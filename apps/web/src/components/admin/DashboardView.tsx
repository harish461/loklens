/**
 * LokLens admin dashboard (Payload home view).
 * Server component: queries Payload local API via getDashboardData and renders the interactive
 * Eduplex-inspired Hindi News CMS dashboard (DashboardClient).
 */
import type { Payload, TypedUser } from 'payload'

import { DashboardClient } from './DashboardClient'
import { getDashboardData } from './dashboard-data'

type Props = {
  payload: Payload
  user?: TypedUser | null
  searchParams?: Record<string, string | string[] | undefined>
}

function initialsOf(user: TypedUser | null | undefined): string {
  const u = (user ?? {}) as { displayName?: unknown; name?: unknown; email?: unknown }
  const label = String(u.displayName ?? u.name ?? u.email ?? 'AD').trim()
  const words = label.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : label.slice(0, 2)).toUpperCase()
}

export async function DashboardView({ payload, user, searchParams }: Props) {
  const raw = Array.isArray(searchParams?.period) ? searchParams?.period[0] : searchParams?.period
  const data = await getDashboardData({ payload, user }, raw ? Number(raw) : undefined)

  const u = (user ?? {}) as { displayName?: string; name?: string; email?: string; role?: string }
  const userName = String(u.displayName || u.name || 'Admin')
  const userRole = String(u.role || 'admin')

  return (
    <DashboardClient
      userName={userName}
      userInitials={initialsOf(user)}
      userRole={userRole}
      initialArticles={data.enrichedArticles}
      dbSummary={data.dbSummary}
      stats={data.stats}
      chart={data.chart}
      donut={data.donut}
      donutTotal={data.donutTotal}
      latest={data.latest}
      activity={data.activity}
      scheduledItems={data.scheduledItems}
      pendingTasks={data.pendingTasks}
      period={data.period}
    />
  )
}
