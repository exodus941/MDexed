/* ── WHICH RENDER CHECKS HAVE BEEN PROVEN TO FIRE ──
 *
 * The source half asserts every check against a fixture carrying the fault it
 * exists to find. The render half had nothing of the kind. A render check whose
 * selector stops matching goes quiet, and quiet reads exactly like a clean
 * page, so each one could have been a no-op for as long as it existed.
 *
 * The coverage channel measures which checks SPEAK on the app's own surfaces.
 * That is a different question and a weaker one: a healthy check on correct
 * code is silent too. Measured on twelve surfaces at three widths, the app
 * produces 0 findings, so everything that spoke there spoke through a NOTE.
 * A note is not evidence that a check can fault.
 *
 * THE ONLY EVIDENCE IS A FINDING ON AN INJECTED FAULT. So this reads the
 * fixture pages, where each fault sits beside its correct twin, and records
 * which check ids produce a finding.
 *
 * WHY A GENERATED HARNESS RATHER THAN A SCRIPT PER PAGE. A fixture is a whole
 * document, so measuring four of them needs four navigations, and a driver
 * that navigates loses itself. Each page goes in an IFRAME instead, and the
 * verifier is built inside that frame's own realm so its `document` is the
 * frame's. Same origin, so nothing is blocked, and one run measures all of
 * them.
 *
 * SCOPE THE RUN TO THE PAGE, NEVER TO ONE CASE. Pointed at each marked element
 * in turn, the spacing fixture reported one check. Pointed at the page it
 * reports eleven. A check that compares siblings has nothing to compare when
 * the scope root IS the candidate, and it then goes quiet rather than failing.
 *
 * Run:  node tools/prove-render.mjs
 * Then: http://localhost:5173/fixtures/prove-render.html
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)

const { CHECKS } = await load('emit/checks.js')
const { createInitialState } = await load('state/schema.js')
const { verifyBrowserFile } = await load('emit/verify.js')

const RENDER = CHECKS.filter(c => c.where === 'render').map(c => c.id)
if (!RENDER.length) {
  console.error('no render checks were read, so this would report a hole that is not there')
  process.exit(1)
}

const out = path.join(here, '..', 'local', 'fixtures')
fs.mkdirSync(out, { recursive: true })

/* READ THE DIRECTORY, NEVER A LIST. A fixture page added tomorrow joins the
   run without anybody remembering to name it here. */
const HARNESS = 'prove-render.html'
const pages = fs.readdirSync(out)
  .filter(f => f.endsWith('.html') && f !== HARNESS)
  .sort()
if (!pages.length) {
  console.error('no fixture pages found in local/fixtures, so nothing could be proven')
  process.exit(1)
}

