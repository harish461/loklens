/** HTTP Range parsing for the footage preview (pure). One range only; open ends are capped at `maxChunk`. */
export function parseRange(header: string | null, size: number, maxChunk: number): { start: number; end: number } | 'invalid' {
  if (size <= 0) return 'invalid'
  if (!header) return { start: 0, end: Math.min(size, maxChunk) - 1 }
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid'
  let start: number
  let end: number
  if (m[1] === '') {
    // Suffix range: the last N bytes.
    const n = Number(m[2])
    if (n <= 0) return 'invalid'
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return 'invalid'
  return { start, end: Math.min(end, start + maxChunk - 1) }
}
