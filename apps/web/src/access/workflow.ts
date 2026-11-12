/**
 * Article review workflow (architecture §8, "Reporter workspace"). Pure functions, no Payload imports,
 * so they can be unit-tested. The Payload hooks in src/hooks/articles.ts call these.
 *
 *   draft ──submit──▶ pending_review ──approve──▶ published
 *     ▲                   │  ▲                       │
 *     └────withdraw───────┘  └──resubmit── rejected ◀┘ (editor rejects with a note)
 *
 * `workflowStatus` is the editorial state; Payload's `_status` (draft/published) stays the source of truth
 * for what the public sees, and the two are kept in sync here.
 */
import { isEditorOrAdmin, isReporter, sameId, type MaybeUser } from './roles'

export const WORKFLOW_STATUSES = ['draft', 'pending_review', 'rejected', 'published'] as const
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  rejected: 'Rejected',
  published: 'Published',
}

/** Set only by the workflow hook or by editors; reporters may never send them. */
export const REVIEW_FIELDS = ['reviewNote', 'reviewedAt', 'reviewedBy', 'submittedAt', 'everPublished'] as const

/** Statuses a reporter may move their own article to (published only with the canPublish permission). */
export const REPORTER_TARGETS: readonly WorkflowStatus[] = ['draft', 'pending_review']

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return typeof value === 'string' && (WORKFLOW_STATUSES as readonly string[]).includes(value)
}

type Doc = Record<string, unknown> | null | undefined

/** Current workflow state of a stored article; older rows without the field fall back to `_status`. */
export function currentWorkflowStatus(doc: Doc): WorkflowStatus {
  if (isWorkflowStatus(doc?.workflowStatus)) return doc.workflowStatus
  return doc?._status === 'published' ? 'published' : 'draft'
}

/** Relationship value → id (number/string), whether populated or not. */
export function relationId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return null
}

function changed(incoming: unknown, current: unknown): boolean {
  const a = relationId(incoming) ?? incoming ?? null
  const b = relationId(current) ?? current ?? null
  if (a instanceof Date || b instanceof Date || typeof a === 'string' || typeof b === 'string') {
    return String(a ?? '') !== String(b ?? '')
  }
  return a !== b
}

export interface ReporterPermissions {
  /** Admin-granted: this reporter may publish directly. Read from the database, not the token. */
  canPublish?: boolean | null
  /** Admin-assigned categories; empty = any category. */
  assignedCategories?: unknown[] | null
  isActive?: boolean | null
}

/**
 * Workflow rules for reporters (editors/admins and trusted calls without a user are never limited here).
 * Returns human-readable violations; empty = allowed.
 */
export function reporterWorkflowViolations(input: {
  user: MaybeUser
  data: Record<string, unknown>
  originalDoc?: Doc
  permissions?: ReporterPermissions | null
}): string[] {
  const { user, data, originalDoc, permissions } = input
  if (!user || !isReporter(user)) return []
  const violations: string[] = []
  const canPublish = Boolean(permissions?.canPublish)

  if (permissions?.isActive === false) violations.push('This account is deactivated.')

  if (originalDoc && !sameId(relationId(originalDoc.createdBy), user.id)) {
    violations.push('Reporters can only change their own articles.')
  }

  if ('workflowStatus' in data && data.workflowStatus !== undefined) {
    const target = data.workflowStatus
    if (!isWorkflowStatus(target)) violations.push('Unknown workflow status.')
    else if (target === 'published' && !canPublish) {
      violations.push('Reporters cannot publish. Submit the article for review.')
    } else if (target !== 'published' && !REPORTER_TARGETS.includes(target) && target !== currentWorkflowStatus(originalDoc)) {
      violations.push('Only an editor can reject an article.')
    }
  }

  for (const field of REVIEW_FIELDS) {
    if (field in data && changed(data[field], originalDoc?.[field])) {
      violations.push(`Reporters cannot change "${field}".`)
    }
  }

  const assigned = (permissions?.assignedCategories ?? []).map(relationId).filter((id) => id !== null)
  if (assigned.length > 0) {
    const category = relationId(data.category ?? originalDoc?.category)
    if (category !== null && !assigned.some((id) => sameId(id, category))) {
      violations.push('You can only file articles in your assigned categories.')
    }
  }
  return violations
}

