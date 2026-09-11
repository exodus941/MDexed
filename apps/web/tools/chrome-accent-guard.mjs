/* ── THE CHROME ACCENT AGAINST EVERY GROUND IT PAINTS ON ──
 *
 * Nothing guarded this. The a11y audit reads the DOCUMENT's roles, and the
 * chrome is a separate class set, so the editor's own accent could fail AA in
 * either theme and no run would say so. I measured it by hand across five
 * candidate colours before this existed.
 *
 * WHAT IT ASKS, in three parts:
 *
 *  1. THE SHIPPED PAIR, pinned to the figures it measures today. A drift in
 *     either direction reports. The light value fails 2 of its 8 pairs at the
 *     dim end of the brightness slider, which is known rather than missed, so
 *     the pin carries that too. A guard demanding zero would refuse a commit
 *     over a value a person chose.
 *
 *  2. THE CEILING THE RULE STATES. "An accent on a light ground has a
 *     lightness ceiling" names OKLCH L 0.49 to 0.50 at every orange hue, and
 *     says no `#FFxx00` can clear. A rule that states a constant needs a
 *     check that READS that constant, or the rule keeps its number while the
 *     stylesheet moves.
 *
 *  3. THE HUE FLOOR. A passing light twin sits at L 0.50, which is where
 *     --danger sits, so hue does the whole separating. The rule says about 20
 *     degrees, and this pins the measured figures behind it.
 *
 * THE GROUND SET WAS ENUMERATED FROM THE DOM, NOT FROM THIS FILE. 9 sites
 * over 6 distinct grounds on the running chrome, plus the slider thumb, which
 * is a pseudo-element no selector can reach. A ground the stylesheet offers
 * and nothing uses cost a false finding once: `--surf3` reported the light
 * accent at 4.36:1, and the accent never paints words there.
 *
 * Run:  node tools/chrome-accent-guard.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)
const { check } = await load('color/contrast.js')
const { toOklchObj, hexFrom, maxChroma, fromHsl360, toHex, inGamut } = await load('color/convert.js')

const CSS = fs.readFileSync(path.join(here, '..', 'src', 'ui', 'theme.css'), 'utf8')
const f2 = n => n.toFixed(2)
const f3 = n => n.toFixed(3)
const pad = (s, n) => String(s).padEnd(n)

const problems = []
const notes = []
const fail = m => problems.push(m)

/* ── READ THE STYLESHEET, NEVER A COPY OF ITS VALUES ──
 * A guard holding its own copy of the accent is a guard that agrees with
 * itself. Parse the two blocks the file actually declares. */
const blockOf = (re) => {
  const m = CSS.match(re)
  if (!m) { fail('cannot find the ' + re + ' block in theme.css'); return '' }
  return m[0]
}
const ROOT = blockOf(/:root\{[\s\S]*?\n\}/)
const LIGHT = blockOf(/:root\[data-ui-theme="light"\]\{[\s\S]*?\n\}/)

const decl = (block, name) => {
  const m = block.match(new RegExp('--' + name + '\\s*:\\s*([^;]+);'))
  return m ? m[1].trim() : null
}
const ACCENT = { dark: decl(ROOT, 'accent'), light: decl(LIGHT, 'accent') }
const TRIPLE = { dark: decl(ROOT, 'accent-rgb'), light: decl(LIGHT, 'accent-rgb') }
for (const mode of ['dark', 'light']) {
  if (!ACCENT[mode]) fail('no --accent declared for ' + mode)
  if (!TRIPLE[mode]) fail('no --accent-rgb declared for ' + mode)
}

/* THE TRIPLE MUST BE THE HEX. Two writers for one colour is how the tints
   drift away from the value they are meant to tint. */
const chan = h => h.replace('#', '').match(/../g).map(v => parseInt(v, 16))
for (const mode of ['dark', 'light']) {
  if (!ACCENT[mode] || !TRIPLE[mode]) continue
  const want = chan(ACCENT[mode]).join(' ')
  if (TRIPLE[mode] !== want) {
    fail(mode + ': --accent-rgb is "' + TRIPLE[mode] + '" and --accent ' + ACCENT[mode]
      + ' is "' + want + '". The triple and the hex are one colour.')
  }
}

/* AND EVERY TINT READS THE TRIPLE. A tint restating the channels is a sixth
   writer per theme, and changing the accent then means finding all six. */
