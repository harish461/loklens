import { createHeadlessEditor } from '@lexical/headless'
import { describe, expect, it } from 'vitest'

import { EDITOR_NODES } from '../../src/components/editor/NewsEditor'
import { LinkStash, fromEditorJSON, toEditorJSON, type JsonNode } from '../../src/components/editor/payloadLexical'
import { hasBodyContent } from '../../src/access/workflow'
import { sanitizeLexical } from '../../src/hooks/sanitizeRichText'

/** Payload value → editor → Lexical parse/serialise → Payload value. */
function roundTrip(value: unknown): { root: JsonNode } {
  const stash = new LinkStash()
  const editor = createHeadlessEditor({ nodes: EDITOR_NODES, onError: (e) => { throw e } })
  editor.setEditorState(editor.parseEditorState(JSON.stringify(toEditorJSON(value, stash))))
  return fromEditorJSON(editor.getEditorState().toJSON() as unknown as { root: JsonNode }, stash)
}

const text = (t: string, format = 0) => ({ mode: 'normal', text: t, type: 'text', style: '', detail: 0, format, version: 1 })
const para = (...children: unknown[]) => ({
  type: 'paragraph', format: '', indent: 0, version: 1, children, direction: 'ltr', textStyle: '', textFormat: 0,
})

/** Real body copied from the dev database (written by Payload's own editor). */
const STORED = {
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: [para(text('[ड्राफ्ट — यह स्थानापन्न पाठ है। संपादक इसे असली सामग्री से बदलेंगे।]'))],
  },
}

const LINK = {
  type: 'link', format: '', indent: 0, version: 3, direction: 'ltr', textStyle: '', textFormat: 0,
  id: '6731f0a2b1c4d5e6f7a8b9c0',
  fields: { url: 'https://loklensnews.com/pradesh', newTab: true, linkType: 'custom' },
  children: [text('यहाँ पढ़ें')],
}
const INTERNAL_LINK = {
  ...LINK,
  id: '6731f0a2b1c4d5e6f7a8b9c1',
  fields: { doc: { relationTo: 'articles', value: 4 }, newTab: false, linkType: 'internal' },
}
const UPLOAD = {
  type: 'upload', format: '', version: 3, id: '6731f0a2b1c4d5e6f7a8b9c2',
  relationTo: 'media', value: 12, fields: { caption: 'देहरादून में बारिश' },
}
const EMBED = {
  type: 'block', format: '', version: 2,
  fields: { id: '6731f0a2b1c4d5e6f7a8b9c3', blockName: '', blockType: 'embed', provider: 'youtube', url: 'https://youtu.be/abc' },
}

const RICH = {
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: [
      { type: 'heading', tag: 'h2', format: '', indent: 0, version: 1, direction: 'ltr', textStyle: '', textFormat: 0, children: [text('मुख्य बातें')] },
      para(text('सामान्य '), text('बोल्ड', 1), text(' और '), text('इटैलिक', 2), text(' — '), LINK, text(' / '), INTERNAL_LINK),
      UPLOAD,
      { type: 'quote', format: '', indent: 0, version: 1, direction: 'ltr', textStyle: '', textFormat: 0, children: [text('उद्धरण')] },
      EMBED,
    ],
  },
}

function find(node: JsonNode, type: string): JsonNode[] {
  const out: JsonNode[] = node.type === type ? [node] : []
  for (const c of node.children ?? []) out.push(...find(c, type))
  return out
}

describe('NewsEditor ↔ Payload Lexical JSON', () => {
  it('round-trips a body written by Payload exactly', () => {
    expect(roundTrip(STORED)).toEqual(STORED)
  })

  it('keeps link ids and fields (custom and internal), uploads and blocks verbatim', () => {
    const out = roundTrip(RICH)
    const links = find(out.root, 'link')
    expect(links).toHaveLength(2)
    expect(links[0]).toMatchObject({ id: LINK.id, fields: LINK.fields, version: 3 })
    expect(links[0]).not.toHaveProperty('url')
    expect(links[0]).not.toHaveProperty('rel')
    expect(links[1]).toMatchObject({ id: INTERNAL_LINK.id, fields: INTERNAL_LINK.fields })
    expect(find(out.root, 'upload')[0]).toEqual(UPLOAD)
    expect(find(out.root, 'block')[0]).toEqual(EMBED)
    expect(find(out.root, 'heading')[0]).toMatchObject({ tag: 'h2' })
    const texts = find(out.root, 'text').map((t) => [t.text, t.format])
    expect(texts).toContainEqual(['बोल्ड', 1])
    expect(texts).toContainEqual(['इटैलिक', 2])
  })

  it('is stable: a second round trip changes nothing', () => {
    const once = roundTrip(RICH)
    expect(roundTrip(once)).toEqual(once)
  })

  it('unwraps populated upload values to the media id', () => {
    const populated = { root: { ...RICH.root, children: [{ ...UPLOAD, value: { id: 12, url: '/m.webp', alt: 'x' } }] } }
    expect(find(roundTrip(populated).root, 'upload')[0].value).toBe(12)
  })

  it('gives an empty editor for a new article, which counts as no body', () => {
    const out = roundTrip(undefined)
    expect(out.root.children).toHaveLength(1)
    expect(hasBodyContent(out)).toBe(false)
    expect(hasBodyContent(RICH)).toBe(true)
  })

  it('passes the save-side sanitiser unchanged', () => {
    const out = roundTrip(RICH)
    expect(sanitizeLexical(out)).toEqual(out)
  })
})
