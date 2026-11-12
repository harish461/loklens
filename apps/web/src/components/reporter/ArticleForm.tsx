'use client'

/**
 * Create / edit article form for reporters. Same layout and styles as the admin Article Studio
 * (articlesAdmin.module.css). Everything is validated again on the server (lib/reporter/actions.ts and
 * the workflow hooks); the checks here are only for quick feedback.
 */
import { Eye, ImagePlus, Save, Send, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { WORKFLOW_LABELS, type WorkflowStatus } from '@/access/workflow'
import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { NewsEditor, type EditorMediaOption } from '@/components/editor/NewsEditor'
import { plainText, type JsonNode } from '@/components/editor/payloadLexical'
import { saveArticle, updateMyMedia, type ArticleInput, type SaveIntent } from '@/lib/reporter/actions'
import type { FormOptions } from '@/lib/reporter/queries'

import styles from './reporter.module.css'
import { StatusBadge } from './StatusBadge'

export interface ArticleFormInitial {
  id?: number
  title: string
  summary: string
  slug: string
  category: number | null
  location: number | null
  tags: number[]
  featuredImage: { id: number; url: string; alt: string; caption: string; own: boolean } | null
  body: unknown
  seo: { metaTitle: string; metaDescription: string; focusKeyword: string }
  articleType: string
  language: string
  featureRequested: boolean
  status: WorkflowStatus
  reviewNote: string | null
}

interface Props {
  initial: ArticleFormInitial
  options: FormOptions
  canPublish: boolean
}

const ARTICLE_TYPES = [
  ['news', 'News (समाचार)'],
  ['opinion', 'Opinion (विचार)'],
  ['interview', 'Interview (साक्षात्कार)'],
  ['analysis', 'Analysis (विश्लेषण)'],
  ['photo_story', 'Photo story (फोटो कहानी)'],
] as const

/** Uploads to Payload's media endpoint (reporters may create media; they own what they upload). */
async function uploadMedia(file: File, alt: string, caption: string): Promise<EditorMediaOption | string> {
  if (file.size > 10 * 1024 * 1024) return 'Image is too large (max 10 MB).'
  const form = new FormData()
  form.append('file', file)
  form.append('_payload', JSON.stringify({ alt, caption }))
  try {
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: form })
    const body = (await res.json().catch(() => null)) as {
      doc?: { id: number; url?: string; alt?: string; caption?: string; sizes?: { card?: { url?: string } } }
      errors?: { message?: string }[]
    } | null
    if (!res.ok || !body?.doc) return body?.errors?.[0]?.message || `Upload failed (${res.status}).`
    return {
      id: body.doc.id,
      url: body.doc.sizes?.card?.url ?? body.doc.url ?? '',
      alt: body.doc.alt ?? alt,
      caption: body.doc.caption ?? caption,
    }
  } catch {
    return 'Upload failed: could not reach the server.'
  }
}

