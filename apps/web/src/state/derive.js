/* The single source of truth for concrete token values.
   Pure: state in, resolved tokens out. Both the preview and the file emitter
   read from here, which is what guarantees that what you see is what exports. */
import { buildRamps, resolveRef, RAMP_STEPS } from '../color/ramp.js'
import { parseColor, toRgb255 } from '../color/convert.js'
import { ALL_ROLES } from './schema.js'

const UNIT_RE = /^(-?\d*\.?\d+)\s*([a-z%]*)$/i

/** Scale a dimension string by a factor, preserving its unit. */
export function scaleValue(value, factor, { keepLarge = false } = {}) {
  if (factor === 1) return value
  const m = UNIT_RE.exec(String(value ?? '').trim())
  if (!m) return value
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return value
  /* 9999px pill radii are a sentinel, not a measurement — never scale them. */
  if (keepLarge && Math.abs(n) >= 999) return value
  const scaled = n * factor
  const unit = m[2]
  const rounded = unit === 'px' ? Math.round(scaled * 10) / 10 : Math.round(scaled * 1000) / 1000
  return `${rounded}${unit}`
}

const rgbaOf = (hex, alpha) => {
  const c = parseColor(hex)
  if (!c) return `rgba(0,0,0,${alpha})`
  const { r, g, b } = toRgb255(c)
  return `rgba(${r},${g},${b},${Math.round(alpha * 1000) / 1000})`
}

/* ── Elevation ──
   Two stacked layers per level (a tight contact shadow plus a diffuse ambient
   one), tinted with the darkest neutral rather than pure black. Black shadows
   over a warm palette read as grey sludge; a tinted shadow keeps the hue. */
const ELEVATION_LEVELS = [
  { name: 'flat',    layers: [] },
  { name: 'raised',  layers: [[0, 1, 2, 0, 0.06], [0, 1, 3, 0, 0.10]] },
  { name: 'overlay', layers: [[0, 4, 8, -1, 0.08], [0, 8, 24, -2, 0.12]] },
  { name: 'modal',   layers: [[0, 8, 16, -4, 0.10], [0, 24, 48, -8, 0.16]] },
]

function deriveElevation(shadowHex, depth) {
  const out = {}
  for (const lvl of ELEVATION_LEVELS) {
    out[lvl.name] = lvl.layers.length === 0
      ? 'none'
      : lvl.layers
          .map(([x, y, blur, spread, a]) =>
            `${x}px ${Math.round(y * depth * 10) / 10}px ${Math.round(blur * depth * 10) / 10}px ${spread}px ${rgbaOf(shadowHex, Math.min(0.6, a * depth))}`)
          .join(', ')
  }
  return out
}

/* ── Motion ── */
const DURATIONS = { instant: 0, fast: 120, normal: 200, slow: 320 }
export const EASINGS = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  entrance: 'cubic-bezier(0, 0, 0, 1)',
  exit:     'cubic-bezier(0.3, 0, 1, 1)',
  emphasis: 'cubic-bezier(0.3, 0, 0, 1.2)',
}

const deriveMotion = speed => ({
  durations: Object.fromEntries(
    Object.entries(DURATIONS).map(([k, ms]) => [k, `${Math.round(ms * speed)}ms`])
  ),
  easings: { ...EASINGS },
})

/**
 * @returns resolved ramps, role colours for both modes, macro-scaled scales,
 *          elevation, motion, and a flat CSS custom-property map for preview.
 */
export function derive(state) {
  const { color, macros } = state
  const m = { scale: 1, density: 1, roundness: 1, depth: 1, speed: 1, ...macros }

  /* Ramps, with any per-step override applied on top of generation. */
  const ramps = buildRamps(color.seeds, color.shape)
  for (const [ref, hex] of Object.entries(color.stepOverrides ?? {})) {
    const dot = ref.lastIndexOf('.')
    const rampName = ref.slice(0, dot), step = ref.slice(dot + 1)
    if (ramps[rampName]?.steps?.[step] != null) ramps[rampName].steps[step] = hex
  }

  /* Roles resolve refs into hex; a role override short-circuits the ref. */
  const roles = { light: {}, dark: {} }
  for (const role of ALL_ROLES) {
    for (const mode of ['light', 'dark']) {
      const override = color.roleOverrides?.[`${role.name}:${mode}`]
      const ref = color.roles?.[role.name]?.[mode] ?? role[mode]
      roles[mode][role.name] = override ?? resolveRef(ref, ramps) ?? '#000000'
    }
  }

  /* Macro-scaled legacy scales. A locked token opts out of its macro. */
  const spacing = state.spacing.map(s =>
    ({ ...s, value: s.locked ? s.value : scaleValue(s.value, m.density) }))
  const rounded = state.rounded.map(r =>
    ({ ...r, value: r.locked ? r.value : scaleValue(r.value, m.roundness, { keepLarge: true }) }))
  const typography = state.typography.map(t =>
    ({ ...t, fontSize: t.locked ? t.fontSize : scaleValue(t.fontSize, m.scale) }))

  const shadowHex = ramps.neutral?.steps?.[950] ?? '#000000'
  const elevation = deriveElevation(shadowHex, m.depth)
  const motion = deriveMotion(m.speed)

  return {
    ramps, roles, spacing, rounded, typography, elevation, motion,
    shadowHex,
    cssVars: buildCssVars({ roles, spacing, rounded, typography, elevation, motion }, color.mode),
  }
}

/** Flat `--token: value` map. The preview injects this; nothing else styles it. */
export function buildCssVars({ roles, spacing, rounded, typography, elevation, motion }, mode = 'light') {
  const vars = {}
  for (const [name, hex] of Object.entries(roles[mode] ?? {})) vars[`--c-${name}`] = hex
  for (const s of spacing) vars[`--space-${s.name}`] = s.value
  for (const r of rounded) vars[`--radius-${r.name}`] = r.value
  for (const t of typography) {
    if (t.fontFamily)    vars[`--font-${t.name}-family`] = t.fontFamily
    if (t.fontSize)      vars[`--font-${t.name}-size`] = t.fontSize
    if (t.fontWeight)    vars[`--font-${t.name}-weight`] = t.fontWeight
    if (t.lineHeight)    vars[`--font-${t.name}-leading`] = t.lineHeight
    if (t.letterSpacing) vars[`--font-${t.name}-tracking`] = t.letterSpacing
  }
  for (const [name, val] of Object.entries(elevation)) vars[`--shadow-${name}`] = val
  for (const [name, val] of Object.entries(motion.durations)) vars[`--duration-${name}`] = val
  for (const [name, val] of Object.entries(motion.easings)) vars[`--ease-${name}`] = val
  return vars
}

export const cssVarsToText = vars =>
  Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join('\n')

export { RAMP_STEPS }
