/**
 * Shared HTTP layer for the public mobile API (docs/api-contract.md §2–§3).
 *
 * Routes are thin: parse the query, call a `@/lib/data` helper, return its contract shape. The helpers
 * already enforce published-only reads, parameter validation and server-side caching; this file adds the
 * HTTP concerns: status codes, ApiError bodies, Cache-Control and CORS. v1 is read-only (GET/OPTIONS).
 * (`_lib` is a private folder: Next.js never routes it.)
 */
import { toApiError, type ApiError } from '@/lib/data'

export const CACHE_CONTROL = {
  /** Contract §3: normal v1 GETs. */
  default: 'public, s-maxage=60, stale-while-revalidate=300',
  /** Contract §3: search is cached for a shorter time at the edge. */
  search: 'public, s-maxage=30, stale-while-revalidate=60',
  /** YouTube Shorts list (the upstream feed itself refreshes every few minutes). */
  shorts: 'public, s-maxage=300, stale-while-revalidate=600',
  /** Errors are never cached. */
  none: 'no-store',
} as const

export type CacheProfile = keyof typeof CACHE_CONTROL

/** CORS for read-only public data: any origin, GET and OPTIONS only. */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Access-Control-Max-Age': '86400',
} as const

function json(status: number, body: unknown, cacheControl: string): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': cacheControl },
  })
}

export function ok(body: unknown, cache: CacheProfile = 'default'): Response {
  return json(200, body, CACHE_CONTROL[cache])
}

export function notFound(message = 'Not found.'): Response {
  const body: ApiError = { error: { code: 'NOT_FOUND', message } }
  return json(404, body, CACHE_CONTROL.none)
}

/** An upstream dependency (e.g. the YouTube feed) is unavailable → 503 SERVER_ERROR, never cached. */
export function unavailable(message: string): Response {
  const body: ApiError = { error: { code: 'SERVER_ERROR', message } }
  return json(503, body, CACHE_CONTROL.none)
}

/** Maps a thrown error to the contract's ApiError (BadRequestError → 400, anything else → generic 500). */
export function failure(err: unknown): Response {
  const { status, body } = toApiError(err)
  if (status === 500) console.error('[LokLens API v1] Unhandled error:', err)
  return json(status, body, CACHE_CONTROL.none)
}

/** CORS preflight. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } })
}

// ---- query helpers --------------------------------------------------------------------------------

/**
 * A numeric query value for the helpers to validate: absent → undefined (helper default), anything else →
 * Number(value). Non-integers become NaN or fractions, which the helpers reject with a 400.
 */
export function numberParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name)
  return raw === null ? undefined : Number(raw.trim() === '' ? NaN : raw)
}

/** A string query value; absent → undefined. */
export function stringParam(params: URLSearchParams, name: string): string | undefined {
  return params.get(name) ?? undefined
}

/** Positive integer id from a path segment, or null (→ 404). */
export function idParam(value: string): number | null {
  if (!/^[1-9]\d{0,15}$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

// ---- route factory --------------------------------------------------------------------------------

type RouteParams = Record<string, string | string[]>

interface GetOptions {
  cache?: CacheProfile
  notFoundMessage?: string
}

/**
 * Builds a GET handler. `load` returns the contract shape, or null for "not found / unpublished" (→ 404).
 * Thrown BadRequestErrors become 400; everything else becomes a logged, generic 500.
 */
export function v1Get<P extends RouteParams = Record<string, never>>(
  load: (query: URLSearchParams, params: P) => Promise<unknown | null>,
  { cache = 'default', notFoundMessage }: GetOptions = {},
) {
  return async function GET(request: Request, context: { params: Promise<P> }): Promise<Response> {
    try {
      const params = await context.params
      const data = await load(new URL(request.url).searchParams, params)
      return data === null || data === undefined ? notFound(notFoundMessage) : ok(data, cache)
    } catch (err) {
      return failure(err)
    }
  }
}
