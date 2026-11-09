import path from 'path'

import type { CollectionConfig, FieldHook } from 'payload'

import { anyone, editorsOnly } from '../access'
import { normalizeCollectionData } from '../hooks/normalize'
import { epaperRevalidation } from '../hooks/revalidate'
import { MEDIA_ROOT } from './Media'

export const EPAPER_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** Today's date in India (IST), as YYYY-MM-DD. */
export function todayInIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
}

export function isValidEPaperDate(value: unknown): boolean {
  if (typeof value !== 'string' || !EPAPER_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const trimDate: FieldHook = ({ value }) => (typeof value === 'string' ? value.trim() : value)

/**
 * One PDF per date. The collection itself is the upload (PDF only), so no extra media relation.
 * `date` is stored as a plain "YYYY-MM-DD" string: unique, timezone-proof, and identical to the
 * contract's EPaper.date and the /e-paper/{yyyy-mm-dd} URL.
 */
export const EPapers: CollectionConfig = {
  slug: 'epapers',
  labels: { singular: 'E-paper', plural: 'E-papers' },
  admin: { useAsTitle: 'date', defaultColumns: ['date', 'edition', 'filename'], group: 'Content' },
  defaultSort: '-date',
  access: { read: anyone, create: editorsOnly, update: editorsOnly, delete: editorsOnly },
  hooks: {
    beforeValidate: [normalizeCollectionData],
    afterChange: epaperRevalidation.afterChange,
    afterDelete: epaperRevalidation.afterDelete,
  },
  upload: {
    staticDir: path.join(MEDIA_ROOT, 'epapers'),
    mimeTypes: ['application/pdf'],
  },
  fields: [
    {
      name: 'date',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      defaultValue: () => todayInIST(),
      hooks: { beforeValidate: [trimDate] },
      validate: (value: unknown) => isValidEPaperDate(value) || 'Use the format YYYY-MM-DD, e.g. 2026-11-09.',
      admin: { description: 'Edition date (YYYY-MM-DD). One e-paper per date.' },
    },
    { name: 'edition', type: 'text', required: true, defaultValue: 'मुख्य संस्करण', maxLength: 100 },
  ],
}
