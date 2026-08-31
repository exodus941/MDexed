#!/usr/bin/env node
/* ── A MISSING TOKEN GETS INVENTED ──
 *
 * A generated dashboard put 2px between a badge's status dot and its label,
 * inside 6px of padding. The mark read as stuck to the word. The builder was
 * not careless: `--cmp-badge-gap` did not exist, so it reached for the
 * smallest step on the spacing scale and moved on.
 *
 * Five of sixteen components published a gap at the time. Badge, input,
 * select, checkbox and switch all pair a mark with words and published none.
 *
 * A rule in prose does not close this. The builder never sees the prose about
 * a token that is absent; it sees an absence and fills it. So the fix is that
 * the payload cannot ship the hole, and this guard is what makes that true.
 *
 * TWO QUESTIONS, both answered from the spec rather than from a heuristic:
 *
 *   1. Does every component that pairs a mark with words publish a `gap`?
 *   2. Does any spacing property hold a raw pixel where a token exists?
 *
 * The second is narrow on purpose. A control's HEIGHT is legitimately a raw
 * value — 36px is a control step, not a spacing step, and forcing it onto the
 * 4px grid through a spacing token would move it with the density macro. Only
 * gap, padding and margin answer to the spacing scale, so only those are
 * checked. A rule wider than its problem is a bigger bug than the problem.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const { COMPONENT_LIBRARY } = await import(
  'file://' + join(HERE, '..', 'src', 'state', 'components.js').replace(/\\/g, '/'))

/* Components that put an ornament beside words. A component with an
   `iconSize` says so itself and is added below. These three carry a mark that
   is not an icon: a status dot, a tick in its own box, a switch track. */
const PAIRS_A_MARK_WITH_WORDS = ['badge', 'checkbox', 'switch']

/* Spacing properties answer to the spacing scale. Everything else does not. */
const SPACING_PROPS = ['gap', 'padding', 'margin', 'rowGap', 'columnGap']

const findings = []

for (const c of COMPONENT_LIBRARY) {
  const base = c.base || {}
  const declaresAMark = Boolean(base.iconSize) || PAIRS_A_MARK_WITH_WORDS.includes(c.name)

  if (declaresAMark && !base.gap) {
    findings.push(`${c.name}: puts a mark beside words and publishes no gap. ` +
      'A builder that finds no gap token invents one, and 2px is what it invents. ' +
      'Add `gap` to its base, or take it out of PAIRS_A_MARK_WITH_WORDS in this guard.')
  }

  /* Base, variants, sizes and states all reach the emitted tokens. */
  const specs = [['base', base]]
  for (const [k, v] of Object.entries(c.variants || {})) specs.push([`variants.${k}`, v])
  for (const [k, v] of Object.entries(c.sizes || {})) specs.push([`sizes.${k}`, v])
  for (const [k, v] of Object.entries(c.states || {})) {
    for (const [k2, v2] of Object.entries(v || {})) specs.push([`states.${k}.${k2}`, v2])
  }

  for (const [where, spec] of specs) {
    for (const prop of SPACING_PROPS) {
      const value = spec?.[prop]
      if (typeof value !== 'string') continue
      const raw = value.match(/(?<![\w.{-])\d+(\.\d+)?(px|rem)\b/)
      if (raw) {
        findings.push(`${c.name}.${where}.${prop}: "${value}" holds the literal ${raw[0]}. ` +
          'Spacing answers to the scale. Name the step, so density moves it and a reader can trace it.')
      }
    }
  }
}

const paired = COMPONENT_LIBRARY.filter(c => c.base?.gap).length
console.log(`component gaps guard: ${COMPONENT_LIBRARY.length} components, ${paired} publish a gap`)

if (!findings.length) {
  console.log('PASS - every component that pairs a mark with words publishes its gap')
  process.exit(0)
}
for (const f of findings) console.log('  ' + f)
console.log('')
console.log(`FAIL - ${findings.length} finding${findings.length === 1 ? '' : 's'}`)
process.exit(1)
