/* The markdown body: the eight spec sections, in spec order.

   This is also where every system the YAML schema has no slot for ends up —
   elevation, motion, and any component property outside the legal eight. That
   isn't a workaround. An agent reads `## Elevation & Depth` as guidance and
   acts on it; it would skim past an unrecognised frontmatter key. Prose is the
   better channel for this content, and it keeps the file spec-legal. */
import { PROSE_SECTIONS, CONTRAST_PAIRS, ROLE_GROUPS } from '../state/schema.js'
import { check } from '../color/contrast.js'
import { SPEC_COMPONENT_PROPS } from './yaml.js'

const cell = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()

const table = (headers, rows) => {
  if (!rows.length) return ''
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => ' --- ').join('|')}|`,
    ...rows.map(r => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n')
}

const joinBlocks = (...blocks) => blocks.filter(b => b && String(b).trim()).join('\n\n')

/* Generated content is fenced by HTML comments: invisible when the markdown is
   rendered, semantically inert to a reading agent, and — the actual point —
   precisely strippable on import, so re-importing a file doesn't paste these
   tables into the prose fields the designer wrote by hand. */
export const GEN_OPEN = '<!-- design.md:generated -->'
export const GEN_CLOSE = '<!-- /design.md:generated -->'
export const GEN_BLOCK_RE = /<!-- design\.md:generated -->[\s\S]*?<!-- \/design\.md:generated -->/g

const fenceGenerated = body => (body && body.trim() ? `${GEN_OPEN}\n${body}\n${GEN_CLOSE}` : '')

/* ── Colors ── */
function colorsBody(state, derived) {
  const { roles } = derived
  const dark = state.color.emitDark

  const rows = []
  for (const group of ROLE_GROUPS) {
    for (const role of group.roles) {
      rows.push(dark
        ? [`\`${role.name}\``, roles.light[role.name], roles.dark[role.name], role.desc]
        : [`\`${role.name}\``, roles.light[role.name], role.desc])
    }
  }
  const roleTable = table(
    dark ? ['Token', 'Light', 'Dark', 'Use for'] : ['Token', 'Value', 'Use for'],
    rows
  )

  const contrastRows = CONTRAST_PAIRS.map(p => {
    const fg = roles.light[p.fg], bg = roles.light[p.bg]
    if (!fg || !bg) return null
    const r = check(fg, bg, { large: false })
    const bar = p.ui ? (r.ratio >= 3 ? 'Pass' : 'Fail') : r.label
    return [p.label, `\`${p.fg}\` on \`${p.bg}\``, `${r.ratio}:1`, bar, `Lc ${r.lc}`]
  }).filter(Boolean)

  const usage = [
    dark && 'Every token has a `dark-` prefixed counterpart; pair them by name when building a theme toggle.',
    state.color.emitRamps && 'Numbered scales (`accent-50` … `accent-950`) exist for cases the semantic roles do not cover. Prefer the semantic role wherever one applies — it carries intent, the raw step does not.',
    'Never introduce a colour that is not listed here.',
  ].filter(Boolean).map(s => `- ${s}`).join('\n')

  return joinBlocks(
    roleTable,
    contrastRows.length && '**Measured contrast** (WCAG ratio and APCA Lc, light mode):',
    contrastRows.length && table(['Pair', 'Tokens', 'Ratio', 'WCAG', 'APCA'], contrastRows),
    usage
  )
}

/* ── Typography ── */
function typographyBody(derived) {
  const rows = derived.typography.map(t => [
    `\`${t.name}\``, t.fontFamily || '—', t.fontSize || '—',
    t.fontWeight || '—', t.lineHeight || '—', t.letterSpacing || '—',
  ])
  return table(['Token', 'Family', 'Size', 'Weight', 'Line height', 'Tracking'], rows)
}

/* ── Layout ── */
function layoutBody(derived, macros) {
  const rows = derived.spacing.map(s => [`\`${s.name}\``, s.value])
  const density = macros.density === 1 ? null
    : `Spacing is set to ${macros.density < 1 ? 'a compact' : 'a generous'} density (×${macros.density.toFixed(2)} of the base scale).`
  return joinBlocks(
    table(['Token', 'Value'], rows),
    density,
    '- Compose layouts from these steps only; do not introduce intermediate values.'
  )
}

