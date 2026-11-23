import { listArticles, type ListArticlesParams } from '@/lib/data'

import { numberParam, preflight, stringParam, v1Get } from '../_lib/http'

/**
 * GET /api/v1/articles → Paginated<ArticleCard>, or CursorPage<ArticleCard> when `cursor` is present
 * (even empty). Params: page | cursor, pageSize, category, tag, author, flag (contract §2).
 */
export const GET = v1Get(async (query) => {
  const params: ListArticlesParams = {
    page: numberParam(query, 'page'),
    pageSize: numberParam(query, 'pageSize'),
    category: stringParam(query, 'category'),
    tag: stringParam(query, 'tag'),
    author: stringParam(query, 'author'),
    flag: stringParam(query, 'flag') as ListArticlesParams['flag'],
  }
  const cursor = query.get('cursor')
  return cursor === null ? listArticles(params) : listArticles({ ...params, cursor })
})
export const OPTIONS = preflight
