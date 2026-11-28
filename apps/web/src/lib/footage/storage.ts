/**
 * Private footage bucket access (server only). Uses the existing S3_* credentials and FOOTAGE_S3_BUCKET
 * (default `loklens-footage`). The browser only ever gets short-lived presigned PUT URLs for single segments;
 * keys and credentials never leave the server.
 */
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const DEFAULTS = {
  S3_REGION: 'ap-northeast-2',
  S3_ENDPOINT: 'https://sfsfwcyrnddxjlrvuakf.storage.supabase.co/storage/v1/s3',
  FOOTAGE_S3_BUCKET: 'loklens-footage',
}

/** Presigned segment URLs live this long; the uploader asks for fresh ones when it resumes. */
export const PUT_URL_SECONDS = 60 * 60

let client: S3Client | null = null

function env(name: 'S3_REGION' | 'S3_ENDPOINT' | 'S3_ACCESS_KEY_ID' | 'S3_SECRET_ACCESS_KEY' | 'FOOTAGE_S3_BUCKET'): string {
  return process.env[name]?.trim() || (DEFAULTS as Record<string, string>)[name] || ''
}

export function footageBucket(): string {
  return env('FOOTAGE_S3_BUCKET')
}

/** Names (never values) of missing settings; empty when storage is usable. */
export function footageStorageProblems(): string[] {
  return (['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter((n) => !env(n))
}

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env('S3_REGION'),
      endpoint: env('S3_ENDPOINT'),
      forcePathStyle: true,
      credentials: { accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY') },
    })
  }
  return client
}

export async function presignSegmentPut(key: string): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: footageBucket(), Key: key, ContentType: 'application/octet-stream' }), {
    expiresIn: PUT_URL_SECONDS,
  })
}

/** All objects under `prefix/` with their sizes. */
export async function listPrefix(prefix: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  let token: string | undefined
  do {
    const res = await s3().send(new ListObjectsV2Command({ Bucket: footageBucket(), Prefix: `${prefix}/`, ContinuationToken: token }))
    for (const o of res.Contents ?? []) if (o.Key) out.set(o.Key, Number(o.Size ?? 0))
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return out
}

/** The first `bytes` bytes of an object (for the container check). */
export async function readHead(key: string, bytes = 64): Promise<Uint8Array> {
  const res = await s3().send(new GetObjectCommand({ Bucket: footageBucket(), Key: key, Range: `bytes=0-${bytes - 1}` }))
  return res.Body ? await res.Body.transformToByteArray() : new Uint8Array()
}

/**
 * Bytes start..end (inclusive) of a segmented video, read with ranged GETs on the segments it spans
 * (used by the admin preview and, later, the YouTube upload job).
 */
export async function readFootageRange(prefix: string, segmentBytes: number, start: number, end: number): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  for (let pos = start; pos <= end; ) {
    const i = Math.floor(pos / segmentBytes)
    const segStart = i * segmentBytes
    const segEnd = Math.min(end, segStart + segmentBytes - 1)
    const key = `${prefix}/seg-${String(i + 1).padStart(4, '0')}`
    const res = await s3().send(new GetObjectCommand({ Bucket: footageBucket(), Key: key, Range: `bytes=${pos - segStart}-${segEnd - segStart}` }))
    parts.push(res.Body ? await res.Body.transformToByteArray() : new Uint8Array())
    pos = segEnd + 1
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  if (out.length !== end - start + 1) throw new Error(`footage read returned ${out.length} bytes, expected ${end - start + 1}`)
  return out
}

/** A whole object from the MEDIA bucket (S3_BUCKET), e.g. an image's original for the YouTube thumbnail. */
export async function readMediaObject(key: string): Promise<Uint8Array> {
  const bucket = process.env.S3_BUCKET?.trim() || 'loklens-media'
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return res.Body ? await res.Body.transformToByteArray() : new Uint8Array()
}

/** Deletes every object under `prefix/`. Returns how many were deleted. */
export async function deletePrefix(prefix: string): Promise<number> {
  if (!/^footage\/[a-z0-9-]+$/.test(prefix)) throw new Error('Refusing to delete outside footage/<id>.')
  const keys = [...(await listPrefix(prefix)).keys()]
  for (let i = 0; i < keys.length; i += 1000) {
    await s3().send(
      new DeleteObjectsCommand({ Bucket: footageBucket(), Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }),
    )
  }
  return keys.length
}
