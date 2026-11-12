/**
 * The article page body, shared by the public article route and the draft preview (/preview/[id]) so a
 * preview looks exactly like the published page. Moved unchanged from page.tsx.
 */
import Image from 'next/image'
import Link from 'next/link'

import { ArticleCard } from '@/components/ArticleCard'
import { RelatedList, TagChips, WhatsAppChannelBanner } from '@/components/ArticleExtras'
import { AdSlot } from '@/components/AdSlot'
import { BreakingBadge, CategoryLabel } from '@/components/Badges'
import { absoluteUrl, formatDateTime } from '@/components/format'
import { Breadcrumbs } from '@/components/Navigation'
import { NewsImage } from '@/components/NewsImage'
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
        src={img.sizes.thumb?.url ?? img.url}
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
            displayWidth={760}
            preferred="article"
            sizes="(min-width: 1024px) 760px, 100vw"
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

      <aside className={styles.sidebar} aria-labelledby="article-side">
        <h2 id="article-side" className={styles.sideTitle}>
          ताज़ा खबरें
        </h2>
        <ol className={styles.sideList}>
          {sidebar.map((a, i) => (
            <li key={a.id}>
              <ArticleCard article={a} variant="numbered" index={i + 1} />
            </li>
          ))}
        </ol>
        <AdSlot size="sidebar" />
      </aside>
    </div>
  )
}
