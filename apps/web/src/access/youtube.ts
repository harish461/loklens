/**
 * YouTube Studio rules (docs/youtube-studio-plan.md §6–7, api-contract.md §9). Pure functions with no Payload
 * imports, so they can be unit-tested. The thin hook adapters live in src/hooks/youtube.ts.
 *
 * Who may do what:
 * - editors and admins write posts; only admins approve;
 * - only the publisher job (req.context.youtubeJob) moves a post to uploading/processing/scheduled/published/failed;
 * - approval is stamped with a hash of everything that goes to YouTube; any later change to those fields sends
 *   the post back to review, and the job re-checks the hash on the STORED document before it uploads (jobs run
 *   without a user, so the stored state, not req.user, is the proof of approval).
 */
import { createHash } from 'node:crypto'

import type { Where } from 'payload'

import { isAdmin, isEditorOrAdmin, isReporter, isStaff, type MaybeUser } from './roles'
import { tagsLength, YT_JOB_STATUSES, YT_LIMITS, YT_LOCKED_STATUSES, YT_POST_STATUSES, type YtPostStatus } from './youtubeLimits'

// ---- Statuses (constants shared with the browser live in ./youtubeLimits) ----------------------------------

export { tagsLength, YT_JOB_STATUSES, YT_LIMITS, YT_LOCKED_STATUSES, YT_POST_STATUSES, type YtPostStatus } from './youtubeLimits'

/** Editorial moves (editors and admins). `approved` targets are additionally admin-only. */
const EDITOR_MOVES: Record<YtPostStatus, readonly YtPostStatus[]> = {
  draft: ['draft', 'pending_review', 'cancelled'],
  pending_review: ['pending_review', 'draft', 'approved', 'cancelled'],
  approved: ['approved', 'pending_review', 'cancelled'],
  failed: ['failed', 'approved', 'cancelled'],
  uploading: ['uploading'],
  processing: ['processing'],
  scheduled: ['scheduled'],
  published: ['published'],
  cancelled: ['cancelled'],
}

/** Publisher job moves. */
const JOB_MOVES: Record<YtPostStatus, readonly YtPostStatus[]> = {
  draft: ['draft'],
  pending_review: ['pending_review'],
  approved: ['approved', 'uploading', 'failed'],
  uploading: ['uploading', 'processing', 'failed'],
  processing: ['processing', 'scheduled', 'published', 'failed'],
  scheduled: ['scheduled', 'published', 'failed'],
  published: ['published'],
  failed: ['failed'],
  cancelled: ['cancelled'],
}

export function isYtStatus(value: unknown): value is YtPostStatus {
  return typeof value === 'string' && (YT_POST_STATUSES as readonly string[]).includes(value)
}

// ---- YouTube limits -------------------------------------------------------------------------------------------

