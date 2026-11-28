/**
 * End-to-end check of the YouTube Studio data model against the LOCAL database (creates and removes its own
 * documents; nothing is uploaded to YouTube or S3):
 *
 *   npx cross-env NODE_OPTIONS=--no-deprecation tsx --env-file=.env scripts/verify-youtube.ts
 *
 * (`payload run` swallowed this script's output on Windows; tsx prints it.)
 *
 * Runs the real Payload access rules and the guard hook as an editor, an admin, a reporter, anonymous and the
 * publisher job (context.youtubeJob).
 */
import { getPayload, type Payload } from 'payload'

import { approvalHash } from '../src/access/youtube'
import config from '../src/payload.config'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

async function rejects(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (err) {
    return (err as Error).message || 'error'
  }
}

type StaffUser = { id: number; role: string; collection: 'users' }

async function userWithRole(payload: Payload, role: string): Promise<StaffUser | null> {
  const doc = (await payload.find({ collection: 'users', where: { role: { equals: role } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  return doc ? { ...(doc as unknown as StaffUser), collection: 'users' } : null
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? ''
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('verify-youtube runs against the local database only')
  const payload = await getPayload({ config })
  const admin = await userWithRole(payload, 'admin')
  const editor = await userWithRole(payload, 'editor')
  const reporter = await userWithRole(payload, 'reporter')
  if (!admin || !editor) throw new Error('Needs an admin and an editor user in the local database (npm run db:seed).')
  const created: { collection: 'footage' | 'youtube-posts'; id: number }[] = []
  const run = Date.now().toString(36)

  try {
    // ---- footage ----
    const footage = await payload.create({
      collection: 'footage',
      data: { title: `verify ${run}`, rightsConfirmed: true },
      user: editor,
      overrideAccess: false,
    })
    created.push({ collection: 'footage', id: footage.id })
    check('editor creates footage; storage fields stay server-set', footage.uploadStatus === 'uploading' && !footage.storagePrefix)

    const forged = await payload.create({
      collection: 'footage',
      data: { title: `forged ${run}`, uploadStatus: 'uploaded', storagePrefix: `footage/forged-${run}`, width: 1, height: 2 } as never,
      user: editor,
      overrideAccess: false,
    })
    created.push({ collection: 'footage', id: forged.id })
    check('clients cannot set upload status or storage fields', forged.uploadStatus === 'uploading' && !forged.storagePrefix && forged.width == null)

    // The upload server action (Phase 4) marks the footage uploaded with overrideAccess.
    await payload.update({
      collection: 'footage',
      id: footage.id,
      data: { uploadStatus: 'uploaded', storagePrefix: `footage/verify-${run}`, sizeBytes: 1000, width: 1920, height: 1080, durationSeconds: 90 },
      overrideAccess: true,
    })
    const stored = await payload.findByID({ collection: 'footage', id: footage.id, overrideAccess: true })
    check('orientation is derived on the server', stored.orientation === 'landscape', String(stored.orientation))

    const anon = await rejects(() => payload.find({ collection: 'footage', overrideAccess: false }))
    check('anonymous cannot read footage', anon !== null)
    if (reporter) {
      const seen = await payload.find({ collection: 'footage', where: { id: { equals: footage.id } }, user: reporter, overrideAccess: false })
      check("a reporter does not see another user's footage", seen.docs.length === 0)
      const reporterPost = await rejects(() =>
        payload.create({ collection: 'youtube-posts', data: { title: 'x' }, user: reporter, overrideAccess: false }),
      )
      check('a reporter cannot create YouTube posts', reporterPost !== null)
    } else {
      console.log('SKIP  reporter checks (no reporter user in the local database)')
    }

    // ---- posts: draft → review → approval ----
    const post = await payload.create({
      collection: 'youtube-posts',
      data: {
        title: 'देहरादून में भारी बारिश',
        description: 'जांच के लिए परीक्षण पोस्ट।',
        tags: ['देहरादून न्यूज़'],
        hashtags: ['#उत्तराखंड'],
        footage: footage.id,
        approvedBy: editor.id,
        approvedHash: 'forged',
        youtubeVideoId: 'forgedforge',
      } as never,
      user: editor,
      overrideAccess: false,
    })
    created.push({ collection: 'youtube-posts', id: post.id })
    check('a new post is a draft, unlisted by default', post.status === 'draft' && post.privacyStatus === 'unlisted')
    check('approval stamps and job fields cannot be forged', !post.approvedBy && !post.approvedHash && !post.youtubeVideoId)

    const tooLong = await rejects(() =>
      payload.update({ collection: 'youtube-posts', id: post.id, data: { description: 'क'.repeat(1700) }, user: editor, overrideAccess: false }),
    )
    check('a description over 5000 bytes is refused', tooLong !== null && /bytes/.test(tooLong), tooLong ?? '')

    const skip = await rejects(() =>
      payload.update({ collection: 'youtube-posts', id: post.id, data: { status: 'approved' }, user: admin, overrideAccess: false }),
    )
    check('a draft cannot jump to approved', skip !== null)

    const submitted = await payload.update({ collection: 'youtube-posts', id: post.id, data: { status: 'pending_review' }, user: editor, overrideAccess: false })
    check('editor submits for review', submitted.status === 'pending_review' && Boolean(submitted.submittedAt))

    const editorApprove = await rejects(() =>
      payload.update({ collection: 'youtube-posts', id: post.id, data: { status: 'approved' }, user: editor, overrideAccess: false }),
    )
    check('an editor cannot approve', editorApprove !== null && /Only admins/.test(editorApprove))

    const approved = await payload.update({ collection: 'youtube-posts', id: post.id, data: { status: 'approved' }, user: admin, overrideAccess: false })
    check(
      'admin approves; stamp and hash are stored',
      approved.status === 'approved' && Boolean(approved.approvedAt) && approved.approvedHash === approvalHash(approved as never),
    )

    const sessionHidden = await payload.findByID({ collection: 'youtube-posts', id: post.id, user: admin, overrideAccess: false })
    check('uploadSessionUri is never readable over the API', !('uploadSessionUri' in sessionHidden) || sessionHidden.uploadSessionUri == null)

    // ---- the job ----
    const editorUpload = await rejects(() =>
      payload.update({ collection: 'youtube-posts', id: post.id, data: { status: 'uploading' }, user: admin, overrideAccess: false }),
    )
    check('admins cannot set job statuses', editorUpload !== null)

    const noJobFlag = await rejects(() =>
      payload.update({ collection: 'youtube-posts', id: post.id, data: { status: 'uploading' }, overrideAccess: true }),
    )
    check('a user-less write without the job flag is refused', noJobFlag !== null)

    const uploading = await payload.update({
      collection: 'youtube-posts',
      id: post.id,
      data: { status: 'uploading', uploadSessionUri: 'https://upload.example/session', uploadStartedAt: new Date().toISOString() },
      overrideAccess: true,
      context: { youtubeJob: true },
    })
    check('the job moves an approved post to uploading', uploading.status === 'uploading')

    const frozen = await rejects(() =>
      payload.update({ collection: 'youtube-posts', id: post.id, data: { title: 'बदला' }, user: admin, overrideAccess: false }),
    )
    check('a post on its way to YouTube is frozen', frozen !== null)

    // ---- edit after approval → back to review ----
    const post2 = await payload.create({
      collection: 'youtube-posts',
      data: { title: 'दूसरी पोस्ट', footage: footage.id, status: 'pending_review' },
      user: editor,
      overrideAccess: false,
    })
    created.push({ collection: 'youtube-posts', id: post2.id })
    await payload.update({ collection: 'youtube-posts', id: post2.id, data: { status: 'approved' }, user: admin, overrideAccess: false })
    const edited = await payload.update({ collection: 'youtube-posts', id: post2.id, data: { title: 'दूसरी पोस्ट (बदली)' }, user: editor, overrideAccess: false })
    check('editing an approved post sends it back to review', edited.status === 'pending_review' && !edited.approvedHash)

    // ---- settings global ----
    const settings = await payload.findGlobal({ slug: 'youtube-settings', user: editor, overrideAccess: false })
    check('settings default: uploads off, unlisted', settings.enabled === false && settings.defaultPrivacy === 'unlisted')
    const editorSettings = await rejects(() =>
      payload.updateGlobal({ slug: 'youtube-settings', data: { enabled: true }, user: editor, overrideAccess: false }),
    )
    check('only admins change YouTube settings', editorSettings !== null)

    // ---- events ----
    const eventCreate = await rejects(() =>
      payload.create({ collection: 'youtube-post-events', data: { post: post.id, type: 'approved' }, user: admin, overrideAccess: false }),
    )
    check('history cannot be written over the API', eventCreate !== null)
  } finally {
    for (const c of [...created].reverse()) {
      await payload.delete({ collection: c.collection, id: c.id, overrideAccess: true, context: { youtubeJob: true } }).catch((e) => {
        console.log(`cleanup ${c.collection} ${c.id}: ${(e as Error).message}`)
      })
    }
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
