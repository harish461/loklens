import { describe, expect, it } from 'vitest'

import type { AccessUser } from '@/access/roles'
import {
  approvalHash,
  approvalStillValid,
  footageProblems,
  orientationOf,
  planYoutubePostChange,
  readFootage,
  tagsLength,
  updateFootage,
  youtubeMetadataProblems,
  type YtChangeInput,
} from '@/access/youtube'

const admin: AccessUser = { id: 1, role: 'admin', collection: 'users' }
const editor: AccessUser = { id: 2, role: 'editor', collection: 'users' }
const reporter: AccessUser = { id: 3, role: 'reporter', collection: 'users' }
const NOW = new Date('2026-11-28T06:00:00.000Z')

const readyFootage = { uploadStatus: 'uploaded', width: 1920, height: 1080, durationSeconds: 95 }
const verticalFootage = { uploadStatus: 'uploaded', width: 1080, height: 1920, durationSeconds: 60 }

const basePost = {
  postType: 'video',
  footage: 10,
  title: 'देहरादून में भारी बारिश, कई सड़कें बंद',
  description: 'देहरादून में रातभर हुई बारिश से कई इलाकों में जलभराव हुआ।',
  tags: ['देहरादून न्यूज़', 'uttarakhand news'],
  hashtags: ['#उत्तराखंड', '#Dehradun'],
  privacyStatus: 'unlisted',
  notifySubscribers: true,
}

const plan = (input: Partial<YtChangeInput>) =>
  planYoutubePostChange({ user: editor, isJob: false, operation: 'update', data: {}, now: NOW, footage: readyFootage, ...input })

/** A stored post that an admin approved. */
function approvedPost(extra: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = { id: 5, ...basePost, status: 'approved', approvedAt: NOW.toISOString(), approvedBy: 1, ...extra }
  doc.approvedHash = approvalHash(doc)
  return doc
}

describe('YouTube metadata limits', () => {
  it('accepts normal Hindi metadata', () => {
    expect(youtubeMetadataProblems(basePost, { requireTitle: true })).toEqual([])
  })

  it('title: required on submit, ≤100 characters (not bytes), no < >', () => {
    expect(youtubeMetadataProblems({ title: '' }, { requireTitle: true })).toContain('A title is required.')
    expect(youtubeMetadataProblems({ title: 'क'.repeat(100) })).toEqual([])
    expect(youtubeMetadataProblems({ title: 'क'.repeat(101) }).join()).toMatch(/longer than 100/)
    expect(youtubeMetadataProblems({ title: 'a <b>' }).join()).toMatch(/< or >/)
  })

  it('description counts BYTES: 1666 Devanagari characters fit, 1667 do not', () => {
    expect(youtubeMetadataProblems({ description: 'क'.repeat(1666) })).toEqual([]) // 4998 bytes
    expect(youtubeMetadataProblems({ description: 'क'.repeat(1667) }).join()).toMatch(/5001 bytes/)
  })

  it('tags: total length as YouTube counts it (quotes for spaces, separators)', () => {
    expect(tagsLength(['ab', 'c d'])).toBe(2 + 3 + 2 + 1)
    expect(youtubeMetadataProblems({ tags: Array(60).fill('abcdefghi') }).join()).toMatch(/500 characters/)
    expect(youtubeMetadataProblems({ tags: ['a,b'] }).join()).toMatch(/commas/)
  })

  it('hashtags: at most 15, each #word without spaces', () => {
    expect(youtubeMetadataProblems({ hashtags: Array(16).fill('#x') }).join()).toMatch(/At most 15/)
    expect(youtubeMetadataProblems({ hashtags: ['no hash'] }).join()).toMatch(/not a valid hashtag/)
    expect(youtubeMetadataProblems({ hashtags: ['#दो शब्द'] }).join()).toMatch(/not a valid hashtag/)
    expect(youtubeMetadataProblems({ hashtags: ['#उत्तराखंड'] })).toEqual([])
  })
})

