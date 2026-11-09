import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EPAPER_PAGE_SIZE, EPaperList } from '@/components/EPaper'
import { parsePageParam } from '@/components/ListingView'
import { listEPapers } from '@/lib/mock'

import { getEPaperRange } from '../../epaper-data'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ page: string }> }

// TODO(seo): src/lib/seo.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params
  return { title: `ई-पेपर — पेज ${page}` }
}

export default async function EPaperPage({ params }: Props) {
  const { page } = await params
  const n = parsePageParam(page, '/e-paper')
  const [result, range] = await Promise.all([listEPapers({ page: n, pageSize: EPAPER_PAGE_SIZE }), getEPaperRange()])
  if (n > result.totalPages) notFound()
  return <EPaperList result={result} range={range} />
}
