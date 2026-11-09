import Sanscript from '@indic-transliteration/sanscript'

/**
 * Hindi (Devanagari) → Latin slug transliteration.
 *
 * Uses @indic-transliteration/sanscript (Devanagari → ITRANS) and simplifies the result into
 * readable, ASCII-only Hindi romanisation:
 *  - Hindi schwa deletion, applied on the Devanagari before transliteration:
 *      word-final:  संवाद → samvad (kept after conjuncts ending in र/य/व: छात्र → chhatra, and in -iya: क्षत्रिय → kshatriya)
 *      medial (VC_CV, left to right): राजनीति → rajniti, योजनाओं → yojnaon, विधानसभा → vidhansabha
 *  - nukta letters are folded (ड़ → r, ढ़ → rh, ज़ → j, फ़ → ph, …)
 *  - long vowels / retroflex capitals are lower-cased: A → a, I → i, T → t, Sh → sh
 *  - anusvara becomes "m" before labials (p/b/m/v), "n" elsewhere, "ng" in सिंह → singh
 *  - common Hindi function words (ने, में, की, …) are removed to keep slugs short
 * The result is lowercase, hyphen-separated, [a-z0-9-] only and capped at SLUG_MAX_LENGTH,
 * cut on a word boundary. Editors can always override it.
 */

export const SLUG_MAX_LENGTH = 80
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const DEVANAGARI = /[ऀ-ॿ]/
const VIRAMA = '्'

const isConsonant = (ch: string) => /[क-हक़-य़]/.test(ch)
const isMatra = (ch: string) => /[ा-ौॢॣ]/.test(ch)
const isModifier = (ch: string) => /[ँ-ः]/.test(ch) // chandrabindu, anusvara, visarga
const isIndependentVowel = (ch: string) => /[ऄ-औॠॡ]/.test(ch)

/** Hindi function words dropped from auto-generated slugs (only when other words remain). */
export const HINDI_STOP_WORDS = new Set([
  'ने', 'में', 'मे', 'की', 'का', 'के', 'को', 'से', 'पर', 'और', 'एवं', 'एवम्', 'व', 'तथा', 'है', 'हैं',
  'था', 'थी', 'थे', 'भी', 'तो', 'ही', 'लिए', 'द्वारा', 'या',
])

/** Folds nukta letters to plain ones; keeps ड़/ढ़ as single precomposed consonants for schwa rules. */
function foldNukta(text: string): string {
  return text
    .replace(/ड़/g, 'ड़') // ड + ़ → ड़ (precomposed)
    .replace(/ढ़/g, 'ढ़') // ढ + ़ → ढ़
    .replace(/क़|क़/g, 'क') // क़ → क
    .replace(/ख़|ख़/g, 'ख') // ख़ → ख
    .replace(/ग़|ग़/g, 'ग') // ग़ → ग
    .replace(/ज़|ज़/g, 'ज') // ज़ → ज
    .replace(/फ़|फ़/g, 'फ') // फ़ → फ
    .replace(/य़|य़/g, 'य') // य़ → य
    .replace(/़/g, '') // any other nukta
}

/** After schwa deletion: ड़ → र, ढ़ → र्ह (as single sounds). */
function foldFlaps(text: string): string {
  return text.replace(/ड़/g, 'र').replace(/ढ़/g, 'र्ह')
}

interface Unit {
  text: string
  consonants: number
  matra: string
  modifier: boolean
  vowelLetter: boolean
  endsWithVirama: boolean
}

/** Splits a Devanagari word into aksharas (consonant cluster + matra + modifiers, or a vowel letter). */
function toUnits(word: string): Unit[] | null {
  const units: Unit[] = []
  for (const ch of word) {
    const last = units[units.length - 1]
    if (isConsonant(ch)) {
      if (last && last.endsWithVirama) {
        last.text += ch
        last.consonants++
        last.endsWithVirama = false
      } else {
        units.push({ text: ch, consonants: 1, matra: '', modifier: false, vowelLetter: false, endsWithVirama: false })
      }
    } else if (isIndependentVowel(ch)) {
      units.push({ text: ch, consonants: 0, matra: '', modifier: false, vowelLetter: true, endsWithVirama: false })
    } else if (ch === VIRAMA && last) {
      last.text += ch
      last.endsWithVirama = true
    } else if (isMatra(ch) && last) {
      last.text += ch
      last.matra = ch
    } else if (isModifier(ch) && last) {
      last.text += ch
      last.modifier = true
    } else {
      return null // unexpected character: leave the word untouched
    }
  }
  return units
}

/** A unit that still carries the inherent "a" (no matra, no virama, not a vowel letter). */
const hasInherentA = (u: Unit) => !u.vowelLetter && !u.matra && !u.endsWithVirama

