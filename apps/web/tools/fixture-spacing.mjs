/* ── THE FIXTURE THAT PROVES THE FIVE SPACING CHECKS ──
 *
 * The app's own twelve preview surfaces are the correct-code half of the proof
 * and every one of them is silent. This is the other half: a page where each
 * fault is injected on its own, beside the correct form of the same shape, so
 * a finding can be read by id rather than counted.
 *
 * Every case here has a SILENT twin, because a run that measured nothing reads
 * exactly like a passing check. Pointing these at correct code is what found
 * the one real bug in the batch: `px('none')` is 0, so a max-height guard
 * written with it matched every element in the document and reported 24
 * findings on one surface, all of them correct code.
 *
 *   ok-above / bad-below       a separator above each item, or below the last
 *   ok-nogap  / bad-gap        a collapsing row, with and without its own gap
 *   ok-feet   / bad-feet       stretched cards, actions level or ragged
 *   ok-rule   / bad-rule       a section rule centred in its gap, or not
 *   ok-strip  / bad-wrap       a tab strip on one line, or folded onto two
 *                / bad-scroll  and one that declares overflow-x: auto
 *   ok-gap    / bad-gap-axes   a wrapped run of buttons, one gap or two
 *
 * Run:  node tools/fixture-spacing.mjs
 * Then: http://localhost:5173/fixtures/spacing.html
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

const V = {
  bg: R.bg, surface: R.surface, text: R.text,
  line: R['border-subtle'], edge: R.border, accent: R.accent, ink: R['text-muted'],
}

const block = (title, inner) => '<h2>' + title + '</h2>\n' + inner

/* ── A separator above each item, or below the last one ── */
const listRows = (side) => {
  const rows = []
  for (let i = 0; i < 4; i++) {
    const border = side === 'above'
      ? 'border-top:1px solid ' + V.line
      : 'border-bottom:1px solid ' + V.line
    rows.push('<li style="' + border + ';padding:10px 0;list-style:none">Row ' + (i + 1) + '</li>')
  }
  return '<div class="card">'
    + '<ul id="' + (side === 'above' ? 'ok-above' : 'bad-below') + '" style="margin:0;padding:0;border-bottom:1px solid ' + V.edge + '">'
    + rows.join('\n') + '</ul></div>'
}

/* ── A collapsing row, with and without a gap charged above it ── */
const fold = (id, gap) =>
  '<div class="card" id="' + id + '" style="display:flex;flex-direction:column;row-gap:' + gap + 'px">'
  + '<div>A title row</div>'
  + '<div style="max-height:0;overflow:hidden">A panel nobody opened</div>'
  + '</div>'

/* ── Stretched cards: actions level, or ragged ── */
const cards = (id, ragged) => {
  const one = (words, pushed) =>
    '<div style="background:' + V.surface + ';padding:16px;display:flex;flex-direction:column;row-gap:8px;flex:1 1 0;min-width:0">'
    + '<strong>Plan</strong>'
    + '<p style="margin:0">' + words + '</p>'
    + '<div style="' + (pushed ? 'margin-block-start:auto;' : '') + 'display:flex;gap:8px">'
    + '<button>Choose</button></div>'
    + '</div>'
  return '<div id="' + id + '" style="display:flex;align-items:stretch;gap:16px">'
    + one('One short line.', !ragged)
    + one('A description long enough to wrap onto two lines inside its own card.', !ragged)
    + one('One short line.', !ragged)
    + '</div>'
}

/* ── A section rule: centred in its gap, or not ── */
const ruled = (id, above, below) =>
  '<div class="card" id="' + id + '">'
  + '<p style="margin:0 0 ' + above + 'px">A section above the rule.</p>'
  + '<div style="height:1px;background:' + V.line + '"></div>'
  + '<h3 style="margin:' + below + 'px 0 0">A heading below it</h3>'
  + '</div>'

/* ── A tab strip: one line, folded, or scrolling ── */
const strip = (id, style) => {
  const tabs = ['Overview', 'Activity', 'Documents', 'Settings', 'Permissions', 'Integrations']
    .map(t => '<span style="padding:8px 12px;white-space:nowrap">' + t + '</span>').join('')
  return '<div class="card" style="width:320px">'
    + '<nav id="' + id + '" aria-label="Record sections" style="display:flex;gap:4px;' + style + '">'
    + tabs + '</nav></div>'
}

/* ── A wrapped run of buttons: one gap in both axes, or two ── */
const buttonRun = (id, colGap, rowGap) => {
  const b = t => '<button style="flex:1 1 0;min-width:120px;white-space:nowrap">' + t + '</button>'
  return '<div class="card" style="width:300px">'
    + '<div id="' + id + '" style="display:flex;flex-wrap:wrap;column-gap:' + colGap + 'px;row-gap:' + rowGap + 'px">'
    + b('Export') + b('New Invoice') + b('Send') + b('Archive')
    + '</div></div>'
}

const html = [
  '<!doctype html>',
  '<html lang="en" data-theme="light">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Fixture: the spacing and structure rules</title>',
  '<style>',
  '  :root { color-scheme: light }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h2 { font-size: 13px; font-weight: 600; margin: 24px 0 8px }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px }',
  '  button { font: inherit; padding: 6px 12px }',
  '</style>',
  '</head>',
  '<body>',
  block('SILENT — a separator above each item', listRows('above')),
  block('FIRES — a separator below each item, so the last lands on the card edge', listRows('below')),
  block('SILENT — a collapsing row that owns the whole distance', fold('ok-nogap', 0)),
  block('FIRES — a collapsing row with a gap charged above it', fold('bad-gap', 8)),
  block('SILENT — stretched cards whose actions take the free space', cards('ok-feet', false)),
  block('FIRES — stretched cards whose actions sit where the text ends', cards('bad-feet', true)),
  block('SILENT — a rule centred in its own gap', ruled('ok-rule', 16, 16)),
  block('FIRES — a rule sitting on one side of its gap', ruled('bad-rule', 4, 32)),
  block('SILENT — a tab strip on one line', strip('ok-strip', 'flex-wrap:nowrap;overflow:hidden')),
  block('FIRES — a tab strip folded onto two rows', strip('bad-wrap', 'flex-wrap:wrap')),
  block('FIRES — a tab strip that declares a scroller', strip('bad-scroll', 'flex-wrap:nowrap;overflow-x:auto')),
  block('SILENT — a wrapped run of buttons with one gap in both axes', buttonRun('ok-gap', 8, 8)),
  block('FIRES — the same run 8px across and 24px down', buttonRun('bad-gap-axes', 8, 24)),
  '</body>',
  '</html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'spacing.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/spacing.html and fixtures/VERIFY-BROWSER.js written')
