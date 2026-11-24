/** Bookmarks saved on this device (available offline). Remove with the bookmark button on each card. */
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { StoryActions, StoryRow } from '@/components/ArticleCards'
import { TAB_BAR_SPACE } from '@/components/FloatingTabBar'
import { EmptyState } from '@/components/States'
import { useBookmarks } from '@/lib/bookmarks'
import { spacing, type, useTheme } from '@/theme'

export default function BookmarksScreen() {
  const t = useTheme()
  const bookmarks = useBookmarks()
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[type.display, { color: t.text }]}>बुकमार्क</Text>
        <Text style={[type.bodySmall, { color: t.muted }]}>
          {bookmarks.length ? `${bookmarks.length} सहेजी गई खबरें · ऑफ़लाइन भी उपलब्ध` : 'बाद में पढ़ने के लिए खबरें सहेजें'}
        </Text>
      </View>
      <FlatList
        data={bookmarks}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: TAB_BAR_SPACE, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View>
            <StoryRow article={item} />
            {/* Bookmark (remove) + share, over the thumbnail. */}
            <StoryActions article={item} />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="bookmark-outline" title="कोई बुकमार्क नहीं" text="किसी खबर पर बुकमार्क बटन दबाएं, वह यहां सहेजी जाएगी।" />}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
})
