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
import { SOURCE_CHECKS, RENDER_CHECKS, checksFor } from './checks.js'

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
  /* A check the document does not ship must not be enforced. See checksFor in
     checks.js: a single-theme package failed a compliant build for not having
     the theme toggle its own DESIGN.md forbids. */
  const checks = checksFor(SOURCE_CHECKS, state)
  const blocks = checks.map(c => [
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
/* A RUN THAT MEASURED NOTHING IS NOT A PASS, AND HAS TO SAY SO. The render
   side has had this channel since it shipped. This side could only fail, so a
   check whose shape does not exist in the tree was silent, and silence reads
   exactly like a clean result. Three checks added on 9 September 2026 report
   their candidate count through it. */
const notes = []
let current = ''
const fail = (path, line, msg) => findings.push({ check: current, path, line, msg })
const note = msg => notes.push(current + ': ' + msg)
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
console.log('VERIFY  ' + files.length + ' files, ' + tokens.size + ' tokens, ' + ${checks.length} + ' checks')
for (const n of notes) console.log('  - ' + n)
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
  /* ── A CHECK THAT PRESSES SOMETHING RUNS LAST ──
   *
   * A press can change the page in a way no restore undoes. Measured on the
   * editor that hosts this document: pressing the theme control writes the
   * document, the editor re-renders, and 17 component samples mount. Each
   * carries the document root's class, so the root became ambiguous and every
   * check ordered after that one measured nothing. The first run reported 3
   * findings and the second reported 86.
   *
   * The restore press does put the theme back. It cannot unmount what the
   * change mounted, so ORDER is the fix rather than a better restore. A
   * pressing check ordered last has nothing after it to spoil.
   *
   * Sorted by the body rather than by a list of ids, so a check that gains a
   * press tomorrow moves on its own. */
  const presses = c => (c.body || []).join('\n').includes('.click()')
  const checks = checksFor(RENDER_CHECKS, state)
    .slice()
    .sort((a, b) => (presses(a) ? 1 : 0) - (presses(b) ? 1 : 0))
  const blocks = checks.map(c => {
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
 * If the page HOSTS your document rather than being it, pass the element that
 * carries the design tokens and everything outside it is left alone:
 *
 *   await verify('.my-document-root')
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

/* ── THE SCOPE, BECAUSE A PAGE MAY HOST A DOCUMENT RATHER THAN BE ONE ──
 *
 * Every query ran over the whole document, which is right for a page you
 * built and wrong for an editor that renders your document inside itself.
 *
 * Measured on one such editor, nine surfaces, one run: 610 findings, and the
 * three biggest were 529 of them. Every one sat in the editor's own interface.
 * The target floor reported 297 and 0 of the 297 were in the document. The
 * mono-face rule reported 12 chips and 0 were in the document. The clipping
 * rule reported 967 select options and 0 were in the document.
 *
 * So verify() takes the root. Pass nothing and it is the whole document,
 * which is what a built page wants. Pass the element that carries the design
 * tokens and every check measures that instead.
 *
 * AND THE TOKEN READER HAS THE SAME HOLE. It read document.documentElement,
 * so a hosted document's own tokens were invisible and every check fell back
 * to its literal. The scope element answers in both cases, because a custom
 * property inherits. */
/* ── AND RESOLVE IT EVERY TIME, NEVER ONCE ──
 *
 * The first version stored the element. One check presses the theme control,
 * that press re-renders the frame, and the stored element is then DETACHED.
 * querySelectorAll still walks its descendants and every rect comes back
 * empty, so every check after that press measured NOTHING and reported clean.
 *
 * Measured: an injected 280px clipping fault came back with 0 findings, while
 * the same logic replayed by hand found it. The root captured before the run
 * was a different element from the one in the page after it.
 *
 * So a SELECTOR is the contract. It is re-resolved on every query, and the
 * frame that replaced the old one carries it too. An element is accepted and
 * watched: once it leaves the document the run says so instead of going quiet. */
/* ── AND FALLING BACK TO THE DOCUMENT IS THE WRONG ANSWER ──
 *
 * A lost root used to widen the run to the whole page. That turns a scoped run
 * into an unscoped one silently, and the findings then describe whatever hosts
 * the document.
 *
 * Measured on this editor, one run at 1440px: the first pass reported 3
 * findings and the second reported 86. One check presses the theme control,
 * that control lives INSIDE the preview, and pressing it writes the document
 * and mounts 17 component samples. Each carries the document root class,
 * because a sample must render in the document tokens. So that class went
 * from 1 element to 18, the
 * root became ambiguous, and every later query ran over the editor's chrome.
 * 83 of those 86 findings were the editor's own interface.
 *
 * A selector that matches more than one element is not a root. So the scope
 * REFUSES: it returns null, every query comes back empty, and the run reports
 * that it measured nothing rather than reporting the wrong thing. An empty run
 * is loud. A widened one reads like a page full of faults. */
let SCOPE_SEL = null
let SCOPE_EL = null
let scopeLost = false
let scopeLostWhy = ''
const scope = () => {
  if (SCOPE_SEL) {
    const found = document.querySelectorAll(SCOPE_SEL)
    if (found.length === 1) return found[0]
    scopeLost = true
    scopeLostWhy = found.length
      ? SCOPE_SEL + ' now matches ' + found.length + ' elements, so it is not a root'
      : SCOPE_SEL + ' matches nothing, so the root left the document'
    return null
  }
  if (SCOPE_EL) {
    if (document.contains(SCOPE_EL)) return SCOPE_EL
    scopeLost = true
    scopeLostWhy = 'the element passed as the root left the document'
    return null
  }
  return document
}
/* A LOST ROOT READS NO TOKENS EITHER. Falling back to the root element would
   read the HOST's tokens, and a threshold taken from those is a number from
   the wrong document. */
const scopeEl = () => {
  const s = scope()
  if (s === null) return null
  return s === document ? document.documentElement : s
}
const tokenValue = n => {
  const el = scopeEl()
  return el ? getComputedStyle(el).getPropertyValue(n).trim() : ''
}
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

/* Scoped, so a hosted document is measured and its host is not. A reader who
   passes no root gets the whole page, unchanged. */
const all = sel => {
  const s = scope()
  if (s === null) return []
  return Array.prototype.slice.call(s.querySelectorAll(sel)).filter(visible)
}
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

/* DOES THIS CONTROL SHOW ANY WORDS AT ALL, at any depth?
 *
 * A DIFFERENT QUESTION FROM textRect, AND SHARING THAT ONE BLINDED A CHECK.
 * textRect must stay direct-only: the cap-band rules measure an element's OWN
 * text, and a child's rect can start at an ornament instead of at the words.
 *
 * The icon-only rules ask the opposite. A button holding an svg and a
 * <span>Export Statement</span> has no direct text node, so textRect returned
 * null and the control fell into the label-less branch. Measured on one build:
 * eight findings reporting a mark "with no label" 66 to 146px off centre, on
 * five nav items and three labelled controls. That offset is just the distance
 * from a leading mark to the middle of a wide control, which is correct.
 *
 * So ask what the ENGINE renders, and ignore text a screen reader alone sees:
 * a visually hidden label is not visible words. */
function hasWords (el) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walk.nextNode())) {
    if (!n.textContent.trim()) continue
    const p = n.parentElement
    if (!p || !visible(p)) continue
    const r = document.createRange(); r.selectNode(n)
    const b = r.getBoundingClientRect()
    if (b.width > 0 && b.height > 0) return true
  }
  return false
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
  /* SCOPED, like all(). This helper queried the document directly, so 11
     findings survived a scoped run and every one was in the host's own
     interface. One helper outside the scope defeats the scope. */
  const scopeRoot = scope()
  if (scopeRoot === null) return out
  for (const parent of scopeRoot.querySelectorAll('*')) {
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

/* ── A PAGE THAT RUNS NO FRAMES CANNOT SETTLE, AND IT READS AS PERFECTLY AT
 * REST ──
 *
 * A hidden or frozen tab stops the document timeline. Measured on 10 September
 * 2026: the clock advanced 0ms across 976ms of wall clock, while 156
 * transitions all reported a running state and a currentTime of 0. So every
 * finished promise burns its deadline, and a cross-fade never completes. Two
 * trees stay mounted, which is the shape that measures the surface LEAVING.
 *
 * A rect-stability check is the worst affected. Two identical samples read as
 * rested on the first comparison, so a frozen page is maximally at rest. That
 * is the strongest possible false pass.
 *
 * ASK THE CLOCK, NEVER THE VISIBILITY FLAG. visibilityState read hidden while
 * the host reported the pane displayed, so the two disagree. A page that is
 * visible and merely throttled fails in the same way. The clock is the
 * mechanism that breaks, so it is the thing to measure.
 *
 * GEOMETRY IS STILL VALID. Layout runs in a hidden tab, so a rectangle is
 * true. Only the settling, the animation waits and the cross-fade are lost. */
async function clockRuns () {
  const at = () => (document.timeline && document.timeline.currentTime) || 0
  const t0 = at()
  await new Promise(r => setTimeout(r, 150))
  return at() > t0
}
window.verifyClockRuns = clockRuns

/* ONE MEASUREMENT PER RUN, AND ONE SCORER. Asking the clock costs 150ms, and a
   check that presses something settles again, so measuring it per call would
   charge that many times over. verify() sets it and settle() reads it. */
let FRAMES_STOPPED = false

/* MEASURE A SETTLED LAYOUT, NEVER A FRAME. A fixed pause is a guess, and a
   guess fifty milliseconds short measures the entrance animation. Ask the
   browser which animations are running instead, and drop the ones that never
   finish. */
async function settle (deadline) {
  /* A STOPPED CLOCK MAKES THIS WAIT A CERTAINTY, NOT A FAILSAFE. Every
     finished promise is unreachable, so the loop below always spends the whole
     deadline. Skip it and say so, which is faster AND honest. */
  if (FRAMES_STOPPED) return false
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
/* ── A CHECK THAT SAID NOTHING MAY HAVE MEASURED NOTHING ──
 *
 * The source side asserts that every check fires on its own fixture. The
 * render side had no such gate, so a render check whose selector stops
 * matching goes quiet and quiet reads as a pass.
 *
 * Measured on 10 September 2026 over twelve surfaces: 20 of the render checks
 * produced a finding or a note, and the rest produced neither. Each one of
 * those could have been a no-op for as long as it existed.
 *
 * SO THE RUN RECORDS WHICH CHECKS SPOKE. A check absent from one surface is
 * normal, and a check silent across EVERY surface is the fault. That question
 * belongs to whatever drives the surfaces, so the run returns the set rather
 * than deciding.
 *
 * NEITHER CHANNEL IS THE WHOLE ANSWER. A finding says the check ran and found
 * something. A note says it ran and measured a count. Both count as speaking,
 * and a check may legitimately do only one of them on one surface.
 *
 * NO BACKTICK IN THIS COMMENT. It sits inside the template literal that emits
 * this file, and one closed the literal early on the first draft. The build
 * then failed on the words rather than on the code. */
const spoke = new Set()
const ran = []
let current = ''
const fail = (where, msg) => { spoke.add(current); findings.push({ check: current, where, msg }) }
const note = msg => { spoke.add(current); notes.push(current + ': ' + msg) }

async function run (id, body) {
  current = id
  ran.push(id)
  try { await body() } catch (err) { fail('(the check itself)', id + ' threw: ' + err.message) }
}

window.verify = async function verify (root) {
  findings.length = 0; notes.length = 0; spoke.clear(); ran.length = 0
  /* A ROOT THAT MATCHES NOTHING IS WORSE THAN NONE, so take an element or a
     selector and say which one answered. A selector is preferred: it survives
     a re-render, and an element does not. */
  SCOPE_SEL = null; SCOPE_EL = null; scopeLost = false; scopeLostWhy = ''
  if (typeof root === 'string') {
    SCOPE_SEL = root
    const found = document.querySelectorAll(root)
    /* REFUSE AT THE DOOR. An ambiguous root used to widen the run to the whole
       page, so a run over an editor reported the editor. */
    if (found.length !== 1) {
      console.error('VERIFY: the root ' + root + ' matches ' + found.length
        + ' elements, so it is not a root. Nothing was measured.'
        + ' Pass a selector that matches exactly one element, or pass the element.')
      return { pass: false, findings: [], rootAmbiguous: found.length }
    }
  } else if (root && root.querySelectorAll) {
    SCOPE_EL = root
  }
  /* TWO CAUSES, AND ONLY ONE OF THEM IS ABOUT THIS PAGE. An unsettled page is
     still animating, so a reading may be one frame of it. A stopped clock
     cannot settle at all, and waiting longer will never change that. */
  FRAMES_STOPPED = !(await clockRuns())
  if (FRAMES_STOPPED) console.error('VERIFY: the document runs no animation frames, so its clock is'
    + ' stopped. Nothing can settle, every animation wait burns its deadline, and a cross-fade can'
    + ' leave two surfaces mounted, which measures the surface LEAVING. Geometry below is still'
    + ' valid. Bring the tab to the foreground and run again.')
  const settled = await settle()
  if (settled === false && !FRAMES_STOPPED) console.warn('VERIFY: the page never came to rest. Measurements below may be a frame of an animation.')
${blocks}

  console.log('VERIFY  ' + innerWidth + 'x' + innerHeight
    + '  theme=' + (document.documentElement.dataset.theme || 'system')
    + '  pointer=' + (matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine')
    + '  root=' + (SCOPE_SEL || (SCOPE_EL ? 'an element' : 'document'))
    + '  ' + ${checks.length} + ' checks')
  /* ── A RUN THAT LOST ITS ROOT MEASURED NOTHING FROM THAT POINT ON ──
   *
   * And the run above did not widen to the document, it went EMPTY. So the
   * findings printed below stop at the point the root was lost, and this line
   * is the only thing that says how far the run got. It is an error rather
   * than a warning because a short clean list reads exactly like a clean page.
   *
   * The cause, measured on this editor: one check presses the theme control,
   * that control sits inside the preview, and pressing it writes the document
   * and mounts 17 more elements carrying the root's class. */
  if (scopeLost) console.error('VERIFY: the root stopped being a root during this run — '
    + scopeLostWhy + '. Every check after that point measured NOTHING, so this'
    + ' run is incomplete rather than clean. A press inside the root can do this:'
    + ' in a host that renders your document live, a control in the document'
    + ' writes the document.')

  /* ── A VERDICT NAMES ITS OWN COVERAGE, AND THE POINTER IS HALF OF IT ──
   *
   * The floor check asks the pointer, never the width, which is right and it
   * means one run measures one floor. A desktop run compares every control
   * against 24px and reports nothing, and that reads as a verdict about the
   * touch case as well.
   *
   * Measured the day this was added, on twelve surfaces that had all passed
   * on a mouse for weeks: 16 controls under the 44px floor at a coarse
   * pointer. An icon-only button 28x44, because a stated width defeated its
   * own aspect ratio. A select 38.26 beside a 44px tab, because a parity calc
   * outweighed the promotion. A nav action 40 beside its own 44px links.
   *
   * So say which half was not measured. In a browser the other half needs
   * device emulation, which the dev tools of every engine can do. */
  const coarseRun = matchMedia('(pointer: coarse)').matches
  console.log('  - UNMEASURED: the ' + (coarseRun ? 'fine' : 'coarse')
    + '-pointer case. Every target floor above was compared against the '
    + (coarseRun ? 'finger' : 'mouse') + ' minimum only. Run this again with '
    + (coarseRun ? 'a mouse' : 'touch emulation on')
    + ' before calling the targets clean.')
  for (const n of notes) console.log('  - ' + n)
  /* Every run carries the same three sets, pass or fail, so a driver reading
     one branch cannot miss them. */
  const coverage = { ran: ran.slice(), spoke: [...spoke], silent: ran.filter(id => !spoke.has(id)) }
  /* A PASS FROM A PAGE THAT RAN NO FRAMES IS A NARROWER CLAIM, SO IT SAYS SO
     IN THE SAME BREATH. Geometry held, and nothing about settling did. */
  if (FRAMES_STOPPED) coverage.framesStopped = true
  if (!findings.length) { console.log('PASS'); return { pass: true, findings: [], coverage } }

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
  return { pass: false, findings: findings.slice(), coverage }
}

console.log('VERIFY-BROWSER loaded. Run:  await verify()'
  + '   or  await verify(rootSelector)  where the page hosts your document')

})()
`
}
