import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import type { Article } from '@/lib/data/types'
import { getArticle, getSiteSettings, listArticles } from '@/lib/data'

import { ArticleView } from './ArticleView'

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

export default async function ArticlePage({ params }: Props) {
  const { category, slugId } = await params
  const article = await load(slugId)
  if (!article) notFound()
  if (`/${category}/${slugId}` !== article.url) permanentRedirect(article.url)

  const [settings, latest] = await Promise.all([getSiteSettings(), listArticles({ pageSize: 7 })])
  const sidebar = latest.items.filter((a) => a.id !== article.id).slice(0, 6)

  return <ArticleView article={article} settings={settings} sidebar={sidebar} />
}
