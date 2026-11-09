import NextImage from 'next/image'

import type { Image, ImageSize } from '@/lib/data/types'

/**
 * next/image over the pre-generated sizes (architecture §5: the Next optimizer stays off, the server
 * never resizes on request). We pick the smallest generated size that covers `minWidth` CSS px at 2x.
 * TODO(frontend): once real media exists, switch to `images.loaderFile` so srcset covers all sizes.
 */
const ORDER: ImageSize[] = ['thumb', 'card', 'article', 'wide']

export function pickImage(image: Image, minWidth: number, preferred?: ImageSize) {
  if (preferred && image.sizes[preferred]) return image.sizes[preferred]!
  const target = minWidth * 2
  for (const key of ORDER) {
    const s = image.sizes[key]
    if (s && s.width >= target) return s
  }
  return { url: image.url, width: image.width, height: image.height }
}

interface Props {
  image: Image
  /** Largest CSS width this image is rendered at; used to pick the file. */
  displayWidth: number
  sizes: string
  preferred?: ImageSize
  priority?: boolean
  className?: string
}

export function NewsImage({ image, displayWidth, sizes, preferred, priority, className }: Props) {
  const src = pickImage(image, displayWidth, preferred)
  return (
    <NextImage
      src={src.url}
      width={src.width}
      height={src.height}
      alt={image.alt}
      sizes={sizes}
      unoptimized
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      className={className}
    />
  )
}
