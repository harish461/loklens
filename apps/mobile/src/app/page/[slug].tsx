/** Static page (about, policies…) from /api/v1/pages/{slug}, rendered natively. */
import { useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { RichText } from '@/components/RichText'
import { EmptyState, ErrorState, HomeSkeleton } from '@/components/States'
import { TopBar } from '@/components/TopBar'
import { ApiError } from '@/lib/api/client'
import { usePage } from '@/lib/api/queries'
import { formatDate } from '@/lib/format'
import { colors, spacing, type } from '@/theme'

export default function PageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const page = usePage(slug)

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar />
      {page.data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={type.display}>{page.data.title}</Text>
          <Text style={[type.meta, { marginTop: spacing.xs, marginBottom: spacing.xl }]}>अंतिम अपडेट: {formatDate(page.data.updatedAt)}</Text>
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
})
