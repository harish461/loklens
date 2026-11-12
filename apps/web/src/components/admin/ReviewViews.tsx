/**
 * Admin views for the reporter workflow (architecture §8), registered in payload.config.ts:
 * - /admin/review     Review Queue — editors and admins
 * - /admin/reporters  Reporter accounts — admins only
 * Both check the role on the server and render inside Payload's DefaultTemplate (LokLens sidebar).
 */
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import type { ReactNode } from 'react'

import { isAdmin, isEditorOrAdmin, type MaybeUser } from '@/access'
import { reportersOverview, reviewQueue } from '@/lib/admin/queries'
import type { User } from '@/payload-types'

import { ReportersClient } from './ReportersClient'
import { ReviewQueueClient } from './ReviewQueueClient'

function shell(props: AdminViewServerProps, children: ReactNode) {
  const { initPageResult, params, searchParams } = props
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={initPageResult.req.user ?? undefined}
      visibleEntities={{
        collections: initPageResult.visibleEntities?.collections,
        globals: initPageResult.visibleEntities?.globals,
      }}
    >
      {children}
    </DefaultTemplate>
  )
}

/**
 * Signed-in admin user, or a redirect to login that returns here afterwards (like Payload's own views).
 * The `redirect` param matters: when the page is opened from another site or app, Payload's CSRF rules ignore
 * the session cookie for that request; the login page then sees the session and sends the user back here.
 */
function viewer(props: AdminViewServerProps, path: string) {
  const user = props.initPageResult?.req.user as User | null | undefined
  if (!user || !props.initPageResult?.permissions?.canAccessAdmin) {
    redirect(`/admin/login?redirect=${encodeURIComponent(path)}`)
  }
  return user
}

export async function ReviewQueueView(props: AdminViewServerProps) {
  const user = viewer(props, '/admin/review')
  if (!isEditorOrAdmin(user as unknown as MaybeUser)) redirect('/admin')
  const data = await reviewQueue(props.initPageResult.req.payload, { user, overrideAccess: false })
  return shell(props, <ReviewQueueClient pending={data.pending} rejected={data.rejected} />)
}

export async function ReportersView(props: AdminViewServerProps) {
  const user = viewer(props, '/admin/reporters')
  if (!isAdmin(user as unknown as MaybeUser)) redirect('/admin')
  const data = await reportersOverview(props.initPageResult.req.payload, { user, overrideAccess: false })
  return shell(props, <ReportersClient reporters={data.rows} categories={data.categories} />)
}
