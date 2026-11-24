/** Web build of the Short player (used by the browser preview): YouTube's official embed in an iframe. */
import { createElement } from 'react'
import { StyleSheet, View } from 'react-native'

import { SITE_URL } from '@/lib/api/client'

export function ShortPlayer({ id }: { id: string }) {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1', // browsers block autoplay with sound
    playsinline: '1',
    loop: '1',
    playlist: id,
    controls: '1',
    rel: '0',
    modestbranding: '1',
    origin: typeof window !== 'undefined' ? window.location.origin : SITE_URL,
  })
  return (
    <View style={StyleSheet.absoluteFill}>
      {createElement('iframe', {
        src: `https://www.youtube.com/embed/${id}?${params.toString()}`,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowFullScreen: true,
        style: { width: '100%', height: '100%', border: 0, background: '#000' },
        title: 'YouTube Short',
      })}
    </View>
  )
}
