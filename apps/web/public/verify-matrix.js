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

/* ── THREE RULES COMPARE ONE RUN AGAINST ANOTHER, SO NO verify() CAN ASK THEM ──
 *
 * A render check sees one surface at one width with one pointer. These three
 * are differences BETWEEN two of those, and that is why all three sat in the
 * audit's checkable list while every other rule got a check:
 *
 *   Squeezing is not responding          narrowest against widest
 *   Three transitions were doing no work below a breakpoint against at it
 *   Grow the box, not the glyph          a fine run against a coarse one
 *
 * So each run records a SNAPSHOT, and the comparisons are pure functions over
 * two of them. One scorer, two callers: the suite pulls these same functions
 * out of this file and proves each on a synthetic pair.
 *
 * KEYED BY NAME, NEVER BY INDEX. A set gains and loses members between widths,
 * so position 2 at 320 and position 2 at 1024 are two different objects. That
 * is the fault the width report already records, and it is the same here.
 */
function snapKey (seen, el) {
  const cls = (el.getAttribute && el.getAttribute('class')) || ''
  const base = el.tagName.toLowerCase()
    + (cls ? '.' + cls.trim().split(/\s+/).slice(0, 2).join('.') : '')
  seen[base] = (seen[base] || 0) + 1
  return base + '#' + seen[base]
}

/* HOW MANY VERTICAL BANDS ITS CHILDREN OCCUPY. A flex row that WRAPPED has
   rearranged without changing a single declaration, so the declarations alone
   cannot answer whether a layout moved. Band by ink OVERLAP rather than by
   distinct tops: a button whose mark sits 3px above its label has two tops and
   one line. */
function snapLines (el) {
  const kids = Array.prototype.slice.call(el.children)
    .map(k => k.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0)
    .sort((a, b) => a.top - b.top)
  let lines = 0
  let edge = -Infinity
  for (const r of kids) {
    if (r.top >= edge) { lines++; edge = r.bottom }
    else edge = Math.max(edge, r.bottom)
  }
  return lines
}

/* A TRACK COUNT, NEVER THE TRACK SIZES. `grid-template-columns` computes to
   used pixels, so `repeat(3, 1fr)` reads as "300px 300px 300px" at 1024 and
   "55px 55px 55px" at 296. Comparing those strings calls a SQUEEZE a
   rearrangement, which is the exact fault this check exists to find. */
function snapTracks (v) {
  if (!v || v === 'none') return 0
  return v.trim().split(/\s+/).length
}

function snapshot (root) {
  const seen = {}
  const arrange = {}
  const boxes = {}
  const marks = {}
  for (const el of Array.prototype.slice.call(root.querySelectorAll('*'))) {
    if (!el.getClientRects || !el.getClientRects().length) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const k = snapKey(seen, el)
    /* A CONTAINER IS WHAT CAN REARRANGE, and two children is the fewest that
       can sit two ways. */
    if (/flex|grid/.test(cs.display) && el.children.length >= 2) {
      arrange[k] = cs.display + '|' + cs.flexDirection + '|' + cs.flexWrap
        + '|c' + snapTracks(cs.gridTemplateColumns)
        + '|r' + snapTracks(cs.gridTemplateRows)
        + '|l' + snapLines(el)
    }
    /* A CONTROL'S TARGET IS AS SMALL AS ITS SMALLER SIDE, which is the reading
       that let 28x44 pass for as long as it did. */
    if (el.matches('button, a[href], input, select, textarea, [role="button"], .btn, .nav-item, .tab')) {
      boxes[k] = Math.round(Math.min(r.width, r.height) * 100) / 100
    }
    /* A MARK IS THE THING THAT MUST NOT MOVE. */
    if (el.matches('svg, .icon')) {
      marks[k] = Math.round(Math.min(r.width, r.height) * 100) / 100
    }
  }
  return { arrange, boxes, marks }
}

/* ── A. SQUEEZING IS NOT RESPONDING ──
 *
 * Asked of the SURFACE, never of one container. A single-column stack is
 * correct to look identical at every width, so a per-container form would
 * fault every correct container on the page. A surface whose every container
 * is arranged identically at its narrowest and its widest has not responded at
 * all, and that claim cannot fire on a surface that did.
 */
function squeezed (narrow, wide) {
  const keys = Object.keys(narrow.arrange).filter(k => k in wide.arrange)
  if (!keys.length) return { asked: 0, moved: 0, why: 'no container in both snapshots' }
  const moved = keys.filter(k => narrow.arrange[k] !== wide.arrange[k])
  return { asked: keys.length, moved: moved.length, examples: moved.slice(0, 3) }
}

