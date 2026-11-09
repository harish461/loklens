/**
 * Local development seed (docs/architecture.md §2, §5). LOCAL ONLY: never run against staging or production.
 *
 *   npm run db:seed        (from apps/web; uses DATABASE_URL from .env)
 *
 * - Idempotent: every document is looked up by slug (or filename for media) first, and existing ones are skipped.
 * - Content is copied from src/lib/mock/fixtures.ts (real LokLens headlines), not invented. Summaries and
 *   bodies in the fixtures are bracketed placeholders, and the body text here says so as well.
 * - Writes run with `skipRevalidate`, so seeding never calls Next.js revalidation or the CDN.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'
import type { Article } from '../src/payload-types'
import { articles as fixtureArticles, tags as fixtureTags, categories as fixtureCategories } from '../src/lib/mock/fixtures'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MOCK_DIR = path.resolve(HERE, '../public/mock')
const CONTEXT = { skipRevalidate: true }

/** The six real headlines in the fixtures, plus three placeholder stories so each main category has one article. */
const ARTICLE_SLUGS = [
  'cm-dhami-haldwani-vyapari-udyog-samvad',
  'gairsain-cm-dhami-231-crore-yojana-lokarpan',
  'ranikhet-yuva-congress-baithak-niyuktiyan',
  'ranikhet-congress-manch-shuddhikaran-fir-mang',
  'ranikhet-gandhi-chowk-congress-vote-bachao',
  'rudraa-housing-nainital-6th-anniversary',
  'desh-placeholder-1',
  'khel-placeholder-1',
  'duniya-placeholder-1',
]

const TAG_SLUGS = ['pushkar-singh-dhami', 'haldwani', 'congress']

/** Mock images are placeholders. Articles need >= 1200 px wide; the 1200×630 file is the site default. */
const ARTICLE_IMAGES = ['ph-1200x675.webp', 'ph-1200x900.webp', 'ph-1200x1200.webp']
const DEFAULT_IMAGE = 'ph-1200x630.webp'

const DRAFT_TEXT = '[ड्राफ्ट — यह स्थानापन्न पाठ है। संपादक इसे असली सामग्री से बदलेंगे।]'

const PAGES = [
  { slug: 'about', title: 'हमारे बारे में' },
  { slug: 'privacy-policy', title: 'गोपनीयता नीति' },
] as const

type Counts = Record<'categories' | 'tags' | 'media' | 'articles' | 'pages' | 'settings', { created: number; skipped: number }>

function lexical(text: string): Article['body'] {
  return {
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
          children: [{ type: 'text', text, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
        },
      ],
    },
  } as Article['body']
}

