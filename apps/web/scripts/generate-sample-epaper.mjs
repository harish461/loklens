// One-off: writes a tiny placeholder e-paper PDF to public/mock/epaper-sample.pdf (no dependencies,
// no downloads). Latin text only — the built-in PDF fonts have no Devanagari glyphs.
// Run from the repo root: node apps/web/scripts/generate-sample-epaper.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/mock')
await mkdir(outDir, { recursive: true })

const W = 595 // A4 points
const H = 842

function pageStream(n, total) {
  const lines = [
    // red masthead band
    '0.769 0.114 0.090 rg',
    `0 ${H - 110} ${W} 110 re f`,
    'BT /F2 34 Tf 1 1 1 rg 40 ' + (H - 70) + ' Td (LokLens News) Tj ET',
    'BT /F1 13 Tf 1 1 1 rg 40 ' + (H - 95) + ' Td (Sample e-paper - placeholder PDF for development) Tj ET',
    // grey placeholder columns
    '0.96 0.965 0.957 rg',
    `40 120 245 ${H - 270} re f`,
    `310 120 245 ${H - 270} re f`,
    'BT /F1 14 Tf 0.36 0.38 0.44 rg 60 ' + (H - 180) + ` Td (Page ${n} of ${total}) Tj ET`,
    'BT /F1 12 Tf 0.36 0.38 0.44 rg 60 ' + (H - 205) + ' Td (Real editions are uploaded as PDFs in the CMS.) Tj ET',
    'BT /F1 10 Tf 0.36 0.38 0.44 rg 40 80 Td (loklensnews.com) Tj ET',
  ]
  return lines.join('\n')
}

const PAGES = 2
const objects = []
// 1 catalog, 2 pages tree, 3 font Helvetica, 4 font Helvetica-Bold, then (page, content) pairs
objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
const kids = Array.from({ length: PAGES }, (_, i) => `${5 + i * 2} 0 R`).join(' ')
objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${PAGES} >>`
objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
for (let i = 0; i < PAGES; i++) {
  const pageId = 5 + i * 2
  const stream = pageStream(i + 1, PAGES)
  objects[pageId] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
    `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`
  objects[pageId + 1] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
}

let pdf = '%PDF-1.4\n'
const offsets = []
for (let id = 1; id < objects.length; id++) {
  offsets[id] = Buffer.byteLength(pdf)
  pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
}
const xref = Buffer.byteLength(pdf)
pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

const file = path.join(outDir, 'epaper-sample.pdf')
await writeFile(file, pdf, 'latin1')
console.log('Wrote', file, Buffer.byteLength(pdf), 'bytes')
