/**
 * End-to-end check of the footage upload flow against the LOCAL database and the REAL private bucket
 * (FOOTAGE_S3_BUCKET). Uploads ~46 MB of synthetic data in 2 segments, then deletes everything it created:
 *
 *   npx cross-env NODE_OPTIONS=--no-deprecation tsx --env-file=.env scripts/verify-footage.ts
 *
 * Covers: segment URLs, resume (only missing segments are re-signed), size check, container check, ownership,
 * discard, and the retention job (expire + abandon).
 */
import { getPayload, type Payload } from 'payload'

import { runFootageRetention } from '../src/lib/footage/retention'
import { SEGMENT_BYTES } from '../src/lib/footage/segments'
import { completeFootageUpload, discardFootage, resumeFootageUpload, startFootageUpload, type UploadPlan } from '../src/lib/footage/service'
import { listPrefix } from '../src/lib/footage/storage'
import config from '../src/payload.config'
import type { User } from '../src/payload-types'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

async function userWithRole(payload: Payload, role: string): Promise<User | null> {
  const doc = (await payload.find({ collection: 'users', where: { role: { equals: role } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  return doc ? ({ ...doc, collection: 'users' } as User) : null
}

/** Synthetic "MP4": an ftyp box, then filler. */
function fakeVideo(size: number, valid = true): Buffer {
  const buf = Buffer.alloc(size, 7)
  if (valid) Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]).copy(buf, 0)
  return buf
}

async function put(plan: UploadPlan, file: Buffer, only?: number[]): Promise<void> {
  for (const s of plan.segments) {
    if (only && !only.includes(s.n)) continue
    const body = file.subarray((s.n - 1) * plan.segmentBytes, s.n * plan.segmentBytes)
    const res = await fetch(s.url, { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream' } })
    if (!res.ok) throw new Error(`PUT segment ${s.n}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? ''
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('verify-footage runs against the local database only')
  const payload = await getPayload({ config })
  const editor = await userWithRole(payload, 'editor')
  const reporter = await userWithRole(payload, 'reporter')
  if (!editor || !reporter) throw new Error('Needs an editor and a reporter in the local database (npm run db:seed).')
  const created: number[] = []
  const base = { mimeType: 'video/mp4', rightsConfirmed: true }

  try {
    // ---- start, partial upload, resume, complete ----
    const size = SEGMENT_BYTES + 1234
    const file = fakeVideo(size)
    const start = await startFootageUpload(payload, reporter, { ...base, filename: 'verify.mp4', sizeBytes: size, title: 'जांच फ़ुटेज' })
    if (!start.ok) throw new Error(start.error)
    created.push(start.footageId)
    check('start returns a URL per segment', start.segmentCount === 2 && start.segments.length === 2)
    check('segment URLs are presigned for the private footage bucket', start.segments.every((s) => s.url.includes('loklens-footage') && s.url.includes('X-Amz-Signature')))

    await put(start, file, [1])
    const tooEarly = await completeFootageUpload(payload, reporter, start.footageId, {})
    check('complete refuses while a segment is missing', !tooEarly.ok)

    const resumed = await resumeFootageUpload(payload, reporter, start.footageId, size)
    check('resume re-signs only the missing segment', resumed.ok && resumed.segments.map((s) => s.n).join() === '2')
    const wrongSize = await resumeFootageUpload(payload, reporter, start.footageId, size + 1)
    check('resume refuses a different file size', !wrongSize.ok)
    const editorResume = await resumeFootageUpload(payload, editor, start.footageId, size)
    check('an editor may resume a reporter upload (editors manage all footage)', editorResume.ok)

    if (resumed.ok) await put(resumed, file)
    const done = await completeFootageUpload(payload, reporter, start.footageId, { durationSeconds: 61.37, width: 1080, height: 1920 })
    check('complete accepts the finished upload', done.ok, done.ok ? '' : done.error)
    const row = await payload.findByID({ collection: 'footage', id: start.footageId, overrideAccess: true })
    check(
      'row is uploaded with facts, orientation and a retention date',
      row.uploadStatus === 'uploaded' && row.durationSeconds === 61.4 && row.orientation === 'vertical' && Boolean(row.retainUntil),
    )
    const objects = await listPrefix(row.storagePrefix as string)
    check('both segments are in the bucket with the right sizes', objects.size === 2 && [...objects.values()].sort((a, b) => a - b).join() === `1234,${SEGMENT_BYTES}`)
    const pub = await fetch(`${(process.env.S3_ENDPOINT ?? '').replace(/\.storage\.supabase\.co\/storage\/v1\/s3\/?$/, '.supabase.co/storage/v1/object/public')}/loklens-footage/${row.storagePrefix}/seg-0001`)
    check('segments are not publicly readable', !pub.ok, `HTTP ${pub.status}`)

    // ---- ownership ----
    const other = await startFootageUpload(payload, editor, { ...base, filename: 'editor.mp4', sizeBytes: 1000, title: 'संपादक' })
    if (!other.ok) throw new Error(other.error)
    created.push(other.footageId)
    const steal = await resumeFootageUpload(payload, reporter, other.footageId, 1000)
    check("a reporter cannot resume someone else's upload", !steal.ok)
    const stealDiscard = await discardFootage(payload, reporter, other.footageId)
    check("a reporter cannot delete someone else's footage", !stealDiscard.ok)

    // ---- container check ----
    const bogus = fakeVideo(2000, false)
    const b = await startFootageUpload(payload, reporter, { ...base, filename: 'fake.mp4', sizeBytes: bogus.length, title: 'नकली' })
    if (!b.ok) throw new Error(b.error)
    created.push(b.footageId)
    await put(b, bogus)
    const bogusDone = await completeFootageUpload(payload, reporter, b.footageId, {})
    const bogusRow = await payload.findByID({ collection: 'footage', id: b.footageId, overrideAccess: true })
    check('a file that is not a video is refused, marked failed and removed', !bogusDone.ok && bogusRow.uploadStatus === 'failed' && (await listPrefix(bogusRow.storagePrefix as string)).size === 0)

    // ---- validation ----
    const tooBig = await startFootageUpload(payload, reporter, { ...base, filename: 'x.mp4', sizeBytes: 3 * 1024 ** 3, title: 'x' })
    check('files over the size limit are refused before anything is created', !tooBig.ok)
    const noRights = await startFootageUpload(payload, reporter, { ...base, filename: 'x.mp4', sizeBytes: 10, title: 'x', rightsConfirmed: false })
    check('the rights confirmation is required', !noRights.ok)

    // ---- discard ----
    const discard = await discardFootage(payload, editor, other.footageId)
    const otherRow = await payload.findByID({ collection: 'footage', id: other.footageId, overrideAccess: true })
    check('discard marks the row deleted', discard.ok && otherRow.uploadStatus === 'deleted')

    // ---- retention ----
    await payload.update({ collection: 'footage', id: start.footageId, data: { retainUntil: new Date(Date.now() - 1000).toISOString() }, overrideAccess: true })
    const post = await payload.create({
      collection: 'youtube-posts',
      data: { title: 'रोक', footage: start.footageId, status: 'pending_review' },
      user: editor,
      overrideAccess: false,
    })
    const r1 = await runFootageRetention(payload)
    check('retention skips footage a post in review still needs', r1.skipped >= 1 && (await listPrefix(row.storagePrefix as string)).size === 2)
    await payload.delete({ collection: 'youtube-posts', id: post.id, overrideAccess: true })
    const r2 = await runFootageRetention(payload)
    const expiredRow = await payload.findByID({ collection: 'footage', id: start.footageId, overrideAccess: true })
    check('retention deletes expired footage', r2.expired >= 1 && expiredRow.uploadStatus === 'deleted' && (await listPrefix(row.storagePrefix as string)).size === 0)

    const stale = await startFootageUpload(payload, reporter, { ...base, filename: 'stale.mp4', sizeBytes: 1000, title: 'अधूरा' })
    if (!stale.ok) throw new Error(stale.error)
    created.push(stale.footageId)
    await put(stale, fakeVideo(1000))
    const r3 = await runFootageRetention(payload, new Date(Date.now() + 49 * 3600 * 1000))
    const staleRow = await payload.findByID({ collection: 'footage', id: stale.footageId, overrideAccess: true })
    check('retention removes uploads abandoned for 48 hours', r3.abandoned >= 1 && staleRow.uploadStatus === 'deleted')
  } finally {
    for (const id of created) {
      const doc = await payload.findByID({ collection: 'footage', id, overrideAccess: true, disableErrors: true })
      if (doc?.storagePrefix && doc.uploadStatus !== 'deleted') {
        const { deletePrefix } = await import('../src/lib/footage/storage')
        await deletePrefix(doc.storagePrefix).catch(() => {})
      }
      await payload.delete({ collection: 'footage', id, overrideAccess: true }).catch((e) => console.log(`cleanup footage ${id}: ${(e as Error).message}`))
    }
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
