'use client'

/**
 * Rich-text editor for article bodies. Built on Lexical (the engine Payload's editor uses) and reads/writes
 * exactly the JSON Payload stores (see payloadLexical.ts), so the admin and the public site render it
 * unchanged. Supports what the content rules allow (contract §5, fields/richText.ts): H2/H3 (the title is
 * the page H1), bold, italic, lists, links, quotes and images from the Media library.
 */
import { $createLinkNode, $isLinkNode, $toggleLink, AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $findMatchingParent, $getNearestNodeOfType, $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type EditorState,
} from 'lexical'
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Undo2,
  Unlink,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isAllowedLinkUrl } from '@/hooks/sanitizeRichText'

import { $createUploadNode, MediaContext, OpaqueNode, UploadNode } from './nodes'
import { LinkStash, fromEditorJSON, toEditorJSON, type JsonNode, type MediaInfo } from './payloadLexical'
import styles from './editor.module.css'

export interface EditorMediaOption {
  id: number
  url: string
  alt: string
  caption?: string
}

export interface NewsEditorProps {
  /** Stored Payload Lexical value (`{ root }`) or empty for a new article. */
  initialValue?: unknown
  onChange: (value: { root: JsonNode }) => void
  /** Images the user may insert (their media library). */
  media: EditorMediaOption[]
  /** Uploads an image and returns the new media item, or an error message. */
  onUploadImage: (file: File, alt: string, caption: string) => Promise<EditorMediaOption | string>
  placeholder?: string
  /** Labels the editable area for screen readers. */
  ariaLabel?: string
}

/** Lexical node set: what Payload's newsEditor stores, plus our upload/opaque nodes. */
export const EDITOR_NODES = [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, UploadNode, OpaqueNode]

export const EDITOR_THEME = {
  paragraph: styles.p,
  heading: { h2: styles.h2, h3: styles.h3, h4: styles.h4 },
  quote: styles.quote,
  list: { ul: styles.ul, ol: styles.ol, listitem: styles.li, nested: { listitem: styles.nestedLi } },
  link: styles.link,
  text: { bold: styles.bold, italic: styles.italic, underline: styles.underline },
}

type BlockType = 'paragraph' | 'h2' | 'h3' | 'quote' | 'ul' | 'ol' | 'other'

