// Shared by /[category] and /[category]/page/[page] (colocated module, not a route).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LISTING_PAGE_SIZE, ListingView } from '@/components/ListingView'
import { isReservedSlug } from '@/lib/slug/reserved'
import { getCategory, getSiteSettings, listArticles } from '@/lib/data'
import { buildBreadcrumbJsonLd, buildCategoryMetadata } from '@/lib/seo'

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
  const otherCategoryItems = latest.items.filter((a) => a.category.id !== category.id)
  const sidebarItems = (otherCategoryItems.length >= 3 ? otherCategoryItems : latest.items).slice(0, 5)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'होम', path: '/' },
    { name: category.name, path: `/${category.slug}` },
  ])
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ListingView
        title={category.name}
        description={category.description}
        crumbs={[{ label: 'होम', href: '/' }, { label: category.name }]}
        result={result}
        basePath={`/${category.slug}`}
        sidebar={sidebarItems}
        hideCategory
      />
    </>
  )
}

export async function categoryMetadata(slug: string, page: number): Promise<Metadata> {
  const [category, settings] = await Promise.all([loadCategory(slug), getSiteSettings()])
  if (!category) return {}
  return buildCategoryMetadata(category, page, settings)
}
