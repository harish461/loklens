import type { Metadata } from 'next'

import type { Article, Category, Image, SiteSettings } from '@/lib/data/types'
import { DEFAULT_CATEGORY_SEO, getGlobalSeoSettings, type GlobalSeoSettings } from './settings'

const FALLBACK_PROD_ORIGIN = 'https://loklensnews.com'

export function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  return raw || FALLBACK_PROD_ORIGIN
}

export function isStagingEnvironment(): boolean {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || '').toLowerCase()
  const host = (process.env.SITE_HOST || '').toLowerCase()
  return origin.includes('dev.') || host.includes('dev.')
}

/**
 * Converts any relative path (`/api/media/file/...`, `/brand/...`) or internal localhost URL
 * into a full absolute URL on `NEXT_PUBLIC_SITE_URL` (e.g. `https://loklensnews.com/...`).
 */
export function toAbsoluteSiteUrl(pathOrUrl: string | undefined | null): string {
  const origin = getSiteOrigin()
  if (!pathOrUrl) return `${origin}/brand/logo-square-1024.jpg`
  const trimmed = pathOrUrl.trim()
  if (!trimmed) return `${origin}/brand/logo-square-1024.jpg`

  // Rewrite any localhost/127.0.0.1/api/media proxy URL to the public site origin
  const mediaMatch = trimmed.match(/^https?:\/\/[^/]+(\/api\/media\/file\/.*)$/i)
  if (mediaMatch) {
    return `${origin}${mediaMatch[1]}`
  }

  const brandMatch = trimmed.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)$/i)
  if (brandMatch) {
    return `${origin}${brandMatch[1]}`
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
}

/** Picks the best 1200×675 / 1200×630 social share image and returns an absolute URL + dimensions. */
export function resolveAbsoluteOgImage(
  image?: Image | null,
  fallbackUrl?: string,
): { url: string; width: number; height: number; alt: string } {
  if (image && !image.isFallback) {
    const preferred = image.sizes.wide ?? image.sizes.og ?? image.sizes.article
    const chosenUrl = preferred?.url || image.url
    return {
      url: toAbsoluteSiteUrl(chosenUrl),
      width: preferred?.width || image.width || 1200,
      height: preferred?.height || image.height || 675,
      alt: image.alt || 'लोक Lens न्यूज़',
    }
  }
  return {
    url: toAbsoluteSiteUrl(fallbackUrl || image?.url || '/brand/logo-square-1024.jpg'),
    width: 1200,
    height: 630,
    alt: image?.alt || 'लोक Lens न्यूज़',
  }
}

export function resolveRobots(noindex = false): Metadata['robots'] {
  if (noindex || isStagingEnvironment()) {
    return {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
      },
    }
  }
  return {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  }
}

export async function buildRootMetadata(settings: SiteSettings): Promise<Metadata> {
  const seo = await getGlobalSeoSettings()
  const origin = getSiteOrigin()
  const suffix = seo.titleSuffix.startsWith('|') ? ` ${seo.titleSuffix}` : ` | ${seo.titleSuffix}`
  const defaultOg = resolveAbsoluteOgImage(settings.defaultImage, seo.defaultOgImageUrl)

  return {
    metadataBase: new URL(origin),
    title: {
      default: seo.homeMetaTitle,
      template: `%s${suffix}`,
    },
    description: seo.homeMetaDescription,
    applicationName: 'लोक Lens न्यूज़ (LokLens News)',
    alternates: {
      canonical: `${origin}/`,
    },
    openGraph: {
      type: 'website',
      locale: 'hi_IN',
      url: `${origin}/`,
      siteName: 'लोक Lens न्यूज़',
      title: seo.homeMetaTitle,
      description: seo.homeMetaDescription,
      images: [defaultOg],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.homeMetaTitle,
      description: seo.homeMetaDescription,
      images: [defaultOg.url],
    },
    robots: resolveRobots(false),
    ...(seo.googleSiteVerification
      ? {
          verification: {
            google: seo.googleSiteVerification,
          },
        }
      : {}),
  }
}

export async function buildHomeMetadata(settings: SiteSettings): Promise<Metadata> {
  const seo = await getGlobalSeoSettings()
  const origin = getSiteOrigin()
  const defaultOg = resolveAbsoluteOgImage(settings.defaultImage, seo.defaultOgImageUrl)

  return {
    title: {
      absolute: seo.homeMetaTitle,
    },
    description: seo.homeMetaDescription,
    alternates: {
      canonical: `${origin}/`,
    },
    openGraph: {
      type: 'website',
      locale: 'hi_IN',
      url: `${origin}/`,
      siteName: 'लोक Lens न्यूज़',
      title: seo.homeMetaTitle,
      description: seo.homeMetaDescription,
      images: [defaultOg],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.homeMetaTitle,
      description: seo.homeMetaDescription,
      images: [defaultOg.url],
    },
    robots: resolveRobots(false),
  }
}

