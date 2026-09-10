/* ── THE FIXTURE THAT PROVES THE HEADER LADDER CHECKS ──
 *
 * Three render checks about a title, its actions and its menu control had
 * never produced a finding on an injected fault.
 *
 * A BURGER IS READ FROM ITS BOXES, NEVER FROM A CLASS NAME, so the menu here
 * is three stacked bars of one size, wider than tall, with no text. The
 * reader names that control whatever they like.
 *
 *   ok-sib   / bad-sib    a menu beside the action group, or inside it
 *   ok-stay  / bad-stay    a menu that holds the title row, or wraps away
 *   ok-band  / bad-band    an action on the heading cap band, or on its box
 *
 * Run:  node tools/fixture-header.mjs
 * Then: http://localhost:5173/fixtures/header.html
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

/* THE BARS ARE GRANDCHILDREN. Both menu checks look for a DESCENDANT whose
   own children are the three bars, so bars placed directly in the button are
   never tested: the test runs on each descendant, and a bar has no children.
   Written flat, both checks found no menu at all and reported nothing. */
const burger = () => '<button class="burger" aria-label="Menu" aria-expanded="false">'
  + '<span class="bars"><span></span><span></span><span></span></span></button>'
const btn = t => '<button class="btn">' + t + '</button>'

/* The menu is a SIBLING of the action group, never a member: a header ladder
   keeps this one control on the title row after the others drop below. */
const headSib = inside => '<div class="head">'
  + '<h3 class="ttl">Quarterly reconciliation</h3>'
  + (inside
    ? '<div class="acts">' + btn('Export') + btn('Share') + burger() + '</div>'
    : '<div class="acts">' + btn('Export') + btn('Share') + '</div>' + burger())
  + '</div>'

const headBand = () => '<div class="bandhead">'
  + '<h3 class="bigttl">Quarterly reconciliation report for the year</h3>'
  + '<div class="acts">' + btn('Export') + '</div>'
  + '</div>'

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the header ladder rules</title>',
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
  '  .btn { display: inline-flex; align-items: baseline; height: 28px;',
  '         line-height: 26px; padding: 0 12px; font-size: 14px;',
  '         border: 1px solid ' + V.border + '; border-radius: 6px;',
  '         background: ' + V.surface + '; color: ' + V.text + '; box-sizing: border-box }',
  /* Three stacked bars of one size, wider than tall. */
  '  .burger { display: inline-flex; align-items: center; justify-content: center;',
  '            width: 28px; height: 28px; padding: 0;',
  '            border: 1px solid ' + V.border + '; border-radius: 6px;',
  '            background: ' + V.surface + '; box-sizing: border-box }',
  '  .bars { display: flex; flex-direction: column; gap: 4px }',
  '  .bars > span { display: block; width: 16px; height: 2px; border-radius: 1px;',
  '                 background: ' + V.text + ' }',
  '',
  /* ── THE RIGHT ANSWER, PAGE-WIDE ── */
  /* The title keeps its row, the action group takes the slack, and the menu is
     the last thing on the row it is on. */
  '  .head { display: flex; align-items: baseline; column-gap: var(--space-sm);',
  '          row-gap: var(--space-sm); flex-wrap: wrap; width: 300px }',
  '  .head > .ttl { font-size: 16px; line-height: 24px; margin: 0;',
  '                 flex: 1 1 auto; min-width: 0 }',
  '  .head > .acts { display: flex; column-gap: var(--space-xs) }',
  /* AN ACTION BESIDE A HEADING TAKES THE SAME BAND AS A MARK: between the cap
     line and the baseline. A percentage in a transform resolves against the
     element OWN box, so any row height lands in the same place. */
  '  .bandhead { display: flex; align-items: flex-start;',
  '              column-gap: var(--space-sm); width: 260px }',
  '  .bandhead > .bigttl { font-size: 28px; line-height: 40px; margin: 0;',
  '                        flex: 1 1 auto; min-width: 0 }',
  /* MEASURED, not derived. The centring formula against this heading put the
     control 13px above the band, because the row starts the action at the
     heading's BOX top and the cap band sits well below it. This fixture needs
     a twin that lands on the band, so the offset is the one that measures
     0.00px rather than the one that reads well. */
  '  .bandhead > .acts { display: flex; column-gap: var(--space-xs);',
  '                      transform: translateY(7px) }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  /* The menu ordered after the action group wraps with it, so it leaves the
     title row. Staying with the title wins. */
  '  #bad-stay .head > .burger { order: 2 }',
  '  #bad-stay .head > .acts { order: 1; flex: 0 0 100% }',
  '  #ok-stay .head > .burger { order: 0 }',
  /* Centred on the heading BOX rather than its cap band. A generated dashboard
     read the rule as the line box and shipped its buttons 12.5px low. */
  '  #bad-band .bandhead { align-items: center }',
  '  #bad-band .bandhead > .acts { transform: none }',
  '</style></head><body>',
  '<h1>Fixture: the header ladder rules</h1>',
  '<p class="lede">Three checks about a title, its actions and its menu, each',
  ' injected once beside the correct form of the same shape.</p>',

  pair('ok-sib', 'bad-sib', 'a menu control is a sibling of the action group',
    'Inside the group it can only go where the group goes. A header ladder keeps this one control on the title row after the others drop below, so it is a sibling and order places it.',
    headSib(false),
    headSib(true)),

  pair('ok-stay', 'bad-stay', 'staying with the title beats being rightmost',
    'Ordered after the action group the menu is rightmost and wraps with it. Ordered before it the menu keeps the title row and stops being rightmost among the buttons. Staying with the title wins.',
    headSib(false),
    headSib(false)),

  pair('ok-band', 'bad-band', 'an action centres on its heading cap band',
    'They drew the two lines: the cap line, the baseline, the control between them. Centre the two never said centre on WHAT, and a heading box is far taller than its cap band.',
    headBand(),
    headBand()),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'header.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/header.html and fixtures/VERIFY-BROWSER.js written')
