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
      totalVisitors: '84,320',
      pageViews: '2,41,800',
      uniqueVisitors: '68,940',
      organicTraffic: '74.8%',
      deltaText: '+14.2% vs yesterday',
    },
    points: [
      { label: '06:00', visitors: 6200, pageViews: 15400, uniqueVisitors: 5100, organicPct: 71 },
      { label: '09:00', visitors: 14800, pageViews: 41200, uniqueVisitors: 12300, organicPct: 76 },
      { label: '12:00', visitors: 19400, pageViews: 56800, uniqueVisitors: 15900, organicPct: 78 },
      { label: '15:00', visitors: 16100, pageViews: 47300, uniqueVisitors: 13200, organicPct: 74 },
      { label: '18:00', visitors: 21900, pageViews: 64500, uniqueVisitors: 17800, organicPct: 77 },
      { label: '21:00', visitors: 25400, pageViews: 74900, uniqueVisitors: 20400, organicPct: 75 },
      { label: '23:59', visitors: 11800, pageViews: 31200, uniqueVisitors: 9600, organicPct: 72 },
    ],
  },
  weekly: {
    summary: {
      totalVisitors: '5,82,400',
      pageViews: '16,94,000',
      uniqueVisitors: '4,38,100',
      organicTraffic: '76.4%',
      deltaText: '+18.6% vs last week',
    },
    points: [
      { label: 'Mon', visitors: 68400, pageViews: 198000, uniqueVisitors: 52100, organicPct: 74 },
      { label: 'Tue', visitors: 74200, pageViews: 215000, uniqueVisitors: 57400, organicPct: 75 },
      { label: 'Wed', visitors: 81900, pageViews: 248000, uniqueVisitors: 63800, organicPct: 77 },
      { label: 'Thu', visitors: 79500, pageViews: 231000, uniqueVisitors: 61200, organicPct: 76 },
      { label: 'Fri', visitors: 88600, pageViews: 264000, uniqueVisitors: 68900, organicPct: 78 },
      { label: 'Sat', visitors: 96400, pageViews: 289000, uniqueVisitors: 74500, organicPct: 79 },
      { label: 'Sun', visitors: 93400, pageViews: 249000, uniqueVisitors: 71200, organicPct: 76 },
    ],
  },
  monthly: {
    summary: {
      totalVisitors: '2.4M',
      pageViews: '6.8M',
      uniqueVisitors: '1.82M',
      organicTraffic: '78.2%',
      deltaText: '+22.4% vs last month',
    },
    points: [
      { label: 'Jun', visitors: 1420000, pageViews: 4100000, uniqueVisitors: 1090000, organicPct: 71 },
      { label: 'Jul', visitors: 1650000, pageViews: 4750000, uniqueVisitors: 1260000, organicPct: 73 },
      { label: 'Aug', visitors: 1810000, pageViews: 5210000, uniqueVisitors: 1390000, organicPct: 75 },
      { label: 'Sep', visitors: 1960000, pageViews: 5680000, uniqueVisitors: 1510000, organicPct: 76 },
      { label: 'Oct', visitors: 2180000, pageViews: 6240000, uniqueVisitors: 1670000, organicPct: 77 },
      { label: 'Nov', visitors: 2410000, pageViews: 6840000, uniqueVisitors: 1820000, organicPct: 78 },
    ],
  },
}

