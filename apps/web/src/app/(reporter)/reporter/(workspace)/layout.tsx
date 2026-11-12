import type { ReactNode } from 'react'

import { ReporterNav } from '@/components/reporter/ReporterNav'
import styles from '@/components/reporter/reporter.module.css'
import { myStats } from '@/lib/reporter/queries'
import { requireReporter } from '@/lib/reporter/session'

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase() || 'R'
}

/** Signed-in reporter shell. Each page below also calls requireReporter() itself. */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireReporter()
  const stats = await myStats(session)
  const name = session.user.displayName || session.user.name
  return (
    <div className={styles.shell}>
      <ReporterNav
        userName={name}
        userInitials={initialsOf(session.user.name)}
        designation={session.user.designation ?? ''}
        pendingCount={stats.pending_review}
      />
      <main className={styles.main} id="main">
        {children}
      </main>
    </div>
  )
}
