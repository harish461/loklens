/**
 * Footage segment rules (docs/youtube-studio-plan.md §12a, api-contract.md §9). Pure: no S3, no Payload.
 *
 * Supabase Free caps each object at 50 MB, so a video is stored as segments of SEGMENT_BYTES under
 * `footage/<id>-<random>/seg-0001` … . 45 MiB is 180 × 256 KiB, so YouTube's resumable chunks (multiples of
 * 256 KiB) line up with segment boundaries.
 */
export const SEGMENT_BYTES = 45 * 1024 * 1024
export const MAX_SEGMENTS = 1000 // 45 GB; far above any setting, guards against nonsense sizes

export const FOOTAGE_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const
export type FootageMime = (typeof FOOTAGE_MIME_TYPES)[number]

const EXT_TO_MIME: Record<string, FootageMime> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }

export function segmentCount(sizeBytes: number): number {
  return Math.max(1, Math.ceil(sizeBytes / SEGMENT_BYTES))
}

/** Exact byte length of segment n (1-based). */
export function segmentLength(sizeBytes: number, n: number): number {
  const start = (n - 1) * SEGMENT_BYTES
  return Math.max(0, Math.min(SEGMENT_BYTES, sizeBytes - start))
}

export function segmentKey(prefix: string, n: number): string {
  return `${prefix}/seg-${String(n).padStart(4, '0')}`
}

/** Parses "…/seg-0007" → 7, or null. */
export function segmentNumber(key: string): number | null {
  const m = /\/seg-(\d{4,})$/.exec(key)
  return m ? Number(m[1]) : null
}

/** The segments still missing, given the objects already stored (key → size). A wrong-size object counts as missing. */
export function missingSegments(prefix: string, sizeBytes: number, stored: ReadonlyMap<string, number>): number[] {
  const missing: number[] = []
  for (let n = 1; n <= segmentCount(sizeBytes); n++) {
    if (stored.get(segmentKey(prefix, n)) !== segmentLength(sizeBytes, n)) missing.push(n)
  }
  return missing
}

/** A safe display filename (no path, no control characters), at most 120 characters. */
export function cleanFilename(name: unknown): string {
  const base = typeof name === 'string' ? name.split(/[\\/]/).pop() ?? '' : ''
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim().slice(-120)
  return cleaned || 'video'
}

export interface StartRequest {
  filename: unknown
  sizeBytes: unknown
  mimeType: unknown
  title: unknown
  rightsConfirmed: unknown
}

export interface ValidStart {
  filename: string
  sizeBytes: number
  mimeType: FootageMime
  title: string
}

/** Checks an upload request against the allowed types and the size limit (in bytes). */
export function validateStart(req: StartRequest, maxBytes: number): { ok: true; value: ValidStart } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const filename = cleanFilename(req.filename)
  const size = typeof req.sizeBytes === 'number' && Number.isSafeInteger(req.sizeBytes) ? req.sizeBytes : -1
  if (size <= 0) errors.push('The file is empty or its size is unknown.')
  else if (size > maxBytes) errors.push(`The file is too large: at most ${Math.floor(maxBytes / 1024 / 1024)} MB.`)
  else if (segmentCount(size) > MAX_SEGMENTS) errors.push('The file is too large.')
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  const declared = typeof req.mimeType === 'string' ? req.mimeType.toLowerCase() : ''
  const mimeType = (FOOTAGE_MIME_TYPES as readonly string[]).includes(declared) ? (declared as FootageMime) : EXT_TO_MIME[ext]
  if (!mimeType) errors.push('Upload an MP4, MOV or WebM video.')
  const title = typeof req.title === 'string' ? req.title.trim().slice(0, 200) : ''
  if (!title) errors.push('Enter a title for the footage.')
  if (req.rightsConfirmed !== true) errors.push('Confirm that this is our own footage and the people shown agreed to be filmed.')
  if (errors.length || !mimeType) return { ok: false, errors }
  return { ok: true, value: { filename, sizeBytes: size, mimeType, title } }
}

/**
 * Container check on the first bytes of the file (never trust the browser's type): MP4/MOV have an ISO-BMFF
 * `ftyp` box at offset 4; WebM/Matroska starts with the EBML magic 1A 45 DF A3.
 */
export function detectContainer(head: Uint8Array): 'mp4' | 'mov' | 'webm' | null {
  if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11])
    return brand === 'qt  ' ? 'mov' : 'mp4'
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'webm'
  return null
}

/** Browser-reported video facts, sanity-checked (the server cannot decode video). Unknown values become null. */
export function cleanVideoFacts(input: { durationSeconds?: unknown; width?: unknown; height?: unknown }) {
  const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : null)
  const duration = num(input.durationSeconds, 24 * 3600)
  const width = num(input.width, 16384)
  const height = num(input.height, 16384)
  return {
    durationSeconds: duration === null ? null : Math.round(duration * 10) / 10,
    width: width === null ? null : Math.round(width),
    height: height === null ? null : Math.round(height),
  }
}

/** Uploads not finished within this time are cleaned up by the retention job. */
export const STALE_UPLOAD_MS = 48 * 3600 * 1000

export interface RetentionCandidate {
  uploadStatus?: unknown
  retainUntil?: unknown
  createdAt?: unknown
}

/** What the retention job does with a footage row now: delete its segments, or nothing. */
export function retentionAction(doc: RetentionCandidate, now: Date): 'expire' | 'abandon' | null {
  if (doc.uploadStatus === 'deleted') return null
  const t = (v: unknown) => (typeof v === 'string' || v instanceof Date ? new Date(v).getTime() : NaN)
  if (doc.uploadStatus === 'uploading' || doc.uploadStatus === 'failed') {
    const created = t(doc.createdAt)
    return Number.isFinite(created) && now.getTime() - created > STALE_UPLOAD_MS ? 'abandon' : null
  }
  const until = t(doc.retainUntil)
  return Number.isFinite(until) && until <= now.getTime() ? 'expire' : null
}
