/* ── THE FIXTURE THAT PROVES THE ROW AND CONTROL CHECKS ──
 *
 * Seven render checks about rows, baselines and control boxes had never
 * produced a finding on an injected fault.
 *
 * Every case has a correct twin, and the stylesheet states the RIGHT answer
 * for the whole page, so one fault fires one check. A page where everything is
 * wrong reports every check at once and proves none of them.
 *
 *   ok-heights / bad-heights   two controls in a row at one height, or two
 *   ok-base    / bad-base      two runs on one baseline, or centred apart
 *   ok-inline  / bad-inline    a painted box that can take a size, or inline
 *   ok-centre  / bad-centre    a stated height whose label centres, or is pinned
 *   ok-shrink  / bad-shrink    a flexible box floored at its word, or cutting it
 *   ok-target  / bad-target    a control clearing the pointer floor, or under it
 *   ok-lift    / bad-lift      a cap-band lift reset on a wrap, or surviving it
 *
 * Run:  node tools/fixture-rows.mjs
 * Then: http://localhost:5173/fixtures/rows.html
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

const svg = () => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'

const block = (id, title, note, body) => [
  '<section>',
  '  <h2>' + title + '</h2>',
  '  <p class="note">' + note + '</p>',
  '  <div class="card" id="' + id + '"><div class="row">' + body + '</div></div>',
  '</section>',
].join('\n')

const pair = (okId, badId, title, note, ok, bad) => [
  '<div class="two">',
  block(okId, 'RIGHT &mdash; ' + title, note, ok),
  block(badId, 'WRONG &mdash; ' + title, note, bad),
  '</div>',
].join('\n')

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the row and control rules</title>',
  '<style>',
  '  :root { color-scheme: light; --cmp-button-icon-size: 14px; --icon-gap: 8px }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h1 { font-size: 18px; font-weight: 500; margin: 0 0 4px }',
  '  h2 { font-size: 13px; font-weight: 600; margin: 0 0 4px }',
  '  .lede { font-size: 13px; opacity: .7; margin: 0 0 24px; max-width: 78ch }',
  '  .note { font-size: 12.5px; line-height: 1.55; margin: 0 0 10px; max-width: 58ch;',
  '          color: color-mix(in oklch, currentColor 62%, transparent) }',
  /* START, NEVER STRETCH. Stretched to one height, two cards put their action
     rows at two heights, and the card-actions check reported that on every
     pair. It was right, and it is a question this page is not about. */
  '  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px;',
  '         align-items: start; margin-bottom: 24px }',
  /* A FLEX ITEM IS BLOCKIFIED, so `display: inline` on a child of the case row
     computes to block and the inline-size check can never see it. The swatch
     needs a plain block parent. */
  '  .plain { display: block }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px }',
  '  .row { display: inline-flex; align-items: baseline; gap: 16px }',
  '',
  /* ── THE RIGHT ANSWER, PAGE-WIDE ──
   * A control states its height, and its line-height equals the CONTENT box:
   * the stated height minus the borders. 28 with a 1px edge each side gives
   * 26, and forcing 28 puts the label a pixel low. */
  '  .btn { display: inline-flex; align-items: baseline; gap: var(--icon-gap);',
  '         height: 28px; line-height: 26px; padding: 0 12px; font-size: 14px;',
  '         border: 1px solid ' + V.border + '; border-radius: 6px;',
  '         background: ' + V.surface + '; color: ' + V.text + '; box-sizing: border-box }',
  '  .icon { width: var(--cmp-button-icon-size); height: var(--cmp-button-icon-size);',
  '          flex: 0 0 auto; vertical-align: baseline; align-self: baseline;',
  '          transform: translateY(calc((100% - 0.75em) / 2)) }',
  '  .icon, .icon * { vector-effect: non-scaling-stroke }',
  '  .icon-only { aspect-ratio: 1; padding: 0; justify-content: center;',
  '               align-items: center; height: 28px }',
  '  .icon-only .icon { transform: none; align-self: center }',
  /* A painted box takes display: block, because inline ignores every width. */
  '  .swatch { display: block; width: 120px; height: 20px;',
  '            background: ' + V.accent + '; border-radius: 4px }',
  /* A flexible box floored at its own word. flex: 1 with min-width: 0 lets a
     box shrink under its label, and nothing leaves the box, so no overflow
     check reports it. */
  /* WRAP, because the rule's own answer is to floor the box at max-content and
     let the row wrap. Without that the correct twin overflows its row and the
     row-fits check reports it, which is a second rule this case is not about. */
  '  .flexcol { display: flex; flex-wrap: wrap; gap: 12px; width: 180px }',
  '  .flexcol > .cell { flex: 1 1 0; min-width: max-content; overflow: hidden;',
  '                     border: 1px solid ' + V.border + '; padding: 4px 8px; border-radius: 4px }',
  /* The cap-band lift costs no layout, which is why it can overlap once the
     actions wrap onto a line of their own. Reset it in the block that
     declares the collapse. */
  '  .head { display: flex; align-items: baseline; gap: 16px; width: 240px; flex-wrap: wrap }',
  '  .head h3 { font-size: 24px; line-height: 32px; margin: 0; flex: 1 1 auto; min-width: 0 }',
  '  .head .acts { transform: translateY(calc(50% - 16px)) }',
  '  @media all { .head { container-type: inline-size } }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  '  #bad-heights .tall { height: 36px; line-height: 34px }',
  '  #bad-base .row { align-items: center }',
  '  #bad-inline .swatch { display: inline }',
  /* A stated height with a line-height that does not match its content box.
     Baseline alignment then packs the single flex line to the top and leaves
     every pixel of slack underneath. */
  '  #bad-centre .btn { height: 44px }',
  '  #bad-shrink > .row > .flexcol > .cell { min-width: 0 }',
  '  #bad-target .icon-only { height: 20px }',
  /* The lift has to be big enough to produce a measurable overlap. Written as
     the centring formula against this heading it comes to 2px, which is under
     the quarter-pixel bar the check uses and reported nothing. */
  /* Bigger than the row gap, or the lift eats the clearance and stops there.
     Measured at 14px against a 16px gap: the actions came to rest 2px clear
     of the heading and the check correctly reported nothing. */
  '  #bad-lift .acts { transform: translateY(-24px) }',
  '  #ok-lift .acts { transform: none }',
  '</style></head><body>',
  '<h1>Fixture: the row and control rules</h1>',
  '<p class="lede">Seven checks about rows, baselines and control boxes, each',
  ' injected once beside the correct form of the same shape.</p>',

  pair('ok-heights', 'bad-heights', 'one height per control row',
    'A row that centres two heights MUST show two tops, and that reads as a misalignment it is not. The tops differ by exactly half the height difference.',
    '<button class="btn">Cancel</button><button class="btn">Save</button>',
    '<button class="btn">Cancel</button><button class="btn tall">Save</button>'),

  pair('ok-base', 'bad-base', 'one baseline per row',
    'Two runs of text in one row sit on one line, whatever their size. Centring them instead is the commonest way this breaks.',
    '<span>Invoices</span><span style="font-size:24px">128</span>',
    '<span>Invoices</span><span style="font-size:24px">128</span>'),

  /* THE SIZE GOES IN THE STYLE ATTRIBUTE, because the check reads el.style.
     A width in the stylesheet is not what the author asked this element for,
     and the first draft put it there and reported nothing. */
  pair('ok-inline', 'bad-inline', 'an inline box has no size',
    'A box that computes to display: inline ignores every width and height it asks for. It renders at its content and nothing reports the difference.',
    '<div class="plain"><span class="swatch" style="width:120px;height:20px"></span></div>',
    '<div class="plain"><span class="swatch" style="width:120px;height:20px"></span></div>'),

  pair('ok-centre', 'bad-centre', 'a fixed-height control centres its label',
    'Baseline alignment pins a label to the top of a fixed-height box, and so does a single flex line in a box taller than its content. The line-height equals the content box.',
    '<button class="btn">Publish</button>',
    '<button class="btn">Publish</button>'),

  pair('ok-shrink', 'bad-shrink', 'a flexible box holds its own label',
    'flex: 1 with min-width: 0 lets a box shrink under its own label. Nothing leaves the box, so no overflow check reports it. Floor it at max-content and let the row wrap.',
    '<div class="flexcol"><div class="cell">Reconciliations</div><div class="cell">Adjustments</div></div>',
    '<div class="flexcol"><div class="cell">Reconciliations</div><div class="cell">Adjustments</div></div>'),

  pair('ok-target', 'bad-target', 'a control clears the floor for its pointer',
    'A mouse minimum is 24px and a finger is 44. A control clears the floor when its targets do, never when its container does.',
    '<button class="btn icon-only" aria-label="Next">' + svg() + '</button>',
    '<button class="btn icon-only" aria-label="Next">' + svg() + '</button>'),

  pair('ok-lift', 'bad-lift', 'a lift must not survive a wrap',
    'A transform costs no layout, which is why it can overlap. Where the actions wrap onto a line of their own there is nothing to centre against, and the same lift pulls them over whatever is above.',
    '<div class="head"><h3>Quarterly reconciliation report</h3><div class="acts"><button class="btn">Export</button></div></div>',
    '<div class="head"><h3>Quarterly reconciliation report</h3><div class="acts"><button class="btn">Export</button></div></div>'),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'rows.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/rows.html and fixtures/VERIFY-BROWSER.js written')
