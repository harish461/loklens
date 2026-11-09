import { afterEach, describe, expect, it, vi } from 'vitest'

import { affectsPublished, relId, relIds } from '../../src/hooks/revalidate'
import { isAllowedEmbed, isAllowedLinkUrl, sanitizeLexical } from '../../src/hooks/sanitizeRichText'
import { expireCacheTags } from '../../src/lib/revalidate/run'
import { purgePathsForArticle, tagsForArticle, tagsForCategory } from '../../src/lib/revalidate/tags'

describe('cache tags (architecture §4)', () => {
  it('article change expires article, old+new category, tags, authors, home, feeds', () => {
    expect(
      tagsForArticle({
        id: 142,
        categorySlugs: ['pradesh', 'desh', 'pradesh', null],
        tagSlugs: ['dhami'],
        authorSlugs: ['rahul-negi'],
      }),
    ).toEqual([
      'article:142',
      'list:category:pradesh',
      'list:category:desh',
      'list:tag:dhami',
      'list:author:rahul-negi',
      'home',
      'feeds',
    ])
  })

  it('category change also refreshes navigation (settings)', () => {
    expect(tagsForCategory(['khel', 'sports'])).toEqual(['list:category:khel', 'list:category:sports', 'home', 'feeds', 'settings'])
  })

  it('purges old and new article URLs', () => {
    const paths = purgePathsForArticle({
      id: 7,
      slug: 'new-slug',
      previousSlug: 'old-slug',
      categorySlug: 'pradesh',
      previousCategorySlug: 'desh',
    })
    expect(paths).toContain('/pradesh/new-slug-7')
    expect(paths).toContain('/desh/old-slug-7')
    expect(paths).toContain('/desh')
  })

  it('relationship ids are extracted from ids, docs and polymorphic values', () => {
    expect(relId(5)).toBe(5)
    expect(relId({ id: 6, slug: 'x' })).toBe(6)
    expect(relId({ relationTo: 'users', value: { id: 8 } })).toBe(8)
    expect(relIds([1, { id: 2 }, null])).toEqual([1, 2])
  })

  it('only changes touching the live version revalidate', () => {
    expect(affectsPublished({ _status: 'draft' }, { _status: 'draft' })).toBe(false)
    expect(affectsPublished({ _status: 'published' }, undefined)).toBe(true)
    expect(affectsPublished({ _status: 'draft' }, { _status: 'published' })).toBe(true)
    expect(affectsPublished({ title: 'no drafts' }, undefined)).toBe(true)
  })
})

describe('expireCacheTags outside Next', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('is a silent no-op in scripts (no NEXT_RUNTIME)', async () => {
    vi.stubEnv('NEXT_RUNTIME', '')
    const log = vi.fn()
    await expect(expireCacheTags(['home'], log)).resolves.toBeUndefined()
    expect(log).not.toHaveBeenCalled()
  })
})

describe('rich-text sanitising (contract §5)', () => {
  it('allows only http(s), mailto, tel and site paths', () => {
    expect(isAllowedLinkUrl('https://loklensnews.com')).toBe(true)
    expect(isAllowedLinkUrl('mailto:news@example.com')).toBe(true)
    expect(isAllowedLinkUrl('tel:+911234')).toBe(true)
    expect(isAllowedLinkUrl('/pradesh')).toBe(true)
    expect(isAllowedLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedLinkUrl('//evil.com')).toBe(false)
    expect(isAllowedLinkUrl('data:text/html,x')).toBe(false)
  })

  it('checks embed hosts against the provider allow-list', () => {
    expect(isAllowedEmbed('youtube', 'https://www.youtube.com/watch?v=abcdefghijk')).toBe(true)
    expect(isAllowedEmbed('youtube', 'https://evil.com/watch')).toBe(false)
    expect(isAllowedEmbed('x', 'http://x.com/a')).toBe(false)
    expect(isAllowedEmbed('tiktok', 'https://tiktok.com/a')).toBe(false)
  })

  it('unwraps bad links (keeping text) and drops bad embeds', () => {
    const text = { type: 'text', text: 'click' }
    const value = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'link', fields: { linkType: 'custom', url: 'javascript:x' }, children: [text] }],
          },
          { type: 'block', fields: { blockType: 'embed', provider: 'youtube', url: 'https://evil.com/x' } },
          { type: 'block', fields: { blockType: 'embed', provider: 'youtube', url: 'https://youtu.be/abcdefghijk' } },
        ],
      },
    }
    const out = sanitizeLexical(value)
    expect(out.root.children).toHaveLength(2)
    expect((out.root.children[0] as { children: unknown[] }).children).toEqual([text])
  })
})
