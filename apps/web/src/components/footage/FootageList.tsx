'use client'

/** List of footage with status badges and a delete button for unused footage. */
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { discardFootageAction } from '@/lib/footage/actions'
import type { FootageRow } from '@/lib/footage/queries'

import styles from './footage.module.css'

const STATUS: Record<string, { label: string; className: string }> = {
  uploading: { label: 'अपलोड अधूरा', className: styles.badgeWarn },
  uploaded: { label: 'तैयार', className: styles.badgeOk },
  failed: { label: 'विफल', className: styles.badgeBad },
}

const ORIENTATION: Record<string, string> = { landscape: 'आड़ा', vertical: 'खड़ा', square: 'चौकोर' }

function when(iso: string): string {
  return new Date(iso).toLocaleString('hi-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function FootageList({ rows, showUploader = false }: { rows: FootageRow[]; showUploader?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function remove(id: number) {
    if (!window.confirm('यह फ़ुटेज हमेशा के लिए हटा दिया जाएगा। जारी रखें?')) return
    setBusy(id)
    setError('')
    const r = await discardFootageAction(id)
    setBusy(null)
    if (!r.ok) setError(r.error)
    router.refresh()
  }

  if (rows.length === 0) return <p className={styles.empty}>अभी कोई फ़ुटेज नहीं है।</p>
  return (
    <>
      {error && <p className={styles.error}>{error}</p>}
      <ul className={styles.list}>
        {rows.map((r) => {
          const s = STATUS[r.uploadStatus] ?? { label: r.uploadStatus, className: '' }
          const meta = [
            when(r.createdAt),
            r.sizeMB !== null ? `${r.sizeMB} MB` : null,
            r.durationSeconds ? `${Math.round(r.durationSeconds)} सेकंड` : null,
            r.orientation ? ORIENTATION[r.orientation] : null,
            showUploader && r.uploader ? r.uploader : null,
          ].filter(Boolean)
          return (
            <li key={r.id} className={styles.item}>
              <div>
                <div className={styles.itemTitle}>{r.title}</div>
                <div className={styles.itemMeta}>{meta.join(' · ')}</div>
              </div>
              <div className={styles.actions}>
                <span className={`${styles.badge} ${s.className}`}>{r.locked ? 'पोस्ट में इस्तेमाल' : s.label}</span>
                {!r.locked && (
                  <button type="button" className={styles.linkButton} onClick={() => void remove(r.id)} disabled={busy === r.id}>
                    {busy === r.id ? 'हटा रहे हैं…' : 'हटाएं'}
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
