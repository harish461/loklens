/**
 * Category news as a two-column staggered (masonry) grid, after the reference layout:
 * - "colour" card: solid brand-colour block, publisher row on top, big white headline
 * - "image" cards: photo-led cards in two heights, small category badge top-right, headline on a scrim
 * - "text" card: light/dark surface with publisher row, summary and a meta line ("2 घंटे पहले · देश")
 * Variants rotate by position, and each card goes to the currently shorter column (estimated heights),
 * so the columns stay balanced like the reference.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { ArticleCard } from '@/lib/api/types'
import { timeAgo } from '@/lib/format'
import { fonts, radius, spacing, useTheme } from '@/theme'

import { openArticle } from './ArticleCards'
import { NewsImage } from './NewsImage'

const LOGO = require('../../assets/brand/logo-144.webp')

/** Saturated block colours for the "colour" cards (white text passes contrast on all of them). */
const BLOCK_COLOURS = ['#2F6BFF', '#C41D17', '#0E8A55', '#7C3AED', '#E4570F', '#0B7FB8'] as const

type Variant = 'colour' | 'imageTall' | 'imageShort' | 'text'
const PATTERN: Variant[] = ['colour', 'imageTall', 'text', 'imageShort', 'imageShort', 'colour']
const ESTIMATE: Record<Variant, number> = { colour: 190, imageTall: 250, imageShort: 175, text: 200 }

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

function ColourCard({ article, colour }: { article: ArticleCard; colour: string }) {
  return (
    <Pressable onPress={() => openArticle(article)} style={({ pressed }) => [styles.card, styles.colour, { backgroundColor: colour }, pressed && styles.pressed]} accessibilityRole="link">
      <Publisher label="LokLens News" light />
      <Text style={styles.colourTitle} numberOfLines={5}>
        {article.title}
      </Text>
    </Pressable>
  )
}

function ImageCard({ article, height }: { article: ArticleCard; height: number }) {
  return (
    <Pressable onPress={() => openArticle(article)} style={({ pressed }) => [styles.card, { height }, pressed && styles.pressed]} accessibilityRole="link">
      <NewsImage image={article.image} size={height > 200 ? 'standard' : 'card'} style={StyleSheet.absoluteFill} />
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

function TextCard({ article }: { article: ArticleCard }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={() => openArticle(article)}
      style={({ pressed }) => [styles.card, styles.text, { backgroundColor: t.surface }, pressed && styles.pressed]}
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

function renderCard(article: ArticleCard, variant: Variant, index: number) {
  switch (variant) {
    case 'colour':
      return <ColourCard key={article.id} article={article} colour={BLOCK_COLOURS[(article.category.id + index) % BLOCK_COLOURS.length]} />
    case 'imageTall':
      return <ImageCard key={article.id} article={article} height={ESTIMATE.imageTall} />
    case 'imageShort':
      return <ImageCard key={article.id} article={article} height={ESTIMATE.imageShort} />
    default:
      return <TextCard key={article.id} article={article} />
  }
}

export function CategoryMasonry({ articles }: { articles: ArticleCard[] }) {
  const columns: { height: number; items: React.ReactElement[] }[] = [
    { height: 0, items: [] },
    { height: 0, items: [] },
  ]
  articles.forEach((article, i) => {
    const variant = PATTERN[i % PATTERN.length]
    const target = columns[0].height <= columns[1].height ? columns[0] : columns[1]
    target.items.push(renderCard(article, variant, i))
    target.height += ESTIMATE[variant] + spacing.md
  })
  return (
    <View style={styles.grid}>
      {columns.map((c, i) => (
        <View key={i} style={styles.column}>
          {c.items}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  column: { flex: 1, gap: spacing.md },
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  pressed: { opacity: 0.85 },
  colour: { padding: spacing.lg, minHeight: ESTIMATE.colour, gap: spacing.lg },
  colourTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 31, color: '#FFFFFF' },
  publisher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
  publisherText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
  badge: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, paddingTop: spacing.xl, backgroundColor: 'rgba(0,0,0,0.45)' },
  scrimTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, color: '#FFFFFF' },
  text: { padding: spacing.lg, gap: spacing.sm },
  textTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 },
  textSummary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
})
