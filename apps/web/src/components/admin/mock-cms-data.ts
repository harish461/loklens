/**
 * Clearly separated fallback / demo data for the LokLens Admin CMS dashboard and modules.
 * Real database records from Payload CMS (articles, categories, users, media, locations) are always
 * loaded first and merged with these realistic Hindi newsroom records when a metric or module
 * (such as external web traffic analytics, reader comments, or ad campaigns) does not yet have
 * live rows in the database.
 */

export type ArticleWorkflowStatus = 'published' | 'draft' | 'pending_review' | 'scheduled' | 'rejected'

export interface AdminArticleItem {
  id: string | number
  dbId?: number
  isSample?: boolean
  title: string
  slug: string
  summary: string
  category: string
  categoryId?: number
  subcategory?: string
  author: string
  authorRole?: string
  publishedAt: string
  updatedAt: string
  views: number
  viewsFormatted: string
  status: ArticleWorkflowStatus
  isBreaking: boolean
  isFeatured: boolean
  isTrending: boolean
  thumbnailUrl: string
  editHref: string
  previewHref: string
  seoScore?: number
  focusKeyword?: string
}

export interface TrafficPoint {
  label: string
  visitors: number
  pageViews: number
  uniqueVisitors: number
  organicPct: number
}

export interface CategoryPerformanceItem {
  category: string
  hindiLabel: string
  articles: number
  views: number
  viewsFormatted: string
  engagement: number
  color: string
  pastelBg: string
  highlight?: boolean
}

export interface ScheduledPublishItem {
  id: string
  title: string
  category: string
  scheduledTime: string
  scheduledDate: string // YYYY-MM-DD
  author: string
  status: 'scheduled' | 'in_progress' | 'upcoming'
  pastelBg: string
  accentColor: string
  editHref: string
}

export interface PendingTaskItem {
  id: string
  title: string
  subtitle: string
  count: number
  priority: 'high' | 'medium' | 'low'
  href: string
  pastelBg: string
  iconName: 'file-check' | 'message-square' | 'search-alert' | 'image'
}

export interface ModerationCommentItem {
  id: string
  articleTitle: string
  readerName: string
  readerLocation: string
  comment: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected' | 'spam'
  flaggedReason?: string
}

export interface AdSlotConfigItem {
  id: string
  name: string
  placement: string
  dimensions: string
  status: 'active' | 'paused' | 'scheduled'
  impressions: string
  ctr: string
  revenue: string
  sponsor: string
}

export interface SubcategoryItem {
  id: string
  name: string
  slug: string
  parentCategory: string
  articleCount: number
  status: 'active' | 'hidden'
}

export interface AdminNotificationItem {
  id: string
  title: string
  detail: string
  timeAgo: string
  type: 'breaking' | 'review' | 'comment' | 'schedule'
  unread: boolean
  href: string
}

export const TRAFFIC_SERIES: Record<'daily' | 'weekly' | 'monthly', {
  summary: {
    totalVisitors: string
    pageViews: string
    uniqueVisitors: string
    organicTraffic: string
    deltaText: string
  }
  points: TrafficPoint[]
}> = {
  daily: {
    summary: {
      totalVisitors: '0',
      pageViews: '0',
      uniqueVisitors: '0',
      organicTraffic: '0%',
      deltaText: 'No traffic data yet',
    },
    points: [],
  },
  weekly: {
    summary: {
      totalVisitors: '0',
      pageViews: '0',
      uniqueVisitors: '0',
      organicTraffic: '0%',
      deltaText: 'No traffic data yet',
    },
    points: [],
  },
  monthly: {
    summary: {
      totalVisitors: '0',
      pageViews: '0',
      uniqueVisitors: '0',
      organicTraffic: '0%',
      deltaText: 'No traffic data yet',
    },
    points: [],
  },
}

export const CATEGORY_PERFORMANCE: CategoryPerformanceItem[] = []

export const SAMPLE_HINDI_ARTICLES: AdminArticleItem[] = []

export const SCHEDULED_PUBLISH_ITEMS: ScheduledPublishItem[] = []

export const PENDING_TASKS: PendingTaskItem[] = []

export const SAMPLE_COMMENTS: ModerationCommentItem[] = []

export const SAMPLE_AD_SLOTS: AdSlotConfigItem[] = []

export const SAMPLE_SUBCATEGORIES: SubcategoryItem[] = []

export const INITIAL_NOTIFICATIONS: AdminNotificationItem[] = []

