import { CheckCircle2, Clock3, FilePenLine, FilePlus2, LayoutGrid, Newspaper } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import dashStyles from '@/components/admin/dashboard.module.css'
import { ArticlesTable } from '@/components/reporter/ArticlesTable'
import styles from '@/components/reporter/reporter.module.css'
import { listMyArticles, myStats } from '@/lib/reporter/queries'
import { requireReporter } from '@/lib/reporter/session'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function ReporterDashboardPage() {
  const session = await requireReporter()
  const [stats, recent] = await Promise.all([myStats(session), listMyArticles(session, { sort: 'latest', page: 1 })])
  const name = session.user.displayName || session.user.name

  const cards = [
    { label: 'Total Articles', value: stats.total, href: '/reporter/articles', icon: <Newspaper size={20} />, bg: '#FDECE4', fg: '#C2410C' },
    { label: 'Published Articles', value: stats.published, href: '/reporter/articles?status=published', icon: <CheckCircle2 size={20} />, bg: '#ECF8C5', fg: '#3F6212' },
    { label: 'Pending Approval', value: stats.pending_review, href: '/reporter/articles?status=pending_review', icon: <Clock3 size={20} />, bg: '#EDE9FE', fg: '#6D28D9' },
    { label: 'Draft Articles', value: stats.draft, href: '/reporter/articles?status=draft', icon: <FilePenLine size={20} />, bg: '#E0F2FE', fg: '#0369A1' },
  ]

  return (
    <div className={adminStyles.pageShell}>
      <header className={adminStyles.pageHeader}>
        <div className={adminStyles.titleGroup}>
          <span className={adminStyles.titleIcon}>
            <LayoutGrid size={20} />
          </span>
          <div>
            <h1 className={adminStyles.pageTitle}>नमस्ते, {name}</h1>
            <p className={adminStyles.pageSubtitle}>Your stories at a glance.</p>
          </div>
        </div>
        <div className={adminStyles.headerActions}>
          <Link href="/reporter/articles/new" className={adminStyles.primaryLimeBtn}>
            <FilePlus2 size={16} /> Create Article
          </Link>
        </div>
      </header>

      {stats.rejected > 0 && (
        <div className={`${styles.alert} ${styles.alertDanger}`} role="status">
          <div>
            <strong>
              {stats.rejected === 1 ? '1 article was' : `${stats.rejected} articles were`} sent back by the editor.
            </strong>
            Open it to read the reason, make the changes and submit again.{' '}
            <Link href="/reporter/articles?status=rejected">View rejected articles</Link>
          </div>
        </div>
      )}

      <section className={styles.stats} aria-label="Article statistics">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={dashStyles.statCard}>
            <div className={dashStyles.statTop}>
              <span className={dashStyles.statIconWrap} style={{ background: c.bg, color: c.fg }}>
                {c.icon}
              </span>
              <div className={dashStyles.statHeadlineGroup}>
                <span className={dashStyles.statLabel}>{c.label}</span>
                <span className={dashStyles.statNumber}>{c.value}</span>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className={adminStyles.cardSurface} aria-labelledby="recent-title">
        <div className={styles.sectionHead}>
          <h2 id="recent-title" className={styles.sectionTitle}>
            Recent Articles
          </h2>
          <Link href="/reporter/articles" className={styles.linkMuted}>
            View all →
          </Link>
        </div>
        {recent.rows.length > 0 ? (
          <ArticlesTable rows={recent.rows.slice(0, 6)} />
        ) : (
          <div className={adminStyles.emptyBox}>
            <h3>No articles yet</h3>
            <p>Write your first story — it stays a draft until you submit it for review.</p>
            <div className={adminStyles.emptyActions}>
              <Link href="/reporter/articles/new" className={adminStyles.primaryLimeBtn}>
                <FilePlus2 size={16} /> Create Article
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
