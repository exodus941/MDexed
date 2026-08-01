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
   can't carry saturation — so taper it toward both ends of the ramp. */
const chromaEnvelope = (t, peak) => {
  const p = clamp(peak, 0.01, 0.99)
  const d = t <= p ? t / p : (1 - t) / (1 - p)
  return 0.2 + 0.8 * Math.pow(clamp(d, 0, 1), 0.7)
}

/**
 * @returns {{ steps: Record<number,string>, anchor: number|null }}
 */
export function buildRamp(seedHex, shape = DEFAULT_SHAPE) {
  const s = { ...DEFAULT_SHAPE, ...shape }
  const parsed = parseColor(seedHex)
  if (!parsed) return { steps: Object.fromEntries(RAMP_STEPS.map(k => [k, '#000000'])), anchor: null }

  const seed = toOklchObj(parsed)
  const n = RAMP_STEPS.length
  const steps = {}

  RAMP_STEPS.forEach((step, i) => {
    const t = i / (n - 1)
    const l = s.lightMax + (s.lightMin - s.lightMax) * easeCurve(t, s.curve)
    const c = seed.c * s.chromaScale * chromaEnvelope(t, s.chromaPeak)
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
export function buildRamps(seeds, shape) {
  const out = {}
  for (const seed of seeds) out[seed.name] = buildRamp(seed.hex, shape)
  return out
}

/** Resolve a `name.step` reference (e.g. "accent.600") against built ramps. */
export function resolveRef(ref, ramps) {
  if (typeof ref !== 'string') return null
  if (ref === 'white') return '#ffffff'
  if (ref === 'black') return '#000000'
  const dot = ref.lastIndexOf('.')
  if (dot < 0) return null
  const ramp = ramps[ref.slice(0, dot)]
  return ramp?.steps?.[ref.slice(dot + 1)] ?? null
}