export function ArticleForm({ initial, options, canPublish }: Props) {
  const router = useRouter()
  const [articleId, setArticleId] = useState(initial.id)
  const [status, setStatus] = useState<WorkflowStatus>(initial.status)
  const [title, setTitle] = useState(initial.title)
  const [summary, setSummary] = useState(initial.summary)
  const [slug, setSlug] = useState(initial.slug)
  const [category, setCategory] = useState<number | null>(initial.category)
  const [location, setLocation] = useState<number | null>(initial.location)
  const [tags, setTags] = useState<number[]>(initial.tags)
  const [featured, setFeatured] = useState(initial.featuredImage)
  const [imageAlt, setImageAlt] = useState(initial.featuredImage?.alt ?? '')
  const [imageCaption, setImageCaption] = useState(initial.featuredImage?.caption ?? '')
  const [body, setBody] = useState<unknown>(initial.body)
  const [seo, setSeo] = useState(initial.seo)
  const [articleType, setArticleType] = useState(initial.articleType)
  const [language, setLanguage] = useState(initial.language)
  const [featureRequested, setFeatureRequested] = useState(initial.featureRequested)
  const [media, setMedia] = useState<EditorMediaOption[]>(options.media)
  const [busy, setBusy] = useState<SaveIntent | 'preview' | 'upload' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setDirty(true)
  }

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const onBodyChange = useCallback((value: { root: JsonNode }) => {
    setBody(value)
    setDirty(true)
  }, [])

  const words = useMemo(() => plainText(body).trim().split(/\s+/).filter(Boolean).length, [body])

  async function uploadFeatured(file: File) {
    if (!imageAlt.trim()) {
      setMessage({ tone: 'error', text: 'Describe the featured image (alt text) before uploading.' })
      return
    }
    setBusy('upload')
    const res = await uploadMedia(file, imageAlt.trim(), imageCaption.trim())
    setBusy(null)
    if (typeof res === 'string') {
      setMessage({ tone: 'error', text: res })
      return
    }
    setMedia((m) => [res, ...m])
    setFeatured({ id: res.id, url: res.url, alt: res.alt, caption: res.caption ?? '', own: true })
    setDirty(true)
    setMessage({ tone: 'ok', text: 'Image uploaded.' })
  }

  function pickFeatured(m: EditorMediaOption) {
    setFeatured({ id: m.id, url: m.url, alt: m.alt, caption: m.caption ?? '', own: true })
    setImageAlt(m.alt)
    setImageCaption(m.caption ?? '')
    setDirty(true)
  }

  function clientChecks(intent: SaveIntent): string | null {
    if (!title.trim()) return 'Add a headline first.'
    if (intent === 'draft') return null
    if (!summary.trim()) return 'Add a short summary before submitting.'
    if (!category) return 'Choose a category before submitting.'
    if (words === 0) return 'Write the article body before submitting.'
    if (!featured) return 'Add a featured image before submitting.'
    return null
  }

  async function save(intent: SaveIntent): Promise<number | null> {
    const problem = clientChecks(intent)
    if (problem) {
      setMessage({ tone: 'error', text: problem })
      return null
    }
    setMessage(null)
    // Keep the featured image's alt/caption in sync (only for images this reporter uploaded).
    if (featured?.own && (imageAlt.trim() !== featured.alt || imageCaption.trim() !== featured.caption)) {
      const res = await updateMyMedia(featured.id, { alt: imageAlt, caption: imageCaption })
      if (!res.ok) {
        setMessage({ tone: 'error', text: res.error })
        return null
      }
      setFeatured({ ...featured, alt: imageAlt.trim(), caption: imageCaption.trim() })
    }
    const input: ArticleInput = {
      id: articleId,
      title,
      summary,
      slug,
      category,
      location,
      tags,
      featuredImage: featured?.id ?? null,
      body,
      seo,
      articleType,
      language,
      featureRequested,
    }
    const res = await saveArticle(input, intent)
    if (!res.ok) {
      setMessage({ tone: 'error', text: res.error })
      return null
    }
    setDirty(false)
    setStatus(res.status)
    if (!articleId) {
      setArticleId(res.id)
      window.history.replaceState(null, '', `/reporter/articles/${res.id}/edit`)
    }
    return res.id
  }

  async function run(intent: SaveIntent) {
    setBusy(intent)
    const savedId = await save(intent)
    setBusy(null)
    if (!savedId) return
    if (intent === 'draft') {
      setMessage({ tone: 'ok', text: 'Draft saved.' })
      router.refresh()
    } else {
      router.push(`/reporter/articles/${savedId}?${intent === 'publish' ? 'published' : 'submitted'}=1`)
      router.refresh()
    }
  }

  async function preview() {
    setBusy('preview')
    // Preview shows the saved version, so save a draft first (without changing a pending state).
    const savedId = dirty || !articleId ? await save(status === 'pending_review' ? 'submit' : 'draft') : articleId
    setBusy(null)
    if (savedId) window.open(`/preview/${savedId}`, '_blank', 'noopener')
  }

  const toggleTag = (id: number) => touch(setTags)(tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id])

  return (
    <div className={adminStyles.editorGrid}>
      <div className={adminStyles.editorMainCol}>
        {initial.reviewNote && status === 'rejected' && (
          <div className={`${styles.alert} ${styles.alertDanger}`} role="status">
            <div>
              <strong>The editor sent this article back</strong>
              <span className={styles.alertNote}>{initial.reviewNote}</span>
              <div style={{ marginTop: 6 }}>Make the changes, then submit it for review again.</div>
            </div>
          </div>
        )}
        {message && (
          <div className={`${styles.alert} ${message.tone === 'ok' ? styles.alertSuccess : styles.alertDanger}`} role={message.tone === 'ok' ? 'status' : 'alert'}>
            {message.text}
          </div>
        )}

        <section className={adminStyles.editorCard} aria-labelledby="basic-h">
          <h2 id="basic-h" className={adminStyles.editorCardTitle}>
            Basic information
          </h2>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="title" className={adminStyles.fieldLabel}>
              Headline (शीर्षक) *
            </label>
            <input
              id="title"
              value={title}
              maxLength={200}
              onChange={(e) => touch(setTitle)(e.target.value)}
              className={adminStyles.titleHeroInput}
              placeholder="खबर का शीर्षक लिखें"
              required
            />
            <span className={adminStyles.fieldHint}>{title.length}/200 · keep it under ~110 characters for Google</span>
          </div>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="summary" className={adminStyles.fieldLabel}>
              Short description / excerpt *
            </label>
            <textarea
              id="summary"
              value={summary}
              maxLength={300}
              rows={3}
              onChange={(e) => touch(setSummary)(e.target.value)}
              className={adminStyles.textareaInput}
              placeholder="1–2 पंक्तियों में खबर का सार"
            />
            <span className={adminStyles.fieldHint}>{summary.length}/300 · shown on cards and in search results</span>
          </div>
        </section>

        <section className={adminStyles.editorCard} aria-labelledby="body-h">
          <h2 id="body-h" className={adminStyles.editorCardTitle}>
            Article content <span className={adminStyles.fieldHint}>{words} words</span>
          </h2>
          <NewsEditor
            initialValue={initial.body}
            onChange={onBodyChange}
            media={media}
            onUploadImage={uploadMedia}
            placeholder="यहाँ विस्तृत समाचार लिखें… (देहरादून। उत्तराखंड में आज…)"
          />
          <p className={adminStyles.fieldHint} style={{ marginTop: 8 }}>
            Use H2/H3 for sections — the headline is the page’s main heading.
          </p>
        </section>

        <section className={adminStyles.editorCard} aria-labelledby="seo-h">
          <h2 id="seo-h" className={adminStyles.editorCardTitle}>
            SEO
          </h2>
          <div className={adminStyles.twoColFields}>
            <div className={adminStyles.fieldBlock}>
              <label htmlFor="metaTitle" className={adminStyles.fieldLabel}>
                SEO title
              </label>
              <input id="metaTitle" maxLength={70} value={seo.metaTitle} onChange={(e) => touch(setSeo)({ ...seo, metaTitle: e.target.value })} className={adminStyles.textInput} placeholder={title || 'Defaults to the headline'} />
              <span className={adminStyles.fieldHint}>{seo.metaTitle.length}/70</span>
            </div>
            <div className={adminStyles.fieldBlock}>
              <label htmlFor="focusKeyword" className={adminStyles.fieldLabel}>
                Focus keyword
              </label>
              <input id="focusKeyword" maxLength={100} value={seo.focusKeyword} onChange={(e) => touch(setSeo)({ ...seo, focusKeyword: e.target.value })} className={adminStyles.textInput} placeholder="e.g. देहरादून बारिश" />
            </div>
          </div>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="metaDescription" className={adminStyles.fieldLabel}>
              Meta description
            </label>
            <textarea id="metaDescription" rows={2} maxLength={200} value={seo.metaDescription} onChange={(e) => touch(setSeo)({ ...seo, metaDescription: e.target.value })} className={adminStyles.textareaInput} placeholder={summary || 'Defaults to the excerpt'} />
            <span className={adminStyles.fieldHint}>{seo.metaDescription.length}/200</span>
          </div>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="slug" className={adminStyles.fieldLabel}>
              URL slug
            </label>
            <input id="slug" maxLength={120} value={slug} onChange={(e) => touch(setSlug)(e.target.value.toLowerCase())} className={adminStyles.textInput} placeholder="Generated from the headline if empty" pattern="[a-z0-9-]*" />
            <span className={adminStyles.fieldHint}>Lowercase English letters, numbers and hyphens.</span>
          </div>
        </section>
      </div>

      <aside className={adminStyles.editorRightCol}>
        <section className={adminStyles.editorCard} aria-labelledby="publish-h">
          <h2 id="publish-h" className={adminStyles.editorCardTitle}>
            Publish <StatusBadge status={status} />
          </h2>
          <div className={adminStyles.publishActionStack}>
            <button type="button" className={adminStyles.fullWidthGhostBtn} onClick={() => run('draft')} disabled={busy !== null}>
              <Save size={16} /> {busy === 'draft' ? 'Saving…' : 'Save as Draft'}
            </button>
            <button type="button" className={adminStyles.fullWidthLimeBtn} onClick={() => run('submit')} disabled={busy !== null}>
              <Send size={16} /> {busy === 'submit' ? 'Submitting…' : status === 'pending_review' ? 'Update submission' : 'Submit for Review'}
            </button>
            {canPublish && (
              <button type="button" className={adminStyles.fullWidthNavyBtn} onClick={() => run('publish')} disabled={busy !== null}>
                <Sparkles size={16} /> {busy === 'publish' ? 'Publishing…' : 'Publish now'}
              </button>
            )}
            <button type="button" className={adminStyles.fullWidthGhostBtn} onClick={preview} disabled={busy !== null || !title.trim()}>
              <Eye size={16} /> {busy === 'preview' ? 'Opening…' : 'Preview Article'}
            </button>
            <Link href={articleId ? `/reporter/articles/${articleId}` : '/reporter/articles'} className={adminStyles.fullWidthGhostBtn}>
              <X size={16} /> Cancel
            </Link>
          </div>
          <p className={adminStyles.fieldHint} style={{ marginTop: 10 }}>
            {canPublish
              ? 'You may publish directly. Submitting sends it to an editor instead.'
              : `Submitted articles go to an editor, who publishes or returns them. Current state: ${WORKFLOW_LABELS[status]}.`}
          </p>
        </section>

        <section className={adminStyles.editorCard} aria-labelledby="tax-h">
          <h2 id="tax-h" className={adminStyles.editorCardTitle}>
            Category &amp; tags
          </h2>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="category" className={adminStyles.fieldLabel}>
              Category *
            </label>
            <select id="category" value={category ?? ''} onChange={(e) => touch(setCategory)(e.target.value ? Number(e.target.value) : null)} className={adminStyles.filterSelect}>
              <option value="">Choose a category…</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {options.locations.length > 0 && (
            <div className={adminStyles.fieldBlock}>
              <label htmlFor="location" className={adminStyles.fieldLabel}>
                Location (subcategory)
              </label>
              <select id="location" value={location ?? ''} onChange={(e) => touch(setLocation)(e.target.value ? Number(e.target.value) : null)} className={adminStyles.filterSelect}>
                <option value="">None</option>
                {options.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={adminStyles.fieldBlock}>
            <span className={adminStyles.fieldLabel}>Tags</span>
            {options.tags.length > 0 ? (
              <div className={adminStyles.chipGroup} role="group" aria-label="Tags">
                {options.tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${adminStyles.selectChip} ${tags.includes(t.id) ? adminStyles.selectChipActive : ''}`}
                    aria-pressed={tags.includes(t.id)}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ) : (
              <span className={adminStyles.fieldHint}>No tags yet — editors create them.</span>
            )}
          </div>
        </section>

        <section className={adminStyles.editorCard} aria-labelledby="img-h">
          <h2 id="img-h" className={adminStyles.editorCardTitle}>
            Featured image *
          </h2>
          {featured ? (
            <div className={adminStyles.featuredPreviewWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element -- CMS preview */}
              <img src={featured.url} alt={featured.alt} className={adminStyles.featuredPreviewImg} />
            </div>
          ) : (
            <button type="button" className={adminStyles.uploadDropzone} onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}>
              <ImagePlus size={22} />
              <span>{busy === 'upload' ? 'Uploading…' : 'Upload an image (at least 1200 px wide)'}</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadFeatured(f)
              e.target.value = ''
            }}
          />
          <div className={adminStyles.fieldBlock} style={{ marginTop: 12 }}>
            <label htmlFor="imgAlt" className={adminStyles.fieldLabel}>
              Alt text *
            </label>
            <input id="imgAlt" maxLength={250} value={imageAlt} onChange={(e) => touch(setImageAlt)(e.target.value)} className={adminStyles.textInput} placeholder="चित्र में क्या दिख रहा है" disabled={Boolean(featured && !featured.own)} />
          </div>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="imgCaption" className={adminStyles.fieldLabel}>
              Caption
            </label>
            <input id="imgCaption" maxLength={300} value={imageCaption} onChange={(e) => touch(setImageCaption)(e.target.value)} className={adminStyles.textInput} placeholder="फोटो कैप्शन" disabled={Boolean(featured && !featured.own)} />
          </div>
          <div className={styles.inlineRow}>
            {featured && (
              <>
                <button type="button" className={adminStyles.secondaryBtn} onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}>
                  Replace
                </button>
                <button type="button" className={adminStyles.secondaryBtn} onClick={() => touch(setFeatured)(null)}>
                  Remove
                </button>
              </>
            )}
          </div>
          {media.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary className={adminStyles.fieldLabel} style={{ cursor: 'pointer' }}>
                Choose from your images
              </summary>
              <div className={adminStyles.galleryGrid} style={{ marginTop: 10 }}>
                {media.map((m) => (
                  <button key={m.id} type="button" className={adminStyles.galleryThumbItem} onClick={() => pickFeatured(m)} title={m.alt} style={{ padding: 0, border: 0, cursor: 'pointer' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- CMS thumbnail */}
                    <img src={m.url} alt={m.alt} className={adminStyles.galleryThumbImg} />
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>

        <section className={adminStyles.editorCard} aria-labelledby="settings-h">
          <h2 id="settings-h" className={adminStyles.editorCardTitle}>
            Article settings
          </h2>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="articleType" className={adminStyles.fieldLabel}>
              Article type
            </label>
            <select id="articleType" value={articleType} onChange={(e) => touch(setArticleType)(e.target.value)} className={adminStyles.filterSelect}>
              {ARTICLE_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className={adminStyles.fieldBlock}>
            <label htmlFor="language" className={adminStyles.fieldLabel}>
              Language
            </label>
            <select id="language" value={language} onChange={(e) => touch(setLanguage)(e.target.value)} className={adminStyles.filterSelect}>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="en">English</option>
            </select>
          </div>
          <label className={adminStyles.toggleRow} style={{ cursor: 'pointer' }}>
            <span className={adminStyles.toggleMeta}>
              <strong>Suggest as featured</strong>
              <small>The editor decides whether it is featured.</small>
            </span>
            <input type="checkbox" checked={featureRequested} onChange={(e) => touch(setFeatureRequested)(e.target.checked)} style={{ width: 18, height: 18 }} />
          </label>
        </section>
      </aside>
    </div>
  )
}
