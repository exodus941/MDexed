#!/usr/bin/env node
/* One-shot codemod: snap every inline style length in the JSX onto the grid.

   It imports the SAME snapSpace/snapType the app and the guard use, so the
   three cannot disagree. Nearest-step snapping is deliberate: it keeps the
   design where the designer put it and only makes the number memorable. It is
   not a redesign, and a value already on the grid is left byte-identical.

   Run with --write to apply; without it, prints what it would change. */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../apps/web/', import.meta.url))
const { snapSpace, snapType } = await import(new URL('../apps/web/src/state/grid.js', import.meta.url))

const WRITE = process.argv.includes('--write')

const LENGTH_PROPS = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'paddingBlock', 'paddingInline', 'margin', 'marginTop', 'marginRight',
  'marginBottom', 'marginLeft', 'gap', 'rowGap', 'columnGap', 'fontSize',
  'borderRadius', 'borderWidth', 'top', 'right', 'bottom', 'left', 'inset',
  'flexBasis', 'strokeWidth',
])
const TYPE_PROPS = new Set(['fontSize'])

const files = []
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p); continue }
    if (/\.(jsx|js)$/.test(e)) files.push(p)
  }
}
walk(join(ROOT, 'src'))

/* Only inside a STYLE region. `prop: number` is a shape that appears all over
   a codebase and means something different nearly everywhere: `strokeWidth:
   1.75` is a design choice about icon weight, `999901px` is a substitution
   sentinel that breaks if it moves, and `{ top: 0, bottom: innerHeight }` is a
   viewport rectangle. Snapping any of those is a bigger bug than an off-grid
   pixel. So the codemod finds `style={{ … }}` and `style: { … }` by matching
   their braces, and touches nothing outside them. */
function styleRegions (text) {
  const out = []
  for (const m of text.matchAll(/style\s*(?:=\s*\{\{|:\s*\{)/g)) {
    const openCount = m[0].endsWith('{{') ? 2 : 1
    let i = m.index + m[0].length
    let depth = openCount
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      else if (text[i] === "'" || text[i] === '"' || text[i] === '`') {
        const q = text[i++]
        while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++ }
      }
      i++
    }
    out.push([m.index + m[0].length, i - openCount])
  }
  return out
}

let changed = 0, touched = 0
for (const path of files) {
  const before = readFileSync(path, 'utf8')
  let hits = 0

  const regions = styleRegions(before)
  const inStyle = (idx) => regions.some(([a, b]) => idx >= a && idx < b)

  const after = before.replace(
    /\b([a-z][A-Za-z]*)(\s*:\s*)(\d+(?:\.\d+)?|'[^']*'|"[^"]*")/g,
    (whole, prop, sep, rawVal, offset) => {
      if (!LENGTH_PROPS.has(prop)) return whole
      if (!inStyle(offset)) return whole
      const snap = TYPE_PROPS.has(prop) ? snapType : snapSpace

      /* A bare number is pixels to React. Snap it and put it back bare, so the
         file keeps the style it was written in. */
      if (/^\d/.test(rawVal)) {
        const n = Number(rawVal)
        const s = snap(n)
        if (s === n) return whole
        hits++
        return `${prop}${sep}${s}`
      }

      /* A string may hold several lengths — `'4px 10px'`. Anything that is not
         a plain px length is left exactly as it was: a var(), a percentage, a
         calc() and a keyword all mean something the grid has no opinion on. */
      const quote = rawVal[0]
      const body = rawVal.slice(1, -1)
      if (!/\d+(\.\d+)?px/.test(body)) return whole
      if (/var\(|calc\(|%|\bem\b|\brem\b|\bvh\b|\bvw\b/.test(body)) return whole
      const next = body.replace(/(\d+(?:\.\d+)?)px/g, (m2, num) => {
        const n = Number(num)
        const s = snap(n)
        if (s !== n) hits++
        return `${s}px`
      })
      if (next === body) return whole
      return `${prop}${sep}${quote}${next}${quote}`
    })

  /* ── A CONDITIONAL VALUE IS STILL A VALUE, AND THE MATCHER ABOVE IS BLIND ──
   *
   * It requires the value to start with a digit or a quote. A ternary starts
   * with an identifier, so `columnGap: dense ? 4 : 13` matches nothing and the
   * whole declaration is skipped. It ships on whichever branch the reader is
   * on. This was recorded as the third blind spot of this matcher and the
   * matcher was never widened. Proven today: a literal fires, a px string
   * fires, and a ternary exits zero.
   *
   * REPORTED, NEVER REWRITTEN. Snapping one branch of a conditional edits a
   * decision rather than a length, and a codemod that rewrites control flow is
   * a bigger bug than an off-grid pixel. So `--write` leaves these alone and
   * `--check` counts them.
   */
  let conditional = 0
  for (const [a, b] of regions) {
    const chunk = before.slice(a, b)
    for (const m of chunk.matchAll(/\b([a-z][A-Za-z]*)\s*:\s*([^,}]+)/g)) {
      if (!LENGTH_PROPS.has(m[1])) continue
      const v = m[2].trim()
      /* The simple shapes are the first pass's business. */
      if (/^\d/.test(v) || /^['"]/.test(v)) continue
      if (!v.includes('?')) continue
      const snap = TYPE_PROPS.has(m[1]) ? snapType : snapSpace
      const nums = [...v.matchAll(/(?:^|[\s?:(])(\d+(?:\.\d+)?)(?:px)?(?=[\s:,)]|$)/g)].map(x => Number(x[1]))
      const off = nums.filter(n => snap(n) !== n)
      if (!off.length) continue
      conditional++
      console.log(`  ${relative(ROOT, path).replace(/\\/g, '/')}  ${m[1]}: ${v.slice(0, 44)}   off-grid ${off.join(', ')}   CONDITIONAL, not rewritten`)
    }
  }

  if (hits) {
    changed += hits
    touched++
    console.log(`  ${relative(ROOT, path).replace(/\\/g, '/')}  ${hits}`)
    if (WRITE) writeFileSync(path, after)
  }
  if (conditional) { changed += conditional; if (!hits) touched++ }
}

console.log(`\n${changed} values across ${touched} files${WRITE ? ' — written' : ' — dry run, pass --write to apply'}`)

/* ── A ONE-SHOT CODEMOD GUARDS NOTHING, AND THIS ONE WAS THE ONLY INSTRUMENT ──
 *
 * A stylesheet is not the whole surface: React reads a bare number in a style
 * object as pixels, so `gap: 7` is a 7px gap no CSS file mentions. The CSS
 * guards never saw those, and this file was run once and then forgotten. 650
 * off-grid values had already shipped that way.
 *
 * Measured today, months later: one more had arrived. A sparkline typed 88 by
 * 22 in the markup, where the 22 was a line box rounded to a whole pixel.
 *
 * So `--check` exits non-zero and the pre-commit hook runs it. A guard that
 * always exits zero reports to nobody: the hook reads the code, and a report
 * on stdout that nothing acts on is the same as silence.
 */
if (process.argv.includes('--check') && changed) {
  console.error('\ngrid guard: ' + changed + ' inline style value(s) off the grid.')
  console.error('A bare number in a style object is pixels, and no CSS guard can see it.')
  console.error('Run `node tools/grid-snap.mjs --write` to snap them, then read the diff.')
  process.exit(1)
}
