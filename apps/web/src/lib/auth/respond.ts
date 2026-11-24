/** JSON responses for the customer auth routes: no-store, CORS for the native app and the reset page. */
import { AuthApiError, toAuthError } from './appUsers'

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization',
  'Cache-Control': 'no-store',
} as const

export function authJson(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: HEADERS })
}

export function authFail(err: unknown): Response {
  const e = toAuthError(err)
  return authJson(e.status, { error: { code: e.code, message: e.message } })
}

export function authPreflight(): Response {
  return new Response(null, { status: 204, headers: HEADERS })
}

/** Parses a JSON object body; anything else is a validation error. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    // fall through to the validation error below
  }
  throw new AuthApiError(422, 'VALIDATION', 'Request body must be a JSON object.')
}
