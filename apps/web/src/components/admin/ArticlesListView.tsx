/**
 * LokLens News Articles management view (/admin/collections/articles).
 * Server component registered as Articles.admin.components.views.list.Component.
 */
import type { Payload, TypedUser } from 'payload'

import { ArticlesListClient } from './ArticlesListClient'
import { getDashboardData } from './dashboard-data'

type Props = {
  payload: Payload
  user?: TypedUser | null
  searchParams?: Record<string, string | string[] | undefined>
}

export async function ArticlesListView({ payload, user, searchParams }: Props) {
  const data = await getDashboardData({ payload, user })
  const rawStatus = Array.isArray(searchParams?.status)
    ? searchParams?.status[0]
    : searchParams?.status

  return (
    <ArticlesListClient
      initialArticles={data.enrichedArticles}
      categories={data.dbSummary.categories}
      initialStatusFilter={typeof rawStatus === 'string' ? rawStatus : undefined}
    />
  )
}