export interface YtMetadata {
  title?: unknown
  description?: unknown
  tags?: unknown
  hashtags?: unknown
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Problems with the text that goes to YouTube. Empty = OK. `requireTitle` is used on submit and approve. */
export function youtubeMetadataProblems(meta: YtMetadata, { requireTitle = false } = {}): string[] {
  const problems: string[] = []
  const title = typeof meta.title === 'string' ? meta.title.trim() : ''
  if (requireTitle && !title) problems.push('A title is required.')
  if ([...title].length > YT_LIMITS.titleChars) problems.push(`The title is longer than ${YT_LIMITS.titleChars} characters.`)
  if (/[<>]/.test(title)) problems.push('The title cannot contain < or >.')
  const description = typeof meta.description === 'string' ? meta.description : ''
  // The publisher appends the hashtags to the description (lib/youtube/publishPlan.ts fullDescription).
  const hashtagLine = strings(meta.hashtags).join(' ')
  const sent = hashtagLine ? `${description.trim()}${description.trim() ? '\n\n' : ''}${hashtagLine}` : description
  const bytes = Buffer.byteLength(sent, 'utf8')
  if (bytes > YT_LIMITS.descriptionBytes) {
    problems.push(`The description (with hashtags) is ${bytes} bytes; YouTube allows ${YT_LIMITS.descriptionBytes} (about 1600 Hindi characters).`)
  }
  if (/[<>]/.test(description)) problems.push('The description cannot contain < or >.')
  const tags = strings(meta.tags)
  if (tagsLength(tags) > YT_LIMITS.tagsChars) problems.push(`The tags are longer than ${YT_LIMITS.tagsChars} characters in total.`)
  if (tags.some((t) => /[<>,]/.test(t))) problems.push('Tags cannot contain <, > or commas.')
  const hashtags = strings(meta.hashtags)
  if (hashtags.length > YT_LIMITS.hashtags) problems.push(`At most ${YT_LIMITS.hashtags} hashtags (YouTube ignores all of them above that).`)
  for (const h of hashtags) {
    if (!/^#[^\s#<>]+$/u.test(h)) problems.push(`"${h.slice(0, 30)}" is not a valid hashtag (start with #, no spaces).`)
  }
  return problems
}

// ---- Footage --------------------------------------------------------------------------------------------------

export type Orientation = 'landscape' | 'vertical' | 'square'

export function orientationOf(width: unknown, height: unknown): Orientation | null {
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return null
  if (width === height) return 'square'
  return width > height ? 'landscape' : 'vertical'
}

export interface FootageFacts {
  uploadStatus?: unknown
  durationSeconds?: unknown
  width?: unknown
  height?: unknown
}

/** Problems with the footage for a post type. Unknown size/duration only block a Short. */
export function footageProblems(postType: unknown, footage: FootageFacts | null | undefined): string[] {
  if (!footage) return ['Choose the footage for this post.']
  if (footage.uploadStatus !== 'uploaded') return ['The footage has not finished uploading.']
  if (postType !== 'short') return []
  const problems: string[] = []
  const o = orientationOf(footage.width, footage.height)
  if (o === null) problems.push('The footage size is unknown, so it cannot be checked as a Short.')
  else if (o === 'landscape') problems.push('A Short must be vertical or square.')
  const d = footage.durationSeconds
  if (typeof d !== 'number' || d <= 0) problems.push('The footage length is unknown, so it cannot be checked as a Short.')
  else if (d > YT_LIMITS.shortMaxSeconds) problems.push('A Short can be at most 3 minutes long.')
  return problems
}

/** Read rule for footage: editors/admins all, reporters their own, everyone else nothing. */
export function readFootage(user: MaybeUser): boolean | Where {
  if (isEditorOrAdmin(user)) return true
  if (isReporter(user) && user) return { createdBy: { equals: user.id } }
  return false
}

/** Update rule for footage: editors/admins all; reporters only their own, until a post approval locks it. */
export function updateFootage(user: MaybeUser): boolean | Where {
  if (isEditorOrAdmin(user)) return true
  if (isReporter(user) && user) {
    return { and: [{ createdBy: { equals: user.id } }, { lockedAt: { exists: false } }] }
  }
  return false
}

export function createFootage(user: MaybeUser): boolean {
  return isStaff(user)
}

// ---- Approval hash ----------------------------------------------------------------------------------------------

/** Everything that decides what goes to YouTube. Changing any of these after approval needs a new approval. */
export const YT_APPROVAL_FIELDS = [
  'postType',
  'footage',
  'thumbnail',
  'title',
  'description',
  'tags',
  'hashtags',
  'categoryId',
  'defaultLanguage',
  'privacyStatus',
  'publishAt',
  'notifySubscribers',
  'madeForKids',
  'containsSyntheticMedia',
] as const

const relId = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'object') return relId((v as { id?: unknown }).id)
  return String(v)
}

const timeOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null
  const t = new Date(v as string).getTime()
  return Number.isNaN(t) ? String(v) : new Date(t).toISOString()
}

function normalizeForHash(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    postType: doc.postType ?? 'video',
    footage: relId(doc.footage),
    thumbnail: relId(doc.thumbnail),
    title: typeof doc.title === 'string' ? doc.title.trim() : '',
    description: typeof doc.description === 'string' ? doc.description : '',
    tags: strings(doc.tags),
    hashtags: strings(doc.hashtags),
    categoryId: doc.categoryId ?? null,
    defaultLanguage: doc.defaultLanguage ?? null,
    privacyStatus: doc.privacyStatus ?? null,
    publishAt: timeOrNull(doc.publishAt),
    notifySubscribers: Boolean(doc.notifySubscribers),
    madeForKids: Boolean(doc.madeForKids),
    containsSyntheticMedia: Boolean(doc.containsSyntheticMedia),
  }
}

/** sha256 of the approval fields, in a fixed order. Relationship objects and IDs hash the same. */
export function approvalHash(doc: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(normalizeForHash(doc))).digest('hex')
}

/** True when the stored post is still exactly what an admin approved (checked by the job before uploading). */
export function approvalStillValid(stored: Record<string, unknown> | null | undefined): boolean {
  if (!stored || !stored.approvedAt || typeof stored.approvedHash !== 'string') return false
  return stored.approvedHash === approvalHash(stored)
}

// ---- Change planner ---------------------------------------------------------------------------------------------

/** Fields only the publisher job writes. Anyone else's values are replaced by the stored ones. */
export const YT_JOB_FIELDS = [
  'youtubeVideoId',
  'youtubeUrl',
  'uploadSessionUri',
  'bytesUploaded',
  'leaseUntil',
  'attempts',
  'lastError',
  'uploadStartedAt',
  'publishedAt',
  'nextCheckAt',
  'thumbnailSetAt',
] as const

/** Fields this planner stamps. Clients can never set them. */
export const YT_STAMP_FIELDS = ['submittedBy', 'submittedAt', 'approvedBy', 'approvedAt', 'approvedHash'] as const