function Toolbar({
  media,
  onUploadImage,
  onMediaAdded,
}: Pick<NewsEditorProps, 'media' | 'onUploadImage'> & { onMediaAdded: (m: EditorMediaOption) => void }) {
  const [editor] = useLexicalComposerContext()
  const [block, setBlock] = useState<BlockType>('paragraph')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [inLink, setInLink] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [panel, setPanel] = useState<null | 'link' | 'image'>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNewTab, setLinkNewTab] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [imgAlt, setImgAlt] = useState('')
  const [imgCaption, setImgCaption] = useState('')
  const [imgBusy, setImgBusy] = useState(false)
  const [imgError, setImgError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const readSelection = useCallback(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    setBold(selection.hasFormat('bold'))
    setItalic(selection.hasFormat('italic'))
    const anchor = selection.anchor.getNode()
    setInLink(Boolean($findMatchingParent(anchor, $isLinkNode)))
    const top = anchor.getKey() === 'root' ? anchor : anchor.getTopLevelElementOrThrow()
    if ($isListNode(top)) {
      const list = $getNearestNodeOfType(anchor, ListNode)
      setBlock((list ?? top).getListType() === 'number' ? 'ol' : 'ul')
    } else if ($isHeadingNode(top)) setBlock(top.getTag() === 'h2' ? 'h2' : top.getTag() === 'h3' ? 'h3' : 'other')
    else if ($isQuoteNode(top)) setBlock('quote')
    else setBlock(top.getType() === 'paragraph' ? 'paragraph' : 'other')
  }, [])

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => editorState.read(readSelection)),
        editor.registerCommand(SELECTION_CHANGE_COMMAND, () => (readSelection(), false), COMMAND_PRIORITY_LOW),
        editor.registerCommand(CAN_UNDO_COMMAND, (v) => (setCanUndo(v), false), COMMAND_PRIORITY_LOW),
        editor.registerCommand(CAN_REDO_COMMAND, (v) => (setCanRedo(v), false), COMMAND_PRIORITY_LOW),
      ),
    [editor, readSelection],
  )

  const setBlockType = (type: 'paragraph' | 'h2' | 'h3' | 'quote') =>
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      $setBlocksType(selection, () =>
        type === 'paragraph' ? $createParagraphNode() : type === 'quote' ? $createQuoteNode() : $createHeadingNode(type),
      )
    })

  const toggleList = (type: 'ul' | 'ol') => {
    if (block === type) editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    else editor.dispatchCommand(type === 'ul' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined)
  }

  function openLink() {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      const link = $isRangeSelection(selection) ? $findMatchingParent(selection.anchor.getNode(), $isLinkNode) : null
      setLinkUrl(link?.getURL() ?? 'https://')
      setLinkNewTab(link?.getTarget() === '_blank')
    })
    setLinkError(null)
    setPanel(panel === 'link' ? null : 'link')
  }

  function applyLink() {
    const url = linkUrl.trim()
    if (!isAllowedLinkUrl(url)) {
      setLinkError('Use a full https:// link, a site path like /pradesh, mailto: or tel:.')
      return
    }
    const target = linkNewTab ? '_blank' : null
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      const existing = $findMatchingParent(selection.anchor.getNode(), $isLinkNode)
      if (existing) {
        existing.setURL(url)
        existing.setTarget(target)
      } else if (selection.isCollapsed()) {
        // Nothing selected: insert the URL itself as the link text.
        const link = $createLinkNode(url, { target })
        link.append($createTextNode(url))
        selection.insertNodes([link])
      } else {
        $toggleLink(url, { target })
      }
    })
    setPanel(null)
  }

  const removeLink = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    setPanel(null)
  }

  function insertImage(m: EditorMediaOption, caption: string) {
    editor.update(() => {
      $insertNodeToNearestRoot($createUploadNode(m.id, caption || m.caption))
    })
    setPanel(null)
    setImgCaption('')
    setImgAlt('')
  }

  async function uploadAndInsert(file: File) {
    if (!imgAlt.trim()) {
      setImgError('Describe the image (alt text) before uploading.')
      return
    }
    setImgBusy(true)
    setImgError(null)
    const res = await onUploadImage(file, imgAlt.trim(), imgCaption.trim())
    setImgBusy(false)
    if (typeof res === 'string') {
      setImgError(res)
      return
    }
    onMediaAdded(res)
    insertImage(res, imgCaption.trim())
  }

  const btn = (active: boolean) => `${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`

  return (
    <div className={styles.toolbarWrap}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        <button type="button" className={btn(block === 'paragraph')} onClick={() => setBlockType('paragraph')} title="Paragraph" aria-pressed={block === 'paragraph'}>
          <Pilcrow size={15} />
        </button>
        <button type="button" className={btn(block === 'h2')} onClick={() => setBlockType('h2')} title="Heading (H2)" aria-pressed={block === 'h2'}>
          <Heading2 size={16} />
        </button>
        <button type="button" className={btn(block === 'h3')} onClick={() => setBlockType('h3')} title="Sub-heading (H3)" aria-pressed={block === 'h3'}>
          <Heading3 size={16} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={btn(bold)} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} title="Bold" aria-pressed={bold}>
          <Bold size={15} />
        </button>
        <button type="button" className={btn(italic)} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} title="Italic" aria-pressed={italic}>
          <Italic size={15} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={btn(block === 'ul')} onClick={() => toggleList('ul')} title="Bullet list" aria-pressed={block === 'ul'}>
          <List size={16} />
        </button>
        <button type="button" className={btn(block === 'ol')} onClick={() => toggleList('ol')} title="Numbered list" aria-pressed={block === 'ol'}>
          <ListOrdered size={16} />
        </button>
        <button type="button" className={btn(block === 'quote')} onClick={() => setBlockType(block === 'quote' ? 'paragraph' : 'quote')} title="Quote" aria-pressed={block === 'quote'}>
          <Quote size={15} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button type="button" className={btn(inLink || panel === 'link')} onClick={openLink} title="Link" aria-expanded={panel === 'link'}>
          <Link2 size={15} />
        </button>
        {inLink && (
          <button type="button" className={styles.toolBtn} onClick={removeLink} title="Remove link">
            <Unlink size={15} />
          </button>
        )}
        <button type="button" className={btn(panel === 'image')} onClick={() => setPanel(panel === 'image' ? null : 'image')} title="Insert image" aria-expanded={panel === 'image'}>
          <ImagePlus size={16} />
        </button>
        <span className={styles.spacer} />
        <button type="button" className={styles.toolBtn} disabled={!canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} title="Undo">
          <Undo2 size={15} />
        </button>
        <button type="button" className={styles.toolBtn} disabled={!canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} title="Redo">
          <Redo2 size={15} />
        </button>
      </div>

      {panel === 'link' && (
        <div className={styles.panel}>
          <label className={styles.panelLabel} htmlFor="ed-link-url">
            Link address
          </label>
          <div className={styles.panelRow}>
            <input
              id="ed-link-url"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                }
              }}
              className={styles.panelInput}
              autoFocus
            />
            <button type="button" className={styles.panelBtn} onClick={applyLink}>
              {inLink ? 'Update' : 'Add link'}
            </button>
          </div>
          <label className={styles.panelCheck}>
            <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} /> Open in a new tab
          </label>
          {linkError && <p className={styles.panelError}>{linkError}</p>}
        </div>
      )}

      {panel === 'image' && (
        <div className={styles.panel}>
          <div className={styles.panelGrid}>
            <div>
              <label className={styles.panelLabel} htmlFor="ed-img-alt">
                Alt text (required for upload)
              </label>
              <input id="ed-img-alt" value={imgAlt} onChange={(e) => setImgAlt(e.target.value)} className={styles.panelInput} placeholder="चित्र का विवरण" />
            </div>
            <div>
              <label className={styles.panelLabel} htmlFor="ed-img-caption">
                Caption
              </label>
              <input id="ed-img-caption" value={imgCaption} onChange={(e) => setImgCaption(e.target.value)} className={styles.panelInput} placeholder="चित्र का कैप्शन" />
            </div>
          </div>
          <div className={styles.panelRow}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadAndInsert(f)
                e.target.value = ''
              }}
            />
            <button type="button" className={styles.panelBtn} onClick={() => fileRef.current?.click()} disabled={imgBusy}>
              {imgBusy ? 'Uploading…' : 'Upload new image'}
            </button>
          </div>
          {imgError && <p className={styles.panelError}>{imgError}</p>}
          {media.length > 0 && (
            <>
              <p className={styles.panelLabel}>Or pick one of your images</p>
              <div className={styles.mediaGrid}>
                {media.map((m) => (
                  <button key={m.id} type="button" className={styles.mediaPick} onClick={() => insertImage(m, imgCaption.trim())} title={m.alt}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- CMS thumbnail */}
                    <img src={m.url} alt={m.alt} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function NewsEditor({ initialValue, onChange, media, onUploadImage, placeholder, ariaLabel }: NewsEditorProps) {
  const stash = useMemo(() => new LinkStash(), [])
  const [mediaInfo, setMediaInfo] = useState(() => {
    const map = new Map<string, MediaInfo>()
    for (const m of media) map.set(String(m.id), { url: m.url, alt: m.alt, caption: m.caption })
    return map
  })
  const [library, setLibrary] = useState(media)

  // Built once: Lexical reads the initial state only on mount.
  const [initialConfig] = useState(() => {
    const found = new Map<string, MediaInfo>()
    const state = toEditorJSON(initialValue, stash, (id, info) => found.set(String(id), info))
    if (found.size) setTimeout(() => setMediaInfo((prev) => new Map([...found, ...prev])), 0)
    return {
      namespace: 'loklens-news',
      theme: EDITOR_THEME,
      nodes: EDITOR_NODES,
      editorState: JSON.stringify(state),
      onError: (error: Error) => {
        throw error
      },
    }
  })

  const handleChange = useCallback(
    (state: EditorState) => onChange(fromEditorJSON(state.toJSON() as unknown as { root: JsonNode }, stash)),
    [onChange, stash],
  )

  const addMedia = (m: EditorMediaOption) => {
    setLibrary((prev) => [m, ...prev.filter((x) => x.id !== m.id)])
    setMediaInfo((prev) => new Map(prev).set(String(m.id), { url: m.url, alt: m.alt, caption: m.caption }))
  }

  return (
    <MediaContext.Provider value={mediaInfo}>
      <LexicalComposer initialConfig={initialConfig}>
        <div className={styles.editor}>
          <Toolbar media={library} onUploadImage={onUploadImage} onMediaAdded={addMedia} />
          <div className={styles.surface}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className={styles.content}
                  aria-label={ariaLabel ?? 'Article body'}
                  aria-placeholder={placeholder ?? ''}
                  placeholder={<div className={styles.placeholder}>{placeholder}</div>}
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin validateUrl={isAllowedLinkUrl} />
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        </div>
      </LexicalComposer>
    </MediaContext.Provider>
  )
}