const html = [
  '<!doctype html>',
  '<html lang="en"><head><meta charset="utf-8">',
  '<title>Which render checks have been proven to fire</title>',
  '<style>',
  '  body { font: 13px ui-monospace, monospace; margin: 24px; max-width: 900px }',
  '  h1 { font: 500 18px system-ui; margin: 0 0 4px }',
  '  p { color: #555; margin: 0 0 16px }',
  '  iframe { width: 900px; height: 700px; border: 1px solid #ddd; display: block; margin: 8px 0 }',
  '  #frames { position: absolute; left: -10000px; top: 0 }',
  '  pre { background: #f6f6f6; padding: 12px; overflow-x: auto; white-space: pre-wrap }',
  '  .bad { color: #a11 }',
  '  .ok { color: #161 }',
  '</style></head><body>',
  '<h1>Which render checks have been proven to fire</h1>',
  '<p>Each fixture page is loaded in a frame and verified. A check is proven only',
  ' when it produces a FINDING, because a note is not evidence that it can fault.</p>',
  '<pre id="report">running</pre>',
  '<div id="frames"></div>',
  '<script>',
  'const PAGES = ' + JSON.stringify(pages),
  'const RENDER = ' + JSON.stringify(RENDER),
  'const VSRC = ' + JSON.stringify('/fixtures/VERIFY-BROWSER.js'),
  'const say = t => { document.getElementById("report").textContent = t }',
  'const wait = ms => new Promise(r => setTimeout(r, ms))',
  '',
  '/* A frame that never loads must say so rather than contributing nothing,',
  '   because an absent page reads exactly like a page with no findings. */',
  'async function frameFor (page) {',
  '  const f = document.createElement("iframe")',
  '  f.src = "/fixtures/" + page',
  '  const loaded = new Promise((res, rej) => {',
  '    f.addEventListener("load", () => res(true), { once: true })',
  '    f.addEventListener("error", () => rej(new Error("the frame errored")), { once: true })',
  '    setTimeout(() => rej(new Error("the frame did not load in 15s")), 15000)',
  '  })',
  '  document.getElementById("frames").appendChild(f)',
  '  await loaded',
  '  return f',
  '}',
  '',
  'window.proveRender = async function proveRender () {',
  '  const src = await (await fetch(VSRC + "?v=" + Date.now())).text()',
  '  const fired = new Map()',
  '  const perPage = {}',
  '  const failed = []',
  '  const selfReports = []',
  '  for (const page of PAGES) {',
  '    let f = null',
  '    try { f = await frameFor(page) } catch (e) { failed.push(page + ": " + e.message); continue }',
  '    const w = f.contentWindow',
  '    /* Build it in the FRAME\'s realm, so its document is the frame\'s. */',
  '    new w.Function(src)()',
  '    const r = await w.verify(f.contentDocument.body)',
  '    const here = {}',
  '    for (const x of r.findings) {',
  '      /* ── A CHECK REPORTING ABOUT ITSELF IS NOT A CHECK THAT FIRED ──',
  '       *',
  '       * `(the check itself)` is the marker for a thrown body and for a',
  '       * body that refuses because it measured nothing. Counted as a hit,',
  '       * the dead-class check read as PROVEN on all four pages while what',
  '       * it actually said was "read only 9 selectors, so nothing was',
  '       * measured". A fixture page carries almost no stylesheet, so that',
  '       * check cannot run there at all.',
  '       *',
  '       * That is the exact failure this harness exists to find, one level',
  '       * up: a finding counted without being read. */',
  '      if (x.where === "(the check itself)") {',
  '        selfReports.push(page + " | " + x.check + " :: " + x.msg)',
  '        continue',
  '      }',
  '      here[x.check] = (here[x.check] || 0) + 1',
  '      if (!fired.has(x.check)) fired.set(x.check, [])',
  '      if (!fired.get(x.check).includes(page)) fired.get(x.check).push(page)',
  '    }',
  '    perPage[page] = { findings: r.findings.length, checks: here }',
  '    f.remove()',
  '  }',
  '',
  '  /* A FIRED ID THAT IS NOT A DECLARED RENDER CHECK MEANS THE TWO LISTS HAVE',
  '     DRIFTED, so it is named rather than counted. */',
  '  const stray = [...fired.keys()].filter(id => !RENDER.includes(id)).sort()',
  '  const proven = RENDER.filter(id => fired.has(id)).sort()',
  '  const unproven = RENDER.filter(id => !fired.has(id)).sort()',
  '  const res = {',
  '    fixturePages: PAGES.length,',
  '    pagesThatFailedToLoad: failed,',
  '    declaredRenderChecks: RENDER.length,',
  '    provenToFire: proven.length,',
  '    neverProven: unproven.length,',
  '    strayIds: stray,',
  '    /* Loud, because a check that throws or refuses on every fixture page is',
  '       its own finding and it is invisible in the two counts above. */',
  '    checksReportingAboutThemselves: selfReports.length,',
  '    selfReports,',
  '    proven, unproven, perPage,',
  '  }',
  '  say(JSON.stringify(res, null, 1))',
  '  return res',
  '}',
  'proveRender().catch(e => say("FAILED: " + (e && e.message)))',
  '</script></body></html>',
].join('\n')

fs.writeFileSync(path.join(out, HARNESS), html)
/* The fixture pages read the verifier from beside themselves, so it is
   refreshed here too. A stale copy measures yesterday's check set. */
fs.writeFileSync(path.join(out, 'VERIFY-BROWSER.js'), verifyBrowserFile(createInitialState()))

console.log('fixtures/' + HARNESS + ' written over ' + pages.length + ' page(s): ' + pages.join(', '))
console.log(RENDER.length + ' declared render checks to account for')
console.log('open http://localhost:5173/fixtures/' + HARNESS + ' and read window.proveRender()')
