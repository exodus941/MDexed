/* ── WHERE THE WIZARD'S TWO SAMPLE PANES STOP BEING USABLE ──
 *
 * They sent a phone screenshot: the Light and Dark panes sit side by side at
 * about 375px and both cards overflow. "Renewal Due" is cut mid-word and
 * "Send Reminder" runs past its own pane.
 *
 * The row is a bare `display: flex` with each pane at `flex: 1 1 0` and
 * `min-width: 0`, so it shrinks to nothing and never wraps. Every comment in
 * that file measures the panes at a modal width of 880 or 960. Nobody
 * measured a phone.
 *
 * DERIVE THE THRESHOLD BY SHRINKING THE REAL ROW, NEVER BY ADDING UP ITS
 * PARTS. A sum of the button widths would miss the card padding, the pane
 * padding and the gap, and it would be true of these labels only. So this page
 * renders the real markup under the real PREVIEW_CSS with the real derived
 * tokens, at a sweep of widths, and asks at each one whether the pane is still
 * usable: nothing overflows, and no word is broken.
 *
 * Run:  node tools/fixture-samplepanes.mjs
 * Then: http://localhost:5173/fixtures/samplepanes.html
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)

const { createInitialState } = await load('state/schema.js')
const { derive, buildCssVars } = await load('state/derive.js')

const state = createInitialState()
const d = derive(state)
const decl = mode => Object.entries(buildCssVars(d, mode))
  .map(([k, v]) => k + ':' + v).join(';')

/* THE WIZARD'S OWN MARKUP AND THE SHIPPED CLASSES, never a copy of them.
 *
 * The first version of this page carried its own `.paneRow` and `.pane` rules,
 * which is a test written around the defect: delete the real container query
 * and the page would still have reported usable. It loads theme.css and uses
 * `.sample-block`, `.sample-panes` and `.sample-pane` instead, so the verdict
 * is about the rule that ships. */
const PANE = (mode, label) => [
  '      <div class="sample-pane">',
  '        <span class="paneLabel">' + label + '</span>',
  '        <div class="dmd frame" data-theme="' + mode + '" style="' + decl(mode) + '">',
  '          <div class="stack-sm">',
  '            <div class="card stack-sm">',
  '              <h3 style="margin:0">Renewal Due</h3>',
  '              <p style="margin:0;font-size:12px">Halcyon Group renews in 6 days.</p>',
  '              <div class="row" style="gap:8px;flex-wrap:wrap">',
  '                <button class="btn btn-primary">Send Reminder</button>',
  '                <button class="btn btn-ghost">Dismiss</button>',
  '              </div>',
  '            </div>',
  '            <span class="muted" style="font-size:12px">Body Text On The Page</span>',
  '          </div>',
  '        </div>',
  '      </div>',
].join('\n')

/* Every width worth asking about: the narrowest phone this app ships for, the
   declared breakpoints, and the midpoint of each adjacent pair. A fault lives
   BETWEEN two breakpoints, so the midpoints are not optional. */
const WIDTHS = [296, 320, 360, 375, 390, 414, 430, 480, 560, 640, 704, 768, 880, 960]

