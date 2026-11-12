import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumbs } from '@/components/Navigation'

import styles from './terms.module.css'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Terms & Conditions (नियम व शर्तें) — लोक Lens न्यूज़',
  description:
    'Welcome to LokLens News. These terms govern access to and use of our website and its news, video and other digital content.',
}

export default function TermsPage() {
  const termsSections = [
    {
      number: '1',
      title: 'Website Use',
      paragraphs: [
        'Content is provided for general informational purposes. Users must access the website lawfully and must not disrupt its operation, compromise security or violate applicable laws.',
      ],
    },
    {
      number: '2',
      title: 'Intellectual Property',
      paragraphs: [
        'Unless otherwise indicated, original articles, photographs, graphics, videos, logos and designs belong to LokLens News or their respective rights holders and are used with permission or other lawful basis.',
        'Sharing links is permitted; reproducing or commercially exploiting protected content requires authorization unless permitted by law.',
      ],
    },
    {
      number: '3',
      title: 'Accuracy and Updates',
      paragraphs: [
        'We strive for accurate and timely reporting, but developing news may change. We cannot guarantee that all content remains complete, current or error-free. We may correct, update or remove content as necessary.',
      ],
    },
    {
      number: '4',
      title: 'Editorial Independence',
      paragraphs: [
        'Editorial decisions are intended to reflect journalistic standards, factual accuracy and public interest. Attributed opinions from guests or interviewees do not necessarily represent the views of LokLens News.',
      ],
    },
    {
      number: '5',
      title: 'User Conduct',
      paragraphs: [
        'Users must not post unlawful, threatening, defamatory or abusive material; distribute malware or spam; impersonate others; infringe rights; or attempt unauthorized system access. Where interactive features exist, we may moderate content in accordance with applicable law.',
      ],
    },
    {
      number: '6',
      title: 'Third-Party Links',
      paragraphs: [
        'Links to external websites, social platforms and services are provided for convenience. Their content and practices are controlled by the respective third parties.',
      ],
    },
    {
      number: '7',
      title: 'Advertising',
      paragraphs: [
        'The website may feature advertising, promotions and sponsored content. Paid or sponsored material should be appropriately identified and distinguished from editorial coverage.',
      ],
    },
    {
      number: '8',
      title: 'Liability',
      paragraphs: [
        'To the extent permitted by applicable law, LokLens News is not liable for losses resulting from technical interruptions, third-party services or reliance on general website information. Nothing excludes liability that cannot legally be excluded.',
      ],
    },
    {
      number: '9',
      title: 'Changes',
      paragraphs: [
        'These terms may be updated. The revised version and effective date will be posted here. Continued use following changes may constitute acceptance where legally valid.',
      ],
    },
    {
      number: '10',
      title: 'Governing Law',
      paragraphs: [
        'These terms are governed by applicable Indian law. Disputes are subject to the jurisdiction of competent courts under applicable law.',
      ],
    },
  ]

  return (
    <div className={`container ${styles.pageWrap}`}>
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { label: 'होम', href: '/' },
          { label: 'Terms & Conditions' },
        ]}
      />

      <article className={styles.card}>
        <header className={styles.header}>
          <span className={styles.badge}>नियम एवं शर्तें</span>
          <h1 className={styles.mainTitle}>Terms &amp; Conditions</h1>
          <div className={styles.effectiveDate}>
            <span>अंतिम अद्यतन (Last Updated): नवंबर 2026</span>
          </div>
          <p className={styles.preamble}>
            Welcome to <strong>LokLens News</strong>. These terms govern access to and use of our website at{' '}
            <strong>[Website URL]</strong> and its news, video and other digital content. By using the website, you agree
            to these terms. If you do not agree, please discontinue use.
          </p>
        </header>

        <div className={styles.sectionsList}>
          {termsSections.map((sec) => (
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

          {/* Section 11: Contact */}
          <section className={styles.sectionItem}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>11.</span>
              <span>Contact</span>
            </h2>
            <div className={styles.sectionBody}>
              <p>For questions or further information regarding these Terms &amp; Conditions, please reach out to us:</p>

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
