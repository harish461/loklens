/**
 * Push notifications on the device (api-contract §8). Signed-in readers only.
 *
 * - The permission is asked only after the reader chooses to turn alerts on (home card or settings), and the
 *   home card is shown once: after "Not now" it never comes back (settings still work).
 * - The Expo push token is registered with the server after permission, refreshed on every launch while
 *   signed in (keeps lastSeen and app version current) and whenever Expo rotates it.
 * - Sign-out unregisters this device first, so a shared phone stops getting the previous reader's alerts.
 * Remote push needs a development or release build: Expo Go (Android) and the web build skip all of this.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { call } from '@/lib/auth/client'
import { getSession } from '@/lib/auth/session'

export const NEWS_CHANNEL = 'news'
const TOKEN_KEY = 'loklens-push-token'
const PROMPT_KEY = 'loklens-push-prompt' // 'dismissed' | 'enabled'

export interface PushPreferences {
  enabled: boolean
  breaking: boolean
  general: boolean
  mutedCategories: number[]
}
export interface PushCategory {
  id: number
  name: string
  slug: string
}
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported'

/** Remote push works on a real device in a development or release build (not the web, not Expo Go). */
export function isPushSupported(): boolean {
  if (Platform.OS === 'web') return false
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false
  return Device.isDevice
}

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId
}

/** Android 13+ shows the permission prompt only once a channel exists, and tokens need it first too. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(NEWS_CHANNEL, {
    name: 'News alerts',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#C41D17',
    vibrationPattern: [0, 200, 120, 200],
  })
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!isPushSupported()) return 'unsupported'
  const perm = await Notifications.getPermissionsAsync()
  if (perm.granted) return 'granted'
  return perm.canAskAgain ? 'undetermined' : 'denied'
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Gets this device's Expo token and registers it with the server. Needs permission already granted. */
async function registerCurrentToken(): Promise<string | null> {
  if (!getSession().token) return null
  const id = projectId()
  if (!id) throw new Error('Missing EAS project ID')
  await ensureChannel()
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data
  await call('/push/devices', {
    auth: true,
    body: {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceId: Device.modelName ?? undefined,
      appVersion: Constants.expoConfig?.version,
    },
  })
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {})
  return token
}

/**
 * Asks for permission (if still possible) and registers. Returns the resulting permission state.
 * Called when the reader taps "Turn on" on the home card or in notification settings.
 */
export async function enablePush(): Promise<PermissionState> {
  if (!isPushSupported()) return 'unsupported'
  await ensureChannel()
  let perm = await Notifications.getPermissionsAsync()
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync()
  if (!perm.granted) {
    await AsyncStorage.setItem(PROMPT_KEY, 'dismissed').catch(() => {})
    return perm.canAskAgain ? 'undetermined' : 'denied'
  }
  await registerCurrentToken()
  await AsyncStorage.setItem(PROMPT_KEY, 'enabled').catch(() => {})
  return 'granted'
}

/** On launch / sign-in: re-register silently if permission was already granted. Never prompts. */
export async function syncPushRegistration(): Promise<void> {
  try {
    if (!isPushSupported() || !getSession().token) return
    const perm = await Notifications.getPermissionsAsync()
    if (perm.granted) await registerCurrentToken()
  } catch {
    // Offline or not configured yet: try again on the next launch.
  }
}

/** Sign-out: tell the server to stop sending to this device, then forget the token locally. */
export async function unregisterThisDevice(): Promise<void> {
  const token = await getStoredToken()
  if (token && getSession().token) {
    await call('/push/devices/unregister', { auth: true, body: { token } }).catch(() => {})
  }
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {})
}

/** Whether to show the home "turn on alerts" card: supported, not asked before, permission not decided. */
export async function shouldOfferPush(): Promise<boolean> {
  if (!isPushSupported() || !getSession().token) return false
  const asked = await AsyncStorage.getItem(PROMPT_KEY).catch(() => null)
  if (asked) return false
  return (await getPermissionState()) === 'undetermined'
}

export async function dismissPushOffer(): Promise<void> {
  await AsyncStorage.setItem(PROMPT_KEY, 'dismissed').catch(() => {})
}

export async function fetchPreferences(token: string): Promise<{ preferences: PushPreferences; categories: PushCategory[] }> {
  return call(`/push/preferences?token=${encodeURIComponent(token)}`, { method: 'GET', auth: true })
}

export async function savePreferences(token: string, preferences: PushPreferences): Promise<PushPreferences> {
  const res = await call<{ preferences: PushPreferences }>('/push/preferences', { auth: true, body: { token, preferences } })
  return res.preferences
}

/** Counts a tap once on the server (it de-duplicates). Fire-and-forget. */
export function reportOpened(notificationId: number): void {
  if (!getSession().token) return
  void getStoredToken().then((token) =>
    call('/push/events', { auth: true, body: { notificationId, token: token ?? undefined, type: 'opened' } }).catch(() => {}),
  )
}
