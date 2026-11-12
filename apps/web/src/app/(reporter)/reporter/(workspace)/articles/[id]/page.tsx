import { ArrowLeft, ExternalLink, Eye, FileText, Pencil } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { currentWorkflowStatus } from '@/access'
import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { formatDateTime } from '@/components/format'
import { DeleteArticleButton } from '@/components/reporter/DeleteArticleButton'
import styles from '@/components/reporter/reporter.module.css'
import { StatusBadge } from '@/components/reporter/StatusBadge'
import { getMyArticle } from '@/lib/reporter/queries'
import { requireReporter } from '@/lib/reporter/session'
import { articlePath } from '@/lib/revalidate/tags'
import type { Category, Media } from '@/payload-types'

export const metadata: Metadata = { title: 'Article' }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ submitted?: string; published?: string }>
}

export default async function ArticleDetailPage({ params, searchParams }: Props) {
  const session = await requireReporter()
  const { id } = await params
  const flags = await searchParams
  const article = await getMyArticle(session, Number(id))
  if (!article) notFound()

  const status = currentWorkflowStatus(article as unknown as Record<string, unknown>)
  const category = typeof article.category === 'object' && article.category ? (article.category as Category) : null
  const image = typeof article.featuredImage === 'object' && article.featuredImage ? (article.featuredImage as Media) : null
  const canEdit = status !== 'published'
  const canDelete = canEdit && !article.everPublished
  const liveUrl = status === 'published' && category ? articlePath(category.slug, article.slug ?? '', article.id) : null

  return (
    <div className={adminStyles.pageShell}>
      <header className={adminStyles.pageHeader}>
        <div className={adminStyles.titleGroup}>
          <span className={adminStyles.titleIcon}>
            <FileText size={20} />
          </span>
          <div>
            <h1 className={adminStyles.pageTitle}>{article.title}</h1>
            <p className={adminStyles.pageSubtitle}>
              <StatusBadge status={status} />
            </p>
          </div>
        </div>
        <div className={adminStyles.headerActions}>
          <Link href="/reporter/articles" className={adminStyles.secondaryBtn}>
            <ArrowLeft size={15} /> My Articles
          </Link>
          <a href={`/preview/${article.id}`} target="_blank" rel="noopener" className={adminStyles.secondaryBtn}>
            <Eye size={15} /> Preview
          </a>
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener" className={adminStyles.secondaryBtn}>
              <ExternalLink size={15} /> View live
            </a>
          )}
          {canDelete && <DeleteArticleButton id={article.id} title={article.title} variant="button" redirectTo="/reporter/articles" />}
          {canEdit && (
            <Link href={`/reporter/articles/${article.id}/edit`} className={adminStyles.primaryLimeBtn}>
              <Pencil size={15} /> Edit
            </Link>
          )}
        </div>
      </header>

      {flags.submitted && status === 'pending_review' && (
        <div className={`${styles.alert} ${styles.alertSuccess}`} role="status">
          Submitted for review. An editor will publish it or send it back with comments.
        </div>
      )}
      {flags.published && status === 'published' && (
        <div className={`${styles.alert} ${styles.alertSuccess}`} role="status">
          Published. It is now live on LokLens News.
        </div>
      )}
      {status === 'rejected' && (
        <div className={`${styles.alert} ${styles.alertDanger}`} role="status">
          <div>
            <strong>Sent back by the editor{article.reviewedAt ? ` on ${formatDateTime(article.reviewedAt)}` : ''}</strong>
            <span className={styles.alertNote}>{article.reviewNote || 'No reason was given.'}</span>
            <div style={{ marginTop: 6 }}>
              <Link href={`/reporter/articles/${article.id}/edit`}>Edit and resubmit →</Link>
            </div>
          </div>
        </div>
      )}
      {status === 'published' && (
        <div className={`${styles.alert} ${styles.alertInfo}`} role="note">
          This article is live. To change it, ask an editor.
        </div>
      )}

      <div className={styles.detailGrid}>
        <section className={adminStyles.editorCard}>
          {image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- CMS media
            <img src={image.sizes?.article?.url ?? image.url} alt={image.alt ?? ''} className={styles.detailImage} />
          ) : (
            <div className={styles.detailImage} aria-hidden="true" />
          )}
          {image?.caption && <p className={adminStyles.fieldHint}>{image.caption}</p>}
          <h2 style={{ fontSize: 20, lineHeight: 1.45, margin: '16px 0 8px' }}>{article.title}</h2>
          <p className={styles.summaryText}>{article.summary || <em>No summary yet.</em>}</p>
          <a href={`/preview/${article.id}`} target="_blank" rel="noopener" className={adminStyles.secondaryBtn}>
            <Eye size={15} /> Read the full preview
          </a>
        </section>

        <aside className={adminStyles.editorCard}>
          <h2 className={adminStyles.editorCardTitle}>Details</h2>
          <dl className={styles.metaList}>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={status} />
              </dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{category?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(article.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDateTime(article.updatedAt)}</dd>
            </div>
            {article.submittedAt && (
              <div>
                <dt>Submitted</dt>
                <dd>{formatDateTime(article.submittedAt)}</dd>
              </div>
            )}
            {article.reviewedAt && (
              <div>
                <dt>Reviewed</dt>
                <dd>{formatDateTime(article.reviewedAt)}</dd>
              </div>
            )}
            {status === 'published' && article.publishedAt && (
              <div>
                <dt>Published</dt>
                <dd>{formatDateTime(article.publishedAt)}</dd>
              </div>
            )}
            <div>
              <dt>Suggested as featured</dt>
              <dd>{article.featureRequested ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}
