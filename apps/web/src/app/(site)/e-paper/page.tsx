import type { Metadata } from 'next'

import { EPAPER_PAGE_SIZE, EPaperList } from '@/components/EPaper'
import { listEPapers } from '@/lib/data'

import { getEPaperRange } from './epaper-data'

export const revalidate = 300

// TODO(seo): src/lib/seo; empty section must be noindex (architecture §3).
export async function generateMetadata(): Promise<Metadata> {
  const { totalItems } = await listEPapers({ pageSize: 1 })
  return { title: 'ई-पेपर', robots: totalItems === 0 ? { index: false, follow: true } : undefined }
}

export default async function EPaperIndex() {
  const [result, range] = await Promise.all([listEPapers({ page: 1, pageSize: EPAPER_PAGE_SIZE }), getEPaperRange()])
  return <EPaperList result={result} range={range} />
}
