'use server'

/**
 * Footage upload server actions, used by the reporter page (/reporter/footage) and the admin view
 * (/admin/youtube). Each call re-checks the session: an active reporter, editor or admin. The service reads
 * the footage row as that user, so the footage access rules decide ownership.
 */
import { revalidatePath } from 'next/cache'

import { isEditorOrAdmin, isReporter, type MaybeUser } from '@/access'
import { checkReporter, getSessionUser } from '@/lib/reporter/session'
import { STUDIO_OFF_MESSAGE, youtubeStudioEnabled } from '@/lib/youtube/flags'
import type { User } from '@/payload-types'

import {
  completeFootageUpload,
  discardFootage,
  resumeFootageUpload,
  startFootageUpload,
  type Result,
  type StartInput,
  type UploadPlan,
} from './service'
import { footageStorageProblems } from './storage'

async function actor() {
  if (!youtubeStudioEnabled()) return { error: STUDIO_OFF_MESSAGE }
  if (footageStorageProblems().length) return { error: 'Footage storage is not configured.' }
  const { payload, user } = await getSessionUser()
  const u = user as unknown as MaybeUser
  if (user && isEditorOrAdmin(u) && user.isActive !== false) return { payload, user: user as User }
  if (user && isReporter(u)) {
    const check = await checkReporter()
    if (check.ok) return { payload: check.session.payload, user: check.session.user }
  }
  return { error: 'Your session has ended. Please sign in again.' }
}

function fail(err: unknown): { ok: false; error: string } {
  console.error('[footage]', err)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

function refresh() {
  revalidatePath('/reporter/footage')
  revalidatePath('/admin/youtube')
}

export async function startFootage(input: StartInput): Promise<Result<UploadPlan>> {
  const a = await actor()
  if ('error' in a) return { ok: false, error: a.error as string }
  try {
    const r = await startFootageUpload(a.payload, a.user, input)
    if (r.ok) refresh()
    return r
  } catch (err) {
    return fail(err)
  }
}

export async function resumeFootage(footageId: number, sizeBytes: number): Promise<Result<UploadPlan>> {
  const a = await actor()
  if ('error' in a) return { ok: false, error: a.error as string }
  try {
    return await resumeFootageUpload(a.payload, a.user, footageId, sizeBytes)
  } catch (err) {
    return fail(err)
  }
}

export async function completeFootage(
  footageId: number,
  facts: { durationSeconds?: number | null; width?: number | null; height?: number | null },
): Promise<Result<{ footageId: number }>> {
  const a = await actor()
  if ('error' in a) return { ok: false, error: a.error as string }
  try {
    const r = await completeFootageUpload(a.payload, a.user, footageId, facts)
    refresh()
    return r
  } catch (err) {
    return fail(err)
  }
}

export async function discardFootageAction(footageId: number): Promise<Result<object>> {
  const a = await actor()
  if ('error' in a) return { ok: false, error: a.error as string }
  try {
    const r = await discardFootage(a.payload, a.user, footageId)
    refresh()
    return r
  } catch (err) {
    return fail(err)
  }
}
