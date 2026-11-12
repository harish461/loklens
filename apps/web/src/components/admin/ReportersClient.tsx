'use client'

import { KeyRound, Pencil, Power, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useRef, useState, useTransition, type FormEvent } from 'react'

import { formatDateTime } from '@/components/format'
import extra from '@/components/reporter/reporter.module.css'
import { StatusBadge } from '@/components/reporter/StatusBadge'
import {
  createReporter,
  resetReporterPassword,
  setReporterActive,
  updateReporter,
  type ReporterAccountInput,
} from '@/lib/admin/actions'
import type { ReporterRow } from '@/lib/admin/queries'

import styles from './articlesAdmin.module.css'

type Category = { id: number; name: string }
type Msg = { text: string; ok: boolean } | null

function AccountDialog({
  dialogRef,
  reporter,
  categories,
  onDone,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>
  reporter: ReporterRow | null
  categories: Category[]
  onDone: (m: Msg) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const creating = !reporter

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const input: ReporterAccountInput = {
      name: String(f.get('name') ?? ''),
      displayName: String(f.get('displayName') ?? ''),
      email: String(f.get('email') ?? ''),
      mobile: String(f.get('mobile') ?? ''),
      designation: String(f.get('designation') ?? ''),
      assignedCategories: f.getAll('categories').map(Number),
      canPublish: f.get('canPublish') === 'on',
    }
    start(async () => {
      setError(null)
      const res = creating
        ? await createReporter(input, String(f.get('password') ?? ''))
        : await updateReporter(reporter.id, input)
      if (!res.ok) {
        setError(res.error)
        return
      }
      dialogRef.current?.close()
      onDone({ text: creating ? `Reporter account created for ${input.email}.` : 'Reporter updated.', ok: true })
    })
  }

  return (
    <dialog ref={dialogRef} className={extra.dialog} style={{ maxWidth: 'min(560px, calc(100vw - 32px))', width: '100%' }} aria-labelledby="acct-h">
      {/* key resets the form whenever another reporter is opened */}
      <form key={reporter?.id ?? 'new'} onSubmit={onSubmit}>
        <h2 id="acct-h">{creating ? 'Add reporter' : `Edit ${reporter.name}`}</h2>
        <div className={styles.twoColFields}>
          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel} htmlFor="r-name">Full name *</label>
            <input id="r-name" name="name" required maxLength={120} defaultValue={reporter?.name} className={styles.textInput} />
          </div>
          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel} htmlFor="r-display">Byline (Hindi)</label>
            <input id="r-display" name="displayName" maxLength={120} defaultValue={reporter?.displayName} className={styles.textInput} />
          </div>
          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel} htmlFor="r-email">Email (login) *</label>
            <input id="r-email" name="email" type="email" required defaultValue={reporter?.email} className={styles.textInput} autoComplete="off" />
          </div>
          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel} htmlFor="r-mobile">Mobile</label>
            <input id="r-mobile" name="mobile" type="tel" maxLength={20} defaultValue={reporter?.mobile} className={styles.textInput} />
          </div>
          <div className={styles.fieldBlock}>
            <label className={styles.fieldLabel} htmlFor="r-designation">Designation</label>
            <input id="r-designation" name="designation" maxLength={80} defaultValue={reporter?.designation} className={styles.textInput} placeholder="संवाददाता, देहरादून" />
          </div>
          {creating && (
            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel} htmlFor="r-password">Starting password *</label>
              <input id="r-password" name="password" type="password" required minLength={10} className={styles.textInput} autoComplete="new-password" />
              <span className={styles.fieldHint}>At least 10 characters. Share it privately; they can change it in their profile.</span>
            </div>
          )}
        </div>
        <fieldset className={styles.fieldBlock} style={{ border: 0, padding: 0, margin: '0 0 14px' }}>
          <legend className={styles.fieldLabel} style={{ marginBottom: 6 }}>Assigned categories (none = all)</legend>
          <div className={styles.chipGroup}>
            {categories.map((c) => (
              <label key={c.id} className={styles.selectChip} style={{ cursor: 'pointer' }}>
                <input type="checkbox" name="categories" value={c.id} defaultChecked={reporter?.assignedCategories.some((a) => a.id === c.id)} /> {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.toggleRow} style={{ cursor: 'pointer', marginBottom: 14 }}>
          <span className={styles.toggleMeta}>
            <strong>May publish directly</strong>
            <small>Off: articles go to the Review Queue first.</small>
          </span>
          <input type="checkbox" name="canPublish" defaultChecked={reporter?.canPublish} style={{ width: 18, height: 18 }} />
        </label>
        {error && <div className={`${extra.alert} ${extra.alertDanger}`} role="alert">{error}</div>}
        <div className={extra.dialogActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => dialogRef.current?.close()} disabled={pending}>Cancel</button>
          <button type="submit" className={styles.primaryLimeBtn} disabled={pending}>
            {pending ? 'Saving…' : creating ? 'Create reporter' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function PasswordDialog({ dialogRef, reporter, onDone }: { dialogRef: React.RefObject<HTMLDialogElement | null>; reporter: ReporterRow | null; onDone: (m: Msg) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!reporter) return <dialog ref={dialogRef} className={extra.dialog} />
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const password = String(new FormData(e.currentTarget).get('password') ?? '')
    start(async () => {
      setError(null)
      const res = await resetReporterPassword(reporter!.id, password)
      if (!res.ok) return setError(res.error)
      dialogRef.current?.close()
      onDone({ text: `Password reset for ${reporter!.name}. They have been signed out everywhere.`, ok: true })
    })
  }
  return (
    <dialog ref={dialogRef} className={extra.dialog} aria-labelledby="pw-h">
      <form key={reporter.id} onSubmit={onSubmit}>
        <h2 id="pw-h">Reset password</h2>
        <p>Set a new password for {reporter.name}. All their open sessions will end.</p>
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={styles.textInput} style={{ width: '100%', marginBottom: 12 }} aria-label="New password" />
        {error && <div className={`${extra.alert} ${extra.alertDanger}`} role="alert">{error}</div>}
        <div className={extra.dialogActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => dialogRef.current?.close()} disabled={pending}>Cancel</button>
          <button type="submit" className={styles.navyBtn} disabled={pending}><KeyRound size={15} /> {pending ? 'Saving…' : 'Set password'}</button>
        </div>
      </form>
    </dialog>
  )
}

export function ReportersClient({ reporters, categories }: { reporters: ReporterRow[]; categories: Category[] }) {
  const router = useRouter()
  const accountRef = useRef<HTMLDialogElement>(null)
  const passwordRef = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState<ReporterRow | null>(null)
  const [resetting, setResetting] = useState<ReporterRow | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [pending, start] = useTransition()

  const done = (m: Msg) => {
    setMsg(m)
    router.refresh()
  }

  const toggleActive = (r: ReporterRow) => {
    if (r.isActive && !window.confirm(`Deactivate ${r.name}? They will be signed out and cannot log in until reactivated.`)) return
    start(async () => {
      const res = await setReporterActive(r.id, !r.isActive)
      done(res.ok ? { text: `${r.name} ${r.isActive ? 'deactivated' : 'reactivated'}.`, ok: true } : { text: res.error, ok: false })
    })
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.titleIcon}><Users size={20} /></span>
          <div>
            <h1 className={styles.pageTitle}>Reporters</h1>
            <p className={styles.pageSubtitle}>Accounts for the Reporter Desk (/reporter). Reporters cannot sign up themselves.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.primaryLimeBtn}
            onClick={() => {
              setEditing(null)
              setTimeout(() => accountRef.current?.showModal(), 0)
            }}
          >
            <UserPlus size={16} /> Add reporter
          </button>
        </div>
      </header>

      {msg && <div className={`${extra.alert} ${msg.ok ? extra.alertSuccess : extra.alertDanger}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div>}

      <section className={styles.cardSurface}>
        {reporters.length ? (
          <div className={styles.tableWrap} style={{ display: 'block', overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Reporter</th>
                  <th scope="col">Categories</th>
                  <th scope="col">Articles</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Account</th>
                  <th scope="col" className={styles.rightAlign}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reporters.map((r) => (
                  <Fragment key={r.id}>
                    <tr style={r.isActive ? undefined : { opacity: 0.6 }}>
                      <td className={styles.articleCol}>
                        <div className={styles.articleMetaText}>
                          <strong>{r.displayName || r.name}</strong>
                          <div className={styles.articleSubRow}>
                            <span>{r.email}</span>
                            {r.designation && <span>· {r.designation}</span>}
                            {r.mobile && <span>· {r.mobile}</span>}
                          </div>
                        </div>
                      </td>
                      <td>{r.assignedCategories.length ? r.assignedCategories.map((c) => <span key={c.id} className={styles.categoryChip} style={{ marginRight: 4 }}>{c.name}</span>) : <span className={styles.fieldHint}>All</span>}</td>
                      <td>
                        <button type="button" className={styles.actionBtn} onClick={() => setExpanded(expanded === r.id ? null : r.id)} aria-expanded={expanded === r.id}>
                          {r.counts.total} total · {r.counts.pending_review} pending · {r.counts.published} live
                        </button>
                      </td>
                      <td className={styles.dateCol}>
                        <div>Login: {r.lastLogin ? formatDateTime(r.lastLogin) : '—'}</div>
                        <div>Submitted: {r.lastSubmission ? formatDateTime(r.lastSubmission) : '—'}</div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${r.isActive ? styles.badgePublished : styles.badgeRejected}`}>{r.isActive ? 'Active' : 'Deactivated'}</span>
                        {r.canPublish && <div className={styles.fieldHint}>Can publish</div>}
                      </td>
                      <td className={styles.rightAlign}>
                        <div className={styles.actionBtnGroup}>
                          <button type="button" className={styles.actionIconBtn} title="Edit" aria-label={`Edit ${r.name}`} onClick={() => { setEditing(r); setTimeout(() => accountRef.current?.showModal(), 0) }}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className={styles.actionIconBtn} title="Reset password" aria-label={`Reset password for ${r.name}`} onClick={() => { setResetting(r); setTimeout(() => passwordRef.current?.showModal(), 0) }}>
                            <KeyRound size={15} />
                          </button>
                          <button type="button" className={`${styles.actionIconBtn} ${r.isActive ? styles.deleteQuickBtn : styles.publishQuickBtn}`} title={r.isActive ? 'Deactivate' : 'Reactivate'} aria-label={`${r.isActive ? 'Deactivate' : 'Reactivate'} ${r.name}`} onClick={() => toggleActive(r)} disabled={pending}>
                            <Power size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr>
                        <td colSpan={6} style={{ background: '#fafbfe' }}>
                          {r.recent.length ? (
                            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                              {r.recent.map((a) => (
                                <li key={a.id}>
                                  <Link href={`/admin/collections/articles/${a.id}`} className={styles.articleTitleLink}>{a.title}</Link>{' '}
                                  <StatusBadge status={a.status} /> <span className={styles.fieldHint}>{formatDateTime(a.updatedAt)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className={styles.fieldHint}>No articles yet.</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyBox}>
            <h3>No reporters yet</h3>
            <p>Create an account and share the login with your reporter. They sign in at /reporter/login.</p>
          </div>
        )}
      </section>

      <AccountDialog dialogRef={accountRef} reporter={editing} categories={categories} onDone={done} />
      <PasswordDialog dialogRef={passwordRef} reporter={resetting} onDone={done} />
    </div>
  )
}
