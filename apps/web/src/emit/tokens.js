/* The same system, in the three formats a build can actually enforce.
 *
 * DESIGN.md is advisory: an agent can ignore every word of it and nothing
 * catches the mistake. These are not. A stylesheet that imports `tokens.css`
 * and writes `var(--c-accent)` is correct by construction, and a Tailwind
 * preset makes `bg-accent` the path of least resistance. The prose stays for
 * the judgement calls; the values stop being a suggestion.
 *
 * All three derive from `derive()`, the same function the preview and the
 * markdown read, so none of them can disagree with the file or the screen.
 */
import { buildCssVars } from '../state/derive.js'
import { hasDark, hasLight, hasThemeToggle } from '../state/schema.js'
import { gradientCss } from '../color/modes.js'
import { resolveRef } from '../color/ramp.js'
import { RAMP_STEPS } from '../color/ramp.js'
import { fontsHref } from '../type/fonts.js'

const stamp = name => `/* ${name} — generated from DESIGN.md. Edit the system, not this file. */`

/** Custom properties for one mode, resolved exactly as the preview does. */
const varsFor = (state, derived, mode, opts) => buildCssVars({
  ...derived,
  elevationCfg: state.elevation,
  gradients: derived.gradients.map(g => ({
    ...g,
    css: gradientCss(g, { roles: derived.roles[mode], ramps: derived.ramps, resolveRef }),
  })),
}, mode, opts)

/* ── tokens.css ───────────────────────────────────────────────────────────
   Both themes, switched by `data-theme` on the root, plus a
   `prefers-color-scheme` block so a page with no toggle still does the right
   thing. The media query comes first so an explicit data-theme always wins. */
export function tokensCss(state, derived) {
  /* The light block carries the dark set under `--c-dark-*` as well, so a
     value can be named from a light context. See buildCssVars. */
  const light = varsFor(state, derived, 'light', { darkAliases: hasDark(state) })
  const dark = varsFor(state, derived, 'dark')
  const decl = vars => Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')

  /* Load the families this file names.
   *
   * Every `--font-*-family` here quoted a Google family, and nothing in the
   * package fetched one. A project that imported tokens.css and no more
   * rendered the whole system in `system-ui` — the fallback at the end of
   * every stack — and looked close enough that nobody checked. The sample
   * pages already carry a <link>; the stylesheet an actual build imports
   * did not. It does now. */
  const href = fontsHref(derived.families)
  const fontImport = href
    ? `/* The families named below, from Google Fonts. Self-host instead by
   replacing this line — the custom properties do not change either way. */
@import url('${href}');

`
    : ''

  /* ── THREE SHAPES, ONE PER THEME SETTING ──
   *
   * A site with one theme must not carry the other one's block. The old file
   * always wrote light on `:root` and appended dark, so "dark only" could not
   * be expressed at all: the page loaded light and switched on a media query
   * nobody asked for.
   *
   *   light   light on :root. Nothing else.
   *   dark    DARK on :root. Nothing else, so it cannot be switched away from.
   *   both    light on :root, dark under the OS query and under data-theme.
   */
  if (!hasDark(state)) {
    return `${stamp('tokens.css')}

${fontImport}/* This system ships a light theme and no other. There is no dark block and no
   toggle: adding either would invent values nobody chose. */
:root {
${decl(light)}
}
`
  }

  if (!hasLight(state)) {
    return `${stamp('tokens.css')}

${fontImport}/* This system ships a DARK theme and no other, so the dark values are the root
   values. There is no light block and no toggle, and no media query either —
   the page looks the same whatever the operating system prefers. */
:root {
${decl(dark)}
}
`
  }

  return `${stamp('tokens.css')}

${fontImport}:root {
${decl(light)}
}

/* Honours the OS setting when the page offers no toggle of its own. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${decl(dark).replace(/^ {2}/gm, '    ')}
  }
}

/* An explicit choice always wins over the OS preference. */
:root[data-theme="dark"] {
${decl(dark)}
}

/* ── THE SAME CHOICE, WITH NO JAVASCRIPT ──
 *
 * The attribute above needs a script to move it, and a theme control that
 * needs a script is a control that does nothing wherever scripts do not run:
 * a sandboxed preview, a strict content policy, a file opened from disk. A
 * reader then presses the lightbulb, sees no change, and reports it broken.
 * That happened on a real build.
 *
 * So the dark block answers to a checkbox as well. Put a hidden checkbox with
 * this id anywhere on the page and label it with your visible control:
 *
 *   <input type="checkbox" id="dmd-dark" hidden>
 *   <label for="dmd-dark" class="…">…lightbulb…</label>
 *
 * The control then works with no script at all. Add the script only for what
 * CSS cannot do: set the checkbox from the OS preference on load, persist the
 * reader's choice, and keep aria-pressed in step. Do NOT write data-theme into
 * your markup.
 *
 * THE TRADE, STATED. A page carrying this checkbox and no script opens LIGHT
 * on a dark system, because an unchecked box means light and CSS cannot ask
 * whether a reader has touched it. A page with the script opens on the system
 * preference. A control that always works is worth more than a default that
 * works only where scripts do, and both are right once the script loads. */
:root:has(#dmd-dark:checked) {
${decl(dark)}
}

/* And back to light, for a reader whose system is dark. */
@media (prefers-color-scheme: dark) {
  :root:has(#dmd-dark:not(:checked)):not([data-theme="dark"]) {
${decl(light).replace(/^ {2}/gm, '    ')}
  }
}
`
}

