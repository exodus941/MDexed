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
