import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPage } from '@/lib/data'

import { formatDate } from './format'
import { Breadcrumbs } from './Navigation'
import { RichText } from './RichText'
import ui from './ui.module.css'

/**
 * Static CMS page (about, contact, policies…). Each slug has its own route folder under
 * src/app/(site)/(pages)/ — explicit static routes win over /[category], and every one of these slugs
 * is on the reserved list (architecture §3), so no category can shadow them.
 */
export async function StaticPage({ slug }: { slug: string }) {
  const page = await getPage(slug)
  if (!page) notFound()
  return (
    <>
      <div className={ui.pageHead}>
        <div className="container">
          <Breadcrumbs items={[{ label: 'होम', href: '/' }, { label: page.title }]} />
          <h1 className={ui.pageTitle}>{page.title}</h1>
          <p className={ui.pageDesc}>
            अंतिम अपडेट: <time dateTime={page.updatedAt}>{formatDate(page.updatedAt)}</time>
          </p>
        </div>
      </div>
      <div className="container">
        <RichText nodes={page.body} />
      </div>
    </>
  )
}

// TODO(seo): replace with src/lib/seo page metadata.
export async function staticPageMetadata(slug: string): Promise<Metadata> {
  const page = await getPage(slug)
  return page ? { title: page.title } : {}
}
