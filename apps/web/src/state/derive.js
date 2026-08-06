/* The single source of truth for concrete token values.
   Pure: state in, resolved tokens out. Both the preview and the file emitter
   read from here, which is what guarantees that what you see is what exports. */
import { buildRamps, resolveRef, RAMP_STEPS } from '../color/ramp.js'
import { gradientCss } from '../color/modes.js'
import { parseColor, toRgb255 } from '../color/convert.js'
import { buildTypeScale } from '../type/scale.js'
import { stackFor } from '../type/fonts.js'
import { expandComponents } from './components.js'
import { resolveAllLayouts } from './componentLayout.js'
import { ALL_ROLES } from './schema.js'

const UNIT_RE = /^(-?\d*\.?\d+)\s*([a-z%]*)$/i
const round = (v, p = 1) => Math.round(v * 10 ** p) / 10 ** p

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
  return `${unit === 'px' ? round(scaled, 1) : round(scaled, 3)}${unit}`
}

const rgbaOf = (hex, alpha) => {
  const c = parseColor(hex)
  if (!c) return `rgba(0,0,0,${alpha})`
  const { r, g, b } = toRgb255(c)
  return `rgba(${r},${g},${b},${round(alpha, 3)})`
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

function deriveElevation(cfg, shadowHex, depth) {
  const out = {}
  const strength = depth * (cfg?.tintStrength ?? 1)
  for (const lvl of ELEVATION_LEVELS) {
    /* Border and tonal systems deliberately emit no shadows — the note in the
       markdown body explains what to use instead. */
    out[lvl.name] = (cfg?.strategy !== 'shadow' || !lvl.layers.length)
      ? 'none'
      : lvl.layers
          .map(([x, y, blur, spread, a]) =>
            `${x}px ${round(y * depth)}px ${round(blur * depth)}px ${spread}px ${rgbaOf(shadowHex, Math.min(0.6, a * strength))}`)
          .join(', ')
  }
  return out
}

export function derive(state) {
  const { color, macros } = state
  const m = { scale: 1, density: 1, roundness: 1, depth: 1, speed: 1, ...macros }

  /* ── Colour ── */
  const ramps = buildRamps(color.seeds, color.shape)
  for (const [ref, hex] of Object.entries(color.stepOverrides ?? {})) {
    const dot = ref.lastIndexOf('.')
    const rampName = ref.slice(0, dot), step = ref.slice(dot + 1)
    if (ramps[rampName]?.steps?.[step] != null) ramps[rampName].steps[step] = hex
  }

  const roles = { light: {}, dark: {} }
  for (const role of ALL_ROLES) {
    for (const mode of ['light', 'dark']) {
      const override = color.roleOverrides?.[`${role.name}:${mode}`]
      const ref = color.roles?.[role.name]?.[mode] ?? role[mode]
      roles[mode][role.name] = override ?? resolveRef(ref, ramps) ?? '#000000'
    }
  }

  const gradients = (color.gradients ?? []).map(g => ({
    ...g,
    css: gradientCss(g, { roles: roles[color.mode], ramps, resolveRef }),
  }))

  /* ── Typography ── */
  const families = Object.fromEntries(
    Object.entries(state.type.families).map(([k, v]) => [k, { ...v, stack: stackFor(v.family, v.category) }])
  )
  const typography = [
    ...buildTypeScale({ ...state.type, families }, m.scale),
    ...(state.type.custom ?? []),
  ]

  /* ── Spacing ── */
  const spacing = state.space.steps.map(s => ({
    id: `sp-${s.name}`,
    name: s.name,
    value: state.space.overrides?.[s.name] ?? `${round(state.space.base * s.mult * m.density, 1)}px`,
    overridden: state.space.overrides?.[s.name] != null,
  }))

  /* ── Radius ── */
  const rounded = state.radius.steps.map(r => ({
    id: `rd-${r.name}`,
    name: r.name,
    value: state.radius.overrides?.[r.name]
      ?? (r.pill ? '9999px' : `${round(state.radius.base * r.mult * m.roundness, 1)}px`),
    overridden: state.radius.overrides?.[r.name] != null,
    pill: !!r.pill,
  }))

  /* ── Everything else ── */
  const shadowHex = resolveRef(state.elevation?.tintRole ?? 'neutral.950', ramps) ?? '#000000'
  const scrimColor = resolveRef(state.elevation?.scrim?.color ?? 'neutral.950', ramps) ?? '#000000'
  const elevation = deriveElevation(state.elevation, shadowHex, m.depth)

  const motion = {
    durations: Object.fromEntries(
      Object.entries(state.motion.durations).map(([k, ms]) => [k, `${Math.round(ms * m.speed)}ms`])
    ),
    easings: { ...state.motion.easings },
    reducedMotion: state.motion.reducedMotion,
  }

  /* Component defaults reference elevation, focus, states and icons the same
     way they reference colours — but those aren't token groups in the emitted
     file, so `{elevation.raised}` would reach an agent unresolved. Flatten
     them to literals here; `{colors.*}`, `{rounded.*}`, `{spacing.*}` and
     `{typography.*}` stay as references because those do resolve. */
  const literals = { elevation, focus: state.focus, states: state.states, icons: state.icons }
  const resolveLiterals = value => String(value).replace(
    /\{(elevation|focus|states|icons)\.([a-zA-Z0-9_-]+)\}/g,
    (match, group, key) => {
      const v = literals[group]?.[key] ?? literals[group]?.sizes?.[key]
      if (v == null) return match
      return typeof v === 'number' && group !== 'states' ? `${v}px` : String(v)
    }
  )

  const components = [
    ...expandComponents(state.components),
    ...(state.components?.custom ?? []).map(c => ({ ...c, source: 'custom' })),
  ].map(c => ({ ...c, properties: c.properties.map(p => ({ ...p, value: resolveLiterals(p.value) })) }))

  const componentLayout = resolveAllLayouts(state.components?.layout)

  return {
    ramps, roles, families, typography, spacing, rounded, elevation, motion, components, gradients,
    componentLayout,
    shadowHex, scrimColor,
    layout: state.layout,
    icons: state.icons,
    focus: state.focus,
    states: state.states,
    borderWidths: state.radius?.borderWidths ?? {},
    cssVars: buildCssVars({ roles, typography, spacing, rounded, elevation, motion, components, gradients, focus: state.focus, icons: state.icons, layout: state.layout, elevationCfg: state.elevation, borderWidths: state.radius?.borderWidths ?? {} }, color.mode),
  }
}

const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/* Component entries → CSS variables, so editing `input.padding` actually moves
   the input in the preview. Without this the matrix only affected the exported
   file and the preview quietly kept using the raw scales. */
function buildComponentVars(components = [], { roles, spacing, rounded, typography, gradients, icons, ramps }) {
  const spaceBy = Object.fromEntries(spacing.map(s => [s.name, s.value]))
  const roundBy = Object.fromEntries(rounded.map(r => [r.name, r.value]))
  const typeBy = Object.fromEntries(typography.map(t => [t.name, t]))

  /* Scale steps are legal colour references too — the emitted file carries
     `accent-700` alongside the roles — so the preview has to resolve them or
     it would quietly disagree with the export. Flattened under the same
     hyphenated names the emitter uses. */
  const stepBy = {}
  for (const [name, ramp] of Object.entries(ramps ?? {})) {
    for (const [step, hex] of Object.entries(ramp.steps ?? {})) stepBy[`${name}-${step}`] = hex
  }

  const gradientBy = Object.fromEntries((gradients ?? []).map(g => [g.name, g.css]))
  const resolve = v => String(v)
    .replace(/\{colors\.([\w-]+)\}/g, (m, k) => roles[k] ?? stepBy[k] ?? m)
    .replace(/\{spacing\.([\w-]+)\}/g, (m, k) => spaceBy[k] ?? m)
    .replace(/\{rounded\.([\w-]+)\}/g, (m, k) => roundBy[k] ?? m)
    .replace(/\{gradient\.([\w-]+)\}/g, (m, k) => gradientBy[k] ?? m)
    .replace(/\{icons\.([\w-]+)\}/g, (m, k) => (icons?.sizes?.[k] != null ? `${icons.sizes[k]}px` : m))

  const vars = {}
  for (const c of components) {
    for (const p of c.properties ?? []) {
      /* A typography reference isn't one value — expand it into the pieces CSS
         actually needs, since var() can't dereference a token name. */
      if (p.key === 'typography') {
        const t = typeBy[p.value]
        if (!t) continue
        if (t.fontSize)      vars[`--cmp-${c.name}-font-size`] = t.fontSize
        if (t.fontWeight)    vars[`--cmp-${c.name}-font-weight`] = t.fontWeight
        if (t.fontFamily)    vars[`--cmp-${c.name}-font-family`] = t.fontFamily
        if (t.letterSpacing) vars[`--cmp-${c.name}-tracking`] = t.letterSpacing
        continue
      }
      vars[`--cmp-${c.name}-${kebab(p.key)}`] = resolve(p.value)
    }
  }
  return vars
}

/** Flat `--token: value` map. The preview injects this; nothing else styles it. */
export function buildCssVars(d, mode = 'light') {
  const vars = {}
  for (const [name, hex] of Object.entries(d.roles?.[mode] ?? {})) vars[`--c-${name}`] = hex
  for (const s of d.spacing ?? []) vars[`--space-${s.name}`] = s.value
  for (const r of d.rounded ?? []) vars[`--radius-${r.name}`] = r.value
  /* The Shapes section of the exported file documents these by name, so an
     agent writes `var(--border-hairline)` and every declaration using it dies
     silently — an undefined custom property with no fallback invalidates the
     whole rule, and the border falls back to currentColor. Documented and not
     emitted is worse than absent: absent gets noticed. */
  for (const [name, w] of Object.entries(d.borderWidths ?? {})) vars[`--border-${name}`] = `${w}px`
  for (const t of d.typography ?? []) {
    if (t.fontFamily)    vars[`--font-${t.name}-family`] = t.fontFamily
    if (t.fontSize)      vars[`--font-${t.name}-size`] = t.fontSize
    if (t.fontWeight)    vars[`--font-${t.name}-weight`] = t.fontWeight
    if (t.lineHeight)    vars[`--font-${t.name}-leading`] = t.lineHeight
    if (t.letterSpacing) vars[`--font-${t.name}-tracking`] = t.letterSpacing
    if (t.fontFeature)   vars[`--font-${t.name}-features`] = t.fontFeature
  }
  for (const [name, val] of Object.entries(d.elevation ?? {})) vars[`--shadow-${name}`] = val
  for (const [name, val] of Object.entries(d.motion?.durations ?? {})) vars[`--duration-${name}`] = val
  for (const [name, val] of Object.entries(d.motion?.easings ?? {})) vars[`--ease-${name}`] = val
  if (d.focus) {
    vars['--focus-width'] = `${d.focus.width}px`
    vars['--focus-offset'] = `${d.focus.offset}px`
    vars['--focus-style'] = d.focus.style
  }
  for (const [name, px] of Object.entries(d.icons?.sizes ?? {})) vars[`--icon-${name}`] = `${px}px`
  if (d.icons?.strokeWidth != null) vars['--icon-stroke'] = String(d.icons.strokeWidth)
  if (d.icons?.gap) vars['--icon-gap'] = d.spacing?.find(s => s.name === d.icons.gap)?.value ?? '8px'
  if (d.layout?.maxMeasure) vars['--measure'] = `${d.layout.maxMeasure}ch`
  /* Fills blend with what's behind them; borders and shadows can't.
     Read from the config, not `d.elevation` — that holds the shadow levels. */
  vars['--fill-blend'] = d.elevationCfg?.fillBlend ?? 'normal'
  for (const g of d.gradients ?? []) if (g.name) vars[`--gradient-${g.name}`] = g.css
  /* Scrim settings reach the Overlays surface, where they're actually visible. */
  if (d.elevationCfg?.scrim) {
    vars['--scrim-opacity'] = String(d.elevationCfg.scrim.opacity ?? 0.55)
    vars['--scrim-blend'] = d.elevationCfg.blendMode ?? 'normal'
  }

  if (d.components?.length) {
    Object.assign(vars, buildComponentVars(d.components, {
      roles: d.roles?.[mode] ?? {}, spacing: d.spacing ?? [], rounded: d.rounded ?? [],
      typography: d.typography ?? [], gradients: d.gradients ?? [], icons: d.icons,
      ramps: d.ramps ?? {},
    }))
  }
  return vars
}

export const cssVarsToText = vars =>
  Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join('\n')

export { RAMP_STEPS }
