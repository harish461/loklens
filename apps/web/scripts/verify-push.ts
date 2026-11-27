/**
 * End-to-end check of the push pipeline against the LOCAL database (creates and removes its own documents):
 *
 *   npx cross-env NODE_OPTIONS=--no-deprecation payload run scripts/verify-push.ts
 *
 * Publishes test articles and runs the real jobs: publish → pushArticlePublish → pushSend → Expo. The device
 * tokens are well-formed but fake, so Expo answers with ticket errors; that exercises targeting, delivery rows,
 * counters, dead-token deactivation and duplicate prevention without a phone.
 */
import { getPayload, type Payload } from 'payload'

import { validateManualNotification } from '../src/lib/push/manual'
import { cancelManualNotification, createManualNotification } from '../src/lib/push/manualSend'
import config from '../src/payload.config'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

const run = Date.now().toString(36)
const token = (n: number) => `ExponentPushToken[verifypush${run}${n}x]`

async function runJobs(payload: Payload): Promise<void> {
  // Several passes: publish job → send job (which may re-queue itself).
  for (let i = 0; i < 5; i++) await payload.jobs.run({ allQueues: true, limit: 20 })
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? ''
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('verify-push runs against the local database only')
  const payload = await getPayload({ config })
  const created: { collection: 'articles' | 'app-users' | 'push-devices' | 'push-notifications'; id: number }[] = []

  try {
    const category = (await payload.find({ collection: 'categories', limit: 2, depth: 0, overrideAccess: true })).docs
    const image = (
      await payload.find({ collection: 'media', where: { width: { greater_than_equal: 1200 } }, limit: 1, depth: 0, overrideAccess: true })
    ).docs[0]
    if (category.length < 2 || !image) throw new Error('Needs 2 categories and one image ≥ 1200 px (run db:seed first)')
    const [catA, catB] = category
    const adminUser = (await payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!adminUser) throw new Error('Needs one admin user in the local database')
    const adminId = adminUser.id

    const user = await payload.create({
      collection: 'app-users',
      data: { name: 'Push Verify', email: `push-verify-${run}@loklens.test`, password: `Verify-${run}-pass!` },
      overrideAccess: true,
    })
    created.push({ collection: 'app-users', id: user.id })

    const device = async (n: number, preferences: Record<string, unknown>) => {
      const d = await payload.create({
        collection: 'push-devices',
        data: { token: token(n), appUser: user.id, platform: 'android', active: true, preferences },
        overrideAccess: true,
      })
      created.push({ collection: 'push-devices', id: d.id })
      return d
    }
    const wantsAll = await device(1, { enabled: true, breaking: true, general: true, mutedCategories: [] })
    const mutedA = await device(2, { enabled: true, breaking: true, general: true, mutedCategories: [catA.id] })
    const switchedOff = await device(3, { enabled: false, breaking: true, general: true, mutedCategories: [] })
    // Other (real) local devices may exist; only count ours.
    const ours = new Set([wantsAll.id, mutedA.id, switchedOff.id])

    const article = async (title: string, pushOnPublish: 'auto' | 'send' | 'skip', isBreaking: boolean, categoryId: number) => {
      const a = await payload.create({
        collection: 'articles',
        draft: true,
        data: {
          title,
          summary: `${title} — सार`,
          category: categoryId,
          featuredImage: image.id,
          pushOnPublish,
          isBreaking,
          body: { root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0, children: [{ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, textFormat: 0, children: [{ type: 'text', version: 1, text: 'परीक्षण', format: 0, detail: 0, mode: 'normal', style: '' }] }] } },
          _status: 'draft',
        },
        overrideAccess: true,
      })
      created.push({ collection: 'articles', id: a.id })
      return a
    }
    const publish = (id: number) => payload.update({ collection: 'articles', id, data: { _status: 'published' }, overrideAccess: true })
    const notificationsFor = async (articleId: number) =>
      (await payload.find({ collection: 'push-notifications', where: { article: { equals: articleId } }, depth: 0, overrideAccess: true })).docs

    // 1. "send" on a category-A article: only the device that wants everything is targeted.
    const a1 = await article(`पुश परीक्षण ${run} A`, 'send', false, catA.id)
    check('a draft save creates no notification', (await notificationsFor(a1.id)).length === 0)
    await publish(a1.id)
    await runJobs(payload)
    let n1 = await notificationsFor(a1.id)
    check('publishing creates exactly one notification', n1.length === 1, `found ${n1.length}`)
    const n = n1[0]
    n1.forEach((x) => created.push({ collection: 'push-notifications', id: x.id }))
    const deliveries = n
      ? (await payload.find({ collection: 'push-deliveries', where: { notification: { equals: n.id } }, depth: 0, limit: 100, overrideAccess: true })).docs
      : []
    const ourDeliveries = deliveries.filter((d) => ours.has(Number(d.device)))
    check('notification reached status "sent"', n?.status === 'sent', String(n?.status))
    check('only the opted-in device was targeted', ourDeliveries.length === 1 && Number(ourDeliveries[0]?.device) === wantsAll.id, `devices ${ourDeliveries.map((d) => d.device).join(',')}`)
    check('muted-category and switched-off devices were skipped', !ourDeliveries.some((d) => [mutedA.id, switchedOff.id].includes(Number(d.device))))
    const ticket = ourDeliveries[0]
    check('Expo answered the fake token with a ticket error', ticket?.status === 'ticket_error', `${ticket?.status} ${ticket?.errorCode ?? ''}`)
    check('counters were updated', (n?.targeted ?? 0) >= 1 && (n?.failed ?? 0) >= 1, `targeted ${n?.targeted}, failed ${n?.failed}`)
    const deviceAfter = await payload.findByID({ collection: 'push-devices', id: wantsAll.id, depth: 0, overrideAccess: true })
    check(
      'a DeviceNotRegistered token is deactivated',
      ticket?.errorCode === 'DeviceNotRegistered' ? deviceAfter.active === false : true,
      `errorCode ${ticket?.errorCode}, active ${deviceAfter.active}`,
    )

    // 2. Re-saving and re-publishing never sends again.
    await payload.update({ collection: 'articles', id: a1.id, data: { title: `पुश परीक्षण ${run} A (संपादित)` }, overrideAccess: true })
    await payload.update({ collection: 'articles', id: a1.id, data: { _status: 'draft' }, overrideAccess: true })
    await publish(a1.id)
    await runJobs(payload)
    n1 = await notificationsFor(a1.id)
    check('edit + unpublish + republish creates no second notification', n1.length === 1, `found ${n1.length}`)

    // 3. "auto" on a non-breaking article, and "skip": no notification.
    const a2 = await article(`पुश परीक्षण ${run} B`, 'auto', false, catB.id)
    const a3 = await article(`पुश परीक्षण ${run} C`, 'skip', true, catB.id)
    await publish(a2.id)
    await publish(a3.id)
    await runJobs(payload)
    check('"auto" without breaking sends nothing', (await notificationsFor(a2.id)).length === 0)
    check('"skip" sends nothing even for breaking news', (await notificationsFor(a3.id)).length === 0)

    // 4. "auto" on breaking news sends, as type breaking with the prefix.
    const a4 = await article(`पुश परीक्षण ${run} D`, 'auto', true, catB.id)
    await publish(a4.id)
    await runJobs(payload)
    const n4 = await notificationsFor(a4.id)
    n4.forEach((x) => created.push({ collection: 'push-notifications', id: x.id }))
    check('"auto" on breaking news sends a breaking notification', n4.length === 1 && n4[0].type === 'breaking' && n4[0].title.startsWith('बड़ी खबर: '), n4[0]?.title)

    // 5. Manual notifications (the admin "Create notification" path, lib/push/manualSend.ts).
    const breakingOn = await device(5, { enabled: true, breaking: true, general: true, mutedCategories: [] })
    const breakingOff = await device(6, { enabled: true, breaking: false, general: true, mutedCategories: [] })
    const form = (over: Record<string, unknown>) => {
      const r = validateManualNotification({ title: `मैनुअल ${run}`, body: 'संदेश', type: 'general', audience: 'breaking', idempotencyKey: `verify-${run}-1`, ...over })
      if (!r.ok) throw new Error(r.errors.join(' '))
      return r.value
    }
    const sent = await createManualNotification(payload, adminId, form({}))
    if (sent.ok) created.push({ collection: 'push-notifications', id: sent.id })
    const manual = sent.ok ? await payload.findByID({ collection: 'push-notifications', id: sent.id, depth: 0, overrideAccess: true }) : null
    const manualDeliveries = manual
      ? (await payload.find({ collection: 'push-deliveries', where: { notification: { equals: manual.id } }, depth: 0, limit: 100, overrideAccess: true })).docs.map((d) => Number(d.device))
      : []
    check('"send now" runs immediately (status sent)', manual?.status === 'sent', String(manual?.status))
    check('audience "breaking subscribers" skips readers with breaking off', manualDeliveries.includes(breakingOn.id) && !manualDeliveries.includes(breakingOff.id), `devices ${manualDeliveries.join(',')}`)
    const again = await createManualNotification(payload, adminId, form({}))
    check('a double submit with the same form key does not send twice', again.ok && again.reused && again.id === (sent.ok ? sent.id : -1))

    const later = await createManualNotification(payload, adminId, form({ idempotencyKey: `verify-${run}-2`, scheduledAt: new Date(Date.now() + 2 * 3600_000).toISOString() }))
    if (later.ok) created.push({ collection: 'push-notifications', id: later.id })
    await runJobs(payload)
    const laterDoc = later.ok ? await payload.findByID({ collection: 'push-notifications', id: later.id, depth: 0, overrideAccess: true }) : null
    check('a scheduled notification waits for its time', laterDoc?.status === 'scheduled', String(laterDoc?.status))
    const cancelled = later.ok ? await cancelManualNotification(payload, later.id) : { ok: false as const, error: 'not created' }
    const cancelledDoc = later.ok ? await payload.findByID({ collection: 'push-notifications', id: later.id, depth: 0, overrideAccess: true }) : null
    check('a scheduled notification can be cancelled', cancelled.ok && cancelledDoc?.status === 'cancelled', String(cancelledDoc?.status))
  } finally {
    // Clean up in dependency order (deliveries/events reference notifications and devices).
    const notificationIds = created.filter((c) => c.collection === 'push-notifications').map((c) => c.id)
    if (notificationIds.length) {
      await payload.delete({ collection: 'push-deliveries', where: { notification: { in: notificationIds } }, overrideAccess: true })
      await payload.delete({ collection: 'push-events', where: { notification: { in: notificationIds } }, overrideAccess: true })
    }
    for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id, overrideAccess: true }).catch(() => {})
    console.log(`cleaned up ${created.length} test documents`)
  }

  await payload.destroy()
  console.log(failures === 0 ? '\nAll push checks passed.' : `\n${failures} push check(s) FAILED.`)
  process.exitCode = failures === 0 ? 0 : 1
}

// `payload run` ends once the module has loaded, so the work must be awaited at the top level.
await main()
