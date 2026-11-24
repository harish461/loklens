/**
 * Article details (reference design): full-bleed featured image at the top (the same image as on the
 * website) with round translucent back / bookmark buttons and the category name over it; a rounded sheet
 * overlaps the image and holds publisher row + share, big headline, date, byline row (author · category ·
 * save), divider, bold lead (summary), the body (native Lexical renderer), tags and related stories.
 * The sheet is white in the light theme and black in the dark theme. Pull-to-refresh.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { router, useIsFocused, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { StoryBadge, StoryRow } from '@/components/ArticleCards'
import { NewsImage } from '@/components/NewsImage'
import { RichText } from '@/components/RichText'
import { EmptyState, ErrorState, HomeSkeleton } from '@/components/States'
import { goBack, TopBar } from '@/components/TopBar'
import { ApiError } from '@/lib/api/client'
import { useArticle } from '@/lib/api/queries'
import type { Article } from '@/lib/api/types'
import { toggleBookmark, useIsBookmarked } from '@/lib/bookmarks'
import { formatDateTime, timeAgo } from '@/lib/format'
import { shareArticle } from '@/lib/share'
import { colors, fonts, spacing, type, useTheme } from '@/theme'

const LOGO = require('../../../assets/brand/logo-144.webp')

/** Translucent round button over the hero image. */
function GlassButton({ icon, label, onPress, active = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.glass, active && { backgroundColor: colors.primary }, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={20} color="#FFFFFF" />
    </Pressable>
  )
}

function SaveButton({ article }: { article: Article }) {
  const saved = useIsBookmarked(article.id)
  return (
    <GlassButton icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'बुकमार्क हटाएं' : 'बुकमार्क करें'} active={saved} onPress={() => toggleBookmark(article)} />
  )
}

function SaveLink({ article }: { article: Article }) {
  const t = useTheme()
  const saved = useIsBookmarked(article.id)
  return (
    <Pressable onPress={() => toggleBookmark(article)} hitSlop={8} style={styles.metaItem} accessibilityRole="button">
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? colors.primary : t.text} />
      <Text style={[styles.metaText, { color: t.text }]}>{saved ? 'सहेजा गया' : 'सहेजें'}</Text>
    </Pressable>
  )
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useArticle(Number(id))
  const focused = useIsFocused()
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const [refreshing, setRefreshing] = useState(false)
  const article = query.data

  const onRefresh = async () => {
    setRefreshing(true)
    await query.refetch()
    setRefreshing(false)
  }

  if (!article) {
    const notFound = query.error instanceof ApiError && query.error.isNotFound
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: t.page }]} edges={['top']}>
        {focused && <StatusBar style={t.statusBar} />}
        <TopBar />
        {query.isPending ? (
          <HomeSkeleton />
        ) : notFound || !Number.isInteger(Number(id)) ? (
          <EmptyState icon="document-text-outline" title="खबर नहीं मिली" text="यह खबर हटा दी गई है या अभी उपलब्ध नहीं है।" />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </SafeAreaView>
    )
  }

  const heroHeight = Math.round(Math.min(440, Math.max(300, windowHeight * 0.42)))
  const authorName = article.authors.map((a) => a.name).join(', ') || 'LokLens News Team'

  return (
    <View style={[styles.screen, { backgroundColor: t.page }]}>
      {/* The hero image sits under the status bar, so its text must be light in both themes. */}
      {focused && <StatusBar style="light" />}
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={[colors.primary]} progressViewOffset={insets.top} />}
      >
        <View style={{ height: heroHeight, backgroundColor: t.skeleton }}>
          <NewsImage image={article.image} size="article" style={StyleSheet.absoluteFill} priority="high" />
          <View style={styles.heroShade} />
          <Text style={[styles.heroTitle, { top: insets.top + spacing.sm + 10 }]} numberOfLines={1}>
            {article.category.name}
          </Text>
        </View>

        <View style={[styles.sheet, { backgroundColor: t.page }]}>
          <View style={styles.publisher}>
            <Image source={LOGO} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.publisherName, { color: t.text }]} numberOfLines={1}>
                  LokLens News
                </Text>
                <Ionicons name="checkmark-circle" size={16} color="#1D9BF0" accessibilityLabel="सत्यापित" />
              </View>
              <Text style={[styles.ago, { color: t.muted }]}>{timeAgo(article.publishedAt)}</Text>
            </View>
            <Pressable
              onPress={() => shareArticle(article)}
              hitSlop={8}
              style={({ pressed }) => [styles.share, { borderColor: t.border }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="शेयर करें"
            >
              <Ionicons name="arrow-redo-outline" size={20} color={t.text} />
            </Pressable>
          </View>

          {article.isBreaking && (
            <View style={{ marginTop: spacing.lg }}>
              <StoryBadge article={article} />
            </View>
          )}

          <Text style={[styles.headline, { color: t.text }]} selectable>
            {article.title}
          </Text>
          <Text style={[styles.date, { color: t.text }]}>{formatDateTime(article.publishedAt)}</Text>

          <View style={[styles.metaRow, { borderBottomColor: t.border }]}>
            <Text style={[styles.metaText, styles.metaAuthor, { color: t.text }]} numberOfLines={1}>
              By {authorName}
            </Text>
            <Pressable onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: article.category.slug } })} hitSlop={8} accessibilityRole="link">
              <Text style={[styles.metaText, { color: t.text }]}>{article.category.name}</Text>
            </Pressable>
            <SaveLink article={article} />
          </View>

          {(article.image.caption || article.image.credit) && (
            <Text style={[type.meta, { color: t.muted, marginTop: spacing.md }]}>
              {article.image.caption}
              {article.image.caption && article.image.credit ? ' · ' : ''}
              {article.image.credit ? `फ़ोटो: ${article.image.credit}` : ''}
            </Text>
          )}

          <Text style={[styles.lead, { color: t.text }]} selectable>
            {article.summary}
          </Text>

          <RichText nodes={article.body} />

          {article.tags.length > 0 && (
            <View style={styles.tags}>
              {article.tags.map((tag) => (
                <Pressable key={tag.id} onPress={() => router.push({ pathname: '/tag/[slug]', params: { slug: tag.slug } })} style={[styles.tag, { backgroundColor: t.surface }]} accessibilityRole="link">
                  <Text style={[styles.tagText, { color: t.body }]}>#{tag.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {article.related.length > 0 && (
            <View style={[styles.related, { borderTopColor: t.border }]}>
              <Text style={[type.section, { color: t.text, marginBottom: spacing.md }]}>संबंधित खबरें</Text>
              <View style={{ gap: spacing.md }}>
                {article.related.map((r) => (
                  <StoryRow key={r.id} article={r} />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed round buttons over the hero (stay reachable while scrolling). */}
      <View pointerEvents="box-none" style={[styles.topButtons, { top: insets.top + spacing.sm }]}>
        <GlassButton icon="chevron-back" label="वापस" onPress={goBack} />
        <SaveButton article={article} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  heroTitle: { position: 'absolute', left: 80, right: 80, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17, lineHeight: 26, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  topButtons: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  glass: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(30,30,32,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  sheet: { marginTop: -32, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  publisher: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  publisherName: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 27 },
  ago: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  share: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headline: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 40, marginTop: spacing.lg },
  date: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21 },
  metaAuthor: { flexShrink: 1 },
  lead: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 28, marginTop: spacing.lg, marginBottom: spacing.lg },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: { borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 5 },
  tagText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  related: { marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1 },
})
