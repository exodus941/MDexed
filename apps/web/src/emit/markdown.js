/* The markdown body: the eight spec sections, in spec order.

   This is also where every system the YAML schema has no slot for ends up —
   elevation, motion, icons, focus, layout grids, and any component property
   outside the legal eight. That isn't a workaround. An agent reads
   `## Elevation & Depth` as guidance and acts on it; it would skim past an
   unrecognised frontmatter key. Prose is the better channel for this content,
   and it keeps the file spec-legal. */
import { PROSE_SECTIONS, CONTRAST_PAIRS, ROLE_GROUPS, TEXT_ROLES, SURFACE_ROLES, hasDark, hasLight, hasThemeToggle, themeOf } from '../state/schema.js'
import { check } from '../color/contrast.js'
import { SPEC_COMPONENT_PROPS, collectComponents } from './yaml.js'
import { LAYOUT_COMPONENTS, layoutRows, layoutSentences } from '../state/componentLayout.js'
import { audit, REQUIREMENTS as A11Y_REQUIREMENTS } from '../a11y/audit.js'
import { KEYBOARD_CONTRACTS, INTERACTIVE_CONTRACTS } from '../state/keyboard.js'
import { NEIGHBOUR_FLOOR } from '../color/dataviz.js'
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
  const casing = state.voice?.casing ?? 'title'
  const dark = hasDark(state)
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
      /* The casing rule listed what Title Case applies TO and stopped. A build
         read that list as illustrative and recased everything: the search
         field said "Search By Invoice, Customer Or Amount" and the footer said
         "Showing 1–6 Of 48 Invoices". Both are sentences. Naming the label set
         is not the same as naming the boundary, so state the boundary too. */
      'Recase a LABEL, never CONTENT. A label names a control or a region: a button, a tab, a menu item, a column heading, a field name, a section title. Everything else is content and keeps its natural capitalisation — a placeholder, a status line like "Showing 1–6 of 48 invoices", a record\'s name, a person\'s name, an address, body copy, a timestamp. A placeholder is a sentence addressed to the reader, not a label on a box.',
      'Convert in ONE direction only. Sentence case to Title Case is mechanical and safe. Title Case back to sentence case needs to know which words are proper nouns, and no rule can tell you that — so where this file supplies a label already in Title Case and the system asks for sentence case, recase it by hand rather than by algorithm.',
      /* THREE THEME SETTINGS, THREE INSTRUCTIONS, and the two single-theme ones
         say the same forbidding sentence. A system with one theme that reads as
         though it might have two is how an agent ends up inventing the palette
         it was never given. */
      /* ── THE MECHANISM, NOT ONLY THE CONTROL ──
       *
       * This bullet used to say "set `data-theme` on the root element", and
       * `tokens.css` has shipped a script-free mechanism for months. Two
       * answers to one decision, in two files, and AGENTS.md sends the reader
       * to DESIGN.md first — so every build took the one that needs a script.
       *
       * It was reported dead three times across three simulations. Each build
       * measured correct when served and looked broken when opened: a
       * sandboxed preview, a strict policy, a file from disk. A control that
       * works only where scripts run is a control that intermittently does
       * nothing, and intermittent is worse than absent.
       *
       * So the primary instruction is now the checkbox, and the script is
       * named for the two things CSS cannot do. Proven on a rebuilt page with
       * every script stripped out: the label repainted the body from
       * rgb(214,221,222) to rgb(20,22,23) and back. */
      hasThemeToggle(state)
        ? 'Build a **theme toggle** into the page, as a visible icon control carrying a lightbulb. It is a real control a reader has to find, so give it a label, a place in the tab order and the same target size as any other control in its row. **Build it so it works with no JavaScript at all.** `tokens.css` opens its dark block on a checkbox as well as on the attribute, so a hidden `<input type="checkbox" id="dmd-dark">` anywhere on the page plus a `<label for="dmd-dark">` carrying your lightbulb IS the whole control. Add a script only for the two things CSS cannot do: set the checkbox from `prefers-color-scheme` on first load, and persist the reader\'s choice. A toggle that needs a script does nothing wherever scripts do not run, and it was reported broken three times before this sentence existed.'
        : 'This system ships one theme. Do not build a theme toggle, and do not invent the other palette to fill one.',

      /* THE HALF THAT WAS MISSING, AND WHAT IT COST.
         The rule above asks for the operating system default and never says
         what defeats it. A generated dashboard wrote data-theme="light" onto
         its own <html>, copying the shape of the example pages beside it, and
         the toggle then had no visible effect for a reader whose script did
         not run. They clicked it several times before reporting it. */
      hasThemeToggle(state) &&
        'WRITE NO `data-theme` INTO YOUR OWN MARKUP. The absence of that attribute IS the follow-the-system state, and it is the only state a page can be in before a single line of script has run. Hardcode it and the application is pinned to whichever value you typed: the operating system preference is ignored, and a toggle whose script fails to load looks broken, because the attribute underneath it never moves. The `EXAMPLE-*.html` pages here are the one exception and they say so in their own source. Each is one half of a light and dark pair, so it pins its own theme deliberately and carries a working control anyway.',
      /* WHERE the button goes, because the rule above says only that it exists.
         Placement was the whole cost of building it here: the toggle went
         through three arrangements before it aligned, and every one of them
         measured as a defect on screen. */
      hasThemeToggle(state) && 'Put the theme toggle in the **header action group**, and put it **before the navigation menu** — the seat at the END of a header belongs to navigation, and nothing may take it. It answers to that row like any other control in it: one stated height, square because it carries no words, and the same promotion to a finger target at narrow widths. A header row holding only fixed-height controls aligns on **centre**, not on baseline. An icon-only button has no text baseline to share, and a menu button wrapped in a `<details>` does not share one either, so a baseline row puts them at different heights — measured at 9px apart in this system, on two controls that were both 44px tall.',
      hasThemeToggle(state) && 'The toggle carries `aria-pressed` and a label that states the CURRENT theme and the one a press will produce: "Dark theme is on. Switch to light." An icon-only control with no state is a button whose meaning a screen reader has to guess from a picture it cannot see. One mark in both states, not a sun swapped for a moon — two marks force the button to decide which of them means "now" and which means "next", and readers split evenly on that.',
    ]),
    directives?.notes?.trim()
  )
}

/* ── Colors ── */
function colorsBody(state, derived) {
  const { roles } = derived
  const dark = hasDark(state)

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
    ]),

    datavizBody(derived),
    retiredBody(state)
  )
}

/* ── Retired tokens ──
 *
 * Emitted only when something has actually been retired. A system with nothing
 * to say about retirement should not ship an empty heading about it. */
function retiredBody(state) {
  const rows = (state.deprecated ?? []).filter(d => d?.token)
  if (!rows.length) return ''
  return joinBlocks(
    '### Retired',
    'These still resolve, and they are going. A token that disappears breaks every build that imported it on the day it ships, so each one keeps its value and carries a mark instead: `$deprecated` in `tokens.json` and a comment above the declaration in `tokens.css`. Move off them before the next release. `VERIFY.mjs` fails any file that still uses one.',
    table(
      ['Retired', 'Use instead', 'Why'],
      rows.map(d => [
        `\`${d.token.startsWith('--') ? d.token : `--c-${d.token}`}\``,
        d.replacement ? `\`${d.replacement}\`` : '—',
        d.reason || '—',
      ])
    )
  )
}

/* ── Charts ──
 *
 * Published or not, a builder charting anything picks a palette. Unpublished,
 * it is one that does not follow the brand. */
