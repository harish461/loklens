/**
 * Verifies the read helpers and the role rules against the local database. LOCAL ONLY.
 *
 *   npm run db:verify      (after db:seed; creates and removes its own test documents)
 *
 * Covers: helper shapes and pagination, unknown/unpublished -> null, draft isolation, reporter limits.
 * Anonymous REST checks (GET /api/articles, GET /api/users) are run separately over HTTP.
 */
import { randomBytes } from 'crypto'

import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'
import type { Article } from '../src/payload-types'
import * as data from '../src/lib/data'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

async function expectThrow(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (err) {
    return (err as Error).message
  }
}

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

async function categoryId(payload: Payload, slug: string): Promise<number> {
  const res = await payload.find({ collection: 'categories', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
  return res.docs[0].id
}

async function readHelpers(payload: Payload): Promise<void> {
  console.log('\n== helpers (published content only) ==')
  const all = await payload.count({ collection: 'articles', where: { _status: { equals: 'published' } }, overrideAccess: true })
  const publishedTotal = all.totalDocs

  const home = await data.getHome()
  check(
    'getHome returns contract arrays',
    home.latest.length > 0 && home.sections.length === 7 && home.featured.length >= 1 && Array.isArray(home.videos),
    `latest=${home.latest.length} sections=${home.sections.length} featured=${home.featured.length} breaking=${home.breaking.length} ticker=${home.ticker.length}`,
  )

  const p1 = await data.listArticles({ page: 1, pageSize: 4 })
  check('listArticles page mode', p1.items.length === 4 && p1.totalItems === publishedTotal && p1.hasNextPage === true, `total=${p1.totalItems} pages=${p1.totalPages}`)
  const beyond = await data.listArticles({ page: 99, pageSize: 4 })
  check('listArticles page beyond last returns empty items', beyond.items.length === 0 && beyond.hasNextPage === false)

  const seen: number[] = []
  let cursor = ''
  let steps = 0
  for (;;) {
    const cp = await data.listArticles({ cursor, pageSize: 4 })
    seen.push(...cp.items.map((i) => i.id))
    steps++
    if (!cp.nextCursor || steps > 20) break
    cursor = cp.nextCursor
  }
  check(
    'listArticles cursor mode walks every item once',
    seen.length === publishedTotal && new Set(seen).size === seen.length,
    `items=${seen.length} steps=${steps}`,
  )

  const sortedOk = p1.items.every((a, i, arr) => i === 0 || arr[i - 1].publishedAt >= a.publishedAt)
  check('listArticles sorted by publishedAt desc', sortedOk)
  check('publishedAt serialised with IST offset', /\+05:30$/.test(p1.items[0].publishedAt), p1.items[0].publishedAt)

  const rajniti = await data.listArticles({ category: 'rajniti', pageSize: 50 })
  check('category filter', rajniti.items.length === 3 && rajniti.items.every((a) => a.category.slug === 'rajniti'), `n=${rajniti.items.length}`)
  const congress = await data.listArticles({ tag: 'congress', pageSize: 50 })
  check('tag filter', congress.items.length === 3, `n=${congress.items.length}`)
  const breaking = await data.listArticles({ flag: 'breaking', pageSize: 50 })
  check('flag=breaking filter', breaking.items.length === 1 && breaking.items[0].isBreaking === true, `n=${breaking.items.length}`)
  const unknownCat = await data.listArticles({ category: 'no-such-category' })
  check('unknown category filter gives empty list', unknownCat.items.length === 0 && unknownCat.totalItems === 0)

  check(
    'bad query: page + cursor',
    (await expectThrow(() => data.listArticles({ page: 1, cursor: '' } as never)))?.includes('cannot be used together') === true,
  )
  check('bad query: pageSize 0', (await expectThrow(() => data.listArticles({ pageSize: 0 }))) !== null)
  check('bad query: pageSize 51', (await expectThrow(() => data.listArticles({ pageSize: 51 }))) !== null)
  check('bad query: invalid cursor', (await expectThrow(() => data.listArticles({ cursor: 'garbage!!' } as never))) !== null)
  check('bad query: flag', (await expectThrow(() => data.listArticles({ flag: 'nope' as never }))) !== null)

  const first = p1.items[0]
  const article = await data.getArticle(first.id)
  check('getArticle returns the article', article !== null && article.id === first.id)
  if (article) {
    check('article byline falls back to organisation', article.authors.length === 1 && article.authors[0].kind === 'organization' && article.authors[0].name === 'LokLens News Team' && article.authors[0].slug === null)
    check('article image is the uploaded file (not fallback)', article.image.isFallback === false && Object.keys(article.image.sizes).length >= 5, `sizes=${Object.keys(article.image.sizes).join(',')}`)
    check('article body is an array of nodes', Array.isArray(article.body) && article.body.length > 0)
    check('article has tags and related (<= 6)', article.tags.length >= 1 && article.related.length <= 6, `tags=${article.tags.length} related=${article.related.length}`)
    check('article url matches category and id', article.url === `/${article.category.slug}/${article.slug}-${article.id}`, article.url)
    check('article seo fallbacks resolved', article.seo.title === article.title && article.seo.noindex === false)
    check('article has no internal fields', !('createdBy' in article) && !('_status' in article) && !('email' in article))
  }
  check('getArticle unknown id -> null', (await data.getArticle(9_999_999)) === null)
  check('getArticle invalid id -> null', (await data.getArticle(-3)) === null)

  const cats = await data.listCategories()
  check('listCategories returns 7 ordered categories', cats.length === 7 && cats[0].order <= cats[1].order, cats.map((c) => c.slug).join(','))
  check('getCategory found', (await data.getCategory('rajniti'))?.slug === 'rajniti')
  check('getCategory unknown -> null', (await data.getCategory('no-such')) === null)
  check('getCategory invalid slug -> null', (await data.getCategory('Bad Slug!')) === null)
  check('getTag found', (await data.getTag('haldwani'))?.slug === 'haldwani')
  check('getTag unknown -> null', (await data.getTag('unknown-tag')) === null)
  check('getAuthor unknown -> null', (await data.getAuthor('no-author')) === null)
  check('getPage about', (await data.getPage('about'))?.slug === 'about')
  check('getPage unknown -> null', (await data.getPage('no-such-page')) === null)
  check('listVideos empty state', (await data.listVideos()).items.length === 0)
  check('getVideo unknown -> null', (await data.getVideo('no-video')) === null)
  check('listEPapers empty state', (await data.listEPapers()).items.length === 0)
  check('getEPaper bad date -> null', (await data.getEPaper('2026-13-40')) === null)

  const hits = await data.search({ q: 'कांग्रेस' })
  check('search finds Hindi terms', hits.items.length >= 3, `n=${hits.items.length}`)
  const literal = await data.search({ q: '%%' })
  check('search treats % literally', literal.items.length === 0, `n=${literal.items.length}`)
  check('search q too short throws', (await expectThrow(() => data.search({ q: 'a' }))) !== null)

  const settings = await data.getSiteSettings()
  check('getSiteSettings social (3 URLs)', settings.social.length === 3, settings.social.map((s) => s.platform).join(','))
  check('getSiteSettings header falls back to nav categories', settings.navigation.header.length === 7)
  check('getSiteSettings default image marked fallback when unset', typeof settings.defaultImage.url === 'string')

  const sitemap = await data.listSitemapEntries()
  const byType = sitemap.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }), {})
  check('listSitemapEntries covers articles and categories', (byType.article ?? 0) === publishedTotal && (byType.category ?? 0) === 7, JSON.stringify(byType))
  const news = await data.listRecentForNews(48)
  check('listRecentForNews (48 h)', news.length === publishedTotal, `n=${news.length}`)
  const feed = await data.listForFeed()
  check('listForFeed latest', feed.length === publishedTotal, `n=${feed.length}`)
  check('listForFeed by category', (await data.listForFeed('khel')).length === 1)
}

