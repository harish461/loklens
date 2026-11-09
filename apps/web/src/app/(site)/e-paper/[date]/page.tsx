import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EPaperDateJump, EPaperHeader, formatEPaperDate, isValidEPaperDate } from '@/components/EPaper'
import styles from '@/components/EPaper.module.css'
import { Icon } from '@/components/Icon'
import ui from '@/components/ui.module.css'
import { getEPaper } from '@/lib/mock'

import { getEPaperNeighbours, getEPaperRange } from '../epaper-data'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ date: string }> }

async function load(date: string) {
  return isValidEPaperDate(date) ? getEPaper(date) : null
}

// TODO(seo): src/lib/seo e-paper metadata.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  const paper = await load(date)
  return paper ? { title: `ई-पेपर — ${formatEPaperDate(paper.date)}` } : {}
}

export default async function EPaperViewer({ params }: Props) {
  const { date } = await params
  const paper = await load(date)
  if (!paper) notFound() // → ./not-found.tsx (404)

  const [{ older, newer }, range] = await Promise.all([getEPaperNeighbours(paper.date), getEPaperRange()])
  const label = formatEPaperDate(paper.date)

  return (
    <>
      <EPaperHeader
        crumbs={[{ label: 'होम', href: '/' }, { label: 'ई-पेपर', href: '/e-paper' }, { label: label }]}
        title={`ई-पेपर: ${label}`}
        subtitle={paper.edition}
      />
      <div className="container">
        {/* Primary action first: on mobile the PDF opens in the browser's own viewer. */}
        <p className={styles.mobileNote}>मोबाइल पर ई-पेपर PDF के रूप में नए टैब में खुलेगा।</p>
        <div className={styles.actions}>
          <a href={paper.pdfUrl} target="_blank" rel="noopener" className={ui.btnPrimary}>
            <Icon name="paper" size={18} />
            PDF खोलें
          </a>
          <a href={paper.pdfUrl} download={`loklens-epaper-${paper.date}.pdf`} className={ui.btnSecondary}>
            डाउनलोड करें
          </a>
        </div>

        <div className={styles.toolbar}>
          <nav aria-label="संस्करण" className={styles.nav}>
            {older ? (
              <Link href={`/e-paper/${older.date}`} rel="prev" className={ui.btnSecondary}>
                <Icon name="chevronLeft" size={18} />
                पिछला संस्करण
                <span className="visually-hidden">: {formatEPaperDate(older.date)}</span>
              </Link>
            ) : (
              <span className={styles.navDisabled}>पिछला संस्करण नहीं</span>
            )}
            {newer ? (
              <Link href={`/e-paper/${newer.date}`} rel="next" className={ui.btnSecondary}>
                अगला संस्करण
                <span className="visually-hidden">: {formatEPaperDate(newer.date)}</span>
                <Icon name="chevronRight" size={18} />
              </Link>
            ) : (
              <span className={styles.navDisabled}>यह सबसे नया संस्करण है</span>
            )}
          </nav>
          <EPaperDateJump min={range.min} max={range.max} value={paper.date} />
        </div>

        {/* Inline viewer on ≥768px only; many mobile browsers can't render PDFs inline. */}
        <object data={paper.pdfUrl} type="application/pdf" className={styles.viewer} aria-label={`ई-पेपर ${label}`}>
          <p className={styles.viewerFallback}>
            आपका ब्राउज़र यहां PDF नहीं दिखा सकता।{' '}
            <a href={paper.pdfUrl} target="_blank" rel="noopener">
              PDF खोलें
            </a>
          </p>
        </object>
      </div>
    </>
  )
}
