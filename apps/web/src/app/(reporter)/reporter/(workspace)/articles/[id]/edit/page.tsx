import { Pencil } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { ArticleForm } from '@/components/reporter/ArticleForm'
import { toFormInitial } from '@/lib/reporter/form'
import { formOptions, getMyArticle } from '@/lib/reporter/queries'
import { requireReporter } from '@/lib/reporter/session'

export const metadata: Metadata = { title: 'Edit Article' }

type Props = { params: Promise<{ id: string }> }

export default async function EditArticlePage({ params }: Props) {
  const session = await requireReporter()
  const { id } = await params
  const article = await getMyArticle(session, Number(id))
  // Not found and "someone else's" look the same, so ids can't be probed.
  if (!article) notFound()
  const initial = toFormInitial(article, session.user.id)
  // Live articles are the editors' responsibility.
  if (initial.status === 'published') redirect(`/reporter/articles/${article.id}`)
  const options = await formOptions(session)

  return (
    <div className={adminStyles.pageShell}>
      <header className={adminStyles.pageHeader}>
        <div className={adminStyles.titleGroup}>
          <span className={adminStyles.titleIcon}>
            <Pencil size={20} />
          </span>
          <div>
            <h1 className={adminStyles.pageTitle}>Edit Article</h1>
            <p className={adminStyles.pageSubtitle}>{article.title}</p>
          </div>
        </div>
      </header>
      <ArticleForm initial={initial} options={options} canPublish={Boolean(session.user.canPublish)} />
    </div>
  )
}
