'use server'

/**
 * YouTube Studio post actions for /admin/youtube. Each call re-checks the session (active editor or admin) and
 * the kill switch, then runs the post service as that user.
 */
import { revalidatePath } from 'next/cache'

import { isEditorOrAdmin, type MaybeUser } from '@/access'
import { getSessionUser } from '@/lib/reporter/session'
import type { User } from '@/payload-types'

import { STUDIO_OFF_MESSAGE, youtubeStudioEnabled } from './flags'
import type { PostFormInput, ReviewChecklist } from './postInput'
import { changePostStatus, savePost, type PostAction, type Result } from './postService'

async function editor() {
  if (!youtubeStudioEnabled()) return { error: STUDIO_OFF_MESSAGE }
  const { payload, user } = await getSessionUser()
  if (!user || user.isActive === false || !isEditorOrAdmin(user as unknown as MaybeUser)) return { error: 'You do not have permission to do this.' }
  return { payload, user: user as User }
}

export async function saveYoutubePost(input: PostFormInput & { id?: number | null }): Promise<Result<{ id: number; status: string }>> {
  const s = await editor()
  if ('error' in s) return { ok: false, error: s.error as string }
  const r = await savePost(s.payload, s.user, input)
  revalidatePath('/admin/youtube')
  return r
}

export async function youtubePostAction(
  id: number,
  action: PostAction,
  opts: { note?: string; checklist?: ReviewChecklist } = {},
): Promise<Result<{ status: string }>> {
  const s = await editor()
  if ('error' in s) return { ok: false, error: s.error as string }
  const r = await changePostStatus(s.payload, s.user, id, action, opts)
  revalidatePath('/admin/youtube')
  return r
}