export const CATEGORY_PERFORMANCE: CategoryPerformanceItem[] = [
  {
    category: 'Hindi News',
    hindiLabel: 'हिंदी न्यूज़ (उत्तराखंड)',
    articles: 342,
    views: 842000,
    viewsFormatted: '842K',
    engagement: 88,
    color: '#1C1B29',
    pastelBg: '#ECF8C5',
    highlight: true,
  },
  {
    category: 'राजनीति',
    hindiLabel: 'राजनीति',
    articles: 256,
    views: 618000,
    viewsFormatted: '618K',
    engagement: 84,
    color: '#1C1B29',
    pastelBg: '#FDECE4',
  },
  {
    category: 'मनोरंजन',
    hindiLabel: 'मनोरंजन',
    articles: 184,
    views: 429000,
    viewsFormatted: '429K',
    engagement: 79,
    color: '#1C1B29',
    pastelBg: '#EBE8FD',
  },
  {
    category: 'खेल',
    hindiLabel: 'खेल',
    articles: 198,
    views: 512000,
    viewsFormatted: '512K',
    engagement: 82,
    color: '#1C1B29',
    pastelBg: '#E3F2FD',
  },
  {
    category: 'टेक्नोलॉजी',
    hindiLabel: 'टेक्नोलॉजी',
    articles: 142,
    views: 294000,
    viewsFormatted: '294K',
    engagement: 75,
    color: '#1C1B29',
    pastelBg: '#E6F7EF',
  },
  {
    category: 'बिजनेस',
    hindiLabel: 'बिजनेस',
    articles: 126,
    views: 248000,
    viewsFormatted: '248K',
    engagement: 73,
    color: '#1C1B29',
    pastelBg: '#FEF5D9',
  },
]

