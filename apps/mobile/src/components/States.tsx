/** Loading, error, empty and offline states on the dark shell (Hindi copy). */
import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useRef } from 'react'
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'

import { ApiError } from '@/lib/api/client'
import { colors, fonts, radius, spacing, type } from '@/theme'

function Pulse({ style }: { style: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.5)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.View style={[{ backgroundColor: colors.skeleton, borderRadius: radius.md }, style, { opacity }]} />
}

/** Skeleton for the home deck and rows. */
export function HomeSkeleton() {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }} accessibilityLabel="लोड हो रहा है">
      <Pulse style={{ width: '60%', height: 26 }} />
      <Pulse style={{ width: '100%', height: 420, borderRadius: radius.xl }} />
      {[0, 1].map((i) => (
        <Pulse key={i} style={{ width: '100%', height: 116, borderRadius: radius.lg }} />
      ))}
    </View>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.code === 'NETWORK'
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={30} color={colors.shellMuted} />
      </View>
      <Text style={styles.title}>{offline ? 'इंटरनेट कनेक्शन नहीं है' : 'खबरें लोड नहीं हो सकीं'}</Text>
      <Text style={styles.text}>{offline ? 'कनेक्शन जांचें और फिर से प्रयास करें।' : 'कृपया थोड़ी देर बाद फिर से प्रयास करें।'}</Text>
      {onRetry && (
        <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>फिर से प्रयास करें</Text>
        </Pressable>
      )}
    </View>
  )
}

export function EmptyState({ icon = 'newspaper-outline', title, text }: { icon?: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={30} color={colors.shellMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  )
}

export function FooterLoader({ loading, done }: { loading: boolean; done: boolean }) {
  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
  if (done) return <Text style={[type.meta, { color: colors.shellSubtle, textAlign: 'center', marginVertical: spacing.xl }]}>आपने सभी खबरें देख लीं</Text>
  return <View style={{ height: spacing.xl }} />
}

/** Shown when cached (offline) data is displayed. */
export function OfflineBanner() {
  return (
    <View style={styles.offline}>
      <Ionicons name="cloud-offline-outline" size={14} color={colors.ink} />
      <Text style={[type.meta, { color: colors.ink }]}>ऑफ़लाइन — सहेजी गई खबरें दिख रही हैं</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl, gap: spacing.sm, minHeight: 320 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.shellText, textAlign: 'center', marginTop: spacing.sm },
  text: { ...type.bodySmall, color: colors.shellMuted, textAlign: 'center' },
  button: { marginTop: spacing.md, backgroundColor: colors.ink, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  buttonText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, color: colors.white },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#FFF1C1',
  },
})
