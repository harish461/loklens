/**
 * Converts between the Lexical JSON Payload stores (fields/richText.ts `newsEditor`) and the JSON the
 * NewsEditor's node set understands. Pure functions — unit-tested for exact round trips.
 *
 * - link / autolink: Payload keeps `{ fields: { url, newTab, linkType, doc? }, id }`; the editor uses
 *   @lexical/link's `{ url, target, rel }`. The Payload id/fields ride along in a stash keyed by a token in
 *   `rel`, so internal links and ids survive.
 * - upload: same shape on both sides (the editor's UploadNode stores Payload's data verbatim).
 * - anything else the editor doesn't know (embed/related `block`s, future node types) becomes an `opaque`
 *   node holding the original JSON, written back unchanged — editing never deletes content.
 */

export type JsonNode = Record<string, unknown> & { type?: string; children?: JsonNode[] }

/** Node types the editor renders natively. */
const NATIVE = new Set(['root', 'paragraph', 'text', 'linebreak', 'tab', 'heading', 'quote', 'list', 'listitem'])
const LINKS = new Set(['link', 'autolink'])
const INLINE_PARENTS = new Set(['paragraph', 'heading', 'quote', 'listitem', 'link', 'autolink'])

export const STASH_PREFIX = 'payload:'

/** Payload's link metadata for links that came from stored content. */
export interface StashedLink {
  id?: string
  fields: Record<string, unknown>
}

export class LinkStash {
  private next = 0
  private readonly map = new Map<string, StashedLink>()
  put(entry: StashedLink): string {
    const token = `l${++this.next}`
    this.map.set(token, entry)
    return token
  }
  get(token: string): StashedLink | undefined {
    return this.map.get(token)
  }
}

/** 24-hex id like Payload's (bson ObjectID shape) for new links/uploads. */
export function newNodeId(): string {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Upload `value` may be populated (depth > 0); the editor and Payload store only the id. */
export function uploadValueId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return null
}

export interface MediaInfo {
  url: string
  alt: string
  caption?: string
}

const EMPTY_ROOT = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textFormat: 0, textStyle: '', children: [] }],
  },
}

/**
 * Payload value → editor state JSON. Populated upload media found on the way are reported through
 * `onMedia` so the editor can show their images.
 */
export function toEditorJSON(
  value: unknown,
  stash: LinkStash,
  onMedia?: (id: number | string, info: MediaInfo) => void,
): { root: JsonNode } {
  const root = (value as { root?: JsonNode } | null | undefined)?.root
  if (!root || !Array.isArray(root.children) || root.children.length === 0) {
    return structuredClone(EMPTY_ROOT) as { root: JsonNode }
  }

  const walk = (node: JsonNode, parentType: string): JsonNode => {
    const type = String(node.type ?? '')
    if (LINKS.has(type)) {
      const fields = { ...((node.fields as Record<string, unknown>) ?? {}) }
      const token = stash.put({ id: typeof node.id === 'string' ? node.id : undefined, fields })
      const { fields: _f, id: _id, ...rest } = node
      return {
        ...rest,
        version: 1,
        url: typeof fields.url === 'string' ? fields.url : '',
        target: fields.newTab ? '_blank' : null,
        rel: `${STASH_PREFIX}${token}`,
        title: null,
        children: (node.children ?? []).map((c) => walk(c, type)),
      }
    }
    if (type === 'upload') {
      const id = uploadValueId(node.value)
      const media = node.value as { url?: string; alt?: string; caption?: string; sizes?: { card?: { url?: string } } }
      if (id !== null && media && typeof media === 'object' && onMedia) {
        onMedia(id, { url: media.sizes?.card?.url ?? media.url ?? '', alt: media.alt ?? '', caption: media.caption ?? '' })
      }
      return { ...node, value: id }
    }
    if (!NATIVE.has(type)) {
      return { type: 'opaque', version: 1, raw: node, inline: INLINE_PARENTS.has(parentType) }
    }
    return Array.isArray(node.children) ? { ...node, children: node.children.map((c) => walk(c, type)) } : node
  }
  return { root: walk(root, '') }
}

/** Editor state JSON → the exact Payload shape. */
export function fromEditorJSON(state: { root: JsonNode }, stash: LinkStash): { root: JsonNode } {
  const walk = (node: JsonNode): JsonNode => {
    const type = String(node.type ?? '')
    if (type === 'opaque') return node.raw as JsonNode
    if (LINKS.has(type)) {
      const { url, target, rel, title: _t, ...rest } = node as JsonNode & {
        url?: string
        target?: string | null
        rel?: string | null
      }
      const stashed =
        typeof rel === 'string' && rel.startsWith(STASH_PREFIX) ? stash.get(rel.slice(STASH_PREFIX.length)) : undefined
      const prev = stashed?.fields ?? { linkType: 'custom' }
      const newTab = target === '_blank'
      const href = typeof url === 'string' ? url : ''
      let fields: Record<string, unknown>
      if (prev.linkType === 'internal' && (href === '' || href === prev.url)) {
        fields = { ...prev, newTab } // internal link untouched (its target is a document, not a URL)
      } else {
        const { doc: _doc, ...custom } = prev
        fields = { ...custom, linkType: 'custom', url: href, newTab }
      }
      return {
        ...rest,
        type,
        version: 3,
        fields,
        id: stashed?.id ?? newNodeId(),
        children: (node.children ?? []).map(walk),
      }
    }
    return Array.isArray(node.children) ? { ...node, children: node.children.map(walk) } : node
  }
  return { root: walk(state.root) }
}

/** Plain-text length of a Payload value (for word counts). */
export function plainText(value: unknown): string {
  const parts: string[] = []
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    const node = n as JsonNode & { text?: unknown }
    if (typeof node.text === 'string') parts.push(node.text)
    if (Array.isArray(node.children)) {
      node.children.forEach(walk)
      if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'quote' || node.type === 'listitem') parts.push('\n')
    }
  }
  walk((value as { root?: unknown } | null)?.root)
  return parts.join('')
}
