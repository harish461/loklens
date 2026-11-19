import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'

import config from '@payload-config'
import { articlePath } from '@/lib/revalidate/tags'
import { getSiteOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const STATIC_PATHS = [
  '',
  '/about',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/editorial-policy',
  '/corrections-policy',
  '/disclaimer',
  '/advertise',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin()
  const now = new Date()

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${origin}${p || '/'}`,
    lastModified: now,
    changeFrequency: p === '' ? 'hourly' : 'monthly',
    priority: p === '' ? 1.0 : 0.5,
  }))

  try {
    const payload = await getPayload({ config })

    const [catRes, artRes] = await Promise.all([
      payload.find({
        collection: 'categories',
        limit: 100,
        depth: 0,
        pagination: false,
        sort: 'order',
        overrideAccess: false,
      }),
      payload.find({
        collection: 'articles',
        where: {
          and: [
            { _status: { equals: 'published' } },
            {
              or: [
                { 'seo.noindex': { equals: false } },
                { 'seo.noindex': { exists: false } },
              ],
            },
          ],
        },
        sort: ['-publishedAt', '-id'],
        limit: 1000,
        depth: 1,
        pagination: false,
        overrideAccess: false,
        draft: false,
      }),
    ])

    for (const c of catRes.docs) {
      entries.push({
        url: `${origin}/${c.slug}`,
        lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
        changeFrequency: 'hourly',
        priority: 0.85,
      })
    }

    for (const a of artRes.docs) {
      const cat = typeof a.category === 'object' && a.category ? a.category.slug : 'pradesh'
      const path = articlePath(cat, a.slug, a.id)
      entries.push({
        url: `${origin}${path}`,
        lastModified: new Date(a.updatedAt || a.publishedAt || a.createdAt),
        changeFrequency: 'daily',
        priority: 0.9,
      })
    }
  } catch (err) {
    console.error('[LokLens Sitemap] Error generating sitemap entries:', err)
  }

  return entries
}
