import { Share } from 'react-native'

import { siteUrl } from './api/client'
import type { ArticleCard } from './api/types'

/** Native share sheet with the headline and the website link. */
export function shareArticle(article: Pick<ArticleCard, 'title' | 'url'>) {
  const link = siteUrl(article.url)
  return Share.share({ title: article.title, message: `${article.title}\n\n${link}`, url: link }).catch(() => {})
}