const CASES = WIDTHS.map(w => [
  '  <section class="case" data-w="' + w + '">',
  '    <h2 class="caseTitle">' + w + 'px</h2>',
  '    <div class="host" style="width:' + w + 'px">',
  '      <div class="sample-block">',
  '        <div class="sample-panes">',
  PANE('light', 'Light'),
  PANE('dark', 'Dark'),
  '        </div>',
  '        <p class="disclaimer">A stylistic representation. The final output is',
  '         based on these choices, not limited to this arrangement.</p>',
  '      </div>',
  '    </div>',
  '    <pre class="verdict" data-for="' + w + '"></pre>',
  '  </section>',
].join('\n')).join('\n')

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Fixture: the wizard sample panes, by width</title>',
  /* BOTH stylesheets. theme.css carries the shipped pane rules and the
     container query; preview.css carries the primitives inside each pane. */
  '<link rel="stylesheet" href="/src/ui/theme.css">',
  '<link rel="stylesheet" href="/src/preview/preview.css">',
  '<style>',
  '  :root { color-scheme: dark }',
  '  body { font: 13px/1.5 system-ui, sans-serif; margin: 0; padding: 20px 24px 40px;',
  '         background: #0d0f11; color: #d8dde2 }',
  '  h1 { font-size: 17px; font-weight: 600; margin: 0 0 4px }',
  '  .lede { font-size: 12.5px; color: #8b959e; margin: 0 0 20px; max-width: 78ch }',
  '  .case { margin-bottom: 22px }',
  '  .caseTitle { font: 600 12px/1 ui-monospace, monospace; color: #8b959e; margin: 0 0 6px }',
  /* The host stands in for the wizard's own column, so the width under test is
     the CONTAINER's rather than the window's. */
  '  .host { border: 1px dashed #2a3238; border-radius: 6px; padding: 12px;',
  '          overflow: visible }',
  /* No .sample-panes or .sample-pane here on purpose: those ship in
     theme.css, and restating them would make this page prove itself. */
  '  .paneLabel { font-size: 12px; color: #7d878f }',
  '  .frame { min-height: auto !important; flex: 1 1 auto; border-radius: 8px;',
  '           overflow: hidden; background: var(--c-bg); padding: 16px; min-width: 0;',
  '           border: 1px solid rgba(140,150,160,.25) }',
  '  .disclaimer { margin: 0; padding-top: 16px; font-size: 12px; color: #6f7a82; line-height: 1.5 }',
  '  .verdict { font: 11px/1.6 ui-monospace, monospace; color: #9aa4ac; margin: 8px 0 0;',
  '             white-space: pre-wrap }',
  '</style></head><body>',
  '<h1>The wizard sample panes, at every width that matters</h1>',
  '<p class="lede">The real markup, the real preview stylesheet and the real',
  ' derived tokens. The dashed box is the wizard column, so the width under test',
  ' is the container&rsquo;s. Each verdict asks whether the pane is still usable:',
  ' nothing crosses its own box, and no word is broken mid-word.</p>',
  CASES,
  '<script>',
  /* USABLE IS NOT THE SAME AS FITTING. A pane whose card overflows has already
     failed, and so has one whose heading breaks inside a word. Ask both. */
  'const brokenWord = el => {',
  '  const r = document.createRange(); const out = [];',
  '  for (const n of el.querySelectorAll("h3, p, button, span")) {',
  '    const t = [...n.childNodes].find(c => c.nodeType === 3 && c.textContent.trim());',
  '    if (!t) continue;',
  '    r.selectNodeContents(n);',
  '    const lines = r.getClientRects().length;',
  '    if (lines < 2) continue;',
  /* A word that survived the break is one whose own rectangle fits a line. So
     measure each WORD: if a single word is wider than the content box, the
     break went through it. */
  '    const box = n.getBoundingClientRect().width;',
  '    for (const w of t.textContent.trim().split(/\\s+/)) {',
  '      const s = document.createElement("span");',
  '      s.style.cssText = "position:absolute;visibility:hidden;white-space:pre";',
  '      s.textContent = w; n.appendChild(s);',
  '      const ww = s.getBoundingClientRect().width; s.remove();',
  '      if (ww > box + 0.5) out.push(w + " " + ww.toFixed(0) + "px in " + box.toFixed(0));',
  '    }',
  '  }',
  '  return out;',
  '}',
  'const spills = el => {',
  '  const out = []; const box = el.getBoundingClientRect();',
  '  for (const n of el.querySelectorAll("*")) {',
  '    const cs = getComputedStyle(n);',
  '    if (cs.position === "absolute" || cs.position === "fixed") continue;',
  '    const r = n.getBoundingClientRect();',
  '    if (r.width === 0) continue;',
  '    const past = r.right - box.right;',
  '    if (past > 0.5) out.push((n.className || n.tagName) + " " + past.toFixed(1) + "px past");',
  '  }',
  '  return out;',
  '}',
  'for (const sec of document.querySelectorAll(".case")) {',
  '  const w = sec.dataset.w;',
  '  const panes = [...sec.querySelectorAll(".pane")];',
  '  const lines = [];',
  '  let bad = 0;',
  '  for (const p of panes) {',
  '    const frame = p.querySelector(".frame");',
  '    const sp = spills(frame), bw = brokenWord(frame);',
  '    if (sp.length || bw.length) bad++;',
  '    lines.push("  pane " + Math.round(p.getBoundingClientRect().width)',
  '      + "px   spill " + (sp.length ? sp.join(", ") : "none")',
  '      + "   broken word " + (bw.length ? bw.join(", ") : "none"));',
  '  }',
  '  sec.querySelector(".verdict").textContent =',
  '    (bad ? "UNUSABLE in " + bad + " of " + panes.length + " panes" : "usable")',
  '    + "\\n" + lines.join("\\n");',
  '}',
  '</script>',
  '</body></html>',
].join('\n')

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'samplepanes.html'), html, 'utf8')
console.log('fixture-samplepanes: wrote local/fixtures/samplepanes.html')
console.log('  ' + WIDTHS.length + ' widths, two panes each. Open /fixtures/samplepanes.html.')
