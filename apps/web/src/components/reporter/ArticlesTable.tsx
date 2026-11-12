/**
 * The reporter's article rows: a table on desktop, cards on phones (same classes as the admin list,
 * which switches between them at 820px). Actions shown are only those this reporter may do:
 * edit while unpublished, delete only if never published.
 */
import { Eye, ImageOff, Pencil } from 'lucide-react'
import Link from 'next/link'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { formatDateTime } from '@/components/format'
import type { ReporterArticleRow } from '@/lib/reporter/queries'

import { DeleteArticleButton } from './DeleteArticleButton'
import { StatusBadge } from './StatusBadge'

const canEdit = (row: ReporterArticleRow) => row.status !== 'published'
const canDelete = (row: ReporterArticleRow) => row.status !== 'published' && !row.everPublished

function Thumb({ row, className }: { row: ReporterArticleRow; className: string }) {
  return row.thumbUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- small CMS thumbnails, already resized by Payload
    <img src={row.thumbUrl} alt="" className={className} loading="lazy" />
  ) : (
    <span className={className} style={{ display: 'grid', placeItems: 'center', color: '#a2a0b8' }} aria-hidden="true">
      <ImageOff size={16} />
    </span>
  )
}

function Actions({ row }: { row: ReporterArticleRow }) {
  return (
    <div className={adminStyles.actionBtnGroup}>
      <Link href={`/reporter/articles/${row.id}`} className={adminStyles.actionIconBtn} aria-label={`View "${row.title}"`} title="View">
        <Eye size={15} />
      </Link>
      {canEdit(row) && (
        <Link
          href={`/reporter/articles/${row.id}/edit`}
          className={adminStyles.actionIconBtn}
          aria-label={`Edit "${row.title}"`}
          title="Edit"
        >
          <Pencil size={15} />
        </Link>
      )}
      {canDelete(row) && <DeleteArticleButton id={row.id} title={row.title} />}
    </div>
  )
}

export function ArticlesTable({ rows }: { rows: ReporterArticleRow[] }) {
  return (
    <>
      <div className={adminStyles.tableWrap}>
        <table className={adminStyles.table}>
          <thead>
            <tr>
              <th scope="col">Article</th>
              <th scope="col">Category</th>
              <th scope="col">Created</th>
              <th scope="col">Last updated</th>
              <th scope="col">Status</th>
              <th scope="col" className={adminStyles.rightAlign}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={adminStyles.articleCol}>
                  <div className={adminStyles.articleFlex}>
                    <span className={adminStyles.thumbFrame}>
                      <Thumb row={row} className={adminStyles.thumbImg} />
                    </span>
                    <div className={adminStyles.articleMetaText}>
                      <Link href={`/reporter/articles/${row.id}`} className={adminStyles.articleTitleLink}>
                        {row.title}
                      </Link>
                      {row.slug && (
                        <div className={adminStyles.articleSubRow}>
                          <span className={adminStyles.slugMono}>/{row.slug}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{row.categoryName ? <span className={adminStyles.categoryChip}>{row.categoryName}</span> : '—'}</td>
                <td className={adminStyles.dateCol}>{formatDateTime(row.createdAt)}</td>
                <td className={adminStyles.dateCol}>{formatDateTime(row.updatedAt)}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td className={adminStyles.rightAlign}>
                  <Actions row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={adminStyles.mobileCardList}>
        {rows.map((row) => (
          <div key={row.id} className={adminStyles.mobileArticleCard}>
            <div className={adminStyles.mobileCardTop}>
              <Thumb row={row} className={adminStyles.mobileThumb} />
              <div className={adminStyles.mobileHeadInfo}>
                <Link href={`/reporter/articles/${row.id}`} className={adminStyles.mobileTitle}>
                  {row.title}
                </Link>
                <div className={adminStyles.mobileMetaRow}>
                  {row.categoryName && <span className={adminStyles.categoryChip}>{row.categoryName}</span>}
                  <span className={adminStyles.fieldHint}>{formatDateTime(row.updatedAt)}</span>
                </div>
              </div>
            </div>
            <div className={adminStyles.mobileCardBottom}>
              <StatusBadge status={row.status} />
              <Actions row={row} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
