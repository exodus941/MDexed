/* Seed colour → an 11-step ramp, generated in OKLCH so the steps are
   perceptually even rather than mathematically even. Three shape controls:
   a lightness curve, a chroma envelope, and a hue shift across the ramp
   (which is how you get warm shadows and cool highlights). */
import { parseColor, toOklchObj, fromOklch, toGamut, toHex, maxChroma, hexFrom } from './convert.js'
import { check } from './contrast.js'

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
/* ── A GREY HAS A HUE ON PAPER AND NONE TO THE EYE ──
 *
 * This averaged the two hue angles, which treats a near-grey's hue as if it
 * carried information. It does not. At chroma 0.006 the number is noise, and
 * averaging it with a real hue lands on a third colour that neither parent
 * has.
 *
 * Measured on the shipped role table: neutral.800 at chroma 0.0056 and a
 * nominal hue of 107, mixed 30% into accent.500 at hue 182, produced hue 129.
 * The user's words for it were "whatever this olive green shit is". It was in
 * `accent-raised` on every dark surface, and nothing reported it.
 *
 * WEIGHT EACH HUE BY ITS OWN CHROMA, times its share of the mix. A grey then
 * contributes nothing and the answer is the other parent's hue exactly. A
 * white mixed 30% into a teal now returns 182, the teal's own hue, where the
 * old code returned 130.
 *
 * NO THRESHOLD, which is the point. A chroma floor was searched for first,
 * across 24 accent hues and three ground tints, and no value cleared the
 * drift: the fault is polar interpolation itself, not where its cutoff sits.
 *
 * MIXING IN OKLAB ALSO FIXES IT, and costs too much. A straight line through
 * the a/b plane cuts inside the chroma circle, so a teal-to-orange mix came
 * out at chroma 0.053 against 0.117. Weighting keeps 0.111.
 *
 * The circular mean wraps by construction, so the old short-way correction is
 * gone rather than kept: a pair either side of 0 degrees can no longer average
 * to the colour opposite both. */
function mixHex (aHex, bHex, t = 0.5) {
  const A = parseColor(aHex), B = parseColor(bHex)
  if (!A || !B) return null
  const oa = toOklchObj(A), ob = toOklchObj(B)
  const mid = (x, y) => x + (y - x) * t
  const wa = (1 - t) * oa.c, wb = t * ob.c
  let h
  /* Two greys have no hue between them, so keep the first rather than
     inventing one from two noise readings. */
  if (wa + wb < 1e-9) h = oa.h ?? 0
  else {
    const ra = (oa.h ?? 0) * Math.PI / 180, rb = (ob.h ?? 0) * Math.PI / 180
    h = (Math.atan2(wa * Math.sin(ra) + wb * Math.sin(rb),
      wa * Math.cos(ra) + wb * Math.cos(rb)) * 180 / Math.PI + 360) % 360
  }
  return toHex(toGamut(fromOklch({ l: mid(oa.l, ob.l), c: mid(oa.c, ob.c), h })))
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

/**
 * A tint that carries the SAME amount of its hue whatever that hue is.
 *
 * ── THEIR REPORT, 11 SEPTEMBER 2026 ──
 *
 * "i think the accent tint needs to have a rolling value depending on the
 * hue, otherwise it's almost invisible in certain hues."
 *
 * Measured, and they are right. A tint taken as a fixed ramp step carries
 * whatever chroma sRGB happens to allow at that step's lightness, and that
 * allowance is wildly uneven. At L 0.970 the ceiling is 0.014 at hue 270 and
 * 0.096 at hue 120. So the light tint ran 0.005 to 0.020 over its ground, a
 * 4x spread, and the dark one ran 0.003 to 0.009.
 *
 * The shipped accent is a blue at hue 251, which sits in the weak band.
 *
 * ── ROLLING THE CHROMA ALONE CANNOT WORK ──
 *
 * The weak hues are already AT the ceiling: 99% to 104% of it at hues 0, 30,
 * 240, 270 and 300. Asking for more chroma there returns the same colour.
 * That is the rule about a hue's lightness not being free, pointed at a near
 * white rather than at a mid dark.
 *
 * ── SO THE LIGHTNESS ROLLS TOO, TOWARD THE GROUND ──
 *
 * The gamut opens as lightness leaves the extremes. A light tint sits above
 * its card and a dark tint below it, so in BOTH modes the room is in the
 * direction of the ground. One rule, no mode branch.
 *
 * ── AND THE LIFT IS WHAT STOPS IT ──
 *
 * Moving toward the ground spends the separation from it. Measured with the
 * lightness free and nothing stopping it, at a flat 0.028 over the ground:
 * six of twelve hues crossed the card entirely, turning a lighter tinted band
 * into a darker one.
 *
 * SO THE BAR IS THE ONE THE AUDIT ALREADY HOLDS. The first version stopped at
 * a contrast floor of 1.05 instead, which is a second currency for one
 * question. It walked straight past the audit's own bar, and the audit fired
 * on nine shipped configurations: `fill-flat:light:accent-subtle`. The check
 * was right and the solve was wrong.
 *
 * `SUBTLE_FILL_LIFT` is that bar, in OKLCH lightness, read by both. A hue
 * that still cannot reach the chroma target at the nearest allowed lightness
 * keeps whatever its ceiling gives there.
 *
 * The HUE comes from the starting colour, so the ramp still decides which
 * accent this is. Only its lightness and chroma move.
 */
export function solveTint (startHex, groundHex, { over, lift = SUBTLE_FILL_LIFT } = {}) {
  const s = toOklchObj(parseColor(startHex))
  const g = toOklchObj(parseColor(groundHex))
  if (!s || !g || !Number.isFinite(over)) return startHex
  const want = g.c + over
  /* Toward the ground, which is where sRGB has room. Above a light card that
     is downward and below a dark card it is upward. */
  const dir = s.l > g.l ? -1 : 1
  /* MEASURE THE HEX, NOT THE REQUEST. A target lightness of exactly
     `ground + lift` round-trips through a hex and comes back under the bar:
     measured, a solve aiming at L 0.960 produced 0.9590 against a 0.0200
     bar, and the audit fired on it. So each candidate is rendered, read back,
     and rejected on its OWN lift. */
  const at = l => {
    const hex = hexFrom({ mode: 'oklch', l, c: Math.min(want, maxChroma(l, s.h)), h: s.h })
    const o = toOklchObj(parseColor(hex))
    return { hex, c: o?.c ?? 0, lift: Math.abs((o?.l ?? 0) - g.l) }
  }
  let best = at(s.l)
  for (let step = 0.002; step <= 0.12 + 1e-9; step += 0.002) {
    const l = s.l + dir * step
    if (l <= 0 || l >= 1) break
    const cand = at(l)
    if (cand.lift < lift) break
    if (cand.c > best.c + 1e-4) best = cand
    if (best.c >= want - 1e-4) break
  }
  return best.hex
}

/**
 * The least lightness distance a tinted fill may sit from its ground.
 *
 * ONE BAR, TWO CALLERS. The a11y audit held this as its own constant and
 * `solveTint` was given a contrast floor instead, which is a second currency
 * for one question. The solve then walked past the audit's bar and the audit
 * fired on nine shipped configurations: `fill-flat:light:accent-subtle`.
 *
 * Two hundredths of OKLCH lightness is the least that reads as a plane at
 * all. Below it a tint is separated from its card by hue alone, which is what
 * a reader called solarized.
 */
export const SUBTLE_FILL_LIFT = 0.02
