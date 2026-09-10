/* ── THE FIXTURE THAT PROVES THE INK AND REACH CHECKS ──
 *
 * Two render checks had never produced a finding on an injected fault:
 *
 *   ok-type  / bad-type    a lifted row at its label's type, or at the body's
 *   ok-hook  / bad-hook    a mark the editor can reach, or one it cannot
 *
 * A THIRD PAIR WAS HERE AND ITS CHECK WAS CUT ON 11 September 2026. The
 * oversized-mark case fired on its fixture and then produced 82 findings on
 * correct code over 156 runs, because it measured the mark's CENTRING where
 * the rule is about a container's CLEARANCE. The record is in `checks.js`
 * where the check was. A fixture for a check nobody declares is a page nobody
 * reads, so the pair came out with it.
 *
 * WHY ITS OWN PAGE, AND NOT THE MARKS FIXTURE.
 *
 * `every-drawn-mark-can-be-edited` is gated on the page carrying an inspect
 * hook at all, and once one exists EVERY mark on that page outside a hook is a
 * finding. Added to the marks fixture it would have reported twenty correct
 * marks against the one this case is about, which is the fault that took the
 * rowplane page from 68 findings to 8.
 *
 * EVERY ROW HERE IS A PLAIN SPAN, ON PURPOSE. The cap-band check iterates
 * `button, a, label, .btn, .nav-item, .brand`, so a marked-up holder would put
 * two checks on one case and neither would read as its own proof. A row that
 * is none of those is outside it, and these checks ask about the row rather
 * than about the control.
 *
 * Run:  node tools/fixture-ink.mjs
 * Then: http://localhost:5173/fixtures/ink.html
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)

const { createInitialState } = await load('state/schema.js')
const { derive } = await load('state/derive.js')
const { verifyBrowserFile } = await load('emit/verify.js')

const state = createInitialState()
const R = derive(state).roles.light
const V = { bg: R.bg, surface: R.surface, text: R.text, border: R.border, accent: R.accent }

const svg = cls => '<svg class="icon' + (cls ? ' ' + cls : '') + '"'
  + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
  + ' aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'

/* THE HOOK SITS ON THE CARD. In the editor it is the element an inspector
   attaches to, so a card is the honest place for one, and a card without it is
   the whole of the fault. */
const block = (id, title, note, body, hook) => [
  '<section>',
  '  <h2 class="caseTitle">' + title + '</h2>',
  '  <p class="note">' + note + '</p>',
  '  <div class="card"' + (hook ? ' data-cmp="' + hook + '"' : '')
    + ' id="' + id + '">' + body + '</div>',
  '</section>',
].join('\n')

const pair = (okId, badId, title, note, ok, bad, okHook, badHook) => [
  '<div class="two">',
  block(okId, 'RIGHT &mdash; ' + title, note, ok, okHook),
  block(badId, 'WRONG &mdash; ' + title, note, bad, badHook),
  '</div>',
].join('\n')

/* A row whose LIFT carries the cap-band arithmetic, beside a label set larger
   than the body. The band is stated in em, so it resolves against whichever
   element holds the transform. */
const typeRow = () => '<span class="liftrow">' + svg()
  + '<strong class="bigl">Discard changes</strong></span>'


const hookRow = () => '<span class="pill">' + svg() + '<span class="lbl">Filter</span></span>'

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the ink and reach rules</title>',
  '<style>',
  '  :root { color-scheme: light; --space-xs: 8px; --space-sm: 12px }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h1 { font-size: 18px; font-weight: 500; margin: 0 0 4px }',
  '  .caseTitle { font-size: 13px; font-weight: 600; margin: 0 0 4px }',
  '  .lede { font-size: 13px; opacity: .7; margin: 0 0 24px; max-width: 78ch }',
  '  .note { font-size: 12.5px; line-height: 1.55; margin: 0 0 10px; max-width: 58ch;',
  '          color: color-mix(in oklch, currentColor 62%, transparent) }',
  '  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px;',
  '         align-items: start; margin-bottom: 24px }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px }',
  '  .icon { width: 14px; height: 14px; flex: 0 0 auto }',
  /* AN SVG SCALES ITS STROKE WITH ITS VIEWBOX, so one token paints a
     different weight at every size. Declared on the SHAPES, because the
     property applies to drawn geometry and does not inherit: on the svg alone
     it computes there and `none` on every path inside it. Missing here at
     first, and the weight check reported all four marks. Correctly. */
  '  .icon, .icon * { vector-effect: non-scaling-stroke }',
  '',
  /* ── THE PAGE STATES THE RIGHT ANSWER, AND EACH FAULT OVERRIDES IT ── */
  /* A ROW CARRIES ITS LABEL'S TYPE. The lift sits on the row, so its 0.75em
     band resolves against the row's own font size, and that has to be the
     label's. Left at the body size a 20px heading gets a 14px band. */
  '  .liftrow { display: inline-flex; align-items: baseline; gap: var(--space-xs);',
  '             font-size: 20px; line-height: 28px;',
  '             transform: translateY(calc((100% - 0.75em) / 2)) }',
  '  .liftrow > .bigl { font-size: 20px; font-weight: 500 }',
  /* The mark takes no lift of its own here: two transforms on one mark is two
     writers for one distance, and the row is the one under test. */
  '  .liftrow > .icon { align-self: baseline; transform: none }',
  '',
  /* EVERY DRAWN MARK CAN BE EDITED. The hook is an attribute rather than a
     rule, so this pair has no declaration to state here. */
  '  .pill { display: inline-flex; align-items: baseline; gap: var(--space-xs);',
  '          padding: 2px 10px; border-radius: 999px; font-size: 14px;',
  '          line-height: 20px; border: 1px solid ' + V.border + ' }',
  '  .pill > .icon { align-self: baseline;',
  '                  transform: translateY(calc((100% - 0.75em) / 2)) }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  /* The row left at the body size while its label states 20px. The band then
     computes at 14 and the mark shifts by the difference. */
  '  #bad-type .liftrow { font-size: 14px }',
  '</style></head><body>',
  '<h1>Fixture: the ink and reach rules</h1>',
  '<p class="lede">Two checks, each injected once beside the correct form of',
  ' the same shape. Every row is a plain span, so the cap-band rules do not',
  ' reach these cases and one fault fires one check.</p>',

  pair('ok-type', 'bad-type', 'a row carries its label type',
    'The cap band is stated in em, so it resolves against whichever element carries the transform. A row left at the body size computed a 12px band for a 20px heading and shifted 4px where 2.5 was wanted.',
    typeRow(), typeRow(), 'nav-item', 'nav-item'),

  pair('ok-hook', 'bad-hook', 'every drawn mark can be edited',
    'The burger had no entry, so clicking it offered the links it opens rather than the mark, and its three bars were 16 by 2 because somebody typed that. A mark outside every hook is a mark nothing can state the size of.',
    hookRow(), hookRow(), 'badge', null),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'ink.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/ink.html and fixtures/VERIFY-BROWSER.js written')
