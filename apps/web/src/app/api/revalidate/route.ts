import { timingSafeEqual } from 'node:crypto'

import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'

import { CACHE_TAG_PATTERN } from '@/lib/revalidate/tags'

/**
 * Internal endpoint used by Payload jobs (which run outside a Next request) to expire cache tags.
 * Auth: `x-revalidate-secret` header must equal REVALIDATE_SECRET. Not part of the public v1 API.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_TAGS = 100

function secretMatches(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get('x-revalidate-secret'))) {
    return error(401, 'UNAUTHORIZED', 'Invalid secret.')
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return error(400, 'BAD_REQUEST', 'Body must be JSON.')
  }
  const tags = (body as { tags?: unknown })?.tags
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.length > MAX_TAGS ||
    !tags.every((t) => typeof t === 'string' && CACHE_TAG_PATTERN.test(t))
  ) {
    return error(400, 'BAD_REQUEST', `"tags" must be 1-${MAX_TAGS} valid cache tags.`)
  }
  for (const tag of new Set(tags as string[])) revalidateTag(tag, { expire: 0 })
  return NextResponse.json({ revalidated: tags.length }, { headers: { 'Cache-Control': 'no-store' } })
}
