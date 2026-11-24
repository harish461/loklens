import path from 'path'
import { fileURLToPath } from 'url'

import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import { en } from '@payloadcms/translations/languages/en'
import { buildConfig, type Config } from 'payload'
import sharp from 'sharp'

import { isEditorOrAdmin, type MaybeUser } from './access'
import { Articles } from './collections/Articles'
import { Categories } from './collections/Categories'
import { EPapers } from './collections/EPapers'
import { Locations } from './collections/Locations'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Redirects } from './collections/Redirects'
import { Tags } from './collections/Tags'
import { AppUsers } from './collections/AppUsers'
import { Users } from './collections/Users'
import { Videos } from './collections/Videos'
import { newsEditor } from './fields/richText'
import { Navigation } from './globals/Navigation'
import { SiteSettings } from './globals/SiteSettings'
import { Ticker } from './globals/Ticker'
import { hi } from './i18n/hi'
import { expireBreakingTask } from './jobs/expireBreaking'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // e-paper PDFs; images are capped at 10 MB in Media

function resolveDatabasePoolConfig(): {
  connectionString: string
  ssl?: boolean | { rejectUnauthorized: boolean }
} {
  const url = process.env.DATABASE_URL?.trim() || ''
  if (process.env.NODE_ENV === 'production' && !url) {
    throw new Error(
      '[LokLens] Missing required environment variable DATABASE_URL in production. ' +
        'Configure DATABASE_URL in your hosting environment variables.',
    )
  }
  if (!url) {
    return { connectionString: '' }
  }
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'db'
    if (process.env.NODE_ENV === 'production' && isLocal) {
      console.warn(
        '[LokLens] Warning: DATABASE_URL points to localhost in production. ' +
          'Ensure DATABASE_URL points to your external PostgreSQL database on managed hosting.',
      )
    }
    const isSupabase = host.endsWith('.supabase.co') || host.endsWith('.supabase.com')
    const sslMode = parsed.searchParams.get('sslmode')
    if (sslMode === 'disable') {
      return { connectionString: url, ssl: false }
    }
    if (isSupabase || (!isLocal && (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'no-verify'))) {
      if ((sslMode === 'require' || sslMode === 'prefer') && !parsed.searchParams.has('uselibpqcompat')) {
        parsed.searchParams.set('uselibpqcompat', 'true')
      }
      return {
        connectionString: parsed.toString(),
        ssl: { rejectUnauthorized: false },
      }
    }
  } catch {
    // Let pg handle non-URL connection strings if used
  }
  return { connectionString: url }
}

const S3_ENV_NAMES = ['S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const
type S3EnvName = (typeof S3_ENV_NAMES)[number]

const S3_DEFAULTS: Partial<Record<S3EnvName, string>> = {
  S3_BUCKET: 'loklens-media',
  S3_REGION: 'ap-northeast-2',
  S3_ENDPOINT: 'https://sfsfwcyrnddxjlrvuakf.storage.supabase.co/storage/v1/s3',
}

/**
 * Reads the Supabase S3 settings (trimmed). If any is missing the S3 plugin is disabled and Payload falls
 * back to the local disk - on managed hosting that disk is empty/ephemeral, so every media URL fails with a
 * generic 500. Log the missing variable NAMES (never values) at boot so this is obvious in the server logs.
 */
function resolveS3Env(): { enabled: boolean; env: Record<S3EnvName, string> } {
  const env = Object.fromEntries(
    S3_ENV_NAMES.map((name) => [name, process.env[name]?.trim() || S3_DEFAULTS[name] || '']),
  ) as Record<S3EnvName, string>
  const missing = S3_ENV_NAMES.filter((name) => !env[name])
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error(
      `[LokLens] S3 media storage is DISABLED - missing environment variable(s): ${missing.join(', ')}. ` +
        'Media files will be read from local disk and existing images will fail to load. ' +
        'Set these variables in the hosting environment and restart the app.',
    )
  }
  return { enabled: missing.length === 0, env }
}

const s3 = resolveS3Env()

/** Nodemailer adapter from the existing SMTP_* settings; undefined (dev logging) when not configured. */
function smtpEmailAdapter() {
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim()
  const user = (process.env.SMTP_USER || 'newsloklens@gmail.com').trim()
  if (!pass) return undefined
  const port = Number(process.env.SMTP_PORT || 465)
  return nodemailerAdapter({
    defaultFromAddress: user,
    defaultFromName: 'लोक Lens न्यूज़',
    transportOptions: {
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port,
      secure: port === 465,
      auth: { user, pass },
    },
  })
}

const editorsCanQueue = ({ req }: { req: { user?: unknown } }) => isEditorOrAdmin(req.user as MaybeUser)