/* ── tailwind.config.js ───────────────────────────────────────────────────
   A preset rather than a full config, so it merges into whatever the project
   already has. Every value points at a custom property instead of inlining a
   hex, which means the dark theme works through the same class names —
   `bg-surface` is correct in both themes without a single `dark:` variant. */
export function tailwindPreset(state, derived) {
  const roles = Object.keys(derived.roles.light)
  const q = o => JSON.stringify(o, null, 6).replace(/\n/g, '\n  ')

  const colors = Object.fromEntries(roles.map(r => [r, `var(--c-${r})`]))
  for (const [name, ramp] of Object.entries(derived.ramps)) {
    for (const step of RAMP_STEPS) colors[`${name}-${step}`] = ramp.steps[step]
  }

  const spacing = Object.fromEntries(derived.spacing.map(s => [s.name, `var(--space-${s.name})`]))
  const radius = Object.fromEntries(derived.rounded.map(r => [r.name, `var(--radius-${r.name})`]))
  const shadow = Object.fromEntries(Object.entries(derived.elevation).map(([k]) => [k, `var(--shadow-${k})`]))
  const fontSize = Object.fromEntries(derived.typography.map(t => [t.name, `var(--font-${t.name}-size)`]))
  const fontFamily = Object.fromEntries(
    Object.entries(derived.families).map(([k, v]) => [k, v.stack.split(',').map(s => s.trim().replace(/^'|'$/g, ''))])
  )
  const duration = Object.fromEntries(Object.entries(derived.motion.durations).map(([k, v]) => [k, v]))
  const screens = Object.fromEntries((state.layout?.breakpoints ?? []).map(b => [b.name, `${b.px}px`]))

  return `${stamp('tailwind.config.js')}
/* A preset — merge it, don't replace your config:
 *
 *   // tailwind.config.js
 *   import designSystem from './tailwind.config.js'
 *   export default { presets: [designSystem], content: ['./src/**' + '/*.{js,ts,jsx,tsx}'] }
 *
 * Import tokens.css once, at the top of your stylesheet. The semantic colours
 * below resolve through custom properties, so \`bg-surface\` is right in both
 * light and dark without a single \`dark:\` variant.
 */
export default {
  theme: {
    extend: {
      colors: ${q(colors)},
      spacing: ${q(spacing)},
      borderRadius: ${q(radius)},
      boxShadow: ${q(shadow)},
      fontSize: ${q(fontSize)},
      fontFamily: ${q(fontFamily)},
      transitionDuration: ${q(duration)},
      screens: ${q(screens)},
    },
  },
}
`
}

/* ── tailwind.css (v4) ────────────────────────────────────────────────────
   Tailwind 4 moved configuration out of JavaScript and into CSS. A project on
   v4 has no `tailwind.config.js` to merge a preset into, so the v3 file above
   is the wrong artefact for it entirely, not merely an old one. Both ship,
   because both versions are in use.

   `@theme` declares the tokens *and* generates the utilities, so one block
   gets `bg-surface`, `text-accent`, `rounded-lg` and the rest. Values point
   at the custom properties from tokens.css rather than at hex, which is what
   keeps a single class correct in both themes. */
