/** Infinite, cursor-paginated list of StoryRows with pull-to-refresh (category, tag and similar feeds). */
import { useCallback, useState, type ReactElement } from 'react'
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native'

import { useArticleFeed } from '@/lib/api/queries'
import type { ListArticlesParams } from '@/lib/api/types'
import { colors, spacing } from '@/theme'

import { StoryRow } from './ArticleCards'
import { EmptyState, ErrorState, FooterLoader, HomeSkeleton } from './States'

interface Props {
  params: ListArticlesParams
  header?: ReactElement
  emptyTitle?: string
  showCategory?: boolean
}

export function ArticleFeed({ params, header, emptyTitle = 'अभी कोई खबर नहीं है', showCategory = true }: Props) {
  const feed = useArticleFeed(params)
  const [refreshing, setRefreshing] = useState(false)
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await feed.refetch()
    setRefreshing(false)
  }, [feed])

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage()
  }, [feed])

  return (
    <FlatList
      data={items}
      keyExtractor={(a) => String(a.id)}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <StoryRow article={item} showCategory={showCategory} />
        </View>
      )}
      ListEmptyComponent={
        feed.isPending ? (
          <HomeSkeleton />
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : (
          <EmptyState title={emptyTitle} text="नई खबरें प्रकाशित होते ही यहां दिखेंगी।" />
        )
      }
      ListFooterComponent={items.length ? <FooterLoader loading={feed.isFetchingNextPage} done={!feed.hasNextPage} /> : undefined}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    />
  )
}

const styles = StyleSheet.create({
  item: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
})
