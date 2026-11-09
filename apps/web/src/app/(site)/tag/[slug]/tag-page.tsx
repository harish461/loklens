// Shared by /tag/[slug] and /tag/[slug]/page/[page].
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LISTING_PAGE_SIZE, ListingView } from '@/components/ListingView'
import { getTag, listArticles } from '@/lib/mock'

export async function TagPage({ slug, page }: { slug: string; page: number }) {
  const tag = await getTag(slug)
  if (!tag) notFound()
  const result = await listArticles({ tag: tag.slug, page, pageSize: LISTING_PAGE_SIZE })
  if (page > 1 && page > result.totalPages) notFound()
  return (
    <ListingView
      title={`#${tag.name}`}
      description={`“${tag.name}” से जुड़ी सभी खबरें`}
      crumbs={[{ label: 'होम', href: '/' }, { label: 'टैग' }, { label: tag.name }]}
      result={result}
      basePath={`/tag/${tag.slug}`}
    />
  )
}

// TODO(seo): replace with src/lib/seo tag metadata.
export async function tagMetadata(slug: string, page: number): Promise<Metadata> {
  const tag = await getTag(slug)
  if (!tag) return {}
  return { title: `${tag.name} — ताज़ा खबरें${page > 1 ? ` — पेज ${page}` : ''}` }
}
