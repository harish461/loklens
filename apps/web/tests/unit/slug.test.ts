import { describe, expect, it } from 'vitest'

import {
  SLUG_MAX_LENGTH,
  applySchwaDeletion,
  isValidSlug,
  slugifyTitle,
  toSlug,
  transliterateHindi,
  withSuffix,
} from '../../src/lib/slug/transliterate'

describe('slugifyTitle – real LokLens headlines', () => {
  it('CM Dhami Haldwani headline', () => {
    const slug = slugifyTitle(
      'मुख्यमंत्री पुष्कर सिंह धामी ने हल्द्वानी में व्यापारियों एवं उद्योग प्रतिनिधियों के साथ किया संवाद',
    )
    expect(slug).toBe('mukhyamantri-pushkar-singh-dhami-haldvani-vyapariyon-udyog-pratinidhiyon-sath')
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    expect(isValidSlug(slug)).toBe(true)
  })

  it('Ranikhet Youth Congress headline', () => {
    expect(slugifyTitle('रानीखेत में युवा कांग्रेस की बैठक, नई नियुक्तियां घोषित')).toBe(
      'ranikhet-yuva-kangres-baithak-nai-niyuktiyan-ghoshit',
    )
  })

  it('Gairsain headline with Latin letters, decimals and a hyphenated compound', () => {
    expect(slugifyTitle('गैरसैंण में CM धामी ने 231.91 करोड़ की 12 योजनाओं का किया लोकार्पण-शिलान्यास')).toBe(
      'gairsain-cm-dhami-231-91-karor-12-yojnaon-kiya-lokarpan-shilanyas',
    )
  })
})

describe('slugifyTitle – category names from architecture §2', () => {
  it.each([
    ['देश', 'desh'],
    ['प्रदेश', 'pradesh'],
    ['राजनीति', 'rajniti'],
    ['समाज', 'samaj'],
    ['खेल', 'khel'],
    ['दुनिया', 'duniya'],
    ['विचार', 'vichar'],
  ])('%s → %s', (name, slug) => {
    expect(slugifyTitle(name)).toBe(slug)
  })
})

describe('transliteration rules', () => {
  it.each([
    ['संवाद', 'samvad'],
    ['सिंह', 'singh'],
    ['विधानसभा', 'vidhansabha'],
    ['सरकार', 'sarkar'],
    ['कमल', 'kamal'],
    ['भारतीय', 'bhartiya'],
    ['मंत्र', 'mantra'],
    ['फ़िल्म', 'philm'],
    ['अल्मोड़ा', 'almora'],
    ['पिथौरागढ़', 'pithauragarh'],
    ['उत्तराखंड', 'uttarakhand'],
    ['ज्ञान', 'gyan'],
    ['ऋषि', 'rishi'],
    ['२०२६', '2026'],
  ])('%s → %s', (hindi, latin) => {
    expect(toSlug(transliterateHindi(hindi))).toBe(latin)
  })

  it('handles decomposed nukta input the same as precomposed', () => {
    expect(transliterateHindi('ड़')).toBe(transliterateHindi('ड़'))
  })

  it('schwa deletion inserts a virama only where the vowel is silent', () => {
    expect(applySchwaDeletion('राजनीति')).toBe('राज्नीति')
    expect(applySchwaDeletion('व')).toBe('व')
  })
})

describe('slug helpers', () => {
  it('drops Hindi stop words but never everything', () => {
    expect(slugifyTitle('के')).toBe('ke')
  })

  it('cuts at a word boundary within the limit', () => {
    expect(toSlug('alpha beta gamma delta', 12)).toBe('alpha-beta')
  })

  it('hard-cuts a single overlong word', () => {
    expect(toSlug('a'.repeat(100))).toHaveLength(SLUG_MAX_LENGTH)
  })

  it('normalises English titles', () => {
    expect(slugifyTitle('  Hello, World! 2026  ')).toBe('hello-world-2026')
  })

  it('returns an empty string when nothing usable remains', () => {
    expect(slugifyTitle('!!!')).toBe('')
    expect(slugifyTitle('')).toBe('')
  })

  it('withSuffix keeps the limit', () => {
    const s = withSuffix('x'.repeat(80), 12)
    expect(s.endsWith('-12')).toBe(true)
    expect(s.length).toBeLessThanOrEqual(80)
    expect(withSuffix('desh', 2)).toBe('desh-2')
  })

  it.each(['desh', 'cm-dhami-142', 'a1'])('accepts %s', (s) => expect(isValidSlug(s)).toBe(true))
  it.each(['Desh', 'desh-', '-desh', 'de--sh', 'देश', 'de sh', 'rss.xml', ''])('rejects "%s"', (s) =>
    expect(isValidSlug(s)).toBe(false),
  )
})
