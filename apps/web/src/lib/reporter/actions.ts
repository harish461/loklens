'use server'

/**
 * Server actions for the reporter workspace. Each one re-checks the session (checkReporter), accepts only
 * an allow-listed set of fields from the client, verifies ownership, and writes through the Payload local
 * API as the reporter (overrideAccess: false) so collection access rules and the workflow/guard hooks
 * (src/hooks/articles.ts) decide the rest.
 */
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { currentWorkflowStatus, type WorkflowStatus } from '@/access'

import { getMyArticle } from './queries'
import { asReporter, checkReporter, type ReporterSession } from './session'

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type SaveIntent = 'draft' | 'submit' | 'publish'

export interface ArticleInput {
  id?: number
  title: string
  summary: string
  slug?: string
  category?: number | null
  location?: number | null
  tags?: number[]
  featuredImage?: number | null
  body?: unknown
  seo?: { metaTitle?: string; metaDescription?: string; focusKeyword?: string }
  articleType?: string
  language?: string
  featureRequested?: boolean
}

const ARTICLE_TYPES = ['news', 'opinion', 'interview', 'analysis', 'photo_story']
const LANGUAGES = ['hi', 'en']

/** Turns Payload/validation errors into one readable message. */
function errorMessage(err: unknown): string {
  const e = err as { message?: string; data?: { errors?: { message?: string; path?: string }[] } }
  const fieldErrors = e?.data?.errors?.map((x) => (x.path ? `${x.path}: ${x.message}` : x.message)).filter(Boolean)
  if (fieldErrors?.length) return fieldErrors.join(' ')
  return e?.message || 'Something went wrong. Please try again.'
}

async function session(): Promise<ReporterSession | string> {
  const check = await checkReporter()
  if (check.ok) return check.session
  return check.reason === 'inactive' ? 'Your account is deactivated.' : 'Your session has ended. Please sign in again.'
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const id = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null)

/** Allow-list of article fields a reporter may send. Everything else (flags, createdBy, review fields) is dropped. */
function cleanArticle(input: ArticleInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    title: str(input.title, 200),
    summary: str(input.summary, 300),
    category: id(input.category),
    location: id(input.location),
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map(id).filter((x): x is number => x !== null))].slice(0, 20) : [],
    featuredImage: id(input.featuredImage),
    seo: {
      metaTitle: str(input.seo?.metaTitle, 70),
      metaDescription: str(input.seo?.metaDescription, 200),
      focusKeyword: str(input.seo?.focusKeyword, 100),
    },
    articleType: ARTICLE_TYPES.includes(String(input.articleType)) ? input.articleType : 'news',
    language: LANGUAGES.includes(String(input.language)) ? input.language : 'hi',
    featureRequested: Boolean(input.featureRequested),
  }
  const slug = str(input.slug, 120)
  if (slug) data.slug = slug
  if (input.body && typeof input.body === 'object' && 'root' in (input.body as object)) data.body = input.body
  return data
}

function refresh(articleId?: number) {
  revalidatePath('/reporter', 'layout')
  if (articleId) revalidatePath(`/preview/${articleId}`)
}