/* ── B. A BREAKPOINT THAT CHANGES NOTHING IS A THRESHOLD TO DELETE ──
 *
 * Three transitions in this project were measured doing no work: the control
 * never left the title's line and the title never wrapped for it. So compare
 * the snapshot just BELOW a declared width against the one AT it.
 *
 * ACROSS EVERY SURFACE, because one breakpoint may move one surface and leave
 * eleven alone. Asked per surface it would report eleven correct surfaces for
 * every real threshold.
 */
function inertBreakpoint (below, at) {
  const names = Object.keys(below)
  let asked = 0
  const changed = []
  for (const s of names) {
    if (!at[s]) continue
    asked++
    const a = below[s], b = at[s]
    for (const k of Object.keys(a.arrange)) {
      if (k in b.arrange && a.arrange[k] !== b.arrange[k]) { changed.push(s + ' ' + k); break }
    }
  }
  return { asked, changed: changed.length, examples: changed.slice(0, 3) }
}

/* ── C. GROW THE BOX, NOT THE GLYPH ──
 *
 * 40px for a finger, 24px for a mouse, and the ICON does not change. Two ways
 * this has broken here: a stated width defeating `aspect-ratio: 1`, so the
 * height went to 44 and the width stayed 28; and a touch promotion resizing a
 * button and leaving its mark at 10px.
 *
 * SO BOTH HALVES, or the check passes the fault it is named after. A box that
 * grew while its mark grew with it is the glyph-scaling fault. A box that
 * stayed while its mark stayed is the unpromoted control.
 */
