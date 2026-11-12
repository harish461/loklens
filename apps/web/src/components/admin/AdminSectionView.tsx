/**
 * Server wrapper for LokLens custom admin sidebar views.
 * Enforces Payload authentication (initPageResult.permissions.canAccessAdmin), wraps the view inside
 * Payload's DefaultTemplate (so our dark navy AdminNav sidebar is always present), and loads live
 * database records via getDashboardData.
 */
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { AdminSectionClient, type SectionRouteKey } from './AdminSectionClient'
import { getDashboardData } from './dashboard-data'

async function renderSection(props: AdminViewServerProps, section: SectionRouteKey) {
  const { initPageResult, params, searchParams } = props
  if (!initPageResult?.permissions?.canAccessAdmin) {
    redirect('/admin/login')
  }

  const payload = initPageResult.req.payload
  const user = initPageResult.req.user
  const data = await getDashboardData({ payload, user })

  const locRes = await payload
    .find({
      collection: 'locations',
      limit: 100,
      depth: 0,
      pagination: false,
      overrideAccess: false,
      user: user ?? undefined,
    })
    .catch(() => ({ docs: [] }))

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={{
        collections: initPageResult.visibleEntities?.collections,
        globals: initPageResult.visibleEntities?.globals,
      }}
    >
      <AdminSectionClient
        section={section}
        articles={data.enrichedArticles}
        categories={data.dbSummary.categories}
        authors={data.dbSummary.authors}
        locations={locRes.docs.map((l) => ({
          id: l.id,
          name: String(l.name),
          slug: String(l.slug),
        }))}
      />
    </DefaultTemplate>
  )
}

export async function SubcategoriesView(props: AdminViewServerProps) {
  return renderSection(props, 'subcategories')
}

export async function AuthorsView(props: AdminViewServerProps) {
  return renderSection(props, 'authors')
}

export async function BreakingNewsView(props: AdminViewServerProps) {
  return renderSection(props, 'breaking-news')
}

export async function ScheduledNewsView(props: AdminViewServerProps) {
  return renderSection(props, 'scheduled-news')
}

export async function CommentsView(props: AdminViewServerProps) {
  return renderSection(props, 'comments')
}

export async function AdvertisementsView(props: AdminViewServerProps) {
  return renderSection(props, 'advertisements')
}

export async function SeoView(props: AdminViewServerProps) {
  return renderSection(props, 'seo')
}

export async function AnalyticsView(props: AdminViewServerProps) {
  return renderSection(props, 'analytics')
}

