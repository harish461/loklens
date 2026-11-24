/** Top bar for pushed screens: round back button, optional title, optional round actions on the right. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, fonts, spacing } from '@/theme'

export function goBack() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

export function IconButton({ icon, label, onPress, active = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, active && { backgroundColor: colors.primary, borderColor: colors.primary }, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={20} color={active ? colors.white : colors.ink} />
    </Pressable>
  )
}

export function TopBar({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <IconButton icon="arrow-back" label="वापस" onPress={goBack} />
      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.background },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 17, lineHeight: 26, color: colors.shellText },
  right: { flexDirection: 'row', gap: spacing.sm },
  button: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
})