export function tailwindV4Css(state, derived) {
  const line = (k, v) => `  ${k}: ${v};`
  const out = []

  for (const role of Object.keys(derived.roles.light)) out.push(line(`--color-${role}`, `var(--c-${role})`))
  for (const [name, ramp] of Object.entries(derived.ramps)) {
    for (const step of RAMP_STEPS) out.push(line(`--color-${name}-${step}`, ramp.steps[step]))
  }
  out.push('')
  for (const s of derived.spacing) out.push(line(`--spacing-${s.name}`, `var(--space-${s.name})`))
  out.push('')
  for (const r of derived.rounded) out.push(line(`--radius-${r.name}`, `var(--radius-${r.name})`))
  out.push('')
  for (const k of Object.keys(derived.elevation)) {
    if (derived.elevation[k] !== 'none') out.push(line(`--shadow-${k}`, `var(--shadow-${k})`))
  }
  out.push('')
  for (const t of derived.typography) out.push(line(`--text-${t.name}`, `var(--font-${t.name}-size)`))
  out.push('')
  for (const [k, v] of Object.entries(derived.families)) out.push(line(`--font-${k}`, v.stack))
  out.push('')
  for (const [k, v] of Object.entries(derived.motion.durations)) out.push(line(`--animate-duration-${k}`, v))
  out.push('')
  for (const b of state.layout?.breakpoints ?? []) out.push(line(`--breakpoint-${b.name}`, `${b.px}px`))

  return `${stamp('tailwind.css')}
/* Tailwind v4. Import it once, after tokens.css:
 *
 *   @import "tailwindcss";
 *   @import "./tokens.css";
 *   @import "./tailwind.css";
 *
 * On Tailwind v3 use tailwind.config.js instead; this file does nothing there.
 */

@theme {
${out.join('\n')}
}
`
}

/* ── tokens.ts ────────────────────────────────────────────────────────────
   For the code that is not a stylesheet: styled-components, emotion,
   vanilla-extract, React Native, a chart library that wants a colour, a build
   script that wants the breakpoints.

   Literal hex rather than `var(--c-*)`, because none of those consumers can
   resolve a custom property. That means the two themes have to be separate
   objects here, which is also what makes `theme(mode).surface` read the way
   it does.

   `as const` throughout is the point of shipping TypeScript at all: role
   names autocomplete, and a typo is a compile error rather than a silently
   undefined colour. */
export function tokensTs(state, derived) {
  const obj = (o, indent = 2) => {
    const pad = ' '.repeat(indent)
    const body = Object.entries(o)
      .map(([k, v]) => `${pad}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${
        typeof v === 'object' && v !== null ? `{\n${obj(v, indent + 2)}\n${pad}}` : JSON.stringify(v)
      },`)
      .join('\n')
    return body
  }
  const block = (name, o, doc) =>
    `${doc}\nexport const ${name} = {\n${obj(o)}\n} as const\n`

  const scale = Object.fromEntries(
    Object.entries(derived.ramps).map(([n, r]) => [n, Object.fromEntries(RAMP_STEPS.map(s => [s, r.steps[s]]))])
  )
  const type = Object.fromEntries(derived.typography.map(t => [t.name, {
    fontFamily: derived.families[t.family]?.stack ?? '',
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
  }]))

  return `${stamp('tokens.ts')}
/* Values, not custom properties: this file is for consumers that cannot
 * resolve \`var()\` — CSS-in-JS, React Native, charts, build scripts. If you
 * are writing a stylesheet, use tokens.css instead, because that one follows
 * the theme without a re-render.
 */

${block('color', { light: derived.roles.light, dark: derived.roles.dark },
    '/** Semantic roles, per theme. */')}
${block('scale', scale, '/** The raw ramps, when a role does not exist for what you need. */')}
${block('spacing', Object.fromEntries(derived.spacing.map(s => [s.name, s.value])), '/** Spacing scale. */')}
${block('radius', Object.fromEntries(derived.rounded.map(r => [r.name, r.value])), '/** Corner radii. */')}
${block('typography', type, '/** Text styles, ready to spread into a style object. */')}
${block('shadow', Object.fromEntries(Object.entries(derived.elevation).filter(([, v]) => v !== 'none')), '/** Elevation. */')}
${block('duration', derived.motion.durations, '/** Motion durations. */')}
${block('easing', derived.motion.easings, '/** Motion curves. */')}
${block('breakpoint', Object.fromEntries((state.layout?.breakpoints ?? []).map(b => [b.name, `${b.px}px`])), '/** Breakpoints, in px. */')}
/** \`light\` or \`dark\`. */
export type Mode = keyof typeof color

/** Every semantic role name. A typo here is a compile error. */
export type ColorRole = keyof typeof color.light

/** Roles for one theme: \`theme('dark').surface\`. */
export const theme = (mode: Mode) => color[mode]

export default { color, scale, spacing, radius, typography, shadow, duration, easing, breakpoint, theme }
`
}

