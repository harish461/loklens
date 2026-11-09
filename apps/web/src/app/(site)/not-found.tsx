import Link from 'next/link'

import ui from '@/components/ui.module.css'

import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <div className={`container ${styles.wrap}`}>
      <p className={styles.code}>404</p>
      <h1 className={ui.pageTitle}>यह पेज नहीं मिला</h1>
      <p className={styles.text}>
        हो सकता है यह खबर हटा दी गई हो या लिंक गलत हो। होम पेज पर ताज़ा खबरें देखें या खोजें।
      </p>
      <div className={styles.actions}>
        <Link href="/" className={ui.btnPrimary}>
          होम पेज पर जाएं
        </Link>
        <Link href="/search" className={ui.btnSecondary}>
          खबरें खोजें
        </Link>
      </div>
    </div>
  )
}
