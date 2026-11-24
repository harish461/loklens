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
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { PERSIST_MAX_AGE, persister, queryClient } from '@/lib/queryClient'
import { colors, fonts } from '@/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  })
  const ready = fontsLoaded || Boolean(fontError)

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
        <StatusBar style="dark" />
        <Stack
          // Pushed screens draw their own TopBar (round back button + actions).
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
        />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  )
}