export const SAMPLE_HINDI_ARTICLES: AdminArticleItem[] = [
  {
    id: 'sample-101',
    isSample: true,
    title: 'देहरादून-दिल्ली एक्सप्रेसवे का अंतिम चरण पूरा, अब मात्र 2.5 घंटे में तय होगा सफर',
    slug: 'dehradun-delhi-expressway-final-phase-complete',
    summary: 'उत्तराखंड और दिल्ली के बीच यात्रा करने वाले लाखों यात्रियों के लिए बड़ी राहत। एलिवेटेड वाइल्डलाइफ कॉरिडोर पर ट्रायल शुरू।',
    category: 'प्रदेश',
    subcategory: 'देहरादून',
    author: 'रोहित बहुगुणा',
    authorRole: 'Senior Editor',
    publishedAt: '2026-11-12T08:30:00+05:30',
    updatedAt: '2026-11-12T09:15:00+05:30',
    views: 68420,
    viewsFormatted: '68.4K',
    status: 'published',
    isBreaking: true,
    isFeatured: true,
    isTrending: true,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 94,
    focusKeyword: 'देहरादून दिल्ली एक्सप्रेसवे',
  },
  {
    id: 'sample-102',
    isSample: true,
    title: 'उत्तराखंड विधानसभा का शीतकालीन सत्र: भू-कानून और स्वरोजगार योजना पर विशेष चर्चा',
    slug: 'uttarakhand-assembly-winter-session-bhu-kanoon',
    summary: 'मंत्रिमंडल की बैठक में मूल निवास और सख्त भू-कानून के प्रारूप पर मंथन तेज, विपक्ष ने भी तैयार की रणनीति।',
    category: 'राजनीति',
    subcategory: 'विधानसभा',
    author: 'प्रिया नौटियाल',
    authorRole: 'Political Bureau',
    publishedAt: '2026-11-12T07:45:00+05:30',
    updatedAt: '2026-11-12T08:10:00+05:30',
    views: 52190,
    viewsFormatted: '52.2K',
    status: 'published',
    isBreaking: false,
    isFeatured: true,
    isTrending: true,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 91,
    focusKeyword: 'उत्तराखंड भू-कानून',
  },
  {
    id: 'sample-103',
    isSample: true,
    title: 'बॉर्डर-गावस्कर ट्रॉफी: ऋषभ पंत की शानदार वापसी, अभ्यास मैच में जड़ा तूफानी शतक',
    slug: 'rishabh-pant-century-border-gavaskar-trophy-practice',
    summary: 'रुड़की के स्टार विकेटकीपर-बल्लेबाज ऋषभ पंत ने ऑस्ट्रेलियाई गेंदबाजों के खिलाफ आक्रामक बल्लेबाजी का प्रदर्शन किया।',
    category: 'खेल',
    subcategory: 'क्रिकेट',
    author: 'आदित्य रावत',
    authorRole: 'Sports Desk',
    publishedAt: '2026-11-12T06:20:00+05:30',
    updatedAt: '2026-11-12T06:50:00+05:30',
    views: 44800,
    viewsFormatted: '44.8K',
    status: 'published',
    isBreaking: false,
    isFeatured: false,
    isTrending: true,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 88,
    focusKeyword: 'ऋषभ पंत शतक',
  },
  {
    id: 'sample-104',
    isSample: true,
    title: 'केदारनाथ और बद्रीनाथ धाम में शीतकालीन सुरक्षा व्यवस्था, ITBP और पुलिस की संयुक्त तैनाती',
    slug: 'kedarnath-badrinath-winter-security-itbp-deployment',
    summary: 'कपाट बंद होने के बाद उच्च हिमालयी क्षेत्रों में बर्फबारी के बीच मंदिर परिसर और पुनर्निर्माण कार्यों की सुरक्षा बढ़ाई गई।',
    category: 'समाज',
    subcategory: 'चारधाम',
    author: 'संदीप जोशी',
    authorRole: 'Garhwal Correspondent',
    publishedAt: '2026-11-12T10:00:00+05:30',
    updatedAt: '2026-11-12T10:15:00+05:30',
    views: 18400,
    viewsFormatted: '18.4K',
    status: 'pending_review',
    isBreaking: false,
    isFeatured: false,
    isTrending: false,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 83,
    focusKeyword: 'केदारनाथ शीतकालीन सुरक्षा',
  },
  {
    id: 'sample-105',
    isSample: true,
    title: 'AI और डिजिटल पत्रकारिता: क्षेत्रीय भाषाओं में समाचार वितरण का बदलता स्वरूप',
    slug: 'ai-digital-journalism-regional-hindi-news-tech',
    summary: 'देवनागरी लिपि में वॉइस सर्च और स्मार्ट कंटेंट रिकमेंडेशन से टियर-2 और टियर-3 शहरों में पाठकों की संख्या में भारी उछाल।',
    category: 'टेक्नोलॉजी',
    subcategory: 'आर्टिफिशियल इंटेलिजेंस',
    author: 'नेहा नेगी',
    authorRole: 'Tech Editor',
    publishedAt: '2026-11-13T09:00:00+05:30',
    updatedAt: '2026-11-12T09:40:00+05:30',
    views: 0,
    viewsFormatted: '—',
    status: 'scheduled',
    isBreaking: false,
    isFeatured: true,
    isTrending: false,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 90,
    focusKeyword: 'डिजिटल पत्रकारिता AI',
  },
  {
    id: 'sample-106',
    isSample: true,
    title: 'हल्द्वानी और रुद्रपुर में नए आईटी पार्क व स्टार्टअप इनक्यूबेशन सेंटर का प्रस्ताव तैयार',
    slug: 'haldwani-rudrapur-it-park-startup-incubation-proposal',
    summary: 'कुमाऊँ मंडल के युवाओं को स्थानीय स्तर पर रोजगार उपलब्ध कराने के लिए सिडकुल और आईटी विभाग की नई पहल।',
    category: 'बिजनेस',
    subcategory: 'कुमाऊँ अर्थतंत्र',
    author: 'रोहित बहुगुणा',
    authorRole: 'Senior Editor',
    publishedAt: '2026-11-11T16:30:00+05:30',
    updatedAt: '2026-11-11T17:00:00+05:30',
    views: 0,
    viewsFormatted: '—',
    status: 'draft',
    isBreaking: false,
    isFeatured: false,
    isTrending: false,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 76,
    focusKeyword: 'हल्द्वानी आईटी पार्क',
  },
  {
    id: 'sample-107',
    isSample: true,
    title: 'उत्तराखंड फिल्म नीति 2026: गढ़वाली-कुमाऊँनी फिल्मों और वेब सीरीज की शूटिंग पर 50% तक सब्सिडी',
    slug: 'uttarakhand-film-policy-subsidy-regional-cinema',
    summary: 'ऋषिकेश, नैनीताल और चोपता बने फिल्म निर्माताओं की पहली पसंद; स्थानीय कलाकारों को मिलेगा सीधा लाभ।',
    category: 'मनोरंजन',
    subcategory: 'सिनेमा',
    author: 'प्रिया नौटियाल',
    authorRole: 'Culture Desk',
    publishedAt: '2026-11-11T14:15:00+05:30',
    updatedAt: '2026-11-11T14:45:00+05:30',
    views: 31250,
    viewsFormatted: '31.3K',
    status: 'published',
    isBreaking: false,
    isFeatured: false,
    isTrending: false,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 87,
    focusKeyword: 'उत्तराखंड फिल्म नीति',
  },
  {
    id: 'sample-108',
    isSample: true,
    title: 'सोशल मीडिया पर वायरल अपुष्ट दावे की पड़ताल: फैक्ट-चेक में अधूरा पाया गया स्रोत',
    slug: 'unverified-viral-claim-fact-check-rejected-draft',
    summary: 'संपादकीय मानकों के तहत आधिकारिक पुष्टि न होने के कारण इस रिपोर्ट को पुनर्लेखन हेतु रोका गया।',
    category: 'देश',
    subcategory: 'फैक्ट चेक',
    author: 'आदित्य रावत',
    authorRole: 'Fact Check Desk',
    publishedAt: '2026-11-10T19:00:00+05:30',
    updatedAt: '2026-11-10T19:30:00+05:30',
    views: 0,
    viewsFormatted: '—',
    status: 'rejected',
    isBreaking: false,
    isFeatured: false,
    isTrending: false,
    thumbnailUrl: '/brand/logo-96.webp',
    editHref: '/admin/collections/articles/create',
    previewHref: '/',
    seoScore: 54,
    focusKeyword: 'फैक्ट चेक',
  },
]

