import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import type { NavItem, SiteSettings } from '@/lib/data/types'

import { FacebookIcon, Icon, InstagramIcon, WhatsAppIcon, YouTubeIcon } from '../Icon'
import styles from './Footer.module.css'
import { NavLink } from './NavLink'

const SOCIAL: Record<string, { label: string; icon: ReactNode }> = {
  youtube: { label: 'YouTube', icon: <YouTubeIcon size={20} color="#fff" triangle="#16181D" /> },
  facebook: { label: 'Facebook', icon: <FacebookIcon size={20} /> },
  instagram: { label: 'Instagram', icon: <InstagramIcon size={20} /> },
  whatsapp: { label: 'WhatsApp चैनल', icon: <WhatsAppIcon size={20} /> },
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
      <div className={`container ${styles.brandRow}`}>
        <Link href="/" className={styles.brand} aria-label={`${settings.name} — होम`}>
          <Image src="/brand/logo-96.webp" width={52} height={52} alt="" unoptimized className={styles.logo} />
          <div className={styles.brandText}>
            <span className={styles.name}>लोक Lens न्यूज़</span>
            <span className={styles.tagline}>{settings.tagline || 'आपकी आवाज़, आपकी खबर'}</span>
          </div>
        </Link>
        <SocialLinks social={settings.social} />
      </div>

      <div className={`container ${styles.grid}`}>
        {/* Column 1: Categories */}
        <nav aria-labelledby="footer-cats" id="footer-categories" className={styles.col}>
          <h2 id="footer-cats" className={styles.colTitle}>
            श्रेणियां
          </h2>
          <ul>
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
          <ul>
            <li>
              <Link href="/about">हमारे बारे में (About Us)</Link>
            </li>
            <li>
              <Link href="/contact">संपर्क करें (Contact Us)</Link>
            </li>
            <li>
              <Link href="/video">वीडियो बुलेटिन</Link>
            </li>
            <li>
              <Link href="/e-paper">ई-पेपर (E-Paper)</Link>
            </li>
            <li>
              <Link href="/advertise">विज्ञापन दें (Advertise)</Link>
            </li>
          </ul>
        </nav>

        {/* Column 3: Policies & Legal */}
        <nav aria-labelledby="footer-policies" className={styles.col}>
          <h2 id="footer-policies" className={styles.colTitle}>
            नीतियां (Policies)
          </h2>
          <ul>
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

        {/* Column 4: Stay Connected & About */}
        <div className={styles.col}>
          <h2 className={styles.colTitle}>जुड़े रहें</h2>
          <div className={styles.contactBox}>
            <p className={styles.contactDesc}>
              लोक Lens न्यूज़ — उत्तराखंड और देश-दुनिया की निष्पक्ष, सटीक और जनसरोकार से जुड़ी खबरों का विश्वसनीय मंच।
            </p>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.whatsappPill}>
              <WhatsAppIcon size={18} />
              <span>WhatsApp चैनल से जुड़ें</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Copyright & English Legal Links */}
      <div className={`container ${styles.bottomBar}`}>
        <div className={styles.copy}>
          © {year} {settings.name}। सर्वाधिकार सुरक्षित। All rights reserved.
        </div>
        <div className={styles.legalLinks}>
          <Link href={p.terms || '/terms'} className={styles.legalLink}>
            Terms and Conditions
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
      </div>
    </footer>
  )
}

/** Mobile-only bottom navigation (hidden ≥768px). */
export function BottomNav() {
  return (
    <nav aria-label="मुख्य नेविगेशन" className={styles.bottomNav}>
      <ul>
        <li>
          <NavLink href="/" className={styles.bottomLink}>
            <Icon name="home" />
            होम
          </NavLink>
        </li>
        <li>
          <NavLink href="/video" className={styles.bottomLink}>
            <Icon name="video" />
            वीडियो
          </NavLink>
        </li>
        <li>
          <NavLink href="/e-paper" className={styles.bottomLink}>
            <Icon name="paper" />
            ई-पेपर
          </NavLink>
        </li>
        <li>
          <a href="#footer-categories" className={styles.bottomLink}>
            <Icon name="grid" />
            श्रेणियां
          </a>
        </li>
      </ul>
    </nav>
  )
}
