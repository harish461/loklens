import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'

import { isAdmin, isEditorOrAdmin, type MaybeUser } from '@/access'
import { getGlobalSeoSettings, saveGlobalSeoSettings, type GlobalSeoSettings } from '@/lib/seo/settings'

/**
 * Admin SEO settings (used by /admin/seo). Not a public endpoint:
 * - GET: editors and admins (the view is in the editor sidebar)
 * - POST: admins only — it writes the site-settings global (admin-only in Payload) and the
 *   Google site-verification tag, which controls Search Console ownership.
 */
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

const STRING_FIELDS = [
  'titleSuffix',
  'homeMetaTitle',
  'homeMetaDescription',
  'defaultOgImageUrl',
  'googleSiteVerification',
] as const

async function currentUser(request: Request): Promise<MaybeUser> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers }).catch(() => ({ user: null }))
  return user as MaybeUser
}

function deny(user: MaybeUser) {
  return user
    ? NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403, headers: NO_STORE })
    : NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401, headers: NO_STORE })
}

const badRequest = (error: string) => NextResponse.json({ ok: false, error }, { status: 400, headers: NO_STORE })

export async function GET(request: Request) {
  const user = await currentUser(request)
  if (!isEditorOrAdmin(user)) return deny(user)

  const settings = await getGlobalSeoSettings()
  return NextResponse.json({ ok: true, settings }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const user = await currentUser(request)
  if (!isAdmin(user)) return deny(user)

  let body: Partial<GlobalSeoSettings>
  try {
    body = (await request.json()) as Partial<GlobalSeoSettings>
  } catch {
    return badRequest('Body must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Body must be a JSON object.')
  for (const field of STRING_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== 'string') return badRequest(`"${field}" must be text.`)
  }
  if (
    body.defaultOgImageId !== undefined &&
    body.defaultOgImageId !== null &&
    !(Number.isInteger(body.defaultOgImageId) && body.defaultOgImageId > 0)
  ) {
    return badRequest('"defaultOgImageId" must be a positive integer or null.')
  }
  if (body.categories !== undefined) {
    const valid =
      body.categories !== null &&
      typeof body.categories === 'object' &&
      !Array.isArray(body.categories) &&
      Object.values(body.categories).every(
        (entry) =>
          entry !== null &&
          typeof entry === 'object' &&
          typeof entry.metaTitle === 'string' &&
          typeof entry.metaDescription === 'string',
      )
    if (!valid) return badRequest('"categories" must map slugs to { metaTitle, metaDescription } text.')
  }

  try {
    const updated = await saveGlobalSeoSettings(body)
    return NextResponse.json({ ok: true, settings: updated }, { headers: NO_STORE })
  } catch (err) {
    console.error('[LokLens Admin SEO API] Failed to save SEO settings:', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to save global SEO settings.' },
      { status: 500, headers: NO_STORE },
    )
  }
}
