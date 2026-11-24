import { parseInteger } from '@/lib/data/params'
import { getYouTubeShorts } from '@/lib/social'

import { failure, numberParam, ok, preflight, unavailable } from '../_lib/http'

/**
 * GET /api/v1/shorts?limit= → { items: Short[] } — newest YouTube Shorts of the LokLens channel, read from
 * YouTube's public Shorts feed (no API key) by the same helper as the website (contract §2, §3).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams
    const limit = parseInteger(numberParam(query, 'limit'), 'limit', { min: 1, max: 50, fallback: 20 })
    const feed = await getYouTubeShorts(limit)
    if (feed.status !== 'ok') return unavailable('YouTube feed is unavailable.')
    const items = feed.posts.map(({ id, title, url, thumbnail, publishedAt }) => ({ id, title, url, thumbnail, publishedAt }))
    return ok({ items }, 'shorts')
  } catch (err) {
    return failure(err)
  }
}

export const OPTIONS = preflight