export async function buildCategoryMetadata(
  category: Category,
  page = 1,
  settings?: SiteSettings,
  globalSeo?: GlobalSeoSettings,
): Promise<Metadata> {
  const seo = globalSeo ?? (await getGlobalSeoSettings())
  const origin = getSiteOrigin()
  const catSeo = seo.categories[category.slug] ?? DEFAULT_CATEGORY_SEO[category.slug]
  const pageSuffix = page > 1 ? ` — पेज ${page}` : ''
  const baseTitle =
    catSeo?.metaTitle ||
    (category.seo.title && category.seo.title !== `${category.name} समाचार`
      ? category.seo.title
      : `${category.name} समाचार — ताज़ा हिंदी खबरें`)
  const title = `${baseTitle}${pageSuffix}`
  const description =
    catSeo?.metaDescription ||
    category.seo.description ||
    `${category.name} से जुड़ी ताज़ा और विश्वसनीय हिंदी खबरें लोक Lens न्यूज़ पर पढ़ें।`
  const canonicalPath = page > 1 ? `/${category.slug}/page/${page}` : `/${category.slug}`
  const canonicalUrl = `${origin}${canonicalPath}`
  const ogImg = resolveAbsoluteOgImage(settings?.defaultImage, seo.defaultOgImageUrl)

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'website',
      locale: 'hi_IN',
      url: canonicalUrl,
      siteName: 'लोक Lens न्यूज़',
      title: `${title} ${seo.titleSuffix}`,
      description,
      images: [ogImg],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} ${seo.titleSuffix}`,
      description,
      images: [ogImg.url],
    },
    robots: resolveRobots(false),
  }
}

export async function buildArticleMetadata(
  article: Article,
  settings?: SiteSettings,
): Promise<Metadata> {
  const seo = await getGlobalSeoSettings()
  const origin = getSiteOrigin()
  const canonicalUrl = `${origin}${article.url}`

  const metaTitle = (article.seo.title || article.title).trim()
  const metaDescription = (article.seo.description || article.summary || article.title).trim()
  const ogImg = resolveAbsoluteOgImage(
    article.seo.image && !article.seo.image.isFallback ? article.seo.image : article.image,
    seo.defaultOgImageUrl,
  )

  const tagNames = article.tags.map((t) => t.name).filter(Boolean)
  const keywords = Array.from(new Set([article.category.name, ...(article.location ? [article.location.name] : []), ...tagNames]))

  return {
    title: metaTitle,
    description: metaDescription,
    keywords: keywords.length > 0 ? keywords : undefined,
    authors: article.authors.map((a) => ({
      name: a.name,
      ...(a.slug ? { url: `${origin}/author/${a.slug}` } : {}),
    })),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'article',
      locale: 'hi_IN',
      url: canonicalUrl,
      siteName: 'लोक Lens न्यूज़',
      title: metaTitle,
      description: metaDescription,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      section: article.category.name,
      tags: tagNames.length > 0 ? tagNames : undefined,
      authors: article.authors.map((a) => a.name),
      images: [
        {
          url: ogImg.url,
          width: ogImg.width,
          height: ogImg.height,
          alt: article.image.alt || article.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDescription,
      images: [ogImg.url],
    },
    robots: resolveRobots(article.seo.noindex),
    other: {
      'article:published_time': article.publishedAt,
      'article:modified_time': article.updatedAt,
      'article:section': article.category.name,
    },
  }
}

// ============================================================================
// JSON-LD Structured Data Builders (NewsArticle, BreadcrumbList, Organization)
// ============================================================================

export function buildPublisherJsonLd(settings?: SiteSettings) {
  const origin = getSiteOrigin()
  const logoUrl = toAbsoluteSiteUrl(settings?.logo?.url || '/brand/logo-144.webp')

  return {
    '@type': 'NewsMediaOrganization',
    '@id': `${origin}/#organization`,
    name: 'लोक Lens न्यूज़ (LokLens News)',
    alternateName: 'LokLens News',
    url: origin,
    logo: {
      '@type': 'ImageObject',
      url: logoUrl,
      width: 144,
      height: 144,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Sanga Cottage, Lower Mall Road',
      addressLocality: 'Almora',
      addressRegion: 'Uttarakhand',
      postalCode: '263601',
      addressCountry: 'IN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-7037455895',
      contactType: 'editorial',
      email: 'newsloklens@gmail.com',
      areaServed: 'IN',
      availableLanguage: ['hi', 'en'],
    },
    sameAs: (settings?.social ?? []).map((s) => s.url).filter((u) => /^https?:\/\//i.test(u)),
  }
}

export function buildWebSiteJsonLd(settings?: SiteSettings) {
  const origin = getSiteOrigin()
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildPublisherJsonLd(settings),
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: 'लोक Lens न्यूज़',
        alternateName: 'LokLens News',
        inLanguage: 'hi',
        publisher: {
          '@id': `${origin}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  const origin = getSiteOrigin()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: `${origin}${item.path.startsWith('/') ? '' : '/'}${item.path}`,
    })),
  }
}

export function buildNewsArticleJsonLd(article: Article, settings?: SiteSettings) {
  const origin = getSiteOrigin()
  const canonicalUrl = `${origin}${article.url}`
  const ogImg = resolveAbsoluteOgImage(
    article.seo.image && !article.seo.image.isFallback ? article.seo.image : article.image,
  )
  const keywords = Array.from(
    new Set([
      article.category.name,
      ...(article.location ? [article.location.name] : []),
      ...article.tags.map((t) => t.name),
    ]),
  ).filter(Boolean)

  const authors = article.authors.map((a) =>
    a.kind === 'person'
      ? {
          '@type': 'Person',
          name: a.name,
          url: a.slug ? `${origin}/author/${a.slug}` : origin,
        }
      : {
          '@type': 'NewsMediaOrganization',
          name: a.name || 'LokLens News Team',
          url: origin,
        },
  )

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    headline: (article.seo.title || article.title).slice(0, 110),
    alternativeHeadline: article.title,
    description: article.seo.description || article.summary || article.title,
    image: [
      {
        '@type': 'ImageObject',
        url: ogImg.url,
        width: ogImg.width,
        height: ogImg.height,
        caption: article.image.alt || article.title,
      },
    ],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: authors,
    publisher: buildPublisherJsonLd(settings),
    articleSection: article.category.name,
    ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
    inLanguage: 'hi',
    isAccessibleForFree: true,
  }
}
