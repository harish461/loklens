/** Story cards in the pastel-card style. All open the article screen on press. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { ArticleCard } from '@/lib/api/types'
import { toggleBookmark, useIsBookmarked } from '@/lib/bookmarks'
import { timeAgo } from '@/lib/format'
import { shareArticle } from '@/lib/share'
import { colors, fonts, pastelFor, radius, shadow, spacing, type, useTheme } from '@/theme'

import { NewsImage } from './NewsImage'

const LOGO = require('../../assets/brand/logo-144.webp')

export const openArticle = (a: Pick<ArticleCard, 'id'>) => router.push({ pathname: '/article/[id]', params: { id: String(a.id) } })
const openCategory = (slug: string) => router.push({ pathname: '/category/[slug]', params: { slug } })

/** Red LIVE pill for breaking news; otherwise a small category tag. */
export function StoryBadge({ article }: { article: ArticleCard }) {
  if (article.isBreaking) {
    return (
      <View style={[styles.badge, { backgroundColor: colors.live }]}>
        <Text style={[styles.badgeText, { color: colors.white }]}>LIVE</Text>
      </View>
    )
  }
  return (
    <View style={[styles.badge, { backgroundColor: 'rgba(17,18,20,0.08)' }]}>
      <Text style={styles.badgeText}>{article.category.name}</Text>
    </View>
  )
}

/** Round action button (bookmark / share), dark translucent so it reads on images and pastels. */
export function RoundAction({ icon, label, onPress, active = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.roundAction, active && { backgroundColor: colors.primary }, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={16} color={colors.white} />
    </Pressable>
  )
}

export function StoryActions({ article }: { article: ArticleCard }) {
  const saved = useIsBookmarked(article.id)
  return (
    <View style={styles.actions}>
      <RoundAction icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'बुकमार्क हटाएं' : 'बुकमार्क करें'} active={saved} onPress={() => toggleBookmark(article)} />
      <RoundAction icon="share-social-outline" label="शेयर करें" onPress={() => shareArticle(article)} />
    </View>
  )
}

