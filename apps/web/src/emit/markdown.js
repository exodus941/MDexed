/* The markdown body: the eight spec sections, in spec order.

   This is also where every system the YAML schema has no slot for ends up —
   elevation, motion, icons, focus, layout grids, and any component property
   outside the legal eight. That isn't a workaround. An agent reads
   `## Elevation & Depth` as guidance and acts on it; it would skim past an
   unrecognised frontmatter key. Prose is the better channel for this content,
   and it keeps the file spec-legal. */
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
const bullets = items => items.filter(Boolean).map(s => `- ${s}`).join('\n')

/* Generated content is fenced by HTML comments: invisible when the markdown is
   rendered, semantically inert to a reading agent, and — the actual point —
   precisely strippable on import, so re-importing a file doesn't paste these
   tables into the prose fields the designer wrote by hand. */
export const GEN_OPEN = '<!-- design.md:generated -->'
export const GEN_CLOSE = '<!-- /design.md:generated -->'
export const GEN_BLOCK_RE = /<!-- design\.md:generated -->[\s\S]*?<!-- \/design\.md:generated -->/g

const fenceGenerated = body => (body && body.trim() ? `${GEN_OPEN}\n${body}\n${GEN_CLOSE}` : '')

/* ── Overview ──
   Style references and output preferences live here. A one-line style label
   carries an enormous amount of signal for a model, and the target framework
   changes what it writes more than most token values do. */
function overviewBody(state) {
  const { directives } = state
  const refs = (directives?.references ?? []).filter(Boolean)
  return joinBlocks(
    refs.length && `**Reference points:** ${refs.join(' · ')}`,
    bullets([
      directives?.framework && directives.framework !== 'Unspecified' && `Target stack: **${directives.framework}**.`,
      directives?.classNaming === 'utility' ? 'Prefer utility classes over bespoke CSS.'
        : directives?.classNaming === 'semantic' ? 'Prefer semantic class names over utility classes.' : null,
      'Every value below is prescriptive. Where this file specifies a token, use it rather than an approximation.',
    ]),
    directives?.notes?.trim()
  )
}

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
  const roleTable = table(dark ? ['Token', 'Light', 'Dark', 'Use for'] : ['Token', 'Value', 'Use for'], rows)

  const contrastRows = CONTRAST_PAIRS.map(p => {
    const fg = roles.light[p.fg], bg = roles.light[p.bg]
    if (!fg || !bg) return null
    const r = check(fg, bg)
    return [p.label, `\`${p.fg}\` on \`${p.bg}\``, `${r.ratio}:1`, p.ui ? (r.ratio >= 3 ? 'Pass' : 'Fail') : r.label, `Lc ${r.lc}`]
  }).filter(Boolean)

  return joinBlocks(
    roleTable,
    contrastRows.length && '**Measured contrast** (WCAG ratio and APCA Lc, light mode):',
    contrastRows.length && table(['Pair', 'Tokens', 'Ratio', 'WCAG', 'APCA'], contrastRows),
    bullets([
      dark && 'Every token has a `dark-` prefixed counterpart; pair them by name when building a theme toggle.',
      state.color.emitRamps && 'Numbered scales (`accent-50` … `accent-950`) exist for cases the semantic roles do not cover. Prefer the semantic role wherever one applies — it carries intent, the raw step does not.',
      'Never introduce a colour that is not listed here.',
    ])
  )
}

/* ── Typography ── */
function typographyBody(state, derived) {
  const t = state.type
  const fams = table(['Role', 'Family', 'Used for'], [
    ['display', derived.families.display?.stack ?? '—', 'Headings and display sizes'],
    ['body', derived.families.body?.stack ?? '—', 'Body copy, labels, UI text'],
    ['mono', derived.families.mono?.stack ?? '—', 'Code, figures, technical values'],
  ])

  const rows = derived.typography.map(tok => [
    `\`${tok.name}\``, tok.fontSize ?? '—', tok.fontWeight ?? '—',
    tok.lineHeight ?? '—', tok.letterSpacing ?? '—',
  ])

  return joinBlocks(
    fams,
    `Modular scale: base **${t.base}px**, ratio **${t.ratio}**${t.fluid?.enabled ? `, fluid between ${t.fluid.minVw}px and ${t.fluid.maxVw}px viewports` : ''}.`,
    table(['Token', 'Size', 'Weight', 'Line height', 'Tracking'], rows),
    bullets([
      `Body copy is capped at **${t.measure}ch** — do not let paragraphs run wider.`,
      'Line height and tracking are derived from size: leading tightens and tracking goes negative as type grows. Keep that relationship if you add a size.',
      t.features?.body?.length && `Body text enables: ${t.features.body.map(f => `\`${f}\``).join(', ')}.`,
      t.features?.mono?.length && `Monospace enables: ${t.features.mono.map(f => `\`${f}\``).join(', ')}.`,
      'Use the token name, not the raw size.',
    ])
  )
}

/* ── Layout ── */
function layoutBody(state, derived) {
  const l = state.layout
  const spacing = table(['Token', 'Value'], derived.spacing.map(s => [`\`${s.name}\``, s.value]))
  const bps = table(['Breakpoint', 'Min width', 'Container'],
    l.breakpoints.map(b => [`\`${b.name}\``, `${b.px}px`, l.containers?.[b.name] ? `${l.containers[b.name]}px` : '—']))

  return joinBlocks(
    '**Spacing scale**', spacing,
    '**Breakpoints and containers**', bps,
    bullets([
      `Grid: **${l.columns} columns**, gutter \`${l.gutter}\`.`,
      `Maximum text measure: **${l.maxMeasure}ch**.`,
      state.macros.density !== 1 && `Spacing runs at ${state.macros.density < 1 ? 'a compact' : 'a generous'} density (×${state.macros.density.toFixed(2)}).`,
      'Compose layouts from these steps only; do not introduce intermediate values.',
      'Mobile first — treat each breakpoint as a min-width.',
    ])
  )
}

