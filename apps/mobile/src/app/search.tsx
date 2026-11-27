/**
 * Search: debounced query (2–100 characters, as the API requires), recent searches on the device,
 * paginated results with infinite scroll.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState } from 'react'
import { FlatList, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from '@/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'

import { StoryRow } from '@/components/ArticleCards'
import { TopBar } from '@/components/TopBar'
import { EmptyState, ErrorState, FooterLoader, HomeSkeleton } from '@/components/States'
import { useSearch } from '@/lib/api/queries'
import { addRecentSearch, clearRecentSearches, removeRecentSearch, useRecentSearches } from '@/lib/recentSearches'
import { colors, fonts, radius, spacing, type, useTheme } from '@/theme'

const DEBOUNCE_MS = 400

export default function SearchScreen() {
  const t = useTheme()
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  const recent = useRecentSearches()
  const search = useSearch(term)

  useEffect(() => {
    const id = setTimeout(() => setTerm(text.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [text])

  // Remember a term once it has returned results.
  useEffect(() => {
    if (search.data && search.data.pages[0]?.totalItems > 0) addRecentSearch(term)
  }, [search.data, term])

  const runSearch = (value: string) => {
    setText(value)
    setTerm(value.trim())
    Keyboard.dismiss()
  }

  const items = search.data?.pages.flatMap((p) => p.items) ?? []
  const total = search.data?.pages[0]?.totalItems ?? 0
  const tooShort = term.length > 0 && term.length < 2

  let body
  if (!term) {
    body = (
      <View style={styles.recent}>
        {recent.length > 0 ? (
          <>
            <View style={styles.recentHeader}>
              <Text style={[type.title, { color: t.text }]}>हाल की खोजें</Text>
              <Pressable onPress={clearRecentSearches} hitSlop={8} accessibilityRole="button">
                <Text style={styles.clear}>सभी हटाएं</Text>
              </Pressable>
            </View>
            <View style={styles.chips}>
              {recent.map((r) => (
                <View key={r} style={[styles.chip, { backgroundColor: t.surface }]}>
                  <Pressable onPress={() => runSearch(r)} accessibilityRole="button">
                    <Text style={[styles.chipText, { color: t.body }]}>{r}</Text>
                  </Pressable>
                  <Pressable onPress={() => removeRecentSearch(r)} hitSlop={8} accessibilityLabel={`${r} हटाएं`}>
                    <Ionicons name="close" size={14} color={t.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        ) : (
          <EmptyState icon="search-outline" title="खबरें खोजें" text="शहर, व्यक्ति या विषय का नाम लिखें, जैसे “देहरादून” या “चुनाव”।" />
        )}
      </View>
    )
  } else if (tooShort) {
    body = <EmptyState icon="text-outline" title="कम से कम 2 अक्षर लिखें" />
  } else if (search.isPending) {
    body = <HomeSkeleton />
  } else if (search.isError && !items.length) {
    body = <ErrorState error={search.error} onRetry={() => search.refetch()} />
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(a) => String(a.id)}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        ListHeaderComponent={items.length ? <Text style={[type.meta, styles.count, { color: t.muted }]}>“{term}” के लिए {total} परिणाम</Text> : undefined}
        ListEmptyComponent={<EmptyState icon="search-outline" title="कोई परिणाम नहीं मिला" text={`“${term}” से जुड़ी कोई खबर नहीं मिली। दूसरे शब्द आज़माएं।`} />}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <StoryRow article={item} />
          </View>
        )}
        ListFooterComponent={items.length ? <FooterLoader loading={search.isFetchingNextPage} done={!search.hasNextPage} /> : undefined}
        onEndReached={() => search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
        onEndReachedThreshold={0.6}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      />
    )
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <TopBar title="खोजें" />
      <View style={styles.header}>
        <View style={[styles.inputWrap, { backgroundColor: t.surface }]}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => runSearch(text)}
            placeholder="खबरें खोजें…"
            placeholderTextColor={t.subtle}
            style={[styles.input, { color: t.text }]}
            returnKeyType="search"
            maxLength={100}
            autoCorrect={false}
            accessibilityLabel="खोज"
            autoFocus
          />
          {text.length > 0 && (
            <Pressable onPress={() => runSearch('')} hitSlop={8} accessibilityLabel="खोज साफ़ करें">
              <Ionicons name="close-circle" size={18} color={t.muted} />
            </Pressable>
          )}
        </View>
      </View>
      {body}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md, paddingBottom: spacing.md },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.pill, paddingHorizontal: spacing.lg, minHeight: 48 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: spacing.sm },
  recent: { flex: 1, paddingHorizontal: spacing.lg },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  clear: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 20, color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 },
  count: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  item: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
})
