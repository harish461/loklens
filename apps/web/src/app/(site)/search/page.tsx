import type { Metadata } from 'next'
import Link from 'next/link'

import { ArticleCard } from '@/components/ArticleCard'
import { Icon } from '@/components/Icon'
import { Breadcrumbs } from '@/components/Navigation'
import ui from '@/components/ui.module.css'
import { search } from '@/lib/mock'

import styles from './search.module.css'

// Dynamic, never cached (architecture §4). Reading searchParams already opts out of static rendering.

// TODO(seo): move to src/lib/seo; search must stay noindex.
export const metadata: Metadata = {
  title: 'खोजें',
  robots: { index: false, follow: true },
}

const PAGE_SIZE = 20

type Props = { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams
  const q = (Array.isArray(sp.q) ? sp.q[0] : (sp.q ?? '')).trim().slice(0, 100)
  const pageRaw = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page)
  const page = Number.isInteger(pageRaw) && pageRaw > 1 ? pageRaw : 1
  const valid = q.length >= 2
  const result = valid ? await search({ q, page, pageSize: PAGE_SIZE }) : null
  const href = (n: number) => `/search?q=${encodeURIComponent(q)}${n > 1 ? `&page=${n}` : ''}`

  return (
    <>
      <div className={ui.pageHead}>
        <div className="container">
          <Breadcrumbs items={[{ label: 'होम', href: '/' }, { label: 'खोजें' }]} />
          <h1 className={ui.pageTitle}>खबरें खोजें</h1>
          <form action="/search" method="get" role="search" className={styles.form}>
            <label htmlFor="search-q" className="visually-hidden">
              खोज शब्द
            </label>
            <input
              id="search-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="जैसे: धामी, रानीखेत, गैरसैंण"
              minLength={2}
              maxLength={100}
              required
            />
            <button type="submit">
              <Icon name="search" size={20} />
              खोजें
            </button>
          </form>
        </div>
      </div>
      <div className="container">
        {!q && <p className={ui.empty}>खोजने के लिए कम से कम 2 अक्षर लिखें।</p>}
        {q && !valid && <p className={ui.empty}>कृपया कम से कम 2 अक्षर लिखें।</p>}
        {result && (
          <>
            <p className={styles.count} role="status">
              “{q}” के लिए {result.totalItems} परिणाम
            </p>
            {result.items.length === 0 ? (
              <p className={ui.empty}>कोई खबर नहीं मिली। दूसरे शब्दों से खोजें।</p>
            ) : (
              <div className={styles.results}>
                {result.items.map((a) => (
                  <ArticleCard key={a.id} article={a} variant="list" thumb="left" headingLevel="h2" />
                ))}
              </div>
            )}
            {result.totalPages > 1 && (
              <nav aria-label="पेज नेविगेशन" className={ui.pager}>
                <span className={ui.pagerStatus}>
                  पेज {result.page} / {result.totalPages}
                </span>
                <div className={ui.pagerLinks}>
                  {result.page > 1 && (
                    <Link href={href(result.page - 1)} className={ui.btnSecondary}>
                      पिछला पेज
                    </Link>
                  )}
                  {result.hasNextPage && (
                    <Link href={href(result.page + 1)} className={ui.btnPrimary}>
                      अगला पेज
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  )
}
