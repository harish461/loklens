import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Navigation'
import { getSiteOrigin, resolveRobots } from '@/lib/seo'

import styles from '../../terms/terms.module.css'

/**
 * /account/delete — how to delete a LokLens News app account (api-contract §7). This URL is the
 * "account deletion" link given to Google Play. In-app deletion is immediate; email requests are for readers
 * who no longer have the app.
 */
export const revalidate = 3600

const EMAIL = 'newsloklens@gmail.com'
const MAIL_SUBJECT = encodeURIComponent('Delete my LokLens News account')
const MAIL_BODY = encodeURIComponent(
  'Please delete my LokLens News app account.\n\nAccount email: \n\n(Send this from the email address of the account.)',
)

export function generateMetadata(): Metadata {
  const origin = getSiteOrigin()
  return {
    title: 'Delete your account (खाता हटाएं)',
    description: 'How to delete your LokLens News app account and the data linked to it.',
    alternates: { canonical: `${origin}/account/delete` },
    robots: resolveRobots(false),
  }
}

export default function AccountDeletePage() {
  const sections = [
    {
      number: '1',
      title: 'Delete it in the app (immediate) · ऐप में खाता हटाएं',
      body: (
        <>
          <p>Open the LokLens News app and sign in, then:</p>
          <ol>
            <li>
              Go to <strong>Profile</strong> (the person icon in the bottom bar).
            </li>
            <li>
              Tap <strong>Delete account</strong> under <strong>Log out</strong>.
            </li>
            <li>
              Enter your password (accounts created with email) and type <strong>DELETE</strong> to confirm.
            </li>
            <li>
              Tap <strong>Delete my account</strong>. Your account is deleted at once and you are signed out.
            </li>
          </ol>
        </>
      ),
    },
    {
      number: '2',
      title: 'Request deletion by email · ईमेल से अनुरोध',
      body: (
        <>
          <p>
            If you no longer have the app, email{' '}
            <a className={styles.contactLink} href={`mailto:${EMAIL}?subject=${MAIL_SUBJECT}&body=${MAIL_BODY}`}>
              {EMAIL}
            </a>{' '}
            with the subject <strong>&ldquo;Delete my LokLens News account&rdquo;</strong>, from the email address of the
            account. We confirm that the request comes from the account owner and delete the account within 7 days, then
            reply to confirm.
          </p>
        </>
      ),
    },
    {
      number: '3',
      title: 'What is deleted · क्या हटाया जाता है',
      body: (
        <ul>
          <li>Your account: name, email address and sign-in details (password or Google sign-in link), and all sign-in sessions.</li>
          <li>Your notification settings and the registration of your devices for push notifications.</li>
          <li>The record of which notifications you opened, and their delivery records for your devices.</li>
        </ul>
      ),
    },
    {
      number: '4',
      title: 'What is kept · क्या रखा जाता है',
      body: (
        <ul>
          <li>
            Overall notification totals (for example, how many devices a notification was sent to) keep their numbers, but
            they are no longer linked to you.
          </li>
          <li>Bookmarks are stored only on your phone; they are not on our servers.</li>
          <li>We do not keep any other personal data from your account after deletion.</li>
        </ul>
      ),
    },
  ]

  return (
    <div className={`container ${styles.pageWrap}`}>
      <Breadcrumbs items={[{ label: 'होम', href: '/' }, { label: 'Delete account' }]} />

      <article className={styles.card}>
        <header className={styles.header}>
          <span className={styles.badge}>खाता हटाएं</span>
          <h1 className={styles.mainTitle}>Delete your LokLens News account</h1>
          <p className={styles.preamble}>
            You can delete your <strong>LokLens News</strong> app account and the data linked to it at any time. News on
            the website and in the app stays readable without an account.
          </p>
        </header>

        <div className={styles.sectionsList}>
          {sections.map((sec) => (
            <section key={sec.number} className={styles.sectionItem}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNumber}>{sec.number}.</span>
                <span>{sec.title}</span>
              </h2>
              <div className={styles.sectionBody}>{sec.body}</div>
            </section>
          ))}

          <section className={styles.sectionItem}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNumber}>5.</span>
              <span>Contact · संपर्क</span>
            </h2>
            <div className={styles.sectionBody}>
              <div className={styles.contactBox}>
                <div className={styles.contactRow}>
                  <strong>Email:</strong>
                  <a href={`mailto:${EMAIL}`} className={styles.contactLink}>
                    {EMAIL}
                  </a>
                </div>
                <div className={styles.contactRow}>
                  <strong>Phone:</strong>
                  <a href="tel:+917037455895" className={styles.contactLink}>
                    +91 70374 55895
                  </a>
                </div>
                <div className={styles.contactAddress}>
                  <strong>Office:</strong> LokLens News, Sanga Cottage, Lower Mall Road, Almora, Uttarakhand – 263601, India.
                </div>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  )
}
