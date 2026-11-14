'use client'

import { DefaultEditView } from '@payloadcms/ui'
import {
  ArrowLeft,
  Bold,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileEdit,
  FolderPlus,
  Globe,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MapPin,
  Maximize2,
  Minimize2,
  Plus,
  Quote,
  Save,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Underline,
  Upload,
  UserCheck,
  Wand2,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { slugifyTitle } from '@/lib/slug/transliterate'

import styles from './articlesAdmin.module.css'
import { type ArticleWorkflowStatus, SAMPLE_SUBCATEGORIES } from './mock-cms-data'

export interface EditorCategoryOption {
  id: number
  name: string
  slug: string
}

export interface EditorAuthorOption {
  id: number
  name: string
  role: string
}

export interface EditorTagOption {
  id: number
  name: string
  slug: string
}

export interface EditorMediaOption {
  id: number
  url: string
  alt: string
  width?: number
  height?: number
}

export type ArticleKind = 'news' | 'opinion' | 'interview' | 'analysis' | 'photo_story'

export interface InitialArticleDoc {
  id?: number
  title: string
  slug: string
  summary: string
  bodyText: string
  rawBody?: unknown
  /** Body has custom upload/embed blocks that only Classic Lexical mode renders. */
  bodyHasRichContent?: boolean
  categoryId?: number
  subcategory?: string
  locationId?: number
  authorIds: number[]
  tagIds: number[]
  featuredImageId?: number
  featuredImageUrl?: string
  galleryUrls: string[]
  seoTitle: string
  metaDescription: string
  focusKeyword: string
  noindex?: boolean
  canonicalUrl: string
  socialImageId?: number
  socialImageUrl?: string
  status: ArticleWorkflowStatus
  reviewNote?: string
  articleType?: ArticleKind
  language?: 'hi' | 'en'
  isFeatured: boolean
  isBreaking: boolean
  isTrending: boolean
  publishedAt: string
}

export interface ArticleEditorClientProps {
  initialDoc: InitialArticleDoc
  categories: EditorCategoryOption[]
  authors: EditorAuthorOption[]
  tags: EditorTagOption[]
  mediaItems: EditorMediaOption[]
  locations: { id: number; name: string; slug: string }[]
  payloadEditProps?: Record<string, unknown>
}

const DEFAULT_CATEGORY_PRESETS: { name: string; slug: string }[] = [
  { name: 'प्रदेश', slug: 'pradesh' },
  { name: 'देश', slug: 'desh' },
  { name: 'राजनीति', slug: 'rajneeti' },
  { name: 'समाज', slug: 'samaj' },
  { name: 'खेल', slug: 'khel' },
  { name: 'दुनिया', slug: 'duniya' },
  { name: 'बिज़नेस', slug: 'business' },
  { name: 'टेक्नोलॉजी', slug: 'technology' },
  { name: 'मनोरंजन', slug: 'manoranjan' },
]

const UTTARAKHAND_DISTRICTS: { name: string; slug: string }[] = [
  { name: 'देहरादून', slug: 'dehradun' },
  { name: 'नैनीताल', slug: 'nainital' },
  { name: 'हरिद्वार', slug: 'haridwar' },
  { name: 'हल्द्वानी', slug: 'haldwani' },
  { name: 'उधम सिंह नगर', slug: 'udham-singh-nagar' },
  { name: 'पौड़ी गढ़वाल', slug: 'pauri-garhwal' },
  { name: 'टिहरी गढ़वाल', slug: 'tehri-garhwal' },
  { name: 'चमोली', slug: 'chamoli' },
  { name: 'रुद्रप्रयाग', slug: 'rudraprayag' },
  { name: 'उत्तरकाशी', slug: 'uttarkashi' },
  { name: 'अल्मोड़ा', slug: 'almora' },
  { name: 'पिथौरागढ़', slug: 'pithoragarh' },
  { name: 'चंपावत', slug: 'champawat' },
  { name: 'बागेश्वर', slug: 'bageshwar' },
]

/** Reads the publish-time input as IST wall-clock time ("YYYY-MM-DDTHH:mm") and returns a UTC ISO string. */
function istInputToIso(value: string): string {
  const ms = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? Date.parse(`${value}:00+05:30`) : Number.NaN
  return new Date(Number.isNaN(ms) ? Date.now() : ms).toISOString()
}

type LexicalInlineNode =
  | {
      type: 'text'
      text: string
      detail: number
      format: number
      mode: 'normal'
      style: string
      version: 1
    }
  | {
      type: 'linebreak'
      version: 1
    }
  | {
      type: 'link'
      direction: 'ltr'
      format: ''
      indent: number
      version: 3
      fields: {
        url: string
        linkType: 'custom'
        newTab: boolean
      }
      children: LexicalInlineNode[]
    }

function makeTextNode(text: string, format = 0): LexicalInlineNode {
  return {
    type: 'text',
    text,
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    version: 1,
  }
}

/**
 * Parses inline markdown (`[label](url)`, `**bold**`, `*italic*`, `__underline__`) and single `\n` linebreaks
 * into Payload-compatible Lexical inline nodes.
 */
function parseInlineNodes(input: string): LexicalInlineNode[] {
  const lines = input.split('\n')
  const result: LexicalInlineNode[] = []

  const tokenRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*/g

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      result.push({ type: 'linebreak', version: 1 })
    }
    let lastIndex = 0
    let match: RegExpExecArray | null
    tokenRegex.lastIndex = 0
    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        result.push(makeTextNode(line.slice(lastIndex, match.index), 0))
      }
      if (match[1] !== undefined && match[2] !== undefined) {
        const url = match[2].trim()
        result.push({
          type: 'link',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 3,
          fields: {
            url,
            linkType: 'custom',
            newTab: url.startsWith('http'),
          },
          children: [makeTextNode(match[1], 0)],
        })
      } else if (match[3] !== undefined) {
        result.push(makeTextNode(match[3], 1)) // bold
      } else if (match[4] !== undefined) {
        result.push(makeTextNode(match[4], 8)) // underline
      } else if (match[5] !== undefined) {
        result.push(makeTextNode(match[5], 2)) // italic
      }
      lastIndex = tokenRegex.lastIndex
    }
    if (lastIndex < line.length) {
      result.push(makeTextNode(line.slice(lastIndex), 0))
    }
  })

  return result.length > 0 ? result : [makeTextNode('')]
}

