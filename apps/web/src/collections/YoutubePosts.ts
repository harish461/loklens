import type { CollectionConfig, FieldAccess } from 'payload'

import { editorsOnly, isAdmin, isEditorOrAdmin, type MaybeUser } from '../access'
import { YT_LIMITS, YT_POST_STATUSES } from '../access/youtube'
import { createdByField } from '../fields/common'
import { guardYoutubePost } from '../hooks/youtube'

/**
 * One YouTube upload (docs/youtube-studio-plan.md §6–7, api-contract.md §9). Editors write the metadata; an admin
 * approves; the publisher job uploads. Status moves, the approval stamp and the job-only fields are enforced
 * by `guardYoutubePost` (rules in access/youtube.ts), not by the UI.
 */
const nobody: FieldAccess = () => false
const editorsField: FieldAccess = ({ req }) => isEditorOrAdmin(req.user as MaybeUser)

export const YoutubePosts: CollectionConfig = {
  slug: 'youtube-posts',
  labels: { singular: 'YouTube post', plural: 'YouTube posts' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'postType', 'status', 'privacyStatus', 'publishedAt', 'updatedAt'],
    group: 'YouTube Studio',
    hidden: ({ user }) => !isEditorOrAdmin(user as MaybeUser),
  },
  access: {
    read: editorsOnly,
    create: editorsOnly,
    update: editorsOnly,
    // Only before anything went to YouTube; afterwards a post is cancelled, not deleted.
    delete: ({ req }) =>
      isAdmin(req.user as MaybeUser) ? { status: { in: ['draft', 'pending_review', 'approved', 'cancelled'] } } : false,
  },
  timestamps: true,
  defaultSort: '-updatedAt',
  // No Payload versions: they would copy uploadSessionUri into a second table. youtube-post-events is the history.
  hooks: { beforeChange: [guardYoutubePost] },
  fields: [
    {
      name: 'postType',
      type: 'select',
      required: true,
      defaultValue: 'video',
      options: [
        { label: 'Video', value: 'video' },
        { label: 'Short', value: 'short' },
      ],
    },
    { name: 'footage', type: 'relationship', relationTo: 'footage', index: true },
    { name: 'article', type: 'relationship', relationTo: 'articles', admin: { description: 'Optional: the related article.' } },
    { name: 'title', type: 'text', maxLength: YT_LIMITS.titleChars },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: `At most ${YT_LIMITS.descriptionBytes} bytes (about 1600 Hindi characters).` },
    },
    { name: 'tags', type: 'text', hasMany: true, maxRows: 50 },
    { name: 'hashtags', type: 'text', hasMany: true, maxRows: YT_LIMITS.hashtags },
    { name: 'categoryId', type: 'text', defaultValue: '25', maxLength: 4, admin: { description: 'YouTube category (25 = News & Politics).' } },
    { name: 'defaultLanguage', type: 'text', defaultValue: 'hi', maxLength: 10 },
    { name: 'thumbnail', type: 'upload', relationTo: 'media', admin: { description: 'Sent to YouTube as JPEG.' } },
    {
      name: 'privacyStatus',
      type: 'select',
      required: true,
      defaultValue: 'unlisted',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Unlisted', value: 'unlisted' },
        { label: 'Private', value: 'private' },
      ],
    },
    {
      name: 'publishAt',
      type: 'date',
      admin: { description: 'Optional. Uploads as private; YouTube publishes it at this time.', date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'notifySubscribers', type: 'checkbox', defaultValue: true },
    { name: 'madeForKids', type: 'checkbox', defaultValue: false },
    { name: 'containsSyntheticMedia', type: 'checkbox', defaultValue: false },
    // ---- Workflow ----
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: YT_POST_STATUSES.map((s) => ({ label: s, value: s })),
      admin: { position: 'sidebar' },
    },
    { name: 'reviewNote', type: 'textarea', maxLength: 1000, admin: { position: 'sidebar' } },
    { name: 'submittedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'submittedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'approvedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'approvedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'approvedHash', type: 'text', maxLength: 64, access: { read: editorsField }, admin: { readOnly: true, hidden: true } },
    // ---- Publisher job (written only by the job; the guard restores them on any other write) ----
    { name: 'youtubeVideoId', type: 'text', unique: true, maxLength: 20, admin: { readOnly: true } },
    { name: 'youtubeUrl', type: 'text', maxLength: 200, admin: { readOnly: true } },
    // The resumable upload URL works without our token for about a week: server only, never readable.
    { name: 'uploadSessionUri', type: 'text', maxLength: 2000, access: { read: nobody }, admin: { hidden: true } },
    { name: 'bytesUploaded', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'leaseUntil', type: 'date', admin: { hidden: true } },
    { name: 'attempts', type: 'number', defaultValue: 0, admin: { readOnly: true } },
    { name: 'lastError', type: 'text', maxLength: 500, admin: { readOnly: true } },
    { name: 'uploadStartedAt', type: 'date', index: true, admin: { readOnly: true } },
    // When the publisher should look at this post again (backoff, processing polls, daily limit, quota).
    { name: 'nextCheckAt', type: 'date', index: true, admin: { hidden: true } },
    { name: 'thumbnailSetAt', type: 'date', admin: { readOnly: true } },
    { name: 'publishedAt', type: 'date', index: true, admin: { readOnly: true } },
    createdByField(),
  ],
}

/** Append-only history of each post. Written by server code and the job; nobody edits or deletes it over the API. */
export const YoutubePostEvents: CollectionConfig = {
  slug: 'youtube-post-events',
  labels: { singular: 'YouTube post event', plural: 'YouTube post events' },
  admin: { group: 'YouTube Studio', hidden: true },
  access: {
    read: editorsOnly,
    create: () => false,
    update: () => false,
    delete: () => false,
    admin: ({ req }) => isAdmin(req.user as MaybeUser),
  },
  timestamps: true,
  defaultSort: '-createdAt',
  fields: [
    // Not required: when an admin deletes a never-uploaded post, its events stay with post = null.
    { name: 'post', type: 'relationship', relationTo: 'youtube-posts', index: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: [
        'created',
        'submitted',
        'rejected',
        'approved',
        'upload_started',
        'chunk',
        'uploaded',
        'thumbnail_set',
        'processed',
        'scheduled',
        'published',
        'failed',
        'retried',
        'cancelled',
      ],
    },
    // Null for job steps.
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    // Offsets, quota units, error codes. Never tokens or upload URLs.
    { name: 'detail', type: 'json' },
  ],
}
