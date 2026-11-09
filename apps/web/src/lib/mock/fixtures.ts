/**
 * Mock content for building the site before the real data helpers exist.
 * Real LokLens headlines are used where provided; everything else is a clearly bracketed placeholder.
 * Images point at local placeholder files in /public/mock (no external hosts).
 */
import type {
  Article,
  ArticleCard,
  Author,
  AuthorRef,
  Category,
  CategoryRef,
  EPaper,
  Image,
  Page,
  RichTextNode,
  SiteSettings,
  TagRef,
  Video,
} from '@/lib/data/types'

// ---- helpers --------------------------------------------------------------------------------------

/** ISO 8601 with IST offset, as the contract serialiser produces. */
export function toIST(date: Date): string {
  const shifted = new Date(date.getTime() + 330 * 60_000)
  return shifted.toISOString().replace(/\.\d{3}Z$/, '+05:30')
}

const BASE_TIME = new Date('2026-11-09T10:00:00Z').getTime() // 15:30 IST
const hoursAgo = (h: number) => toIST(new Date(BASE_TIME - h * 3_600_000))

export function placeholderImage(alt: string, caption?: string): Image {
  return {
    url: '/mock/ph-1200x675.webp',
    alt,
    width: 1200,
    height: 675,
    caption,
    isFallback: true,
    sizes: {
      thumb: { url: '/mock/ph-320x180.webp', width: 320, height: 180 },
      card: { url: '/mock/ph-640x360.webp', width: 640, height: 360 },
      article: { url: '/mock/ph-1200x675.webp', width: 1200, height: 675 },
      og: { url: '/mock/ph-1200x630.webp', width: 1200, height: 630 },
      wide: { url: '/mock/ph-1200x675.webp', width: 1200, height: 675 },
      standard: { url: '/mock/ph-1200x900.webp', width: 1200, height: 900 },
      square: { url: '/mock/ph-1200x1200.webp', width: 1200, height: 1200 },
    },
  }
}

export const logoImage: Image = {
  url: '/brand/logo-square-1024.jpg',
  alt: 'लोक Lens न्यूज़ का लोगो',
  width: 1024,
  height: 1024,
  isFallback: false,
  sizes: {
    thumb: { url: '/brand/logo-96.webp', width: 96, height: 96 },
    card: { url: '/brand/logo-144.webp', width: 144, height: 144 },
    square: { url: '/brand/logo-square-1024.jpg', width: 1024, height: 1024 },
  },
}

// ---- categories (architecture §2 "Categories at launch") -----------------------------------------

const cat = (id: number, name: string, slug: string, order: number): Category => ({
  id,
  name,
  slug,
  order,
  description: `[${name} श्रेणी का विवरण]`,
  seo: { title: `${name} समाचार`, description: `[${name} श्रेणी का SEO विवरण]` },
})

export const categories: Category[] = [
  cat(1, 'प्रदेश', 'pradesh', 1),
  cat(2, 'देश', 'desh', 2),
  cat(3, 'राजनीति', 'rajniti', 3),
  cat(4, 'समाज', 'samaj', 4),
  cat(5, 'खेल', 'khel', 5),
  cat(6, 'दुनिया', 'duniya', 6),
  cat(7, 'विचार', 'vichar', 7),
]

const ref = (slug: string): CategoryRef => {
  const c = categories.find((x) => x.slug === slug)!
  return { id: c.id, name: c.name, slug: c.slug }
}

// ---- tags, authors -------------------------------------------------------------------------------

export const tags: TagRef[] = [
  { id: 1, name: 'पुष्कर सिंह धामी', slug: 'pushkar-singh-dhami' },
  { id: 2, name: 'हल्द्वानी', slug: 'haldwani' },
  { id: 3, name: 'गैरसैंण', slug: 'gairsain' },
  { id: 4, name: 'रानीखेत', slug: 'ranikhet' },
  { id: 5, name: 'कांग्रेस', slug: 'congress' },
  { id: 6, name: 'नैनीताल', slug: 'nainital' },
]
const tag = (slug: string) => tags.find((t) => t.slug === slug)!

export const ORG_BYLINE: AuthorRef = { kind: 'organization', name: 'LokLens News Team', slug: null }

