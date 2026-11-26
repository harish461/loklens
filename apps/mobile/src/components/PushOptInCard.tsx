/**
 * One-time card on the home screen that explains news alerts before Android's permission prompt appears.
 * "चालू करें" asks for permission and registers; "अभी नहीं" hides it for good (Profile → Notifications still
 * works). Not shown where push is unavailable, after it was answered, or once permission was decided.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'

import { Text } from '@/components/AppText'
import { dismissPushOffer, enablePush, shouldOfferPush } from '@/lib/push/notifications'
import { colors, fonts, radius, spacing, useTheme } from '@/theme'

export function PushOptInCard() {
  const t = useTheme()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void shouldOfferPush().then((show) => alive && setVisible(show))
    return () => {
      alive = false
    }
  }, [])

  if (!visible) return null

  const turnOn = async () => {
    setBusy(true)
    try {
      await enablePush()
    } catch {
      // Registration problems are retried on the next launch; the card's job is done either way.
    } finally {
      setBusy(false)
      setVisible(false)
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.icon}>
        <Ionicons name="notifications" size={20} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.text }]}>ब्रेकिंग न्यूज़ अलर्ट पाएं</Text>
        <Text style={[styles.text, { color: t.muted }]}>बड़ी खबरें सबसे पहले आपके फ़ोन पर। कौन-सी श्रेणियां, यह आप तय करें।</Text>
        <View style={styles.actions}>
          <Pressable onPress={turnOn} disabled={busy} style={[styles.primary, { backgroundColor: t.pill }]} accessibilityRole="button">
            {busy ? <ActivityIndicator color={t.pillText} /> : <Text style={[styles.primaryText, { color: t.pillText }]}>चालू करें</Text>}
          </Pressable>
          <Pressable
            onPress={() => {
              setVisible(false)
              void dismissPushOffer()
            }}
            style={styles.secondary}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryText, { color: t.muted }]}>अभी नहीं</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 },
  text: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  primary: { borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 9, minWidth: 110, alignItems: 'center' },
  primaryText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 21 },
  secondary: { paddingVertical: 9, paddingHorizontal: spacing.sm },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21 },
})
