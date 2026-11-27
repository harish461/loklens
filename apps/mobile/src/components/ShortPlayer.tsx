/**
 * YouTube Short player (Android/iOS). YouTube videos may only be played through YouTube's official
 * embedded player, which needs a WebView — this is the only WebView in the app (user-approved).
 * The page is loaded with a loklensnews.com base URL so YouTube sees a valid embed origin/referer.
 */
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { SITE_URL } from '@/lib/api/client'

export function embedHtml(id: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    loop: '1',
    playlist: id, // required for loop
    controls: '1',
    rel: '0',
    modestbranding: '1',
    origin: SITE_URL,
  })
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body><iframe src="https://www.youtube.com/embed/${id}?${params.toString()}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></body></html>`
}

export function ShortPlayer({ id }: { id: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        source={{ html: embedHtml(id), baseUrl: SITE_URL }}
        style={styles.web}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        // Never navigate away from the player inside the app; YouTube links open outside.
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#000' },
})
