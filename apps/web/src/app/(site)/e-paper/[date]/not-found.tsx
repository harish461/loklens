import Link from 'next/link'

import ui from '@/components/ui.module.css'

import styles from '../../not-found.module.css'

// Missing or invalid edition date (404).
export default function EPaperNotFound() {
  return (
    <div className={`container ${styles.wrap}`}>
      <p className={styles.code}>404</p>
      <h1 className={ui.pageTitle}>इस तारीख का ई-पेपर नहीं मिला</h1>
      <p className={styles.text}>हो सकता है उस दिन का संस्करण प्रकाशित न हुआ हो। उपलब्ध संस्करणों की सूची देखें।</p>
      <div className={styles.actions}>
        <Link href="/e-paper" className={ui.btnPrimary}>
          सभी ई-पेपर देखें
        </Link>
        <Link href="/" className={ui.btnSecondary}>
          होम पेज
        </Link>
      </div>
    </div>
  )
}
