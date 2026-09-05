/* ── THE TWO VERIFIERS THE PAYLOAD SHIPS ──
 *
 * The package held 32 files and not one of them could run. Every arrangement
 * rule was prose, so the only way to obey it was to remember it, and a builder
 * with 700 lines of prose in front of it remembers the first fifty.
 *
 * Two files, because the questions split cleanly and neither tool can answer
 * the other's half:
 *
 *   VERIFY.mjs         Node, over the files the agent wrote. Sees a literal
 *                      colour, an invented number, a token that does not
 *                      exist, a hardcoded theme attribute. Cannot see a
 *                      baseline, because nothing is laid out yet.
 *
 *   VERIFY-BROWSER.js  Pasted into the console of the built page. Sees the
 *                      baselines, the heights, the gaps, the clipping and
 *                      whether a control actually does anything. Cannot see
 *                      the source it came from.
 *
 * Both are generated from `checks.js`, which also writes the contract's
 * checklist. That is the whole point of the split: a rule cannot be worded one
 * way for the reader and coded another way for the tool.
 */
import { SOURCE_CHECKS, RENDER_CHECKS } from './checks.js'

export const VERIFY_NODE = 'VERIFY.mjs'
export const VERIFY_BROWSER = 'VERIFY-BROWSER.js'

const indent = (lines, by) => lines.map(l => ' '.repeat(by) + l).join('\n')

/* ── SOURCE ──────────────────────────────────────────────────────────────
 *
 * Takes a directory. Reads every .html and .css it holds, plus the token
 * names out of tokens.css beside it, then runs each source check over them.
 */
