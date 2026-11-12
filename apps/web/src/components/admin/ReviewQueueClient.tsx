'use client'

import { CheckCircle2, ClipboardCheck, Eye, ImageOff, Pencil, Star, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { formatDateTime } from '@/components/format'
import extra from '@/components/reporter/reporter.module.css'
import { StatusBadge } from '@/components/reporter/StatusBadge'
import { approveArticle, rejectArticle } from '@/lib/admin/actions'
import type { ReviewItem } from '@/lib/admin/queries'

import styles from './articlesAdmin.module.css'

function Thumb({ item }: { item: ReviewItem }) {
  return item.thumbUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- CMS thumbnail
    <img src={item.thumbUrl} alt="" className={styles.thumbImg} />
  ) : (
    <span className={styles.thumbImg} style={{ display: 'grid', placeItems: 'center', color: '#a2a0b8' }} aria-hidden="true">
      <ImageOff size={16} />
    </span>
  )
}

function ReviewRow({ item, onDone }: { item: ReviewItem; onDone: (text: string, ok: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState('')
  const [feature, setFeature] = useState(item.featureRequested)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const approve = () =>
    start(async () => {
      const res = await approveArticle(item.id, { markFeatured: feature })
      onDone(res.ok ? `Published “${item.title}”.` : res.error, res.ok)
    })

  const reject = () =>
    start(async () => {
      setError(null)
      const res = await rejectArticle(item.id, note)
      if (!res.ok) {
        setError(res.error)
        return
      }
      dialog.current?.close()
      onDone(`Sent “${item.title}” back to ${item.reporterName}.`, true)
    })

  return (
    <tr>
      <td className={styles.articleCol}>
        <div className={styles.articleFlex}>
          <span className={styles.thumbFrame}>
            <Thumb item={item} />
          </span>
          <div className={styles.articleMetaText}>
            <a href={`/preview/${item.id}`} target="_blank" rel="noopener" className={styles.articleTitleLink}>
              {item.title}
            </a>
            <div className={styles.articleSubRow}>
              {item.categoryName && <span className={styles.categoryChip}>{item.categoryName}</span>}
              {item.featureRequested && (
                <span className={styles.featuredChip} title="The reporter suggests this as featured">
                  <Star size={11} /> Feature request
                </span>
              )}
              {!item.hasImage && <span className={styles.breakingChip}>No featured image</span>}
            </div>
          </div>
        </div>
      </td>
      <td className={styles.authorCol}>{item.reporterName}</td>
      <td className={styles.dateCol}>{item.submittedAt ? formatDateTime(item.submittedAt) : '—'}</td>
      <td className={styles.rightAlign}>
        <div className={styles.actionBtnGroup}>
          <a href={`/preview/${item.id}`} target="_blank" rel="noopener" className={styles.actionIconBtn} title="Preview" aria-label={`Preview “${item.title}”`}>
            <Eye size={15} />
          </a>
          <Link href={`/admin/collections/articles/${item.id}`} className={styles.actionIconBtn} title="Edit" aria-label={`Edit “${item.title}”`}>
            <Pencil size={15} />
          </Link>
          {item.featureRequested && (
            <label className={styles.actionBtn} title="Also mark as featured when publishing">
              <input type="checkbox" checked={feature} onChange={(e) => setFeature(e.target.checked)} /> Feature
            </label>
          )}
          <button type="button" className={styles.actionBtn} onClick={() => dialog.current?.showModal()} disabled={pending}>
            <XCircle size={14} /> Reject
          </button>
          <button type="button" className={styles.primaryLimeBtn} onClick={approve} disabled={pending}>
            <CheckCircle2 size={14} /> {pending ? 'Working…' : 'Approve & publish'}
          </button>
        </div>
        <dialog ref={dialog} className={extra.dialog} aria-labelledby={`rej-${item.id}`} style={{ textAlign: 'left' }}>
          <h2 id={`rej-${item.id}`}>Send back to the reporter</h2>
          <p>{item.reporterName} will see this reason and can edit and resubmit “{item.title}”.</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={1000}
            className={styles.textareaInput}
            placeholder="क्या बदलना है — जैसे: स्रोत जोड़ें, शीर्षक छोटा करें…"
            style={{ width: '100%', marginBottom: 12 }}
            autoFocus
          />
          {error && (
            <div className={`${extra.alert} ${extra.alertDanger}`} role="alert">
              {error}
            </div>
          )}
          <div className={extra.dialogActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => dialog.current?.close()} disabled={pending}>
              Cancel
            </button>
            <button type="button" className={extra.dangerBtn} onClick={reject} disabled={pending || !note.trim()}>
              <XCircle size={15} /> {pending ? 'Sending…' : 'Reject with feedback'}
            </button>
          </div>
        </dialog>
      </td>
    </tr>
  )
}

export function ReviewQueueClient({ pending, rejected }: { pending: ReviewItem[]; rejected: ReviewItem[] }) {
  const router = useRouter()
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const onDone = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    if (ok) router.refresh()
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.titleIcon}>
            <ClipboardCheck size={20} />
          </span>
          <div>
            <h1 className={styles.pageTitle}>Review Queue</h1>
            <p className={styles.pageSubtitle}>
              {pending.length === 0 ? 'Nothing waiting.' : `${pending.length} reporter submission${pending.length === 1 ? '' : 's'} waiting, oldest first.`}
            </p>
          </div>
        </div>
      </header>

      {msg && (
        <div className={`${extra.alert} ${msg.ok ? extra.alertSuccess : extra.alertDanger}`} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </div>
      )}

      <section className={styles.cardSurface} style={{ marginBottom: 18 }}>
        {pending.length ? (
          <div className={styles.tableWrap} style={{ display: 'block', overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Article</th>
                  <th scope="col">Reporter</th>
                  <th scope="col">Submitted</th>
                  <th scope="col" className={styles.rightAlign}>
                    Decision
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending.map((item) => (
                  <ReviewRow key={item.id} item={item} onDone={onDone} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyBox}>
            <h3>All caught up</h3>
            <p>When a reporter submits an article, it appears here for approval.</p>
          </div>
        )}
      </section>

      {rejected.length > 0 && (
        <section className={styles.cardSurface}>
          <div className={extra.sectionHead}>
            <h2 className={extra.sectionTitle}>Sent back to reporters</h2>
          </div>
          <div className={styles.tableWrap} style={{ display: 'block', overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Article</th>
                  <th scope="col">Reporter</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Returned</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rejected.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.articleCol}>
                      <a href={`/preview/${item.id}`} target="_blank" rel="noopener" className={styles.articleTitleLink}>
                        {item.title}
                      </a>
                    </td>
                    <td className={styles.authorCol}>{item.reporterName}</td>
                    <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{item.reviewNote}</td>
                    <td className={styles.dateCol}>{item.reviewedAt ? formatDateTime(item.reviewedAt) : '—'}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
