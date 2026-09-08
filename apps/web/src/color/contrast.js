/* Contrast checking. WCAG 2.1 ratios because that's what accessibility
   requirements are still written against, and APCA Lc alongside it because
   the WCAG formula is badly wrong about dark backgrounds and light text. */
import { wcagContrast } from 'culori'
import { parseColor, toRgb255 } from './convert.js'

/* ── A TRANSLUCENT COLOUR HAS NO RATIO UNTIL IT IS COMPOSITED ──
 *
 * Both formulas below read a colour's channels and had no opinion about its
 * alpha, so a translucent value passed AA while failing it on screen by a
 * factor of five. Measured before this:
 *
 *     #00000080 on white       reported 21:1      composited 4:1
 *     #33333380 on white       reported 12.63:1   composited 2.85:1
 *     #ffffff80 on #111111     reported 18.88:1   composited 5.33:1
 *
 * The foreground's ground IS the background, so that half is exact.
 */
export const alphaOf = c => {
  const p = parseColor(c)
  if (!p) return null
  const a = toRgb255(p).a
  return a == null ? 1 : a
}

/** Composite `c` over `over`, in sRGB, which is where the eye reads it. */
export function flatten(c, over) {
  const f = parseColor(c), g = parseColor(over)
  if (!f) return null
  const fr = toRgb255(f)
  const a = fr.a == null ? 1 : fr.a
  if (a >= 1 || !g) return c
  const gr = toRgb255(g)
  const mix = (x, y) => Math.round(x * a + y * (1 - a))
  const hex = n => n.toString(16).padStart(2, 0)
  return '#' + hex(mix(fr.r, gr.r)) + hex(mix(fr.g, gr.g)) + hex(mix(fr.b, gr.b))
}

/* ── WCAG 2.1 ── */
/**
 * @param {string} fg
 * @param {string} bg
 * @param {{ under?: string }} [opts] the ground a TRANSLUCENT bg sits on.
 *   Without it a translucent background cannot be measured, and a test that
 *   cannot run returns null rather than a verdict.
 */
export function wcag(fg, bg, opts) {
  const flatBg = flattenBg(bg, opts)
  if (flatBg == null) return null
  const a = parseColor(flatten(fg, flatBg)), b = parseColor(flatBg)
  if (!a || !b) return null
  const ratio = wcagContrast(a, b)
  return {
    ratio: Math.round(ratio * 100) / 100,
    normalAA:  ratio >= 4.5,
    normalAAA: ratio >= 7,
    largeAA:   ratio >= 3,
    largeAAA:  ratio >= 4.5,
    ui:        ratio >= 3,   // non-text: borders, focus rings, icons
  }
}

/* ── A TRANSLUCENT BACKGROUND HAS NO KNOWN GROUND HERE ──
 * Its ground is whatever the page puts behind it, which this layer cannot
 * see. Return null so the caller says "not measured" rather than printing a
 * number nobody can act on. A caller that knows the ground passes `under`. */
function flattenBg(bg, opts) {
  if (!parseColor(bg)) return null
  if (alphaOf(bg) >= 1) return bg
  const under = opts && opts.under
  if (!under || alphaOf(under) < 1) return null
  return flatten(bg, under)
}

/* Best of AA / AAA / fail, for a compact badge in the UI. */
export function wcagGrade(fg, bg, { large = false, under } = {}) {
  const r = wcag(fg, bg, { under })
  if (!r) return { label: '—', pass: false, ratio: null }
  const aaa = large ? r.largeAAA : r.normalAAA
  const aa  = large ? r.largeAA  : r.normalAA
  return {
    ratio: r.ratio,
    pass: aa,
    label: aaa ? 'AAA' : aa ? 'AA' : r.ui ? 'UI only' : 'Fail',
  }
}

/* ── APCA (W3 0.1.9) ──
   Lc is a signed, polarity-aware lightness contrast. Rough guidance:
   90 = body text at small sizes, 75 = body, 60 = large text,
   45 = headlines, 30 = the floor for anything that must be legible,
   15 = disabled text and decorative dividers only. */
const MAIN_TRC = 2.4
const [RCO, GCO, BCO] = [0.2126729, 0.7151522, 0.0721750]
const NORM_BG = 0.56, NORM_TXT = 0.57, REV_TXT = 0.62, REV_BG = 0.65
const BLK_THRS = 0.022, BLK_CLMP = 1.414
const SCALE_BOW = 1.14, SCALE_WOB = 1.14
const LO_BOW_OFFSET = 0.027, LO_WOB_OFFSET = 0.027
const DELTA_Y_MIN = 0.0005, LO_CLIP = 0.1

const luminance = hex => {
  const { r, g, b } = toRgb255(parseColor(hex))
  const lin = v => Math.pow(v / 255, MAIN_TRC)
  return RCO * lin(r) + GCO * lin(g) + BCO * lin(b)
}

const softClampBlack = y => (y > BLK_THRS ? y : y + Math.pow(BLK_THRS - y, BLK_CLMP))

export function apca(textHex, bgHex, opts) {
  const flatBg = flattenBg(bgHex, opts)
  if (flatBg == null) return null
  if (!parseColor(textHex)) return null
  const yTxt = softClampBlack(luminance(flatten(textHex, flatBg)))
  const yBg  = softClampBlack(luminance(flatBg))
  if (Math.abs(yBg - yTxt) < DELTA_Y_MIN) return 0

  let sapc, out
  if (yBg > yTxt) {                                   // dark text on light bg
    sapc = (Math.pow(yBg, NORM_BG) - Math.pow(yTxt, NORM_TXT)) * SCALE_BOW
    out = sapc < LO_CLIP ? 0 : sapc - LO_BOW_OFFSET
  } else {                                            // light text on dark bg
    sapc = (Math.pow(yBg, REV_BG) - Math.pow(yTxt, REV_TXT)) * SCALE_WOB
    out = sapc > -LO_CLIP ? 0 : sapc + LO_WOB_OFFSET
  }
  return Math.round(out * 100 * 10) / 10
}

/** What the given Lc is actually good for. */
export function apcaUse(lc) {
  const v = Math.abs(lc ?? 0)
  if (v >= 90) return 'Any text'
  if (v >= 75) return 'Body text'
  if (v >= 60) return 'Large text'
  if (v >= 45) return 'Headlines'
  if (v >= 30) return 'Non-text only'
  return 'Insufficient'
}

/** Combined report for one foreground/background pair. */
export function check(fg, bg, opts) {
  const w = wcagGrade(fg, bg, opts)
  const lc = apca(fg, bg, opts)
  /* NOT MEASURED IS NOT A PASS. A translucent background with no stated
     ground cannot be graded, and saying so beats printing a wrong number. */
  if (w.ratio == null) return { ...w, lc: null, use: apcaUse(null), notMeasured: true }
  return { ...w, lc, use: apcaUse(lc) }
}

/** Pick whichever of two candidates reads better on `bg`. */
export function bestOn(bg, candidates = ['#ffffff', '#000000'], opts) {
  let best = candidates[0], bestLc = -1
  for (const c of candidates) {
    const lc = Math.abs(apca(c, bg, opts) ?? 0)
    if (lc > bestLc) { bestLc = lc; best = c }
  }
  return best
}
