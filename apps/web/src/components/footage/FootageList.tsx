'use client'

/** List of footage with status badges and a delete button for unused footage. */
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { discardFootageAction } from '@/lib/footage/actions'
import type { FootageRow } from '@/lib/footage/queries'

import styles from './footage.module.css'

const STATUS: Record<string, { label: string; className: string }> = {
  uploading: { label: 'Upload incomplete', className: styles.badgeWarn },
  uploaded: { label: 'Ready', className: styles.badgeOk },
  failed: { label: 'Failed', className: styles.badgeBad },
}

const ORIENTATION: Record<string, string> = { landscape: 'Landscape', vertical: 'Vertical', square: 'Square' }

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function FootageList({ rows, showUploader = false }: { rows: FootageRow[]; showUploader?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function remove(id: number) {
    if (!window.confirm('This footage will be deleted permanently. Continue?')) return
    setBusy(id)
    setError('')
    const r = await discardFootageAction(id)
    setBusy(null)
    if (!r.ok) setError(r.error)
    router.refresh()
  }

  if (rows.length === 0) return <p className={styles.empty}>No footage yet.</p>
  return (
    <>
      {error && <p className={styles.error}>{error}</p>}
      <ul className={styles.list}>
        {rows.map((r) => {
          const s = STATUS[r.uploadStatus] ?? { label: r.uploadStatus, className: '' }
          const meta = [
            when(r.createdAt),
            r.sizeMB !== null ? `${r.sizeMB} MB` : null,
            r.durationSeconds ? `${Math.round(r.durationSeconds)} s` : null,
            r.orientation ? ORIENTATION[r.orientation] : null,
            showUploader && r.uploader ? r.uploader : null,
          ].filter(Boolean)
          return (
            <li key={r.id} className={styles.item}>
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt="" className={styles.thumbSmall} />
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.itemTitle}>{r.title}</div>
                <div className={styles.itemMeta}>{meta.join(' · ')}</div>
                {r.hashtags.length > 0 && <div className={styles.itemMeta}>{r.hashtags.join(' ')}</div>}
              </div>
              <div className={styles.actions}>
                <span className={`${styles.badge} ${s.className}`}>{r.locked ? 'Used in a post' : s.label}</span>
                {!r.locked && (
                  <button type="button" className={styles.linkButton} onClick={() => void remove(r.id)} disabled={busy === r.id}>
                    {busy === r.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
