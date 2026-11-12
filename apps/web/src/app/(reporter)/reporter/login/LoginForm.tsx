'use client'

import { LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import adminStyles from '@/components/admin/articlesAdmin.module.css'
import styles from '@/components/reporter/reporter.module.css'

/** Signs in through Payload's own login endpoint (same users, same hashing, same lockout rules). */
export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      })
      const body = (await res.json().catch(() => null)) as {
        user?: { role?: string }
        errors?: { message?: string }[]
      } | null
      if (!res.ok || !body?.user) {
        setError(body?.errors?.[0]?.message || 'The email or password is not correct.')
        return
      }
      // Editors and admins belong in /admin; the server would redirect them anyway.
      router.replace(body.user.role === 'reporter' ? '/reporter' : '/admin')
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      {error && (
        <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
          {error}
        </div>
      )}
      <div className={adminStyles.fieldBlock}>
        <label htmlFor="email" className={adminStyles.fieldLabel}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={adminStyles.textInput} />
      </div>
      <div className={adminStyles.fieldBlock}>
        <label htmlFor="password" className={adminStyles.fieldLabel}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={adminStyles.textInput}
        />
      </div>
      <button type="submit" className={adminStyles.fullWidthLimeBtn} disabled={busy}>
        <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
