import type { Metadata } from 'next'

import { parsePageParam } from '@/components/ListingView'

import { CategoryPage, categoryMetadata } from '../../category-page'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ category: string; page: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, page } = await params
  const n = Number(page)
  return Number.isInteger(n) && n >= 2 ? categoryMetadata(category, n) : {}
}

export default async function Page({ params }: Props) {
  const { category, page } = await params
  const n = parsePageParam(page, `/${category}`)
  return <CategoryPage slug={category} page={n} />
}