export const SCHEDULED_PUBLISH_ITEMS: ScheduledPublishItem[] = [
  {
    id: 'sched-1',
    title: 'AI और डिजिटल पत्रकारिता: क्षेत्रीय भाषाओं में समाचार वितरण',
    category: 'टेक्नोलॉजी',
    scheduledTime: 'Today, 06:00 PM',
    scheduledDate: '2026-11-12',
    author: 'नेहा नेगी',
    status: 'in_progress',
    pastelBg: '#EBE8FD',
    accentColor: '#6C5CE7',
    editHref: '/admin/collections/articles/create',
  },
  {
    id: 'sched-2',
    title: 'कुमाऊँ महोत्सव 2026: लोक संस्कृति और पारंपरिक शिल्प की झलक',
    category: 'मनोरंजन',
    scheduledTime: '13 Nov, 08:30 AM',
    scheduledDate: '2026-11-13',
    author: 'प्रिया नौटियाल',
    status: 'scheduled',
    pastelBg: '#ECF8C5',
    accentColor: '#4D7C0F',
    editHref: '/admin/collections/articles/create',
  },
  {
    id: 'sched-3',
    title: 'उत्तराखंड बजट विशेष: पर्वतीय कृषि और बागवानी के लिए नया पैकेज',
    category: 'बिजनेस',
    scheduledTime: '15 Nov, 09:00 AM',
    scheduledDate: '2026-11-15',
    author: 'रोहित बहुगुणा',
    status: 'upcoming',
    pastelBg: '#FDECE4',
    accentColor: '#D97706',
    editHref: '/admin/collections/articles/create',
  },
  {
    id: 'sched-4',
    title: 'रणजी ट्रॉफी: उत्तराखंड बनाम दिल्ली मुकाबले का पूरा विश्लेषण',
    category: 'खेल',
    scheduledTime: '18 Nov, 07:00 AM',
    scheduledDate: '2026-11-18',
    author: 'आदित्य रावत',
    status: 'upcoming',
    pastelBg: '#E3F2FD',
    accentColor: '#0284C7',
    editHref: '/admin/collections/articles/create',
  },
]

