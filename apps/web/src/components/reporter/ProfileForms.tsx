'use client'

import { Camera, KeyRound, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import { changePassword, updateProfile } from '@/lib/reporter/actions'

import styles from './reporter.module.css'

export interface ProfileInitial {
  name: string
  displayName: string
  mobile: string
  designation: string
  bio: string
  photo: { id: number; url: string } | null
}

function Message({ msg }: { msg: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`${styles.alert} ${msg.tone === 'ok' ? styles.alertSuccess : styles.alertDanger}`} role={msg.tone === 'ok' ? 'status' : 'alert'}>
      {msg.text}
    </div>
  )
}

/** Fields a reporter may change about themselves. Role, status and categories are admin-only. */
export function ProfileForm({ initial, initials }: { initial: ProfileInitial; initials: string }) {
  const router = useRouter()
  const [photo, setPhoto] = useState(initial.photo)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadPhoto(file: File, name: string) {
    const form = new FormData()
    form.append('file', file)
    form.append('_payload', JSON.stringify({ alt: `${name} — profile photo` }))
    setBusy(true)
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: form }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as {
      doc?: { id: number; url?: string; sizes?: { thumb?: { url?: string } } }
      errors?: { message?: string }[]
    } | null
    setBusy(false)
    if (!res?.ok || !body?.doc) {
      setMsg({ tone: 'error', text: body?.errors?.[0]?.message || 'Photo upload failed.' })
      return
    }
    setPhoto({ id: body.doc.id, url: body.doc.sizes?.thumb?.url ?? body.doc.url ?? '' })
    setMsg({ tone: 'ok', text: 'Photo uploaded — save the profile to keep it.' })
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const res = await updateProfile({
      name: String(f.get('name') ?? ''),
      displayName: String(f.get('displayName') ?? ''),
      mobile: String(f.get('mobile') ?? ''),
      designation: String(f.get('designation') ?? ''),
      bio: String(f.get('bio') ?? ''),
      photo: photo?.id ?? null,
    })
    setBusy(false)
    setMsg(res.ok ? { tone: 'ok', text: 'Profile saved.' } : { tone: 'error', text: res.error })
    if (res.ok) router.refresh()
  }

  return (
    <form onSubmit={onSubmit}>
      <Message msg={msg} />
      <div className={styles.inlineRow} style={{ marginBottom: 18 }}>
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- CMS media
          <img src={photo.url} alt="" className={styles.avatarLarge} />
        ) : (
          <span className={styles.avatarLarge} aria-hidden="true">
            {initials}
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            const name = (e.currentTarget.form?.elements.namedItem('name') as HTMLInputElement | null)?.value ?? ''
            if (file) void uploadPhoto(file, name)
            e.target.value = ''
          }}
        />
        <button type="button" className={adminStyles.secondaryBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
          <Camera size={15} /> {photo ? 'Change photo' : 'Upload photo'}
        </button>
        {photo && (
          <button type="button" className={adminStyles.secondaryBtn} onClick={() => setPhoto(null)} disabled={busy}>
            Remove
          </button>
        )}
      </div>

      <div className={adminStyles.twoColFields}>
        <div className={adminStyles.fieldBlock}>
          <label htmlFor="name" className={adminStyles.fieldLabel}>
            Full name *
          </label>
          <input id="name" name="name" required maxLength={120} defaultValue={initial.name} className={adminStyles.textInput} />
        </div>
        <div className={adminStyles.fieldBlock}>
          <label htmlFor="displayName" className={adminStyles.fieldLabel}>
            Byline (Hindi)
          </label>
          <input id="displayName" name="displayName" maxLength={120} defaultValue={initial.displayName} className={adminStyles.textInput} placeholder="राहुल नेगी" />
        </div>
        <div className={adminStyles.fieldBlock}>
          <label htmlFor="mobile" className={adminStyles.fieldLabel}>
            Mobile number
          </label>
          <input id="mobile" name="mobile" type="tel" maxLength={20} defaultValue={initial.mobile} className={adminStyles.textInput} placeholder="+91 98xxxxxxxx" />
        </div>
        <div className={adminStyles.fieldBlock}>
          <label htmlFor="designation" className={adminStyles.fieldLabel}>
            Designation
          </label>
          <input id="designation" name="designation" maxLength={80} defaultValue={initial.designation} className={adminStyles.textInput} placeholder="संवाददाता, देहरादून" />
        </div>
      </div>
      <div className={adminStyles.fieldBlock}>
        <label htmlFor="bio" className={adminStyles.fieldLabel}>
          Short bio
        </label>
        <textarea id="bio" name="bio" rows={3} maxLength={600} defaultValue={initial.bio} className={adminStyles.textareaInput} />
      </div>
      <button type="submit" className={adminStyles.primaryLimeBtn} disabled={busy}>
        <Save size={15} /> {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const next = String(f.get('next') ?? '')
    if (next !== String(f.get('confirm') ?? '')) {
      setMsg({ tone: 'error', text: 'The new passwords do not match.' })
      return
    }
    setBusy(true)
    const res = await changePassword(String(f.get('current') ?? ''), next)
    setBusy(false)
    if (res.ok) {
      form.reset()
      setMsg({ tone: 'ok', text: 'Password changed. Other devices have been signed out.' })
    } else setMsg({ tone: 'error', text: res.error })
  }

  return (
    <form onSubmit={onSubmit} className={styles.passwordGrid}>
      <Message msg={msg} />
      <div className={adminStyles.fieldBlock}>
        <label htmlFor="current" className={adminStyles.fieldLabel}>
          Current password
        </label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={adminStyles.textInput} />
      </div>
      <div className={adminStyles.fieldBlock}>
        <label htmlFor="next" className={adminStyles.fieldLabel}>
          New password
        </label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className={adminStyles.textInput} />
        <span className={adminStyles.fieldHint}>At least 10 characters.</span>
      </div>
      <div className={adminStyles.fieldBlock}>
        <label htmlFor="confirm" className={adminStyles.fieldLabel}>
          Confirm new password
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={adminStyles.textInput} />
      </div>
      <button type="submit" className={adminStyles.navyBtn} disabled={busy}>
        <KeyRound size={15} /> {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  )
}
