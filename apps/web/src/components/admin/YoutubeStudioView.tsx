/**
 * /admin/youtube (editors and admins): YouTube Studio (api-contract §9).
 *   ?tab=posts (default)      all posts, filter by status
 *   ?tab=edit[&id=]           create or edit a post (editors and admins)
 *   ?tab=review[&id=]         posts waiting for approval and failed uploads; the panel approves (admins only)
 *   ?tab=history              on YouTube, in the upload queue, failed or cancelled
 *   ?tab=footage              upload and manage footage
 * The role is checked here on the server; every action checks it again.
 */
import { Clapperboard, Plus } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'

import { isAdmin, isEditorOrAdmin, type MaybeUser } from '@/access'
import { YT_POST_STATUSES, type YtPostStatus } from '@/access/youtubeLimits'
import { FootageList } from '@/components/footage/FootageList'
import { FootageUploader } from '@/components/footage/FootageUploader'
import footageStyles from '@/components/footage/footage.module.css'
import { STATUS_LABEL } from '@/components/youtube/labels'
import { PostEditor } from '@/components/youtube/PostEditor'
import { PostList } from '@/components/youtube/PostList'
import { ReviewPanel } from '@/components/youtube/ReviewPanel'
import ys from '@/components/youtube/studio.module.css'
import { listFootage } from '@/lib/footage/queries'
import { STUDIO_OFF_MESSAGE, youtubeStudioEnabled } from '@/lib/youtube/flags'
import { articleOptions, footageOptions, listPosts, postDetail, statusCounts, thumbnailOptions } from '@/lib/youtube/studioQueries'
import type { User } from '@/payload-types'

import styles from './articlesAdmin.module.css'
import { adminShell } from './ReviewViews'

type Tab = 'posts' | 'edit' | 'review' | 'history' | 'footage'
const TABS: Tab[] = ['posts', 'edit', 'review', 'history', 'footage']
const HISTORY: YtPostStatus[] = ['approved', 'uploading', 'processing', 'scheduled', 'published', 'failed', 'cancelled']

function param(sp: unknown, key: string): string | undefined {
  const v = (sp as Record<string, unknown> | undefined)?.[key]
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s.trim() ? s.trim() : undefined
}