export function verifyNodeFile (state) {
  const rtl = !!state?.meta?.rtl
  const blocks = SOURCE_CHECKS.map(c => [
    '',
    '  /* ' + c.id + ' — ' + c.line.replace(/\x60/g, '') + ' */',
    '  run(' + JSON.stringify(c.id) + ', () => {',
    indent((rtl && c.rtlBody) ? c.rtlBody : c.body, 4),
    '  })',
  ].join('\n')).join('\n')

  return `#!/usr/bin/env node
/* Verify the source against the design system that shipped with it.
 *
 *   node VERIFY.mjs <directory>
 *
 * Exits 1 when anything fails, so a build step can depend on it. It reads the
 * token names from tokens.css beside this file, so a token you never imported
 * is reported rather than silently accepted.
 *
 * This checks what a parser can see. Run VERIFY-BROWSER.js against the page
 * itself for the half that only exists once something is laid out: baselines,
 * heights, gaps, clipping, and whether a control does anything when pressed.
 *
 * Generated with the design system. Do not edit; the next export overwrites it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = process.argv[2] || '.'

const walk = dir => readdirSync(dir).flatMap(entry => {
  if (entry === 'node_modules' || entry.startsWith('.')) return []
  const full = join(dir, entry)
  return statSync(full).isDirectory() ? walk(full) : [full]
})

const wanted = new Set(['.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx', '.mjs'])
const paths = (statSync(ROOT).isDirectory() ? walk(ROOT) : [ROOT])
  .filter(p => wanted.has(extname(p)))
  .filter(p => !/VERIFY(-BROWSER)?\\.(mjs|js)$/.test(p))
  .filter(p => !/^EXAMPLE-|[/\\\\]EXAMPLE-/.test(relative(ROOT, p)))
  .filter(p => !/(^|[/\\\\])tokens\\.(css|ts|json)$|tailwind|_tokens\\.scss/.test(p))

/* ── BLANK THE COMMENTS, NEVER DELETE THEM ──
 *
 * A rule quoted in a comment is not a rule broken in the code. Two findings in
 * the first run pointed at prose explaining a threshold, and a check that
 * fires on correct code costs more than the miss it prevents.
 *
 * Blanked, not stripped: deleting a comment takes its newlines with it and
 * every line number below shifts. A wrong line number is worse than none.
 *
 * Per language, because the tokens are not shared. CSS has no // comment, so
 * blanking one there would eat the rest of any line holding a URL. */
const blankComments = (text, kind) => {
  const keepLines = m => m.replace(/[^\\n]/g, ' ')
  let out = text.replace(/\\/\\*[\\s\\S]*?\\*\\//g, keepLines)
  if (kind === 'js') out = out.replace(/(^|[^:\\\\])\\/\\/[^\\n]*/g, (m, p) => p + keepLines(m.slice(p.length)))
  if (kind === 'html') out = out.replace(/<!--[\\s\\S]*?-->/g, keepLines)
  return out
}

const files = paths.map(p => {
  const text = readFileSync(p, 'utf8')
  const ext = extname(p)
  const kind = ext === '.css' ? 'css' : (ext === '.html' || ext === '.htm') ? 'html' : 'js'
  const bare = blankComments(text, kind)
  return {
    path: relative(ROOT, p) || p,
    text,
    lines: text.split('\\n'),
    /* Every check that asks "does the CODE do this" reads these. */
    bare,
    bareLines: bare.split('\\n'),
    css: kind === 'css',
    html: kind === 'html',
  }
})

/* Every token this system publishes. A name outside this set is either a typo
   or a value the builder invented and gave a token-shaped name.
 *
 * The RETIRED ones are read in the same pass, because tokens.css is the only
 * file that carries the marks and it is deliberately outside the scanned set:
 * it declares every token by definition, so scanning it would fault the one
 * file that has to hold them. A mark is a comment naming the replacement, on
 * the line above the declaration, which is the shape the emitter writes. */
const tokens = new Set()
/* The published VALUE as well as the name, so a check can say what the system
   ships rather than only that a name is taken. The first declaration wins: the
   root block comes before the theme blocks, and root is the base. */
const tokenValues = new Map()
const retiredTokens = new Map()
const readTokens = css => {
  for (const m of css.matchAll(/(--[\\w-]+)\\s*:\\s*([^;\\n]*)/g)) {
    tokens.add(m[1])
    if (!tokenValues.has(m[1])) tokenValues.set(m[1], m[2].trim())
  }
  const lines = css.split('\\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/RETIRED\\./.test(lines[i])) continue
    const decl = (lines[i + 1] || '').match(/(--[\\w-]+)\\s*:/)
    if (!decl) continue
    const use = (lines[i].match(/Use (--[\\w-]+)/) || [])[1]
    retiredTokens.set(decl[1], use || null)
  }
}
for (const candidate of ['tokens.css', join(ROOT, 'tokens.css')]) {
  try {
    readTokens(readFileSync(join(HERE, candidate), 'utf8'))
    break
  } catch { /* try the next location */ }
}
if (!tokens.size) {
  try {
    readTokens(readFileSync(join(ROOT, 'tokens.css'), 'utf8'))
  } catch { /* reported below */ }
}

/* Custom properties the SOURCE declares for itself.
 *
 * DESIGN.md tells the builder to name a value that changes at a breakpoint
 * rather than compile it in, because a media query can reach a property and
 * cannot reach a constant. Following that instruction and then reporting the
 * new name as an unknown token faults the document's own advice. Read the
 * declarations instead of asking for a naming convention: a typo is still
 * declared nowhere, so it still fails. */
const declared = new Set()
for (const f of files) {
  for (const m of f.bare.matchAll(/(--[\\w-]+)\\s*:/g)) declared.add(m[1])
}

const findings = []
let current = ''
const fail = (path, line, msg) => findings.push({ check: current, path, line, msg })
const lineOf = (f, index) => f.text.slice(0, index).split('\\n').length

function run (id, body) {
  current = id
  try { body() } catch (err) { fail('(the check itself)', 0, id + ' threw: ' + err.message) }
}

if (!files.length) {
  console.error('VERIFY: no source files under ' + ROOT + '. Nothing was checked, and that is not a pass.')
  process.exit(1)
}
if (!tokens.size) {
  console.error('VERIFY: tokens.css was not found beside this script or under ' + ROOT + '.')
  console.error('        Without it the token-name check cannot run, so this is a failure, not a skip.')
  process.exit(1)
}
${blocks}

const width = Math.max(...findings.map(f => f.check.length), 10)
console.log('VERIFY  ' + files.length + ' files, ' + tokens.size + ' tokens, ' + ${SOURCE_CHECKS.length} + ' checks')
if (!findings.length) {
  console.log('PASS')
  process.exit(0)
}
for (const f of findings) {
  console.log('  ' + f.check.padEnd(width) + '  ' + f.path + (f.line ? ':' + f.line : '') + '  ' + f.msg)
}
console.log('')
console.log('FAIL - ' + findings.length + ' finding' + (findings.length === 1 ? '' : 's'))
console.log('Fix each one. Do not report it as a limitation of the design system.')
process.exit(1)
`
}

