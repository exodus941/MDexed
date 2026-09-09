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

/* ── A RUN THAT READ NOTHING IS NOT A CLEAN RUN, AND IT HAS TO SAY SO ──
 *
 * This exits non-zero on a finding, which is right, and it said nothing about
 * how much it had read. A clean run printed "0 values across 0 files", where
 * the 0 files means files CHANGED. A run that walked the wrong directory and
 * found no files at all printed the identical line.
 *
 * It cost a question: the user read that line in a verification report and
 * asked why the guard had skipped. The answer was that it had not, and the
 * report could not say so. */
if (!files.length) {
  console.error('grid guard: no .jsx or .js file under ' + join(ROOT, 'src'))
  console.error('Nothing was read, so this is a failure rather than a clean result.')
  process.exit(1)
}

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

  /* ── A SIZE IS AN ATTRIBUTE TOO, AND THE STYLE-REGION SCOPE CANNOT SEE ONE ──
   *
   * `<svg width={14} height={14}>` states a length outside every style region,
   * so the pass above skips it and no CSS guard can reach it either. This was
   * recorded in the rules as the SECOND widening of this matcher, and the
   * widening never landed. Measured when it finally did: 71 attribute lengths
   * across 10 files, every one of them already on the grid at 10, 12, 14, 24,
   * 104, 120, 124 and 130. So there was no fault to find and no instrument
   * that would have found one.
   *
   * REPORTED, NEVER REWRITTEN, for a different reason than the ternary. An
   * `<svg>` attribute and its `viewBox` are one decision: snapping the width
   * and leaving the viewBox rescales the drawing. So this names the value and
   * a person changes both.
   *
   * ONLY ON A DRAWING ELEMENT. `width` on an `<input>` or a `<td>` is an HTML
   * attribute with its own meaning, and a `<rect>` inside a chart is geometry
   * derived from data rather than a length somebody chose. The gate is the
   * tag, and it is narrow on purpose. A `width` prop on a React component is
   * outside it too: one reads 130 and it is a control's width, not a drawing.
   *
   * ── AND IT ANSWERS TO THE TYPE GRID, NOT THE SPACE GRID ──
   *
   * The first version snapped against `snapSpace` and reported 46 findings on
   * correct code. A mark's box is a SIZE, and the space grid is 4px multiples
   * above 8, so it called 10 and 14 off-grid. 14 is the published mark size,
   * their own number. The type grid is multiples of 2 below 24 and 4 above,
   * which is the rule a size answers to: it accepts 10, 12, 14, 24, 104, 120
   * and 124, and rejects 13 and 27.
   *
   * A check that fires on correct code costs more than the miss it prevents.
   * Measured after the fix: 0 findings across 10 files holding 71 attribute
   * lengths, and an injected 13 fires. */
  let attr = 0
  for (const m of before.matchAll(/<(svg|use|image)\s([^>]{0,400})>/g)) {
    for (const a of m[2].matchAll(/\b(width|height)=\{(\d+(?:\.\d+)?)\}/g)) {
      const n = Number(a[2])
      if (snapType(n) === n) continue
      attr++
      console.log(`  ${relative(ROOT, path).replace(/\\/g, '/')}  <${m[1]} ${a[1]}={${a[2]}}>   off-grid   ATTRIBUTE, not rewritten (the viewBox is the other half)`)
    }
  }

  if (hits) {
    changed += hits
    touched++
    console.log(`  ${relative(ROOT, path).replace(/\\/g, '/')}  ${hits}`)
    if (WRITE) writeFileSync(path, after)
  }
  if (conditional || attr) { changed += conditional + attr; if (!hits) touched++ }
}

/* SAY WHAT WAS READ, NOT ONLY WHAT WAS FOUND. `touched` counts files with a
   finding, so on a clean tree both numbers are zero and the line reads as a
   guard that looked at nothing. Name the denominator. */
console.log(`\n${changed} value(s) off the grid in ${touched} of ${files.length} file(s) read`
  + (WRITE ? ' — written' : ' — dry run, pass --write to apply'))

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
