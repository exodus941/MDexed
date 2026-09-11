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
 * ── HOW THE FIVE ARE PLACED: A SWEEP, NOT A METRONOME ──
 *
 * Series one carries the accent's own hue. The rest sweep away from it in ONE
 * direction, across a span rather than around the circle, at UNEVEN steps that
 * hurry through the yellow-green region. Lightness arcs once, up to a peak and
 * gently down. Chroma rises the whole way, so the set has a quiet member to
 * rest on and a loud one to land on.
 *
 * That is three curves replacing three cycles. Every one of the cycles
 * maximised the gap between neighbours, and together they are what made the
 * old scale read as a swatch drawer.
 *
 * THE PALEST STOP IS BOUNDED BY THE PAGE, not by taste. At 0.88 it came out
 * 0.012 DARKER than a light page measuring 0.893, so the fill read as nothing
 * at all while this file's own prose claimed 0.11 of separation. The arc peaks
 * at 0.83, which restores that gap.
 *
 * Every filled series takes a hairline in the page's own border colour. The
 * gap is enough for an area and not for an edge.
 *
 * ── SO STATE THE LIMIT ──
 *
 * No categorical palette this size is safe without red-green vision, this one
 * included: measured across 216 seeds, the worst pair falls to 0.030 once that
 * axis is gone. Saying so is worth more than a claim nobody measured, and it
 * is why a chart never encodes a series by colour alone. The palette makes the
 * picture readable and the direct label makes it certain.
 */

import { parseColor, toHex, toGamut, fromOklch, toOklchObj, inGamut, maxChroma } from './convert.js'
import { RAMP_STEPS } from './ramp.js'

/**
 * Fixed count.
 *
 * IT WAS EIGHT, AND EIGHT IS WHY THE SCALE LOOKED MECHANICAL. A palette that
 * reads as a family sweeps its hue one way and arcs its lightness once. Eight
 * stops on that arc are too close together to tell apart. Measured across 36
 * accent hues and four hue spans, with and without lightness alternation:
 *
 *   n=3   median worst pair 0.256   36 of 36 hues clear the floor
 *   n=4                     0.136   36 of 36
 *   n=5                     0.088    7 of 36
 *   n=6                     0.082    1 of 36
 *   n=8                     0.052    0 of 36
 *
 * So the COUNT was the constraint, not the formula. At five the sweep beats
 * the old cycling scale on both questions at once: 0.162 against 0.146, and it
 * reads as one family rather than as a box of pencils.
 *
 * A chart needing more than five series is almost always the wrong form. Say
 * that in the document rather than shipping colours nobody can separate.
 */
export const CATEGORICAL_COUNT = 5

/**
 * ── THE LIGHTNESS ARCS ONCE, IT DOES NOT CYCLE ──
 *
 * It used to be `[0.38, 0.68, 0.52, 0.78]`, cycling. That maximises the gap
 * between neighbours and it is exactly what made the scale read as a
 * metronome: series one to three ran 38, 68, 52. Up, then down, then up.
 *
 * A palette a person calls agreeable rises and settles once. Measured on the
 * reference sent for this: 38, 63, 83, 78, 68. One peak, a gentle fall.
 *
 * So these points define an arc through the sequence rather than a cycle.
 *
 * A PARABOLA THROUGH THREE OF THEM IS NOT THE SAME CURVE, and the difference
 * cost three presets. Fitted to 0.38, 0.83 and 0.66, it passes through 0.83 at
 * three quarters as well, so series three and four came out one point apart
 * instead of five. Where the hue gap between those two is also small, the pair
 * collapsed: 0.082, 0.083 and 0.075 against a floor of 0.10.
 *
 * So the curve is their five measurements interpolated, not a shape fitted to
 * a subset of them.
 *
 * ONE VALUE IS NOT THEIRS, AND IT IS THE FOURTH. They measure 0.78 there and
 * this ships 0.73. At 0.78 the palette still failed 35 of 216 seeds across the
 * hue circle, always on that same third-to-fourth pair. Their own reference
 * measures 0.081 on it and would fail this floor too.
 *
 * 0.73 was chosen by searching curve[3], the hue span and the narrow-band cost
 * together against all 216, rather than by nudging until the presets passed.
 * Every combination that cleared is listed in the memory; this one clears with
 * the largest margin while keeping the hue span inside the 157-237 band the
 * references measure.
 */
