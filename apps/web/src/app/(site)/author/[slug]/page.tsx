import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LISTING_PAGE_SIZE, ListingView } from '@/components/ListingView'
import { getAuthor, listArticles } from '@/lib/mock'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

// TODO(seo): replace with src/lib/seo author metadata + Person JSON-LD.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const author = await getAuthor(slug)
  if (!author) return {}
  return { title: `${author.name} — लेखक`, description: author.bio }
}

// Architecture §3 lists only /author/{slug} (no pagination route); the first page shows the latest 12.
export default async function AuthorPage({ params }: Props) {
  const { slug } = await params
  const author = await getAuthor(slug)
  if (!author) notFound()
  const result = await listArticles({ author: slug, page: 1, pageSize: LISTING_PAGE_SIZE })
  return (
    <ListingView
      title={author.name}
      description={author.bio}
      crumbs={[{ label: 'होम', href: '/' }, { label: 'लेखक' }, { label: author.name }]}
      result={{ ...result, totalPages: 1, hasNextPage: false }}
      basePath={`/author/${slug}`}
    />
  )
}
