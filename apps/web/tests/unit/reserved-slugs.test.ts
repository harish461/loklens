import { describe, expect, it } from 'vitest'

import { RESERVED_SLUGS, isReservedSlug } from '../../src/lib/slug/reserved'
import { validateCategorySlug, validateSlugFormat } from '../../src/lib/slug/validate'

const ARCHITECTURE_RESERVED = [
  'tag', 'author', 'video', 'e-paper', 'search', 'about', 'contact', 'advertise', 'privacy-policy',
  'terms', 'editorial-policy', 'corrections-policy', 'disclaimer', 'admin', 'api', 'legacy', 'media',
  'rss.xml', 'sitemap.xml', 'news-sitemap.xml', 'page', '_next',
]

describe('reserved slugs (architecture §3)', () => {
  it('contains exactly the route names from the architecture', () => {
    expect([...RESERVED_SLUGS].sort()).toEqual([...ARCHITECTURE_RESERVED].sort())
  })

  it('matches case-insensitively and trims', () => {
    expect(isReservedSlug('Admin')).toBe(true)
    expect(isReservedSlug(' tag ')).toBe(true)
    expect(isReservedSlug('pradesh')).toBe(false)
  })
})

describe('validateCategorySlug', () => {
  it.each(['desh', 'pradesh', 'rajniti', 'samaj', 'khel', 'duniya', 'vichar', 'tag-news', 'pages'])(
    'accepts %s',
    (slug) => expect(validateCategorySlug(slug)).toBe(true),
  )

  it.each(ARCHITECTURE_RESERVED.filter((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)))('rejects reserved %s', (slug) => {
    expect(validateCategorySlug(slug)).toMatch(/reserved/)
  })

  it.each(['rss.xml', '_next', 'Pradesh', 'प्रदेश', 'a b', ''])('rejects malformed "%s"', (slug) => {
    expect(validateCategorySlug(slug)).not.toBe(true)
  })

  it('rejects non-strings and overlong values', () => {
    expect(validateCategorySlug(42)).not.toBe(true)
    expect(validateSlugFormat('a'.repeat(81))).toMatch(/at most 80/)
  })
})
