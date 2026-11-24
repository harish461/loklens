/** Story cards in the pastel-card style. All open the article screen on press. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { ArticleCard } from '@/lib/api/types'
import { toggleBookmark, useIsBookmarked } from '@/lib/bookmarks'
import { timeAgo } from '@/lib/format'
import { shareArticle } from '@/lib/share'
import { colors, fonts, pastelFor, radius, shadow, spacing, type } from '@/theme'

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
export function PublisherRow({ article, name = 'LokLens News Team' }: { article: ArticleCard; name?: string }) {
  return (
    <View style={styles.publisher}>
      <Image source={LOGO} style={styles.avatar} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={type.tiny}>प्रकाशक</Text>
        <Text style={styles.publisherName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Pressable onPress={() => openCategory(article.category.slug)} style={styles.pill} accessibilityRole="link">
        <Text style={styles.pillText}>{article.category.name}</Text>
      </Pressable>
    </View>
  )
}

/** Big pastel card for the home deck: badge, headline, time, publisher, summary, image with actions. */
export function DeckCard({ article, width }: { article: ArticleCard; width: number }) {
  return (
    <Pressable
      onPress={() => openArticle(article)}
      style={[styles.deck, { width, backgroundColor: pastelFor(article.category.id) }]}
      accessibilityRole="link"
    >
      <StoryBadge article={article} />
      <Text style={[type.hero, { marginTop: spacing.sm }]} numberOfLines={3}>
        {article.title}
      </Text>
      <Text style={[type.meta, { marginTop: spacing.xs }]}>अपडेट: {timeAgo(article.updatedAt || article.publishedAt)}</Text>
      <PublisherRow article={article} />
      <Text style={[type.bodySmall, { marginTop: spacing.md }]} numberOfLines={3}>
        {article.summary}
      </Text>
      <View style={styles.deckImageWrap}>
        <NewsImage image={article.image} size="card" style={styles.deckImage} priority="high" />
        <StoryActions article={article} />
      </View>
    </Pressable>
  )
}

/** Compact pastel row: text left, rounded thumbnail right. */
export function StoryRow({ article, showCategory = true }: { article: ArticleCard; showCategory?: boolean }) {
  return (
    <Pressable
      onPress={() => openArticle(article)}
      style={({ pressed }) => [styles.row, { backgroundColor: pastelFor(article.category.id) }, pressed && { opacity: 0.85 }]}
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
  return (
    <Pressable onPress={() => openArticle(article)} style={styles.ranked} accessibilityRole="link">
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[type.cardTitle, { color: colors.shellText }]} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={[type.meta, { color: colors.shellMuted, marginTop: 2 }]}>
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
  deck: { borderRadius: radius.xl, padding: spacing.xl, ...shadow },
  deckImageWrap: { marginTop: spacing.md },
  deckImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, alignItems: 'center' },
  rowThumb: { width: 92, height: 92, borderRadius: radius.md },
  mini: { borderRadius: radius.lg, padding: spacing.sm, paddingBottom: spacing.md, minHeight: 250 },
  miniImage: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.md },
  ranked: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, alignItems: 'flex-start' },
  rank: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: colors.primary, width: 34 },
})
