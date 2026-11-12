/**
 * The one serializer between Payload documents and the public v1 shapes (docs/api-contract.md §1–§2).
 * Every helper in ./read.ts maps through these functions. Output is whitelisted field by field, so
 * internal fields (email, role, createdBy, _status, hashes) can never leak into a response.
 */
import type {
  Article as PArticle,
  Category as PCategory,
  Epaper as PEpaper,
  Location as PLocation,
  Media as PMedia,
  Navigation as PNavigation,
  Page as PPage,
  SiteSetting as PSiteSetting,
  Tag as PTag,
  User as PUser,
  Video as PVideo,
} from '../../payload-types'
import { sanitizeLexical } from '../../hooks/sanitizeRichText'
import { articlePath } from '../revalidate/tags'
import type {
  Article,
  ArticleCard,
  Author,
  AuthorRef,
  Category,
  CategoryRef,
  EPaper,
  Image,
  ImageSize,
  LocationRef,
  NavItem,
  Page,
  RichTextNode,
  SiteSettings,
  TagRef,
  Video,
} from './types'
import { toEpoch, toIST } from './time'
import { absoluteUrl, withVersion } from './urls'

export interface MapContext {
  /** Site default image, already marked isFallback: true. */
  defaultImage: Image
  now: Date
}

export const IMAGE_SIZE_NAMES: ImageSize[] = ['thumb', 'card', 'article', 'og', 'wide', 'standard', 'square']

/** Last-resort image when the site has no default image configured yet. */
export const BRAND_FALLBACK_IMAGE: Image = {
  url: '/brand/logo-square-1024.jpg',
  alt: 'लोक Lens न्यूज़',
  width: 1024,
  height: 1024,
  isFallback: true,
  sizes: {},
}

/** Contract §1: "LokLens News Team" (no authors set) is an organisation, not a person. */
export const ORG_BYLINE: AuthorRef = { kind: 'organization', name: 'LokLens News Team', slug: null }

export function asFallback(image: Image): Image {
  return { ...image, isFallback: true }
}

export function nonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/** Relationship values are an id unless the query populated them. */
export function populated<T extends { id: number }>(value: unknown): T | null {
  return value !== null && typeof value === 'object' && 'id' in value ? (value as T) : null
}

// ---- media ----------------------------------------------------------------------------------------

interface RawSize {
  url?: string | null
  width?: number | null
  height?: number | null
}

/** Maps an uploaded image. Missing or unpopulated media falls back to the site default (isFallback true). */
export function toImage(media: unknown, fallback: Image): Image {
  const m = populated<PMedia>(media)
  if (!m || !m.url || !m.width || !m.height) return asFallback(fallback)
  const rawSizes = m.sizes as Partial<Record<ImageSize, RawSize | null>> | null | undefined
  const sizes: Image['sizes'] = {}
  for (const name of IMAGE_SIZE_NAMES) {
    const s = rawSizes?.[name]
    if (s?.url && s.width && s.height) {
      sizes[name] = { url: absoluteUrl(withVersion(s.url, m.updatedAt)), width: s.width, height: s.height }
    }
  }
  return {
    url: absoluteUrl(withVersion(m.url, m.updatedAt)),
    alt: m.alt?.trim() || fallback.alt,
    width: m.width,
    height: m.height,
    ...(m.caption ? { caption: m.caption } : {}),
    ...(m.credit ? { credit: m.credit } : {}),
    isFallback: false,
    sizes,
  }
}

/** Public thumbnail for a video without its own upload (YouTube's standard 4:3 frame). */
export function youtubeThumbnail(youtubeId: string, alt: string): Image {
  return {
    url: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    alt,
    width: 480,
    height: 360,
    isFallback: false,
    sizes: {},
  }
}

// ---- taxonomy and people --------------------------------------------------------------------------

export function toCategoryRef(value: unknown): CategoryRef | null {
  const c = populated<PCategory>(value)
  if (!c) return null
  return { id: c.id, name: c.name, slug: c.slug, ...(c.color ? { color: c.color } : {}) }
}

