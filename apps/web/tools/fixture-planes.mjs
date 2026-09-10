/* ── THE FIXTURE THAT PROVES THE PLANE AND TYPE CHECKS ──
 *
 * Seven render checks about a fill against its ground, and about a type role
 * being one decision, had never produced a finding on an injected fault.
 *
 * These read TOKENS, so the page publishes them. A check that resolves no
 * token reports that it measured nothing, which is not a proof either.
 *
 *   ok-date  / bad-date   a month name in the body face, or in the mono one
 *   ok-fig   / bad-fig    a lone figure in the body face, or in the mono one
 *   ok-role  / bad-role   one role's size and leading, or two roles mixed
 *   ok-shape / bad-shape  a filled square clear of its ground, or on it
 *   ok-tint  / bad-tint   a tint near its ground's chroma, or far past it
 *   ok-sel   / bad-sel    a selection on a card, or on its own colour
 *   ok-edge  / bad-edge   a bar paid for in padding, or eating the inset
 *
 * Run:  node tools/fixture-planes.mjs
 * Then: http://localhost:5173/fixtures/planes.html
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

const row = cls => '<div class="list">'
  + '<div class="litem ' + cls + '" aria-current="page">Chosen row</div>'
  + '<div class="litem">Another row</div>'
  + '<div class="litem">A third row</div>'
  + '</div>'

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the plane and type rules</title>',
  '<style>',
  '  :root { color-scheme: light;',
  /* Published, because every check below reads one of these. */
  '    --font-body-md-family: system-ui, sans-serif;',
  '    --font-body-md-size: 14px; --font-body-md-leading: 1.5;',
  '    --font-h3-size: 20px; --font-h3-leading: 1.4;',
  '    --font-caption-size: 12px; --font-caption-leading: 1.4;',
  '    --font-code-family: ui-monospace, monospace;',
  '    --c-selected: color-mix(in oklch, ' + V.accent + ' 14%, ' + V.surface + ');',
  '    --space-sm: 12px; --space-2xs: 4px }',
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
  /* A date with a month name is read rather than compared, and a standalone
     figure is display type. Both take the body face. */
  '  .reads { font-family: var(--font-body-md-family) }',
  /* One role, both halves. 20px at 1.4 is 28px, which is what h3 publishes. */
  '  .roled { font-size: var(--font-h3-size);',
  '           line-height: calc(var(--font-h3-size) * var(--font-h3-leading)) }',
  /* A filled shape clear of its ground, and a tint near its ground chroma. */
  '  .shape { width: 24px; height: 24px; border-radius: 4px;',
  '           background: color-mix(in oklch, ' + V.text + ' 55%, ' + V.surface + ') }',
  /* A TINT SITS BEHIND SOMETHING, so it carries words. A fill with no text on
     it is a MARK, and a mark's colour IS its meaning: the check skips those,
     and an empty swatch reported nothing. It also has to be near its ground's
     LIGHTNESS, or the two are simply different colours rather than one
     staining the other. */
  '  .tint { min-width: 120px; padding: 8px 12px; border-radius: 4px;',
  '          background: oklch(0.93 0.02 250) }',
  /* A selection is a step off the CARD, so the list sits on a surface. */
  '  .list { width: 220px; background: ' + V.surface + ' }',
  '  .litem { padding-inline-start: var(--space-sm); padding-block: 4px }',
  '  .picked { background: var(--c-selected) }',
  /* An edge costs padding, so the weight and the inset are ONE setting. */
  '  .barred { background: var(--c-selected);',
  '            box-shadow: inset 4px 0 0 0 ' + V.accent + ';',
  '            padding-inline-start: calc(var(--space-sm) + var(--space-2xs)) }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  '  #bad-date .reads, #bad-fig .reads { font-family: var(--font-code-family) }',
  /* h3's size on caption's leading. The published h3 leading never reaches the
     screen, and no check of size alone can see it. */
  '  #bad-role .roled { line-height: calc(var(--font-caption-size) * var(--font-caption-leading)) }',
  '  #bad-shape .shape { background: ' + V.surface + ' }',
  '  #bad-tint .tint { background: oklch(0.93 0.17 250) }',
  /* The list itself painted the selection colour, so the chosen row stands on
     its own colour and nothing shows. */
  '  #bad-sel .list { background: var(--c-selected) }',
  /* The bar drawn inside the row eats the label inset instead of being paid
     for on top of it. */
  '  #bad-edge .barred { padding-inline-start: var(--space-sm) }',
  '</style></head><body>',
  '<h1>Fixture: the plane and type rules</h1>',
  '<p class="lede">Seven checks about a fill against its ground and about a type',
  ' role being one decision, each injected once beside its correct form.</p>',

  pair('ok-date', 'bad-date', 'a date with a month name is text',
    'The mono face exists so digits stack over each other. A month name is read rather than compared, so it takes the body face. Only an all-figure date takes the mono one.',
    '<span class="reads">12 Aug 2026</span>',
    '<span class="reads">12 Aug 2026</span>'),

  pair('ok-fig', 'bad-fig', 'a standalone figure keeps the body face',
    'A figure standing alone has nothing to stack against, so the mono face buys it nothing and costs it the page voice. A stat tile is display type, not data in a column.',
    '<span class="reads">45,645</span>',
    '<span class="reads">45,645</span>'),

  pair('ok-role', 'bad-role', 'a type role is one decision',
    'A tag carrying one role size renders that size on whatever leading it sits in, so the published leading never reaches the screen. One class carries family, size, weight, leading and tracking together.',
    '<div class="roled">Reconciliation</div>',
    '<div class="roled">Reconciliation</div>'),

  pair('ok-shape', 'bad-shape', 'a filled shape separates from its ground',
    'A shape whose fill equals its surface is absent rather than subtle. Below about 1.2:1 nobody can find it.',
    '<div class="shape"></div>',
    '<div class="shape"></div>'),

  pair('ok-tint', 'bad-tint', 'no tint out-saturates its ground',
    'A chroma that reads as clean beside a near-grey ground reads as solarized on it. No contrast check sees this: a ratio measures lightness and both values are correct.',
    '<div class="tint">Tinted panel</div>',
    '<div class="tint">Tinted panel</div>'),

  pair('ok-sel', 'bad-sel', 'a selection stands on its own ground',
    'The selection role is a step off the CARD, never off the page. Painted on a ground of the same colour, nobody can see which row is chosen.',
    row('picked'),
    row('picked')),

  pair('ok-edge', 'bad-edge', 'a selection edge costs only its own width',
    'A bar drawn inside the row eats the label inset, so the selected label alone sits at a different one. State the padding as the sum, and the weight then moves the text with it.',
    row('barred'),
    row('barred')),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'planes.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/planes.html and fixtures/VERIFY-BROWSER.js written')