describe('footage', () => {
  it('orientation', () => {
    expect(orientationOf(1920, 1080)).toBe('landscape')
    expect(orientationOf(1080, 1920)).toBe('vertical')
    expect(orientationOf(720, 720)).toBe('square')
    expect(orientationOf(undefined, 5)).toBeNull()
  })

  it('must be fully uploaded', () => {
    expect(footageProblems('video', null)).toHaveLength(1)
    expect(footageProblems('video', { ...readyFootage, uploadStatus: 'uploading' }).join()).toMatch(/not finished/)
    expect(footageProblems('video', readyFootage)).toEqual([])
  })

  it('a Short is vertical or square and at most 3 minutes', () => {
    expect(footageProblems('short', verticalFootage)).toEqual([])
    expect(footageProblems('short', { ...verticalFootage, width: 720, height: 720 })).toEqual([])
    expect(footageProblems('short', readyFootage).join()).toMatch(/vertical or square/)
    expect(footageProblems('short', { ...verticalFootage, durationSeconds: 181 }).join()).toMatch(/3 minutes/)
    expect(footageProblems('short', { uploadStatus: 'uploaded' }).length).toBe(2)
  })

  it('access: editors all, reporters own (and only until locked), anonymous nothing', () => {
    expect(readFootage(editor)).toBe(true)
    expect(readFootage(reporter)).toEqual({ createdBy: { equals: 3 } })
    expect(readFootage(null)).toBe(false)
    expect(updateFootage(admin)).toBe(true)
    expect(updateFootage(reporter)).toEqual({ and: [{ createdBy: { equals: 3 } }, { lockedAt: { exists: false } }] })
    expect(updateFootage(undefined)).toBe(false)
  })
})

describe('approval hash', () => {
  it('is stable for relationship objects vs ids and ignores unrelated fields', () => {
    const a = approvalHash({ ...basePost, footage: 10, reviewNote: 'x', article: 7 })
    const b = approvalHash({ ...basePost, footage: { id: 10, title: 'clip' }, reviewNote: 'y', article: 8 })
    expect(a).toBe(b)
  })

  it('changes with anything that goes to YouTube', () => {
    const h = approvalHash(basePost)
    for (const change of [
      { title: basePost.title + '!' },
      { footage: 11 },
      { thumbnail: 4 },
      { tags: ['x'] },
      { privacyStatus: 'public' },
      { publishAt: '2026-12-01T10:00:00Z' },
      { postType: 'short' },
      { notifySubscribers: false },
    ]) {
      expect(approvalHash({ ...basePost, ...change })).not.toBe(h)
    }
  })

  it('approvalStillValid: true for an untouched approval, false after a change or without approval', () => {
    expect(approvalStillValid(approvedPost())).toBe(true)
    expect(approvalStillValid({ ...approvedPost(), title: 'बदला हुआ' })).toBe(false)
    expect(approvalStillValid({ ...basePost })).toBe(false)
    expect(approvalStillValid(null)).toBe(false)
  })
})

describe('planYoutubePostChange: who', () => {
  it('reporters, anonymous and user-less non-job calls are refused', () => {
    for (const user of [reporter, null, undefined]) {
      const r = planYoutubePostChange({ user, isJob: false, operation: 'create', data: basePost })
      expect(r.violations.join()).toMatch(/Only editors and admins/)
    }
  })

  it('an editor creates a draft; status defaults to draft', () => {
    const r = planYoutubePostChange({ user: editor, isJob: false, operation: 'create', data: basePost, now: NOW })
    expect(r.violations).toEqual([])
    expect(r.set.status).toBe('draft')
  })

  it('a new post cannot start approved or published, and the job cannot create posts', () => {
    expect(planYoutubePostChange({ user: admin, isJob: false, operation: 'create', data: { ...basePost, status: 'approved' } }).violations.length).toBeGreaterThan(0)
    expect(planYoutubePostChange({ user: admin, isJob: false, operation: 'create', data: { ...basePost, status: 'published' } }).violations.length).toBeGreaterThan(0)
    expect(planYoutubePostChange({ user: null, isJob: true, operation: 'create', data: basePost }).violations.join()).toMatch(/cannot create/)
  })
})

