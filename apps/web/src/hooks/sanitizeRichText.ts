import type { FieldHook } from 'payload'

/**
 * Save-side rich-text sanitising (contract §5). The read side applies the same rules again.
 * - links: only http(s), mailto, tel; otherwise the link is unwrapped (text kept)
 * - embeds: provider host must be on the allow-list, otherwise the node is removed
 */
export const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'] as const

export const EMBED_PROVIDERS = {
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch'],
} as const

export type EmbedProvider = keyof typeof EMBED_PROVIDERS

export function isAllowedLinkUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.trim() === '') return false
  const trimmed = url.trim()
  // Site-relative paths and in-page anchors are safe.
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('#')) return true
  try {
    return (ALLOWED_LINK_PROTOCOLS as readonly string[]).includes(new URL(trimmed).protocol)
  } catch {
    return false
  }
}

export function isAllowedEmbed(provider: unknown, url: unknown): boolean {
  if (typeof provider !== 'string' || !(provider in EMBED_PROVIDERS) || typeof url !== 'string') return false
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return (EMBED_PROVIDERS[provider as EmbedProvider] as readonly string[]).includes(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

interface LexicalNode {
  type?: string
  children?: LexicalNode[]
  fields?: Record<string, unknown>
  [key: string]: unknown
}

function sanitizeChildren(children: LexicalNode[]): LexicalNode[] {
  const out: LexicalNode[] = []
  for (const node of children) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'html' || node.type === 'raw') continue
    if ((node.type === 'link' || node.type === 'autolink') && node.fields?.linkType !== 'internal') {
      if (!isAllowedLinkUrl(node.fields?.url)) {
        out.push(...sanitizeChildren(node.children ?? []))
        continue
      }
    }
    if (node.type === 'block' && node.fields?.blockType === 'embed') {
      if (!isAllowedEmbed(node.fields.provider, node.fields.url)) continue
    }
    out.push(node.children ? { ...node, children: sanitizeChildren(node.children) } : node)
  }
  return out
}

export function sanitizeLexical<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  const root = (value as { root?: LexicalNode }).root
  if (!root || !Array.isArray(root.children)) return value
  return { ...value, root: { ...root, children: sanitizeChildren(root.children) } }
}

export const sanitizeRichTextHook: FieldHook = ({ value }) => sanitizeLexical(value)
