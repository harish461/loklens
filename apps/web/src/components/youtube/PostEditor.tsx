'use client'

/**
 * YouTube post editor (/admin/youtube?tab=edit[&id=]). Editors type the metadata themselves (AI is off in
 * Release 1). Counters follow YouTube's limits; the server checks them again (access/youtube.ts).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { tagsLength, YT_LIMITS, YT_LOCKED_STATUSES, type YtPostStatus } from '@/access/youtubeLimits'
import { parseHashtags, parseTags } from '@/lib/youtube/postInput'
import { fullDescription } from '@/lib/youtube/publishPlan'
import { saveYoutubePost, youtubePostAction } from '@/lib/youtube/studioActions'
import type { ArticleOption, FootageOption, MediaOption, PostDetail } from '@/lib/youtube/studioQueries'

import { EVENT_LABEL, formatIst, ORIENTATION_LABEL, PRIVACY_LABEL, STATUS_LABEL, STATUS_TONE } from './labels'
import s from './studio.module.css'

type Form = PostDetail['form']

const EMPTY: Form = {
  postType: 'video',
  footage: null,
  article: null,
  thumbnail: null,
  title: '',
  description: '',
  tags: '',
  hashtags: '',
  privacyStatus: 'unlisted',
  publishAtIst: '',
  notifySubscribers: true,
  madeForKids: false,
  containsSyntheticMedia: false,
}

const bytes = (t: string) => new TextEncoder().encode(t).length

async function uploadThumbnail(file: File, alt: string): Promise<MediaOption | string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return 'केवल JPG, PNG या WebP चित्र।'
  if (file.size > 10 * 1024 * 1024) return 'चित्र 10 MB से बड़ा है।'
  const form = new FormData()
  form.append('file', file)
  form.append('_payload', JSON.stringify({ alt: alt || 'यूट्यूब थंबनेल' }))
  const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: form }).catch(() => null)
  const body = (await res?.json().catch(() => null)) as { doc?: { id: number; url?: string; alt?: string; sizes?: { thumb?: { url?: string } } }; errors?: { message?: string }[] } | null
  if (!res?.ok || !body?.doc) return body?.errors?.[0]?.message || 'थंबनेल अपलोड नहीं हुआ।'
  return { id: body.doc.id, url: body.doc.sizes?.thumb?.url ?? body.doc.url ?? '', alt: body.doc.alt ?? '' }
}

interface Props {
  post: PostDetail | null
  footage: FootageOption[]
  thumbnails: MediaOption[]
  articles: ArticleOption[]
  requireThumbnail: boolean
}

export function PostEditor({ post, footage, thumbnails, articles, requireThumbnail }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<Form>(post?.form ?? EMPTY)
  const [thumbs, setThumbs] = useState<MediaOption[]>(thumbnails)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, start] = useTransition()
  const [uploading, setUploading] = useState(false)

  const status: YtPostStatus = post?.status ?? 'draft'
  const locked = YT_LOCKED_STATUSES.includes(status)
  // The post's current footage stays selectable even if it is no longer in the "uploaded" list.
  const footageList = useMemo(() => {
    const list = [...footage]
    if (post?.footage && !list.some((f) => f.id === post.footage!.id)) list.unshift(post.footage)
    return list
  }, [footage, post])
  const selectedFootage = footageList.find((f) => f.id === form.footage) ?? null
  const selectedThumb = thumbs.find((t) => t.id === form.thumbnail) ?? null

  const titleLen = [...form.title].length
  const tagList = parseTags(form.tags)
  const hashList = parseHashtags(form.hashtags)
  // Counted as sent: the description plus the hashtag line the publisher appends.
  const descBytes = bytes(fullDescription({ description: form.description, hashtags: hashList }))
  const tagLen = tagsLength(tagList)
  const shortWarning =
    form.postType === 'short' && selectedFootage
      ? selectedFootage.orientation === 'landscape'
        ? 'शॉर्ट के लिए खड़ा (vertical) या चौकोर वीडियो चाहिए।'
        : selectedFootage.durationSeconds && selectedFootage.durationSeconds > YT_LIMITS.shortMaxSeconds
          ? 'शॉर्ट अधिकतम 3 मिनट का हो सकता है।'
          : ''
      : ''

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  function save(then?: 'submit') {
    setError('')
    setNotice('')
    if (then === 'submit' && requireThumbnail && form.postType === 'video' && !form.thumbnail) {
      setError('वीडियो के लिए थंबनेल चुनें।')
      return
    }
    start(async () => {
      const r = await saveYoutubePost({ ...form, id: post?.id ?? null })
      if (!r.ok) return setError(r.error)
      if (then === 'submit') {
        const s2 = await youtubePostAction(r.id, 'submit')
        if (!s2.ok) {
          setError(s2.error)
          if (!post) router.replace(`/admin/youtube?tab=edit&id=${r.id}`)
          return
        }
        router.replace(`/admin/youtube?tab=posts`)
        router.refresh()
        return
      }
      setNotice(r.status === 'pending_review' && post?.status === 'approved' ? 'बदलाव सहेजे गए। मंज़ूरी के बाद बदलाव हुआ, इसलिए पोस्ट फिर से समीक्षा में है।' : 'सहेजा गया।')
      if (!post) router.replace(`/admin/youtube?tab=edit&id=${r.id}`)
      router.refresh()
    })
  }

  function act(action: 'withdraw' | 'cancel') {
    if (!post) return
    if (action === 'cancel' && !window.confirm('यह पोस्ट रद्द हो जाएगी। जारी रखें?')) return
    setError('')
    start(async () => {
      const r = await youtubePostAction(post.id, action)
      if (!r.ok) return setError(r.error)
      router.refresh()
    })
  }

  async function onThumbFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setError('')
    const r = await uploadThumbnail(file, form.title)
    setUploading(false)
    if (typeof r === 'string') return setError(r)
    setThumbs((t) => [r, ...t])
    set('thumbnail', r.id)
  }

  return (
    <div className={s.grid}>
      <div className={s.form}>
        {post && (
          <div className={s.actions} style={{ alignItems: 'center' }}>
            <span className={`${s.badge} ${s[STATUS_TONE[status]]}`}>{STATUS_LABEL[status]}</span>
            {post.youtubeUrl && (
              <a href={post.youtubeUrl} target="_blank" rel="noopener noreferrer">
                यूट्यूब पर देखें
              </a>
            )}
          </div>
        )}
        {post?.reviewNote && status === 'draft' && <div className={s.note}>समीक्षक की टिप्पणी: {post.reviewNote}</div>}
        {post?.lastError && status === 'failed' && <div className={s.error}>त्रुटि: {post.lastError}</div>}
        {locked && <div className={s.note}>यह पोस्ट यूट्यूब पर जा चुकी है या रद्द है, इसलिए यहां बदली नहीं जा सकती।</div>}

        <fieldset disabled={locked || pending} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
          <div className={s.field}>
            <span className={s.label}>प्रकार</span>
            <div className={s.radioGroup}>
              {(['video', 'short'] as const).map((t) => (
                <label key={t} className={`${s.radio} ${form.postType === t ? s.radioActive : ''}`}>
                  <input type="radio" name="postType" checked={form.postType === t} onChange={() => set('postType', t)} />
                  {t === 'video' ? 'वीडियो' : 'शॉर्ट (खड़ा, 3 मिनट तक)'}
                </label>
              ))}
            </div>
          </div>

          <label className={s.field}>
            <span className={s.label}>फ़ुटेज</span>
            <select className={s.select} value={form.footage ?? ''} onChange={(e) => set('footage', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— फ़ुटेज चुनें —</option>
              {footageList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                  {f.orientation ? ` · ${ORIENTATION_LABEL[f.orientation]}` : ''}
                  {f.durationSeconds ? ` · ${Math.round(f.durationSeconds)} से.` : ''}
                  {f.uploader ? ` · ${f.uploader}` : ''}
                </option>
              ))}
            </select>
            <span className={s.hint}>
              फ़ुटेज नहीं दिख रहा? <Link href="/admin/youtube?tab=footage">फ़ुटेज टैब</Link> में अपलोड करें।
            </span>
          </label>
          {selectedFootage && (
            <>
              <video key={selectedFootage.id} className={s.player} controls preload="metadata" src={`/api/youtube/footage/${selectedFootage.id}`} />
              {selectedFootage.notes && <div className={s.note}>रिपोर्टर का ब्योरा: {selectedFootage.notes}</div>}
            </>
          )}
          {shortWarning && <div className={s.error}>{shortWarning}</div>}

          <label className={s.field}>
            <span className={s.label}>
              शीर्षक
              <span className={`${s.counter} ${titleLen > YT_LIMITS.titleChars ? s.counterOver : ''}`}>
                {titleLen}/{YT_LIMITS.titleChars}
              </span>
            </span>
            <input className={s.input} value={form.title} onChange={(e) => set('title', e.target.value)} />
            <span className={s.hint}>सटीक और साफ़; क्लिकबेट नहीं। &lt; और &gt; नहीं चलेंगे।</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>
              विवरण
              <span className={`${s.counter} ${descBytes > YT_LIMITS.descriptionBytes ? s.counterOver : ''}`}>
                {descBytes}/{YT_LIMITS.descriptionBytes} बाइट
              </span>
            </span>
            <textarea className={s.textarea} value={form.description} onChange={(e) => set('description', e.target.value)} />
            <span className={s.hint}>यूट्यूब बाइट गिनता है: एक हिंदी अक्षर लगभग 3 बाइट।</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>
              टैग
              <span className={`${s.counter} ${tagLen > YT_LIMITS.tagsChars ? s.counterOver : ''}`}>
                {tagLen}/{YT_LIMITS.tagsChars}
              </span>
            </span>
            <input className={s.input} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="देहरादून न्यूज़, uttarakhand news" />
            <span className={s.hint}>कॉमा से अलग करें।</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>
              हैशटैग
              <span className={`${s.counter} ${hashList.length > YT_LIMITS.hashtags ? s.counterOver : ''}`}>
                {hashList.length}/{YT_LIMITS.hashtags}
              </span>
            </span>
            <input className={s.input} value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#उत्तराखंड #Dehradun" />
            <span className={s.hint}>पहले तीन शीर्षक के ऊपर दिखते हैं।</span>
          </label>

          <div className={s.field}>
            <span className={s.label}>
              थंबनेल{form.postType === 'video' && requireThumbnail ? ' (ज़रूरी)' : ' (वैकल्पिक)'}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void onThumbFile(e.target.files?.[0] ?? null)} disabled={uploading} aria-label="नया थंबनेल अपलोड करें" />
            {uploading && <span className={s.hint}>अपलोड हो रहा है…</span>}
            <div className={s.thumbs}>
              {thumbs.map((t) => (
                <button key={t.id} type="button" className={`${s.thumb} ${form.thumbnail === t.id ? s.thumbActive : ''}`} onClick={() => set('thumbnail', form.thumbnail === t.id ? null : t.id)} aria-pressed={form.thumbnail === t.id} title={t.alt}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.url} alt={t.alt} loading="lazy" />
                </button>
              ))}
            </div>
            <span className={s.hint}>16:9, कम से कम 1280×720 सबसे अच्छा। यूट्यूब पर JPEG बनाकर भेजा जाएगा।</span>
          </div>

          <div className={s.field}>
            <span className={s.label}>कौन देख सकता है</span>
            <div className={s.radioGroup}>
              {(['unlisted', 'public', 'private'] as const).map((p) => (
                <label key={p} className={`${s.radio} ${form.privacyStatus === p ? s.radioActive : ''}`}>
                  <input type="radio" name="privacy" checked={form.privacyStatus === p} onChange={() => set('privacyStatus', p)} />
                  {PRIVACY_LABEL[p]}
                </label>
              ))}
            </div>
          </div>

          <label className={s.field}>
            <span className={s.label}>शेड्यूल (भारतीय समय, वैकल्पिक)</span>
            <input type="datetime-local" className={s.input} value={form.publishAtIst} onChange={(e) => set('publishAtIst', e.target.value)} />
            <span className={s.hint}>खाली = मंज़ूरी के बाद अपलोड होते ही। शेड्यूल होने पर वीडियो पहले निजी रहता है, फिर तय समय पर खुलता है।</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>संबंधित खबर (वैकल्पिक)</span>
            <select className={s.select} value={form.article ?? ''} onChange={(e) => set('article', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— कोई नहीं —</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>

          <div className={s.inline}>
            <label className={s.check}>
              <input type="checkbox" checked={form.notifySubscribers} onChange={(e) => set('notifySubscribers', e.target.checked)} />
              <span>सब्सक्राइबर्स को सूचना भेजें</span>
            </label>
            <label className={s.check}>
              <input type="checkbox" checked={form.madeForKids} onChange={(e) => set('madeForKids', e.target.checked)} />
              <span>बच्चों के लिए बनाया गया</span>
            </label>
            <label className={s.check}>
              <input type="checkbox" checked={form.containsSyntheticMedia} onChange={(e) => set('containsSyntheticMedia', e.target.checked)} />
              <span>इसमें AI से बनाया/बदला गया दृश्य है</span>
            </label>
          </div>
        </fieldset>

        {error && <p className={s.error}>{error}</p>}
        {notice && <p className={s.success}>{notice}</p>}

        {!locked && (
          <div className={s.actions}>
            <button type="button" className={s.buttonSecondary} onClick={() => save()} disabled={pending}>
              सहेजें
            </button>
            {(status === 'draft' || !post) && (
              <button type="button" className={s.buttonLime} onClick={() => save('submit')} disabled={pending}>
                समीक्षा के लिए भेजें
              </button>
            )}
            {status === 'pending_review' && (
              <button type="button" className={s.buttonSecondary} onClick={() => act('withdraw')} disabled={pending}>
                वापस ड्राफ़्ट में लें
              </button>
            )}
            {post && (
              <button type="button" className={s.buttonDanger} onClick={() => act('cancel')} disabled={pending}>
                पोस्ट रद्द करें
              </button>
            )}
          </div>
        )}
      </div>

      <aside className={s.preview} aria-label="यूट्यूब पर कैसा दिखेगा">
        <p className={s.sectionTitle}>पूर्वावलोकन</p>
        {selectedThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={s.thumbPreview} src={selectedThumb.url} alt="" />
        ) : (
          <div className={s.thumbPreview} />
        )}
        {hashList.length > 0 && <div className={s.meta}>{hashList.slice(0, 3).join(' ')}</div>}
        <div className={s.previewTitle}>{form.title || 'शीर्षक'}</div>
        <div className={s.meta}>
          {PRIVACY_LABEL[form.privacyStatus]}
          {form.publishAtIst ? ` · ${formatIst(new Date(`${form.publishAtIst}:00+05:30`).toISOString())}` : ''}
        </div>
        <div className={s.previewDesc}>{form.description || 'विवरण'}</div>
        {post && post.events.length > 0 && (
          <>
            <p className={s.sectionTitle}>इतिहास</p>
            <EventList events={post.events} />
          </>
        )}
      </aside>
    </div>
  )
}

export function EventList({ events }: { events: PostDetail['events'] }) {
  return (
    <ul className={s.events}>
      {events.map((e, i) => (
        <li key={i}>
          <strong>{EVENT_TEXT(e.type)}</strong> · {formatIst(e.at)}
          {e.actor ? ` · ${e.actor}` : ''}
          {e.note ? ` — ${e.note}` : ''}
        </li>
      ))}
    </ul>
  )
}

const EVENT_TEXT = (t: string) => EVENT_LABEL[t] ?? t
