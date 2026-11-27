/**
 * Bookmarks saved on the device (AsyncStorage). Whole ArticleCards are stored so the Bookmarks screen
 * works offline. Tiny external store + useSyncExternalStore; no extra state library.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

import type { ArticleCard } from './api/types'

const KEY = 'loklens-bookmarks-v1'
let items: ArticleCard[] = []
let loaded = false
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

async function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = await AsyncStorage.getItem(KEY)
    items = raw ? (JSON.parse(raw) as ArticleCard[]) : []
  } catch {
    items = []
  }
  emit()
}

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {})
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  void load()
  return () => listeners.delete(listener)
}

export function toggleBookmark(article: ArticleCard) {
  items = items.some((a) => a.id === article.id) ? items.filter((a) => a.id !== article.id) : [toCard(article), ...items]
  save()
  emit()
}

/** Keep only the card fields (an Article also carries body/related, which we don't need to store). */
function toCard(a: ArticleCard): ArticleCard {
  const { id, title, slug, url, summary, image, category, location, publishedAt, updatedAt, isBreaking, isTrending, isFeatured } = a
  return { id, title, slug, url, summary, image, category, location, publishedAt, updatedAt, isBreaking, isTrending, isFeatured }
}

export function useBookmarks(): ArticleCard[] {
  return useSyncExternalStore(subscribe, () => items, () => items)
}

export function useIsBookmarked(id: number): boolean {
  return useSyncExternalStore(subscribe, () => items.some((a) => a.id === id), () => false)
}
