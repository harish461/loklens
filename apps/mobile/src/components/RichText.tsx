/**
 * Native renderer for Payload Lexical JSON as returned by /api/v1 (contract §5). No WebView, no HTML.
 *
 * Blocks: paragraph, heading (h1–h6), list/listitem (bullet, number, check; nested), quote, upload
 * (resolved Image), horizontalrule, block:embed ({ provider, url } → tap-to-open card), block:relatedArticle.
 * Inline: text (format bitmask 1 bold, 2 italic, 4 strikethrough, 8 underline, 16 code, 32 sub, 64 sup),
 * linebreak, tab, link/autolink.
 * Unknown nodes never crash: unknown inline nodes render their children's text; unknown blocks render
 * their children or are skipped, and each block sits behind an error boundary.
 * Text and surface colours follow the light/dark theme (article pages are black or white).
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image as ExpoImage } from 'expo-image'
import { Component, Fragment, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native'

import type { ArticleCard, Image, RichTextNode } from '@/lib/api/types'
import { openLink } from '@/lib/links'
import { colors, fonts, radius, spacing, type, useTheme } from '@/theme'

import { StoryRow } from './ArticleCards'
import { NewsImage } from './NewsImage'

const INLINE_TYPES = new Set(['text', 'linebreak', 'tab', 'link', 'autolink'])
const FORMAT = { bold: 1, italic: 2, strikethrough: 4, underline: 8, code: 16, subscript: 32, superscript: 64 }

/** Keeps one bad node from taking down the whole article. */
class NodeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    if (__DEV__) console.warn('[RichText] node failed to render', err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const isInline = (n: RichTextNode) => INLINE_TYPES.has(n.type)
const children = (n: RichTextNode): RichTextNode[] => (Array.isArray(n.children) ? n.children : [])
const formatBits = (f: unknown) => (typeof f === 'number' ? f : 0)

function alignOf(node: RichTextNode): TextStyle['textAlign'] | undefined {
  const f = node.format
  return f === 'center' || f === 'right' || f === 'justify' || f === 'left' ? f : undefined
}

function textStyle(bits: number): TextStyle {
  const s: { -readonly [K in keyof TextStyle]?: TextStyle[K] } = {}
  // Real Poppins faces for bold/italic (never fontWeight/fontStyle, which the OS fakes and blurs).
  const bold = Boolean(bits & FORMAT.bold)
  const italic = Boolean(bits & FORMAT.italic)
  if (bold || italic) s.fontFamily = bold && italic ? fonts.boldItalic : bold ? fonts.bold : fonts.italic
  const deco: string[] = []
  if (bits & FORMAT.underline) deco.push('underline')
  if (bits & FORMAT.strikethrough) deco.push('line-through')
  if (deco.length) s.textDecorationLine = deco.join(' ') as TextStyle['textDecorationLine']
  if (bits & FORMAT.code) Object.assign(s, styles.code)
  if (bits & (FORMAT.subscript | FORMAT.superscript)) s.fontSize = 12
  return s
}

function linkUrl(node: RichTextNode): string | undefined {
  const fields = (node.fields ?? {}) as { url?: unknown }
  if (typeof fields.url === 'string') return fields.url
  return typeof node.url === 'string' ? node.url : undefined
}

/** Inline content: returns nested <Text> parts (must be rendered inside a parent <Text>). */
function Inline({ nodes }: { nodes: RichTextNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return (
              <Text key={i} style={textStyle(formatBits(n.format))}>
                {typeof n.text === 'string' ? n.text : ''}
              </Text>
            )
          case 'linebreak':
            return <Text key={i}>{'\n'}</Text>
          case 'tab':
            return <Text key={i}>{'\t'}</Text>
          case 'link':
          case 'autolink': {
            const url = linkUrl(n)
            return (
              <Text key={i} style={styles.link} onPress={url ? () => openLink(url) : undefined} accessibilityRole="link">
                <Inline nodes={children(n)} />
              </Text>
            )
          }
          default:
            // Unknown inline node: keep its text, drop its behaviour.
            return children(n).length ? <Inline key={i} nodes={children(n)} /> : typeof n.text === 'string' ? <Text key={i}>{n.text}</Text> : null
        }
      })}
    </>
  )
}