export const authors: Author[] = [
  {
    kind: 'person',
    name: '[संवाददाता का नाम]',
    slug: 'samvaddata',
    bio: '[संवाददाता का परिचय — संपादक द्वारा जोड़ा जाएगा]',
  },
]

// ---- articles ------------------------------------------------------------------------------------

interface Seed {
  title: string
  slug: string
  category: string
  tags?: string[]
  author?: string
  isBreaking?: boolean
  isTrending?: boolean
  isFeatured?: boolean
}

const REAL: Seed[] = [
  {
    title: 'मुख्यमंत्री पुष्कर सिंह धामी ने हल्द्वानी में व्यापारियों एवं उद्योग प्रतिनिधियों के साथ किया संवाद',
    slug: 'cm-dhami-haldwani-vyapari-udyog-samvad',
    category: 'pradesh',
    tags: ['pushkar-singh-dhami', 'haldwani'],
    isFeatured: true,
    isTrending: true,
    isBreaking: true,
  },
  {
    title: 'गैरसैंण में CM धामी ने 231.91 करोड़ की 12 योजनाओं का किया लोकार्पण-शिलान्यास',
    slug: 'gairsain-cm-dhami-231-crore-yojana-lokarpan',
    category: 'pradesh',
    tags: ['pushkar-singh-dhami', 'gairsain'],
    isFeatured: true,
    isTrending: true,
  },
  {
    title: 'रानीखेत में युवा कांग्रेस की बैठक, नई नियुक्तियां घोषित',
    slug: 'ranikhet-yuva-congress-baithak-niyuktiyan',
    category: 'rajniti',
    tags: ['ranikhet', 'congress'],
    author: 'samvaddata',
    isFeatured: true,
    isTrending: true,
  },
  {
    title: 'मंच के कथित शुद्धिकरण को लेकर रानीखेत कांग्रेस मुखर, पुलिस से FIR दर्ज करने की मांग',
    slug: 'ranikhet-congress-manch-shuddhikaran-fir-mang',
    category: 'rajniti',
    tags: ['ranikhet', 'congress'],
    author: 'samvaddata',
    isTrending: true,
  },
  {
    title: 'रानीखेत के गांधी चौक पर कांग्रेस ने उठाई ‘वोट बचाओ–देश बचाओ’ की आवाज',
    slug: 'ranikhet-gandhi-chowk-congress-vote-bachao',
    category: 'rajniti',
    tags: ['ranikhet', 'congress'],
    author: 'samvaddata',
    isTrending: true,
  },
  {
    title: 'Rudraa Housing ने Nainital में मनाई 6वीं Anniversary',
    slug: 'rudraa-housing-nainital-6th-anniversary',
    category: 'samaj',
    tags: ['nainital'],
    isTrending: true,
  },
]

// Placeholders: enough per category for section blocks; pradesh gets enough for 3 listing pages.
const PLACEHOLDER_COUNTS: Record<string, number> = {
  pradesh: 26,
  desh: 6,
  rajniti: 4,
  samaj: 5,
  khel: 6,
  duniya: 6,
  vichar: 4,
}

const seeds: Seed[] = [...REAL]
for (const [slug, count] of Object.entries(PLACEHOLDER_COUNTS)) {
  const name = ref(slug).name
  for (let i = 1; i <= count; i++) {
    seeds.push({ title: `[${name} श्रेणी की खबर ${i}]`, slug: `${slug}-placeholder-${i}`, category: slug })
  }
}

// Interleave so the latest feed mixes categories: real headlines first, then placeholders round-robin.
const ordered: Seed[] = [...REAL]
const pools = Object.keys(PLACEHOLDER_COUNTS).map((c) => seeds.filter((s) => s.category === c && !REAL.includes(s)))
while (pools.some((p) => p.length)) for (const p of pools) if (p.length) ordered.push(p.shift()!)

