import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { isStaff, type MaybeUser } from '@/access'
import { WORKFLOW_LABELS, isWorkflowStatus } from '@/access/workflow'
import { getSiteSettings, listArticles } from '@/lib/data'
import { getArticlePreview } from '@/lib/data/preview'
import { getSessionUser } from '@/lib/reporter/session'

import { ArticleView } from '../../[category]/[slugId]/ArticleView'
import styles from './preview.module.css'

/**
 * Draft preview inside the real site layout, so it looks exactly like the published page.
 * Signed-in newsroom users only; Payload's read rules decide which articles each one may see
 * (reporters: their own + published; editors/admins: all). Never cached, never indexed.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Preview', robots: { index: false, follow: false } }

type Props = { params: Promise<{ id: string }> }

export default async function PreviewPage({ params }: Props) {
  const { user } = await getSessionUser()
  if (!user || !isStaff(user as unknown as MaybeUser) || user.isActive === false) redirect('/reporter/login')
  const { id } = await params
  const result = await getArticlePreview(Number(id), user)
  const back = user.role === 'reporter' ? `/reporter/articles/${id}` : `/admin/collections/articles/${id}`

  if (!result.ok) {
    return (
      <div className="container">
        <div className={styles.banner} role="status">
          <strong>Preview not available.</strong>{' '}
          {result.reason === 'incomplete'
            ? 'Choose a category for this article first — the page needs it.'
            : 'This article does not exist or you cannot view it.'}{' '}
          <a href={back}>Back</a>
        </div>
      </div>
    )
  }

  const [settings, latest] = await Promise.all([getSiteSettings(), listArticles({ pageSize: 7 })])
  const sidebar = latest.items.filter((a) => a.id !== result.article.id).slice(0, 6)
  const label = isWorkflowStatus(result.status) ? WORKFLOW_LABELS[result.status] : result.status

  return (
    <>
      <div className="container">
        <div className={styles.banner} role="status">
          <span className={styles.pill}>पूर्वावलोकन · Preview</span>
          <span>
            Status: <strong>{label}</strong>. This is how the article will look on LokLens News.
          </span>
          <a href={back} className={styles.back}>
            ← Back to editing
          </a>
        </div>
      </div>
      <ArticleView article={result.article} settings={settings} sidebar={sidebar} />
    </>
  )
}
