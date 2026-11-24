/** Categories tab: two-column grid of pastel tiles; each opens its category feed. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TAB_BAR_SPACE } from '@/components/FloatingTabBar'
import { EmptyState, ErrorState, HomeSkeleton } from '@/components/States'
import { useCategories } from '@/lib/api/queries'
import { colors, fonts, pastelFor, radius, spacing, type, useTheme } from '@/theme'

export default function CategoriesScreen() {
  const t = useTheme()
  const { data, error, isPending, isRefetching, refetch } = useCategories()

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[type.display, { color: t.text }]}>श्रेणियाँ</Text>
        <Text style={[type.bodySmall, { color: t.muted }]}>अपनी पसंद के विषय की खबरें पढ़ें</Text>
      </View>
      {isPending ? (
        <HomeSkeleton />
      ) : !data ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => String(c.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: TAB_BAR_SPACE }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.text} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="grid-outline" title="कोई श्रेणी नहीं मिली" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: item.slug } })}
              style={({ pressed }) => [styles.tile, { backgroundColor: pastelFor(item.id) }, pressed && { opacity: 0.85 }]}
              accessibilityRole="link"
            >
              <Text style={styles.tileName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.description ? (
                <Text style={[type.meta, { marginTop: spacing.xs }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.arrow}>
                <Ionicons name="arrow-forward" size={16} color={colors.white} />
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  tile: { flex: 1, minHeight: 128, borderRadius: radius.xl, padding: spacing.lg },
  tileName: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: colors.ink },
  arrow: { marginTop: 'auto', alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' },
})
