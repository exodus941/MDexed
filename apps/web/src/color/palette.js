/* Palette generation.

   Works in OKLCH and generates by harmony rather than by random RGB, so the
   results are usable rather than merely varied. Locked seeds anchor the run:
   the base hue is taken from what you've kept, and everything unlocked is
   placed relative to it.

   Status colours are constrained to the hue bands people actually read as
   success, warning and danger — a "random" green success colour that lands on
   teal stops communicating. */
import { fromOklch, toOklchObj, toGamut, toHex, parseColor } from './convert.js'

export const HARMONIES = [
  { id: 'analogous',     label: 'Analogous',     offsets: [0, 28, -28, 52, -52, 76] },
  { id: 'complementary', label: 'Complementary', offsets: [0, 180, 22, 202, -22, 158] },
  { id: 'split',         label: 'Split comp.',   offsets: [0, 150, 210, 30, 180, 120] },
  { id: 'triadic',       label: 'Triadic',       offsets: [0, 120, 240, 60, 180, 300] },
  { id: 'tetradic',      label: 'Tetradic',      offsets: [0, 90, 180, 270, 45, 225] },
  { id: 'monochrome',    label: 'Monochrome',    offsets: [0, 0, 0, 0, 0, 0] },
  { id: 'free',          label: 'Free',          offsets: null },
]

/* How far the generator is willing to go.

   The old behaviour was Balanced and nothing else: every run landed at
   mid-lightness, mid-chroma, and a neutral so close to grey it may as well
   have been grey. Pleasant, and incapable of producing a system with any
   nerve.

   `neutralChroma` is the consequential one. The neutral scale is what `bg`,
   `surface` and every border resolve to, so it — not the accent — decides
   whether the page reads as white-with-a-blue-button or as a blue room. At
   Vivid it carries enough chroma to be a colour in its own right. */
export const INTENSITIES = [
  { id: 'muted',    label: 'Muted',    chroma: [0.045, 0.10], neutralChroma: [0.002, 0.008], light: [0.52, 0.64] },
  { id: 'balanced', label: 'Balanced', chroma: [0.11, 0.19],  neutralChroma: [0.004, 0.018], light: [0.48, 0.62] },
  { id: 'vivid',    label: 'Vivid',    chroma: [0.19, 0.30],  neutralChroma: [0.022, 0.060], light: [0.44, 0.60] },
]

/* Hue bands a colour has to sit in to still read as its meaning. */
const ROLE_HUE_BAND = {
  success: [130, 165],
  warning: [62, 92],
  danger: [18, 40],
  positive: [130, 165],
  caution: [62, 92],
  negative: [18, 40],
}

const NEUTRAL_NAMES = new Set(['neutral', 'muted', 'surface-tint', 'grey', 'gray'])

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const wrap = h => ((h % 360) + 360) % 360

/**
 * @param seeds    current seed list (each may carry `locked`)
 * @param harmony  id from HARMONIES
 * @returns a map of seed id → new hex, for unlocked seeds only
 */
export function generatePalette(seeds, harmony = 'analogous', intensity = 'balanced') {
  const scheme = HARMONIES.find(h => h.id === harmony) ?? HARMONIES[0]
  const int = INTENSITIES.find(i => i.id === intensity) ?? INTENSITIES[1]

  /* Anchor on a locked colour if there is one — that's the point of locking.
     Prefer a chromatic lock over a neutral, which carries no usable hue. */
  const lockedColours = seeds
    .filter(s => s.locked)
    .map(s => ({ seed: s, ok: toOklchObj(parseColor(s.hex) ?? parseColor('#888888')) }))
  const anchor = lockedColours.find(l => l.ok.c > 0.04 && !NEUTRAL_NAMES.has(l.seed.name))
  const baseHue = anchor ? anchor.ok.h : rand(0, 360)

  /* Keep the overall saturation and weight of a locked palette rather than
     drifting away from it. */
  /* A lock still dictates the weight of the run, but the intensity setting
     bounds it — otherwise picking Vivid with a muted colour locked would
     quietly do nothing. */
  const baseChroma = anchor
    ? Math.max(int.chroma[0], Math.min(int.chroma[1] * 1.2, anchor.ok.c))
    : rand(...int.chroma)
  const baseLight = anchor
    ? Math.max(0.40, Math.min(0.70, anchor.ok.l))
    : rand(...int.light)

  const out = {}
  let step = 0

  for (const seed of seeds) {
    if (seed.locked) continue
    const name = (seed.name ?? '').toLowerCase()

    if (NEUTRAL_NAMES.has(name)) {
      /* Neutrals aren't grey — a trace of the accent hue keeps a palette
         feeling like one family rather than a colour plus some grey. How much
         of a trace is the intensity setting's job, and at Vivid it stops being
         a trace: this is the seed the page background is built from, so a
         saturated one is what makes a deep-blue or oxblood UI possible at all. */
      out[seed.id] = toHex(toGamut(fromOklch({
        l: rand(0.46, 0.56),
        c: rand(...int.neutralChroma),
        h: wrap(baseHue + rand(-12, 12)),
      })))
      continue
    }

    const band = ROLE_HUE_BAND[name]
    if (band) {
      /* Status colours follow the intensity too, but never drop so low they
         stop reading as a signal. */
      out[seed.id] = toHex(toGamut(fromOklch({
        l: rand(0.50, 0.60),
        c: Math.max(0.10, rand(...int.chroma) * 0.9),
        h: rand(band[0], band[1]),
      })))
      continue
    }

    const offset = scheme.offsets
      ? scheme.offsets[step % scheme.offsets.length] + rand(-6, 6)
      : rand(0, 360)
    /* Monochrome varies weight instead of hue, or every slot comes out
       identical. */
    const mono = scheme.id === 'monochrome'
    out[seed.id] = toHex(toGamut(fromOklch({
      l: mono ? baseLight + (step % 2 ? 1 : -1) * rand(0.06, 0.16) : baseLight + rand(-0.07, 0.07),
      c: mono ? baseChroma * rand(0.55, 1.15) : baseChroma * rand(0.8, 1.2),
      h: wrap(baseHue + offset),
    })))
    step++
  }

  return out
}

/** Slots offered when adding a seat to the palette. */
export const PALETTE_SLOTS = [
  'accent', 'secondary', 'tertiary', 'neutral',
  'success', 'warning', 'danger', 'info', 'highlight', 'link',
]
