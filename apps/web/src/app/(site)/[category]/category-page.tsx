// Shared by /[category] and /[category]/page/[page] (colocated module, not a route).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LISTING_PAGE_SIZE, ListingView } from '@/components/ListingView'
import { isReservedSlug } from '@/lib/slug/reserved'
import { getCategory, listArticles } from '@/lib/data'

export async function loadCategory(slug: string) {
  // Reserved route names (architecture §3) never resolve as categories.
  if (isReservedSlug(slug)) return null
  return getCategory(slug)
}

export async function CategoryPage({ slug, page }: { slug: string; page: number }) {
  const category = await loadCategory(slug)
  if (!category) notFound()
  const [result, latest] = await Promise.all([
    listArticles({ category: category.slug, page, pageSize: LISTING_PAGE_SIZE }),
    listArticles({ pageSize: 6 }),
  ])
  if (page > 1 && page > result.totalPages) notFound()
  return (
    <ListingView
      title={category.name}
      description={category.description}
      crumbs={[{ label: 'होम', href: '/' }, { label: category.name }]}
      result={result}
      basePath={`/${category.slug}`}
      sidebar={latest.items.filter((a) => a.category.id !== category.id).slice(0, 6)}
      hideCategory
    />
  )
}

// TODO(seo): replace with src/lib/seo category metadata (canonical, prev/next, OG).
export async function categoryMetadata(slug: string, page: number): Promise<Metadata> {
  const category = await loadCategory(slug)
  if (!category) return {}
  const suffix = page > 1 ? ` — पेज ${page}` : ''
  return { title: `${category.seo.title}${suffix}`, description: category.seo.description }
}
