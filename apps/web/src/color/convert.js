/* Colour conversion — every model the picker exposes, on top of culori.
   Internally everything is a culori colour object; the UI and the emitter
   both speak hex, so round-tripping stays lossless within sRGB. */
import { parse, formatHex, formatHex8, converter, clampChroma } from 'culori'

const toRgb   = converter('rgb')
const toHsl   = converter('hsl')
const toHsv   = converter('hsv')
const toOklch = converter('oklch')

export const parseColor = str => {
  if (typeof str !== 'string' || !str.trim()) return null
  try { return parse(str.trim()) ?? null } catch { return null }
}
export const isValidColor = str => parseColor(str) != null

/* Hex is the canonical serialisation. Alpha only appears when it isn't 1. */
export const toHex = c => {
  if (!c) return null
  return c.alpha != null && c.alpha < 1 ? formatHex8(c) : formatHex(c)
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const r3 = v => Math.round(v * 1000) / 1000

/* ── sRGB 0–255 ── */
export const toRgb255 = c => {
  const { r, g, b, alpha } = toRgb(c)
  return { r: Math.round(clamp(r, 0, 1) * 255), g: Math.round(clamp(g, 0, 1) * 255), b: Math.round(clamp(b, 0, 1) * 255), a: alpha ?? 1 }
}
export const fromRgb255 = ({ r, g, b, a = 1 }) =>
  ({ mode: 'rgb', r: clamp(r, 0, 255) / 255, g: clamp(g, 0, 255) / 255, b: clamp(b, 0, 255) / 255, alpha: a })

/* ── HSL, degrees + percentages ── */
export const toHsl360 = c => {
  const { h, s, l, alpha } = toHsl(c)
  return { h: Math.round(h ?? 0), s: Math.round((s ?? 0) * 100), l: Math.round((l ?? 0) * 100), a: alpha ?? 1 }
}
export const fromHsl360 = ({ h, s, l, a = 1 }) =>
  ({ mode: 'hsl', h: ((h % 360) + 360) % 360, s: clamp(s, 0, 100) / 100, l: clamp(l, 0, 100) / 100, alpha: a })

/* ── HSB (a.k.a. HSV) — what Figma and Photoshop call it ── */
export const toHsb360 = c => {
  const { h, s, v, alpha } = toHsv(c)
  return { h: Math.round(h ?? 0), s: Math.round((s ?? 0) * 100), b: Math.round((v ?? 0) * 100), a: alpha ?? 1 }
}
export const fromHsb360 = ({ h, s, b, a = 1 }) =>
  ({ mode: 'hsv', h: ((h % 360) + 360) % 360, s: clamp(s, 0, 100) / 100, v: clamp(b, 0, 100) / 100, alpha: a })

/* ── OKLCH — perceptually uniform, what the ramp generator works in ── */
export const toOklchObj = c => {
  const { l, c: chroma, h, alpha } = toOklch(c)
  return { l: r3(l ?? 0), c: r3(chroma ?? 0), h: Math.round(h ?? 0), a: alpha ?? 1 }
}
export const fromOklch = ({ l, c, h, a = 1 }) =>
  ({ mode: 'oklch', l: clamp(l, 0, 1), c: Math.max(0, c), h: ((h % 360) + 360) % 360, alpha: a })

/* Pull chroma down until the colour fits in sRGB. Out-of-gamut OKLCH is easy
   to specify and renders as a clipped, muddy mess otherwise. */
export const toGamut = c => clampChroma(c, 'oklch')
export const inGamut = c => {
  const { r, g, b } = toRgb(c)
  const eps = 1e-4
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps
}

export const withAlpha = (c, a) => ({ ...c, alpha: a })

/* Convenience: hex in, hex out, through whichever model the UI is editing. */
export const hexFrom = obj => toHex(toGamut(obj))