/** "प्रकाशक · LokLens News Team" row with the category as a dark pill on the right. */
export function PublisherRow({ article, name = 'LokLens News Team', onPage = false }: { article: ArticleCard; name?: string; onPage?: boolean }) {
  // On a pastel card the colours are fixed; on a page (article screen) they follow the light/dark theme.
  const t = useTheme()
  return (
    <View style={styles.publisher}>
      <Image source={LOGO} style={styles.avatar} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={[type.tiny, onPage && { color: t.muted }]}>प्रकाशक</Text>
        <Text style={[styles.publisherName, onPage && { color: t.text }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Pressable onPress={() => openCategory(article.category.slug)} style={[styles.pill, onPage && { backgroundColor: t.pill }]} accessibilityRole="link">
        <Text style={[styles.pillText, onPage && { color: t.pillText }]}>{article.category.name}</Text>
      </Pressable>
    </View>
  )
}

/** Outlined round action on a pastel surface (reference: like / save / share circles on the deck card). */
export function OutlineAction({ icon, label, onPress, active = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.outline, active && { backgroundColor: colors.ink, borderColor: colors.ink }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={17} color={active ? colors.white : colors.ink} />
    </Pressable>
  )
}

/**
 * Text-only pastel card for the home swipe deck (reference design): LIVE/category badge, big headline,
 * updated time, publisher row with dark category pill, summary, outlined actions bottom-right.
 * Fills the height it is given; the summary takes the remaining space.
 */
export function DeckCard({ article, width, height, onPress }: { article: ArticleCard; width: number; height: number; onPress?: () => void }) {
  const saved = useIsBookmarked(article.id)
  // Fixed parts (badge, 3-line headline, time, publisher, actions, padding) take ~330 px; the summary gets the rest.
  const summaryLines = Math.max(2, Math.floor((height - 330) / 25))
  return (
    <Pressable
      onPress={onPress ?? (() => openArticle(article))}
      style={[styles.deck, { width, height, backgroundColor: pastelFor(article.category.id) }]}
      accessibilityRole="link"
    >
      <StoryBadge article={article} />
      <Text style={[styles.deckTitle, { marginTop: spacing.md }]} numberOfLines={3}>
        {article.title}
      </Text>
      <Text style={[type.meta, { marginTop: spacing.sm }]}>अपडेट: {timeAgo(article.updatedAt || article.publishedAt)}</Text>
      <PublisherRow article={article} />
      <Text style={styles.deckSummary} numberOfLines={summaryLines}>
        {article.summary}
      </Text>
      <View style={styles.deckActions}>
        <OutlineAction icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'बुकमार्क हटाएं' : 'बुकमार्क करें'} active={saved} onPress={() => toggleBookmark(article)} />
        <OutlineAction icon="arrow-redo-outline" label="शेयर करें" onPress={() => shareArticle(article)} />
        <OutlineAction icon="arrow-forward" label="पूरी खबर पढ़ें" onPress={() => openArticle(article)} />
      </View>
    </Pressable>
  )
}

/** Compact pastel row: text left, rounded thumbnail right. */
export function StoryRow({ article, showCategory = true, background }: { article: ArticleCard; showCategory?: boolean; background?: string }) {
  return (
    <Pressable
      onPress={() => openArticle(article)}
      style={({ pressed }) => [styles.row, { backgroundColor: background ?? pastelFor(article.category.id) }, pressed && { opacity: 0.85 }]}
      accessibilityRole="link"
    >
      <View style={{ flex: 1 }}>
        {(showCategory || article.isBreaking) && <StoryBadge article={article} />}
        <Text style={[type.cardTitle, { marginTop: showCategory || article.isBreaking ? spacing.xs : 0 }]} numberOfLines={3}>
          {article.title}
        </Text>
        <Text style={[type.meta, { marginTop: spacing.xs }]}>{timeAgo(article.publishedAt)}</Text>
      </View>
      <NewsImage image={article.image} size="thumb" style={styles.rowThumb} />
    </Pressable>
  )
}

/** Small pastel card for horizontal category rails. */
export function MiniCard({ article, width = 232 }: { article: ArticleCard; width?: number }) {
  return (
    <Pressable
      onPress={() => openArticle(article)}
      style={({ pressed }) => [styles.mini, { width, backgroundColor: pastelFor(article.category.id) }, pressed && { opacity: 0.85 }]}
      accessibilityRole="link"
    >
      <NewsImage image={article.image} size="card" style={styles.miniImage} />
      <Text style={[type.cardTitle, { marginTop: spacing.sm }]} numberOfLines={3}>
        {article.title}
      </Text>
      <Text style={[type.meta, { marginTop: 'auto', paddingTop: spacing.xs }]}>{timeAgo(article.publishedAt)}</Text>
    </Pressable>
  )
}

/** Numbered headline on the dark shell (trending). */
export function RankedRow({ article, rank }: { article: ArticleCard; rank: number }) {
  const t = useTheme()
  return (
    <Pressable onPress={() => openArticle(article)} style={styles.ranked} accessibilityRole="link">
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[type.cardTitle, { color: t.text }]} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={[type.meta, { color: t.muted, marginTop: 2 }]}>
          {article.category.name} • {timeAgo(article.publishedAt)}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 17, color: colors.ink },
  actions: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  roundAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(17,18,20,0.72)', alignItems: 'center', justifyContent: 'center' },
  publisher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white },
  publisherName: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.ink },
  pill: { backgroundColor: colors.pill, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18, color: colors.white },
  deck: { borderRadius: 30, padding: spacing.xl, overflow: 'hidden', ...shadow },
  deckTitle: { fontFamily: fonts.bold, fontSize: 25, lineHeight: 38, color: colors.ink },
  deckSummary: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 25, color: colors.text, marginTop: spacing.lg, flexShrink: 1 },
  deckActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 'auto', paddingTop: spacing.md },
  outline: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: 'rgba(17,18,20,0.14)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, alignItems: 'center' },
  rowThumb: { width: 92, height: 92, borderRadius: radius.md },
  mini: { borderRadius: radius.lg, padding: spacing.sm, paddingBottom: spacing.md, minHeight: 250 },
  miniImage: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.md },
  ranked: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, alignItems: 'flex-start' },
  rank: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: colors.primary, width: 34 },
})
