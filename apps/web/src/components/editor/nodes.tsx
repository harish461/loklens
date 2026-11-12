'use client'

/**
 * Custom Lexical nodes for NewsEditor.
 * - UploadNode: Payload's `upload` node (image from the Media collection), stored in Payload's exact shape.
 * - OpaqueNode: any node the editor can't edit (embeds, related-article blocks); kept verbatim.
 */
import { DecoratorBlockNode, type SerializedDecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getNodeByKey,
  DecoratorNode,
  type EditorConfig,
  type ElementFormatType,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import { createContext, useContext, type JSX } from 'react'

import { newNodeId, type JsonNode, type MediaInfo } from './payloadLexical'
import styles from './editor.module.css'

/** id → image info, provided by NewsEditor so upload nodes can show their picture. */
export const MediaContext = createContext<Map<string, MediaInfo>>(new Map())

export interface UploadData {
  id: string
  relationTo: string
  value: number | string | null
  fields?: { caption?: string } | null
  pending?: unknown
}

export type SerializedUploadNode = Spread<UploadData & { type: 'upload'; version: number }, SerializedDecoratorBlockNode>

function UploadView({ nodeKey, data }: { nodeKey: NodeKey; data: UploadData }) {
  const media = useContext(MediaContext)
  const [editor] = useLexicalComposerContext()
  const info = data.value !== null ? media.get(String(data.value)) : undefined
  const caption = data.fields?.caption || info?.caption || ''
  const remove = () =>
    editor.update(() => {
      $getNodeByKey(nodeKey)?.remove()
    })
  return (
    <figure className={styles.upload} contentEditable={false}>
      {info?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- CMS media preview inside the editor
        <img src={info.url} alt={info.alt} className={styles.uploadImg} />
      ) : (
        <div className={styles.uploadMissing}>Image #{String(data.value)}</div>
      )}
      {caption && <figcaption className={styles.uploadCaption}>{caption}</figcaption>}
      <button type="button" className={styles.uploadRemove} onClick={remove} aria-label="Remove image">
        ×
      </button>
    </figure>
  )
}

export class UploadNode extends DecoratorBlockNode {
  __data: UploadData

  static getType(): string {
    return 'upload'
  }

  static clone(node: UploadNode): UploadNode {
    return new UploadNode(node.__data, node.__format, node.__key)
  }

  constructor(data: UploadData, format?: ElementFormatType, key?: NodeKey) {
    super(format, key)
    this.__data = data
  }

  static importJSON(serialized: SerializedLexicalNode & Record<string, unknown>): UploadNode {
    const json = serialized as unknown as SerializedUploadNode
    const { id, relationTo, value, fields, pending } = json
    const node = new UploadNode({ id, relationTo, value, fields, ...(pending !== undefined ? { pending } : {}) })
    node.setFormat(json.format)
    return node
  }

  exportJSON(): SerializedUploadNode {
    return { ...super.exportJSON(), ...this.getLatest().__data, type: 'upload', version: 3 } as SerializedUploadNode
  }

  decorate(): JSX.Element {
    return <UploadView nodeKey={this.getKey()} data={this.__data} />
  }
}

export function $createUploadNode(mediaId: number, caption?: string): UploadNode {
  return new UploadNode({
    id: newNodeId(),
    relationTo: 'media',
    value: mediaId,
    fields: caption?.trim() ? { caption: caption.trim() } : null,
  })
}

export type SerializedOpaqueNode = Spread<{ raw: JsonNode; inline: boolean }, SerializedLexicalNode>

/** Keeps content this editor cannot edit (embeds, related articles…) exactly as stored. */
export class OpaqueNode extends DecoratorNode<JSX.Element> {
  __raw: JsonNode
  __inline: boolean

  static getType(): string {
    return 'opaque'
  }

  static clone(node: OpaqueNode): OpaqueNode {
    return new OpaqueNode(node.__raw, node.__inline, node.__key)
  }

  constructor(raw: JsonNode, inline: boolean, key?: NodeKey) {
    super(key)
    this.__raw = raw
    this.__inline = inline
  }

  static importJSON(json: SerializedOpaqueNode): OpaqueNode {
    return new OpaqueNode(json.raw, json.inline)
  }

  exportJSON(): SerializedOpaqueNode {
    return { type: 'opaque', version: 1, raw: this.__raw, inline: this.__inline }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement(this.__inline ? 'span' : 'div')
  }

  updateDOM(): false {
    return false
  }

  isInline(): boolean {
    return this.__inline
  }

  decorate(): JSX.Element {
    const raw = this.__raw as { type?: string; fields?: { blockType?: string; provider?: string } }
    const label =
      raw.fields?.blockType === 'embed'
        ? `${raw.fields.provider ?? 'Social'} embed`
        : raw.fields?.blockType === 'relatedArticle'
          ? 'Related article'
          : `${raw.type ?? 'Content'} block`
    return (
      <span className={styles.opaque} contentEditable={false} title="Kept as is. An editor can change it in the admin.">
        {label} · kept as is
      </span>
    )
  }
}

export function $isUploadNode(node: LexicalNode | null | undefined): node is UploadNode {
  return node instanceof UploadNode
}
