/**
 * Automatic push notification when an article is published (api-contract §8).
 *
 * The article hook only queues a `pushArticlePublish` job, inside the publish transaction: the job row commits
 * only if the publish commits, and a failure here can never roll back an editor's publish. The job then
 * creates the notification once (unique `article-publish:{id}` key) and starts sending.
 */
import type { CollectionAfterChangeHook, Payload, PayloadRequest } from 'payload'

import { absoluteUrl } from '@/lib/data/urls'

import { articleDedupeKey, isNewPublish, shouldPushOnPublish } from './rules'

/** afterChange hook on articles: queue the publish notification on a real publish event. */
export const queuePushOnPublish: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  try {
    if (!isNewPublish(previousDoc?._status, doc._status)) return doc
    if (!shouldPushOnPublish(doc.pushOnPublish, Boolean(doc.isBreaking))) return doc
    await req.payload.jobs.queue({ task: 'pushArticlePublish', input: { articleId: Number(doc.id) }, req })
  } catch (err) {
    req.payload.logger.error({ err }, `[push] could not queue the publish notification for article ${doc.id}`)
  }
  return doc
}

const BREAKING_PREFIX = 'बड़ी खबर: '
const TITLE_MAX = 120
const BODY_MAX = 240

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

type MediaDoc = { url?: string | null; updatedAt?: string; sizes?: Record<string, { url?: string | null } | undefined> }

function imageUrlOf(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const m = media as MediaDoc
  const url = m.sizes?.card?.url || m.url
  if (!url) return null
  const absolute = absoluteUrl(url)
  return /^https:\/\//.test(absolute) ? absolute : null
}

export interface PublishNotificationResult {
  notificationId: number | null
  reason?: 'not-found' | 'not-published' | 'opted-out' | 'already-sent'
}

/**
 * Creates the article's publish notification if it does not exist yet and queues the first send slice.
 * Re-checks the article (still published, still opted in) because the job may run a minute later.
 */
export async function createPublishNotification(payload: Payload, articleId: number, req?: PayloadRequest): Promise<PublishNotificationResult> {
  const article = await payload
    .findByID({ collection: 'articles', id: articleId, depth: 1, overrideAccess: true, req })
    .catch(() => null)
  if (!article) return { notificationId: null, reason: 'not-found' }
  if (article._status !== 'published') return { notificationId: null, reason: 'not-published' }
  if (!shouldPushOnPublish(article.pushOnPublish, Boolean(article.isBreaking))) return { notificationId: null, reason: 'opted-out' }

  const dedupeKey = articleDedupeKey(article.id)
  const existing = await payload.find({
    collection: 'push-notifications',
    where: { dedupeKey: { equals: dedupeKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (existing.docs.length) return { notificationId: existing.docs[0].id, reason: 'already-sent' }

  const isBreaking = Boolean(article.isBreaking)
  const categoryId = typeof article.category === 'object' && article.category ? article.category.id : article.category
  const created = await payload.create({
    collection: 'push-notifications',
    data: {
      title: clip(`${isBreaking ? BREAKING_PREFIX : ''}${article.title}`, TITLE_MAX),
      body: clip(article.summary ?? '', BODY_MAX) || article.title,
      imageUrl: imageUrlOf(article.featuredImage),
      type: isBreaking ? 'breaking' : 'article',
      audience: 'all',
      category: categoryId ?? null,
      article: article.id,
      source: 'publish',
      dedupeKey,
      status: 'queued',
    },
    overrideAccess: true,
    req,
  })
  await payload.jobs.queue({ task: 'pushSend', input: { notificationId: created.id }, req })
  return { notificationId: created.id }
}
