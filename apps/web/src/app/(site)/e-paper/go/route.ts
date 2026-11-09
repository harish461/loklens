import { NextResponse, type NextRequest } from 'next/server'

import { isValidEPaperDate } from '@/components/EPaper'

/**
 * Target of the e-paper date picker (a plain GET form, so it works without JS):
 * /e-paper/go?date=yyyy-mm-dd → 303 to /e-paper/{date} (whose not-found page explains a missing edition).
 * Anything invalid goes back to /e-paper. Never cached.
 */
export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') ?? ''
  const target = isValidEPaperDate(date) ? `/e-paper/${date}` : '/e-paper'
  return NextResponse.redirect(new URL(target, request.nextUrl.origin), 303)
}
