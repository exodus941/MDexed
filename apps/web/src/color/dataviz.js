/* ── A CHART PALETTE, DERIVED FROM THE SEEDS ──
 *
 * Every open-spec system measured against this one publishes three chart
 * scales and ours published none. A builder charting anything therefore
 * invented a palette, and the one thing certain about an invented palette is
 * that it does not follow the brand.
 *
 * Three scales, because they answer three different questions.
 *
 *   CATEGORICAL   which series is this        no order, all one weight
 *   SEQUENTIAL    how much of one thing       one hue, light to dark
 *   DIVERGING     how far either side of zero two hues around a pale middle
 *
 * ── THE ORDER IS FIXED, AND THAT IS THE POINT ──
 *
 * Series one is always the same colour. Two charts of the same data then
 * agree, and a legend learned on one page still reads on the next. A palette
 * that assigns colours by iteration order gives a different picture every time
 * the data is sorted.
 *
 * ── WHY THE GOLDEN ANGLE ──
 *
 * Eight hues at 45 degrees apart look evenly spaced on a colour wheel and are
 * not evenly spaced to an eye: the yellow-green region is perceptually narrow
 * and swallows two of them. Stepping by 137.508 degrees never revisits a
 * region until the whole circle is covered, so any PREFIX of the sequence is
 * well spread. A chart with three series gets three colours as far apart as
 * three colours can be, and the fourth does not disturb them.
 *
 * ── AND WHY THE LIGHTNESS CYCLES THROUGH FOUR ──
 *
 * Hue alone is not enough. Roughly one man in twelve cannot separate two of
 * the hues this sequence produces, and no rotation fixes that. What survives
 * is LIGHTNESS, so the sequence cycles through four levels rather than sitting
 * at one.
 *
 * Four, and not two, and not eight. Measured across the default and all six
 * presets, worst pair of the eight, with the red-green axis removed:
 *
 *   two levels    0.003     the two colours are the same colour
 *   FOUR LEVELS   0.019
 *   eight levels  0.053     but lightness then rises monotonically, and a
 *                           categorical scale that climbs reads as a rank
 *
 * Varying chroma as well was tried and does not help: alternating it took the
 * same worst pair to 0.013 and cost 0.030 of ordinary separation.
 *
 * ── SO STATE THE LIMIT ──
 *
 * 0.019 is under two just-noticeable differences. No eight-colour categorical
 * palette is safe without red-green vision, this one included, and saying so
 * is worth more than a claim nobody measured. That is the reason a chart never
 * encodes a series by colour alone. The palette makes the picture readable and
 * the direct label makes it certain.
 *
 * ── ONE SET, BOTH THEMES ──
 *
 * The four levels span the middle of the range, clear of a light page at 0.97
 * and a dark one at 0.20. So series three is the same colour in both themes,
 * and a legend learned in one reads in the other. The palest series has 0.11
 * of lightness between it and a light page, which is a fill and not a line:
 * every series takes a hairline in the page's own border colour, and then the
 * palest one still has an edge.
 */

import { parseColor, toHex, toGamut, fromOklch, toOklchObj, inGamut } from './convert.js'
import { RAMP_STEPS } from './ramp.js'

/** Fixed count. Eight series is where a legend stops being readable. */
export const CATEGORICAL_COUNT = 8

/** Degrees. The golden angle, 360 / phi^2. */
const GOLDEN_ANGLE = 137.508

/**
 * Four lightness levels, cycling. Series i takes level i mod 4, so two series
 * share a level only when they are four apart in the sequence, which is 190
 * degrees of hue.
 */
export const LIGHTNESS_LEVELS = [0.52, 0.64, 0.76, 0.86]

/**
 * The floor a neighbouring pair must clear, in OKLab units.
 *
 * A just-noticeable difference for a large filled area is about 0.02 there, so
 * this is roughly four of them: two wedges that touch read as two colours
 * rather than as one gradient. It is a perceptual constant, not a number tuned
 * until the shipped presets passed. `neighbourDistances` reports the measured
 * minimum so a palette that fails says so.
 */
export const NEIGHBOUR_FLOOR = 0.10

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Distance in OKLab. Chroma and hue are polar, so convert before subtracting. */
export function oklabDistance(aHex, bHex) {
  const a = toOklchObj(parseColor(aHex))
  const b = toOklchObj(parseColor(bHex))
  const rad = d => (d * Math.PI) / 180
  const ax = a.c * Math.cos(rad(a.h ?? 0)), ay = a.c * Math.sin(rad(a.h ?? 0))
  const bx = b.c * Math.cos(rad(b.h ?? 0)), by = b.c * Math.sin(rad(b.h ?? 0))
  return Math.hypot(a.l - b.l, ax - bx, ay - by)
}

