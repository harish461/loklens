/**
 * LokLens design tokens.
 *
 * Direction: white app shell with large pastel story cards, bold headlines, round icon buttons and a
 * floating dark capsule tab bar (layout reference: Dribbble "News App" by MindInventory; approach only).
 * Visual polish is deferred; colours live here so the shell can be re-themed in one place.
 * Brand accent stays the LokLens logo red (#C41D17) for LIVE/breaking badges and active states.
 * Font: Poppins (Medium text, Bold headings), which covers both Hindi and English.
 */
import { Platform, type TextStyle } from 'react-native'

export const colors = {
  // Brand
  primary: '#C41D17',
  primaryDark: '#9E1611',
  live: '#E5322B',

  // App shell (light)
  background: '#FFFFFF',
  surface: '#F4F5F7',
  surfaceRaised: '#ECEEF1',
  border: '#E4E6EA',
  shellText: '#111214',
  shellMuted: '#5E626B',
  shellSubtle: '#8A8F98',

  // On pastel cards / light surfaces
  ink: '#111214',
  text: '#26282D',
  muted: '#5E626B',
  pill: '#141517', // dark pill buttons on pastel cards

  skeleton: '#ECEEF1',
  white: '#FFFFFF',
  black: '#000000',
} as const

/** Pastel card colours; a story's colour is picked from its category so it stays consistent. */
export const pastels = ['#FFF1C1', '#FADADB', '#DCEBFB', '#E5E0F8', '#D9F2E3', '#FFE3CF'] as const

export function pastelFor(key: number | string): string {
  const n = typeof key === 'number' ? key : [...key].reduce((s, c) => s + c.charCodeAt(0), 0)
  return pastels[Math.abs(n) % pastels.length]
}

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const

export const fonts = {
  // Poppins (Latin + Devanagari in one family). Two real weights only, never synthesized, so text stays
  // crisp: Medium for all running text and labels, Bold for headings, titles and emphasis.
  regular: 'Poppins_500Medium',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_700Bold',
  bold: 'Poppins_700Bold',
  italic: 'Poppins_500Medium_Italic',
  boldItalic: 'Poppins_700Bold_Italic',
} as const

/** Devanagari needs tall line heights (matras above, conjuncts below): ~1.4–1.65 × size. */
export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36, color: colors.ink },
  display: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 34, color: colors.ink },
  headline: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 28, color: colors.ink },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 25, color: colors.ink },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 27, color: colors.text },
  bodySmall: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.text },
  section: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 28, color: colors.shellText },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 20, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  tiny: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 15, color: colors.muted },
} satisfies Record<string, TextStyle>

export const shadow = Platform.select({
  ios: { shadowColor: '#0F1720', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 4 },
  default: { boxShadow: '0 4px 14px rgba(15,23,32,0.12)' } as object,
})

export { palettes, setThemeMode, toggleThemeMode, useTheme, useThemeMode, loadThemeMode, type Palette, type ThemeMode } from './mode'
