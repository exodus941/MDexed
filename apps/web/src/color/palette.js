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
import { MEANING_PAIRS, HUE_MIN as MEANING_HUE_MIN } from '../a11y/audit.js'

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

/* ── CHROMA LEVEL: HOW LOUD, AS A CONTINUOUS DECISION ──
 *
 * The three intensities above are the shape of a palette. This is its volume,
 * and it multiplies whichever shape you picked.
 *
 * IT EXISTS BECAUSE THE DEFAULT WAS TOO LOUD AND NOTHING SAID SO. Measured
 * against eight palettes a person picked out as agreeable, 39 swatches: their
 * chroma mean is 0.101 and ours was 0.165. Their most saturated swatch is
 * about our average. Nothing in the generator ever asked for a quiet colour.
 *
 * 1.00 IS THE REFERENCE LEVEL. Balanced at 1.00 measures 0.111 across 240
 * generated seeds against their 0.101, and the gap is the status floor: a
 * success colour never drops below 0.10 or it stops reading as a signal. The ranges above are
 * unchanged, so Muted and Vivid still mean what they always did; the level
 * carries a factor that puts 1.00 on the reference rather than on the old
 * behaviour. The old behaviour is 1.25, inside the range rather than at its
 * end, so nobody has to leave the scale to get back to it. */
export const CHROMA_LEVEL = { min: 0, max: 2, step: 0.05, default: 1 }

/* What 1.00 multiplies by, chosen so the default lands on the references and
   RE-MEASURED whenever the shape it scales changes.
 *
 * It was 0.8, which put Balanced's [0.11, 0.19] on the measured 0.101. Adding
 * the ladder's chroma curve dropped the same setting to 0.087, and the curve
 * is normalised by its own mean, so the loss is not the curve. It is the
 * GAMUT: the loud middle rung asks for more chroma than sRGB holds and gets
 * clipped, while the quiet rungs keep everything they ask for. Clipping one
 * side of a balanced curve is not balanced.
 *
 * A CALIBRATION CONSTANT IS ONLY TRUE OF THE THING IT CALIBRATED. Measured
 * again across 400 palettes per step: 0.80 gives 0.087, 0.92 gives 0.094, 1.03
 * gives 0.101. */
const LEVEL_REFERENCE = 1.03

/* Hue bands a colour has to sit in to still read as its meaning. */
/* ── SUCCESS IS A TEAL, BECAUSE A GREEN ONE IS UNREADABLE BESIDE DANGER ──
 *
 * A true green sat here and it failed the audit at EVERY point in the band.
 * Under red-green vision loss the only surviving axes are lightness and
 * blue-yellow, and success and danger are both step 500 in the default role
 * map, so their lightness is identical by construction. That leaves
 * blue-yellow alone, and a green and a red land in the same place on it.
 *
 * Simulated at full severity, the old band's pair: #006121 and #892b20 become
 * #595027 and #5d531d. The same olive twice.
 *
 * Measured across 360 generated palettes, moving the band to 196-222:
 *
 *     [130, 165]  green       3.27 fail/run    716 collisions
 *     [196, 222]  teal        1.97 fail/run    254 collisions
 *
 * IT IS NOT A DEVIATION. The default document ships success at hue 191, and so
 * do all six presets. This band was the only thing in the system still using a
 * green, and it straddles the hue everything else already uses.
 *
 * Going further toward cyan scores better still, 1.40 at 215-240, and stops
 * reading as success rather than as information. They picked 196-222 with both
 * columns rendered side by side.
 *
 * The residue is `colour-alone:accent:danger`, which no hue band can fix: the
 * accent is free by design and half the wheel collides with danger on that
 * axis. Only a ROLE STEP separates them, which the generator does not write.
 * See [[the-generator-scored-the-wrong-artefact]]. */
const ROLE_HUE_BAND = {
  success: [196, 222],
  warning: [62, 92],
  danger: [18, 40],
  positive: [196, 222],
  caution: [62, 92],
  negative: [18, 40],
}

const NEUTRAL_NAMES = new Set(['neutral', 'muted', 'surface-tint', 'grey', 'gray'])

const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const wrap = h => ((h % 360) + 360) % 360