async function seedCategories(payload: Payload, counts: Counts): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const fx of fixtureCategories) {
    const found = await payload.find({
      collection: 'categories',
      where: { slug: { equals: fx.slug } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (found.docs[0]) {
      ids.set(fx.slug, found.docs[0].id)
      counts.categories.skipped++
      continue
    }
    const doc = await payload.create({
      collection: 'categories',
      data: { name: fx.name, slug: fx.slug, order: fx.order, showInNav: true },
      overrideAccess: true,
      context: CONTEXT,
    })
    ids.set(fx.slug, doc.id)
    counts.categories.created++
  }
  return ids
}

async function seedTags(payload: Payload, counts: Counts): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const slug of TAG_SLUGS) {
    const fx = fixtureTags.find((t) => t.slug === slug)
    if (!fx) throw new Error(`Fixture tag missing: ${slug}`)
    const found = await payload.find({
      collection: 'tags',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    if (found.docs[0]) {
      ids.set(slug, found.docs[0].id)
      counts.tags.skipped++
      continue
    }
    const doc = await payload.create({
      collection: 'tags',
      data: { name: fx.name, slug },
      overrideAccess: true,
      context: CONTEXT,
    })
    ids.set(slug, doc.id)
    counts.tags.created++
  }
  return ids
}

/** Uploads a mock image once (matched by filename on later runs). Alt text is Hindi. */
async function seedMedia(payload: Payload, file: string, alt: string, counts: Counts): Promise<number> {
  const found = await payload.find({
    collection: 'media',
    where: { filename: { equals: file } },
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  if (found.docs[0]) {
    counts.media.skipped++
    return found.docs[0].id
  }
  const data = fs.readFileSync(path.join(MOCK_DIR, file))
  const doc = await payload.create({
    collection: 'media',
    data: { alt, credit: 'विकास के लिए प्लेसहोल्डर' },
    file: { data, mimetype: 'image/webp', name: file, size: data.length },
    overrideAccess: true,
    context: CONTEXT,
  })
  counts.media.created++
  return doc.id
}

async function seedArticles(
  payload: Payload,
  categoryIds: Map<string, number>,
  tagIds: Map<string, number>,
  imageIds: Map<string, number>,
  counts: Counts,
): Promise<void> {
  for (const [index, slug] of ARTICLE_SLUGS.entries()) {
    const fx = fixtureArticles.find((a) => a.slug === slug)
    if (!fx) throw new Error(`Fixture article missing: ${slug}`)
    const existing = await payload.find({
      collection: 'articles',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      pagination: false,
      draft: true,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      counts.articles.skipped++
      continue
    }
    const categoryId = categoryIds.get(fx.category.slug)
    const imageId = imageIds.get(ARTICLE_IMAGES[index % ARTICLE_IMAGES.length])
    if (categoryId === undefined || imageId === undefined) throw new Error(`Missing relation for ${slug}`)
    const tags = fx.tags.map((t) => tagIds.get(t.slug)).filter((id): id is number => id !== undefined)

    await payload.create({
      collection: 'articles',
      data: {
        title: fx.title,
        slug,
        summary: fx.summary,
        body: lexical(DRAFT_TEXT),
        featuredImage: imageId,
        category: categoryId,
        tags,
        publishedAt: fx.publishedAt,
        isBreaking: fx.isBreaking,
        isTrending: fx.isTrending,
        isFeatured: fx.isFeatured,
        _status: 'published',
      },
      overrideAccess: true,
      context: CONTEXT,
    })
    counts.articles.created++
  }
}

async function seedPages(payload: Payload, counts: Counts): Promise<void> {
  for (const page of PAGES) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: page.slug } },
      limit: 1,
      depth: 0,
      pagination: false,
      draft: true,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      counts.pages.skipped++
      continue
    }
    await payload.create({
      collection: 'pages',
      data: {
        title: page.title,
        slug: page.slug,
        body: lexical(`${page.title} — ${DRAFT_TEXT}`),
        _status: 'published',
      },
      overrideAccess: true,
      context: CONTEXT,
    })
    counts.pages.created++
  }
}

async function seedSettings(payload: Payload, defaultImageId: number): Promise<void> {
  // Global updates are idempotent by nature: the same values are written on every run (not counted).
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      name: 'लोक Lens न्यूज़',
      tagline: 'आपकी आवाज़, आपकी खबर',
      defaultImage: defaultImageId,
      social: [
        { platform: 'youtube', url: 'https://www.youtube.com/@loklensnews' },
        { platform: 'facebook', url: 'https://www.facebook.com/people/LokLens-Samachar/61584754019161/' },
        { platform: 'instagram', url: 'https://www.instagram.com/loklens_news' },
      ],
    },
    overrideAccess: true,
    context: CONTEXT,
  })
}

async function main(): Promise<void> {
  const payload = await getPayload({ config })
  const counts: Counts = {
    categories: { created: 0, skipped: 0 },
    tags: { created: 0, skipped: 0 },
    media: { created: 0, skipped: 0 },
    articles: { created: 0, skipped: 0 },
    pages: { created: 0, skipped: 0 },
    settings: { created: 0, skipped: 0 },
  }
  try {
    const categoryIds = await seedCategories(payload, counts)
    const tagIds = await seedTags(payload, counts)

    const imageIds = new Map<string, number>()
    for (const file of [...ARTICLE_IMAGES, DEFAULT_IMAGE]) {
      imageIds.set(file, await seedMedia(payload, file, 'प्रतीकात्मक तस्वीर (विकास के लिए प्लेसहोल्डर)', counts))
    }

    await seedArticles(payload, categoryIds, tagIds, imageIds, counts)
    await seedPages(payload, counts)
    await seedSettings(payload, imageIds.get(DEFAULT_IMAGE) as number)

    payload.logger.info(`[seed] ${JSON.stringify(counts)}`)
    console.log('[seed] done', JSON.stringify(counts))
  } finally {
    await payload.destroy()
  }
}

await main()
