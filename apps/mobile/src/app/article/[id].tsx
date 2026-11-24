/**
 * Article details: category, headline, byline + date, featured image, summary, full body (native
 * Lexical renderer), tags, related stories; bookmark and share in the top bar; pull-to-refresh.
 */
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { StoryRow } from '@/components/ArticleCards'
import { NewsImage } from '@/components/NewsImage'
import { RichText } from '@/components/RichText'
import { EmptyState, ErrorState, HomeSkeleton } from '@/components/States'
import { IconButton, TopBar } from '@/components/TopBar'
import { ApiError } from '@/lib/api/client'
import { useArticle } from '@/lib/api/queries'
import type { Article } from '@/lib/api/types'
import { toggleBookmark, useIsBookmarked } from '@/lib/bookmarks'
import { formatDateTime } from '@/lib/format'
import { shareArticle } from '@/lib/share'
import { colors, fonts, pastelFor, radius, spacing, type } from '@/theme'

const LOGO = require('../../../assets/brand/logo-144.webp')

function Actions({ article }: { article: Article }) {
  const saved = useIsBookmarked(article.id)
  return (
    <>
      <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'बुकमार्क हटाएं' : 'बुकमार्क करें'} active={saved} onPress={() => toggleBookmark(article)} />
      <IconButton icon="share-social-outline" label="शेयर करें" onPress={() => shareArticle(article)} />
    </>
  )
}

function Byline({ article }: { article: Article }) {
  const first = article.authors[0]
  const names = article.authors.map((a) => a.name).join(', ')
  const updated = article.updatedAt && article.updatedAt !== article.publishedAt
  return (
    <View style={styles.byline}>
      {first?.photo ? (
        <Image source={{ uri: first.photo.sizes.thumb?.url ?? first.photo.url }} style={styles.avatar} contentFit="cover" />
      ) : (
        <Image source={LOGO} style={styles.avatar} contentFit="cover" />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.author} numberOfLines={1}>
          {names || 'LokLens News Team'}
        </Text>
        <Text style={type.meta}>
          {formatDateTime(article.publishedAt)}
          {updated ? ` · अपडेट ${formatDateTime(article.updatedAt)}` : ''}
        </Text>
      </View>
    </View>
  )
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const query = useArticle(Number(id))
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
      <SafeAreaView style={styles.screen} edges={['top']}>
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar right={<Actions article={article} />} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={styles.badges}>
          {article.isBreaking && (
            <View style={[styles.badge, { backgroundColor: colors.live }]}>
              <Text style={[styles.badgeText, { color: colors.white }]}>LIVE</Text>
            </View>
          )}
          <Pressable
            onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: article.category.slug } })}
            style={[styles.badge, { backgroundColor: pastelFor(article.category.id) }]}
            accessibilityRole="link"
          >
            <Text style={styles.badgeText}>{article.category.name}</Text>
          </Pressable>
          {article.location && <Text style={type.meta}>{article.location.name}</Text>}
        </View>

        <Text style={[type.display, styles.headline]} selectable>
          {article.title}
        </Text>
        <Byline article={article} />

        <NewsImage image={article.image} size="article" style={styles.hero} priority="high" />
        {(article.image.caption || article.image.credit) && (
          <Text style={[type.meta, styles.caption]}>
            {article.image.caption}
            {article.image.caption && article.image.credit ? ' · ' : ''}
            {article.image.credit ? `फ़ोटो: ${article.image.credit}` : ''}
          </Text>
        )}

        <Text style={styles.summary} selectable>
          {article.summary}
        </Text>

        <RichText nodes={article.body} />

        {article.tags.length > 0 && (
          <View style={styles.tags}>
            {article.tags.map((t) => (
              <Pressable key={t.id} onPress={() => router.push({ pathname: '/tag/[slug]', params: { slug: t.slug } })} style={styles.tag} accessibilityRole="link">
                <Text style={styles.tagText}>#{t.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {article.related.length > 0 && (
          <View style={styles.related}>
            <Text style={[type.section, { marginBottom: spacing.md }]}>संबंधित खबरें</Text>
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.ink },
  headline: { marginTop: spacing.md },
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface },
  author: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: colors.ink },
  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, marginTop: spacing.lg },
  caption: { marginTop: spacing.xs },
  summary: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 29, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.lg },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: { borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 5 },
  tagText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.text },
  related: { marginTop: spacing.xxl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
})
