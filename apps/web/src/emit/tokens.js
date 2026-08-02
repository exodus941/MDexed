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
import { gradientCss } from '../color/modes.js'
import { resolveRef } from '../color/ramp.js'
import { RAMP_STEPS } from '../color/ramp.js'

const stamp = name => `/* ${name} — generated from DESIGN.md. Edit the system, not this file. */`

/** Custom properties for one mode, resolved exactly as the preview does. */
const varsFor = (state, derived, mode) => buildCssVars({
  ...derived,
  elevationCfg: state.elevation,
  gradients: derived.gradients.map(g => ({
    ...g,
    css: gradientCss(g, { roles: derived.roles[mode], ramps: derived.ramps, resolveRef }),
  })),
}, mode)

/* ── tokens.css ───────────────────────────────────────────────────────────
   Both themes, switched by `data-theme` on the root, plus a
   `prefers-color-scheme` block so a page with no toggle still does the right
   thing. The media query comes first so an explicit data-theme always wins. */
export function tokensCss(state, derived) {
  const light = varsFor(state, derived, 'light')
  const dark = varsFor(state, derived, 'dark')
  const decl = vars => Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')

  return `${stamp('tokens.css')}

:root {
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

Generated by the design.md editor. Every file here derives from the same
source, so none of them can disagree with another.

| File | What it's for |
| --- | --- |
| \`DESIGN.md\` | The system in full — values *and* the reasoning. Give this to a coding agent. |
| \`tokens.css\` | Custom properties for both themes. Import once; use \`var(--c-accent)\`. |
| \`tailwind.config.js\` | A Tailwind preset. Merge it, don't replace your config. |
| \`tokens.json\` | W3C Design Tokens format, for Style Dictionary, Figma and similar. |
| \`html-examples/\` | Every preview surface as a standalone page. Open one and read the markup. |

## Using it with an agent

Put \`DESIGN.md\` at the root of the project. Most agents read it without being
asked; if not, point at it explicitly. The markdown carries the intent — why
the accent is reserved for one thing, what never to do — which the token files
cannot express.

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
