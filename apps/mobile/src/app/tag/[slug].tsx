/** Tag feed: "#tag" header, then all published stories with the tag (infinite). */
import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Text } from '@/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ArticleFeed } from '@/components/ArticleFeed'
import { EmptyState } from '@/components/States'
import { TopBar } from '@/components/TopBar'
import { ApiError } from '@/lib/api/client'
import { useTag } from '@/lib/api/queries'
import { spacing, type, useTheme } from '@/theme'

export default function TagScreen() {
  const t = useTheme()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const tag = useTag(slug)

  if (tag.error instanceof ApiError && tag.error.isNotFound) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
        <TopBar />
        <EmptyState icon="pricetag-outline" title="टैग नहीं मिला" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <TopBar />
      <ArticleFeed
        params={{ tag: slug }}
        header={
          <View style={styles.header}>
            <Text style={[type.meta, { color: t.muted }]}>टैग</Text>
            <Text style={[type.display, { color: t.text }]}>#{tag.data?.name ?? ''}</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
})
