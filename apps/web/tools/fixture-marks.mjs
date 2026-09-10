/* ── THE FIXTURE THAT PROVES THE MARK AND ICON CHECKS ──
 *
 * Ten render checks about marks had never produced a finding on an injected
 * fault. The app's twelve surfaces are the correct-code half of the proof and
 * every one of them is right, so nothing there could ever break them.
 *
 * Every case has a correct twin, because a run that measured nothing reads
 * exactly like a passing check.
 *
 * AND THE BASE RULES ARE CORRECT, SO ONE FAULT FIRES ONE CHECK. A page where
 * every mark is wrong reports every check at once and proves none of them: the
 * rowplane fixture buried its own 7 findings under 60 correct ones from a
 * question it was not about. So the stylesheet here states the RIGHT answer
 * for the whole page, and each fault is one override on one case.
 *
 *   ok-sizes   / bad-sizes    one control, one mark size, or two
 *   ok-square  / bad-square   an icon-only control 1:1, or an oblong
 *   ok-glyph   / bad-glyph    the icon set, or a typed chevron
 *   ok-side    / bad-side     a trailing mark that says so, or one that does not
 *   ok-lone    / bad-lone     a label-less mark on its box centre, or off it
 *   ok-weight  / bad-weight   a stroke that cannot scale, or one that does
 *   ok-paints  / bad-paints   a mark at its published size, or under it
 *   ok-inside  / bad-inside   two states in one cell, or side by side
 *   ok-cap     / bad-cap      a mark in the cap band, or centred on the box
 *   ok-wrap    / bad-wrap     a text-less wrapper carrying the rule, or bare
 *
 * Run:  node tools/fixture-marks.mjs
 * Then: http://localhost:5173/fixtures/marks.html
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

/* A chevron with a stroke, so the weight check has something to read. The
   viewBox is 24 and the painted box is 14, which is the scale that turns one
   token into a different weight at every size. */
const svg = (cls, extra) => '<svg class="icon' + (cls ? ' ' + cls : '') + '"'
  + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
  + (extra || '') + ' aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'

/* ── THE CASE ROW SHRINK-WRAPS, OR IT REPORTS A DIFFERENT RULE ──
 *
 * The first draft made each card a wrapping flex row. A card is as wide as its
 * column, so every case became a row of one control asking for the whole line
 * and filling a fifth of it. That is exactly what the covers-its-line check is
 * about, and it was right: 18 correct findings against the 13 this page exists
 * to show. An inline row takes its content width and asks for no line. */
const block = (id, title, note, body) => [
  '<section>',
  '  <h2>' + title + '</h2>',
  '  <p class="note">' + note + '</p>',
  '  <div class="card" id="' + id + '"><div class="row">' + body + '</div></div>',
  '</section>',
].join('\n')