/** True when a Lexical value has any visible text or an upload. */
export function hasBodyContent(body: unknown): boolean {
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const n = node as { type?: string; text?: unknown; children?: unknown[] }
    if (n.type === 'upload' || n.type === 'block') return true
    if (typeof n.text === 'string' && n.text.trim() !== '') return true
    return Array.isArray(n.children) && n.children.some(walk)
  }
  return walk((body as { root?: unknown } | null | undefined)?.root)
}

/**
 * An article must be complete before it goes to an editor: title, summary, category, body and a
 * featured image (publishing needs the image anyway). Checked on the merged (stored + incoming) doc.
 */
export function submissionViolations(doc: Record<string, unknown>): string[] {
  const violations: string[] = []
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  if (!text(doc.title)) violations.push('Add a headline.')
  if (!text(doc.summary)) violations.push('Add a short summary.')
  if (relationId(doc.category) === null) violations.push('Choose a category.')
  if (!hasBodyContent(doc.body)) violations.push('Write the article body.')
  if (relationId(doc.featuredImage) === null) violations.push('Add a featured image.')
  return violations
}

export interface WorkflowResult {
  /** Fields to merge into the incoming data. */
  patch: Record<string, unknown>
  violations: string[]
}

/**
 * Derives the workflow fields for a create/update and keeps them in sync with `_status`.
 * - publishing (`_status: published`, or `workflowStatus: published`) → published, everPublished
 * - unpublishing a published article without a target → draft
 * - rejecting → needs a review note, forces `_status: draft`
 * - entering pending_review → stamps submittedAt; approving/rejecting → stamps reviewedAt/By
 */
export function workflowPatch(input: {
  user: MaybeUser
  data: Record<string, unknown>
  originalDoc?: Doc
  now?: Date
}): WorkflowResult {
  const { user, data, originalDoc } = input
  const now = (input.now ?? new Date()).toISOString()
  const previous = currentWorkflowStatus(originalDoc)
  const requested = isWorkflowStatus(data.workflowStatus) ? data.workflowStatus : undefined
  const patch: Record<string, unknown> = {}
  const violations: string[] = []

  let next: WorkflowStatus
  if (data._status === 'published' || requested === 'published') {
    next = 'published'
    if (data._status !== 'published') patch._status = 'published'
  } else if (requested) {
    next = requested
  } else if (data._status === 'draft' && previous === 'published') {
    next = 'draft'
  } else {
    next = originalDoc ? previous : 'draft'
  }

  // A non-published workflow state always means the public sees no live version of this save.
  if (next !== 'published' && data._status === 'published') patch._status = 'draft'
  if (next !== 'published' && previous === 'published' && data._status === undefined) patch._status = 'draft'

  if (next === 'rejected') {
    const note = data.reviewNote ?? originalDoc?.reviewNote
    if (typeof note !== 'string' || note.trim() === '') {
      violations.push('Add a reason for the reporter when rejecting an article.')
    }
    patch._status = 'draft'
  }

  if (next === 'pending_review' && previous !== 'pending_review') {
    patch.submittedAt = now
    violations.push(...submissionViolations({ ...(originalDoc ?? {}), ...data }))
  }

  if ((next === 'rejected' || next === 'published') && previous !== next && user && isEditorOrAdmin(user)) {
    patch.reviewedAt = now
    patch.reviewedBy = user.id
  }

  patch.workflowStatus = next
  patch.everPublished = Boolean(originalDoc?.everPublished) || next === 'published'
  return { patch, violations }
}