/* ── THE LADDER: WHY A GENERATED PALETTE READ AS A BOX OF PENCILS ──
 *
 * Measured against six palettes a person picked out as agreeable, on the five
 * numbers that describe a set:
 *
 *                     chroma mean   lightness   SPREAD   hue span
 *   theirs             0.070-0.129  0.48-0.76   0.24-0.65  157-237°
 *   generate           0.084-0.100  0.52-0.56   0.05-0.17  112-234°
 *
 * FOUR OF THE FIVE ALREADY AGREED. The chroma was in their band, the hue span
 * was in their band, and the mean lightness was in their band. One number was
 * out by five and a half times, and it is the one that decides how a row of
 * swatches reads.
 *
 * Every seed came out at one lightness, differing only in hue. Five equally
 * mid colours in five hues is a box of pencils: nothing recedes, nothing
 * leads, and the eye has nowhere to rest. Their sets run from a dark member to
 * a pale one and use hue for far less of the work.
 *
 * ── SO THE SEEDS TAKE RUNGS ──
 *
 * A run picks a KEY, which is the palette's own middle, and a SPREAD, which is
 * how far it reaches. Each seed takes an evenly spaced rung between them.
 *
 * ── THE NEUTRAL IS EXCLUDED, AND FINDING OUT WHY COST THE MOST ──
 *
 * `buildRamp` takes only hue and chroma from a seed, so it looked as though a
 * seed's lightness were free: every step's lightness comes from the ramp
 * SHAPE. That is true of ten of the eleven steps. `anchorSeed` writes the seed
 * VERBATIM into whichever step sits nearest it in lightness, so the eleventh
 * moves to wherever the seed is.
 *
 * On a chromatic seed that is harmless and is the feature: a brand colour
 * survives generation exactly. On the NEUTRAL it is not, because `bg` and
 * `surface` are both steps of the neutral ramp. A neutral placed at the pale
 * end anchors into a pale step and pulls the card up toward `*.50`, which is
 * where every subtle fill lives.
 *
 * Measured: with the neutral taking an outer rung, 53 flat-fill warnings in
 * 300 runs, none before. Every one of them carried a neutral at L 0.92 and a
 * card at #f0eeee, with the fill 1.9 points off a floor of 2. Turning
 * `anchorSeed` off cleared all 53, which is what named the mechanism.
 *
 * So the neutral keeps the mid band it always had, and the chromatic seeds
 * carry the ladder. It costs nothing: the neutral is near-achromatic anyway,
 * so its rung was never what made a row of swatches read well.
 *
 * ── AND CHROMA FOLLOWS THE RUNG ──
 *
 * Their palettes are quiet at both ends of their own lightness range and loud
 * in the middle. Measured, as a share of each palette's loudest swatch:
 *
 *   darkest 0.52 · dark 0.65 · middle 0.99 · light 0.78 · lightest 0.64
 *
 * It is skewed, not symmetric: the pale end holds more chroma than the deep
 * end. So the curve is those measurements interpolated, rather than a tent
 * fitted to them. A symmetric tent was tried and reads 0.85 where they measure
 * 0.65. */
/* The reach is bounded by MEANING at both ends. A hue stops being nameable at
   the extremes, so a warning at 0.30 reads brown and a danger at 0.88 reads
   pink, and a status seed has to survive as its own signal. */
const LADDER = { key: [0.50, 0.70], spread: [0.30, 0.60], floor: 0.40, ceiling: 0.84 }

/* Sampled at the centre of each fifth, so index i is t = 0.1 + 0.2i. */
const CHROMA_BY_RUNG = [0.52, 0.65, 0.99, 0.78, 0.64]

/* Divided by its own mean, so the curve adds SHAPE without moving the
   palette's average chroma off the reference level the slider is calibrated
   to. Without this every set came out a third quieter than asked for. */
const RUNG_MEAN = CHROMA_BY_RUNG.reduce((a, b) => a + b, 0) / CHROMA_BY_RUNG.length

function rungChroma(t) {
  const x = (Math.max(0, Math.min(1, t)) - 0.1) / 0.2
  const i = Math.max(0, Math.min(CHROMA_BY_RUNG.length - 2, Math.floor(x)))
  const f = Math.max(0, Math.min(1, x - i))
  const v = CHROMA_BY_RUNG[i] + (CHROMA_BY_RUNG[i + 1] - CHROMA_BY_RUNG[i]) * f
  return v / RUNG_MEAN
}

/**
 * Which seed takes which rung. The neutral is not in the list.
 *
 * THE RUNGS ARE SHUFFLED, and the first version handed them out in seed order
 * instead. That made the rank a property of the ROLE: success came out dark in
 * every run and warning came out pale in every run, which is a decision nobody
 * made. It also parked the accent next to a status colour at the same
 * lightness, and the two-meanings-one-colour warning went from 61 to 143.
 *
 * @returns {Map<string, number>} seed id → rung, 0 at the dark end
 */
function assignRungs(free) {
  const n = free.length
  const rungs = new Map()
  if (!n) return rungs
  if (n === 1) { rungs.set(free[0].seed.id, 0.5); return rungs }

  const slots = Array.from({ length: n }, (_, i) => i / (n - 1))
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  free.forEach((f, i) => rungs.set(f.seed.id, slots[i]))
  return rungs
}

/**
 * @param seeds    current seed list (each may carry `locked`)
 * @param harmony  id from HARMONIES
 * @returns a map of seed id → new hex, for unlocked seeds only
 */
