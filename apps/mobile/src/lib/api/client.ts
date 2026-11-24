/**
 * HTTP client for the public LokLens API v1 (read-only GET endpoints, no credentials).
 * Base URL: app.json → expo.extra.apiBaseUrl, overridable with EXPO_PUBLIC_API_URL (e.g. a local server).
 */
import axios, { AxiosError } from 'axios'
import Constants from 'expo-constants'

import type { ApiErrorBody, Article, ArticleCard, Category, CursorPage, Home, ListArticlesParams, Page, Paginated, Short, SiteSettings, TagRef } from './types'

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string; siteUrl?: string }

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiBaseUrl || 'https://loklensnews.com/api/v1').replace(/\/+$/, '')
export const SITE_URL = (extra.siteUrl || 'https://loklensnews.com').replace(/\/+$/, '')

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
})

/** Error with the contract's code; `status` 0 = network/offline. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorBody['error']['code'] | 'NETWORK',
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  get isNotFound() {
    return this.status === 404
  }
  get isRetryable() {
    return this.status === 0 || this.status >= 500
  }
}

function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const body = err.response?.data as Partial<ApiErrorBody> | undefined
    if (err.response) {
      return new ApiError(err.response.status, body?.error?.code ?? 'SERVER_ERROR', body?.error?.message ?? err.message)
    }
    return new ApiError(0, 'NETWORK', 'इंटरनेट कनेक्शन उपलब्ध नहीं है।')
  }
  return new ApiError(0, 'NETWORK', err instanceof Error ? err.message : 'Unknown error')
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  try {
    const res = await http.get<T>(path, { params })
    return res.data
  } catch (err) {
    throw toApiError(err)
  }
}

export const api = {
  home: () => get<Home>('/home'),
  articlesPage: (page: number, params: ListArticlesParams = {}) =>
    get<Paginated<ArticleCard>>('/articles', { page, ...params }),
  /** Cursor mode: an empty cursor requests the first page (contract §2). */
  articlesCursor: (cursor: string, params: ListArticlesParams = {}) =>
    get<CursorPage<ArticleCard>>('/articles', { cursor, ...params }),
  article: (id: number) => get<Article>(`/articles/${id}`),
  categories: () => get<Category[]>('/categories'),
  category: (slug: string) => get<Category>(`/categories/${encodeURIComponent(slug)}`),
  tag: (slug: string) => get<TagRef>(`/tags/${encodeURIComponent(slug)}`),
  page: (slug: string) => get<Page>(`/pages/${encodeURIComponent(slug)}`),
  search: (q: string, page = 1) => get<Paginated<ArticleCard>>('/search', { q, page }),
  settings: () => get<SiteSettings>('/settings'),
  shorts: (limit = 30) => get<{ items: Short[] }>('/shorts', { limit }),
}

/** Absolute website URL for sharing an article/category path. */
export const siteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
