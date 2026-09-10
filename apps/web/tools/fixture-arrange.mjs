/* ── THE FIXTURE THAT PROVES THE ARRANGEMENT CHECKS ──
 *
 * Six render checks about how a row rearranges had never produced a finding on
 * an injected fault.
 *
 * Every case has a correct twin, and the stylesheet states the RIGHT answer
 * page-wide, so one fault fires one check.
 *
 *   ok-words  / bad-words   a heading that keeps its words, or breaks one
 *   ok-fit    / bad-fit      content inside the page, or past its edge
 *   ok-line   / bad-line     a row that fills its line, or covers an empty one
 *   ok-rule   / bad-rule     a row that breaks by a rule, or under nowrap
 *   ok-rank   / bad-rank     a broken action row in pairs, or ragged
 *   ok-pair   / bad-pair     every pair in one arrangement, or half dissolved
 *
 * ONE FAULT HERE IS ABOUT THE WHOLE PAGE. The sideways-scroll check asks the
 * document, so its case makes this page report one finding for as long as it
 * exists. That is the shape of the rule rather than a defect in the fixture.
 *
 * Run:  node tools/fixture-arrange.mjs
 * Then: http://localhost:5173/fixtures/arrange.html
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

const btn = t => '<button class="btn">' + t + '</button>'
const pairsRow = dissolveSecond => '<div class="action-pairs">'
  + '<div class="pair">' + btn('Discard') + btn('Save draft') + '</div>'
  + '<div class="pair' + (dissolveSecond ? ' loose' : '') + '">' + btn('Review') + btn('Publish') + '</div>'
  + '</div>'

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the arrangement rules</title>',
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
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px; overflow: visible }',
  '  .btn { display: inline-flex; align-items: baseline; height: 28px;',
  '         line-height: 26px; padding: 0 12px; font-size: 14px;',
  '         border: 1px solid ' + V.border + '; border-radius: 6px;',
  '         background: ' + V.surface + '; color: ' + V.text + '; box-sizing: border-box }',
  '',
  /* ── THE RIGHT ANSWER, PAGE-WIDE ── */
  /* A heading keeps every word and takes the lines it needs. */
  '  .title { font-size: 20px; line-height: 28px; margin: 0; width: 120px;',
  '           overflow-wrap: normal }',
  /* Content stays inside the page. A box that must be wider scrolls inside
     its own bounds, and every ancestor down to it carries min-width: 0. */
  '  .wide { width: 240px; height: 24px; background: ' + V.accent + '; border-radius: 4px }',
  '  .scroller { max-width: 100%; overflow-x: auto }',
  /* A row fills the line it takes, or it takes no line. */
  '  .oneline { display: inline-flex; column-gap: var(--space-xs) }',
  /* A row collapses by a RULE that states the new arrangement. `.row` is the
     flex primitive, so anything else placing its children is the fault. */
  /* INLINE, or the correct twin asks for the whole line and fills a quarter of
     it, which is the covers-its-line rule and not this one. */
  '  .row { display: inline-flex; flex-direction: row; flex-wrap: nowrap;',
  '         column-gap: var(--space-xs) }',
  /* A broken action row breaks into PAIRS: two per line, equal, full width. */
  '  .actions { display: flex; flex-wrap: wrap; gap: var(--space-xs); width: 200px }',
  '  .actions > .pairline { display: flex; gap: var(--space-xs); flex: 0 0 100% }',
  '  .actions > .pairline > .btn { flex: 1 1 0 }',
  '  .action-pairs { display: flex; flex-wrap: wrap; gap: var(--space-xs); width: 200px }',
  '  .action-pairs > .pair { display: flex; gap: var(--space-xs); flex: 0 0 100% }',
  '  .action-pairs > .pair > .btn { flex: 1 1 0 }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  /* Anywhere allows a break INSIDE a word, and a title ends with a mark that
     says it continues or not at all. */
  '  #bad-words .title { overflow-wrap: anywhere }',
  /* Wider than the viewport, with nothing between it and the page able to
     clamp. */
  '  #bad-fit .wide { width: 1600px }',
  '  #bad-fit .scroller { overflow-x: visible }',
  /* Block level, so it asks for the whole line and fills a fraction of it. */
  '  #bad-line .oneline { display: flex }',
  /* A GRID the class did not expect. flex-wrap still reads nowrap, so nothing
     wrapped: something else placed the children. */
  '  #bad-rule .row { display: grid; grid-template-columns: 1fr }',
  /* An odd count with no ranking: three buttons at natural width wrap into a
     ragged run rather than into pairs. */
  '  #bad-rank .pairline { display: contents }',
  /* HALF DISSOLVED, which is a row in two arrangements at once. */
  '  #bad-pair .pair.loose { display: contents }',
  '</style></head><body>',
  '<h1>Fixture: the arrangement rules</h1>',
  '<p class="lede">Six checks about how a row rearranges, each injected once',
  ' beside the correct form of the same shape.</p>',

  pair('ok-words', 'bad-words', 'a heading keeps its words',
    'overflow-wrap: anywhere turned Overview into Overvie over w. A title ends with a mark that says it continues, or not at all.',
    '<h3 class="title">Reconciliation overview</h3>',
    '<h3 class="title">Reconciliation overview</h3>'),

  pair('ok-fit', 'bad-fit', 'the page never scrolls sideways',
    'A table may scroll inside its own box. The page may not. A scroller cannot clamp until every ancestor between it and the page carries min-width: 0.',
    '<div class="scroller"><div class="wide"></div></div>',
    '<div class="scroller"><div class="wide"></div></div>'),

  pair('ok-line', 'bad-line', 'a row alone on its line covers it',
    'A row that takes a line of its own covers that line, so whatever it leaves empty is space nobody can use. Either fill it or take no line.',
    '<div class="oneline">' + btn('Filter') + btn('Sort') + '</div>',
    '<div class="oneline">' + btn('Filter') + btn('Sort') + '</div>'),

  pair('ok-rule', 'bad-rule', 'a row collapses by rule, never by wrap',
    'A row on two lines while flex-wrap is nowrap means something other than a wrap rule moved its children: a dissolved wrapper, a grid the class did not expect, or a stated width past the line.',
    '<div class="row">' + btn('One') + btn('Two') + '</div>',
    '<div class="row">' + btn('One') + btn('Two') + '</div>'),

  pair('ok-rank', 'bad-rank', 'a broken action row is ranked',
    'Two buttons per line, equal, covering the whole width. An odd count gives the most important button a line of its own, and that line goes first.',
    /* THE ODD ONE GOES FIRST. A column is pressed from the top, so the single
       button leads. Written the other way round the correct twin laid out
       [2,1] and the check reported both cases. */
    '<div class="actions"><div class="pairline">' + btn('Publish') + '</div><div class="pairline">' + btn('Discard') + btn('Save') + '</div></div>',
    '<div class="actions"><div class="pairline">' + btn('Discard') + btn('Save') + '</div><div class="pairline">' + btn('Publish') + '</div></div>'),

  pair('ok-pair', 'bad-pair', 'a pair dissolves when the row fits',
    'Either the row fits and every pair dissolves, or it does not and every pair holds a line. Half dissolved is one row in two arrangements.',
    pairsRow(false),
    pairsRow(true)),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'arrange.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/arrange.html and fixtures/VERIFY-BROWSER.js written')
