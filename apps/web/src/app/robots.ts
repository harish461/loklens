import type { MetadataRoute } from 'next'

import { getSiteOrigin, isStagingEnvironment } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin()

  // Block all crawlers on staging (dev.loklensnews.com)
  if (isStagingEnvironment()) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/*', '/api', '/api/*', '/preview', '/preview/*', '/reporter', '/reporter/*'],
      },
    ],
    sitemap: [`${origin}/sitemap.xml`, `${origin}/news-sitemap.xml`],
    host: origin,
  }
}
