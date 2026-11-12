import { describe, expect, it } from 'vitest'

import type { AccessUser } from '../../src/access/roles'
import {
  currentWorkflowStatus,
  reporterWorkflowViolations,
  workflowPatch,
} from '../../src/access/workflow'

const editor: AccessUser = { id: 2, role: 'editor' }
const reporter: AccessUser = { id: 3, role: 'reporter' }
const otherReporter: AccessUser = { id: 7, role: 'reporter' }
const NOW = new Date('2026-11-12T06:00:00.000Z')

const own = (extra: Record<string, unknown> = {}) => ({ createdBy: 3, workflowStatus: 'draft', ...extra })

describe('currentWorkflowStatus', () => {
  it('falls back to _status for rows created before the field existed', () => {
    expect(currentWorkflowStatus(undefined)).toBe('draft')
    expect(currentWorkflowStatus({ _status: 'published' })).toBe('published')
    expect(currentWorkflowStatus({ _status: 'draft', workflowStatus: 'rejected' })).toBe('rejected')
  })
})

describe('reporterWorkflowViolations', () => {
  it('lets reporters submit, withdraw and resubmit their own articles', () => {
    for (const [from, to] of [
      ['draft', 'pending_review'],
      ['pending_review', 'draft'],
      ['rejected', 'pending_review'],
      ['rejected', 'draft'],
    ]) {
      expect(
        reporterWorkflowViolations({ user: reporter, data: { workflowStatus: to }, originalDoc: own({ workflowStatus: from }) }),
      ).toEqual([])
    }
  })

  it('never lets reporters reject, or publish without canPublish', () => {
    const originalDoc = own({ workflowStatus: 'pending_review' })
    expect(reporterWorkflowViolations({ user: reporter, data: { workflowStatus: 'rejected' }, originalDoc })).toHaveLength(1)
    expect(reporterWorkflowViolations({ user: reporter, data: { workflowStatus: 'published' }, originalDoc })).toHaveLength(1)
    expect(
      reporterWorkflowViolations({
        user: reporter,
        data: { workflowStatus: 'published' },
        originalDoc,
        permissions: { canPublish: true },
      }),
    ).toEqual([])
  })

  it("re-sending an unchanged 'rejected' state (saving edits) is fine", () => {
    expect(
      reporterWorkflowViolations({
        user: reporter,
        data: { workflowStatus: 'rejected', title: 'fixed' },
        originalDoc: own({ workflowStatus: 'rejected' }),
      }),
    ).toEqual([])
  })

  it("blocks changes to another reporter's article", () => {
    expect(reporterWorkflowViolations({ user: otherReporter, data: { title: 'x' }, originalDoc: own() })).toHaveLength(1)
  })

  it('blocks review fields unless re-sent unchanged', () => {
    const originalDoc = own({ reviewNote: 'Add sources' })
    expect(reporterWorkflowViolations({ user: reporter, data: { reviewNote: 'ok now' }, originalDoc })).toHaveLength(1)
    expect(reporterWorkflowViolations({ user: reporter, data: { reviewNote: 'Add sources' }, originalDoc })).toEqual([])
    expect(reporterWorkflowViolations({ user: reporter, data: { everPublished: true }, originalDoc })).toHaveLength(1)
    expect(reporterWorkflowViolations({ user: reporter, data: { reviewedBy: 2 }, originalDoc })).toHaveLength(1)
  })

  it('enforces assigned categories (empty list = any)', () => {
    const permissions = { assignedCategories: [{ id: 5 }, 6] }
    expect(reporterWorkflowViolations({ user: reporter, data: { category: 5 }, permissions })).toEqual([])
    expect(reporterWorkflowViolations({ user: reporter, data: { category: { id: 6 } }, permissions })).toEqual([])
    expect(reporterWorkflowViolations({ user: reporter, data: { category: 9 }, permissions })).toHaveLength(1)
    expect(reporterWorkflowViolations({ user: reporter, data: { category: 9 }, permissions: { assignedCategories: [] } })).toEqual([])
  })

  it('blocks deactivated reporters', () => {
    expect(reporterWorkflowViolations({ user: reporter, data: {}, permissions: { isActive: false } })).toHaveLength(1)
  })

  it('does not limit editors or trusted calls', () => {
    expect(reporterWorkflowViolations({ user: editor, data: { workflowStatus: 'rejected', reviewNote: 'x' } })).toEqual([])
    expect(reporterWorkflowViolations({ user: null, data: { everPublished: true } })).toEqual([])
  })
})

describe('workflowPatch', () => {
  it('new articles start as drafts', () => {
    const { patch } = workflowPatch({ user: reporter, data: { title: 'x' }, now: NOW })
    expect(patch).toMatchObject({ workflowStatus: 'draft', everPublished: false })
  })

  it('submitting stamps submittedAt', () => {
    const { patch } = workflowPatch({ user: reporter, data: { workflowStatus: 'pending_review' }, originalDoc: own(), now: NOW })
    expect(patch).toMatchObject({ workflowStatus: 'pending_review', submittedAt: NOW.toISOString() })
    expect(patch).not.toHaveProperty('reviewedAt')
  })

  it('approving publishes, stamps the reviewer and marks everPublished', () => {
    const originalDoc = own({ workflowStatus: 'pending_review' })
    const viaStatus = workflowPatch({ user: editor, data: { _status: 'published' }, originalDoc, now: NOW })
    expect(viaStatus.patch).toMatchObject({
      workflowStatus: 'published',
      everPublished: true,
      reviewedBy: 2,
      reviewedAt: NOW.toISOString(),
    })
    const viaWorkflow = workflowPatch({ user: editor, data: { workflowStatus: 'published' }, originalDoc, now: NOW })
    expect(viaWorkflow.patch).toMatchObject({ _status: 'published', workflowStatus: 'published' })
  })

  it('rejecting needs a note and forces a draft', () => {
    const originalDoc = own({ workflowStatus: 'pending_review' })
    expect(workflowPatch({ user: editor, data: { workflowStatus: 'rejected' }, originalDoc }).violations).toHaveLength(1)
    const { patch, violations } = workflowPatch({
      user: editor,
      data: { workflowStatus: 'rejected', reviewNote: 'स्रोत जोड़ें' },
      originalDoc,
      now: NOW,
    })
    expect(violations).toEqual([])
    expect(patch).toMatchObject({ workflowStatus: 'rejected', _status: 'draft', reviewedBy: 2 })
  })

  it('unpublishing returns to draft but keeps everPublished', () => {
    const originalDoc = own({ workflowStatus: 'published', _status: 'published', everPublished: true })
    const { patch } = workflowPatch({ user: editor, data: { _status: 'draft' }, originalDoc })
    expect(patch).toMatchObject({ workflowStatus: 'draft', everPublished: true })
  })

  it('a plain edit keeps the current state', () => {
    const originalDoc = own({ workflowStatus: 'pending_review', submittedAt: '2026-11-10T00:00:00.000Z' })
    const { patch } = workflowPatch({ user: reporter, data: { title: 'edited' }, originalDoc, now: NOW })
    expect(patch.workflowStatus).toBe('pending_review')
    expect(patch).not.toHaveProperty('submittedAt')
  })

  it('an editor title edit on a live article keeps it live', () => {
    const originalDoc = own({ workflowStatus: 'published', _status: 'published', everPublished: true })
    const { patch } = workflowPatch({ user: editor, data: { title: 'edited' }, originalDoc })
    expect(patch).toEqual({ workflowStatus: 'published', everPublished: true })
  })
})