for (const [label, block] of [['dark', ROOT], ['light', LIGHT]]) {
  for (const t of ['accent-wash', 'accent-soft', 'accent-line', 'accent-ring']) {
    const v = decl(block, t)
    if (v && !/var\(--accent-rgb\)/.test(v)) {
      fail(label + ': --' + t + ' is "' + v + '" and restates the channels. '
        + 'Read the triple: rgb(var(--accent-rgb) / <alpha>).')
    }
  }
}

/* ── THE GROUND LADDERS, read off the same file ── */
const HUE = Number((decl(ROOT, 'ui-h') || '208').replace(/[^\d.]/g, ''))
const hsl = (s, l) => toHex(fromHsl360({ h: HUE, s, l }))
/* The lightness of each surface is `calc(A% + var(--b) * B%)`, so read A and B
   rather than typing the ladder out here. */
const surf = (block, name) => {
  const v = decl(block, name)
  if (!v) return null
  const m = v.match(/hsl\(var\(--ui-h\)\s+([\d.]+)%\s+calc\(([\d.]+)%\s*\+\s*var\(--b\)\s*\*\s*([\d.]+)%\)\)/)
  if (!m) return null
  const [, s, a, b] = m.map(Number)
  return f => hsl(s, a + f * b)
}
const ladder = block => {
  const out = {}
  for (const n of ['bg', 'surf', 'surf2', 'bdr2']) {
    const fn = surf(block, n)
    if (!fn) { fail('cannot parse --' + n + ' in theme.css'); return null }
    out[n] = fn
  }
  return out
}
const L = { dark: ladder(ROOT), light: ladder(LIGHT) }

const flat = (hex, a, over) => {
  const f = chan(hex), b = chan(over)
  return '#' + f.map((v, i) => Math.round(v * a + b[i] * (1 - a)).toString(16).padStart(2, '0')).join('')
}

/* THE EIGHT SHAPES. Every one was found on the running chrome. */
const pairs = (a, G, f) => {
  const bg = G.bg(f), sf = G.surf(f), s2 = G.surf2(f), b2 = G.bdr2(f)
  const wash = flat(a, 0.07, sf)
  return [
    ['fill, --bg label on it', bg, a, 4.5],
    ['words on its .07 wash', a, wash, 4.5],
    ['mark on its .07 wash', a, wash, 3],
    ['line on surf', a, sf, 3],
    ['words on surf2', a, s2, 4.5],
    ['mark on surf2', a, s2, 3],
    ['thumb on its track', a, b2, 3],
    ['thumb on the panel', a, sf, 3],
  ]
}
const score = (a, G, f) => pairs(a, G, f).map(([w, fg, bg, bar]) =>
  ({ w, r: check(fg, bg).ratio, bar })).map(x => ({ ...x, ok: x.r >= x.bar }))
const clears = (a, G, f) => score(a, G, f).every(x => x.ok)

/* ── 1. THE SHIPPED PAIR, PINNED ──
 * Recomputed from the stylesheet, compared against what it measured the day
 * the rule was written. `known` is the failing count at that slider position.
 * A figure that moves in EITHER direction reports, because a palette drifting
 * upward is still a palette nobody re-measured. */
/* THESE FIGURES WERE READ OFF THIS GUARD'S OWN FIRST RUN, NOT REMEMBERED.
   My first attempt typed them from an earlier candidate's table and four of
   the six were wrong by 0.13 to 2.70. A baseline you remember is not a
   baseline. */
const PIN = [
  ['dark', 0, 0, 5.70], ['dark', 1 / 3, 0, 5.19], ['dark', 1, 0, 4.23],
  ['light', 0, 2, 2.83], ['light', 1 / 3, 0, 3.09], ['light', 1, 0, 3.63],
]
for (const [mode, f, knownFails, knownWorst] of PIN) {
  if (!L[mode] || !ACCENT[mode]) continue
  const rows = score(ACCENT[mode], L[mode], f)
  const bad = rows.filter(x => !x.ok)
  const worst = Math.min(...rows.map(x => x.r))
  const at = mode + ' at --b ' + f3(f)
  if (bad.length !== knownFails) {
    fail(at + ': ' + bad.length + ' of 8 pairs fail, pinned at ' + knownFails
      + '. ' + bad.map(x => x.w + ' ' + f2(x.r) + ' vs ' + f2(x.bar)).join('; '))
  }
  if (Math.abs(worst - knownWorst) > 0.05) {
    fail(at + ': worst pair reads ' + f2(worst) + ', pinned at ' + f2(knownWorst) + '.')
  }
  notes.push('  ' + pad(at, 22) + pad(ACCENT[mode], 10)
    + bad.length + ' of 8 fail, worst ' + f2(worst))
}