function buildBody(seed: Seed, related?: ArticleCard): RichTextNode[] {
  const p = (text: string): RichTextNode => ({ type: 'paragraph', children: [{ type: 'text', text, format: 0 }] })
  const nodes: RichTextNode[] = [
    p('[खबर का पहला अनुच्छेद — असली सामग्री संपादक द्वारा CMS में जोड़ी जाएगी।]'),
    {
      type: 'paragraph',
      children: [
        { type: 'text', text: '[दूसरा अनुच्छेद, जिसमें ', format: 0 },
        { type: 'text', text: 'बोल्ड', format: 1 },
        { type: 'text', text: ', ', format: 0 },
        { type: 'text', text: 'इटैलिक', format: 2 },
        { type: 'text', text: ' और ', format: 0 },
        {
          type: 'link',
          fields: { url: 'https://uk.gov.in', newTab: true, linkType: 'custom' },
          children: [{ type: 'text', text: 'बाहरी लिंक', format: 0 }],
        },
        { type: 'text', text: ' का उदाहरण है। यह लिंक हटाया जाएगा: ', format: 0 },
        {
          type: 'link',
          fields: { url: 'javascript:alert(1)', linkType: 'custom' },
          children: [{ type: 'text', text: 'असुरक्षित लिंक (केवल टेक्स्ट दिखेगा)', format: 0 }],
        },
        { type: 'text', text: '।]', format: 0 },
      ],
    },
    p('[तीसरा अनुच्छेद — इसके बाद लेख के बीच का विज्ञापन स्थान आरक्षित है (अभी बंद)।]'),
    { type: 'heading', tag: 'h2', children: [{ type: 'text', text: '[उपशीर्षक]', format: 0 }] },
    {
      type: 'list',
      listType: 'bullet',
      tag: 'ul',
      children: [
        { type: 'listitem', children: [{ type: 'text', text: '[मुख्य बिंदु 1]', format: 0 }] },
        { type: 'listitem', children: [{ type: 'text', text: '[मुख्य बिंदु 2]', format: 0 }] },
      ],
    },
    { type: 'quote', children: [{ type: 'text', text: '[किसी वक्ता का उद्धरण यहां आएगा]', format: 0 }] },
    { type: 'upload', value: placeholderImage('[लेख के भीतर की तस्वीर]', '[तस्वीर का कैप्शन]') },
    { type: 'block', fields: { blockType: 'embed', provider: 'youtube', url: 'https://www.youtube.com/watch?v=M0CK0000001' } },
    { type: 'table', children: [] }, // unknown node: renderer must skip it
    p('[अंतिम अनुच्छेद।]'),
  ]
  if (related) nodes.splice(6, 0, { type: 'block', fields: { blockType: 'relatedArticle', article: related } })
  if (seed.category === 'vichar') nodes.splice(1, 0, p('[विचार लेखक की राय]'))
  return nodes
}

export const articles: Article[] = ordered.map((seed, i) => {
  const id = 142 + ordered.length - i // newest first gets the highest id
  const category = ref(seed.category)
  const publishedAt = hoursAgo(i * 1.5 + 0.25)
  const author = seed.author ? authors.find((a) => a.slug === seed.author) : undefined
  const isReal = REAL.includes(seed)
  const image = placeholderImage(isReal ? seed.title : `[${category.name} खबर की तस्वीर]`, '[तस्वीर का कैप्शन]')
  return {
    id,
    title: seed.title,
    slug: seed.slug,
    url: `/${category.slug}/${seed.slug}-${id}`,
    summary: isReal ? '[खबर का सारांश — संपादक द्वारा जोड़ा जाएगा]' : `[${category.name} खबर का सारांश]`,
    image,
    category,
    publishedAt,
    updatedAt: i === 0 ? hoursAgo(0) : publishedAt,
    isBreaking: Boolean(seed.isBreaking),
    isTrending: Boolean(seed.isTrending),
    isFeatured: Boolean(seed.isFeatured),
    body: [],
    tags: (seed.tags ?? []).map(tag),
    authors: author ? [{ kind: author.kind, name: author.name, slug: author.slug }] : [ORG_BYLINE],
    seo: { title: seed.title, description: '[SEO विवरण]', image, noindex: false },
    related: [],
  }
})

export function toCard(a: Article): ArticleCard {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    url: a.url,
    summary: a.summary,
    image: a.image,
    category: a.category,
    location: a.location,
    publishedAt: a.publishedAt,
    updatedAt: a.updatedAt,
    isBreaking: a.isBreaking,
    isTrending: a.isTrending,
    isFeatured: a.isFeatured,
  }
}

