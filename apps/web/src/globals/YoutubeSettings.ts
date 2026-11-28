import type { GlobalConfig } from 'payload'

import { adminsOnly, editorsOnly } from '../access'

/**
 * YouTube Studio switches and limits (docs/youtube-studio-plan.md §6). The env var YOUTUBE_STUDIO_ENABLED is the
 * hard kill switch; `enabled` here is the admin's soft switch. Both must be on for the publisher to run.
 */
export const YoutubeSettings: GlobalConfig = {
  slug: 'youtube-settings',
  label: 'YouTube settings',
  admin: { group: 'YouTube Studio' },
  access: { read: editorsOnly, update: adminsOnly },
  fields: [
    { name: 'enabled', type: 'checkbox', defaultValue: false, admin: { description: 'Allow uploads to YouTube.' } },
    { name: 'dailyUploadLimit', type: 'number', defaultValue: 20, min: 1, max: 100 },
    { name: 'maxFootageMB', type: 'number', defaultValue: 2048, min: 50, max: 10240 },
    { name: 'footageRetentionDays', type: 'number', defaultValue: 30, min: 1, max: 365 },
    {
      name: 'defaultPrivacy',
      type: 'select',
      defaultValue: 'unlisted',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Unlisted', value: 'unlisted' },
        { label: 'Private', value: 'private' },
      ],
    },
    { name: 'defaultHashtags', type: 'text', hasMany: true, maxRows: 5 },
    { name: 'requireThumbnailForVideos', type: 'checkbox', defaultValue: true },
    { name: 'channelTitle', type: 'text', maxLength: 100, admin: { readOnly: true } },
  ],
}
