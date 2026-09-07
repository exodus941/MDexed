/* ── THE FIXTURE THAT PROVES THE FOUR CHART CHECKS ──
 *
 * A render check needs a real engine, so it is proven in a browser. The app's
 * own Charts surface is the correct-code half of that proof; this is the other
 * half, and it is written because pointing the checks at correct code found
 * two holes that a clean report would have hidden:
 *
 *   THE GRIDLINE CHECK MEASURED NOTHING. It looked for child line elements,
 *   and the shipped charts paint their gridlines with a repeating gradient on
 *   one box. Fourteen plots, an axis found on twelve, zero gridlines read.
 *
 *   THE PLOT-SHAPE CHECK NEEDED THE ROW-COUNT GUARD. A horizontal bar chart
 *   declares `aspect-ratio: auto` on purpose, because its height comes from
 *   how many bars it has.
 *
 * Eight plots. Four are correct and must stay silent, and each of the four
 * faults is injected on its own so a finding can be read by id rather than
 * counted:
 *
 *   ok-grid      gridlines one step under the axis          silent
 *   ok-zero      one line AT the axis weight, a zero line   silent
 *   ok-bar       aspect-ratio auto, height from its rows    silent
 *   ok-named     a chart with role=img and a label          silent
 *   bad-grid     gridlines in the axis colour               gridline
 *   bad-height   a stated height and no ratio               plot-shape
 *   bad-group    2:1 between groups and inside them         grouped-ratio
 *   bad-focus    a plot with tabindex=0                     chart-name
 *
 * Run:  node tools/fixture-charts.mjs
 * Then: http://localhost:5173/fixtures/charts.html
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

const V = {
  bg: R.bg,
  surface: R.surface,
  text: R.text,
  axis: R.border,
  grid: R['bg-subtle'],
  series: derived.dataviz.categorical[0],
  second: derived.dataviz.categorical[1],
  third: derived.dataviz.categorical[2],
}

/* The gradient the system ships: one line at the hairline, then transparent to
   the next quarter. `to top` so the first line sits on the axis. */
const gridLayer = colour => 'repeating-linear-gradient(to top,'
  + colour + ' 0,' + colour + ' 1px,'
  + 'transparent 1px, transparent 25%)'

const cols = (n, colour) => Array.from({ length: n }, (_, i) =>
  '<div style="flex:1 1 0;align-self:flex-end;height:' + (30 + i * 12) + '%;background:' + colour + '"></div>'
).join('')

/* THE GROUP TAKES `height: 100%`, OR IT HAS NO HEIGHT TO BE A PERCENTAGE OF.
   Written without it, the bars sized to a group that sized to its bars, so
   every group measured zero and the check skipped the whole row. A fixture
   whose fault does not render tests nothing, and it reads exactly like a
   passing check. */
const groups = (inner, between) => {
  const one = '<div style="display:flex;align-items:flex-end;gap:' + inner + 'px;flex:1 1 0;height:100%">'
    + '<div style="flex:1 1 0;height:70%;background:' + V.series + '"></div>'
    + '<div style="flex:1 1 0;height:52%;background:' + V.second + '"></div>'
    + '<div style="flex:1 1 0;height:38%;background:' + V.third + '"></div>'
    + '</div>'
  return '<div class="chart-cols" style="display:flex;align-items:flex-end;gap:' + between + 'px;height:100%">'
    + one.repeat(4) + '</div>'
}

const block = (title, inner) => '<h2>' + title + '</h2>\n<div class="card">' + inner + '</div>'

/* A plot: a grid layer and a series layer in one cell, which is the shape the
   system publishes. `plot` in the class, because the checks ask for it. */
const plot = (opts) => {
  const style = [
    'position:relative',
    'display:grid',
    'grid-template-areas:' + String.fromCharCode(39) + 'plot' + String.fromCharCode(39),
    opts.ratio ? 'aspect-ratio:' + opts.ratio : '',
    opts.height ? 'height:' + opts.height : '',
    'min-block-size:140px',
    'max-inline-size:100%',
    'border-block-end:1px solid ' + V.axis,
    opts.grid ? 'background-image:' + gridLayer(opts.grid) : '',
    'background-position:bottom left',
  ].filter(Boolean).join(';')
  return '<div class="chart-plot" style="' + style + '"'
    + (opts.tabindex != null ? ' tabindex="' + opts.tabindex + '"' : '')
    + '>'
    + '<div style="grid-area:plot;display:flex;align-items:flex-end;gap:8px;height:100%">'
    + (opts.body || cols(6, V.series))
    + '</div>'
    + (opts.zero
      ? '<div style="grid-area:plot;align-self:center;height:1px;width:100%;background:' + V.axis + '"></div>'
      : '')
    + '</div>'
}

const chart = (id, inner, attrs) => '<div class="chart" id="' + id + '"'
  + (attrs || '') + '>' + inner + '</div>'

const html = [
  '<!doctype html>',
  '<html lang="en" data-theme="light">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Fixture: the chart furniture rules</title>',
  '<style>',
  '  :root { color-scheme: light }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h2 { font-size: 13px; font-weight: 600; margin: 0 0 8px }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px; margin-bottom: 24px }',
  '</style>',
  '</head>',
  '<body>',

  block('SILENT — gridlines one step under the axis',
    chart('ok-grid', plot({ ratio: '2 / 1', grid: V.grid }),
      ' role="img" aria-label="Invoices raised, six months, rising from 58 to 108 thousand"')),

  block('SILENT — one line AT the axis weight, which is a zero line',
    chart('ok-zero', plot({ ratio: '2 / 1', grid: V.grid, zero: true }),
      ' role="img" aria-label="Net movement, six months, crossing zero in July"')),

  block('SILENT — a horizontal bar chart, height from its row count',
    '<div class="chart chart-bar" id="ok-bar" role="img" aria-label="Revenue by line, five lines">'
    + plot({ height: 'auto', grid: V.grid, body: cols(5, V.series) }).replace('min-block-size:140px', 'min-block-size:104px')
    + '</div>'),

  block('SILENT — a chart named by a figure and its caption',
    '<figure style="margin:0">'
    + chart('ok-named', plot({ ratio: '2 / 1', grid: V.grid }))
    + '<figcaption>Invoices raised, six months</figcaption></figure>'),

  block('FIRES — gridlines painted in the axis colour',
    chart('bad-grid', plot({ ratio: '2 / 1', grid: V.axis }),
      ' role="img" aria-label="Invoices raised, six months"')),

  block('FIRES — a stated height and no aspect ratio',
    chart('bad-height', plot({ height: '140px', grid: V.grid }),
      ' role="img" aria-label="Invoices raised, six months"')),

  block('FIRES — a grouped chart at 2:1 rather than 3:1',
    '<div class="chart chart-grouped" id="bad-group" role="img" aria-label="Raised, settled and written off, four months">'
    + plot({ ratio: '2 / 1', grid: V.grid, body: groups(8, 16) })
    + '</div>'),

  block('FIRES — a plot in the tab order that answers no key',
    chart('bad-focus', plot({ ratio: '2 / 1', grid: V.grid, tabindex: 0 }),
      ' role="img" aria-label="Invoices raised, six months"')),

  '</body>',
  '</html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'charts.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))

console.log('fixtures/charts.html and fixtures/VERIFY-BROWSER.js written')
console.log('  axis  ' + V.axis)
console.log('  grid  ' + V.grid)