/** Applies Hindi schwa deletion by inserting a virama where the inherent "a" is silent. */
export function applySchwaDeletion(word: string): string {
  const units = toUnits(word)
  if (!units || units.length < 2) return word
  const n = units.length
  const deleted = new Array<boolean>(n).fill(false)

  // Word-final schwa: silent, except after a conjunct (मंत्र) or in -iya (भारतीय, क्षत्रिय).
  const last = units[n - 1]
  const prev = units[n - 2]
  if (hasInherentA(last) && !last.modifier) {
    // Conjuncts ending in र/य/व keep the vowel (mantra, karya); others drop it (film, dharm).
    const conjunct = last.consonants > 1 && /[रयव]$/.test(last.text)
    const iya = last.text === 'य' && (prev.matra === 'ि' || prev.matra === 'ी')
    if (!conjunct && !iya) deleted[n - 1] = true
  }

  // Medial schwa (VC_CV), left to right: single bare consonant between two vowel-bearing units.
  const keepsVowel = (i: number) =>
    units[i].vowelLetter || Boolean(units[i].matra) || units[i].modifier || (hasInherentA(units[i]) && !deleted[i])
  for (let i = 1; i < n - 1; i++) {
    const u = units[i]
    if (!hasInherentA(u) || u.modifier || u.consonants !== 1) continue
    const next = units[i + 1]
    if (next.vowelLetter || next.consonants === 0) continue
    if (keepsVowel(i - 1) && keepsVowel(i + 1)) deleted[i] = true
  }

  return units.map((u, i) => (deleted[i] ? u.text + VIRAMA : u.text)).join('')
}

/** ITRANS → simplified ASCII. Order matters: longest tokens first. */
const ITRANS_MAP: Array<[RegExp, string]> = [
  [/RRI|RRi|R\^i/g, 'ri'],
  [/LLI|LLi|L\^i/g, 'li'],
  [/j~n|GY/g, 'gy'],
  [/~N|~n/g, 'n'],
  [/\.N/g, 'n'], // chandrabindu
  [/\.n/g, 'n'],
  [/\.h/g, ''], // explicit virama
  [/\.a/g, ''], // avagraha
  [/OM/g, 'om'],
  [/kSh|x/g, 'ksh'],
  [/Ch/g, 'chh'],
  [/Sh|shh/g, 'sh'],
  [/Th/g, 'th'],
  [/Dh/g, 'dh'],
  [/M(?=[pbmvw])/g, 'm'],
  [/M(?=h\b)/g, 'ng'], // सिंह → singh
  [/M(?=N)/g, ''], // ंण → n
  [/M/g, 'n'],
  [/H/g, 'h'], // visarga
  [/A|aa/g, 'a'],
  [/I|ii/g, 'i'],
  [/U|uu/g, 'u'],
  [/T/g, 't'],
  [/D/g, 'd'],
  [/N/g, 'n'],
  [/E/g, 'e'],
  [/O/g, 'o'],
  [/w/g, 'v'],
]

function devanagariRunToLatin(run: string): string {
  let latin: string = Sanscript.t(run, 'devanagari', 'itrans')
  for (const [re, rep] of ITRANS_MAP) latin = latin.replace(re, rep)
  return latin
}

/** Transliterates free Hindi/English text to a simplified Latin string (not yet slugified). */
export function transliterateHindi(input: string): string {
  let text = foldNukta(input.normalize('NFC'))
  text = text.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966)) // Devanagari digits
  text = text.replace(/[।॥]/g, ' ') // danda
  text = text.replace(/[ऀ-ॿ]+/g, (word) => foldFlaps(applySchwaDeletion(word)))
  // Transliterate only Devanagari runs so Latin text (e.g. "CM") is not reinterpreted as ITRANS.
  const out = text.replace(/[ऀ-ॿ]+/g, devanagariRunToLatin)
  return out.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

/** Collapses any string into a URL-safe slug, cut at a word boundary to `maxLength`. */
export function toSlug(input: string, maxLength = SLUG_MAX_LENGTH): string {
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  let slug = ''
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word
    if (next.length > maxLength) break
    slug = next
  }
  // A single word longer than the limit: hard cut.
  if (!slug && words.length > 0) slug = words[0].slice(0, maxLength)
  return slug
}

/**
 * Generates a slug from a (usually Hindi) title.
 * Returns '' when nothing usable remains (caller should then require a manual slug).
 */
export function slugifyTitle(title: string, maxLength = SLUG_MAX_LENGTH): string {
  if (!title) return ''
  const words = title.normalize('NFC').split(/[\s,;:!?"'“”‘’()[\]{}|/]+/).filter(Boolean)
  const filtered = DEVANAGARI.test(title) ? removeStopWords(words) : words
  return toSlug(transliterateHindi(filtered.join(' ')), maxLength)
}

function removeStopWords(words: string[]): string[] {
  const kept = words.filter((w) => !HINDI_STOP_WORDS.has(w))
  return kept.length > 0 ? kept : words
}

export function isValidSlug(slug: unknown, maxLength = SLUG_MAX_LENGTH): slug is string {
  return typeof slug === 'string' && slug.length <= maxLength && SLUG_PATTERN.test(slug)
}

/** Appends -2, -3, … to make `base` unique, keeping within maxLength. */
export function withSuffix(base: string, n: number, maxLength = SLUG_MAX_LENGTH): string {
  const suffix = `-${n}`
  const head = base.slice(0, maxLength - suffix.length).replace(/-+$/, '')
  return `${head}${suffix}`
}
