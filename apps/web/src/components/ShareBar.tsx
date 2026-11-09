'use client'

import { useEffect, useState } from 'react'

import { FacebookIcon, Icon, WhatsAppIcon, XIcon } from './Icon'
import styles from './ShareBar.module.css'

interface Props {
  /** Absolute canonical URL. */
  url: string
  title: string
}

/**
 * WhatsApp first. All share targets are plain links (work without JS); with JS we add the native share
 * sheet (Web Share API, mostly mobile) and copy-link.
 */
export function ShareBar({ url, title }: Props) {
  const [canShare, setCanShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Feature detection must run after hydration (navigator is not available on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const text = encodeURIComponent(`${title} ${url}`)
  const u = encodeURIComponent(url)

  async function nativeShare() {
    try {
      await navigator.share({ title, url })
    } catch {
      // user cancelled — nothing to do
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('लिंक कॉपी करें', url)
    }
  }

  return (
    <div className={styles.bar} role="group" aria-label="खबर शेयर करें">
      <a
        className={`${styles.btn} ${styles.whatsapp}`}
        href={`https://wa.me/?text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp पर शेयर करें"
      >
        <WhatsAppIcon />
        <span>
          WhatsApp<span className={styles.long}> पर शेयर करें</span>
        </span>
      </a>
      {canShare && (
        <button type="button" className={styles.icon} onClick={nativeShare} aria-label="अन्य ऐप में शेयर करें">
          <Icon name="share" size={20} />
        </button>
      )}
      {/* With the native share sheet (mostly mobile), Facebook/X links are redundant fallbacks. */}
      {!canShare && (
        <>
          <a
            className={styles.icon}
            href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook पर शेयर करें"
          >
            <FacebookIcon />
          </a>
          <a
            className={styles.icon}
            href={`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${u}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X पर शेयर करें"
          >
            <XIcon />
          </a>
        </>
      )}
      <button type="button" className={styles.icon} onClick={copy} aria-label="लिंक कॉपी करें">
        <Icon name={copied ? 'check' : 'link'} size={20} />
      </button>
      <span className="visually-hidden" role="status">
        {copied ? 'लिंक कॉपी हो गया' : ''}
      </span>
    </div>
  )
}