for (const a of articles) {
  const sameTag = articles.filter((b) => b.id !== a.id && b.tags.some((t) => a.tags.some((x) => x.id === t.id)))
  const sameCat = articles.filter((b) => b.id !== a.id && b.category.id === a.category.id && !sameTag.includes(b))
  a.related = [...sameTag, ...sameCat].slice(0, 6).map(toCard)
  a.body = buildBody({ title: a.title, slug: a.slug, category: a.category.slug }, a.related[0])
}

// ---- videos --------------------------------------------------------------------------------------

export const videos: Video[] = [1, 2, 3, 4].map((n) => ({
  id: n,
  title: `[वीडियो शीर्षक ${n}]`,
  slug: `video-placeholder-${n}`,
  url: `/video/video-placeholder-${n}`,
  youtubeId: `M0CK000000${n}`,
  thumbnail: placeholderImage(`[वीडियो ${n} की तस्वीर]`),
  category: ref('pradesh'),
  publishedAt: hoursAgo(n * 5),
}))

// ---- static pages --------------------------------------------------------------------------------

const STATIC_PAGES: [string, string][] = [
  ['about', 'हमारे बारे में'],
  ['contact', 'संपर्क करें'],
  ['advertise', 'विज्ञापन दें'],
  ['privacy-policy', 'गोपनीयता नीति'],
  ['terms', 'नियम व शर्तें'],
  ['editorial-policy', 'संपादकीय नीति'],
  ['corrections-policy', 'सुधार नीति'],
  ['disclaimer', 'अस्वीकरण'],
]

export const pages: Page[] = STATIC_PAGES.map(([slug, title]) => ({
  slug,
  title,
  updatedAt: hoursAgo(72),
  body: [
    { type: 'paragraph', children: [{ type: 'text', text: `[${title} — सामग्री संपादक द्वारा CMS में जोड़ी जाएगी।]` }] },
    { type: 'heading', tag: 'h2', children: [{ type: 'text', text: '[उपशीर्षक]' }] },
    { type: 'paragraph', children: [{ type: 'text', text: '[अनुच्छेद]' }] },
  ],
}))

// ---- site settings -------------------------------------------------------------------------------

export const siteSettings: SiteSettings = {
  name: 'लोक Lens न्यूज़',
  tagline: 'आपकी आवाज़, आपकी खबर',
  logo: logoImage,
  defaultImage: placeholderImage('लोक Lens न्यूज़'),
  social: [
    { platform: 'whatsapp', url: 'https://whatsapp.com/channel/PLACEHOLDER' },
    { platform: 'youtube', url: 'https://www.youtube.com/@loklensnews' },
    { platform: 'facebook', url: 'https://www.facebook.com/people/LokLens-Samachar/61584754019161/' },
    { platform: 'instagram', url: 'https://www.instagram.com/loklens_news' },
  ],
  contact: { email: '[ईमेल पता]' },
  policies: {
    about: '/about',
    contact: '/contact',
    privacy: '/privacy-policy',
    terms: '/terms',
    editorial: '/editorial-policy',
    corrections: '/corrections-policy',
    disclaimer: '/disclaimer',
  },
  navigation: {
    header: categories.map((c) => ({ label: c.name, url: `/${c.slug}` })),
    footer: [
      {
        title: 'लोक Lens',
        items: [
          { label: 'हमारे बारे में', url: '/about' },
          { label: 'संपर्क करें', url: '/contact' },
          { label: 'विज्ञापन दें', url: '/advertise' },
          { label: 'वीडियो', url: '/video' },
          { label: 'ई-पेपर', url: '/e-paper' },
        ],
      },
    ],
  },
}

// ---- e-paper -------------------------------------------------------------------------------------

// Four editions with a gap (11-06 missing) so previous/next skips correctly. One shared sample PDF.
export const ePapers: EPaper[] = ['2026-11-09', '2026-11-08', '2026-11-07', '2026-11-05'].map((date) => ({
  date,
  edition: 'उत्तराखंड संस्करण',
  pdfUrl: '/mock/epaper-sample.pdf',
}))
