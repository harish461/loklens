import type { Metadata } from 'next'

import { TagPage, tagMetadata } from './tag-page'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return tagMetadata(slug, 1)
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  return <TagPage slug={slug} page={1} />
}