/* ── RENDER ──────────────────────────────────────────────────────────────
 *
 * Pasted into the console. Measures the page as laid out.
 *
 * Every helper here answers a question the prose asks, and the awkward ones
 * are awkward for a reason:
 *
 *   A baseline is not a rectangle edge. A Range bottom is the text BOX bottom,
 *   which sits below the baseline by the descender, so the baseline comes from
 *   font metrics instead.
 *
 *   A row is not "things with similar tops". It is things whose ink OVERLAPS
 *   vertically, because a wrapped row is several rows and a proximity constant
 *   is always wrong somewhere.
 *
 *   An icon is measured on its BOX, never on its ink. The box is what CSS
 *   places; where a glyph sits inside its own viewBox is the icon set's
 *   business, and correcting per glyph destroys the set's optical balance.
 */
/* ── THE DIRECTION-AWARE BODY SHIPS ONLY WHEN RTL IS ON ──
 *
 * Two checks read `left` and mean START. Under `dir="rtl"` the start edge is
 * the right one, so each would report every correct table and every correct
 * selected row as being its whole padding out of place.
 *
 * Both have an `rtlBody` that measures inward from whichever edge the element
 * declares. It is NOT shipped by default: an LTR build gets the file it has
 * always had, byte for byte, and pays nothing for a direction it does not use.
 * That is the same gate the RTL prose takes.
 */
const bodyFor = (c, rtl) => (rtl && c.rtlBody) ? c.rtlBody : c.body

