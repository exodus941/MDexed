/* Contrast checking. WCAG 2.1 ratios because that's what accessibility
   requirements are still written against, and APCA Lc alongside it because
   the WCAG formula is badly wrong about dark backgrounds and light text. */
import { wcagContrast } from 'culori'
import { parseColor, toRgb255 } from './convert.js'

/* ── WCAG 2.1 ── */
export function wcag(fg, bg) {
  const a = parseColor(fg), b = parseColor(bg)
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

/* Best of AA / AAA / fail, for a compact badge in the UI. */
export function wcagGrade(fg, bg, { large = false } = {}) {
  const r = wcag(fg, bg)
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

export function apca(textHex, bgHex) {
  if (!parseColor(textHex) || !parseColor(bgHex)) return null
  const yTxt = softClampBlack(luminance(textHex))
  const yBg  = softClampBlack(luminance(bgHex))
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
  const lc = apca(fg, bg)
  return { ...w, lc, use: apcaUse(lc) }
}

/** Pick whichever of two candidates reads better on `bg`. */
export function bestOn(bg, candidates = ['#ffffff', '#000000']) {
  let best = candidates[0], bestLc = -1
  for (const c of candidates) {
    const lc = Math.abs(apca(c, bg) ?? 0)
    if (lc > bestLc) { bestLc = lc; best = c }
  }
  return best
}
