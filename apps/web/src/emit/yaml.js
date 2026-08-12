/* Spec-conformant YAML frontmatter.
   Hand-written rather than dumped by js-yaml so key order, grouping comments
   and quoting stay stable — a DESIGN.md that reorders itself on every save
   produces unreadable diffs in the repo it lives in.

   The allow-lists below are the whole spec surface. Anything outside them is
   deliberately not emitted here; it goes into the markdown body instead. */

export const SPEC_TOP_LEVEL = ['version', 'name', 'description', 'omitted', 'colors', 'typography', 'rounded', 'spacing', 'components']
export const SPEC_COMPONENT_PROPS = ['backgroundColor', 'textColor', 'typography', 'rounded', 'padding', 'size', 'height', 'width']
export const SPEC_TYPOGRAPHY_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFeature', 'fontVariation']

/* Quote anything YAML would otherwise reinterpret. Hex colours always need it
   — a bare #b8422e is a comment. */
export function q(v) {
  const s = String(v ?? '')
  if (s === '') return '""'
  return /[:#[\]{},&*?|<>=!%@`\n"']/.test(s) || /^\s|\s$/.test(s) || /^[-]/.test(s)
    ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : s
}

const isSafeKey = k => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(String(k))
const key = k => (isSafeKey(k) ? k : `"${String(k).replace(/"/g, '\\"')}"`)

/** Colour tokens in emission order: roles, dark roles, ramps, then customs. */
export function collectColors(state, derived) {
  const out = []
  const { color } = state
  const seen = new Set()
  const push = (name, value, group) => {
    if (!name || seen.has(name)) return
    seen.add(name)
    out.push({ name, value, group })
  }

  for (const [name, hex] of Object.entries(derived.roles.light)) push(name, hex, 'Semantic roles')
  if (color.emitDark) {
    for (const [name, hex] of Object.entries(derived.roles.dark)) push(`dark-${name}`, hex, 'Dark mode roles')
  }
  if (color.emitRamps) {
    for (const [rampName, ramp] of Object.entries(derived.ramps)) {
      for (const [step, hex] of Object.entries(ramp.steps)) push(`${rampName}-${step}`, hex, 'Scales')
    }
  }
  for (const c of color.custom ?? []) push(c.name, c.value, 'Custom')
  return out
}

/** Component entries reduced to legal properties, with the rest reported. */
export function collectComponents(components = []) {
  const kept = []
  const dropped = []
  /* Entries styled entirely by properties the spec has no slot for. */
  const proseOnly = []
  for (const comp of components) {
    if (!comp.name) continue
    const props = []
    for (const p of comp.properties ?? []) {
      if (!p.key) continue
      if (SPEC_COMPONENT_PROPS.includes(p.key)) props.push(p)
      else dropped.push({ component: comp.name, key: p.key })
    }
    /* An entry with no legal property was emitted as a bare `input-focus:`
       with nothing under it. YAML reads that as null, and null reads as "this
       state has no styling" — the opposite of the truth, since its styling is
       every property the spec cannot hold (borderColor, boxShadow, opacity)
       and all of it is in the table below. A key with no body is a claim, so
       do not make it. */
    if (props.length) kept.push({ name: comp.name, properties: props })
    else if ((comp.properties ?? []).some(p => p.key)) proseOnly.push(comp.name)
  }
  return { kept, dropped, proseOnly }
}

/**
 * @returns {{ text: string, dropped: Array }} the full `---` delimited block
 */
export function emitFrontmatter(state, derived, { omitted = [] } = {}) {
  const L = ['---']
  const { meta } = state

  if (meta.version)     L.push(`version: ${q(meta.version)}`)
  L.push(`name: ${q(meta.name || 'Untitled Design System')}`)
  if (meta.description) L.push(`description: ${q(meta.description)}`)

  if (omitted.length) {
    L.push('omitted:')
    for (const o of omitted) L.push(`  - ${q(o)}`)
  }

  const colors = collectColors(state, derived)
  if (colors.length) {
    L.push('colors:')
    let group = null
    for (const c of colors) {
      if (c.group !== group) { group = c.group; L.push(`  # ${group}`) }
      L.push(`  ${key(c.name)}: ${q(c.value)}`)
    }
  }

  if (derived.typography.length) {
    L.push('typography:')
    for (const t of derived.typography) {
      if (!t.name) continue
      L.push(`  ${key(t.name)}:`)
      for (const p of SPEC_TYPOGRAPHY_PROPS) {
        const v = t[p]
        if (v === '' || v == null) continue
        /* fontWeight is spec'd as a number; emit it unquoted when it is one. */
        L.push(`    ${p}: ${p === 'fontWeight' && /^\d+$/.test(String(v)) ? v : q(v)}`)
      }
    }
  }

  if (derived.rounded.length) {
    L.push('rounded:')
    for (const r of derived.rounded) if (r.name) L.push(`  ${key(r.name)}: ${q(r.value)}`)
  }

  if (derived.spacing.length) {
    L.push('spacing:')
    for (const s of derived.spacing) if (s.name) L.push(`  ${key(s.name)}: ${q(s.value)}`)
  }

  const { kept, dropped } = collectComponents(derived.components)
  if (kept.length) {
    L.push('components:')
    for (const c of kept) {
      L.push(`  ${key(c.name)}:`)
      for (const p of c.properties) L.push(`    ${p.key}: ${q(p.value)}`)
    }
  }

  L.push('---')
  return { text: L.join('\n'), dropped }
}
