import { FilePlus2, Newspaper, Search } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { WORKFLOW_LABELS, WORKFLOW_STATUSES } from '@/access/workflow'
import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { ArticlesTable } from '@/components/reporter/ArticlesTable'
import { formOptions, listMyArticles, parseListParams } from '@/lib/reporter/queries'
import { requireReporter } from '@/lib/reporter/session'

export const metadata: Metadata = { title: 'My Articles' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function MyArticlesPage({ searchParams }: Props) {
  const session = await requireReporter()
  const params = parseListParams(await searchParams)
  const [list, options] = await Promise.all([listMyArticles(session, params), formOptions(session)])
  const filtered = Boolean(params.q || params.category || params.status)

  /** Same filters, another page. */
  const pageHref = (page: number) => {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.category) sp.set('category', params.category)
    if (params.status) sp.set('status', params.status)
    if (params.sort !== 'latest') sp.set('sort', params.sort)
    if (page > 1) sp.set('page', String(page))
    const qs = sp.toString()
    return qs ? `/reporter/articles?${qs}` : '/reporter/articles'
  }

  return (
    <div className={adminStyles.pageShell}>
      <header className={adminStyles.pageHeader}>
        <div className={adminStyles.titleGroup}>
          <span className={adminStyles.titleIcon}>
            <Newspaper size={20} />
          </span>
          <div>
            <h1 className={adminStyles.pageTitle}>My Articles</h1>
            <p className={adminStyles.pageSubtitle}>
              {list.totalDocs === 1 ? '1 article' : `${list.totalDocs} articles`}
              {filtered ? ' match your filters' : ' written by you'}
            </p>
          </div>
        </div>
        <div className={adminStyles.headerActions}>
          <Link href="/reporter/articles/new" className={adminStyles.primaryLimeBtn}>
            <FilePlus2 size={16} /> Create Article
          </Link>
        </div>
      </header>

      <section className={adminStyles.cardSurface}>
        <form className={adminStyles.filterToolbar} action="/reporter/articles" method="get" role="search">
          <label className={adminStyles.searchBox}>
            <Search size={16} className={adminStyles.searchIcon} aria-hidden="true" />
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              Search by title
            </span>
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Search by title…"
              className={adminStyles.searchInput}
            />
          </label>
          <div className={adminStyles.dropdownRow}>
            <select name="category" defaultValue={params.category} className={adminStyles.filterSelect} aria-label="Filter by category">
              <option value="">All categories</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={params.status} className={adminStyles.filterSelect} aria-label="Filter by status">
              <option value="">All statuses</option>
              {WORKFLOW_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {WORKFLOW_LABELS[s]}
                </option>
              ))}
            </select>
            <select name="sort" defaultValue={params.sort} className={adminStyles.filterSelect} aria-label="Sort">
              <option value="latest">Latest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button type="submit" className={adminStyles.navyBtn}>
              Apply
            </button>
            {filtered && (
              <Link href="/reporter/articles" className={adminStyles.secondaryBtn}>
                Clear
              </Link>
            )}
          </div>
        </form>

        {list.rows.length > 0 ? (
          <>
            <ArticlesTable rows={list.rows} />
            {list.totalPages > 1 && (
              <nav className={adminStyles.paginationFooter} aria-label="Pagination">
                <span className={adminStyles.pageCountLabel}>
                  Page {list.page} of {list.totalPages}
                </span>
                <div className={adminStyles.pageNumbers}>
                  {list.page > 1 && (
                    <Link href={pageHref(list.page - 1)} className={adminStyles.pageNumBtn} aria-label="Previous page">
                      ‹
                    </Link>
                  )}
                  {Array.from({ length: list.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === list.totalPages || Math.abs(p - list.page) <= 2)
                    .map((p) => (
                      <Link
                        key={p}
                        href={pageHref(p)}
                        className={`${adminStyles.pageNumBtn} ${p === list.page ? adminStyles.pageNumBtnActive : ''}`}
                        aria-current={p === list.page ? 'page' : undefined}
                      >
                        {p}
                      </Link>
                    ))}
                  {list.page < list.totalPages && (
                    <Link href={pageHref(list.page + 1)} className={adminStyles.pageNumBtn} aria-label="Next page">
                      ›
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        ) : filtered ? (
          <div className={adminStyles.emptyBox}>
            <h3>No matching articles</h3>
            <p>Try another search or clear the filters.</p>
            <div className={adminStyles.emptyActions}>
              <Link href="/reporter/articles" className={adminStyles.secondaryBtn}>
                Clear filters
              </Link>
            </div>
          </div>
        ) : (
          <div className={adminStyles.emptyBox}>
            <h3>You haven’t written any articles yet</h3>
            <p>Start a story now. It stays a private draft until you submit it for the editor’s review.</p>
            <div className={adminStyles.emptyActions}>
              <Link href="/reporter/articles/new" className={adminStyles.primaryLimeBtn}>
                <FilePlus2 size={16} /> Create your first article
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
