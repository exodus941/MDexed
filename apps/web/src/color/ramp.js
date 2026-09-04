/* Seed colour → an 11-step ramp, generated in OKLCH so the steps are
   perceptually even rather than mathematically even. Three shape controls:
   a lightness curve, a chroma envelope, and a hue shift across the ramp
   (which is how you get warm shadows and cool highlights). */
import { parseColor, toOklchObj, fromOklch, toGamut, toHex } from './convert.js'

export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

export const DEFAULT_SHAPE = {
  lightMax: 0.97,   // OKLCH L at step 50
  lightMin: 0.20,   // OKLCH L at step 950
  curve: 0,         // -1 … 1 — bias the lightness distribution light or dark
  chromaPeak: 0.55, // 0 … 1 — where along the ramp chroma is strongest
  chromaScale: 1,   // overall saturation multiplier
  hueShift: 0,      // degrees of hue rotation from lightest to darkest
  anchorSeed: true, // snap the nearest step to the exact seed colour
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/* bias < 0 packs steps toward the light end, > 0 toward the dark end */
const easeCurve = (t, bias) => (bias ? Math.pow(t, Math.pow(2, bias * 2)) : t)

/* Chroma can't hold up at the extremes — near-white and near-black simply
   can't carry saturation — so taper it toward both ends of the ramp.
 *
 * ── THE TAPER IS SYMMETRIC AND sRGB IS NOT ──
 *
 * That premise is true at the white end and false at the black end, and the
 * gap is what made every generated dark ground a dead grey. Measured by
 * bisecting `inGamut` at each end:
 *
 *   L 97.0   sRGB holds chroma 0.0148   the 0.2 taper spends 23% of it
 *   L 20.0   sRGB holds chroma 0.0567   the 0.2 taper spends  6% of it
 *
 * sRGB carries 3.83x more chroma at L 20 than at L 97. So the dark end has
 * room the envelope never used, and a neutral seed's whisper of hue vanished
 * exactly where the dark theme needed it: `bg` came out at chroma 0.004 and
 * `surface` at 0.007, against an accent at 0.133. A 19x chroma jump onto an
 * achromatic ground is what reads as solarized.
 *
 * DARK_FLOOR is that measured ratio applied to the same 0.2, not a number
 * picked to taste. The light end keeps 0.2, because there the premise holds.
 *
 * It is opt-in per ramp set. The light roles resolve against a ramp built the
 * old way, so nothing in a light theme moves. */
export const DARK_FLOOR = 0.2 * 3.83

const chromaEnvelope = (t, peak, darkFloor = 0.2) => {
  const p = clamp(peak, 0.01, 0.99)
  const d = t <= p ? t / p : (1 - t) / (1 - p)
  const floor = t <= p ? 0.2 : clamp(darkFloor, 0.2, 1)
  return floor + (1 - floor) * Math.pow(clamp(d, 0, 1), 0.7)
}

/**
 * @returns {{ steps: Record<number,string>, anchor: number|null }}
 */
export function buildRamp(seedHex, shape = DEFAULT_SHAPE, opts = {}) {
  const s = { ...DEFAULT_SHAPE, ...shape }
  const darkFloor = opts.darkFloor ?? 0.2
  const parsed = parseColor(seedHex)
  if (!parsed) return { steps: Object.fromEntries(RAMP_STEPS.map(k => [k, '#000000'])), anchor: null }

  const seed = toOklchObj(parsed)
  const n = RAMP_STEPS.length
  const steps = {}

  RAMP_STEPS.forEach((step, i) => {
    const t = i / (n - 1)
    const l = s.lightMax + (s.lightMin - s.lightMax) * easeCurve(t, s.curve)
    const c = seed.c * s.chromaScale * chromaEnvelope(t, s.chromaPeak, darkFloor)
    const h = seed.h + s.hueShift * (t - 0.5) * 2
    steps[step] = toHex(toGamut(fromOklch({ l, c, h })))
  })

  /* Put the designer's actual brand colour into the ramp at whichever step
     sits closest to it in lightness, so it survives generation verbatim. */
  let anchor = null
  if (s.anchorSeed) {
    let best = Infinity
    RAMP_STEPS.forEach((step, i) => {
      const t = i / (n - 1)
      const l = s.lightMax + (s.lightMin - s.lightMax) * easeCurve(t, s.curve)
      const d = Math.abs(l - seed.l)
      if (d < best) { best = d; anchor = step }
    })
    if (anchor != null) steps[anchor] = toHex(toGamut(parsed))
  }

  return { steps, anchor }
}

/** Ramps for every seed, keyed by seed name. */
export function buildRamps(seeds, shape, opts = {}) {
  const out = {}
  for (const seed of seeds) out[seed.name] = buildRamp(seed.hex, shape, opts)
  return out
}

/** Resolve a `name.step` reference (e.g. "accent.600") against built ramps. */
/* A ref may name a point BETWEEN two steps: `neutral.50~100`.
 *
 * The ramp cannot gain a step. `buildRamp` places each one by its INDEX —
 * `t = i / (n - 1)` — so inserting a twelfth would slide every existing colour
 * along the curve and repaint the whole palette. That is far too much to pay
 * for one tint.
 *
 * But a row stripe genuinely needs to sit between 50 and 100, and there is
 * nothing there: the two lightest steps are 1.27:1 apart, which is a band
 * rather than a rhythm. Mixing them in OKLCH gives the missing value without
 * moving anything, and it still follows the seed — change the neutral and the
 * stripe changes with it, which a typed hex would not.
 *
 * A WEIGHT is allowed — `neutral.50~100@0.25` — and the default is the
 * midpoint. This began as midpoint-only, on the argument that a weight invites
 * values picked by nudging. The argument lasted one turn: the stripe had to
 * halve again, which is a quarter step, and no pair of ramp steps brackets it.
 * A constraint that blocks a value somebody can justify is not discipline.
 * What guards against nudging is the measurement, not the syntax. */
function mixSteps (ramp, a, b, t = 0.5) {
  return mixHex(ramp?.steps?.[a], ramp?.steps?.[b], t)
}

/* ── AND A REF MAY MIX ACROSS TWO RAMPS ──
 *
 * `mixSteps` walks one ramp, which covers a point between two of its own
 * steps. It cannot reach a tint that is mostly neutral with some accent in it,
 * and no single accent step is that: an accent step near the middle carries
 * the ramp's full chroma.
 *
 * A filled accent SHAPE needs exactly that colour. `accent-subtle` measured
 * 1.13:1 against the card in light and 1.11 in dark, both under the 1.2 a
 * shape needs, so an avatar disc vanished and only its initials showed. No
 * accent-tinted role in the palette clears 1.2 in both modes, so the step was
 * never the fix. Mixing the accent into the raised surface is, and it still
 * follows the seed.
 *
 * Written `neutral.800~accent.500@0.2`: the left ref is the ground and the
 * weight is how much of the right one goes in. */
function mixHex (aHex, bHex, t = 0.5) {
  const A = parseColor(aHex), B = parseColor(bHex)
  if (!A || !B) return null
  const oa = toOklchObj(A), ob = toOklchObj(B)
  const mid = (x, y) => x + (y - x) * t
  return toHex(toGamut(fromOklch({
    l: mid(oa.l, ob.l), c: mid(oa.c, ob.c),
    /* Hue is an angle: mix it the short way round, or a pair either side of
       0 degrees averages to the colour opposite both of them. */
    h: mid(oa.h ?? 0, (ob.h ?? 0) + (Math.abs((ob.h ?? 0) - (oa.h ?? 0)) > 180 ? ((ob.h ?? 0) > (oa.h ?? 0) ? -360 : 360) : 0)),
  })))
}

export function resolveRef(ref, ramps) {
  if (typeof ref !== 'string') return null
  if (ref === 'white') return '#ffffff'
  if (ref === 'black') return '#000000'
  /* Take the weight off FIRST. `lastIndexOf('.')` was splitting the ramp from
     the step, and a weight of `0.25` puts a dot after the step — so
     `neutral.50~100@0.25` split into ramp "neutral.50~100@0" and step "25",
     resolved to nothing, and the stripe painted BLACK. A separator chosen when
     the grammar had one shape stops working the moment it gains another. */
  const [body, weight] = ref.split('@')
  /* CROSS-RAMP FIRST. `neutral.800~accent.500` names two whole refs, and the
     same-ramp form `neutral.50~100` names one ramp and two of its steps. The
     tell is a dot on the RIGHT of the tilde. Testing the left side cannot
     separate them, because both have one. */
  if (body.includes('~')) {
    const [left, right] = body.split('~')
    if (right.includes('.')) {
      const t = weight === undefined ? 0.5 : Number(weight)
      if (!Number.isFinite(t) || t < 0 || t > 1) return null
      return mixHex(resolveRef(left, ramps), resolveRef(right, ramps), t)
    }
  }
  const dot = body.lastIndexOf('.')
  if (dot < 0) return null
  const ramp = ramps[body.slice(0, dot)]
  const step = body.slice(dot + 1)
  if (step.includes('~')) {
    const [a, b] = step.split('~')
    const t = weight === undefined ? 0.5 : Number(weight)
    if (!Number.isFinite(t) || t < 0 || t > 1) return null
    return mixSteps(ramp, a, b, t)
  }
  return ramp?.steps?.[step] ?? null
}
