import type { Metadata } from 'next'

import { formatDate } from '@/components/format'
import { Breadcrumbs } from '@/components/Navigation'
import ui from '@/components/ui.module.css'
import { listEPapers } from '@/lib/mock'

export const revalidate = 300

// TODO(seo): src/lib/seo; empty section must be noindex (architecture §3).
export async function generateMetadata(): Promise<Metadata> {
  const { totalItems } = await listEPapers({ pageSize: 1 })
  return { title: 'ई-पेपर', robots: totalItems === 0 ? { index: false } : undefined }
}

// Minimal list; the dated viewer (/e-paper/{yyyy-mm-dd}) is a later task.
export default async function EPaperPage() {
  const { items } = await listEPapers({ pageSize: 30 })
  return (
    <>
      <div className={ui.pageHead}>
        <div className="container">
          <Breadcrumbs items={[{ label: 'होम', href: '/' }, { label: 'ई-पेपर' }]} />
          <h1 className={ui.pageTitle}>ई-पेपर</h1>
        </div>
      </div>
      <div className="container">
        {items.length === 0 ? (
          <p className={ui.empty}>ई-पेपर जल्द ही यहां उपलब्ध होगा।</p>
        ) : (
          <ul>
            {items.map((e) => (
              <li key={e.date}>
                <a href={e.pdfUrl}>
                  {e.edition} — {formatDate(`${e.date}T00:00:00+05:30`)} (PDF)
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