function Paragraph({ node, style, heading = false }: { node: RichTextNode; style?: TextStyle; heading?: boolean }) {
  const t = useTheme()
  const kids = children(node)
  if (kids.length === 0) return null // empty paragraph = spacing only
  return (
    <Text style={[type.body, styles.block, { textAlign: alignOf(node), color: t.body }, style, heading && { color: t.text }]} selectable>
      <Inline nodes={kids} />
    </Text>
  )
}

const HEADING: Record<string, TextStyle> = {
  h1: { ...type.display },
  h2: { ...type.display, fontSize: 21, lineHeight: 32 },
  h3: { ...type.headline },
  h4: { ...type.title, fontSize: 17, lineHeight: 26 },
  h5: { ...type.title },
  h6: { ...type.title, fontSize: 15 },
}

function List({ node, depth }: { node: RichTextNode; depth: number }) {
  const t = useTheme()
  const listType = node.listType ?? (node.tag === 'ol' ? 'number' : 'bullet')
  const start = typeof node.start === 'number' ? node.start : 1
  let n = start - 1
  return (
    <View style={[styles.block, { paddingLeft: depth * spacing.lg }]}>
      {children(node).map((item, i) => {
        const nested = children(item).filter((c) => c.type === 'list')
        const content = children(item).filter((c) => c.type !== 'list')
        // A listitem that only wraps a nested list has no marker of its own (Lexical's nesting format).
        if (content.length === 0 && nested.length) {
          return nested.map((l, j) => <List key={`${i}-${j}`} node={l} depth={depth + 1} />)
        }
        n += 1
        const marker = listType === 'number' ? `${n}.` : listType === 'check' ? (item.checked ? '☑' : '☐') : '•'
        return (
          <View key={i}>
            <View style={styles.listRow}>
              <Text style={[type.body, styles.marker]}>{marker}</Text>
              <Text style={[type.body, { flex: 1, color: t.body }]} selectable>
                <Inline nodes={content.filter(isInline)} />
              </Text>
            </View>
            {nested.map((l, j) => (
              <List key={j} node={l} depth={depth + 1} />
            ))}
          </View>
        )
      })}
    </View>
  )
}

function Upload({ image }: { image: Image }) {
  const t = useTheme()
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 16 / 9
  return (
    <View style={styles.block}>
      <NewsImage image={image} size="article" style={[styles.upload, { aspectRatio: ratio }]} />
      {(image.caption || image.credit) && (
        <Text style={[type.meta, styles.caption, { color: t.muted }]}>
          {image.caption}
          {image.caption && image.credit ? ' · ' : ''}
          {image.credit ? `फ़ोटो: ${image.credit}` : ''}
        </Text>
      )}
    </View>
  )
}

const PROVIDERS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  youtube: { label: 'YouTube पर देखें', icon: 'logo-youtube', color: '#FF0000' },
  x: { label: 'X पर देखें', icon: 'logo-twitter', color: '#111214' },
  instagram: { label: 'Instagram पर देखें', icon: 'logo-instagram', color: '#C13584' },
  facebook: { label: 'Facebook पर देखें', icon: 'logo-facebook', color: '#1877F2' },
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1).split('/')[0] || null
    return u.searchParams.get('v') ?? /\/(?:embed|shorts|live)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

