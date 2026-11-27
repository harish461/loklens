/**
 * Category news as a horizontal slider (one per category on the home screen). Every card has the same size;
 * the three card designs rotate by position:
 * - "colour": solid brand-colour block, publisher row on top, big white headline
 * - "image": photo-led card, small badge top-right, headline on a scrim
 * - "text": light/dark surface with publisher row, headline, summary and a meta line ("2 घंटे पहले · देश")
 * Cards snap into place while swiping, and the next card peeks in from the right so the row reads as scrollable.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from '@/components/AppText'

import { useArticleFeed } from '@/lib/api/queries'
import type { ArticleCard } from '@/lib/api/types'
import { timeAgo } from '@/lib/format'
import { fonts, radius, spacing, useTheme } from '@/theme'

import { openArticle } from './ArticleCards'
import { NewsImage } from './NewsImage'

const LOGO = require('../../assets/brand/logo-144.webp')

/** Saturated block colours for the "colour" cards (white text passes contrast on all of them). */
const BLOCK_COLOURS = ['#2F6BFF', '#C41D17', '#0E8A55', '#7C3AED', '#E4570F', '#0B7FB8'] as const

type Variant = 'colour' | 'image' | 'text'
const PATTERN: Variant[] = ['colour', 'image', 'text', 'image']

/** One height for every card, so the row lines up whatever the content. */
const CARD_HEIGHT = 250
/** Card width as a share of the screen: leaves the next card peeking in. Capped for tablets. */
const CARD_WIDTH_RATIO = 0.62
const CARD_MAX_WIDTH = 300
const GAP = spacing.md

function Publisher({ label, light = false }: { label: string; light?: boolean }) {
  const t = useTheme()
  return (
    <View style={styles.publisher}>
      <Image source={LOGO} style={styles.avatar} contentFit="cover" />
      <Text style={[styles.publisherText, { color: light ? '#FFFFFF' : t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

function ColourCard({ article, colour, width }: { article: ArticleCard; colour: string; width: number }) {
  return (
    <Pressable
      onPress={() => openArticle(article)}
      style={({ pressed }) => [styles.card, styles.padded, { width, backgroundColor: colour }, pressed && styles.pressed]}
      accessibilityRole="link"
    >
      <Publisher label="LokLens News" light />
      <Text style={styles.colourTitle} numberOfLines={5}>
        {article.title}
      </Text>
    </Pressable>
  )
}

function ImageCard({ article, width }: { article: ArticleCard; width: number }) {
  return (
    <Pressable onPress={() => openArticle(article)} style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]} accessibilityRole="link">
      <NewsImage image={article.image} size="standard" style={StyleSheet.absoluteFill} />
      <View style={styles.badge}>
        <Ionicons name={article.isBreaking ? 'radio' : 'newspaper'} size={12} color="#111214" />
      </View>
      <View style={styles.scrim}>
        <Text style={styles.scrimTitle} numberOfLines={3}>
          {article.title}
        </Text>
      </View>
    </Pressable>
  )
}

function TextCard({ article, width }: { article: ArticleCard; width: number }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={() => openArticle(article)}
      style={({ pressed }) => [styles.card, styles.padded, styles.text, { width, backgroundColor: t.surface }, pressed && styles.pressed]}
      accessibilityRole="link"
    >
      <Publisher label="LokLens News" />
      <Text style={[styles.textTitle, { color: t.text }]} numberOfLines={2}>
        {article.title}
      </Text>
      <Text style={[styles.textSummary, { color: t.body }]} numberOfLines={3}>
        {article.summary}
      </Text>
      <Text style={[styles.meta, { color: t.muted }]} numberOfLines={1}>
        {timeAgo(article.publishedAt)} · {article.category.name}
      </Text>
    </Pressable>
  )
}

function Card({ article, index, width }: { article: ArticleCard; index: number; width: number }) {
  switch (PATTERN[index % PATTERN.length]) {
    case 'colour':
      return <ColourCard article={article} colour={BLOCK_COLOURS[(article.category.id + index) % BLOCK_COLOURS.length]} width={width} />
    case 'image':
      return <ImageCard article={article} width={width} />
    default:
      return <TextCard article={article} width={width} />
  }
}

/**
 * All articles of one category, newest first. Starts with the few articles the home response already has (so
 * the row draws at once), then shows the category's full list and loads more pages while swiping to the end.
 */
export function CategorySlider({ category, initialArticles }: { category: string; initialArticles: ArticleCard[] }) {
  const { width: screenWidth } = useWindowDimensions()
  const cardWidth = Math.min(Math.round(screenWidth * CARD_WIDTH_RATIO), CARD_MAX_WIDTH)
  const feed = useArticleFeed({ category })
  const loaded = feed.data?.pages.flatMap((p) => p.items)
  const articles = loaded?.length ? loaded : initialArticles
  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage()
  }
  return (
    <FlatList
      horizontal
      data={articles}
      keyExtractor={(a) => String(a.id)}
      renderItem={({ item, index }) => <Card article={item} index={index} width={cardWidth} />}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      ItemSeparatorComponent={Separator}
      ListFooterComponent={feed.isFetchingNextPage ? <MoreLoader /> : undefined}
      onEndReached={loadMore}
      onEndReachedThreshold={1.5}
      snapToInterval={cardWidth + GAP}
      snapToAlignment="start"
      decelerationRate="fast"
      // Home is already a long vertical list; keep each row light.
      initialNumToRender={3}
      windowSize={3}
    />
  )
}

function Separator() {
  return <View style={{ width: GAP }} />
}

function MoreLoader() {
  const t = useTheme()
  return (
    <View style={styles.more}>
      <ActivityIndicator color={t.text} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg },
  more: { width: 64, height: CARD_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  card: { height: CARD_HEIGHT, borderRadius: radius.xl, overflow: 'hidden' },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.85 },
  colourTitle: { marginTop: spacing.lg, fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: '#FFFFFF' },
  publisher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
  publisherText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  badge: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, paddingTop: spacing.xl, backgroundColor: 'rgba(0,0,0,0.45)' },
  scrimTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23, color: '#FFFFFF' },
  text: { gap: spacing.sm },
  textTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 },
  textSummary: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
})
