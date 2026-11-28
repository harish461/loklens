import { APIError, type CollectionBeforeChangeHook } from 'payload'

import type { MaybeUser } from '../access/roles'
import { orientationOf, planYoutubePostChange, type FootageFacts } from '../access/youtube'
import { relId } from './revalidate'

/** True only for writes made by the YouTube publisher job (it passes `context: { youtubeJob: true }`). */
export function isYoutubeJob(context: unknown): boolean {
  return Boolean(context && typeof context === 'object' && (context as { youtubeJob?: unknown }).youtubeJob === true)
}

/**
 * youtube-posts beforeChange: applies the pure rules in access/youtube.ts (status moves, approval stamp and hash,
 * job-only fields, YouTube limits). The selected footage is read fresh from the database when the post is being
 * submitted or approved, so its upload state and shape are checked, not trusted from the client.
 */
export const guardYoutubePost: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  const stored = operation === 'update' ? (originalDoc as Record<string, unknown> | undefined) : undefined
  const incoming = data as Record<string, unknown>
  const targetStatus = incoming.status ?? stored?.status
  let footage: FootageFacts | null = null
  if (targetStatus === 'pending_review' || targetStatus === 'approved' || incoming.footage !== undefined) {
    const footageId = relId(incoming.footage ?? stored?.footage)
    if (footageId !== null) {
      footage = (await req.payload.findByID({
        collection: 'footage',
        id: footageId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })) as FootageFacts | null
    }
  }
  const { violations, set } = planYoutubePostChange({
    user: req.user as MaybeUser,
    isJob: isYoutubeJob(context),
    operation: operation === 'create' ? 'create' : 'update',
    data: incoming,
    originalDoc: stored,
    footage,
  })
  if (violations.length > 0) throw new APIError(violations.join(' '), 400, undefined, true)
  return { ...incoming, ...set }
}

/** footage beforeChange: keeps `orientation` derived from width/height (never typed by hand). */
export const deriveFootageOrientation: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const width = data.width ?? (originalDoc as { width?: unknown } | undefined)?.width
  const height = data.height ?? (originalDoc as { height?: unknown } | undefined)?.height
  return { ...data, orientation: orientationOf(width, height) }
}
