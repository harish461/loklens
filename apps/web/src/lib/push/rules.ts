/**
 * Push notification rules (api-contract §8). Pure functions, no Payload imports, so they are unit-tested.
 */

export type NotificationType = 'article' | 'breaking' | 'general'
export type Platform = 'android' | 'ios'

export interface PushPreferences {
  enabled: boolean
  breaking: boolean
  general: boolean
  mutedCategories: number[]
}

export const DEFAULT_PREFERENCES: PushPreferences = { enabled: true, breaking: true, general: true, mutedCategories: [] }

/** Expo push tokens look like `ExponentPushToken[xxxxxxxx]` (older) or `ExpoPushToken[xxxxxxxx]`. */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,100}\]$/

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && EXPO_TOKEN.test(value)
}

export function isPlatform(value: unknown): value is Platform {
  return value === 'android' || value === 'ios'
}

/** Short free-text fields from the app (device ID, app version): trimmed, length-capped, or undefined. */
export function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

/**
 * Validates preferences from the app. Returns null when the shape is wrong. Category IDs are de-duplicated
 * positive integers (at most 200, more than the site will ever have).
 */
export function parsePreferences(value: unknown): PushPreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (typeof v.enabled !== 'boolean' || typeof v.breaking !== 'boolean' || typeof v.general !== 'boolean') return null
  if (!Array.isArray(v.mutedCategories) || v.mutedCategories.length > 200) return null
  if (!v.mutedCategories.every((id) => Number.isInteger(id) && (id as number) > 0)) return null
  return {
    enabled: v.enabled,
    breaking: v.breaking,
    general: v.general,
    mutedCategories: [...new Set(v.mutedCategories as number[])],
  }
}

/** Stored preferences may be partial (older rows, admin edits): fill in the defaults. */
export function normalizeStoredPreferences(value: unknown): PushPreferences {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const muted = Array.isArray(v.mutedCategories) ? v.mutedCategories.filter((id): id is number => Number.isInteger(id)) : []
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_PREFERENCES.enabled,
    breaking: typeof v.breaking === 'boolean' ? v.breaking : DEFAULT_PREFERENCES.breaking,
    general: typeof v.general === 'boolean' ? v.general : DEFAULT_PREFERENCES.general,
    mutedCategories: muted,
  }
}

export interface TargetSpec {
  type: NotificationType
  /** Category of the article, or the category picked for a "category subscribers" notification. */
  categoryId?: number | null
  /** 'all' | 'breaking' | 'category' — who was chosen in the admin form. */
  audience: 'all' | 'breaking' | 'category'
}

/**
 * Whether a device with these preferences should get this notification (contract §8 "Who receives").
 * The audience narrows further: "breaking subscribers" needs `breaking`; "category subscribers" needs the
 * category not muted.
 */
export function wantsNotification(prefs: PushPreferences, spec: TargetSpec): boolean {
  if (!prefs.enabled) return false
  const categoryAllowed = spec.categoryId == null || !prefs.mutedCategories.includes(spec.categoryId)
  if (spec.audience === 'breaking' && !prefs.breaking) return false
  if (spec.audience === 'category' && (!categoryAllowed || spec.categoryId == null)) return false
  switch (spec.type) {
    case 'breaking':
      return prefs.breaking
    case 'article':
      return categoryAllowed
    case 'general':
      return prefs.general
  }
}

/** `pushOnPublish` values on articles. 'auto' sends only for breaking news (the configurable default). */
export type PushOnPublish = 'auto' | 'send' | 'skip'

export function shouldPushOnPublish(mode: unknown, isBreaking: boolean): boolean {
  if (mode === 'send') return true
  if (mode === 'skip') return false
  return isBreaking // 'auto' and missing values
}

/** True only for a real publish event: the document was not published before and is published now. */
export function isNewPublish(previousStatus: unknown, nextStatus: unknown): boolean {
  return nextStatus === 'published' && previousStatus !== 'published'
}

export const articleDedupeKey = (articleId: number | string) => `article-publish:${articleId}`

export const articleDeepLink = (articleId: number | string) => `loklens://article/${articleId}`
export const HOME_DEEP_LINK = 'loklens://'

export interface MessageInput {
  notificationId: number
  type: NotificationType
  title: string
  body: string
  imageUrl?: string | null
  articleId?: number | null
  articleSlug?: string | null
  categorySlug?: string | null
}

export interface ExpoMessage {
  to: string
  title: string
  body: string
  sound: 'default'
  priority: 'high'
  channelId: 'news'
  data: Record<string, string | number | null>
  richContent?: { image: string }
}

/** The one payload shape the app understands (contract §8). */
export function buildMessage(token: string, n: MessageInput): ExpoMessage {
  const message: ExpoMessage = {
    to: token,
    title: n.title,
    body: n.body,
    sound: 'default',
    priority: 'high',
    channelId: 'news',
    data: {
      notificationId: n.notificationId,
      notificationType: n.type,
      articleId: n.articleId ?? null,
      articleSlug: n.articleSlug ?? null,
      category: n.categorySlug ?? null,
      deepLink: n.articleId ? articleDeepLink(n.articleId) : HOME_DEEP_LINK,
    },
  }
  if (n.imageUrl && /^https:\/\//.test(n.imageUrl)) message.richContent = { image: n.imageUrl }
  return message
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
