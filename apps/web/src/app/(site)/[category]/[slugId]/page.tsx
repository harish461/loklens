import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'

import { ArticleCard } from '@/components/ArticleCard'
import { RelatedList, TagChips, WhatsAppChannelBanner } from '@/components/ArticleExtras'
import { AdSlot } from '@/components/AdSlot'
import { BreakingBadge, CategoryLabel } from '@/components/Badges'
import { absoluteUrl, formatDateTime } from '@/components/format'
import { Breadcrumbs } from '@/components/Navigation'
import { NewsImage } from '@/components/NewsImage'
import { RichText } from '@/components/RichText'
import { ShareBar } from '@/components/ShareBar'
import type { Article, AuthorRef } from '@/lib/data/types'
import { getArticle, getSiteSettings, listArticles } from '@/lib/mock'

import styles from './article.module.css'

export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ category: string; slugId: string }> }

/** `/{category}/{slug}-{id}` → id (contract §4). */
function parseId(slugId: string): number | null {
  const m = slugId.match(/-(\d+)$/) ?? slugId.match(/^(\d+)$/)
  if (!m) return null
  const id = Number(m[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

async function load(slugId: string): Promise<Article | null> {
  const id = parseId(slugId)
  return id ? getArticle(id) : null
}

// TODO(seo): replace with src/lib/seo article metadata + NewsArticle/BreadcrumbList JSON-LD.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugId } = await params
  const article = await load(slugId)
  if (!article) return {}
  return { title: article.seo.title || article.title, description: article.seo.description || article.summary }
}

function Byline({ authors }: { authors: AuthorRef[] }) {
  const first = authors[0]
  const avatar = first?.photo ? (
    <Image
      src={first.photo.sizes.thumb?.url ?? first.photo.url}
      width={40}
      height={40}
      alt=""
      unoptimized
      className={styles.avatar}
    />
  ) : (
    <span className={styles.monogram} aria-hidden="true">
      LL
    </span>
  )
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

export default async function ArticlePage({ params }: Props) {
  const { category, slugId } = await params
  const article = await load(slugId)
  if (!article) notFound()
  if (`/${category}/${slugId}` !== article.url) permanentRedirect(article.url)

  const [settings, latest] = await Promise.all([getSiteSettings(), listArticles({ pageSize: 7 })])
  const sidebar = latest.items.filter((a) => a.id !== article.id).slice(0, 6)
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
            <Byline authors={article.authors} />
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
