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
import { useCallback, useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { BrandSplash } from '@/components/BrandSplash'
import { PushHandler } from '@/components/PushHandler'
import { PERSIST_MAX_AGE, persister, queryClient } from '@/lib/queryClient'
import { refreshMe } from '@/lib/auth/client'
import { loadSession, useSession } from '@/lib/auth/session'
import { loadThemeMode, useTheme } from '@/theme'

// The native splash stays until the branded splash (BrandSplash) has drawn its artwork, then hides itself.
SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_500Medium,
    Poppins_500Medium_Italic,
    Poppins_700Bold,
    Poppins_700Bold_Italic,
  })
  const [themeLoaded, setThemeLoaded] = useState(false)
  const session = useSession()
  const t = useTheme()

  // Read the saved light/dark choice before the first frame, so the app never flashes the wrong theme.
  useEffect(() => {
    loadThemeMode().finally(() => setThemeLoaded(true))
  }, [])

  // Restore the saved customer session, then refresh the user in the background (offline keeps the cache).
  useEffect(() => {
    loadSession().then(() => refreshMe())
  }, [])

  const ready = (fontsLoaded || Boolean(fontError)) && themeLoaded && session.loaded
  const signedIn = Boolean(session.token)

  // The branded splash stays on top of the app until it has faded out (it sets its own minimum time).
  const [splashDone, setSplashDone] = useState(false)
  const hideSplash = useCallback(() => setSplashDone(true), [])

  return (
    <SafeAreaProvider>
      {ready ? (
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
          <StatusBar style={splashDone ? t.statusBar : 'dark'} />
          <Stack
            // Pushed screens draw their own TopBar (round back button + actions).
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}
          >
            {/* Signed-out readers only reach the account screens; the router moves them when this changes. */}
            <Stack.Protected guard={signedIn} redirectTo="/sign-in">
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="article/[id]" />
              <Stack.Screen name="category/[slug]" />
              <Stack.Screen name="tag/[slug]" />
              <Stack.Screen name="latest" />
              <Stack.Screen name="search" />
              <Stack.Screen name="page/[slug]" />
              <Stack.Screen name="notification-settings" />
              <Stack.Screen name="delete-account" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="register" />
              <Stack.Screen name="forgot" />
            </Stack.Protected>
            {/* About, contact, privacy and terms stay readable whether or not the reader is signed in. */}
            <Stack.Screen name="info/[slug]" />
          </Stack>
          {/* Push registration and notification taps; re-mounts on every sign-in. */}
          {signedIn ? <PushHandler key={session.token} /> : null}
        </PersistQueryClientProvider>
      ) : (
        <StatusBar style="dark" />
      )}
      {splashDone ? null : <BrandSplash appReady={ready} onHidden={hideSplash} />}
    </SafeAreaProvider>
  )
}
