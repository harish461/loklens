'use client'

import type { DefaultCellComponentProps } from 'payload'
import { useState } from 'react'

/**
 * Admin list column with a trash icon on each row. Deletes the document through the collection's REST route
 * (Payload's own access rules decide if the user may). Asks for confirmation first. UI only: the field is a
 * virtual `ui` field, so it has no database column.
 */
export function DeleteRowCell({ rowData, collectionSlug }: DefaultCellComponentProps) {
  const [busy, setBusy] = useState(false)
  const id = rowData?.id as number | string | undefined
  if (id === undefined || id === null) return null
  const label = String(rowData?.title ?? rowData?.youtubeId ?? id)

  async function onDelete() {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/${collectionSlug}/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        window.alert(body?.errors?.[0]?.message ?? `Could not delete (HTTP ${res.status}).`)
        return
      }
      // Payload's list view keeps its own state, so reload to show the updated table.
      window.location.reload()
    } catch {
      window.alert('Could not delete. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      aria-label={`Delete ${label}`}
      title="Delete"
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 32,
        height: 32,
        border: '1px solid #e3e5e1',
        borderRadius: 6,
        background: '#fff',
        color: '#c41d17',
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