/* ── _tokens.scss ─────────────────────────────────────────────────────────
   Sass is still what a great many existing codebases are built in, and none
   of them can use a Tailwind preset or a TypeScript module.

   Variables point at the custom properties rather than at hex, so the theme
   still switches at runtime; Sass resolves at build time and would otherwise
   freeze whichever theme was compiled. The maps exist for the thing Sass is
   actually better at than CSS, which is generating a rule per token in a
   loop. */
export function tokensScss(state, derived) {
  const v = (name, value) => `$${name}: ${value};`
  const map = (name, entries) =>
    `$${name}: (\n${entries.map(([k, val]) => `  "${k}": ${val},`).join('\n')}\n);`

  const roles = Object.keys(derived.roles.light)

  return `${stamp('_tokens.scss')}
//
//   @use "tokens" as t;
//   .card { background: t.$c-surface; padding: t.$space-md; }
//
// Import tokens.css once as well. These variables resolve to custom
// properties, so the theme switches at runtime — a Sass variable holding a
// hex would freeze whichever theme happened to compile.

@use "sass:map";

// ── Colour roles ──
${roles.map(r => v(`c-${r}`, `var(--c-${r})`)).join('\n')}

// ── Spacing ──
${derived.spacing.map(s => v(`space-${s.name}`, `var(--space-${s.name})`)).join('\n')}

// ── Radius ──
${derived.rounded.map(r => v(`radius-${r.name}`, `var(--radius-${r.name})`)).join('\n')}

// ── Type ──
${derived.typography.map(t => v(`text-${t.name}`, `var(--font-${t.name}-size)`)).join('\n')}
${Object.entries(derived.families).map(([k, f]) => v(`font-${k}`, f.stack)).join('\n')}

// ── Elevation ──
${Object.entries(derived.elevation).filter(([, val]) => val !== 'none').map(([k]) => v(`shadow-${k}`, `var(--shadow-${k})`)).join('\n')}

// ── Motion ──
${Object.entries(derived.motion.durations).map(([k, val]) => v(`duration-${k}`, val)).join('\n')}
${Object.entries(derived.motion.easings).map(([k, val]) => v(`ease-${k}`, val)).join('\n')}

// ── Breakpoints ──
${(state.layout?.breakpoints ?? []).map(b => v(`bp-${b.name}`, `${b.px}px`)).join('\n')}

// ── Maps, for iterating ──
${map('colors', roles.map(r => [r, `var(--c-${r})`]))}

${map('spacings', derived.spacing.map(s => [s.name, `var(--space-${s.name})`]))}

${map('radii', derived.rounded.map(r => [r.name, `var(--radius-${r.name})`]))}

${map('breakpoints', (state.layout?.breakpoints ?? []).map(b => [b.name, `${b.px}px`]))}

// Mobile-first media query: \`@include t.above("md") { ... }\`
// \`map.get\` rather than the global \`map-get\`, which Dart Sass has deprecated
// and will remove.
@mixin above($name) {
  $width: map.get($breakpoints, $name);
  @if $width == null { @error "Unknown breakpoint: #{$name}"; }
  @media (min-width: #{$width}) { @content; }
}
`
}

/* ── tokens.json ──────────────────────────────────────────────────────────
   W3C Design Tokens Community Group format, which Style Dictionary, Figma
   and most token pipelines already read. Both themes are present as separate
   groups because the format has no first-class notion of a mode. */
