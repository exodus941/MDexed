/* ── THE FIXTURE THAT PROVES THE FIVE SPACING CHECKS ──
 *
 * The app's own twelve preview surfaces are the correct-code half of the proof
 * and every one of them is right. This is the other half: a page where each
 * fault is injected on its own, beside the correct form of the same shape, so
 * a finding can be read by id rather than counted.
 *
 * Every case here has a correct twin, because a run that measured nothing reads
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

const block = (title, note, inner) => '<h2>' + title + '</h2>'
  + '<p class="note">' + note + '</p>' + inner

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
    + '<div style="' + (pushed ? 'margin-block-start:auto;' : '') + 'display:flex;gap:8px;padding-block-start:8px">'
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

/* ── A button after a text block: 16px of clearance, or 8 ── */
const clearance = (id, pad) =>
  '<div class="card" id="' + id + '" style="width:320px;display:flex;flex-direction:column;row-gap:8px">'
  + '<strong>Next step</strong>'
  + '<p style="margin:0">Raise a credit note for INV-2291 before the period closes.</p>'
  + '<div style="display:flex;gap:8px;padding-block-start:' + pad + 'px"><button>Open invoice</button></div>'
  + '</div>'
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
  '  h2 { font-size: 13px; font-weight: 600; margin: 24px 0 4px }',
  '  .note { font-size: 12.5px; line-height: 1.55; margin: 0 0 10px; max-width: 74ch;',
  '          color: color-mix(in oklch, currentColor 62%, transparent) }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px }',
  '  button { font: inherit; padding: 6px 12px }',
  '</style>',
  '</head>',
  '<body>',
  block('RIGHT — a separator above each item',
    'Four rows. The rule is on each row top edge. The first row has nothing above it, so it draws none. The last row draws none at its bottom.',
    listRows('above')),
  block('WRONG — a separator below each item, so the last lands on the card edge',
    'The same four rows with the rule on the bottom edge. The last row rule sits 0px from the card own border. Two 1px lines, 0px apart, separating nothing.',
    listRows('below')),
  block('RIGHT — a closed panel with no gap charged',
    'A card with a closed panel. The panel is max-height 0. The card row-gap is 0px. The closed panel adds 0px to the card height.',
    fold('ok-nogap', 0)),
  block('WRONG — a collapsing row with a gap charged above it',
    'The same card with row-gap 8px. The gap is charged even though the row is empty. The card is 8px taller than its visible content. Put the 8px in the panel padding instead.',
    fold('bad-gap', 8)),
  block('RIGHT — stretched cards with their buttons at the foot',
    'Three cards, all 156px tall. The middle description takes two lines. Every button has margin-block-start: auto, so all three end 0px from their card foot. The action row also holds 8px of padding on top of the card 8px row gap: 16px minimum between the text and the button, and 37px on the two short cards where the margin takes the slack.',
    cards('ok-feet', false)),
  block('WRONG — stretched cards whose actions sit where the text ends',
    'The same three without margin-block-start: auto. Each button still clears its text by 16px. It sits where its own text ends, so the two short cards put theirs 21px above the card foot and the middle one 0px.',
    cards('bad-feet', true)),
  block('RIGHT — a rule centred in its own gap',
    'A 1px rule between two sections. 16px above it and 16px below it. The boundary takes the same height whether or not the rule is drawn.',
    ruled('ok-rule', 16, 16)),
  block('WRONG — a rule sitting on one side of its gap',
    'The same rule with 4px above and 32px below. It sits 8 times closer to the section above than to the one below.',
    ruled('bad-rule', 4, 32)),
  block('RIGHT — a tab strip on one line',
    'Six tabs in a 320px card. flex-wrap: nowrap and overflow: hidden. One line. The tabs past 320px are clipped.',
    strip('ok-strip', 'flex-wrap:nowrap;overflow:hidden')),
  block('WRONG — a tab strip on two rows',
    'The same six with flex-wrap: wrap. Two rows. Measured once at 92px tall for four tabs in a 248px pane. Swap the strip for a select at the width where it stops fitting.',
    strip('bad-wrap', 'flex-wrap:wrap')),
  block('WRONG — a tab strip with a horizontal scrollbar',
    'The same six with overflow-x: auto. Tabs past 320px are reachable only by scrolling. A scrollbar also takes 10px of height from this strip and 0px from the one beside it.',
    strip('bad-scroll', 'flex-wrap:nowrap;overflow-x:auto')),
  block('RIGHT — a wrapped run of buttons with one gap in both axes',
    'Four buttons in a 300px card. column-gap 8px, row-gap 8px. Two lines. The same 8px in both directions.',
    buttonRun('ok-gap', 8, 8)),
  block('WRONG — the same run 8px across and 24px down',
    'The same four with column-gap 8px and row-gap 24px. The vertical distance is 3 times the horizontal one, so the two lines read as two separate rows of buttons.',
    buttonRun('bad-gap-axes', 8, 24)),

  block('RIGHT — a button 16px below the text that explains it',
    'A card with row-gap 8px. The action row carries 8px of its own padding, so the button sits 16px below the paragraph. A control needs more clearance than the card own rhythm.',
    clearance('ok-clear', 8)),

  block('WRONG — the same button 8px below the text',
    'The same card with no padding on the action row, so the button sits 8px below the paragraph. At the card own step it reads as one more line of the paragraph rather than as something you press.',
    clearance('bad-clear', 0)),
  '</body>',
  '</html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'spacing.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/spacing.html and fixtures/VERIFY-BROWSER.js written')
