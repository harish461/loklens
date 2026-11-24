'use client'

import { useState } from 'react'

/** Sets a new password through the public API (POST /api/v1/auth/reset). The token comes from the email link. */
export function ResetForm() {
  // Read on the client only; the token is not part of the server-rendered markup.
  const [token] = useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('token') ?? ''))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const problem =
      password.length < 8 ? 'पासवर्ड कम से कम 8 अक्षर का होना चाहिए।' : password !== confirm ? 'दोनों पासवर्ड एक जैसे नहीं हैं।' : !token ? 'रीसेट लिंक अधूरा है। ईमेल का लिंक दोबारा खोलें।' : ''
    if (problem) {
      setMessage(problem)
      setStatus('error')
      return
    }
    setStatus('saving')
    try {
      const res = await fetch('/api/v1/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } }
      if (res.ok && body.ok) {
        setStatus('done')
        setMessage('आपका पासवर्ड बदल दिया गया है। अब ऐप में नए पासवर्ड से साइन इन करें।')
      } else {
        setStatus('error')
        setMessage(body.error?.message ?? 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।')
      }
    } catch {
      setStatus('error')
      setMessage('इंटरनेट कनेक्शन जांचें और फिर कोशिश करें।')
    }
  }

  if (status === 'done') return <p style={{ fontSize: 16, lineHeight: 1.6 }}>{message}</p>

  const input = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E4E6EA', fontSize: 16, marginBottom: 12 } as const

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="pw" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>नया पासवर्ड</label>
      <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
      <label htmlFor="pw2" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>पासवर्ड दोबारा लिखें</label>
      <input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} />
      <button
        type="submit"
        disabled={status === 'saving'}
        style={{ width: '100%', padding: '14px', borderRadius: 999, border: 0, background: '#111214', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
      >
        {status === 'saving' ? 'सेव हो रहा है…' : 'पासवर्ड सेव करें'}
      </button>
      {message && <p role="alert" style={{ color: '#C41D17', marginTop: 14 }}>{message}</p>}
    </form>
  )
}