export async function YoutubeStudioView(props: AdminViewServerProps) {
  const user = props.initPageResult?.req.user as User | null | undefined
  if (!user || !props.initPageResult?.permissions?.canAccessAdmin) redirect('/admin/login?redirect=%2Fadmin%2Fyoutube')
  const u = user as unknown as MaybeUser
  if (!isEditorOrAdmin(u)) redirect('/admin')
  const admin = isAdmin(u)
  const payload = props.initPageResult.req.payload

  const tabParam = param(props.searchParams, 'tab') as Tab | undefined
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'posts'
  const id = Number(param(props.searchParams, 'id'))
  const postId = Number.isSafeInteger(id) && id > 0 ? id : null
  const statusParam = param(props.searchParams, 'status') as YtPostStatus | undefined
  const statusFilter = statusParam && (YT_POST_STATUSES as readonly string[]).includes(statusParam) ? statusParam : undefined

  const header = (
    <header className={styles.pageHeader}>
      <div className={styles.titleGroup}>
        <span className={styles.titleIcon}>
          <Clapperboard size={20} />
        </span>
        <div>
          <h1 className={styles.pageTitle}>YouTube Studio</h1>
          <p className={styles.pageSubtitle}>YouTube videos and Shorts from footage: write, approve, publish.</p>
        </div>
      </div>
      <div className={styles.headerActions}>
        <Link href="/admin/youtube?tab=edit" className={styles.primaryLimeBtn}>
          <Plus size={16} /> New post
        </Link>
      </div>
    </header>
  )

  if (!youtubeStudioEnabled()) {
    return adminShell(
      props,
      <div className={styles.pageShell}>
        {header}
        <section className={styles.cardSurface}>
          <p className={footageStyles.off}>{STUDIO_OFF_MESSAGE}</p>
        </section>
      </div>,
    )
  }

  const counts = await statusCounts(payload, user)
  const reviewCount = counts.pending_review + counts.failed
  const tabs: { key: Tab; label: string; href: string; count?: number }[] = [
    { key: 'posts', label: 'All posts', href: '/admin/youtube' },
    { key: 'edit', label: postId && tab === 'edit' ? 'Edit' : 'New post', href: '/admin/youtube?tab=edit' },
    { key: 'review', label: 'Review', href: '/admin/youtube?tab=review', count: reviewCount },
    { key: 'history', label: 'History', href: '/admin/youtube?tab=history' },
    { key: 'footage', label: 'Footage', href: '/admin/youtube?tab=footage' },
  ]

  let body: React.ReactNode
  if (tab === 'edit') {
    const [post, footage, thumbs, articles, settings] = await Promise.all([
      postId ? postDetail(payload, user, postId) : Promise.resolve(null),
      footageOptions(payload, user),
      thumbnailOptions(payload, user),
      articleOptions(payload, user),
      payload.findGlobal({ slug: 'youtube-settings', depth: 0, user, overrideAccess: false }),
    ])
    body =
      postId && !post ? (
        <p className={ys.empty}>Post not found.</p>
      ) : (
        <PostEditor
          key={post?.id ?? 'new'}
          post={post}
          footage={footage}
          thumbnails={thumbs}
          articles={articles}
          requireThumbnail={settings.requireThumbnailForVideos !== false}
        />
      )
  } else if (tab === 'review' && postId) {
    const post = await postDetail(payload, user, postId)
    body = post ? <ReviewPanel post={post} isAdmin={admin} /> : <p className={ys.empty}>Post not found.</p>
  } else if (tab === 'review') {
    const rows = await listPosts(payload, user, { statuses: ['pending_review', 'failed'] })
    body = <PostList rows={rows} linkTo="review" empty="Nothing to review." />
  } else if (tab === 'history') {
    const rows = await listPosts(payload, user, { statuses: HISTORY, limit: 100 })
    body = <PostList rows={rows} linkTo="review" empty="No post has been approved yet." />
  } else if (tab === 'footage') {
    const rows = await listFootage(payload, user, { limit: 50 })
    body = (
      <>
        <FootageUploader />
        <div style={{ marginTop: 16 }}>
          <FootageList rows={rows} showUploader />
        </div>
      </>
    )
  } else {
    const rows = await listPosts(payload, user, { statuses: statusFilter ? [statusFilter] : undefined, limit: 100 })
    body = (
      <>
        <div className={`${ys.tabs} ${ys.pillLinks}`} role="tablist" aria-label="Status">
          <Link href="/admin/youtube" className={`${styles.statusTabPill} ${!statusFilter ? styles.statusTabPillActive : ''}`}>
            All
          </Link>
          {YT_POST_STATUSES.filter((st) => counts[st] > 0).map((st) => (
            <Link key={st} href={`/admin/youtube?status=${st}`} className={`${styles.statusTabPill} ${statusFilter === st ? styles.statusTabPillActive : ''}`}>
              {STATUS_LABEL[st]} <span className={styles.tabCount}>{counts[st]}</span>
            </Link>
          ))}
        </div>
        <PostList rows={rows} linkTo="edit" empty="No posts yet. Start with “New post” above." />
      </>
    )
  }

  return adminShell(
    props,
    <div className={styles.pageShell}>
      {header}
      <div className={`${styles.statusTabsRow} ${ys.pillLinks}`} role="tablist">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} role="tab" aria-selected={tab === t.key} className={`${styles.statusTabPill} ${tab === t.key ? styles.statusTabPillActive : ''}`}>
            {t.label}
            {t.count ? <span className={styles.tabCount}>{t.count}</span> : null}
          </Link>
        ))}
      </div>
      <section className={styles.cardSurface}>{body}</section>
    </div>,
  )
}