export async function saveArticle(
  input: ArticleInput,
  intent: SaveIntent,
): Promise<ActionResult<{ id: number; status: WorkflowStatus }>> {
  const s = await session()
  if (typeof s === 'string') return { ok: false, error: s }

  const data = cleanArticle(input)
  if (!data.title) return { ok: false, error: 'Add a headline first.' }

  const publishing = intent === 'publish'
  if (publishing && !s.user.canPublish) {
    return { ok: false, error: 'You do not have permission to publish. Submit the article for review.' }
  }
  if (publishing) data._status = 'published'
  else data.workflowStatus = intent === 'submit' ? 'pending_review' : 'draft'

  try {
    const existingId = id(input.id)
    if (existingId) {
      const existing = await getMyArticle(s, existingId)
      if (!existing) return { ok: false, error: 'Article not found.' }
      if (currentWorkflowStatus(existing as unknown as Record<string, unknown>) === 'published') {
        return { ok: false, error: 'This article is live. Ask an editor to change it.' }
      }
      const doc = await s.payload.update({
        collection: 'articles',
        id: existingId,
        data,
        // Drafts and submissions save as a draft version (required fields are checked on submit by the
        // workflow hook, and on publish by Payload).
        draft: !publishing,
        depth: 0,
        ...asReporter(s),
      })
      refresh(existingId)
      return { ok: true, id: doc.id, status: currentWorkflowStatus(doc as unknown as Record<string, unknown>) }
    }

    const doc = await s.payload.create({
      collection: 'articles',
      data: { ...data, authors: [s.user.id] } as never,
      draft: !publishing,
      depth: 0,
      ...asReporter(s),
    })
    refresh(doc.id)
    return { ok: true, id: doc.id, status: currentWorkflowStatus(doc as unknown as Record<string, unknown>) }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export async function deleteMyArticle(articleId: number): Promise<ActionResult> {
  const s = await session()
  if (typeof s === 'string') return { ok: false, error: s }
  const existing = await getMyArticle(s, Number(articleId))
  if (!existing) return { ok: false, error: 'Article not found.' }
  if (existing.everPublished || existing._status === 'published') {
    return { ok: false, error: 'This article has been published. Only an editor can delete it.' }
  }
  try {
    // The collection's delete rule re-checks ownership and the never-published condition.
    await s.payload.delete({ collection: 'articles', id: existing.id, ...asReporter(s) })
    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/** Updates the media item's alt/caption — only for images this reporter uploaded (collection rule). */
export async function updateMyMedia(
  mediaId: number,
  fields: { alt: string; caption: string },
): Promise<ActionResult> {
  const s = await session()
  if (typeof s === 'string') return { ok: false, error: s }
  const alt = str(fields.alt, 250)
  if (!alt) return { ok: false, error: 'Alt text is required.' }
  try {
    await s.payload.update({
      collection: 'media',
      id: Number(mediaId),
      data: { alt, caption: str(fields.caption, 300) },
      ...asReporter(s),
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export interface ProfileInput {
  name: string
  displayName?: string
  mobile?: string
  designation?: string
  bio?: string
  photo?: number | null
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const s = await session()
  if (typeof s === 'string') return { ok: false, error: s }
  const name = str(input.name, 120)
  if (!name) return { ok: false, error: 'Name is required.' }
  const mobile = str(input.mobile, 20)
  if (mobile && !/^\+?[0-9 ()-]{7,20}$/.test(mobile)) return { ok: false, error: 'Enter a valid mobile number.' }
  try {
    // Only profile fields: role, status, permissions and categories are admin-only (field access).
    await s.payload.update({
      collection: 'users',
      id: s.user.id,
      data: {
        name,
        displayName: str(input.displayName, 120),
        mobile,
        designation: str(input.designation, 80),
        bio: str(input.bio, 600),
        photo: id(input.photo),
      },
      ...asReporter(s),
    })
    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

/** Session id (`sid`) of the request's own token; the token was already verified by payload.auth. */
async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get('payload-token')?.value
  const part = token?.split('.')[1]
  if (!part) return null
  try {
    const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { sid?: unknown }
    return typeof claims.sid === 'string' ? claims.sid : null
  } catch {
    return null
  }
}

export async function changePassword(current: string, next: string): Promise<ActionResult> {
  const s = await session()
  if (typeof s === 'string') return { ok: false, error: s }
  if (typeof next !== 'string' || next.length < 10) {
    return { ok: false, error: 'The new password must be at least 10 characters.' }
  }
  if (next === current) return { ok: false, error: 'Choose a password different from the current one.' }

  // Verify the current password (counts toward Payload's login lockout, so it cannot be brute-forced).
  try {
    await s.payload.login({ collection: 'users', data: { email: s.user.email, password: String(current) } })
  } catch {
    return { ok: false, error: 'The current password is not correct.' }
  }

  try {
    await s.payload.update({ collection: 'users', id: s.user.id, data: { password: next }, ...asReporter(s) })
    // Keep only this browser's session: other devices (and the session the check above created) sign out.
    const sid = await currentSessionId()
    const fresh = await s.payload.findByID({ collection: 'users', id: s.user.id, depth: 0, overrideAccess: true })
    await s.payload.update({
      collection: 'users',
      id: s.user.id,
      data: { sessions: (fresh.sessions ?? []).filter((x) => x.id === sid) },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
