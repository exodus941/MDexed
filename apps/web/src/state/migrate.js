/* Forward migrations for saved documents.
   Cloud projects store whatever schema was current when they were saved, so
   anything loaded from the API or localStorage passes through here first. */
import { SCHEMA_VERSION, createInitialState, defaultRoles, emptyProse, uid, SPACE_STEPS, RADIUS_STEPS, ANTI_PATTERNS } from './schema.js'
import { DEFAULT_SHAPE } from '../color/ramp.js'
import { TYPE_ROLES } from '../type/scale.js'
import { COMPONENT_LIBRARY } from './components.js'
import { isValidColor } from '../color/convert.js'

const ACCENT_HINTS  = ['accent', 'primary', 'brand', 'action']
const NEUTRAL_HINTS = ['neutral', 'gray', 'grey', 'surface', 'background', 'bg', 'secondary']

const pick = (colors, hints) =>
  colors.find(c => hints.some(h => (c.name ?? '').toLowerCase().includes(h)))

const ROLE_NAMES = new Set(TYPE_ROLES.map(r => r.name))
const TYPE_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFeature', 'fontVariation']

/* A flat list of typography tokens becomes overrides where the name matches a
   generated role, and custom entries where it doesn't — so nothing a designer
   wrote is silently dropped when the scale takes over. */
function foldTypography(list, base) {
  const overrides = {}
  const custom = []
  for (const t of list ?? []) {
    if (!t?.name) continue
    if (ROLE_NAMES.has(t.name)) {
      for (const p of TYPE_PROPS) {
        if (t[p] !== '' && t[p] != null) overrides[`${t.name}.${p}`] = String(t[p])
      }
    } else {
      custom.push({ ...t, id: t.id ?? uid() })
    }
  }
  return { ...base, overrides, custom }
}

/* Flat scales fold into overrides on the matching step; unknown names are
   appended as extra steps so their values survive. */
function foldScale(list, cfgBase, defaultSteps, { pillAware = false } = {}) {
  const known = new Set(defaultSteps.map(s => s.name))
  const steps = defaultSteps.map(s => ({ ...s }))
  const overrides = {}

  for (const item of list ?? []) {
    if (!item?.name || item.value == null) continue
    if (known.has(item.name)) {
      overrides[item.name] = String(item.value)
    } else {
      const px = parseFloat(item.value)
      const isPill = pillAware && Number.isFinite(px) && px >= 999
      steps.push(isPill ? { name: item.name, pill: true } : { name: item.name, mult: Number.isFinite(px) ? px / cfgBase : 1 })
      if (!isPill && !Number.isFinite(px)) overrides[item.name] = String(item.value)
    }
  }
  return { steps, overrides }
}

/* An incoming component list becomes the whole component set. The built-in
   library is switched off wherever entries arrive — otherwise the defaults and
   the imported entries would both be emitted and every component would appear
   twice. */
function foldComponents(list, base) {
  const custom = (list ?? []).filter(c => c?.name).map(c => ({
    name: c.name,
    properties: (c.properties ?? []).filter(p => p?.key).map(p => ({ id: p.id ?? uid(), key: p.key, value: String(p.value ?? '') })),
  }))
  if (!custom.length) return { ...base }
  return {
    ...base,
    custom,
    enabled: Object.fromEntries(COMPONENT_LIBRARY.map(d => [d.name, false])),
  }
}

/* v1: flat `colors` array, no macros, no roles. */
function v1ToV2Shape(old) {
  const colors = Array.isArray(old.colors) ? old.colors.filter(c => isValidColor(c.value)) : []
  const base = createInitialState()
  const seeds = base.color.seeds.map(seed => {
    const hint = seed.name === 'accent' ? ACCENT_HINTS : seed.name === 'neutral' ? NEUTRAL_HINTS : [seed.name]
    const match = pick(colors, hint)
    return match ? { ...seed, hex: match.value } : seed
  })
  return {
    meta: old.meta,
    color: {
      ...base.color, seeds, shape: { ...DEFAULT_SHAPE }, roles: defaultRoles(),
      custom: colors.map(c => ({ id: c.id ?? uid(), name: c.name, value: c.value })),
    },
    typography: old.typography, rounded: old.rounded, spacing: old.spacing,
    components: old.components, prose: old.prose, macros: old.macros,
  }
}

