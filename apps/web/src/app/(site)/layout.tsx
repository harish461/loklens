import type { Metadata, Viewport } from 'next'
import { Mukta } from 'next/font/google'
import type { ReactNode } from 'react'

import { Footer, BottomNav } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
// TODO(data): switch to '@/lib/data' when the backend helpers land (same names and signatures).
import { getHome, getSiteSettings, listCategories } from '@/lib/mock'

import './globals.css'

const mukta = Mukta({
  subsets: ['devanagari', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-mukta',
})

// TODO(seo): replace with the src/lib/seo site defaults (metadataBase, title template, OG, verification).
export const metadata: Metadata = {
  title: { default: 'लोक Lens न्यूज़ — आपकी आवाज़, आपकी खबर', template: '%s | लोक Lens न्यूज़' },
  description: 'उत्तराखंड और देश की ताज़ा खबरें — आपकी आवाज़, आपकी खबर',
}

export const viewport: Viewport = {
  themeColor: '#C41D17',
  width: 'device-width',
  initialScale: 1,
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [settings, categories, home] = await Promise.all([getSiteSettings(), listCategories(), getHome()])
  const nav = settings.navigation.header.length
    ? settings.navigation.header
    : categories.map((c) => ({ label: c.name, url: `/${c.slug}` }))
  return (
    <html lang="hi" className={mukta.variable}>
      <body>
        <a href="#main" className="skip-link">
          मुख्य सामग्री पर जाएं
        </a>
        <Header settings={settings} categories={nav} ticker={home.ticker} breaking={home.breaking} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer settings={settings} categories={nav} />
        <BottomNav />
      </body>
    </html>
  )
}