export const PENDING_TASKS: PendingTaskItem[] = [
  {
    id: 'task-approval',
    title: 'Articles awaiting approval',
    subtitle: 'Editorial desk review queue',
    count: 8,
    priority: 'high',
    href: '/admin/collections/articles?status=pending_review',
    pastelBg: '#FDECE4',
    iconName: 'file-check',
  },
  {
    id: 'task-comments',
    title: 'Comments awaiting moderation',
    subtitle: 'Reader comments flagged for check',
    count: 14,
    priority: 'medium',
    href: '/admin/comments',
    pastelBg: '#EBE8FD',
    iconName: 'message-square',
  },
  {
    id: 'task-seo',
    title: 'SEO issues detected',
    subtitle: 'Missing meta description or focus keyword',
    count: 3,
    priority: 'medium',
    href: '/admin/seo',
    pastelBg: '#ECF8C5',
    iconName: 'search-alert',
  },
  {
    id: 'task-media',
    title: 'Media awaiting review',
    subtitle: 'Verify Hindi alt-text & photo credits',
    count: 5,
    priority: 'low',
    href: '/admin/collections/media',
    pastelBg: '#E3F2FD',
    iconName: 'image',
  },
]

export const SAMPLE_COMMENTS: ModerationCommentItem[] = [
  {
    id: 'c-1',
    articleTitle: 'देहरादून-दिल्ली एक्सप्रेसवे का अंतिम चरण पूरा, अब मात्र 2.5 घंटे में तय होगा सफर',
    readerName: 'विकास खंडूरी',
    readerLocation: 'देहरादून',
    comment: 'यह उत्तराखंड के पर्यटन और व्यापार दोनों के लिए ऐतिहासिक कदम है। ट्रैफिक प्रबंधन पर भी ध्यान देना होगा।',
    createdAt: '12 mins ago',
    status: 'pending',
  },
  {
    id: 'c-2',
    articleTitle: 'उत्तराखंड विधानसभा का शीतकालीन सत्र: भू-कानून और स्वरोजगार योजना पर विशेष चर्चा',
    readerName: 'कविता बिष्ट',
    readerLocation: 'अल्मोड़ा',
    comment: 'पहाड़ के युवाओं के लिए रोजगार और भूमि संरक्षण दोनों बेहद जरूरी विषय हैं।',
    createdAt: '38 mins ago',
    status: 'pending',
  },
  {
    id: 'c-3',
    articleTitle: 'बॉर्डर-गावस्कर ट्रॉफी: ऋषभ पंत की शानदार वापसी',
    readerName: 'अंकित सेमवाल',
    readerLocation: 'रुड़की',
    comment: 'ऋषभ पंत हमेशा बड़े मैचों के खिलाड़ी रहे हैं, पूरे उत्तराखंड को उन पर गर्व है!',
    createdAt: '1 hour ago',
    status: 'approved',
  },
  {
    id: 'c-4',
    articleTitle: 'हल्द्वानी और रुद्रपुर में नए आईटी पार्क व स्टार्टअप इनक्यूबेशन सेंटर का प्रस्ताव',
    readerName: 'PromoBot_99',
    readerLocation: 'Unknown',
    comment: 'Click here for cheap crypto loans and instant lottery rewards!!!',
    createdAt: '2 hours ago',
    status: 'spam',
    flaggedReason: 'Automated spam link filter',
  },
]

