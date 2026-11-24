// Import only the four Poppins faces the app uses (the package index would bundle all 18).
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium'
import { Poppins_500Medium_Italic } from '@expo-google-fonts/poppins/500Medium_Italic'
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold'
import { Poppins_700Bold_Italic } from '@expo-google-fonts/poppins/700Bold_Italic'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useFonts } from 'expo-font'
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
    Poppins_500Medium,
    Poppins_500Medium_Italic,
    Poppins_700Bold,
    Poppins_700Bold_Italic,
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
