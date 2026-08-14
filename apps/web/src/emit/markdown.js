/* The markdown body: the eight spec sections, in spec order.

   This is also where every system the YAML schema has no slot for ends up —
   elevation, motion, icons, focus, layout grids, and any component property
   outside the legal eight. That isn't a workaround. An agent reads
   `## Elevation & Depth` as guidance and acts on it; it would skim past an
   unrecognised frontmatter key. Prose is the better channel for this content,
   and it keeps the file spec-legal. */
import { PROSE_SECTIONS, CONTRAST_PAIRS, ROLE_GROUPS, TEXT_ROLES, SURFACE_ROLES } from '../state/schema.js'
import { check } from '../color/contrast.js'
import { SPEC_COMPONENT_PROPS, collectComponents } from './yaml.js'
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
  const build = state.build ?? { themeToggle: true }
  const casing = state.voice?.casing ?? 'title'
  const dark = state.color?.emitDark
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
      'The `EXAMPLE-*.html` pages in the package root are style references, not templates. Take the arrangement from them: what sits beside what, which elevation a panel uses, how tight a heading is set. Do not take their page width, their section order or their content — those belong to the sample, not to this system.',
    ]),
    /* Build preferences.
     *
     * A generated build kept the brief's capitalisation for labels it was
     * handed and used sentence case for labels it invented, then reported the
     * inconsistency in its notes. It had no way to be right: the document
     * asked for sentence case in prose and demonstrated Title Case in its own
     * examples. Two defensible readings, so state the choice. */
    '**Build preferences**',
    bullets([
      /* Capitalisation is stated here and NOWHERE else. It had a second home
         in Copy and formatting, and the file then carried both rules — one
         section demanding Title Case, the other demanding sentence case, with
         no precedence between them. Two agents found it independently and each
         had to choose. Both now read the same field; only this line prints the
         rule, and the other section points here. */
      casing === 'title'
        ? 'Capitalise every UI label as **Title Case**: "Export Payload", "Save Draft", "Row Count". This applies to buttons, tabs, menu items, column headings and section titles — the labels this file supplies and the labels you invent alike. Body copy stays sentence case. Do not mix the two conventions in one build.'
        : 'Capitalise every UI label as **sentence case**: "Export payload", "Save draft", "Row count". Only the first word and proper nouns take a capital. This applies to buttons, tabs, menu items, column headings and section titles — the labels this file supplies and the labels you invent alike. Where a label quoted in this document disagrees, this rule wins: recase it.',
      dark && build.themeToggle
        ? 'Build a **theme toggle** into the page. Set `data-theme="light"` or `data-theme="dark"` on the root element; every token reassigns itself and no variable name changes. Persist the choice, and default to the operating system setting via `prefers-color-scheme` on first load.'
        : dark
          ? 'Do not build a theme toggle. The tokens support both themes and the page follows `prefers-color-scheme` on its own, which is what this system asks for.'
          : 'This system ships one theme. Do not build a theme toggle, and do not invent a dark palette for it.',
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

  /* Measure every mode the system ships.
   *
   * This table said "light mode" and measured light only, while the role table
   * above it shipped a Dark column. A dark system was exported whose light side
   * passed every pair and whose dark side failed four — and the file reported
   * nothing, because it never looked. The mode that is not measured is the mode
   * the failures live in. */
  /* An exempt pair reports its ratio and is graded "Exempt", never "Fail".
     1.4.3 does not cover text inside a disabled control, and a system that dims
     disabled text is doing the right thing. Printing the number anyway matters:
     silence invites someone to invent a value, and "Fail" invites them to make
     disabled look enabled. */
  const grade = (r, p) => (p.exempt ? 'Exempt (1.4.3)' : p.ui ? (r.ratio >= 3 ? 'Pass' : 'Fail') : r.label)
  const cell = (fg, bg, p) => {
    const r = check(fg, bg)
    return `${r.ratio}:1 ${grade(r, p)} · Lc ${r.lc}`
  }

  const contrastRows = CONTRAST_PAIRS.map(p => {
    const l = roles.light[p.fg] && roles.light[p.bg] ? cell(roles.light[p.fg], roles.light[p.bg], p) : null
    if (!l) return null
    const tokens = `\`${p.fg}\` on \`${p.bg}\``
    if (!dark) return [p.label, tokens, l]
    const d = roles.dark[p.fg] && roles.dark[p.bg] ? cell(roles.dark[p.fg], roles.dark[p.bg], p) : null
    return [p.label, tokens, l, d ?? '—']
  }).filter(Boolean)

  /* The sweep. Every text role against every surface role, in every mode
     shipped. It reports failures only, so it is silent on a sound system. */
  const sweepFails = []
  for (const [mode, set] of dark ? [['light', roles.light], ['dark', roles.dark]] : [['light', roles.light]]) {
    for (const fg of TEXT_ROLES) {
      for (const bg of SURFACE_ROLES) {
        if (!set[fg] || !set[bg]) continue
        const r = check(set[fg], set[bg])
        if (r.ratio < 4.5) sweepFails.push([`\`${fg}\` on \`${bg}\``, mode, `${r.ratio}:1`, `${set[fg]} on ${set[bg]}`])
      }
    }
  }

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
    contrastRows.length && (dark
      ? '**Measured contrast** (WCAG ratio, grade and APCA Lc, per mode):'
      : '**Measured contrast** (WCAG ratio, grade and APCA Lc):'),
    contrastRows.length && table(
      dark ? ['Pair', 'Tokens', 'Light', 'Dark'] : ['Pair', 'Tokens', 'Measured'],
      contrastRows),
    /* Say what the rows do not mean, or the reader discounts the whole block
       on the first row that has a good reason to be there. `text-subtle`
       covers placeholders and disabled text, and 1.4.3 exempts the second but
       not the first — so the row is right and the remedy depends on the use. */
    sweepFails.length && `**These pairs fall below AA (4.5:1) for body text.** Do not put the first token's colour on the second's at body size. Raise the text to large-text size (18.66px bold, or 24px, where 3:1 applies), or pick a different role. Two cases are not defects: text inside a disabled control is exempt from 1.4.3, and a pair you never build does not matter.`,
    sweepFails.length && table(['Pair', 'Mode', 'Ratio', 'Values'], sweepFails),
    bullets([
      /* This line promised `--c-dark-accent` and every sibling. No file in the
         package defines one: tokens.css reassigns the same name inside
         `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`.
         An agent following it wrote a theme toggle against variables that do
         not exist — the same failure as the `var(--color-accent)` one above,
         from the same cause, which is a sentence describing tokens the
         package never emitted. */
      dark && 'Two ways to reach a dark value, and the first is the one you want. `tokens.css` reassigns the same custom properties under `@media (prefers-color-scheme: dark)` and under `:root[data-theme="dark"]`, so `var(--c-surface)` is already correct in both themes. Build a theme toggle by setting `data-theme` on the root element, and change no variable name anywhere.',
      dark && 'The second way is for the case the first cannot serve. Every role also exists as `--c-dark-<role>` — `var(--c-dark-surface)` — holding the dark value regardless of the active theme. Reach for it only when you need the dark value *while the light theme is in force*: a panel that stays dark inside a light page, or a figure showing both themes at once. A media query cannot be in two states, and this is what covers that.',
      state.color.emitRamps && 'Numbered scales (`accent-50` … `accent-950`) exist for cases the semantic roles do not cover. Prefer the semantic role wherever one applies — it carries intent, the raw step does not.',
      'Never introduce a colour that is not listed here.',
      /* Learned twice, the second time by a simulation that read a sentence
         about `dark-` prefixed tokens and built a theme toggle against
         variables no file in the package defined. */
      'Never write a token name this file does not define. A custom property that no stylesheet declares resolves to nothing, paints nothing and reports nothing — the page renders, and the colour is simply absent. If a name is not in the table above, it does not exist.',
      /* The contrast table measured light only while the role table shipped a
         dark column, and a system whose light side passed every pair shipped
         four dark failures with a clean report above them. */
      'Check a colour in every mode the system ships. A ratio measured in one mode says nothing about the other: the same pair can pass on paper and fail in the dark, and the mode nobody measured is the mode the failures live in.',
      /* One role served placeholders and disabled text, and those two have
         different contrast requirements — 1.4.3 exempts the second and not the
         first. No single ramp step satisfies both, so the overload guaranteed
         one of the two uses would be wrong. Split by requirement, not by
         appearance. */
      'A placeholder and disabled text are not the same colour, because they are not the same requirement. A placeholder is readable content and must clear 4.5:1 — use `var(--c-text-muted)`. Text inside a disabled control is exempt from 1.4.3 and should look inert — use `var(--c-text-subtle)`, which is deliberately fainter. Never use `text-subtle` for a placeholder: it fails AA on most surfaces in this system, and that is by design rather than by oversight.',
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
      /* Every `--font-*-family` quoted a Google family and no file in the
         package fetched one, so a project that imported tokens.css rendered
         the whole system in `system-ui` — the last entry in every stack — and
         looked close enough that nobody checked. */
      'Load a family before you name it. `tokens.css` opens with an `@import` covering every family above; keep it, or replace it with self-hosted `@font-face` rules. A stack whose first family never loads falls through to `system-ui` silently, and the page looks deliberate.',
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
    ]),

    /* Situations, not components.
       Every rule above describes a part. These describe whole screens, and
       they are the ones with no token to look up — so they are the ones an
       agent invents. Each came from building the screen and finding the rule
       had nowhere to be read. */
    '**Situations this system has rules for**',
    bullets([
      'A **record page** shows one thing: a long title, a row of label-over-value facts, tabs over the body, and a column of context beside it. It is the only page shape whose title wraps, so build it before trusting any header rule measured from a short title.',
      'An **empty state** is three states, never one, and they are not interchangeable. **First run** carries the feature\'s own primary action — this is where the product teaches itself. **No results** offers a way BACK, such as clearing the filter, and never a way forward; the reader already has data and asked the wrong question. **A failure** names what failed and offers a retry. One "nothing here" card serving all three tells a new user the product is broken.',
      'Each empty state holds a mark, a title, one line of explanation and exactly one way out. Cap the prose at the stated measure and centre the block with `align-items: center`, not `stretch` — a stretched child of a centred column is full width and only looks centred while its text is short.',
      'A **comparison** is read across, so it keeps its columns. This is the one exception to the rule that a run of items which does not fit has too many: a plan table holds every column while they fit, and stacks when they do not. It never scrolls sideways, because a column scrolled out of view is a column nobody compared.',
      'Put every row of a comparison on **one** grid, so a cell in row four sits under the cell in row one. Rows sized independently line up only by accident, and the reader is scanning down a column.',
      'Repeating a track list on each row is not the same as sharing one, and it does not work. Declare the tracks once on the container and make every row a `subgrid` of it. Written out again per row, an intrinsic track such as `max-content` resolves against that row alone — measured, a header row sized its label column to the word "Feature" while the rows below sized theirs to "Automatic chasing", and the three value columns missed their own headings by 44.1, 26.5 and 8.9px. Nothing overflowed, so no check objected. Keep the repeated list as a fallback under `@supports`, so a browser without subgrid renders a comparison that is slightly out rather than one column of everything.',
      'Give a comparison\'s label column `max-content`, never a fraction. A fraction takes its share at every width and takes it from the columns being compared, which is where the width is needed. Measured on the same table: sized as `1.1fr` it had to stack at 880px, and at `max-content` it stayed side by side to 788.',
      'Size the collapse of a comparison from its widest CONTROL, not its widest answer. On a plan table the answers were 56px and the columns had 186px to hold them; the item that actually stopped fitting was a call to action needing 136px. Measure every cell, label and button in the block, and take the widest shortfall.',
      'Mark a **recommended** option by its edge, never by a fill. An accent border and a chip say "recommended". A fill says "selected", and a filled column beside two unfilled ones tells the reader a choice has been made when nobody has made one.',
      'A marked column is ONE unbroken edge, so the row dividers stop against it rather than crossing it. Draw the divider on the cells it divides and leave the marked column out of that rule. Crossing it cuts the edge into one segment per row, and a table of six rows then reads as six stacked boxes rather than one highlighted column.',
      'Give a table whose cells PAINT — a divider, a fill, a marked column — no column gap at all. A gap is space belonging to no cell, so nothing can paint across it: with the divider on the cells, every row rule broke into three pieces with a 16px hole at each track boundary. Set the column gap to zero and put the separation inside each cell as padding. Padding on a cell is safe because it sits within the track and moves nothing; only padding on the ROW shifts the track list and breaks the alignment between rows.',
      'Beware of fixing a seam by moving what draws it, because the seam can simply move too. Taking the divider off the row and onto the cells turned a vertical break into a horizontal one. Ask what the empty space between the two parts actually is — here it was the column gap — and remove the cause rather than reassigning the symptom.',
      'Stretch any cell that carries a border. A cell centred in its row is only as tall as its own content — measured 44px inside a 47.6px row, and 38px on a row holding an icon — so an edge drawn on it floats clear of the row with a gap above and below. `align-self: stretch` makes consecutive cells meet exactly.',
      'Do not reach for `grid-row: 1 / -1` to span a column marker across auto-placed rows. `-1` names the end of the EXPLICIT grid, so with no `grid-template-rows` the element collapses to its own borders. Giving it a row span instead pushes every auto-placed row below it. Solve it in the dividers, not with an overlay.',
      'Content beside **context** is not content beside **navigation**. They are the same two columns and a different relationship, so give them different classes. The navigation split usually carries named grid areas, because the folded menu has to sit between the header and the body — drop two plain columns into it and they land in the same area and paint over each other.',
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
  const tabStyle = state.components?.tabStyle ?? 'underline'
  const proseOnly = []
  for (const c of derived.components) {
    for (const p of c.properties ?? []) {
      if (!SPEC_COMPONENT_PROPS.includes(p.key)) proseOnly.push([`\`${c.name}\``, `\`${p.key}\``, p.value])
    }
  }
  /* Read it from the emitter rather than recomputing the rule here. Two copies
     of one condition drift, and this one decides whether a name appears. */
  const frontmatterless = collectComponents(derived.components).proseOnly

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
      /* Every rule above was in the file already, and a generated title bar
         still shipped four baselines across seven runs, 2.48px apart. The
         build had CHECKED — with `Range.getClientRects().bottom`, which is the
         text box bottom. That grows with the descender, so at one font size it
         looks like the baseline and across two sizes it is not, and the check
         reported a pass on a broken row. Knowing the rule was never the
         problem. Measuring the wrong line was. */
      'Measure a baseline with font metrics, never with a rectangle. `getBoundingClientRect().bottom` and `Range.getClientRects()[0].bottom` both give the text **box** bottom, which grows with the descender and with the line height — so two runs at different sizes report different numbers while sitting on one line, and two runs on different lines can report the same number. A title bar shipped with four baselines 2.48px apart after passing exactly that check. The real number is the rect top plus the font\'s ascent:',
      /* Concatenation, not a template literal. The spec validator reads a
         `${...}` as an unresolved token reference and fails the whole file —
         correctly, since it cannot tell a code sample from a real one. */
      '```js\nconst ctx = document.createElement(\'canvas\').getContext(\'2d\')\nfunction baselineOf (el) {\n  const r = document.createRange(); r.selectNodeContents(el)\n  const rect = r.getClientRects()[0]\n  const cs = getComputedStyle(el)\n  ctx.font = cs.fontWeight + \' \' + cs.fontSize + \' \' + cs.fontFamily\n  return rect.top + ctx.measureText(el.textContent).fontBoundingBoxAscent\n}\n```',
      'Then check the row, not one element. Collect the baseline of every text run in the row and count the distinct values: one value is correct, and anything else is the number of lines you actually shipped. Report the spread in pixels, because "they look aligned" is what the wrong measurement already told you.',
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
      /* An agent had to work this out and wrote a note explaining its choice.
         It reached the right answer. Both halves of the conflict came from
         this document — a selected nav item is filled, and a tab wants an
         underline — and nothing said which applied to which. */
      /* The style is a system setting now, so the document states which one is
         in force rather than describing the only one that existed. */
      tabStyle === 'pill'
        ? 'This system marks a selected **tab** with a **pill**: a tinted fill at `var(--c-accent-subtle)` with the accent as its text, full radius, and no underline. The strip carries no rule of its own, so give it vertical padding and let the pill float clear. Do not add an underline as well — a 2px mark against no line reads as a stray rule.'
        : 'This system marks a selected **tab** with an **underline**: a 2px inset shadow sitting on the strip\'s own rule, and no background fill. A fill inside a strip competes with that rule. Keep the rule under the strip, because the mark is on that line.',
      /* A promotion to the pill under a major rule was written here and
         rescinded on sight. The chosen treatment stands wherever the strip
         sits. Do not reinstate it. */
      /* They said it twice, and the second time was blunt: "that\'s how people
         have been doing it for years. possibly for over a decade." */
      '**A folded navigation is an application bar, so the mark sits BESIDE the page title.** Never on a bar of its own above it — a labelled row for one 28px control cost 48px of height and left 44px of nothing between the nav and the heading. The section label goes INSIDE the menu, with the links it names, because the label belongs to the menu rather than to the bar. The menu then opens directly under the row that carries the mark, which means the fold has to be a sibling of the title row and not a block further up the page.',
      'Name a screen the way a reader would before measuring it. A reader sees an app bar, a drawer, a card list — patterns they have met before. "A sidebar that has collapsed" describes how a thing was built, not what it is, and every geometric check passes while the arrangement is wrong.',
      'A long page title **wraps beside the mark; the mark never moves.** Floor the title at `min-width: 0` with `overflow-wrap: anywhere`, and give the mark `flex: 0 0 auto`. Truncation with an ellipsis is the fallback where a single line is a hard requirement — losing words from a page title costs more than a second line.',
      'A **mark beside a heading** aligns to the heading\'s cap centre, exactly as an icon beside a label does, and the error is larger because the box is. `align-items: center` centres on the heading\'s line box, which is far taller than its cap band: measured 2.81px high on a 39.1px title. Correct it with a transform, stated against the heading\'s own size token so it follows the type scale. Do not state it in `em` — on that element `em` resolves against the inherited body size, not the heading\'s. A heading that wraps has no single cap centre, and an item beside a two-line block centres on the block instead.',
      '**The control that opens a folded navigation is a BUTTON, and it belongs to the action group at the rightmost seat.** Not a mark parked against the page title — a control beside a heading reads as part of the heading rather than as something you press. Give it the same shell as every other button in that row: the same height, padding, radius, border and hover. Navigation outranks every action on the page, so nothing may take the rightmost seat from it. Build it as a SIBLING of the action group rather than a member, because a collapsing header keeps this one control on the title\'s row after the others drop to a line of their own — inside the group it can only go where the group goes.',
      '**A header collapses in five stages, and the order of sacrifice is the rule.** The title and the mark that opens the navigation never go. Widest, the navigation is a column beside the page and every action sits on the title\'s row. Then the navigation folds to a mark with its label, at the right of the title. Then the label goes. Then the actions take a line of their own, which hands the label its room back. Then the label goes again. Read it as a priority order rather than five layouts: drop decoration before content, and content before action.',
      '**A collapse threshold is a SUM, not a constant — recompute it for your own content.** Every width in this document was measured from one heading and one set of controls, and a container query cannot measure text, so the numbers here are a worked example rather than a value to copy. The sum is: `threshold = widest item + gap + the control beside it + twice the surface padding`. The reference this document was measured from: heading 163px, labelled menu control 160px, bare control 44px, action group 251px, row gap 8px, surface padding 24px each side. That gives 163 + 8 + 160 + 48 = 379, and the heading starts overflowing just under 380. Substitute your own widths and the same sum gives your own threshold.',
      '**A sum only works on a row with two things in it.** Every threshold here that was added up while the row held three or four items came out 16 to 32px wrong, because a sum misses a gap or a size step. Two things can be added up and four cannot, which is a reason to simplify the row rather than to measure harder.',
      '**Measure a part at the width where it is used.** A control that grows at a breakpoint has two natural widths, and the sum is only true on one side of it. The menu control here is 136px above the `sm` breakpoint and 160px below it — using the smaller figure put a threshold 25px too low and clipped the heading.',
      '**Derive a collapse threshold by shrinking the real row until it breaks.** Never by adding up the parts. Two thresholds here came from arithmetic and both were wrong — one by 32px of margins and edges a sum never counts, and one by measuring an action row at a width where its buttons were still at the small step. A button that grows at a breakpoint has two natural widths, and the sum is only true on one side of it.',
      '**A title beside its actions takes content width, never the free space.** `width: 100%` puts the actions on a second row at every width. `flex: 1 1 auto` does the same thing quietly, by growing into the room the actions needed. Use `flex: 0 1 auto` and let the title claim the whole line only at the width where the actions are meant to drop.',
      '**A folded menu floats. It never pushes the page down.** Opening it inline moved every word on the screen, which is the thing a floating panel exists to prevent. Take the panel out of the flow, anchor it under the mark that opens it, and give it the overlay elevation — a flat panel reads as text lying on the page rather than a surface above it.',
      '**Two meanings must not be one colour, and contrast cannot tell you.** A ratio measures lightness, so two roles one step apart on a ramp read about 1:1 whatever their hue. Compare OKLCH hue as well: below about 25 degrees the pair says nothing. Ask both questions together, though — a brand and a danger one degree apart in hue but fifteen points apart in lightness ARE distinguishable, and reporting that pair calls a solved problem open.',
      '**A page title keeps every word and takes the lines it needs.** It is the one thing on screen that says where the reader is, so it wraps rather than truncating, and it never breaks mid-word. Measure every collapse threshold from a LONG title rather than a short sample one — a container query cannot measure text, so a threshold tuned to a short heading lets a long one overflow before the layout reacts. A short title then collapses a step early, which nobody notices; an overflow is a defect everybody notices.',
      '**Controls beside a multi-line title centre on its FIRST LINE, not on the block.** Centred on the block they drift further down with every extra line, and then they read as attached to the paragraph rather than to the heading. Derive the offset from tokens rather than typing it: the first line is `size × leading`, and the control\'s height is its own step. Use the height the control actually has at that width — assuming the small step read 6.08px out where the button was 44 tall.',
      '**"Rightmost" and "stays with the title" cannot both hold in one wrapping row.** Ordered after the action group, a menu control is rightmost and wraps away with it. Ordered before the group, it keeps the title\'s row and stops being rightmost among the buttons. A short title hides the clash; a long one makes the group wrap early and exposes it. Staying with the title wins, so the action group takes a line of its own whenever the navigation is folded.',
      '**An icon-only control is SQUARE — one to one, at every size step.** An oblong reads as a button whose label failed to load. State it with `aspect-ratio: 1` and `padding: 0` rather than a width per size, so a new step in the scale cannot leave the shape behind.',
      '**A control whose label is HIDDEN is icon-only too, and CSS cannot see that.** A selector cannot ask whether a child is rendered, so a label hidden by a media query leaves the markup unchanged and the icon-only class never arrives — measured at 46x28 and 70x44 on a menu button. Put the square in the same rule block that hides the label, because they are one decision. Then assert it outside CSS: walk the descendants, ask what the engine renders, and fail any pressable thing that has a mark, no visible words and two different sides.',
      '**A tab strip that does not fit becomes a dropdown.** Replace the bar rather than shrinking it or bolting a scrollbar onto it: a run of destinations that does not fit is a list, and a list you pick from is a select. Give the select the tab\'s font size, its padding and its box height, so the value keeps the strip\'s baseline and the content below does not jump when the swap happens. A native select ignores `line-height` on its value, so the parity comes from the box and never from the leading. Keep both in the markup and let CSS show one, or the rule cannot work in a page with no script.',
      'A **tab strip scrolls, it never wraps.** A nav is one line of destinations, and the strip\'s shape is what says so. Folded to two rows it stops reading as one control, and the marker on row two looks like a different thing: measured at 92px tall over two rows for four tabs in a 248px pane. Give the strip `overflow-x: auto` and `flex-wrap: nowrap`, and hide the scrollbar where a second strip sits beside it — a bar takes 10px of height from one strip and not the other, so the two stop agreeing.',
      'A selected **nav item** is a different component and a different answer: a tinted fill, never an underline. It marks the current place in a list, where a fill is what reads as "you are here"; a tab marks the active view in a row. Both have their own entries in the component tables, so neither needs improvising.',
      /* The same agent measured `border-subtle` at 1.38:1 against the page in
         dark, judged that it did not read as a line, and substituted `border`
         for every structural rule while leaving card and row rules alone.
         That call was correct and unwritten, so it cost a paragraph of
         reasoning to reach. It is a rule now. */
      /* This said structural edges take `border`. That was written while
         `border-subtle` was broken — it collided with `surface-raised` at
         1.00:1, so a generated build reasonably substituted the heavier
         weight. The collision is fixed, and the rule outlived its cause:
         three `border` rules stacked in 43px of chrome read as harsh, and the
         same layout with `border-subtle` reads as considered. */
      '`var(--c-border-subtle)` draws every line that divides. A title bar\'s lower edge, the rule under a tab strip, a card\'s edge, a rule between rows: one weight across the whole interface, so a reader learns it once. Space, not weight, says how big a boundary is — a heavier line for a more important division reads as harshness rather than as hierarchy.',
      '`var(--c-border)` is not a divider. It is the outline of a control — an input, a secondary button, anything whose edge tells you where you may click. It is heavier on purpose, and using it for a rule between sections is the most common way a calm layout turns noisy.',
      'Never stack two rules of the same weight close together. Three of them inside 43px of chrome say one boundary three times, and repetition reads as noise. If two lines land near each other, one of them is doing a job that space should do.',
      'A **gutter between columns is a step of its own**, never the row\'s default. Two tab strips 8px apart, with tabs 4px apart inside each, read as one long strip: two to one, where proximity wants more than three to one. Take the gutter up the scale until the ratio clears — 24px against 4px separated the columns.',
      '**Split a row by what each side holds, not down the middle.** A column with three tiles against a column with one card came 4.4px short at an even-handed 46 to 54, so the tiles wrapped two-and-one at every width. At 40 to 60 they fit on one line with room to spare. State the measurement in the comment, or the next reader reads the ratio as taste.',
      '`flex: 1` with `min-width: 0` lets a box **shrink under its own label**. Three tiles cut their headings to fit — 73px of word in a 34px box — and no check calls that an overflow, because nothing left the box. Give a tile `flex: 1 1 max-content` and a `max-content` floor, and let the row wrap instead. A wrapped row is legible; a cut word is not.',
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
      'A description under a heading belongs to that heading. Keep it one small step away, not one ordinary step: measured at 12px it read as a floating one-line paragraph rather than as part of the title, and 4px binds the two into a block. Watch for two sources feeding that one distance — a row `gap` plus a `margin-top` on the paragraph is how 8 became 12. Set the row `row-gap` to zero and let every wrapping child state its own top spacing.',
      'Inside a card, the action row stands FURTHER from the body than anything else in the card. A button pressed against the sentence that explains it reads as the last line of that sentence. State one distance for it and use it in every card: measured before, 16px on a landing card and 12px in an empty state, both against body copy, and both now one step clear of it.',
      'A change or delta belongs to the number it describes, not to the tile. Put it closer to the value than the label above the value is. Measured before: 4px above the number and 6px below it, which made the change read as a third separate line rather than as part of the figure.',
      'An empty state\'s mark is the first thing read, so draw it at twice the largest icon step rather than at it. At the plain icon size it measured smaller than the heading beside it and read as a bullet on a line of its own. Derive the size from the icon scale so it moves when the scale does.',
      'Where a margin has to subtract its container\'s gap, write the rule on the CONTAINER, never on the child. The obvious version publishes the gap as a custom property for the child to read, and it does not work: custom properties inherit, so a descendant cannot tell whether the value came from its own parent or from something four levels up. Measured twice on the same rule — a card that was not a stack subtracted a 16px gap it never had and its action row halved to 8px, then a modal footer did the same and measured 11.7 where every card measured 24. A child combinator (`.stack > .card-actions`) names the real relationship, and everything outside a stack takes the whole distance.',
      'Any custom property used inside a `calc` must be defined everywhere that calc runs. Defined on `.card` and used by a modal footer, it was simply absent: the calc became invalid and the entire margin resolved to nothing, with no error and no warning. Declare shared spacing properties on the root element.',
      'When you equalise the space under a heading, measure the INK, not the boxes. Two cards with an identical stated gap do not look identical if one leads with a mark: an icon inside the line box overshoots the cap band by about 1.5px, and a mark TALLER than the line box sets the row\'s top edge and costs the whole distance from a text box\'s top to its cap top — nearly 8px on a 32px avatar. These are two different corrections, not one scaled. Derive each from its own size token.',
      'Ship no fractional pixel. A scale is only useful if a person can hold it in their head: 12, 16, 24, 32 is a scale somebody repeats from memory a week later, and 12.8, 15.1, 22.6 is a lookup table. Both are equally correct arithmetic and only one of them gets used correctly.',
      'Put every gap, padding, size and radius on a 4px grid. Below 8px a multiple of 2 is allowed, because the small end needs a finer step than 4 to be useful. Values of 1, 2 and 3 are exempt: a hairline is ink, not space.',
      'Put every font size on multiples of 4 from 24px up, and multiples of 2 below that. Type cannot take the 4px grid all the way down, because 12, 16, 20 leaves no room for the 14px and 18px that secondary and lead text need. A base of 16 at a major third then gives 12, 14, 16, 18, 20, 24, 32, 40, 48, 60.',
      'Snap at the LAST step, on the derived pixel, never on the ratio or the multiplier. A modular ratio and a density multiplier are both continuous, so they produce a fraction at almost every position: a density of 0.93 turns a 12px step into 11.16px. Rounding the multiplier instead and then multiplying by the step just moves the fraction downstream.',
      'Two things are exempt because they are not steps on a grid. The middle term of a `clamp()` is the slope of the line joining two grid endpoints. A `line-height` stated in px on a fixed-height control is the content box, which is the stated height minus the borders — a 40px control with a 1px edge each side gives 38, and forcing that to 40 breaks the centring it exists to do.',
      'Put EVERY branch of a conditional style value on the grid, not only the one you are looking at. `columnGap: isMobile ? 8 : 13` ships an 8px gap to a phone and a 13px gap to every desktop, and the second is as real as the first. The same goes for a size written as an attribute rather than a style: `<svg width="13">` paints a 13px box.',
      'Keep a `var()` fallback equal to the value the token actually ships. A fallback is what PAINTS when the token is missing, so one that has drifted states a second design nobody chose — measured, eleven of them in one stylesheet, including a 1px corner where the token ships 4px.',
      'Give a table cell a HORIZONTAL gutter, not only a vertical one. It is the commonest omission in a table and one missing value produces three separate faults: column headings running together, an identifier breaking mid-word, and a two-word date folding onto two lines. State the padding on both axes.',
      'Shrink the ORNAMENT columns rather than growing a content one. A checkbox column and a row-action column take `width: 1%`, which a table reads as "your content and no more", and the remaining width then spreads across the columns that hold data. Setting `width: 100%` on one content column instead takes ALL the slack and starves the rest — measured, 905px of account name beside a 27.5px date that wrapped.',
      'Keep the two outer edges of a table equal. An override on the first or last cell is what breaks it, and an uneven pair always reads as a lean rather than as a decision.',
      'Let ONE mechanism centre a label. A button that centres its text with a `line-height` equal to its own height, and is then also made a flex container, is centring twice: measured, the label sat 2px high, its chevron 1px off the optical middle, and the whole control 1px above its neighbours. Three faults, one cause. Where flex does the centring, set the line-height back to normal.',
      'Stripe a long list with the SOFTEST step available, and put a selected row one step further. Measured on this palette: the stripe reads 1.13:1 against the surface and the selection 1.27, with 1.12 between them. Two steps apart the table reads heavy and the selected rows look darkened rather than chosen. Keep the row rules as well as the stripe — the stripe gives the rhythm and the rule gives the edge — and mark the selection with an accent edge and its checkbox rather than with a saturated fill, which is fatigue when it repeats down ten rows.',
      'Choosing a lighter ground for a selected row also decides whether the controls standing on it are legal. The default outline measured 2.36:1 two steps down from the surface and 3.02 one step down. Check a control against every ground it can sit on, not only the card.',
      'A collapsed row still costs its line gap. An element held at `max-height: 0` is still on a flex line, and the container charges the row gap whether or not anything is in it. Measured on a title bar: 65px tall to hold a 40px button, and 9 of those pixels were a gap beneath a panel nobody had opened. Where a row opens and closes, give it the whole spacing as its own animated margin and set the container\'s `row-gap` to zero. One writer per gap, the same way there is one writer per animated property.',
      'Never mix a shorthand and a longhand for the same property in one inline style object. Declaration order decides, exactly as in a stylesheet: `rowGap` followed by `gap` sets both axes and the row value never applies once. Write `columnGap` and `rowGap`, never `gap` beside either.',
      'State an alignment on the element that must hold it, never leave it to a neighbour. A header\'s actions sat against the right edge only because a group beside them carried `flex: 1` — and that group is hidden at narrow widths, so the actions packed left with 226px of empty bar beside them. Put `margin-left: auto` on the group that belongs at the end. Where the flexible neighbour does render it takes the free space first and the margin resolves to zero, so one rule covers every width.',

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

    /* Figures. The mono family is named in this document and, until now,
       nothing said what it was for — so it would be used for code samples and
       every table of money would come out misaligned. */
    '**Set figures in the mono family**, and there are two cases. An AMOUNT — money, a quantity, a percentage, a duration, anything you would add up or compare in size — takes the mono face AND a right edge: the right edge lines up the magnitudes and the mono face lines up the digits inside them. Any OTHER figure — an invoice number, a journal or order reference, a version, a hash — takes the mono face alone and keeps its normal alignment, because nobody compares its magnitude and a right-aligned identifier reads as a total. A date is text when it carries a month name and a figure when it does not: "12 Aug" stays in the body face, "12/08/2026" takes the mono face.',

    /* Found by drawing a list with a select-all box over a part-selected set.
       The component had two states and needed three. */
    'A checkbox has **three** states, not two. Indeterminate is the only honest answer for a select-all box when some of the rows below it are selected and some are not — unchecked claims nothing is selected while rows plainly are, and checked claims everything is. Distinguish it by the MARK, a dash against a tick, never by the fill alone: a reader who cannot separate the two hues still sees two shapes.',

    /* Which variant, decided by context rather than by habit. A ghost went
       into an empty state because a ghost is the reflex for a secondary
       action, and an empty state is the one place with no frame to supply the
       edge a ghost gives up. */
    'Choose a button variant by what the action sits **in**, never by how important it feels. A ghost gives up its edge and borrows the frame around it, so it belongs inside something already framed: a table row, a toolbar, a dialog footer, a card header. An action standing on its own — the second button of an empty state, a lone action in the middle of a panel — has nothing around it to read against, so it takes the secondary variant and keeps its border. A ghost in open space is a link wearing a button\'s padding.',

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
    /* Stated whether or not any entry is affected today. A rule that only
       appears when it bites has to be learned during the incident. */
    'The frontmatter holds eight properties per component and no more — the spec allows no others. Everything else is in the tables in this section. Absence from the frontmatter never means unstyled: read both, and treat the tables as equal in force.',
    proseOnly.length && '**Additional component properties** (outside the DESIGN.md component schema, applied the same way):',
    proseOnly.length && table(['Component', 'Property', 'Value'], proseOnly),
    /* An entry whose every property is outside the schema has no frontmatter
       key at all — it would have been a name with nothing under it, which
       reads as "unstyled". Name the entries here so the absence is a stated
       fact rather than a hole an agent has to notice. */
    frontmatterless.length && `**${frontmatterless.join('`, `').replace(/^/, '`') + '`'}** ${frontmatterless.length === 1 ? 'has' : 'have'} no entry in the frontmatter. Every property ${frontmatterless.length === 1 ? 'it uses is' : 'they use are'} outside the component schema, so the table above is the whole definition. Absence from the frontmatter never means unstyled.`,

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
      /* Points at the rule rather than restating it. Two statements of one
         decision drift the moment either is edited, and this pair drifted into
         a direct contradiction inside a single file. */
      'Label capitalisation is stated once, under **Overview → Build preferences**. Follow it there.',
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