export function toCategory(c: PCategory): Category {
  const ref = toCategoryRef(c) as CategoryRef
  const description = c.description?.trim() || undefined
  return {
    ...ref,
    ...(description ? { description } : {}),
    order: c.order ?? 0,
    seo: {
      title: c.seo?.metaTitle?.trim() || `${c.name} समाचार`,
      description: c.seo?.metaDescription?.trim() || description || `${c.name} की ताज़ा खबरें`,
    },
  }
}

export function toTagRef(value: unknown): TagRef | null {
  const t = populated<PTag>(value)
  return t ? { id: t.id, name: t.name, slug: t.slug } : null
}

export function toLocationRef(value: unknown): LocationRef | undefined {
  const l = populated<PLocation>(value)
  return l ? { id: l.id, name: l.name, slug: l.slug } : undefined
}

export function toAuthorRef(value: unknown, defaultImage: Image = BRAND_FALLBACK_IMAGE): AuthorRef | null {
  const user = populated<PUser>(value)
  if (!user) return null
  const photo = populated<PMedia>(user.photo) ? toImage(user.photo, defaultImage) : null
  return {
    kind: 'person',
    name: user.displayName?.trim() || user.name,
    slug: user.slug,
    ...(photo && !photo.isFallback ? { photo } : {}),
  }
}

/** Byline rule: authors if any are set, otherwise the organisation. Never empty. */
export function bylineFor(authors: unknown[] | null | undefined): AuthorRef[] {
  const refs = (authors ?? []).map((a) => toAuthorRef(a)).filter(nonNull)
  return refs.length > 0 ? refs : [{ ...ORG_BYLINE }]
}

export function toAuthor(user: PUser, defaultImage: Image): Author {
  const ref = toAuthorRef(user, defaultImage) as AuthorRef
  const bio = user.bio?.trim() || undefined
  const social = (user.social ?? []).map((s) => ({ platform: s.platform, url: s.url }))
  return { ...ref, ...(bio ? { bio } : {}), ...(social.length ? { social } : {}) }
}

// ---- articles -------------------------------------------------------------------------------------

/** A breaking label is active while breakingUntil is in the future (or unset). Contract §1. */
export function isBreakingNow(doc: { isBreaking?: boolean | null; breakingUntil?: string | null }, now: Date): boolean {
  if (!doc.isBreaking) return false
  const until = toEpoch(doc.breakingUntil)
  return until === null || until > now.getTime()
}

export function toArticleCard(doc: PArticle, ctx: MapContext): ArticleCard | null {
  const category = toCategoryRef(doc.category)
  if (!category) return null
  const location = toLocationRef(doc.location)
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    url: articlePath(category.slug, doc.slug, doc.id),
    summary: doc.summary,
    image: toImage(doc.featuredImage, ctx.defaultImage),
    category,
    ...(location ? { location } : {}),
    publishedAt: toIST(doc.publishedAt ?? doc.createdAt),
    updatedAt: toIST(doc.updatedAt),
    isBreaking: isBreakingNow(doc, ctx.now),
    isTrending: Boolean(doc.isTrending),
    isFeatured: Boolean(doc.isFeatured),
  }
}

/**
 * Lexical → RichTextNode[] (contract §5). Sanitised again on read. Uploads resolve to Image, related
 * articles to ArticleCard; an unresolved reference is dropped rather than rendered broken.
 */
export function toRichText(body: unknown, ctx: MapContext): RichTextNode[] {
  const root = (body as { root?: { children?: unknown } } | null | undefined)?.root
  const children = Array.isArray(root?.children) ? root.children : []
  const sanitized = sanitizeLexical({ root: { children } }).root.children as unknown[]
  return mapNodes(sanitized, ctx)
}

