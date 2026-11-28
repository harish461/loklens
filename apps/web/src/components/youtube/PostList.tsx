import Link from 'next/link'

import type { PostRow } from '@/lib/youtube/studioQueries'

import { formatIst, PRIVACY_LABEL, STATUS_LABEL, STATUS_TONE } from './labels'
import s from './studio.module.css'

/** Post rows; the title links to the editor or the review panel. */
export function PostList({ rows, linkTo, empty }: { rows: PostRow[]; linkTo: 'edit' | 'review'; empty: string }) {
  if (rows.length === 0) return <p className={s.empty}>{empty}</p>
  return (
    <ul className={s.list}>
      {rows.map((r) => (
        <li key={r.id} className={s.row}>
          <div className={s.rowMain}>
            <Link className={s.rowTitle} href={`/admin/youtube?tab=${linkTo}&id=${r.id}`}>
              {r.title}
            </Link>
            <div className={s.meta}>
              {r.postType === 'short' ? 'Short' : 'Video'} · {PRIVACY_LABEL[r.privacyStatus] ?? r.privacyStatus}
              {r.footageTitle ? ` · ${r.footageTitle}` : ''} · {formatIst(r.updatedAt)}
              {r.publishAt ? ` · scheduled ${formatIst(r.publishAt)}` : ''}
            </div>
            {r.status === 'draft' && r.reviewNote && <div className={s.meta}>Returned: {r.reviewNote}</div>}
            {r.status === 'failed' && r.lastError && <div className={s.meta}>Error: {r.lastError}</div>}
          </div>
          <div className={s.actions} style={{ alignItems: 'center' }}>
            {r.youtubeUrl && (
              <a href={r.youtubeUrl} target="_blank" rel="noopener noreferrer">
                YouTube
              </a>
            )}
            <span className={`${s.badge} ${s[STATUS_TONE[r.status]]}`}>{STATUS_LABEL[r.status]}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