function boxGrewMarkDidNot (fine, coarse, floor) {
  const small = []
  const grownMarks = []
  let boxesAsked = 0
  let marksAsked = 0
  for (const k of Object.keys(fine.boxes)) {
    if (!(k in coarse.boxes)) continue
    boxesAsked++
    /* AT OR ABOVE THE FLOOR, and never smaller than it was on a mouse. */
    if (coarse.boxes[k] < floor - 0.5 || coarse.boxes[k] < fine.boxes[k] - 0.5) {
      small.push(k + ' ' + fine.boxes[k] + ' to ' + coarse.boxes[k])
    }
  }
  for (const k of Object.keys(fine.marks)) {
    if (!(k in coarse.marks)) continue
    marksAsked++
    if (Math.abs(coarse.marks[k] - fine.marks[k]) > 0.5) {
      grownMarks.push(k + ' ' + fine.marks[k] + ' to ' + coarse.marks[k])
    }
  }
  return {
    boxesAsked, marksAsked,
    small: small.length, grownMarks: grownMarks.length,
    examples: small.slice(0, 3).concat(grownMarks.slice(0, 3)),
  }
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
    /* ── WHICH CHECKS NEVER SPOKE ──
     *
     * The source side asserts that every check fires on its own fixture. The
     * render side had no such gate, so a check whose selector stops matching
     * goes quiet, and quiet reads as a pass.
     *
     * A check absent from ONE surface is normal. Silent across EVERY surface
     * in the run is the fault, so the union belongs here rather than in one
     * verify call. Measured when this shipped: 20 of the render checks spoke
     * and the rest said nothing over twelve surfaces. */
    spoke: new Set(), ranAny: new Set(),
    /* ONE SNAPSHOT PER RUN, keyed surface then width, so the three cross-run
       rules have two readings to compare rather than one. */
    snaps: {},
  }
  const A = acc
  A.promise = (async () => {
    /* ── A PAGE THAT RUNS NO FRAMES CANNOT BE DRIVEN, SO REFUSE ──
     *
     * A hidden or frozen tab stops the document timeline, and every deadline
     * here is wall clock. So each bounded poll gets one sample instead of
     * dozens, and a cross-fade never completes. Two trees stay mounted, which
     * is the shape that measures the surface LEAVING.
     *
     * Measured on 10 September 2026, on this exact fault: a 100ms interval
     * fired 6 times in 25 seconds, learn() took 36.6s against 3.9s, and the
     * matrix reached 2 of 12 runs in 6.3 minutes. That is a hang rather than
     * a slow run, and the partial result it produces cannot be trusted.
     *
     * REPORTING IT IS NOT ENOUGH HERE. A wrong surface labelled with the one
     * requested sends a reader to a clean page to hunt a real fault. */
    if (typeof window.verifyClockRuns === 'function' && !(await window.verifyClockRuns())) {
      A.err = 'the document runs no animation frames, so its clock is stopped. Nothing can settle,'
        + ' every bounded wait gets one sample, and a cross-fade can leave two surfaces mounted,'
        + ' which measures the one LEAVING. Nothing was measured. Bring the tab to the foreground'
        + ' and run again.'
      console.error('verify-matrix: ' + A.err)
      A.framesStopped = true
      A.groundAfter = ground()
      A.finished = true
      return
    }
    /* ── A VERDICT NAMES ITS OWN COVERAGE, AND MOTION IS PART OF IT ──
     *
     * The gate passes on either of two grounds: the clock ticks, or nothing
     * on the page can animate. The second is sound and it is a DIFFERENT
     * claim, because no transition ran during the run. Say which, in the
     * report, rather than letting the two read the same. */
    A.clock = window.verifyClockWhy
      ? (window.verifyClockWhy.ticks ? 'ticking'
        : 'stopped, and nothing on the page animates, so there was nothing to settle')
      : 'unmeasured'
    try {
      for (const surface of list) {
        for (const width of w) {
          const g = await go(surface, width)
          A.runs++
          if (!g.landed) { A.notLanded.push(g.why); continue }
          if (!g.rested) A.notRested.push(surface + '@' + width)
          /* BEFORE verify(), because one check presses the theme control and
             the press re-renders the tree it measured. A snapshot taken after
             that is a snapshot of another state. */
          if (!A.snaps[surface]) A.snaps[surface] = {}
          A.snaps[surface][width] = snapshot(g.root)
          const v = await window.verify(g.root)
          /* An OLDER verifier returns no coverage, and a driver that assumed
             one would crash rather than say so. */
          if (v.coverage) {
            for (const id of v.coverage.ran) A.ranAny.add(id)
            for (const id of v.coverage.spoke) A.spoke.add(id)
          }
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
    /* WHICH GROUND THE GATE PASSED ON. A run with the clock stopped and every
       transition off measures a page that is at rest by construction, which is
       sound and is not the same claim as a run with motion live. */
    ...(A.clock ? { clock: A.clock } : {}),
    /* A REFUSAL MUST READ AS A REFUSAL, NEVER AS A CLEAN RUN. Without this
       line a stopped clock prints 0 of 36 runs and 0 findings, and the second
       number is what a reader remembers. */
    ...(A.framesStopped ? { framesStopped: 'the document ran no animation frames, so NOTHING was measured' } : {}),
    themeReturned: A.groundBefore === A.groundAfter,
    minutes: +((Date.now() - A.started) / 60000).toFixed(1),
    findings: A.rows.length,
    byCheck: Object.entries(byCheck).sort((a, b) => b[1] - a[1]),
  }
  /* ── AND HOW MANY CHECKS NEVER SPOKE ──
   * A run that measured nothing is not a pass, and this is where the render
   * side says so. Silent across every surface means the check may have been a
   * no-op for as long as it existed. */
  if (A.ranAny.size) {
    const silent = [...A.ranAny].filter(id => !A.spoke.has(id)).sort()
    out.checksRan = A.ranAny.size
    out.checksThatSpoke = A.spoke.size
    out.checksSilentEverywhere = silent.length
    /* Complete rather than a window, because the whole point is the list. */
    if (silent.length) out.silent = silent
  } else {
    out.coverage = 'the verifier returned none, so the silent set is UNMEASURED'
  }
  /* ── THE TWO CROSS-RUN RULES THIS HALF CAN ANSWER ──
   *
   * The pointer one needs the OTHER half's snapshots, so it lives in
   * `comparePointers` and a reader passes both accumulators. These two are
   * answerable inside one run.
   *
   * A RUN THAT MEASURED NOTHING SAYS SO. With one width there is no pair, and
   * silence there would read as a surface that rearranged. */
  const surfaces = Object.keys(A.snaps)
  if (surfaces.length) {
    const widths = (A.snaps[surfaces[0]] && Object.keys(A.snaps[surfaces[0]]).map(Number).sort((a, b) => a - b)) || []
    if (widths.length < 2) {
      out.rearranged = 'one width was measured, so no surface could be compared against itself'
    } else {
      const lo = widths[0], hi = widths[widths.length - 1]
      const flat = []
      let asked = 0
      for (const s of surfaces) {
        const a = A.snaps[s][lo], b = A.snaps[s][hi]
        if (!a || !b) continue
        asked++
        const q = squeezed(a, b)
        if (!q.moved) flat.push(s + ' (' + q.asked + ' containers identical at ' + lo + ' and ' + hi + ')')
      }
      out.rearranged = asked + ' surface(s) compared at ' + lo + ' against ' + hi
      if (flat.length) out.squeezedRatherThanResponded = flat
    }
    /* ── ASK THE THRESHOLD THE STYLESHEET DECLARES, NOT THE TOKEN THE
       DOCUMENT PUBLISHES ──
     *
     * The first version walked the document's own breakpoint scale and
     * reported `xl` at 1280 and `2xl` at 1536 as doing no work. Both readings
     * were true and the SUBJECT was wrong. Those are published tokens whose
     * consumer is somebody else's build, and the preview stylesheet reads
     * neither. So the check faulted a published scale for the preview's own
     * failure to demonstrate it, and acting on it would delete two steps a
     * reader's build may depend on.
     *
     * A threshold the STYLESHEET declares is ours, and it has to earn its
     * place. Read them off the served CSS rather than keeping a list, so a
     * threshold added tomorrow joins without being remembered.
     *
     * SEVERAL THRESHOLDS CAN SHARE ONE INTERVAL, and the sweep cannot tell
     * them apart: 384, 400, 430 and 460 all sit between 320 and 480. So the
     * finding names the interval and every threshold inside it, rather than
     * claiming to know which one was inert. */
    const stated = []
    for (const sh of Array.prototype.slice.call(document.styleSheets)) {
      let rules = null
      try { rules = sh.cssRules } catch (e) { continue }
      const walk = list => {
        for (const r of Array.prototype.slice.call(list || [])) {
          if (r.conditionText) {
            const m = /(?:max|min)-width:\s*(\d+)px/.exec(r.conditionText)
            /* A SENTINEL IS NOT A THRESHOLD. The build substitutes real
               numbers, so a 999901 left in a sheet is an unsubstituted rule
               that never matches, and a separate check owns that. */
            if (m && +m[1] < 100000 && stated.indexOf(+m[1]) < 0) stated.push(+m[1])
          }
          if (r.cssRules && r.cssRules.length) walk(r.cssRules)
        }
      }
      walk(rules)
    }
    stated.sort((a, b) => a - b)
    const inert = []
    let bpAsked = 0
    for (let i = 1; i < widths.length; i++) {
      const lo = widths[i - 1], hi = widths[i]
      /* A max-width threshold at T separates T from T+1, so an interval
         straddles it when lo <= T < hi. */
      const inside = stated.filter(t => t >= lo && t < hi)
      if (!inside.length) continue
      const a = {}, b = {}
      for (const s of surfaces) {
        if (A.snaps[s][lo]) a[s] = A.snaps[s][lo]
        if (A.snaps[s][hi]) b[s] = A.snaps[s][hi]
      }
      if (!Object.keys(a).length || !Object.keys(b).length) continue
      bpAsked++
      const r = inertBreakpoint(a, b)
      if (!r.changed) {
        inert.push(lo + ' to ' + hi + ' holds ' + inside.join(', ')
          + ' and nothing moved on ' + r.asked + ' surfaces')
      }
    }
    out.thresholdsTheStylesheetStates = stated.length
    out.intervalsMeasured = bpAsked
    if (inert.length) out.breakpointsDoingNoWork = inert
    /* AND A THRESHOLD NO INTERVAL STRADDLES IS UNMEASURED, NEVER CLEAN. */
    const unswept = stated.filter(t => {
      for (let i = 1; i < widths.length; i++) if (t >= widths[i - 1] && t < widths[i]) return false
      return true
    })
    if (unswept.length) out.thresholdsNoPairStraddles = unswept
  } else {
    out.rearranged = 'no snapshot was taken, so the cross-width rules are UNMEASURED'
  }

  const n = limit || 20
  out.sample = A.rows.slice(0, n).map(r => r.s + '@' + r.w + ' ' + r.check + ' ' + r.where + ' :: ' + r.msg)
  if (A.rows.length > n) out.sample.push('+ ' + (A.rows.length - n) + ' more not listed')
  return out
}

/* ── AND THE POINTER RULE NEEDS BOTH HALVES ──
 *
 * One run measures one pointer, which is the whole reason the coarse case went
 * unmeasured for weeks. So this takes two accumulators and says which surfaces
 * and widths it could pair. A pair it could not find is named rather than
 * skipped: an unpaired width reads exactly like a clean one.
 */
function comparePointers (fineSnaps, coarseSnaps, floor) {
  const out = { paired: 0, findings: [], unpaired: [] }
  for (const s of Object.keys(fineSnaps)) {
    for (const w of Object.keys(fineSnaps[s])) {
      const c = coarseSnaps[s] && coarseSnaps[s][w]
      if (!c) { out.unpaired.push(s + '@' + w); continue }
      out.paired++
      const r = boxGrewMarkDidNot(fineSnaps[s][w], c, floor)
      if (r.small || r.grownMarks) {
        out.findings.push(s + '@' + w + ': ' + r.small + ' control(s) under the floor, '
          + r.grownMarks + ' mark(s) that changed size — ' + r.examples.join('; '))
      }
    }
  }
  return out
}

const probe = (surfaces, widths, only) => run(surfaces, widths, only)

window.matrix = { learn, go, run, probe, report,
  /* The cross-run half, exported so a reader can pair two halves by hand and
     so the suite can call the same functions it proves. */
  snapshot, squeezed, inertBreakpoint, boxGrewMarkDidNot, comparePointers,
  get acc () { return acc }, SURFACES, WIDTHS, DECLARED, IDMAP }
console.log('verify-matrix loaded. await matrix.learn() then matrix.run(), matrix.report()')

})()
