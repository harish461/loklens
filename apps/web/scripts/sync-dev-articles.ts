/**
 * Reusable Non-Destructive Sync Script: Development (https://dev.loklensnews.com) -> Local Payload CMS
 *
 * Usage:
 *   npx cross-env NODE_OPTIONS=--no-deprecation payload run scripts/sync-dev-articles.ts
 *
 * Safety guarantees:
 * 1. Read-only GET requests against https://dev.loklensnews.com/api/articles (never modifies dev).
 * 2. Saves full JSON backup to apps/web/backups/dev-articles-export.json.
 * 3. Never deletes or overwrites existing local articles, categories, tags, locations, or media.
 * 4. Downloads missing featured images from dev and imports them through Payload's Media collection.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'

const DEV_BASE_URL = (process.env.SYNC_SOURCE_URL || 'https://dev.loklensnews.com').replace(/\/+$/, '')

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const BACKUP_DIR = path.resolve(dirname, '../backups')
const BACKUP_FILE = path.resolve(BACKUP_DIR, 'dev-articles-export.json')

interface RemoteMedia {
  id: number
  filename?: string
  url?: string
  alt?: string
  caption?: string | null
  credit?: string | null
  mimeType?: string
  width?: number
  height?: number
}

interface RemoteRef {
  id: number
  name: string
  slug: string
  description?: string | null
  color?: string | null
  order?: number | null
  showInNav?: boolean | null
}

interface RemoteAuthor {
  id: number
  name?: string
  displayName?: string
  email?: string
}

interface RemoteArticle {
  id: number
  title: string
  slug: string
  summary: string
  body: Record<string, unknown>
  featuredImage?: RemoteMedia | number | null
  category?: RemoteRef | number | null
  location?: RemoteRef | number | null
  tags?: (RemoteRef | number)[] | null
  authors?: (RemoteAuthor | number)[] | null
  publishedAt?: string | null
  isBreaking?: boolean | null
  breakingUntil?: string | null
  isTrending?: boolean | null
  isFeatured?: boolean | null
  articleType?: 'news' | 'opinion' | 'interview' | 'analysis' | 'photo_story' | null
  language?: 'hi' | 'en' | null
  _status?: 'draft' | 'published' | null
  seo?: {
    metaTitle?: string | null
    metaDescription?: string | null
    focusKeyword?: string | null
    noindex?: boolean | null
    ogImage?: RemoteMedia | number | null
  } | null
  createdAt?: string
  updatedAt?: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

async function ensureCategory(payload: Payload, remoteCat: RemoteRef): Promise<number> {
  const existing = await payload.find({
    collection: 'categories',
    where: { slug: { equals: remoteCat.slug } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs[0]) {
    return Number(existing.docs[0].id)
  }
  const created = await payload.create({
    collection: 'categories',
    context: { skipRevalidate: true },
    data: {
      name: remoteCat.name,
      slug: remoteCat.slug,
      description: remoteCat.description || undefined,
      color: remoteCat.color || undefined,
      order: typeof remoteCat.order === 'number' ? remoteCat.order : 0,
      showInNav: typeof remoteCat.showInNav === 'boolean' ? remoteCat.showInNav : true,
    },
  })
  console.log(`  [+] Created missing category: ${remoteCat.name} (${remoteCat.slug}) -> local ID ${created.id}`)
  return Number(created.id)
}

async function ensureLocation(payload: Payload, remoteLoc: RemoteRef): Promise<number> {
  const existing = await payload.find({
    collection: 'locations',
    where: { slug: { equals: remoteLoc.slug } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs[0]) {
    return Number(existing.docs[0].id)
  }
  const created = await payload.create({
    collection: 'locations',
    data: {
      name: remoteLoc.name,
      slug: remoteLoc.slug,
    },
  })
  console.log(`  [+] Created missing location: ${remoteLoc.name} (${remoteLoc.slug}) -> local ID ${created.id}`)
  return Number(created.id)
}

async function ensureTag(payload: Payload, remoteTag: RemoteRef): Promise<number> {
  const existing = await payload.find({
    collection: 'tags',
    where: { slug: { equals: remoteTag.slug } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs[0]) {
    return Number(existing.docs[0].id)
  }
  const created = await payload.create({
    collection: 'tags',
    data: {
      name: remoteTag.name,
      slug: remoteTag.slug,
    },
  })
  console.log(`  [+] Created missing tag: ${remoteTag.name} (${remoteTag.slug}) -> local ID ${created.id}`)
  return Number(created.id)
}

async function ensureMedia(payload: Payload, remoteMedia: RemoteMedia): Promise<number> {
  const fname = remoteMedia.filename || ''
  if (fname) {
    const existing = await payload.find({
      collection: 'media',
      where: { filename: { equals: fname } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]) {
      return Number(existing.docs[0].id)
    }
  }

  // Construct download URL from dev
  const rawUrl = remoteMedia.url || `/api/media/file/${encodeURIComponent(fname)}`
  const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${DEV_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`

  console.log(`  [↓] Downloading media "${fname}" from ${fullUrl}...`)
  const res = await fetch(fullUrl)
  if (!res.ok) {
    throw new Error(`Failed to download media ${fullUrl}: HTTP ${res.status}`)
  }
  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const mimeType = remoteMedia.mimeType || res.headers.get('content-type') || 'image/webp'
  // Use a clean filename without spaces/parentheses to avoid collisions if needed
  const cleanName = fname || `imported-${remoteMedia.id}.webp`

  const created = await payload.create({
    collection: 'media',
    context: { skipRevalidate: true },
    data: {
      alt: remoteMedia.alt || cleanName,
      caption: remoteMedia.caption || undefined,
      credit: remoteMedia.credit || undefined,
    },
    file: {
      data: buffer,
      mimetype: mimeType,
      name: cleanName,
      size: buffer.length,
    },
  })
  console.log(`  [+] Imported media "${cleanName}" -> local ID ${created.id}`)
  return Number(created.id)
}

async function main() {
  console.log(`=== LokLens Article Sync (Source: ${DEV_BASE_URL}) ===`)

  // 1. Export from development API
  const articlesUrl = `${DEV_BASE_URL}/api/articles?depth=2&limit=100&sort=id`
  const categoriesUrl = `${DEV_BASE_URL}/api/categories?limit=100`
  const tagsUrl = `${DEV_BASE_URL}/api/tags?limit=100`
  const locationsUrl = `${DEV_BASE_URL}/api/locations?limit=100`

  const [articlesRes, categoriesRes, tagsRes, locationsRes] = await Promise.all([
    fetchJson<{ docs: RemoteArticle[]; totalDocs: number }>(articlesUrl),
    fetchJson<{ docs: RemoteRef[]; totalDocs: number }>(categoriesUrl),
    fetchJson<{ docs: RemoteRef[]; totalDocs: number }>(tagsUrl),
    fetchJson<{ docs: RemoteRef[]; totalDocs: number }>(locationsUrl),
  ])

  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const backupPayload = {
    exportedAt: new Date().toISOString(),
    sourceUrl: DEV_BASE_URL,
    counts: {
      articles: articlesRes.docs.length,
      categories: categoriesRes.docs.length,
      tags: tagsRes.docs.length,
      locations: locationsRes.docs.length,
    },
    categories: categoriesRes.docs,
    tags: tagsRes.docs,
    locations: locationsRes.docs,
    articles: articlesRes.docs,
  }
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupPayload, null, 2), 'utf8')
  console.log(`[✓] Saved JSON backup (${articlesRes.docs.length} articles) to: ${BACKUP_FILE}`)

  // 2. Initialize local Payload instance
  const payload = await getPayload({ config })

  // Ensure all categories from dev exist locally
  for (const cat of categoriesRes.docs) {
    await ensureCategory(payload, cat)
  }

  let importedCount = 0
  let skippedCount = 0

  for (const remoteArticle of articlesRes.docs) {
    // Check if article already exists locally by slug (check both published table and drafts table)
    const [existingPublished, existingDraft] = await Promise.all([
      payload.find({
        collection: 'articles',
        where: { slug: { equals: remoteArticle.slug } },
        limit: 1,
        depth: 0,
        draft: false,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'articles',
        where: { slug: { equals: remoteArticle.slug } },
        limit: 1,
        depth: 0,
        draft: true,
        overrideAccess: true,
      }),
    ])

    const existingDoc = existingPublished.docs[0] || existingDraft.docs[0]
    if (existingDoc) {
      console.log(`[=] Skipping existing local article: "${remoteArticle.slug}" (Local ID: ${existingDoc.id})`)
      skippedCount++
      continue
    }

    console.log(`[→] Importing article: "${remoteArticle.slug}" (Dev ID: ${remoteArticle.id})`)

    // Resolve Category
    if (!remoteArticle.category || typeof remoteArticle.category === 'number') {
      throw new Error(`Article ${remoteArticle.slug} is missing expanded category object`)
    }
    const localCategoryId = await ensureCategory(payload, remoteArticle.category)

    // Resolve Location (optional)
    let localLocationId: number | undefined
    if (remoteArticle.location && typeof remoteArticle.location === 'object') {
      localLocationId = await ensureLocation(payload, remoteArticle.location)
    }

    // Resolve Tags (optional)
    const localTagIds: number[] = []
    if (Array.isArray(remoteArticle.tags)) {
      for (const t of remoteArticle.tags) {
        if (t && typeof t === 'object') {
          localTagIds.push(await ensureTag(payload, t))
        }
      }
    }

    // Resolve Featured Image
    let localFeaturedImageId: number | undefined
    if (remoteArticle.featuredImage && typeof remoteArticle.featuredImage === 'object') {
      localFeaturedImageId = await ensureMedia(payload, remoteArticle.featuredImage)
    }

    // Resolve SEO OG Image (optional)
    let localSeoImageId: number | undefined
    if (remoteArticle.seo?.ogImage && typeof remoteArticle.seo.ogImage === 'object') {
      if (
        remoteArticle.featuredImage &&
        typeof remoteArticle.featuredImage === 'object' &&
        remoteArticle.seo.ogImage.filename === remoteArticle.featuredImage.filename
      ) {
        localSeoImageId = localFeaturedImageId
      } else {
        localSeoImageId = await ensureMedia(payload, remoteArticle.seo.ogImage)
      }
    }

    const fallbackBody = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            textFormat: 0,
            textStyle: '',
            children: [
              {
                type: 'text',
                text: remoteArticle.summary || remoteArticle.title,
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                version: 1,
              },
            ],
          },
        ],
      },
    }

    // Create article in local database
    const isPublished = (remoteArticle._status || 'published') === 'published'
    const createdArticle = await payload.create({
      collection: 'articles',
      draft: !isPublished,
      context: { skipRevalidate: true },
      data: {
        title: remoteArticle.title,
        slug: remoteArticle.slug,
        summary: remoteArticle.summary,
        body: (remoteArticle.body && typeof remoteArticle.body === 'object' ? remoteArticle.body : fallbackBody) as never,
        featuredImage: localFeaturedImageId,
        category: localCategoryId,
        location: localLocationId,
        tags: localTagIds.length > 0 ? localTagIds : undefined,
        publishedAt: remoteArticle.publishedAt || new Date().toISOString(),
        isBreaking: Boolean(remoteArticle.isBreaking),
        breakingUntil: remoteArticle.breakingUntil || undefined,
        isTrending: Boolean(remoteArticle.isTrending),
        isFeatured: Boolean(remoteArticle.isFeatured),
        articleType: remoteArticle.articleType || 'news',
        language: remoteArticle.language || 'hi',
        _status: isPublished ? 'published' : 'draft',
        workflowStatus: isPublished ? 'published' : 'draft',
        seo: {
          metaTitle: remoteArticle.seo?.metaTitle || undefined,
          metaDescription: remoteArticle.seo?.metaDescription || undefined,
          focusKeyword: remoteArticle.seo?.focusKeyword || undefined,
          noindex: Boolean(remoteArticle.seo?.noindex),
          ogImage: localSeoImageId,
        },
      },
    })

    console.log(`[✓] Imported article "${createdArticle.slug}" -> Local ID ${createdArticle.id}`)
    importedCount++
  }

  // Final verification query
  const finalLocal = await payload.find({
    collection: 'articles',
    limit: 100,
    depth: 1,
    sort: '-publishedAt',
  })

  console.log('\n=== Sync Complete ===')
  console.log(`Imported new articles : ${importedCount}`)
  console.log(`Skipped existing      : ${skippedCount}`)
  console.log(`Total local articles  : ${finalLocal.totalDocs}`)
  for (const doc of finalLocal.docs) {
    const cat = typeof doc.category === 'object' && doc.category ? doc.category.slug : String(doc.category)
    const img =
      typeof doc.featuredImage === 'object' && doc.featuredImage ? doc.featuredImage.filename : String(doc.featuredImage)
    console.log(`  • [ID ${doc.id}] ${doc.slug} | category=${cat} | status=${doc._status} | image=${img}`)
  }

  await payload.destroy()
}

await main()
