import { describe, expect, it } from 'vitest'

import { hasRole, isAdmin, isEditorOrAdmin, isStaff, type AccessUser } from '../../src/access/roles'
import {
  PUBLISHED,
  canReadInternal,
  canReadUserPrivateField,
  canSetEditorialFlags,
  createArticle,
  deleteArticle,
  publishGuardViolations,
  readPublishedOrStaff,
  updateArticle,
  updateMedia,
  updateUser,
} from '../../src/access/rules'
import { applyPublishDefaults } from '../../src/hooks/articles'

const admin: AccessUser = { id: 1, role: 'admin' }
const editor: AccessUser = { id: 2, role: 'editor' }
const reporter: AccessUser = { id: 3, role: 'reporter' }
const noRole: AccessUser = { id: 4, role: null }
const anon = null

describe('roles', () => {
  it('classifies users', () => {
    expect(isAdmin(admin)).toBe(true)
    expect(isAdmin(editor)).toBe(false)
    expect(isEditorOrAdmin(editor)).toBe(true)
    expect(isEditorOrAdmin(reporter)).toBe(false)
    expect(isStaff(reporter)).toBe(true)
    expect(isStaff(noRole)).toBe(false)
    expect(isStaff(anon)).toBe(false)
    expect(hasRole({ id: 9, role: 'superuser' as never }, 'admin')).toBe(false)
  })
})

describe('read access (published only for the public)', () => {
  it('anonymous and role-less users only see published', () => {
    expect(readPublishedOrStaff(anon)).toEqual(PUBLISHED)
    expect(readPublishedOrStaff(noRole)).toEqual(PUBLISHED)
  })
  it('reporters see published plus their own', () => {
    expect(readPublishedOrStaff(reporter)).toEqual({ or: [PUBLISHED, { createdBy: { equals: 3 } }] })
  })
  it('editors and admins see everything', () => {
    expect(readPublishedOrStaff(editor)).toBe(true)
    expect(readPublishedOrStaff(admin)).toBe(true)
  })
  it('internal fields are hidden from the public', () => {
    expect(canReadInternal(anon)).toBe(false)
    expect(canReadInternal(reporter)).toBe(true)
  })
})

describe('article write access', () => {
  it('create: staff only', () => {
    expect(createArticle(anon)).toBe(false)
    expect(createArticle(noRole)).toBe(false)
    expect(createArticle(reporter)).toBe(true)
  })
  it('update: reporters only their own unpublished drafts', () => {
    expect(updateArticle(anon)).toBe(false)
    expect(updateArticle(reporter)).toEqual({
      and: [{ createdBy: { equals: 3 } }, { _status: { not_equals: 'published' } }],
    })
    expect(updateArticle(editor)).toBe(true)
  })
  it('delete: editors/admins any; reporters only their own never-published articles', () => {
    expect(deleteArticle(anon)).toBe(false)
    expect(deleteArticle(noRole)).toBe(false)
    expect(deleteArticle(reporter)).toEqual({
      and: [
        { createdBy: { equals: 3 } },
        { _status: { not_equals: 'published' } },
        { or: [{ everPublished: { equals: false } }, { everPublished: { exists: false } }] },
      ],
    })
    expect(deleteArticle(editor)).toBe(true)
  })
  it('editorial flags: editors/admins', () => {
    expect(canSetEditorialFlags(reporter)).toBe(false)
    expect(canSetEditorialFlags(anon)).toBe(false)
    expect(canSetEditorialFlags(editor)).toBe(true)
    expect(canSetEditorialFlags(admin)).toBe(true)
  })
})

