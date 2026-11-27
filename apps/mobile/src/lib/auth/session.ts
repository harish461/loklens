/**
 * Customer session. On phones the token lives in the device's secure storage (Keychain / Android Keystore),
 * never in AsyncStorage. expo-secure-store has no web version, so the web build keeps it in the browser's
 * localStorage instead (the usual place for a web app; without it every page reload signed the reader out).
 * The signed-in user is kept in memory and refreshed from /me on each launch.
 */
import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

export interface AppUser {
  id: number
  name: string
  email: string
  provider: 'password' | 'google'
  createdAt: string
}

interface SessionState {
  loaded: boolean
  token: string | null
  user: AppUser | null
}

const KEY = 'loklens-session-token'

/** Where the token is kept: secure storage on iOS/Android, localStorage on the web. Errors are the caller's. */
const tokenStore =
  Platform.OS === 'web'
    ? {
        get: async () => globalThis.localStorage?.getItem(KEY) ?? null,
        set: async (token: string) => globalThis.localStorage?.setItem(KEY, token),
        remove: async () => globalThis.localStorage?.removeItem(KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(KEY),
        set: (token: string) => SecureStore.setItemAsync(KEY, token),
        remove: () => SecureStore.deleteItemAsync(KEY),
      }

let state: SessionState = { loaded: false, token: null, user: null }
const listeners = new Set<() => void>()

const emit = (next: SessionState) => {
  state = next
  listeners.forEach((l) => l())
}

/** Reads the saved token once at startup. */
export async function loadSession(): Promise<void> {
  let token: string | null = null
  try {
    token = await tokenStore.get()
  } catch {
    token = null
  }
  emit({ loaded: true, token, user: state.user })
}

export async function saveSession(token: string, user: AppUser): Promise<void> {
  await tokenStore.set(token).catch(() => {})
  emit({ loaded: true, token, user })
}

/** Updates the cached user (e.g. after /me) without touching the token. */
export function setSessionUser(user: AppUser): void {
  emit({ ...state, user })
}

export async function clearSession(): Promise<void> {
  await tokenStore.remove().catch(() => {})
  emit({ loaded: true, token: null, user: null })
}

export function getSession(): SessionState {
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSession = (): SessionState => useSyncExternalStore(subscribe, getSession, getSession)
