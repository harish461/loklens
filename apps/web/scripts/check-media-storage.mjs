/**
 * READ-ONLY media storage check: confirms every media file referenced in Payload exists in the S3 bucket.
 *
 * Usage (from apps/web):
 *   node scripts/check-media-storage.mjs                         # checks https://dev.loklensnews.com
 *   node scripts/check-media-storage.mjs http://localhost:3000   # any Payload site
 *
 * Reads S3_* from the environment (or apps/web/.env if present). Only performs:
 *   - GET <site>/api/media (public read)
 *   - S3 HeadObject per key
 * It never uploads, modifies or deletes anything. Secrets are never printed.
 */
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

try {
  process.loadEnvFile('.env')
} catch {
  // No .env in cwd - rely on the process environment.
}

const SITE = (process.argv[2] || 'https://dev.loklensnews.com').replace(/\/+$/, '')
const DEFAULT_PREFIX = 'images' // must match payload.config.ts s3Storage collections.media.prefix
const NAMES = ['S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']

const env = Object.fromEntries(NAMES.map((n) => [n, process.env[n]?.trim() || '']))
const missing = NAMES.filter((n) => !env[n])
if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(', ')}`)
  process.exit(2)
}

console.log(`Site    : ${SITE}`)
console.log(`Bucket  : ${env.S3_BUCKET}`)
console.log(`Endpoint: ${env.S3_ENDPOINT}`)
console.log(`Region  : ${env.S3_REGION}\n`)

const res = await fetch(`${SITE}/api/media?limit=500&depth=0&sort=id`, { headers: { Accept: 'application/json' } })
if (!res.ok) {
  console.error(`Failed to list media from ${SITE}: HTTP ${res.status}`)
  process.exit(1)
}
const { docs = [] } = await res.json()

const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
})

const totals = { ok: 0, missing: 0, error: 0 }
const missingByDoc = new Map()

for (const doc of docs) {
  const prefix = [doc.prefix ?? DEFAULT_PREFIX, doc._objectKey].filter(Boolean).join('/')
  const filenames = new Set([doc.filename, ...Object.values(doc.sizes || {}).map((s) => s?.filename)].filter(Boolean))

  for (const filename of filenames) {
    const key = prefix ? `${prefix}/${filename}` : filename
    let status
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
      status = `OK      ${String(head.ContentLength).padStart(8)} B`
      totals.ok++
    } catch (err) {
      const code = err?.$metadata?.httpStatusCode
      if (code === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
        status = 'MISSING'
        totals.missing++
        missingByDoc.set(doc.id, [...(missingByDoc.get(doc.id) || []), key])
      } else {
        status = `ERROR   ${err?.name || 'Error'} (HTTP ${code ?? '?'})`
        totals.error++
      }
    }
    console.log(`[media ${String(doc.id).padStart(3)}] ${status}  ${key}`)
  }
}

client.destroy()

console.log(`\nMedia records: ${docs.length}`)
console.log(`Objects OK: ${totals.ok}   MISSING: ${totals.missing}   ERROR: ${totals.error}`)
if (missingByDoc.size) {
  console.log('\nMedia records with missing objects:')
  for (const [id, keys] of missingByDoc) console.log(`  media ${id}: ${keys.length} missing (e.g. ${keys[0]})`)
}
if (totals.error) {
  console.log('\nERRORs usually mean wrong/revoked credentials, endpoint, region or bucket name (403 = access denied).')
}
process.exit(totals.missing || totals.error ? 1 : 0)
