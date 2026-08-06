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
import { LAYOUT_COMPONENTS, layoutRows, layoutSentences } from '../state/componentLayout.js'
import { audit, REQUIREMENTS as A11Y_REQUIREMENTS } from '../a11y/audit.js'
import { purposeOf } from '../color/modes.js'

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
      /* Without this, an agent reads the sample pages as the answer rather than
         as a reference, and inherits whatever was true of the pane they were
         rendered in — the page width most of all. */
      'The pages in `html-examples/` are style references, not templates. Take the arrangement from them: what sits beside what, which elevation a panel uses, how tight a heading is set. Do not take their page width, their section order or their content — those belong to the sample, not to this system.',
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

  const gradientBlock = gradientSection(state, derived)

  return joinBlocks(
    roleTable,
    gradientBlock,
    contrastRows.length && '**Measured contrast** (WCAG ratio and APCA Lc, light mode):',
    contrastRows.length && table(['Pair', 'Tokens', 'Ratio', 'WCAG', 'APCA'], contrastRows),
    bullets([
      dark && 'Every token has a `dark-` prefixed counterpart; pair them by name when building a theme toggle.',
      state.color.emitRamps && 'Numbered scales (`accent-50` … `accent-950`) exist for cases the semantic roles do not cover. Prefer the semantic role wherever one applies — it carries intent, the raw step does not.',
      'Never introduce a colour that is not listed here.',
    ])
  )
}

/* ── Gradients ──
 *
 * The section most likely to be skipped, so it is written to be hard to skip.
 *
 * A gradient is a CSS image, not a colour value, so it cannot be a `colors`
 * token and no component property in the spec's legal eight can hold one.
 * That is a ceiling, not an implementation gap: gradients reach an agent as
 * prose or not at all. Which means the prose has to carry the whole job.
 *
 * Four things make the difference between an agent reading this and an agent
 * acting on it:
 *
 *   1. Say where each one goes. A table of gradient definitions is inert; the
 *      component that uses it lives in a different table further down the
 *      file, and nothing was joining the two. Now the section names the
 *      elements by selector.
 *   2. Give code to copy. Models reproduce a fenced block far more reliably
 *      than they infer one from a description.
 *   3. Say it is not optional. Anything that reads as decoration is the first
 *      thing dropped when a model is economising.
 *   4. Say what the failure mode looks like, because "substitute a flat
 *      colour" is exactly what gets done otherwise, and it looks plausible.
 */
function gradientSection(state, derived) {
  const gradients = derived.gradients ?? []
  if (!gradients.length) return ''

  /* Which entries actually reference each gradient. This is the join that was
     missing: without it the definitions are a glossary nobody is told to use. */
  const usage = new Map(gradients.map(g => [g.name, []]))
  for (const c of derived.components ?? []) {
    for (const p of c.properties ?? []) {
      const m = /^\{gradient\.([\w-]+)\}$/.exec(String(p.value))
      if (m && usage.has(m[1])) usage.get(m[1]).push({ entry: c.name, prop: p.key })
    }
  }
  const used = gradients.filter(g => usage.get(g.name).length)
  /* Genuinely unplaced: no component uses it and no purpose was stated. A
     gradient with a purpose is placed, even without a component to hang it on. */
  const unused = gradients.filter(g => !usage.get(g.name).length && !purposeOf(g.purpose)?.selector)

  /* Two sources of placement, and they answer different questions. A
     component reference is a fact — this entry carries this gradient. A
     stated purpose is an instruction — put it here, even though no component
     in the matrix can hold it, which is most of the interesting cases
     (a page background, a hero, text clipped to a gradient). */
  const applyRows = [
    ...used.flatMap(g =>
      usage.get(g.name).map(u => [`\`.${u.entry}\``, `\`${kebabCss(u.prop)}\``, `\`var(--gradient-${g.name})\``])),
    ...gradients.filter(g => g.purpose && purposeOf(g.purpose)?.selector && !usage.get(g.name).length)
      .map(g => {
        const p = purposeOf(g.purpose)
        return [`\`${p.selector}\``, p.value === 'title' ? '`background-image` + `background-clip: text`' : '`background-image`',
          `\`var(--gradient-${g.name})\``]
      }),
  ]

  /* The designer's own sentences. These carry the judgement a selector cannot
     — when to reach for it, and when not to. */
  const noteRows = gradients.filter(g => g.note?.trim() || g.purpose)
    .map(g => [`\`--gradient-${g.name}\``, purposeOf(g.purpose)?.label ?? '—', g.note?.trim() || '—'])

  /* A worked example beats a rule. Uses the first real pairing where there is
     one, so the snippet is about this system rather than a generic one. */
  const sample = used[0]
  const sampleSel = sample ? `.${usage.get(sample.name)[0].entry}` : null
  const example = sample ? [
    '```css',
    `/* ${sampleSel} — the gradient is the fill, not an overlay on one. */`,
    `${sampleSel} {`,
    `  background-image: var(--gradient-${sample.name});`,
    '  /* Keep a flat fallback underneath for print and forced-colours mode. */',
    `  background-color: var(--c-accent);`,
    '}',
    '```',
  ].join('\n') : null

  return joinBlocks(
    '**Gradients**',
    'These are part of the design, not decoration. Implement every one of them.',
    table(['Token', 'CSS'], gradients.map(g => [`\`--gradient-${g.name}\``, `\`${g.css}\``])),

    applyRows.length && '**Where each one goes.** Apply exactly these; do not invent new placements.',
    applyRows.length && table(['Element', 'Property', 'Value'], applyRows),
    example,

    noteRows.length > 0 && '**What each one is for.**',
    noteRows.length > 0 && table(['Token', 'Role', 'Notes'], noteRows),

    /* Named but unassigned. Saying nothing invites two opposite mistakes:
       dropping it, or sprinkling it wherever it seems to fit. Neither is what
       an unassigned token means. */
    unused.length > 0 && (() => {
      const one = unused.length === 1
      const names = unused.map(g => `\`--gradient-${g.name}\``).join(', ')
      /* "the table above" only means something when there is one. With
         nothing assigned at all the sentence would point at empty space. */
      const where = applyRows.length
        ? `do not apply ${one ? 'it' : 'them'} anywhere the table above does not ask for`
        : `do not apply ${one ? 'it' : 'them'} to anything — nothing in this system uses ${one ? 'it' : 'them'} yet`
      return `${one ? 'One gradient is' : `${unused.length} gradients are`} defined but not assigned: ${names}. `
        + `Define ${one ? 'it' : 'them'} in your stylesheet so ${one ? 'it is' : 'they are'} available, but ${where}.`
    })(),

    bullets([
      'A gradient is a CSS image, so it is not in the `colors` map and cannot be one. Apply it as `background-image` and leave `background-color` set as the fallback beneath it.',
      '**Do not substitute a flat colour.** Approximating a gradient with its first stop is the most common way this gets lost, and it silently changes the design. If a surface is listed above as carrying a gradient, it carries the gradient.',
      'If `tokens.css` shipped alongside this file, every `--gradient-*` custom property above is already defined there — reference it rather than pasting the literal, so the value stays in one place.',
      'For a gradient *stroke*, use `border-image` or a two-layer background with `background-clip: padding-box, border-box`. There is no gradient border property; do not invent one.',
      'Text on a gradient must clear contrast against **both** end stops, not the average. Where it cannot, keep the flat fill.',
    ].filter(Boolean))
  )
}

