import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'

/**
 * Draft preview endpoint (architecture §4).
 * Enables Next.js draftMode when PREVIEW_SECRET matches (or when a signed-in staff user opens preview)
 * and redirects to the article's canonical path.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  const secret = searchParams.get('secret') ?? ''
  const expectedSecret = process.env.PREVIEW_SECRET ?? ''

  if (!Number.isInteger(id) || id <= 0) {
    return new Response('Invalid article id', { status: 400 })
  }

  const payload = await getPayload({ config })
  const authResult = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }))
  const isAuthorized =
    Boolean(authResult.user) || (Boolean(expectedSecret) && secret === expectedSecret)

  if (!isAuthorized) {
    return new Response('Unauthorized preview request', { status: 401 })
  }

  const article = await payload
    .findByID({
      collection: 'articles',
      id,
      depth: 1,
      draft: true,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!article) {
    redirect('/')
  }

  const catSlug =
    article.category && typeof article.category === 'object' && 'slug' in article.category
      ? String((article.category as { slug: unknown }).slug)
      : 'pradesh'
  const slug = typeof article.slug === 'string' && article.slug ? article.slug : `article-${id}`

  const draft = await draftMode()
  draft.enable()

  redirect(`/${catSlug}/${slug}-${id}`)
}

