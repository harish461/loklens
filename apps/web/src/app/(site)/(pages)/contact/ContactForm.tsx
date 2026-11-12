'use client'

import { useState } from 'react'

import styles from './contact.module.css'

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className={styles.successBox} role="alert">
        <h3 className={styles.successTitle}>धन्यवाद! आपका संदेश हमें प्राप्त हो गया है।</h3>
        <p className={styles.successText}>
          लोकलेंस न्यूज़ से संपर्क करने के लिए धन्यवाद। हमारी संपादकीय व सहायता टीम जल्द ही आपसे संपर्क करेगी।
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className={styles.btnSecondary}
        >
          नया संदेश भेजें
        </button>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
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
            placeholder="संदेश का विषय"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="message" className={styles.label}>
          Message (संदेश)
        </label>
        <textarea
          id="message"
          name="message"
          placeholder="अपना संदेश या समाचार विवरण यहाँ लिखें…"
          className={styles.textarea}
        />
      </div>

      <button type="submit" className={styles.btnSubmit}>
        <span>संदेश भेजें (Send Message)</span>
        <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}

