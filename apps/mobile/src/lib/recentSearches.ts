/** Last 8 search terms, kept on the device. */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

const KEY = 'loklens-recent-searches-v1'
const MAX = 8
let terms: string[] = []
let loaded = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(l: () => void) {
  listeners.add(l)
  if (!loaded) {
    loaded = true
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        terms = raw ? (JSON.parse(raw) as string[]) : []
        emit()
      })
      .catch(() => {})
  }
  return () => listeners.delete(l)
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(terms)).catch(() => {})
  emit()
}

export function addRecentSearch(term: string) {
  const t = term.trim()
  if (t.length < 2) return
  terms = [t, ...terms.filter((x) => x !== t)].slice(0, MAX)
  persist()
}

export function removeRecentSearch(term: string) {
  terms = terms.filter((x) => x !== term)
  persist()
}

export function clearRecentSearches() {
  terms = []
  persist()
}

export const useRecentSearches = () => useSyncExternalStore(subscribe, () => terms, () => terms)
