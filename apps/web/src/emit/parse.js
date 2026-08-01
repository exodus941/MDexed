/* Importing a DESIGN.md.

   The old hand-rolled parser understood exactly 0/2/4-space indentation and
   returned an empty document on anything it couldn't read — so a malformed
   file silently wiped the editor. This one uses a real YAML parser and, when
   it can't cope, says so and changes nothing. */
import { load as yamlLoad } from 'js-yaml'
import { createInitialState, ALL_ROLES, PROSE_SECTIONS, DEFAULT_MACROS, uid } from '../state/schema.js'
import { RAMP_STEPS } from '../color/ramp.js'
import { isValidColor } from '../color/convert.js'
import { GEN_BLOCK_RE } from './markdown.js'

const ROLE_NAMES = new Set(ALL_ROLES.map(r => r.name))
const STEP_SET = new Set(RAMP_STEPS.map(String))
const STEP_RE = new RegExp(`^(.+)-(${RAMP_STEPS.join('|')})$`)

const asArray = (map, fn) => Object.entries(map ?? {}).map(fn)

/* Sort colour tokens into roles, ramp steps, and everything else. */
function classifyColors(colors, warnings) {
  const roleOverrides = {}
  const rampSteps = {}   // rampName → { step: hex }
  const custom = []

  for (const [name, raw] of Object.entries(colors ?? {})) {
    const value = String(raw)
    if (!isValidColor(value)) {
      warnings.push(`Colour \`${name}\` has an unreadable value (${value}) and was skipped.`)
      continue
    }

    const darkRole = name.startsWith('dark-') ? name.slice(5) : null
    if (darkRole && ROLE_NAMES.has(darkRole)) { roleOverrides[`${darkRole}:dark`] = value; continue }
    if (ROLE_NAMES.has(name))                 { roleOverrides[`${name}:light`] = value; continue }

    const m = STEP_RE.exec(name)
    if (m && STEP_SET.has(m[2])) {
      ;(rampSteps[m[1]] ??= {})[m[2]] = value
      continue
    }
    custom.push({ id: uid(), name, value })
  }
  return { roleOverrides, rampSteps, custom }
}

/* Rebuild seeds from imported ramps so generation still has something to work
   from, while pinning every imported step as an override so the file's exact
   values survive the round trip. */
function seedsFromRamps(baseSeeds, rampSteps) {
  const seeds = baseSeeds.map(s => ({ ...s }))
  const stepOverrides = {}

  for (const [rampName, steps] of Object.entries(rampSteps)) {
    const mid = steps['500'] ?? steps['600'] ?? steps['400'] ?? Object.values(steps)[0]
    const existing = seeds.find(s => s.name === rampName)
    if (existing) existing.hex = mid
    else seeds.push({ id: uid(), name: rampName, hex: mid, desc: 'Imported' })
    for (const [step, hex] of Object.entries(steps)) stepOverrides[`${rampName}.${step}`] = hex
  }
  return { seeds, stepOverrides }
}

/* Match a heading to a prose field: exact first, then the loose matching the
   original parser used, so hand-written files with near-miss headings land. */
function proseKeyFor(heading) {
  const h = heading.trim().toLowerCase()
  const exact = PROSE_SECTIONS.find(s => s.heading.toLowerCase() === h)
  if (exact) return exact.k
  if (h.includes('overview')) return 'overview'
  if (/don'?t|do'?s/.test(h)) return 'dosDonts'
  if (h.includes('color') || h.includes('colour')) return 'colors'
  if (h.includes('typograph') || h.includes('type')) return 'typography'
  if (h.includes('layout') || h.includes('grid') || h.includes('spacing')) return 'layout'
  if (h.includes('elevation') || h.includes('depth') || h.includes('shadow')) return 'elevation'
  if (h.includes('shape') || h.includes('radius')) return 'shapes'
  if (h.includes('component')) return 'components'
  return null
}

/**
 * @returns {{ ok: boolean, state: object|null, warnings: string[], error: string|null }}
 *   On failure `state` is null and the caller must leave the document alone.
 */
export function parseFile(text) {
  const warnings = []
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, state: null, warnings, error: 'The file is empty.' }
  }

  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!fm) {
    return { ok: false, state: null, warnings, error: 'No YAML frontmatter found. A DESIGN.md must begin with a `---` delimited block.' }
  }

  let doc
  try {
    doc = yamlLoad(fm[1])
  } catch (e) {
    const where = e.mark ? ` (line ${e.mark.line + 1})` : ''
    return { ok: false, state: null, warnings, error: `Frontmatter is not valid YAML${where}: ${e.reason ?? e.message}` }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, state: null, warnings, error: 'Frontmatter did not parse to a set of key/value pairs.' }
  }

  const base = createInitialState()
  const { roleOverrides, rampSteps, custom } = classifyColors(doc.colors, warnings)
  const { seeds, stepOverrides } = seedsFromRamps(base.color.seeds, rampSteps)

  const typography = asArray(doc.typography, ([name, p]) => ({
    id: uid(), name,
    fontFamily: p?.fontFamily ?? '', fontSize: p?.fontSize ?? '',
    fontWeight: p?.fontWeight != null ? String(p.fontWeight) : '',
    lineHeight: p?.lineHeight != null ? String(p.lineHeight) : '',
    letterSpacing: p?.letterSpacing ?? '', fontFeature: p?.fontFeature ?? '', fontVariation: p?.fontVariation ?? '',
  }))

  const components = asArray(doc.components, ([name, props]) => ({
    id: uid(), name,
    properties: Object.entries(props ?? {}).map(([k, v]) => ({ id: uid(), key: k, value: String(v) })),
  }))

  /* Prose: drop generated blocks so re-importing our own output doesn't paste
     the tables back into the author's text. */
  const body = text.slice(fm[0].length)
  const prose = { ...base.prose }
  const headings = [...body.matchAll(/^## (.+)$/gm)]
  headings.forEach((m, i) => {
    const key = proseKeyFor(m[1])
    if (!key) return
    const raw = body.slice(m.index + m[0].length, headings[i + 1]?.index)
    prose[key] = raw.replace(GEN_BLOCK_RE, '').trim()
  })

  const state = {
    ...base,
    meta: {
      name: doc.name ?? base.meta.name,
      description: doc.description ?? '',
      version: doc.version ?? 'alpha',
    },
    /* Imported dimensions are already final. Re-applying macros on top would
       scale them a second time, so the multipliers reset to neutral. */
    macros: { ...DEFAULT_MACROS },
    color: {
      ...base.color,
      seeds,
      stepOverrides,
      roleOverrides,
      custom,
      emitRamps: Object.keys(rampSteps).length > 0,
      emitDark: Object.keys(roleOverrides).some(k => k.endsWith(':dark')),
    },
    typography: typography.length ? typography : base.typography,
    rounded: asArray(doc.rounded, ([name, value]) => ({ id: uid(), name, value: String(value) })),
    spacing: asArray(doc.spacing, ([name, value]) => ({ id: uid(), name, value: String(value) })),
    components,
    prose,
  }

  if (!state.rounded.length) state.rounded = base.rounded
  if (!state.spacing.length) state.spacing = base.spacing

  if (Object.values(state.macros).some(v => v !== 1)) warnings.push('Macro sliders were reset — imported values are treated as the new baseline.')
  if (custom.length) warnings.push(`${custom.length} colour token${custom.length === 1 ? '' : 's'} didn't match a known role or scale and were kept as custom tokens.`)

  return { ok: true, state, warnings, error: null }
}
