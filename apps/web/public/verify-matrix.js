/* Drive the preview across every surface and width, and run the render
 * verifier on each. Serve it, do not retype it.
 *
 *   const s = await (await fetch('/verify-matrix.js')).text(); new Function(s)()
 *   await matrix.learn()                       // once per page load
 *   matrix.run()                               // every surface, every width
 *   matrix.report()                            // read the verdict
 *   matrix.probe(['Form'], [296], 'check-id')  // one check, narrowed
 *
 * WHY IT IS A FILE. This driver was retyped into the console four times in one
 * session and lost three times to a page reload, because a JSX edit that HMR
 * cannot accept forces one. Each retype dropped a lesson the previous one had
 * learned. The rule about running the toolkit rather than a throwaway probe
 * applies to the probe as well.
 *
 * WHAT IT ASSERTS, because each one cost a wrong reading:
 *
 *   THE WIDTH LANDED. A <select> silently refuses a value with no option, so
 *   the value became '' and the frame took whatever the window gave. Inject a
 *   real option, use the native setter, fire change.
 *
 *   AND IT LANDED BY POLLING, NOT AFTER A PAUSE. A fixed 300ms against a
 *   125ms cross-fade measured 4 of 13 runs at a width nobody asked for: 1280
 *   for a 320 request, 296 for a 640, and 0 twice. A ZERO-WIDTH FRAME PASSES
 *   EVERY CHECK, which reads exactly like a clean surface.
 *
 *   AND THE SURFACE LANDED TOO. An earlier version checked the width and only
 *   that the surface id was non-empty. A run whose tab click had not landed
 *   passed carrying the label of the surface I asked for. It reported groups
 *   on two surfaces that do not have them.
 *
 *   THE ID COMES FROM THE TAB, MEASURED. The tab reads "Overlays" and the
 *   surface id is `dialog`, so a label comparison skips a correct surface and
 *   a skipped surface reads exactly like a clean one. learn() drives each tab
 *   once and records what it produces.
 *
 *   EVERY CONTROL IS RE-FOUND BY SELECTOR. A surface switch re-renders the
 *   chrome, so a reference held from install is detached: the click does
 *   nothing and the select value goes nowhere.
 *
 *   THE OUTGOING FRAME IS NOT THE ONE ARRIVING. A cross-fade keeps both
 *   mounted and the outgoing layer mounts first, so the first match is the one
 *   leaving. It says so on itself.
 *
 *   AND A RUN THAT DID NOT LAND IS REPORTED, never measured and labelled.
 */
