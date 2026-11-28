/** Footage lists for the reporter page and the admin YouTube view. Read as the signed-in user (access rules apply). */
import type { Payload } from 'payload'

import type { User } from '@/payload-types'

export interface FootageRow {
  id: number
  title: string
  uploadStatus: string
  sizeMB: number | null
  durationSeconds: number | null
  orientation: string | null
  createdAt: string
  uploader: string | null
  locked: boolean
  imageUrl: string | null
  hashtags: string[]
}

export async function listFootage(payload: Payload, user: User, { limit = 30 } = {}): Promise<FootageRow[]> {
  const res = await payload.find({
    collection: 'footage',
    where: { uploadStatus: { not_equals: 'deleted' } },
    sort: '-createdAt',
    limit,
    depth: 1,
    user,
    overrideAccess: false,
  })
  return res.docs.map((d) => {
    const by = d.createdBy && typeof d.createdBy === 'object' ? d.createdBy : null
    return {
      id: d.id,
      title: d.title,
      uploadStatus: d.uploadStatus,
      sizeMB: typeof d.sizeBytes === 'number' ? Math.round((d.sizeBytes / 1024 / 1024) * 10) / 10 : null,
      durationSeconds: typeof d.durationSeconds === 'number' ? d.durationSeconds : null,
      orientation: d.orientation ?? null,
      createdAt: d.createdAt,
      uploader: by ? by.displayName || by.name || null : null,
      locked: Boolean(d.lockedAt),
      imageUrl: d.image && typeof d.image === 'object' ? (d.image.sizes?.thumb?.url ?? d.image.url ?? null) : null,
      hashtags: d.hashtags ?? [],
    }
  })
}
