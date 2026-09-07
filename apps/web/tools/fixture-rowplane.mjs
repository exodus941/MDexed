/* ── THE FIXTURE THAT PROVES THE ROW-PLANE CHECK ──
 *
 * A render check cannot run in the test suite: it needs a real engine for
 * `getComputedStyle` and a real box for `getBoundingClientRect`. So it is
 * proven in a browser, and this writes the page it is proven against.
 *
 * It is GENERATED rather than hand-written, because every fill has to be the
 * palette's own. A fixture with typed hexes measures a table that this system
 * does not ship, and the whole question here is about the distance between
 * three roles the palette decides.
 *
 * Six tables, and the three quiet ones matter as much as the three loud ones:
 *
 *   ok        the shipped stripe, the selection one step further   silent
 *   okcell    the same, with the selection painted on the CELLS    silent
 *   plain     a ruled table with no stripe at all                  silent
 *   band      a stripe two steps off the surface                   boundary + two-step
 *   order     the selection softer than the stripe                 order
 *   twostep   the selection at the accent                          two-step
 *
 * `okcell` IS THE ONE THAT EARNED ITS PLACE. `preview.css` paints a selection
 * as `tr.is-selected > td`, so the row's own background is transparent on all
 * ten rows. The first version of the check read the row and skipped the whole
 * table, which reads exactly like a pass.
 *
 * Run:  node tools/fixture-rowplane.mjs
 * Then: http://localhost:5173/fixtures/rowplane.html  and in the console
 *       const s = await (await fetch('/fixtures/VERIFY-BROWSER.js')).text()
 *       new Function(s)(); (await verify()).findings
 *       .filter(f => f.check === 'a-stripe-is-rhythm-and-a-selection-is-a-choice')
 *
 * It writes the verifier beside the page, from the same state, so the two
 * cannot describe different palettes.
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
const derived = derive(state)
const R = derived.roles.light
const N = derived.ramps.neutral.steps

const V = {
  bg: R.bg,
  surface: R.surface,
  stripe: R['row-stripe'],
  selected: R.selected,
  text: R.text,
  border: R['border-subtle'],
  /* A stripe far enough out to trip the boundary bar, and a selection further
     still, so that table faults on the stripe rather than on the order. */
  band: N['300'],
  deep: N['500'],
  /* Two steps and then some. This is the baby-blue selection they rejected. */
  loud: R.accent,
}

const ROWS = 10
const CHOSEN = [0, 2]

/* A checked box, because that is how the Index preview declares its choice —
   not with `aria-selected`, which no row there carries. */
const cell = (i, fill) => {
  const bg = fill ? ' style="background:' + fill + '"' : ''
  const on = CHOSEN.includes(i) ? ' checked' : ''
  return '<td' + bg + '><input type="checkbox"' + on + ' aria-label="Select row"></td>'
    + '<td' + bg + '>INV-22' + (91 - i) + '</td>'
    + '<td' + bg + '>Ashford &amp; Kline</td>'
    + '<td' + bg + '>12 Aug</td>'
}

/* The stripe and the selection on the ROW, which is the ordinary shape. */
const onRow = (stripeFill, selFill) => {
  const out = []
  for (let i = 0; i < ROWS; i++) {
    const chosen = CHOSEN.includes(i)
    const fill = chosen ? selFill : (i % 2 === 1 ? stripeFill : 'transparent')
    out.push('<tr style="background:' + fill + '">' + cell(i, null) + '</tr>')
  }
  return out.join('\n')
}

/* The stripe on the row and the selection on the CELLS. */
const onCells = () => {
  const out = []
  for (let i = 0; i < ROWS; i++) {
    const chosen = CHOSEN.includes(i)
    const rowBg = !chosen && i % 2 === 1 ? V.stripe : 'transparent'
    out.push('<tr style="background:' + rowBg + '">'
      + cell(i, chosen ? V.selected : null) + '</tr>')
  }
  return out.join('\n')
}

const noStripe = () => {
  const out = []
  for (let i = 0; i < ROWS; i++) out.push('<tr>' + cell(i, null).replace(' checked', '') + '</tr>')
  return out.join('\n')
}

const block = (id, title, inner) => [
  '<h2>' + title + '</h2>',
  '<div class="card"><table id="' + id + '">',
  '<thead><tr><th>Pick</th><th>Number</th><th>Account</th><th>Due</th></tr></thead>',
  '<tbody>', inner, '</tbody></table></div>',
].join('\n')

const html = [
  '<!doctype html>',
  '<html lang="en" data-theme="light">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Fixture: a stripe is rhythm and a selection is a choice</title>',
  '<style>',
  '  :root { color-scheme: light }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h2 { font-size: 13px; font-weight: 600; margin: 0 0 8px }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px; margin-bottom: 24px }',
  '  table { border-collapse: collapse; width: 100% }',
  '  th, td { padding: 8px 12px; text-align: start }',
  '  tbody tr { border-top: 1px solid ' + V.border + ' }',
  '</style>',
  '</head>',
  '<body>',
  block('ok', 'SILENT — the shipped stripe, the selection one step further', onRow(V.stripe, V.selected)),
  block('okcell', 'SILENT — the same, with the selection painted on the CELLS', onCells()),
  block('plain', 'SILENT — a ruled table with no stripe at all', noStripe()),
  block('band', 'FIRES — a stripe two steps off the surface', onRow(V.band, V.deep)),
  block('order', 'FIRES — the selection softer than the stripe', onRow(V.selected, V.stripe)),
  block('twostep', 'FIRES — the selection two steps off the stripe', onRow(V.stripe, V.loud)),
  '</body>',
  '</html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'rowplane.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))

console.log('fixtures/rowplane.html and fixtures/VERIFY-BROWSER.js written')
console.log('  surface  ' + V.surface)
console.log('  stripe   ' + V.stripe)
console.log('  selected ' + V.selected)
console.log('  band     ' + V.band + '   (the boundary case)')
console.log('  loud     ' + V.loud + '   (the rejected tint)')
