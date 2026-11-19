/**
 * The article page body, shared by the public article route and the draft preview (/preview/[id]) so a
 * preview looks exactly like the published page.
 */
import Image from 'next/image'
import Link from 'next/link'

import { RelatedList, TagChips, WhatsAppChannelBanner } from '@/components/ArticleExtras'
import { AdSlot } from '@/components/AdSlot'
import { BreakingBadge, CategoryLabel } from '@/components/Badges'
import { absoluteUrl, formatDateTime } from '@/components/format'
import { Breadcrumbs } from '@/components/Navigation'
import { NewsImage, toRenderableMediaUrl } from '@/components/NewsImage'
import { RichText } from '@/components/RichText'
import { ShareBar } from '@/components/ShareBar'
import type { Article, ArticleCard as ArticleCardType, AuthorRef, Image as ImageType, SiteSettings } from '@/lib/data/types'

import styles from './article.module.css'

/**
 * Avatar initials: Latin names get two ("RS"); Devanagari names get the first akshara only ("रा"),
 * since joined Hindi initials read as a word.
 */
function initials(name: string): string {
  const words = name.match(/[\p{L}\p{M}]+/gu) ?? []
  const seg = new Intl.Segmenter('hi', { granularity: 'grapheme' })
  const first = (w: string) => seg.segment(w)[Symbol.iterator]().next().value?.segment ?? ''
  const [head] = words
  if (!head) return ''
  return /^[A-Za-z]/.test(head) ? words.slice(0, 2).map(first).join('').toUpperCase() : first(head)
}

function Avatar({ author, logo }: { author?: AuthorRef; logo: ImageType }) {
  // Organization byline ("LokLens News Team") → site logo; person → photo, else initials.
  const img = author?.kind === 'organization' ? logo : author?.photo
  if (img) {
    return (
      <Image
        src={toRenderableMediaUrl(img.sizes.thumb?.url ?? img.url)}
        width={40}
        height={40}
        alt=""
        unoptimized
        className={styles.avatar}
      />
    )
  }
  return (
    <span className={styles.monogram} aria-hidden="true">
      {initials(author?.name ?? '') || 'LL'}
    </span>
  )
}

function Byline({ authors, logo }: { authors: AuthorRef[]; logo: ImageType }) {
  const avatar = <Avatar author={authors[0]} logo={logo} />
  return (
    <>
      {avatar}
      <span className={styles.authors}>
        {authors.map((a, i) => (
          <span key={`${a.name}-${i}`}>
            {i > 0 && ', '}
            {a.kind === 'person' && a.slug ? (
              <Link href={`/author/${a.slug}`} rel="author">
                {a.name}
              </Link>
            ) : (
              a.name
            )}
          </span>
        ))}
      </span>
    </>
  )
}

