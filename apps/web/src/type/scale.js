/* Type scale generation.

   Sizes come from a modular scale; line-height and tracking are then derived
   from the resulting size rather than set per token. Both follow curves real
   typesetting uses — leading tightens as type grows, tracking goes negative at
   display sizes and slightly positive at caption sizes — so the scale stays
   optically consistent instead of merely arithmetically consistent. */

export const RATIOS = [
  { name: 'Minor second', value: 1.067 },
  { name: 'Major second', value: 1.125 },
  { name: 'Minor third', value: 1.200 },
  { name: 'Major third', value: 1.250 },
  { name: 'Perfect fourth', value: 1.333 },
  { name: 'Augmented fourth', value: 1.414 },
  { name: 'Perfect fifth', value: 1.500 },
  { name: 'Golden ratio', value: 1.618 },
]

/** Which family each role draws from, its step off the base, and its weight. */
export const TYPE_ROLES = [
  { name: 'display',  step: 6,     family: 'display', weight: 700 },
  { name: 'h1',       step: 5,     family: 'display', weight: 700 },
  { name: 'h2',       step: 4,     family: 'display', weight: 700 },
  { name: 'h3',       step: 3,     family: 'display', weight: 600 },
  { name: 'h4',       step: 2,     family: 'display', weight: 600 },
  { name: 'h5',       step: 1,     family: 'display', weight: 600 },
  { name: 'h6',       step: 0.5,   family: 'display', weight: 600 },
  { name: 'body-lg',  step: 0.5,   family: 'body',    weight: 400 },
  { name: 'body-md',  step: 0,     family: 'body',    weight: 400 },
  { name: 'body-sm',  step: -0.5,  family: 'body',    weight: 400 },
  { name: 'caption',  step: -1,    family: 'body',    weight: 400 },
  { name: 'overline', step: -1,    family: 'body',    weight: 500, tracking: 0.08 },
  { name: 'button',   step: -0.25, family: 'body',    weight: 500 },
  { name: 'code',     step: -0.25, family: 'mono',    weight: 400 },
]

const round = (v, p = 2) => Math.round(v * 10 ** p) / 10 ** p
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Modular scale: base × ratio^step. */
export const sizeAt = (base, ratio, step) => base * Math.pow(ratio, step)

/** Leading tightens as size grows — 1.6-ish at caption, 1.2-ish at display. */
export function autoLeading(sizePx, tightness = 1) {
  return round(clamp(1.15 + 0.7 * Math.exp(-sizePx / 30) * tightness, 1.0, 1.9), 2)
}

/** Optical tracking: negative for large type, marginally positive for small. */
export function autoTracking(sizePx, tightness = 1) {
  const em = -0.0223 * Math.log(sizePx / 13.2) * tightness
  return round(clamp(em, -0.05, 0.025), 3)
}

/**
 * A `clamp()` that interpolates between two viewport widths.
 * Both endpoints are in px; the middle term is the linear interpolation.
 */
export function fluidClamp(minPx, maxPx, minVw, maxVw) {
  if (maxVw === minVw || Math.abs(maxPx - minPx) < 0.01) return `${round(maxPx, 1)}px`
  const slope = (maxPx - minPx) / (maxVw - minVw)
  const intercept = minPx - slope * minVw
  return `clamp(${round(minPx, 1)}px, ${round(intercept, 2)}px + ${round(slope * 100, 3)}vw, ${round(maxPx, 1)}px)`
}

/**
 * Build the full set of typography tokens.
 *
 * @param cfg   type config from state
 * @param scale the global type-scale macro
 * @returns array of tokens in DESIGN.md typography shape, plus `computedPx`
 *          for the UI and `modified` where an override is in play.
 */
export function buildTypeScale(cfg, scale = 1) {
  const { base, ratio, families, fluid, leading, tracking, axes, features, overrides = {} } = cfg
  const effectiveBase = base * scale

  return TYPE_ROLES.map(role => {
    const key = role.name
    const ov = k => overrides[`${key}.${k}`]

    const px = sizeAt(effectiveBase, ratio, role.step)
    let fontSize
    if (ov('fontSize')) {
      fontSize = ov('fontSize')
    } else if (fluid?.enabled) {
      const minPx = sizeAt(base * fluid.minScale, fluid.minRatio, role.step)
      fontSize = fluidClamp(minPx, px, fluid.minVw, fluid.maxVw)
    } else {
      fontSize = `${round(px, 1)}px`
    }

    /* Prefer the resolved stack when derive supplied one, but never over an
       explicit override — that's what keeps an imported family surviving a
       round trip. */
    const fam = families[role.family] ?? families.body
    const weight = ov('fontWeight') ?? String(role.weight)

    return {
      id: `ty-${key}`,
      name: key,
      family: role.family,
      fontFamily: ov('fontFamily') ?? fam?.stack ?? fam?.family ?? '',
      fontSize,
      fontWeight: weight,
      lineHeight: ov('lineHeight') ?? String(autoLeading(px, leading)),
      letterSpacing: ov('letterSpacing') ?? `${role.tracking ?? autoTracking(px, tracking)}em`,
      fontFeature: ov('fontFeature') ?? (features?.[role.family]?.length ? features[role.family].map(f => `"${f}" 1`).join(', ') : ''),
      fontVariation: ov('fontVariation') ?? formatVariation(axes?.[role.family], role.weight),
      computedPx: round(px, 1),
      modified: Object.keys(overrides).some(k => k.startsWith(`${key}.`)),
    }
  })
}

/** Variable-font axis settings, omitting wght (carried by fontWeight). */
function formatVariation(axisValues, weight) {
  if (!axisValues) return ''
  const parts = Object.entries(axisValues)
    .filter(([tag, v]) => tag !== 'wght' && v != null)
    .map(([tag, v]) => `"${tag}" ${v}`)
  return parts.length ? parts.join(', ') : ''
}

/** OpenType features worth surfacing as checkboxes, keyed by tag. */
export const OPENTYPE_FEATURES = [
  { tag: 'liga', label: 'Standard ligatures' },
  { tag: 'dlig', label: 'Discretionary ligatures' },
  { tag: 'tnum', label: 'Tabular figures' },
  { tag: 'onum', label: 'Old-style figures' },
  { tag: 'smcp', label: 'Small caps' },
  { tag: 'ss01', label: 'Stylistic set 1' },
  { tag: 'zero', label: 'Slashed zero' },
  { tag: 'frac', label: 'Fractions' },
]
