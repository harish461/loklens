'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { deleteMyArticle } from '@/lib/reporter/actions'

import styles from './reporter.module.css'

/** Delete with a confirmation dialog. The server action re-checks ownership and that it was never published. */
export function DeleteArticleButton({
  id,
  title,
  variant = 'icon',
  redirectTo,
}: {
  id: number
  title: string
  variant?: 'icon' | 'button'
  redirectTo?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function confirmDelete() {
    setError(null)
    start(async () => {
      const res = await deleteMyArticle(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      dialog.current?.close()
      if (redirectTo) router.replace(redirectTo)
      router.refresh()
    })
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          className={`${adminStyles.actionIconBtn} ${adminStyles.deleteQuickBtn}`}
          onClick={() => dialog.current?.showModal()}
          aria-label={`Delete "${title}"`}
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      ) : (
        <button type="button" className={adminStyles.secondaryBtn} onClick={() => dialog.current?.showModal()}>
          <Trash2 size={15} /> Delete
        </button>
      )}

      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`del-${id}`}>
        <h2 id={`del-${id}`}>Delete this article?</h2>
        <p>
          “{title}” will be permanently deleted, with all its saved versions. This cannot be undone.
        </p>
        {error && (
          <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
            {error}
          </div>
        )}
        <div className={styles.dialogActions}>
          <button type="button" className={adminStyles.secondaryBtn} onClick={() => dialog.current?.close()} disabled={pending}>
            Cancel
          </button>
          <button type="button" className={styles.dangerBtn} onClick={confirmDelete} disabled={pending}>
            <Trash2 size={15} /> {pending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </dialog>
    </>
  )
}
