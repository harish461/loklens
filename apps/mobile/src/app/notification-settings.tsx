/**
 * Notification settings (api-contract §8): master switch, breaking news, general updates and one switch per
 * category. Settings belong to this device and are saved on the server as soon as a switch changes.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/AppText'
import { TopBar } from '@/components/TopBar'
import {
  enablePush,
  fetchPreferences,
  getPermissionState,
  getStoredToken,
  savePreferences,
  type PermissionState,
  type PushCategory,
  type PushPreferences,
} from '@/lib/push/notifications'
import { colors, fonts, radius, spacing, useTheme } from '@/theme'

type Loaded = { token: string; preferences: PushPreferences; categories: PushCategory[] }

function Row({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme()
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: t.text }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, { color: t.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: t.border }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  )
}

export default function NotificationSettingsScreen() {
  const t = useTheme()
  const [permission, setPermission] = useState<PermissionState | null>(null)
  const [data, setData] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const state = await getPermissionState()
    setPermission(state)
    const token = await getStoredToken()
    if (state !== 'granted' || !token) {
      setData(null)
      return
    }
    try {
      const res = await fetchPreferences(token)
      setData({ token, ...res })
    } catch {
      setError('Could not load your notification settings. Check your connection and try again.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const turnOn = async () => {
    setBusy(true)
    setError('')
    try {
      await enablePush()
      await load()
    } catch {
      setError('Could not turn on notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  /** Optimistic: show the change at once, save it, and put it back if saving fails. */
  const update = async (next: PushPreferences) => {
    if (!data) return
    const previous = data.preferences
    setData({ ...data, preferences: next })
    try {
      const saved = await savePreferences(data.token, next)
      setData((d) => (d ? { ...d, preferences: saved } : d))
    } catch {
      setData((d) => (d ? { ...d, preferences: previous } : d))
      setError('Could not save. Check your connection and try again.')
    }
  }

  const toggleCategory = (id: number, on: boolean) => {
    if (!data) return
    const muted = new Set(data.preferences.mutedCategories)
    if (on) muted.delete(id)
    else muted.add(id)
    void update({ ...data.preferences, mutedCategories: [...muted] })
  }

  let body: React.ReactNode
  if (permission === null) {
    body = <ActivityIndicator color={t.text} style={{ marginTop: spacing.xxl }} />
  } else if (permission === 'unsupported') {
    body = (
      <Notice icon="phone-portrait-outline" title="Not available here" text="Notifications work in the LokLens app on your phone." />
    )
  } else if (permission === 'denied') {
    body = (
      <Notice icon="notifications-off-outline" title="Notifications are blocked" text="Allow notifications for LokLens News in your phone's settings, then come back here.">
        <Button label="Open phone settings" onPress={() => void Linking.openSettings()} />
      </Notice>
    )
  } else if (!data) {
    body = (
      <Notice
        icon="notifications-outline"
        title="Get news alerts"
        text="Be the first to know about breaking news and the stories you care about. You choose which categories, and you can change it any time."
      >
        <Button label={busy ? '' : 'Turn on notifications'} onPress={turnOn} busy={busy} />
      </Notice>
    )
  } else {
    const p = data.preferences
    body = (
      <>
        <View style={[styles.group, { backgroundColor: t.surface }]}>
          <Row label="Notifications" hint="Turn all LokLens alerts on or off" value={p.enabled} onChange={(v) => void update({ ...p, enabled: v })} />
        </View>
        <Text style={[styles.groupTitle, { color: t.muted }]}>Alerts</Text>
        <View style={[styles.group, { backgroundColor: t.surface }]}>
          <Row label="Breaking news" value={p.breaking} disabled={!p.enabled} onChange={(v) => void update({ ...p, breaking: v })} />
          <Row label="General updates" hint="Announcements from LokLens News" value={p.general} disabled={!p.enabled} onChange={(v) => void update({ ...p, general: v })} />
        </View>
        <Text style={[styles.groupTitle, { color: t.muted }]}>Categories</Text>
        <View style={[styles.group, { backgroundColor: t.surface }]}>
          {data.categories.map((c) => (
            <Row
              key={c.id}
              label={c.name}
              value={!p.mutedCategories.includes(c.id)}
              disabled={!p.enabled}
              onChange={(v) => toggleCategory(c.id, v)}
            />
          ))}
        </View>
      </>
    )
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <TopBar title="Notifications" />
      <ScrollView contentContainerStyle={styles.content}>
        {body}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function Notice({ icon, title, text, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; children?: React.ReactNode }) {
  const t = useTheme()
  return (
    <View style={[styles.notice, { backgroundColor: t.surface }]}>
      <Ionicons name={icon} size={30} color={colors.primary} />
      <Text style={[styles.noticeTitle, { color: t.text }]}>{title}</Text>
      <Text style={[styles.noticeText, { color: t.muted }]}>{text}</Text>
      {children}
    </View>
  )
}

function Button({ label, onPress, busy = false }: { label: string; onPress: () => void; busy?: boolean }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [styles.button, { backgroundColor: t.pill }, (pressed || busy) && { opacity: 0.7 }]} accessibilityRole="button">
      {busy ? <ActivityIndicator color={t.pillText} /> : <Text style={[styles.buttonText, { color: t.pillText }]}>{label}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 20, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
  rowHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  notice: { alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.xl },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, textAlign: 'center' },
  noticeText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.md, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 },
  error: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.primary, marginTop: spacing.lg, textAlign: 'center' },
})
