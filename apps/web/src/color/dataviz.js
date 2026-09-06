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
 * ── HOW THE EIGHT ARE PLACED ──
 *
 * Hues spread evenly across a SPAN rather than around the whole circle, with
 * series one on the accent's own hue at one end of it. Lightness cycles
 * through four levels and chroma through four factors, so two series sharing a
 * level are four apart in the sequence and 149 degrees apart in hue.
 *
 * THE PALEST LEVEL IS BOUNDED BY THE PAGE, not by taste. At 0.88 it came out
 * 0.012 DARKER than a light page measuring 0.893, so the fill read as nothing
 * at all while this file's own prose claimed 0.11 of separation. 0.78 restores
 * that gap and still clears the floor at 0.105 across the hue circle.
 *
 * Every filled series takes a hairline in the page's own border colour. The
 * gap is enough for an area and not for an edge.
 *
 * ── SO STATE THE LIMIT ──
 *
 * No eight-colour categorical palette is safe without red-green vision, this
 * one included. Saying so is worth more than a claim nobody measured, and it
 * is why a chart never encodes a series by colour alone. The palette makes the
 * picture readable and the direct label makes it certain.
 */

import { parseColor, toHex, toGamut, fromOklch, toOklchObj, inGamut } from './convert.js'
import { RAMP_STEPS } from './ramp.js'

/** Fixed count. Eight series is where a legend stops being readable. */
export const CATEGORICAL_COUNT = 8

/**
 * Four lightness levels, cycling. Series i takes level i mod 4, so two series
 * share a level only when they are four apart in the sequence, which is 149
 * degrees of hue across a 260 degree span.
 */
export const LIGHTNESS_LEVELS = [0.38, 0.68, 0.52, 0.78]

/* ── WHY THIS PALETTE LOOKED LIKE A SWATCH DRAWER ──
 *
 * It optimised separation and had no opinion about anything else, so it came
 * out maximally distinguishable and unpleasant by construction. Measured
 * against eight palettes a person picked out as agreeable, 39 swatches to our
 * 15:
 *
 *              chroma mean   chroma range   hue span   worst pair
 *   theirs           0.101      0.02-0.21   157-237°   0.058-0.195
 *   ours             0.165      0.08-0.27   240-274°   0.140-0.220
 *
 * THREE FAULTS, AND SEPARATION WAS NEVER ONE OF THEM. Ours is HIGHER than
 * every reference and ours is the one that hurts to look at.
 *
 * CHROMA AT THE GAMUT EDGE. `maxChroma` returns the most sRGB can hold at a
 * lightness and hue, and every swatch took it. Their most saturated swatch is
 * about our average. So the target is an absolute level near theirs, clamped
 * by the gamut rather than defined by it.
 *
 * NO QUIET MEMBER. Their sets run 0.03 to 0.17 inside one palette and give the
 * eye somewhere to rest. Ours ran 0.13 to 0.21, every member shouting. So the
 * chroma cycles as well as the lightness, and two of every four are quiet.
 *
 * THE WHOLE WHEEL. Ours spanned 274 degrees, theirs about 190. A set that
 * leaves a gap reads as a family; a set that closes the circle reads as a box
 * of pencils. So the hues spread EVENLY inside a span rather than around the
 * circle. The golden ratio was tried inside the span first and is wrong there:
 * it landed two hues three degrees apart, which is 0.010 at a quiet chroma.
 */
export const CHROMA_TARGET = 0.16
export const CHROMA_CYCLE = [1, 0.55, 0.85, 0.4]
export const HUE_SPAN = 260

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
  if (!ceiling) return 1
  /* IT MODULATES THE TARGET NOW, IT DOES NOT DEFINE IT.
   *
   * This used to be a fraction of the gamut edge, 0.45 to 1, and the edge was
   * the target. Once the target became an absolute level, multiplying by a
   * fraction under 1 counted the same decision twice: the level asked for
   * 0.14, the seed cut it to 0.6 of that, and the set came out at 0.082 with
   * its worst pair at 0.091, under the floor it is supposed to clear.
   *
   * A vivid brand should still chart a little louder than a muted one, so the
   * range is narrow and centred on 1 rather than sliding to zero. */
  return clamp(0.85 + (s.c / ceiling) * 0.4, 0.85, 1.15)
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
       system is the colour the reader already associates with it, and it sits
       at one END of the span so its nearest neighbour in hue never shares its
       lightness. The rest step evenly across. */
    const step = HUE_SPAN * (i / (CATEGORICAL_COUNT - 1))
    const h = (((seed.h ?? 0) + step) % 360 + 360) % 360
    const l = LIGHTNESS_LEVELS[i % LIGHTNESS_LEVELS.length]
    /* AN ABSOLUTE TARGET, CLAMPED BY THE GAMUT RATHER THAN DEFINED BY IT. The
       cycle is what gives the set a quiet member, and the seed's own
       saturation still scales the whole thing, so a muted brand charts muted. */
    const want = CHROMA_TARGET * CHROMA_CYCLE[i % CHROMA_CYCLE.length] * sat
    const c = Math.min(want, maxChroma(l, h))
    out.push(toHex(toGamut(fromOklch({ l, c, h }))))
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
