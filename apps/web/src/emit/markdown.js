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
      /* The property an agent types, not the bare role name. A simulation had
         one write `var(--color-accent)` from a table that said `accent`. */
      rows.push(dark
        ? [`\`var(--c-${role.name})\``, roles.light[role.name], roles.dark[role.name], role.desc]
        : [`\`var(--c-${role.name})\``, roles.light[role.name], role.desc])
    }
  }
  const roleTable = table(dark ? ['Property', 'Light', 'Dark', 'Use for'] : ['Property', 'Value', 'Use for'], rows)

  const contrastRows = CONTRAST_PAIRS.map(p => {
    const fg = roles.light[p.fg], bg = roles.light[p.bg]
    if (!fg || !bg) return null
    const r = check(fg, bg)
    return [p.label, `\`${p.fg}\` on \`${p.bg}\``, `${r.ratio}:1`, p.ui ? (r.ratio >= 3 ? 'Pass' : 'Fail') : r.label, `Lc ${r.lc}`]
  }).filter(Boolean)

  const gradientBlock = gradientSection(state, derived)

  return joinBlocks(
    /* Show the variable, not only the role name.
     *
     * Found by simulation: an agent handed this package built a whole dashboard
     * with `var(--color-accent)` and every other colour, because the table named
     * the role `accent` and nothing here ever showed the custom property. The
     * page rendered with no colour at all — every variable undefined, and no
     * error anywhere. It had followed the file faithfully.
     *
     * One line of syntax before the table removes the guess. */
    'Write these as CSS custom properties with a `--c-` prefix: the role `accent` is `var(--c-accent)`, `text-muted` is `var(--c-text-muted)`. The role names in the table below are the part after the prefix.',
    roleTable,
    gradientBlock,
    contrastRows.length && '**Measured contrast** (WCAG ratio and APCA Lc, light mode):',
    contrastRows.length && table(['Pair', 'Tokens', 'Ratio', 'WCAG', 'APCA'], contrastRows),
    bullets([
      dark && 'Every token has a `dark-` prefixed counterpart; pair them by name when building a theme toggle.',
      state.color.emitRamps && 'Numbered scales (`accent-50` … `accent-950`) exist for cases the semantic roles do not cover. Prefer the semantic role wherever one applies — it carries intent, the raw step does not.',
      'Never introduce a colour that is not listed here.',
      /* The table above pairs each role against the page and against its own
         foreground. A component that combines two roles of its own makes a
         third pair, and that pair is in no row here. */
      'This table cannot cover a pair a component invents. A badge that takes its text from one role and its fill from another creates a combination no row above measures — check that pair yourself before you ship the component.',
      'Report any ratio you measure to two decimal places. One place turns 4.4996 into "4.5:1", which reads as a pass against a threshold of 4.5 and is not one.',
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
      /* Neither of these is spacing, so neither belongs on the spacing scale —
         and with nowhere to live they were being invented per page. The
         simulated dashboard reached for 216px and 320px, both off every scale
         in the file, which is what an agent does where the system goes quiet.
         Named, but explicitly adjustable: a rail is a container for words whose
         length nobody here knows. */
      l.fixedWidths && `Fixed widths, emitted as \`--width-*\` custom properties: ${
        Object.entries(l.fixedWidths).map(([k, v]) => `**${k}** ${v}px`).join(', ')
      }. These are starting points, not constraints. A rail that cannot hold its longest label, or a field that crowds the control beside it, should change. Change the token rather than the one page, and keep every other width on the spacing scale.`,
      'Mobile first — treat each breakpoint as a min-width.',
      'Use `minmax(0, 1fr)` for equal grid columns, never a bare `1fr`. A bare `1fr` carries a min-content floor, so the column holding the longest word grows and the "equal" columns come out different widths.',
      'Anything left alone on its own line takes the whole line. A wrap, a fold or a hidden label orphans an element often. The orphan almost never resizes itself. A 150px field floating in a 351px row then reads as an accident, not a decision.',
      'Sideways scrolling is a last resort, not a layout tool. Ask what genuinely cannot stack: a table of real columns cannot, so it scrolls. A run of buttons can, so it stacks. A pane that scrolls down, inside a page that scrolls down, around a group that scrolls sideways, is three scrollbars for four controls.',
      'Choose each breakpoint from the thing it governs, measured. "Can two panes sit side by side" is about pane width. "Is this toolbar cramped" is about that toolbar\'s own contents, and the two answers are usually far apart. Reusing one number for both leaves every width in between with a layout that cannot fit.',
      'Collapse in stages, cheapest first: decoration before content, content before action. A wordmark and a colour strip go before a name you can edit, which goes before a button you can press.',

      /* Three rules the simulated dashboard had to invent, because the file
         said what a narrow layout must not do and never said what it does
         instead. The agent wrapped the header actions onto a second line and
         reflowed the nav rail into a two-column grid. Both are what a flex
         container does when nobody decides for it. */
      'A row of actions beside a heading moves **below** the heading when it stops fitting. It never wraps inside the heading\'s row. Put the whole row on its own line under the heading and its description, aligned to the same left edge.',

      /* The three cases the user drew, after a generated dashboard stacked a
         44px icon button on a line of its own and left the rest of that line
         empty. A wrap is what flexbox does when nobody decides; these are the
         decisions. */
      'There is no limit on how many actions may sit beside a heading. As many as fit at their natural widths belong on that line, and a wide layout should keep them there. The rules below start the moment they stop fitting — they are about breaking a row, not about capping one.',

      /* What "stop fitting" means, which the rules above assumed and never
         defined. Without it an agent fits a row by letting the title touch the
         first button, which technically fits and reads as a collision. */
      'Keep a floor under the gap between a heading and the nearest action beside it. Use the `lg` step. Proximity is a ratio: the buttons sit `xs` apart from each other, so anything close to that between the title and the first button makes the two read as one group.',
      'That floor is what decides when the row breaks. The question is never "do the actions still fit" — it is "do they still fit with that gap intact". A row that fits only by letting the title and the first button close up has already failed. Move the actions below the heading at the width where the gap would drop under the floor, not at the width where the buttons would finally overlap.',
      'Once the actions are on their own line, break them by importance, not by whatever order they were written in. Four rules cover any number of buttons.',
      '**If they all fit on one line, leave them.** They keep their own widths and their ratio to each other. Do not stretch any of them to fill the row.',
      '**The single most important action takes a full-width line to itself.** It goes first, at the top. In a row the primary reads last because the eye ends there; in a column the top line is the one that gets pressed.',
      '**Every remaining action packs onto the lines below, in priority order** — as many per line as fit at their natural widths. On each line the last labelled button absorbs the slack, so every line starts and ends on the same two edges as the first. A ragged line reads as a wrap that got away rather than as a decision.',
      '**Where two or more actions carry equal top importance, each takes its own full-width line.** Ranking is what packs a line; without a ranking there is nothing to pack by.',
      'Never leave an icon-only button alone on a line at its natural width. It is the emptiest line on the page. Either pair it with the button before it, or give it a label so it can fill the row like the rest. Never stretch a lone icon across a full-width bar — a bar with one glyph centred in it says nothing.',
      'Before trimming a gap to make a row fit, take the icon-only controls to the stated touch floor. Three of them measured 47px from their padding against a 44px floor, and the row needed 359.1px in a 351px bar. At 44 it comes to 350.1 and fits. The floor is a value the system publishes with a reason; a gap cut to 6px is a number invented at the moment of the problem.',
      'Never render an empty box that grows. Where every child of a group is hidden at some width, do not render the group — an empty flex child with `flex-grow` claims the free space, paints nothing, and pushes real content around. Measured at 38.9px of nothing in one bar, which was exactly what forced a wrap. It appears the first time a restructure lets that group empty out, so re-check a container after moving anything out of it.',
      'Navigation collapses to one control. It never reflows. Below the width where the full list fits, replace the list with a single menu button. The button opens the same list, in the same order. Give the button the touch target size and an accessible name.',
      'A side rail has exactly two states: the full rail, and a menu button. It never passes through a third. The tempting middle step turns the rail into a horizontal strip of links, and that strip wraps the moment the labels outrun the width — measured on a generated dashboard, five links folded into two ragged columns beside the product name, which reads as a broken page rather than a narrow one. Do not build the middle step. Go straight from rail to button.',
      'Never let a nav list wrap. Set `flex-wrap: nowrap` on it and let the collapse handle the width. A wrapping nav is the single most common way a good layout starts looking broken, because every other part of the page still looks deliberate.',
      'Pick between the two collapses by counting. Move a row below its heading when the row holds three items or fewer. Put it behind a menu button when it holds more. A menu holding two items costs a press and saves nothing. Navigation is the exception and always takes the menu button, because a nav list is longer than three the moment a product grows.',
      'Measure the collapse against the container, not the window. A rail 224px wide takes that much away from everything beside it. Ask the content column with a container query. A window-width breakpoint fires at the wrong moment in every layout that has a rail.',

      /* The rule that stops a responsive fix from being half a fix. Sprung
         three times in one sitting on a single header mark. */
      'A breakpoint moves a **row**, never one object in it. Promote a button to the touch size and every object sharing that row goes with it — the mark beside it, the field, the badge. Miss one and it is correct at one width and a size short at the other, which is the same defect twice rather than a fix and a regression.',
      'This is why a size belongs in a custom property rather than in a fixed value on the element. A media query can reach a property. It cannot reach an inline style at all, and it cannot reach a constant that was compiled in. Where a value has to change at a breakpoint, name it once and let the breakpoint move the name.',
      'Check a responsive rule at **both** widths before calling it done. A rule verified only at the width you were looking at is half tested, and the untested half is where the object you forgot is sitting. The test is cheap: measure the row at each width and confirm every member changed by the same amount, or that none of them did.',
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
      /* Two rules elsewhere in this file combine into the wrong answer: labels
         sit above their control, and an item beside a multi-line block centres
         on the block. Follow both and a toolbar button centres against the
         label-and-field pair, floating above the field it belongs to. */
      'A field carries a label above it, which makes it two lines tall. A control beside it still aligns to **the field**, not to the label-and-field pair — the two are one row of controls, and the label sits outside that row. Give the label its own line above the whole row, or let it sit above the field and align the neighbouring controls to the field\'s box.',
      'A control with a fixed height centres its own content. Do not baseline-align inside it — baseline packs the content to the top of the box and leaves all the slack underneath.',

      /* The inversion, learned by making it. Centring a whole title bar to
         settle 0.5px between two squares put five font sizes on five different
         lines. */
      'Count what a row is made of before you choose its alignment. A row that is mostly TEXT takes `align-items: baseline`. A row that is mostly fixed-height CONTROLS takes `center`. A row of words with a square in it is not a row of squares.',
      'Choose the line, then make everything obey it. The baseline of a row is a decision, not something you read off whichever element happens to look right. Pick it, then put every run of text on that row onto it.',
      'Every run of text on the row belongs on that line, with no exceptions for decoration. A logotype inside a square is still text — if a reader reads it as a word, it obeys the line. Measured on a title bar: the letters in a 36px square sat at 30 while every other word in the row sat at 29, because the square centred them with flexbox.',
      'Flexbox centring hides a label from the row it sits in. It positions the glyphs inside the box and tells the row nothing about where they landed, so the row cannot align to them. Use the line box instead — it centres the letters **and** makes them the element\'s baseline: `display: inline-block`, a stated `line-height`, `text-align: center`, and `align-self: baseline` in the row.',
      'Find that line-height by sweeping, not by arithmetic. On a 36px square the candidates 30, 32, 34, 36 and 38 put its box 2, 1, 0, −1 and −2 pixels from the buttons beside it — every 2px of line height moves the box 1px, and 34 is where it reaches zero. Write the winner against the size token so a touch step carries it.',
      'Getting that the wrong way round trades a fault nobody can see for one everybody reads. `align-items: center` removes every item from the baseline set, so each run of text then centres on its own box — and runs of different sizes land on different lines. Measured on a bar whose button labels sat at 29: a 15px wordmark at 29.75, a 9.5px chip at 26.88, a 10.5px chip at 27.63. Half a pixel was bought and three lines were lost.',
      'A box inside a baseline-aligned run of text is positioned by that text, not by its own height. Two groups on one row, both 36px tall, both on baseline 29, had boxes at 7-to-43 and 6-to-42 — because their ascents above the shared baseline were 22 and 23. A square centred inside the first group centres in the wrong band, and nothing done to the square corrects it. Make the box a sibling of the text group rather than a member.',
      'Initials in an avatar are text on the line, not part of the graphic. They sit on the baseline of the name beside them. Centre them with `line-height` on an inline-block. Do not use `align-items` on a flex box. A flex box with no baseline-aligned child reports its bottom edge, and the initials then line up with nothing.',
      'What a button hands to the row around it is its label\'s baseline, never its icon\'s. An icon must never decide it.',
      'A fixed-height button cannot do both jobs with flexbox. Centre it with `align-items` and it has no text baseline to give — a flex box with no baseline-aligned child reports its bottom edge. Make the label a baseline participant instead and the group aligns to cross-start, pinning the label to the top of the box. Pick one and you lose the other.',
      'So centre it with the line box instead: `display: inline-block`, `line-height` equal to the button\'s own height, `text-align: center`, `white-space: nowrap`. The label is then centred *and* it is the button\'s baseline, so a button in a row of text sits on that text\'s line. The declared height does not change. Space an icon with a margin and `vertical-align: middle`, since there is no flex gap any more.',
      'The same technique gives an avatar\'s initials a baseline. Anything that has no text to offer — an icon, a progress bar, a switch — centres on the row instead.',
      'Set that `line-height` from the **content** box, not the declared height. With `box-sizing: border-box` a 28px control with 1px borders has 26px of content, so `line-height: 28px` makes the line box 2px taller than the space it sits in. A single line box starts at the content top, so the whole overflow falls off the bottom and every label lands 1px low. Use `calc(28px - 2px)`, or whatever the borders come to.',
      'Do not blame descender space for that. A line box centres its own ink whenever `ascent - descent` equals the cap height, which is true of most text faces. If the three balance, the leading is innocent and the box is the wrong size.',
      'A fractional line box does not centre. A ratio like `1.56` on a 12.8px font computes to 19.968px. The half-leading either side then becomes 0.984, and the subpixel split lands unevenly. Measured on a badge: 6px above the cap against 7.95px below the baseline. Round the line box to a whole even number, with `round(1.56em, 2px)` or a whole-pixel value. The ink then centres exactly.',
      'Fix that by rounding, not by shrinking. Setting `line-height: 1` also centres it and takes 30% off the height, which changes a rendered value in the system rather than correcting how it is drawn.',
      '`vertical-align: middle` does not mean the middle of the box. It puts the icon\'s centre on the baseline plus half the **x-height**, which sits below the cap centre — so an icon beside a label reads as sinking, by about 2.5px at ordinary sizes. Lift it by roughly half the difference between cap height and x-height, near `0.12em`, with a transform so no layout moves.',
      'An icon beside a label aligns to **the label**, not to the button. The two are read as one object. Get those agreeing first, then place the pair.',
      'An element with no text has no baseline of its own. An inline-block with no in-flow content falls back to its bottom margin edge, so an icon-only button whose icon is absolutely positioned floats against its lettered neighbours — measured at 8px. Give it a strut: `::before { content: "\\200B" }`, invisible, no width, inheriting the line-height, so its baseline lands where a label\'s would.',
      /* Two rules used to answer this and disagree. An agent reading both said
         so in its notes: the general rule says a much larger heading centres,
         and this one said baseline, full stop. They happened to converge on
         its page and would not have on a bigger title. This one now names the
         block to align to and defers on the method, with a number rather than
         a judgement call. */
      'Page actions belong to the heading, not to the heading-and-description block. Align them to the heading itself. Which alignment depends on the size difference: share a baseline while the heading is under one and a half times the control\'s font size, and centre the two once it is over that. Never pin the actions to the top of the band with `align-items: flex-start` — that leaves them floating above a title whose letters sit well below them.',
      'First and last cells in a table sit flush with the container\'s padding edge. Zero their outer horizontal padding rather than letting the column gutter add to the card\'s own, or the first column starts further in than every heading above it.',
      'Never build an underline from a border. A 2px border makes the element 2px taller and pushes it past its own container\'s rule, breaking that line exactly where the element sits. A *transparent* border costs the same height, so the inactive siblings sit wrong too. Paint it with `box-shadow: inset 0 -2px 0` instead, which lands in the same place and joins no box.',
      'Unequal gaps in one row read as a mistake even when nothing is misaligned. Every gap comes from the spacing scale, and a different gap means a deliberate grouping rather than a typed number.',
      'Proximity is grouping, and it outranks alignment. Items closer together read as one unit, so a label nearer the field below it than the field above labels the wrong one — and no amount of correct alignment repairs that.',
      'Only one thing may animate a property at a time. Two loops writing the same scroll position or the same transform do not average out — they trade pixels, and the one with the larger step wins by a few a frame. The symptom is a jitter that works about half the time, which is whether the first animation had already finished. Whoever starts second takes sole ownership and cancels the first.',
      'Adding a second way to do something is a change to the first way. A tab strip gained wheel scrolling and its hover-scroll broke, though that code was never touched. After adding an input, exercise every other input that reaches the same state.',

      'Never tell someone you saved a document they did not change. A control that changes what the reader is LOOKING at — a light/dark preview switch, a zoom, a filter, a chosen tab — must not write the document, mark it unsaved, add an undo step, or raise a "saved" message. Each of those says an edit happened, and no edit happened.',
      'The test for whether a control is a lens is not whether it feels like a preference. Generate the output before and after it, and see whether a single byte moves. If nothing moves, it is a lens, and it belongs in view state — or at least outside anything that counts as an edit.',

      'A status readout is not a control. If it renders as a bordered pill with a label, people will click it. Either make it clickable or stop drawing it like a button: no border, no pill, and wording that states a fact.',
      'Never style a bare element selector in an application that renders somebody else\'s design inside it. A rule like `label { text-transform: uppercase }` reaches every label in the hosted content, The preview then stops showing the user\'s system and starts showing yours. It also disagrees with what that same system exports, which is the file people build from. Scope such rules away from the hosted region.',
      'A flex container takes its baseline from its **first flex item**. Whatever sits first inside it decides where the row\'s text sits. An `inline-flex` badge starting with a tick hands its baseline to the tick. The same badge starting with a status dot hands it to the dot. Measured: three badges of one class, one height and one font, 4px apart on a single line. Build a badge as an `inline-block` with a stated `line-height`. Space its ornaments with `vertical-align: middle` and a margin. No child can then move its baseline.',
      'Height and `line-height` are one decision, never two. Change a control\'s height and change its line height in the same edit, always to the height minus its two borders. A height raised for a touch target while the line box stayed sized for the old one measured 13px above the cap against 17 below the baseline.',
      'A control with a stated height and an icon needs three properties together: the height, the line height, and `align-items: center`. Leave the alignment unstated and the label centres while the icon goes to the top of the box — measured 12.5px apart.',
      'Symmetric padding does not optically centre text. A line box is not symmetric about the cap-to-baseline band. A taller sibling on the same baseline hangs further below it than letters do — a chip, a count, a badge. The row therefore grows downward only, and the label it grew around ends up high inside it. Correct it with unequal padding: move one pixel from the bottom to the top. Do this only where that taller sibling is present. Derive the pixel by measuring, never by picking.',
      'Judge padding by the result, never by its symmetry. Unequal padding with centred text is a correction doing its job. Unequal padding with off-centre text is the defect. A review that flags the asymmetry itself reports the fix and calls it the fault.',
      'Two controls of the same height, each centring its own label, put their baselines apart by roughly a third of their font-size difference. So equal boxes give unequal baselines and equal baselines give unequal boxes — you cannot have both from two different sizes. Pick the size, not the alignment property. A dense context that sizes its field text and leaves the button beside it at the default size has created a third size, and no alignment property rescues that row.',
      'A row that aligns on the baseline and holds boxes of different heights **must** have different tops. That is the arithmetic of baseline alignment, not a fault in it — a 28px and a 44px button sharing a baseline sit 4px apart at the top and that is the correct answer.',
      'Never type a glyph where an icon belongs. A plus, a cross, an arrow or a chevron written into the label — `+ Add item`, `× Close` — is a letter in a sentence, not a mark beside one. It takes the label\'s font instead of the icon size, it takes a word space instead of the icon gap, and it changes shape with the typeface. Use the icon set, at the size token for that control\'s step, with the icon-gap token between it and the words.',
      'A word space is not a gap. It is roughly a quarter of the font size, it belongs to the text, and no spacing token controls it — so a mark separated by one is spaced by whatever the font happens to do. State the gap.',

      'Grow the box, not the glyph. A lock at 20px, a delete at 21, a close at 21, a segment at 22 — all sized by an icon plus a little padding, all under the floor. Set a minimum width and height on the control and centre the mark inside it. The icon does not change size; the target does.',
      'Touch targets are 40px and mouse targets are 24px, and a control clears the floor when **its targets do**, not when its container does. A segmented box measuring 40px passes while the two buttons inside it — the parts anyone taps — stand 36px after its border and padding. Measure the segment, not the pill. A checkbox wrapped in a label is likewise not a 15px target: the label is the target.',
      'Mark an icon-only button with an explicit class, and never try to detect it in CSS. `:only-child`, `:last-child` and `:nth-child` count **element** children, and a button\'s label is usually a bare text node — so an icon beside a perfectly good label is still the only element in there. `:has(> .icon:only-child)` looks like the clever version of the class and it squashed a labelled button into a 36px box with 87px of its text hanging outside. There is no selector that asks "is there text next to this". Use the class, and assert in a test that every icon-only button carries it.',
      'A rule wider than the problem is a bigger bug than the problem. The narrow version above was already correct; generalising it to catch a case someone might forget broke working buttons across a whole screen.',
      'A decorative mark inside a field must sit **above** it, not merely within it. Positioned absolutely and earlier in the source, it paints first and the field\'s own background colour covers it completely — a search icon that measures 16 by 16 and renders none of it. Give it a stacking order and `pointer-events: none` so it stays out of the way of the click.',
      'A mark that belongs to a line of text goes **inside that line**. Never put it in a flex slot beside the text. A wrapper holding only an icon has no text, so the row invents a baseline for it. Every value of `align-self` then lands the mark off the line it describes. Measured: 3.5px high when pinned to the top, 2.5px high on baseline. Nothing in that slot does better. Set the mark inline with `vertical-align: middle` and the optical lift. It then stays on the first line when the message wraps. A flex slot never does that.',
      'A checkbox, a switch, a progress bar and a swatch carry no text. They have nothing to put on a baseline. A baseline row therefore aligns them by their bottom edge, and they ride high beside their label.',
      'A control beside a label centres on the label\'s **first line**. Never centre it on the label as a block. Centring the row is right for one line. It is wrong the moment the label wraps: measured 22px out on a three-line label. The control then centres on the paragraph instead of on the choice. Start the control and the label at the top. Push the control down by half the difference between the label\'s line height and the control\'s height. Compute that from the label\'s type tokens. Do not use the `lh` unit, which resolves against the font the control inherits and leaves a constant offset.',
      'Centring the control alone is worse than centring nothing. The box moves to the middle. The label keeps a baseline it now shares with no one. Above the text height the label then climbs to the top of the row. Alignment in a pair belongs to the pair.',
      'Give every section the same container. One block left bare among cards does not read as the same thing without a border — it reads as a different KIND of thing, and the reader stops to work out why. Consistency of container is what lets a person stop looking at the frame and start reading the contents.',
      'Draw a separator ABOVE each item in a list, never below. Below, the last item puts a rule directly onto its container\'s own bottom border: two lines a pixel apart, closing nothing. Above, the first item supplies the rule under any group header and the list ends on an item. It also needs no index and no last-child rule — a top border on every row IS the between-ness, because nothing sits above the first row to separate it from.',

      'A heading belongs to the block under it. Keep the gap between a title and its body clearly smaller than the gap between one section and the next, or the heading reads as floating between the two and the reader has to work out which side it belongs to.',
      'State both gaps together, as one ratio. A title 28px from its own body and 48px from the section above it is nearly the midpoint of the two, which reads as neither. Halving the first to 14 and holding the second at 48 makes the answer obvious at a glance without moving anything else.',
      'A rule between two sections sits INSIDE that gap rather than adding to it. Give the separator half the section gap on each side, so a marked boundary and an unmarked one occupy the same height. The line then says where a boundary is and never how big it is, and a panel keeps one rhythm whether or not its sections are ruled.',
      'Watch for two sources feeding one gap. A margin on a child of a flex or grid container ADDS to that container\'s `gap` rather than replacing it. Halving a margin from 18 to 9 inside a column with a 10px gap moves the visible distance from 28 to 19, not to 14. Name both numbers and write the subtraction, or the value in the code will not be the value on the screen.',

      'Two spacing gaps that are stated equal do not read equal when text sits on either side. A text box carries leading. There is more of it below a baseline than above a cap. Measured: 5.95 against 4.00 on a 12.8px font. One 8px gap rendered as 13.95 and the other as 12.00. Correct that difference. Or trim both boxes to their ink with `text-box: cap alphabetic`. If you trim, re-tune the spacing scale in the same edit. The old values were chosen with the leading in them, and trimming alone tightens every stack at once.',
      'Proximity is decided by the RATIO, never by the absolute value. Take a field group whose label sits 8px from its input. It needs clearly more than 12px before the next group. Otherwise the help line under one field sits closer to the next field\'s label than to its own input, and the two groups read as one. Separation must beat cohesion. A single step on the spacing scale is often not enough.',
      'A checkbox draws at 16px and is hit at its label. Do not inflate the box to 24px to satisfy a target-size rule — that silences the warning by making the control wrong. Draw it at 16, declare a minimum target, and give the label the padding that earns it. WCAG 2.5.8 has a spacing exception, and the label is what the exception is for.',
      'An optical correction belongs to the mechanism it corrects. `vertical-align: middle` aligns an icon to the x-height, and the eye reads the cap centre instead. A lift of about 0.12em fixes that. Carry the same lift onto an icon already centred by flexbox and it becomes an error of the same size. Measured: 1.81px off centre with it, 0.00 without.',
      'A structural selector is only as good as the class actually on the node. A rule centring `.row > .checkbox` matched nothing for as long as it existed, because the component rendered a span with no class. Assert the pairing in a test, because CSS cannot tell you that a selector matched nothing.',
      'Anywhere this system is **demonstrated**, that rendering is a real instance. This covers a style guide, a docs page, a component gallery and a sample beside a property panel. Each takes the same scrutiny as a production screen. The demonstration and the thing demonstrated are the same object. A specimen that renders a component wrongly is a specification that lies. It is also the picture people check their tokens against. Build specimens from the markup and classes the product itself uses. Never build a lookalike.',
      'A specimen needs room to be itself. A select is a value on the left and a mark on the right, and the gap between them is the point. Measured: its content wanted 150px in a 118px column, so the two collided. The picture then showed a control the system does not contain. Give the wide components the full width. Stack them above their properties rather than squeezing them into a side column.',
    ]),
    /* This was its own component in the preview for a long time, with a
       hardcoded box, and it stood taller than the small buttons beside it. An
       agent will make the same mistake unless the file says otherwise. */
    'An icon-only button is a button. Same variant, same size entry, same height as any other button on its row — square, with width equal to that height, no label and an accessible name from `aria-label`. It is not a separate component with a size of its own.',

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
      'Use `normal` for a colour change on hover or focus, `fast` for something appearing or moving a short distance, `slow` for a full-screen change. Movement and colour are read differently: slowing a panel that slides makes an interface feel sticky, while speeding a colour change makes it invisible.',
      'A colour fade under about 180ms is present, running, and over before the eye resolves it. The transition passes every check and the interface still feels dead. If a hover looks like it is doing nothing, the duration is the first thing to measure.',
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
