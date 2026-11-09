import type { CollectionBeforeValidateHook, GlobalBeforeValidateHook } from 'payload'

/** Recursively NFC-normalises every string in plain objects/arrays (contract: "Strings are NFC on save"). */
export function normalizeStringsNFC<T>(value: T): T {
  if (typeof value === 'string') return value.normalize('NFC') as T
  if (Array.isArray(value)) return value.map((v) => normalizeStringsNFC(v)) as T
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalizeStringsNFC(v)
    return out as T
  }
  return value
}

export const normalizeCollectionData: CollectionBeforeValidateHook = ({ data }) =>
  data ? normalizeStringsNFC(data) : data

export const normalizeGlobalData: GlobalBeforeValidateHook = ({ data }) => normalizeStringsNFC(data)
