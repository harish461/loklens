import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionSlug,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'

import { purgeCloudflareUrls } from '../lib/cdn/cloudflare'
import { expireCacheTags } from '../lib/revalidate/run'
import {
  cacheTags,
  purgePathsForArticle,
  tagsForArticle,
  tagsForAuthor,
  tagsForCategory,
  tagsForEPaper,
  tagsForPage,
  tagsForTag,
  tagsForVideo,
} from '../lib/revalidate/tags'

type Doc = Record<string, unknown> & { id?: number | string }

/** Extracts the id from a relationship value (id, populated doc, or polymorphic `{ value }`). */
export function relId(value: unknown): number | string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { id?: unknown; value?: unknown }
    if (v.id !== undefined) return relId(v.id)
    if (v.value !== undefined) return relId(v.value)
  }
  return null
}

export function relIds(value: unknown): Array<number | string> {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  return list.map(relId).filter((v): v is number | string => v !== null)
}

export function shouldSkip(req: PayloadRequest, context?: Record<string, unknown>): boolean {
  return Boolean(req.context?.skipRevalidate || context?.skipRevalidate)
}

/** Only changes that touch the live version matter for the public cache. */
export function affectsPublished(doc: Doc | undefined, previousDoc: Doc | undefined): boolean {
  const hasStatus = (d?: Doc) => d && '_status' in d
  if (!hasStatus(doc) && !hasStatus(previousDoc)) return true // collection without drafts
  return doc?._status === 'published' || previousDoc?._status === 'published'
}

async function slugsFor(req: PayloadRequest, collection: CollectionSlug, ids: Array<number | string>) {
  const unique = [...new Set(ids.map(String))]
  if (unique.length === 0) return new Map<string, string>()
  const res = await req.payload.find({
    collection,
    where: { id: { in: unique } },
    depth: 0,
    limit: unique.length,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return new Map(res.docs.map((d) => [String(d.id), String((d as { slug?: unknown }).slug ?? '')]))
}

const log = (req: PayloadRequest) => (msg: string) => req.payload.logger.warn(msg)

async function run(req: PayloadRequest, tags: string[], purgePaths: string[] = []) {
  try {
    await expireCacheTags(tags, log(req))
    await purgeCloudflareUrls(purgePaths, log(req))
  } catch (err) {
    req.payload.logger.error(`[revalidate] ${(err as Error).message}`)
  }
}

async function revalidateArticle(req: PayloadRequest, doc: Doc, previousDoc?: Doc) {
  const categoryIds = relIds([doc.category, previousDoc?.category])
  const cats = await slugsFor(req, 'categories', categoryIds)
  const tags = await slugsFor(req, 'tags', relIds([...(relIdsRaw(doc.tags)), ...relIdsRaw(previousDoc?.tags)]))
  const authors = await slugsFor(req, 'users', relIds([...relIdsRaw(doc.authors), ...relIdsRaw(previousDoc?.authors)]))
  const catSlug = (v: unknown) => {
    const id = relId(v)
    return id === null ? null : (cats.get(String(id)) ?? null)
  }
  const id = doc.id ?? previousDoc?.id
  if (id === undefined) return
  await run(
    req,
    tagsForArticle({
      id,
      categorySlugs: categoryIds.map((c) => cats.get(String(c))),
      tagSlugs: [...tags.values()],
      authorSlugs: [...authors.values()],
    }),
    purgePathsForArticle({
      id,
      slug: doc.slug as string | undefined,
      previousSlug: previousDoc?.slug as string | undefined,
      categorySlug: catSlug(doc.category),
      previousCategorySlug: catSlug(previousDoc?.category),
    }),
  )
}

function relIdsRaw(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
}

// ---------------------------------------------------------------------------------------------
// Articles
export const revalidateArticleAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (shouldSkip(req, context) || !affectsPublished(doc, previousDoc)) return doc
  await revalidateArticle(req, doc, previousDoc)
  return doc
}

export const revalidateArticleAfterDelete: CollectionAfterDeleteHook = async ({ doc, req, context }) => {
  if (shouldSkip(req, context)) return doc
  await revalidateArticle(req, doc)
  return doc
}

// ---------------------------------------------------------------------------------------------
// Simple slug-keyed collections
type TagBuilder = (keys: Array<string | null | undefined>) => string[]

function slugCollectionHooks(build: TagBuilder, key = 'slug', purge: (keys: string[]) => string[] = () => []) {
  const keysOf = (...docs: Array<Doc | undefined>) =>
    docs.map((d) => (d?.[key] as string | undefined) ?? null).filter((k): k is string => Boolean(k))
  const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
    if (shouldSkip(req, context) || !affectsPublished(doc, previousDoc)) return doc
    const keys = keysOf(doc, previousDoc)
    await run(req, build(keys), purge(keys))
    return doc
  }
  const afterDelete: CollectionAfterDeleteHook = async ({ doc, req, context }) => {
    if (shouldSkip(req, context)) return doc
    const keys = keysOf(doc)
    await run(req, build(keys), purge(keys))
    return doc
  }
  return { afterChange: [afterChange], afterDelete: [afterDelete] }
}

export const categoryRevalidation = slugCollectionHooks(tagsForCategory, 'slug', (slugs) => [
  '/',
  ...slugs.map((s) => `/${s}`),
])
export const tagRevalidation = slugCollectionHooks(tagsForTag, 'slug', (slugs) => slugs.map((s) => `/tag/${s}`))
export const userRevalidation = slugCollectionHooks(tagsForAuthor, 'slug', (slugs) => slugs.map((s) => `/author/${s}`))
export const pageRevalidation = slugCollectionHooks(tagsForPage, 'slug', (slugs) => slugs.map((s) => `/${s}`))
export const videoRevalidation = slugCollectionHooks(tagsForVideo, 'slug', (slugs) => [
  '/',
  '/video',
  ...slugs.map((s) => `/video/${s}`),
])
export const epaperRevalidation = slugCollectionHooks(tagsForEPaper, 'date', (dates) => [
  '/e-paper',
  ...dates.map((d) => `/e-paper/${d}`),
])
export const redirectRevalidation = slugCollectionHooks(() => [cacheTags.redirects], 'from')

// ---------------------------------------------------------------------------------------------
// Globals
export function revalidateGlobal(tags: string[], paths: string[] = ['/']): GlobalAfterChangeHook {
  return async ({ doc, req, context }) => {
    if (shouldSkip(req, context)) return doc
    await run(req, tags, paths)
    return doc
  }
}
