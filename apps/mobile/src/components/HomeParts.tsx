/** Home-screen building blocks (follow the light/dark theme): header, category pills, LIVE strip, section header. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from '@/components/AppText'

import type { CategoryRef } from '@/lib/api/types'
import { formatToday } from '@/lib/format'
import { colors, fonts, radius, spacing, toggleThemeMode, type, useTheme } from '@/theme'

const HEADER_LOGO = require('../../assets/brand/logo-header.webp')

export function CircleButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.circle, { backgroundColor: t.button, borderColor: t.chipBorder }, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={t.text} />
    </Pressable>
  )
}

/** Home header: brand logo and today's date on the left; two large round buttons (search, theme) on the right. */
export function AppHeader() {
  const t = useTheme()
  return (
    <View style={styles.header}>
      <Image source={HEADER_LOGO} style={styles.logo} contentFit="contain" accessibilityLabel="LokLens News" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.date, { color: t.muted }]} numberOfLines={2}>
          {formatToday()}
        </Text>
      </View>
      <CircleButton icon="search-outline" label="खोजें" onPress={() => router.push('/search')} />
      <CircleButton
        icon={t.isDark ? 'sunny-outline' : 'moon-outline'}
        label={t.isDark ? 'लाइट थीम' : 'डार्क थीम'}
        onPress={toggleThemeMode}
      />
    </View>
  )
}

/** Pill chips: "सभी खबरें" is the active (filled) pill; each category pill opens that category. */
export function CategoryTabs({ categories }: { categories: CategoryRef[] }) {
  const t = useTheme()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      <View style={[styles.chip, { backgroundColor: t.pill, borderColor: t.pill }]}>
        <Text style={[styles.chipText, { color: t.pillText }]}>सभी खबरें</Text>
      </View>
      {categories.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: c.slug } })}
          style={({ pressed }) => [styles.chip, { backgroundColor: t.chip, borderColor: t.chipBorder }, pressed && { opacity: 0.7 }]}
          accessibilityRole="link"
        >
          <Text style={[styles.chipText, { color: t.text }]}>{c.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

export interface TickerItem {
  key: string
  title: string
  onPress?: () => void
}

/** Rounded dark strip: red label pill + one headline at a time (rotates every 4 s with a fade). */
export function NewsTicker({ label, live = false, items }: { label: string; live?: boolean; items: TickerItem[] }) {
  const t = useTheme()
  const [index, setIndex] = useState(0)
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (items.length < 2) return
    const id = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % items.length)
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start()
      })
    }, 4000)
    return () => clearInterval(id)
  }, [items.length, opacity])

  if (items.length === 0) return null
  const item = items[index % items.length]
  return (
    <Pressable style={[styles.ticker, { backgroundColor: t.surface, borderColor: t.border }]} onPress={item.onPress} accessibilityRole="link">
      <View style={[styles.tickerLabel, live && { backgroundColor: colors.live }]}>
        {live && <View style={styles.liveDot} />}
        <Text style={styles.tickerLabelText}>{label}</Text>
      </View>
      <Animated.Text style={[styles.tickerText, { opacity, color: t.text }]} numberOfLines={1} textBreakStrategy="simple">
        {item.title}
      </Animated.Text>
    </Pressable>
  )
}

/** Reference section header: bold title left, plain "सभी देखें" link right. `first` trims the top margin. */
export function SectionHeader({ title, onSeeAll, first = false }: { title: string; onSeeAll?: () => void; first?: boolean }) {
  const t = useTheme()
  return (
    <View style={[styles.sectionHeader, first && { marginTop: spacing.xs }]}>
      <Text style={[type.section, { flex: 1, color: t.text }]}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={10} style={styles.seeAll} accessibilityRole="link">
          <Text style={[styles.seeAllText, { color: t.muted }]}>सभी देखें</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  date: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  // Header logo: the boxed लोक Lens NEWS mark (assets/brand/logo-header.webp, 251×240).
  logo: { width: 63, height: 60, borderRadius: radius.sm },
  circle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: 10 },
  chipText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tickerLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  tickerLabelText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: colors.white },
  tickerText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 21 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  seeAll: { paddingVertical: 4 },
  seeAllText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 },
})