/** Converts plain/markdown-like blocks from the Studio editor into valid Payload Lexical JSON. */
function textToLexicalJson(text: string) {
  const blocks = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const children = (blocks.length > 0 ? blocks : ['']).map((block) => {
    if (block.startsWith('#### ')) {
      return {
        type: 'heading',
        tag: 'h4',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: parseInlineNodes(block.slice(5).trim()),
      }
    }
    if (block.startsWith('### ')) {
      return {
        type: 'heading',
        tag: 'h3',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: parseInlineNodes(block.slice(4).trim()),
      }
    }
    if (block.startsWith('## ')) {
      return {
        type: 'heading',
        tag: 'h2',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: parseInlineNodes(block.slice(3).trim()),
      }
    }
    if (block.startsWith('> ')) {
      const cleaned = block
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n')
        .trim()
      return {
        type: 'quote',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: parseInlineNodes(cleaned),
      }
    }

    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const isBulletList = lines.length > 0 && lines.every((l) => /^(?:•|-|\*)\s+/.test(l))
    if (isBulletList) {
      return {
        type: 'list',
        listType: 'bullet',
        tag: 'ul',
        start: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: lines.map((line, idx) => ({
          type: 'listitem',
          value: idx + 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: parseInlineNodes(line.replace(/^(?:•|-|\*)\s+/, '')),
        })),
      }
    }

    const isNumberList = lines.length > 0 && lines.every((l) => /^\d+\.\s+/.test(l))
    if (isNumberList) {
      return {
        type: 'list',
        listType: 'number',
        tag: 'ol',
        start: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: lines.map((line, idx) => ({
          type: 'listitem',
          value: idx + 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          children: parseInlineNodes(line.replace(/^\d+\.\s+/, '')),
        })),
      }
    }

    return {
      type: 'paragraph',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children: parseInlineNodes(block),
    }
  })

  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children,
    },
  }
}

/**
 * Ensures an uploaded image is at least `minWidth` px wide (1200px required by Payload's
 * `requireFeaturedImageOnPublish` hook). If the user selects a smaller image (e.g. a WhatsApp image),
 * it is upscaled cleanly in the browser before uploading to `/api/media`.
 */
async function ensureMinimumImageWidth(file: File, minWidth = 1200): Promise<File> {
  if (typeof window === 'undefined') return file
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      if (img.naturalWidth >= minWidth || img.naturalWidth === 0) {
        resolve(file)
        return
      }
      const scale = minWidth / img.naturalWidth
      const targetWidth = minWidth
      const targetHeight = Math.max(1, Math.round(img.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'loklens-image'
          resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp' }))
        },
        'image/webp',
        0.9,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }
    img.src = objectUrl
  })
}

