import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import type { Article } from '@/lib/data/types'
import { getArticle, getSiteSettings, listArticles } from '@/lib/data'
import { buildArticleMetadata, buildBreadcrumbJsonLd, buildNewsArticleJsonLd } from '@/lib/seo'

import { ArticleView } from './ArticleView'

export const dynamic = 'force-dynamic'
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugId } = await params
  const [article, settings] = await Promise.all([load(slugId), getSiteSettings()])
  if (!article) return {}
  return buildArticleMetadata(article, settings)
}

export default async function ArticlePage({ params }: Props) {
  const { category, slugId } = await params
  const article = await load(slugId)
  if (!article) notFound()
  if (`/${category}/${slugId}` !== article.url) permanentRedirect(article.url)

  const [settings, latest] = await Promise.all([getSiteSettings(), listArticles({ pageSize: 7 })])
  const sidebar = latest.items.filter((a) => a.id !== article.id).slice(0, 6)

  const newsArticleJsonLd = buildNewsArticleJsonLd(article, settings)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'होम', path: '/' },
    { name: article.category.name, path: `/${article.category.slug}` },
    { name: article.title, path: article.url },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ArticleView article={article} settings={settings} sidebar={sidebar} />
    </>
  )
}
