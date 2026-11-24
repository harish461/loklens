/**
 * Home (dark shell, pastel story cards):
 * header → text category tabs → LIVE/ताज़ा strip → swipeable story deck → ताज़ा खबरें rows →
 * ट्रेंडिंग → category rails → infinite "सभी खबरें" feed (cursor pagination), pull-to-refresh.
 * Stories already shown above the feed are not repeated in it.
 */
import { router } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DeckCard, MiniCard, RankedRow, StoryRow } from '@/components/ArticleCards'
import { TAB_BAR_SPACE } from '@/components/FloatingTabBar'
import { AppHeader, CategoryTabs, NewsTicker, SectionHeader, type TickerItem } from '@/components/HomeParts'
import { EmptyState, ErrorState, FooterLoader, HomeSkeleton, OfflineBanner } from '@/components/States'
import { useArticleFeed, useCategories, useHome, useTrending } from '@/lib/api/queries'
import type { ArticleCard, Home } from '@/lib/api/types'
import { colors, spacing } from '@/theme'

const openArticleId = (id: number) => router.push({ pathname: '/article/[id]', params: { id: String(id) } })
const idFromPath = (url: string) => Number(/-(\d+)\/?$/.exec(url)?.[1])

function tickerFor(home: Home): { label: string; live: boolean; items: TickerItem[] } {
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
  return { label: 'ताज़ा', live: false, items: home.latest.slice(0, 5).map((a) => ({ key: `l${a.id}`, title: a.title, onPress: () => openArticleId(a.id) })) }
}

/** Swipeable deck: one big pastel card with the next one peeking on the right, plus progress dots. */
function StoryDeck({ articles }: { articles: ArticleCard[] }) {
  const { width } = useWindowDimensions()
  const cardWidth = Math.min(width, 560) - spacing.lg * 2 - 28
  const [active, setActive] = useState(0)
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    if (viewableItems[0]?.index != null) setActive(viewableItems[0].index)
  }, [])
  if (!articles.length) return null
  return (
    <View>
      <FlatList
        data={articles}
        keyExtractor={(a) => String(a.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + spacing.md}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm }}
        renderItem={({ item, index }) => (
          <View style={index !== active && { transform: [{ scale: 0.96 }], opacity: 0.85 }}>
            <DeckCard article={item} width={cardWidth} />
          </View>
        )}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />
      {articles.length > 1 && (
        <View style={styles.dots}>
          {articles.map((a, i) => (
            <View key={a.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

export default function HomeScreen() {
  const home = useHome()
  const categories = useCategories()
  const trending = useTrending()
  const feed = useArticleFeed()
  const [refreshing, setRefreshing] = useState(false)

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
        <AppHeader />
        {home.isPending ? <HomeSkeleton /> : <ErrorState error={home.error} onRetry={() => home.refetch()} />}
      </SafeAreaView>
    )
  }

  const tabs = categories.data ?? home.data.sections.map((s) => s.category)

  const header = (
    <View>
      <CategoryTabs categories={tabs} />
      {home.error && <OfflineBanner />}
      <NewsTicker label={layout.ticker.label} live={layout.ticker.live} items={layout.ticker.items} />
      <StoryDeck articles={layout.deck} />

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
          <View style={styles.trending}>
            {layout.trendingItems.map((a, i) => (
              <RankedRow key={a.id} article={a} rank={i + 1} />
            ))}
          </View>
        </>
      )}

      {layout.sections.map((s) => (
        <View key={s.category.id}>
          <SectionHeader title={s.category.name} onSeeAll={() => router.push({ pathname: '/category/[slug]', params: { slug: s.category.slug } })} />
          <FlatList
            data={s.articles}
            keyExtractor={(a) => String(a.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
            renderItem={({ item }) => <MiniCard article={item} />}
          />
        </View>
      ))}

      {feedItems.length > 0 && <SectionHeader title="सभी खबरें" />}
    </View>
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} />}
        initialNumToRender={6}
        windowSize={9}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  stack: { paddingHorizontal: spacing.lg, gap: spacing.md },
  trending: { marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.surface },
  feedItem: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.shellText },
})
