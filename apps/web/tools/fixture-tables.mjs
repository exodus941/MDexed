/* ── THE FIXTURE THAT PROVES THE TABLE AND PROXIMITY CHECKS ──
 *
 * Four render checks about columns and about the ratio between two gaps had
 * never produced a finding on an injected fault.
 *
 * Every case has a correct twin, and the stylesheet states the RIGHT answer
 * page-wide, so one fault fires one check.
 *
 *   ok-orn   / bad-orn    an ornament column at its content, or stretched
 *   ok-edge  / bad-edge   the first cell on the heading margin, or inset
 *   ok-prox  / bad-prox   two gaps at two to one, or closer than that
 *   ok-split / bad-split  a split that stacks, or a table scrolling beside it
 *
 * Run:  node tools/fixture-tables.mjs
 * Then: http://localhost:5173/fixtures/tables.html
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

/* The heading sits in the same padded box as the table, because the check
   compares the first cell's painted edge with the heading's own. */
const block = (id, title, note, body) => [
  '<section>',
  '  <h2 class="caseTitle">' + title + '</h2>',
  '  <p class="note">' + note + '</p>',
  '  <div class="card" id="' + id + '">' + body + '</div>',
  '</section>',
].join('\n')

const pair = (okId, badId, title, note, ok, bad) => [
  '<div class="two">',
  block(okId, 'RIGHT &mdash; ' + title, note, ok),
  block(badId, 'WRONG &mdash; ' + title, note, bad),
  '</div>',
].join('\n')

const cb = () => '<span class="cbox" role="checkbox" aria-checked="false"'
  + ' aria-label="Select row" tabindex="0"></span>'

/* THE ORNAMENT COLUMN IS NOT THE FIRST ONE. A table whose first cell holds a
   selection checkbox is exempt from the heading-margin check, on purpose: that
   box IS the column's content. With the ornament first, that check skipped the
   whole table and reported nothing. */
const table = () => '<h3 class="tblhead">Invoices</h3><table><tbody>'
  + [['INV-2291', '1,240.00'], ['INV-2290', '860.50'], ['INV-2289', '3,015.25']]
    .map(r => '<tr><td>' + r[0] + '</td><td class="orn">' + cb()
      + '</td><td class="amt">' + r[1] + '</td></tr>').join('')
  + '</tbody></table>'

const groups = () => '<div class="outer">'
  + '<div class="grp"><span class="chip">One</span><span class="chip">Two</span></div>'
  + '<div class="grp"><span class="chip">Three</span><span class="chip">Four</span></div>'
  + '</div>'

const split = () => '<div class="split">'
  + '<div class="scroller"><table class="wide"><tbody><tr>'
  + ['Account', 'Reference', 'Raised', 'Due', 'Amount', 'Status'].map(h => '<td>' + h + '</td>').join('')
  + '</tr></tbody></table></div>'
  + '<aside class="ctx">Context</aside>'
  + '</div>'

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the table and proximity rules</title>',
  '<style>',
  '  :root { color-scheme: light; --space-xs: 8px; --space-sm: 12px;',
  '    --space-lg: 24px; --font-code-family: ui-monospace, monospace }',
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
  '  .tblhead { font-size: 14px; margin: 0 0 8px }',
  '  table { border-collapse: collapse; width: 100% }',
  /* Rows far enough apart that one hairline each is one boundary said once. */
  '  td { padding: 14px var(--space-sm); text-align: start }',
  '  tr + tr td { border-top: 1px solid ' + V.border + ' }',
  /* The outer cell sits on the heading margin, so the first column carries no
     inline-start padding of its own. */
  '  td:first-child { padding-inline-start: 0 }',
  /* A figure in a COLUMN takes the mono face, and an amount an end edge. */
  '  .amt { font-family: var(--font-code-family); text-align: end }',
  /* AN ORNAMENT COLUMN TAKES ITS CONTENT AND NO MORE, so the slack spreads
     across the columns holding data. */
  '  .orn { width: 1% }',
  '  .cbox { display: inline-block; width: 24px; height: 24px; box-sizing: border-box;',
  '          border: 1px solid ' + V.border + '; border-radius: 4px }',
  /* Proximity is a ratio: the gap inside a group against the gap between two.
     Two to one is the bar. */
  '  .outer { display: flex; flex-direction: column; row-gap: var(--space-lg) }',
  '  .grp { display: flex; column-gap: var(--space-xs) }',
  '  .chip { padding: 2px 8px; border: 1px solid ' + V.border + '; border-radius: 999px }',
  /* A SPLIT COLLAPSES BEFORE ITS TABLE SCROLLS. Stacked, the table has the
     whole width and needs no scroller. */
  '  .split { display: flex; flex-direction: column; row-gap: var(--space-sm); width: 300px }',
  '  .scroller { overflow-x: auto; min-width: 0 }',
  '  .wide { width: 520px }',
  '  .ctx { border: 1px solid ' + V.border + '; border-radius: 6px; padding: 8px }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  /* Given a share of the row, an ornament column holds that share at every
     width and takes it out of the columns holding data. */
  '  #bad-orn .orn { width: 40% }',
  /* Any inline-start padding on the outer cell reads as a lean, because the
     heading beside it starts at the content edge. */
  '  #bad-edge td:first-child { padding-inline-start: var(--space-sm) }',
  /* 12 against 8 is 1.5 to 1, so five things read as one run. */
  '  #bad-prox .outer { row-gap: var(--space-sm) }',
  /* Side by side, the table scrolls while the context column keeps its width.
     A destination scrolled out of view is one nobody visits. */
  '  #bad-split .split { flex-direction: row; column-gap: var(--space-sm) }',
  '</style></head><body>',
  '<h1>Fixture: the table and proximity rules</h1>',
  '<p class="lede">Four checks about columns and about the ratio between two',
  ' gaps, each injected once beside the correct form of the same shape.</p>',

  pair('ok-orn', 'bad-orn', 'an ornament column takes its content',
    'A checkbox column and a row-action column take width: 1%, which means your content and no more, and the slack then spreads across the columns holding data.',
    table(),
    table()),

  pair('ok-edge', 'bad-edge', 'the outer cell sits on the heading margin',
    'Equal padding on both outer edges, and the first cell starts where the heading does. An override on the first cell always reads as a lean.',
    table(),
    table()),

  pair('ok-prox', 'bad-prox', 'proximity is a ratio',
    'The gap inside a group against the gap between groups. Two to one is the bar, and below it a reader cannot tell which items belong together.',
    groups(),
    groups()),

  pair('ok-split', 'bad-split', 'a split collapses before its table scrolls',
    'A table may scroll inside its own box, and it should not have to while a column beside it keeps its width. The split stacks first.',
    split(),
    split()),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'tables.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/tables.html and fixtures/VERIFY-BROWSER.js written')
