import { Image as ExpoImage, type ImageStyle } from 'expo-image'
import { Platform, type StyleProp } from 'react-native'

import type { Image, ImageSize } from '@/lib/api/types'
import { colors } from '@/theme'

interface Props {
  image: Image
  /** Preferred pre-generated size; falls back to the original. Use `thumb` for lists, `card` for cards. */
  size?: ImageSize
  style?: StyleProp<ImageStyle>
  priority?: 'low' | 'normal' | 'high'
}

/** Cached, fading news image using the API's pre-generated WebP sizes (never the full original in lists). */
export function NewsImage({ image, size = 'card', style, priority = 'normal' }: Props) {
  const uri = image.sizes[size]?.url ?? image.url
  return (
    <ExpoImage
      source={{ uri }}
      style={[{ backgroundColor: colors.skeleton }, style]}
      contentFit="cover"
      // The web build sometimes leaves the fade stuck at opacity 0; fade only on native.
      transition={Platform.OS === 'web' ? 0 : 180}
      cachePolicy="memory-disk"
      priority={priority}
      accessibilityLabel={image.alt}
      recyclingKey={uri}
    />
  )
}
