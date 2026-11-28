'use client'

/**
 * Footage uploader (reporter page and admin YouTube view). The video goes straight from the browser to the
 * private bucket in ≤45 MiB segments (presigned PUT per segment, 2 at a time, each retried). If the connection
 * drops or the page reloads, choosing the same file again resumes: finished segments are skipped.
 */
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { completeFootage, discardFootageAction, resumeFootage, startFootage } from '@/lib/footage/actions'

import styles from './footage.module.css'

type Facts = { durationSeconds: number | null; width: number | null; height: number | null }
type Phase = 'idle' | 'uploading' | 'finishing' | 'done' | 'error'

const PARALLEL = 2
const RETRIES = 4
const ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm'

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)
const resumeKey = (f: File) => `loklens-footage:${f.name}:${f.size}:${f.lastModified}`

function readFacts(file: File): Promise<Facts> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (facts: Facts) => {
      URL.revokeObjectURL(url)
      resolve(facts)
    }
    const timer = setTimeout(() => done({ durationSeconds: null, width: null, height: null }), 8000)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      clearTimeout(timer)
      done({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      })
    }
    video.onerror = () => {
      clearTimeout(timer)
      done({ durationSeconds: null, width: null, height: null })
    }
    video.src = url
  })
}

function putSegment(url: string, body: Blob, onProgress: (sent: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = (e) => onProgress(e.loaded)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('network'))
    xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

/** Uploads the image to the media library (staff, including reporters, may create media). Returns its ID. */
async function uploadImage(file: File, alt: string): Promise<number | string> {
  const form = new FormData()
  form.append('file', file)
  form.append('_payload', JSON.stringify({ alt: alt.trim() || 'Footage image' }))
  const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: form }).catch(() => null)
  const body = (await res?.json().catch(() => null)) as { doc?: { id: number }; errors?: { message?: string }[] } | null
  if (!res?.ok || !body?.doc) return body?.errors?.[0]?.message || 'The image could not be uploaded.'
  return body.doc.id
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function FootageUploader() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [rights, setRights] = useState(false)
  const [hashtags, setHashtags] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [facts, setFacts] = useState<Facts | null>(null)
  const [canResume, setCanResume] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [sent, setSent] = useState(0)
  const [message, setMessage] = useState('')
  const [hasUpload, setHasUpload] = useState(false)
  // Changing the key remounts the file input, which clears the chosen file after a finished upload.
  const [inputKey, setInputKey] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const footageIdRef = useRef<number | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  async function onPick(f: File | null) {
    setFile(f)
    setFacts(null)
    setPhase('idle')
    setMessage('')
    setSent(0)
    setCanResume(Boolean(f && localStorage.getItem(resumeKey(f))))
    if (f) setFacts(await readFacts(f))
  }

  function pickImage(f: File | null) {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    if (f && (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 10 * 1024 * 1024)) {
      setMessage('The image must be a JPG, PNG or WebP of at most 10 MB.')
      setImage(null)
      setImageUrl('')
      return
    }
    setImage(f)
    setImageUrl(f ? URL.createObjectURL(f) : '')
  }

  async function upload() {
    if (!file) return
    setMessage('')
    setPhase('uploading')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const saved = Number(localStorage.getItem(resumeKey(file)))
      let plan = saved > 0 ? await resumeFootage(saved, file.size) : null
      if (!plan || !plan.ok) {
        localStorage.removeItem(resumeKey(file))
        let imageId: number | null = null
        if (image) {
          const up = await uploadImage(image, title)
          if (typeof up === 'string') throw new Error(up)
          imageId = up
        }
        plan = await startFootage({ filename: file.name, sizeBytes: file.size, mimeType: file.type, title, notes, hashtags, image: imageId, rightsConfirmed: rights })
      }
      if (!plan.ok) throw new Error(plan.error)
      const { footageId, segmentBytes, segments } = plan
      footageIdRef.current = footageId
      setHasUpload(true)
      localStorage.setItem(resumeKey(file), String(footageId))

      // Bytes already stored (earlier session) count as sent.
      const pendingBytes = segments.reduce((n, s) => n + Math.min(segmentBytes, file.size - (s.n - 1) * segmentBytes), 0)
      const base = file.size - pendingBytes
      const inFlight = new Map<number, number>()
      let finished = 0
      const report = () => setSent(base + finished + [...inFlight.values()].reduce((a, b) => a + b, 0))
      report()

      let next = 0
      const worker = async () => {
        while (next < segments.length) {
          const s = segments[next++]
          const blob = file.slice((s.n - 1) * segmentBytes, s.n * segmentBytes)
          for (let attempt = 1; ; attempt++) {
            try {
              await putSegment(s.url, blob, (b) => (inFlight.set(s.n, b), report()), controller.signal)
              inFlight.delete(s.n)
              finished += blob.size
              report()
              break
            } catch (err) {
              inFlight.delete(s.n)
              report()
              if ((err as Error).name === 'AbortError' || attempt > RETRIES) throw err
              await sleep(2000 * 2 ** (attempt - 1))
            }
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(PARALLEL, segments.length) }, worker))

      setPhase('finishing')
      const done = await completeFootage(footageId, facts ?? {})
      if (!done.ok) throw new Error(done.error)
      localStorage.removeItem(resumeKey(file))
      footageIdRef.current = null
      setHasUpload(false)
      setCanResume(false)
      setPhase('done')
      setMessage('Footage uploaded.')
      setFile(null)
      setInputKey((k) => k + 1)
      setTitle('')
      setNotes('')
      setHashtags('')
      pickImage(null)
      setRights(false)
      router.refresh()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setPhase('error')
      setCanResume(true)
      setMessage(
        (err as Error).message === 'network' || /^HTTP /.test((err as Error).message)
          ? 'The connection dropped. Choose the same file and press "Try again": parts already sent are not sent again.'
          : (err as Error).message,
      )
    } finally {
      abortRef.current = null
    }
  }

  async function cancel() {
    abortRef.current?.abort()
    const id = footageIdRef.current
    if (file) localStorage.removeItem(resumeKey(file))
    setPhase('idle')
    setSent(0)
    setCanResume(false)
    if (id) await discardFootageAction(id)
    footageIdRef.current = null
    setHasUpload(false)
    setMessage('Upload cancelled.')
    router.refresh()
  }

  const busy = phase === 'uploading' || phase === 'finishing'
  const percent = file ? Math.min(100, Math.round((sent / file.size) * 100)) : 0
  const ready = Boolean(file && title.trim() && rights && !busy)

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void upload()
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={busy} required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Brief</span>
        <span className={styles.hint}>What happened, where, who, when. Who is speaking in the video.</span>
        <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} disabled={busy} />
      </label>
      <div className={styles.fileBox}>
        <input key={inputKey} type="file" accept={ACCEPT} onChange={(e) => void onPick(e.target.files?.[0] ?? null)} disabled={busy} aria-label="Choose the video file" />
        {file && (
          <div className={styles.fileInfo}>
            {file.name} · {mb(file.size)} MB
            {facts?.durationSeconds ? ` · ${Math.round(facts.durationSeconds)} s` : ''}
            {facts?.width && facts?.height ? ` · ${facts.width}×${facts.height}` : ''}
          </div>
        )}
      </div>
      <label className={styles.field}>
        <span className={styles.label}>Hashtags</span>
        <span className={styles.hint}>Space-separated, e.g. #Uttarakhand #Dehradun. Used as suggestions for the YouTube post.</span>
        <input className={styles.input} value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#Uttarakhand #Dehradun" maxLength={400} disabled={busy} />
      </label>
      <div className={styles.field}>
        <span className={styles.label}>Image (optional)</span>
        <span className={styles.hint}>A photo for the thumbnail: JPG, PNG or WebP, up to 10 MB, ideally 16:9.</span>
        <input key={`img-${inputKey}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} disabled={busy} aria-label="Choose an image" />
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className={styles.imagePreview} />
        )}
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} disabled={busy} />
        <span>This is our own footage, and the people shown agreed to be filmed.</span>
      </label>

      {(busy || phase === 'error') && file && (
        <div>
          <div className={styles.progressTrack} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.progressBar} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.status}>
            {phase === 'finishing' ? 'Checking…' : `${percent}% (${mb(sent)} / ${mb(file.size)} MB)`}
          </p>
        </div>
      )}
      {message && <p className={phase === 'done' ? styles.success : phase === 'error' ? styles.error : styles.status}>{message}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={!ready}>
          {canResume ? 'Try again' : 'Upload'}
        </button>
        {(busy || (phase === 'error' && hasUpload)) && (
          <button type="button" className={styles.buttonSecondary} onClick={() => void cancel()}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
