/**
 * Validation for the admin "Create notification" form (pure, unit-tested). The server action re-validates
 * everything the browser sends; nothing from the form is trusted as-is.
 */
import type { NotificationType } from './rules'

export type Audience = 'all' | 'breaking' | 'category'

export interface ManualNotificationInput {
  title?: unknown
  body?: unknown
  imageUrl?: unknown
  type?: unknown
  audience?: unknown
  categoryId?: unknown
  articleId?: unknown
  /** ISO date-time; empty = send now. */
  scheduledAt?: unknown
  /** Random key from the form, so a double click cannot create two notifications. */
  idempotencyKey?: unknown
}

export interface ManualNotification {
  title: string
  body: string
  imageUrl: string | null
  type: NotificationType
  audience: Audience
  categoryId: number | null
  articleId: number | null
  scheduledAt: string | null
  idempotencyKey: string
}

export const TITLE_MAX = 120
export const BODY_MAX = 240
/** Scheduling more than 30 days ahead is almost certainly a typo. */
const MAX_SCHEDULE_MS = 30 * 24 * 60 * 60 * 1000

const positiveInt = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return Number.isInteger(n) && (n as number) > 0 ? (n as number) : null
}

/** Returns the cleaned notification, or a list of problems in plain English. */
export function validateManualNotification(input: ManualNotificationInput, now = new Date()): { ok: true; value: ManualNotification } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  if (!title) errors.push('Add a title.')
  else if (title.length > TITLE_MAX) errors.push(`Keep the title under ${TITLE_MAX} characters.`)
  if (!body) errors.push('Add a message.')
  else if (body.length > BODY_MAX) errors.push(`Keep the message under ${BODY_MAX} characters.`)

  let imageUrl: string | null = null
  if (typeof input.imageUrl === 'string' && input.imageUrl.trim()) {
    const raw = input.imageUrl.trim()
    try {
      const u = new URL(raw)
      if (u.protocol !== 'https:') errors.push('The image URL must start with https://.')
      else if (raw.length > 500) errors.push('The image URL is too long.')
      else imageUrl = u.toString()
    } catch {
      errors.push('The image URL is not a valid address.')
    }
  }

  const type = input.type === 'breaking' || input.type === 'article' || input.type === 'general' ? input.type : null
  if (!type) errors.push('Choose a notification type.')
  const audience = input.audience === 'all' || input.audience === 'breaking' || input.audience === 'category' ? input.audience : null
  if (!audience) errors.push('Choose who should get it.')

  const categoryId = positiveInt(input.categoryId)
  const articleId = positiveInt(input.articleId)
  if (audience === 'category' && !categoryId) errors.push('Choose the category whose subscribers should get it.')
  if (type === 'article' && !articleId) errors.push('Choose the article to open, or use type "General update".')

  let scheduledAt: string | null = null
  if (typeof input.scheduledAt === 'string' && input.scheduledAt.trim()) {
    const t = new Date(input.scheduledAt)
    if (Number.isNaN(t.getTime())) errors.push('The schedule time is not valid.')
    else if (t.getTime() <= now.getTime() + 60_000) errors.push('Schedule at least a minute ahead, or send now.')
    else if (t.getTime() - now.getTime() > MAX_SCHEDULE_MS) errors.push('Schedule at most 30 days ahead.')
    else scheduledAt = t.toISOString()
  }

  const idempotencyKey = typeof input.idempotencyKey === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(input.idempotencyKey) ? input.idempotencyKey : ''
  if (!idempotencyKey) errors.push('The form is out of date. Reload the page and try again.')

  if (errors.length || !type || !audience) return { ok: false, errors }
  return { ok: true, value: { title, body, imageUrl, type, audience, categoryId, articleId, scheduledAt, idempotencyKey } }
}

export const manualDedupeKey = (idempotencyKey: string) => `manual:${idempotencyKey}`
