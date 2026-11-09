import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

import type { ArticleCard as Card, Image, RichTextNode } from '@/lib/data/types'

import { AdSlot } from '../AdSlot'
import { ArticleCard } from '../ArticleCard'
import { NewsImage } from '../NewsImage'
import { EmbedFacade } from './EmbedFacade'
import styles from './RichText.module.css'

/**
 * Renders contract §5 rich text (Lexical JSON). Only allowed nodes render; unknown nodes are skipped.
 * Sanitising also happens server-side, but the renderer re-checks link schemes and embed hosts so a bad
 * node can never produce a dangerous attribute.
 */

const LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']
const FORMAT_BOLD = 1
const FORMAT_ITALIC = 2
const FORMAT_UNDERLINE = 8

export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  if (!url) return null
  if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('#')) return url
  try {
    return LINK_SCHEMES.includes(new URL(url).protocol) ? url : null
  } catch {
    return null
  }
}

const EMBED_HOSTS: Record<string, string[]> = {
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch'],
}

export function youTubeId(url: URL): string | null {
  let id: string | null = null
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1)
  else if (url.pathname === '/watch') id = url.searchParams.get('v')
  else {
    const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)
    id = m ? m[1] : null
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

function isImage(v: unknown): v is Image {
  return !!v && typeof v === 'object' && typeof (v as Image).url === 'string' && typeof (v as Image).alt === 'string'
}

function isCard(v: unknown): v is Card {
  return !!v && typeof v === 'object' && typeof (v as Card).url === 'string' && typeof (v as Card).title === 'string'
}

function renderText(node: RichTextNode, key: number): ReactNode {
  const format = typeof node.format === 'number' ? node.format : 0
  let out: ReactNode = node.text ?? ''
  if (format & FORMAT_UNDERLINE) out = <u>{out}</u>
  if (format & FORMAT_ITALIC) out = <em>{out}</em>
  if (format & FORMAT_BOLD) out = <strong>{out}</strong>
  return <Fragment key={key}>{out}</Fragment>
}

function renderInline(nodes: RichTextNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, i) => {
    switch (node.type) {
      case 'text':
        return renderText(node, i)
      case 'linebreak':
        return <br key={i} />
      case 'link':
      case 'autolink': {
        const href = safeHref(node.fields?.url)
        const children = renderInline(node.children)
        if (!href) return <Fragment key={i}>{children}</Fragment>
        if (href.startsWith('/') || href.startsWith('#')) {
          return (
            <Link key={i} href={href}>
              {children}
            </Link>
          )
        }
        const newTab = node.fields?.newTab === true
        return (
          <a key={i} href={href} rel="noopener" target={newTab ? '_blank' : undefined}>
            {children}
          </a>
        )
      }
      default:
        return null // unknown inline node: skipped
    }
  })
}

function renderBlock(node: RichTextNode, key: number): ReactNode {
  switch (node.type) {
    case 'paragraph': {
      const children = renderInline(node.children)
      return children.length ? <p key={key}>{children}</p> : null
    }
    case 'heading': {
      const Tag = node.tag === 'h3' ? 'h3' : node.tag === 'h4' ? 'h4' : 'h2'
      return <Tag key={key}>{renderInline(node.children)}</Tag>
    }
    case 'quote':
      return <blockquote key={key}>{renderInline(node.children)}</blockquote>
    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul'
      return (
        <Tag key={key}>
          {(node.children ?? [])
            .filter((c) => c.type === 'listitem')
            .map((li, i) => {
              // Nested lists sit inside a listitem.
              const nested = (li.children ?? []).filter((c) => c.type === 'list')
              const inline = (li.children ?? []).filter((c) => c.type !== 'list')
              return (
                <li key={i}>
                  {renderInline(inline)}
                  {nested.map((n, j) => renderBlock(n, j))}
                </li>
              )
            })}
        </Tag>
      )
    }
    case 'upload': {
      if (!isImage(node.value)) return null
      const img = node.value
      return (
        <figure key={key} className={styles.figure}>
          <NewsImage image={img} displayWidth={680} sizes="(min-width: 768px) 680px, 100vw" />
          {(img.caption || img.credit) && (
            <figcaption>
              {img.caption}
              {img.credit && <span className={styles.credit}> — {img.credit}</span>}
            </figcaption>
          )}
        </figure>
      )
    }
    case 'block': {
      const f = node.fields ?? {}
      if (f.blockType === 'embed') {
        const provider = typeof f.provider === 'string' ? f.provider : ''
        if (typeof f.url !== 'string' || !EMBED_HOSTS[provider]) return null
        let url: URL
        try {
          url = new URL(f.url)
        } catch {
          return null
        }
        if (url.protocol !== 'https:' || !EMBED_HOSTS[provider].includes(url.hostname.toLowerCase())) return null
        const videoId = provider === 'youtube' ? youTubeId(url) : null
        if (provider === 'youtube' && !videoId) return null
        return <EmbedFacade key={key} provider={provider} url={url.toString()} youtubeId={videoId} />
      }
      if (f.blockType === 'relatedArticle' && isCard(f.article)) {
        return (
          <aside key={key} className={styles.related} aria-label="यह भी पढ़ें">
            <p className={styles.relatedLabel}>यह भी पढ़ें</p>
            <ArticleCard article={f.article} variant="list" showCategory={false} />
          </aside>
        )
      }
      return null
    }
    default:
      return null // unknown node: skipped, never crash
  }
}

interface Props {
  nodes: RichTextNode[]
  /** Insert the in-article ad slot after this many paragraphs (design system: 3). */
  adAfterParagraph?: number
  className?: string
}

export function RichText({ nodes, adAfterParagraph, className }: Props) {
  let paragraphs = 0
  const out: ReactNode[] = []
  ;(Array.isArray(nodes) ? nodes : []).forEach((node, i) => {
    if (!node || typeof node !== 'object') return
    out.push(renderBlock(node, i))
    if (node.type === 'paragraph') {
      paragraphs++
      if (adAfterParagraph && paragraphs === adAfterParagraph) out.push(<AdSlot key={`ad-${i}`} size="in-article" />)
    }
  })
  return <div className={`${styles.body} ${className ?? ''}`}>{out}</div>
}
