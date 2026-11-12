import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumbs } from '@/components/Navigation'

import styles from './privacy.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'गोपनीयता नीति (Privacy Policy) — लोक Lens न्यूज़',
  description:
    'LokLens News respects the privacy of its readers and visitors. Learn how we collect, use, and protect your information.',
}

export default function PrivacyPolicyPage() {
  const policySections = [
    {
      number: '1',
      title: 'Information Collected',
      paragraphs: [
        'Depending on available features, we may collect information voluntarily submitted through forms or email, such as names, email addresses, phone numbers, messages and news tips. Technical data may include IP addresses, device/browser information, pages visited, approximate visit duration and referring pages.',
      ],
    },
    {
      number: '2',
      title: 'Uses of Information',
      paragraphs: [
        'Where collected, information may be used to respond to inquiries, manage corrections, operate and secure the website, understand audience engagement, improve services, deliver opted-in updates and meet legal obligations.',
      ],
    },
    {
      number: '3',
      title: 'Cookies and Analytics',
      paragraphs: [
        'Cookies or similar technologies may support site functionality, traffic measurement and advertising. Users can manage browser settings and available consent controls. Where required by law, consent will be sought for non-essential tracking.',
      ],
    },
    {
      number: '4',
      title: 'Third-Party Services',
      paragraphs: [
        'Hosting providers, analytics services, video platforms, social networks and advertising providers may process data under their own terms and privacy notices.',
      ],
    },
    {
      number: '5',
      title: 'Information Sharing',
      paragraphs: [
        'Information may be shared with authorized service providers where necessary for site operations or when required by applicable law. We do not sell personal information to third parties.',
      ],
    },
    {
      number: '6',
      title: 'Security',
      paragraphs: [
        'We aim to apply reasonable technical and organizational safeguards, although no internet-based system is entirely secure.',
      ],
    },
    {
      number: '7',
      title: 'Retention',
      paragraphs: [
        'Information is retained only as reasonably necessary for its collection purpose or to satisfy applicable legal requirements. Actual retention periods depend on the data and service.',
      ],
    },
    {
      number: '8',
      title: 'Your Rights',
      paragraphs: [
        'Subject to applicable law, users may request access to information about processing, correction, updating, withdrawal of consent or deletion where applicable. Contact us using the details below.',
      ],
    },
    {
      number: '9',
      title: 'Children',
      paragraphs: [
        'We do not intentionally seek children’s personal information without consent or authorization required by applicable law. Report concerns to the contact address below.',
      ],
    },
    {
      number: '10',
      title: 'External Links',
      paragraphs: [
        'Third-party sites linked from LokLens News maintain their own privacy practices. Please review their policies.',
      ],
    },
    {
      number: '11',
      title: 'Policy Updates',
      paragraphs: [
        'Changes to this policy will be posted on this page with an updated effective date.',
      ],
    },
  ]

  return (
    <div className={`container ${styles.pageWrap}`}>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { label: 'होम', href: '/' },
          { label: 'Privacy Policy' },
        ]}
      />

      <article className={styles.card}>
        <header className={styles.header}>
          <span className={styles.badge}>गोपनीयता नीति</span>
          <h1 className={styles.mainTitle}>Privacy Policy</h1>
          <div className={styles.effectiveDate}>
            <span>अंतिम अद्यतन (Last Updated): नवंबर 2026</span>
          </div>
          <p className={styles.preamble}>
            <strong>LokLens News</strong> respects the privacy of its readers and visitors. This policy describes
            information that may be collected through <strong>[Website URL]</strong>, why it may be used, and how
            users can contact us. The details below must be checked against the website’s actual technology and
            practices before publication.
          </p>
        </header>

        <div className={styles.sectionsList}>
          {policySections.map((sec) => (
            <section key={sec.number} className={styles.sectionItem}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNumber}>{sec.number}.</span>
                <span>{sec.title}</span>
              </h2>
              <div className={styles.sectionBody}>
                {sec.paragraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ))}

          {/* Contact Details & Data Subject Inquiries */}
          <section className={styles.sectionItem}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>12.</span>
              <span>Contact Us &amp; Rights Inquiries</span>
            </h2>
            <div className={styles.sectionBody}>
              <p>
                If you have questions, feedback, or wish to exercise your rights regarding personal data, please contact
                us using the information below:
              </p>

              <div className={styles.contactBox}>
                <div className={styles.contactRow}>
                  <strong>Email:</strong>
                  <a href="mailto:newsloklens@gmail.com" className={styles.contactLink}>
                    newsloklens@gmail.com
                  </a>
                </div>
                <div className={styles.contactRow}>
                  <strong>Phone:</strong>
                  <a href="tel:+917037455895" className={styles.contactLink}>
                    +91 70374 55895
                  </a>
                </div>
                <div className={styles.contactAddress}>
                  <strong>Office:</strong> LokLens News, Sanga Cottage, Lower Mall Road, Almora, Uttarakhand – 263601,
                  India.
                </div>
                <div className={styles.contactActions}>
                  <Link href="/contact" className={styles.contactBtn}>
                    संपर्क पृष्ठ पर जाएं (Contact Page) &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  )
}
