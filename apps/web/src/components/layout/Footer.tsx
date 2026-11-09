import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import type { NavItem, SiteSettings } from '@/lib/data/types'

import { FacebookIcon, Icon, InstagramIcon, WhatsAppIcon, YouTubeIcon } from '../Icon'
import styles from './Footer.module.css'
import { NavLink } from './NavLink'

const SOCIAL: Record<string, { label: string; icon: ReactNode }> = {
  youtube: { label: 'YouTube', icon: <YouTubeIcon size={22} color="#fff" triangle="#16181D" /> },
  facebook: { label: 'Facebook', icon: <FacebookIcon size={22} /> },
  instagram: { label: 'Instagram', icon: <InstagramIcon size={22} /> },
  whatsapp: { label: 'WhatsApp चैनल', icon: <WhatsAppIcon size={22} /> },
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
  const policies: NavItem[] = [
    { label: 'संपादकीय नीति', url: p.editorial },
    { label: 'सुधार नीति', url: p.corrections },
    { label: 'गोपनीयता नीति', url: p.privacy },
    { label: 'नियम व शर्तें', url: p.terms },
    { label: 'अस्वीकरण', url: p.disclaimer },
  ]
  const year = new Date().getFullYear()
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.about}>
          <Link href="/" className={styles.brand}>
            <Image src="/brand/logo-96.webp" width={96} height={96} alt="" unoptimized className={styles.logo} />
            <span className={styles.name}>लोक Lens न्यूज़</span>
          </Link>
          <p className={styles.tagline}>{settings.tagline}</p>
          <SocialLinks social={settings.social} />
        </div>
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
        {settings.navigation.footer.map((group, i) => (
          <nav key={group.title} aria-labelledby={`footer-g${i}`} className={styles.col}>
            <h2 id={`footer-g${i}`} className={styles.colTitle}>
              {group.title}
            </h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.url}>
                  <Link href={item.url}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-labelledby="footer-policies" className={styles.col}>
          <h2 id="footer-policies" className={styles.colTitle}>
            नीतियां
          </h2>
          <ul>
            {policies.map((item) => (
              <li key={item.url}>
                <Link href={item.url}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className={`container ${styles.copy}`}>
        © {year} {settings.name}। सर्वाधिकार सुरक्षित।
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
