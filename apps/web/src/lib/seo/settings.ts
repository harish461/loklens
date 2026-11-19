import config from '@payload-config'
import { getPayload } from 'payload'

export interface CategorySeoEntry {
  slug: string
  name: string
  metaTitle: string
  metaDescription: string
}

export interface GlobalSeoSettings {
  titleSuffix: string
  homeMetaTitle: string
  homeMetaDescription: string
  defaultOgImageUrl: string
  defaultOgImageId?: number | null
  googleSiteVerification: string
  categories: Record<string, { metaTitle: string; metaDescription: string }>
}

export const DEFAULT_CATEGORY_SEO: Record<string, { name: string; metaTitle: string; metaDescription: string }> = {
  pradesh: {
    name: 'प्रदेश',
    metaTitle: 'उत्तराखंड प्रदेश समाचार (Uttarakhand News in Hindi) — ताज़ा खबरें',
    metaDescription:
      'उत्तराखंड के सभी 13 जिलों (अल्मोड़ा, रानीखेत, देहरादून, नैनीताल, हल्द्वानी, हरिद्वार, गैरसैंण) की ताज़ा और विश्वसनीय हिंदी खबरें।',
  },
  desh: {
    name: 'देश',
    metaTitle: 'देश समाचार (National News in Hindi) — भारत की ताज़ा खबरें',
    metaDescription:
      'भारत की प्रमुख राष्ट्रीय खबरें, संसद, केंद्र सरकार की योजनाएं, आर्थिक सुधार और देश भर के ताज़ा समाचार हिंदी में।',
  },
  rajniti: {
    name: 'राजनीति',
    metaTitle: 'राजनीति समाचार (Politics News in Hindi) — सियासी विश्लेषण व चुनाव खबरें',
    metaDescription:
      'उत्तराखंड और देश की राजनीति, विधानसभा व लोकसभा सत्र, राजनीतिक दलों के बयान और चुनावी हलचल की सटीक रिपोर्टिंग।',
  },
  samaj: {
    name: 'समाज',
    metaTitle: 'समाज एवं जनसरोकार (Society & Community News in Hindi)',
    metaDescription:
      'जनसरोकार, संस्कृति, शिक्षा, स्वास्थ्य, पर्यावरण और सामाजिक मुद्दों से जुड़ी जमीनी खबरें व विशेष रिपोर्ट।',
  },
  khel: {
    name: 'खेल',
    metaTitle: 'खेल समाचार (Sports News in Hindi) — क्रिकेट व खेल जगत की खबरें',
    metaDescription:
      'क्रिकेट, फुटबॉल, ओलंपिक और उत्तराखंड के स्थानीय खेल टूर्नामेंटों की ताज़ा खबरें, स्कोर और खिलाड़ियों की उपलब्धियां।',
  },
  duniya: {
    name: 'दुनिया',
    metaTitle: 'दुनिया समाचार (World & International News in Hindi)',
    metaDescription:
      'अंतरराष्ट्रीय खबरें, विदेश नीति, वैश्विक अर्थव्यवस्था और दुनिया भर की प्रमुख घटनाओं का हिंदी समाचार विश्लेषण।',
  },
  vichar: {
    name: 'विचार',
    metaTitle: 'विचार एवं संपादकीय (Opinion & Editorial in Hindi)',
    metaDescription:
      'समसामयिक मुद्दों पर वरिष्ठ पत्रकारों व विशेषज्ञों के लेख, संपादकीय दृष्टिकोण और गहन विश्लेषण।',
  },
}

export const DEFAULT_GLOBAL_SEO: GlobalSeoSettings = {
  titleSuffix: '| लोक Lens न्यूज़',
  homeMetaTitle: 'लोक Lens न्यूज़ — उत्तराखंड और देश की ताज़ा हिंदी खबरें | आपकी आवाज़, आपकी खबर',
  homeMetaDescription:
    'लोक Lens न्यूज़ (LokLens News) पर पढ़ें उत्तराखंड, देश, राजनीति, समाज, खेल और दुनिया की ताज़ा, निष्पक्ष और विश्वसनीय हिंदी खबरें।',
  defaultOgImageUrl: '/brand/logo-square-1024.jpg',
  defaultOgImageId: null,
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || '',
  categories: Object.fromEntries(
    Object.entries(DEFAULT_CATEGORY_SEO).map(([slug, val]) => [
      slug,
      { metaTitle: val.metaTitle, metaDescription: val.metaDescription },
    ]),
  ),
}

async function ensureSeoTable() {
  const payload = await getPayload({ config })
  await payload.db.drizzle.execute(`
    CREATE TABLE IF NOT EXISTS "loklens_seo_settings" (
      "key" text PRIMARY KEY,
      "value" jsonb NOT NULL,
      "updated_at" timestamptz DEFAULT now()
    );
  `)
  return payload
}