export const SAMPLE_AD_SLOTS: AdSlotConfigItem[] = [
  {
    id: 'ad-header',
    name: 'Top Leaderboard Banner',
    placement: 'Below Header (All Pages)',
    dimensions: '970×90 / 320×50 Mobile',
    status: 'active',
    impressions: '482.5K',
    ctr: '2.14%',
    revenue: '₹42,800',
    sponsor: 'Uttarakhand Tourism Board',
  },
  {
    id: 'ad-article-inline',
    name: 'In-Article Native Slot',
    placement: 'Inside Article Body (After Paragraph 3)',
    dimensions: '728×90 / 300×250',
    status: 'active',
    impressions: '618.2K',
    ctr: '2.86%',
    revenue: '₹64,200',
    sponsor: 'Google AdSense Auto / Direct',
  },
  {
    id: 'ad-sidebar',
    name: 'Desktop Sticky Sidebar',
    placement: 'Right Rail (Article & Category Pages)',
    dimensions: '300×600 Half Page',
    status: 'active',
    impressions: '295.0K',
    ctr: '1.92%',
    revenue: '₹31,400',
    sponsor: 'Graphic Era University',
  },
  {
    id: 'ad-feed',
    name: 'Category Feed Interstitial',
    placement: 'Every 6 Cards in Listing Feed',
    dimensions: 'Responsive Card',
    status: 'scheduled',
    impressions: '140.8K',
    ctr: '1.65%',
    revenue: '₹18,500',
    sponsor: 'Himalayan Organic Honey',
  },
]

export const SAMPLE_SUBCATEGORIES: SubcategoryItem[] = [
  { id: 'sub-1', name: 'गढ़वाल मंडल (Garhwal)', slug: 'garhwal', parentCategory: 'प्रदेश', articleCount: 184, status: 'active' },
  { id: 'sub-2', name: 'कुमाऊँ मंडल (Kumaon)', slug: 'kumaon', parentCategory: 'प्रदेश', articleCount: 158, status: 'active' },
  { id: 'sub-3', name: 'चारधाम यात्रा (Chardham)', slug: 'chardham', parentCategory: 'समाज', articleCount: 96, status: 'active' },
  { id: 'sub-4', name: 'विधानसभा व चुनाव (Assembly)', slug: 'assembly-elections', parentCategory: 'राजनीति', articleCount: 142, status: 'active' },
  { id: 'sub-5', name: 'क्रिकेट (Cricket)', slug: 'cricket', parentCategory: 'खेल', articleCount: 118, status: 'active' },
  { id: 'sub-6', name: 'बॉलीवुड व क्षेत्रीय सिनेमा', slug: 'cinema', parentCategory: 'मनोरंजन', articleCount: 89, status: 'active' },
  { id: 'sub-7', name: 'AI और गैजेट्स (AI & Gadgets)', slug: 'ai-gadgets', parentCategory: 'टेक्नोलॉजी', articleCount: 74, status: 'active' },
  { id: 'sub-8', name: 'स्टार्टअप व स्वरोजगार', slug: 'startups-economy', parentCategory: 'बिजनेस', articleCount: 68, status: 'active' },
]

export const INITIAL_NOTIFICATIONS: AdminNotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Breaking Story Active',
    detail: 'देहरादून-दिल्ली एक्सप्रेसवे स्टोरी पर 68K+ व्यूज़ पार हुए।',
    timeAgo: '5m ago',
    type: 'breaking',
    unread: true,
    href: '/admin/breaking-news',
  },
  {
    id: 'notif-2',
    title: '8 Articles Awaiting Approval',
    detail: 'संदीप जोशी और टीम ने नई रिपोर्ट्स रिव्यू के लिए भेजी हैं।',
    timeAgo: '22m ago',
    type: 'review',
    unread: true,
    href: '/admin/collections/articles?status=pending_review',
  },
  {
    id: 'notif-3',
    title: '14 New Reader Comments',
    detail: 'मॉडरेशन क्यू में नए पाठकों की टिप्पणियाँ उपलब्ध हैं।',
    timeAgo: '1h ago',
    type: 'comment',
    unread: true,
    href: '/admin/comments',
  },
  {
    id: 'notif-4',
    title: 'Scheduled Publish at 6:00 PM',
    detail: 'AI और डिजिटल पत्रकारिता विशेष लेख शाम 6 बजे लाइव होगा।',
    timeAgo: '2h ago',
    type: 'schedule',
    unread: false,
    href: '/admin/scheduled-news',
  },
]

