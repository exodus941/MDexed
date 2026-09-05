/* Palette generation.

   Works in OKLCH and generates by harmony rather than by random RGB, so the
   results are usable rather than merely varied. Locked seeds anchor the run:
   the base hue is taken from what you've kept, and everything unlocked is
   placed relative to it.

   Status colours are constrained to the hue bands people actually read as
   success, warning and danger — a "random" green success colour that lands on
   teal stops communicating. */
import { fromOklch, toOklchObj, toGamut, toHex, parseColor } from './convert.js'

/* ONE SOURCE FOR THE THRESHOLD. The audit decides what "reads as one colour"
   means, and the generator has to answer the same question the same way. A
   second copy here would drift, and then the generator would emit palettes its
   own audit rejects. */
import { MEANING_PAIRS, HUE_MIN as MEANING_HUE_MIN, LIGHTNESS_MIN as MEANING_LIGHTNESS_MIN } from '../a11y/audit.js'

/* A near-grey has no hue worth comparing, the same floor the audit uses. */
const CHROMA_FLOOR = 0.03

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

  return separateMeanings(seeds, out)
}

/* ── TWO MEANINGS MUST NOT BE ONE COLOUR, AND THE GENERATOR USED TO ALLOW IT ──
 *
 * The audit reports a colliding pair as a warning, and a warning arrives after
 * the palette is on screen. Nothing stopped the generator producing one in the
 * first place: status seeds are placed inside their own hue bands, the accent
 * is placed anywhere, and no step compared the two.
 *
 * Measured on the shipped generator before this: 432 palettes walked round the
 * hue circle produced a colliding pair in a large minority of runs, and each
 * one reached the screen for a person to notice.
 *
 * ROTATE THE FREE SEED, NEVER THE CONSTRAINED ONE. A green success has to stay
 * clear of danger for red-green vision, so the accent is the seed with room.
 * Where the accent is LOCKED — which is what a brand colour is — the status
 * seed moves instead, and only inside its own band, so it still reads as the
 * meaning it carries.
 *
 * A LOCK IS A DECISION AND THIS NEVER OVERRIDES ONE. If both seeds of a
 * colliding pair are locked, the palette is left exactly as asked and the
 * audit's warning stands. A generator that quietly moved a colour somebody
 * pinned would be a worse fault than the collision. */
const NUDGE_STEPS = [12, -12, 24, -24, 36, -36, 48, -48, 60, -60, 90, -90, 120, -120, 180]

/* ── HUE IS NOT ALWAYS AVAILABLE, AND LIGHTNESS IS THE OTHER LEVER ──
 *
 * A brand colour pinned INSIDE a status band leaves no legal hue to move to: a
 * green brand at 150° and a success bounded to 130–165 are within 25° at every
 * point in the band. Measured: 36 of 200 pinned brands walked round the circle
 * still collided after the hue pass.
 *
 * Two meanings one degree apart in hue and fifteen points apart in lightness
 * ARE distinguishable, and this system's own presets rely on it. So the
 * constrained seed steps in lightness instead, and stays inside the range
 * where a status colour still reads as a signal rather than as a tint. */
const LIGHT_STEPS = [0.12, -0.12, 0.16, -0.16, 0.20, -0.20]
const STATUS_LIGHT = [0.34, 0.76]

function separateMeanings (seeds, out) {
  const byName = new Map(seeds.map(s => [(s.name ?? '').toLowerCase(), s]))
  const hexOf = name => {
    const s = byName.get(name)
    if (!s) return null
    return out[s.id] ?? s.hex ?? null
  }
  const okOf = name => {
    const hex = hexOf(name)
    const p = hex ? parseColor(hex) : null
    return p ? toOklchObj(p) : null
  }
  const collides = (x, y) => {
    if (!x || !y) return false
    if ((x.c ?? 0) < CHROMA_FLOOR || (y.c ?? 0) < CHROMA_FLOOR) return false
    const raw = Math.abs((x.h ?? 0) - (y.h ?? 0))
    const gap = Math.min(raw, 360 - raw)
    if (gap >= MEANING_HUE_MIN) return false
    return Math.abs((x.l ?? 0) - (y.l ?? 0)) * 100 < MEANING_LIGHTNESS_MIN
  }

  /* SCORE THE WHOLE PALETTE, NEVER THE PAIR BEING REPAIRED. The first version
     asked only whether the pair in hand was separated, so moving the accent
     clear of danger walked it onto warning. 840 generated palettes still came
     back with 59 colliding pairs. A remedy that clears the finding you opened
     and raises the total is not a remedy. */
  const total = () => MEANING_PAIRS.filter(([a, b]) => collides(okOf(a), okOf(b))).length

  for (let pass = 0; pass < MEANING_PAIRS.length + 1 && total() > 0; pass++) {
    const hit = MEANING_PAIRS.find(([a, b]) => collides(okOf(a), okOf(b)))
    const [a, b] = hit
    const seedA = byName.get(a), seedB = byName.get(b)
    /* The free seed is the one the generator wrote and nobody pinned. */
    const free = !seedA.locked && out[seedA.id] ? a : (!seedB.locked && out[seedB.id] ? b : null)
    if (!free) break
    const seed = byName.get(free)
    const band = ROLE_HUE_BAND[free]
    const start = okOf(free)
    const was = out[seed.id]
    let best = null
    const tryTrial = trial => {
      out[seed.id] = toHex(toGamut(fromOklch(trial)))
      const score = total()
      if (best === null || score < best.score) best = { score, hex: out[seed.id] }
      return score
    }
    for (const step of NUDGE_STEPS) {
      const h = wrap((start.h ?? 0) + step)
      /* A status seed stays inside the band that gives it its meaning. */
      if (band && (h < band[0] || h > band[1])) continue
      if (tryTrial({ ...start, h }) === 0) break
    }
    /* Hue had no room, so take the lightness. */
    if (!best || best.score > 0) {
      for (const step of LIGHT_STEPS) {
        const l = (start.l ?? 0.5) + step
        if (band && (l < STATUS_LIGHT[0] || l > STATUS_LIGHT[1])) continue
        if (l < 0.2 || l > 0.9) continue
        if (tryTrial({ ...start, l }) === 0) break
      }
    }
    /* Nothing that helps means leave it alone and let the audit say so. A move
       that does not lower the count is worse than none. */
    out[seed.id] = was
    const before = total()
    if (!best || best.score >= before) break
    out[seed.id] = best.hex
  }
  return out
}

/** Slots offered when adding a seat to the palette. */
export const PALETTE_SLOTS = [
  'accent', 'secondary', 'tertiary', 'neutral',
  'success', 'warning', 'danger', 'info', 'highlight', 'link',
]
