#!/usr/bin/env node
/* ── The pixel-grid guard ──

   Fails when the system emits a pixel value nobody can hold in their head.
   Two grids, because two different things are being measured:

   SPACE  — gaps, padding, sizes, radii. Multiples of 4; multiples of 2 below
            8px; 1, 2 and 3 exempt, because a hairline is ink and not space.
   TYPE   — font sizes, and the icon scale, because an icon beside a label
            takes the label's size and so lands on the same steps. Whole even
            numbers. The 4px grid cannot serve type: 12, 16, 20 leaves no room
            for the 14px nearly every interface wants for secondary text.

   The rule lives in apps/web/src/state/grid.js and is IMPORTED here rather
   than restated. A guard that reimplements the thing it guards passes on logic
   the app does not run.

   Exempt by nature, and each says why:
   - a `clamp()` slope, which is the line joining two grid endpoints
   - a breakpoint or container width, which answers to a device and not a grid
   - a shadow offset or blur, which is light and not layout
   - a `line-height` stated in px, which is the line-box technique: on a
     fixed-height control the leading IS the content box, so it is the stated
     height minus the borders. A 40px control with a 1px edge each side gives
     38, and forcing that to 40 would break the centring it exists to do. */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../apps/web/', import.meta.url))
const { isOnSpaceGrid, isOnTypeGrid } = await import(new URL('../apps/web/src/state/grid.js', import.meta.url))
const { createInitialState } = await import(new URL('../apps/web/src/state/schema.js', import.meta.url))
const { derive } = await import(new URL('../apps/web/src/state/derive.js', import.meta.url))

const d = derive(createInitialState())
const derivedVars = d.cssVars

const TYPE_PROP = /font-size|--font-[\w-]*-size|icon-size|--icon-(sm|md|lg|xl)\b|letter-spacing/
const TYPE_SELECTOR = /\.icon\b|\bsvg\b/
const EXEMPT_PROP = /shadow|breakpoint|container|--layout-|blur|translate|outline-offset|scroll|line-height|--field-line/

const findings = []

const stale = []

const scanValue = (file, where, prop, raw, selector = '') => {
  if (EXEMPT_PROP.test(prop)) return
  if (/clamp\(/.test(raw)) return              // the slope term is a line, not a step

  /* A fallback answers to the TOKEN it stands in for, never to the property it
     sits in. `margin-top: calc(var(--font-body-sm-size, 14px) * 1.55)` holds a
     type value inside a space property, and judging it by `margin-top` reports
     a fault that is not there. Pull the fallbacks out first, judge each by its
     own token name, then check what is left. */
  raw = raw.replace(/var\(\s*(--[\w-]+)\s*,\s*([^),]+?)\s*\)/g, (whole, token, fb) => {
    if (/px/.test(fb)) {
      scanValue(file, where, token, fb, selector)
      /* A fallback is what PAINTS when the token is missing, so one that has
         drifted from the token's real value ships a number nobody chose. */
      const real = derivedVars?.[token]
      if (real && real !== fb.trim()) stale.push({ file, where, token, fb: fb.trim(), real })
    }
    return ' '
  })

  for (const m of raw.matchAll(/(-?[\d.]+)px/g)) {
    const n = Math.abs(Number(m[1]))
    /* A pill radius is not a length. It is "bigger than any corner", and the
       usual spellings of that are 999 and 9999. */
    if (n === 0 || n === 999 || n === 9999) continue
    const typed = TYPE_PROP.test(prop) || (TYPE_SELECTOR.test(selector) && /^(width|height|min-|max-)/.test(prop))
    const ok = typed ? isOnTypeGrid(n) : isOnSpaceGrid(n)
    if (!ok) findings.push({ file, where, prop, value: m[0], grid: typed ? 'type' : 'space' })
  }
}

/* ── The stylesheets ── */
const sheets = []
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p); continue }
    if (e.endsWith('.css')) sheets.push(p)
  }
}
walk(join(ROOT, 'src'))

