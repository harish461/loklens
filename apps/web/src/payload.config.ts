import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
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

const editorsCanQueue = ({ req }: { req: { user?: unknown } }) => isEditorOrAdmin(req.user as MaybeUser)

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  secret: process.env.PAYLOAD_SECRET || '',
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' – LokLens News Admin' },
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      // LokLens dashboard (read-only numbers, see components/admin). Replaces Payload's default home view only.
      views: { dashboard: { Component: '@/components/admin/DashboardView#DashboardView' } },
      // LokLens sidebar (UI only): same Payload links, built from the visible entities, so access still applies.
      Nav: '@/components/admin/AdminNav#AdminNav',
    },
  },
  collections: [Articles, Categories, Tags, Locations, Media, Videos, EPapers, Pages, Redirects, Users],
  globals: [SiteSettings, Navigation, Ticker],
  editor: newsEditor,
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
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
  telemetry: false,
})

