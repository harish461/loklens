import type { Access, CollectionConfig, FieldAccess } from 'payload'

import { editorsOnly, type MaybeUser } from '../access'
import { createFootage, readFootage, updateFootage } from '../access/youtube'
import { createdByField } from '../fields/common'
import { deriveFootageOrientation } from '../hooks/youtube'

/**
 * Raw video for YouTube Studio (docs/youtube-studio-plan.md §6, api-contract.md §9). The file itself is NOT a
 * Payload upload: the browser puts it in the PRIVATE bucket FOOTAGE_S3_BUCKET as ≤45 MiB segment objects under
 * `storagePrefix` (Supabase Free caps an object at 50 MB). This row only describes it. Never readable
 * anonymously; there is no public URL.
 */
const u = (user: unknown): MaybeUser => user as MaybeUser
const read: Access = ({ req }) => readFootage(u(req.user))
const create: Access = ({ req }) => createFootage(u(req.user))
const update: Access = ({ req }) => updateFootage(u(req.user))
/** Storage and lock fields are written only by server code (overrideAccess), never by a client. */
const serverOnly: FieldAccess = () => false

export const FOOTAGE_UPLOAD_STATUSES = ['uploading', 'uploaded', 'failed', 'deleted'] as const

export const Footage: CollectionConfig = {
  slug: 'footage',
  labels: { singular: 'Footage', plural: 'Footage' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'uploadStatus', 'orientation', 'durationSeconds', 'createdBy', 'createdAt'],
    group: 'YouTube Studio',
  },
  access: { read, create, update, delete: editorsOnly },
  timestamps: true,
  defaultSort: '-createdAt',
  hooks: { beforeChange: [deriveFootageOrientation] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    {
      name: 'notes',
      type: 'textarea',
      maxLength: 2000,
      admin: { description: 'Reporter brief: what happened, where, who, when.' },
    },
    // Suggested by the reporter; the post editor pre-fills its thumbnail and hashtags from these.
    { name: 'image', type: 'upload', relationTo: 'media', admin: { description: 'Suggested thumbnail image.' } },
    { name: 'hashtags', type: 'text', hasMany: true, maxRows: 15, admin: { description: 'Suggested hashtags, e.g. #Dehradun.' } },
    { name: 'location', type: 'relationship', relationTo: 'locations' },
    { name: 'category', type: 'relationship', relationTo: 'categories' },
    {
      name: 'rightsConfirmed',
      type: 'checkbox',
      defaultValue: false,
      // Must be ticked before an upload starts (checked by the upload server action, Phase 4).
      admin: { description: 'Our own footage, and the people shown agreed to be filmed.' },
    },
    { name: 'credit', type: 'text', maxLength: 120 },
    // ---- Storage (server only) ----
    {
      name: 'uploadStatus',
      type: 'select',
      required: true,
      defaultValue: 'uploading',
      index: true,
      options: FOOTAGE_UPLOAD_STATUSES.map((s) => ({ label: s, value: s })),
      access: { create: serverOnly, update: serverOnly },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'storagePrefix',
      type: 'text',
      unique: true,
      index: true,
      maxLength: 200,
      access: { create: serverOnly, update: serverOnly },
      admin: { readOnly: true, hidden: true },
    },
    { name: 'bucket', type: 'text', maxLength: 100, access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true, hidden: true } },
    { name: 'filename', type: 'text', maxLength: 200, access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
    { name: 'mimeType', type: 'text', maxLength: 60, access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
    { name: 'sizeBytes', type: 'number', access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
    { name: 'segmentBytes', type: 'number', access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true, hidden: true } },
    { name: 'segmentCount', type: 'number', access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
    { name: 'durationSeconds', type: 'number', access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
    { name: 'width', type: 'number', access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
    { name: 'height', type: 'number', access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true } },
    {
      name: 'orientation',
      type: 'select',
      options: ['landscape', 'vertical', 'square'],
      access: { create: serverOnly, update: serverOnly },
      admin: { readOnly: true },
    },
    // Set when a post using this footage is approved; reporters can no longer edit it after that.
    { name: 'lockedAt', type: 'date', access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true, position: 'sidebar' } },
    // Retention job deletes the segments after this date (default: 30 days after the post is published/cancelled).
    { name: 'retainUntil', type: 'date', index: true, access: { create: serverOnly, update: serverOnly }, admin: { readOnly: true, position: 'sidebar' } },
    createdByField(),
  ],
}