/* `backgroundImage` → `background-image`, for prose that a developer reads as
   CSS rather than as our internal property names. */
const kebabCss = k => k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

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
    ]),

    /* The scale gives one number per role, and the file tells the agent to use
       the token rather than a size. Between those two instructions there is no
       answer for a narrow screen, so the agent invents one — usually an
       arbitrary px value, which breaks the scale it was told to keep. Naming
       the step-down as a rule closes that gap without adding a token. */
    '**Narrow screens**',
    bullets([
      t.fluid?.on
        ? 'Sizes are fluid: each one interpolates with the viewport, so no breakpoint work is needed.'
        : 'Sizes are fixed. On a narrow screen, step a heading **down the scale to the next token** rather than inventing a smaller size. A hero set in `h1` becomes `h2`, then `h3`.',
      'Never set a size that is not on the scale, at any breakpoint.',
      `The layout has to survive **320px** with no horizontal scrolling, so the largest roles will need a step down before that width.`,
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

  /* Composition — where the icon goes, how the actions sit. The eight legal
     component properties describe appearance, not arrangement, so this is the
     only place it can be said. Stated as rules rather than settings, because
     that is the form an agent acts on. */
  const composition = LAYOUT_COMPONENTS.flatMap(def => {
    const values = derived.componentLayout?.[def.name]
    if (!values) return []
    return [
      `**${def.label}**`,
      table(['Setting', 'Value'], layoutRows(def, values)),
      bullets(layoutSentences(def, values)),
    ]
  })

  /* Alignment.
     Vertical rhythm inside a row is the thing generated UI gets wrong most
     reliably, because centring everything is the reflex and it is only right
     for a block. None of it fits the eight legal component properties, so it
     goes out as rules. The heights are the exception: `height` is legal, so the
     numbers below are already in the frontmatter. Restating them as a set is
     what turns three equal literals into a stated relationship. */
  const heights = derived.components
    .map(c => [c.name, (c.properties ?? []).find(p => p.key === 'height')?.value])
    .filter(([, v]) => v)

  /* Only the ones a finger has to hit. A switch is a 24px control inside a
     44px row, and calling it a short target every time would be noise. */
  const TAPPABLE = /^(button|input|select|checkbox|nav-item)/

  /* Two numbers in this file disagree by design: a compact control is shorter
     than the minimum target. Saying both and leaving it there reads as an
     oversight, and an agent picks whichever it saw last. Name the shortfall and
     say how to close it. */
  const target = state.states?.touchTarget ?? 44
  const short = heights.filter(([n, v]) => TAPPABLE.test(n) && parseFloat(v) < target)
  const targets = short.length ? [
    '**Controls shorter than the minimum target**',
    `${short.map(([n, v]) => `\`${n}\` (${v})`).join(', ')} ${short.length === 1 ? 'is' : 'are'} below the ${target}px minimum. That is deliberate — a dense control should look dense. It is not permission to ship a ${target}px-shy hit area.`,
    bullets([
      `Give the control ${target}px of hit area without changing how it looks: pad the wrapper, or stretch a pseudo-element over it.`,
      `Or use a taller size for anything standing on its own. Reserve the short ones for rows and toolbars, where neighbours supply the clear space.`,
    ]),
  ] : []

  const alignment = [
    '**Alignment**',
    bullets([
      'Text that sits on one line shares one baseline. Two different sizes centred independently do not share one — their baselines end up apart by roughly a third of the size difference.',
      'An item beside a multi-line block centres on the block. The exception is an item that belongs to the block\'s title, such as a count beside a section heading, which sits on the title\'s line.',
      'A heading much larger than a control next to it centres instead. At that size difference a shared baseline reads as a mistake.',
      'A button beside a field matches that field\'s height. Equal heights with both boxes centring their own text put the two baselines within half a pixel, which needs no further correction.',
      'A control with a fixed height centres its own content. Do not baseline-align inside it — baseline packs the content to the top of the box and leaves all the slack underneath.',
      'Initials in an avatar are text on the line, not part of the graphic. They sit on the baseline of the name beside them. Centre them with `line-height` on an inline-block rather than with `align-items` on a flex box: a flex box with no baseline-aligned child reports its bottom edge, and then the initials can never line up with anything.',
      'What a button hands to the row around it is its label\'s baseline, never its icon\'s. If a flex button centres everything, give the label `align-self: baseline` so it becomes the donor. An icon must never decide it.',
    ]),
    heights.length && 'Declared heights. Controls that share a row must share a height:',
    heights.length && table(['Entry', 'Height'], heights.map(([n, v]) => [`\`${n}\``, `\`${v}\``])),
  ].filter(Boolean)

  return joinBlocks(
    bullets([
      'Variants and states are flattened into the component name: `button-primary`, `button-primary-hover`, `button-sm`.',
      'A state entry lists only what changes from its base — apply it on top, do not treat it as a complete definition.',
    ]),

    ...alignment,
    ...targets,
    proseOnly.length && '**Additional component properties** (outside the DESIGN.md component schema, applied the same way):',
    proseOnly.length && table(['Component', 'Property', 'Value'], proseOnly),

    ...composition,

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

/* ── Accessibility ──
   A tenth section, and the one with the most leverage per byte.

   Two halves, and the split matters. The requirements are things no palette
   can check and every agent gets wrong unless told — semantic elements, focus
   trapping, live regions. They are the same every time, which is exactly why
   they belong in the file rather than in someone's head.

   The findings are what this specific system currently fails. Shipping them
   is a deliberate choice: an agent that knows the palette's success and danger
   collapse under deuteranopia will pair them with icons. An agent handed a
   silently broken palette will not. A known flaw stated out loud is worth
   more than a clean-looking file. */
function accessibilitySection(state, derived, findings) {
  const f = state.focus ?? {}
  const live = findings.filter(x => x.level === 'fail')

  return joinBlocks(
    '**Non-negotiable**',
    bullets(A11Y_REQUIREMENTS.map(r => r.text)),

    '**Focus**',
    bullets([
      f.style === 'none'
        ? 'No focus style is defined in this system. Define one before shipping.'
        : `Focus indicator: ${f.width}px ${f.style}, offset ${f.offset}px, using the \`${f.role}\` colour.`,
      'Apply it with `:focus-visible`, never `:focus` — a mouse click should not draw a ring.',
      'Never remove the outline without replacing it with something at least as visible.',
    ]),

    '**Targets and states**',
    bullets([
      `Minimum interactive target: ${state.states?.touchTarget ?? 44}px. Controls smaller than this need clear space around them to compensate.`,
      `Disabled controls sit at ${state.states?.disabledOpacity ?? 0.5} opacity and stay in the tab order only if they explain why they are disabled.`,
      'Every interactive element has a hover, a focus-visible, an active and a disabled appearance. Do not ship a control with only a resting state.',
    ]),

    live.length > 0 && '**Known issues in this system**',
    live.length > 0 && 'These are measured, not hypothetical. Work around them; do not reproduce them elsewhere.',
    live.length > 0 && table(
      ['Issue', 'Criterion', 'Measured'],
      live.map(x => [
        x.mode ? `${x.title} (${x.mode} mode)` : x.title,
        x.criterion,
        x.measured ? `\`${x.measured}\`` : '—',
      ])
    )
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
  parts.push(`## Accessibility\n\n${fenceGenerated(accessibilitySection(state, derived, audit(state, derived)))}`)

  return { text: parts.join('\n\n'), omitted }
}
