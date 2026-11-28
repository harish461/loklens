/**
 * REAL end-to-end publisher test: local database + private footage bucket + the @loklensnews channel.
 * Uploads one short video as PRIVATE (nobody else can see it), notifySubscribers=false, then DELETES it from
 * YouTube and removes every row and object it created. Local database only.
 *
 *   npx cross-env NODE_OPTIONS=--no-deprecation tsx --env-file=.env \
 *     --env-file=../../tools/ai-spike/.env --env-file=../../tools/ai-spike/.env.oauth \
 *     scripts/verify-publisher.ts <path-to-small-video.mp4>
 *
 * Quota: 1 upload (of 100/day) + ~50 (thumbnail) + ~10 (polls) + 50 (delete) of 10,000 units.
 */
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'

import { completeFootageUpload, startFootageUpload } from '../src/lib/footage/service'
import { deletePrefix, readMediaObject } from '../src/lib/footage/storage'
import { googleAccessToken } from '../src/lib/google/oauth'
import { getVideoState } from '../src/lib/youtube/api'
import { changePostStatus, savePost } from '../src/lib/youtube/postService'
import { runPublisherStep } from '../src/lib/youtube/publisher'
import config from '../src/payload.config'
import type { User, YoutubePost } from '../src/payload-types'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function userWithRole(payload: Payload, role: string): Promise<User> {
  const doc = (await payload.find({ collection: 'users', where: { role: { equals: role } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!doc) throw new Error(`Needs a ${role} in the local database.`)
  return { ...doc, collection: 'users' } as User
}

async function main(): Promise<void> {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '')) throw new Error('local database only')
  const file = process.argv[2]
  if (!file) throw new Error('Usage: verify-publisher.ts <small-video.mp4>')
  process.env.YOUTUBE_STUDIO_ENABLED = 'true'
  process.env.YOUTUBE_CHUNK_MB = '1' // several chunks even for a small file
  const payload = await getPayload({ config })
  const editor = await userWithRole(payload, 'editor')
  const admin = await userWithRole(payload, 'admin')
  const ALL = { rights: true, minors: true, defamation: true, accuracy: true }
  let footageId: number | null = null
  let postId: number | null = null
  let videoId: string | null = null
  const settingsBefore = await payload.findGlobal({ slug: 'youtube-settings', overrideAccess: true })

  try {
    // ---- footage (real bucket) ----
    const bytes = readFileSync(file)
    const start = await startFootageUpload(payload, editor, {
      filename: path.basename(file),
      sizeBytes: statSync(file).size,
      mimeType: 'video/mp4',
      title: 'प्रकाशक परीक्षण',
      rightsConfirmed: true,
    })
    if (!start.ok) throw new Error(start.error)
    footageId = start.footageId
    for (const s of start.segments) {
      const res = await fetch(s.url, { method: 'PUT', body: bytes.subarray((s.n - 1) * start.segmentBytes, s.n * start.segmentBytes) })
      if (!res.ok) throw new Error(`segment ${s.n}: HTTP ${res.status}`)
    }
    const done = await completeFootageUpload(payload, editor, footageId, { durationSeconds: 5, width: 1920, height: 1080 })
    check('footage uploaded to the private bucket', done.ok, done.ok ? '' : done.error)

    // A thumbnail whose original exists in the media bucket.
    let thumbnail: number | null = null
    for (const m of (await payload.find({ collection: 'media', sort: '-createdAt', limit: 30, overrideAccess: true })).docs) {
      if (!m.filename || !/^image\/(jpeg|png|webp)$/.test(m.mimeType ?? '')) continue
      const ok = await readMediaObject(`${m.prefix || 'images'}/${m.filename}`).then((b) => b.length > 0).catch(() => false)
      if (ok) {
        thumbnail = m.id
        break
      }
    }
    check('found a thumbnail image in the media bucket', thumbnail !== null)

    // ---- post: draft → review → approved (PRIVATE, no notification) ----
    const saved = await savePost(payload, editor, {
      postType: 'video',
      footage: footageId,
      thumbnail,
      title: 'LokLens परीक्षण अपलोड – कृपया अनदेखा करें',
      description: 'स्वचालित परीक्षण। यह वीडियो निजी है और तुरंत हटा दिया जाएगा।',
      tags: 'loklens-test',
      hashtags: 'LokLensTest',
      privacyStatus: 'private',
      notifySubscribers: false,
    })
    if (!saved.ok) throw new Error(saved.error)
    postId = saved.id
    await changePostStatus(payload, editor, postId, 'submit')
    const approved = await changePostStatus(payload, admin, postId, 'approve', { checklist: ALL })
    check('post approved by an admin', approved.ok && approved.status === 'approved')

    // ---- switches ----
    await payload.updateGlobal({ slug: 'youtube-settings', data: { enabled: false }, overrideAccess: true })
    const off = await runPublisherStep(payload)
    check('publisher does nothing while the admin switch is off', off.action === 'idle', 'reason' in off ? off.reason : '')
    await payload.updateGlobal({ slug: 'youtube-settings', data: { enabled: true }, overrideAccess: true })

    // ---- lease ----
    await payload.db.drizzle.execute(sql`UPDATE "youtube_posts" SET "lease_until" = now() + interval '1 minute' WHERE "id" = ${postId}`)
    const busy = await runPublisherStep(payload)
    check('a post leased by another runner is skipped', busy.action === 'busy')
    await payload.db.drizzle.execute(sql`UPDATE "youtube_posts" SET "lease_until" = NULL WHERE "id" = ${postId}`)

    // ---- first step through the real job wiring: schedule → queue youtube → task ----
    await payload.jobs.handleSchedules({ queue: 'youtube' })
    const queued = await payload.count({ collection: 'payload-jobs', where: { and: [{ taskSlug: { equals: 'youtubePublish' } }, { queue: { equals: 'youtube' } }] }, overrideAccess: true })
    check('the schedule queues youtubePublish on the youtube queue', queued.totalDocs >= 1, `${queued.totalDocs} job(s)`)
    // Payload queues a scheduled job for its NEXT run time (the next minute); the cron call a minute later runs
    // it. Make it due now instead of waiting.
    await payload.db.drizzle.execute(sql`UPDATE "payload_jobs" SET "wait_until" = now() WHERE "task_slug" = 'youtubePublish'`)
    await payload.jobs.run({ queue: 'youtube', limit: 1 })
    let post = (await payload.findByID({ collection: 'youtube-posts', id: postId, overrideAccess: true })) as YoutubePost
    check('job step 1: upload session opened, first chunk sent', post.status === 'uploading' && Number(post.bytesUploaded) > 0, `${post.status}, ${post.bytesUploaded} bytes`)

    // ---- remaining steps (time-boxed like the cron: short budget, so several runs) ----
    for (let i = 0; i < 40; i++) {
      post = (await payload.findByID({ collection: 'youtube-posts', id: postId, overrideAccess: true })) as YoutubePost
      if (post.status === 'published' || post.status === 'failed') break
      // Do not wait for the poll delay in a test.
      await payload.db.drizzle.execute(sql`UPDATE "youtube_posts" SET "next_check_at" = NULL WHERE "id" = ${postId}`)
      const r = await runPublisherStep(payload, { budgetMs: 1 })
      console.log(`      step: ${r.action}${'detail' in r && r.detail ? ` ${JSON.stringify(r.detail)}` : ''}`)
      if (r.action === 'processing') await sleep(15_000)
    }
    post = (await payload.findByID({ collection: 'youtube-posts', id: postId, overrideAccess: true })) as YoutubePost
    videoId = post.youtubeVideoId ?? null
    check('video uploaded in several time-boxed steps', Boolean(videoId))
    check('post reached published', post.status === 'published', `${post.status}${post.lastError ? `: ${post.lastError}` : ''}`)
    check('upload session URL cleared after upload', !post.uploadSessionUri)

    if (videoId) {
      const state = await getVideoState(videoId)
      check('YouTube has it as PRIVATE (as approved)', state?.privacyStatus === 'private', JSON.stringify(state))
    }
    const events = await payload.find({ collection: 'youtube-post-events', where: { post: { equals: postId } }, sort: 'createdAt', limit: 100, overrideAccess: true })
    const types = events.docs.map((e) => e.type)
    check('history has upload_started, chunk, uploaded, processed, published', ['upload_started', 'chunk', 'uploaded', 'processed', 'published'].every((t) => types.includes(t)), types.join(','))
    const thumb = events.docs.find((e) => e.type === 'thumbnail_set')
    check('thumbnail step ran', Boolean(thumb), JSON.stringify(thumb?.detail ?? null))
    const f = await payload.findByID({ collection: 'footage', id: footageId, overrideAccess: true })
    check('footage released for retention after publishing', !f.lockedAt && Boolean(f.retainUntil))
  } finally {
    if (videoId) {
      const token = await googleAccessToken()
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      console.log(res.status === 204 ? `deleted test video ${videoId} from YouTube` : `COULD NOT DELETE test video ${videoId}: HTTP ${res.status}`)
    }
    if (postId) {
      await payload.delete({ collection: 'youtube-post-events', where: { post: { equals: postId } }, overrideAccess: true })
      await payload.delete({ collection: 'youtube-posts', id: postId, overrideAccess: true }).catch((e) => console.log(`cleanup post: ${(e as Error).message}`))
    }
    if (footageId) {
      const f = await payload.findByID({ collection: 'footage', id: footageId, overrideAccess: true, disableErrors: true })
      if (f?.storagePrefix) await deletePrefix(f.storagePrefix).catch(() => {})
      await payload.delete({ collection: 'footage', id: footageId, overrideAccess: true }).catch(() => {})
    }
    await payload.delete({ collection: 'payload-jobs', where: { taskSlug: { equals: 'youtubePublish' } }, overrideAccess: true }).catch(() => {})
    await payload.updateGlobal({ slug: 'youtube-settings', data: { enabled: Boolean(settingsBefore.enabled) }, overrideAccess: true })
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
