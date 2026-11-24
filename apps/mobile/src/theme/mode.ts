/**
 * Light / dark theme for the app shell (backgrounds, text, surfaces). Pastel story cards keep their colours
 * in both themes. The reader's choice is saved on the device; default is dark.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

export type ThemeMode = 'dark' | 'light'

export const palettes = {
  dark: {
    mode: 'dark' as ThemeMode,
    isDark: true,
    bg: '#0B0B0C', // app background (article pages are pure black)
    page: '#000000',
    surface: '#1B1B1E',
    raised: '#2A2A2E',
    border: '#2E2E33',
    text: '#FFFFFF', // headings
    body: '#E6E6EA', // long-form text
    muted: '#A3A3AB',
    subtle: '#6F6F77',
    skeleton: '#2A2A2E',
    pill: '#FFFFFF', // high-contrast pill (category, buttons)
    pillText: '#111214',
    statusBar: 'light' as 'light' | 'dark',
  },
  light: {
    mode: 'light' as ThemeMode,
    isDark: false,
    bg: '#FFFFFF',
    page: '#FFFFFF',
    surface: '#F4F5F7',
    raised: '#ECEEF1',
    border: '#E4E6EA',
    text: '#111214',
    body: '#26282D',
    muted: '#5E626B',
    subtle: '#8A8F98',
    skeleton: '#ECEEF1',
    pill: '#141517',
    pillText: '#FFFFFF',
    statusBar: 'dark' as 'light' | 'dark',
  },
}

export type Palette = (typeof palettes)['dark']

const KEY = 'loklens-theme-v1'
let mode: ThemeMode = 'dark'
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Reads the saved choice once at startup (the root layout waits for it to avoid a colour flash). */
export async function loadThemeMode(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    const saved = await AsyncStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') mode = saved
  } catch {
    // keep default
  }
  emit()
}

export function setThemeMode(next: ThemeMode) {
  if (next === mode) return
  mode = next
  AsyncStorage.setItem(KEY, next).catch(() => {})
  emit()
}

export const toggleThemeMode = () => setThemeMode(mode === 'dark' ? 'light' : 'dark')

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useThemeMode = (): ThemeMode => useSyncExternalStore(subscribe, () => mode, () => mode)

/** Current shell palette. */
export const useTheme = (): Palette => palettes[useThemeMode()]
