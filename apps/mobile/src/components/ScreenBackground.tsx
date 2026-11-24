/** Soft vertical gradient behind the main tab screens (white → mint in light, near-black → deep green in dark). */
import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet } from 'react-native'

import { useTheme } from '@/theme'

export function ScreenBackground() {
  const t = useTheme()
  return <LinearGradient colors={[...t.gradient]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
}
