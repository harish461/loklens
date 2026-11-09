// One-off: builds favicon/app icons, header logo sizes and local placeholder images from the square logo.
// Run from the repo root: node apps/web/scripts/generate-brand-assets.mjs
// Output is committed; re-run only when docs/brand/logo-square-1024.jpg changes.
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(appDir, '../../docs/brand/logo-square-1024.jpg')
const brandDir = path.join(appDir, 'public/brand')
const mockDir = path.join(appDir, 'public/mock')
const appRouteDir = path.join(appDir, 'src/app')

await mkdir(brandDir, { recursive: true })
await mkdir(mockDir, { recursive: true })

await copyFile(source, path.join(brandDir, 'logo-square-1024.jpg'))

// Header logo: 72 px desktop / 48 px mobile, 2x for high-DPI screens.
for (const px of [96, 144]) {
  await sharp(source).resize(px, px).webp({ quality: 90 }).toFile(path.join(brandDir, `logo-${px}.webp`))
}

// Next.js file-convention icons (src/app/icon.png, src/app/apple-icon.png).
await sharp(source).resize(192, 192).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(appRouteDir, 'icon.png'))
await sharp(source).resize(180, 180).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path.join(appRouteDir, 'apple-icon.png'))

// Placeholder images: light logo tint with the logo centred (stands in for the site default image).
const TINT = { r: 0xf9, g: 0xe3, b: 0xe2, alpha: 1 }
const placeholders = [
  ['ph-320x180', 320, 180],
  ['ph-640x360', 640, 360],
  ['ph-1200x675', 1200, 675],
  ['ph-1200x630', 1200, 630],
  ['ph-1200x900', 1200, 900],
  ['ph-1200x1200', 1200, 1200],
]
for (const [name, w, h] of placeholders) {
  const logoPx = Math.round(Math.min(w, h) * 0.42)
  const logo = await sharp(source).resize(logoPx, logoPx).toBuffer()
  await sharp({ create: { width: w, height: h, channels: 4, background: TINT } })
    .composite([{ input: logo, gravity: 'center' }])
    .webp({ quality: 80 })
    .toFile(path.join(mockDir, `${name}.webp`))
}

console.log('Brand assets written to', brandDir, mockDir, appRouteDir)
