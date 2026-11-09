import { BadRequestError } from './errors'

/** Opaque cursor for article feeds (contract §2): the sort key of the last item, (publishedAt, id). */
export interface ArticleCursor {
  publishedAt: string // ISO UTC, millisecond precision
  id: number
}

export function encodeCursor(cursor: ArticleCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.publishedAt, i: cursor.id }), 'utf8').toString('base64url')
}

export function decodeCursor(raw: string): ArticleCursor {
  let parsed: { t?: unknown; i?: unknown }
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    throw new BadRequestError('cursor is not valid.')
  }
  const t = typeof parsed.t === 'string' ? new Date(parsed.t) : null
  const i = parsed.i
  if (!t || Number.isNaN(t.getTime()) || typeof i !== 'number' || !Number.isSafeInteger(i) || i < 1) {
    throw new BadRequestError('cursor is not valid.')
  }
  return { publishedAt: t.toISOString(), id: i }
}
