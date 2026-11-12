import { FilePlus2 } from 'lucide-react'
import type { Metadata } from 'next'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { ArticleForm } from '@/components/reporter/ArticleForm'
import { EMPTY_ARTICLE } from '@/lib/reporter/form'
import { formOptions } from '@/lib/reporter/queries'
import { requireReporter } from '@/lib/reporter/session'

export const metadata: Metadata = { title: 'Create Article' }

export default async function NewArticlePage() {
  const session = await requireReporter()
  const options = await formOptions(session)
  return (
    <div className={adminStyles.pageShell}>
      <header className={adminStyles.pageHeader}>
        <div className={adminStyles.titleGroup}>
          <span className={adminStyles.titleIcon}>
            <FilePlus2 size={20} />
          </span>
          <div>
            <h1 className={adminStyles.pageTitle}>Create Article</h1>
            <p className={adminStyles.pageSubtitle}>Saved as a private draft until you submit it for review.</p>
          </div>
        </div>
      </header>
      <ArticleForm initial={EMPTY_ARTICLE} options={options} canPublish={Boolean(session.user.canPublish)} />
    </div>
  )
}
