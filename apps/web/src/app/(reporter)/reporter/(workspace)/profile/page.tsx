import { UserRound } from 'lucide-react'
import type { Metadata } from 'next'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { PasswordForm, ProfileForm } from '@/components/reporter/ProfileForms'
import styles from '@/components/reporter/reporter.module.css'
import { mediaThumbUrl } from '@/lib/reporter/queries'
import { asReporter, requireReporter } from '@/lib/reporter/session'
import type { Category, Media } from '@/payload-types'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const session = await requireReporter()
  // Read my own record as myself (depth 1 for photo and category names).
  const me = await session.payload.findByID({ collection: 'users', id: session.user.id, depth: 1, ...asReporter(session) })
  const photo = me.photo && typeof me.photo === 'object' ? (me.photo as Media) : null
  const categories = (me.assignedCategories ?? []).filter((c): c is Category => typeof c === 'object' && c !== null)
  const initials = (me.name || 'R')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className={adminStyles.pageShell}>
      <header className={adminStyles.pageHeader}>
        <div className={adminStyles.titleGroup}>
          <span className={adminStyles.titleIcon}>
            <UserRound size={20} />
          </span>
          <div>
            <h1 className={adminStyles.pageTitle}>Profile</h1>
            <p className={adminStyles.pageSubtitle}>Your byline and contact details.</p>
          </div>
        </div>
      </header>

      <div className={adminStyles.editorGrid}>
        <div className={adminStyles.editorMainCol}>
          <section className={adminStyles.editorCard} aria-labelledby="profile-h">
            <h2 id="profile-h" className={adminStyles.editorCardTitle}>
              Personal details
            </h2>
            <ProfileForm
              initials={initials}
              initial={{
                name: me.name ?? '',
                displayName: me.displayName ?? '',
                mobile: me.mobile ?? '',
                designation: me.designation ?? '',
                bio: me.bio ?? '',
                photo: photo ? { id: photo.id, url: mediaThumbUrl(photo) ?? '' } : null,
              }}
            />
          </section>
          <section className={adminStyles.editorCard} aria-labelledby="password-h">
            <h2 id="password-h" className={adminStyles.editorCardTitle}>
              Change password
            </h2>
            <PasswordForm />
          </section>
        </div>

        <aside className={adminStyles.editorRightCol}>
          <section className={adminStyles.editorCard} aria-labelledby="account-h">
            <h2 id="account-h" className={adminStyles.editorCardTitle}>
              Account
            </h2>
            <p className={adminStyles.fieldHint} style={{ marginTop: -6, marginBottom: 14 }}>
              Managed by the LokLens admin.
            </p>
            <div className={adminStyles.fieldBlock}>
              <span className={adminStyles.fieldLabel}>Email (login)</span>
              <span className={styles.readOnlyValue}>{me.email}</span>
            </div>
            <div className={adminStyles.fieldBlock}>
              <span className={adminStyles.fieldLabel}>Role</span>
              <span className={styles.readOnlyValue}>Reporter</span>
            </div>
            <div className={adminStyles.fieldBlock}>
              <span className={adminStyles.fieldLabel}>Account status</span>
              <span className={styles.readOnlyValue}>{me.isActive === false ? 'Deactivated' : 'Active'}</span>
            </div>
            <div className={adminStyles.fieldBlock}>
              <span className={adminStyles.fieldLabel}>Publishing</span>
              <span className={styles.readOnlyValue}>{me.canPublish ? 'May publish directly' : 'Articles are reviewed by an editor'}</span>
            </div>
            <div className={adminStyles.fieldBlock}>
              <span className={adminStyles.fieldLabel}>Assigned categories</span>
              <span className={styles.readOnlyValue}>
                {categories.length ? categories.map((c) => c.name).join(', ') : 'All categories'}
              </span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