/** Social/video embed as a tap-to-open card (no third-party scripts, no WebView). */
function Embed({ provider, url }: { provider: string; url: string }) {
  const t = useTheme()
  const p = PROVIDERS[provider] ?? { label: 'लिंक खोलें', icon: 'open-outline' as const, color: colors.ink }
  const yt = provider === 'youtube' ? youtubeId(url) : null
  return (
    <Pressable onPress={() => openLink(url)} style={[styles.block, styles.embed, { borderColor: t.border, backgroundColor: t.surface }]} accessibilityRole="link" accessibilityLabel={p.label}>
      {yt ? (
        <View>
          <ExpoImage source={{ uri: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` }} style={styles.embedThumb} contentFit="cover" />
          <View style={styles.play}>
            <Ionicons name="play" size={26} color={colors.white} />
          </View>
        </View>
      ) : null}
      <View style={styles.embedBar}>
        <Ionicons name={p.icon} size={20} color={p.color} />
        <Text style={[type.label, { flex: 1, color: t.text }]} numberOfLines={1}>
          {p.label}
        </Text>
        <Ionicons name="open-outline" size={16} color={t.muted} />
      </View>
    </Pressable>
  )
}

function Block({ node, depth = 0 }: { node: RichTextNode; depth?: number }) {
  const t = useTheme()
  switch (node.type) {
    case 'paragraph':
      return <Paragraph node={node} />
    case 'heading': {
      const tag = typeof node.tag === 'string' ? node.tag : 'h2'
      return <Paragraph heading node={node} style={{ ...(HEADING[tag] ?? HEADING.h2), marginTop: spacing.sm }} />
    }
    case 'list':
      return <List node={node} depth={depth} />
    case 'quote':
      return (
        <View style={[styles.block, styles.quote, { backgroundColor: t.surface }]}>
          <Text style={[type.body, styles.quoteText, { color: t.text }]} selectable>
            <Inline nodes={children(node).filter(isInline)} />
          </Text>
        </View>
      )
    case 'upload': {
      const image = node.value as Image | undefined
      return image && typeof image.url === 'string' ? <Upload image={image} /> : null
    }
    case 'horizontalrule':
      return <View style={[styles.block, styles.rule, { backgroundColor: t.border }]} />
    case 'block': {
      const fields = (node.fields ?? {}) as { blockType?: string; provider?: string; url?: string; article?: ArticleCard }
      if (fields.blockType === 'embed' && typeof fields.url === 'string') return <Embed provider={fields.provider ?? ''} url={fields.url} />
      if (fields.blockType === 'relatedArticle' && fields.article?.id) {
        return (
          <View style={styles.block}>
            <Text style={[type.meta, { marginBottom: spacing.xs, color: t.muted }]}>यह भी पढ़ें</Text>
            <StoryRow article={fields.article} />
          </View>
        )
      }
      return null
    }
    default: {
      // Unknown block: render inline children as a paragraph, block children recursively, else skip.
      const kids = children(node)
      if (kids.length === 0) return null
      if (kids.every(isInline)) return <Paragraph node={node} />
      return (
        <>
          {kids.map((k, i) => (
            <Block key={i} node={k} depth={depth} />
          ))}
        </>
      )
    }
  }
}

export function RichText({ nodes }: { nodes: RichTextNode[] | null | undefined }) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  return (
    <View>
      {nodes.map((node, i) =>
        node && typeof node === 'object' && typeof node.type === 'string' ? (
          <NodeBoundary key={i}>
            <Block node={node} />
          </NodeBoundary>
        ) : (
          <Fragment key={i} />
        ),
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.lg },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  code: { fontFamily: undefined, backgroundColor: colors.surface, fontSize: 14 },
  listRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  marker: { minWidth: 18, color: colors.primary, fontFamily: fonts.bold },
  quote: { borderLeftWidth: 4, borderLeftColor: colors.primary, backgroundColor: colors.surface, borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  quoteText: { fontFamily: fonts.medium, color: colors.ink },
  upload: { width: '100%', borderRadius: radius.md },
  caption: { marginTop: spacing.xs },
  rule: { height: 1, backgroundColor: colors.border },
  embed: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.background },
  embedThumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.skeleton },
  play: { position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  embedBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
})
