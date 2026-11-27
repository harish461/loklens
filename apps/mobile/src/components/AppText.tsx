/**
 * The app's Text: React Native's Text with Android's "simple" line breaking.
 *
 * Android's default ("highQuality") break strategy measures some bold Devanagari words slightly too narrow, so
 * the last word of a label wraps out of sight ("लॉग आउट" showed as "लॉग", "सभी खबरें" as "सभी"). "simple" measures
 * them correctly. iOS and the web ignore the prop. A screen can still pass its own textBreakStrategy.
 *
 * Import Text from here instead of from 'react-native'.
 */
import type { ComponentProps } from 'react'
import { Text as NativeText } from 'react-native'

export function Text(props: ComponentProps<typeof NativeText>) {
  return <NativeText textBreakStrategy="simple" {...props} />
}
