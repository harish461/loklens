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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function FootageUploader() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [rights, setRights] = useState(false)
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
        plan = await startFootage({ filename: file.name, sizeBytes: file.size, mimeType: file.type, title, notes, rightsConfirmed: rights })
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
      setMessage('फ़ुटेज अपलोड हो गया।')
      setFile(null)
      setInputKey((k) => k + 1)
      setTitle('')
      setNotes('')
      setRights(false)
      router.refresh()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setPhase('error')
      setCanResume(true)
      setMessage(
        (err as Error).message === 'network' || /^HTTP /.test((err as Error).message)
          ? 'कनेक्शन टूट गया। वही फ़ाइल चुनकर "फिर से कोशिश करें" दबाएं; जो हिस्से पहुंच चुके हैं, वे दोबारा नहीं भेजे जाएंगे।'
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
    setMessage('अपलोड रद्द किया गया।')
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
        <span className={styles.label}>शीर्षक</span>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={busy} required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>ब्योरा</span>
        <span className={styles.hint}>क्या हुआ, कहां, कौन, कब। वीडियो में कौन बोल रहा है।</span>
        <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} disabled={busy} />
      </label>
      <div className={styles.fileBox}>
        <input key={inputKey} type="file" accept={ACCEPT} onChange={(e) => void onPick(e.target.files?.[0] ?? null)} disabled={busy} aria-label="वीडियो फ़ाइल चुनें" />
        {file && (
          <div className={styles.fileInfo}>
            {file.name} · {mb(file.size)} MB
            {facts?.durationSeconds ? ` · ${Math.round(facts.durationSeconds)} सेकंड` : ''}
            {facts?.width && facts?.height ? ` · ${facts.width}×${facts.height}` : ''}
          </div>
        )}
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} disabled={busy} />
        <span>यह हमारा अपना फ़ुटेज है, और वीडियो में दिखाए गए लोगों ने फ़िल्माए जाने की सहमति दी है।</span>
      </label>

      {(busy || phase === 'error') && file && (
        <div>
          <div className={styles.progressTrack} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={styles.progressBar} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.status}>
            {phase === 'finishing' ? 'जांच हो रही है…' : `${percent}% (${mb(sent)} / ${mb(file.size)} MB)`}
          </p>
        </div>
      )}
      {message && <p className={phase === 'done' ? styles.success : phase === 'error' ? styles.error : styles.status}>{message}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={!ready}>
          {canResume ? 'फिर से कोशिश करें' : 'अपलोड करें'}
        </button>
        {(busy || (phase === 'error' && hasUpload)) && (
          <button type="button" className={styles.buttonSecondary} onClick={() => void cancel()}>
            रद्द करें
          </button>
        )}
      </div>
    </form>
  )
}
