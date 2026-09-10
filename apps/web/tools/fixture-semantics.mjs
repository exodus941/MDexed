/* ── THE FIXTURE THAT PROVES THE SEMANTIC CHECKS ──
 *
 * Six render checks about what the markup DECLARES had never produced a
 * finding on an injected fault. Paint is not a state, and a run that looks
 * right measures the same as one a reader can use.
 *
 * Every case has a correct twin, and the stylesheet states the RIGHT answer
 * page-wide, so one fault fires one check.
 *
 *   ok-marked  / bad-marked   the chosen item declares itself, or only paints
 *   ok-tab     / bad-tab      a tab names its panel, or names nothing
 *   ok-stop    / bad-stop     one tab stop for the group, or one per item
 *   ok-overlay / bad-overlay  a panel that says it is a dialog, or does not
 *   ok-mean    / bad-mean     a marker with a word, or a hue alone
 *   ok-alive   / bad-alive    a class that reaches its element, or one that does not
 *
 * Run:  node tools/fixture-semantics.mjs
 * Then: http://localhost:5173/fixtures/semantics.html
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
  accent: R.accent, danger: R.danger || R.accent, subtle: R.bgSubtle || R.surface }

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

/* Four items, so a run has something to be the odd one out of, and the marked
   one is a LIKE thing: the same tag appears more than once. */
const navRun = markedAttr => '<nav class="run">'
  + '<a href="#a" class="navitem marked"' + markedAttr + '>Ledgers</a>'
  + '<a href="#b" class="navitem">Journals</a>'
  + '<a href="#c" class="navitem">Reports</a>'
  + '<a href="#d" class="navitem">Settings</a>'
  + '</nav>'

