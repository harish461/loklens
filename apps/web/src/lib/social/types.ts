/** Normalised post from an external social account (currently YouTube only). */
export interface SocialPost {
  platform: 'youtube'
  id: string
  title: string // trimmed to ~120 characters
  url: string // the post on the platform
  thumbnail: { url: string; width: number; height: number } | null
  publishedAt: string // ISO 8601 with IST offset
}

export interface SocialFeed {
  status: 'ok' | 'error'
  posts: SocialPost[]
}
