import {
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import type { Block, Field, RichTextField, TextField } from 'payload'

import { EMBED_PROVIDERS, isAllowedEmbed, isAllowedLinkUrl, sanitizeRichTextHook } from '../hooks/sanitizeRichText'

/** Social / video embed (contract §5). Rendered as a click-to-load facade on the web. */
export const EmbedBlock: Block = {
  slug: 'embed',
  interfaceName: 'EmbedBlock',
  labels: { singular: 'Embed', plural: 'Embeds' },
  fields: [
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: Object.keys(EMBED_PROVIDERS).map((p) => ({ label: p, value: p })),
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
        isAllowedEmbed(siblingData?.provider, value) || 'URL must be an https link on the selected provider’s domain.',
    },
  ],
}

/** Inline "read also" card pointing at another article (contract §5 relatedArticle → ArticleCard). */
export const RelatedArticleBlock: Block = {
  slug: 'relatedArticle',
  interfaceName: 'RelatedArticleBlock',
  labels: { singular: 'Related article', plural: 'Related articles' },
  fields: [{ name: 'article', type: 'relationship', relationTo: 'articles', required: true }],
}

/** Editor limited to the node types allowed by contract §5. */
export const newsEditor = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    LinkFeature({
      enabledCollections: ['articles', 'pages'],
      fields: ({ defaultFields }) =>
        defaultFields.map((f) =>
          'name' in f && f.name === 'url'
            ? ({
                ...(f as TextField),
                validate: (value: unknown, options: { siblingData?: Record<string, unknown> }) =>
                  options?.siblingData?.linkType === 'internal' ||
                  isAllowedLinkUrl(value) ||
                  'Only http(s), mailto: and tel: links are allowed.',
              } as Field)
            : f,
        ),
    }),
    UploadFeature({
      enabledCollections: ['media'],
      collections: {
        media: { fields: [{ name: 'caption', type: 'text' }] },
      },
    }),
    BlocksFeature({ blocks: [EmbedBlock, RelatedArticleBlock] }),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
})

export function richTextField(name: string, required = false): RichTextField {
  return {
    name,
    type: 'richText',
    required,
    editor: newsEditor,
    hooks: { beforeChange: [sanitizeRichTextHook] },
  }
}
