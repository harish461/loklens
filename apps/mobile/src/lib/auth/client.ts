/** Customer account calls (docs/api-contract.md §7). Every request is a plain HTTPS call; no secrets in the app. */
import { API_BASE_URL } from '@/lib/api/client'

import { type AppUser, clearSession, getSession, saveSession, setSessionUser } from './session'

export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
  /** Network problem: the phone is offline or the server was unreachable. */
  get isNetwork() {
    return this.status === 0
  }
}

async function call<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (init.auth) {
    const token = getSession().token
    if (token) headers.Authorization = `JWT ${token}`
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? 'POST',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new AuthError(0, 'NETWORK', 'इंटरनेट कनेक्शन जांचें और फिर कोशिश करें।')
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & Record<string, unknown>
  if (!res.ok) {
    throw new AuthError(res.status, json.error?.code ?? 'SERVER_ERROR', json.error?.message ?? 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।')
  }
  return json as T
}

interface SessionResponse {
  token: string
  user: AppUser
}

/** Signs in (or creates) the account for a Google ID token; the server verifies the token. */
export async function googleLogin(idToken: string): Promise<void> {
  const res = await call<SessionResponse>('/auth/google', { body: { idToken } })
  await saveSession(res.token, res.user)
}

export async function register(name: string, email: string, password: string): Promise<void> {
  const res = await call<SessionResponse>('/auth/register', { body: { name, email, password } })
  await saveSession(res.token, res.user)
}

export async function login(email: string, password: string): Promise<void> {
  const res = await call<SessionResponse>('/auth/login', { body: { email, password } })
  await saveSession(res.token, res.user)
}

/** Always resolves: the server answers the same way whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  await call<{ ok: boolean }>('/auth/forgot', { body: { email } })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await call<{ ok: boolean }>('/auth/reset', { body: { token, password } })
}

/** Refreshes the cached user. A rejected token (401) signs the device out. */
export async function refreshMe(): Promise<void> {
  if (!getSession().token) return
  try {
    const res = await call<{ user: AppUser }>('/me', { method: 'GET', auth: true })
    setSessionUser(res.user)
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) await clearSession()
    // Offline: keep the signed-in state and the cached user.
  }
}

/** Ends this device's session on the server, then forgets the token locally, even if the server call fails. */
export async function logout(): Promise<void> {
  try {
    await call<{ ok: boolean }>('/auth/logout', { auth: true })
  } catch {
    // Local sign-out still happens below.
  } finally {
    await clearSession()
  }
}
