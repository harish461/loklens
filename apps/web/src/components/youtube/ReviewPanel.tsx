'use client'

/**
 * Admin review (/admin/youtube?tab=review&id=): watch the footage, read what will go to YouTube, tick the
 * checklist, then approve (or retry a failed upload) or send it back with a note. Editors see it read-only.
 * The server checks the role and the checklist again (lib/youtube/postService.ts).
 */
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { REVIEW_CHECKLIST, type ReviewChecklist } from '@/lib/youtube/postInput'
import { youtubePostAction } from '@/lib/youtube/studioActions'
import type { PostDetail } from '@/lib/youtube/studioQueries'

import { CHECKLIST_LABEL, formatIst, ORIENTATION_LABEL, PRIVACY_LABEL, STATUS_LABEL, STATUS_TONE } from './labels'
import { EventList } from './PostEditor'
import s from './studio.module.css'

export function ReviewPanel({ post, isAdmin }: { post: PostDetail; isAdmin: boolean }) {
  const router = useRouter()
  const [checks, setChecks] = useState<ReviewChecklist>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [pending, start] = useTransition()
  const f = post.form
  const canDecide = isAdmin && (post.status === 'pending_review' || post.status === 'failed')
  const allChecked = REVIEW_CHECKLIST.every((k) => checks[k] === true)
  const hashtags = f.hashtags.split(/\s+/).filter(Boolean)

  function decide(action: 'approve' | 'retry' | 'reject') {
    setError('')
    if (action === 'reject' && !note.trim()) return setError('लौटाने का कारण लिखें।')
    start(async () => {
      const r = await youtubePostAction(post.id, action, { note, checklist: action === 'reject' ? undefined : checks })
      if (!r.ok) return setError(r.error)
      setDone(action === 'reject' ? 'पोस्ट संपादक को लौटा दी गई।' : 'मंज़ूर। यह यूट्यूब अपलोड की कतार में है।')
      router.refresh()
    })
  }

  return (
    <div className={s.grid}>
      <div className={s.form}>
        <div className={s.actions} style={{ alignItems: 'center' }}>
          <span className={`${s.badge} ${s[STATUS_TONE[post.status]]}`}>{STATUS_LABEL[post.status]}</span>
          <span className={s.meta}>
            {f.postType === 'short' ? 'शॉर्ट' : 'वीडियो'} · {PRIVACY_LABEL[f.privacyStatus]}
            {f.publishAtIst ? ` · शेड्यूल ${formatIst(new Date(`${f.publishAtIst}:00+05:30`).toISOString())}` : ''}
          </span>
        </div>
        {post.footage ? (
          <>
            <video className={s.player} controls preload="metadata" src={`/api/youtube/footage/${post.footage.id}`} />
            <div className={s.meta}>
              फ़ुटेज: {post.footage.title}
              {post.footage.orientation ? ` · ${ORIENTATION_LABEL[post.footage.orientation]}` : ''}
              {post.footage.durationSeconds ? ` · ${Math.round(post.footage.durationSeconds)} सेकंड` : ''}
              {post.footage.uploader ? ` · ${post.footage.uploader}` : ''}
              {post.footage.rightsConfirmed ? ' · अधिकार की पुष्टि: हां' : ' · अधिकार की पुष्टि: नहीं'}
            </div>
            {post.footage.notes && <div className={s.note}>रिपोर्टर का ब्योरा: {post.footage.notes}</div>}
          </>
        ) : (
          <div className={s.error}>कोई फ़ुटेज नहीं चुना गया।</div>
        )}
        {post.lastError && <div className={s.error}>पिछली त्रुटि: {post.lastError}</div>}

        {canDecide ? (
          <div className={s.form}>
            <p className={s.sectionTitle}>जांच-सूची</p>
            {REVIEW_CHECKLIST.map((k) => (
              <label key={k} className={s.check}>
                <input type="checkbox" checked={checks[k] === true} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} />
                <span>{CHECKLIST_LABEL[k]}</span>
              </label>
            ))}
            <label className={s.field}>
              <span className={s.label}>टिप्पणी (लौटाने पर ज़रूरी)</span>
              <textarea className={s.textarea} style={{ minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            </label>
            {error && <p className={s.error}>{error}</p>}
            {done && <p className={s.success}>{done}</p>}
            <div className={s.actions}>
              <button type="button" className={s.buttonLime} onClick={() => decide(post.status === 'failed' ? 'retry' : 'approve')} disabled={pending || !allChecked}>
                {post.status === 'failed' ? 'फिर से अपलोड करें' : 'मंज़ूर करें'}
              </button>
              {post.status === 'pending_review' && (
                <button type="button" className={s.buttonSecondary} onClick={() => decide('reject')} disabled={pending}>
                  सुधार के लिए लौटाएं
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={s.note}>{isAdmin ? 'इस पोस्ट पर अभी कोई फ़ैसला बाकी नहीं है।' : 'केवल एडमिन मंज़ूरी दे सकते हैं।'}</div>
        )}
      </div>

      <aside className={s.preview} aria-label="यूट्यूब पर क्या जाएगा">
        <p className={s.sectionTitle}>यूट्यूब पर क्या जाएगा</p>
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={s.thumbPreview} src={post.thumbnailUrl} alt="" />
        ) : (
          <div className={s.meta}>थंबनेल नहीं चुना गया (यूट्यूब अपना चुनेगा)।</div>
        )}
        {hashtags.length > 0 && <div className={s.meta}>{hashtags.slice(0, 3).join(' ')}</div>}
        <div className={s.previewTitle}>{f.title}</div>
        <div className={s.previewDesc}>{f.description}</div>
        {f.tags && <div className={s.meta}>टैग: {f.tags}</div>}
        <div className={s.meta}>
          सब्सक्राइबर सूचना: {f.notifySubscribers ? 'हां' : 'नहीं'} · बच्चों के लिए: {f.madeForKids ? 'हां' : 'नहीं'} · AI दृश्य:{' '}
          {f.containsSyntheticMedia ? 'हां' : 'नहीं'}
        </div>
        <p className={s.sectionTitle}>इतिहास</p>
        <EventList events={post.events} />
      </aside>
    </div>
  )
}
