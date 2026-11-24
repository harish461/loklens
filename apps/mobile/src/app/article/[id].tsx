/**
 * Article details: black page in the dark theme, white in the light theme (story cards stay pastel). Round back button,
 * big headline, "अपडेट" time, publisher row with dark category pill, summary, rounded featured image with
 * round bookmark/share buttons on it, then the full body (native Lexical renderer), tags and related
 * stories. Pull-to-refresh.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useIsFocused, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PublisherRow, RoundAction, StoryBadge, StoryRow } from '@/components/ArticleCards'
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
import { colors, fonts, radius, spacing, type, useTheme } from '@/theme'

function ImageActions({ article }: { article: Article }) {
  const saved = useIsBookmarked(article.id)
  return (
    <View style={styles.imageActions}>
      <RoundAction icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'बुकमार्क हटाएं' : 'बुकमार्क करें'} active={saved} onPress={() => toggleBookmark(article)} />
      <RoundAction icon="arrow-redo-outline" label="शेयर करें" onPress={() => shareArticle(article)} />
    </View>
  )
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useArticle(Number(id))
  const focused = useIsFocused()
  const t = useTheme()
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

  const authorName = article.authors.map((a) => a.name).join(', ') || 'LokLens News Team'

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.page }]} edges={['top']}>
      {focused && <StatusBar style={t.statusBar} />}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.text} colors={[colors.primary]} />}
      >
        <Pressable onPress={goBack} hitSlop={10} style={[styles.back, { backgroundColor: t.surface }]} accessibilityRole="button" accessibilityLabel="वापस">
          <Ionicons name="arrow-back" size={22} color={t.text} />
        </Pressable>

        {(article.isBreaking || article.location) && (
          <View style={styles.badges}>
            {article.isBreaking && <StoryBadge article={article} />}
            {article.location && <Text style={[type.meta, { color: t.muted }]}>{article.location.name}</Text>}
          </View>
        )}

        <Text style={[styles.headline, { color: t.text }]} selectable>
          {article.title}
        </Text>
        <Text style={[type.meta, { marginTop: spacing.sm, color: t.muted }]}>
          अपडेट {timeAgo(article.updatedAt || article.publishedAt)} · {formatDateTime(article.publishedAt)}
        </Text>

        <PublisherRow article={article} name={authorName} onPage />

        <Text style={[styles.summary, { color: t.body }]} selectable>
          {article.summary}
        </Text>

        <View style={styles.imageWrap}>
          <NewsImage image={article.image} size="article" style={styles.image} priority="high" />
          <ImageActions article={article} />
        </View>
        {(article.image.caption || article.image.credit) && (
          <Text style={[type.meta, { marginTop: spacing.xs, color: t.muted }]}>
            {article.image.caption}
            {article.image.caption && article.image.credit ? ' · ' : ''}
            {article.image.credit ? `फ़ोटो: ${article.image.credit}` : ''}
          </Text>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <RichText nodes={article.body} />
        </View>

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
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl * 2 },
  back: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headline: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 42 },
  summary: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 27, marginTop: spacing.lg },
  imageWrap: { marginTop: spacing.xl, borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  imageActions: { position: 'absolute', right: spacing.md, bottom: spacing.md, flexDirection: 'row', gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 },
  tagText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  related: { marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1 },
})
