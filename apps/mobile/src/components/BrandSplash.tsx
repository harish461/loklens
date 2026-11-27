/**
 * Full-screen branded splash, shown after the native splash while the app loads (fonts, theme, session).
 *
 * The native Android splash (Android 12+ SplashScreen API) can only show a centred icon, so the full-bleed
 * artwork is drawn here instead. The native splash is hidden once this image is on screen, so there is no
 * blank frame between the two. The artwork then stays for at least MIN_VISIBLE_MS and fades out once the app
 * is ready.
 */
import { Image } from 'expo-image'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet } from 'react-native'

const ARTWORK = require('../../assets/brand/splash.webp')

/** Matches the artwork's light background, so the edges blend on screens with a different aspect ratio. */
export const SPLASH_BACKGROUND = '#F2F5F9'

/** How long the artwork stays on screen at minimum, counted from when it is actually drawn. */
const MIN_VISIBLE_MS = 1200
/** If the artwork has not been drawn by then (slow device, failed load), stop waiting for it. */
const ARTWORK_TIMEOUT_MS = 3000

export function BrandSplash({ appReady, onHidden }: { appReady: boolean; onHidden: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current
  const [artworkShown, setArtworkShown] = useState(false)
  const [minTimePassed, setMinTimePassed] = useState(false)

  // Hide the native splash once the artwork is drawn, or after the timeout at the latest.
  useEffect(() => {
    if (artworkShown) {
      SplashScreen.hideAsync().catch(() => {})
      const timer = setTimeout(() => setMinTimePassed(true), MIN_VISIBLE_MS)
      return () => clearTimeout(timer)
    }
    const fallback = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {})
      setMinTimePassed(true)
    }, ARTWORK_TIMEOUT_MS)
    return () => clearTimeout(fallback)
  }, [artworkShown])

  const done = appReady && minTimePassed
  useEffect(() => {
    if (!done) return
    // The JS driver also works on web, where the native animated module is missing.
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => onHidden())
  }, [done, opacity, onHidden])

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]} pointerEvents={done ? 'none' : 'auto'}>
      <Image
        source={ARTWORK}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onDisplay={() => setArtworkShown(true)}
        accessibilityLabel="LokLens News"
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BACKGROUND, zIndex: 10 },
})