/* ── 2. THE CEILING THE RULE STATES ──
 * The rule says L 0.49 to 0.50 at every orange hue, and that no `#FFxx00`
 * clears. Both are read back rather than quoted. */
const ceilingAt = h => {
  for (let l = 0.90; l > 0.20; l -= 0.002) {
    const cand = hexFrom({ mode: 'oklch', l, c: maxChroma(l, h), h })
    if (clears(cand, L.light, 0)) return l
  }
  return null
}
const CEIL = [40, 48, 56, 62, 70].map(h => ({ h, l: ceilingAt(h) }))
for (const c of CEIL) {
  if (c.l === null) { fail('no colour at hue ' + c.h + ' clears the light pairs at all.'); continue }
  if (c.l < 0.485 || c.l > 0.505) {
    fail('the ceiling at hue ' + c.h + ' is L ' + f3(c.l)
      + ', outside the 0.49 to 0.50 the rule states.')
  }
}
notes.push('  ceiling  ' + CEIL.map(c => c.h + ':' + (c.l === null ? 'none' : f3(c.l))).join('  '))

/* EVERY `#FFxx00`, so "none of them can clear" is a closed set. */
let ffClears = 0, ffDarkest = { l: 9 }
for (let g = 0; g <= 255; g++) {
  const hex = '#ff' + g.toString(16).padStart(2, '0') + '00'
  const o = toOklchObj(hex)
  if (o.l < ffDarkest.l) ffDarkest = { hex, l: o.l }
  if (clears(hex, L.light, 0)) ffClears++
}
if (ffClears !== 0) {
  fail(ffClears + ' of 256 `#FFxx00` clear the light pairs. The rule says none can.')
}
notes.push('  #FFxx00  256 asked, ' + ffClears + ' clear, darkest '
  + ffDarkest.hex + ' at L ' + f3(ffDarkest.l))

/* ── 3. THE HUE FLOOR AGAINST --danger ──
 * A passing twin sits where --danger sits, so hue is the only separator. */
const DANGER = decl(LIGHT, 'danger')
if (!DANGER) fail('no --danger declared for light')
else {
  const d = toOklchObj(DANGER)
  const twinAt = h => {
    for (let l = 0.90; l > 0.20; l -= 0.002) {
      const cand = hexFrom({ mode: 'oklch', l, c: maxChroma(l, h), h })
      if (clears(cand, L.light, 0)) return cand
    }
    return null
  }
  const rows = [35, 43, 48, 56].map(h => {
    const t = twinAt(h)
    let dh = Math.abs(h - d.h); if (dh > 180) dh = 360 - dh
    return { h, t, dh, dl: t ? Math.abs(toOklchObj(t).l - d.l) * 100 : null }
  })
  /* LIGHTNESS MUST NOT BE DOING THE WORK. If it were, the hue floor would be
     unnecessary and this whole rule would be wrong. */
  const worstDl = Math.max(...rows.filter(r => r.dl !== null).map(r => r.dl))
  if (worstDl > 5) {
    fail('a passing twin sits ' + f2(worstDl) + ' lightness points from --danger. '
      + 'Above about 5, lightness separates them and the hue floor is not the rule.')
  }
  const near = rows.find(r => r.h === 35)
  if (near && near.dh >= 10) {
    fail('hue 35 is ' + f2(near.dh) + ' degrees from --danger at ' + f2(d.h)
      + '. The rule cites 9, so --danger has moved and the floor needs re-deriving.')
  }
  notes.push('  vs danger ' + DANGER + ' hue ' + f2(d.h) + ': '
    + rows.map(r => r.h + ' is ' + f2(r.dh) + ' off, dL ' + f2(r.dl)).join('  |  '))
}

console.log('chrome accent guard')
for (const n of notes) console.log(n)
if (problems.length) {
  console.log('\n' + problems.length + ' problem(s):')
  for (const p of problems) console.log('  - ' + p)
  process.exit(1)
}
console.log('\nPASS - the shipped pair matches its pinned figures, the light ceiling')
console.log('       holds at L 0.49-0.50 across 5 hues, 0 of 256 #FFxx00 clear,')
console.log('       and hue is the only thing separating a twin from --danger.')
