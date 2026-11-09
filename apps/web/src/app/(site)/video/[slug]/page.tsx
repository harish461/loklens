import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { formatDate } from '@/components/format'
import { Breadcrumbs } from '@/components/Navigation'
import { EmbedFacade } from '@/components/RichText/EmbedFacade'
import ui from '@/components/ui.module.css'
import { getVideo } from '@/lib/data'

import styles from '../video.module.css'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

// TODO(seo): src/lib/seo video metadata + VideoObject JSON-LD.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const video = await getVideo(slug)
  return video ? { title: video.title } : {}
}

export default async function VideoPage({ params }: Props) {
  const { slug } = await params
  const video = await getVideo(slug)
  if (!video || !/^[\w-]{11}$/.test(video.youtubeId)) notFound()
  return (
    <>
      <div className={ui.pageHead}>
        <div className="container">
          <Breadcrumbs items={[{ label: 'होम', href: '/' }, { label: 'वीडियो', href: '/video' }, { label: video.title }]} />
          <h1 className={ui.pageTitle}>{video.title}</h1>
        </div>
      </div>
      <div className={`container ${styles.player}`}>
        <EmbedFacade
          provider="youtube"
          url={`https://www.youtube.com/watch?v=${video.youtubeId}`}
          youtubeId={video.youtubeId}
        />
        <p className={styles.meta}>
          <time dateTime={video.publishedAt}>{formatDate(video.publishedAt)}</time>
        </p>
      </div>
    </>
  )
}
