/* ── THE FIXTURE THAT PROVES THE THEME TOGGLE CHECK ──
 *
 * A control that changes nothing measures the same as one that works, because
 * a click that does nothing leaves no trace. This is the last render check
 * that had never produced a finding on an injected fault.
 *
 * IT GETS A PAGE OF ITS OWN, because the check presses the FIRST control it
 * matches. Two controls on one page means only one of them is ever pressed,
 * so a faulty case and a correct case cannot share a page.
 *
 * AND THE CORRECT CASE IS THE APP ITSELF. Its twelve surfaces carry a working
 * theme control, and the matrix reports 0 findings on all of them at 1280.
 * That is a measured correct case rather than a described one, so nothing is
 * lost by leaving it off this page.
 *
 *   bad-toggle   a control that states itself and changes no painted colour
 *
 * Run:  node tools/fixture-toggle.mjs
 * Then: http://localhost:5173/fixtures/toggle.html
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
const V = { bg: R.bg, surface: R.surface, text: R.text, border: R.border }

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the theme toggle rule</title>',
  '<style>',
  '  :root { color-scheme: light }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h1 { font-size: 18px; font-weight: 500; margin: 0 0 4px }',
  '  .caseTitle { font-size: 13px; font-weight: 600; margin: 0 0 4px }',
  '  .lede { font-size: 13px; opacity: .7; margin: 0 0 24px; max-width: 78ch }',
  '  .note { font-size: 12.5px; line-height: 1.55; margin: 0 0 10px; max-width: 58ch;',
  '          color: color-mix(in oklch, currentColor 62%, transparent) }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px }',
  '  .btn { display: inline-flex; align-items: baseline; height: 28px;',
  '         line-height: 26px; padding: 0 12px; font-size: 14px;',
  '         border: 1px solid ' + V.border + '; border-radius: 6px;',
  '         background: ' + V.surface + '; color: ' + V.text + '; box-sizing: border-box }',
  '</style></head><body>',
  '<h1>Fixture: the theme toggle rule</h1>',
  '<p class="lede">One control, because the check presses the first one it',
  ' matches. The correct case is the app itself, which carries a working',
  ' control on every surface and reports nothing.</p>',
  '<section>',
  '  <h2 class="caseTitle">WRONG &mdash; the toggle actually toggles</h2>',
  '  <p class="note">A press changes nothing. It states which theme is on, it',
  '   is reachable, it is named, and every painted colour on the page is',
  '   identical before and after. A click that does nothing measures the same',
  '   as a click that works.</p>',
  '  <div class="card" id="bad-toggle">',
  '    <button class="btn" aria-pressed="false" aria-label="Dark theme is off">Theme</button>',
  '  </div>',
  '</section>',
  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'toggle.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/toggle.html and fixtures/VERIFY-BROWSER.js written')
