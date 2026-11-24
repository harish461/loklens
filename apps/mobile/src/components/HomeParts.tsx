/** Home-screen building blocks on the dark shell: header, text category tabs, LIVE strip, section header. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { CategoryRef } from '@/lib/api/types'
import { formatToday } from '@/lib/format'
import { colors, fonts, radius, spacing, type } from '@/theme'

const LOGO = require('../../assets/brand/logo-144.webp')

export function CircleButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.circle, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={colors.shellText} />
    </Pressable>
  )
}

export function AppHeader() {
  return (
    <View style={styles.header}>
      <Image source={LOGO} style={styles.logo} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={styles.brand} numberOfLines={1}>
          लोक Lens न्यूज़
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {formatToday()}
        </Text>
      </View>
      <CircleButton icon="search" label="खोजें" onPress={() => router.push('/search')} />
    </View>
  )
}

/** Text tabs like "Trending  Health  Sports": the active one large and white, the rest small and grey. */
export function CategoryTabs({ categories }: { categories: CategoryRef[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      <View style={styles.tabActiveWrap}>
        <Text style={styles.tabActive}>ट्रेंडिंग</Text>
        <View style={styles.tabDot} />
      </View>
      {categories.map((c) => (
        <Pressable key={c.id} onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: c.slug } })} hitSlop={6} accessibilityRole="link">
          <Text style={styles.tab}>{c.name}</Text>
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
    <Pressable style={styles.ticker} onPress={item.onPress} accessibilityRole="link">
      <View style={[styles.tickerLabel, live && { backgroundColor: colors.live }]}>
        {live && <View style={styles.liveDot} />}
        <Text style={styles.tickerLabelText}>{label}</Text>
      </View>
      <Animated.Text style={[styles.tickerText, { opacity }]} numberOfLines={1}>
        {item.title}
      </Animated.Text>
    </Pressable>
  )
}

export function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.section, { flex: 1 }]}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll} accessibilityRole="link">
          <Text style={styles.seeAllText}>सभी देखें</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.shellText} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white },
  brand: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: colors.shellText },
  date: { ...type.meta, color: colors.shellMuted, marginTop: -3 },
  circle: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tabs: { alignItems: 'flex-end', gap: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  tabActiveWrap: { alignItems: 'flex-start' },
  tabActive: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: colors.shellText },
  tabDot: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: 1 },
  tab: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.shellMuted, paddingBottom: 4 },
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tickerLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  tickerLabelText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 19, color: colors.white },
  tickerText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, color: colors.shellText },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  seeAllText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18, color: colors.shellText },
})
