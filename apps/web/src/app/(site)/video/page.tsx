import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Navigation'
import ui from '@/components/ui.module.css'
import { VideoCard } from '@/components/VideoCard'
import { listVideos } from '@/lib/data'

import styles from './video.module.css'

export const revalidate = 300

// TODO(seo): src/lib/seo; empty section must be noindex (architecture §3).
export async function generateMetadata(): Promise<Metadata> {
  const { totalItems } = await listVideos({ pageSize: 1 })
  return { title: 'वीडियो', robots: totalItems === 0 ? { index: false } : undefined }
}

export default async function VideosPage() {
  const { items } = await listVideos({ pageSize: 24 })
  return (
    <>
      <div className={ui.pageHead}>
        <div className="container">
          <Breadcrumbs items={[{ label: 'होम', href: '/' }, { label: 'वीडियो' }]} />
          <h1 className={ui.pageTitle}>वीडियो</h1>
        </div>
      </div>
      <div className="container">
        {items.length === 0 ? (
          <p className={ui.empty}>जल्द ही यहां वीडियो आएंगे।</p>
        ) : (
          <div className={styles.grid}>
            {items.map((v) => (
              <VideoCard key={v.id} video={v} tone="light" />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
