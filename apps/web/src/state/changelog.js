/* Classifying edits for the change log.

   Category comes from which top-level branch of the document changed, found by
   reference comparison — cheap, and correct even when a caller forgot to tag
   its update. The tag, where there is one, supplies the detail. */

export const CHANGE_CATEGORIES = [
  { id: 'colour',     label: 'Colour',     colour: '#dc9055' },
  { id: 'type',       label: 'Type',       colour: '#7aa2f7' },
  { id: 'layout',     label: 'Layout',     colour: '#5aad80' },
  { id: 'shape',      label: 'Shape',      colour: '#c586c0' },
  { id: 'depth',      label: 'Depth',      colour: '#d8a441' },
  { id: 'motion',     label: 'Motion',     colour: '#4ec9b0' },
  { id: 'components', label: 'Components', colour: '#e06c9f' },
  { id: 'content',    label: 'Content',    colour: '#9cb4c7' },
  { id: 'system',     label: 'System',     colour: '#8d8d9e' },
]

export const CATEGORY_BY_ID = Object.fromEntries(CHANGE_CATEGORIES.map(c => [c.id, c]))

/* Which branch belongs to which category. */
const KEY_CATEGORY = {
  color: 'colour',
  type: 'type',
  space: 'layout', layout: 'layout',
  radius: 'shape', icons: 'shape', focus: 'shape', states: 'shape',
  elevation: 'depth',
  motion: 'motion',
  components: 'components',
  meta: 'content', prose: 'content', voice: 'content', directives: 'content',
  macros: 'system',
}

export const TOP_KEYS = Object.keys(KEY_CATEGORY)

/** Top-level branches that differ by reference between two documents. */
export function changedKeys(before, after) {
  if (!before || !after) return []
  return TOP_KEYS.filter(k => before[k] !== after[k])
}

/* Human phrasing per tag prefix. The suffix is usually the thing's own name,
   which is more useful than any wording we could invent for it. */
const TAG_LABELS = {
  revert: t => {
    const inner = TAG_LABELS[t.split(':')[0]]
    return `Reverted · ${inner ? inner(t.slice(t.indexOf(':') + 1)) : t}`
  },
  palette: t => `Palette generated · ${t}`,
  'seed-lock': () => 'Seed lock',
  macro: t => `${cap(t)} macro`,
  mode: () => 'Preview mode',
  seed: () => 'Seed colour',
  'seed-name': () => 'Seed renamed',
  step: t => `Scale step ${t}`,
  role: t => `Role ${t.replace(':', ' · ')}`,
  shape: t => `Scale shape · ${t}`,
  grad: () => 'Gradient',
  type: t => `Type · ${t}`,
  'ty-ov': t => `Type override · ${t}`,
  axis: t => `Variable axis · ${t}`,
  fluid: t => `Fluid sizing · ${t}`,
  'space:base': () => 'Base spacing unit',
  'sp-ov': t => `Spacing · ${t}`,
  layout: t => `Layout · ${t}`,
  bp: () => 'Breakpoint',
  ct: t => `Container · ${t}`,
  'radius:base': () => 'Base radius',
  'rd-ov': t => `Radius · ${t}`,
  bw: t => `Border width · ${t}`,
  icons: t => `Icons · ${t}`,
  icsz: t => `Icon size · ${t}`,
  focus: t => `Focus ring · ${t}`,
  states: t => `States · ${t}`,
  elev: t => `Elevation · ${t}`,
  dur: t => `Duration · ${t}`,
  ease: t => `Easing · ${t}`,
  comp: t => `Component · ${t}`,
  prop: () => 'Component property',
  meta: t => `Project ${t}`,
  prose: t => `Rationale · ${t}`,
  voice: t => `Voice · ${t}`,
  dir: t => `Directives · ${t}`,
}

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s)

const FALLBACK_LABEL = {
  color: 'Colour changed', type: 'Typography changed', space: 'Spacing changed',
  layout: 'Layout changed', radius: 'Radius changed', icons: 'Icons changed',
  focus: 'Focus changed', states: 'States changed', elevation: 'Elevation changed',
  motion: 'Motion changed', components: 'Components changed', meta: 'Project info changed',
  prose: 'Rationale changed', voice: 'Voice changed', directives: 'Directives changed',
  macros: 'Macros changed',
}

/* ── What actually changed ──
   A log line reading "Colour changed" is no better than no log line. These
   pull the before and after out of the two documents so an entry can say
   which token moved and to what. */

const seedById = (s, id) => (s.color?.seeds ?? []).find(x => x.id === id)
const gradById = (s, id) => (s.color?.gradients ?? []).find(x => x.id === id)
const at = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

/** Stops carried on a gradient entry, so the log can draw a real preview. */
const gradientSnapshot = g => g && ({
  name: g.name, type: g.type, angle: g.angle,
  stops: (g.stops ?? []).map(s => ({ color: s.color, position: s.position })),
})