export function ArticleEditorClient({
  initialDoc,
  categories: initialCategories,
  authors,
  tags: initialTags,
  mediaItems: initialMedia,
  locations: initialLocations,
  payloadEditProps,
}: ArticleEditorClientProps) {
  const router = useRouter()
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)
  const socialInputRef = useRef<HTMLInputElement | null>(null)

  const [classicMode, setClassicMode] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Core Article Fields (Section 5)
  const [title, setTitle] = useState(initialDoc.title)
  const [slug, setSlug] = useState(initialDoc.slug)
  const [slugTouched, setSlugTouched] = useState(Boolean(initialDoc.slug))
  const [summary, setSummary] = useState(initialDoc.summary)
  const [bodyText, setBodyText] = useState(initialDoc.bodyText)

  // Taxonomy & Relations
  const [categories, setCategories] = useState<EditorCategoryOption[]>(initialCategories)
  const [categoryId, setCategoryId] = useState<number | ''>(
    initialDoc.categoryId ?? initialCategories[0]?.id ?? '',
  )
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  const [subcategory, setSubcategory] = useState(
    initialDoc.subcategory || SAMPLE_SUBCATEGORIES[0]?.name || '',
  )
  const [locations, setLocations] = useState(initialLocations)
  const [locationId, setLocationId] = useState<number | ''>(initialDoc.locationId ?? '')
  const [newLocationInput, setNewLocationInput] = useState('')
  const [creatingLocation, setCreatingLocation] = useState(false)

  const [selectedAuthors, setSelectedAuthors] = useState<number[]>(initialDoc.authorIds)
  const [tags, setTags] = useState<EditorTagOption[]>(initialTags)
  const [selectedTags, setSelectedTags] = useState<number[]>(initialDoc.tagIds)
  const [newTagInput, setNewTagInput] = useState('')

  // Media Fields
  const [mediaList, setMediaList] = useState<EditorMediaOption[]>(initialMedia)
  const [featuredImageId, setFeaturedImageId] = useState<number | undefined>(
    initialDoc.featuredImageId,
  )
  const [featuredImageUrl, setFeaturedImageUrl] = useState(
    initialDoc.featuredImageUrl || '',
  )
  const [featuredAlt, setFeaturedAlt] = useState(
    initialDoc.title || 'उत्तराखंड समाचार फ़ोटो',
  )
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initialDoc.galleryUrls)

  // SEO Fields
  const [seoTitle, setSeoTitle] = useState(initialDoc.seoTitle)
  const [metaDescription, setMetaDescription] = useState(initialDoc.metaDescription)
  const [focusKeyword, setFocusKeyword] = useState(initialDoc.focusKeyword)
  const [noindex, setNoindex] = useState(Boolean(initialDoc.noindex))
  const [canonicalUrl, setCanonicalUrl] = useState(initialDoc.canonicalUrl)
  const [socialImageId, setSocialImageId] = useState<number | undefined>(
    initialDoc.socialImageId,
  )
  const [socialImageUrl, setSocialImageUrl] = useState(initialDoc.socialImageUrl || '')

  // Right-side Publishing Settings Panel
  const [status, setStatus] = useState<ArticleWorkflowStatus>(initialDoc.status)
  const [reviewNote, setReviewNote] = useState(initialDoc.reviewNote || '')
  const [articleType, setArticleType] = useState<ArticleKind>(initialDoc.articleType || 'news')
  const [language, setLanguage] = useState<'hi' | 'en'>(initialDoc.language || 'hi')
  const [isFeatured, setIsFeatured] = useState(initialDoc.isFeatured)
  const [isBreaking, setIsBreaking] = useState(initialDoc.isBreaking)
  const [isTrending, setIsTrending] = useState(initialDoc.isTrending)
  const [publishedAt, setPublishedAt] = useState(initialDoc.publishedAt)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!slugTouched) {
      setSlug(slugifyTitle(val))
    }
  }

  function regenerateSlug() {
    const generated = slugifyTitle(title) || `loklens-story-${Date.now().toString().slice(-4)}`
    setSlug(generated)
    setSlugTouched(true)
    showToast('English slug generated from Hindi headline')
  }

  function insertFormatting(prefix: string, suffix = '') {
    const el = bodyRef.current
    if (!el) {
      setBodyText((prev) => `${prev}\n${prefix}${suffix}`)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = bodyText.slice(start, end) || 'यहाँ लिखें'
    const next =
      bodyText.slice(0, start) + prefix + selected + suffix + bodyText.slice(end)
    setBodyText(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    }, 10)
  }

  // Upload image helper to Payload /api/media
  async function uploadMediaFile(rawFile: File, target: 'featured' | 'gallery' | 'social') {
    setUploadingImage(true)
    try {
      const file =
        target === 'featured' ? await ensureMinimumImageWidth(rawFile, 1200) : rawFile
      const formData = new FormData()
      formData.append('file', file)
      formData.append(
        '_payload',
        JSON.stringify({
          alt: (featuredAlt.trim() || title.trim() || 'LokLens News Image').slice(0, 250),
        }),
      )
      const res = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (res.ok) {
        const body = (await res.json()) as {
          doc?: {
            id: number
            url?: string
            width?: number
            height?: number
            sizes?: { thumb?: { url?: string }; card?: { url?: string } }
          }
        }
        if (body.doc?.id) {
          const url =
            body.doc.sizes?.card?.url ||
            body.doc.sizes?.thumb?.url ||
            body.doc.url ||
            URL.createObjectURL(file)
          const newOption: EditorMediaOption = {
            id: body.doc.id,
            url,
            alt: title || featuredAlt || 'Image',
            width: body.doc.width,
            height: body.doc.height,
          }
          setMediaList((prev) => [newOption, ...prev.filter((m) => m.id !== body.doc!.id)])
          if (target === 'featured') {
            setFeaturedImageId(body.doc.id)
            setFeaturedImageUrl(url)
          } else if (target === 'gallery') {
            setGalleryUrls((prev) => [...prev, url])
          } else {
            setSocialImageId(body.doc.id)
            setSocialImageUrl(url)
          }
          showToast(`Image uploaded to Media Library (#${body.doc.id})`)
          return
        }
      }
      const errJson = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
      showToast(`Image not uploaded: ${errJson?.errors?.[0]?.message || `server error (${res.status})`}`)
    } catch {
      showToast('Image not uploaded: could not reach the server.')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleCreateCategory(preset?: { name: string; slug: string }) {
    const name = (preset?.name ?? newCategoryInput).trim()
    if (!name) return
    const existing = categories.find((c) => c.name === name)
    if (existing) {
      setCategoryId(existing.id)
      setNewCategoryInput('')
      showToast(`Selected category "${existing.name}"`)
      return
    }
    const catSlug = preset?.slug || slugifyTitle(name) || `category-${Date.now().toString().slice(-4)}`
    setCreatingCategory(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          slug: catSlug,
          showInNav: true,
          order: categories.length + 1,
        }),
      })
      if (res.ok) {
        const body = (await res.json()) as { doc?: EditorCategoryOption }
        if (body.doc?.id) {
          const created: EditorCategoryOption = {
            id: body.doc.id,
            name: String(body.doc.name),
            slug: String(body.doc.slug),
          }
          setCategories((prev) => [...prev, created])
          setCategoryId(created.id)
          setNewCategoryInput('')
          showToast(`Category "${created.name}" created and selected`)
          return
        }
      }
      const errJson = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
      showToast(`Category not created: ${errJson?.errors?.[0]?.message || `server error (${res.status})`}`)
    } catch {
      showToast('Category not created: could not reach the server.')
    } finally {
      setCreatingCategory(false)
    }
  }

  async function handleCreateLocation(preset?: { name: string; slug: string }) {
    const name = (preset?.name ?? newLocationInput).trim()
    if (!name) return
    const existing = locations.find((l) => l.name === name)
    if (existing) {
      setLocationId(existing.id)
      setNewLocationInput('')
      showToast(`Selected district "${existing.name}"`)
      return
    }
    const locSlug = preset?.slug || slugifyTitle(name) || `district-${Date.now().toString().slice(-4)}`
    setCreatingLocation(true)
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          slug: locSlug,
          kind: 'district',
        }),
      })
      if (res.ok) {
        const body = (await res.json()) as { doc?: { id: number; name: string; slug: string } }
        if (body.doc?.id) {
          const created = {
            id: body.doc.id,
            name: String(body.doc.name),
            slug: String(body.doc.slug),
          }
          setLocations((prev) => [...prev, created])
          setLocationId(created.id)
          setNewLocationInput('')
          showToast(`District "${created.name}" added and selected`)
          return
        }
      }
      const errJson = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
      showToast(`District not added: ${errJson?.errors?.[0]?.message || `server error (${res.status})`}`)
    } catch {
      showToast('District not added: could not reach the server.')
    } finally {
      setCreatingLocation(false)
    }
  }

  async function handleAddTag() {
    const name = newTagInput.trim()
    if (!name) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!selectedTags.includes(existing.id)) {
        setSelectedTags((prev) => [...prev, existing.id])
      }
      setNewTagInput('')
      showToast(`Selected tag "#${existing.name}"`)
      return
    }
    const tagSlug = slugifyTitle(name) || `tag-${Date.now().toString().slice(-4)}`
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, slug: tagSlug }),
      })
      if (res.ok) {
        const body = (await res.json()) as { doc?: { id: number; name: string; slug: string } }
        if (body.doc) {
          setTags((prev) => [...prev, body.doc!])
          setSelectedTags((prev) => [...prev, body.doc!.id])
          setNewTagInput('')
          showToast(`Added tag "#${name}"`)
          return
        }
      }
      const errJson = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
      showToast(`Tag not added: ${errJson?.errors?.[0]?.message || `server error (${res.status})`}`)
    } catch {
      showToast('Tag not added: could not reach the server.')
    }
  }

  // Ensure a category exists in DB if none seeded yet
  async function ensureCategoryId(): Promise<number | undefined> {
    if (typeof categoryId === 'number') return categoryId
    if (categories.length > 0) return categories[0].id
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'प्रदेश', slug: 'pradesh', showInNav: true, order: 1 }),
      })
      if (res.ok) {
        const body = (await res.json()) as { doc?: EditorCategoryOption }
        if (body.doc?.id) {
          setCategories([body.doc])
          setCategoryId(body.doc.id)
          return body.doc.id
        }
      }
    } catch {
      /* ignore */
    }
    return undefined
  }

  async function handleSaveArticle(targetMode: 'publish' | 'schedule' | 'draft') {
    if (!title.trim()) {
      showToast('Please enter a Hindi article headline first.')
      return
    }
    if (targetMode === 'publish' && !featuredImageId) {
      showToast('A Featured Image is required before publishing live. Upload or select an image below, or click "Save as Draft".')
      return
    }
    if (status === 'rejected' && targetMode === 'draft' && !reviewNote.trim()) {
      showToast('Please enter a Review Note explaining why this article is rejected.')
      return
    }

    setSaving(true)
    const nextWorkflow: ArticleWorkflowStatus =
      targetMode === 'publish'
        ? 'published'
        : targetMode === 'schedule'
          ? 'scheduled'
          : status === 'pending_review' || status === 'rejected'
            ? status
            : 'draft'
    setStatus(nextWorkflow)

    try {
      const resolvedCatId = await ensureCategoryId()
      const finalSlug = (
        slug.trim() ||
        slugifyTitle(title) ||
        `hindi-news-${Date.now().toString().slice(-5)}`
      ).slice(0, 120)
      const payloadStatus = targetMode === 'publish' ? 'published' : 'draft'
      const payloadWorkflowStatus =
        targetMode === 'publish'
          ? 'published'
          : targetMode === 'schedule'
            ? 'draft'
            : status === 'pending_review' || status === 'rejected'
              ? status
              : 'draft'

      // If scheduling and publishedAt isn't in the future yet, default to 1 hour from now
      let effectivePublishedAt = istInputToIso(publishedAt)
      if (targetMode === 'schedule' && Date.parse(effectivePublishedAt) <= Date.now()) {
        const oneHourLaterMs = Date.now() + 3600_000
        effectivePublishedAt = new Date(oneHourLaterMs).toISOString()
        const istStr = new Date(oneHourLaterMs + 330 * 60_000).toISOString().slice(0, 16)
        setPublishedAt(istStr)
      }

      const derivedSummary = (
        summary.trim() ||
        bodyText
          .replace(/^[#>*•-]+\s*/gm, '')
          .trim()
          .slice(0, 220) ||
        title.trim()
      ).slice(0, 300)

      const payloadBody: Record<string, unknown> = {
        title: title.trim().slice(0, 200),
        slug: finalSlug,
        summary: derivedSummary,
        // Keep the stored Lexical body unless the text was edited, so saving metadata never strips custom blocks.
        body:
          initialDoc.rawBody && bodyText === initialDoc.bodyText
            ? initialDoc.rawBody
            : textToLexicalJson(bodyText || derivedSummary || title),
        _status: payloadStatus,
        workflowStatus: payloadWorkflowStatus,
        articleType,
        language,
        isFeatured,
        isBreaking,
        isTrending,
        publishedAt: effectivePublishedAt,
        seo: {
          metaTitle: seoTitle.trim() ? seoTitle.trim().slice(0, 70) : undefined,
          metaDescription: metaDescription.trim() ? metaDescription.trim().slice(0, 200) : undefined,
          focusKeyword: focusKeyword.trim() ? focusKeyword.trim().slice(0, 100) : undefined,
          noindex,
          ogImage: socialImageId || featuredImageId || undefined,
        },
      }
      if (reviewNote.trim()) {
        payloadBody.reviewNote = reviewNote.trim().slice(0, 1000)
      }
      if (resolvedCatId) payloadBody.category = resolvedCatId
      if (typeof locationId === 'number') payloadBody.location = locationId
      else if (initialDoc.locationId && locationId === '') payloadBody.location = null
      if (featuredImageId) payloadBody.featuredImage = featuredImageId
      payloadBody.authors = selectedAuthors
      payloadBody.tags = selectedTags.filter((id) => id < 1_000_000_000)

      const endpoint = initialDoc.id ? `/api/articles/${initialDoc.id}` : '/api/articles'
      const method = initialDoc.id ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payloadBody),
      })

      if (res.ok) {
        const result = (await res.json()) as { doc?: { id?: number } }
        const savedId = result.doc?.id ?? initialDoc.id
        showToast(
          targetMode === 'publish'
            ? 'Article published live!'
            : targetMode === 'schedule'
              ? 'Article scheduled for publication!'
              : 'Draft saved successfully!',
        )
        if (!initialDoc.id && savedId) {
          router.push(`/admin/collections/articles/${savedId}`)
        } else {
          router.refresh()
        }
      } else {
        const errJson = (await res.json().catch(() => null)) as {
          errors?: { message?: string }[]
        } | null
        setStatus(initialDoc.status)
        showToast(
          `Not saved: ${errJson?.errors?.[0]?.message || `server error (${res.status})`}. Your text is still in the editor.`,
        )
      }
    } catch {
      setStatus(initialDoc.status)
      showToast('Not saved: could not reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // Live SEO Score computation
  const seoScore = useMemo(() => {
    let score = 45
    if (title.trim().length >= 25 && title.trim().length <= 110) score += 15
    if (summary.trim().length >= 50) score += 15
    if (bodyText.trim().split(/\s+/).filter(Boolean).length >= 80) score += 10
    if (focusKeyword.trim()) {
      const kw = focusKeyword.trim().toLowerCase()
      if (title.toLowerCase().includes(kw)) score += 8
      if ((metaDescription || summary).toLowerCase().includes(kw)) score += 7
    } else if (seoTitle.trim() || metaDescription.trim()) {
      score += 10
    }
    return Math.min(100, score)
  }, [title, summary, bodyText, focusKeyword, seoTitle, metaDescription])

  const wordCount = useMemo(
    () => bodyText.trim().split(/\s+/).filter(Boolean).length,
    [bodyText],
  )

  const selectedCategorySlug = useMemo(() => {
    const found = categories.find((c) => c.id === categoryId)
    return found?.slug || 'pradesh'
  }, [categories, categoryId])

  const resolvedCanonical =
    canonicalUrl.trim() ||
    `https://loklensnews.com/${selectedCategorySlug}/${slug || 'hindi-news-story'}${initialDoc.id ? `-${initialDoc.id}` : ''}`

  if (classicMode && payloadEditProps) {
    return (
      <div className={styles.pageShell}>
        <div className={styles.pageHeader}>
          <button
            type="button"
            className={styles.primaryLimeBtn}
            onClick={() => setClassicMode(false)}
          >
            <Sparkles size={15} /> Back to LokLens Studio Editor
          </button>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <DefaultEditView {...(payloadEditProps as any)} />
      </div>
    )
  }

  return (
    <div className={styles.pageShell}>
      {toast && (
        <div className={styles.toast} role="status">
          <Sparkles size={15} />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Studio Header */}
      <header className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <Link
            href="/admin/collections/articles"
            className={styles.secondaryBtn}
            title="Back to News Articles"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className={styles.pageTitle}>
              {initialDoc.id ? `Edit Article #${initialDoc.id}` : 'Create Article'}
            </h1>
            <p className={styles.pageSubtitle}>
              Spacious Hindi newsroom studio · Auto-transliterated slug · Lexical &amp; SEO ready
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          {payloadEditProps && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setClassicMode(true)}
            >
              <FileEdit size={15} />
              <span>Classic CMS Fields</span>
            </button>
          )}
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setFocusMode((f) => !f)}
          >
            {focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span>{focusMode ? 'Exit Focus Mode' : 'Distraction-Free'}</span>
          </button>
          <button
            type="button"
            disabled={saving || uploadingImage}
            onClick={() => handleSaveArticle('draft')}
            className={styles.secondaryBtn}
          >
            <Save size={15} />
            <span>Save as Draft</span>
          </button>
          <button
            type="button"
            disabled={saving || uploadingImage}
            onClick={() => handleSaveArticle('publish')}
            className={styles.primaryLimeBtn}
          >
            <Send size={15} />
            <span>{saving ? 'Saving...' : 'Publish Now'}</span>
          </button>
        </div>
      </header>

      <div
        className={styles.editorGrid}
        style={focusMode ? { gridTemplateColumns: 'minmax(0, 920px)', justifyContent: 'center' } : undefined}
      >
        {/* LEFT / MAIN CONTENT EDITOR COLUMN */}
        <div className={styles.editorMainCol}>
          {/* Card 1: Headline, English Slug & Short Description */}
          <section className={styles.editorCard}>
            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="article-title" className={styles.fieldLabel}>
                  Article Title (Hindi Headline) *
                </label>
                <span className={styles.fieldHint}>
                  {title.length} / 110 chars recommended (max 200)
                </span>
              </div>
              <input
                id="article-title"
                type="text"
                maxLength={200}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="यहाँ हिंदी समाचार का मुख्य शीर्षक लिखें (उदा. देहरादून-दिल्ली एक्सप्रेसवे का अंतिम चरण पूरा)..."
                className={styles.titleHeroInput}
              />
            </div>

            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="article-slug" className={styles.fieldLabel}>
                  English Slug (URL-friendly Latin) *
                </label>
                <span className={styles.fieldHint}>
                  Preview: /{selectedCategorySlug}/{slug || 'your-slug'}{initialDoc.id ? `-${initialDoc.id}` : ''}
                </span>
              </div>
              <div className={styles.slugRow}>
                <input
                  id="article-slug"
                  type="text"
                  maxLength={120}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value)
                    setSlugTouched(true)
                  }}
                  placeholder="dehradun-delhi-expressway-final-phase"
                  className={styles.textInput}
                />
                <button
                  type="button"
                  onClick={regenerateSlug}
                  className={styles.secondaryBtn}
                  title="Auto-transliterate Hindi title to English slug"
                >
                  <Wand2 size={15} />
                  <span>Auto-Slug</span>
                </button>
              </div>
            </div>

            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="article-summary" className={styles.fieldLabel}>
                  Short Description (Summary / Standfirst) *
                </label>
                <span className={styles.fieldHint}>{summary.length} / 300 chars</span>
              </div>
              <textarea
                id="article-summary"
                rows={3}
                maxLength={300}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="1–2 पंक्तियों में खबर का सार लिखें। यह होमपेज कार्ड, ऐप प्रीव्यू और गूगल मेटा डिस्क्रिप्शन में दिखेगा..."
                className={styles.textareaInput}
              />
            </div>
          </section>

          {/* Card 2: Spacious Rich Text Content Editor */}
          <section className={styles.editorCard}>
            <div className={styles.editorCardTitle}>
              <span>Rich Text Content Editor</span>
              <span className={styles.fieldHint}>
                Devanagari Unicode NFC · Headings, Lists, Quotes &amp; Links supported
              </span>
            </div>

            <div className={styles.richEditorContainer}>
              <div className={styles.richToolbar} role="toolbar" aria-label="Formatting options">
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('**', '**')}
                  title="Bold (**text**)"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('*', '*')}
                  title="Italic (*text*)"
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('__', '__')}
                  title="Underline (__text__)"
                >
                  <Underline size={14} />
                </button>
                <span className={styles.toolDivider} />
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('\n\n## ')}
                  title="Heading 2"
                >
                  <Heading2 size={14} /> H2
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('\n\n### ')}
                  title="Heading 3"
                >
                  <Heading3 size={14} /> H3
                </button>
                <span className={styles.toolDivider} />
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('\n\n• ')}
                  title="Bullet List"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('\n\n1. ')}
                  title="Numbered List"
                >
                  <ListOrdered size={14} />
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('\n\n> ')}
                  title="Blockquote"
                >
                  <Quote size={14} /> Quote
                </button>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => insertFormatting('[', '](https://loklensnews.com)')}
                  title="Insert Link"
                >
                  <Link2 size={14} /> Link
                </button>
              </div>

              {initialDoc.bodyHasRichContent && (
                <p className={styles.bodyWarning} role="note">
                  This article contains embedded media or custom blocks. They are preserved unless you edit
                  the text below; use &ldquo;Classic CMS Fields&rdquo; at the top right to edit embeds directly.
                </p>
              )}

              <textarea
                ref={bodyRef}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="यहाँ विस्तृत समाचार लिखें...