describe('planYoutubePostChange: review and approval', () => {
  it('submit: checks title and footage, stamps submittedBy/At', () => {
    const r = plan({ originalDoc: { ...basePost, status: 'draft' }, data: { status: 'pending_review' } })
    expect(r.violations).toEqual([])
    expect(r.set).toMatchObject({ status: 'pending_review', submittedBy: 2, submittedAt: NOW.toISOString(), approvedAt: null })
  })

  it('submit is refused with an empty title or unfinished footage', () => {
    expect(plan({ originalDoc: { ...basePost, title: '', status: 'draft' }, data: { status: 'pending_review' } }).violations.join()).toMatch(/title is required/)
    const r = plan({ originalDoc: { ...basePost, status: 'draft' }, data: { status: 'pending_review' }, footage: { uploadStatus: 'uploading' } })
    expect(r.violations.join()).toMatch(/not finished/)
  })

  it('a Short with landscape footage cannot be submitted', () => {
    const r = plan({ originalDoc: { ...basePost, postType: 'short', status: 'draft' }, data: { status: 'pending_review' } })
    expect(r.violations.join()).toMatch(/vertical or square/)
  })

  it('only admins approve; approval stamps who, when and the hash of what was approved', () => {
    const pending = { ...basePost, status: 'pending_review' }
    expect(plan({ user: editor, originalDoc: pending, data: { status: 'approved' } }).violations.join()).toMatch(/Only admins/)
    const r = plan({ user: admin, originalDoc: pending, data: { status: 'approved' } })
    expect(r.violations).toEqual([])
    expect(r.set).toMatchObject({ status: 'approved', approvedBy: 1, approvedAt: NOW.toISOString(), approvedHash: approvalHash(pending) })
  })

  it('approval needs a privacy choice and a future schedule', () => {
    expect(plan({ user: admin, originalDoc: { ...basePost, privacyStatus: null, status: 'pending_review' }, data: { status: 'approved' } }).violations.join()).toMatch(/who can see/)
    expect(plan({ user: admin, originalDoc: { ...basePost, publishAt: '2026-11-28T05:00:00Z', status: 'pending_review' }, data: { status: 'approved' } }).violations.join()).toMatch(/future/)
  })

  it('a draft cannot jump straight to approved', () => {
    expect(plan({ user: admin, originalDoc: { ...basePost, status: 'draft' }, data: { status: 'approved' } }).violations.join()).toMatch(/cannot move/)
  })

  it('reject / withdraw: pending_review → draft clears the submission', () => {
    const r = plan({ originalDoc: { ...basePost, status: 'pending_review', submittedBy: 2, submittedAt: 'x' }, data: { status: 'draft', reviewNote: 'शीर्षक बदलें' } })
    expect(r.violations).toEqual([])
    expect(r.set).toMatchObject({ status: 'draft', submittedBy: null, submittedAt: null })
  })

  it('clients cannot forge approval stamps', () => {
    const r = plan({ user: editor, originalDoc: { ...basePost, status: 'draft' }, data: { approvedBy: 2, approvedAt: NOW.toISOString(), approvedHash: 'x' } })
    expect(r.set).toMatchObject({ approvedBy: null, approvedAt: null, approvedHash: null })
  })
})