export async function getGlobalSeoSettings(): Promise<GlobalSeoSettings> {
  try {
    const payload = await ensureSeoTable()
    const res = (await payload.db.drizzle.execute(
      `SELECT "value" FROM "loklens_seo_settings" WHERE "key" = 'global' LIMIT 1;`,
    )) as { rows?: { value?: Partial<GlobalSeoSettings> }[] }

    const stored = res.rows?.[0]?.value ?? {}

    // Also pull category SEO values directly from the categories collection
    const catRes = await payload
      .find({
        collection: 'categories',
        limit: 50,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      .catch(() => ({ docs: [] }))

    const mergedCategories: Record<string, { metaTitle: string; metaDescription: string }> = {
      ...DEFAULT_GLOBAL_SEO.categories,
      ...(stored.categories ?? {}),
    }

    for (const c of catRes.docs) {
      const slug = String(c.slug)
      const def = DEFAULT_CATEGORY_SEO[slug]
      const dbTitle = c.seo?.metaTitle?.trim()
      const dbDesc = c.seo?.metaDescription?.trim() || c.description?.trim()
      mergedCategories[slug] = {
        metaTitle:
          dbTitle ||
          stored.categories?.[slug]?.metaTitle ||
          def?.metaTitle ||
          `${c.name} समाचार — ताज़ा हिंदी खबरें`,
        metaDescription:
          dbDesc ||
          stored.categories?.[slug]?.metaDescription ||
          def?.metaDescription ||
          `${c.name} से जुड़ी ताज़ा और विश्वसनीय हिंदी खबरें लोक Lens न्यूज़ पर पढ़ें।`,
      }
    }

    return {
      titleSuffix: stored.titleSuffix?.trim() || DEFAULT_GLOBAL_SEO.titleSuffix,
      homeMetaTitle: stored.homeMetaTitle?.trim() || DEFAULT_GLOBAL_SEO.homeMetaTitle,
      homeMetaDescription: stored.homeMetaDescription?.trim() || DEFAULT_GLOBAL_SEO.homeMetaDescription,
      defaultOgImageUrl: stored.defaultOgImageUrl?.trim() || DEFAULT_GLOBAL_SEO.defaultOgImageUrl,
      defaultOgImageId: stored.defaultOgImageId ?? DEFAULT_GLOBAL_SEO.defaultOgImageId,
      googleSiteVerification:
        stored.googleSiteVerification !== undefined
          ? stored.googleSiteVerification.trim()
          : DEFAULT_GLOBAL_SEO.googleSiteVerification,
      categories: mergedCategories,
    }
  } catch {
    return DEFAULT_GLOBAL_SEO
  }
}

export async function saveGlobalSeoSettings(
  input: Partial<GlobalSeoSettings>,
): Promise<GlobalSeoSettings> {
  const current = await getGlobalSeoSettings()
  const next: GlobalSeoSettings = {
    titleSuffix: (input.titleSuffix ?? current.titleSuffix).trim() || DEFAULT_GLOBAL_SEO.titleSuffix,
    homeMetaTitle: (input.homeMetaTitle ?? current.homeMetaTitle).trim() || DEFAULT_GLOBAL_SEO.homeMetaTitle,
    homeMetaDescription:
      (input.homeMetaDescription ?? current.homeMetaDescription).trim() || DEFAULT_GLOBAL_SEO.homeMetaDescription,
    defaultOgImageUrl:
      (input.defaultOgImageUrl ?? current.defaultOgImageUrl).trim() || DEFAULT_GLOBAL_SEO.defaultOgImageUrl,
    defaultOgImageId:
      input.defaultOgImageId !== undefined ? input.defaultOgImageId : current.defaultOgImageId,
    googleSiteVerification: (input.googleSiteVerification ?? current.googleSiteVerification).trim(),
    categories: {
      ...current.categories,
      ...(input.categories ?? {}),
    },
  }

  const payload = await ensureSeoTable()
  const jsonLiteral = JSON.stringify(next).replace(/'/g, "''")
  await payload.db.drizzle.execute(`
    INSERT INTO "loklens_seo_settings" ("key", "value", "updated_at")
    VALUES ('global', '${jsonLiteral}'::jsonb, now())
    ON CONFLICT ("key") DO UPDATE
    SET "value" = EXCLUDED."value", "updated_at" = now();
  `)

  // Sync category-level SEO titles & descriptions into the Payload `categories` table
  if (input.categories) {
    const catRes = await payload
      .find({
        collection: 'categories',
        limit: 50,
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      .catch(() => ({ docs: [] }))

    for (const doc of catRes.docs) {
      const entry = next.categories[doc.slug]
      if (!entry) continue
      await payload
        .update({
          collection: 'categories',
          id: doc.id,
          overrideAccess: true,
          context: { skipRevalidate: true },
          data: {
            seo: {
              metaTitle: entry.metaTitle.slice(0, 70),
              metaDescription: entry.metaDescription.slice(0, 200),
            },
          },
        })
        .catch(() => null)
    }
  }

  // If defaultOgImageId was provided, sync to site-settings global
  if (typeof next.defaultOgImageId === 'number' && next.defaultOgImageId > 0) {
    await payload
      .updateGlobal({
        slug: 'site-settings',
        overrideAccess: true,
        context: { skipRevalidate: true },
        data: {
          defaultImage: next.defaultOgImageId,
        },
      })
      .catch(() => null)
  }

  return next
}