export interface YtChangeInput {
  user: MaybeUser
  /** True only for calls from the publisher job (req.context.youtubeJob). */
  isJob: boolean
  operation: 'create' | 'update'
  data: Record<string, unknown>
  /** Stored document (update only). */
  originalDoc?: Record<string, unknown> | null
  /** The selected footage's facts, loaded by the hook when a post is submitted or approved. */
  footage?: FootageFacts | null
  now?: Date
}

export interface YtChangePlan {
  violations: string[]
  /** Values to merge into `data` (stamps, restored job fields, the resulting status). */
  set: Record<string, unknown>
}

/**
 * Decides what a change to a youtube-posts document may do. Returns violations (empty = allowed) and the values
 * to write on top of the incoming data.
 */
export function planYoutubePostChange({ user, isJob, operation, data, originalDoc, footage, now = new Date() }: YtChangeInput): YtChangePlan {
  const violations: string[] = []
  const set: Record<string, unknown> = {}
  const stored = operation === 'update' ? (originalDoc ?? {}) : {}
  const merged: Record<string, unknown> = { ...stored, ...data }

  const from: YtPostStatus | null = operation === 'update' ? (isYtStatus(stored.status) ? stored.status : 'draft') : null
  const requested = data.status === undefined ? (from ?? 'draft') : data.status
  if (!isYtStatus(requested)) return { violations: ['Unknown status.'], set }
  let to: YtPostStatus = requested

  // Who: the job, or editors/admins. Requests without a user that are not the job are refused, so a stray
  // overrideAccess call cannot skip approval.
  if (!isJob && !isEditorOrAdmin(user)) {
    return { violations: ['Only editors and admins can change YouTube posts.'], set }
  }

  // Job-owned and stamped fields: never taken from a non-job client.
  if (!isJob) {
    for (const f of YT_JOB_FIELDS) set[f] = stored[f] ?? null
  }
  for (const f of YT_STAMP_FIELDS) set[f] = stored[f] ?? null

  const changedApproval = operation === 'update' && approvalHash(merged) !== approvalHash(stored)

  if (operation === 'create') {
    if (isJob) violations.push('The publisher job cannot create posts.')
    if (to !== 'draft' && to !== 'pending_review') violations.push('A new post starts as a draft or is submitted for review.')
  } else if (from) {
    if (isJob) {
      if (!JOB_MOVES[from].includes(to)) violations.push(`The job cannot move a post from ${from} to ${to}.`)
      if (changedApproval) violations.push('The job cannot change what was approved.')
      if (from === 'approved' && to === 'uploading' && !approvalStillValid(stored)) {
        violations.push('The approval no longer matches this post; it needs a new approval.')
      }
    } else {
      if (YT_LOCKED_STATUSES.includes(from) && changedApproval) {
        violations.push('This post has already gone to YouTube (or was cancelled); its details can no longer be changed here.')
      }
      // An edit to an approved (or failed) post goes back to review instead of keeping a stale approval.
      if ((from === 'approved' || from === 'failed') && changedApproval && to !== 'cancelled') {
        to = 'pending_review'
      }
      if (!EDITOR_MOVES[from].includes(to)) violations.push(`A post cannot move from ${from} to ${to}.`)
      if (YT_JOB_STATUSES.includes(to) && to !== from) violations.push('Only the publisher can set this status.')
    }
  }

  // Entering review: stamp who submitted, and check the content.
  if (to === 'pending_review' && from !== 'pending_review' && !isJob) {
    violations.push(...youtubeMetadataProblems(merged, { requireTitle: true }), ...footageProblems(merged.postType, footage))
    set.submittedBy = user?.id ?? null
    set.submittedAt = now.toISOString()
    set.approvedBy = null
    set.approvedAt = null
    set.approvedHash = null
  }

  // Approval (admins only): stamp who, when and exactly what.
  if (to === 'approved' && from !== 'approved' && !isJob) {
    if (!isAdmin(user)) violations.push('Only admins can approve a YouTube post.')
    violations.push(...youtubeMetadataProblems(merged, { requireTitle: true }), ...footageProblems(merged.postType, footage))
    if (merged.privacyStatus !== 'public' && merged.privacyStatus !== 'unlisted' && merged.privacyStatus !== 'private') {
      violations.push('Choose who can see the video (public, unlisted or private).')
    }
    const publishAt = timeOrNull(merged.publishAt)
    if (publishAt && new Date(publishAt).getTime() <= now.getTime()) violations.push('The scheduled time must be in the future.')
    set.approvedBy = user?.id ?? null
    set.approvedAt = now.toISOString()
    set.approvedHash = approvalHash(merged)
  }

  // Leaving review back to draft (rejection or withdrawal) clears the submission.
  if (to === 'draft' && from === 'pending_review') {
    set.submittedBy = null
    set.submittedAt = null
  }

  // Free-form edits must still respect YouTube's limits (title can be empty while drafting).
  if (!isJob) violations.push(...youtubeMetadataProblems(merged))

  set.status = to
  return { violations: [...new Set(violations)], set }
}
