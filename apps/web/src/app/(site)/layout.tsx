import type { Metadata, Viewport } from 'next'
import { Montserrat, Noto_Sans_Devanagari } from 'next/font/google'
import { Suspense, type ReactNode } from 'react'

import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { SiteLoader } from '@/components/layout/SiteLoader'
import { getHome, getSiteSettings, listCategories } from '@/lib/data'
import { buildRootMetadata } from '@/lib/seo'

import './globals.css'

export const dynamic = 'force-dynamic'

// Montserrat is the site font. It has no Devanagari glyphs, so Hindi text falls back to Noto Sans Devanagari.
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: 'variable',
  display: 'swap',
  variable: '--font-montserrat',
})

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: 'variable',
  display: 'swap',
  variable: '--font-devanagari',
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return buildRootMetadata(settings)
}

export const viewport: Viewport = {
  themeColor: '#0c548d',
  width: 'device-width',
  initialScale: 1,
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [settings, categories, home] = await Promise.all([getSiteSettings(), listCategories(), getHome()])
  const nav = settings.navigation.header.length
    ? settings.navigation.header
    : categories.map((c) => ({ label: c.name, url: `/${c.slug}` }))
  return (
    <html lang="hi" className={`${montserrat.variable} ${notoDevanagari.variable}`}>
      <body>
        <Suspense fallback={null}>
          <SiteLoader />
        </Suspense>
        <a href="#main" className="skip-link">
          मुख्य सामग्री पर जाएं
        </a>
        <Header settings={settings} categories={nav} ticker={home.ticker} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer settings={settings} categories={nav} />
      </body>
    </html>
  )
}
