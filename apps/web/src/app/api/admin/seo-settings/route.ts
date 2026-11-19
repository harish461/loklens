import { NextResponse } from 'next/server'

import { getGlobalSeoSettings, saveGlobalSeoSettings, type GlobalSeoSettings } from '@/lib/seo/settings'

export async function GET() {
  const settings = await getGlobalSeoSettings()
  return NextResponse.json({ ok: true, settings })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<GlobalSeoSettings>
    const updated = await saveGlobalSeoSettings(body)
    return NextResponse.json({ ok: true, settings: updated })
  } catch (err) {
    console.error('[LokLens Admin SEO API] Failed to save SEO settings:', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to save global SEO settings.' },
      { status: 500 },
    )
  }
}