describe('publish guard', () => {
  it('blocks reporters from publishing', () => {
    expect(publishGuardViolations({ user: reporter, data: { _status: 'published' } })).toHaveLength(1)
  })
  it('lets a reporter publish only with the admin-granted canPublish permission', () => {
    const data = { _status: 'published' }
    expect(publishGuardViolations({ user: reporter, data, canPublish: false })).toHaveLength(1)
    expect(publishGuardViolations({ user: reporter, data, canPublish: true })).toEqual([])
    expect(publishGuardViolations({ user: noRole, data, canPublish: true })).not.toEqual([])
  })
  it('allows reporters to save drafts', () => {
    expect(publishGuardViolations({ user: reporter, data: { _status: 'draft', title: 'x' } })).toEqual([])
  })
  it('blocks flag changes but not unchanged values re-sent by the form', () => {
    const originalDoc = { isBreaking: true, breakingUntil: '2026-11-09T12:00:00.000Z' }
    expect(publishGuardViolations({ user: reporter, data: { isTrending: true }, originalDoc })).toHaveLength(1)
    expect(
      publishGuardViolations({
        user: reporter,
        data: { isBreaking: true, isTrending: false, breakingUntil: '2026-11-09T12:00:00Z' },
        originalDoc,
      }),
    ).toEqual([])
    expect(
      publishGuardViolations({ user: reporter, data: { breakingUntil: '2026-11-10T12:00:00Z' }, originalDoc }),
    ).toHaveLength(1)
  })
  it('lets editors, admins and trusted (user-less) calls through', () => {
    const data = { _status: 'published', isBreaking: true }
    expect(publishGuardViolations({ user: editor, data })).toEqual([])
    expect(publishGuardViolations({ user: admin, data })).toEqual([])
    expect(publishGuardViolations({ user: null, data })).toEqual([])
  })
  it('rejects users without a valid role', () => {
    expect(publishGuardViolations({ user: noRole, data: { title: 'x' } }).length).toBeGreaterThan(0)
  })
})

describe('users and media', () => {
  it('email/role readable by admins and self only', () => {
    expect(canReadUserPrivateField(anon, 3)).toBe(false)
    expect(canReadUserPrivateField(editor, 3)).toBe(false)
    expect(canReadUserPrivateField(reporter, 3)).toBe(true)
    expect(canReadUserPrivateField(reporter, '3')).toBe(true)
    expect(canReadUserPrivateField(admin, 3)).toBe(true)
  })
  it('users edit only themselves unless admin', () => {
    expect(updateUser(anon)).toBe(false)
    expect(updateUser(editor)).toEqual({ id: { equals: 2 } })
    expect(updateUser(admin)).toBe(true)
  })
  it('reporters edit only their own media', () => {
    expect(updateMedia(reporter)).toEqual({ createdBy: { equals: 3 } })
    expect(updateMedia(editor)).toBe(true)
    expect(updateMedia(anon)).toBe(false)
  })
})

describe('publish defaults', () => {
  const now = new Date('2026-11-09T10:00:00.000Z')
  it('sets publishedAt on first publish only', () => {
    expect(applyPublishDefaults({ _status: 'published' }, undefined, now).publishedAt).toBe(now.toISOString())
    expect(
      applyPublishDefaults({ _status: 'published' }, { publishedAt: '2026-01-01T00:00:00.000Z' }, now).publishedAt,
    ).toBeUndefined()
    expect(applyPublishDefaults({ _status: 'draft' }, undefined, now).publishedAt).toBeUndefined()
  })
  it('defaults breakingUntil to +6 h when breaking is switched on', () => {
    const out = applyPublishDefaults({ _status: 'published', isBreaking: true }, undefined, now)
    expect(out.breakingUntil).toBe('2026-11-09T16:00:00.000Z')
  })
  it('keeps an explicit breakingUntil', () => {
    const out = applyPublishDefaults(
      { isBreaking: true, breakingUntil: '2026-11-09T20:00:00.000Z' },
      { isBreaking: false },
      now,
    )
    expect(out.breakingUntil).toBe('2026-11-09T20:00:00.000Z')
  })
  it('resets a stale breakingUntil when breaking is switched on again', () => {
    const out = applyPublishDefaults(
      { isBreaking: true, breakingUntil: '2026-11-01T00:00:00.000Z' },
      { isBreaking: false, breakingUntil: '2026-11-01T00:00:00.000Z', publishedAt: '2026-10-31T00:00:00.000Z' },
      now,
    )
    expect(out.breakingUntil).toBe('2026-11-09T16:00:00.000Z')
  })
})
