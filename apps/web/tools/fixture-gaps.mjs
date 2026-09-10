/* ── THE FIXTURE THAT PROVES THE GAP AND ALIGNMENT CHECKS ──
 *
 * Six render checks about who owns a distance had never produced a finding on
 * an injected fault.
 *
 * Every case has a correct twin, and the stylesheet states the RIGHT answer
 * page-wide, so one fault fires one check.
 *
 *   ok-byline / bad-byline   a byline one small step under its heading, or adrift
 *   ok-label  / bad-label    a group label with a gap, or touching its list
 *   ok-writer / bad-writer   one writer for a distance, or a gap plus a margin
 *   ok-spread / bad-spread   a row started at one end, or space-between
 *   ok-rules  / bad-rules    one boundary said once, or three times
 *   ok-stated / bad-stated   an end placed by its own margin, or by a neighbour
 *
 * Run:  node tools/fixture-gaps.mjs
 * Then: http://localhost:5173/fixtures/gaps.html
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

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the gap and alignment rules</title>',
  '<style>',
  '  :root { color-scheme: light;',
  '    --space-2xs: 4px; --space-xs: 8px; --space-sm: 12px; --space-md: 16px;',
  '    --icon-gap: 8px }',
  '  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;',
  '         background: ' + V.bg + '; color: ' + V.text + ' }',
  '  h1 { font-size: 18px; font-weight: 500; margin: 0 0 4px }',
  /* The case heading is NOT a specimen heading, and the byline check reads any
     h2 followed by a caption. It carries its own class and no caption follows
     it, so it contributes nothing. */
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
  '',
  /* ── THE RIGHT ANSWER, PAGE-WIDE ── */
  /* A byline belongs to its heading: one small step, and ONE writer for it. */
  '  .titled h3 { font-size: 16px; line-height: 24px; margin: 0 }',
  '  .titled .caption { font-size: 12.5px; margin: var(--space-2xs) 0 0;',
  '                     color: color-mix(in oklch, currentColor 62%, transparent) }',
  /* A group label states the distance to what it names. Blocks carry none. */
  '  .grp > .lbl { display: block; margin-bottom: var(--space-xs); font-weight: 600 }',
  /* Each item states its own distance to the one above it, or the check reads
     every item pair as a label with no gap and reports three where one fault
     was injected. */
  '  .grp > .item { display: block }',
  '  .grp > .item + .item { margin-top: var(--space-2xs) }',
  /* One writer: the container publishes the distance and no child adds to it. */
  '  .stack { display: flex; flex-direction: column; row-gap: var(--space-sm) }',
  '  .stack > * { margin: 0 }',
  /* A row starts at one end and the group that belongs at the far end takes an
     auto margin, so all the slack lands in one place. */
  /* INLINE, and only as wide as the case needs. At 520px in a 471px column the
     row asked for the whole line, filled 207px of it and overflowed the page,
     so two other checks reported it. Both were right. */
  '  .bar { display: inline-flex; column-gap: var(--icon-gap); width: 280px }',
  '  .divider { border-top: 1px solid ' + V.border + '; width: 100%; height: 0 }',
  /* BASELINE, or the button stretches and the row holds two baselines. */
  '  .hdr { display: inline-flex; align-items: baseline;',
  '         column-gap: var(--space-sm); width: 300px }',
  '  .hdr > .words { flex: 1 1 auto; min-width: 0 }',
  /* THE AUTO MARGIN GOES ON THE CORRECT CASE ALONE. Written as a base rule it
     matched the faulty button too, so the check read that end as stated and
     said nothing. A selector in the auto list is what the check reads, and an
     override to 0 does not take the element out of that list. */
  '  #ok-stated .hdr > .end { margin-inline-start: auto }',
  /* A rule the check can see as ABLE to vanish. The query never matches, and
     the check reads the stylesheet TEXT rather than what is in force, which is
     the whole point: the slack absorber is ALLOWED to disappear. */
  '  @media (max-width: 1px) { .vanishes { display: none } }',
  '',
  /* ── ONE OVERRIDE PER FAULT ── */
  '  #bad-byline .caption { margin-top: var(--space-md) }',
  '  #bad-label > .grp > .lbl { margin-bottom: 0 }',
  /* Positional, never a class. A class used by one case alone is dead in the
     other, and the dead-class check reported it. */
  '  #bad-writer .stack > div:nth-child(2) { margin-block-start: var(--space-sm) }',
  '  #bad-spread .bar { justify-content: space-between }',
  '  #bad-stated .hdr > .end { margin-inline-start: 0 }',
  '</style></head><body>',
  '<h1>Fixture: the gap and alignment rules</h1>',
  '<p class="lede">Six checks about who owns a distance, each injected once',
  ' beside the correct form of the same shape.</p>',

  pair('ok-byline', 'bad-byline', 'a byline belongs to its heading',
    'The pair is one group, so it takes one small step. Further out the line reads as a paragraph of its own rather than as part of the title.',
    '<div class="titled"><h3>Reconciliation</h3><p class="caption">Updated four minutes ago</p></div>',
    '<div class="titled"><h3>Reconciliation</h3><p class="caption">Updated four minutes ago</p></div>'),

  pair('ok-label', 'bad-label', 'a group label owns the distance to what it names',
    'An overline above a list is two block siblings, and a block carries no gap of its own. At zero the label reads as a dead first row rather than as the list name.',
    '<div class="grp"><span class="lbl">Workspace</span><span class="item">Ledgers</span><span class="item">Journals</span></div>',
    '<div class="grp"><span class="lbl">Workspace</span><span class="item">Ledgers</span><span class="item">Journals</span></div>'),

  pair('ok-writer', 'bad-writer', 'one writer for one gap',
    'A row-gap and a margin ADD, so two writers give a distance nobody chose, wrong by the sum. A container publishes it, or each child states its own.',
    '<div class="stack"><div>First row</div><div>Second row</div></div>',
    '<div class="stack"><div>First row</div><div>Second row</div></div>'),

  pair('ok-spread', 'bad-spread', 'space-between spreads every gap',
    'Two adjacent controls of one kind read as a run. space-between splits its free space evenly across every gap, so it opens a hole inside that run.',
    '<div class="bar"><button class="btn">Copy</button><button class="btn">Move</button><button class="btn">Archive</button></div>',
    '<div class="bar"><button class="btn">Copy</button><button class="btn">Move</button><button class="btn">Archive</button></div>'),

  pair('ok-rules', 'bad-rules', 'two rules of one weight do not stack',
    'Three inside 43px say one boundary three times, and repetition reads as noise. Space says how big a boundary is, never weight.',
    '<div style="width:240px"><div class="divider"></div><div style="height:40px"></div><div class="divider"></div></div>',
    '<div style="width:240px"><div class="divider"></div><div style="height:12px"></div><div class="divider"></div><div style="height:12px"></div><div class="divider"></div></div>'),

  pair('ok-stated', 'bad-stated', 'alignment is stated, never inherited',
    'A header action sat at the end because a words group beside it held flex: 1. That group is allowed to disappear at a narrow width, and when it did the action packed to the start.',
    '<div class="hdr"><div class="words vanishes">Quarterly report</div><button class="btn end">Export</button></div>',
    '<div class="hdr"><div class="words vanishes">Quarterly report</div><button class="btn end">Export</button></div>'),

  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'gaps.html'), html)
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(state))
console.log('fixtures/gaps.html and fixtures/VERIFY-BROWSER.js written')
