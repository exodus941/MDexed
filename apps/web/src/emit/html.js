/* A standalone HTML page of one preview surface.

   The audience is a developer who has the DESIGN.md but not this app: they get
   a page they can open, inspect and steal markup from, with the token values
   sitting in a `:root` block rather than baked into every rule. Nothing is
   fetched at runtime except the webfonts, and nothing about it depends on the
   editor still existing.

   Both palettes ship, switched by `data-theme` on the root element, because a
   reference that only proves the light theme is half a reference. */
import { PREVIEW_CSS, responsiveCss } from '../preview/tokens.js'
import { buildCssVars } from '../state/derive.js'
import { gradientCss } from '../color/modes.js'
import { resolveRef } from '../color/ramp.js'
import { fontsHref } from '../type/fonts.js'

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const slugify = s =>
  (String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design-system')

/** Custom properties for one mode, resolved the same way the preview does. */
const varsFor = (derived, state, mode) => buildCssVars({
  ...derived,
  elevationCfg: state.elevation,
  gradients: derived.gradients.map(g => ({
    ...g,
    css: gradientCss(g, { roles: derived.roles[mode], ramps: derived.ramps, resolveRef }),
  })),
}, mode)

const declarations = vars =>
  Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')

/* ── Fallbacks that belong to this system ──
 *
 * preview.css writes `var(--c-text-muted, #666)`. Inside the editor the
 * fallback never runs, because the variable is always set — so the value there
 * is arbitrary, and it is generic boilerplate from no palette in particular.
 *
 * In an exported file that stops being harmless. Anything that keeps the
 * stylesheet but loses the variables — a wrong path, a partial copy, an agent
 * lifting one rule out of context — renders the page in somebody else's
 * colours. Swapping each fallback for the value this system actually resolves
 * to means a failure degrades to the right brand instead of a stranger's.
 *
 * Only the literal after the first comma is replaced, so a nested
 * `var(--a, var(--b, #666))` keeps its structure and gets fixed at each level.
 */
const withRealFallbacks = (css, vars) =>
  css.replace(/var\(\s*(--[\w-]+)\s*,\s*([^,()]*?)\s*\)/g,
    (whole, name, fallback) => vars[name] != null ? `var(${name}, ${vars[name]})` : whole)

/**
 * @param markup  the surface, already rendered to static HTML
 * @param surface human-readable name of the surface, for the title
 */
export function previewHtml({ state, derived, markup, surface, mode }) {
  const name = state.meta?.name?.trim() || 'Design system'
  const light = varsFor(derived, state, 'light')
  const dark = varsFor(derived, state, 'dark')
  const href = fontsHref(state.type?.families)
  const other = mode === 'dark' ? 'light' : 'dark'

  return `<!doctype html>
<html lang="en" data-theme="${mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — ${esc(surface)}</title>
<!--
  ${esc(name)} — ${esc(surface)} surface.
  Generated from a DESIGN.md by the design.md editor. Self-contained: the only
  external request is the webfont stylesheet below.

  Every value lives in the custom properties in :root. Change one there and it
  moves everywhere it is used, exactly as it does in the real system — nothing
  in the rules below hard-codes a colour, size or radius.

  This page is showing the ${esc(mode)} theme. Set data-theme="${other}" on the
  <html> element to see the other one; both palettes are defined below.
-->
${href ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(href)}">` : ''}
<style>
/* ── Tokens: light ─────────────────────────────────────────────────────── */
:root {
${declarations(light)}
}

/* ── Tokens: dark ──────────────────────────────────────────────────────── */
:root[data-theme="dark"] {
${declarations(dark)}
}

/* ── Page chrome (not part of the design system) ───────────────────────── */
html, body { margin: 0; padding: 0; }
body { background: var(--c-bg, #fff); }
.dmd { min-height: 100vh; }
/* The editor makes every element clickable for inspection; here they are not. */
.dmd [data-cmp] { cursor: auto; }

/* ── The system ────────────────────────────────────────────────────────── */
${withRealFallbacks(PREVIEW_CSS.trim(), mode === 'dark' ? dark : light)}

/* ── Responsive ────────────────────────────────────────────────────────────
   Media queries here, container queries in the editor. Same breakpoints, same
   collapse widths, so this page still behaves like the thing you were looking
   at. The editor has to ask the container, because its preview is a pane
   inside a pane and a media query would report the browser width instead.

   This page has no such problem, and it is a style reference for an agent. The
   DESIGN.md beside it says to treat each breakpoint as a min-width, so shipping
   a container query here taught a technique the prose never mentions, and an
   agent copying it would carry it into an app that has no frame to measure.

   No backticks in this comment on purpose. It sits inside a template literal,
   so one would end the string here and leave the rest of the page parsing as
   expressions. That is the trap this project keeps hitting, and I hit it
   writing this very comment. */
${responsiveCss(state.layout?.breakpoints ?? [], 'media').trim()}
</style>
</head>
<body>
${markup}
</body>
</html>
`
}