for (const path of sheets) {
  const text = readFileSync(path, 'utf8')
  const rel = relative(ROOT, path).replace(/\\/g, '/')
  /* Blank comments, never delete them: deleting takes the newlines too and
     every line number below shifts. A measurement quoted in a comment is
     prose, and prose is not a declaration. */
  let clean = ''
  let inBlock = false
  for (let c = 0; c < text.length; c++) {
    if (!inBlock && text[c] === '/' && text[c + 1] === '*') { inBlock = true; clean += ' '; c++; continue }
    if (inBlock && text[c] === '*' && text[c + 1] === '/') { inBlock = false; clean += ' '; c++; continue }
    clean += inBlock ? (text[c] === '\n' ? '\n' : ' ') : text[c]
  }

  /* An at-rule is a QUERY, not a declaration. A breakpoint answers to a device
     and a sentinel answers to the substitution step; neither is on a grid. */
  clean = clean.replace(/@(media|supports|container)[^{]*/g, m => ' '.repeat(m.length))

  /* Read the DECLARATION, never the raw text. The property decides which grid
     applies, so a 14px that is a font size passes where a 14px gap would not.
     Requiring `{` or `;` before the name is what keeps a `::-webkit` pseudo
     element from being read as a property called `-webkit-slider-thumb`. */
  const lineAt = (idx) => clean.slice(0, idx).split('\n').length
  for (const m of clean.matchAll(/(^|[{;])\s*(--[\w-]+|[a-z][a-z-]*)\s*:\s*([^;{}]+)/g)) {
    if (!m[3].includes('px')) continue
    /* The SELECTOR decides which grid a bare `width` answers to. An icon's box
       is sized to the label beside it, so it lands on the type steps; a slider
       thumb is a control and lands on the space grid. The property name alone
       cannot tell those apart. */
    const open = clean.lastIndexOf('{', m.index)
    const prevEnd = Math.max(clean.lastIndexOf('}', open), clean.lastIndexOf('{', open - 1))
    const selector = open < 0 ? '' : clean.slice(prevEnd + 1, open).trim()
    scanValue(rel, `line ${lineAt(m.index)}`, m[2], m[3], selector)
  }
}

/* ── Inline style objects ──
   A stylesheet is not the whole surface. React takes a bare number in a style
   object as pixels, so `gap: 7` is a 7px gap that no CSS file mentions and no
   CSS scan can see. Checking only the stylesheets reported this codebase clean
   while dozens of them sat in the components — a guard that passes because it
   was not looking is worse than no guard, because it is believed.

   Only LENGTH properties are read. `flexShrink: 0`, `opacity`, `zIndex` and a
   unitless `lineHeight` are numbers that are not pixels, and treating them as
   lengths is how a check starts firing on correct code. */
const LENGTH_PROPS = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'paddingBlock', 'paddingInline', 'margin', 'marginTop', 'marginRight',
  'marginBottom', 'marginLeft', 'gap', 'rowGap', 'columnGap', 'fontSize',
  'borderRadius', 'borderWidth', 'top', 'right', 'bottom', 'left', 'inset',
  'flexBasis',
])
/* `strokeWidth` is deliberately absent. An icon's stroke is a WEIGHT, chosen
   against the type it sits beside, and 1.75 is a legitimate answer. Judging it
   against a layout grid faults a design decision. */
const kebab = (s) => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())

const jsxFiles = []
const walkJs = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walkJs(p); continue }
    if (/\.(jsx|js)$/.test(e)) jsxFiles.push(p)
  }
}
walkJs(join(ROOT, 'src'))