const tabStrip = (full, stops) => '<div role="tablist" class="strip" aria-label="Views">'
  + ['One', 'Two', 'Three'].map((t, i) => '<button role="tab" class="tabitem"'
    + (full ? ' aria-selected="' + (i === 0 ? 'true' : 'false') + '" aria-controls="panel-' + (stops ? 'b' : 'a') + i + '"' : '')
    + ' tabindex="' + (stops ? '0' : (i === 0 ? '0' : '-1')) + '">' + t + '</button>').join('')
  + '</div>'
  + (full ? ['One', 'Two', 'Three'].map((t, i) => '<div role="tabpanel" id="panel-'
      + (stops ? 'b' : 'a') + i + '" aria-labelledby="x" hidden></div>').join('') : '')

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the semantic rules</title>',
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
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px;',
  '          position: relative; min-height: 96px }',
  '  .run { display: inline-flex; align-items: baseline; column-gap: var(--space-sm) }',
  '  .navitem { color: ' + V.text + '; text-decoration: none; padding: 4px 8px;',
  '             border-radius: 4px; min-height: 24px; display: inline-block }',
  /* ── A MARKED ROW TAKES A REAL STEP OFF ITS GROUND ──
   *
   * The first draft filled it with the recessed role, which on this card is
   * the same colour: 1.00:1, so nothing showed. The selection check reported
   * it on every marked item, four times, and was right each time. A selection
   * has to be FOUND by the eye rather than noticed once you are looking. */
  '  .marked { font-weight: 600;',
  '            background: color-mix(in oklch, ' + V.accent + ' 14%, ' + V.surface + ') }',
  /* And an unmarked tab paints no fill at all, or every one of them reads as
     a marked row sitting on its own colour. */
  '  .tabitem { background: transparent }',
  /* TWO CLASSES, NOT ONE ATTRIBUTE. Written as [aria-selected="true"] it
     weighs the same as .tabitem, and order decided it: the transparent fill
     came later and won, so every selected tab still read 1.00:1. */
  '  .tabitem[aria-selected="true"] { background: color-mix(in oklch, ' + V.accent + ' 14%, ' + V.surface + ') }',
  '  .pale { background: ' + V.surface + ' }',
  '  .strip { display: inline-flex; flex-wrap: nowrap; column-gap: 4px }',
  '  .tabitem { height: 28px; line-height: 26px; padding: 0 10px; font-size: 14px;',
  '             border: 1px solid ' + V.border + '; border-radius: 6px;',
  '             background: ' + V.surface + '; color: ' + V.text + '; box-sizing: border-box }',
  '  .panel { position: absolute; inset: 16px; background: ' + V.surface + ';',
  '           border: 1px solid ' + V.border + '; border-radius: 8px; padding: 12px }',
  '  .panel h3 { font-size: 14px; margin: 0 0 8px }',
  '  .dotrow { display: inline-flex; align-items: baseline; column-gap: var(--space-xs) }',
  '  .dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto;',
  '         background: ' + V.danger + '; align-self: baseline;',
  '         transform: translateY(calc((100% - 0.75em) / 2)) }',
  /* A class that reaches its element only inside another box. On anything else
     it is a class that exists in the stylesheet and styles nothing here. */
  '  .parenty .scoped { color: ' + V.accent + ' }',
  /* ── A CLASS WITH ENOUGH PROPERTIES TO BE RE-IMPLEMENTED ──
     Its own class, used by BOTH twins, because a class carried by one case
     only is dead in the other and that fires a different check. The bad twin
     adds nothing new: it restates four of these inline, which is the stray. */
  '  .chipish { display: inline-flex; align-items: center; box-sizing: border-box;',
  '             height: 24px; line-height: 22px; padding: 0 8px; border-radius: 6px;',
  '             background: ' + V.surface + '; color: ' + V.text + ';',
  '             border: 1px solid ' + V.border + ' }',
  '</style></head><body>',
  '<h1>Fixture: the semantic rules</h1>',
  '<p class="lede">Six checks about what the markup declares, each injected once',
  ' beside the correct form of the same shape.</p>',

  pair('ok-marked', 'bad-marked', 'a marked item says so',
    'Exactly one item in a run painted differently reads as the chosen one. A screen reader is never told, and a mark drawn with a fill disappears under forced colors.',
    navRun(' aria-current="page"'),
    navRun('')),

  pair('ok-tab', 'bad-tab', 'a tab names its panel',
    'aria-selected goes on EVERY tab, false as well as true. aria-controls points at the panel id, and the panel takes its name from its own tab.',
    tabStrip(true, false),
    tabStrip(false, false)),

  pair('ok-stop', 'bad-stop', 'a composite widget is one tab stop',
    'Tab enters the group and lands on the active item, and the arrows move within it. Built with a tabindex on every item, a strip of three costs three presses to walk past.',
    tabStrip(true, false),
    tabStrip(true, true)),

  pair('ok-overlay', 'bad-overlay', 'an overlay says it is one',
    'A panel that paints over the page puts the page behind it out of play. Nothing tells a reader that unless the panel declares it. The role goes on the panel, never on the scrim.',
    '<div class="panel modalish" role="dialog" aria-modal="true" aria-labelledby="ov-ok"><h3 id="ov-ok">Discard changes</h3><button class="tabitem">Discard</button></div>',
    '<div class="panel modalish"><h3>Discard changes</h3><button class="tabitem">Discard</button></div>'),

  pair('ok-mean', 'bad-mean', 'meaning never rests on colour alone',
    'No categorical palette survives the loss of red-green vision, so a green success and a red danger land in the same place on the axis that is left. A shape or a word is what makes it certain.',
    '<span class="dotrow"><span class="dot danger"></span><span>Failed</span></span>',
    '<span class="dotrow"><span class="dot danger"></span></span>'),

  pair('ok-alive', 'bad-alive', 'a class styles something where it sits',
    'A class that exists somewhere and reaches nothing here reads in the source as though the work is done. Only the DOM can answer it.',
    '<div class="parenty"><span class="scoped">Accented here</span></div>',
    '<div><span class="scoped">Accented nowhere</span></div>'),

  pair('ok-sel', 'bad-sel', 'a selected row is a step off its ground',
    'A selection has to be found by the eye, not noticed once you are already looking. A fill equal to its ground is absent rather than subtle.',
    '<nav class="run"><a href="#p" class="navitem marked" aria-current="page">Chosen</a><a href="#q" class="navitem">Other</a><a href="#r" class="navitem">Third</a></nav>',
    '<nav class="run"><a href="#p" class="navitem pale" aria-current="page">Chosen</a><a href="#q" class="navitem">Other</a><a href="#r" class="navitem">Third</a></nav>'),

  /* ── THE STRAY, AND THE TWO TWINS ARE PIXEL-IDENTICAL ──
     That is the whole point of it. The bad twin restates four properties its
     own class already declares, so it renders the same and carries a second
     answer to the same question. A screen reads correct and the primitive is
     re-implemented in it. */
  pair('ok-stray', 'bad-stray', 'an element does not re-implement its own class',
    'The two look the same. The second restates its class inline, so the class carries one answer and the element another, and the next change to the class reaches only one of them.',
    '<span class="chipish">Draft</span>',
    '<span class="chipish" style="height: 24px; line-height: 22px; padding: 0 8px; border-radius: 6px">Draft</span>'),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'semantics.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/semantics.html and fixtures/VERIFY-BROWSER.js written')