export function verifyBrowserFile (state) {
  const rtl = !!state?.meta?.rtl
  const blocks = RENDER_CHECKS.map(c => {
    const lines = ['', '  /* ' + c.id + ' — ' + c.line.replace(/\x60/g, '') + ' */']
    if (rtl && c.rtlBody) lines.push('  /* Direction-aware: measured from the START edge, not from the left. */')
    lines.push('  await run(' + JSON.stringify(c.id) + ', async () => {', indent(bodyFor(c, rtl), 4), '  })')
    return lines.join('\n')
  }).join('\n')

  return `/* Verify the built page against the design system that shipped with it.
 *
 * Paste this whole file into the browser console on the page you built, then:
 *
 *   await verify()
 *
 * It measures what only exists once the page is laid out. Run it at every
 * breakpoint the system publishes AND at the midpoint between each adjacent
 * pair: a fault lives where the layout changes, and no declared width sits
 * inside that band.
 *
 * Run VERIFY.mjs over the source for the other half.
 *
 * Generated with the design system. Do not edit; the next export overwrites it.
 */
;(function () {

const round = n => Math.round(n * 100) / 100
const px = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
const tokenValue = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
const frame = () => new Promise(r => setTimeout(r, 60))

function visible (el) {
  if (!el.getClientRects || !el.getClientRects().length) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
}

function name (el) {
  if (!el || !el.tagName) return '?'
  const cls = el.getAttribute && el.getAttribute('class')
  const label = el.getAttribute && el.getAttribute('aria-label')
  return el.tagName.toLowerCase()
    + (cls ? '.' + String(cls).trim().split(/\\s+/).join('.') : '')
    + (label ? '[' + label + ']' : '')
}

const all = sel => Array.prototype.slice.call(document.querySelectorAll(sel)).filter(visible)
const boxOf = el => { const r = el.getBoundingClientRect(); return r.width ? r : null }

/* The union of the element's OWN text, ignoring text inside its children. */
function textRect (el) {
  let box = null
  for (const n of el.childNodes) {
    if (n.nodeType !== 3 || !n.textContent.trim()) continue
    const r = document.createRange(); r.selectNode(n)
    const b = r.getBoundingClientRect()
    if (!b.width) continue
    box = box
      ? { left: Math.min(box.left, b.left), right: Math.max(box.right, b.right),
          top: Math.min(box.top, b.top), bottom: Math.max(box.bottom, b.bottom), rects: box.rects + r.getClientRects().length }
      : { left: b.left, right: b.right, top: b.top, bottom: b.bottom, rects: r.getClientRects().length }
  }
  return box
}

/* The cap line and the baseline of an element's own text, from font metrics.
   A rectangle cannot give you either one. */
function capBand (el) {
  const t = textRect(el)
  if (!t) return null
  const cs = getComputedStyle(el)
  const ctx = capBand.ctx || (capBand.ctx = document.createElement('canvas').getContext('2d'))
  ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
  const m = ctx.measureText('H')
  const baseline = t.top + m.fontBoundingBoxAscent
  return { cap: baseline - m.actualBoundingBoxAscent, baseline, lines: t.rects }
}

/* The nearest ancestor that states a horizontal padding, and its padding box.
   That padding is the margin every heading in the container already sits on. */
function padded (el) {
  let n = el.parentElement
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n)
    const pl = px(cs.paddingLeft), pr = px(cs.paddingRight)
    if (pl > 0 || pr > 0) {
      const r = n.getBoundingClientRect()
      return { el: n, left: r.left + px(cs.borderLeftWidth) + pl, right: r.right - px(cs.borderRightWidth) - pr }
    }
    n = n.parentElement
  }
  return null
}

/* ── WHAT A TOKEN ACTUALLY PAINTS, IN THE FORM THE ENGINE REPORTS IT ──
 *
 * getPropertyValue hands back the AUTHORED string, so a token written as a
 * hex can never be compared against a computed background-color, which the
 * engine always reports as an rgb triple. Paint the token on a probe and read
 * the engine's own answer, so both sides of every comparison come from one
 * place.
 *
 * A missing token is not an error here. A var() naming nothing is invalid at
 * computed-value time, and background-color does not inherit, so it resolves
 * to transparent. That is reported as null rather than compared. */
/* Read the ALPHA rather than pattern-matching one spelling of transparent.
   A ground at 2% opacity is still a ground, and a regex looking for a zero
   would have to know how the engine punctuates its own output. */
function opaque (v) {
  if (!v || v === 'transparent') return false
  const open = v.indexOf('('); if (open < 0) return true
  const parts = v.slice(open + 1, v.lastIndexOf(')')).split(',')
  return parts.length < 4 || parseFloat(parts[3]) > 0
}

/* THE PROBE COMES BACK OUT, and leaving it in cost a false positive. Cached
   between calls it is a bare div painted --c-selected, sitting in the body
   with the page's own cards as siblings. The selection check then measured
   the instrument and reported a fault on a correct page. */
function paints (token) {
  const p = document.body.appendChild(document.createElement('div'))
  p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none'
  p.style.backgroundColor = 'var(' + token + ')'
  const v = getComputedStyle(p).backgroundColor
  p.remove()
  return opaque(v) ? v : null
}

/* The nearest ancestor that actually paints something behind this element. */
function ground (el) {
  let n = el.parentElement
  while (n) {
    const bg = getComputedStyle(n).backgroundColor
    if (opaque(bg)) return { el: n, bg }
    n = n.parentElement
  }
  return null
}

/* A cell's own content edges. */
function inner (cell) {
  const cs = getComputedStyle(cell), r = cell.getBoundingClientRect()
  return {
    left: r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft),
    right: r.right - px(cs.borderRightWidth) - px(cs.paddingRight),
  }
}

const CONTROL = 'button, input, select, textarea, a[href], [role=button], [role=tab], .btn'

/* ── A CONTROL CLIPPED TO A PIXEL IS NOT THE CONTROL A PERSON SEES ──
 *
 * The standard way to build a switch with no script is a visually hidden
 * checkbox and a label that draws it. The input keeps a 1x1 box so it stays
 * focusable and nameable, and the LABEL is what the reader hits.
 *
 * Measured without this: a row of two 36px buttons reported "heights 36, 1,
 * 36", and the same input reported 1x1 against a 44px touch floor. Both are
 * the check reading the wrong element. Its label carries the size, the target
 * and the hit area, and every one of those checks already measures the label.
 */
const clippedAway = el => {
  const r = el.getBoundingClientRect()
  if (r.width > 2 || r.height > 2) return false
  const cs = getComputedStyle(el)
  return cs.position === 'absolute' &&
    (cs.clipPath !== 'none' || cs.clip !== 'auto' || cs.overflow === 'hidden')
}

function describe (el) {
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const band = capBand(el)
  return {
    el, rect,
    label: name(el),
    text: Boolean(band),
    lines: band ? band.lines : 0,
    baseline: band ? band.baseline : null,
    control: el.matches(CONTROL) && !clippedAway(el),
  }
}

/* Band a container's children by whether their ink OVERLAPS vertically. A
   wrapped row is several rows, and any proximity constant gets that wrong
   somewhere. Only flex and grid containers are asked: a block container has
   one child per line by definition. */
function rows () {
  const out = []
  for (const parent of document.querySelectorAll('*')) {
    const cs = getComputedStyle(parent)
    if (!/flex|grid/.test(cs.display)) continue
    const kids = Array.prototype.slice.call(parent.children).filter(visible)
    if (kids.length < 2) continue
    const items = kids.map(describe).filter(Boolean)
    const bands = []
    for (const it of items) {
      const found = bands.find(b => b.some(x => it.rect.top < x.rect.bottom && x.rect.top < it.rect.bottom))
      if (found) found.push(it); else bands.push([it])
    }
    for (const b of bands) if (b.length > 1) out.push({ name: name(parent), items: b, parent })
  }
  return out
}

/* MEASURE A SETTLED LAYOUT, NEVER A FRAME. A fixed pause is a guess, and a
   guess fifty milliseconds short measures the entrance animation. Ask the
   browser which animations are running instead, and drop the ones that never
   finish. */
async function settle (deadline) {
  const stop = Date.now() + (deadline || 2000)
  for (let i = 0; i < 40; i++) {
    const running = document.getAnimations
      ? document.getAnimations().filter(a => a.playState === 'running' && a.effect &&
          (a.effect.getComputedTiming().iterations || 1) !== Infinity)
      : []
    if (!running.length) break
    await Promise.race([
      Promise.all(running.map(a => a.finished.catch(() => {}))),
      new Promise(r => setTimeout(r, 200)),
    ])
    if (Date.now() > stop) return false
  }
  await frame()
  return true
}

const findings = []
const notes = []
let current = ''
const fail = (where, msg) => findings.push({ check: current, where, msg })
const note = msg => notes.push(current + ': ' + msg)

async function run (id, body) {
  current = id
  try { await body() } catch (err) { fail('(the check itself)', id + ' threw: ' + err.message) }
}

window.verify = async function verify () {
  findings.length = 0; notes.length = 0
  const settled = await settle()
  if (!settled) console.warn('VERIFY: the page never came to rest. Measurements below may be a frame of an animation.')
${blocks}

  console.log('VERIFY  ' + innerWidth + 'x' + innerHeight
    + '  theme=' + (document.documentElement.dataset.theme || 'system')
    + '  pointer=' + (matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine')
    + '  ' + ${RENDER_CHECKS.length} + ' checks')
  for (const n of notes) console.log('  - ' + n)
  if (!findings.length) { console.log('PASS'); return { pass: true, findings: [] } }

  /* FIX THE CLASS, NOT THE INSTANCE. Five identical nav items produced five
     identical lines, and a wall of repeats is read as noise rather than as one
     fault with five sites. Group on the message and say how many. */
  const groups = []
  for (const f of findings) {
    const key = f.check + '|' + f.msg
    const g = groups.find(g => g.key === key)
    if (g) { g.count++; if (g.count <= 4) g.where.push(f.where) }
    else groups.push({ key, check: f.check, msg: f.msg, count: 1, where: [f.where] })
  }
  const width = Math.max.apply(null, groups.map(g => g.check.length))
  for (const g of groups) {
    const sites = g.count > 1 ? ' [' + g.count + ' sites: ' + g.where.join(', ') + (g.count > 4 ? ', …' : '') + ']' : '  ' + g.where[0]
    console.log('  ' + g.check.padEnd(width) + sites + '  ' + g.msg)
  }
  console.log('')
  console.log('FAIL - ' + groups.length + ' fault' + (groups.length === 1 ? '' : 's')
    + ' across ' + findings.length + ' site' + (findings.length === 1 ? '' : 's'))
  console.log('Fix each one. Do not report it as a limitation of the design system.')
  return { pass: false, findings: findings.slice() }
}

console.log('VERIFY-BROWSER loaded. Run:  await verify()')

})()
`
}
