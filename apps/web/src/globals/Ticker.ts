import type { GlobalConfig } from 'payload'

import { anyone, editorsOnly } from '../access'
import { validateUrlOrPath } from '../fields/common'
import { normalizeGlobalData } from '../hooks/normalize'
import { revalidateGlobal } from '../hooks/revalidate'
import { cacheTags } from '../lib/revalidate/tags'

/** Optional manual ticker items; when empty, the ticker is built from isTrending articles. */
export const Ticker: GlobalConfig = {
  slug: 'ticker',
  label: 'Trending ticker',
  admin: { group: 'Settings' },
  access: { read: anyone, update: editorsOnly },
  hooks: {
    beforeValidate: [normalizeGlobalData],
    afterChange: [revalidateGlobal([cacheTags.home])],
  },
  fields: [
    {
      name: 'items',
      type: 'array',
      maxRows: 10,
      admin: { description: 'Up to 10 manual items. Empty = latest trending articles.' },
      fields: [
        { name: 'title', type: 'text', required: true, maxLength: 150 },
        { name: 'url', type: 'text', required: true, validate: (v: unknown) => validateUrlOrPath(v) },
      ],
    },
  ],
}
