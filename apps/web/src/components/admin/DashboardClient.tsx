'use client'

import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Calendar as CalendarIcon,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileEdit,
  Flame,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type {
  DynamicScheduledItem,
  DynamicTaskItem,
  LatestArticle,
  StatCard,
} from './dashboard-data'
import styles from './dashboard.module.css'
import {
  type AdminArticleItem,
  type AdminNotificationItem,
  type ArticleWorkflowStatus,
} from './mock-cms-data'

export interface DashboardClientProps {
  userName: string
  userInitials: string
  userRole: string
  initialArticles: AdminArticleItem[]
  dbSummary: {
    totalArticles: number
    publishedArticles: number
    draftArticles: number
    breakingArticles: number
    categories: { id: number; name: string; slug: string }[]
    authors: { id: number; name: string; role: string; email?: string }[]
  }
  stats?: StatCard[]
  chart?: {
    days: string[]
    values: number[]
    breakingDays: string[]
    summary: {
      totalPublished: number
      peakDay: number
      activeDays: number
      breakingStories: number
    }
  }
  donut?: { name: string; count: number; percentage: number }[]
  donutTotal?: number
  latest?: LatestArticle[]
  activity?: { id: number; title: string; updatedAt: string; editHref: string }[]
  scheduledItems?: DynamicScheduledItem[]
  pendingTasks?: DynamicTaskItem[]
  period?: number
}

const STATUS_META: Record<
  ArticleWorkflowStatus,
  { label: string; className: string }
