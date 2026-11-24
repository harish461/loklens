/** Category feed: name + description header, then all published stories in the category (infinite). */
import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ArticleFeed } from '@/components/ArticleFeed'
import { EmptyState } from '@/components/States'
import { TopBar } from '@/components/TopBar'
import { ApiError } from '@/lib/api/client'
import { useCategory } from '@/lib/api/queries'
import { colors, pastelFor, radius, spacing, type } from '@/theme'

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const category = useCategory(slug)

  if (category.error instanceof ApiError && category.error.isNotFound) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <TopBar />
        <EmptyState icon="grid-outline" title="श्रेणी नहीं मिली" />
      </SafeAreaView>
    )
  }

  const c = category.data
  const header = (
    <View style={[styles.hero, { backgroundColor: c ? pastelFor(c.id) : colors.surface }]}>
      <Text style={type.display}>{c?.name ?? ' '}</Text>
      {c?.description ? <Text style={[type.bodySmall, { marginTop: spacing.xs }]}>{c.description}</Text> : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar title={c?.name} />
      <ArticleFeed params={{ category: slug }} header={header} showCategory={false} emptyTitle="इस श्रेणी में अभी कोई खबर नहीं है" />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, marginTop: spacing.xs, padding: spacing.xl, borderRadius: radius.xl },
})