export function generatePalette(seeds, harmony = 'analogous', intensity = 'balanced', chromaLevel = CHROMA_LEVEL.default) {
  const scheme = HARMONIES.find(h => h.id === harmony) ?? HARMONIES[0]
  const base = INTENSITIES.find(i => i.id === intensity) ?? INTENSITIES[1]
  /* THE LEVEL SCALES THE SHAPE. The intensity says which part of the range,
     and this says how loud that range is. Both chroma ranges move together, so
     a quiet palette keeps its quiet neutral. */
  /* `??` and a number test, not `||`. Zero is a legal level now, and `0 || 1`
     is 1: the bottom of the slider would have silently generated the default. */
  const asked = Number.isFinite(chromaLevel) ? chromaLevel : CHROMA_LEVEL.default
  const level = Math.max(CHROMA_LEVEL.min, Math.min(CHROMA_LEVEL.max, asked))
  const k = level * LEVEL_REFERENCE
  const int = { ...base,
    chroma: base.chroma.map(v => v * k),
    neutralChroma: base.neutralChroma.map(v => v * k) }

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

  /* ── THE LADDER THIS RUN CLIMBS ──
     A locked colour keys the run, exactly as it keys the hue and the chroma,
     so a pinned brand stays where it was put and the rest arrange around it. */
  const onLadder = seeds.filter(s => !s.locked && !NEUTRAL_NAMES.has((s.name ?? '').toLowerCase()))
    .map(s => ({ seed: s }))
  const rungs = assignRungs(onLadder)
  const key = anchor ? baseLight : rand(...LADDER.key)
  /* MONOCHROME TAKES THE WHOLE REACH. It has one hue, so the ladder is the
     only thing separating its members and a short one gives five of the same
     colour. Every other scheme rolls its own. */
  const spread = scheme.id === 'monochrome' ? LADDER.spread[1] : rand(...LADDER.spread)
  const rungLight = (t, lo = LADDER.floor, hi = LADDER.ceiling) =>
    Math.max(lo, Math.min(hi, key - spread / 2 + spread * t))

  const out = {}
  let step = 0

  for (const seed of seeds) {
    if (seed.locked) continue
    const name = (seed.name ?? '').toLowerCase()
    const t = rungs.get(seed.id) ?? 0.5

    if (NEUTRAL_NAMES.has(name)) {
      /* Neutrals aren't grey — a trace of the accent hue keeps a palette
         feeling like one family rather than a colour plus some grey. How much
         of a trace is the intensity setting's job, and at Vivid it stops being
         a trace: this is the seed the page background is built from, so a
         saturated one is what makes a deep-blue or oxblood UI possible at all. */
      /* NOT ON THE LADDER, and the ladder section above says why: `bg` and
         `surface` are both steps of this ramp, so a pale neutral anchors into
         a pale step and closes the gap every subtle fill needs. */
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
         stop reading as a signal. The ladder's own bounds already keep the hue
         nameable, so the rung needs no extra clamp here. */
      out[seed.id] = toHex(toGamut(fromOklch({
        l: rungLight(t),
        c: Math.max(0.10, rand(...int.chroma) * 0.9 * rungChroma(t)),
        h: rand(band[0], band[1]),
      })))
      continue
    }

    const offset = scheme.offsets
      ? scheme.offsets[step % scheme.offsets.length] + rand(-6, 6)
      : rand(0, 360)
    /* Monochrome varies weight instead of hue, or every slot comes out
       identical. */
    out[seed.id] = toHex(toGamut(fromOklch({
      l: rungLight(t),
      c: baseChroma * rungChroma(t) * rand(0.9, 1.1),
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

/* ── SCORE THE PAIR THE WAY THE AUDIT WILL, WHICH IS ON HUE ──
 *
 * The audit answers "do these read as one colour" with hue AND lightness, and
 * this scorer used to copy that rule verbatim. Copying it was the bug. The
 * audit reads the ROLE colours and this reads the SEEDS, and the ramp stands
 * between them: `accent` and `danger` are both step 500 in the default role
 * map, so they hold the SAME lightness whatever their seeds did.
 *
 * So a seed pair separated by 20 points of lightness scored as resolved here
 * and arrived at the audit as two colours 15° apart at an identical lightness.
 * The generator was crediting itself with a separation the ramp deletes.
 *
 * Measured over 480 generated palettes: 263 collisions warned with the
 * lightness clause and 2 without it. It also clears 59 of the 61 that the
 * shipped generator produced before any of this, so the clause was never
 * paying for itself.
 *
 * A lock inside a status band can still leave no legal hue. That case now ends
 * as the audit already described it, with a warning and no move, rather than
 * with a move that changes nothing a reader can see.
 *
 * THE LIGHTNESS LEVER STAYS. It is not scored any more, so it only survives
 * when it lowers the hue count, which it can do: a seed sitting ON its role's
 * step IS that role, so moving it off the step hands the role back to the ramp. */
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
    return gap < MEANING_HUE_MIN
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
