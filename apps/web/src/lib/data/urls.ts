/** Public site origin (no trailing slash). Empty when not configured, in which case paths stay relative. */
export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '')
}

/** Contract §1: image and file URLs are absolute. */
export function absoluteUrl(pathOrUrl: string, base: string = siteBaseUrl()): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  if (!base) return pathOrUrl
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

/** Adds the version query (architecture §5): ?v={updatedAt} so /media can be cached for a year. */
export function withVersion(url: string, updatedAt: string | null | undefined): string {
  const t = updatedAt ? new Date(updatedAt).getTime() : NaN
  if (Number.isNaN(t)) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${t}`
}
