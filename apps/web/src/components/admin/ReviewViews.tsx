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

function viewer(props: AdminViewServerProps) {
  const user = props.initPageResult?.req.user as User | null | undefined
  if (!user || !props.initPageResult?.permissions?.canAccessAdmin) redirect('/admin/login')
  return user
}

export async function ReviewQueueView(props: AdminViewServerProps) {
  const user = viewer(props)
  if (!isEditorOrAdmin(user as unknown as MaybeUser)) redirect('/admin')
  const data = await reviewQueue(props.initPageResult.req.payload, { user, overrideAccess: false })
  return shell(props, <ReviewQueueClient pending={data.pending} rejected={data.rejected} />)
}

export async function ReportersView(props: AdminViewServerProps) {
  const user = viewer(props)
  if (!isAdmin(user as unknown as MaybeUser)) redirect('/admin')
  const data = await reportersOverview(props.initPageResult.req.payload, { user, overrideAccess: false })
  return shell(props, <ReportersClient reporters={data.rows} categories={data.categories} />)
}
