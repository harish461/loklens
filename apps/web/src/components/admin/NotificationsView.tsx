/**
 * /admin/notifications (admins only): overview, create and history of push notifications.
 * The role is checked here on the server; the actions it calls check it again (lib/admin/notificationActions).
 */
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { isAdmin, type MaybeUser } from '@/access'
import { notificationFormOptions, notificationHistory, notificationStats, type HistoryFilters } from '@/lib/admin/notifications'
import type { User } from '@/payload-types'

import { NotificationsClient } from './NotificationsClient'
import { adminShell } from './ReviewViews'

const STATUSES = ['scheduled', 'queued', 'sending', 'sent', 'failed', 'cancelled']

function str(v: unknown): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s.trim() ? s.trim() : undefined
}

/** History filters from the URL (?tab=history&from=2026-11-01&to=…&category=3&status=sent&page=2), validated. */
function filtersFrom(searchParams: AdminViewServerProps['searchParams']): HistoryFilters {
  const sp = (searchParams ?? {}) as Record<string, unknown>
  const date = (v?: string, endOfDay = false) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
    const d = new Date(`${v}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  const category = Number(str(sp.category))
  const page = Number(str(sp.page))
  const status = str(sp.status)
  return {
    from: date(str(sp.from)),
    to: date(str(sp.to), true),
    category: Number.isInteger(category) && category > 0 ? category : undefined,
    status: status && STATUSES.includes(status) ? status : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export async function NotificationsView(props: AdminViewServerProps) {
  const user = props.initPageResult?.req.user as User | null | undefined
  if (!user || !props.initPageResult?.permissions?.canAccessAdmin) redirect('/admin/login?redirect=%2Fadmin%2Fnotifications')
  if (!isAdmin(user as unknown as MaybeUser)) redirect('/admin')

  const payload = props.initPageResult.req.payload
  const sp = (props.searchParams ?? {}) as Record<string, unknown>
  const filters = filtersFrom(props.searchParams)
  const [stats, history, options, recent] = await Promise.all([
    notificationStats(payload),
    notificationHistory(payload, filters),
    notificationFormOptions(payload),
    notificationHistory(payload, { page: 1 }),
  ])
  return adminShell(
    props,
    <NotificationsClient
      tab={str(sp.tab) === 'create' || str(sp.tab) === 'history' ? (str(sp.tab) as 'create' | 'history') : 'overview'}
      stats={stats}
      recent={recent.rows.slice(0, 6)}
      history={history}
      filters={{ from: str(sp.from) ?? '', to: str(sp.to) ?? '', category: filters.category ?? null, status: filters.status ?? '' }}
      categories={options.categories}
      articles={options.articles}
    />,
  )
}
