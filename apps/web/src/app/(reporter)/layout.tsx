import type { Metadata, Viewport } from 'next'
import { Montserrat, Noto_Sans_Devanagari } from 'next/font/google'
import type { ReactNode } from 'react'

import './reporter.css'

// Same fonts as the site and admin: Montserrat, with Noto Sans Devanagari for Hindi.
const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-montserrat' })
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-devanagari',
})

export const metadata: Metadata = {
  title: { default: 'Reporter Desk – LokLens News', template: '%s – LokLens Reporter Desk' },
  // Private workspace: never indexed.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1c1b29' }

export const dynamic = 'force-dynamic'

export default function ReporterRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi" className={`${montserrat.variable} ${notoDevanagari.variable}`}>
      <body>{children}</body>
    </html>
  )
}