/* ── Elevation & Depth ── */
function elevationBody(derived, macros) {
  const rows = Object.entries(derived.elevation).map(([name, val]) => [`\`${name}\``, val === 'none' ? 'none' : `\`${val}\``])
  const notes = [
    `Shadows are tinted with the darkest neutral (\`${derived.shadowHex}\`) rather than pure black — black shadows over a warm palette read as grey sludge.`,
    'Each level stacks two layers: a tight contact shadow and a diffuse ambient one. Use the named level; do not hand-roll a shadow.',
    'In dark mode, prefer raising the surface colour over deepening the shadow — shadows barely register against a dark background.',
    macros.depth === 0 && 'Depth is set to zero: this system is flat. Separate surfaces with borders, not shadows.',
  ].filter(Boolean).map(s => `- ${s}`).join('\n')
  return joinBlocks(table(['Level', 'Shadow'], rows), notes)
}

/* ── Shapes ── */
function shapesBody(derived) {
  const rows = derived.rounded.map(r => [`\`${r.name}\``, r.value])
  const notes = [
    'When nesting rounded elements, the inner radius should equal the outer radius minus the gap between them. Concentric corners look wrong when both use the same value.',
    'Apply one radius token consistently per component; do not mix radii within a single element.',
  ].map(s => `- ${s}`).join('\n')
  return joinBlocks(table(['Token', 'Radius'], rows), notes)
}

/* ── Components ──
   Properties the YAML schema rejects still belong in the file; they just
   travel as prose. This table carries all of them. */
function componentsBody(components = []) {
  const rows = []
  for (const c of components) {
    for (const p of c.properties ?? []) {
      if (!p.key) continue
      rows.push([`\`${c.name}\``, `\`${p.key}\``, p.value, SPEC_COMPONENT_PROPS.includes(p.key) ? '' : 'prose only'])
    }
  }
  if (!rows.length) return ''
  const anyProseOnly = rows.some(r => r[3])
  return joinBlocks(
    table(anyProseOnly ? ['Component', 'Property', 'Value', 'Note'] : ['Component', 'Property', 'Value'],
      anyProseOnly ? rows : rows.map(r => r.slice(0, 3))),
    anyProseOnly && '- Rows marked *prose only* fall outside the DESIGN.md component schema and appear here rather than in the frontmatter. Apply them the same way.'
  )
}

/* ── Motion ──
   A ninth section. The spec's eight are emitted in order above; consumers are
   told to preserve headings they don't recognise, so this rides along after
   them. Agents invent arbitrary transition values without it. */
function motionSection(derived) {
  const d = table(['Token', 'Duration'], Object.entries(derived.motion.durations).map(([k, v]) => [`\`${k}\``, v]))
  const e = table(['Token', 'Curve'], Object.entries(derived.motion.easings).map(([k, v]) => [`\`${k}\``, `\`${v}\``]))
  const notes = [
    'Use `fast` for hover and colour changes, `normal` for entering and leaving elements, `slow` for anything full-screen.',
    'Animate transform and opacity only. Never animate layout properties.',
    'Honour `prefers-reduced-motion`: drop to a cross-fade at `fast`, or no transition at all.',
  ].map(s => `- ${s}`).join('\n')
  return joinBlocks(d, e, notes)
}

/**
 * @returns {{ text: string, omitted: string[] }}
 */
export function emitBody(state, derived) {
  const prose = state.prose ?? {}
  const generated = {
    overview:   '',
    colors:     colorsBody(state, derived),
    typography: typographyBody(derived),
    layout:     layoutBody(derived, state.macros),
    elevation:  elevationBody(derived, state.macros),
    shapes:     shapesBody(derived),
    components: componentsBody(state.components),
    dosDonts:   '',
  }

  const parts = []
  const omitted = []

  for (const section of PROSE_SECTIONS) {
    const body = joinBlocks((prose[section.k] ?? '').trim(), fenceGenerated(generated[section.k]))
    if (!body) { omitted.push(section.heading); continue }
    parts.push(`## ${section.heading}\n\n${body}`)
  }

  parts.push(`## Motion\n\n${fenceGenerated(motionSection(derived))}`)

  return { text: parts.join('\n\n'), omitted }
}
