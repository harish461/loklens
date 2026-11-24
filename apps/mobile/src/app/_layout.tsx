import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-devanagari'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { PERSIST_MAX_AGE, persister, queryClient } from '@/lib/queryClient'
import { loadThemeMode, useTheme } from '@/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  })
  const [themeLoaded, setThemeLoaded] = useState(false)
  const t = useTheme()

  // Read the saved light/dark choice before the first frame, so the app never flashes the wrong theme.
  useEffect(() => {
    loadThemeMode().finally(() => setThemeLoaded(true))
  }, [])

  const ready = (fontsLoaded || Boolean(fontError)) && themeLoaded

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
        <StatusBar style={t.statusBar} />
        <Stack
          // Pushed screens draw their own TopBar (round back button + actions).
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}
        />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  )
}
