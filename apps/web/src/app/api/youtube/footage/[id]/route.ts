import config from '@payload-config'
import { getPayload } from 'payload'

import { parseRange } from '@/lib/footage/range'
import { readFootageRange } from '@/lib/footage/storage'
import { youtubeStudioEnabled } from '@/lib/youtube/flags'

/**
 * GET /api/youtube/footage/:id — streams private footage for the admin preview player (api-contract §9).
 * Signed-in staff only, and only footage their role may read (editors/admins all, reporters their own): the row
 * is read as the user. Supports HTTP Range across the stored segments; each response is at most 4 MB, so a
 * request stays short (Hostinger / Cloudflare time limits). Never cached, never public.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_CHUNK = 4 * 1024 * 1024
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!youtubeStudioEnabled()) return new Response('Not found', { status: 404, headers: NO_STORE })
  const id = Number((await ctx.params).id)
  if (!Number.isSafeInteger(id) || id <= 0) return new Response('Not found', { status: 404, headers: NO_STORE })

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }))
  if (!user || user.collection !== 'users' || (user as { isActive?: boolean }).isActive === false) {
    return new Response('Unauthorized', { status: 401, headers: NO_STORE })
  }
  const row = await payload.findByID({ collection: 'footage', id, depth: 0, user, overrideAccess: false, disableErrors: true })
  if (!row || row.uploadStatus !== 'uploaded' || !row.storagePrefix || !row.sizeBytes || !row.segmentBytes) {
    return new Response('Not found', { status: 404, headers: NO_STORE })
  }

  const size = Number(row.sizeBytes)
  const range = parseRange(req.headers.get('range'), size, MAX_CHUNK)
  if (range === 'invalid') {
    return new Response('Range not satisfiable', { status: 416, headers: { ...NO_STORE, 'Content-Range': `bytes */${size}` } })
  }
  try {
    const body = await readFootageRange(row.storagePrefix, Number(row.segmentBytes), range.start, range.end)
    return new Response(Buffer.from(body), {
      status: 206,
      headers: {
        ...NO_STORE,
        'Content-Type': row.mimeType || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Content-Length': String(body.length),
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    })
  } catch (err) {
    payload.logger.error({ err }, `[footage-preview] footage ${id}`)
    return new Response('Could not read footage', { status: 502, headers: NO_STORE })
  }
}
