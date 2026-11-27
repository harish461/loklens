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

/** Calls the LokLens API (api/v1). `auth: true` sends the saved session token. Errors are AuthError, in English. */
export async function call<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean } = {}): Promise<T> {
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
    throw new AuthError(0, 'NETWORK', 'Check your internet connection and try again.')
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & Record<string, unknown>
  if (!res.ok) {
    const code = json.error?.code ?? 'SERVER_ERROR'
    throw new AuthError(res.status, code, englishMessage(code, json.error?.message))
  }
  return json as T
}

/**
 * The account screens are in English, but the server's auth messages are mostly Hindi (the website shares
 * them). Known messages are translated here; anything unknown falls back to a generic English line per code.
 */
const SERVER_MESSAGES: Record<string, string> = {
  'ईमेल या पासवर्ड गलत है।': 'Incorrect email or password.',
  'कृपया फिर से साइन इन करें।': 'Please sign in again.',
  'यह ईमेल पहले से पंजीकृत है।': 'This email is already registered.',
  'यह ईमेल पासवर्ड से पंजीकृत है। कृपया पासवर्ड से साइन इन करें।':
    'This email is registered with a password. Please sign in with your password.',
  'कृपया अपना नाम लिखें।': 'Please enter your name.',
  'कृपया सही ईमेल पता लिखें।': 'Please enter a valid email address.',
  'कृपया सही जानकारी भरें।': 'Please check the details you entered.',
  'पासवर्ड कम से कम 8 अक्षर का होना चाहिए।': 'Password must be at least 8 characters.',
  'पासवर्ड लिखें।': 'Please enter your password.',
  'यह रीसेट लिंक अमान्य है या समाप्त हो चुका है।': 'This reset link is invalid or has expired.',
  'रीसेट लिंक अधूरा है।': 'This reset link is incomplete.',
  'बहुत अधिक प्रयास। 15 मिनट बाद फिर कोशिश करें।': 'Too many attempts. Please try again in 15 minutes.',
  'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।': 'Something went wrong. Please try again.',
}

const CODE_FALLBACKS: Record<string, string> = {
  UNAUTHORIZED: 'Please sign in again.',
  CONFLICT: 'This email is already registered.',
  VALIDATION: 'Please check the details you entered.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please try again later.',
}

/** Exported for tests. */
export function englishMessage(code: string, serverMessage: string | undefined): string {
  if (serverMessage && SERVER_MESSAGES[serverMessage]) return SERVER_MESSAGES[serverMessage]
  // Messages already in English (no Devanagari) are shown as they are.
  if (serverMessage && !/[ऀ-ॿ]/.test(serverMessage)) return serverMessage
  return CODE_FALLBACKS[code] ?? 'Something went wrong. Please try again.'
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
