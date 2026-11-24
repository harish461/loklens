/** TanStack Query hooks for the v1 API. Query keys are stable arrays so the offline cache can persist them. */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { api } from './client'
import type { ListArticlesParams } from './types'

export const queryKeys = {
  home: ['home'] as const,
  feed: (params: ListArticlesParams) => ['articles', 'feed', params] as const,
  article: (id: number) => ['article', id] as const,
  categories: ['categories'] as const,
  category: (slug: string) => ['category', slug] as const,
  search: (q: string) => ['search', q] as const,
  tag: (slug: string) => ['tag', slug] as const,
  page: (slug: string) => ['page', slug] as const,
  settings: ['settings'] as const,
  shorts: ['shorts'] as const,
}

export const useHome = () => useQuery({ queryKey: queryKeys.home, queryFn: api.home })

/** Infinite, cursor-paginated article feed (newest first). */
export function useArticleFeed(params: ListArticlesParams = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(params),
    queryFn: ({ pageParam }) => api.articlesCursor(pageParam, { pageSize: 10, ...params }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  })
}

/** Top trending headlines (first page only). */
export const useTrending = (pageSize = 5) =>
  useQuery({
    queryKey: ['articles', 'trending', pageSize] as const,
    queryFn: () => api.articlesPage(1, { flag: 'trending', pageSize }),
  })

export const useArticle =(id: number) =>
  useQuery({ queryKey: queryKeys.article(id), queryFn: () => api.article(id), enabled: Number.isInteger(id) && id > 0 })

export const useCategories = () =>
  useQuery({ queryKey: queryKeys.categories, queryFn: api.categories, staleTime: 10 * 60_000 })

export const useCategory = (slug: string) =>
  useQuery({ queryKey: queryKeys.category(slug), queryFn: () => api.category(slug), enabled: Boolean(slug) })

export const useSettings = () =>
  useQuery({ queryKey: queryKeys.settings, queryFn: api.settings, staleTime: 30 * 60_000 })

export const useTag = (slug: string) =>
  useQuery({ queryKey: queryKeys.tag(slug), queryFn: () => api.tag(slug), enabled: Boolean(slug) })

export const usePage = (slug: string) =>
  useQuery({ queryKey: queryKeys.page(slug), queryFn: () => api.page(slug), enabled: Boolean(slug), staleTime: 60 * 60_000 })

/** Page-based search results (q must be 2–100 characters; shorter queries are not sent). */
export function useSearch(q: string) {
  const term = q.trim()
  return useInfiniteQuery({
    queryKey: queryKeys.search(term),
    queryFn: ({ pageParam }) => api.search(term, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.page + 1 : undefined),
    enabled: term.length >= 2 && term.length <= 100,
    staleTime: 30_000,
  })
}

/** Channel Shorts (server caches 5 min). */
export const useShorts = () =>
  useQuery({ queryKey: queryKeys.shorts, queryFn: () => api.shorts(30), staleTime: 5 * 60_000 })