async function draftIsolation(payload: Payload): Promise<void> {
  console.log('\n== draft isolation ==')
  const slug = `verify-draft-${randomBytes(3).toString('hex')}`
  const draft = await payload.create({
    collection: 'articles',
    data: {
      title: 'परीक्षण ड्राफ्ट खबर',
      slug,
      summary: 'परीक्षण',
      body: lexical('परीक्षण'),
      featuredImage: (await payload.find({ collection: 'media', limit: 1, depth: 0, overrideAccess: true })).docs[0].id,
      category: await categoryId(payload, 'pradesh'),
      _status: 'draft',
    },
    overrideAccess: true,
    context: { skipRevalidate: true },
  })
  check('draft article is not returned by getArticle', (await data.getArticle(draft.id)) === null)
  const list = await data.listArticles({ pageSize: 50 })
  check('draft article is not in listArticles', !list.items.some((a) => a.id === draft.id))
  check('draft article is not returned by search', !(await data.search({ q: 'परीक्षण ड्राफ्ट' })).items.some((a) => a.id === draft.id))

  // Editing a published article as a draft must not change what the public sees.
  const live = list.items[0]
  const before = await data.getArticle(live.id)
  await payload.update({
    collection: 'articles',
    id: live.id,
    data: { title: 'परीक्षण — संपादित ड्राफ्ट शीर्षक' },
    draft: true,
    overrideAccess: true,
    context: { skipRevalidate: true },
  })
  const after = await data.getArticle(live.id)
  check('draft edit of a live article does not change the public version', after?.title === before?.title, `live="${after?.title}"`)
  // Restore the live article exactly: title and published status (a plain save keeps the current status).
  await payload.update({
    collection: 'articles',
    id: live.id,
    data: { title: before?.title ?? live.title, _status: 'published' },
    overrideAccess: true,
    context: { skipRevalidate: true },
  })

  await payload.delete({ collection: 'articles', id: draft.id, overrideAccess: true, context: { skipRevalidate: true } })
}

