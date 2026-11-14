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
import type { ArticleWorkflowStatus } from './mock-cms-data'

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

function serializeInline(nodes: unknown[] | undefined): string {
  if (!Array.isArray(nodes)) return ''
  return nodes
    .map((node) => {
      if (!node || typeof node !== 'object') return ''
      const n = node as {
        type?: string
        text?: string
        format?: number
        fields?: { url?: string }
        children?: unknown[]
      }
      if (n.type === 'linebreak') return '\n'
      if (n.type === 'link' || n.type === 'autolink') {
        const inner = serializeInline(n.children)
        const url = typeof n.fields?.url === 'string' ? n.fields.url : ''
        return url ? `[${inner || url}](${url})` : inner
      }
      if (typeof n.text === 'string') {
        let out = n.text
        const fmt = typeof n.format === 'number' ? n.format : 0
        if (!out) return ''
        if (fmt & 8) out = `__${out}__`
        if (fmt & 2) out = `*${out}*`
        if (fmt & 1) out = `**${out}**`
        return out
      }
      if (Array.isArray(n.children)) return serializeInline(n.children)
      return ''
    })
    .join('')
}

function lexicalToPlainText(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const root = (body as { root?: { children?: unknown[] } }).root
  if (!root || !Array.isArray(root.children)) return ''
  const blocks: string[] = []

  for (const child of root.children) {
    if (!child || typeof child !== 'object') continue
    const c = child as {
      type?: string
      tag?: string
      listType?: string
      children?: unknown[]
    }
    if (c.type === 'list' && Array.isArray(c.children)) {
      const items = c.children
        .map((li, idx) => {
          if (!li || typeof li !== 'object') return ''
          const liNode = li as { children?: unknown[] }
          const txt = serializeInline(liNode.children).trim()
          if (!txt) return ''
          return c.listType === 'number' ? `${idx + 1}. ${txt}` : `• ${txt}`
        })
        .filter(Boolean)
      if (items.length > 0) blocks.push(items.join('\n'))
      continue
    }
    const txt = serializeInline(c.children).trim()
    if (!txt) continue
    if (c.type === 'heading' && c.tag === 'h2') blocks.push(`## ${txt}`)
    else if (c.type === 'heading' && c.tag === 'h3') blocks.push(`### ${txt}`)
    else if (c.type === 'heading' && c.tag === 'h4') blocks.push(`#### ${txt}`)
    else if (c.type === 'quote') blocks.push(`> ${txt}`)
    else blocks.push(txt)
  }
  return blocks.join('\n\n')
}

/**
 * True only when the Lexical body holds custom block/upload nodes (`upload` or `block`)
 * that can only be edited in Classic Lexical mode. Standard headings, lists, quotes, links,
 * bold, italic, and underline round-trip cleanly in the Studio editor.
 */
function hasRichContent(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const root = (body as { root?: unknown }).root
  function walk(node: unknown): boolean {
    if (!node || typeof node !== 'object') return false
    const n = node as { type?: string; children?: unknown[] }
    if (n.type === 'upload' || n.type === 'block') return true
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

function resolveInitialStatus(doc: Record<string, unknown> | null | undefined): ArticleWorkflowStatus {
  if (!doc) return 'draft'
  if (doc._status === 'published') return 'published'
  if (doc.workflowStatus === 'pending_review' || doc.workflowStatus === 'rejected') {
    return doc.workflowStatus
  }
  const pubMs = typeof doc.publishedAt === 'string' ? Date.parse(doc.publishedAt) : Number.NaN
  if (!Number.isNaN(pubMs) && pubMs > Date.now()) {
    return 'scheduled'
  }
  return 'draft'
}

export async function ArticleEditView(props: Props) {
  const { doc, payload, user } = props
  const accessOpt = { overrideAccess: false as const, user: user ?? undefined }

  const [catRes, userRes, tagRes, mediaRes, locRes] = await Promise.all([
    payload.find({ collection: 'categories', limit: 100, depth: 0, pagination: false, sort: 'order', ...accessOpt }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'users', limit: 100, depth: 0, pagination: false, ...accessOpt }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'tags', limit: 100, depth: 0, pagination: false, ...accessOpt }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'media', limit: 50, depth: 0, sort: '-updatedAt', ...accessOpt }).catch(() => ({ docs: [] })),
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

  const mediaItems: EditorMediaOption[] = mediaRes.docs.map((m) => {
    const raw = m as unknown as { alt?: string; width?: number; height?: number; filename?: string }
    return {
      id: m.id,
      url: mediaUrlOf(m),
      alt: String(raw.alt || raw.filename || `Media #${m.id}`),
      width: typeof raw.width === 'number' ? raw.width : undefined,
      height: typeof raw.height === 'number' ? raw.height : undefined,
    }
  })

  const locations = locRes.docs.map((l) => ({
    id: l.id,
    name: String(l.name),
    slug: String(l.slug),
  }))

  const seoGroup = (doc?.seo ?? {}) as {
    metaTitle?: string
    metaDescription?: string
    focusKeyword?: string
    noindex?: boolean
    ogImage?: unknown
  }

  const formattedLocalDateTime = toIstInputValue(doc?.publishedAt)
  const featuredImageId = idOfRel(doc?.featuredImage)
  const matchedFeaturedMedia = featuredImageId ? mediaItems.find((m) => m.id === featuredImageId) : undefined
  const socialImageId = idOfRel(seoGroup.ogImage)
  const matchedSocialMedia = socialImageId ? mediaItems.find((m) => m.id === socialImageId) : undefined

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
    featuredImageId,
    featuredImageUrl:
      matchedFeaturedMedia?.url ||
      (doc?.featuredImage && typeof doc.featuredImage === 'object' ? mediaUrlOf(doc.featuredImage) : ''),
    galleryUrls: [],
    seoTitle: String(seoGroup.metaTitle ?? ''),
    metaDescription: String(seoGroup.metaDescription ?? ''),
    focusKeyword: String(seoGroup.focusKeyword ?? ''),
    noindex: Boolean(seoGroup.noindex),
    canonicalUrl: '',
    socialImageId,
    socialImageUrl:
      matchedSocialMedia?.url ||
      (seoGroup.ogImage && typeof seoGroup.ogImage === 'object' ? mediaUrlOf(seoGroup.ogImage) : ''),
    status: resolveInitialStatus(doc),
    reviewNote: typeof doc?.reviewNote === 'string' ? doc.reviewNote : '',
    articleType:
      typeof doc?.articleType === 'string' &&
      ['news', 'opinion', 'interview', 'analysis', 'photo_story'].includes(doc.articleType)
        ? (doc.articleType as InitialArticleDoc['articleType'])
        : 'news',
    language: doc?.language === 'en' ? 'en' : 'hi',
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
