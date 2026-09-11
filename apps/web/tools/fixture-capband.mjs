/* ── THE FIXTURE THAT PROVES A MARK-LED CARD ROW STARTS WHERE TEXT WOULD ──
 *
 * `a-marks-row-starts-where-a-text-row-would`, injected twice.
 *
 *   ok-short / bad-short   a 14px mark INSIDE the line box, corrected or not
 *   ok-tall  / bad-tall    a 32px mark TALLER than it, corrected or not
 *
 * WHY ITS OWN PAGE. The check selects `.dmd .card > :first-child + .row`, so
 * the case has to carry those three class names, and the ink fixture keeps
 * every row a plain span on purpose so one fault fires one check. Bringing
 * `.card` and `.row` onto that page would put the card-flow and row rules on
 * cases that are not about them.
 *
 * THE CORRECT VALUES ARE MEASURED ON THIS PAGE, NOT COPIED FROM THE APP. The
 * app's cap inset is 0.4229em of Manrope. This page is set in system-ui, whose
 * metrics differ, so a copied figure would fault the correct twin. Both
 * numbers below were read off this page with the check's own probe.
 *
 * Run:  node tools/fixture-capband.mjs
 * Then: http://localhost:5173/fixtures/capband.html
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)

const { createInitialState } = await load('state/schema.js')
const { derive } = await load('state/derive.js')

const state = createInitialState()
const R = derive(state).roles.light
const V = { bg: R.bg, surface: R.surface, text: R.text, muted: R['text-muted'], accent: R.accent }

const icon = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
const disc = '<span class="avatar">AH</span>'

const block = (id, title, note, body) => [
  '<section>',
  '  <h2 class="caseTitle">' + title + '</h2>',
  '  <p class="note">' + note + '</p>',
  '  <div class="card" id="' + id + '">',
  '    <h3 class="cardHead">Activity</h3>',
  '    <div class="row">' + body + '</div>',
  '  </div>',
  '</section>',
].join('\n')

const pair = (okId, badId, title, note, body) => [
  '<div class="two">',
  block(okId, 'RIGHT &mdash; ' + title, note, body),
  block(badId, 'WRONG &mdash; ' + title, note, body),
  '</div>',
].join('\n')

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: a mark-led card row starts where text would</title>',
  '<style>',
  '  :root { color-scheme: light; --space-xs: 8px; --space-sm: 12px; --space-md: 16px }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h1 { font-size: 18px; font-weight: 500; margin: 0 0 4px }',
  '  .caseTitle { font-size: 13px; font-weight: 600; margin: 0 0 4px }',
  '  .lede { font-size: 13px; opacity: .7; margin: 0 0 24px; max-width: 80ch }',
  '  .note { font-size: 12.5px; line-height: 1.55; margin: 0 0 10px; max-width: 58ch;',
  '          color: ' + V.muted + ' }',
  '  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px;',
  '         align-items: start; margin-bottom: 24px }',
  '  .icon { width: 14px; height: 14px; flex: 0 0 auto }',
  '  .icon, .icon * { vector-effect: non-scaling-stroke }',
  '  .avatar { width: 32px; height: 32px; flex: 0 0 auto; border-radius: 50%;',
  '            display: inline-block; text-align: center; line-height: 32px;',
  '            font-size: 12px; background: ' + V.accent + '; color: ' + V.bg + ' }',
  '',
  /* ── THE PAGE STATES THE RIGHT ANSWER, AND EACH FAULT IS ONE OVERRIDE ── */
  '  .dmd .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px }',
  '  .dmd .cardHead { font-size: 15px; line-height: 20px; font-weight: 600; margin: 0 }',
  '  .dmd .card > :first-child + .row { display: flex; align-items: center;',
  '                                     gap: var(--space-xs); margin-top: var(--space-sm) }',
  '  .dmd .card > :first-child + .row > .lbl { font-size: 14px; line-height: 22px }',
  /* A MARK INSIDE THE LINE BOX overshoots the cap by half the difference, so
     the row pays that back. A MARK TALLER than it SETS the row's top edge and
     costs the whole cap inset. Two corrections, not one scaled.
     Both figures were read off THIS page with the check's own probe. */
  /* The short case pays back half the overshoot. The tall case pays the WHOLE
     reference, because its mark sets the row edge and starts the ink at 0.
     5.09 was tried first and the check refused it at 1.08px out, correctly. */
  '  .dmd #ok-short .row { padding-top: 1.86px }',
  '  .dmd #ok-tall .row  { padding-top: 6.16px }',
  '',
  /* ── ONE OVERRIDE PER FAULT: the correction simply absent ── */
  '  .dmd #bad-short .row { padding-top: 0 }',
  '  .dmd #bad-tall .row  { padding-top: 0 }',
  '</style></head><body class="dmd">',
  '<h1>Fixture: a mark-led card row starts where text would</h1>',
  '<p class="lede">One check, injected on both of its branches. A card heading',
  ' states its gap once, so every row under it has to start its ink in the same',
  ' place. A mark shorter than the line box and a mark taller than it lose',
  ' different amounts, so they take different corrections.</p>',

  pair('ok-short', 'bad-short', 'a mark inside the line box',
    'A 14px mark in a 22px line box paints above the cap band its label sits in, so the row reads tighter than the paragraph beside it by half the difference.',
    icon + '<span class="lbl">Matched 14 invoices</span>'),

  pair('ok-tall', 'bad-tall', 'a mark taller than the line box',
    'A 32px disc is taller than the line box, so it SETS the row top edge and the row loses the whole distance from a text box top to its cap top. One formula scaled covers neither case.',
    disc + '<span class="lbl">A. Halloran</span>'),

  '<script src="/VERIFY-BROWSER.js"></script>',
  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'capband.html'), html, 'utf8')
console.log('fixture-capband: wrote local/fixtures/capband.html')
console.log('  4 cases, 2 pairs. Open /fixtures/capband.html and read window.verify(document.body).')
