/**
 * LokLens Create / Edit Article Studio view (/admin/collections/articles/create and /admin/collections/articles/:id).
 * Server component registered as Articles.admin.components.views.edit.default.Component.
 */
import type { Payload, TypedUser } from 'payload'

import {
  ArticleEditorClient,
  type EditorAuthorOption,
  type EditorCategoryOption,
  type EditorMediaOption,
  type EditorTagOption,
  type InitialArticleDoc,
} from './ArticleEditorClient'
import { mediaUrlOf } from './dashboard-data'

const IST_OFFSET_MS = 330 * 60_000

/**
 * Value for the datetime-local publish input: IST wall-clock time (YYYY-MM-DDTHH:mm), now when unset.
 * The client converts it back with an explicit +05:30 offset, so saving never shifts the time
 * whatever the browser or server timezone is.
 */
function toIstInputValue(publishedAt: unknown): string {
  const parsed = typeof publishedAt === 'string' ? Date.parse(publishedAt) : Number.NaN
  const ms = Number.isNaN(parsed) ? Date.now() : parsed
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 16)
}

type Props = {
  doc?: Record<string, unknown> | null
  payload: Payload
  user?: TypedUser | null
  formState?: unknown
  documentSubViewType?: unknown
  viewType?: unknown
  Description?: React.ReactNode
  BeforeDocumentControls?: React.ReactNode
  BeforeFields?: React.ReactNode
  AfterFields?: React.ReactNode
  AfterDocument?: React.ReactNode
}

function lexicalToPlainText(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const root = (body as { root?: { children?: unknown[] } }).root
  if (!root || !Array.isArray(root.children)) return ''
  const blocks: string[] = []

  function walkText(node: unknown): string {
    if (!node || typeof node !== 'object') return ''
    const n = node as { type?: string; text?: string; children?: unknown[] }
    if (typeof n.text === 'string') return n.text
    if (Array.isArray(n.children)) return n.children.map(walkText).join('')
    return ''
  }

  for (const child of root.children) {
    if (!child || typeof child !== 'object') continue
    const c = child as { type?: string; tag?: string }
    const txt = walkText(child).trim()
    if (!txt) continue
    if (c.type === 'heading' && c.tag === 'h2') blocks.push(`## ${txt}`)
    else if (c.type === 'heading' && c.tag === 'h3') blocks.push(`### ${txt}`)
    else if (c.type === 'quote') blocks.push(`> ${txt}`)
    else blocks.push(txt)
  }
  return blocks.join('\n\n')
}

/**
 * True when the Lexical body holds anything the plain-text Studio editor cannot round-trip
 * (links, lists, images, bold/italic, h1/h4+ headings...). Saving edited text would drop it.
 */
function hasRichContent(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const root = (body as { root?: unknown }).root
  function walk(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false
    const n = node as { type?: string; tag?: string; format?: unknown; children?: unknown[] }
    if (n.type === 'text') {
      if (typeof n.format === 'number' && n.format !== 0) return true
    } else if (n.type === 'heading') {
      if (n.tag !== 'h2' && n.tag !== 'h3') return true
    } else if (n.type !== 'root' && n.type !== 'paragraph' && n.type !== 'quote' && n.type !== 'linebreak') {
      return true
    }
    return Array.isArray(n.children) && n.children.some(walk)
  }
  return walk(root)
}

function idOfRel(val: unknown): number | undefined {
  if (typeof val === 'number') return val
  if (val && typeof val === 'object' && 'id' in val) {
    const id = Number((val as { id: unknown }).id)
    return Number.isNaN(id) ? undefined : id
  }
  return undefined
}

function idsOfRelArray(val: unknown): number[] {
  if (!Array.isArray(val)) return []
  return val.map(idOfRel).filter((x): x is number => typeof x === 'number')
}

