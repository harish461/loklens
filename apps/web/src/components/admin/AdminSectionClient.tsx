'use client'

import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import styles from './articlesAdmin.module.css'
import {
  type AdminArticleItem,
  CATEGORY_PERFORMANCE,
  type ModerationCommentItem,
  SAMPLE_AD_SLOTS,
  SAMPLE_COMMENTS,
  SAMPLE_SUBCATEGORIES,
  TRAFFIC_SERIES,
} from './mock-cms-data'

export type SectionRouteKey =
  | 'subcategories'
  | 'authors'
  | 'breaking-news'
  | 'comments'
  | 'advertisements'
  | 'seo'
  | 'analytics'

export interface AdminSectionClientProps {
  section: SectionRouteKey
  articles: AdminArticleItem[]
  categories: { id: number; name: string; slug: string }[]
  authors: { id: number; name: string; role: string; email?: string }[]
  locations: { id: number; name: string; slug: string }[]
}

export function AdminSectionClient({
  section,
  articles: initialArticles,
  categories,
  authors,
}: AdminSectionClientProps) {
  const [articles, setArticles] = useState<AdminArticleItem[]>(initialArticles)
  const [comments, setComments] = useState<ModerationCommentItem[]>(SAMPLE_COMMENTS)
  const [commentFilter, setCommentFilter] = useState<'all' | 'pending' | 'approved' | 'spam'>('all')
  const [subcategories, setSubcategories] = useState(SAMPLE_SUBCATEGORIES)
  const [newSubName, setNewSubName] = useState('')
  const [newSubParent, setNewSubParent] = useState(categories[0]?.name || 'प्रदेश')
  const [adSlots, setAdSlots] = useState(SAMPLE_AD_SLOTS)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // Global Site SEO Settings state (Admin > Settings > SEO)
  const [savingSeo, setSavingSeo] = useState(false)
  const [uploadingOg, setUploadingOg] = useState(false)
  const [titleSuffix, setTitleSuffix] = useState('| लोक Lens न्यूज़')
  const [homeMetaTitle, setHomeMetaTitle] = useState(
    'लोक Lens न्यूज़ — उत्तराखंड और देश की ताज़ा हिंदी खबरें | आपकी आवाज़, आपकी खबर',
  )
  const [homeMetaDescription, setHomeMetaDescription] = useState(
    'लोक Lens न्यूज़ (LokLens News) पर पढ़ें उत्तराखंड, देश, राजनीति, समाज, खेल और दुनिया की ताज़ा, निष्पक्ष और विश्वसनीय हिंदी खबरें।',
  )
  const [defaultOgImageUrl, setDefaultOgImageUrl] = useState('/brand/logo-square-1024.jpg')
  const [defaultOgImageId, setDefaultOgImageId] = useState<number | null>(null)
  const [googleSiteVerification, setGoogleSiteVerification] = useState('')
  const [categorySeo, setCategorySeo] = useState<
    Record<string, { metaTitle: string; metaDescription: string }>
  >({
    pradesh: {
      metaTitle: 'उत्तराखंड प्रदेश समाचार (Uttarakhand News in Hindi) — ताज़ा खबरें',
      metaDescription:
        'उत्तराखंड के सभी 13 जिलों (अल्मोड़ा, रानीखेत, देहरादून, नैनीताल, हल्द्वानी, हरिद्वार, गैरसैंण) की ताज़ा और विश्वसनीय हिंदी खबरें।',
    },
    desh: {
      metaTitle: 'देश समाचार (National News in Hindi) — भारत की ताज़ा खबरें',
      metaDescription:
        'भारत की प्रमुख राष्ट्रीय खबरें, संसद, केंद्र सरकार की योजनाएं, आर्थिक सुधार और देश भर के ताज़ा समाचार हिंदी में।',
    },
    rajniti: {
      metaTitle: 'राजनीति समाचार (Politics News in Hindi) — सियासी विश्लेषण व चुनाव खबरें',
      metaDescription:
        'उत्तराखंड और देश की राजनीति, विधानसभा व लोकसभा सत्र, राजनीतिक दलों के बयान और चुनावी हलचल की सटीक रिपोर्टिंग।',
    },
    samaj: {
      metaTitle: 'समाज एवं जनसरोकार (Society & Community News in Hindi)',
      metaDescription:
        'जनसरोकार, संस्कृति, शिक्षा, स्वास्थ्य, पर्यावरण और सामाजिक मुद्दों से जुड़ी जमीनी खबरें व विशेष रिपोर्ट।',
    },
    khel: {
      metaTitle: 'खेल समाचार (Sports News in Hindi) — क्रिकेट व खेल जगत की खबरें',
      metaDescription:
        'क्रिकेट, फुटबॉल, ओलंपिक और उत्तराखंड के स्थानीय खेल टूर्नामेंटों की ताज़ा खबरें, स्कोर और खिलाड़ियों की उपलब्धियां।',
    },
    duniya: {
      metaTitle: 'दुनिया समाचार (World & International News in Hindi)',
      metaDescription:
        'अंतरराष्ट्रीय खबरें, विदेश नीति, वैश्विक अर्थव्यवस्था और दुनिया भर की प्रमुख घटनाओं का हिंदी समाचार विश्लेषण।',
    },
    vichar: {
      metaTitle: 'विचार एवं संपादकीय (Opinion & Editorial in Hindi)',
      metaDescription:
        'समसामयिक मुद्दों पर वरिष्ठ पत्रकारों व विशेषज्ञों के लेख, संपादकीय दृष्टिकोण और गहन विश्लेषण।',
    },
  })

  useEffect(() => {
    if (section !== 'seo') return
    fetch('/api/admin/seo-settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { ok?: boolean; settings?: Record<string, unknown> }) => {
        if (!data?.ok || !data.settings) return
        const s = data.settings
        if (typeof s.titleSuffix === 'string') setTitleSuffix(s.titleSuffix)
        if (typeof s.homeMetaTitle === 'string') setHomeMetaTitle(s.homeMetaTitle)
        if (typeof s.homeMetaDescription === 'string') setHomeMetaDescription(s.homeMetaDescription)
        if (typeof s.defaultOgImageUrl === 'string') setDefaultOgImageUrl(s.defaultOgImageUrl)
        if (typeof s.defaultOgImageId === 'number') setDefaultOgImageId(s.defaultOgImageId)
        if (typeof s.googleSiteVerification === 'string')
          setGoogleSiteVerification(s.googleSiteVerification)
        if (s.categories && typeof s.categories === 'object') {
          setCategorySeo((prev) => ({
            ...prev,
            ...(s.categories as Record<string, { metaTitle: string; metaDescription: string }>),
          }))
        }
      })
      .catch(() => null)
  }, [section])

  async function handleSaveGlobalSeo() {
    setSavingSeo(true)
    try {
      const res = await fetch('/api/admin/seo-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          titleSuffix,
          homeMetaTitle,
          homeMetaDescription,
          defaultOgImageUrl,
          defaultOgImageId,
          googleSiteVerification,
          categories: categorySeo,
        }),
      })
      if (res.ok) {
        notify('Global & Category SEO settings saved!')
      } else {
        notify('Failed to save SEO settings.')
      }
    } catch {
      notify('Could not reach server to save SEO settings.')
    } finally {
      setSavingSeo(false)
    }
  }

  async function handleUploadDefaultOg(file: File) {
    setUploadingOg(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('_payload', JSON.stringify({ alt: 'लोक Lens न्यूज़ — Default Social Share Image' }))
      const res = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (res.ok) {
        const body = (await res.json()) as { doc?: { id: number; url?: string } }
        if (body.doc?.id) {
          setDefaultOgImageId(body.doc.id)
          if (body.doc.url) setDefaultOgImageUrl(body.doc.url)
          notify('Default OG Image uploaded!')
        }
      } else {
        notify('Failed to upload OG image.')
      }
    } catch {
      notify('Could not upload OG image.')
    } finally {
      setUploadingOg(false)
    }
  }

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  async function toggleBreakingOnArticle(item: AdminArticleItem) {
    const nextVal = !item.isBreaking
    if (item.dbId) {
      const res = await fetch(`/api/articles/${item.dbId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isBreaking: nextVal }),
      }).catch(() => null)
      if (!res?.ok) {
        notify('Could not update Breaking News. Check permissions or connection.')
        return
      }
    }
    setArticles((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, isBreaking: nextVal } : a)),
    )
    notify(nextVal ? 'Breaking News activated' : 'Breaking News cleared')
  }

  // 1. SUBCATEGORIES VIEW
  if (section === 'subcategories') {
    return (
      <div className={styles.pageShell}>
        {toast && (
          <div className={styles.toast}>
            <Sparkles size={15} /> <span>{toast}</span>
          </div>
        )}
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon} style={{ background: '#ECF8C5', color: '#3F6212' }}>
              <Layers size={22} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>Subcategories &amp; Regional Desks</h1>
              <p className={styles.pageSubtitle}>
                Organize Hindi news into regional Uttarakhand mandals, districts and topic desks
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/collections/locations" className={styles.secondaryBtn}>
              Manage Districts (Locations)
            </Link>
            <Link href="/admin/collections/categories" className={styles.primaryLimeBtn}>
              Parent Categories
            </Link>
          </div>
        </header>

        <div className={styles.cardSurface} style={{ marginBottom: 18 }}>
          <h2 className={styles.editorCardTitle}>Create New Subcategory</h2>
          <div className={styles.slugRow}>
            <input
              type="text"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Subcategory Hindi / English name (e.g. नैनीताल विशेष)..."
              className={styles.textInput}
            />
            <select
              value={newSubParent}
              onChange={(e) => setNewSubParent(e.target.value)}
              className={styles.filterSelect}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value="प्रदेश">प्रदेश</option>
              <option value="राजनीति">राजनीति</option>
              <option value="खेल">खेल</option>
            </select>
            <button
              type="button"
              className={styles.primaryLimeBtn}
              onClick={() => {
                if (!newSubName.trim()) return
                setSubcategories((prev) => [
                  {
                    id: `sub-${Date.now()}`,
                    name: newSubName.trim(),
                    slug: newSubName.trim().toLowerCase().replace(/\s+/g, '-'),
                    parentCategory: newSubParent,
                    articleCount: 0,
                    status: 'active',
                  },
                  ...prev,
                ])
                setNewSubName('')
                notify('Subcategory added')
              }}
            >
              <Plus size={15} /> Add Subcategory
            </button>
          </div>
        </div>

        <div className={styles.cardSurface}>
          <div className={styles.tableWrap} style={{ display: 'block' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Subcategory Name</th>
                  <th>Slug</th>
                  <th>Parent Category</th>
                  <th>Articles</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subcategories.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className={styles.slugMono}>/{s.slug}</td>
                    <td>
                      <span className={styles.categoryChip}>{s.parentCategory}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.articleCount}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles.badgePublished}`}>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 2. AUTHORS / JOURNALISTS VIEW
  if (section === 'authors') {
    const displayAuthors = authors
    return (
      <div className={styles.pageShell}>
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon} style={{ background: '#E3F2FD', color: '#0369A1' }}>
              <UserCheck size={22} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>Authors / Journalists</h1>
              <p className={styles.pageSubtitle}>
                Newsroom reporters, bureau editors and columnists publishing on LokLens
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/collections/users/create" className={styles.primaryLimeBtn}>
              <Plus size={16} /> Add Journalist
            </Link>
          </div>
        </header>

        <div className={styles.cardSurface}>
          <div className={styles.tableWrap} style={{ display: 'block' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Journalist / Author</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th className={styles.rightAlign}>Manage</th>
                </tr>
              </thead>
              <tbody>
                {displayAuthors.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>
                      <span className={styles.categoryChip}>{u.role.toUpperCase()}</span>
                    </td>
                    <td className={styles.dateCol}>{u.email || '—'}</td>
                    <td className={styles.rightAlign}>
                      <Link
                        href={`/admin/collections/users/${u.id}`}
                        className={styles.actionBtn}
                      >
                        <Pencil size={13} /> Edit Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 3. BREAKING NEWS VIEW
  if (section === 'breaking-news') {
    const breakingList = articles.filter((a) =>
      search ? a.title.toLowerCase().includes(search.toLowerCase()) : true,
    )
    return (
      <div className={styles.pageShell}>
        {toast && (
          <div className={styles.toast}>
            <Sparkles size={15} /> <span>{toast}</span>
          </div>
        )}
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon} style={{ background: '#FEE2E2', color: '#B91C1C' }}>
              <Flame size={22} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>Breaking News Desk</h1>
              <p className={styles.pageSubtitle}>
                Manage live breaking news alerts and ticker stories (auto-expires after 6 hours)
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/globals/ticker" className={styles.secondaryBtn}>
              Configure Top Ticker
            </Link>
            <Link href="/admin/collections/articles/create" className={styles.primaryLimeBtn}>
              <Plus size={16} /> Post Breaking Story
            </Link>
          </div>
        </header>

        <div className={styles.cardSurface}>
          <div className={styles.filterToolbar}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search articles to toggle Breaking status..."
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className={styles.tableWrap} style={{ display: 'block' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hindi Headline</th>
                  <th>Category</th>
                  <th>Breaking Status</th>
                  <th className={styles.rightAlign}>Toggle Alert</th>
                </tr>
              </thead>
              <tbody>
                {breakingList.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={a.editHref} className={styles.articleTitleLink}>
                        {a.title}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.categoryChip}>{a.category}</span>
                    </td>
                    <td>
                      {a.isBreaking ? (
                        <span className={`${styles.statusBadge} ${styles.badgeRejected}`}>
                          LIVE BREAKING
                        </span>
                      ) : (
                        <span className={`${styles.statusBadge} ${styles.badgeDraft}`}>
                          Standard
                        </span>
                      )}
                    </td>
                    <td className={styles.rightAlign}>
                      <button
                        type="button"
                        onClick={() => toggleBreakingOnArticle(a)}
                        className={a.isBreaking ? styles.secondaryBtn : styles.primaryLimeBtn}
                        style={{ height: 32, padding: '0 12px', fontSize: 12 }}
                      >
                        <Flame size={14} />
                        <span>{a.isBreaking ? 'Turn Off Breaking' : 'Set as Breaking'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 4. COMMENTS & MODERATION VIEW
  if (section === 'comments') {
    const filteredComments = comments.filter((c) =>
      commentFilter === 'all' ? true : c.status === commentFilter,
    )
    return (
      <div className={styles.pageShell}>
        {toast && (
          <div className={styles.toast}>
            <Sparkles size={15} /> <span>{toast}</span>
          </div>
        )}
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon} style={{ background: '#EBE8FD', color: '#5B21B6' }}>
              <MessageSquare size={22} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>Comments &amp; Moderation</h1>
              <p className={styles.pageSubtitle}>
                Review reader discussions, approve constructive Hindi comments and block spam
              </p>
            </div>
          </div>
        </header>

        <div className={styles.statusTabsRow}>
          {(['all', 'pending', 'approved', 'spam'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setCommentFilter(st)}
              className={`${styles.statusTabPill} ${
                commentFilter === st ? styles.statusTabPillActive : ''
              }`}
            >
              <span>{st.toUpperCase()}</span>
            </button>
          ))}
        </div>

        <div className={styles.cardSurface}>
          <div className={styles.tableWrap} style={{ display: 'block' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Reader</th>
                  <th>Comment (Hindi / English)</th>
                  <th>Article</th>
                  <th>Status</th>
                  <th className={styles.rightAlign}>Moderation</th>
                </tr>
              </thead>
              <tbody>
                {filteredComments.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.readerName}</strong>
                      <div className={styles.slugMono}>{c.readerLocation} · {c.createdAt}</div>
                    </td>
                    <td style={{ maxWidth: 360 }}>{c.comment}</td>
                    <td style={{ maxWidth: 260, fontSize: 12.5 }}>{c.articleTitle}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          c.status === 'approved'
                            ? styles.badgePublished
                            : c.status === 'pending'
                              ? styles.badgePending
                              : styles.badgeRejected
                        }`}
                      >
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.rightAlign}>
                      <div className={styles.actionBtnGroup}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => {
                            setComments((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, status: 'approved' } : x)),
                            )
                            notify('Comment approved')
                          }}
                        >
                          <CheckCircle2 size={13} /> Approve
                        </button>
                        <button
                          type="button"
                          className={styles.actionIconBtn}
                          title="Mark Spam"
                          onClick={() => {
                            setComments((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, status: 'spam' } : x)),
                            )
                            notify('Marked as spam')
                          }}
                        >
                          <XCircle size={14} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionIconBtn} ${styles.deleteQuickBtn}`}
                          title="Delete"
                          onClick={() => {
                            setComments((prev) => prev.filter((x) => x.id !== c.id))
                            notify('Comment deleted')
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 6. ADVERTISEMENTS VIEW
  if (section === 'advertisements') {
    return (
      <div className={styles.pageShell}>
        {toast && (
          <div className={styles.toast}>
            <Sparkles size={15} /> <span>{toast}</span>
          </div>
        )}
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon} style={{ background: '#FDECE4', color: '#C2410C' }}>
              <Megaphone size={22} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>Advertisements &amp; AdSense Slots</h1>
              <p className={styles.pageSubtitle}>
                CLS-safe reserved ad placements across Header, Article Body, Desktop Sidebar &amp; Category Feeds
              </p>
            </div>
          </div>
        </header>

        <div className={styles.cardSurface}>
          <div className={styles.tableWrap} style={{ display: 'block' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ad Slot Name</th>
                  <th>Placement</th>
                  <th>Dimensions</th>
                  <th>Sponsor / Network</th>
                  <th>Impressions</th>
                  <th>Status</th>
                  <th className={styles.rightAlign}>Toggle</th>
                </tr>
              </thead>
              <tbody>
                {adSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td style={{ fontWeight: 600 }}>{slot.name}</td>
                    <td>{slot.placement}</td>
                    <td className={styles.slugMono}>{slot.dimensions}</td>
                    <td>{slot.sponsor}</td>
                    <td style={{ fontWeight: 600 }}>{slot.impressions} ({slot.ctr})</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          slot.status === 'active'
                            ? styles.badgePublished
                            : styles.badgeScheduled
                        }`}
                      >
                        {slot.status.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.rightAlign}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => {
                          setAdSlots((prev) =>
                            prev.map((s) =>
                              s.id === slot.id
                                ? { ...s, status: s.status === 'active' ? 'paused' : 'active' }
                                : s,
                            ),
                          )
                          notify(`Updated ${slot.name}`)
                        }}
                      >
                        {slot.status === 'active' ? 'Pause Slot' : 'Activate Slot'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 7. SEO MANAGEMENT VIEW (Global Site SEO Settings + Category SEO + Article SEO Audit)
  if (section === 'seo') {
    const seoCategoryList = [
      { slug: 'pradesh', label: 'प्रदेश (/pradesh)' },
      { slug: 'desh', label: 'देश (/desh)' },
      { slug: 'rajniti', label: 'राजनीति (/rajniti)' },
      { slug: 'samaj', label: 'समाज (/samaj)' },
      { slug: 'khel', label: 'खेल (/khel)' },
      { slug: 'duniya', label: 'दुनिया (/duniya)' },
      { slug: 'vichar', label: 'विचार (/vichar)' },
    ]

    return (
      <div className={styles.pageShell}>
        {toast && (
          <div className={styles.toast}>
            <Sparkles size={15} /> <span>{toast}</span>
          </div>
        )}
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.titleIcon} style={{ background: '#ECF8C5', color: '#3F6212' }}>
              <Globe size={22} />
            </div>
            <div>
              <h1 className={styles.pageTitle}>Global Site SEO &amp; News Sitemaps</h1>
              <p className={styles.pageSubtitle}>
                Homepage &amp; Category Meta Tags, Google Search Console Verification, NewsArticle JSON-LD &amp; Google News Sitemaps
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
              <ExternalLink size={14} /> /sitemap.xml
            </a>
            <a href="/news-sitemap.xml" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
              <ExternalLink size={14} /> /news-sitemap.xml
            </a>
            <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
              <ExternalLink size={14} /> /robots.txt
            </a>
            <Link href="/admin/collections/redirects" className={styles.secondaryBtn}>
              301 / 410 Redirects
            </Link>
            <button
              type="button"
              disabled={savingSeo}
              onClick={handleSaveGlobalSeo}
              className={styles.primaryLimeBtn}
            >
              <Save size={15} />
              <span>{savingSeo ? 'Saving SEO...' : 'Save SEO Settings'}</span>
            </button>
          </div>
        </header>

        {/* Card 1: Global Site SEO Settings */}
        <div className={styles.cardSurface} style={{ marginBottom: 18 }}>
          <h2 className={styles.editorCardTitle}>
            <span>Global Site SEO Defaults (Homepage, Suffix, OG Image &amp; Search Console)</span>
          </h2>

          <div className={styles.twoColFields}>
            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="global-title-suffix" className={styles.fieldLabel}>
                  Default Site Title Suffix
                </label>
                <span className={styles.fieldHint}>Appended to inner pages (%s | लोक Lens न्यूज़)</span>
              </div>
              <input
                id="global-title-suffix"
                type="text"
                maxLength={50}
                value={titleSuffix}
                onChange={(e) => setTitleSuffix(e.target.value)}
                placeholder="| लोक Lens न्यूज़"
                className={styles.textInput}
              />
            </div>

            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="global-gsc-verify" className={styles.fieldLabel}>
                  Google Search Console Verification Meta Tag
                </label>
                <span className={styles.fieldHint}>google-site-verification content code</span>
              </div>
              <input
                id="global-gsc-verify"
                type="text"
                maxLength={120}
                value={googleSiteVerification}
                onChange={(e) => setGoogleSiteVerification(e.target.value)}
                placeholder="Paste Google Search Console verification code..."
                className={styles.textInput}
              />
            </div>
          </div>

          <div className={styles.fieldBlock} style={{ marginTop: 12 }}>
            <div className={styles.fieldLabelRow}>
              <label htmlFor="global-home-title" className={styles.fieldLabel}>
                Homepage Meta Title
              </label>
              <span className={styles.fieldHint}>
                {homeMetaTitle.length} chars (recommended 50–65)
              </span>
            </div>
            <input
              id="global-home-title"
              type="text"
              maxLength={110}
              value={homeMetaTitle}
              onChange={(e) => setHomeMetaTitle(e.target.value)}
              className={styles.textInput}
            />
          </div>

          <div className={styles.fieldBlock} style={{ marginTop: 12 }}>
            <div className={styles.fieldLabelRow}>
              <label htmlFor="global-home-desc" className={styles.fieldLabel}>
                Homepage Meta Description
              </label>
              <span className={styles.fieldHint}>
                {homeMetaDescription.length} chars (recommended 140–160)
              </span>
            </div>
            <textarea
              id="global-home-desc"
              rows={2}
              maxLength={220}
              value={homeMetaDescription}
              onChange={(e) => setHomeMetaDescription(e.target.value)}
              className={styles.textareaInput}
            />
          </div>

          <div className={styles.fieldBlock} style={{ marginTop: 12 }}>
            <label htmlFor="global-og-image" className={styles.fieldLabel}>
              Default Open Graph / WhatsApp Image (1200×630)
            </label>
            <div className={styles.slugRow}>
              <input
                id="global-og-image"
                type="text"
                value={defaultOgImageUrl}
                onChange={(e) => setDefaultOgImageUrl(e.target.value)}
                placeholder="/brand/logo-square-1024.jpg"
                className={styles.textInput}
              />
              <label className={styles.secondaryBtn} style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>{uploadingOg ? 'Uploading...' : 'Upload Default OG'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUploadDefaultOg(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Card 2: Category-Level Meta Titles & Descriptions */}
        <div className={styles.cardSurface} style={{ marginBottom: 18 }}>
          <div className={styles.editorCardTitle}>
            <span>Category-Level Meta Titles &amp; Descriptions (/pradesh, /desh, /rajniti, /samaj, /khel, /duniya, /vichar)</span>
            <button
              type="button"
              disabled={savingSeo}
              onClick={handleSaveGlobalSeo}
              className={styles.primaryLimeBtn}
            >
              <Save size={14} />
              <span>{savingSeo ? 'Saving...' : 'Save All Categories'}</span>
            </button>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {seoCategoryList.map((cat) => {
              const entry = categorySeo[cat.slug] ?? { metaTitle: '', metaDescription: '' }
              return (
                <div
                  key={cat.slug}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    background: '#FAFAFC',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ fontSize: 14, color: '#111827' }}>{cat.label}</strong>
                    <span className={styles.slugMono}>https://loklensnews.com/{cat.slug}</span>
                  </div>
                  <div className={styles.twoColFields}>
                    <div className={styles.fieldBlock}>
                      <div className={styles.fieldLabelRow}>
                        <label className={styles.fieldLabel}>Meta Title</label>
                        <span className={styles.fieldHint}>{entry.metaTitle.length} chars</span>
                      </div>
                      <input
                        type="text"
                        maxLength={90}
                        value={entry.metaTitle}
                        onChange={(e) =>
                          setCategorySeo((prev) => ({
                            ...prev,
                            [cat.slug]: {
                              ...entry,
                              metaTitle: e.target.value,
                            },
                          }))
                        }
                        className={styles.textInput}
                      />
                    </div>
                    <div className={styles.fieldBlock}>
                      <div className={styles.fieldLabelRow}>
                        <label className={styles.fieldLabel}>Meta Description</label>
                        <span className={styles.fieldHint}>{entry.metaDescription.length} chars</span>
                      </div>
                      <input
                        type="text"
                        maxLength={200}
                        value={entry.metaDescription}
                        onChange={(e) =>
                          setCategorySeo((prev) => ({
                            ...prev,
                            [cat.slug]: {
                              ...entry,
                              metaDescription: e.target.value,
                            },
                          }))
                        }
                        className={styles.textInput}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Card 3: Article SEO Readiness Audit */}
        <div className={styles.cardSurface}>
          <h2 className={styles.editorCardTitle}>Article SEO Readiness Audit</h2>
          <div className={styles.tableWrap} style={{ display: 'block' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Article Headline</th>
                  <th>Slug</th>
                  <th>Focus Keyword</th>
                  <th>SEO Score</th>
                  <th className={styles.rightAlign}>Optimize</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                    <td className={styles.slugMono}>/{a.slug}</td>
                    <td>{a.focusKeyword || 'उत्तराखंड समाचार'}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          (a.seoScore ?? 85) >= 85
                            ? styles.badgePublished
                            : styles.badgePending
                        }`}
                      >
                        {a.seoScore ?? 88} / 100
                      </span>
                    </td>
                    <td className={styles.rightAlign}>
                      <Link href={a.editHref} className={styles.actionBtn}>
                        <Pencil size={13} /> Edit SEO
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // 8. ANALYTICS & REPORTS VIEW
  return (
    <div className={styles.pageShell}>
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon} style={{ background: '#E3F2FD', color: '#0369A1' }}>
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>Analytics &amp; Reports</h1>
            <p className={styles.pageSubtitle}>
              Audience growth, organic Google News discovery and Hindi category engagement
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" target="_blank" className={styles.secondaryBtn}>
            <ExternalLink size={15} /> Live Portal
          </Link>
        </div>
      </header>

      <div className={styles.twoColFields} style={{ marginBottom: 18 }}>
        <div className={styles.cardSurface}>
          <h2 className={styles.editorCardTitle}>Monthly Readership Growth</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={TRAFFIC_SERIES.monthly.points}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F6" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="pageViews"
                stroke="#1C1B29"
                strokeWidth={2.5}
                fill="#D5F46A"
                fillOpacity={0.45}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.cardSurface}>
          <h2 className={styles.editorCardTitle}>Category Readership Breakdown</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={CATEGORY_PERFORMANCE}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F6" />
              <XAxis dataKey="category" axisLine={false} tickLine={false} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip />
              <Bar dataKey="views" radius={[8, 8, 8, 8]}>
                {CATEGORY_PERFORMANCE.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={entry.highlight ? '#D5F46A' : '#1C1B29'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