/**
 * The largest chroma sRGB holds at this lightness and hue, by bisection.
 *
 * Asking for one chroma at every hue does not give one weight: sRGB carries
 * far more chroma in blue than in yellow, so a flat request comes back clamped
 * at some hues and not others, and the yellow series looks washed beside the
 * blue one. Taking a FRACTION of each hue's own ceiling gives eight colours
 * that read at the same strength.
 */
function maxChroma(l, h) {
  let lo = 0, hi = 0.4
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(fromOklch({ l, c: mid, h }))) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * How saturated the brand is, as a fraction of what its own lightness allows.
 * A muted seed gives a muted chart and a vivid one gives a vivid chart, which
 * is the whole reason to derive rather than to ship a fixed set.
 */
function seedSaturation(seedHex) {
  const s = toOklchObj(parseColor(seedHex))
  const ceiling = maxChroma(s.l, s.h ?? 0)
  if (!ceiling) return 0.7
  /* Floored, because eight hues at a near-zero chroma are eight greys. A
     neutral brand still needs a chart somebody can read. */
  return clamp(s.c / ceiling, 0.45, 1)
}

/**
 * @param {string} accentHex
 * @returns {string[]} CATEGORICAL_COUNT colours, in a fixed order, for both themes
 */
export function categorical(accentHex) {
  const seed = toOklchObj(parseColor(accentHex))
  const sat = seedSaturation(accentHex)
  const out = []
  for (let i = 0; i < CATEGORICAL_COUNT; i++) {
    /* Series one IS the brand hue, so the first swatch of every chart in the
       system is the colour the reader already associates with it. */
    const h = ((seed.h ?? 0) + i * GOLDEN_ANGLE) % 360
    const l = LIGHTNESS_LEVELS[i % LIGHTNESS_LEVELS.length]
    out.push(toHex(toGamut(fromOklch({ l, c: maxChroma(l, h) * sat, h }))))
  }
  return out
}

/**
 * One hue, light to dark. Nine steps, which is the ramp with its two extremes
 * dropped: step 50 is indistinguishable from the page and 950 from the text.
 * Use as many as the data has bins, taken from the light end.
 */
export function sequential(ramp) {
  return RAMP_STEPS.filter(s => s !== 50 && s !== 950).map(s => ramp.steps[s])
}

/**
 * Two hues meeting at a pale middle. Nine steps, so the middle is the fifth
 * and a reader can point at zero.
 *
 * The ends are DANGER and ACCENT rather than danger and success. Success at
 * one end states that the positive direction is good, which is true of profit
 * and false of a temperature anomaly. Where your data is a gain and a loss,
 * pass the success ramp instead and say so in the legend.
 */
export function diverging(lowRamp, highRamp, neutralRamp) {
  const low = [700, 600, 500, 400].map(s => lowRamp.steps[s])
  const mid = neutralRamp.steps[100]
  const high = [400, 500, 600, 700].map(s => highRamp.steps[s])
  return [...low, mid, ...high]
}

/**
 * EVERY pair, not only the adjacent ones. Two series that are not neighbours
 * in the legend still touch in a pie, and a stacked bar puts any two together
 * the moment a category is empty. The neighbour list alone reported 0.238 on a
 * set whose worst real pair is 0.130.
 */
export function worstPair(colors) {
  let worst = { distance: Infinity, a: -1, b: -1 }
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = oklabDistance(colors[i], colors[j])
      if (d < worst.distance) worst = { distance: d, a: i, b: j }
    }
  }
  return worst
}

/** Adjacent pairs only, kept because a legend is read in order. */
export function neighbourDistances(colors) {
  const out = []
  for (let i = 1; i < colors.length; i++) out.push(oklabDistance(colors[i - 1], colors[i]))
  return out
}

/**
 * What is left of a pair once red-green is gone: lightness, and the
 * blue-yellow component. A projection rather than a simulation, onto the axis
 * that actually survives.
 */
export function withoutRedGreen(aHex, bHex) {
  const proj = hex => {
    const o = toOklchObj(parseColor(hex))
    return [o.l, o.c * Math.sin(((o.h ?? 0) * Math.PI) / 180)]
  }
  const [al, ab] = proj(aHex), [bl, bb] = proj(bHex)
  return Math.hypot(al - bl, ab - bb)
}

/**
 * @returns {{ categorical: string[], sequential: string[], diverging: string[], worst: object, worstWithoutRedGreen: number }}
 */
export function buildDataviz(seeds, ramps) {
  const accentHex = seeds.find(s => s.name === 'accent')?.hex ?? '#1771bf'
  const cat = categorical(accentHex)
  let cvd = Infinity
  for (let i = 0; i < cat.length; i++) {
    for (let j = i + 1; j < cat.length; j++) cvd = Math.min(cvd, withoutRedGreen(cat[i], cat[j]))
  }
  return {
    categorical: cat,
    sequential: sequential(ramps.accent),
    diverging: diverging(ramps.danger, ramps.accent, ramps.neutral),
    worst: worstPair(cat),
    worstWithoutRedGreen: cvd,
  }
}