;(function () {

const wait = ms => new Promise(r => setTimeout(r, ms))

const SURFACES = ['Dashboard', 'Record', 'Index', 'Shell', 'Landing', 'Pricing',
  'Form', 'Settings', 'Empty', 'Charts', 'Overlays', 'Gallery']

/* EVERY DECLARED WIDTH AND THE MIDPOINT OF EACH ADJACENT PAIR. A breakpoint is
   where the layout changes, so the arrangement BETWEEN two of them is the one
   nobody declared and nobody has looked at. One fault lived in 360 to 600 and
   no declared width falls inside it. */
const DECLARED = [296, 320, 640, 768, 1024, 1280, 1536]
const WIDTHS = (() => {
  const out = []
  for (let i = 0; i < DECLARED.length; i++) {
    out.push(DECLARED[i])
    if (i + 1 < DECLARED.length) out.push(Math.round((DECLARED[i] + DECLARED[i + 1]) / 2))
  }
  return out
})()

const chromeBtns = () => Array.prototype.slice.call(document.querySelectorAll('button'))
  .filter(b => !b.closest('.dmd'))
const tabFor = n => chromeBtns().find(b => b.textContent.trim() === n)
const widthSelect = () => Array.prototype.slice.call(document.querySelectorAll('select'))
  .filter(x => !x.closest('.dmd'))
  .find(x => Array.prototype.slice.call(x.options).some(o => /\d+px/.test(o.textContent)))

const setWidth = v => {
  const sel = widthSelect()
  if (!sel) throw new Error('the width control is not in the document')
  let temp = null
  if (!Array.prototype.slice.call(sel.options).some(o => o.value === String(v))) {
    temp = document.createElement('option')
    temp.value = String(v)
    temp.textContent = v + 'px'
    sel.appendChild(temp)
  }
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')
    .set.call(sel, String(v))
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return temp
}

/* The outgoing layer of a cross-fade says so on itself. Read that rather than
   waiting longer and hoping. */
const incoming = () => Array.prototype.slice.call(document.querySelectorAll('.dmd-frame .dmd'))
  .filter(e => !e.closest('.xfade-out') && !e.closest('[aria-hidden="true"]'))
  .pop()
const idOf = el => (el && el.closest('[data-surface]') && el.closest('[data-surface]').dataset.surface) || ''

const oneFrame = async () => {
  const stop = Date.now() + 5000
  while (Date.now() < stop) {
    await wait(60)
    if (document.querySelectorAll('.dmd-frame .dmd').length === 1) return true
  }
  return false
}

const showPreview = () => {
  const b = chromeBtns().filter(e => /^PREVIEW/.test(e.textContent.trim()))[0]
  if (b) b.click()
}

const IDMAP = {}

const rest = async root => {
  let last = ''
  const stop = Date.now() + 4000
  while (Date.now() < stop) {
    await wait(48)
    const now = Array.prototype.slice.call(root.querySelectorAll('*')).slice(0, 60)
      .map(e => { const r = e.getBoundingClientRect(); return r.top.toFixed(1) + ',' + r.left.toFixed(1) })
      .join('|')
    if (now === last) return true
    last = now
  }
  return false
}

async function learn () {
  showPreview()
  await wait(500)
  for (const s of SURFACES) {
    await oneFrame()
    const t = tabFor(s)
    if (!t) { IDMAP[s] = ''; continue }
    t.click()
    const stop = Date.now() + 6000
    let id = ''
    while (Date.now() < stop) {
      await wait(80)
      await oneFrame()
      id = idOf(incoming())
      if (id) break
    }
    IDMAP[s] = id
  }
  const missing = SURFACES.filter(s => !IDMAP[s])
  if (missing.length) console.warn('verify-matrix: no id learned for ' + missing.join(', '))
  return IDMAP
}

/* BOTH HALVES OF THE STATE, OR THE READING IS LABELLED WITH A REQUEST RATHER
   THAN A MEASUREMENT. */
async function go (surface, width) {
  const want = IDMAP[surface]
  if (!want) return { landed: false, why: 'no id learned for ' + surface + '. Call matrix.learn() first.' }
  await oneFrame()
  const t = tabFor(surface)
  if (!t) return { landed: false, why: 'no tab named ' + surface }
  t.click()
  await oneFrame()
  const temp = setWidth(width)
  let root = null
  let got = { w: -1, id: '' }
  const stop = Date.now() + 8000
  while (Date.now() < stop) {
    await wait(60)
    root = incoming()
    if (!root) continue
    got = { w: Math.round(root.getBoundingClientRect().width), id: idOf(root) }
    if (got.w === width && got.id === want) break
  }
  if (temp) temp.remove()
  if (got.w !== width || got.id !== want) {
    return { landed: false, why: surface + '@' + width + ' wanted ' + want
      + ', the frame is ' + (got.id || 'nothing') + '@' + got.w }
  }
  const rested = await rest(root)
  root = incoming()
  /* The frame can change under the settle, so ask again. */
  if (idOf(root) !== want) return { landed: false, why: 'the frame became ' + idOf(root) + ' during the settle' }
  return { landed: true, root, rested, width: Math.round(root.getBoundingClientRect().width), id: idOf(root) }
}

const ground = () => {
  const f = document.querySelector('.dmd-frame .dmd')
  return f ? getComputedStyle(f).backgroundColor : 'none'
}

let acc = null

function run (surfaces, widths, only) {
  if (typeof window.verify !== 'function') {
    console.error('verify-matrix: window.verify is absent. Load VERIFY-BROWSER.js first.')
    return 'not started'
  }
  const list = surfaces || SURFACES
  const w = widths || WIDTHS
  acc = {
    rows: [], notLanded: [], notRested: [], runs: 0, done: [], finished: false, err: null,
    total: list.length * w.length, started: Date.now(),
    groundBefore: ground(), groundAfter: null,
    pointer: matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine',
  }
  const A = acc
  A.promise = (async () => {
    try {
      for (const surface of list) {
        for (const width of w) {
          const g = await go(surface, width)
          A.runs++
          if (!g.landed) { A.notLanded.push(g.why); continue }
          if (!g.rested) A.notRested.push(surface + '@' + width)
          const v = await window.verify(g.root)
          for (const f of v.findings) {
            if (only && f.check !== only) continue
            A.rows.push({ s: surface, w: width, check: f.check, where: f.where, msg: f.msg })
          }
        }
        A.done.push(surface)
      }
    } catch (e) { A.err = String((e && e.message) || e) }
    A.groundAfter = ground()
    A.finished = true
  })()
  return 'running ' + A.total + ' runs at a ' + A.pointer + ' pointer'
}

/* A RUN THAT MEASURED NOTHING IS NOT A PASS, AND A PARTIAL ONE IS NOT EITHER.
   The verdict names its own coverage: how many runs landed, which did not, and
   which pointer was measured. */
function report (limit) {
  if (!acc) return 'nothing has run'
  const A = acc
  const byCheck = {}
  for (const r of A.rows) byCheck[r.check] = (byCheck[r.check] || 0) + 1
  const out = {
    finished: A.finished,
    runs: A.runs + ' of ' + A.total,
    landed: A.runs - A.notLanded.length,
    notLanded: A.notLanded,
    neverSettled: A.notRested,
    error: A.err,
    pointer: A.pointer,
    unmeasured: A.pointer === 'coarse' ? 'the fine-pointer case' : 'the coarse-pointer case',
    themeReturned: A.groundBefore === A.groundAfter,
    minutes: +((Date.now() - A.started) / 60000).toFixed(1),
    findings: A.rows.length,
    byCheck: Object.entries(byCheck).sort((a, b) => b[1] - a[1]),
  }
  const n = limit || 20
  out.sample = A.rows.slice(0, n).map(r => r.s + '@' + r.w + ' ' + r.check + ' ' + r.where + ' :: ' + r.msg)
  if (A.rows.length > n) out.sample.push('+ ' + (A.rows.length - n) + ' more not listed')
  return out
}

const probe = (surfaces, widths, only) => run(surfaces, widths, only)

window.matrix = { learn, go, run, probe, report,
  get acc () { return acc }, SURFACES, WIDTHS, DECLARED, IDMAP }
console.log('verify-matrix loaded. await matrix.learn() then matrix.run(), matrix.report()')

})()
