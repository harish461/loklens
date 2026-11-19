import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import type { NavItem, SiteSettings } from '@/lib/data/types'

import { FacebookIcon, InstagramIcon, WhatsAppIcon, YouTubeIcon } from '../Icon'
import styles from './Footer.module.css'

const SOCIAL: Record<string, { label: string; icon: ReactNode }> = {
  youtube: { label: 'YouTube', icon: <YouTubeIcon size={18} color="#fff" triangle="#16181D" /> },
  facebook: { label: 'Facebook', icon: <FacebookIcon size={18} /> },
  instagram: { label: 'Instagram', icon: <InstagramIcon size={18} /> },
  whatsapp: { label: 'WhatsApp चैनल', icon: <WhatsAppIcon size={18} /> },
}

/** Profile links from SiteSettings.social; unknown platforms are skipped. */
function SocialLinks({ social }: { social: SiteSettings['social'] }) {
  const items = social.filter((s) => SOCIAL[s.platform])
  if (items.length === 0) return null
  return (
    <ul className={styles.social} aria-label="सोशल मीडिया पर लोक Lens">
      {items.map((s) => (
        <li key={s.platform}>
          <a href={s.url} target="_blank" rel="noopener" aria-label={`${SOCIAL[s.platform].label} पर लोक Lens`}>
            {SOCIAL[s.platform].icon}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function Footer({ settings, categories }: { settings: SiteSettings; categories: NavItem[] }) {
  const p = settings.policies
  const policies: { label: string; enLabel: string; url: string }[] = [
    { label: 'नियम व शर्तें', enLabel: 'Terms & Conditions', url: p.terms || '/terms' },
    { label: 'गोपनीयता नीति', enLabel: 'Privacy Policy', url: p.privacy || '/privacy-policy' },
    { label: 'संपादकीय नीति', enLabel: 'Editorial Policy', url: p.editorial || '/editorial-policy' },
    { label: 'सुधार नीति', enLabel: 'Corrections Policy', url: p.corrections || '/corrections-policy' },
    { label: 'अस्वीकरण', enLabel: 'Disclaimer', url: p.disclaimer || '/disclaimer' },
  ]
  const whatsappUrl = settings.social.find((s) => s.platform === 'whatsapp')?.url || 'https://whatsapp.com'
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      {/* Top Brand & Community Card */}
      <div className="container">
        <div className={styles.brandCard}>
          <div className={styles.brandMain}>
            <Link href="/" className={styles.brand} aria-label={`${settings.name} — होम`}>
              <Image src="/brand/logo-96.webp" width={52} height={52} alt="" unoptimized className={styles.logo} />
              <div className={styles.brandText}>
                <span className={styles.name}>लोक Lens न्यूज़</span>
                <span className={styles.tagline}>{settings.tagline || 'आपकी आवाज़, आपकी खबर'}</span>
              </div>
            </Link>
            <p className={styles.mobileMission}>
              उत्तराखंड और देश-दुनिया की निष्पक्ष, सटीक और जनसरोकार से जुड़ी खबरों का विश्वसनीय डिजिटल मंच।
            </p>
          </div>

          <div className={styles.brandActions}>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.whatsappHeaderBtn}>
              <WhatsAppIcon size={17} />
              <span>WhatsApp चैनल से जुड़ें</span>
            </a>
            <SocialLinks social={settings.social} />
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className={`container ${styles.grid}`}>
        {/* Column 1: Categories (Pill Chips on Mobile, Vertical List on Desktop) */}
        <nav aria-labelledby="footer-cats" id="footer-categories" className={`${styles.col} ${styles.catCol}`}>
          <h2 id="footer-cats" className={styles.colTitle}>
            प्रमुख श्रेणियां
          </h2>
          <ul className={styles.catList}>
            <li>
              <Link href="/">होम</Link>
            </li>
            {categories.map((c) => (
              <li key={c.url}>
                <Link href={c.url}>{c.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Column 2: Quick Links */}
        <nav aria-labelledby="footer-quicklinks" className={styles.col}>
          <h2 id="footer-quicklinks" className={styles.colTitle}>
            त्वरित लिंक
          </h2>
          <ul className={styles.linkList}>
            <li>
              <Link href="/about">
                <span>हमारे बारे में</span>
                <span className={styles.enSubtext}>(About Us)</span>
              </Link>
            </li>
            <li>
              <Link href="/contact">
                <span>संपर्क करें</span>
                <span className={styles.enSubtext}>(Contact Us)</span>
              </Link>
            </li>
            <li>
              <Link href="/video">
                <span>वीडियो बुलेटिन</span>
              </Link>
            </li>
            {false && (
              <li>
                <Link href="/e-paper">
                  <span>ई-पेपर</span>
                  <span className={styles.enSubtext}>(E-Paper)</span>
                </Link>
              </li>
            )}
            <li>
              <Link href="/advertise">
                <span>विज्ञापन दें</span>
                <span className={styles.enSubtext}>(Advertise)</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Column 3: Policies & Legal */}
        <nav aria-labelledby="footer-policies" className={styles.col}>
          <h2 id="footer-policies" className={styles.colTitle}>
            नीतियां
          </h2>
          <ul className={styles.linkList}>
            {policies.map((item) => (
              <li key={item.url}>
                <Link href={item.url}>
                  <span>{item.label}</span>
                  <span className={styles.enSubtext}>({item.enLabel})</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Column 4: Stay Connected & Office (Desktop Column / Mobile Contact Strip) */}
        <div className={`${styles.col} ${styles.connectCol}`}>
          <h2 className={styles.colTitle}>संपर्क एवं कार्यालय</h2>
          <div className={styles.contactBox}>
            <p className={styles.contactDesc}>
              <strong>LokLens News</strong>, Sanga Cottage, Lower Mall Road, Almora, Uttarakhand – 263601
            </p>
            <div className={styles.contactMetaRow}>
              <a href="mailto:newsloklens@gmail.com" className={styles.contactChip}>
                ✉️ newsloklens@gmail.com
              </a>
              <a href="tel:+917037455895" className={styles.contactChip}>
                📞 +91 70374 55895
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Copyright & English Legal Links */}
      <div className={`container ${styles.bottomBar}`}>
        <div className={styles.legalLinks}>
          <Link href={p.terms || '/terms'} className={styles.legalLink}>
            Terms & Conditions
          </Link>
          <span className={styles.dot} aria-hidden="true">•</span>
          <Link href={p.privacy || '/privacy-policy'} className={styles.legalLink}>
            Privacy Policy
          </Link>
          <span className={styles.dot} aria-hidden="true">•</span>
          <Link href="/about" className={styles.legalLink}>
            About Us
          </Link>
          <span className={styles.dot} aria-hidden="true">•</span>
          <Link href="/contact" className={styles.legalLink}>
            Contact Us
          </Link>
        </div>
        <div className={styles.copy}>
          © {year} {settings.name} • सर्वाधिकार सुरक्षित (All rights reserved)
        </div>
      </div>
    </footer>
  )
}
