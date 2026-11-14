
import fs from 'node:fs'
import path from 'node:path'
import { createReadStream } from 'node:fs'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const bucket = process.env.S3_BUCKET
const region = process.env.S3_REGION
const endpoint = process.env.S3_ENDPOINT
const accessKeyId = process.env.S3_ACCESS_KEY_ID
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

const backupDir = path.resolve(
  process.cwd(),
  'loklens-media-backup-20261113-130725',
  'images',
)

const expectedFiles = 53

for (const [name, value] of Object.entries({
  S3_BUCKET: bucket,
  S3_REGION: region,
  S3_ENDPOINT: endpoint,
  S3_ACCESS_KEY_ID: accessKeyId,
  S3_SECRET_ACCESS_KEY: secretAccessKey,
})) {
  if (!value) throw new Error(`Missing environment variable: ${name}`)
}

if (!fs.existsSync(backupDir)) {
  throw new Error(`Backup directory not found: ${backupDir}`)
}

const files = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(fullPath)
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
}

walk(backupDir)

if (files.length !== expectedFiles) {
  throw new Error(
    `Expected ${expectedFiles} backup files, found ${files.length}. Stopping.`,
  )
}

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
})

let uploaded = 0
let skipped = 0

for (const file of files) {
  const relativePath = path.relative(backupDir, file).split(path.sep).join('/')
  const key = `images/${relativePath}`
  const stat = fs.statSync(file)

  try {
    const existing = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    )

    if (existing.ContentLength !== stat.size) {
      throw new Error(
        `Existing object has a different size: ${key}. Stopping safely.`,
      )
    }

    console.log(`SKIPPED (already exists): ${key}`)
    skipped++
    continue
  } catch (error) {
    if (error.message?.includes('different size')) throw error

    const status = error.$metadata?.httpStatusCode
    const missing =
      status === 404 ||
      error.name === 'NotFound' ||
      error.name === 'NoSuchKey'

    if (!missing) throw error
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(file),
      ContentLength: stat.size,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  console.log(`UPLOADED: ${key}`)
  uploaded++
}

for (const file of files) {
  const relativePath = path.relative(backupDir, file).split(path.sep).join('/')
  const key = `images/${relativePath}`
  const stat = fs.statSync(file)

  const result = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key }),
  )

  if (result.ContentLength !== stat.size) {
    throw new Error(`Verification failed: ${key}`)
  }
}

console.log('\nMigration upload completed.')
console.log(`Expected files: ${files.length}`)
console.log(`Uploaded: ${uploaded}`)
console.log(`Already present: ${skipped}`)
console.log('All uploaded files passed size verification.')

client.destroy()