function datavizBody(derived) {
  const dv = derived.dataviz
  if (!dv?.categorical?.length) return ''
  const swatches = list => list.map((hex, i) => `${i + 1}. \`${hex}\``).join(' · ')

  return joinBlocks(
    '### Charts',
    'Three scales, because a chart asks three different questions. Which series is this — no order, every colour one weight. How much of one thing — one hue, light to dark. How far either side of zero — two hues around a pale middle.',

    `**Categorical** — \`--chart-1\` to \`--chart-${dv.categorical.length}\`. ${swatches(dv.categorical)}`,
    'The ORDER is the contract. Series one is always series one, so two charts of the same data agree and a legend learned on one page still reads on the next. Never assign these by iteration order, or the picture changes every time the data is sorted. Series one is the accent hue, so the first swatch in every chart is the colour the reader already associates with this system.',
    `Every pair is separated, not only the pairs that sit next to each other in the legend: two series touch anywhere in a pie, and a stacked bar puts any two together the moment a category is empty. Measured on this palette, the worst pair of the ${dv.categorical.length} is **${dv.worst.distance.toFixed(3)}** in OKLab, between series ${dv.worst.a + 1} and ${dv.worst.b + 1}. The floor is ${NEIGHBOUR_FLOOR}, about four just-noticeable differences, so two areas that touch read as two colours rather than as one gradient.`,
    `**And the limit, stated.** With the red-green axis removed, that worst pair falls to **${dv.worstWithoutRedGreen.toFixed(3)}**, which is under two just-noticeable differences. No eight-colour categorical palette is safe without red-green vision, this one included. So a chart never encodes a series by colour alone: label each series directly where it sits, or give it a dash pattern or a marker shape as well. The palette makes the picture readable and the label makes it certain.`,
    'Give every filled series a hairline in `var(--c-border-subtle)`. The palest series has only 0.11 of lightness between it and a light page, which is enough for an area and not for an edge.',

    `**Sequential** — \`--chart-seq-1\` to \`--chart-seq-${dv.sequential.length}\`, light to dark. ${swatches(dv.sequential)}`,
    'One hue, for one quantity. Take as many steps as the data has bins, from the light end. It is the accent ramp with its two extremes dropped: the lightest step is indistinguishable from the page and the darkest from the body text.',

    `**Diverging** — \`--chart-div-1\` to \`--chart-div-${dv.diverging.length}\`, with the middle at \`--chart-div-5\`. ${swatches(dv.diverging)}`,
    'Nine steps so the middle is the fifth and a reader can point at zero. The ends are the danger hue and the accent hue rather than danger and success: success at one end states that the positive direction is good, which is true of a profit and false of a temperature anomaly. Where your data really is a gain and a loss, swap the positive end for the success ramp and say so in the legend.',

    'None of these is a status colour. A series that happens to be red is series two, not a failure. Where a chart shows both a series and a state, put the state in a mark or a label rather than in the fill, or the two colour languages collide in one picture.'
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
  /* ── NAME THE PROPERTY, NOT ONLY THE ROLE ──
   *
   * This table listed three FAMILY roles and the token file publishes SCALE
   * roles, so the mono family is carried by `--font-code-family` and nothing
   * anywhere said so. Every rule in this document about figures says "the mono
   * family", the obvious guess is `--font-mono-family`, and a custom property
   * no stylesheet declares resolves to nothing, paints nothing and reports
   * nothing — which this file warns about in the Colors section and then
   * walked into itself.
   *
   * Found by simulation run 12, by writing the guess and getting no face.
   * The Sass file calls the same family `$font-mono`, so one thing had three
   * names across four files and the document bridged none of them. */
  /* A family is not a token of its own. Every SCALE role carries one, so the
     property to read is whichever scale role is canonical for that family.
     Prefer the obvious name, and fall back to the first role in the family so
     a renamed or removed scale role cannot leave the column empty. */
  const PREFERRED = { display: 'display', body: 'body-md', mono: 'code' }
  const famProp = role => {
    const inFamily = derived.typography.filter(tok => tok.family === role)
    const pick = inFamily.find(tok => tok.name === PREFERRED[role]) ?? inFamily[0]
    return pick ? `\`var(--font-${pick.name}-family)\`` : '—'
  }
  const fams = table(['Role', 'Family', 'Read the family as', 'Used for'], [
    ['display', derived.families.display?.stack ?? '—', famProp('display'), 'Headings and display sizes'],
    ['body', derived.families.body?.stack ?? '—', famProp('body'), 'Body copy, labels, UI text'],
    ['mono', derived.families.mono?.stack ?? '—', famProp('mono'), 'Code, figures, technical values'],
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
      '**RESET `box-sizing` TO `border-box` BEFORE ANYTHING ELSE.** Every height in this file is the whole box, and every stated line height is that height minus its borders. Both are only true under `border-box`, and the browser default is `content-box`, where a height and its padding ADD. Measured on a generated dashboard: a nav item asked for the 44px target floor, carried 6px of padding above and below, and rendered a 56px box with its label pinned to the top. Put `*, *::before, *::after { box-sizing: border-box }` at the top of your stylesheet. This package does not ship a reset, because a reset belongs to the application rather than to a token file.',
      '**A CONTAINER QUERY NEVER STYLES ITS OWN CONTAINER.** `@container` matches inside the containment context, so a rule for the element that declares `container-type` is inert. That is worse than not working, because the half that DOES apply hides the half that does not. Measured on a generated dashboard: the shell declared the containment and the query held both its own `grid-template-columns` and `.rail { display: none }`. The rail hid, its 224px column stayed with nothing in it, the content came out 96px wide, and the page overflowed by 177px at a 320px viewport. Put `container-type` on a WRAPPER and leave the collapsing element a descendant of it.',
      '**A RULE THAT WINS BY POSITION IS NOT A FIX, AND A COLLAPSE BLOCK USUALLY LOSES.** Every rule a breakpoint overrides has the same specificity as the base rule it is overriding, so the cascade is decided by ORDER. Write the collapse beside the structure it changes and a later base rule silently beats it. Measured: a menu button declared `display: none` ninety lines below its own container query, so it never appeared at any width, and a narrow page had no rail and no menu at all. Put every breakpoint and container block AFTER the base rules, at the end of the stylesheet.',
      '**`align-content` DOES NOTHING ON A FLEX ROW THAT CANNOT WRAP.** It positions flex LINES, and the default `nowrap` gives one line that always fills its container. So the declaration reads like the fix and is ignored, and the items stay where `align-items` put them. Measured on a nav item holding the 44px touch floor: the label packed to the top of a 44px box, which reads as an oddly tall selection with its contents in a corner. Either add `flex-wrap: wrap`, which gives the property a line to centre, or centre the items instead.',
      '**A SCROLLER CANNOT CLAMP UNTIL EVERY ANCESTOR IS FLOORED.** A flex or grid child defaults to `min-width: auto`, so its box grows to its content and the `overflow-x` inside it never engages. Measured at a 320px viewport: a table rendered 572px wide, the page came to 497, and nothing scrolled inside its own box. Put `min-width: 0` on every box between the scroller and the page, not only on the one that holds it.',
      'Use `minmax(0, 1fr)` for equal grid columns, never a bare `1fr`. A bare `1fr` carries a min-content floor, so the column holding the longest word grows and the "equal" columns come out different widths.',
      '**A HIT AREA WIDER THAN ITS MARK GROWS INWARD ON AN OUTER COLUMN.** A checkbox is drawn at its own size and hit at the published target, so the area is far wider than the box. Centre the box in it and the first column paints its mark well inside the margin every heading, count and range in the panel sits on. Measured from a card own start edge: the title, the selection count and the pager range all at 13px, and the checkbox at 27px. A check on the CELL cannot see it, because the cell was on the margin and the painted mark was not. Give an outer column start alignment and let the area extend away from the edge.',
      'Anything left alone on its own line takes the whole line. A wrap, a fold or a hidden label orphans an element often. The orphan almost never resizes itself. A 150px field floating in a 351px row then reads as an accident, not a decision.',
      'Sideways scrolling is a last resort, not a layout tool. Ask what genuinely cannot stack: a table of real columns cannot, so it scrolls. A run of buttons can, so it stacks. A pane that scrolls down, inside a page that scrolls down, around a group that scrolls sideways, is three scrollbars for four controls.',
      'Choose each breakpoint from the thing it governs, measured. "Can two panes sit side by side" is about pane width. "Is this toolbar cramped" is about that toolbar\'s own contents, and the two answers are usually far apart. Reusing one number for both leaves every width in between with a layout that cannot fit.',
      'Collapse in stages, cheapest first: decoration before content, content before action. A wordmark and a colour strip go before a name you can edit, which goes before a button you can press.',

      /* Three rules the simulated dashboard had to invent, because the file
         said what a narrow layout must not do and never said what it does
         instead. The agent wrapped the header actions onto a second line and
         reflowed the nav rail into a two-column grid. Both are what a flex
         container does when nobody decides for it. */
      'A row of actions beside a heading moves **below** the heading when it stops fitting. It never wraps inside the heading\'s row. Put the whole row on its own line under the heading and its description, aligned to the same start edge.',

      /* The three cases the user drew, after a generated dashboard stacked a
         44px icon button on a line of its own and left the rest of that line
         empty. A wrap is what flexbox does when nobody decides; these are the
         decisions. */
      'There is no limit on how many actions may sit beside a heading. As many as fit at their natural widths belong on that line, and a wide layout should keep them there. The rules below start the moment they stop fitting — they are about breaking a row, not about capping one.',

      /* What "stop fitting" means, which the rules above assumed and never
         defined. Without it an agent fits a row by letting the title touch the
         first button, which technically fits and reads as a collision. */
      'Keep a floor under the gap between a heading and the nearest action beside it. Use the `lg` step. Proximity is a ratio: the buttons sit `xs` apart from each other, so anything close to that between the title and the first button makes the two read as one group.',
      '**A GROUP LABEL OWNS THE DISTANCE TO WHAT IT NAMES, AND A BARE BLOCK OWNS NOTHING.** An overline above a list is two block siblings, and blocks carry no gap of their own. Measured on a generated rail: a "Ledger" label sat 0.00px above the first navigation item, so the label read as a dead first row of the list rather than as its name. A flex parent with a `gap` fixes the whole group at once; a `margin-bottom` on the label fixes only where somebody remembered it. Give the label at least the `sm` step, and keep it under the step between one group and the next, or the label joins the group above.',
      'That floor is what decides when the row breaks. The question is never "do the actions still fit" — it is "do they still fit with that gap intact". A row that fits only by letting the title and the first button close up has already failed. Move the actions below the heading at the width where the gap would drop under the floor, not at the width where the buttons would finally overlap.',
      'Once the actions are on their own line, break them by importance, not by whatever order they were written in. Four rules cover any number of buttons.',
      '**If they all fit on one line, leave them.** They keep their own widths and their ratio to each other. Do not stretch any of them to fill the row.',
      '**An ODD number of actions gives the most important one a full-width line to itself.** It goes first, at the top. In a row the primary reads last because the eye ends there; in a column the top line is the one that gets pressed. That leaves an even number to pair up below it. An EVEN number needs no such line and pairs straight away.',
      '**The rest go TWO PER LINE, equal, covering the whole width.** Each takes half the line, so every line starts and ends on the same two edges as the first — a ragged line reads as a wrap that got away rather than as a decision. Where one label is longer than its half, it takes the width it needs and its partner shrinks into what is left. Where BOTH labels are too long to share, each takes its own line at full width.',
      '**Build the pair as its own container, holding two buttons.** Two per line and "one stretches, the other shrinks" cannot both come out of one flex row. Give every button in a row `flex: 1 1 0` and the count per line is decided by the labels rather than by you — five buttons come out one, then three, then one. Give them a 50% basis instead and a `min-content` floor pushes the two bases past the line, so the row wraps rather than shrinking the partner, and one long label renders the same as two. With two children in their own container, growth splits between exactly two. Each button then takes `flex: 1 1 0` and `min-width: min-content`. Measured on a 370px row: 49/49 with both short, 58/40 with one long, 100/100 on two lines with both long.',

      /* ── THE THIRD CASE NEEDS ONE MORE DECLARATION, AND IT WAS MISSING ──
       *
       * The rule above promises "100/100 on two lines with both long" and
       * never says how the pair reaches a second line. A flex container does
       * not wrap by default, so with both labels too long the pair simply
       * overflows its row.
       *
       * Measured on a generated record page at a 320px viewport: the pair
       * came out 341px inside a 280px row, on one line, and pushed the page
       * 42px sideways. The primary button was cut off at the screen edge.
       * `flex-wrap: wrap` on the pair took it to 280px, two lines, 280 and
       * 280, and zero overflow.
       *
       * It costs nothing in the other two cases, because a container only
       * wraps once its contents genuinely do not fit. Re-measured at 370px
       * with wrap on: 49/49 with both short and 39/60 with one long, both on
       * one line. */
      '**AND THE PAIR WRAPS, WHICH IS THE ONLY WAY IT REACHES A SECOND LINE.** A flex container does not wrap by default, so a pair holding two labels that are each too long for half the row overflows instead of stacking. `white-space: nowrap` on a button means neither one can shrink below its own label, so nothing else can give. Put `flex-wrap: wrap` on the pair. Measured at a 320px viewport: without it the pair came out 341px inside a 280px row and pushed the page 42px sideways, with the primary cut off at the screen edge. With it the pair is 280px over two lines at 280 and 280, and the page does not scroll. It changes nothing at a width where the two fit.',
      '**Dissolve the pairs at any width where the row fits on one line.** `display: contents` on each pair promotes every button into the single row, at natural widths. The pairing is what a row does when it breaks, not a permanent structure.',
      '**An auto margin does not create space; it takes what the line already has.** A button held against the END edge by `margin-inline-start: auto` needs free space on its own line to consume. Put the buttons inside a box that shrink-wraps them and there is none, so the margin resolves to zero while the bar still has room — measured at 0px against 618.6px of empty bar. Nothing reports it: the margin is declared, computed style agrees it is zero, and the button simply sits in the wrong place. Give that box `flex: 1` so the slack falls inside it.',
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
      'Give that property a name of your own and set it beside the rule that uses it. It is not a token and it does not belong in `tokens.css`, which the next export overwrites. `VERIFY.mjs` accepts any custom property your own source declares, so the two do not fight; a name you read and never declare is still a typo and still fails.',
      '**SWEEP THE MIDPOINTS TOO, BECAUSE A FAULT LIVES WHERE THE LAYOUT CHANGES.** A declared width is where you already thought about the arrangement. The band between two of them is where nobody did. Measured on this system: 77 clean runs over a real fault whose band ran from 360 to 600, when the declared list held 296, 320, 640, 768, 1024, 1280 and 1536. Not one of those values falls inside it. Add the midpoint of every adjacent pair, and label it as a midpoint so a finding there reads as between two breakpoints rather than at a width somebody chose.',
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
      'An **empty state** is FOUR states, never one, and they are not interchangeable. **First run** carries the feature\'s own primary action — this is where the product teaches itself. **No results** offers a way BACK, such as clearing the filter, and never a way forward; the reader already has data and asked the wrong question. **A failure** names what failed and offers a retry. **Loading** is the fourth, and it holds the shape of what is coming rather than a spinner — the rules for it are under Accessibility. One "nothing here" card serving all four tells a new user the product is broken.',
      'Each empty state holds a mark, a title, one line of explanation and exactly one way out. Cap the prose at the stated measure and centre the block with `align-items: center`, not `stretch` — a stretched child of a centred column is full width and only looks centred while its text is short.',
      'A **comparison** is read across, so it keeps its columns. This is the one exception to the rule that a run of items which does not fit has too many: a plan table holds every column while they fit, and stacks when they do not. It never scrolls sideways, because a column scrolled out of view is a column nobody compared.',
      'Put every row of a comparison on **one** grid, so a cell in row four sits under the cell in row one. Rows sized independently line up only by accident, and the reader is scanning down a column.',
      'Repeating a track list on each row is not the same as sharing one, and it does not work. Declare the tracks once on the container and make every row a `subgrid` of it. Written out again per row, an intrinsic track such as `max-content` resolves against that row alone — measured, a header row sized its label column to the word "Feature" while the rows below sized theirs to "Automatic chasing", and the three value columns missed their own headings by 44.1, 26.5 and 8.9px. Nothing overflowed, so no check objected. Keep the repeated list as a fallback under `@supports`, so a browser without subgrid renders a comparison that is slightly out rather than one column of everything.',
      'Give a comparison\'s label column `max-content`, never a fraction. A fraction takes its share at every width and takes it from the columns being compared, which is where the width is needed. Measured on the same table: sized as `1.1fr` it had to stack at 880px, and at `max-content` it stayed side by side to 788.',
      'Size the collapse of a comparison from its widest CONTROL, not its widest answer. On a plan table the answers were 56px and the columns had 186px to hold them; the item that actually stopped fitting was a call to action needing 136px. Measure every cell, label and button in the block, and take the widest shortfall.',
      'Mark a **recommended** option by its edge, never by a fill. An accent border and a chip say "recommended". A fill says "selected", and a filled column beside two unfilled ones tells the reader a choice has been made when nobody has made one.',
      'A marked column keeps ONE unbroken edge and still carries the row dividers. A comparison is read across, so a column with no rules in it reads as a panel laid over the table rather than as one of its columns. Do not draw those dividers with a border: a border spans the cell\'s whole width, including the pixel carrying the accent edge, so it chips that edge once per row and a table of six rows reads as six stacked boxes. Draw it as a background image instead, which can be inset where a border cannot — a 1px gradient sized to the cell width minus 2px and placed 1px in stops short of both edges, so the divider crosses the column and the vertical line stays whole. This is safe because a marked column carries no fill; it is marked by its edge.',
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
  /* ── AT DEPTH ZERO A SHADOW IS A STRING OF ZEROES, AND `none` IS THE TRUTH ──
   *
   * `deriveElevation` multiplies the geometry and the alpha by the macro, so
   * at 0 every level came out as `0px 0px 0px 0px rgba(20,22,23,0)` — four
   * rows of a shadow that paints nothing, printed under a heading that says
   * shadows, two lines above prose saying to treat every surface as flat. A
   * reader can paste one and wonder why it does nothing.
   *
   * Read the VALUE, never the macro. A layer whose colour is fully
   * transparent paints nothing whatever produced it, which also covers a
   * scrim opacity of zero and any future strategy that zeroes a layer. */
  const paintsNothing = v => typeof v === 'string' &&
    v.split('),').every(layer => /rgba?\([^)]*,\s*0\s*\)?\s*$/.test(layer.trim() + (layer.includes(')') ? '' : ')')))
  const rows = Object.entries(derived.elevation).map(([name, val]) =>
    [`\`${name}\``, (val === 'none' || paintsNothing(val)) ? 'none' : `\`${val}\``])

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
    ]),
    '**The stacking order is published. Do not invent one.**',
    '',
    'A shadow says a thing is raised. `z-index` says which raised thing wins. Nine layers, on a step of 100, so something new slots between two without renumbering the rest:',
    '',
    /* ── ONE STRING, BECAUSE THE JOINER PUTS A BLANK LINE BETWEEN ENTRIES ──
     *
     * This shipped as eleven separate array entries, and everything in this
     * function is joined with a blank line between entries. So the only table
     * in the document written by hand rather than through `table()` came out
     * with a blank line between every row, which markdown reads as eleven
     * paragraphs of pipes. Found by reading the emitted file in simulation
     * run 12 — nothing else was looking, because every other table in the
     * document goes through the helper and cannot have this shape. */
    table(['Token', 'Value', 'What sits here'], [
      ['`--z-base`', '0', 'the page'],
      ['`--z-raised`', '10', 'a card that lifts off it'],
      ['`--z-sticky`', '100', 'a header that stays while the content scrolls'],
      ['`--z-dropdown`', '200', 'a menu opened from a control'],
      ['`--z-overlay`', '300', 'the scrim behind a dialog'],
      ['`--z-modal`', '400', 'the dialog on that scrim'],
      ['`--z-popover`', '500', 'a picker that has to clear a dialog'],
      ['`--z-toast`', '600', 'a message that clears everything'],
      ['`--z-tooltip`', '700', 'last'],
    ]),
    'Read it as a sequence rather than a table of numbers. A card lifts, a header sticks, a menu opens, a scrim covers, a dialog sits on the scrim, a picker clears the dialog, a toast clears everything, and a tooltip is last. A builder reaching for "above a modal" then finds `popover` instead of adding a thousand.',
    '',
    '**Local stacking is not a layer.** `z-index: 1` inside a positioned card, to put a mark over a fill, orders two siblings and never joins the global order. It needs no token and it must not take one, because a card that claims `--z-modal` beats every dialog on the page.',
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
  /* A MARK'S BAR IS NOT A CONTROL'S BOX, and the schema makes them share a
     key. `nav-burger` publishes `size` for its bar LENGTH and `height` for its
     THICKNESS, because the spec allows eight property names and no ninth. It
     then landed in this table under the heading "Controls that share a row
     must share a height", reading `nav-burger  2px`. A reader building a menu
     button from that has a 2px control.

     Ask the property, never a list of names. An entry publishing `size` as
     well is describing a mark it draws, so its height is a thickness.
     Enumerated on the shipped set: every real control publishes one or the
     other, and the burger is the only entry that publishes both. */
  const heights = derived.components
    .map(c => [c.name, (c.properties ?? []).find(p => p.key === 'height')?.value,
      (c.properties ?? []).some(p => p.key === 'size')])
    .filter(([, v, drawsAMark]) => v && !drawsAMark)
    .map(([n, v]) => [n, v])

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
      /* ── "PAD THE WRAPPER" IS THE ADVICE A BUILDER TAKES, AND IT DOES NOT
       *    WORK ──
       *
       * A `<span>` around an input does not forward its clicks, so a 44px
       * padded span leaves the reader with the same 16px box and the render
       * check rightly still fails it. Measured on a build from this package:
       * five row checkboxes at 16x16 under a 44px floor, every one already
       * inside a padded wrapper.
       *
       * Two shapes actually work, and the difference is whether the thing
       * being padded can receive the press on the control's behalf. Name
       * both, and name the one that looks right and is not. */
      `Give the control ${target}px of hit area without changing how it looks, and there are exactly two ways. Stretch the CONTROL itself over the target — transparent, positioned, on top — and let a sibling paint the small box under it. Or make the wrapper a \`<label>\`, which does forward its clicks, and visually hide the input inside it. Padding a \`<span>\` wrapper is neither: a span cannot receive a press for the control inside it, so the reader still has only the small box to hit and nothing about the markup says so.`,
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
      '**A SQUARE TALLER THAN THE WORDS BESIDE IT TAKES THE ROW CENTRE, NOT ITS BASELINE.** The cap-band formula above assumes the mark has no baseline of its own, which is true of a drawing: `vertical-align: baseline` puts its bottom edge on the line and the transform lifts it into the band. A square carrying initials HAS a baseline, so that premise fails and the transform pushes it the wrong way. Measured on a 32px square beside an 18px name: initials on the row baseline left the square 6px above the cap line against 13px below it, so it hung 3.5px low, and the formula made that 20.75. Give the ROW `align-items: center` instead. One declaration, and the square landed 9.23 against 9.77, which is a quarter of a pixel from the band centre and needs no correction. Keep the baseline treatment for an avatar close to the size of the text beside it; reach for the centre once the mark is roughly twice the cap band.',
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
      '**THE SELECTION COLUMN IS THE ONE EXCEPTION, AND IT HAS ITS OWN ENTRY.** A column that carries the selected row\'s accent bar cannot also sit flush, because the bar would paint over whatever is in the cell. `table-selection-cell` publishes that column\'s padding with the bar\'s gutter already in it. Take it on EVERY row of that column, selected or not, and take `table-cell` for every other column.',
      'Never build an underline from a border. A 2px border makes the element 2px taller and pushes it past its own container\'s rule, breaking that line exactly where the element sits. A *transparent* border costs the same height, so the inactive siblings sit wrong too. Paint it with `box-shadow: inset 0 -2px 0` instead, which lands in the same place and joins no box.',
      '**AND EVERY MARK DRAWN THAT WAY DISAPPEARS IN FORCED COLORS.** Windows High Contrast overrides authored colour, ignores `box-shadow` outright, and drops `background-image`. Three marks in this system are drawn with one of those, and each is a rule stated above: the selected row\'s accent bar, the selected tab\'s underline, and the neutral badge\'s outline. In that mode all three lose their only marker, and the fill cannot cover for them because `background-color` is disregarded as well.\n\n**Restore them with an `outline` at a NEGATIVE offset**, inside `@media (forced-colors: active)`. Forced colors preserves outlines, which is why a focus ring already survives there, and an outline costs no layout. A border would widen the box and move the very column these rules keep straight. Use `Highlight` for a chosen thing and `CanvasText` for a structural edge: those are the user\'s own colours, which is the point of the mode. `tokens.css` ships the block keyed on `aria-current`, `aria-selected` and `aria-checked`. Match your own selectors to it if you mark state with classes instead.',
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
      'A **mark beside a heading** aligns to the heading\'s cap centre, exactly as an icon beside a label does, and the error is larger because the box is. `align-items: center` centres on the heading\'s line box, which is far taller than its cap band: measured 2.81px high on a 39.1px title. Correct it with a transform, stated against the heading\'s own size token so it follows the type scale. Do not state it in `em` — on that element `em` resolves against the inherited body size, not the heading\'s. A heading that wraps has no single cap centre at all, so the block rule above applies instead.',
      '**The control that opens a folded navigation is a BUTTON, and it belongs to the action group at the seat furthest along the row.** Not a mark parked against the page title — a control beside a heading reads as part of the heading rather than as something you press. Give it the same shell as every other button in that row: the same height, padding, radius, border and hover. Navigation outranks every action on the page, so nothing may take that last seat from it. Build it as a SIBLING of the action group rather than a member, because a collapsing header keeps this one control on the title\'s row after the others drop to a line of their own — inside the group it can only go where the group goes.',
      '**A header collapses in five stages, and the order of sacrifice is the rule.** The title and the mark that opens the navigation never go. Widest, the navigation is a column beside the page and every action sits on the title\'s row. Then the navigation folds to a mark with its label, at the right of the title. Then the label goes. Then the actions take a line of their own, which hands the label its room back. Then the label goes again. Read it as a priority order rather than five layouts: drop decoration before content, and content before action.',
      '**A collapse threshold is a SUM, not a constant — recompute it for your own content.** Every width in this document was measured from one heading and one set of controls, and a container query cannot measure text, so the numbers here are a worked example rather than a value to copy. The sum is: `threshold = widest item + gap + the control beside it + twice the surface padding`. The reference this document was measured from: heading 163px, labelled menu control 160px, bare control 44px, action group 251px, row gap 8px, surface padding 24px each side. That gives 163 + 8 + 160 + 48 = 379, and the heading starts overflowing just under 380. Substitute your own widths and the same sum gives your own threshold.',
      '**A sum only works on a row with two things in it.** Every threshold here that was added up while the row held three or four items came out 16 to 32px wrong, because a sum misses a gap or a size step. Two things can be added up and four cannot, which is a reason to simplify the row rather than to measure harder.',
      '**Measure a part at the width where it is used.** A control that grows at a breakpoint has two natural widths, and the sum is only true on one side of it. The menu control here is 136px above the `sm` breakpoint and 160px below it — using the smaller figure put a threshold 25px too low and clipped the heading.',
      /* The two-natural-widths sentence belongs to the rule above and was
         repeated here verbatim. One statement, and this one points at it by
         naming the case rather than restating the claim. */
      '**Derive a collapse threshold by shrinking the real row until it breaks.** Never by adding up the parts. Two thresholds here came from arithmetic and both were wrong — one by 32px of margins and edges a sum never counts, and one by measuring an action row at a width where its buttons were still at the small step, which is the two-widths trap above.',
      '**A title beside its actions takes content width, never the free space.** `width: 100%` puts the actions on a second row at every width. `flex: 1 1 auto` does the same thing quietly, by growing into the room the actions needed. Use `flex: 0 1 auto` and let the title claim the whole line only at the width where the actions are meant to drop.',
      '**A folded menu floats. It never pushes the page down.** Opening it inline moved every word on the screen, which is the thing a floating panel exists to prevent. Take the panel out of the flow, anchor it under the mark that opens it, and give it the overlay elevation — a flat panel reads as text lying on the page rather than a surface above it.',
      '**Two meanings must not be one colour, and contrast cannot tell you.** A ratio measures lightness, so two roles one step apart on a ramp read about 1:1 whatever their hue. Compare OKLCH hue as well: below about 25 degrees the pair says nothing. Ask both questions together, though — a brand and a danger one degree apart in hue but fifteen points apart in lightness ARE distinguishable, and reporting that pair calls a solved problem open.',
      '**A page title keeps every word and takes the lines it needs.** It is the one thing on screen that says where the reader is, so it wraps rather than truncating, and it never breaks mid-word. Measure every collapse threshold from a LONG title rather than a short sample one — a container query cannot measure text, so a threshold tuned to a short heading lets a long one overflow before the layout reacts. A short title then collapses a step early, which nobody notices; an overflow is a defect everybody notices.',
      '**THE CONTROLS ALIGN TO THE HEADING. THE METADATA LINE IS NOT PART OF THAT ROW.** A description, a timestamp or a status line sits BELOW the title and belongs to no row of controls. So a title and its description must not be one flex item: `last baseline` then takes the last line of that item, which is the metadata, and the buttons land level with the small grey line instead of the heading. Measured on a generated dashboard: a 31.78px baseline spread across the row, with the actions 25.78px below the title they belonged to. Give the header named grid areas — the title and the actions on one row, the description on its own underneath — so the actions centre on the title and still take a full line below everything when they stop fitting.',
      '**COUNT WHAT A HEADER ROW HOLDS BEFORE CHOOSING ITS ALIGNMENT.** A heading beside two or three fixed-height controls is a row of CONTROLS, so it centres. On baseline, a button carrying a mark and a button carrying none report baselines 1.75px apart, because the mark is a baseline participant and the label is not the only one. Reach for `align-items: center` on any header row whose controls outnumber its runs of text.',
      '**Controls beside a multi-line title centre on its FIRST LINE, not on the block.** Centred on the block they drift further down with every extra line, and then they read as attached to the paragraph rather than to the heading. Derive the offset from tokens rather than typing it: the first line is `size × leading`, and the control\'s height is its own step. Use the height the control actually has at that width — assuming the small step read 6.08px out where the button was 44 tall.',
      '**"Rightmost" and "stays with the title" cannot both hold in one wrapping row.** Ordered after the action group, a menu control sits last and wraps away with it. Ordered before the group, it keeps the title\'s row and stops being rightmost among the buttons. A short title hides the clash; a long one makes the group wrap early and exposes it. Staying with the title wins, so the action group takes a line of its own whenever the navigation is folded.',
      '**THE MARK IS ONE SIZE AT EVERY BUTTON SIZE.** A button states its box, its padding and its label per size; its icon does not follow. The size is published once, as the button component base, and every size step reads that one value. Do not derive a per-size icon from the label beside it: the alignment rule below centres the mark on the label\'s own cap band at whatever size the mark is, so the step has nothing left to track. Deriving it per size is also how the pairing breaks in practice, because every rule that resizes a button then has to remember to resize a mark, and three of them did not.',
      '**An icon equal to its label crosses the baseline, and that is a SIZE fault fixed once.** The cap band is what a reader compares the mark against, and it is about three quarters of the type size, while the tallest glyphs in an icon set paint nearly their whole box. Measured on a download mark beside a 12px label: 11px of ink in a 9px band, 1.3px below the line. The published mark size already clears this. If you change it, change the one token, never a glyph and never a single size step.',
      '**The icon lives between the CAP LINE and the BASELINE of the label beside it.** Those two lines are the whole vertical rule: the top of a capital letter, and the line the letters sit on. Centre the icon BOX between them, and measure the centring on the box rather than on the ink — the box is what CSS places, and where a glyph sits inside its own viewBox is the icon set’s business. Equal overhang above and below is correct, because that is what centred means. A large equal overhang is a size fault, fixed by taking the icon token down a step and never by moving the glyph.',

      /* ── THE FORMULA, NOT ONLY THE TARGET ──
       *
       * The rule above states where the mark ends up and left the reader to
       * derive the CSS. Several plausible answers land in different places,
       * and the usual one is `vertical-align: middle`, which is the x-height
       * centre rather than the cap centre. A generated build got there and
       * the mark sank on every button.
       *
       * Every neighbouring rule in this section already ships its mechanism —
       * `:not(.icon-only)` on the selector, `line-height` on an inline-block
       * for avatar initials. This one was the outlier. */
      'Three declarations do the whole job, and none of the three is optional:\n\n```css\nvertical-align: baseline;   /* puts the box BOTTOM edge on the text baseline */\nalign-self: baseline;       /* a flex parent ignores vertical-align */\ntransform: translateY(calc((100% - 0.75em) / 2));\n```\n\nThe percentage resolves against the mark’s OWN height, so one rule holds at every icon size and no per-size table is needed. `0.75em` is the cap height, measured from painted ink at 12, 16, 20 and 24px. Both units resolve on the element carrying the transform, so put the rule on something that inherits the label’s type.',

      '**Two traps go with that formula, and neither is guessable from the result.** `align-self` is not optional: a flex parent ignores `vertical-align` entirely, so a nav item centred its mark on the row box while the button beside it sat on the baseline, measured 0.34 above the cap against 5.66 below. And the ROW must declare `align-items: baseline` as well, because `align-self: baseline` aligns to the flex LINE baseline rather than to the label. Inside a folded menu the item grew to 40px and the two diverged, at 2.65 spread against 0.50 for the same markup wider.',
      '**AND TWO CONTROLS ARE EXCLUDED FROM IT, WHICH IS WHERE THIS RULE GETS BROKEN.** The rule says "the label beside it", so a control with no label is not in it. An ICON-ONLY control has no text, so there is no cap line and no baseline to sit between: it centres on its own BOX, both axes. A SELECT TRIGGER puts its chevron at the far end of a row that sets its own alignment, and centres on its box too. Write the rule so it cannot reach them — a `:not(.icon-only):not(.select-trigger)` on the selector — because a builder that applies it to everything gets the fault silently. Measured on a generated dashboard: a lightbulb in a 36px square button sat 8.25px above the button\'s centre, and the reader called the icon broken without being able to say why.',
      '**Do not correct individual glyphs.** An icon set spans its glyphs deliberately: measured in one 12px box, a plus paints 8px of ink, a magnifier 10px and a chevron 4px. That variation is the set’s optical balance. Scaling each glyph to a common ink height destroys it and leaves a table of per-glyph numbers nobody can maintain. Fix the size token and the alignment rule; leave the drawings alone.',
      '**ANY RULE THAT RESTATES A BUTTON’S SIZE MUST RESTATE ITS ICON.** This is where the pairing breaks in practice, and it broke twice in one system. A touch-width rule promoted header buttons to the large step — height, leading, padding and label — and left the mark on the small one: a 44px button carrying a 16px label and a 10px icon. A navigation call-to-action was promoted to match the links beside it, kept the small size class in its markup, and did the same. Height, padding, label and mark are one decision, so they live in one block. Anything added to such a selector list belongs in every declaration it carries.',      '**An icon-only control is SQUARE — one to one, at every size step.** An oblong reads as a button whose label failed to load. State it with `aspect-ratio: 1` and `padding: 0` rather than a width per size, so a new step in the scale cannot leave the shape behind.',
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
      '**MEASURE THE SIDE THAT CANNOT SHRINK, AND A TABLE IS ALWAYS THAT SIDE.** A run of tiles wraps when its share runs short, which is untidy. A table SCROLLS, which hides columns, and a scrollbar under a table on a wide desktop reads as a broken page rather than a narrow one. Measured on a generated dashboard at a 1400px viewport: a seven-column table needing 774px was given three fifths of the content column, came out 628px, and cut 146px off its last two columns with a rail still on screen and room to spare beside it. Take the table\'s own min-content width, add the padding between it and the split, and give that side at least this much. Where no share can hold it, the split is the wrong structure for that width and the context column belongs underneath. That floor is a MEASUREMENT, so no token can hold it: put it in a custom property of your own beside the grid that reads it, state the sum it came from in a comment, and keep it on the space grid.',
      '`flex: 1` with `min-width: 0` lets a box **shrink under its own label**. Three tiles cut their headings to fit — 73px of word in a 34px box — and no check calls that an overflow, because nothing left the box. Give a tile `flex: 1 1 max-content` and a `max-content` floor, and let the row wrap instead. A wrapped row is legible; a cut word is not.',
      'Unequal gaps in one row read as a mistake even when nothing is misaligned. Every gap comes from the spacing scale, and a different gap means a deliberate grouping rather than a typed number.',
      'Proximity is grouping, and it outranks alignment. Items closer together read as one unit, so a label nearer the field below it than the field above labels the wrong one — and no amount of correct alignment repairs that.',
      'Only one thing may animate a property at a time. Two loops writing the same scroll position or the same transform do not average out — they trade pixels, and the one with the larger step wins by a few a frame. The symptom is a jitter that works about half the time, which is whether the first animation had already finished. Whoever starts second takes sole ownership and cancels the first.',
      'Adding a second way to do something is a change to the first way. A tab strip gained wheel scrolling and its hover-scroll broke, though that code was never touched. After adding an input, exercise every other input that reaches the same state.',

      'Never tell someone you saved a document they did not change. A control that changes what the reader is LOOKING at — a light/dark preview switch, a zoom, a filter, a chosen tab — must not write the document, mark it unsaved, add an undo step, or raise a "saved" message. Each of those says an edit happened, and no edit happened.',
      'The test for whether a control is a lens is not whether it feels like a preference. Generate the output before and after it, and see whether a single byte moves. If nothing moves, it is a lens, and it belongs in view state — or at least outside anything that counts as an edit.',

      'A status readout is not a control. If it renders as a bordered pill with a label, people will click it. Either make it clickable or stop drawing it like a button: no border, no pill, and wording that states a fact.',
      'Never style a bare element selector in an application that renders somebody else\'s design inside it. A rule like `label { text-transform: uppercase }` reaches every label in the hosted content, The preview then stops showing the user\'s system and starts showing yours. It also disagrees with what that same system exports, which is the file people build from. Scope such rules away from the hosted region.',
      'A flex container takes its baseline from its **first flex item**. Whatever sits first inside it decides where the row\'s text sits. An `inline-flex` badge starting with a tick hands its baseline to the tick. The same badge starting with a status dot hands it to the dot. Measured: three badges of one class, one height and one font, 4px apart on a single line. Build a badge as an `inline-block` with a stated `line-height`. Space its ornaments the way the line-box rule above says. No child can then move its baseline.',
      'Height and `line-height` are one decision, never two. Change a control\'s height and change its line height in the same edit, always to the height minus its two borders. A height raised for a touch target while the line box stayed sized for the old one measured 13px above the cap against 17 below the baseline.',
      'A control with a stated height and an icon needs three properties together: the height, the line height, and `align-items: center`. Leave the alignment unstated and the label centres while the icon goes to the top of the box — measured 12.5px apart.',
      'Symmetric padding does not optically centre text. A line box is not symmetric about the cap-to-baseline band. A taller sibling on the same baseline hangs further below it than letters do — a chip, a count, a badge. The row therefore grows downward only, and the label it grew around ends up high inside it. Correct it with unequal padding: move one pixel from the bottom to the top. Do this only where that taller sibling is present. Derive the pixel by measuring, never by picking.',
      'Judge padding by the result, never by its symmetry. Unequal padding with centred text is a correction doing its job. Unequal padding with off-centre text is the defect. A review that flags the asymmetry itself reports the fix and calls it the fault.',
      '**Every control in a row is the SAME HEIGHT, and that height is stated rather than inherited from what is inside it.** This is the rule the rest of this section depends on, so read it first. A control sized by its own contents comes out at whatever its padding, border and label happen to add up to, and it changes the next time any of those change. A segmented control built that way stood 34px beside a 36px select — and because the row centres its children, two boxes of different heights MUST have different tops, so it sat 1px low and read as a misalignment. Nothing was misaligned. The row was holding two heights. State the height on the box, give its inner buttons `align-items: stretch` and `height: 100%`, and the offset cannot occur.',
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
      'Inside a card, the action row stands FURTHER from the body than anything else in the card, and 16px is the distance. A button pressed against the sentence that explains it reads as the last line of that sentence; at 24 it reads as a separated block rather than a card with an action in it. State one distance and use it in every card.',
      '**And in a ROW of cards, every action sits on the bottom edge.** Cards stretched to one height do not give their buttons one height: a description that wraps to two lines pushes its own button down, and the row then reads as ragged. Measured on three plan cards of equal height: one button ended 25px from its card\'s foot and the other two ended 47.3px from theirs. Put `margin-top: auto` on the action row, which takes the free space in a flex column and lands the action on the bottom wherever the text above it ends. A card sized by its own content has no free space, so the margin resolves to zero and nothing moves — the rule needs no width test and no second class.',
      'THE DISTANCE THEN HAS TO MOVE TO PADDING, and this is the part that is easy to get wrong. An auto margin consumes the free space, so it cannot also hold a minimum: the moment a card fills up, a stated margin collapses to nothing and the action touches the sentence above it. Padding cannot be consumed. One writer per property — the margin pushes the action down, the padding holds it clear. Where the card is a stack with its own gap, subtract that gap from the distance and floor the result at zero, because padding cannot go negative.',
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
      '**A TINTED SELECTION STEPS DOWN, AND IN DARK THAT READS AS A HOLE.** `accent-subtle` sits below the surface in BOTH modes — measured L 89.3 against a 94.0 card in light, and L 23.7 against 27.6 in dark. In light a slightly darker tinted band is the conventional marked row and it reads correctly. In dark the same step moves the row toward the page rather than toward the reader, so it reads as a hole with a coloured label floating in it. Where the mark has to work in dark, carry it on the LIGHTNESS instead: step up to `surface-raised`, which is +3.1 in light and +7.8 in dark, and let the label take full-strength `text`.',
      '**A GROUND MAY BE QUIET. A FILLED SHAPE MAY NOT.** `accent-subtle` is the tint behind accent-coloured TEXT, and the words carry the contrast, so the fill may sit close to the card. An avatar disc, a status dot or a tinted square has no words to carry it. Its own fill is the whole signal, and under about 1.2:1 against the ground the shape is absent rather than subtle. Measured here against the card: 1.13:1 in light and 1.11:1 in dark, so an avatar drawn in it vanished in both modes and only its initials floated. No accent STEP repairs it, because a step near the middle of the ramp carries the ramp\'s full chroma and reads as a solid button. Use `accent-raised`, which mixes the accent into the raised surface and clears the floor in both modes, and put `text` on it rather than `accent`.',
      '**AND THE EDGE COSTS A GUTTER, WHICH EVERY ROW IN THE SET RESERVES.** A bar drawn inside the row eats whatever is at that inset, so the content has to clear it. **Never a border**, whichever mechanism you pick: a border widens the row by its own width, so the selected row alone would sit at a different inset.\n\n**WHICH MECHANISM DEPENDS ON WHETHER A RULE CROSSES THE ROW.** Where nothing does — a nav item, a card in a list — an inset `box-shadow` is right and costs no extra element. Where a rule DOES cross, as in every table row with a bottom hairline, an inset shadow is wrong: the border paints on top of it, so the bar stops one hairline short at each boundary. Measured here on a 57px row: the bar painted 56. It then reads as a dash between the rules rather than as the row\'s own edge, and a run of two selected rows shows the break twice.\n\nIn a ruled set the bar is a **pseudo-element**, stretched one hairline past each end so it overlaps the rule above and below. Nothing else can: a background is clipped to the border box and the border still covers it, and an outline draws on all four sides. Two adjacent selected rows then meet with no seam, which is correct — they are one selection.\n\n```css\n.table tr.is-selected > td:first-child { position: relative; }\n.table tr.is-selected > td:first-child::before {\n  content: ""; position: absolute;\n  inset-block: calc(-1 * var(--border-hairline));\n  inset-inline-start: 0;\n  width: var(--cmp-table-row-selected-edge-width);\n  background: var(--cmp-table-row-selected-edge-color);\n}\n```\n\n**The gutter belongs to the BASE padding, never to the selected state.** Adding the bar to the selected row alone is arithmetically right and it staggers the column: measured on a 4px bar, a nav list of five had its selected label at 693 and its four siblings at 689. So `nav-item` and `table-selection-cell` carry the gutter in their own padding, every row takes it, and `nav-item-selected` and `table-row-selected` state no padding at all. The bar then paints into space that is already there.\n\n**A gutter is the bar plus a STEP, not the bar plus whatever is left.** Where the first thing in the row is a label, the component\'s own inset is enough. Where it is an ORNAMENT the step is bigger: a table\'s selection column holds a 16px checkbox, and at the small step the box and the bar read as touching. Both are the accent, so they fused into one shape. `table-selection-cell` clears it by the `lg` step. **Each component also publishes `edge-width`**, the bar alone, for a build that sets its own inset.',
      '**ONE TREATMENT FOR EVERY SELECTED ROW, AND EACH KEEPS ITS OWN INSET.** A nav item marked by a lifted surface, beside a table row marked by an accent wash, reads as two products rather than one system. So the fill and the label colour are the same in both. The INSET is not: a nav item is padded by `sm` and a table cell by `md`, so the two edge compensations differ and the emitted values say so. Read `nav-item-selected` and `table-row-selected` together, and give any other selectable row you build the same fill with its own base padding.',
      'A collapsed row still costs its line gap. An element held at `max-height: 0` is still on a flex line, and the container charges the row gap whether or not anything is in it. Measured on a title bar: 65px tall to hold a 40px button, and 9 of those pixels were a gap beneath a panel nobody had opened. Where a row opens and closes, give it the whole spacing as its own animated margin and set the container\'s `row-gap` to zero. One writer per gap, the same way there is one writer per animated property.',
      'Never mix a shorthand and a longhand for the same property in one inline style object. Declaration order decides, exactly as in a stylesheet: `rowGap` followed by `gap` sets both axes and the row value never applies once. Write `columnGap` and `rowGap`, never `gap` beside either.',
      'State an alignment on the element that must hold it, never leave it to a neighbour. A header\'s actions sat against the END edge only because a group beside them carried `flex: 1` — and that group is hidden at narrow widths, so the actions packed left with 226px of empty bar beside them. Put `margin-inline-start: auto` on the group that belongs at the end. Where the flexible neighbour does render it takes the free space first and the margin resolves to zero, so one rule covers every width.',

      'Two spacing gaps that are stated equal do not read equal when text sits on either side. A text box carries leading. There is more of it below a baseline than above a cap. Measured: 5.95 against 4.00 on a 12.8px font. One 8px gap rendered as 13.95 and the other as 12.00. Correct that difference. Or trim both boxes to their ink with `text-box: cap alphabetic`. If you trim, re-tune the spacing scale in the same edit. The old values were chosen with the leading in them, and trimming alone tightens every stack at once.',
      'Proximity is decided by the RATIO, never by the absolute value. Take a field group whose label sits 8px from its input. It needs clearly more than 12px before the next group. Otherwise the help line under one field sits closer to the next field\'s label than to its own input, and the two groups read as one. Separation must beat cohesion. A single step on the spacing scale is often not enough.',
      'A checkbox draws at 16px and is hit at its WRAPPER. Do not inflate the box to 24px to satisfy a target-size rule — that silences the warning by making the control wrong. Draw it at 16, declare a minimum target, and put the padding that earns it on whatever wraps the box. Where visible text sits beside the box, that wrapper is the label. Where none does — a row-selection box in a table — the CELL carries the target, and the selection column widens to the declared minimum instead of staying at the box\'s own width. WCAG 2.5.8 has a spacing exception, and the wrapper is what the exception is for.',
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
       every table of money would come out misaligned.

       NARROWED 5 September 2026, after a dashboard rendered it both ways. The
       rule used to say every figure, so one row of stat tiles read $45,645, 18
       and 21 with only the first carrying a mark. A COLUMN is what makes the
       face matter: one figure standing alone has nothing to stack against. */
    '**Set figures in the mono family when they sit in a COLUMN of figures** — a table cell, a ledger, a run of values read down the page. One figure standing alone has nothing to stack against, so a stat tile, a pricing hero, a badge count and a number inside a sentence all keep the body face. Inside a column there are two cases. An AMOUNT — money, a quantity, a percentage, a duration, anything you would add up or compare in size — takes the mono face AND an END edge, set with `text-align: end`. The mono face gives every digit one width; the END edge is what stacks the columns of digits over each other, and it is the half usually missing. Any OTHER figure in that column — an invoice number, a journal or order reference, a version, a hash — takes the face alone and keeps its normal alignment, because nobody compares its magnitude and an end-aligned identifier reads as a total. A date is text when it carries a month name and a figure when it does not: "12 Aug" stays in the body face, "12/08/2026" in a column takes the mono face.',

    /* NUMERALS. A setting, so the sentence follows it rather than stating a
       preference the document might contradict. The limit is the point: tabular
       digits are a fix for a column, and outside one they are a slab. */
    (state.type?.numerals ?? 'tabular-in-tables') === 'proportional'
      ? '**Set every figure in proportional digits**, including tables. Digits then vary in width, so a column of figures will not line up between rows and magnitudes are compared by reading rather than by looking. Do not switch a table to tabular figures to fix that — this system has chosen proportional everywhere, and one table in a different treatment reads as a mistake.'
      : '**Use tabular figures ONLY where a column of numbers has to line up**, and proportional digits everywhere else. Tabular means every digit occupies the same width, so 1 is as wide as 8 and the magnitudes stack down a column — apply it with `font-variant-numeric: tabular-nums` on the table cells that hold figures, or on the table. That is the whole reason to reach for it, and it is also the whole limit. Outside a column there is nothing to line up with, and the even spacing reads as a monospaced slab dropped into the middle of the text: a figure in a stat tile, an info card, a badge, a heading or a sentence takes the body face and its normal proportional digits.',

    /* HEADING WRAP. Nothing stated this before, so a generated page got
       whatever the browser did with a long title. */
    (state.type?.headingWrap ?? 'wrap') === 'truncate'
      ? '**A heading too long for its line is truncated with an ellipsis**, on one line. Use `text-overflow: ellipsis` with `overflow: hidden` and `white-space: nowrap`, so every row keeps the same height. The reader cannot see what was cut, so the full text has to be reachable another way: put it in a `title` attribute, or show it on the record the heading names.'
      : '**A heading too long for its line breaks into more lines** and keeps every word. It is the thing that says where you are, so nothing in it is hidden. Never break mid-word — `overflow-wrap: anywhere` turns "Overview" into "Overvie" over "w", and a title either ends with a mark that says it continues or it does not end at all. Use `text-wrap: balance` so a two-word heading does not split one word onto a line of its own.',

    /* WHERE THE CONTROLS SIT BESIDE A WRAPPED HEADING. Only stated when the
       heading wraps: one line makes all three answers identical, so under
       truncation this is a rule about nothing. */
    (state.type?.headingWrap ?? 'wrap') === 'wrap' && (
      (state.type?.headingAlign ?? 'last') === 'first'
        ? '**Every control on a wrapped heading\'s row centres on the heading\'s FIRST line.** Hang the group from the top of the row with `align-self: flex-start`, then push it down by half the difference between one line and the control: `margin-top: calc((<heading size> * <heading leading> - <control height>) / 2)`. Both terms are tokens, so a type-scale change carries and no pixel is typed. The row then reads the same however many lines the heading takes, and a long heading grows downward away from its buttons.'
        : (state.type?.headingAlign ?? 'last') === 'center'
          ? '**Every control on a wrapped heading\'s row centres on the heading BLOCK.** `align-self: center` and no margin: an offset here would move the control off the centre the alignment just found. With more than two lines the controls drift further from any single line, so they read as attached to the block rather than to a line of it.'
          : '**Every control on a wrapped heading\'s row centres on the heading\'s LAST line**, so it sits level with where the title finishes and the page continues. Hang the group from the bottom of the row with `align-self: flex-end`, then lift it by half the difference between one line and the control: `margin-bottom: calc((<heading size> * <heading leading> - <control height>) / 2)`. It is the same offset the first-line rule uses, because the distance from a line\'s edge to a control\'s centre is the same at the top and at the bottom. Both terms are tokens, so a type-scale change carries and no pixel is typed. A one-line heading makes every answer identical, so build this against a heading that actually wraps or you cannot see it is wrong.'
    ),

    /* Found by drawing a list with a select-all box over a part-selected set.
       The component had two states and needed three. */
    '**A STAT TILE TAKES THE BASE CARD, NOT THE COMPACT ONE.** The compact variant exists for a card inside another card, or a card in a list of many. A tile carrying one figure is the card the system was designed around, so it takes the base padding. Measured at the densest setting on offer: the base card gives 16px and the compact variant 12px, and 12px around a heading, a large figure and a delta reads as cramped. The variant is a decision about CONTEXT rather than about size, so pick it from where the card sits.',
    '**THE THREE STATES SHARE ONE CELL.** Two of them draw a mark, and in normal flow two marks lay out SIDE BY SIDE. Measured: two 14px marks in a 14px content box overflowed it by 6px and 8px and were clipped, so the checked box showed the right-hand half of its tick, which is the long diagonal, and read as a slash rather than a tick. `opacity: 0` on the other mark reclaims nothing, because an invisible flex item still takes its share of the line. Put every state at `grid-area: 1 / 1` in a grid box, or position them absolutely.',
    '**GIVE THE TICK THE BOX, AND LEAVE THE DRAWING ALONE.** An icon set centres its glyph in a square viewBox with margin around it, so a check occupying 16 by 11 of a 24 box spends two thirds of your control on nothing. Rendered at 12px that came to 8.0 by 5.5 with a 2.5px short leg, which no reader sees as a tick. Crop the viewBox to the glyph own bounding box plus a unit of margin. The box is yours to choose and the ink inside it is the library, so this is a sizing decision rather than a redrawing.',
    '**A CHIP CENTRES ITS LABEL WITH A STATED LINE BOX, NOT WITH PADDING.** A line box reserves descender room that capitals never use, so equal padding above and below still leaves the ink high. Measured on four badges: 7px above the ink against 8.72 below, for 1.71px of visible lift on a 25px chip. State a height and a `line-height` equal to it, and put the horizontal inset in `padding-inline`.',
    'A checkbox has **three** states, not two. Indeterminate is the only honest answer for a select-all box when some of the rows below it are selected and some are not — unchecked claims nothing is selected while rows plainly are, and checked claims everything is. Distinguish it by the MARK, a dash against a tick, never by the fill alone: a reader who cannot separate the two hues still sees two shapes.',

    /* The rule above says what a checkbox LOOKS like in each state and never
       said what tells the reader which one they are selecting. So a build put
       bare boxes in a table and bare boxes in a form, and only one of those is
       a legitimate pattern. */
    'A checkbox carries a visible label. There are exactly four exceptions, and every one of them is a case where the label is POSITIONAL — supplied by the structure the box sits in rather than by text beside it. A row-selection box is named by the column heading together with its own row. A select-all in the header cell is named by its column, so it needs a name of its own and does not inherit the rows\'. A box inside a card or a tile is named by that card\'s heading. A box in a matrix cell is named by its row label and its column heading together. Everywhere else, visible text sits beside the box. An icon-only box in a toolbar is not an exception to this: it is a toggle button, which is a different component.',
    'A positional label still owes an accessible NAME, and these are two separate questions. A selection column is right to carry no visible text and wrong to carry no `aria-label`. Name each row\'s box for the record it selects, using that row\'s own identifier rather than "Select row", and give the select-all a name of its own. A `<label>` element that wraps no control and carries no `for` names nothing, whatever text sits inside it.',

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
      /* ── A COMPONENT WITH A GAP AND NO ICON SIZE IS NOT AN OVERSIGHT ──
       *
       * The badge publishes a `gap` and deliberately no `iconSize`, and the
       * reason lived only in a source comment: its ornament is a shape, and
       * the smallest icon on the scale is larger than the caption the chip is
       * set in. A builder cannot read that comment. It finds a gap, infers a
       * mark is expected, finds no size, and invents one — which is the hole
       * the gaps guard was built to close, arriving from the other side.
       *
       * Measured while building from this package: the first attempt sized a
       * badge's mark at `var(--space-sm)`, a spacing step standing in for an
       * icon size, because nothing said not to. */
      'A component that publishes a `gap` but no `iconSize` wants a SHAPE, not an icon, and the badge is the case. Its ornament is a dot, a bar or a square built from the spacing scale — the smallest size on the icon scale is larger than the caption a chip is set in, so a glyph in one is always too big. Do not reach for a spacing step as an icon size to get around it. Three shapes also carry meaning better than three hues: a reader who cannot separate the colours still sees a circle, a dash and a square.',
      `**TAKE THE GLYPH FROM ${icons.library.toUpperCase()}. DO NOT DRAW ONE.** This package names a library and ships no marks, which leaves a builder with no path data and a mark to place. What it does then is draw its own, and a hand-drawn glyph is wrong in a way that is hard to name and easy to see: a generated dashboard invented a lightbulb whose ink filled 20 of its 24 units, so it rendered as a tall thin shape crammed into a box every other mark sat comfortably inside. Install the package, or copy the exact path data from the library's own file. An icon set spans its glyphs deliberately, and that balance is the reason to name a set at all.`,
      /* The number alone was ambiguous, and the ambiguity cost real weight
         drift here: one token painted six different marks across the surfaces,
         from 0.73px to 2.33px, because an SVG scales its stroke with its box. */
      `Stroke width \`${icons.strokeWidth}\`, ${icons.joinStyle} joins and caps. **That figure is the weight the mark PAINTS, in pixels, at every icon size.** An SVG scales `
        + 'its stroke with its viewBox by default, so one `stroke-width` renders heavier in a bigger box and a row holding two sizes reads as two different sets. '
        + 'Set `vector-effect: non-scaling-stroke` on every icon, which takes the stroke out of that transform and makes the number mean what it says. '
        + '**Declare it on the SHAPES, not on the `<svg>`.** `vector-effect` applies to drawn geometry and is not inherited, so a rule on the root element computes `non-scaling-stroke` on the `<svg>`, `none` on every `path` inside it, and changes nothing. That reads as done: the declaration is in the stylesheet, computed style on the icon agrees, and the stroke still scales. Measured on a build that did exactly this — a 1px token painting 0.875px in a 14px box and 0.75px in a 12px one, from icons whose own computed style said `non-scaling-stroke`. Write the selector so it reaches the children, `.icon, .icon *`. '
        + 'Do not compensate per size instead: the component knows which size it asked for, the stylesheet is what actually sets the box, and the two disagree wherever a button, a trigger or a mark resizes an icon.',
    ]),
    iconTable,

    '**Focus and interaction states**',
    bullets([
      `Focus ring: \`${f.width}px ${f.style}\` in \`${f.role}\`, offset \`${f.offset}px\`. Apply on \`:focus-visible\`, never remove it.`,
      `Disabled elements drop to \`${state.states.disabledOpacity}\` opacity and lose pointer events.`,
      `Minimum touch target: **${state.states.touchTarget}px**.`,
      `Transition only: ${state.states.transitionOn.map(p => `\`${p}\``).join(', ')}.`,
      /* The four-states rule is stated ONCE, under Accessibility > Targets and
         states, which also carries the `disabled` versus `aria-disabled`
         distinction it needs. A duplicate sat here and said the same thing in
         different words, which is how one rule becomes two that disagree. */
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
/* ── The RTL half, emitted only when the document turns it on ──
 *
 * Everything the rest of this file says is already logical, so a build that
 * never flips loses nothing by leaving this out. What lives here is the part
 * that only matters when the page IS right-to-left. */
function rtlSection() {
  return [
    '**This section is for Arabic, Persian, Urdu and Hebrew pages.** If the product does not ship in one of those, it does not apply, and the rest of this file already covers you. Every rule elsewhere is written in logical terms, so a left-to-right build gets the same layout either way.',
    '',
    '### The direction is declared once',
    '',
    'Put `dir="rtl"` on the `<html>` element and nothing else. Set it per element only where a run of text genuinely runs the other way, such as a Latin brand name inside an Arabic sentence. A `dir` on every container is how a page ends up with pockets that disagree with each other.',
    '',
    '### Layout mirrors. Some things inside it do not.',
    '',
    'The whole layout flips: the rail moves to the right, the selection edge paints on the right, an action group at the end of a row sits at the left. Logical properties do that for free. Physical ones do not, which is why nothing in this file names `left` or `right` for placement.',
    '',
    '**What must NOT mirror:**',
    '',
    '- **A clock face, and anything reading as one.** Time runs the same way in every script.',
    '- **A media transport.** Play still points along the direction of playback, not the direction of the text.',
    '- **A chart\'s value axis.** A rising line still rises to the right. Mirroring it inverts the meaning.',
    '- **A logo, a photograph, a flag.**',
    '- **Code, a file path, a version, a hash.** These are left-to-right strings. Wrap them in `dir="ltr"` so a leading slash does not jump to the other end.',
    '',
    '**What DOES mirror:** an arrow that means *next* or *back*, a chevron that opens a drawer, a progress bar, an indent, a breadcrumb separator, and every icon whose meaning is directional rather than physical.',
    '',
    '### Numbers and mixed text',
    '',
    'Digits inside right-to-left text still run left to right, and the browser handles that. What it cannot guess is which way a mixed string should read overall, so a phone number, an ID or a measurement beside Arabic text needs its own `dir` or the bidi isolation the `bdi` element gives.',
    '',
    'The mono-face rule for figures is unchanged. The END edge is what an amount aligns to, and in this direction that edge is on the left.',
    '',
    '### What to check',
    '',
    'Mirror the page and read it. A layout built on logical properties needs no second stylesheet, so anything that did not move is a physical property somebody typed by hand. That is the whole test.',
  ].join('\n')
}

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
      /* Learned by building it here. Three settings blocks in this editor's own
         chrome appeared and vanished on a toggle, and the panel read as having
         jumped rather than as having revealed something. */
      'A settings block revealed by another setting **opens, it does not appear**. A block that pops moves everything under it with no warning, so the reader sees the panel jump instead of the block arrive. Animate `grid-template-rows` from `0fr` to `1fr` on a wrapper whose child has `overflow: hidden` — that transitions to the content\'s real height without measuring it, and it is one of the two properties safe to animate here because nothing around it reflows. Put the block\'s own separation INSIDE the collapsing box, so the distance closes with it rather than arriving underneath. Unmount the contents after the transition, or immediately when motion is reduced.',
      'Three cases are NOT this rule, and animating them is worse than the pop. A layout branch that fires on resize, because the window is already moving. A step inside a wizard or a modal, which is a cross-fade between two things rather than one thing opening. And a block that appears WHILE THE READER TYPES, where a transition on every keystroke turns a settled field into a moving one.',
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
      /* `disabled` versus `aria-disabled`. The rule above says a disabled
         control stays in the tab order "only if it explains why", and never
         said how — and `disabled` makes that impossible, because the control is
         gone. Found on a pager's Previous arrow: on page one it vanished from
         the tab order, so a keyboard reader could not learn which end they were
         at. */
      'Two ways to be unavailable, and they are not interchangeable. `disabled` removes the control from the tab order entirely, which is right for a form field nobody may edit yet. `aria-disabled="true"` keeps it reachable and announces the state, which is right for anything whose unavailability is itself information — a pager step at the first page, a Save with nothing to save. Give both the same appearance, or the second reads as a live control that does nothing.',
    ]),

    /* ── OVERLAYS, FIELDS AND WAITING ──
     *
     * Four situations every product has, and this file described none of them at
     * the level an agent could act on. It was measured: this system's own preview
     * surfaces carried eleven `aria-label`, three `aria-hidden` and one
     * `aria-invalid` between ten screens, and the surface whose whole job was to
     * demonstrate an overlay carried nothing at all. The rules were absent, so
     * there was nothing to break. */
    '**Overlays, fields and waiting**',
    bullets([
      'An **overlay** is not a card in a page. It carries `role="dialog"`, or `role="alertdialog"` where its message is the reason to stop and think. It carries `aria-modal="true"`, or assistive technology keeps reading the page underneath it. It takes its name from `aria-labelledby` pointing at its own heading rather than from a second copy of that heading in an `aria-label` — two statements of one name drift the moment either is edited. Where it also has a description worth reading unprompted, `aria-describedby` points at that.',
      'Focus enters the overlay when it opens, cannot leave while it is open, and returns to the control that opened it. An icon-only close button carries a name: a cross is not a word.',
      'An **invalid field** carries `aria-invalid="true"` AND `aria-describedby` pointing at its message. On its own, `aria-invalid` tells the reader that something is wrong and never what. Use `describedby`, never `labelledby`: the label names the field, and replacing it with the complaint loses which field it was. The message sits below the field, never in a tooltip, names the fix rather than the failure, and is marked by a glyph as well as a colour.',
      'A **pager** names its steps ("Previous page", not a bare chevron) and lives in a `nav` with a name, so it can be jumped to. Where a page changes without a page load, the range beside it — "Showing 21 to 40 of 128" — is a live region, or every row swaps in silence. A run of numbered page buttons is optional and often wrong: it grows with the data and cannot state its own width, so two steps and a count is the safer shape. If you do ship numbers, the current one carries `aria-current="page"`.',
      'A **loading state** holds the shape of what is coming, at the height it will occupy, so nothing moves when the data lands. It carries `role="status"` and `aria-busy="true"` and a name; the placeholder shapes themselves carry `aria-hidden="true"`, because read aloud they are noise. Derive every placeholder height from the type tokens of the line it stands in for, so the skeleton and the loaded row measure the same. Any shimmer animates opacity only and stops under `prefers-reduced-motion`. A spinner is the fallback for something whose shape cannot be known, not the default.',
      'Loading is the **fourth** empty state, beside first run, no results and a failure. A system that demonstrates three gets a centred spinner invented for the fourth.',
    ]),

    /* ── WHICH KEYS EACH CONTROL ANSWERS ──
     *
     * The section above named focus, targets, states, overlays, fields and
     * waiting, and never said which KEYS anything answers. A builder learned
     * that a switch needs a visible focus ring and nothing about Space. Every
     * open-spec system measured against this one publishes the contract.
     *
     * Ordered so the widgets come first. A component that answers no key is
     * still listed, because an absent entry reads as an oversight and a
     * stated `none` reads as a decision. */
    '**Keyboard**',
    'Two rules under all of it. A composite widget is ONE tab stop: Tab enters the group and lands on the active item, and the arrows move within it. Built with a tabindex on every item, a strip of six tabs costs six presses to walk past. And Space is not Enter: a button takes both, a checkbox and a switch take Space only, because Enter inside a form submits it.',
    table(
      ['Component', 'Pattern', 'Keys'],
      KEYBOARD_CONTRACTS.map(c => [
        `\`${c.component}\``,
        c.pattern,
        c.keys.length
          ? c.keys.map(k => `**${k.key}** ${k.does}`).join(' ')
          : 'Answers no key.',
      ])
    ),
    bullets(KEYBOARD_CONTRACTS.filter(c => c.note).map(c => `**\`${c.component}\`** ${c.note}`)),
    `Where you build one of these on a \`div\` instead of the native element, you owe every key in its row. ${INTERACTIVE_CONTRACTS.filter(c => c.requires.length).length} of the ${KEYBOARD_CONTRACTS.length} components have no native element that answers for them, and the checklist tests those by name.`,

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

  /* ── RTL, ONLY WHEN THE DOCUMENT ASKED FOR IT ──
   *
   * Every rule above is already written in logical terms, which costs a
   * left-to-right build nothing. This section is the RTL-SPECIFIC half: what
   * mirrors, what must not, and how bidirectional text behaves. It is noise
   * for a page that will never be Arabic, Persian, Urdu or Hebrew, and a
   * reader should not have to work out whether it applies to them. */
  if (state.meta?.rtl) parts.push(`## Right-to-left\n\n${fenceGenerated(rtlSection())}`)

  /* ── A MAP OF THIS FILE, MEASURED FROM THIS FILE ──
   *
   * The document reached 17,630 words, about 23,800 tokens, with ten sections
   * and no route through them. `AGENTS.md` states the order to read the FILES
   * and is the wrong place for this: it cannot know how long each section came
   * out, and restating its file order here would be one rule with two homes.
   *
   * The measurement is the point. One section is 59% of the document, and it is
   * a lookup table rather than prose — a reader who does not know that reads it
   * linearly, or gives up in it and never reaches Accessibility at the end. The
   * shares are computed from the assembled text, so they cannot drift from it.
   *
   * Placed after assembly and prepended, because a map written before the
   * sections exist is a claim about them. */
  const body = parts.join('\n\n')
  const measured = parts.map(p => {
    const heading = /^##\s+(.+)$/m.exec(p)?.[1] ?? '?'
    return { heading, words: p.split(/\s+/).filter(Boolean).length }
  })
  const total = measured.reduce((a, x) => a + x.words, 0)
  /* A section is a LOOKUP where it is mostly generated rows, and prose where a
     reader has to read it. The distinction is what makes the length safe. */
  const LOOKUP = new Set(['Components', 'Colors'])
  const map = [
    '## How to read this file',
    '',
    `About ${(Math.round(total / 100) * 100).toLocaleString('en-GB')} words. Two kinds of section, and they are read differently.`,
    '',
    '**Read in full.** These carry constraints that no token value states, and'
      + ' a build that skips them validates and still looks wrong.',
    '',
    ...measured.filter(m => !LOOKUP.has(m.heading))
      .map(m => `- **${m.heading}** — ${Math.round(m.words / total * 100)}%`),
    '',
    '**Look up as you build.** Generated tables, one row per token or component.'
      + ' Reading these end to end is not the intended use.',
    '',
    ...measured.filter(m => LOOKUP.has(m.heading))
      .map(m => `- **${m.heading}** — ${Math.round(m.words / total * 100)}%`),
    '',
    'Accessibility is last and is not optional. It carries the rules for overlays,'
      + ' invalid fields, pagers and loading states, which are the four situations'
      + ' most often invented rather than looked up.',
  ].join('\n')

  return { text: `${map}\n\n${body}`, omitted }
}
