/** Floating capsule tab bar: dark pill with round icon buttons; the active tab is a white circle. */
import Ionicons from '@expo/vector-icons/Ionicons'
import type { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, shadow, spacing } from '@/theme'

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

type IconName = keyof typeof Ionicons.glyphMap

/**
 * Each tab has its own accent colour, so the bar stays lively on the dark theme:
 * - `tint`: icon colour on the dark idle button (light shade, reads well on #232327)
 * - `fill`: background of the active button (deeper shade, white icon stays readable on it)
 */
export const TAB_ICONS: Record<string, { icon: IconName; active: IconName; tint: string; fill: string }> = {
  index: { icon: 'home-outline', active: 'home', tint: '#FF6B63', fill: '#C41D17' },
  categories: { icon: 'grid-outline', active: 'grid', tint: '#6EA0FF', fill: '#2F6BFF' },
  shorts: { icon: 'logo-youtube', active: 'logo-youtube', tint: '#FF8A3D', fill: '#E4570F' },
  bookmarks: { icon: 'bookmark-outline', active: 'bookmark', tint: '#FBBF24', fill: '#B45309' },
  profile: { icon: 'person-outline', active: 'person', tint: '#34D399', fill: '#0E8A55' },
}

/** Height the bar occupies above the safe area; screens add this as bottom padding. */
export const TAB_BAR_SPACE = 92

export function FloatingTabBar({ state, descriptors, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const { options } = descriptors[route.key]
          const icons = TAB_ICONS[route.name] ?? { icon: 'ellipse-outline', active: 'ellipse', tint: colors.white, fill: colors.primary }
          const onPress = () => {
            if (!focused) navigateToTab(route.key)
          }
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.button, focused && [styles.buttonActive, { backgroundColor: icons.fill, shadowColor: icons.fill }]]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={typeof options.title === 'string' ? options.title : route.name}
            >
              <Ionicons name={focused ? icons.active : icons.icon} size={focused ? 22 : 20} color={focused ? colors.white : icons.tint} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// Dark capsule; every tab is its own round button with a coloured icon, the active one filled in its colour.
const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...shadow,
  },
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#232327' },
  // Coloured glow under the active button (iOS shadow / Android elevation).
  buttonActive: { shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
})
