/* Forward migrations for saved documents.
   Cloud projects store whatever schema was current when they were saved, so
   anything loaded from the API or localStorage passes through here first. */
import { SCHEMA_VERSION, createInitialState, defaultRoles, emptyProse, uid } from './schema.js'
import { DEFAULT_SHAPE } from '../color/ramp.js'
import { isValidColor } from '../color/convert.js'

/* Names that plausibly mean "this is the brand colour" / "this is the greys". */
const ACCENT_HINTS  = ['accent', 'primary', 'brand', 'action']
const NEUTRAL_HINTS = ['neutral', 'gray', 'grey', 'surface', 'background', 'bg', 'secondary']

const pick = (colors, hints) =>
  colors.find(c => hints.some(h => (c.name ?? '').toLowerCase().includes(h)))

/* v1: flat `colors` array, no macros, no roles. */
function v1ToV2(old) {
  const base = createInitialState()
  const colors = Array.isArray(old.colors) ? old.colors.filter(c => isValidColor(c.value)) : []

  const seeds = base.color.seeds.map(seed => {
    const hint = seed.name === 'accent' ? ACCENT_HINTS : seed.name === 'neutral' ? NEUTRAL_HINTS : [seed.name]
    const match = pick(colors, hint)
    return match ? { ...seed, hex: match.value } : seed
  })

  return {
    ...base,
    meta: { ...base.meta, ...(old.meta ?? {}) },
    color: {
      ...base.color,
      seeds,
      shape: { ...DEFAULT_SHAPE },
      roles: defaultRoles(),
      /* Nothing from the old palette is thrown away — anything that wasn't
         adopted as a seed is preserved verbatim as a custom token. */
      custom: colors.map(c => ({ id: c.id ?? uid(), name: c.name, value: c.value })),
    },
    typography: Array.isArray(old.typography) && old.typography.length ? old.typography : base.typography,
    rounded:    Array.isArray(old.rounded)    && old.rounded.length    ? old.rounded    : base.rounded,
    spacing:    Array.isArray(old.spacing)    && old.spacing.length    ? old.spacing    : base.spacing,
    components: Array.isArray(old.components) ? old.components : [],
    prose:      { ...emptyProse(), ...(old.prose ?? {}) },
    schemaVersion: SCHEMA_VERSION,
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

  if (version === SCHEMA_VERSION) {
    /* Fill in anything a partial save left out rather than trusting the blob. */
    const base = createInitialState()
    return {
      state: {
        ...base, ...raw,
        meta:   { ...base.meta, ...(raw.meta ?? {}) },
        macros: { ...base.macros, ...(raw.macros ?? {}) },
        color:  { ...base.color, ...(raw.color ?? {}), shape: { ...DEFAULT_SHAPE, ...(raw.color?.shape ?? {}) }, roles: { ...defaultRoles(), ...(raw.color?.roles ?? {}) } },
        prose:  { ...emptyProse(), ...(raw.prose ?? {}) },
      },
      migratedFrom: null, warning: null,
    }
  }

  if (version <= 1) {
    return { state: v1ToV2(raw), migratedFrom: version, warning: null }
  }

  /* Saved by a newer build than this one. Load what we understand and say so
     rather than silently dropping fields the user can still see in the file. */
  return {
    state: v1ToV2(raw),
    migratedFrom: version,
    warning: `This document was saved by a newer version (schema ${version}). Some settings may not have loaded.`,
  }
}