export function ArticleView({
  article,
  settings,
  sidebar,
}: {
  article: Article
  settings: SiteSettings
  sidebar: ArticleCardType[]
}) {
  const updated = article.updatedAt !== article.publishedAt
  const otherStories = sidebar.filter((item) => item.id !== article.id)
  const itemsToRender = otherStories.length > 0 ? otherStories : sidebar
  const spotlightStory = itemsToRender[0]
  const feedStories = itemsToRender.slice(1, 6)

  return (
    <div className={`container ${styles.layout}`}>
      <article className={styles.article}>
        <Breadcrumbs
          items={[
            { label: 'होम', href: '/' },
            { label: article.category.name, href: `/${article.category.slug}` },
            { label: article.title },
          ]}
        />
        <header className={styles.head}>
          <div className={styles.kicker}>
            {article.isBreaking && <BreakingBadge />}
            <CategoryLabel category={article.category} />
          </div>
          <h1 className={styles.title}>{article.title}</h1>
          {article.summary && <p className={styles.dek}>{article.summary}</p>}
          <div className={styles.byline}>
            <Byline authors={article.authors} logo={settings.logo} />
            <span className={styles.times}>
              <time dateTime={article.publishedAt}>{formatDateTime(article.publishedAt)}</time>
              {updated && (
                <>
                  {' · अपडेट: '}
                  <time dateTime={article.updatedAt}>{formatDateTime(article.updatedAt)}</time>
                </>
              )}
            </span>
          </div>
          <ShareBar url={absoluteUrl(article.url)} title={article.title} />
        </header>

        <figure className={styles.figure}>
          <NewsImage
            image={article.image}
            displayWidth={860}
            preferred="article"
            sizes="(min-width: 1024px) 860px, 100vw"
            priority
          />
          {(article.image.caption || article.image.credit) && (
            <figcaption>
              {article.image.caption}
              {article.image.credit && ` — ${article.image.credit}`}
            </figcaption>
          )}
        </figure>

        <RichText nodes={article.body} adAfterParagraph={3} />

        <div className={styles.after}>
          <TagChips tags={article.tags} />
          <WhatsAppChannelBanner settings={settings} />
          <RelatedList articles={article.related} />
        </div>
      </article>

      {/* Redesigned Right Sidebar: Spotlight Story + Media Feed + E-Paper Widget */}
      <aside className={styles.sidebar} aria-labelledby="article-side">
        <div className={styles.sidePanel}>
          <header className={styles.sideHeader}>
            <div className={styles.sideTitleWrap}>
              <span className={styles.liveDot} aria-hidden="true" />
              <h2 id="article-side" className={styles.sideTitle}>
                ताज़ा खबरें
              </h2>
            </div>
            <Link href={`/${article.category.slug}`} className={styles.sideViewAll}>
              सभी देखें →
            </Link>
          </header>

          {/* Top #1 Spotlight Card with 16:9 Thumbnail */}
          {spotlightStory && (
            <article className={styles.spotlightCard}>
              <Link href={spotlightStory.url} className={styles.spotlightMedia}>
                <NewsImage
                  image={spotlightStory.image}
                  displayWidth={360}
                  preferred="card"
                  sizes="360px"
                />
                <span className={styles.spotlightRank}>#1 प्रमुख खबर</span>
              </Link>
              <div className={styles.spotlightBody}>
                <div className={styles.spotlightMetaRow}>
                  <span className={styles.sideCatPill}>{spotlightStory.category.name}</span>
                  <time className={styles.sideTime} dateTime={spotlightStory.publishedAt}>
                    {formatDateTime(spotlightStory.publishedAt)}
                  </time>
                </div>
                <h3 className={styles.spotlightTitle}>
                  <Link href={spotlightStory.url}>{spotlightStory.title}</Link>
                </h3>
              </div>
            </article>
          )}

          {/* Compact Media Cards with Thumbnail + Numbered Badge */}
          {feedStories.length > 0 && (
            <ol className={styles.sideList} start={2}>
              {feedStories.map((item, idx) => (
                <li key={item.id} className={styles.sideItem}>
                  <Link href={item.url} className={styles.sideCardLink}>
                    <div className={styles.sideCardContent}>
                      <div className={styles.sideCardTop}>
                        <span className={styles.sideRankBadge}>
                          {String(idx + 2).padStart(2, '0')}
                        </span>
                        <span className={styles.sideCatText}>{item.category.name}</span>
                      </div>
                      <h3 className={styles.sideItemTitle}>{item.title}</h3>
                      <time className={styles.sideTime} dateTime={item.publishedAt}>
                        {formatDateTime(item.publishedAt)}
                      </time>
                    </div>
                    <div className={styles.sideThumb}>
                      <NewsImage
                        image={item.image}
                        displayWidth={96}
                        preferred="thumb"
                        sizes="96px"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Category Quick Explore + E-Paper Widget (Hidden for now) */}
        {false && (
          <div className={styles.epaperWidget}>
            <div className={styles.epaperBadgeRow}>
              <span className={styles.epaperBadge}>Digital Edition</span>
              <span className={styles.epaperBrand}>लोक Lens</span>
            </div>
            <h3 className={styles.epaperTitle}>आज का डिजिटल ई-पेपर पढ़ें</h3>
            <p className={styles.epaperDesc}>
              उत्तराखंड और देश-दुनिया की प्रमुख खबरें डिजिटल अख़बार फ़ॉर्मेट में।
            </p>
            <div className={styles.epaperActions}>
              <Link href="/e-paper" className={styles.epaperPrimaryBtn}>
                <span>ई-पेपर खोलें</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link href={`/${article.category.slug}`} className={styles.epaperSecondaryBtn}>
                <span>{article.category.name} समाचार</span>
              </Link>
            </div>
          </div>
        )}

        <AdSlot size="sidebar" />
      </aside>
    </div>
  )
}