export function tokensJson(state, derived) {
  const colour = mode => Object.fromEntries(
    Object.entries(derived.roles[mode]).map(([k, v]) => [k, { $type: 'color', $value: v }])
  )
  const scales = Object.fromEntries(
    Object.entries(derived.ramps).map(([name, ramp]) => [
      name,
      Object.fromEntries(RAMP_STEPS.map(s => [String(s), { $type: 'color', $value: ramp.steps[s] }])),
    ])
  )

  return JSON.stringify({
    $description: `${state.meta?.name ?? 'Design system'} — generated from DESIGN.md`,
    color: { light: colour('light'), dark: colour('dark'), scale: scales },
    dimension: {
      spacing: Object.fromEntries(derived.spacing.map(s => [s.name, { $type: 'dimension', $value: s.value }])),
      radius: Object.fromEntries(derived.rounded.map(r => [r.name, { $type: 'dimension', $value: r.value }])),
    },
    typography: Object.fromEntries(derived.typography.map(t => [t.name, {
      $type: 'typography',
      $value: {
        fontFamily: derived.families[t.family]?.stack,
        fontSize: t.fontSize,
        fontWeight: Number(t.fontWeight) || t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      },
    }])),
    shadow: Object.fromEntries(Object.entries(derived.elevation)
      .filter(([, v]) => v !== 'none')
      .map(([k, v]) => [k, { $type: 'shadow', $value: v }])),
    duration: Object.fromEntries(Object.entries(derived.motion.durations)
      .map(([k, v]) => [k, { $type: 'duration', $value: v }])),
  }, null, 2) + '\n'
}

/** What the developer should read first. */
export function packageReadme(state) {
  const name = state.meta?.name?.trim() || 'Design system'
  return `# ${name}

> **Coding agents: read \`AGENTS.md\` first.** It is the contract for this
> package. \`CLAUDE.md\` is the same file under the name Claude Code opens on
> its own. This README is for people choosing which files to keep.

Generated by the design.md editor. Every file here derives from one source.
Where two of them still seem to disagree, \`AGENTS.md\` publishes the order that
decides it.

You will not need all of these. Take \`tokens.css\` plus whichever one matches
your stack, and ignore the rest.

| File | What it's for |
| --- | --- |
| \`AGENTS.md\` | The rules for using this package. Written for agents, short enough to read. |
| \`CLAUDE.md\` | Identical to \`AGENTS.md\`. Claude Code reads this name without being asked. |
| \`DESIGN.md\` | The system in full — values *and* the reasoning. Give this to a coding agent. |
| \`tokens.css\` | Custom properties for both themes. Start here whatever else you use. |
| \`tokens.ts\` | Literal values for CSS-in-JS, React Native, charts, scripts. Typed, so role names autocomplete. |
| \`tailwind.css\` | Tailwind **v4**. An \`@theme\` block; import it after \`tokens.css\`. |
| \`tailwind.config.js\` | Tailwind **v3**. A preset — merge it, don't replace your config. |
| \`_tokens.scss\` | Sass variables, maps and a breakpoint mixin. |
| \`tokens.json\` | W3C Design Tokens format, for Style Dictionary, Figma and similar. |
| \`EXAMPLE-<theme>-<surface>.html\` | Every surface as a standalone page, in the package root. Both themes when the system ships both, named in the file. The markup is identical between them — the theme is a variable swap and nothing else. |

Both Tailwind files are present because v3 and v4 configure themselves in
different places and neither can read the other's. Use the one matching your
version; the other does nothing.

\`tokens.ts\` holds hex rather than \`var()\`, because none of its consumers can
resolve a custom property — which is why it has a separate object per theme.
Everything else points at \`tokens.css\`, so the theme switches at runtime.

## Using it with an agent

Hand over the whole folder and say "here's your design reference". \`AGENTS.md\`
carries the rules, so you should not have to explain the package itself. That
leaves you free to describe what you want built.

If you prefer to hand over a single file, use \`DESIGN.md\`. It carries the
intent — why the accent is reserved for one thing, what never to do — which the
token files cannot express. You then lose the usage rules, so say more.

## Using it by hand

\`\`\`css
@import './tokens.css';

.card {
  background: var(--c-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: var(--shadow-raised);
}
\`\`\`

Dark mode needs no second set of rules: set \`data-theme="dark"\` on the root
element and every property above resolves to its dark value. With no attribute
set, the OS preference decides.

## Regenerating

Change the system in the editor and export again. Nothing here should be
edited by hand — the next export would overwrite it, and the file would then
disagree with the \`DESIGN.md\` beside it.
`
}