describe('planYoutubePostChange: after approval', () => {
  it('editing anything that goes to YouTube sends an approved post back to review', () => {
    const r = plan({ originalDoc: approvedPost(), data: { title: 'नया शीर्षक' } })
    expect(r.violations).toEqual([])
    expect(r.set).toMatchObject({ status: 'pending_review', approvedAt: null, approvedHash: null })
  })

  it('editing an unrelated field (review note, linked article) keeps the approval', () => {
    const stored = approvedPost()
    const r = plan({ originalDoc: stored, data: { reviewNote: 'ठीक है', article: 9 } })
    expect(r.violations).toEqual([])
    expect(r.set).toMatchObject({ status: 'approved', approvedHash: stored.approvedHash })
  })

  it('editors cannot set job statuses', () => {
    for (const status of ['uploading', 'processing', 'scheduled', 'published', 'failed']) {
      expect(plan({ user: admin, originalDoc: approvedPost(), data: { status } }).violations.length).toBeGreaterThan(0)
    }
  })

  it('a post on YouTube is frozen; cancel is final', () => {
    expect(plan({ originalDoc: approvedPost({ status: 'published' }), data: { title: 'x' } }).violations.join()).toMatch(/already gone to YouTube/)
    expect(plan({ originalDoc: approvedPost({ status: 'cancelled' }), data: { status: 'draft' } }).violations.join()).toMatch(/cannot move/)
  })

  it('failed → approved is an admin retry with a fresh stamp', () => {
    expect(plan({ user: editor, originalDoc: approvedPost({ status: 'failed' }), data: { status: 'approved' } }).violations.join()).toMatch(/Only admins/)
    const r = plan({ user: admin, originalDoc: approvedPost({ status: 'failed' }), data: { status: 'approved' } })
    expect(r.violations).toEqual([])
    expect(r.set.status).toBe('approved')
  })

  it('job-owned fields are restored for non-job writes', () => {
    const r = plan({ originalDoc: approvedPost({ youtubeVideoId: 'abcdefghijk', bytesUploaded: 5 }), data: { youtubeVideoId: 'zzzzzzzzzzz', uploadSessionUri: 'https://evil', bytesUploaded: 999 } })
    expect(r.set).toMatchObject({ youtubeVideoId: 'abcdefghijk', uploadSessionUri: null, bytesUploaded: 5 })
  })
})

describe('planYoutubePostChange: the publisher job', () => {
  const job = (originalDoc: Record<string, unknown>, data: Record<string, unknown>) =>
    planYoutubePostChange({ user: null, isJob: true, operation: 'update', originalDoc, data, now: NOW })

  it('approved → uploading only while the stored approval still matches', () => {
    expect(job(approvedPost(), { status: 'uploading' }).violations).toEqual([])
    const tampered = { ...approvedPost(), title: 'changed outside the guard' }
    expect(job(tampered, { status: 'uploading' }).violations.join()).toMatch(/needs a new approval/)
    expect(job({ ...basePost, status: 'approved' }, { status: 'uploading' }).violations.join()).toMatch(/needs a new approval/)
  })

  it('follows the upload path and may fail', () => {
    expect(job(approvedPost({ status: 'uploading' }), { status: 'processing', youtubeVideoId: 'abcdefghijk' }).violations).toEqual([])
    expect(job(approvedPost({ status: 'processing' }), { status: 'published' }).violations).toEqual([])
    expect(job(approvedPost({ status: 'processing' }), { status: 'scheduled' }).violations).toEqual([])
    expect(job(approvedPost({ status: 'scheduled' }), { status: 'published' }).violations).toEqual([])
    expect(job(approvedPost({ status: 'uploading' }), { status: 'failed', lastError: 'quota' }).violations).toEqual([])
  })

  it('cannot skip steps, touch drafts, or change what was approved', () => {
    expect(job({ ...basePost, status: 'pending_review' }, { status: 'uploading' }).violations.length).toBeGreaterThan(0)
    expect(job(approvedPost(), { status: 'published' }).violations.length).toBeGreaterThan(0)
    expect(job(approvedPost({ status: 'uploading' }), { title: 'x' }).violations.join()).toMatch(/cannot change what was approved/)
  })

  it('keeps its own fields and the approval stamps', () => {
    const stored = approvedPost()
    const r = job(stored, { status: 'uploading', uploadSessionUri: 'https://upload', approvedBy: 99 })
    expect(r.set.uploadSessionUri).toBeUndefined() // job's own value passes through from data
    expect(r.set.approvedBy).toBe(1)
  })
})
