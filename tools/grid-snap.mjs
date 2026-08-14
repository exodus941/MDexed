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

  if (hits) {
    changed += hits
    touched++
    console.log(`  ${relative(ROOT, path).replace(/\\/g, '/')}  ${hits}`)
    if (WRITE) writeFileSync(path, after)
  }
}

console.log(`\n${changed} values across ${touched} files${WRITE ? ' — written' : ' — dry run, pass --write to apply'}`)