/* ── Elevation ── */
function elevationBody(state, derived) {
  const e = state.elevation
  const rows = Object.entries(derived.elevation).map(([name, val]) => [`\`${name}\``, val === 'none' ? 'none' : `\`${val}\``])

  const strategyNote = {
    shadow: 'Depth is expressed with shadows.',
    border: 'This system is flat: separate surfaces with **borders**, never shadows.',
    tonal: 'This system is tonal: separate surfaces by **changing the surface colour**, never with shadows.',
  }[e.strategy] ?? ''

  const scrim = e.scrim ?? {}
  return joinBlocks(
    strategyNote,
    table(['Level', 'Shadow'], rows),
    '**Overlays and scrims**',
    table(['Property', 'Value'], [
      ['Scrim colour', derived.scrimColor],
      ['Scrim opacity', String(scrim.opacity ?? 0.55)],
      ['Backdrop blur', scrim.blur ? `${scrim.blur}px` : 'none'],
      ['Scrim blend mode', e.blendMode ?? 'normal'],
      ['Fill blend mode', e.fillBlend ?? 'normal'],
    ]),
    bullets([
      e.blendMode && e.blendMode !== 'normal'
        ? `Composited layers — scrims, tinted overlays, image treatments — use \`mix-blend-mode: ${e.blendMode}\`.`
        : 'Scrims composite normally; no blend mode is applied.',
      e.fillBlend && e.fillBlend !== 'normal'
        ? `Filled surfaces use \`mix-blend-mode: ${e.fillBlend}\`. Set \`isolation: isolate\` on any such element that contains text, or the text blends too.`
        : null,
      'Borders and shadows are never blended — CSS has no `border-blend-mode`, and `box-shadow` renders unblended. Do not attempt to emulate one.',
    ]),
    bullets([
      e.strategy === 'shadow' && `Shadows are tinted with \`${derived.shadowHex}\` rather than pure black — black shadows over a warm palette read as grey sludge.`,
      e.strategy === 'shadow' && 'Each level stacks two layers: a tight contact shadow and a diffuse ambient one. Use the named level; do not hand-roll a shadow.',
      e.darkStrategy === 'lighten' && 'In dark mode, raise the surface colour rather than deepening the shadow — shadows barely register against a dark background.',
      state.macros.depth === 0 && 'Depth is set to zero. Treat every surface as flat.',
    ])
  )
}

/* ── Shapes ── */
function shapesBody(state, derived) {
  const r = state.radius
  const rows = derived.rounded.map(x => [`\`${x.name}\``, x.value])
  const borders = table(['Token', 'Width'], Object.entries(r.borderWidths ?? {}).map(([k, v]) => [`\`${k}\``, `${v}px`]))

  return joinBlocks(
    table(['Token', 'Radius'], rows),
    '**Border widths**', borders,
    bullets([
      r.nesting && 'When nesting rounded elements, the inner radius should equal the outer radius minus the gap between them. Concentric corners look wrong when both use the same value.',
      'Apply one radius token consistently per component; do not mix radii within a single element.',
      state.macros.roundness === 0 && 'Roundness is zero — this system has square corners throughout.',
    ])
  )
}

/* ── Components ──
   Only properties the frontmatter can't carry appear here. Everything legal is
   already in the YAML above, and repeating it would double the file for no
   gain. Icons, focus and state conventions ride along in this section because
   they are component-level concerns with no schema slot of their own. */