देहरादून। उत्तराखंड में आज..."
                className={styles.richTextarea}
              />

              <div className={styles.editorFooterStats}>
                <span>
                  <strong>{wordCount}</strong> words · <strong>{bodyText.length}</strong> characters
                </span>
                <span>Estimated read time: {Math.max(1, Math.ceil(wordCount / 180))} min</span>
              </div>
            </div>
          </section>

          {/* Card 3: Featured Image Upload & Additional Image Gallery */}
          <section className={styles.editorCard}>
            <h2 className={styles.editorCardTitle}>
              <span>Featured Image &amp; Additional Image Gallery</span>
              <span className={styles.fieldHint}>Auto-upscaled to ≥ 1200px · WebP auto-sizes (16:9, 4:3, 1:1)</span>
            </h2>

            <div className={styles.twoColFields}>
              {/* Featured Image Upload */}
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>Featured Image (Required on Publish) *</label>
                <div className={styles.uploadDropzone}>
                  {featuredImageUrl ? (
                    <div className={styles.featuredPreviewWrap}>
                      <Image
                        src={featuredImageUrl}
                        alt={featuredAlt}
                        width={96}
                        height={68}
                        unoptimized
                        className={styles.featuredPreviewImg}
                      />
                      <div>
                        <strong style={{ fontSize: 12.5, display: 'block' }}>
                          Featured Image Selected
                        </strong>
                        <span className={styles.fieldHint}>
                          {featuredImageId ? `Media ID #${featuredImageId}` : 'Local preview ready'}
                        </span>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            disabled={uploadingImage}
                            className={styles.secondaryBtn}
                            style={{ height: 30, padding: '0 10px', fontSize: 11.5 }}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {uploadingImage ? 'Uploading...' : 'Replace'}
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            style={{ height: 30, padding: '0 10px', fontSize: 11.5 }}
                            onClick={() => {
                              setFeaturedImageId(undefined)
                              setFeaturedImageUrl('')
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={24} color="#6E7185" />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {uploadingImage
                          ? 'Uploading & optimizing image...'
                          : 'Upload Featured Image (auto-optimized to ≥ 1200px)'}
                      </span>
                      <button
                        type="button"
                        disabled={uploadingImage}
                        className={styles.secondaryBtn}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} /> {uploadingImage ? 'Uploading...' : 'Choose Image File'}
                      </button>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadMediaFile(f, 'featured')
                      e.target.value = ''
                    }}
                  />
                </div>

                <input
                  type="text"
                  maxLength={250}
                  value={featuredAlt}
                  onChange={(e) => setFeaturedAlt(e.target.value)}
                  placeholder="Hindi Alt Text (फ़ोटो का विवरण)..."
                  className={styles.textInput}
                  style={{ marginTop: 6 }}
                />

                {mediaList.length > 0 && (
                  <select
                    value={featuredImageId ?? ''}
                    onChange={(e) => {
                      const id = Number(e.target.value)
                      const found = mediaList.find((m) => m.id === id)
                      if (found) {
                        setFeaturedImageId(found.id)
                        setFeaturedImageUrl(found.url)
                        setFeaturedAlt(found.alt)
                      }
                    }}
                    className={styles.filterSelect}
                    style={{ marginTop: 6 }}
                  >
                    <option value="">Or pick from Media Library ({mediaList.length})...</option>
                    {mediaList.map((m) => (
                      <option key={m.id} value={m.id}>
                        #{m.id} — {m.alt}
                        {m.width && m.height ? ` (${m.width}×${m.height}px)` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Additional Image Gallery */}
              <div className={styles.fieldBlock}>
                <label className={styles.fieldLabel}>Additional Image Gallery</label>
                <div className={styles.uploadDropzone}>
                  <Upload size={22} color="#6E7185" />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                    Add Photo Gallery Images ({galleryUrls.length} attached)
                  </span>
                  <button
                    type="button"
                    disabled={uploadingImage}
                    className={styles.secondaryBtn}
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    <Plus size={14} /> Add Gallery Photos
                  </button>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      for (const f of files) uploadMediaFile(f, 'gallery')
                      e.target.value = ''
                    }}
                  />
                </div>

                {galleryUrls.length > 0 && (
                  <div className={styles.galleryGrid}>
                    {galleryUrls.map((url, idx) => (
                      <div key={idx} className={styles.galleryThumbItem}>
                        <Image
                          src={url}
                          alt={`Gallery ${idx + 1}`}
                          width={92}
                          height={70}
                          unoptimized
                          className={styles.galleryThumbImg}
                        />
                        <button
                          type="button"
                          className={styles.removeGalleryBtn}
                          onClick={() =>
                            setGalleryUrls((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Card 4: Category, Subcategory, District, Authors & Tags */}
          <section className={styles.editorCard}>
            <h2 className={styles.editorCardTitle}>
              <span>Category, Uttarakhand District, Authors &amp; Tags</span>
            </h2>

            <div className={styles.twoColFields}>
              {/* Primary Category + Inline Creator */}
              <div className={styles.fieldBlock}>
                <label htmlFor="article-category" className={styles.fieldLabel}>
                  Primary Category *
                </label>
                <select
                  id="article-category"
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(e.target.value ? Number(e.target.value) : '')
                  }
                  className={styles.filterSelect}
                >
                  {categories.length === 0 && (
                    <option value="">प्रदेश (Default — auto-created on save)</option>
                  )}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (/{c.slug})
                    </option>
                  ))}
                </select>

                {/* Quick Create Category */}
                <div className={styles.slugRow} style={{ marginTop: 6 }}>
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateCategory()
                      }
                    }}
                    placeholder="New category (e.g. प्रदेश, राजनीति)..."
                    className={styles.textInput}
                  />
                  <button
                    type="button"
                    disabled={creatingCategory}
                    onClick={() => handleCreateCategory()}
                    className={styles.secondaryBtn}
                  >
                    <FolderPlus size={14} /> Add
                  </button>
                </div>

                {categories.length < 4 && (
                  <div className={styles.chipGroup} style={{ marginTop: 6 }}>
                    {DEFAULT_CATEGORY_PRESETS.filter(
                      (p) => !categories.some((c) => c.slug === p.slug || c.name === p.name),
                    )
                      .slice(0, 6)
                      .map((preset) => (
                        <button
                          key={preset.slug}
                          type="button"
                          disabled={creatingCategory}
                          onClick={() => handleCreateCategory(preset)}
                          className={styles.selectChip}
                          title={`Click to add category ${preset.name}`}
                        >
                          + {preset.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Uttarakhand District / Location + Inline Creator */}
              <div className={styles.fieldBlock}>
                <label htmlFor="article-location" className={styles.fieldLabel}>
                  <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Uttarakhand District / Location
                </label>
                <select
                  id="article-location"
                  value={locationId}
                  onChange={(e) =>
                    setLocationId(e.target.value ? Number(e.target.value) : '')
                  }
                  className={styles.filterSelect}
                >
                  <option value="">All Uttarakhand / General</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} (/{loc.slug})
                    </option>
                  ))}
                </select>

                <div className={styles.slugRow} style={{ marginTop: 6 }}>
                  <input
                    type="text"
                    value={newLocationInput}
                    onChange={(e) => setNewLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateLocation()
                      }
                    }}
                    placeholder="Add district (e.g. देहरादून, नैनीताल)..."
                    className={styles.textInput}
                  />
                  <button
                    type="button"
                    disabled={creatingLocation}
                    onClick={() => handleCreateLocation()}
                    className={styles.secondaryBtn}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {locations.length < 5 && (
                  <div className={styles.chipGroup} style={{ marginTop: 6 }}>
                    {UTTARAKHAND_DISTRICTS.filter(
                      (d) => !locations.some((l) => l.slug === d.slug || l.name === d.name),
                    )
                      .slice(0, 5)
                      .map((preset) => (
                        <button
                          key={preset.slug}
                          type="button"
                          disabled={creatingLocation}
                          onClick={() => handleCreateLocation(preset)}
                          className={styles.selectChip}
                          title={`Click to add ${preset.name}`}
                        >
                          + {preset.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Subcategory / Regional Desk */}
            {(SAMPLE_SUBCATEGORIES.length > 0 || locations.length > 0) && (
              <div className={styles.fieldBlock} style={{ marginTop: 12 }}>
                <label htmlFor="article-subcategory" className={styles.fieldLabel}>
                  Subcategory / Regional Desk
                </label>
                <select
                  id="article-subcategory"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">General Newsroom Desk</option>
                  {SAMPLE_SUBCATEGORIES.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} — {s.parentCategory}
                    </option>
                  ))}
                  {locations.map((loc) => (
                    <option key={`loc-${loc.id}`} value={loc.name}>
                      {loc.name} (District Desk)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Author Selection */}
            <div className={styles.fieldBlock} style={{ marginTop: 14 }}>
              <div className={styles.fieldLabelRow}>
                <label className={styles.fieldLabel}>
                  <UserCheck size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  Author / Journalist Selection
                </label>
                <span className={styles.fieldHint}>
                  Empty = &ldquo;LokLens News Team&rdquo; organization byline
                </span>
              </div>
              <div className={styles.chipGroup}>
                {authors.map((a) => {
                  const active = selectedAuthors.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setSelectedAuthors((prev) =>
                          active ? prev.filter((id) => id !== a.id) : [...prev, a.id],
                        )
                      }
                      className={`${styles.selectChip} ${
                        active ? styles.selectChipActive : ''
                      }`}
                    >
                      <span>{a.name}</span>
                      <small style={{ opacity: 0.75 }}>({a.role})</small>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tags Selection */}
            <div className={styles.fieldBlock} style={{ marginTop: 14 }}>
              <label className={styles.fieldLabel}>
                <Tag size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                Article Tags
              </label>
              <div className={styles.slugRow}>
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  placeholder="Type a Hindi or English tag and press Add..."
                  className={styles.textInput}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className={styles.secondaryBtn}
                >
                  <Plus size={14} /> Add Tag
                </button>
              </div>
              <div className={styles.chipGroup}>
                {tags.map((t) => {
                  const active = selectedTags.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          active ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                        )
                      }
                      className={`${styles.selectChip} ${
                        active ? styles.selectChipActive : ''
                      }`}
                    >
                      #{t.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Card 5: SEO Settings (SEO Title, Meta Description, Focus Keyword, Canonical URL, Social Image) */}
          <section className={styles.editorCard}>
            <div className={styles.editorCardTitle}>
              <span>
                <Globe size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                SEO &amp; Social Sharing Optimization
              </span>
              <span
                className={`${styles.statusBadge} ${
                  seoScore >= 80 ? styles.badgePublished : styles.badgePending
                }`}
              >
                SEO Score: {seoScore}/100
              </span>
            </div>

            <div className={styles.twoColFields}>
              <div className={styles.fieldBlock}>
                <label htmlFor="seo-focus-kw" className={styles.fieldLabel}>
                  Focus Keyword (मुख्य कीवर्ड)
                </label>
                <input
                  id="seo-focus-kw"
                  type="text"
                  maxLength={100}
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g. देहरादून दिल्ली एक्सप्रेसवे"
                  className={styles.textInput}
                />
              </div>

              <div className={styles.fieldBlock}>
                <label htmlFor="seo-canonical" className={styles.fieldLabel}>
                  Canonical URL
                </label>
                <input
                  id="seo-canonical"
                  type="url"
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                  placeholder={resolvedCanonical}
                  className={styles.textInput}
                />
              </div>
            </div>

            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="seo-title" className={styles.fieldLabel}>
                  SEO Title (Meta Title)
                </label>
                <span className={styles.fieldHint}>
                  {seoTitle.length} / 70 chars
                </span>
              </div>
              <input
                id="seo-title"
                type="text"
                maxLength={70}
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={title || 'Defaults to the Hindi headline...'}
                className={styles.textInput}
              />
            </div>

            <div className={styles.fieldBlock}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="seo-desc" className={styles.fieldLabel}>
                  Meta Description
                </label>
                <span className={styles.fieldHint}>
                  {metaDescription.length} / 200 chars (160 recommended)
                </span>
              </div>
              <textarea
                id="seo-desc"
                rows={2}
                maxLength={200}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder={summary || 'Defaults to the short description...'}
                className={styles.textareaInput}
              />
            </div>

            <div className={styles.fieldBlock}>
              <label className={styles.fieldLabel}>
                Social Sharing Image (Open Graph / WhatsApp 1200×630)
              </label>
              <div className={styles.slugRow}>
                <input
                  type="text"
                  value={socialImageUrl || featuredImageUrl}
                  onChange={(e) => setSocialImageUrl(e.target.value)}
                  placeholder="Defaults to Featured Image unless overridden..."
                  className={styles.textInput}
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  className={styles.secondaryBtn}
                  onClick={() => socialInputRef.current?.click()}
                >
                  <Upload size={14} /> Upload OG Image
                </button>
                <input
                  ref={socialInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadMediaFile(f, 'social')
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            <div className={styles.toggleRow} style={{ marginTop: 8 }}>
              <div className={styles.toggleMeta}>
                <strong>Hide from Search Engines (noindex)</strong>
                <small>Prevent Google from indexing this article</small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={noindex}
                onClick={() => setNoindex((v) => !v)}
                className={`${styles.switchBtn} ${noindex ? styles.switchBtnOn : ''}`}
              >
                <span className={styles.switchThumb} />
              </button>
            </div>

            {/* Live Google Search Snippet Preview */}
            <div className={styles.seoPreviewBox}>
              <div className={styles.seoPreviewUrl}>{resolvedCanonical}</div>
              <div className={styles.seoPreviewTitle}>
                {seoTitle || title || 'लोकलेंस न्यूज़: आपकी आवाज़, आपकी खबर'} | LokLens News
              </div>
              <div className={styles.seoPreviewDesc}>
                {metaDescription ||
                  summary ||
                  'उत्तराखंड और देश-दुनिया की ताज़ा हिंदी खबरें, राजनीति, समाज और खेल समाचार।'}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT-SIDE PUBLISHING SETTINGS PANEL (Section 5) */}
        {!focusMode && (
          <aside className={styles.editorRightCol} aria-label="Publishing settings">
            <section className={styles.editorCard}>
              <h2 className={styles.editorCardTitle}>
                <span>Publishing Actions</span>
                <span
                  className={`${styles.statusBadge} ${
                    status === 'published'
                      ? styles.badgePublished
                      : status === 'scheduled'
                        ? styles.badgeScheduled
                        : status === 'pending_review'
                          ? styles.badgePending
                          : status === 'rejected'
                            ? styles.badgeRejected
                            : styles.badgeDraft
                  }`}
                >
                  {status.replace('_', ' ').toUpperCase()}
                </span>
              </h2>

              <div className={styles.publishActionStack}>
                <button
                  type="button"
                  disabled={saving || uploadingImage}
                  onClick={() => handleSaveArticle('publish')}
                  className={styles.fullWidthLimeBtn}
                >
                  <CheckCircle2 size={16} />
                  <span>{saving ? 'Publishing...' : 'Publish Now'}</span>
                </button>

                <button
                  type="button"
                  disabled={saving || uploadingImage}
                  onClick={() => handleSaveArticle('schedule')}
                  className={styles.fullWidthNavyBtn}
                >
                  <CalendarClock size={16} />
                  <span>Schedule Article</span>
                </button>

                <button
                  type="button"
                  disabled={saving || uploadingImage}
                  onClick={() => handleSaveArticle('draft')}
                  className={styles.fullWidthGhostBtn}
                >
                  <Save size={15} />
                  <span>Save as Draft</span>
                </button>
              </div>
            </section>

            {/* Right Panel Settings: Status, Format, Language, Toggles, Publish Date & Time */}
            <section className={styles.editorCard}>
              <h2 className={styles.editorCardTitle}>
                <span>Publishing Settings</span>
              </h2>

              <div className={styles.fieldBlock}>
                <label htmlFor="pub-status" className={styles.fieldLabel}>
                  Article Status
                </label>
                <select
                  id="pub-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ArticleWorkflowStatus)}
                  className={styles.filterSelect}
                >
                  <option value="draft">Draft (मसौदा)</option>
                  <option value="pending_review">Pending Review (समीक्षाधीन)</option>
                  <option value="scheduled">Scheduled (निर्धारित)</option>
                  <option value="published">Published (प्रकाशित)</option>
                  <option value="rejected">Rejected (अस्वीकृत)</option>
                </select>
              </div>

              {(status === 'rejected' || status === 'pending_review' || reviewNote) && (
                <div className={styles.fieldBlock}>
                  <label htmlFor="pub-review-note" className={styles.fieldLabel}>
                    Editorial Review Note {status === 'rejected' ? '*' : ''}
                  </label>
                  <textarea
                    id="pub-review-note"
                    rows={2}
                    maxLength={1000}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Feedback or reason for rejection shown to the reporter..."
                    className={styles.textareaInput}
                  />
                </div>
              )}

              <div className={styles.twoColFields}>
                <div className={styles.fieldBlock}>
                  <label htmlFor="pub-article-type" className={styles.fieldLabel}>
                    Article Type
                  </label>
                  <select
                    id="pub-article-type"
                    value={articleType}
                    onChange={(e) => setArticleType(e.target.value as ArticleKind)}
                    className={styles.filterSelect}
                  >
                    <option value="news">News (समाचार)</option>
                    <option value="opinion">Opinion (विचार)</option>
                    <option value="interview">Interview (साक्षात्कार)</option>
                    <option value="analysis">Analysis (विश्लेषण)</option>
                    <option value="photo_story">Photo Story (फ़ोटो स्टोरी)</option>
                  </select>
                </div>

                <div className={styles.fieldBlock}>
                  <label htmlFor="pub-language" className={styles.fieldLabel}>
                    Language
                  </label>
                  <select
                    id="pub-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'hi' | 'en')}
                    className={styles.filterSelect}
                  >
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className={styles.fieldBlock}>
                <label htmlFor="pub-datetime" className={styles.fieldLabel}>
                  Publish Date &amp; Time (IST)
                </label>
                <input
                  id="pub-datetime"
                  type="datetime-local"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className={styles.textInput}
                />
              </div>

              {/* Editorial Toggles */}
              <div style={{ marginTop: 12 }}>
                <div className={styles.toggleRow}>
                  <div className={styles.toggleMeta}>
                    <strong>Featured Article</strong>
                    <small>Pin in Editors&apos; Picks hero carousel</small>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isFeatured}
                    onClick={() => setIsFeatured((v) => !v)}
                    className={`${styles.switchBtn} ${isFeatured ? styles.switchBtnOn : ''}`}
                  >
                    <span className={styles.switchThumb} />
                  </button>
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleMeta}>
                    <strong>Breaking News</strong>
                    <small>Show red breaking badge &amp; alert (6h auto-expiry)</small>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isBreaking}
                    onClick={() => setIsBreaking((v) => !v)}
                    className={`${styles.switchBtn} ${isBreaking ? styles.switchBtnOn : ''}`}
                  >
                    <span className={styles.switchThumb} />
                  </button>
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleMeta}>
                    <strong>Homepage Featured / Trending</strong>
                    <small>Include in top trending news ticker</small>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isTrending}
                    onClick={() => setIsTrending((v) => !v)}
                    className={`${styles.switchBtn} ${isTrending ? styles.switchBtnOn : ''}`}
                  >
                    <span className={styles.switchThumb} />
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Preview & Danger Zone when editing existing article */}
            {initialDoc.id && (
              <section className={styles.editorCard}>
                <h2 className={styles.editorCardTitle}>
                  <span>Article Shortcuts</span>
                </h2>
                <div className={styles.publishActionStack}>
                  <Link
                    href={
                      status === 'published'
                        ? `/${selectedCategorySlug}/${slug}-${initialDoc.id}`
                        : `/preview/${initialDoc.id}`
                    }
                    target="_blank"
                    className={styles.fullWidthGhostBtn}
                    style={{ textDecoration: 'none' }}
                  >
                    <Eye size={15} />
                    <span>{status === 'published' ? 'Open Live Article' : 'Open Draft Preview'}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('Delete this article permanently?')) return
                      const res = await fetch(`/api/articles/${initialDoc.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      })
                      if (res.ok) {
                        router.push('/admin/collections/articles')
                      }
                    }}
                    className={`${styles.fullWidthGhostBtn}`}
                    style={{ color: '#DC2626', borderColor: '#FECACA' }}
                  >
                    <Trash2 size={15} />
                    <span>Delete Article</span>
                  </button>
                </div>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
