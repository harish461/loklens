import { Clapperboard } from 'lucide-react'
import type { Metadata } from 'next'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { FootageList } from '@/components/footage/FootageList'
import { FootageUploader } from '@/components/footage/FootageUploader'
import styles from '@/components/footage/footage.module.css'
import { listFootage } from '@/lib/footage/queries'
import { requireReporter } from '@/lib/reporter/session'
import { STUDIO_OFF_MESSAGE, youtubeStudioEnabled } from '@/lib/youtube/flags'

export const metadata: Metadata = { title: 'वीडियो फ़ुटेज' }

/** Reporter footage upload (YouTube Studio, api-contract §9). Reporters see and manage only their own footage. */
export default async function ReporterFootagePage() {
  const session = await requireReporter()
  const enabled = youtubeStudioEnabled()
  const rows = enabled ? await listFootage(session.payload, session.user) : []
  return (
    <div className={adminStyles.pageShell}>
      <header className={adminStyles.pageHeader}>
        <div className={adminStyles.titleGroup}>
          <span className={adminStyles.titleIcon}>
            <Clapperboard size={20} />
          </span>
          <div>
            <h1 className={adminStyles.pageTitle}>वीडियो फ़ुटेज</h1>
            <p className={adminStyles.pageSubtitle}>यूट्यूब के लिए वीडियो भेजें। संपादक इसे देखकर चैनल पर डालेंगे।</p>
          </div>
        </div>
      </header>
      {!enabled ? (
        <section className={adminStyles.cardSurface}>
          <p className={styles.off}>{STUDIO_OFF_MESSAGE}</p>
        </section>
      ) : (
        <>
          <section className={adminStyles.cardSurface}>
            <FootageUploader />
          </section>
          <section className={adminStyles.cardSurface}>
            <FootageList rows={rows} />
          </section>
        </>
      )}
    </div>
  )
}