/**
 * @returns {{ kind, from, to, subject }|null}
 *   kind: 'colour' | 'gradient' | 'value' | 'text'
 */
export function detailFor(tag, before, after) {
  if (!tag) return null
  const colon = tag.indexOf(':')
  const prefix = colon < 0 ? tag : tag.slice(0, colon)
  const rest = colon < 0 ? '' : tag.slice(colon + 1)

  const pair = (from, to, kind, subject) =>
    (from === to ? null : { kind, from, to, subject })

  switch (prefix) {
    /* A revert reports the same shape as the change it undoes — recurse on
       the original tag so it shows current → restored. */
    case 'revert':
      return detailFor(rest, before, after)
    case 'palette': {
      /* The whole palette moved, so the entry carries every seat. */
      const swatches = (after.color?.seeds ?? []).map(s => ({
        name: s.name,
        to: s.hex,
        from: seedById(before, s.id)?.hex,
        locked: !!s.locked,
      }))
      return { kind: 'palette', swatches, subject: rest }
    }
    case 'seed-lock': {
      const s = seedById(after, rest)
      return { kind: 'text', from: s?.locked ? 'unlocked' : 'locked', to: s?.locked ? 'locked' : 'unlocked', subject: s?.name }
    }
    case 'seed': {
      const a = seedById(before, rest), b = seedById(after, rest)
      return pair(a?.hex, b?.hex, 'colour', b?.name ?? a?.name)
    }
    case 'seed-name':
      return pair(seedById(before, rest)?.name, seedById(after, rest)?.name, 'text', 'Seed name')
    case 'step':
      return pair(before.color?.stepOverrides?.[rest], after.color?.stepOverrides?.[rest], 'colour', rest)
    case 'role':
      return pair(before.color?.roleOverrides?.[rest], after.color?.roleOverrides?.[rest], 'colour', rest.replace(':', ' · '))
    case 'grad': {
      const a = gradById(before, rest), b = gradById(after, rest)
      if (!b) return null
      return { kind: 'gradient', from: gradientSnapshot(a), to: gradientSnapshot(b), subject: b.name }
    }
    case 'macro':
      return pair(before.macros?.[rest], after.macros?.[rest], 'value', rest)
    case 'sp-ov':
      return pair(before.space?.overrides?.[rest], after.space?.overrides?.[rest], 'value', `spacing.${rest}`)
    case 'rd-ov':
      return pair(before.radius?.overrides?.[rest], after.radius?.overrides?.[rest], 'value', `radius.${rest}`)
    case 'ty-ov':
      return pair(before.type?.overrides?.[rest], after.type?.overrides?.[rest], 'value', rest)
    case 'comp':
      return pair(before.components?.overrides?.[rest], after.components?.overrides?.[rest], 'value', rest)
    case 'type':
      return pair(before.type?.[rest], after.type?.[rest], 'value', `type.${rest}`)
    case 'dur':
      return pair(before.motion?.durations?.[rest], after.motion?.durations?.[rest], 'value', `${rest} duration`)
    case 'ease':
      return pair(before.motion?.easings?.[rest], after.motion?.easings?.[rest], 'text', `${rest} easing`)
    case 'elev':
      return pair(at(before, `elevation.${rest}`), at(after, `elevation.${rest}`), 'value', `elevation.${rest}`)
    case 'focus':
      return pair(before.focus?.[rest], after.focus?.[rest], 'value', `focus.${rest}`)
    case 'icons':
      return pair(before.icons?.[rest], after.icons?.[rest], 'value', `icons.${rest}`)
    case 'icsz':
      return pair(before.icons?.sizes?.[rest], after.icons?.sizes?.[rest], 'value', `icon ${rest}`)
    case 'states':
      return pair(before.states?.[rest], after.states?.[rest], 'value', `states.${rest}`)
    case 'layout':
      return pair(before.layout?.[rest], after.layout?.[rest], 'value', `layout.${rest}`)
    case 'shape':
      return pair(before.color?.shape?.[rest], after.color?.shape?.[rest], 'value', `scale ${rest}`)
    case 'meta':
      return pair(before.meta?.[rest], after.meta?.[rest], 'text', rest)
    case 'voice':
      return pair(before.voice?.[rest], after.voice?.[rest], 'text', rest)
    case 'space:base':
    case 'radius:base':
      return null
    case 'prose': {
      const a = (before.prose?.[rest] ?? '').trim(), b = (after.prose?.[rest] ?? '').trim()
      if (a === b) return null
      const words = s => (s ? s.split(/\s+/).length : 0)
      return { kind: 'text', from: `${words(a)} words`, to: `${words(b)} words`, subject: rest }
    }
    default:
      return null
  }
}

/* ── Reverting a single entry ──
   Restores just that change's `from` value, wherever the token stands now.
   Deliberately not an undo: the rest of the document is untouched, so this
   works even after fifty later edits. */

