import type { GlobalConfig } from 'payload'

import { adminsOnly, anyone } from '../access'
import { SOCIAL_PLATFORMS } from '../collections/Users'
import { validateUrlOrPath } from '../fields/common'
import { normalizeGlobalData } from '../hooks/normalize'
import { revalidateGlobal } from '../hooks/revalidate'
import { cacheTags } from '../lib/revalidate/tags'

const policyPath = (name: string, defaultValue: string, label: string) => ({
  name,
  type: 'text' as const,
  required: true,
  defaultValue,
  label,
  validate: (value: unknown) => validateUrlOrPath(value),
})

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: { group: 'Settings' },
  access: { read: anyone, update: adminsOnly },
  hooks: {
    beforeValidate: [normalizeGlobalData],
    afterChange: [revalidateGlobal([cacheTags.settings, cacheTags.home, cacheTags.feeds])],
  },
  fields: [
    { name: 'name', type: 'text', required: true, defaultValue: 'लोकलेंस न्यूज़' },
    { name: 'tagline', type: 'text', defaultValue: 'आपकी आवाज़, आपकी खबर' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'defaultImage',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Fallback share/card image when an article image is missing (1200×630 or larger).' },
    },
    {
      name: 'social',
      type: 'array',
      maxRows: 10,
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: SOCIAL_PLATFORMS.map((p) => ({ label: p, value: p })),
        },
        { name: 'url', type: 'text', required: true, validate: (v: unknown) => validateUrlOrPath(v) },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'email', type: 'email' },
        { name: 'whatsapp', type: 'text', admin: { description: 'International format, e.g. +91XXXXXXXXXX.' } },
      ],
    },
    {
      name: 'policies',
      type: 'group',
      admin: { description: 'Paths of the policy pages (used in footer and Organization schema).' },
      fields: [
        policyPath('about', '/about', 'About'),
        policyPath('contact', '/contact', 'Contact'),
        policyPath('privacy', '/privacy-policy', 'Privacy policy'),
        policyPath('terms', '/terms', 'Terms'),
        policyPath('editorial', '/editorial-policy', 'Editorial policy'),
        policyPath('corrections', '/corrections-policy', 'Corrections policy'),
        policyPath('disclaimer', '/disclaimer', 'Disclaimer'),
      ],
    },
    {
      name: 'analyticsId',
      type: 'text',
      admin: { description: 'e.g. G-XXXXXXX (decision pending, architecture §10).' },
    },
    {
      name: 'adsTxt',
      type: 'textarea',
      admin: { description: 'Contents of /ads.txt (Phase 7).' },
    },
  ],
}
