'use client'

/**
 * Admin Notifications: Overview (real totals + recent activity), Create (form, live phone preview, confirmation
 * with the number of devices that will receive it) and History (filters, per-notification numbers).
 * Wording follows api-contract §8: "accepted" by Expo and "handed to Android/iOS", never "delivered".
 */
import { Bell, CheckCircle2, Clock, Hand, Send, Smartphone, TriangleAlert, Truck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'

import { formatDateTime } from '@/components/format'
import extra from '@/components/reporter/reporter.module.css'
import type { FormArticle, NotificationRow, NotificationStats } from '@/lib/admin/notifications'
import { cancelNotification, createNotification, estimateAudience } from '@/lib/admin/notificationActions'
import { BODY_MAX, TITLE_MAX } from '@/lib/push/manual'

import styles from './articlesAdmin.module.css'
import dash from './dashboard.module.css'
import n from './notifications.module.css'

type Tab = 'overview' | 'create' | 'history'

interface Props {
  tab: Tab
  stats: NotificationStats
  recent: NotificationRow[]
  history: { rows: NotificationRow[]; page: number; totalPages: number; totalDocs: number }
  filters: { from: string; to: string; category: number | null; status: string }
  categories: { id: number; name: string }[]
  articles: FormArticle[]
}

const TYPE_LABEL: Record<NotificationRow['type'], string> = { article: 'Article', breaking: 'Breaking news', general: 'General update' }
const AUDIENCE_LABEL: Record<NotificationRow['audience'], string> = {
  all: 'All opted-in readers',
  breaking: 'Breaking news subscribers',
  category: 'Category subscribers',
}
const STATUS_CLASS: Record<string, string> = {
  sent: styles.badgePublished,
  sending: styles.badgePending,
  queued: styles.badgePending,
  scheduled: styles.badgeScheduled,
  failed: styles.badgeRejected,
  cancelled: styles.badgeDraft,
}
const fmt = (v: number) => v.toLocaleString('en-IN')

function StatusBadge({ status }: { status: string }) {
  return <span className={`${styles.statusBadge} ${STATUS_CLASS[status] ?? styles.badgeDraft}`}>{status}</span>
}

function StatCard({ label, value, icon, tint, note }: { label: string; value: number; icon: React.ReactNode; tint: string; note: string }) {
  return (
    <div className={dash.statCard}>
      <div className={dash.statTop}>
        <span className={dash.statIconWrap} style={{ background: tint }}>
          {icon}
        </span>
        <div className={dash.statHeadlineGroup}>
          <span className={dash.statLabel}>{label}</span>
          <span className={dash.statNumber}>{fmt(value)}</span>
        </div>
      </div>
      <span className={n.statNote}>{note}</span>
    </div>
  )
}

function HistoryTable({ rows, onCancel }: { rows: NotificationRow[]; onCancel?: (row: NotificationRow) => void }) {
  if (!rows.length) {
    return (
      <div className={styles.emptyBox}>
        <h3>No notifications yet</h3>
        <p>Notifications you send, and the ones sent when articles are published, appear here.</p>
      </div>
    )
  }
  return (
    <div className={styles.tableWrap} style={{ display: 'block', overflowX: 'auto' }}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Notification</th>
            <th scope="col">Type / audience</th>
            <th scope="col">Sent</th>
            <th scope="col" className={n.metric} title="Devices that matched the audience and their settings">Targeted</th>
            <th scope="col" className={n.metric} title="Expo accepted the message (push ticket ok)">Accepted</th>
            <th scope="col" className={n.metric} title="Expo's receipt: handed to Google/Apple. Not proof the phone showed it.">Handed over</th>
            <th scope="col" className={n.metric}>Failed</th>
            <th scope="col" className={n.metric} title="Taps reported by the app, once per device">Opened</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={styles.articleCol} style={{ minWidth: 260 }}>
                <div className={styles.articleMetaText}>
                  <strong>{r.title}</strong>
                  <span className={n.subtle}>{r.body}</span>
                  {r.articleTitle ? <span className={n.subtle}>Opens: {r.articleTitle}</span> : null}
                  {r.error ? <span className={n.subtle} style={{ color: '#b42318' }}>{r.error}</span> : null}
                </div>
              </td>
              <td>
                <div className={styles.articleMetaText}>
                  <span>{TYPE_LABEL[r.type]}</span>
                  <span className={n.subtle}>
                    {AUDIENCE_LABEL[r.audience]}
                    {r.categoryName ? ` · ${r.categoryName}` : ''}
                    {r.source === 'publish' ? ' · on publish' : ''}
                  </span>
                </div>
              </td>
              <td className={styles.dateCol}>
                {r.sentAt ? formatDateTime(r.sentAt) : r.scheduledAt ? `Scheduled ${formatDateTime(r.scheduledAt)}` : formatDateTime(r.createdAt)}
              </td>
              <td className={n.metric}>{fmt(r.targeted)}</td>
              <td className={n.metric}>{fmt(r.accepted)}</td>
              <td className={n.metric}>{fmt(r.handedOver)}</td>
              <td className={n.metric}>{fmt(r.failed + r.receiptFailed)}</td>
              <td className={n.metric}>{fmt(r.opened)}</td>
              <td>
                <StatusBadge status={r.status} />
                {onCancel && (r.status === 'scheduled' || r.status === 'queued') ? (
                  <button type="button" className={styles.actionBtn} style={{ marginLeft: 6 }} onClick={() => onCancel(r)}>
                    Cancel
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Android-style preview of the notification as readers will see it. */
function PhonePreview({ title, body, imageUrl }: { title: string; body: string; imageUrl: string }) {
  return (
    <div className={n.phone} aria-label="Notification preview">
      <div className={n.phoneScreen}>
        <div className={n.phoneClock}>10:24</div>
        <div className={n.notif}>
          <div className={n.notifHead}>
            <span className={n.notifAppIcon}>
              <Bell size={11} />
            </span>
            LokLens News · now
          </div>
          <div className={n.notifTitle}>{title || 'Notification title'}</div>
          <div className={n.notifBody}>{body || 'Your message appears here.'}</div>
          {/^https:\/\//.test(imageUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of an external image URL
            <img className={n.notifImage} src={imageUrl} alt="" />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function CreateForm({ categories, articles, onDone }: { categories: Props['categories']; articles: FormArticle[]; onDone: (text: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [key, setKey] = useState(newKey)
  const [articleId, setArticleId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [type, setType] = useState<'general' | 'article' | 'breaking'>('general')
  const [audience, setAudience] = useState<'all' | 'breaking' | 'category'>('all')
  const [categoryId, setCategoryId] = useState('')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [scheduledLocal, setScheduledLocal] = useState('')
  const [estimate, setEstimate] = useState<number | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [pending, start] = useTransition()

  const pickArticle = (id: string) => {
    setArticleId(id)
    const a = articles.find((x) => String(x.id) === id)
    if (!a) {
      if (type === 'article') setType('general')
      return
    }
    setTitle(a.title.slice(0, TITLE_MAX))
    setBody(a.summary.slice(0, BODY_MAX))
    setImageUrl(a.imageUrl ?? '')
    if (type === 'general') setType('article')
    if (a.categoryId) setCategoryId(String(a.categoryId))
  }

  const input = () => ({
    title,
    body,
    imageUrl,
    type,
    audience,
    categoryId: audience === 'category' || type === 'article' ? categoryId : '',
    articleId,
    // datetime-local is the admin's local time; the server stores UTC.
    scheduledAt: when === 'later' && scheduledLocal ? new Date(scheduledLocal).toISOString() : '',
    idempotencyKey: key,
  })

  const review = () =>
    start(async () => {
      setErrors([])
      setEstimate(null)
      const res = await estimateAudience({ type, audience, categoryId: categoryId ? Number(categoryId) : null })
      if (!res.ok) {
        setErrors([res.error])
        return
      }
      setEstimate(res.count)
      dialog.current?.showModal()
    })

  const send = () =>
    start(async () => {
      const res = await createNotification(input())
      if (!res.ok) {
        setErrors(res.errors)
        dialog.current?.close()
        return
      }
      dialog.current?.close()
      setKey(newKey())
      setTitle('')
      setBody('')
      setImageUrl('')
      setArticleId('')
      setType('general')
      setAudience('all')
      setWhen('now')
      setScheduledLocal('')
      onDone(res.scheduled ? 'Notification scheduled.' : 'Notification is being sent. Numbers update in History as Expo answers.')
    })

  const categoryName = categories.find((c) => String(c.id) === categoryId)?.name
  return (
    <div className={n.createGrid}>
      <section className={styles.cardSurface} style={{ padding: 18 }}>
        {errors.length > 0 && (
          <div className={`${extra.alert} ${extra.alertDanger}`} role="alert">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        <div className={styles.fieldBlock}>
          <label htmlFor="nf-article" className={styles.fieldLabel}>
            Article (optional)
          </label>
          <select id="nf-article" className={styles.filterSelect} value={articleId} onChange={(e) => pickArticle(e.target.value)}>
            <option value="">No article: opens the app</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <span className={styles.fieldHint}>Choosing an article fills in the text and image, and a tap opens that article.</span>
        </div>
        <div className={styles.fieldBlock}>
          <label htmlFor="nf-title" className={styles.fieldLabel}>
            Title
          </label>
          <input id="nf-title" className={styles.textInput} value={title} maxLength={TITLE_MAX + 20} onChange={(e) => setTitle(e.target.value)} />
          <span className={`${n.counter} ${title.length > TITLE_MAX ? n.counterOver : ''}`}>
            {title.length}/{TITLE_MAX}
          </span>
        </div>
        <div className={styles.fieldBlock}>
          <label htmlFor="nf-body" className={styles.fieldLabel}>
            Message
          </label>
          <textarea id="nf-body" className={styles.textareaInput} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <span className={`${n.counter} ${body.length > BODY_MAX ? n.counterOver : ''}`}>
            {body.length}/{BODY_MAX}
          </span>
        </div>
        <div className={styles.fieldBlock}>
          <label htmlFor="nf-image" className={styles.fieldLabel}>
            Image URL (optional, https)
          </label>
          <input id="nf-image" className={styles.textInput} value={imageUrl} placeholder="https://…" onChange={(e) => setImageUrl(e.target.value)} />
        </div>
        <div className={styles.twoColFields}>
          <div className={styles.fieldBlock}>
            <label htmlFor="nf-type" className={styles.fieldLabel}>
              Type
            </label>
            <select id="nf-type" className={styles.filterSelect} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="general">General update</option>
              <option value="breaking">Breaking news</option>
              <option value="article" disabled={!articleId}>
                Article (choose an article first)
              </option>
            </select>
          </div>
          <div className={styles.fieldBlock}>
            <label htmlFor="nf-audience" className={styles.fieldLabel}>
              Send to
            </label>
            <select id="nf-audience" className={styles.filterSelect} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
              <option value="all">All opted-in readers</option>
              <option value="breaking">Breaking news subscribers</option>
              <option value="category">Subscribers of one category</option>
            </select>
          </div>
        </div>
        {(audience === 'category' || type === 'article') && (
          <div className={styles.fieldBlock}>
            <label htmlFor="nf-category" className={styles.fieldLabel}>
              Category
            </label>
            <select id="nf-category" className={styles.filterSelect} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className={styles.fieldHint}>Readers who switched this category off in the app are skipped.</span>
          </div>
        )}
        <div className={styles.twoColFields}>
          <div className={styles.fieldBlock}>
            <label htmlFor="nf-when" className={styles.fieldLabel}>
              When
            </label>
            <select id="nf-when" className={styles.filterSelect} value={when} onChange={(e) => setWhen(e.target.value as typeof when)}>
              <option value="now">Send now</option>
              <option value="later">Schedule</option>
            </select>
          </div>
          {when === 'later' && (
            <div className={styles.fieldBlock}>
              <label htmlFor="nf-at" className={styles.fieldLabel}>
                Date and time (your local time)
              </label>
              <input id="nf-at" type="datetime-local" className={styles.textInput} value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className={styles.primaryLimeBtn} onClick={review} disabled={pending || !title.trim() || !body.trim()}>
            <Send size={15} /> {pending ? 'Checking…' : 'Review and send'}
          </button>
        </div>

        <dialog ref={dialog} className={extra.dialog} aria-labelledby="nf-confirm-title">
          <h2 id="nf-confirm-title">{when === 'later' ? 'Schedule this notification?' : 'Send this notification now?'}</h2>
          <dl className={n.summaryList}>
            <dt>Title</dt>
            <dd>{title}</dd>
            <dt>Type</dt>
            <dd>{TYPE_LABEL[type]}</dd>
            <dt>Send to</dt>
            <dd>
              {AUDIENCE_LABEL[audience]}
              {categoryName && (audience === 'category' || type === 'article') ? ` · ${categoryName}` : ''}
            </dd>
            <dt>Devices</dt>
            <dd>{estimate === null ? '…' : `${fmt(estimate)} right now`}</dd>
            {when === 'later' && scheduledLocal ? (
              <>
                <dt>At</dt>
                <dd>{formatDateTime(new Date(scheduledLocal).toISOString())}</dd>
              </>
            ) : null}
          </dl>
          {estimate === 0 ? <p>No device matches this audience yet, so nobody would get it.</p> : <p>This cannot be undone once sending starts.</p>}
          <div className={extra.dialogActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => dialog.current?.close()} disabled={pending}>
              Back
            </button>
            <button type="button" className={styles.primaryLimeBtn} onClick={send} disabled={pending || estimate === 0}>
              {pending ? 'Working…' : when === 'later' ? 'Schedule' : 'Send now'}
            </button>
          </div>
        </dialog>
      </section>
      <PhonePreview title={title} body={body} imageUrl={imageUrl} />
    </div>
  )
}

export function NotificationsClient({ tab, stats, recent, history, filters, categories, articles }: Props) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pending, start] = useTransition()

  const tabs = useMemo(
    () => [
      { key: 'overview' as const, label: 'Overview', href: '/admin/notifications' },
      { key: 'create' as const, label: 'Create notification', href: '/admin/notifications?tab=create' },
      { key: 'history' as const, label: 'History', href: '/admin/notifications?tab=history', count: history.totalDocs },
    ],
    [history.totalDocs],
  )

  const onCancel = (row: NotificationRow) =>
    start(async () => {
      const res = await cancelNotification(row.id)
      setMsg(res.ok ? { text: `Cancelled “${row.title}”.`, ok: true } : { text: res.error, ok: false })
      if (res.ok) router.refresh()
    })

  const historyHref = (page: number) => {
    const p = new URLSearchParams({ tab: 'history' })
    if (filters.from) p.set('from', filters.from)
    if (filters.to) p.set('to', filters.to)
    if (filters.category) p.set('category', String(filters.category))
    if (filters.status) p.set('status', filters.status)
    if (page > 1) p.set('page', String(page))
    return `/admin/notifications?${p.toString()}`
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.titleIcon}>
            <Bell size={20} />
          </span>
          <div>
            <h1 className={styles.pageTitle}>Notifications</h1>
            <p className={styles.pageSubtitle}>Push notifications to the LokLens News app.</p>
          </div>
        </div>
      </header>

      <div className={styles.statusTabsRow} role="tablist">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} role="tab" aria-selected={tab === t.key} className={`${styles.statusTabPill} ${tab === t.key ? styles.statusTabPillActive : ''}`}>
            {t.label}
            {'count' in t && t.count ? <span className={styles.tabCount}>{t.count}</span> : null}
          </Link>
        ))}
      </div>

      {msg && (
        <div className={`${extra.alert} ${msg.ok ? extra.alertSuccess : extra.alertDanger}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </div>
      )}

      {tab === 'overview' && (
        <>
          <div className={n.statsGrid}>
            <StatCard label="Notifications sent" value={stats.notificationsSent} icon={<Send size={20} color="#1d4ed8" />} tint="#dbeafe" note="Finished sending" />
            <StatCard label="Active devices" value={stats.activeDevices} icon={<Smartphone size={20} color="#047857" />} tint="#d1fae5" note="Signed-in phones that can receive pushes" />
            <StatCard label="Accepted by Expo" value={stats.accepted} icon={<CheckCircle2 size={20} color="#4338ca" />} tint="#e0e7ff" note={`Out of ${fmt(stats.targeted)} targeted messages`} />
            <StatCard label="Handed to Android/iOS" value={stats.handedOver} icon={<Truck size={20} color="#0e7490" />} tint="#cffafe" note={`${fmt(stats.awaitingReceipt)} still waiting for Expo's receipt`} />
            <StatCard label="Failed" value={stats.failed} icon={<TriangleAlert size={20} color="#b42318" />} tint="#fee4e2" note="Rejected tickets and receipts" />
            <StatCard label="Opened" value={stats.opened} icon={<Hand size={20} color="#b45309" />} tint="#fef3c7" note="Taps reported by the app" />
          </div>
          <p className={n.subtle} style={{ marginBottom: 12 }}>
            <Clock size={12} style={{ verticalAlign: '-2px' }} /> Neither Expo nor Google/Apple confirm that a phone displayed a notification, so
            nothing here is counted as &ldquo;delivered&rdquo;.
          </p>
          <section className={styles.cardSurface}>
            <HistoryTable rows={recent} />
          </section>
        </>
      )}

      {tab === 'create' && (
        <CreateForm
          categories={categories}
          articles={articles}
          onDone={(text) => {
            setMsg({ text, ok: true })
            router.push('/admin/notifications?tab=history')
            router.refresh()
          }}
        />
      )}

      {tab === 'history' && (
        <section className={styles.cardSurface}>
          <form className={styles.filterToolbar} action="/admin/notifications" method="get" style={{ flexWrap: 'wrap', gap: 10 }}>
            <input type="hidden" name="tab" value="history" />
            <label className={n.subtle}>
              From <input type="date" name="from" defaultValue={filters.from} className={styles.dateInput} />
            </label>
            <label className={n.subtle}>
              To <input type="date" name="to" defaultValue={filters.to} className={styles.dateInput} />
            </label>
            <select name="category" defaultValue={filters.category ?? ''} className={styles.filterSelect} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={filters.status} className={styles.filterSelect} aria-label="Status">
              <option value="">Any status</option>
              {['sent', 'sending', 'queued', 'scheduled', 'failed', 'cancelled'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className={styles.secondaryBtn}>
              Filter
            </button>
            <Link href="/admin/notifications?tab=history" className={styles.secondaryBtn}>
              Clear
            </Link>
          </form>
          <HistoryTable rows={history.rows} onCancel={pending ? undefined : onCancel} />
          {history.totalPages > 1 && (
            <div className={styles.paginationFooter}>
              <span className={styles.pageCountLabel}>
                Page {history.page} of {history.totalPages} · {fmt(history.totalDocs)} notifications
              </span>
              <div className={styles.pageNumbers}>
                {history.page > 1 ? (
                  <Link className={styles.pageNumBtn} href={historyHref(history.page - 1)}>
                    Previous
                  </Link>
                ) : null}
                {history.page < history.totalPages ? (
                  <Link className={styles.pageNumBtn} href={historyHref(history.page + 1)}>
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
