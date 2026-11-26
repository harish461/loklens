/**
 * Push notification wiring for a signed-in reader (rendered once, inside the root navigator):
 * - keeps the device registered (on mount and whenever Expo rotates the token);
 * - a tap on a notification opens its article (or home), counts the open once, and also works when the tap
 *   launched the app from closed ("cold start"): the last response is read once the navigator is ready.
 * Foreground display is configured at module level (banner + list + sound) so alerts also show while the
 * app is open.
 */
import { router, useRootNavigationState } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import { isPushSupported, reportOpened, syncPushRegistration } from '@/lib/push/notifications'

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
}

type PushData = { notificationId?: unknown; articleId?: unknown }

function openFromResponse(response: Notifications.NotificationResponse): void {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
  const data = (response.notification.request.content.data ?? {}) as PushData
  const notificationId = Number(data.notificationId)
  if (Number.isInteger(notificationId) && notificationId > 0) reportOpened(notificationId)
  const articleId = Number(data.articleId)
  if (Number.isInteger(articleId) && articleId > 0) {
    router.push({ pathname: '/article/[id]', params: { id: String(articleId) } })
  } else {
    router.navigate('/')
  }
}

export function PushHandler() {
  const navReady = Boolean(useRootNavigationState()?.key)
  const handled = useRef(new Set<string>())

  // Registration: once per sign-in, and again when Expo rotates the token.
  useEffect(() => {
    if (!isPushSupported()) return
    void syncPushRegistration()
    const sub = Notifications.addPushTokenListener(() => void syncPushRegistration())
    return () => sub.remove()
  }, [])

  // Taps. Each notification is handled once, whether it arrives via the listener or as the launch response.
  useEffect(() => {
    if (!navReady || !isPushSupported()) return
    const handle = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier
      if (handled.current.has(id)) return
      handled.current.add(id)
      openFromResponse(response)
      void Notifications.clearLastNotificationResponseAsync().catch(() => {})
    }
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) handle(r)
    })
    const sub = Notifications.addNotificationResponseReceivedListener(handle)
    return () => sub.remove()
  }, [navReady])

  return null
}
