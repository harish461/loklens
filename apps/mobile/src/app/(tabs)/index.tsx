/**
 * Home (reference design; follows the light/dark theme): header → text category tabs → LIVE strip (only when there is
 * breaking/ticker news) → stacked swipe deck of pastel story cards → ताज़ा खबरें → ट्रेंडिंग → category
 * rails → infinite "सभी खबरें" feed (cursor pagination), pull-to-refresh. Stories shown above the feed
 * are not repeated in it.
 */
import { router, useIsFocused } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RankedRow, StoryRow } from '@/components/ArticleCards'
import { CategoryMasonry } from '@/components/CategoryMasonry'
import { ScreenBackground } from '@/components/ScreenBackground'
import { TAB_BAR_SPACE } from '@/components/FloatingTabBar'
import { AppHeader, CategoryTabs, NewsTicker, SectionHeader, type TickerItem } from '@/components/HomeParts'
import { EmptyState, ErrorState, FooterLoader, HomeSkeleton, OfflineBanner } from '@/components/States'
import { SwipeDeck } from '@/components/SwipeDeck'
import { useArticleFeed, useCategories, useHome, useTrending } from '@/lib/api/queries'
import type { ArticleCard, Home } from '@/lib/api/types'
import { colors, spacing, useTheme } from '@/theme'

const openArticleId = (id: number) => router.push({ pathname: '/article/[id]', params: { id: String(id) } })
const idFromPath = (url: string) => Number(/-(\d+)\/?$/.exec(url)?.[1])

/** Only real breaking news or editor ticker items get a strip (the reference design has none otherwise). */
function tickerFor(home: Home): { label: string; live: boolean; items: TickerItem[] } | null {
  if (home.breaking.length) {
    return { label: 'LIVE', live: true, items: home.breaking.map((a) => ({ key: `b${a.id}`, title: a.title, onPress: () => openArticleId(a.id) })) }
  }
  if (home.ticker.length) {
    return {
      label: 'ट्रेंडिंग',
      live: false,
      items: home.ticker.map((t, i) => {
        const id = idFromPath(t.url)
        return { key: `t${i}`, title: t.title, onPress: Number.isInteger(id) && id > 0 ? () => openArticleId(id) : undefined }
      }),
    }
  }
  return null
}

/** Deck sized to the phone: wide as the screen (max 560), tall enough to read but leaving the next section visible. */
function DeckArea({ articles }: { articles: ArticleCard[] }) {
  const { width, height } = useWindowDimensions()
  const deckWidth = Math.min(width, 560) - spacing.lg * 2
  const cardHeight = Math.round(Math.max(380, Math.min(520, height * 0.58)))
  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <SwipeDeck articles={articles} width={deckWidth} height={cardHeight} />
    </View>
  )
}

export default function HomeScreen() {
  const home = useHome()
  const categories = useCategories()
  const trending = useTrending()
  const feed = useArticleFeed()
  const [refreshing, setRefreshing] = useState(false)
  const focused = useIsFocused()
  const t = useTheme()

  const layout = useMemo(() => {
    if (!home.data) return null
    const h = home.data
    const deck = (h.featured.length ? h.featured : h.latest).slice(0, 5)
    const shown = new Set(deck.map((a) => a.id))
    const latest = h.latest.filter((a) => !shown.has(a.id)).slice(0, 5)
    latest.forEach((a) => shown.add(a.id))
    const trendingItems = (trending.data?.items ?? []).slice(0, 5)
    const sections = h.sections
      .map((s) => ({ category: s.category, articles: s.articles.filter((a) => !shown.has(a.id)).slice(0, 5) }))
      .filter((s) => s.articles.length > 0)
    sections.forEach((s) => s.articles.forEach((a) => shown.add(a.id)))
    return { ticker: tickerFor(h), deck, latest, trendingItems, sections, shown }
  }, [home.data, trending.data])

  const feedItems = useMemo(() => {
    const all = feed.data?.pages.flatMap((p) => p.items) ?? []
    return layout ? all.filter((a) => !layout.shown.has(a.id)) : all
  }, [feed.data, layout])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.allSettled([home.refetch(), categories.refetch(), trending.refetch(), feed.refetch()])
    setRefreshing(false)
  }, [home, categories, trending, feed])

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
  }, [feed])

  if (home.isPending || !home.data || !layout) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground />
        <AppHeader />
        {focused && <StatusBar style={t.statusBar} />}
        {home.isPending ? <HomeSkeleton /> : <ErrorState error={home.error} onRetry={() => home.refetch()} />}
      </SafeAreaView>
    )
  }

  const tabs = categories.data ?? home.data.sections.map((s) => s.category)

  const header = (
    <View>
      <CategoryTabs categories={tabs} />
      {home.error && <OfflineBanner />}
      {layout.ticker && <NewsTicker label={layout.ticker.label} live={layout.ticker.live} items={layout.ticker.items} />}
      <SectionHeader first title="प्रमुख खबरें" onSeeAll={() => router.push('/latest')} />
      <DeckArea articles={layout.deck} />

      {layout.latest.length > 0 && (
        <>
          <SectionHeader title="ताज़ा खबरें" />
          <View style={styles.stack}>
            {layout.latest.map((a) => (
              <StoryRow key={a.id} article={a} />
            ))}
          </View>
        </>
      )}

      {layout.trendingItems.length > 0 && (
        <>
          <SectionHeader title="ट्रेंडिंग" />
          <View style={[styles.trending, { backgroundColor: t.surface }]}>
            {layout.trendingItems.map((a, i) => (
              <RankedRow key={a.id} article={a} rank={i + 1} />
            ))}
          </View>
        </>
      )}

      {layout.sections.map((s) => (
        <View key={s.category.id}>
          <SectionHeader title={s.category.name} onSeeAll={() => router.push({ pathname: '/category/[slug]', params: { slug: s.category.slug } })} />
          <CategoryMasonry articles={s.articles} />
        </View>
      ))}

      {feedItems.length > 0 && <SectionHeader title="सभी खबरें" />}
    </View>
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenBackground />
      {focused && <StatusBar style={t.statusBar} />}
      <AppHeader />
      <FlatList
        data={feedItems}
        keyExtractor={(a) => String(a.id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.feedItem}>
            <StoryRow article={item} />
          </View>
        )}
        ListEmptyComponent={
          feed.isPending || layout.latest.length || layout.sections.length ? undefined : (
            <EmptyState title="अभी कोई खबर नहीं है" text="नई खबरें प्रकाशित होते ही यहां दिखेंगी।" />
          )
        }
        ListFooterComponent={<FooterLoader loading={feed.isFetchingNextPage} done={!feed.hasNextPage && !feed.isPending && feedItems.length > 0} />}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.text} colors={[colors.primary]} progressBackgroundColor={t.surface} />}
        initialNumToRender={6}
        windowSize={9}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stack: { paddingHorizontal: spacing.lg, gap: spacing.md },
  trending: { marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, borderRadius: 20 },
  feedItem: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
})
