import type { Metadata } from 'next'

import { parsePageParam } from '@/components/ListingView'

import { TagPage, tagMetadata } from '../../tag-page'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string; page: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params
  const n = Number(page)
  return Number.isInteger(n) && n >= 2 ? tagMetadata(slug, n) : {}
}

export default async function Page({ params }: Props) {
  const { slug, page } = await params
  const n = parsePageParam(page, `/tag/${slug}`)
  return <TagPage slug={slug} page={n} />
}
