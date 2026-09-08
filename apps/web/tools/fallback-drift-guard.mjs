/* ── A var() FALLBACK IS WHAT PAINTS WHEN THE TOKEN IS MISSING ──
 *
 * So a drifted one states a second design nobody chose, and nothing was
 * looking. Measured before this guard existed: 553 fallbacks in our own
 * stylesheets, 316 of them on a token the system pins, and 19 carrying a
 * concrete value different from the one that ships. The worst was
 * `--radius-lg` at 16px where the token ships 8, which is a second corner
 * radius living in the same file as the first.
 *
 * WHY OUR STYLESHEETS CARRY FALLBACKS AT ALL. The preview hosts an arbitrary
 * document, so a fallback is what the app paints when that document publishes
 * no such token. The payload tells a READER to carry none, because a sample
 * must let a missing role paint nothing. Two contexts, two rules.
 *
 * ── THREE SCOPE DECISIONS, EACH NEEDED TO KEEP IT HONEST ──
 *
 * ONLY WHAT THE SYSTEM PINS. A colour moves with the seed, so there is no one
 * shipped value for a colour fallback to be wrong about. Spacing, radius,
 * border widths, icon sizes, durations, easings, layers and the type metrics
 * do not move.
 *
 * A CSS-WIDE KEYWORD IS NOT A DESIGN VALUE. `normal`, `inherit`, `auto`,
 * `none` and `ease` are the property's own initial. A fallback of `normal` for
 * letter-spacing states no second design; it states the absence of one. 46 of
 * the 316 are these, and faulting them would have buried the 19.
 *
 * NUMERICALLY EQUAL IS EQUAL. `.5` and `0.5` are one value written two ways,
 * and a string compare called two of those a drift.
 *
 * Run: node tools/fallback-drift-guard.mjs
 */
import './../test/css-hook.mjs'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const web = path.join(here, '..')
const load = f => import(url.pathToFileURL(path.join(web, 'src', f)).href)

const { createInitialState } = await load('state/schema.js')
const { derive } = await load('state/derive.js')
const { payloadTextFiles } = await load('emit/payload.js')

const st = createInitialState()
const tokensCss = payloadTextFiles(st, derive(st))['tokens.css']

/* The FIRST declaration wins: the root block comes before the theme blocks,
   and root is the base. */
const shipped = new Map()
for (const m of tokensCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  if (!shipped.has(m[1])) shipped.set(m[1], m[2].trim())
}
if (shipped.size < 100) {
  console.error('fallback guard: read only ' + shipped.size + ' tokens. Nothing was checked, and that is not a pass.')
  process.exit(1)
}

const PINNED = /^--(space|radius|border|icon|duration|ease|z|font-[a-z0-9]+-(size|leading|tracking)|cmp-)/
const NEUTRAL = new Set(['inherit', 'initial', 'unset', 'revert', 'normal', 'auto',
  'none', 'ease', '0', '0px', 'currentcolor', 'transparent'])

const norm = v => {
  const t = v.trim().replace(/\s+/g, ' ').toLowerCase()
  const n = parseFloat(t)
  if (!isNaN(n) && /^-?[\d.]+(px|em|rem|ms|s|%)?$/.test(t)) return String(n) + t.replace(/^-?[\d.]+/, '')
  return t
}

/* BLANK a comment, never delete it: deleting takes its newlines too and every
   line number below shifts. */
const blank = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

const FILES = ['src/preview/preview.css', 'src/preview/responsive.rules.css', 'src/ui/theme.css']
let total = 0, pinned = 0, neutral = 0
const drift = []
for (const rel of FILES) {
  const p = path.join(web, rel)
  if (!fs.existsSync(p)) continue
  const src = blank(fs.readFileSync(p, 'utf8'))
  for (const m of src.matchAll(/var\(\s*(--[\w-]+)\s*,\s*([^();]+)\)/g)) {
    total++
    const name = m[1], fallback = m[2].trim()
    if (!PINNED.test(name)) continue
    const ship = shipped.get(name)
    /* A token whose own value is a var() reference resolves elsewhere. */
    if (!ship || /var\(/.test(ship)) continue
    pinned++
    if (NEUTRAL.has(fallback.toLowerCase())) { neutral++; continue }
    if (norm(ship) !== norm(fallback))
      drift.push({ rel, line: src.slice(0, m.index).split('\n').length, name, fallback, ship })
  }
}

if (total === 0) {
  console.error('fallback guard: no var() fallbacks found at all. Nothing was checked.')
  process.exit(1)
}

if (!drift.length) {
  console.log('fallback guard: ' + total + ' fallbacks, ' + pinned + ' on a pinned token, '
    + neutral + ' a CSS-wide neutral, 0 drifted')
  process.exit(0)
}

console.error('fallback guard: ' + drift.length + ' fallback(s) state a value the token does not ship.\n')
for (const d of drift) {
  console.error('  ' + d.rel + ':' + d.line)
  console.error('    ' + d.name + '  fallback ' + d.fallback + '  ships ' + d.ship)
}
console.error('\nA fallback is what PAINTS when the token is missing, so a drifted one is a')
console.error('second design nobody chose. Match it to the shipped value, or drop it.')
process.exit(1)