export default buildConfig({
  // In development, omit serverURL so Payload uses relative URLs (/api/..., /admin/...) that work
  // seamlessly on both http://localhost:3000 and LAN IPs (http://192.168.1.15:3000) without cross-origin CSRF issues.
  serverURL: process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_SITE_URL || undefined : undefined,
  secret: process.env.PAYLOAD_SECRET || '',
  // Password-reset emails for app customers. Uses the same SMTP account as the contact form; without SMTP
  // settings Payload falls back to logging the message (development).
  email: smtpEmailAdapter(),
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' – LokLens News Admin' },
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      graphics: {
        Logo: '@/components/admin/AdminBranding#AdminLogo',
        Icon: '@/components/admin/AdminBranding#AdminIcon',
      },
      // LokLens dashboard (Eduplex-inspired Hindi News CMS home view).
      views: {
        dashboard: { Component: '@/components/admin/DashboardView#DashboardView' },
        subcategories: {
          Component: '@/components/admin/AdminSectionView#SubcategoriesView',
          path: '/subcategories',
          exact: true,
        },
        authors: {
          Component: '@/components/admin/AdminSectionView#AuthorsView',
          path: '/authors',
          exact: true,
        },
        breakingNews: {
          Component: '@/components/admin/AdminSectionView#BreakingNewsView',
          path: '/breaking-news',
          exact: true,
        },
        comments: {
          Component: '@/components/admin/AdminSectionView#CommentsView',
          path: '/comments',
          exact: true,
        },
        advertisements: {
          Component: '@/components/admin/AdminSectionView#AdvertisementsView',
          path: '/advertisements',
          exact: true,
        },
        seo: {
          Component: '@/components/admin/AdminSectionView#SeoView',
          path: '/seo',
          exact: true,
        },
        analytics: {
          Component: '@/components/admin/AdminSectionView#AnalyticsView',
          path: '/analytics',
          exact: true,
        },
        // Reporter workflow (architecture §8): role-checked server-side inside each view.
        review: {
          Component: '@/components/admin/ReviewViews#ReviewQueueView',
          path: '/review',
          exact: true,
        },
        reporters: {
          Component: '@/components/admin/ReviewViews#ReportersView',
          path: '/reporters',
          exact: true,
        },
      },
      // LokLens sidebar: dark navy SaaS sidebar with lime-green active states and all 15 CMS modules.
      Nav: '@/components/admin/AdminNav#AdminNav',
    },
  },
  collections: [Articles, Categories, Tags, Locations, Media, Videos, EPapers, Pages, Redirects, Users, AppUsers],
  globals: [SiteSettings, Navigation, Ticker],
  plugins: [
    s3Storage({
      enabled: s3.enabled,
      collections: {
        media: {
          prefix: 'images',
          disableLocalStorage: true,
          // Keep Payload's server-side file proxy enabled.
          // Do not set disablePayloadAccessControl: true.
        },
      },
      bucket: s3.env.S3_BUCKET,
      config: {
        credentials: {
          accessKeyId: s3.env.S3_ACCESS_KEY_ID,
          secretAccessKey: s3.env.S3_SECRET_ACCESS_KEY,
        },
        region: s3.env.S3_REGION,
        endpoint: s3.env.S3_ENDPOINT || undefined,
        forcePathStyle: true,
      },
    }),
  ],
  editor: newsEditor,
  db: postgresAdapter({
    pool: resolveDatabasePoolConfig(),
    idType: 'serial',
    // Schema changes only through migrations (src/migrations), never dev push.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    // Production containers apply pending migrations on boot.
    prodMigrations: migrations,
  }),
  sharp,
  // GraphQL is disabled (CLAUDE.md); the (payload) route group has no graphql routes either.
  graphQL: { disable: true, disablePlaygroundInProduction: true },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  upload: { limits: { fileSize: MAX_UPLOAD_BYTES } },
  i18n: {
    fallbackLanguage: 'en',
    supportedLanguages: { en, hi } as unknown as NonNullable<Config['i18n']>['supportedLanguages'],
  },
  jobs: {
    tasks: [expireBreakingTask],
    // Runs queued jobs (scheduled publish + expireBreaking) every minute inside the app process.
    autoRun: [{ cron: '* * * * *', queue: 'default', limit: 50 }],
    // Never auto-run in CLI scripts (migrate, seed, generate:types) — only in the Next server.
    shouldAutoRun: () => Boolean(process.env.NEXT_RUNTIME),
    deleteJobOnComplete: true,
    access: { queue: editorsCanQueue, run: editorsCanQueue, cancel: editorsCanQueue },
  },
  onInit: async (payload) => {
    try {
      if (s3.enabled) {
        await payload.db.drizzle.execute(
          `UPDATE "media" SET "prefix" = 'images' WHERE "prefix" IS NULL OR "prefix" = '';`,
        )
      }
      // Backfill generic image alt text with the linked article's Hindi headline
      await payload.db.drizzle.execute(`
        UPDATE "media" m
        SET "alt" = a."title"
        FROM "articles" a
        WHERE a."featured_image_id" = m."id"
          AND (m."alt" IS NULL OR m."alt" = '' OR m."alt" = 'उत्तराखंड समाचार फ़ोटो');
      `)
    } catch {
      // Ignore if table not yet migrated
    }
  },
  telemetry: false,
})