export async function ArticleEditView(props: Props) {
  const { doc, payload, user } = props
  const accessOpt = { overrideAccess: false as const, user: user ?? undefined }

  const [catRes, userRes, tagRes, mediaRes, locRes] = await Promise.all([
    payload.find({ collection: 'categories', limit: 100, depth: 0, pagination: false, ...accessOpt }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'users', limit: 100, depth: 0, pagination: false, ...accessOpt }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'tags', limit: 100, depth: 0, pagination: false, ...accessOpt }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'media', limit: 40, depth: 0, sort: '-updatedAt', ...accessOpt }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'locations', limit: 100, depth: 0, pagination: false, ...accessOpt }).catch(() => ({ docs: [] })),
  ])

  const categories: EditorCategoryOption[] = catRes.docs.map((c) => ({
    id: c.id,
    name: String(c.name),
    slug: String(c.slug),
  }))

  const authors: EditorAuthorOption[] = userRes.docs.map((u) => {
    const usr = u as unknown as { id: number; displayName?: string; name?: string; email?: string; role?: string }
    return {
      id: usr.id,
      name: String(usr.displayName || usr.name || usr.email || `User #${usr.id}`),
      role: String(usr.role || 'reporter'),
    }
  })

  const tags: EditorTagOption[] = tagRes.docs.map((t) => ({
    id: t.id,
    name: String(t.name),
    slug: String(t.slug),
  }))

  const mediaItems: EditorMediaOption[] = mediaRes.docs.map((m) => ({
    id: m.id,
    url: mediaUrlOf(m),
    alt: String((m as unknown as { alt?: string }).alt || `Media #${m.id}`),
  }))

  const locations = locRes.docs.map((l) => ({
    id: l.id,
    name: String(l.name),
    slug: String(l.slug),
  }))

  const seoGroup = (doc?.seo ?? {}) as {
    metaTitle?: string
    metaDescription?: string
    ogImage?: unknown
  }

  const formattedLocalDateTime = toIstInputValue(doc?.publishedAt)

  const initialDoc: InitialArticleDoc = {
    id: typeof doc?.id === 'number' ? doc.id : undefined,
    title: typeof doc?.title === 'string' ? doc.title : '',
    slug: typeof doc?.slug === 'string' ? doc.slug : '',
    summary: typeof doc?.summary === 'string' ? doc.summary : '',
    bodyText: lexicalToPlainText(doc?.body),
    rawBody: doc?.body,
    bodyHasRichContent: hasRichContent(doc?.body),
    categoryId: idOfRel(doc?.category) ?? categories[0]?.id,
    locationId: idOfRel(doc?.location),
    authorIds: idsOfRelArray(doc?.authors),
    tagIds: idsOfRelArray(doc?.tags),
    featuredImageId: idOfRel(doc?.featuredImage),
    featuredImageUrl: doc?.featuredImage ? mediaUrlOf(doc.featuredImage) : '',
    galleryUrls: [],
    seoTitle: String(seoGroup.metaTitle ?? ''),
    metaDescription: String(seoGroup.metaDescription ?? ''),
    focusKeyword: '',
    canonicalUrl: '',
    socialImageId: idOfRel(seoGroup.ogImage),
    socialImageUrl: seoGroup.ogImage ? mediaUrlOf(seoGroup.ogImage) : '',
    status: doc?._status === 'published' ? 'published' : 'draft',
    isFeatured: Boolean(doc?.isFeatured),
    isBreaking: Boolean(doc?.isBreaking),
    isTrending: Boolean(doc?.isTrending),
    publishedAt: formattedLocalDateTime,
  }

  return (
    <ArticleEditorClient
      initialDoc={initialDoc}
      categories={categories}
      authors={authors}
      tags={tags}
      mediaItems={mediaItems}
      locations={locations}
      payloadEditProps={{
        formState: props.formState,
        documentSubViewType: props.documentSubViewType,
        viewType: props.viewType,
        Description: props.Description,
        BeforeDocumentControls: props.BeforeDocumentControls,
        BeforeFields: props.BeforeFields,
        AfterFields: props.AfterFields,
        AfterDocument: props.AfterDocument,
      }}
    />
  )
}

