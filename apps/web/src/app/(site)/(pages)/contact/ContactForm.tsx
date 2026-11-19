'use client'

import { useState } from 'react'

import styles from './contact.module.css'

const TARGET_EMAIL = 'newsloklens@gmail.com'

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    const payload = {
      firstName: String(formData.get('firstName') || '').trim(),
      lastName: String(formData.get('lastName') || '').trim(),
      mobileNumber: String(formData.get('mobileNumber') || '').trim(),
      subject: String(formData.get('subject') || '').trim(),
      message: String(formData.get('message') || '').trim(),
    }

    if (!payload.firstName || !payload.lastName || !payload.mobileNumber || !payload.subject || !payload.message) {
      setError('कृपया सभी आवश्यक फ़ील्ड भरें (Please fill in all required fields).')
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        transport?: string
        error?: string
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'संदेश भेजने में त्रुटि हुई।')
      }

      // If server returned client-relay (when SMTP_PASS is not set in env), send directly from browser via FormSubmit AJAX
      if (result.transport === 'client-relay') {
        const fullName = `${payload.firstName} ${payload.lastName}`.trim()
        const relayRes = await fetch(`https://formsubmit.co/ajax/${TARGET_EMAIL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            _subject: `[LokLens Contact] ${payload.subject} — ${fullName}`,
            _template: 'table',
            _captcha: 'false',
            Name: fullName,
            'First Name': payload.firstName,
            'Last Name': payload.lastName,
            'Mobile Number': payload.mobileNumber,
            Subject: payload.subject,
            Message: payload.message,
          }),
        })

        if (!relayRes.ok) {
          throw new Error('ईमेल सर्वर से संपर्क नहीं हो सका।')
        }
      }

      form.reset()
      setSubmitted(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'संदेश भेजने में समस्या आई। कृपया पुनः प्रयास करें।'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.successBox} role="alert">
        <h3 className={styles.successTitle}>धन्यवाद! आपका संदेश हमें प्राप्त हो गया है।</h3>
        <p className={styles.successText}>
          आपका संदेश <strong>{TARGET_EMAIL}</strong> पर सफलतापूर्वक भेज दिया गया है। हमारी संपादकीय व सहायता टीम जल्द
          ही आपसे संपर्क करेगी।
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false)
            setError(null)
          }}
          className={styles.btnSecondary}
        >
          नया संदेश भेजें
        </button>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && (
        <div className={styles.errorBox} role="alert">
          {error}
        </div>
      )}

      <div className={styles.rowTwo}>
        <div className={styles.field}>
          <label htmlFor="firstName" className={styles.label}>
            First Name <span className={styles.required}>*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            disabled={submitting}
            placeholder="पहला नाम"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="lastName" className={styles.label}>
            Last Name <span className={styles.required}>*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            disabled={submitting}
            placeholder="अंतिम नाम"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.rowTwo}>
        <div className={styles.field}>
          <label htmlFor="mobileNumber" className={styles.label}>
            Mobile Number <span className={styles.required}>*</span>
          </label>
          <input
            id="mobileNumber"
            name="mobileNumber"
            type="tel"
            required
            disabled={submitting}
            placeholder="+91 XXXXX XXXXX"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="subject" className={styles.label}>
            Subject <span className={styles.required}>*</span>
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            disabled={submitting}
            placeholder="संदेश का विषय"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="message" className={styles.label}>
          Message (संदेश) <span className={styles.required}>*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          disabled={submitting}
          placeholder="अपना संदेश या समाचार विवरण यहाँ लिखें…"
          className={styles.textarea}
        />
      </div>

      <button type="submit" disabled={submitting} className={styles.btnSubmit}>
        <span>{submitting ? 'भेजा जा रहा है… (Sending…)' : 'संदेश भेजें (Send Message)'}</span>
        <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}