export const LIGHT_CURVE = [0.38, 0.63, 0.83, 0.73, 0.66]

/**
 * ── AND THE CHROMA RISES ALONG THE RUN ──
 *
 * The same reference: 0.044, 0.101, 0.117, 0.127, 0.156. Monotonic. The dark
 * anchor is the quietest member and the last is the loudest, so the set has
 * somewhere for the eye to rest AND somewhere for it to land. The old scale
 * cycled this too, which is a second metronome laid over the first.
 */
export const CHROMA_LOW = 0.05
export const CHROMA_HIGH = 0.16

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
 * of pencils. So the hues spread inside a SPAN rather than around the circle.
 * The golden ratio was tried inside the span first and is wrong there: it
 * landed two hues three degrees apart, which is 0.010 at a quiet chroma.
 *
 * ── AND THE STEPS INSIDE THE SPAN ARE UNEVEN, ON PURPOSE ──
 *
 * Spreading EVENLY was the last thing left of the metronome. The reference
 * steps 43, 96, 29 and 23 degrees, and the 96 is a jump straight over the
 * yellow-green region. That agrees with what the golden-angle work already
 * found: yellow-green is perceptually narrow, so degrees spent there buy less
 * separation than degrees spent anywhere else.
 *
 * So the walk is WARPED rather than linear. A degree inside the narrow band
 * costs a third of a degree outside it, which makes the sweep hurry through
 * and linger where the eye can tell hues apart.
 */
export const CHROMA_TARGET = 0.16
export const HUE_SPAN = -220
export const NARROW_BAND = [100, 170]
export const NARROW_COST = 0.35

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
/* `maxChroma` lives in `convert.js`, beside `inGamut`. Two copies of it sat
   here and in `palette.js`, at 24 and 20 bisection steps, which is a scorer
   that had already drifted from itself. */

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
/**
 * Where the arc sits at position t, 0 at series one and 1 at the last.
 *
 * `LIGHT_CURVE` interpolated, so the set rises to a peak and settles rather
 * than sawing up and down.
 */
export function lightAt(t) {
  const n = LIGHT_CURVE.length - 1
  const x = clamp(t, 0, 1) * n
  const i = Math.min(n - 1, Math.floor(x))
  return LIGHT_CURVE[i] + (LIGHT_CURVE[i + 1] - LIGHT_CURVE[i]) * (x - i)
}

/**
 * The hue at position t, walking a warped arc.
 *
 * READ THE COST, NEVER THE DEGREES. A linear walk spends the same number of
 * stops in yellow-green as anywhere else, and that region separates worst. The
 * accumulator below charges a narrow-band degree at `NARROW_COST`, so `t` maps
 * to a hue by how much SEPARATION has been bought rather than by how far the
 * angle has turned.
 */
export function hueAt(startHue, t) {
  const N = 360
  const cost = []
  let acc = 0
  for (let i = 0; i < N; i++) {
    const h = (((startHue + (HUE_SPAN * i) / N) % 360) + 360) % 360
    acc += h >= NARROW_BAND[0] && h <= NARROW_BAND[1] ? NARROW_COST : 1
    cost.push(acc)
  }
  const want = clamp(t, 0, 1) * acc
  let i = cost.findIndex(v => v >= want)
  if (i < 0) i = N - 1
  return (((startHue + (HUE_SPAN * i) / N) % 360) + 360) % 360
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
       system is the colour the reader already associates with it, and the
       sweep runs away from it in one direction. */
    const t = CATEGORICAL_COUNT === 1 ? 0 : i / (CATEGORICAL_COUNT - 1)
    const h = hueAt(seed.h ?? 0, t)
    const l = clamp(lightAt(t), 0.24, 0.9)
    /* AN ABSOLUTE TARGET, CLAMPED BY THE GAMUT RATHER THAN DEFINED BY IT. The
       rise is what gives the set a quiet member and a loud one, and the seed's
       own saturation still scales the whole thing, so a muted brand charts
       muted. */
    const want = (CHROMA_LOW + (CHROMA_HIGH - CHROMA_LOW) * t) * sat
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