for (const path of jsxFiles) {
  const raw = readFileSync(path, 'utf8')
  const rel = relative(ROOT, path).replace(/\\/g, '/')
  /* Blank the comments here too. A comment explaining `max-height: 86vh` is
     prose about a value, not the value — and the CSS side of this guard
     already learned that lesson. Blank, never delete, so line numbers hold. */
  let text = ''
  let block = false, lineC = false
  for (let c = 0; c < raw.length; c++) {
    const two = raw[c] + raw[c + 1]
    if (!block && !lineC && two === '/*') { block = true; text += '  '; c++; continue }
    if (block && two === '*/') { block = false; text += '  '; c++; continue }
    if (!block && !lineC && two === '//') { lineC = true; text += '  '; c++; continue }
    if (lineC && raw[c] === '\n') lineC = false
    text += (block || lineC) ? (raw[c] === '\n' ? '\n' : ' ') : raw[c]
  }
  const lineAt = (idx) => text.slice(0, idx).split('\n').length
  /* `prop: 8` or `prop: '4px 10px'` — a style-object entry either way. The
     property name is what says whether the number is a length at all.
     The lookbehind is what stops `max-width` in a media-query string being
     read as a `width` declaration: a breakpoint answers to a device, and
     three of them were reported as off-grid layout. */
  for (const m of text.matchAll(/(?<![-\w])([a-z][A-Za-z]*)\s*:\s*([^,}\n]+)/g)) {
    const prop = m[1]
    if (!LENGTH_PROPS.has(prop)) continue
    /* Read EVERY branch of a ternary. `columnGap: isMobile ? 8 : 13` ships a
       13px gap on every desktop, and a scanner that only accepts a literal
       straight after the colon sees no value at all and reports the file
       clean. A conditional value is still a value. */
    for (const lit of m[2].matchAll(/(?:^|[?:\s(])(\d+(?:\.\d+)?)(?=\s*[:)\s]|$)|'([^']*)'|"([^"]*)"/g)) {
      const rawVal = lit[1] ?? lit[2] ?? lit[3]
      if (rawVal == null) continue
      const val = lit[1] != null ? `${rawVal}px` : rawVal
      if (!/px|^\d/.test(val) || /var\(|%|em|rem|vh|vw|calc|auto|\bfr\b/.test(val)) continue
      scanValue(rel, `line ${lineAt(m.index)}`, kebab(prop), /px/.test(val) ? val : `${val}px`)
    }
  }

  /* An SVG sizes itself by ATTRIBUTE, not by style: `<svg width={13} …>`. That
     is still a painted 13px box, and it hid a whole class of them — every icon
     in the chrome — from a scan that only read style objects. An icon takes the
     type grid, because it is sized to the label beside it. */
  for (const m of text.matchAll(/<svg\b[^>]*?\bwidth=\{?(\d+(?:\.\d+)?)\}?[^>]*?\bheight=\{?(\d+(?:\.\d+)?)\}?/g)) {
    scanValue(rel, `line ${lineAt(m.index)}`, 'icon-size', `${m[1]}px ${m[2]}px`)
  }
}

/* ── The derived token set ── */
for (const s of d.spacing) scanValue('derived', 'spacing', `--space-${s.name}`, s.value)
for (const r of d.rounded) scanValue('derived', 'radius', `--radius-${r.name}`, r.value)
for (const [k, v] of Object.entries(d.cssVars)) if (typeof v === 'string') scanValue('derived', 'cssVar', k, v)

/* Every density and roundness the macro sliders can reach. A value legal at
   1.0 and fractional at 0.93 is still a fractional value the app can ship. */
for (let macro = 0.5; macro <= 1.5; macro = Math.round((macro + 0.01) * 100) / 100) {
  const st = createInitialState()
  st.macros = { ...st.macros, density: macro, roundness: macro, scale: macro }
  const dd = derive(st)
  for (const s of dd.spacing) scanValue('derived', `density ${macro}`, `--space-${s.name}`, s.value)
  for (const r of dd.rounded) scanValue('derived', `roundness ${macro}`, `--radius-${r.name}`, r.value)
  for (const t of dd.typography) scanValue('derived', `scale ${macro}`, `--font-${t.name}-size`, t.fontSize)
}

const staleSeen = new Set()
const staleUnique = stale.filter(s => {
  const k = `${s.file}|${s.token}|${s.fb}`
  if (staleSeen.has(k)) return false
  staleSeen.add(k)
  return true
})

if (findings.length === 0 && staleUnique.length === 0) {
  console.log(`grid guard: ${sheets.length} stylesheets and every macro position clean`)
  process.exit(0)
}

if (findings.length) {
  console.log(`grid guard: ${findings.length} off-grid values\n`)
  /* Key on the LOCATION, never on the value. Deduplicating by value hides
     every other instance of the same mistake, and a reader then fixes the one
     line they were shown and calls the class done. */
  const seen = new Set()
  for (const f of findings) {
    const key = `${f.file}|${f.where}|${f.prop}|${f.value}`
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`  ${f.file}  ${f.where}  ${f.prop}: ${f.value}   (${f.grid} grid)`)
  }
}

if (staleUnique.length) {
  console.log(`\ngrid guard: ${staleUnique.length} stale fallbacks — each paints a value nobody chose\n`)
  for (const s of staleUnique) {
    console.log(`  ${s.file}  ${s.where}  var(${s.token}, ${s.fb})   token now ships ${s.real}`)
  }
}
process.exit(1)