/* v2 → v3: flat token lists become generated scales plus overrides. */
function toV3(mid) {
  const base = createInitialState()
  const space = foldScale(mid.spacing, base.space.base, SPACE_STEPS)
  const radius = foldScale(mid.rounded, base.radius.base, RADIUS_STEPS, { pillAware: true })

  return {
    ...base,
    meta: { ...base.meta, ...(mid.meta ?? {}) },
    macros: { ...base.macros, ...(mid.macros ?? {}) },
    color: { ...base.color, ...(mid.color ?? {}), shape: { ...DEFAULT_SHAPE, ...(mid.color?.shape ?? {}) }, roles: { ...defaultRoles(), ...(mid.color?.roles ?? {}) } },
    type: foldTypography(mid.typography, base.type),
    space: { ...base.space, ...space },
    radius: { ...base.radius, ...radius },
    components: foldComponents(mid.components, base.components),
    prose: { ...emptyProse(), ...(mid.prose ?? {}) },
    /* Build preferences arrived after this version shipped. A document without
       them takes the defaults rather than an undefined, which the emitter
       would read as "nothing stated" — the exact gap the section was added to
       close.
       `labelCase` briefly lived here and is now `voice.casing`, because one
       decision gets one field. Carry an old value across rather than dropping
       it, then drop the dead key so nothing reads it again. */
    build: (() => {
      const b = { ...base.build, ...(mid.build ?? {}) }
      delete b.labelCase
      return b
    })(),
    voice: {
      ...base.voice,
      ...(mid.voice ?? {}),
      casing: mid.voice?.casing ?? mid.build?.labelCase ?? base.voice.casing,
    },
    schemaVersion: SCHEMA_VERSION,
  }
}

/* The duration defaults changed from 120/200/320 to 125/250/500. A document
   carrying the old set exactly never had them chosen deliberately, so it gets
   the new ones. Anything edited is left alone. */
const SUPERSEDED_DURATIONS = { instant: 0, fast: 120, normal: 200, slow: 320 }
const isSuperseded = d =>
  d && Object.entries(SUPERSEDED_DURATIONS).every(([k, v]) => d[k] === v)

/** Fill in anything a partial save left out rather than trusting the blob. */
/* Keep the saved on/off choice for every constraint the document already knows
   about, drop any whose id no longer exists, and append the rest in the order
   the checklist declares them. */
function mergeAntiPatterns(saved) {
  const bySaved = new Map((saved ?? []).map(a => [a.id, a]))
  return ANTI_PATTERNS.map(a => ({ ...a, ...(bySaved.get(a.id) ?? {}) }))
}

function hydrate(raw) {
  const base = createInitialState()
  if (isSuperseded(raw.motion?.durations)) {
    raw = { ...raw, motion: { ...raw.motion, durations: { ...base.motion.durations } } }
  }
  return {
    ...base, ...raw,
    meta:   { ...base.meta, ...(raw.meta ?? {}) },
    macros: { ...base.macros, ...(raw.macros ?? {}) },
    color:  { ...base.color, ...(raw.color ?? {}), shape: { ...DEFAULT_SHAPE, ...(raw.color?.shape ?? {}) }, roles: { ...defaultRoles(), ...(raw.color?.roles ?? {}) } },
    type:   { ...base.type, ...(raw.type ?? {}), families: { ...base.type.families, ...(raw.type?.families ?? {}) }, fluid: { ...base.type.fluid, ...(raw.type?.fluid ?? {}) } },
    space:  { ...base.space, ...(raw.space ?? {}) },
    radius: { ...base.radius, ...(raw.radius ?? {}) },
    layout: { ...base.layout, ...(raw.layout ?? {}) },
    elevation: { ...base.elevation, ...(raw.elevation ?? {}) },
    motion: { ...base.motion, ...(raw.motion ?? {}), durations: { ...base.motion.durations, ...(raw.motion?.durations ?? {}) }, easings: { ...base.motion.easings, ...(raw.motion?.easings ?? {}) } },
    icons:  { ...base.icons, ...(raw.icons ?? {}) },
    focus:  { ...base.focus, ...(raw.focus ?? {}) },
    states: { ...base.states, ...(raw.states ?? {}) },
    components: { ...base.components, ...(raw.components ?? {}) },
    voice:  { ...base.voice, ...(raw.voice ?? {}) },
    directives: {
      ...base.directives, ...(raw.directives ?? {}),
      /* Merged by id rather than replaced. A saved document carries its own
         copy of the checklist, so a spread would freeze it at the length it had
         when it was saved and every constraint added later would reach new
         documents only. Choices already made are kept, and anything new arrives
         at its default. */
      antiPatterns: mergeAntiPatterns(raw.directives?.antiPatterns),
    },
    prose:  { ...emptyProse(), ...(raw.prose ?? {}) },
  }
}

/**
 * Bring any saved document up to the current schema.
 * @returns {{ state: object, migratedFrom: number|null, warning: string|null }}
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') {
    return { state: createInitialState(), migratedFrom: null, warning: 'Saved data was unreadable; started a new document.' }
  }

  const version = Number(raw.schemaVersion) || (Array.isArray(raw.colors) ? 1 : 0)

  if (version === SCHEMA_VERSION) return { state: hydrate(raw), migratedFrom: null, warning: null }
  if (version <= 1) return { state: toV3(v1ToV2Shape(raw)), migratedFrom: version || 1, warning: null }
  if (version === 2) return { state: toV3(raw), migratedFrom: 2, warning: null }

  /* Saved by a newer build than this one. Load what we understand and say so
     rather than silently dropping fields the user can still see in the file. */
  return {
    state: hydrate(raw),
    migratedFrom: version,
    warning: `This document was saved by a newer version (schema ${version}). Some settings may not have loaded.`,
  }
}
