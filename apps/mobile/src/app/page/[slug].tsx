/** Static page (about, policies…) from /api/v1/pages/{slug}, rendered natively. */
import { useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'
import { Text } from '@/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RichText } from '@/components/RichText'
import { EmptyState, ErrorState, HomeSkeleton } from '@/components/States'
import { TopBar } from '@/components/TopBar'
import { ApiError } from '@/lib/api/client'
import { usePage } from '@/lib/api/queries'
import { formatDate } from '@/lib/format'
import { spacing, type, useTheme } from '@/theme'

export default function PageScreen() {
  const t = useTheme()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const page = usePage(slug)

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <TopBar />
      {page.data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[type.display, { color: t.text }]}>{page.data.title}</Text>
          <Text style={[type.meta, { marginTop: spacing.xs, marginBottom: spacing.xl, color: t.muted }]}>अंतिम अपडेट: {formatDate(page.data.updatedAt)}</Text>
          <RichText nodes={page.data.body} />
        </ScrollView>
      ) : page.isPending ? (
        <HomeSkeleton />
      ) : page.error instanceof ApiError && page.error.isNotFound ? (
        <EmptyState icon="document-text-outline" title="पेज उपलब्ध नहीं है" text="यह जानकारी अभी प्रकाशित नहीं हुई है।" />
      ) : (
        <ErrorState error={page.error} onRetry={() => page.refetch()} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
})
