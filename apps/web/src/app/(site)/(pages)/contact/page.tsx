import type { Metadata } from 'next'

import { FacebookIcon, InstagramIcon, WhatsAppIcon, XIcon, YouTubeIcon } from '@/components/Icon'
import { Breadcrumbs } from '@/components/Navigation'

import styles from './contact.module.css'
import { ContactForm } from './ContactForm'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'संपर्क करें (Contact Us) — लोक Lens न्यूज़',
  description:
    'लोकलेंस न्यूज़ से संपर्क करें। समाचार सुझाव, विज्ञापन, संपादकीय पूछताछ और प्रतिक्रिया के लिए हमसे जुड़ें।',
}

export default function ContactPage() {
  const emails = [
    {
      dept: 'General and editorial inquiries',
      email: 'newsloklens@gmail.com',
    },
    {
      dept: 'News tips and press releases',
      email: 'newsloklens@gmail.com',
    },
    {
      dept: 'Advertising and partnerships',
      email: 'newsloklens@gmail.com',
    },
    {
      dept: 'Corrections and complaints',
      email: 'newsloklens@gmail.com',
    },
  ]

  return (
    <div className={`container ${styles.pageWrap}`}>
      {/* Breadcrumbs */}
      <div className={styles.crumbWrap}>
        <Breadcrumbs
          items={[
            { label: 'होम', href: '/' },
            { label: 'संपर्क करें (Contact Us)' },
          ]}
        />
      </div>

      {/* Header Section */}
      <header className={styles.headerSection}>
        <span className={styles.badge}>संपर्क सूत्र</span>
        <h1 className={styles.mainTitle}>Connect With LokLens News</h1>
        <p className={styles.subtitle}>
          We welcome news tips, feedback, correction requests, story suggestions, advertising inquiries and business
          collaborations.
        </p>
      </header>

      {/* 2-Column Section */}
      <div className={styles.contactGrid}>
        {/* Left Column: Contact Form */}
        <section className={styles.formCard} aria-labelledby="form-heading">
          <div className={styles.cardHead}>
            <h2 id="form-heading" className={styles.cardTitle}>
              हमें संदेश भेजें (Send Us a Message)
            </h2>
            <p className={styles.cardDesc}>
              नीचे दिया गया फॉर्म भरें, हमारी टीम यथाशीघ्र आपसे संपर्क करेगी।
            </p>
          </div>

          <ContactForm />
        </section>

        {/* Right Column: Office & Contact Information */}
        <aside className={styles.infoCard} aria-label="कार्यालय एवं संपर्क विवरण">
          {/* Office Address */}
          <div className={styles.infoBlock}>
            <h3 className={styles.blockHeading}>
              <span aria-hidden="true">📍</span>
              <span>कार्यालय का पता (Office)</span>
            </h3>
            <p className={styles.officeText}>
              <strong>LokLens News</strong>, Sanga Cottage, Lower Mall Road, Almora, Uttarakhand – 263601, India
            </p>
          </div>

          {/* Phone */}
          <div className={styles.infoBlock}>
            <h3 className={styles.blockHeading}>
              <span aria-hidden="true">📞</span>
              <span>फ़ोन संपर्क (Phone)</span>
            </h3>
            <a href="tel:+917037455895" className={styles.phoneLink}>
              +91 70374 55895
            </a>
          </div>

          {/* Department Emails */}
          <div className={styles.infoBlock}>
            <h3 className={styles.blockHeading}>
              <span aria-hidden="true">✉️</span>
              <span>ईमेल संपर्क (Email Inquiries)</span>
            </h3>
            <ul className={styles.emailList}>
              {emails.map((item) => (
                <li key={item.dept} className={styles.emailItem}>
                  <span className={styles.emailDept}>{item.dept}:</span>
                  <a href={`mailto:${item.email}`} className={styles.emailAddr}>
                    {item.email}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Profiles */}
          <div className={styles.infoBlock}>
            <h3 className={styles.blockHeading}>
              <span aria-hidden="true">🌐</span>
              <span>सोशल मीडिया (Follow Us)</span>
            </h3>
            <div className={styles.socialList}>
              <a
                href="https://www.youtube.com/@loklensnews"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.socialBtn} ${styles.ytBtn}`}
              >
                <YouTubeIcon size={16} color="#e60000" triangle="#fff" />
                <span>YouTube</span>
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialBtn}
              >
                <FacebookIcon size={16} />
                <span>Facebook</span>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialBtn}
              >
                <InstagramIcon size={16} />
                <span>Instagram</span>
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialBtn}
              >
                <XIcon size={16} />
                <span>X (Twitter)</span>
              </a>
              <a
                href="https://whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialBtn}
              >
                <WhatsAppIcon size={16} />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Note regarding corrections */}
          <div className={styles.noteBox}>
            <p>
              For corrections, please include the relevant article or video link and supporting details.
            </p>
            <span className={styles.noteHighlight}>
              Your Voice Matters. Your Stories Matter.
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}
