/* ── THE FIXTURE THAT PROVES THE REMAINING CHART CHECKS ──
 *
 * Three render checks about chart furniture had never produced a finding on an
 * injected fault. Each one asks about a LAYER rather than about a colour, and
 * every geometric check passes on all three faults: the boxes exist and sit
 * where the grid put them.
 *
 *   ok-area  / bad-area   an axis layer with area to paint in, or none
 *   ok-ratio / bad-ratio  a grouped chart at two to one, or below it
 *   ok-tick  / bad-tick   tick labels on their gridlines, or half a line out
 *
 * Run:  node tools/fixture-chartfurniture.mjs
 * Then: http://localhost:5173/fixtures/chartfurniture.html
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
const V = { bg: R.bg, surface: R.surface, text: R.text, border: R.border,
  /* ── A GRIDLINE IS ONE STEP QUIETER THAN ITS AXIS ──
   *
   * The first draft read `borderSubtle` with the axis colour as a fallback,
   * and that role resolves to nothing here, so both came out #6d7c8a. The
   * gridline check reported both plots and was right: a gridline in the axis
   * colour turns a plot into a grid of boxes. Derived rather than fallen back
   * on, so it cannot silently equal the axis. */
  subtle: 'color-mix(in oklch, ' + R.border + ' 45%, ' + R.surface + ')',
  accent: R.accent }

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

/* A plot whose value axis is its own layer, so the axis has a declaration to
   be measured against. */
const plot = () => '<div class="chart-lines" role="img" aria-label="Monthly total">'
  + '<div class="chart-plot"><div class="chart-axis"></div>'
  + '<div class="chart-grid"></div></div></div>'

const ticks = () => '<div class="chart-ticked" role="img" aria-label="Monthly total">'
  + '<div class="chart-ticks">' + ['400', '300', '200', '100', '0']
    .map(t => '<span class="tk">' + t + '</span>').join('') + '</div>'
  + '<div class="chart-plot2"><div class="chart-grid"></div></div>'
  + '</div>'

const grouped = () => '<div class="chart-grouped" role="img" aria-label="By region">'
  + '<div class="cols">'
  + [0, 1, 2].map(() => '<div class="grp">'
      + '<span class="bar b1"></span><span class="bar b2"></span></div>').join('')
  + '</div></div>'

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the chart furniture rules</title>',
  '<style>',
  '  :root { color-scheme: light; --space-xs: 8px; --space-sm: 12px; --space-lg: 24px }',
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
  '',
  /* ── THE RIGHT ANSWER, PAGE-WIDE ── */
  /* A line layer has no content, so an absolutely placed box with no inset
     takes nothing. State inset 0 on BOTH axes: the block side gives an axis
     its length and the inline side gives a gradient its width. */
  /* A PLOT IS A SHAPE, SO IT TAKES AN ASPECT RATIO. Stated as a fixed height
     it gives a different proportion at every width, and that check reported
     all four plots here. It was right, and it is not the question this page
     is about. */
  '  .chart-plot, .chart-plot2 { position: relative; width: 200px; aspect-ratio: 2 / 1 }',
  '  .chart-axis { position: absolute; inset: 0;',
  '                border-left: 1px solid ' + V.border + ' }',
  '  .chart-grid { position: absolute; inset: 0; background-image:',
  '     repeating-linear-gradient(to top, ' + V.subtle + ' 0 1px, transparent 1px 25%) }',
  /* A tick label is centred on the gridline it names. space-between
     distributes the label BOXES, so the ends sit half a line out: extend the
     column by half a line at each end and the centres land on the boundaries. */
  /* ── AND THAT OVERHANG LEAVES THE BOX, SO THE CONTAINER PAYS FOR IT ──
     The column is extended half a line at each end, and that half line sits
     outside the plot. Padding on the block axis absorbs exactly it, so the box
     contains its own ink again. Half the TICK's line, 16px, is 8. The inline
     axis stays at zero: the container owns that inset. */
  '  .chart-ticked { display: flex; column-gap: var(--space-xs);',
  '                  padding-block: 8px; padding-inline: 0 }',
  '  .chart-ticks { display: flex; flex-direction: column;',
  '                 justify-content: space-between; text-align: end;',
  '                 font-size: 12px; line-height: 16px;',
  '                 margin-block: -8px; height: calc(100px + 16px) }',
  /* A grouped chart states a ratio: the gap inside a group against the gap
     between two, and two to one is the bar. */
  '  .chart-grouped { width: 220px }',
  '  .chart-grouped > .cols { display: flex; column-gap: var(--space-lg);',
  '                           align-items: flex-end; height: 120px }',
  '  .chart-grouped .grp { display: flex; column-gap: var(--space-xs); flex: 1 1 0;',
  '                        align-items: flex-end; height: 100% }',
  '  .bar { flex: 1 1 0; border-radius: 2px 2px 0 0 }',
  '  .b1 { height: 70%; background: ' + V.accent + ' }',
  '  .b2 { height: 45%; background: color-mix(in oklch, ' + V.accent + ' 45%, ' + V.surface + ') }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  /* With no inset the axis takes its CONTENT, and a line layer has none. It
     computes to the grid area collapsed at its own centre. */
  '  #bad-area .chart-axis { inset: auto }',
  /* 12 against 8 is 1.5 to 1, so the groups dissolve into one run of bars and
     the category axis stops meaning anything. */
  '  #bad-ratio .chart-grouped > .cols { column-gap: var(--space-sm) }',
  /* Without the half-line margin the end labels sit half a line off the
     boundaries they name. */
  '  #bad-tick .chart-ticks { margin-block: 0; height: 100px }',
  /* THE OVERHANG LEFT THE BOX AND NOTHING ABSORBED IT. A card giving the
     title group 12px of clearance then reads as 2.28. */
  '  #bad-pad .chart-ticked { padding-block: 0 }',
  '</style></head><body>',
  '<h1>Fixture: the chart furniture rules</h1>',
  '<p class="lede">Four checks about chart furniture, each injected once beside',
  ' the correct form of the same shape. Every geometric check passes on all',
  ' four faults, because the boxes exist and sit where the grid put them.</p>',

  pair('ok-area', 'bad-area', 'a declared line has area to paint in',
    'An absolutely positioned box with no inset takes its CONTENT, and a line layer has none. It measures a pixel by nothing and paints nothing, while every geometric check passes.',
    plot(),
    plot()),

  pair('ok-ratio', 'bad-ratio', 'a grouped chart states a ratio',
    'The gap inside a group against the gap between them. Under two to one the groups dissolve into one run of bars and the category axis stops meaning anything.',
    grouped(),
    grouped()),

  pair('ok-tick', 'bad-tick', 'a tick label centres on its gridline',
    'space-between distributes the label BOXES, not their centres, so the ends sit half a line out. Extend the column by half a line at each end.',
    ticks(),
    ticks()),

  pair('ok-pad', 'bad-pad', 'a tick column pads the block axis',
    'The column is extended half a line at each end, and that half line leaves the plot. Padding on the block axis absorbs exactly the overhang, so a stated 12px of clearance is 12px rather than 2.28. Only where a column exists: a chart without one has no overhang.',
    ticks(),
    ticks()),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'chartfurniture.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/chartfurniture.html and fixtures/VERIFY-BROWSER.js written')