const pair = (okId, badId, title, note, ok, bad) => [
  '<div class="two">',
  block(okId, 'RIGHT &mdash; ' + title, note, ok),
  block(badId, 'WRONG &mdash; ' + title, note, bad),
  '</div>',
].join('\n')

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the mark and icon rules</title>',
  '<style>',
  '  :root { color-scheme: light;',
  /* Published, because the paints-size check reads them off the scope root.
     Only the button token is published: the other five have no instance here
     and the check reports an absent instance rather than a fault. */
  '    --cmp-button-icon-size: 14px;',
  '    --icon-gap: 8px; --space-sm: 12px; --space-md: 16px }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h1 { font-size: 18px; font-weight: 500; margin: 0 0 4px }',
  '  h2 { font-size: 13px; font-weight: 600; margin: 0 0 4px }',
  '  .lede { font-size: 13px; color: ' + V.text + '; opacity: .7; margin: 0 0 24px; max-width: 78ch }',
  '  .note { font-size: 12.5px; line-height: 1.55; margin: 0 0 10px; max-width: 58ch;',
  '          color: color-mix(in oklch, currentColor 62%, transparent) }',
  '  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px }',
  '  .card { background: ' + V.surface + '; padding: 16px; border-radius: 8px }',
  '  .row { display: inline-flex; align-items: baseline; gap: 16px }',
  '',
  /* ── THE PAGE STATES THE RIGHT ANSWER, AND EACH FAULT OVERRIDES IT ── */
  '  .btn { display: inline-flex; align-items: baseline; gap: var(--icon-gap);',
  '         height: 28px; line-height: 26px; padding: 0 var(--space-sm);',
  '         font-size: 14px; border: 1px solid ' + V.border + '; border-radius: 6px;',
  '         background: ' + V.surface + '; color: ' + V.text + '; box-sizing: border-box }',
  '  .icon { width: var(--cmp-button-icon-size); height: var(--cmp-button-icon-size);',
  '          flex: 0 0 auto; vertical-align: baseline; align-self: baseline;',
  '          transform: translateY(calc((100% - 0.75em) / 2)) }',
  /* An SVG scales its stroke with its viewBox, so the number is only the
     painted width once the stroke leaves that transform. On the SHAPES, or it
     computes on the svg and none on the path. */
  '  .icon, .icon * { vector-effect: non-scaling-stroke }',
  /* An icon-only control is square, and it states no width at all: a ratio
     only makes a size when the other axis is auto. */
  '  .icon-only { aspect-ratio: 1; padding: 0; justify-content: center;',
  '               align-items: center; height: 28px }',
  '  .icon-only .icon { transform: none; align-self: center }',
  '  .cbox { position: relative; width: 24px; height: 24px; flex: 0 0 auto;',
  '          border: 1px solid ' + V.border + '; border-radius: 4px; box-sizing: border-box }',
  '  .cbox .icon { position: absolute; inset: 0; margin: auto; transform: none;',
  '                width: 14px; height: 14px }',
  /* A child aligns to the flex LINE, so the wrapper's own row has to put that
     line on the label. Declared here, and one case below removes it. */
  '  .wrapmark { display: inline-flex; align-items: baseline; align-self: baseline;',
  '              transform: translateY(calc((100% - 0.75em) / 2)) }',
  '  .chip { display: inline-flex; align-items: baseline; gap: var(--icon-gap);',
  '          padding: 2px 8px; border-radius: 999px; font-size: 14px;',
  '          border: 1px solid ' + V.border + ' }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  /* The spread goes on a CHIP, which no published mark size pairs with. On a
     button the smaller mark also breaks the published size, so one case fired
     two checks and neither read as its own proof. */
  '  #bad-sizes .small { width: 10px; height: 10px }',
  '  #bad-square .icon-only { aspect-ratio: auto; width: 46px }',
  '  #bad-lone .icon-only { justify-content: flex-start; padding-inline-start: 2px }',
  '  #bad-weight .icon, #bad-weight .icon * { vector-effect: none }',
  '  #bad-paints .icon { width: 10px; height: 10px }',
  '  #bad-inside .cbox .icon { position: static; inset: auto; margin: 0 }',
  /* ── EQUAL OVERHANG IS CORRECT, SO CENTRING ON THE BOX IS NOT THE FAULT ──
   *
   * The first injection centred the mark on a 44px flex box. Measured: 2px
   * above the cap against 2px below the baseline, which is what centred
   * means, and the check correctly said nothing. A line box is symmetric
   * about its own ink, so box centring and cap centring coincide there.
   *
   * The fault this check exists for is `vertical-align: middle`, which puts
   * a mark on the X-HEIGHT centre rather than the cap centre. A FLEX parent
   * ignores vertical-align, which is why the rule needs align-self as well,
   * so the fault only shows in an inline context. */
  '  #bad-cap .btn { display: inline-block; height: auto; line-height: 26px }',
  '  #bad-cap .icon { transform: none; align-self: auto; vertical-align: middle }',
  '  #bad-wrap .wrapmark { align-self: auto; transform: none }',
  '  #bad-rowbase .row { align-items: center }',
  '</style></head><body>',
  '<h1>Fixture: the mark and icon rules</h1>',
  '<p class="lede">Ten checks about marks, each injected once beside the correct',
  ' form of the same shape. The stylesheet states the right answer for the whole',
  ' page, so one fault fires one check rather than every check at once.</p>',

  pair('ok-sizes', 'bad-sizes', 'a control holds one mark size',
    'A control is a leaf, so its marks are ornament rather than siblings in a layout. Two of them at two sizes is one control speaking twice.',
    '<span class="chip">' + svg() + 'In review' + svg('icon-end') + '</span>',
    '<span class="chip">' + svg() + 'In review' + svg('small icon-end') + '</span>'),

  pair('ok-square', 'bad-square', 'an icon-only control is square',
    'One to one at every size step. An oblong reads as a button whose label failed to load.',
    '<button class="btn icon-only" aria-label="Next">' + svg() + '</button>',
    '<button class="btn icon-only" aria-label="Next">' + svg() + '</button>'),

  pair('ok-glyph', 'bad-glyph', 'a mark is never a typed glyph',
    'A text glyph takes the label size rather than the mark size, and a word space answers to no spacing token.',
    '<button class="btn">Next' + svg('icon-end') + '</button>',
    '<button class="btn">Next ›</button>'),

  pair('ok-side', 'bad-side', 'a mark beside words names its side',
    'A label is a text node, so :last-child matches the leading mark instead and puts the gap on the wrong side. Leading is the default, so only a trailing mark carries a class.',
    '<button class="btn">Download' + svg('icon-end') + '</button>',
    '<button class="btn">Download' + svg() + '</button>'),

  pair('ok-lone', 'bad-lone', 'a lone mark centres on its box',
    'With no label there is no cap band to sit in, so a mark with no words centres on the box.',
    '<button class="btn icon-only" aria-label="Open">' + svg() + '</button>',
    '<button class="btn icon-only" aria-label="Open">' + svg() + '</button>'),

  pair('ok-weight', 'bad-weight', 'one token is not one weight',
    'An SVG scales its stroke with its viewBox, so one declaration paints a different weight at every size. The property applies to drawn geometry and does not inherit, so it goes on the shapes.',
    '<button class="btn">Refresh' + svg('icon-end') + '</button>',
    '<button class="btn">Refresh' + svg('icon-end') + '</button>'),

  pair('ok-paints', 'bad-paints', 'a mark paints the size its component publishes',
    'The page publishes --cmp-button-icon-size: 14px. A component that publishes a mark size and paints another is a specification that lies.',
    '<button class="btn">Save' + svg('icon-end') + '</button>',
    '<button class="btn">Save' + svg('icon-end') + '</button>'),

  pair('ok-inside', 'bad-inside', 'a mark stays inside its control',
    'A checkbox draws both states and reveals one, so in normal flow two marks lay out side by side and the engine clips the second. Put every state in one cell.',
    '<span class="cbox" role="checkbox" aria-checked="true" aria-label="Pick one" tabindex="0">' + svg() + svg() + '</span>',
    '<span class="cbox" role="checkbox" aria-checked="true" aria-label="Pick one" tabindex="0">' + svg() + svg() + '</span>'),

  pair('ok-cap', 'bad-cap', 'a mark beside a label sits in the cap band',
    'The only acceptable space is between the cap height and the baseline of the label. A flex parent ignores vertical-align, so align-self is not optional.',
    '<button class="btn">' + svg() + 'Publish</button>',
    '<button class="btn">' + svg() + 'Publish</button>'),

  pair('ok-wrap', 'bad-wrap', 'a text-less wrapper carries the cap-band rule',
    'An editor that wraps each instance makes the mark a grandchild, so a child selector matches nothing and the wrapper becomes the flex item. With no in-flow text it takes its baseline from its bottom margin edge.',
    '<span class="wrapmark">' + svg() + '</span><span>Wrapped instance</span>',
    '<span class="wrapmark">' + svg() + '</span><span>Wrapped instance</span>'),

  pair('ok-rowbase', 'bad-rowbase', 'the row declares the baseline too',
    'A mark asking for align-self: baseline aligns to the flex LINE. A row declaring centre never puts that line on the label, so the two diverge and the rule has nothing to land against.',
    '<span class="wrapmark">' + svg() + '</span><span>Row on the label</span>',
    '<span class="wrapmark">' + svg() + '</span><span>Row on its own centre</span>'),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'marks.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/marks.html and fixtures/VERIFY-BROWSER.js written')