function componentsBody(state, derived) {
  const proseOnly = []
  for (const c of derived.components) {
    for (const p of c.properties ?? []) {
      if (!SPEC_COMPONENT_PROPS.includes(p.key)) proseOnly.push([`\`${c.name}\``, `\`${p.key}\``, p.value])
    }
  }

  const icons = state.icons
  const iconTable = table(['Size', 'Value'], Object.entries(icons.sizes ?? {}).map(([k, v]) => [`\`${k}\``, `${v}px`]))
  const f = state.focus

  return joinBlocks(
    bullets([
      'Variants and states are flattened into the component name: `button-primary`, `button-primary-hover`, `button-sm`.',
      'A state entry lists only what changes from its base — apply it on top, do not treat it as a complete definition.',
    ]),
    proseOnly.length && '**Additional component properties** (outside the DESIGN.md component schema, applied the same way):',
    proseOnly.length && table(['Component', 'Property', 'Value'], proseOnly),

    '**Iconography**',
    bullets([
      `Library: **${icons.library}**. Do not mix icon sets.`,
      `Stroke width \`${icons.strokeWidth}\`, ${icons.joinStyle} joins and caps.`,
    ]),
    iconTable,

    '**Focus and interaction states**',
    bullets([
      `Focus ring: \`${f.width}px ${f.style}\` in \`${f.role}\`, offset \`${f.offset}px\`. Apply on \`:focus-visible\`, never remove it.`,
      `Disabled elements drop to \`${state.states.disabledOpacity}\` opacity and lose pointer events.`,
      `Minimum touch target: **${state.states.touchTarget}px**.`,
      `Transition only: ${state.states.transitionOn.map(p => `\`${p}\``).join(', ')}.`,
      'Every interactive element needs visible hover, active, focus-visible and disabled states.',
    ])
  )
}

/* ── Do's and Don'ts ──
   Negative constraints are the instructions models follow most reliably, so
   this section is generated from an explicit checklist rather than left to
   whatever the designer remembered to type. */
function dosDontsBody(state) {
  const on = (state.directives?.antiPatterns ?? []).filter(a => a.on)
  const v = state.voice
  return joinBlocks(
    on.length && '**Hard constraints**',
    on.length && bullets(on.map(a => a.text)),
    '**Copy and formatting**',
    bullets([
      v.casing === 'sentence' ? 'Sentence case for all UI text, including buttons and headings.' : 'Title Case for headings and buttons.',
      v.buttonStyle === 'verb-first' ? 'Buttons start with a verb — "Save changes", not "Changes".' : 'Buttons name the object rather than the action.',
      v.errorTone === 'plain' ? 'Error messages state what happened and what to do. No apologies, no blame.'
        : v.errorTone === 'terse' ? 'Error messages are as short as they can be while staying actionable.'
        : 'Error messages acknowledge the inconvenience before explaining the fix.',
      `Dates as \`${v.dateFormat}\`; numbers as \`${v.numberFormat}\`; currency in ${v.currency}.`,
    ])
  )
}

/* ── Motion ──
   A ninth section. The spec's eight are emitted in order above; consumers are
   told to preserve headings they don't recognise, so this rides along after
   them. Agents invent arbitrary transition values without it. */
function motionSection(state, derived) {
  const d = table(['Token', 'Duration'], Object.entries(derived.motion.durations).map(([k, v]) => [`\`${k}\``, v]))
  const e = table(['Token', 'Curve'], Object.entries(derived.motion.easings).map(([k, v]) => [`\`${k}\``, `\`${v}\``]))
  return joinBlocks(
    `Motion personality: **${state.motion.personality}**.`,
    d, e,
    bullets([
      'Use `fast` for hover and colour changes, `normal` for entering and leaving elements, `slow` for anything full-screen.',
      'Animate transform and opacity only. Never animate layout properties.',
      state.motion.reducedMotion === 'crossfade'
        ? 'Under `prefers-reduced-motion`, drop to a cross-fade at `fast`.'
        : 'Under `prefers-reduced-motion`, remove transitions entirely.',
    ])
  )
}

/**
 * @returns {{ text: string, omitted: string[] }}
 */
export function emitBody(state, derived) {
  const prose = state.prose ?? {}
  const generated = {
    overview:   overviewBody(state),
    colors:     colorsBody(state, derived),
    typography: typographyBody(state, derived),
    layout:     layoutBody(state, derived),
    elevation:  elevationBody(state, derived),
    shapes:     shapesBody(state, derived),
    components: componentsBody(state, derived),
    dosDonts:   dosDontsBody(state),
  }

  const parts = []
  const omitted = []

  for (const section of PROSE_SECTIONS) {
    const body = joinBlocks((prose[section.k] ?? '').trim(), fenceGenerated(generated[section.k]))
    if (!body) { omitted.push(section.heading); continue }
    parts.push(`## ${section.heading}\n\n${body}`)
  }

  parts.push(`## Motion\n\n${fenceGenerated(motionSection(state, derived))}`)

  return { text: parts.join('\n\n'), omitted }
}