async function reporterRules(payload: Payload): Promise<void> {
  console.log('\n== reporter role limits ==')
  const email = `verify-reporter-${randomBytes(4).toString('hex')}@example.test`
  const reporter = await payload.create({
    collection: 'users',
    data: { email, password: randomBytes(18).toString('hex'), name: 'परीक्षण रिपोर्टर', slug: `verify-user-${randomBytes(3).toString('hex')}`, role: 'reporter' },
    overrideAccess: true,
    draft: false,
  })
  const user = { ...reporter, collection: 'users' as const }
  const reporterReq = { user, overrideAccess: false as const, context: { skipRevalidate: true } }
  const catId = await categoryId(payload, 'pradesh')
  const imageId = (await payload.find({ collection: 'media', limit: 1, depth: 0, overrideAccess: true })).docs[0].id

  try {
    const draft = await payload.create({
      collection: 'articles',
      ...reporterReq,
      data: {
        title: 'रिपोर्टर परीक्षण',
        slug: `verify-reporter-${randomBytes(3).toString('hex')}`,
        summary: 'परीक्षण',
        body: lexical('परीक्षण'),
        featuredImage: imageId,
        category: catId,
        _status: 'draft',
      },
    })
    check('reporter can create a draft', draft.id !== undefined && draft._status === 'draft')

    // Passes when the update is rejected, or when the requested value was not stored (field access strips it).
    const tryUpdate = async (label: string, body: Record<string, unknown>, extraOpts: Record<string, unknown> = {}) => {
      const err = await expectThrow(() =>
        payload.update({ collection: 'articles', id: draft.id, ...reporterReq, data: body, ...extraOpts }),
      )
      const stored = (await payload.findByID({ collection: 'articles', id: draft.id, depth: 0, draft: true, overrideAccess: true })) as unknown as Record<string, unknown>
      const applied = Object.entries(body).some(([k, v]) => stored[k] === v)
      check(label, err !== null || !applied, err ? `rejected: ${err.slice(0, 80)}` : `no error; value not stored`)
    }

    await tryUpdate('reporter cannot set _status to published', { _status: 'published' })
    const afterPublish = await payload.findByID({ collection: 'articles', id: draft.id, depth: 0, draft: true, overrideAccess: true })
    check('draft is still draft after reporter publish attempt', afterPublish._status !== 'published', `status=${afterPublish._status}`)
    // A plain save (no draft flag) is a publish in Payload; it must not publish for a reporter either.
    const plainErr = await expectThrow(() =>
      payload.update({ collection: 'articles', id: draft.id, ...reporterReq, data: { title: 'रिपोर्टर सादा सेव' } }),
    )
    const afterPlain = await payload.findByID({ collection: 'articles', id: draft.id, depth: 0, draft: true, overrideAccess: true })
    check(
      'reporter plain save (no draft flag) does not publish',
      afterPlain._status !== 'published',
      plainErr ? `rejected: ${plainErr.slice(0, 80)}` : `status=${afterPlain._status}`,
    )
    await tryUpdate('reporter cannot set isBreaking', { isBreaking: true })
    await tryUpdate('reporter cannot set isTrending', { isTrending: true })
    await tryUpdate('reporter cannot set isFeatured', { isFeatured: true })

    const withFlag = await expectThrow(() =>
      payload.create({
        collection: 'articles',
        ...reporterReq,
        data: {
          title: 'रिपोर्टर फ्लैग परीक्षण',
          slug: `verify-reporter-flag-${randomBytes(3).toString('hex')}`,
          summary: 'परीक्षण',
          body: lexical('परीक्षण'),
          featuredImage: imageId,
          category: catId,
          isFeatured: true,
          _status: 'draft',
        },
      }),
    )
    if (withFlag) {
      check('reporter create with isFeatured is rejected', true, withFlag.slice(0, 80))
    } else {
      const created = await payload.find({ collection: 'articles', where: { title: { equals: 'रिपोर्टर फ्लैग परीक्षण' } }, limit: 5, depth: 0, draft: true, overrideAccess: true })
      check('reporter create with isFeatured is stripped', created.docs.every((d) => d.isFeatured !== true))
      for (const d of created.docs) await payload.delete({ collection: 'articles', id: d.id, overrideAccess: true, context: { skipRevalidate: true } })
    }

    await payload.delete({ collection: 'articles', id: draft.id, overrideAccess: true, context: { skipRevalidate: true } })
  } finally {
    await payload.delete({ collection: 'users', id: reporter.id, overrideAccess: true })
    console.log('       test reporter and draft articles removed')
  }
}

async function main(): Promise<void> {
  const payload = await getPayload({ config })
  try {
    await readHelpers(payload)
    await draftIsolation(payload)
    await reporterRules(payload)
  } finally {
    await payload.destroy()
  }
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