> = {
  published: { label: 'Published', className: 'statusPublished' },
  draft: { label: 'Draft', className: 'statusDraft' },
  pending_review: { label: 'Pending Review', className: 'statusPending' },
  scheduled: { label: 'Scheduled', className: 'statusScheduled' },
  rejected: { label: 'Rejected', className: 'statusRejected' },
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function DashboardClient({
  userName,
  userInitials,
  initialArticles,
  dbSummary,
  stats,
  chart,
  donut = [],
  scheduledItems = [],
  pendingTasks = [],
}: DashboardClientProps) {
  // Global search state
  const [globalQuery, setGlobalQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)

  // Dynamic Notifications derived strictly from real DB state
  const initialNotificationsList = useMemo(() => {
    const list: AdminNotificationItem[] = []
    if (dbSummary.draftArticles > 0) {
      list.push({
        id: 'notif-drafts',
        title: 'Draft Articles Awaiting Review',
        detail: `${dbSummary.draftArticles} articles are currently in draft status.`,
        timeAgo: 'Pending',
        type: 'review',
        unread: true,
        href: '/admin/collections/articles?where[_status][equals]=draft',
      })
    }
    if (dbSummary.breakingArticles > 0) {
      list.push({
        id: 'notif-breaking',
        title: 'Active Breaking News',
        detail: `${dbSummary.breakingArticles} breaking alerts live on website ticker.`,
        timeAgo: 'Active',
        type: 'breaking',
        unread: true,
        href: '/admin/breaking-news',
      })
    }
    if (scheduledItems.length > 0) {
      list.push({
        id: 'notif-scheduled',
        title: 'Upcoming Scheduled Stories',
        detail: `${scheduledItems.length} articles queued for timed publication.`,
        timeAgo: 'Scheduled',
        type: 'schedule',
        unread: false,
        href: '/admin/scheduled-news',
      })
    }
    if (initialArticles.length > 0) {
      const topArt = initialArticles[0]
      list.push({
        id: `notif-art-${topArt.id}`,
        title: `Latest: ${topArt.title.slice(0, 32)}...`,
        detail: `Published in ${topArt.category} by ${topArt.author}.`,
        timeAgo: formatShortDate(topArt.publishedAt),
        type: 'breaking',
        unread: false,
        href: topArt.editHref,
      })
    }
    return list
  }, [dbSummary, scheduledItems, initialArticles])

  const [notifications, setNotifications] = useState<AdminNotificationItem[]>(initialNotificationsList)

  // Chart filter states (timeframe: 7, 14, 30 days)
  const [publishTimeframe, setPublishTimeframe] = useState<'7d' | '14d' | '30d'>('14d')
  const [categoryMetric, setCategoryMetric] = useState<'articles' | 'percentage'>('articles')

  // Recent Articles table states (only genuine database articles)
  const [articles, setArticles] = useState<AdminArticleItem[]>(initialArticles)
  const [articleSearch, setArticleSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ArticleWorkflowStatus>('all')
  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null)
  const [actionToast, setActionToast] = useState<string | null>(null)

  // Editorial Calendar states (current month / year)
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())

  const unreadCount = notifications.filter((n) => n.unread).length

  function showToast(msg: string) {
    setActionToast(msg)
    setTimeout(() => setActionToast(null), 3200)
  }

  // Merge Global search + Article table search
  const effectiveSearch = (articleSearch || globalQuery).trim().toLowerCase()

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of dbSummary.categories) set.add(c.name)
    for (const a of articles) if (a.category) set.add(a.category)
    return Array.from(set)
  }, [dbSummary.categories, articles])

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (effectiveSearch) {
        const hay = `${a.title} ${a.author} ${a.category} ${a.slug}`.toLowerCase()
        if (!hay.includes(effectiveSearch)) return false
      }
      return true
    })
  }, [articles, categoryFilter, statusFilter, effectiveSearch])

  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  // Article row actions (calls real Payload API for DB rows, updates local state immediately)
  async function handleStatusChange(item: AdminArticleItem, nextStatus: ArticleWorkflowStatus) {
    setOpenMenuId(null)
    if (item.dbId) {
      const payloadStatus = nextStatus === 'published' ? 'published' : 'draft'
      try {
        const res = await fetch(`/api/articles/${item.dbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ _status: payloadStatus }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch {
        showToast('Could not update database status. Check permissions.')
        return
      }
    }
    setArticles((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a)),
    )
    showToast(`Status updated to ${STATUS_META[nextStatus].label}`)
  }

  async function handleToggleBreaking(item: AdminArticleItem) {
    setOpenMenuId(null)
    const nextBreaking = !item.isBreaking
    if (item.dbId) {
      const res = await fetch(`/api/articles/${item.dbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isBreaking: nextBreaking }),
      }).catch(() => null)
      if (!res?.ok) {
        showToast('Could not update Breaking News. Check permissions or connection.')
        return
      }
    }
    setArticles((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, isBreaking: nextBreaking } : a)),
    )
    showToast(nextBreaking ? 'Marked as Breaking News' : 'Removed from Breaking News')
  }

  async function handleDeleteArticle(item: AdminArticleItem) {
    setOpenMenuId(null)
    if (!window.confirm(`Delete "${item.title}"?`)) return
    if (item.dbId) {
      try {
        const res = await fetch(`/api/articles/${item.dbId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch {
        showToast('Could not delete from database.')
        return
      }
    }
    setArticles((prev) => prev.filter((a) => a.id !== item.id))
    showToast('Article deleted')
  }

  // Dynamic Chart 1: Publishing Activity Series from real Payload data
  const chartPoints = useMemo(() => {
    if (!chart?.days || chart.days.length === 0) return []
    const daysToShow = publishTimeframe === '7d' ? 7 : publishTimeframe === '14d' ? 14 : 30
    const sliceDays = chart.days.slice(-daysToShow)
    const sliceVals = chart.values.slice(-daysToShow)
    return sliceDays.map((dayStr, i) => {
      const d = new Date(dayStr)
      const label = !Number.isNaN(d.getTime())
        ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        : dayStr
      return {
        label,
        articles: sliceVals[i] ?? 0,
        isBreaking: chart.breakingDays.includes(dayStr),
      }
    })
  }, [chart, publishTimeframe])

  const chartKPIs = useMemo(() => {
    const total = chartPoints.reduce((acc, p) => acc + p.articles, 0)
    const peak = chartPoints.length ? Math.max(...chartPoints.map((p) => p.articles)) : 0
    const active = chartPoints.filter((p) => p.articles > 0).length
    const breaking = chartPoints.filter((p) => p.isBreaking).length
    return { total, peak, active, breaking }
  }, [chartPoints])

  // Dynamic Chart 2: Category Distribution from real Payload data
  const categoryData = useMemo(() => {
    if (donut && donut.length > 0) {
      return donut.map((item, idx) => ({
        category: item.name,
        articles: item.count,
        percentage: item.percentage,
        highlight: idx === 0,
        pastelBg: ['#ECF8C5', '#FDECE4', '#EBE8FD', '#E3F2FD', '#E6F7EF', '#FEF5D9'][idx % 6],
      }))
    }
    return []
  }, [donut])

  // Calendar dates with active published or scheduled stories
  const activeArticleDates = useMemo(() => {
    const set = new Set<string>()
    for (const a of articles) {
      if (a.publishedAt) {
        const key = a.publishedAt.slice(0, 10)
        if (key) set.add(key)
      }
    }
    for (const s of scheduledItems) {
      if (s.scheduledDate) set.add(s.scheduledDate)
    }
    return set
  }, [articles, scheduledItems])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate()
    const cells: { day: number; inMonth: boolean; dateKey: string }[] = []

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      cells.push({ day: d, inMonth: false, dateKey: '' })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(calMonth + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      cells.push({ day: d, inMonth: true, dateKey: `${calYear}-${mm}-${dd}` })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: cells.length - (firstDay + daysInMonth) + 1, inMonth: false, dateKey: '' })
    }
    return cells
  }, [calYear, calMonth])

  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11)
      setCalYear((y) => y - 1)
    } else {
      setCalMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0)
      setCalYear((y) => y + 1)
    } else {
      setCalMonth((m) => m + 1)
    }
  }

  return (
    <div className={styles.dashboardShell}>
      {actionToast && (
        <div className={styles.toast} role="status">
          <Sparkles size={15} />
          <span>{actionToast}</span>
        </div>
      )}

      {/* B. MAIN DASHBOARD CONTENT */}
      <div className={styles.mainColumn}>
        {/* Header Section */}
        <header className={styles.topHeader}>
          <div className={styles.greetingBlock}>
            <h1 className={styles.greetingTitle}>Welcome back, {userName || 'Admin'} 👋</h1>
            <p className={styles.greetingSub}>
              Live editorial overview of LokLens Hindi newsroom.
            </p>
          </div>

          <div className={styles.headerToolbar}>
            <div className={styles.globalSearchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="search"
                value={globalQuery}
                onChange={(e) => {
                  setGlobalQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Search Hindi news, authors, categories..."
                className={styles.globalSearchInput}
                aria-label="Global search"
              />
            </div>

            <Link
              href="/admin/collections/articles/create"
              className={styles.createArticleCta}
            >
              <Plus size={16} />
              <span>+ Create Article</span>
            </Link>

            <div className={styles.notifWrapper}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className={styles.notifBadge}>{unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className={styles.notifPopover} role="dialog" aria-label="Notifications">
                  <div className={styles.notifHeader}>
                    <strong>Notifications ({notifications.length})</strong>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        className={styles.markReadBtn}
                        onClick={() =>
                          setNotifications((prev) =>
                            prev.map((n) => ({ ...n, unread: false })),
                          )
                        }
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Bell size={20} />
                      <p>No notifications at this time.</p>
                    </div>
                  ) : (
                    <ul className={styles.notifList}>
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className={`${styles.notifItem} ${n.unread ? styles.notifUnread : ''}`}
                        >
                          <Link
                            href={n.href}
                            className={styles.notifLink}
                            onClick={() => setNotifOpen(false)}
                          >
                            <div className={styles.notifTitleRow}>
                              <span className={styles.notifItemTitle}>{n.title}</span>
                              <span className={styles.notifTime}>{n.timeAgo}</span>
                            </div>
                            <p className={styles.notifDetail}>{n.detail}</p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/admin/account"
              className={styles.avatarPill}
              title={`Profile (${userName})`}
            >
              <span>{userInitials}</span>
            </Link>
          </div>
        </header>

        {/* Section 3: Dedicated Quick Action Area */}
        <section className={styles.quickActionStrip} aria-label="Quick Actions">
          <Link
            href="/admin/collections/articles/create"
            className={styles.quickActionPill}
          >
            <span className={styles.qaIcon} style={{ background: '#ECF8C5', color: '#3F6212' }}>
              <Pencil size={16} />
            </span>
            <span className={styles.qaText}>
              <strong>Create New Article</strong>
              <small>Write Hindi story</small>
            </span>
            <ArrowUpRight size={15} className={styles.qaArrow} />
          </Link>

          <Link
            href="/admin/collections/media/create"
            className={styles.quickActionPill}
          >
            <span className={styles.qaIcon} style={{ background: '#E3F2FD', color: '#0369A1' }}>
              <Upload size={16} />
            </span>
            <span className={styles.qaText}>
              <strong>Upload Media</strong>
              <small>Photos &amp; WebP sizes</small>
            </span>
            <ArrowUpRight size={15} className={styles.qaArrow} />
          </Link>

          <Link href="/admin/breaking-news" className={styles.quickActionPill}>
            <span className={styles.qaIcon} style={{ background: '#FDECE4', color: '#C2410C' }}>
              <Flame size={16} />
            </span>
            <span className={styles.qaText}>
              <strong>Breaking News</strong>
              <small>Push live ticker alert</small>
            </span>
            <ArrowUpRight size={15} className={styles.qaArrow} />
          </Link>

          <Link href="/admin/scheduled-news" className={styles.quickActionPill}>
            <span className={styles.qaIcon} style={{ background: '#EBE8FD', color: '#5B21B6' }}>
              <CalendarClock size={16} />
            </span>
            <span className={styles.qaText}>
              <strong>Scheduled News</strong>
              <small>Queue timed release</small>
            </span>
            <ArrowUpRight size={15} className={styles.qaArrow} />
          </Link>
        </section>

        {/* C. Dynamic Statistics Cards (4 real database metric cards) */}
        <section className={styles.statsGrid} aria-label="Key Statistics">
          <Link href="/admin/collections/articles" className={styles.statCard}>
            <div className={styles.statTop}>
              <span
                className={styles.statIconWrap}
                style={{ background: '#FDECE4', color: '#C2410C' }}
              >
                <Newspaper size={20} />
              </span>
              <div className={styles.statHeadlineGroup}>
                <span className={styles.statLabel}>Total Articles</span>
                <span className={styles.statNumber}>{dbSummary.totalArticles}</span>
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statTrendUp}>
                <TrendingUp size={13} />{' '}
                {stats?.[0]?.delta !== undefined && stats[0].delta !== 0
                  ? `${stats[0].delta > 0 ? `+${stats[0].delta}` : stats[0].delta} in last 30d`
                  : 'Total across beats'}
              </span>
              <span className={styles.statSubTag}>
                {dbSummary.totalArticles === 1 ? '1 story in DB' : `${dbSummary.totalArticles} stories in DB`}
              </span>
            </div>
          </Link>

          <Link
            href="/admin/collections/articles?where[_status][equals]=published"
            className={styles.statCard}
          >
            <div className={styles.statTop}>
              <span
                className={styles.statIconWrap}
                style={{ background: '#ECF8C5', color: '#3F6212' }}
              >
                <CheckCircle2 size={20} />
              </span>
              <div className={styles.statHeadlineGroup}>
                <span className={styles.statLabel}>Published Articles</span>
                <span className={styles.statNumber}>{dbSummary.publishedArticles}</span>
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statTrendUp}>
                <TrendingUp size={13} />{' '}
                {dbSummary.totalArticles > 0
                  ? `${Math.round((dbSummary.publishedArticles / dbSummary.totalArticles) * 100)}% published`
                  : 'Live on site'}
              </span>
              <span className={styles.statSubTag}>Live on site</span>
            </div>
          </Link>

          <Link
            href="/admin/collections/articles?where[_status][equals]=draft"
            className={styles.statCard}
          >
            <div className={styles.statTop}>
              <span
                className={styles.statIconWrap}
                style={{ background: '#EBE8FD', color: '#5B21B6' }}
              >
                <FileEdit size={20} />
              </span>
              <div className={styles.statHeadlineGroup}>
                <span className={styles.statLabel}>Draft Articles</span>
                <span className={styles.statNumber}>{dbSummary.draftArticles}</span>
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statTrendNeutral}>
                <Clock size={13} />{' '}
                {dbSummary.draftArticles > 0 ? `${dbSummary.draftArticles} awaiting review` : 'No pending drafts'}
              </span>
              <span className={styles.statSubTag}>Editorial desk</span>
            </div>
          </Link>

          <Link href="/admin/breaking-news" className={styles.statCard}>
            <div className={styles.statTop}>
              <span
                className={styles.statIconWrap}
                style={{ background: '#FEF5D9', color: '#B45309' }}
              >
                <Flame size={20} />
              </span>
              <div className={styles.statHeadlineGroup}>
                <span className={styles.statLabel}>Breaking Stories</span>
                <span className={styles.statNumber}>{dbSummary.breakingArticles}</span>
              </div>
            </div>
            <div className={styles.statFooter}>
              <span className={styles.statTrendUp}>
                <Sparkles size={13} />{' '}
                {dbSummary.breakingArticles > 0 ? 'Live on ticker' : 'No active alerts'}
              </span>
              <span className={styles.statSubTag}>High priority</span>
            </div>
          </Link>
        </section>

        {/* D. Dynamic Analytics Section (Real publishing velocity + Category distribution) */}
        <section className={styles.analyticsRow} aria-label="Publishing Analytics Overview">
          {/* Card 1: Article Publishing Activity */}
          <div className={styles.surfaceCard}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Publishing Activity</h2>
                <p className={styles.cardDeltaRow}>
                  <span className={styles.deltaBadge}>
                    {chartKPIs.total} {chartKPIs.total === 1 ? 'story' : 'stories'} published in window
                  </span>
                </p>
              </div>
              <div className={styles.segmentedTabs} role="tablist" aria-label="Timeframe">
                {(['7d', '14d', '30d'] as const).map((periodKey) => (
                  <button
                    key={periodKey}
                    type="button"
                    role="tab"
                    aria-selected={publishTimeframe === periodKey}
                    className={`${styles.segTab} ${
                      publishTimeframe === periodKey ? styles.segTabActive : ''
                    }`}
                    onClick={() => setPublishTimeframe(periodKey)}
                  >
                    {periodKey === '7d' ? '7 Days' : periodKey === '14d' ? '14 Days' : '30 Days'}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.trafficKpiGrid}>
              <div className={styles.kpiMini}>
                <span className={styles.kpiMiniLabel}>Published Stories</span>
                <strong className={styles.kpiMiniValue}>{chartKPIs.total}</strong>
              </div>
              <div className={styles.kpiMini}>
                <span className={styles.kpiMiniLabel}>Peak Day Volume</span>
                <strong className={styles.kpiMiniValue}>
                  {chartKPIs.peak} {chartKPIs.peak === 1 ? 'story' : 'stories'}
                </strong>
              </div>
              <div className={styles.kpiMini}>
                <span className={styles.kpiMiniLabel}>Active Publishing Days</span>
                <strong className={styles.kpiMiniValue}>{chartKPIs.active} days</strong>
              </div>
              <div className={styles.kpiMini}>
                <span className={styles.kpiMiniLabel}>Breaking Coverage</span>
                <strong className={styles.kpiMiniValueAccent}>{chartKPIs.breaking} alerts</strong>
              </div>
            </div>

            <div className={styles.chartBox}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chartPoints}
                  margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="loklensPublishFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D5F46A" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#D5F46A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F6" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#7B7F92', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    tick={{ fill: '#7B7F92', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1C1B29',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
                    }}
                    formatter={(val) => [`${val} stories`, 'Published']}
                    itemStyle={{ color: '#D5F46A', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="articles"
                    name="Stories"
                    stroke="#1C1B29"
                    strokeWidth={2.5}
                    fill="url(#loklensPublishFill)"
                    activeDot={{ r: 6, fill: '#D5F46A', stroke: '#1C1B29', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Category Distribution */}
          <div className={styles.surfaceCard}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Category Distribution</h2>
                <p className={styles.cardSubtext}>Live article breakdown across editorial beats</p>
              </div>
              <div className={styles.segmentedTabs}>
                <button
                  type="button"
                  className={`${styles.segTab} ${
                    categoryMetric === 'articles' ? styles.segTabActive : ''
                  }`}
                  onClick={() => setCategoryMetric('articles')}
                >
                  Articles
                </button>
                <button
                  type="button"
                  className={`${styles.segTab} ${
                    categoryMetric === 'percentage' ? styles.segTabActive : ''
                  }`}
                  onClick={() => setCategoryMetric('percentage')}
                >
                  Share %
                </button>
              </div>
            </div>

            {categoryData.length === 0 ? (
              <div className={styles.emptyState}>
                <Layers size={24} />
                <p>No category distribution data available.</p>
              </div>
            ) : (
              <>
                <div className={styles.chartBox}>
                  <ResponsiveContainer width="100%" height={185}>
                    <BarChart
                      data={categoryData}
                      margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
                      barSize={18}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F6" />
                      <XAxis
                        dataKey="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#525668', fontSize: 11, fontWeight: 500 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        tick={{ fill: '#7B7F92', fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(213, 244, 106, 0.14)' }}
                        contentStyle={{
                          background: '#1C1B29',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#FFFFFF',
                          fontSize: '12px',
                        }}
                        formatter={(val) => [
                          categoryMetric === 'articles' ? `${val} stories` : `${val}%`,
                          categoryMetric === 'articles' ? 'Articles' : 'Share',
                        ]}
                      />
                      <Bar
                        dataKey={categoryMetric}
                        name={categoryMetric === 'articles' ? 'Published Articles' : 'Share %'}
                        radius={[9, 9, 9, 9]}
                      >
                        {categoryData.map((entry) => (
                          <Cell
                            key={entry.category}
                            fill={entry.highlight ? '#D5F46A' : '#1C1B29'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <ul className={styles.categoryPillList}>
                  {categoryData.map((cat) => (
                    <li key={cat.category} className={styles.categoryPillItem}>
                      <span
                        className={styles.categoryDot}
                        style={{ background: cat.pastelBg }}
                      />
                      <span className={styles.categoryPillName}>{cat.category}</span>
                      <strong className={styles.categoryPillVal}>
                        {categoryMetric === 'articles'
                          ? `${cat.articles} ${cat.articles === 1 ? 'story' : 'stories'}`
                          : `${cat.percentage}%`}
                      </strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {/* E. Recent News Articles (Real Database Articles Only) */}
        <section className={styles.surfaceCard} aria-labelledby="recent-articles-heading">
          <div className={styles.recentHeader}>
            <div>
              <h2 id="recent-articles-heading" className={styles.cardTitle}>
                Recent Articles ({filteredArticles.length})
              </h2>
              <p className={styles.cardSubtext}>
                Manage Hindi stories, workflow status and editorial publishing
              </p>
            </div>
            <Link href="/admin/collections/articles" className={styles.viewAllLink}>
              <span>View All in CMS</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {/* Search & Filters Bar */}
          <div className={styles.tableFilterRow}>
            <div className={styles.inlineSearch}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="search"
                value={articleSearch}
                onChange={(e) => {
                  setArticleSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search headline or author..."
                className={styles.inlineSearchInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value)
                  setPage(1)
                }}
                className={styles.selectControl}
                aria-label="Filter by category"
              >
                <option value="all">All Categories ({dbSummary.categories.length})</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | ArticleWorkflowStatus)
                  setPage(1)
                }}
                className={styles.selectControl}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="scheduled">Scheduled</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Articles Table & Pagination */}
          {paginatedArticles.length === 0 ? (
            <div className={styles.emptyState}>
              <AlertCircle size={24} />
              <p>No articles match the selected search or filter criteria.</p>
              <button
                type="button"
                className={styles.resetFilterBtn}
                onClick={() => {
                  setArticleSearch('')
                  setGlobalQuery('')
                  setCategoryFilter('all')
                  setStatusFilter('all')
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.articlesTable}>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Category</th>
                    <th>Author</th>
                    <th>Published Date</th>
                    <th>Status</th>
                    <th className={styles.actionColHead}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedArticles.map((art) => {
                    const st = STATUS_META[art.status] || STATUS_META.published
                    const menuOpen = openMenuId === art.id
                    return (
                      <tr key={art.id}>
                        <td className={styles.articleMainCell}>
                          <div className={styles.articleCellFlex}>
                            <div className={styles.thumbBox}>
                              <Image
                                src={art.thumbnailUrl || '/brand/logo-96.webp'}
                                alt={art.title}
                                width={48}
                                height={36}
                                unoptimized
                                className={styles.thumbImg}
                              />
                            </div>
                            <div className={styles.headlineWrap}>
                              <Link href={art.editHref} className={styles.headlineLink}>
                                {art.title}
                              </Link>
                              <div className={styles.headlineBadges}>
                                {art.isBreaking && (
                                  <span className={styles.breakingMicro}>BREAKING</span>
                                )}
                                {art.subcategory && (
                                  <span className={styles.subcatMicro}>{art.subcategory}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles.catBadge}>{art.category}</span>
                        </td>
                        <td className={styles.authorCell}>{art.author}</td>
                        <td className={styles.dateCell}>{formatShortDate(art.publishedAt)}</td>
                        <td>
                          <span className={`${styles.statusPill} ${styles[st.className]}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className={styles.actionCell}>
                          <div className={styles.rowActions}>
                            <Link
                              href={art.editHref}
                              className={styles.rowIconBtn}
                              title="Edit article"
                            >
                              <Pencil size={15} />
                            </Link>
                            <button
                              type="button"
                              className={styles.rowIconBtn}
                              onClick={() =>
                                setOpenMenuId(menuOpen ? null : art.id)
                              }
                              aria-label="More actions"
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {menuOpen && (
                              <div className={styles.actionDropdown}>
                                <Link
                                  href={art.editHref}
                                  className={styles.dropdownItem}
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  <Pencil size={14} /> Edit Article
                                </Link>
                                <Link
                                  href={art.previewHref}
                                  target="_blank"
                                  className={styles.dropdownItem}
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  <Eye size={14} /> Preview
                                </Link>
                                {art.status !== 'published' ? (
                                  <button
                                    type="button"
                                    className={styles.dropdownItem}
                                    onClick={() => handleStatusChange(art, 'published')}
                                  >
                                    <CheckCircle2 size={14} /> Publish Now
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className={styles.dropdownItem}
                                    onClick={() => handleStatusChange(art, 'draft')}
                                  >
                                    <FileEdit size={14} /> Move to Draft
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={styles.dropdownItem}
                                  onClick={() => handleToggleBreaking(art)}
                                >
                                  <Flame size={14} />{' '}
                                  {art.isBreaking ? 'Clear Breaking' : 'Mark Breaking'}
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.dropdownItem} ${styles.dropdownDanger}`}
                                  onClick={() => handleDeleteArticle(art)}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          <div className={styles.paginationBar}>
            <span className={styles.paginationMeta}>
              Showing {filteredArticles.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, filteredArticles.length)} of{' '}
              {filteredArticles.length} articles
            </span>
            <div className={styles.paginationBtns}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  className={`${styles.pageBtn} ${
                    pNum === currentPage ? styles.pageBtnActive : ''
                  }`}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </button>
              ))}
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* F. RIGHT INFORMATION PANEL (100% Dynamic Editorial Widgets) */}
      <aside className={styles.rightPanel} aria-label="Editorial widgets and schedule">
        {/* Widget 1: Platform Card */}
        <div className={styles.promoWidget}>
          <div className={styles.promoTopRow}>
            <div className={styles.promoBrand}>
              <Image
                src="/brand/logo-96.webp"
                width={26}
                height={26}
                alt="LokLens"
                unoptimized
                className={styles.promoLogo}
              />
              <span>LokLens</span>
            </div>
            <span className={styles.liveTag}>LIVE CMS</span>
          </div>

          <h3 className={styles.promoHeading}>LokLens Newsroom</h3>
          <p className={styles.promoDesc}>
            Publish Uttarakhand &amp; national Hindi journalism with instant CDN revalidation.
          </p>

          <div className={styles.promoActions}>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.promoLimeBtn}
            >
              <span>Visit Website</span>
              <ExternalLink size={14} />
            </Link>
            <Link href="/admin/breaking-news" className={styles.promoGhostBtn}>
              Breaking Desk
            </Link>
          </div>
        </div>

        {/* Widget 2: Editorial Calendar */}
        <div className={styles.rightCard}>
          <div className={styles.calHeader}>
            <button
              type="button"
              onClick={prevMonth}
              className={styles.calNavBtn}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <h3 className={styles.calTitle}>
              {MONTH_NAMES[calMonth]}, {calYear}
            </h3>
            <button
              type="button"
              onClick={nextMonth}
              className={styles.calNavBtn}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className={styles.calWeekdays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
              <span key={idx}>{d}</span>
            ))}
          </div>

          <div className={styles.calGrid}>
            {calendarDays.map((cell, idx) => {
              const isToday =
                calYear === today.getFullYear() &&
                calMonth === today.getMonth() &&
                cell.inMonth &&
                cell.day === today.getDate()
              const isSelected = cell.inMonth && cell.day === selectedDay
              const hasActivity = cell.dateKey && activeArticleDates.has(cell.dateKey)
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!cell.inMonth}
                  onClick={() => cell.inMonth && setSelectedDay(cell.day)}
                  className={`${styles.calDay} ${!cell.inMonth ? styles.calDayMuted : ''} ${
                    isToday ? styles.calDayToday : ''
                  } ${isSelected && !isToday ? styles.calDaySelected : ''} ${
                    hasActivity ? styles.calDayScheduled : ''
                  }`}
                >
                  <span>{cell.day}</span>
                  {hasActivity && <i className={styles.calDot} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Widget 3: Publishing Schedule (Dynamic from real database scheduled articles) */}
        <div className={styles.rightCard}>
          <div className={styles.widgetHeader}>
            <h3 className={styles.widgetTitle}>Publishing Schedule</h3>
            <Link
              href="/admin/collections/articles/create"
              className={styles.limePlusBtn}
              title="Schedule new article"
              aria-label="Schedule new article"
            >
              <Plus size={16} />
            </Link>
          </div>

          {scheduledItems.length === 0 ? (
            <div className={styles.emptyWidget}>
              <CalendarClock size={26} className={styles.emptyWidgetIcon} />
              <p className={styles.emptyWidgetTitle}>No Scheduled Articles</p>
              <span className={styles.emptyWidgetSub}>
                Stories queued with a future publish date will appear here.
              </span>
              <Link href="/admin/collections/articles/create" className={styles.emptyWidgetAction}>
                + Schedule Story
              </Link>
            </div>
          ) : (
            <ul className={styles.scheduleList}>
              {scheduledItems.map((item) => (
                <li key={item.id} className={styles.scheduleCard}>
                  <span
                    className={styles.scheduleIcon}
                    style={{ background: '#EBE8FD', color: '#5B21B6' }}
                  >
                    <CalendarIcon size={16} />
                  </span>
                  <div className={styles.scheduleBody}>
                    <Link href={item.editHref} className={styles.scheduleHeadline}>
                      {item.title}
                    </Link>
                    <span className={styles.scheduleMeta}>{item.scheduledTime}</span>
                  </div>
                  <span className={`${styles.scheduleTag} ${styles.schedReady}`}>
                    Scheduled
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Widget 4: Pending Tasks (Dynamic from real database status) */}
        <div className={styles.rightCard}>
          <div className={styles.widgetHeader}>
            <h3 className={styles.widgetTitle}>Pending Tasks</h3>
            <span className={styles.widgetCountPill}>
              {pendingTasks.reduce((acc, t) => acc + t.count, 0)} total
            </span>
          </div>

          {pendingTasks.length === 0 ? (
            <div className={styles.emptyWidget}>
              <CheckCircle2 size={26} className={styles.emptyWidgetIconGreen} />
              <p className={styles.emptyWidgetTitle}>All Tasks Completed</p>
              <span className={styles.emptyWidgetSub}>
                No drafts or alerts requiring immediate action.
              </span>
            </div>
          ) : (
            <ul className={styles.taskList}>
              {pendingTasks.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className={styles.taskRow}>
                    <span
                      className={styles.taskIconBox}
                      style={{
                        background:
                          t.priority === 'high'
                            ? '#FDECE4'
                            : t.priority === 'medium'
                              ? '#FEF5D9'
                              : '#EBE8FD',
                      }}
                    >
                      {t.iconName === 'file-check' && <FileCheck2 size={16} />}
                      {t.iconName === 'message-square' && <MessageSquare size={16} />}
                      {t.iconName === 'search-alert' && <AlertCircle size={16} />}
                      {t.iconName === 'image' && <ImageIcon size={16} />}
                    </span>
                    <div className={styles.taskText}>
                      <strong>{t.title}</strong>
                      <span>{t.subtitle}</span>
                    </div>
                    <span className={styles.taskBadge}>{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Widget 5: Quick Overview (100% Dynamic Numbers from DB) */}
        <div className={styles.rightCard}>
          <div className={styles.widgetHeader}>
            <h3 className={styles.widgetTitle}>Quick Overview</h3>
          </div>

          <div className={styles.overviewList}>
            <Link href="/admin/breaking-news" className={styles.overviewItem}>
              <div className={styles.overviewLeft}>
                <span className={styles.pulseDotRed} />
                <span>Breaking News Status</span>
              </div>
              <strong className={styles.overviewVal}>
                {dbSummary.breakingArticles} Live
              </strong>
            </Link>

            <Link href="/admin/collections/categories" className={styles.overviewItem}>
              <div className={styles.overviewLeft}>
                <Layers size={14} className={styles.overviewIcon} />
                <span>Active Categories</span>
              </div>
              <strong className={styles.overviewVal}>
                {dbSummary.categories.length} Sections
              </strong>
            </Link>

            <Link href="/admin/collections/users" className={styles.overviewItem}>
              <div className={styles.overviewLeft}>
                <Users size={14} className={styles.overviewIcon} />
                <span>Editorial Team</span>
              </div>
              <strong className={styles.overviewVal}>
                {dbSummary.authors.length} Editors
              </strong>
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
