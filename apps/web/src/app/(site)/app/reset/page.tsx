import type { Metadata } from 'next'

import { ResetForm } from './ResetForm'

export const metadata: Metadata = {
  title: 'पासवर्ड बदलें',
  robots: { index: false, follow: false },
}

/** Landing page for the password-reset email sent to LokLens app customers. */
export default function AppResetPage() {
  return (
    <main style={{ maxWidth: 440, margin: '0 auto', padding: '48px 20px', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>पासवर्ड बदलें</h1>
      <p style={{ color: '#5E626B', marginBottom: 24 }}>नया पासवर्ड लिखें, फिर लोक Lens न्यूज़ ऐप में साइन इन करें।</p>
      <ResetForm />
    </main>
  )
}
