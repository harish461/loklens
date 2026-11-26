/**
 * Shorts: full-screen vertical feed of the LokLens YouTube channel's Shorts, like YouTube Shorts.
 * Swipe up/down; only the visible Short mounts the player (autoplays, loops); others show a thumbnail.
 * Side actions: share, open in YouTube. Data: GET /api/v1/shorts.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { useIsFocused } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Linking, Pressable, Share, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { Text } from '@/components/AppText'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ShortPlayer } from '@/components/ShortPlayer'
import { TAB_BAR_SPACE } from '@/components/FloatingTabBar'
import { useShorts } from '@/lib/api/queries'
import type { Short } from '@/lib/api/types'
import { timeAgo } from '@/lib/format'
import { fonts, spacing } from '@/theme'

const CHANNEL_URL = 'https://www.youtube.com/@LokLensNews'
const LOGO = require('../../../assets/brand/logo-144.webp')

function SideButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.side} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.sideIcon}>
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <Text style={styles.sideLabel}>{label}</Text>
    </Pressable>
  )
}

function ShortItem({ short, height, active }: { short: Short; height: number; active: boolean }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.item, { height }]}>
      {short.thumbnail && !active ? <Image source={{ uri: short.thumbnail.url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      {active ? <ShortPlayer id={short.id} /> : null}

      {/* Overlay (does not block the player's own controls in the centre). */}
      <View pointerEvents="box-none" style={[styles.overlay, { paddingBottom: TAB_BAR_SPACE + Math.max(insets.bottom, spacing.md) }]}>
        <View pointerEvents="none" style={styles.meta}>
          <View style={styles.channel}>
            <Image source={LOGO} style={styles.avatar} contentFit="cover" />
            <Text style={styles.channelName}>@LokLensNews</Text>
          </View>
          <Text style={styles.title} numberOfLines={3}>
            {short.title}
          </Text>
          <Text style={styles.time}>{timeAgo(short.publishedAt)}</Text>
        </View>
        <View style={styles.actions}>
          <SideButton icon="share-social" label="शेयर" onPress={() => void Share.share({ message: `${short.title}\n\n${short.url}`, url: short.url }).catch(() => {})} />
          <SideButton icon="logo-youtube" label="YouTube" onPress={() => void Linking.openURL(short.url).catch(() => {})} />
        </View>
      </View>
    </View>
  )
}

export default function ShortsScreen() {
  const insets = useSafeAreaInsets()
  const focused = useIsFocused()
  const { data, error, isPending, refetch, isRefetching } = useShorts()
  const [height, setHeight] = useState(0)
  const [active, setActive] = useState(0)

  const onLayout = (e: LayoutChangeEvent) => setHeight(Math.round(e.nativeEvent.layout.height))
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    if (viewableItems[0]?.index != null) setActive(viewableItems[0].index)
  }, [])

  const shorts = data?.items ?? []

  return (
    <View style={styles.screen} onLayout={onLayout}>
      {focused && <StatusBar style="light" />}
      <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Ionicons name="logo-youtube" size={24} color="#FF0000" />
        <Text style={styles.headerTitle}>शॉर्ट्स</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => void Linking.openURL(CHANNEL_URL)} style={styles.subscribe} accessibilityRole="link">
          <Text style={styles.subscribeText}>चैनल देखें</Text>
        </Pressable>
      </View>

      {isPending || height === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : !shorts.length ? (
        <View style={styles.center}>
          <Ionicons name={error ? 'cloud-offline-outline' : 'videocam-outline'} size={40} color="#aaa" />
          <Text style={styles.message}>{error ? 'शॉर्ट्स लोड नहीं हो सके' : 'अभी कोई शॉर्ट्स नहीं हैं'}</Text>
          <Pressable onPress={() => refetch()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>{isRefetching ? 'लोड हो रहा है…' : 'फिर से प्रयास करें'}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={shorts}
          keyExtractor={(s) => s.id}
          renderItem={({ item, index }) => <ShortItem short={item} height={height} active={focused && index === active} />}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          onRefresh={() => refetch()}
          refreshing={isRefetching}
        />
      )}
    </View>
  )
}

const shadowText = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', zIndex: 2, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  headerTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: '#fff', ...shadowText },
  subscribe: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 },
  subscribeText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18, color: '#111' },
  item: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.lg },
  meta: { flex: 1, gap: spacing.xs, paddingRight: spacing.md },
  channel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff' },
  channelName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 21, color: '#fff', ...shadowText },
  title: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23, color: '#fff', ...shadowText },
  time: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.8)', ...shadowText },
  actions: { gap: spacing.lg, alignItems: 'center', paddingBottom: spacing.sm },
  side: { alignItems: 'center', gap: 2 },
  sideIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  sideLabel: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: '#fff', ...shadowText },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxxl },
  message: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23, color: '#fff', textAlign: 'center' },
  retry: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  retryText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22, color: '#111' },
})
