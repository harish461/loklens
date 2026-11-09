// Colocated helpers for the e-paper routes (not a route).
// CONTRACT GAP: the contract has no way to ask for the previous/next edition or the date range, so we
// read the newest 50 editions. Requested from backend: `getEPaper(date)` → `{ ...EPaper, prev, next }`
// (or listEPapers `before`/`after` params) and min/max dates.
import type { EPaper } from '@/lib/data/types'
import { listEPapers } from '@/lib/mock'

async function recent(): Promise<EPaper[]> {
  return (await listEPapers({ page: 1, pageSize: 50 })).items // newest first
}

export async function getEPaperRange(): Promise<{ min?: string; max?: string }> {
  const items = await recent()
  return { max: items[0]?.date, min: items[items.length - 1]?.date }
}

/** older = previous edition, newer = next edition. */
export async function getEPaperNeighbours(date: string): Promise<{ older?: EPaper; newer?: EPaper }> {
  const items = await recent()
  const newer = [...items].reverse().find((e) => e.date > date)
  const older = items.find((e) => e.date < date)
  return { older, newer }
}
