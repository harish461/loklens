'use client'

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Eye,
  FileEdit,
  Flame,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import styles from './articlesAdmin.module.css'
import { type AdminArticleItem, type ArticleWorkflowStatus } from './mock-cms-data'

export interface ArticlesListClientProps {
  initialArticles: AdminArticleItem[]
  categories: { id: number; name: string; slug: string }[]
  initialStatusFilter?: string
}

const STATUS_META: Record<
  ArticleWorkflowStatus,
  { label: string; badgeClass: string }
> = {
  published: { label: 'Published', badgeClass: 'badgePublished' },
  draft: { label: 'Draft', badgeClass: 'badgeDraft' },
  pending_review: { label: 'Pending Review', badgeClass: 'badgePending' },
  scheduled: { label: 'Scheduled', badgeClass: 'badgeScheduled' },
  rejected: { label: 'Rejected', badgeClass: 'badgeRejected' },
}

function formatHindiDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ArticlesListClient({
  initialArticles,
  categories,
  initialStatusFilter,
}: ArticlesListClientProps) {
  const [articles, setArticles] = useState<AdminArticleItem[]>(initialArticles)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatusFilter && initialStatusFilter in STATUS_META ? initialStatusFilter : 'all',
  )
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all')
  const [customDate, setCustomDate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  const allCategories = useMemo(() => {
    const names = new Set<string>()
    for (const c of categories) names.add(c.name)
    for (const a of articles) if (a.category) names.add(a.category)
    return Array.from(names)
  }, [categories, articles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const referenceNowMs = Date.now()
    const todayKey = new Date().toISOString().slice(0, 10)
    return articles.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (q) {
        const hay = `${a.title} ${a.summary} ${a.author} ${a.category} ${a.slug}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (dateFilter !== 'all') {
        const pubTime = Date.parse(a.publishedAt)
        if (!Number.isNaN(pubTime)) {
          if (dateFilter === 'today') {
            if (a.publishedAt.slice(0, 10) !== todayKey) return false
          } else if (dateFilter === '7d') {
            if (referenceNowMs - pubTime > 7 * 86_400_000) return false
          } else if (dateFilter === '30d') {
            if (referenceNowMs - pubTime > 30 * 86_400_000) return false
          } else if (dateFilter === 'custom' && customDate) {
            if (a.publishedAt.slice(0, 10) !== customDate) return false
          }
        }
      }
      return true
    })
  }, [articles, categoryFilter, statusFilter, search, dateFilter, customDate])

  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((a) => selectedIds.has(a.id))

  function toggleSelectAll() {
    const next = new Set(selectedIds)
    if (allOnPageSelected) {
      for (const a of paginated) next.delete(a.id)
    } else {
      for (const a of paginated) next.add(a.id)
    }
    setSelectedIds(next)
  }

  function toggleRow(id: string | number) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // Row Actions (Publish, Unpublish, Delete)
  async function updateArticleStatus(item: AdminArticleItem, nextStatus: ArticleWorkflowStatus) {
    setBusy(true)
    try {
      if (item.dbId) {
        const payloadStatus = nextStatus === 'published' ? 'published' : 'draft'
        const res = await fetch(`/api/articles/${item.dbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ _status: payloadStatus }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }
      setArticles((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a)),
      )
      notify(
        nextStatus === 'published'
          ? 'Article published successfully'
          : 'Article moved to Draft',
      )
    } catch {
      notify('Could not update article status. Verify permissions.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSingleArticle(item: AdminArticleItem) {
    if (!window.confirm(`Delete "${item.title}"? This action cannot be undone.`)) return
    setBusy(true)
    try {
      if (item.dbId) {
        const res = await fetch(`/api/articles/${item.dbId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }
      setArticles((prev) => prev.filter((a) => a.id !== item.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      notify('Article deleted')
    } catch {
      notify('Could not delete article.')
    } finally {
      setBusy(false)
    }
  }

  /** Sends one request per selected DB article; returns the ids whose request succeeded. */
  async function sendForEach(
    targets: AdminArticleItem[],
    init: RequestInit,
  ): Promise<Set<AdminArticleItem['id']>> {
    const results = await Promise.all(
      targets.map(async (t) => {
        if (!t.dbId) return t.id
        const res = await fetch(`/api/articles/${t.dbId}`, { credentials: 'include', ...init }).catch(
          () => null,
        )
        return res?.ok ? t.id : null
      }),
    )
    return new Set(results.filter((id): id is AdminArticleItem['id'] => id !== null))
  }

  function reportBulk(done: number, total: number, success: string) {
    notify(
      done === total
        ? success
        : `${done} of ${total} done; ${total - done} failed (check permissions or connection).`,
    )
  }

  // Bulk Actions
  async function runBulkStatus(nextStatus: ArticleWorkflowStatus) {
    if (selectedIds.size === 0) return
    setBusy(true)
    const targets = articles.filter((a) => selectedIds.has(a.id))
    const payloadStatus = nextStatus === 'published' ? 'published' : 'draft'
    try {
      const ok = await sendForEach(targets, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _status: payloadStatus }),
      })
      setArticles((prev) => prev.map((a) => (ok.has(a.id) ? { ...a, status: nextStatus } : a)))
      reportBulk(ok.size, targets.length, `Updated ${ok.size} article(s) to ${STATUS_META[nextStatus].label}`)
      setSelectedIds(new Set())
    } finally {
      setBusy(false)
    }
  }

  async function runBulkBreaking(breakingVal: boolean) {
    if (selectedIds.size === 0) return
    setBusy(true)
    const targets = articles.filter((a) => selectedIds.has(a.id))
    try {
      const ok = await sendForEach(targets, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBreaking: breakingVal }),
      })
      setArticles((prev) => prev.map((a) => (ok.has(a.id) ? { ...a, isBreaking: breakingVal } : a)))
      reportBulk(
        ok.size,
        targets.length,
        breakingVal
          ? `Marked ${ok.size} article(s) as Breaking News`
          : `Cleared Breaking News flag on ${ok.size} article(s)`,
      )
      setSelectedIds(new Set())
    } finally {
      setBusy(false)
    }
  }

  async function runBulkDelete() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} selected article(s)?`)) return
    setBusy(true)
    const targets = articles.filter((a) => selectedIds.has(a.id))
    try {
      const ok = await sendForEach(targets, { method: 'DELETE' })
      setArticles((prev) => prev.filter((a) => !ok.has(a.id)))
      reportBulk(ok.size, targets.length, `Deleted ${ok.size} article(s)`)
      setSelectedIds(new Set())
    } finally {
      setBusy(false)
    }
  }

  const countsByStatus = useMemo(() => {
    const counts = {
      all: articles.length,
      published: 0,
      draft: 0,
      pending_review: 0,
      scheduled: 0,
      rejected: 0,
    }
    for (const a of articles) counts[a.status] = (counts[a.status] ?? 0) + 1
    return counts
  }, [articles])

  return (
    <div className={styles.pageShell}>
      {toast && (
        <div className={styles.toast} role="status">
          <Sparkles size={15} />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon}>
            <Newspaper size={22} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>News Articles</h1>
            <p className={styles.pageSubtitle}>
              Manage all Hindi news stories, editorial workflow statuses, breaking flags and SEO
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href="/admin/collections/articles/create" className={styles.primaryLimeBtn}>
            <Plus size={16} />
            <span>Create Article</span>
          </Link>
        </div>
      </header>

      {/* Status Quick Tabs */}
      <div className={styles.statusTabsRow}>
        {(
          [
            { key: 'all', label: 'All Articles', count: countsByStatus.all },
            { key: 'published', label: 'Published', count: countsByStatus.published },
            { key: 'draft', label: 'Drafts', count: countsByStatus.draft },
            { key: 'pending_review', label: 'Pending Review', count: countsByStatus.pending_review },
            { key: 'scheduled', label: 'Scheduled', count: countsByStatus.scheduled },
            { key: 'rejected', label: 'Rejected', count: countsByStatus.rejected },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.statusTabPill} ${
              statusFilter === tab.key ? styles.statusTabPillActive : ''
            }`}
            onClick={() => {
              setStatusFilter(tab.key)
              setPage(1)
            }}
          >
            <span>{tab.label}</span>
            <span className={styles.tabCount}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Main Card Container */}
      <div className={styles.cardSurface}>
        {/* Search, Category, Status & Date Filter Bar */}
        <div className={styles.filterToolbar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by Hindi headline, slug, summary or journalist..."
              className={styles.searchInput}
              aria-label="Search articles"
            />
          </div>

          <div className={styles.dropdownRow}>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className={styles.filterSelect}
              aria-label="Category filter"
            >
              <option value="all">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className={styles.filterSelect}
              aria-label="Status filter"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="scheduled">Scheduled</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as typeof dateFilter)
                setPage(1)
              }}
              className={styles.filterSelect}
              aria-label="Date filter"
            >
              <option value="all">All Dates</option>
              <option value="today">Today (12 Nov)</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Date...</option>
            </select>

            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value)
                  setPage(1)
                }}
                className={styles.dateInput}
                aria-label="Pick date"
              />
            )}
          </div>
        </div>

        {/* Bulk Actions Bar (appears when 1+ rows selected) */}
        {selectedIds.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>
              <strong>{selectedIds.size}</strong> article(s) selected
            </span>
            <div className={styles.bulkActions}>
              <button
                type="button"
                disabled={busy}
                onClick={() => runBulkStatus('published')}
                className={styles.bulkBtn}
              >
                <CheckCircle2 size={14} /> Publish
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runBulkStatus('draft')}
                className={styles.bulkBtn}
              >
                <FileEdit size={14} /> Unpublish (Draft)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runBulkBreaking(true)}
                className={styles.bulkBtn}
              >
                <Flame size={14} /> Mark Breaking
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={runBulkDelete}
                className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
              >
                <Trash2 size={14} /> Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className={styles.bulkClearBtn}
              >
                <XCircle size={14} /> Clear
              </button>
            </div>
          </div>
        )}

        {/* Desktop Table & Mobile Cards */}
        {paginated.length === 0 ? (
          <div className={styles.emptyBox}>
            <AlertCircle size={28} />
            <h3>No articles found</h3>
            <p>Try clearing your filters or create a new Hindi news article.</p>
            <div className={styles.emptyActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setSearch('')
                  setCategoryFilter('all')
                  setStatusFilter('all')
                  setDateFilter('all')
                }}
              >
                Reset all filters
              </button>
              <Link href="/admin/collections/articles/create" className={styles.primaryLimeBtn}>
                <Plus size={15} /> Create New Article
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkCol}>
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all articles on this page"
                      />
                    </th>
                    <th>Article</th>
                    <th>Category</th>
                    <th>Author</th>
                    <th>Date</th>
                    <th>Views</th>
                    <th>Status</th>
                    <th className={styles.rightAlign}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => {
                    const checked = selectedIds.has(item.id)
                    const st = STATUS_META[item.status]
                    return (
                      <tr key={item.id} className={checked ? styles.rowSelected : ''}>
                        <td className={styles.checkCol}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRow(item.id)}
                            aria-label={`Select ${item.title}`}
                          />
                        </td>
                        <td className={styles.articleCol}>
                          <div className={styles.articleFlex}>
                            <div className={styles.thumbFrame}>
                              <Image
                                src={item.thumbnailUrl || '/brand/logo-96.webp'}
                                alt={item.title}
                                width={56}
                                height={42}
                                unoptimized
                                className={styles.thumbImg}
                              />
                            </div>
                            <div className={styles.articleMetaText}>
                              <Link href={item.editHref} className={styles.articleTitleLink}>
                                {item.title}
                              </Link>
                              <div className={styles.articleSubRow}>
                                <span className={styles.slugMono}>/{item.slug}</span>
                                {item.isBreaking && (
                                  <span className={styles.breakingChip}>BREAKING</span>
                                )}
                                {item.isFeatured && (
                                  <span className={styles.featuredChip}>FEATURED</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles.categoryChip}>{item.category}</span>
                        </td>
                        <td className={styles.authorCol}>{item.author}</td>
                        <td className={styles.dateCol}>{formatHindiDate(item.publishedAt)}</td>
                        <td className={styles.viewsCol}>{item.viewsFormatted}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[st.badgeClass]}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className={styles.rightAlign}>
                          <div className={styles.actionBtnGroup}>
                            <Link
                              href={item.editHref}
                              className={styles.actionBtn}
                              title="Edit"
                            >
                              <Pencil size={14} />
                              <span>Edit</span>
                            </Link>
                            <Link
                              href={item.previewHref}
                              target="_blank"
                              className={styles.actionIconBtn}
                              title="Preview"
                              aria-label="Preview"
                            >
                              <Eye size={15} />
                            </Link>
                            {item.status !== 'published' ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateArticleStatus(item, 'published')}
                                className={`${styles.actionIconBtn} ${styles.publishQuickBtn}`}
                                title="Publish"
                                aria-label="Publish"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateArticleStatus(item, 'draft')}
                                className={styles.actionIconBtn}
                                title="Unpublish to Draft"
                                aria-label="Unpublish"
                              >
                                <FileEdit size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => deleteSingleArticle(item)}
                              className={`${styles.actionIconBtn} ${styles.deleteQuickBtn}`}
                              title="Delete"
                              aria-label="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (Section 6: Responsive tables converted into mobile-friendly article cards) */}
            <div className={styles.mobileCardList}>
              {paginated.map((item) => {
                const st = STATUS_META[item.status]
                return (
                  <article key={item.id} className={styles.mobileArticleCard}>
                    <div className={styles.mobileCardTop}>
                      <Image
                        src={item.thumbnailUrl || '/brand/logo-96.webp'}
                        alt={item.title}
                        width={60}
                        height={46}
                        unoptimized
                        className={styles.mobileThumb}
                      />
                      <div className={styles.mobileHeadInfo}>
                        <Link href={item.editHref} className={styles.mobileTitle}>
                          {item.title}
                        </Link>
                        <div className={styles.mobileMetaRow}>
                          <span className={styles.categoryChip}>{item.category}</span>
                          <span className={`${styles.statusBadge} ${styles[st.badgeClass]}`}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.mobileCardBottom}>
                      <span>
                        {item.author} · {formatHindiDate(item.publishedAt)} · {item.viewsFormatted}{' '}
                        views
                      </span>
                      <div className={styles.actionBtnGroup}>
                        <Link href={item.editHref} className={styles.actionBtn}>
                          <Pencil size={13} /> Edit
                        </Link>
                        <Link
                          href={item.previewHref}
                          target="_blank"
                          className={styles.actionIconBtn}
                        >
                          <Eye size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteSingleArticle(item)}
                          className={`${styles.actionIconBtn} ${styles.deleteQuickBtn}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        <div className={styles.paginationFooter}>
          <span className={styles.pageCountLabel}>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} articles
          </span>
          <div className={styles.pageNumbers}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={styles.pageNumBtn}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`${styles.pageNumBtn} ${
                  n === currentPage ? styles.pageNumBtnActive : ''
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={styles.pageNumBtn}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

