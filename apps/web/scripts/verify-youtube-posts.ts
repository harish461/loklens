/**
 * Role checks for the YouTube Studio post workflow (lib/youtube/postService.ts) against the LOCAL database.
 * Creates and removes its own rows; nothing touches S3 or YouTube:
 *
 *   npx cross-env NODE_OPTIONS=--no-deprecation tsx --env-file=.env scripts/verify-youtube-posts.ts
 */
import { getPayload, type Payload } from 'payload'

import { changePostStatus, savePost } from '../src/lib/youtube/postService'
import { postDetail } from '../src/lib/youtube/studioQueries'
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

const ALL = { rights: true, minors: true, defamation: true, accuracy: true }

async function main(): Promise<void> {
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '')) throw new Error('local database only')
  const payload = await getPayload({ config })
  const admin = await userWithRole(payload, 'admin')
  const editor = await userWithRole(payload, 'editor')
  const reporter = await userWithRole(payload, 'reporter')
  if (!admin || !editor || !reporter) throw new Error('Needs an admin, an editor and a reporter in the local database.')
  const run = Date.now().toString(36)
  const posts: number[] = []
  const footageIds: number[] = []

  try {
    const footage = await payload.create({
      collection: 'footage',
      data: { title: `posts ${run}`, rightsConfirmed: true, uploadStatus: 'uploading' },
      overrideAccess: true,
    })
    footageIds.push(footage.id)
    await payload.update({
      collection: 'footage',
      id: footage.id,
      data: { uploadStatus: 'uploaded', storagePrefix: `footage/${footage.id}-verify${run}`, width: 1920, height: 1080, durationSeconds: 120, retainUntil: new Date(Date.now() + 86400000).toISOString() },
      overrideAccess: true,
    })

    const base = { title: 'हरिद्वार में गंगा आरती', description: 'परीक्षण विवरण', tags: 'हरिद्वार, ganga aarti', hashtags: 'उत्तराखंड', footage: footage.id, privacyStatus: 'unlisted' }

    const byReporter = await savePost(payload, reporter, base)
    check('a reporter cannot create posts', !byReporter.ok)

    const created = await savePost(payload, editor, { ...base, ...({ status: 'approved', approvedBy: admin.id } as object) })
    if (!created.ok) throw new Error(created.error)
    posts.push(created.id)
    check('an editor creates a draft (client status ignored)', created.status === 'draft')

    const tooLong = await savePost(payload, editor, { ...base, id: created.id, title: 'क'.repeat(101) })
    check('a title over 100 characters is refused with a message', !tooLong.ok && /100/.test(tooLong.ok ? '' : tooLong.error))

    const submit = await changePostStatus(payload, editor, created.id, 'submit')
    check('editor submits for review', submit.ok && submit.status === 'pending_review')

    const editorApprove = await changePostStatus(payload, editor, created.id, 'approve', { checklist: ALL })
    check('an editor cannot approve', !editorApprove.ok)

    const noChecklist = await changePostStatus(payload, admin, created.id, 'approve', { checklist: { rights: true } })
    check('approval needs the full checklist', !noChecklist.ok)

    const rejectNoNote = await changePostStatus(payload, admin, created.id, 'reject')
    check('returning a post needs a note', !rejectNoNote.ok)

    const reject = await changePostStatus(payload, admin, created.id, 'reject', { note: 'शीर्षक में स्थान जोड़ें' })
    check('admin returns it with a note', reject.ok && reject.status === 'draft')
    let detail = await postDetail(payload, editor, created.id)
    check('the note is shown to the editor', detail?.reviewNote === 'शीर्षक में स्थान जोड़ें')

    await savePost(payload, editor, { ...base, id: created.id, title: 'हरिद्वार: हर की पैड़ी पर गंगा आरती' })
    await changePostStatus(payload, editor, created.id, 'submit')
    const approve = await changePostStatus(payload, admin, created.id, 'approve', { checklist: ALL })
    check('admin approves with the checklist', approve.ok && approve.status === 'approved')
    let f = await payload.findByID({ collection: 'footage', id: footage.id, overrideAccess: true })
    check('approval locks the footage and stops its expiry', Boolean(f.lockedAt) && !f.retainUntil)

    const edited = await savePost(payload, editor, { ...base, id: created.id, title: 'हरिद्वार: गंगा आरती (बदला शीर्षक)' })
    check('editing an approved post sends it back to review', edited.ok && edited.status === 'pending_review')

    await changePostStatus(payload, admin, created.id, 'approve', { checklist: ALL })
    const cancel = await changePostStatus(payload, editor, created.id, 'cancel')
    check('an editor can cancel before upload', cancel.ok && cancel.status === 'cancelled')
    f = await payload.findByID({ collection: 'footage', id: footage.id, overrideAccess: true })
    check('cancelling releases the footage (unlocked, expiry set again)', !f.lockedAt && Boolean(f.retainUntil))

    const reopen = await changePostStatus(payload, admin, created.id, 'submit')
    check('a cancelled post stays cancelled', !reopen.ok)

    detail = await postDetail(payload, admin, created.id)
    const types = detail?.events.map((e) => e.type).reverse().join(',')
    check(
      'every step is in the history',
      types === 'created,submitted,rejected,submitted,approved,submitted,approved,cancelled',
      types,
    )

    // retry path: a failed post (set by the "job") can be re-approved only by an admin with the checklist
    const second = await savePost(payload, editor, { ...base, title: 'दूसरी पोस्ट' })
    if (!second.ok) throw new Error(second.error)
    posts.push(second.id)
    await changePostStatus(payload, editor, second.id, 'submit')
    await changePostStatus(payload, admin, second.id, 'approve', { checklist: ALL })
    await payload.update({ collection: 'youtube-posts', id: second.id, data: { status: 'failed', lastError: 'test' }, overrideAccess: true, context: { youtubeJob: true } })
    const editorRetry = await changePostStatus(payload, editor, second.id, 'retry', { checklist: ALL })
    check('an editor cannot retry a failed upload', !editorRetry.ok)
    const retry = await changePostStatus(payload, admin, second.id, 'retry', { checklist: ALL })
    check('an admin retries a failed upload', retry.ok && retry.status === 'approved')

    const reporterRead = await postDetail(payload, reporter, second.id).catch(() => null)
    check('a reporter cannot read posts', reporterRead === null)
  } finally {
    for (const id of posts) {
      const ev = await payload.find({ collection: 'youtube-post-events', where: { post: { equals: id } }, limit: 200, overrideAccess: true })
      for (const e of ev.docs) await payload.delete({ collection: 'youtube-post-events', id: e.id, overrideAccess: true })
      await payload.delete({ collection: 'youtube-posts', id, overrideAccess: true }).catch((e) => console.log(`cleanup post ${id}: ${(e as Error).message}`))
    }
    for (const id of footageIds) await payload.delete({ collection: 'footage', id, overrideAccess: true }).catch(() => {})
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
