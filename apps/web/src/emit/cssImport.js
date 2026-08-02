/* Reading a design system back out of a stylesheet.
 *
 * This is inference, not parsing, and the difference matters. A stylesheet
 * records what someone typed, not what they meant: fifty greys with no
 * structure, three near-identical blues, spacing that is mostly multiples of
 * four with a stray 13px. The job is to find the intent underneath and be
 * honest about the confidence.
 *
 * So nothing here applies itself. Everything is offered with a count of how
 * often it appeared, because frequency is the best evidence available that a
 * value was a decision rather than an accident.
 */
import { parseColor, toHex, toOklchObj } from '../color/convert.js'

/* Strip comments and string literals first — a hex inside a `content:` string
   or a commented-out block is not part of the system. */
const clean = css => css
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, m => (/[,{]/.test(m) ? ' ' : m))

const COLOUR_RE = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch|color)\([^)]*\)/gi
const FAMILY_RE = /font-family\s*:\s*([^;}]+)/gi
const RADIUS_RE = /border-radius\s*:\s*([^;}]+)/gi
const SPACE_RE = /(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*([^;}]+)/gi
const SIZE_RE = /font-size\s*:\s*([^;}]+)/gi

const tally = () => new Map()
const bump = (m, k, by = 1) => m.set(k, (m.get(k) ?? 0) + by)
const ranked = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))

/** Everything a stylesheet can honestly tell us about a system. */
export function readCss(source) {
  const css = clean(source)

  /* ── Colours ──
     Normalised to hex so `#FFF`, `#ffffff` and `rgb(255,255,255)` count as one
     colour rather than three. Fully transparent values are dropped: they carry
     no hue and would crowd out real ones. */
  const colours = tally()
  for (const raw of css.match(COLOUR_RE) ?? []) {
    const c = parseColor(raw.trim())
    if (!c || c.alpha === 0) continue
    bump(colours, toHex({ ...c, alpha: 1 }).toLowerCase())
  }

  /* ── Families ──
     The first name in each stack is the intent; the rest is fallback. */
  const families = tally()
  for (const m of css.matchAll(FAMILY_RE)) {
    const first = m[1].split(',')[0].trim().replace(/^["']|["']$/g, '')
    if (!first || first.startsWith('var(') || /^(inherit|initial|unset|revert)$/i.test(first)) continue
    bump(families, first)
  }

  /* ── Dimensions ──
     Shorthands are split, so `padding: 8px 16px` counts both. Zero and
     percentages are dropped — neither tells you anything about a scale. */
  const px = (map, decl) => {
    for (const part of decl.trim().split(/\s+/)) {
      const n = /^(-?\d*\.?\d+)px$/.exec(part)
      if (!n) continue
      const v = Math.abs(parseFloat(n[1]))
      if (v > 0 && v <= 256) bump(map, v)
    }
  }
  const spacing = tally(), radii = tally(), sizes = tally()
  for (const m of css.matchAll(SPACE_RE)) px(spacing, m[1])
  for (const m of css.matchAll(RADIUS_RE)) px(radii, m[1])
  for (const m of css.matchAll(SIZE_RE)) px(sizes, m[1])

  const byCount = m => [...m.entries()].sort((a, b) => b[1] - a[1])

  return {
    colours: rankColours(colours),
    families: ranked(families).slice(0, 12),
    /* The most-used step is the likeliest base unit — a system's base appears
       far more often than any of its multiples. */
    spacingBase: guessBase(byCount(spacing)),
    radiusBase: byCount(radii)[0]?.[0] ?? null,
    fontBase: guessFontBase(byCount(sizes)),
    counts: { colours: colours.size, families: families.size, spacing: spacing.size },
  }
}

/* Rank colours by usefulness, not just frequency: a saturated colour used
   twice is more likely to be the brand than a grey used two hundred times.
   Greys are kept but listed after, since one of them is probably the neutral
   seed. */
function rankColours(map) {
  const out = []
  for (const [hex, count] of map) {
    const c = parseColor(hex)
    if (!c) continue
    const { l, c: chroma } = toOklchObj(c)
    out.push({ value: hex, count, chroma: +chroma.toFixed(3), light: +l.toFixed(3), grey: chroma < 0.03 })
  }
  /* Chromatic first, by frequency; then greys, mid-lightness first — a mid
     grey makes a better neutral seed than near-black or near-white. */
  const chromatic = out.filter(c => !c.grey).sort((a, b) => b.count - a.count || b.chroma - a.chroma)
  const greys = out.filter(c => c.grey).sort((a, b) => Math.abs(a.light - 0.5) - Math.abs(b.light - 0.5))
  return [...chromatic.slice(0, 18), ...greys.slice(0, 8)]
}

/* A spacing base divides most of the observed values. Test the small
   candidates and pick whichever explains the most of what's there. */
function guessBase(entries) {
  if (!entries.length) return null
  const total = entries.reduce((n, [, c]) => n + c, 0)
  let best = null, bestScore = 0
  for (const base of [2, 4, 5, 6, 8]) {
    const score = entries.reduce((n, [v, c]) => n + (v % base === 0 ? c : 0), 0) / total
    /* Prefer the largest base that still explains most values — 8 explains
       less than 4 by definition, so it only wins when it genuinely fits. */
    if (score >= 0.7 && score * base > bestScore) { bestScore = score * base; best = base }
  }
  return best
}

/* Body size, not the most common size — headings repeat too. Take the most
   frequent value in the range body text actually occupies. */
function guessFontBase(entries) {
  const body = entries.filter(([v]) => v >= 13 && v <= 18)
  return body[0]?.[0] ?? entries[0]?.[0] ?? null
}
