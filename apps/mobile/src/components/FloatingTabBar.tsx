/** Floating capsule tab bar: dark pill with round icon buttons; the active tab is a white circle. */
import Ionicons from '@expo/vector-icons/Ionicons'
import type { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, shadow, spacing } from '@/theme'

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

type IconName = keyof typeof Ionicons.glyphMap

export const TAB_ICONS: Record<string, { icon: IconName; active: IconName }> = {
  index: { icon: 'home-outline', active: 'home' },
  categories: { icon: 'grid-outline', active: 'grid' },
  shorts: { icon: 'logo-youtube', active: 'logo-youtube' },
  bookmarks: { icon: 'bookmark-outline', active: 'bookmark' },
  profile: { icon: 'person-outline', active: 'person' },
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
          const icons = TAB_ICONS[route.name] ?? { icon: 'ellipse-outline', active: 'ellipse' }
          const onPress = () => {
            if (!focused) navigateToTab(route.key)
          }
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.button, focused && styles.buttonActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={typeof options.title === 'string' ? options.title : route.name}
            >
              <Ionicons name={focused ? icons.active : icons.icon} size={20} color={focused ? (route.name === 'shorts' ? '#FF0000' : colors.ink) : '#9A9DA6'} />
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 6,
    borderRadius: 999,
    backgroundColor: colors.ink, // dark capsule on the light shell
    ...shadow,
  },
  button: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  buttonActive: { backgroundColor: colors.white },
})