const setOr = (map = {}, key, value) => {
  const next = { ...map }
  if (value === undefined || value === null) delete next[key]
  else next[key] = value
  return next
}

const patch = (s, branch, changes) => ({ ...s, [branch]: { ...s[branch], ...changes } })

/** Entries we can put back. Prose is excluded — see the note in the panel. */
export const REVERTIBLE = new Set([
  'seed', 'seed-name', 'seed-lock', 'step', 'role', 'palette', 'grad',
  'macro', 'sp-ov', 'rd-ov', 'ty-ov', 'comp', 'type', 'dur', 'ease',
  'elev', 'focus', 'icons', 'icsz', 'states', 'layout', 'shape', 'meta', 'voice',
])

export const canRevert = entry => {
  if (!entry?.tag || !entry.detail) return false
  return REVERTIBLE.has(entry.tag.split(':')[0])
}

/**
 * @returns an updater `(state) => state`, or null if the entry can't be undone
 */
export function revertChange(entry) {
  if (!canRevert(entry)) return null
  const { tag, detail } = entry
  const colon = tag.indexOf(':')
  const prefix = colon < 0 ? tag : tag.slice(0, colon)
  const rest = colon < 0 ? '' : tag.slice(colon + 1)
  const from = detail.from

  switch (prefix) {
    case 'seed':
      return s => patch(s, 'color', { seeds: s.color.seeds.map(x => x.id === rest ? { ...x, hex: from } : x) })
    case 'seed-name':
      return s => patch(s, 'color', { seeds: s.color.seeds.map(x => x.id === rest ? { ...x, name: from } : x) })
    case 'seed-lock':
      return s => patch(s, 'color', { seeds: s.color.seeds.map(x => x.id === rest ? { ...x, locked: from === 'locked' } : x) })
    case 'palette':
      /* Match by name — ids survive, but a name is what the entry displayed. */
      return s => patch(s, 'color', {
        seeds: s.color.seeds.map(x => {
          const was = detail.swatches?.find(w => w.name === x.name)
          return was?.from ? { ...x, hex: was.from } : x
        }),
      })
    case 'grad':
      return s => patch(s, 'color', {
        gradients: from
          ? s.color.gradients.map(g => (g.id === rest ? { ...g, ...from } : g))
          : s.color.gradients.filter(g => g.id !== rest),
      })
    case 'step':
      return s => patch(s, 'color', { stepOverrides: setOr(s.color.stepOverrides, rest, from) })
    case 'role':
      return s => patch(s, 'color', { roleOverrides: setOr(s.color.roleOverrides, rest, from) })
    case 'shape':
      return s => patch(s, 'color', { shape: { ...s.color.shape, [rest]: from } })
    case 'macro':
      return s => patch(s, 'macros', { [rest]: from })
    case 'sp-ov':
      return s => patch(s, 'space', { overrides: setOr(s.space.overrides, rest, from) })
    case 'rd-ov':
      return s => patch(s, 'radius', { overrides: setOr(s.radius.overrides, rest, from) })
    case 'ty-ov':
      return s => patch(s, 'type', { overrides: setOr(s.type.overrides, rest, from) })
    case 'comp':
      return s => patch(s, 'components', { overrides: setOr(s.components.overrides, rest, from) })
    case 'type':
      return s => patch(s, 'type', { [rest]: from })
    case 'dur':
      return s => patch(s, 'motion', { durations: { ...s.motion.durations, [rest]: from } })
    case 'ease':
      return s => patch(s, 'motion', { easings: { ...s.motion.easings, [rest]: from } })
    case 'elev':
      return s => patch(s, 'elevation', { [rest]: from })
    case 'focus':
      return s => patch(s, 'focus', { [rest]: from })
    case 'icons':
      return s => patch(s, 'icons', { [rest]: from })
    case 'icsz':
      return s => patch(s, 'icons', { sizes: { ...s.icons.sizes, [rest]: from } })
    case 'states':
      return s => patch(s, 'states', { [rest]: from })
    case 'layout':
      return s => patch(s, 'layout', { [rest]: from })
    case 'meta':
      return s => patch(s, 'meta', { [rest]: from })
    case 'voice':
      return s => patch(s, 'voice', { [rest]: from })
    default:
      return null
  }
}

/**
 * @returns {{ category: string, label: string }}
 */
export function describeChange(tag, keys) {
  const key = keys[0]
  const category = KEY_CATEGORY[key] ?? 'system'

  if (tag) {
    const colon = tag.indexOf(':')
    const prefix = colon < 0 ? tag : tag.slice(0, colon)
    const rest = colon < 0 ? '' : tag.slice(colon + 1)
    const fn = TAG_LABELS[tag] ?? TAG_LABELS[prefix]
    if (fn) return { category, label: fn(rest) }
  }

  /* Several branches at once means something wholesale — a preset, an import. */
  if (keys.length > 3) return { category: 'system', label: 'Document replaced' }
  return { category, label: FALLBACK_LABEL[key] ?? 'Change' }
}