function mapNodes(nodes: unknown[], ctx: MapContext): RichTextNode[] {
  const out: RichTextNode[] = []
  for (const raw of nodes) {
    if (!raw || typeof raw !== 'object') continue
    const node = raw as Record<string, unknown>
    if (node.type === 'upload') {
      const media = populated<PMedia>(node.value)
      if (!media) continue
      // The per-insertion caption (upload node `fields.caption`) wins over the media item's own caption.
      const image = toImage(media, ctx.defaultImage)
      const nodeCaption = (node.fields as { caption?: unknown } | undefined)?.caption
      const caption = typeof nodeCaption === 'string' && nodeCaption.trim() ? nodeCaption.trim() : image.caption
      out.push({ ...node, value: { ...image, caption } } as unknown as RichTextNode)
      continue
    }
    if (node.type === 'block') {
      const fields = (node.fields ?? {}) as Record<string, unknown>
      if (fields.blockType === 'relatedArticle') {
        const related = populated<PArticle>(fields.article)
        const card = related ? toArticleCard(related, ctx) : null
        if (card) out.push({ ...node, fields: { blockType: 'relatedArticle', article: card } } as unknown as RichTextNode)
        continue
      }
    }
    const children = Array.isArray(node.children) ? mapNodes(node.children, ctx) : undefined
    out.push({ ...node, ...(children ? { children } : {}) } as unknown as RichTextNode)
  }
  return out
}

export function toArticle(doc: PArticle, ctx: MapContext, related: ArticleCard[]): Article | null {
  const card = toArticleCard(doc, ctx)
  if (!card) return null
  const seo = doc.seo ?? {}
  return {
    ...card,
    body: toRichText(doc.body, ctx),
    tags: (doc.tags ?? []).map(toTagRef).filter(nonNull),
    authors: bylineFor(doc.authors),
    seo: {
      title: seo.metaTitle?.trim() || doc.title,
      description: seo.metaDescription?.trim() || doc.summary,
      image: populated<PMedia>(seo.ogImage) ? toImage(seo.ogImage, ctx.defaultImage) : card.image,
      noindex: Boolean(seo.noindex),
    },
    related,
  }
}

// ---- video, e-paper, pages ------------------------------------------------------------------------

export function toVideo(doc: PVideo, ctx: MapContext): Video {
  const thumb = populated<PMedia>(doc.thumbnail)
  const category = toCategoryRef(doc.category)
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    url: `/video/${doc.slug}`,
    youtubeId: doc.youtubeId,
    thumbnail: thumb?.url ? toImage(thumb, ctx.defaultImage) : youtubeThumbnail(doc.youtubeId, doc.title),
    ...(category ? { category } : {}),
    publishedAt: toIST(doc.publishedAt),
  }
}

export function toEPaper(doc: PEpaper): EPaper {
  return { date: doc.date, edition: doc.edition, pdfUrl: absoluteUrl(doc.url ?? '') }
}

export function toPage(doc: PPage, ctx: MapContext): Page {
  return {
    title: doc.title,
    slug: doc.slug,
    body: toRichText(doc.body, ctx),
    updatedAt: toIST(doc.updatedAt),
  }
}

// ---- settings -------------------------------------------------------------------------------------

export function toNavItem(value: unknown): NavItem | null {
  const v = value as { label?: string | null; url?: string | null } | null
  return v?.label && v.url ? { label: v.label, url: v.url } : null
}

export function toSiteSettings(
  settings: PSiteSetting,
  navigation: PNavigation | null,
  categoryNav: NavItem[],
): SiteSettings {
  const header = (navigation?.header ?? []).map(toNavItem).filter(nonNull)
  const footer = (navigation?.footer ?? []).map((col) => ({
    title: col.title,
    items: (col.items ?? []).map(toNavItem).filter(nonNull),
  }))
  const p = settings.policies
  return {
    name: settings.name,
    tagline: settings.tagline ?? '',
    logo: toImage(settings.logo, BRAND_FALLBACK_IMAGE),
    defaultImage: toImage(settings.defaultImage, BRAND_FALLBACK_IMAGE),
    social: (settings.social ?? []).map((s) => ({ platform: s.platform, url: s.url })),
    contact: {
      email: settings.contact?.email ?? '',
      ...(settings.contact?.whatsapp ? { whatsapp: settings.contact.whatsapp } : {}),
    },
    policies: {
      about: p?.about ?? '/about',
      contact: p?.contact ?? '/contact',
      privacy: p?.privacy ?? '/privacy-policy',
      terms: p?.terms ?? '/terms',
      editorial: p?.editorial ?? '/editorial-policy',
      corrections: p?.corrections ?? '/corrections-policy',
      disclaimer: p?.disclaimer ?? '/disclaimer',
    },
    navigation: { header: header.length > 0 ? header : categoryNav, footer },
  }
}
