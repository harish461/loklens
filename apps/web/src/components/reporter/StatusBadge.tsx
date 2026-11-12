import { WORKFLOW_LABELS, type WorkflowStatus } from '@/access/workflow'

import styles from '../admin/articlesAdmin.module.css'

const TONE: Record<WorkflowStatus, string> = {
  draft: styles.badgeDraft,
  pending_review: styles.badgePending,
  rejected: styles.badgeRejected,
  published: styles.badgePublished,
}

/** Same badge styles as the admin article list. */
export function StatusBadge({ status }: { status: WorkflowStatus }) {
  return <span className={`${styles.statusBadge} ${TONE[status]}`}>{WORKFLOW_LABELS[status]}</span>
}
