import { describe, expect, it } from 'vitest'

import {
  articleDedupeKey,
  buildMessage,
  chunk,
  DEFAULT_PREFERENCES,
  isExpoPushToken,
  isNewPublish,
  normalizeStoredPreferences,
  parsePreferences,
  shouldPushOnPublish,
  wantsNotification,
  type PushPreferences,
} from '../../src/lib/push/rules'

const prefs = (over: Partial<PushPreferences> = {}): PushPreferences => ({ ...DEFAULT_PREFERENCES, ...over })

describe('isExpoPushToken', () => {
  it('accepts both Expo token formats', () => {
    expect(isExpoPushToken('ExponentPushToken[AbCdEf123456789xyz]')).toBe(true)
    expect(isExpoPushToken('ExpoPushToken[AbCdEf_123-456789]')).toBe(true)
  })
  it('rejects anything else', () => {
    for (const bad of ['', 'ExponentPushToken[]', 'ExponentPushToken[short]', 'fcm-token-123', 'ExponentPushToken[a b c d e f g h]', 42, null]) {
      expect(isExpoPushToken(bad)).toBe(false)
    }
  })
})

describe('parsePreferences', () => {
  it('accepts a full, valid object and de-duplicates categories', () => {
    expect(parsePreferences({ enabled: true, breaking: false, general: true, mutedCategories: [3, 3, 5] })).toEqual({
      enabled: true,
      breaking: false,
      general: true,
      mutedCategories: [3, 5],
    })
  })
  it('rejects missing switches, wrong types and bad category IDs', () => {
    expect(parsePreferences(null)).toBeNull()
    expect(parsePreferences([])).toBeNull()
    expect(parsePreferences({ enabled: true, breaking: true, mutedCategories: [] })).toBeNull()
    expect(parsePreferences({ enabled: 'yes', breaking: true, general: true, mutedCategories: [] })).toBeNull()
    expect(parsePreferences({ enabled: true, breaking: true, general: true, mutedCategories: [0] })).toBeNull()
    expect(parsePreferences({ enabled: true, breaking: true, general: true, mutedCategories: ['3'] })).toBeNull()
    expect(parsePreferences({ enabled: true, breaking: true, general: true, mutedCategories: Array(201).fill(1) })).toBeNull()
  })
})

describe('normalizeStoredPreferences', () => {
  it('fills defaults for empty or partial rows', () => {
    expect(normalizeStoredPreferences(undefined)).toEqual(DEFAULT_PREFERENCES)
    expect(normalizeStoredPreferences({ breaking: false, mutedCategories: [2, 'x'] })).toEqual({ ...DEFAULT_PREFERENCES, breaking: false, mutedCategories: [2] })
  })
})

describe('wantsNotification', () => {
  const article = (categoryId: number) => ({ type: 'article' as const, audience: 'all' as const, categoryId })
  it('the master switch turns everything off', () => {
    expect(wantsNotification(prefs({ enabled: false }), { type: 'breaking', audience: 'all' })).toBe(false)
    expect(wantsNotification(prefs({ enabled: false }), article(1))).toBe(false)
  })
  it('breaking follows the breaking switch', () => {
    expect(wantsNotification(prefs(), { type: 'breaking', audience: 'all' })).toBe(true)
    expect(wantsNotification(prefs({ breaking: false }), { type: 'breaking', audience: 'all' })).toBe(false)
  })
  it('category news respects muted categories', () => {
    expect(wantsNotification(prefs({ mutedCategories: [4] }), article(4))).toBe(false)
    expect(wantsNotification(prefs({ mutedCategories: [4] }), article(5))).toBe(true)
  })
  it('general updates follow the general switch', () => {
    expect(wantsNotification(prefs({ general: false }), { type: 'general', audience: 'all' })).toBe(false)
  })
  it('audience "breaking subscribers" also needs the breaking switch', () => {
    expect(wantsNotification(prefs({ breaking: false }), { type: 'general', audience: 'breaking' })).toBe(false)
  })
  it('audience "category subscribers" needs a category that is not muted', () => {
    expect(wantsNotification(prefs(), { type: 'general', audience: 'category', categoryId: 2 })).toBe(true)
    expect(wantsNotification(prefs({ mutedCategories: [2] }), { type: 'general', audience: 'category', categoryId: 2 })).toBe(false)
    expect(wantsNotification(prefs(), { type: 'general', audience: 'category' })).toBe(false)
  })
})

describe('publish rules', () => {
  it('auto sends for breaking news only; send/skip override', () => {
    expect(shouldPushOnPublish('auto', true)).toBe(true)
    expect(shouldPushOnPublish('auto', false)).toBe(false)
    expect(shouldPushOnPublish(undefined, true)).toBe(true)
    expect(shouldPushOnPublish('send', false)).toBe(true)
    expect(shouldPushOnPublish('skip', true)).toBe(false)
  })
  it('only a draft → published change is a new publish', () => {
    expect(isNewPublish('draft', 'published')).toBe(true)
    expect(isNewPublish(undefined, 'published')).toBe(true)
    expect(isNewPublish('published', 'published')).toBe(false)
    expect(isNewPublish('published', 'draft')).toBe(false)
    expect(isNewPublish('draft', 'draft')).toBe(false)
  })
  it('one dedupe key per article', () => {
    expect(articleDedupeKey(42)).toBe('article-publish:42')
  })
})

describe('buildMessage', () => {
  it('builds the contract payload with an article deep link', () => {
    const m = buildMessage('ExponentPushToken[abcdefghij12]', {
      notificationId: 9,
      type: 'breaking',
      title: 'बड़ी खबर',
      body: 'विवरण',
      imageUrl: 'https://loklensnews.com/x.webp',
      articleId: 51,
      articleSlug: 'slug-51',
      categorySlug: 'pradesh',
    })
    expect(m).toMatchObject({ to: 'ExponentPushToken[abcdefghij12]', channelId: 'news', priority: 'high', sound: 'default', richContent: { image: 'https://loklensnews.com/x.webp' } })
    expect(m.data).toEqual({ notificationId: 9, notificationType: 'breaking', articleId: 51, articleSlug: 'slug-51', category: 'pradesh', deepLink: 'loklens://article/51' })
  })
  it('general notifications open the app home; non-https images are dropped', () => {
    const m = buildMessage('ExponentPushToken[abcdefghij12]', { notificationId: 1, type: 'general', title: 't', body: 'b', imageUrl: 'http://x/y.png' })
    expect(m.data.deepLink).toBe('loklens://')
    expect(m.richContent).toBeUndefined()
  })
})

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 100)).toEqual([])
  })
})
