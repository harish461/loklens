import { getPayload } from 'payload'

import config from '@payload-config'
import { toIST } from '@/lib/data/time'
import { articlePath } from '@/lib/revalidate/tags'
import { getSiteOrigin } from '@/lib/seo'

export const dynamic = 'force-dynamic'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const origin = getSiteOrigin()
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  let docs: {
    id: number
    title: string
    slug: string
    language?: string | null
    publishedAt?: string | null
    createdAt: string
    category?: { slug?: string; name?: string } | number | null
    tags?: ({ name?: string } | number)[] | null
    seo?: { focusKeyword?: string | null; noindex?: boolean | null } | null
  }[] = []

  try {
    const payload = await getPayload({ config })

    // Query articles published in the last 48 hours per Google News spec
    const recentRes = await payload.find({
      collection: 'articles',
      where: {
        and: [
          { _status: { equals: 'published' } },
          { publishedAt: { greater_than_equal: cutoff48h } },
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
    })

    docs = recentRes.docs as unknown as typeof docs

    // Fallback to latest 10 published articles if no stories fell inside the 48h window yet
    if (docs.length === 0) {
      const latestRes = await payload.find({
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
        limit: 10,
        depth: 1,
        pagination: false,
        overrideAccess: false,
        draft: false,
      })
      docs = latestRes.docs as unknown as typeof docs
    }
  } catch (err) {
    console.error('[LokLens News Sitemap] Failed to query articles:', err)
  }

  const urlNodes = docs
    .map((doc) => {
      const catSlug =
        typeof doc.category === 'object' && doc.category?.slug ? doc.category.slug : 'pradesh'
      const loc = `${origin}${articlePath(catSlug, doc.slug, doc.id)}`
      const pubDate = toIST(doc.publishedAt || doc.createdAt)
      const lang = doc.language === 'en' ? 'en' : 'hi'
      const tagNames = (Array.isArray(doc.tags) ? doc.tags : [])
        .map((t) => (typeof t === 'object' && t?.name ? t.name : ''))
        .filter(Boolean)
      const keywords = [doc.seo?.focusKeyword || '', ...tagNames].filter(Boolean).join(', ')

      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        '        <news:name>लोक Lens न्यूज़</news:name>',
        `        <news:language>${escapeXml(lang)}</news:language>`,
        '      </news:publication>',
        `      <news:publication_date>${escapeXml(pubDate)}</news:publication_date>`,
        `      <news:title>${escapeXml(doc.title)}</news:title>`,
        ...(keywords ? [`      <news:keywords>${escapeXml(keywords)}</news:keywords>`] : []),
        '    </news:news>',
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    urlNodes,
    '</urlset>',
  ].join('\n')

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}
