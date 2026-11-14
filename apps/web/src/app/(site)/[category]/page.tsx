import type { Metadata } from 'next'

import { CategoryPage, categoryMetadata } from './category-page'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// Render on first request and cache (ISR); slugs come from the CMS.
export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ category: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  return categoryMetadata(category, 1)
}

export default async function Page({ params }: Props) {
  const { category } = await params
  return <CategoryPage slug={category} page={1} />
}
