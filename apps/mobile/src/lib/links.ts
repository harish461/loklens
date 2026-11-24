/**
 * Opens a link from article content. LokLens article/category/tag/page URLs open inside the app;
 * everything else goes to the system browser or the matching app (YouTube, X, …). No WebView.
 */
import { router } from 'expo-router'
import { Linking } from 'react-native'

import { SITE_URL } from './api/client'

const SITE_HOSTS = new Set(['loklensnews.com', 'www.loklensnews.com'])
const SAFE_SCHEMES = /^(https?:|mailto:|tel:)/i

/** Returns the in-app route for a LokLens path, or null when the path is not one the app shows. */
export function inAppRoute(path: string): (() => void) | null {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '')
  const parts = clean.split('/').filter(Boolean)
  if (parts.length === 2 && parts[0] === 'tag') return () => router.push({ pathname: '/tag/[slug]', params: { slug: parts[1] } })
  if (parts.length === 2) {
    const id = Number(/-(\d+)$/.exec(parts[1])?.[1])
    if (Number.isSafeInteger(id) && id > 0) return () => router.push({ pathname: '/article/[id]', params: { id: String(id) } })
  }
  if (parts.length === 1 && /^[a-z0-9-]+$/.test(parts[0])) {
    const slug = parts[0]
    const pages = ['about', 'contact', 'advertise', 'privacy-policy', 'terms', 'editorial-policy', 'corrections-policy', 'disclaimer']
    if (pages.includes(slug)) return () => router.push({ pathname: '/page/[slug]', params: { slug } })
    return () => router.push({ pathname: '/category/[slug]', params: { slug } })
  }
  return null
}

export function openLink(raw: string | undefined | null) {
  const href = (raw ?? '').trim()
  if (!href) return
  if (href.startsWith('/')) {
    const local = inAppRoute(href)
    if (local) return local()
    return void Linking.openURL(`${SITE_URL}${href}`).catch(() => {})
  }
  if (!SAFE_SCHEMES.test(href)) return
  try {
    const url = new URL(href)
    if (SITE_HOSTS.has(url.hostname.toLowerCase())) {
      const local = inAppRoute(url.pathname)
      if (local) return local()
    }
  } catch {
    return
  }
  void Linking.openURL(href).catch(() => {})
}
