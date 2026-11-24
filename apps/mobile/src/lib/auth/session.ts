/**
 * Customer session. The token lives in the device's secure storage (Keychain / Android Keystore), never in
 * AsyncStorage. The signed-in user is kept in memory and refreshed from /me on each launch.
 */
import * as SecureStore from 'expo-secure-store'
import { useSyncExternalStore } from 'react'

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
    token = await SecureStore.getItemAsync(KEY)
  } catch {
    token = null
  }
  emit({ loaded: true, token, user: state.user })
}

export async function saveSession(token: string, user: AppUser): Promise<void> {
  await SecureStore.setItemAsync(KEY, token).catch(() => {})
  emit({ loaded: true, token, user })
}

/** Updates the cached user (e.g. after /me) without touching the token. */
export function setSessionUser(user: AppUser): void {
  emit({ ...state, user })
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => {})
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
