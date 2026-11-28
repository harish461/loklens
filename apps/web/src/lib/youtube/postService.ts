/**
 * YouTube Studio post workflow (server side): save, submit, withdraw, reject, approve, cancel, retry.
 * Every write goes through Payload AS THE USER (overrideAccess: false), so collection access and the guard
 * (access/youtube.ts) decide; the checks here only give clearer messages. Each step appends a
 * youtube-post-events row. Approval locks the footage (no retention while in use); cancelling releases it.
 */
import type { Payload } from 'payload'

import { isAdmin, isEditorOrAdmin, type MaybeUser } from '@/access'
import type { User, YoutubePost } from '@/payload-types'

import { checklistComplete, cleanPostInput, type PostFormInput, type ReviewChecklist } from './postInput'

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

type EventType = 'created' | 'submitted' | 'rejected' | 'approved' | 'cancelled' | 'retried'

const DAY_MS = 24 * 3600 * 1000
const as = (user: User) => ({ user, overrideAccess: false as const })
const roleOf = (user: User) => user as unknown as MaybeUser
const relId = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  return typeof raw === 'number' ? raw : null
}

/** Payload/guard errors → one readable message. */
export function errorText(err: unknown): string {
  const e = err as { message?: string; data?: { errors?: { message?: string; path?: string }[] } }
  const details = e?.data?.errors?.map((x) => (x.path ? `${x.path}: ${x.message}` : x.message)).filter(Boolean)
  return details?.length ? details.join(' ') : e?.message || 'कुछ गलत हो गया।'
}

async function logEvent(payload: Payload, postId: number, type: EventType, actor: User, detail?: Record<string, unknown>) {
  await payload.create({
    collection: 'youtube-post-events',
    data: { post: postId, type, actor: actor.id, detail: detail ?? null },
    overrideAccess: true,
  })
}

async function load(payload: Payload, user: User, id: unknown): Promise<YoutubePost | null> {
  const postId = typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null
  if (!postId) return null
  return (await payload.findByID({ collection: 'youtube-posts', id: postId, depth: 0, disableErrors: true, ...as(user) })) as YoutubePost | null
}

/** Footage used by an approved post must not expire; release it again when no active post uses it. */
async function lockFootage(payload: Payload, footageId: number | null) {
  if (!footageId) return
  await payload.update({ collection: 'footage', id: footageId, data: { lockedAt: new Date().toISOString(), retainUntil: null }, overrideAccess: true })
}

async function releaseFootage(payload: Payload, footageId: number | null, exceptPostId: number) {
  if (!footageId) return
  const active = await payload.count({
    collection: 'youtube-posts',
    where: {
      and: [
        { footage: { equals: footageId } },
        { id: { not_equals: exceptPostId } },
        { status: { in: ['approved', 'uploading', 'processing', 'scheduled', 'failed'] } },
      ],
    },
    overrideAccess: true,
  })
  if (active.totalDocs > 0) return
  const s = await payload.findGlobal({ slug: 'youtube-settings', overrideAccess: true, depth: 0 })
  const days = Math.max(1, Number(s.footageRetentionDays) || 30)
  await payload.update({
    collection: 'footage',
    id: footageId,
    data: { lockedAt: null, retainUntil: new Date(Date.now() + days * DAY_MS).toISOString() },
    overrideAccess: true,
  })
}

/** Create (status draft) or update a post's details. Never changes the status (except the guard's own reset). */
export async function savePost(payload: Payload, user: User, input: PostFormInput & { id?: unknown }): Promise<Result<{ id: number; status: string }>> {
  if (!isEditorOrAdmin(roleOf(user))) return { ok: false, error: 'केवल संपादक और एडमिन यूट्यूब पोस्ट बना सकते हैं।' }
  const { data, errors } = cleanPostInput(input)
  if (errors.length) return { ok: false, error: errors.join(' ') }
  try {
    if (input.id !== undefined && input.id !== null) {
      const existing = await load(payload, user, input.id)
      if (!existing) return { ok: false, error: 'पोस्ट नहीं मिली।' }
      const doc = await payload.update({ collection: 'youtube-posts', id: existing.id, data, ...as(user) })
      // The guard sends an approved post back to review when what goes to YouTube changed.
      if (existing.status !== doc.status) {
        await logEvent(payload, doc.id, 'submitted', user, { from: existing.status, to: doc.status, reason: 'edited after approval' })
      }
      return { ok: true, id: doc.id, status: doc.status }
    }
    // cleanPostInput always sets postType and privacyStatus (the required fields).
    const createData = { ...data, status: 'draft' } as unknown as Omit<YoutubePost, 'id' | 'createdAt' | 'updatedAt'>
    const doc = await payload.create({ collection: 'youtube-posts', data: createData, ...as(user) })
    await logEvent(payload, doc.id, 'created', user)
    return { ok: true, id: doc.id, status: doc.status }
  } catch (err) {
    return { ok: false, error: errorText(err) }
  }
}

export type PostAction = 'submit' | 'withdraw' | 'reject' | 'approve' | 'cancel' | 'retry'

export async function changePostStatus(
  payload: Payload,
  user: User,
  id: unknown,
  action: PostAction,
  opts: { note?: unknown; checklist?: ReviewChecklist } = {},
): Promise<Result<{ status: string }>> {
  if (!isEditorOrAdmin(roleOf(user))) return { ok: false, error: 'अनुमति नहीं है।' }
  const post = await load(payload, user, id)
  if (!post) return { ok: false, error: 'पोस्ट नहीं मिली।' }
  const admin = isAdmin(roleOf(user))
  const note = typeof opts.note === 'string' ? opts.note.trim().slice(0, 1000) : ''

  let data: Record<string, unknown>
  let event: EventType
  switch (action) {
    case 'submit':
      data = { status: 'pending_review', reviewNote: null }
      event = 'submitted'
      break
    case 'withdraw':
      data = { status: 'draft' }
      event = 'rejected'
      break
    case 'reject':
      if (!admin) return { ok: false, error: 'केवल एडमिन लौटा सकते हैं।' }
      if (!note) return { ok: false, error: 'लौटाने का कारण लिखें।' }
      data = { status: 'draft', reviewNote: note }
      event = 'rejected'
      break
    case 'approve':
    case 'retry':
      if (!admin) return { ok: false, error: 'केवल एडमिन मंज़ूरी दे सकते हैं।' }
      if (!checklistComplete(opts.checklist)) return { ok: false, error: 'मंज़ूरी से पहले जांच-सूची के सभी बिंदु चुनें।' }
      data = { status: 'approved', ...(note ? { reviewNote: note } : {}) }
      event = action === 'approve' ? 'approved' : 'retried'
      break
    case 'cancel':
      data = { status: 'cancelled' }
      event = 'cancelled'
      break
    default:
      return { ok: false, error: 'अज्ञात कार्रवाई।' }
  }

  try {
    const doc = await payload.update({ collection: 'youtube-posts', id: post.id, data, ...as(user) })
    await logEvent(payload, doc.id, event, user, {
      from: post.status,
      to: doc.status,
      ...(action === 'withdraw' ? { withdrawn: true } : {}),
      ...(note ? { note } : {}),
    })
    if (doc.status === 'approved') await lockFootage(payload, relId(doc.footage))
    if (doc.status === 'cancelled') await releaseFootage(payload, relId(doc.footage), doc.id)
    return { ok: true, status: doc.status }
  } catch (err) {
    return { ok: false, error: errorText(err) }
  }
}
