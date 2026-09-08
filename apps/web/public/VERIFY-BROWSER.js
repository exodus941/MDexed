/* Verify the built page against the design system that shipped with it.
 *
 * Paste this whole file into the browser console on the page you built, then:
 *
 *   await verify()
 *
 * It measures what only exists once the page is laid out. Run it at every
 * breakpoint the system publishes AND at the midpoint between each adjacent
 * pair: a fault lives where the layout changes, and no declared width sits
 * inside that band.
 *
 * Run VERIFY.mjs over the source for the other half.
 *
 * Generated with the design system. Do not edit; the next export overwrites it.
 */
;(function () {

const round = n => Math.round(n * 100) / 100
const px = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
const tokenValue = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
const frame = () => new Promise(r => setTimeout(r, 60))

function visible (el) {
  if (!el.getClientRects || !el.getClientRects().length) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
}

function name (el) {
  if (!el || !el.tagName) return '?'
  const cls = el.getAttribute && el.getAttribute('class')
  const label = el.getAttribute && el.getAttribute('aria-label')
  return el.tagName.toLowerCase()
    + (cls ? '.' + String(cls).trim().split(/\s+/).join('.') : '')
    + (label ? '[' + label + ']' : '')
}

const all = sel => Array.prototype.slice.call(document.querySelectorAll(sel)).filter(visible)
const boxOf = el => { const r = el.getBoundingClientRect(); return r.width ? r : null }

/* The union of the element's OWN text, ignoring text inside its children. */
function textRect (el) {
  let box = null
  for (const n of el.childNodes) {
    if (n.nodeType !== 3 || !n.textContent.trim()) continue
    const r = document.createRange(); r.selectNode(n)
    const b = r.getBoundingClientRect()
    if (!b.width) continue
    box = box
      ? { left: Math.min(box.left, b.left), right: Math.max(box.right, b.right),
          top: Math.min(box.top, b.top), bottom: Math.max(box.bottom, b.bottom), rects: box.rects + r.getClientRects().length }
      : { left: b.left, right: b.right, top: b.top, bottom: b.bottom, rects: r.getClientRects().length }
  }
  return box
}

/* DOES THIS CONTROL SHOW ANY WORDS AT ALL, at any depth?
 *
 * A DIFFERENT QUESTION FROM textRect, AND SHARING THAT ONE BLINDED A CHECK.
 * textRect must stay direct-only: the cap-band rules measure an element's OWN
 * text, and a child's rect can start at an ornament instead of at the words.
 *
 * The icon-only rules ask the opposite. A button holding an svg and a
 * <span>Export Statement</span> has no direct text node, so textRect returned
 * null and the control fell into the label-less branch. Measured on one build:
 * eight findings reporting a mark "with no label" 66 to 146px off centre, on
 * five nav items and three labelled controls. That offset is just the distance
 * from a leading mark to the middle of a wide control, which is correct.
 *
 * So ask what the ENGINE renders, and ignore text a screen reader alone sees:
 * a visually hidden label is not visible words. */
function hasWords (el) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walk.nextNode())) {
    if (!n.textContent.trim()) continue
    const p = n.parentElement
    if (!p || !visible(p)) continue
    const r = document.createRange(); r.selectNode(n)
    const b = r.getBoundingClientRect()
    if (b.width > 0 && b.height > 0) return true
  }
  return false
}

/* The cap line and the baseline of an element's own text, from font metrics.
   A rectangle cannot give you either one. */
function capBand (el) {
  const t = textRect(el)
  if (!t) return null
  const cs = getComputedStyle(el)
  const ctx = capBand.ctx || (capBand.ctx = document.createElement('canvas').getContext('2d'))
  ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
  const m = ctx.measureText('H')
  const baseline = t.top + m.fontBoundingBoxAscent
  return { cap: baseline - m.actualBoundingBoxAscent, baseline, lines: t.rects }
}

/* The nearest ancestor that states a horizontal padding, and its padding box.
   That padding is the margin every heading in the container already sits on. */
function padded (el) {
  let n = el.parentElement
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n)
    const pl = px(cs.paddingLeft), pr = px(cs.paddingRight)
    if (pl > 0 || pr > 0) {
      const r = n.getBoundingClientRect()
      return { el: n, left: r.left + px(cs.borderLeftWidth) + pl, right: r.right - px(cs.borderRightWidth) - pr }
    }
    n = n.parentElement
  }
  return null
}

/* ── WHAT A TOKEN ACTUALLY PAINTS, IN THE FORM THE ENGINE REPORTS IT ──
 *
 * getPropertyValue hands back the AUTHORED string, so a token written as a
 * hex can never be compared against a computed background-color, which the
 * engine always reports as an rgb triple. Paint the token on a probe and read
 * the engine's own answer, so both sides of every comparison come from one
 * place.
 *
 * A missing token is not an error here. A var() naming nothing is invalid at
 * computed-value time, and background-color does not inherit, so it resolves
 * to transparent. That is reported as null rather than compared. */
/* Read the ALPHA rather than pattern-matching one spelling of transparent.
   A ground at 2% opacity is still a ground, and a regex looking for a zero
   would have to know how the engine punctuates its own output. */
function opaque (v) {
  if (!v || v === 'transparent') return false
  const open = v.indexOf('('); if (open < 0) return true
  const parts = v.slice(open + 1, v.lastIndexOf(')')).split(',')
  return parts.length < 4 || parseFloat(parts[3]) > 0
}

/* THE PROBE COMES BACK OUT, and leaving it in cost a false positive. Cached
   between calls it is a bare div painted --c-selected, sitting in the body
   with the page's own cards as siblings. The selection check then measured
   the instrument and reported a fault on a correct page. */
function paints (token) {
  const p = document.body.appendChild(document.createElement('div'))
  p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none'
  p.style.backgroundColor = 'var(' + token + ')'
  const v = getComputedStyle(p).backgroundColor
  p.remove()
  return opaque(v) ? v : null
}

/* The nearest ancestor that actually paints something behind this element. */
function ground (el) {
  let n = el.parentElement
  while (n) {
    const bg = getComputedStyle(n).backgroundColor
    if (opaque(bg)) return { el: n, bg }
    n = n.parentElement
  }
  return null
}

/* A cell's own content edges. */
function inner (cell) {
  const cs = getComputedStyle(cell), r = cell.getBoundingClientRect()
  return {
    left: r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft),
    right: r.right - px(cs.borderRightWidth) - px(cs.paddingRight),
  }
}

const CONTROL = 'button, input, select, textarea, a[href], [role=button], [role=tab], .btn'

/* ── A CONTROL CLIPPED TO A PIXEL IS NOT THE CONTROL A PERSON SEES ──
 *
 * The standard way to build a switch with no script is a visually hidden
 * checkbox and a label that draws it. The input keeps a 1x1 box so it stays
 * focusable and nameable, and the LABEL is what the reader hits.
 *
 * Measured without this: a row of two 36px buttons reported "heights 36, 1,
 * 36", and the same input reported 1x1 against a 44px touch floor. Both are
 * the check reading the wrong element. Its label carries the size, the target
 * and the hit area, and every one of those checks already measures the label.
 */
const clippedAway = el => {
  const r = el.getBoundingClientRect()
  if (r.width > 2 || r.height > 2) return false
  const cs = getComputedStyle(el)
  return cs.position === 'absolute' &&
    (cs.clipPath !== 'none' || cs.clip !== 'auto' || cs.overflow === 'hidden')
}

function describe (el) {
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const band = capBand(el)
  return {
    el, rect,
    label: name(el),
    text: Boolean(band),
    lines: band ? band.lines : 0,
    baseline: band ? band.baseline : null,
    control: el.matches(CONTROL) && !clippedAway(el),
  }
}

/* Band a container's children by whether their ink OVERLAPS vertically. A
   wrapped row is several rows, and any proximity constant gets that wrong
   somewhere. Only flex and grid containers are asked: a block container has
   one child per line by definition. */
function rows () {
  const out = []
  for (const parent of document.querySelectorAll('*')) {
    const cs = getComputedStyle(parent)
    if (!/flex|grid/.test(cs.display)) continue
    const kids = Array.prototype.slice.call(parent.children).filter(visible)
    if (kids.length < 2) continue
    const items = kids.map(describe).filter(Boolean)
    const bands = []
    for (const it of items) {
      const found = bands.find(b => b.some(x => it.rect.top < x.rect.bottom && x.rect.top < it.rect.bottom))
      if (found) found.push(it); else bands.push([it])
    }
    for (const b of bands) if (b.length > 1) out.push({ name: name(parent), items: b, parent })
  }
  return out
}

/* MEASURE A SETTLED LAYOUT, NEVER A FRAME. A fixed pause is a guess, and a
   guess fifty milliseconds short measures the entrance animation. Ask the
   browser which animations are running instead, and drop the ones that never
   finish. */
async function settle (deadline) {
  const stop = Date.now() + (deadline || 2000)
  for (let i = 0; i < 40; i++) {
    const running = document.getAnimations
      ? document.getAnimations().filter(a => a.playState === 'running' && a.effect &&
          (a.effect.getComputedTiming().iterations || 1) !== Infinity)
      : []
    if (!running.length) break
    await Promise.race([
      Promise.all(running.map(a => a.finished.catch(() => {}))),
      new Promise(r => setTimeout(r, 200)),
    ])
    if (Date.now() > stop) return false
  }
  await frame()
  return true
}

const findings = []
const notes = []
let current = ''
const fail = (where, msg) => findings.push({ check: current, where, msg })
const note = msg => notes.push(current + ': ' + msg)

async function run (id, body) {
  current = id
  try { await body() } catch (err) { fail('(the check itself)', id + ' threw: ' + err.message) }
}

window.verify = async function verify () {
  findings.length = 0; notes.length = 0
  const settled = await settle()
  if (!settled) console.warn('VERIFY: the page never came to rest. Measurements below may be a frame of an animation.')

  /* a-composite-widget-is-one-tab-stop — A tablist, menu, listbox, radiogroup or toolbar exposes exactly one tab stop. */
  await run("a-composite-widget-is-one-tab-stop", async () => {
    const GROUPS = '[role="tablist"], [role="menu"], [role="menubar"], [role="radiogroup"], [role="listbox"], [role="toolbar"], [role="tree"]'
    const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'
    for (const g of all(GROUPS)) {
      const r = g.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      if (g.hasAttribute('aria-activedescendant')) continue
      const stops = Array.prototype.filter.call(g.querySelectorAll(FOCUSABLE), function (el) {
        const t = el.getAttribute('tabindex')
        if (t !== null) return Number(t) >= 0
        return !el.disabled
      })
      if (stops.length > 1)
        fail(name(g), 'a composite widget with ' + stops.length + ' tab stops. It owes exactly one. Tab enters the group and lands on the ACTIVE item, and the arrows move within it. Give the active item tabindex="0" and every other item tabindex="-1".')
      else if (stops.length === 0)
        fail(name(g), 'a composite widget with no tab stop at all, so a keyboard cannot enter it. Give the active item tabindex="0", or put aria-activedescendant on this container and make the container itself focusable.')
    }
  })

  /* a-tab-names-its-panel — Every tab states aria-selected and names its panel, and the panel names its tab. */
  await run("a-tab-names-its-panel", async () => {
    for (const t of all('[role="tab"]')) {
      if (!t.hasAttribute('aria-selected'))
        fail(name(t), 'a tab states aria-selected. It goes on EVERY tab in the strip, false as well as true, or a reader hears which one is chosen and never that the rest are not.')
      const controls = t.getAttribute('aria-controls')
      if (!controls) {
        fail(name(t), 'a tab names the panel it shows, with aria-controls pointing at that panel id.')
        continue
      }
      if (!document.getElementById(controls))
        fail(name(t), 'aria-controls names ' + controls + ' and no element carries that id, so the tab points at nothing.')
    }
    for (const p of all('[role="tabpanel"]')) {
      if (!p.getAttribute('aria-labelledby'))
        fail(name(p), 'a tabpanel takes its name from its own tab, with aria-labelledby. Repeating the words in an aria-label is a second copy that drifts.')
    }
  })

  /* an-action-centres-on-its-heading-cap-band — A control beside a heading centres its box between that heading’s cap line and baseline. */
  await run("an-action-centres-on-its-heading-cap-band", async () => {
    for (const h of all('h1,h2,h3,h4,h5,h6')) {
      const band = capBand(h)
      if (!band) continue
      const hSize = parseFloat(getComputedStyle(h).fontSize) || 0
      const range = document.createRange()
      range.selectNodeContents(h)
      const rects = Array.prototype.slice.call(range.getClientRects())
        .filter(function (r) { return r.width > 0 && r.height > 0 })
      if (!rects.length) continue
      const tops = []
      for (const r of rects) {
        if (!tops.some(function (t) { return Math.abs(t - r.top) < 1 })) tops.push(r.top)
      }
      const first = Math.min.apply(null, tops)
      const ascent = band.baseline - first
      const capH = band.baseline - band.cap
      const centres = tops.map(function (t) { return t + ascent - capH / 2 })
      const pairing = el => {
        let n = el
        for (let i = 0; i < 4 && n; i++) {
          const p = n.parentElement
          if (!p) return null
          if (p.contains(h)) {
            const ps = getComputedStyle(p)
            const rowish = (ps.display === 'flex' || ps.display === 'inline-flex')
              && !/column/.test(ps.flexDirection)
            if (!rowish) return null
            let m = h
            while (m && m.parentElement !== p) m = m.parentElement
            return m && m !== n ? { item: n, headItem: m } : null
          }
          n = p
        }
        return null
      }
      const sameLine = pair =>
        pair.item.offsetTop < pair.headItem.offsetTop + pair.headItem.offsetHeight &&
        pair.item.offsetTop + pair.item.offsetHeight > pair.headItem.offsetTop
      for (const c of all('button, a[href], [role="button"], .btn')) {
        if (h.contains(c) || c.contains(h)) continue
        const r = c.getBoundingClientRect()
        if (!r.width || !r.height) continue
        /* On the heading's ROW. Dropped below it is the collapsed layout. */
        const pair = pairing(c)
        if (!pair || !sameLine(pair)) continue
        const cr = c.getBoundingClientRect()
        const onTop = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2)
        if (onTop && onTop !== c && !c.contains(onTop) && !onTop.contains(c)) continue
        const cSize = parseFloat(getComputedStyle(c).fontSize) || 0
        if (!cSize || hSize < cSize * 1.5) continue
        const mid = (r.top + r.bottom) / 2
        let off = null
        for (const centre of centres) {
          const d = mid - centre
          if (off === null || Math.abs(d) < Math.abs(off)) off = d
        }
        if (off === null || Math.abs(off) <= 1) continue
        fail(name(c), 'this control sits ' + round(off) + 'px from the cap-band centre of ' + name(h) + ' beside it. The band is the top of a capital letter to the baseline, and it is ' + round(capH) + 'px on a ' + round(hSize) + 'px heading. A line box is taller than that, because it carries leading and descender space the capitals never use, so centring on the ROW lands the control below the letters. Centre the box between those two lines and let it overhang both equally.')
      }
    }
  })

  /* a-column-of-figures-takes-the-mono-face — Every cell in a column of figures is set in the mono family. */
  await run("a-column-of-figures-takes-the-mono-face", async () => {
    const MONO = /mono|courier|consolas|menlo|ui-monospace/i
    const FIGURE = /^[^0-9A-Za-z]{0,2}[0-9](?:[0-9,.:/\u00a0 ]*[0-9])?[^0-9A-Za-z]?$/
    const ABSENT = /^(?:[-\u2013\u2014\u2212]|n\/a|none|)$/i
    for (const table of all('table')) {
      const rows = Array.prototype.filter.call(table.querySelectorAll('tbody tr'), function (r) {
        const b = r.getBoundingClientRect(); return b.width > 0 && b.height > 0
      })
      if (rows.length < 2) continue
      const cols = {}
      for (const r of rows) {
        Array.prototype.forEach.call(r.children, function (td, i) {
          (cols[i] = cols[i] || []).push(td)
        })
      }
      for (const key of Object.keys(cols)) {
        const cells = cols[key]
        if (cells.length < 2) continue
        let figures = 0
        let body = 0
        let first = null
        let mixed = false
        for (const td of cells) {
          const text = (td.textContent || '').replace(/\s+/g, ' ').trim()
          if (ABSENT.test(text)) continue
          if (!FIGURE.test(text)) { mixed = true; break }
          figures++
          const holder = td.querySelector('*') || td
          if (!MONO.test(getComputedStyle(holder).fontFamily)) { body++; if (!first) first = td }
        }
        if (mixed || figures < 2 || !body) continue
        fail(name(first), 'this column holds ' + figures + ' figures and ' + body + ' of them are set in the body face. A column is what makes the mono face matter: it gives every digit one width, so the digits stack. A proportional face cannot line them up however carefully the cells are padded. Set the family on the cell, not on one span inside it, or the next value added lands in the wrong face.')
      }
    }
  })

  /* a-standalone-figure-keeps-the-body-face — A figure with no column to stack against keeps the body face. */
  await run("a-standalone-figure-keeps-the-body-face", async () => {
    const MONO = /mono|courier|consolas|menlo|ui-monospace/i
    const FIGURE = /^[^0-9A-Za-z]{0,2}[0-9](?:[0-9,.:/\u00a0 ]*[0-9])?[^0-9A-Za-z]?$/
    for (const el of all('*')) {
      if (el.children.length) continue
      if (el.closest('table, code, pre, kbd, samp')) continue
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!text || !FIGURE.test(text)) continue
      const face = getComputedStyle(el).fontFamily
      if (!MONO.test(face)) continue
      fail(name(el), 'this figure reads "' + text + '" and sits in the mono face with no column to stack against. A column is what makes that face matter: it gives every digit one width so the digits line up down the page. Alone it buys nothing and costs the page its own voice. A stat tile, a hero price, a badge count and a number inside a sentence all keep the body face.')
    }
  })

  /* an-amount-lines-up-on-its-end-edge — Amounts in one column share an end edge. The mono face alone does not line them up. */
  await run("an-amount-lines-up-on-its-end-edge", async () => {
    const MONO = /mono|courier|consolas|menlo|ui-monospace/i
    const FIGURE = /^[^0-9A-Za-z]{0,2}[0-9](?:[0-9,.\u00a0 ]*[0-9])?[^0-9A-Za-z]?$/
    const MARKED = /[,.]|^[^0-9]|[^0-9]$/
    const ENDWISE = /right|end/
    for (const table of all('table')) {
      const rows = Array.prototype.filter.call(table.querySelectorAll('tbody tr'), function (r) {
        const b = r.getBoundingClientRect(); return b.width > 0 && b.height > 0
      })
      if (rows.length < 2) continue
      const cols = {}
      for (const r of rows) {
        Array.prototype.forEach.call(r.children, function (td, i) {
          (cols[i] = cols[i] || []).push(td)
        })
      }
      for (const key of Object.keys(cols)) {
        const cells = cols[key]
        if (cells.length < 2) continue
        const rights = []
        const widths = []
        let endwise = false
        let amounts = true
        for (const td of cells) {
          const holder = td.querySelector('*') || td
          const text = (td.textContent || '').replace(/\s+/g, ' ').trim()
          if (!FIGURE.test(text) || !MARKED.test(text)) { amounts = false; break }
          if (!MONO.test(getComputedStyle(holder).fontFamily)) { amounts = false; break }
          if (ENDWISE.test(getComputedStyle(td).textAlign) || ENDWISE.test(getComputedStyle(holder).textAlign)) endwise = true
          const range = document.createRange()
          range.selectNodeContents(holder)
          const box = range.getBoundingClientRect()
          rights.push(box.right)
          widths.push(box.width)
        }
        if (!amounts || rights.length < 2) continue
        const spread = Math.max.apply(null, rights) - Math.min.apply(null, rights)
        const vary = Math.max.apply(null, widths) - Math.min.apply(null, widths)
        if (spread > 1) {
          fail(name(cells[0]), 'this column holds amounts and their end edges differ by ' + spread.toFixed(1) + 'px, so the magnitudes do not line up. The mono face gives every digit one width. The END EDGE is what stacks the digits over each other, and it is the half that was missing. A single class loses to a descendant selector, so check that whatever sets the alignment actually wins.')
        } else if (vary <= 1 && !endwise) {
          fail(name(cells[0]), 'this column of amounts lines up only because every value is the same width. Nothing here declares an end alignment, so the first value that gains a digit breaks the column. Give the cells text-align: end.')
        }
      }
    }
  })

  /* a-tick-label-centres-on-its-gridline — Every value tick sits on the gridline it names, measured from its cap band. */
  await run("a-tick-label-centres-on-its-gridline", async () => {
    /* THE PERIOD IS THE LAST STOP, in px or as a share of the box. */
    const periodOf = (bg, h) => {
      const m = bg.match(/,\s*[^,]*?\s([\d.]+)(px|%)\s*\)\s*$/)
      if (!m) return null
      return m[2] === "%" ? (+m[1] / 100) * h : +m[1]
    }
    let measured = 0
    for (const chart of all("[class*=chart]")) {
      const grid = chart.querySelector("[class*=grid]")
      const ticks = chart.querySelector("[class*=ticks]")
      if (!grid || !ticks) continue
      const gb = boxOf(grid); if (!gb || !gb.height) continue
      const p = periodOf(getComputedStyle(grid).backgroundImage, gb.height)
      /* A ONE PIXEL PERIOD IS THE LINE ITSELF, never the gap between two. */
      if (!p || p < 4) continue
      /* The gradient runs bottom up, and the labels run top down. */
      const lines = []
      for (let y = gb.bottom; y >= gb.top - 0.5; y -= p) lines.push(y)
      lines.reverse()
      const labels = Array.prototype.filter.call(ticks.children,
        k => (k.textContent || "").trim())
      /* TWO TICKS HAVE NOTHING TO DRIFT. The fault is at the ends. */
      if (labels.length < 3 || labels.length !== lines.length) continue
      measured++
      const offs = []
      for (let i = 0; i < labels.length; i++) {
        const band = capBand(labels[i]); if (!band) continue
        offs.push(((band.cap + band.baseline) / 2) - lines[i])
      }
      if (!offs.length) continue
      const worst = offs.reduce((a, x) => Math.abs(x) > Math.abs(a) ? x : a, 0)
      /* A WHOLE PIXEL, because centring shifts a thing by half the difference
         and nothing under one pixel can be repaired. The recorded fault is
         half a line, which is 9.72 on a 12px caption. */
      if (Math.abs(worst) <= 2) continue
      fail(name(chart), "this tick label sits " + round(worst) + "px from the gridline it names, over " + labels.length + " ticks at a " + round(p) + "px period. space-between distributes the label BOXES between the plot edges, not their centres, so the ends sit half a line out and the middle one is right by accident. Extend the tick column by half a line at each end with a negative block margin, derived from the caption size and its leading.")
    }
    /* A RUN THAT MEASURED NOTHING IS NOT A PASS. */
    if (!measured) note("no chart paired a gridline gradient with a tick column, so nothing was measured")
    else note(measured + " tick columns measured against their gridlines")
  })

  /* a-declared-line-has-area-to-paint-in — A layer that declares an axis or a gridline has area on both sides, or it paints nothing. */
  await run("a-declared-line-has-area-to-paint-in", async () => {
    /* A LAYER DECLARES ITS LINE, so read the declaration rather than guessing
       from a class name. An axis is a border. A gridline set is a repeating
       gradient, which is one box rather than a run of elements. */
    let layers = 0
    for (const el of all("[class*=chart]")) {
      const cs = getComputedStyle(el)
      const widths = ["Top", "Right", "Bottom", "Left"]
        .map(side => parseFloat(cs["border" + side + "Width"]) || 0)
      const edges = widths.filter(w => w > 0).length
      const gradient = cs.backgroundImage.indexOf("gradient") >= 0
      if (!edges && !gradient) continue
      layers++
      const r = el.getBoundingClientRect()
      /* ONE PIXEL ON EITHER SIDE. A line needs a length as well as a width, so
         a box thinner than a pixel on either axis paints nothing at all. */
      if (r.width >= 1 && r.height >= 1) continue
      fail(name(el), "this layer declares " + (edges ? edges + " edge(s)" : "") + (edges && gradient ? " and " : "") + (gradient ? "a gradient" : "") + " and measures " + round(r.width) + "x" + round(r.height) + ", so it paints nothing. An absolutely positioned box with no inset takes its CONTENT, and a line layer has none. State inset 0 on both axes: the block side gives an axis its length and the inline side gives a gradient its width. Every geometric check passes on this, because the box exists and sits where the grid put it.")
    }
    /* A RUN THAT MEASURED NOTHING IS NOT A PASS. */
    if (!layers) note("no chart layer declared an edge or a gradient, so nothing was measured")
    else note(layers + " chart layers measured for area")
  })

  /* a-gridline-is-quieter-than-its-axis — A chart axis is heavier than its gridlines, and the gridlines come off the value axis alone. */
  await run("a-gridline-is-quieter-than-its-axis", async () => {
    const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)
      if (!c || c.length < 3) return null
      const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
    const hexOf = rgb => { const m = /rgba?\(([^)]*)\)/.exec(rgb || '')
      if (!m) return null
      const p = m[1].split(',').map(s => parseFloat(s))
      if (p.length < 3 || p.some(n => !isFinite(n))) return null
      if (p.length > 3 && p[3] === 0) return null
      return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }
    const ratioOf = (a, b) => { const x = lum(a), y = lum(b)
      if (x == null || y == null) return null
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const axisOf = el => { const cs = getComputedStyle(el)
      for (const side of ['Bottom', 'Top', 'Left', 'Right']) {
        if (px(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none') {
          const c = hexOf(cs['border' + side + 'Color'])
          if (c) return c
        }
      }
      return null }
    /* ── A GRIDLINE IS PAINTED, AND A GRADIENT IS HOW. Reading child elements
       alone measured nothing on the shipped charts: fourteen plots, an axis found
       on twelve, and zero gridlines, because a repeating gradient is one box and
       not a run of lines. That reads exactly like a pass. So ask both mechanisms,
       and read the gradient's own opaque stops. */
    const stopsOf = el => { const img = getComputedStyle(el).backgroundImage
      if (!img || img === 'none' || !/gradient/.test(img)) return []
      const out = []
      for (const m of img.matchAll(/rgba?\([^)]*\)/g)) {
        const hex = hexOf(m[0])
        if (hex) out.push(hex)
      }
      return [...new Set(out)] }
    for (const plot of all('[class*=plot]')) {
      const box = plot.getBoundingClientRect()
      if (box.width < 40 || box.height < 40) continue
      let axis = axisOf(plot)
      /* THE AXIS MAY BE ON A CHILD. A bar chart draws its value axis on the grid
         layer inside its rows, because that is where zero actually is. */
      if (!axis) for (const kid of plot.querySelectorAll('*')) { axis = axisOf(kid); if (axis) break }
      if (!axis) continue
      const grid = []
      for (const el of [plot, ...plot.querySelectorAll('*')]) {
        for (const hex of stopsOf(el)) grid.push({ el, hex, how: 'gradient' })
        if (el === plot) continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        const wide = r.width >= box.width * 0.9 && r.height <= 3
        const tall = r.height >= box.height * 0.9 && r.width <= 3
        if (!wide && !tall) continue
        const paint = hexOf(getComputedStyle(el).backgroundColor)
        if (paint) grid.push({ el, hex: paint, how: 'element' })
      }
      if (!grid.length) continue
      /* A SERIES IS PAINTED TOO, and a bar is not a gridline. Only the lines that
         span the plot and the gradients reach here, so what is left is furniture. */
      const same = grid.filter(g => { const r = ratioOf(g.hex, axis); return r != null && r < 1.02 })
      if (!same.length) continue
      /* A ZERO LINE IS NOT A GRIDLINE. It carries the axis weight on purpose,
         because it is the axis moved off the floor, so a single matching line is
         correct and a gridline SET matching is the fault. */
      if (same.length === 1 && same[0].how === 'element') continue
      fail(name(plot), 'the gridlines inside this plot are painted ' + same[0].hex + ', which is its own axis colour, so the plot reads as a grid of boxes rather than as data on a ground. An axis is the chart outline and a gridline sits UNDER the data: take the gridlines one step quieter than the axis. A single line matching the axis is a zero line and is right to.')
    }
  })

  /* a-plot-is-a-shape-not-a-height — A chart plot states an aspect ratio, never a height, so it keeps its proportion at every width. */
  await run("a-plot-is-a-shape-not-a-height", async () => {
    for (const plot of all('[class*=plot]')) {
      const box = plot.getBoundingClientRect()
      if (box.width < 40 || box.height < 40) continue
      const cs = getComputedStyle(plot)
      /* A ratio IS declared. Nothing to say. */
      if (cs.aspectRatio && cs.aspectRatio !== 'auto') continue
      /* THE ROW-COUNT CASE. A horizontal bar chart is as tall as it has bars,
         and its own class says which type it is. */
      if (plot.closest('[class*=chart-bar]')) continue
      /* A STRETCHED TRACK OWNS THE HEIGHT. Read the parent DECLARATION, not
         the geometry: a stretch container has decided its children fill it. */
      const p = plot.parentElement
      const pcs = p ? getComputedStyle(p) : null
      const stretched = pcs && /flex|grid/.test(pcs.display) &&
        /stretch|normal/.test(cs.alignSelf === 'auto' ? pcs.alignItems : cs.alignSelf)
      if (stretched && px(cs.height) > 0 && !/px/.test(cs.height)) continue
      /* A STATED HEIGHT IS THE FAULT ITSELF. */
      fail(name(plot), 'this plot states a height and no aspect ratio, so it takes a different proportion at every width. Measured across one set, a single fixed height produced 3.36:1 to 10.82:1. Give it an aspect-ratio with a minimum height instead, and cap the box at its track so the floor beats the ratio where the two disagree.')
    }
  })

  /* a-grouped-chart-states-a-ratio — A grouped chart keeps at least three to one between the gap inside a group and the gap between groups. */
  await run("a-grouped-chart-states-a-ratio", async () => {
    for (const row of all('[class*=chart-grouped] [class*=cols], [class*=chart-grouped] [class*=groups]')) {
      const groups = Array.prototype.filter.call(row.children, el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && el.children.length > 1
      })
      if (groups.length < 2) continue
      const between = px(getComputedStyle(row).columnGap)
      const inner = px(getComputedStyle(groups[0]).columnGap)
      if (!(inner > 0) || !(between > 0)) continue
      if (between / inner >= 3) continue
      fail(name(row), 'this grouped chart puts ' + inner + 'px inside a group and ' + between + 'px between them, a ratio of ' + (between / inner).toFixed(1) + ':1. Under three to one the groups dissolve into one run of bars and the category axis stops meaning anything. Take the between-groups gap up the scale until it clears three to one, and leave the inner gap where it is.')
    }
  })

  /* a-chart-is-named-not-focused — A chart takes no focus and answers no keys. It owes a name and a text alternative instead. */
  await run("a-chart-is-named-not-focused", async () => {
    /* THE FOCUS PASS, over every part of the picture. A tabindex on the
       PLOT is the commonest form of this and the outermost-only guard
       below cannot see it. */
    for (const part of all('[class*=chart]')) {
      const tab = part.getAttribute('tabindex')
      if (tab === null || Number(tab) < 0) continue
      /* A CONTROL INSIDE A CHART IS ALLOWED A TAB STOP. A legend that
         filters is a group of buttons, and it answers keys. */
      if (part.matches(CONTROL) || part.getAttribute('role') === 'button') continue
      fail(name(part), 'this is part of a chart, it is in the tab order, and it answers no key when a reader reaches it. That is worse than not being reachable. A chart is a picture of data: no focus, no keys. Take the tabindex off and give the chart a name instead. Where the chart has controls, put the tab stops on those.')
    }
    for (const chart of all('[class*=chart]')) {
      const box = chart.getBoundingClientRect()
      if (box.width < 40 || box.height < 24) continue
      /* ONE ELEMENT PER CHART. A frame inside a chart inside a card would
         otherwise report the same picture three times. */
      if (chart.parentElement && chart.parentElement.closest('[class*=chart]')) continue
      if (chart.getAttribute('aria-hidden') === 'true') continue
      /* ── A CHART ANNOUNCING A STATE IS NOT A PICTURE OF DATA ──
         Two of them, and both are correct code that this faulted first.
         A LOADING placeholder carries role=status and aria-busy, and its
         shapes are already aria-hidden: naming it as a picture would
         describe data that is not there yet. An EMPTY or NO-RESULTS chart
         holds a message and an action, and role=img would make both
         presentational and silence the only thing worth reading. Ask the
         PROPERTY: a live region says so, and an offered action is a
         control. */
      if (/^(status|alert|progressbar)$/.test(chart.getAttribute('role') || '')) continue
      if (chart.getAttribute('aria-busy') === 'true') continue
      if (chart.querySelector(CONTROL)) continue
      /* A SPARKLINE IN A ROW IS DELIBERATELY SILENT, because the row already
         says its name and its value in words. */
      /* ── A LEGEND IS TEXT, AND ITS WORDS ARE THE ALTERNATIVE ──
         role=img would make every one of those words presentational, which is
         the same fault as putting it on an empty state. Measured on one
         dashboard: the key paints 1% of its own box (five 8px dots and their
         labels) and the strip beside it paints 100%. Nothing sits near 10. */
      const ownBox = chart.getBoundingClientRect()
      let painted = 0
      for (const kid of chart.querySelectorAll('*')) {
        const bg = getComputedStyle(kid).backgroundColor
        if (!opaque(bg)) continue
        const b = kid.getBoundingClientRect()
        painted += b.width * b.height
      }
      const area = ownBox.width * ownBox.height
      if (area > 0 && painted / area < 0.1 && hasWords(chart)) continue
      const row = chart.closest('tr, [role=row]')
      if (row && hasWords(row)) continue
      const named = chart.getAttribute('aria-label') || chart.getAttribute('aria-labelledby')
        || (chart.getAttribute('role') === 'img' && hasWords(chart))
      const figure = chart.closest('figure')
      if (named || (figure && figure.querySelector('figcaption'))) continue
      /* A TABLE BESIDE THE CHART IS THE TEXT ALTERNATIVE, and it is the best
         one. A picture whose figures are also in a table needs nothing. */
      const near = chart.parentElement
      if (near && near.querySelector('table')) continue
      fail(name(chart), 'this chart carries no name, so a screen reader has a picture it cannot describe. Give it role=img with an aria-label carrying the figures, or put a table beside it, or wrap it in a figure with a figcaption. A sparkline inside a table row is the one exception and takes aria-hidden, because the row already says its name and value in text.')
    }
  })

  /* meaning-never-rests-on-colour-alone — A marker that names a meaning carries a word or a shape as well as a hue. */
  await run("meaning-never-rests-on-colour-alone", async () => {
    /* A class that names a MEANING. The element is claiming to say something,
       and a reader who cannot separate two hues has to be able to read it. */
    const SEMANTIC = /(^|[^a-z])(success|warning|danger|error|positive|negative|caution|critical)([^a-z]|$)/
    for (const el of all('*')) {
      const cls = el.getAttribute('class') || ''
      if (!SEMANTIC.test(cls)) continue
      const cs = getComputedStyle(el)
      /* ── ONLY A MARKER, which is something that paints its own fill or edge.
         A wrapper carrying the word in its class name paints nothing and says
         nothing, so it is not what a reader is looking at. */
      const marks = cs.backgroundColor !== 'rgba(0, 0, 0, 0)'
        || cs.backgroundImage !== 'none' || px(cs.borderTopWidth) > 0
      if (!marks) continue
      /* ── THREE WAYS TO SURVIVE THE LOSS OF A HUE ──
         Its own words. A glyph, which is a shape rather than a colour. Or words
         BESIDE it: a legend dot is labelled by the row it sits in, and that is
         what makes the picture certain. */
      if ((el.textContent || '').trim()) continue
      if (el.querySelector('svg')) continue
      const near = el.parentElement ? (el.parentElement.textContent || '').trim() : ''
      if (near) continue
      fail(name(el),
        'this marker says ' + cls + ' and carries no words, no glyph and no label beside it, so its meaning rests on its hue alone. No categorical palette survives the loss of red-green vision, so a green success and a red danger land in the same place on the axis that is left. Give it a shape or a word: the colour makes the picture readable and the label makes it certain.')
    }
  })

  /* a-marked-item-says-so — The chosen item in a nav or a strip declares aria-current or aria-selected, not only a colour. */
  await run("a-marked-item-says-so", async () => {
    const RUNS = 'nav, [role="tablist"], [role="menu"], [role="menubar"], [role="tree"]'
    const PAINT = ['fontWeight', 'color', 'backgroundColor', 'boxShadow', 'borderBottomColor', 'borderBottomWidth']
    const SAYS = '[aria-current], [aria-selected], [aria-checked], [aria-pressed]'
    for (const run of all(RUNS)) {
      const kids = Array.prototype.filter.call(run.children, function (el) {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      if (kids.length < 3) continue
      const styles = kids.map(function (el) { return getComputedStyle(el) })
      /* The signature of each item across every property that paints. */
      const sigs = styles.map(function (cs) { return PAINT.map(function (p) { return cs[p] }).join('|') })
      const tally = {}
      for (const s of sigs) tally[s] = (tally[s] || 0) + 1
      const odd = sigs.map(function (s, i) { return tally[s] === 1 ? i : -1 }).filter(function (i) { return i >= 0 })
      if (odd.length !== 1) continue
      const el = kids[odd[0]]
      /* A DIFFERENT KIND OF ITEM IS NOT A MARKED ONE, and the tag says which.
         Measured on a real landing nav: a title span, two link items and a
         filled call-to-action button. The button is the only thing painted
         differently and it is not the current destination, so this reported a
         correct nav. A marked item is one of a run of like things, so its tag
         appears more than once. A tag appearing exactly once is a CTA, a
         title, or a search box that happens to sit in the same bar. */
      const sameKind = kids.filter(function (k) { return k.tagName === el.tagName }).length
      if (sameKind < 2) continue
      if (el.matches(SAYS) || el.closest(SAYS) === el) continue
      /* A control INSIDE the item may carry the state instead. */
      if (el.querySelector(SAYS)) continue
      fail(name(el), 'this is the only item in its run that is painted differently, so it reads as the chosen one, and it declares nothing. A screen reader is never told. Worse, a mark drawn with a shadow or a background disappears under forced colors, and the rule that restores it has to key on a state. Add aria-current="page" where the run is navigation, or aria-selected where it is a tablist.')
    }
  })

  /* one-baseline-per-row — Every row of text sits on one baseline. */
  await run("one-baseline-per-row", async () => {
    const centredMark = el => {
      let n = el
      for (let i = 0; i < 4 && n && n.parentElement; i++, n = n.parentElement) {
        const r = n.getBoundingClientRect()
        if (!r.width || !r.height) continue
        const ratio = r.width / r.height
        if (ratio < 0.7 || ratio > 1.45) continue
        const cs = getComputedStyle(n), parent = getComputedStyle(n.parentElement)
        const centred = cs.alignSelf === 'center' ||
          (parent.display.indexOf('flex') >= 0 && parent.alignItems === 'center' && cs.alignSelf === 'auto')
        if (!centred) continue
        const bg = cs.backgroundColor
        const open = bg ? bg.indexOf('(') : -1
        const parts = open < 0 ? [] : bg.slice(open + 1, bg.lastIndexOf(')')).split(',')
        const filled = !!bg && bg !== 'transparent' && (parts.length < 4 || parseFloat(parts[3]) > 0)
        if (filled || parseFloat(cs.borderTopWidth) > 0) return true
      }
      return false
    }
    for (const row of rows()) {
      const runs = row.items.filter(i => i.text && i.lines === 1 && !(i.el && centredMark(i.el)))
      if (runs.length < 2) continue
      const bl = runs.map(i => i.baseline)
      const spread = Math.max.apply(null, bl) - Math.min.apply(null, bl)
      if (spread > 0.5)
        fail(row.name, round(spread) + 'px between ' + runs.length + ' baselines on one line: ' + runs.map(i => i.label + '@' + round(i.baseline)).join(', '))
    }
  })

  /* one-height-per-control-row — Every control on one line states the same height. */
  await run("one-height-per-control-row", async () => {
    for (const row of rows()) {
      const ctl = row.items.filter(i => i.control)
      if (ctl.length < 2) continue
      const hs = ctl.map(i => Math.round(i.rect.height))
      if (new Set(hs).size > 1)
        fail(row.name, 'heights ' + hs.join(', ') + ' in one row. A row that centres two heights MUST show two tops, and that reads as a misalignment it is not.')
    }
  })

  /* icon-on-the-cap-band — Every mark beside a label sits between that label’s cap line and its baseline. */
  await run("icon-on-the-cap-band", async () => {
    const HOLDERS = 'button, a, label, .btn, .nav-item, .brand, [class*=brand], [class*=lockup]'
    /* A LABEL CLIPPED TO A PIXEL IS NOT A LABEL. A visually hidden name
       has a box, and comparing a 16px mark against it produced 13.5px
       above the cap against -9.5 below on a correct icon-only control. */
    const readable = el => { const b = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.opacity !== '0' }
    for (const el of all(HOLDERS)) {
      /* ASK THE PROPERTY, NOT THE CLASS NAME. A list of names finds the
         cases somebody already thought of: a square built as .sq rather
         than .brand-mark was never measured. A mark is a DRAWING, or a
         sibling that paints its own box and is roughly square. */
      const paintsABox = n => { const cs = getComputedStyle(n), b = n.getBoundingClientRect()
        if (!b.width || !b.height) return false
        const ratio = b.width / b.height
        if (ratio < 0.7 || ratio > 1.45) return false
        const bg = cs.backgroundColor
        const open = bg ? bg.indexOf('(') : -1
        const parts = open < 0 ? [] : bg.slice(open + 1, bg.lastIndexOf(')')).split(',')
        const filled = !!bg && bg !== 'transparent' && (parts.length < 4 || parseFloat(parts[3]) > 0)
        const edged = parseFloat(cs.borderTopWidth) > 0
        return filled || edged || cs.backgroundImage !== 'none' }
      let mark = el.querySelector('svg, img')
      if (!mark) {
        for (const kid of el.children) if (paintsABox(kid)) { mark = kid; break }
      }
      if (!mark) continue
      const r = boxOf(mark); if (!r) continue
      /* FIND THE MARK FIRST, THEN ITS OWN LABEL. Looking for the first
         text-bearing descendant found the MARK, because a brand square
         carries initials, and the check then compared the mark with
         itself and skipped. The label is a SIBLING of the mark: without
         that, a container holding another control reports a mark against
         a heading rows away from it. */
      let band = readable(el) ? capBand(el) : null
      if (!band) {
        for (const sib of Array.prototype.slice.call(mark.parentElement.children)) {
          if (sib === mark || sib.contains(mark)) continue
          if (!readable(sib)) continue
          const b = capBand(sib)
          if (b) { band = b; break }
        }
      }
      if (!band) continue
      const above = band.cap - r.top, below = r.bottom - band.baseline
      if (Math.abs(above - below) > 1)
        fail(name(el), 'mark ' + round(above) + 'px above the cap line against ' + round(below) + 'px below the baseline. Equal overhang is what centred means. A mark TALLER than the cap band centres its own BOX on that band; putting its own letters on the row baseline positions it by the wrong thing.')
    }
  })

  /* selection-stands-on-its-own-ground — A selected row sits on a card, where its fill is a step clear of the ground. */
  await run("selection-stands-on-its-own-ground", async () => {
    const sel = paints('--c-selected')
    if (sel) for (const el of all('*')) {
      if (getComputedStyle(el).backgroundColor !== sel) continue
      const p = el.parentElement; if (!p) continue
      const marked = el.matches('[aria-selected=true], [aria-current], .selected, .is-selected')
      if (!marked) {
        const sibs = Array.prototype.slice.call(p.children).filter(s => s !== el && s.tagName === el.tagName)
        if (!sibs.length) continue
        if (!sibs.some(s => getComputedStyle(s).backgroundColor !== sel)) continue
      }
      const g = ground(el); if (!g || g.bg !== sel) continue
      fail(name(el), 'a selected row painted ' + sel + ' stands on a ground of the same colour, so nobody can see it is chosen. This role is a step off the CARD, not off the page. Put the list on a surface, or mark the selection some other way.')
    }
  })

  /* lone-mark-centres-on-its-box — A control with a mark and no words centres that mark on its own box, both axes. */
  await run("lone-mark-centres-on-its-box", async () => {
    for (const el of all('button, a[href], label, [role=button]')) {
      if (hasWords(el)) continue   /* it has a label; the cap band rule owns it */
      const mark = el.querySelector('svg, img'); if (!mark) continue
      const b = el.getBoundingClientRect(), m = mark.getBoundingClientRect()
      if (!b.width || !m.width) continue
      const dy = ((m.top + m.bottom) / 2) - ((b.top + b.bottom) / 2)
      const dx = ((m.left + m.right) / 2) - ((b.left + b.right) / 2)
      if (Math.abs(dy) > 0.75 || Math.abs(dx) > 0.75)
        fail(name(el), 'a mark with no label sits ' + round(dx) + ', ' + round(dy) + ' off its own box centre. With no label there is no cap band to sit in, so it centres on the box.')
    }
  })

  /* outer-cell-on-the-heading-margin — A table’s first column starts on the same margin as the headings above it. */
  await run("outer-cell-on-the-heading-margin", async () => {
    for (const table of all('table')) {
      let host = table.parentElement, head = null
      for (let i = 0; i < 4 && host && !head; i++) {
        head = Array.prototype.find.call(host.querySelectorAll('h1,h2,h3,h4,h5,h6'), h => !table.contains(h))
        if (!head) host = host.parentElement
      }
      if (!head) continue
      const first = table.querySelector('tr > *:first-child')
      if (!first) continue
      const box = padded(first), headBox = padded(head)
      if (!box || !headBox || box.el !== headBox.el) continue
      if (table.querySelector('tbody td:first-child input[type="checkbox"], tbody td:first-child [role="checkbox"]')) continue
      /* WHAT PAINTS, not the first element that matches. A visually hidden
         input fills the whole hit area, so picking it read the cell's own
         edge and the check stayed silent while the visible box sat 14px in. */
      const paints = Array.prototype.filter.call(
        first.querySelectorAll('svg, img, [class*=box], [class*=avatar], [class*=dot]'),
        n => { const cs = getComputedStyle(n), b = n.getBoundingClientRect()
               return cs.opacity !== '0' && cs.visibility !== 'hidden' && b.width > 2 && b.height > 2 })
      const edge = paints.length ? paints[0].getBoundingClientRect().left : inner(first).left
      const d = edge - head.getBoundingClientRect().left
      if (Math.abs(d) > 0.5)
        fail(name(table), 'the first column starts ' + round(d) + 'px off the margin set by ' + name(head) + ' above it. Zero the outer cell padding rather than letting it add to the container own. If a hit area wider than its mark is centring that mark, give the outer column start alignment so the area grows inward instead.')
    }
  })

  /* target-floor-for-the-pointer — Every control clears the published minimum for the pointer in use, as a whole row. */
  await run("target-floor-for-the-pointer", async () => {
    const coarse = matchMedia('(pointer: coarse)').matches
    const floor = coarse
      ? px(tokenValue('--target-min') || '44px')
      : px(tokenValue('--target-min-pointer') || '24px')
    for (const el of all('button, a[href], input, select, [role=button]')) {
      if (clippedAway(el)) continue   /* its label is the hit area */
      const r = el.getBoundingClientRect(); if (!r.width) continue
      if (r.height < floor - 0.5 || r.width < floor - 0.5)
        fail(name(el), round(r.width) + 'x' + round(r.height) + ' under the ' + floor + 'px floor for a ' + (coarse ? 'coarse' : 'fine') + ' pointer. Promote the whole row, never one control in it.')
    }
  })

  /* the-toggle-actually-toggles — Pressing the theme control changes the painted page. Press it and read the result. */
  await run("the-toggle-actually-toggles", async () => {
    const btn = document.querySelector('[aria-pressed][aria-label*=heme], #dmd-dark, [data-theme-toggle], #theme-toggle')
    if (!btn) { fail('document', 'no theme control found. The system asks for a visible one.'); return }
    const before = getComputedStyle(document.body).backgroundColor
    btn.click(); await settle(1200)
    const after = getComputedStyle(document.body).backgroundColor
    btn.click(); await settle(1200)
    if (before === after)
      fail(name(btn), 'a press changed nothing. The page painted ' + before + ' before and after.')
    const statesItself = btn.getAttribute('aria-pressed') != null ||
      (btn.tagName === 'INPUT' && btn.type === 'checkbox') || btn.getAttribute('aria-checked') != null
    if (!statesItself)
      fail(name(btn), 'the control never says which theme is on. Give a button aria-pressed, or use a checkbox, which states it natively.')
  })

  /* nothing-clipped-out-of-reach — Nothing is clipped with no way to reach it. */
  await run("nothing-clipped-out-of-reach", async () => {
    for (const el of all('*')) {
      const cs = getComputedStyle(el)
      const clips = /hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(cs.overflowY)
      if (!clips) continue
      if (/auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflowY)) continue
      if (cs.textOverflow === 'ellipsis') continue
      const shutBox = el.getBoundingClientRect()
      if (shutBox.height <= 1 || shutBox.width <= 1) continue
      let shutAbove = false
      for (let a = el.parentElement, up = 0; a && up < 4; a = a.parentElement, up++) {
        const r = a.getBoundingClientRect()
        if (r.height <= 1 || r.width <= 1) { shutAbove = true; break }
      }
      if (shutAbove) continue
      const box = el.getBoundingClientRect()
      for (const kid of el.children) {
        const ks = getComputedStyle(kid)
        if (ks.position === 'absolute' || ks.position === 'fixed') continue
        const k = kid.getBoundingClientRect()
        const over = Math.max(k.right - box.right, box.left - k.left, k.bottom - box.bottom)
        if (over > 1) fail(name(kid), round(over) + 'px cut off by ' + name(el) + ', which does not scroll. No error, no scrollbar, and the content is simply gone.')
      }
    }
  })

  /* the-page-never-scrolls-sideways — The page never scrolls sideways, down to the narrowest width you ship. */
  await run("the-page-never-scrolls-sideways", async () => {
    const d = document.documentElement
    const vw = d.clientWidth
    const page = document.body ? document.body.scrollWidth : d.scrollWidth
    if (page > vw + 1)
      fail('document', 'the page scrolls sideways: ' + page + ' of content in a ' + vw + 'px viewport, over by ' + (page - vw) + '. A table may scroll inside its own box. The page may not. A scroller cannot clamp until every ancestor between it and the page carries min-width: 0.')
  })

  /* a-selected-row-is-a-step-off-its-ground — A selected row differs from the ground it sits on by a step the eye can find. */
  await run("a-selected-row-is-a-step-off-its-ground", async () => {
    const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)
      if (!c || c.length < 3) return null
      const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
    const hexOf = rgb => { const m = /rgba?\(([^)]*)\)/.exec(rgb || '')
      if (!m) return null
      const p = m[1].split(',').map(s => parseFloat(s))
      if (p.length < 3 || p.some(n => !isFinite(n))) return null
      if (p.length > 3 && p[3] === 0) return null
      return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }
    for (const el of all('[aria-current], [aria-selected="true"]')) {
      const cs = getComputedStyle(el)
      const own = hexOf(cs.backgroundColor)
      if (!own) continue
      let node = el.parentElement, ground = null
      for (; node; node = node.parentElement) {
        const g = hexOf(getComputedStyle(node).backgroundColor)
        if (g) { ground = g; break }
      }
      if (!ground) continue
      const a = lum(own), b = lum(ground)
      if (a == null || b == null) continue
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      const barred = /inset/.test(cs.boxShadow || '')
        || (() => { const b = getComputedStyle(el, '::before')
             return !!b && b.content !== 'none' && (b.position === 'absolute' || b.position === 'fixed')
               && !!b.backgroundColor && b.backgroundColor !== 'rgba(0, 0, 0, 0)'
               && (parseFloat(b.left) === 0 || parseFloat(b.right) === 0) })()
      if (barred) continue
      if (ratio < 1.06)
        fail(name(el), 'this row is marked and its fill reads ' + ratio.toFixed(2) + ':1 against the ground behind it, so nothing shows. A selection has to be found rather than noticed once you are already looking. Step the fill off the surface, and give the mark a second channel: an edge, or a full-strength label.')
    }
  })

  /* a-stripe-is-rhythm-and-a-selection-is-a-choice — A row stripe is the softest step available, and a selected row stands further off the surface than the stripe does. */
  await run("a-stripe-is-rhythm-and-a-selection-is-a-choice", async () => {
    const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)
      if (!c || c.length < 3) return null
      const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
    const hexOf = rgb => { const m = /rgba?\(([^)]*)\)/.exec(rgb || '')
      if (!m) return null
      const p = m[1].split(',').map(s => parseFloat(s))
      if (p.length < 3 || p.some(n => !isFinite(n))) return null
      if (p.length > 3 && p[3] === 0) return null
      return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }
    const ratioOf = (a, b) => { const x = lum(a), y = lum(b)
      if (x == null || y == null) return null
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const fillOf = (el, ground) => {
      const own = hexOf(getComputedStyle(el).backgroundColor)
      if (own) return own
      const cells = Array.prototype.filter.call(el.children, shown)
      if (!cells.length) return ground
      const each = cells.map(c => hexOf(getComputedStyle(c).backgroundColor))
      if (each.some(v => !v)) return ground
      return each.every(v => v === each[0]) ? each[0] : ground
    }
    const CHOSEN = el => el.matches('[aria-selected=true], [aria-current]')
      || !!el.querySelector('[aria-checked=true], input:checked')
    for (const run of all('*')) {
      const kids = Array.prototype.filter.call(run.children, shown)
      if (kids.length < 4) continue
      if (!kids.every(k => k.tagName === kids[0].tagName)) continue
      let ground = null
      for (let n = run; n && !ground; n = n.parentElement) ground = hexOf(getComputedStyle(n).backgroundColor)
      if (!ground) continue
      const fills = kids.map(k => fillOf(k, ground))
      const plain = kids.map((k, i) => CHOSEN(k) ? -1 : i).filter(i => i >= 0)
      if (!plain.some(i => fills[i] === ground)) continue
      const others = [...new Set(plain.map(i => fills[i]).filter(f => f !== ground))]
      if (others.length !== 1) continue
      const stripe = others[0]
      const at = plain.filter(i => fills[i] === stripe)
      if (at.length * 3 < kids.length) continue
      if (!at.every(i => i % 2 === at[0] % 2)) continue
      const step = ratioOf(stripe, ground)
      if (step == null) continue
      if (step >= 1.6)
        fail(name(run), 'every other row in this run is filled ' + step.toFixed(2) + ':1 off the ground behind it, which divides the table into blocks rather than grouping its rows. A stripe is rhythm: take it to the softest step the palette publishes, and put a selected row one step further out rather than raising the stripe to reach it.')
      for (let i = 0; i < kids.length; i++) {
        if (!CHOSEN(kids[i])) continue
        const own = fills[i]
        if (own === ground || own === stripe) continue
        const mine = ratioOf(own, ground), gap = ratioOf(own, stripe)
        if (mine == null || gap == null) continue
        if (mine <= step)
          fail(name(kids[i]), 'this row is chosen and reads ' + mine.toFixed(2) + ':1 against the ground, while the plain stripe beside it reads ' + step.toFixed(2) + '. The rhythm is louder than the choice, so every other row competes with the one the reader picked. Step the selection further off the surface than the stripe, and leave the stripe where it is.')
        else if (gap >= 1.5)
          fail(name(kids[i]), 'this row is chosen and sits ' + gap.toFixed(2) + ':1 off the stripe beside it, which is two steps rather than one. Selected rows then read as darkened rather than as chosen, and a table with several picked reads heavy. Close it to one step and let the accent edge and the row checkbox carry the rest of the marking.')
      }
    }
  })

  /* a-selection-edge-costs-only-its-own-width — A selection edge moves the label by its own width, and by nothing else. */
  await run("a-selection-edge-costs-only-its-own-width", async () => {
    const barPx = s => { if (!s || s === 'none' || !/inset/.test(s)) return 0
      const m = s.replace(/rgba?\([^)]*\)/g, '').match(/(-?[\d.]+)px/)
      return m ? Math.abs(parseFloat(m[1])) : 0 }
    /* ── TWO MECHANISMS DRAW THIS BAR, AND ASKING ABOUT ONE IS BLINDNESS ──
       An inset shadow is right where nothing crosses the row. Inside a RULED
       set it is wrong: the border paints on top of it, so the bar stops one
       hairline short at every boundary. There the bar is a pseudo-element
       stretched past each end. A check that asks only about box-shadow goes
       silent the moment a build does the correct thing. */
    const pseudoBar = el => {
      const b = getComputedStyle(el, '::before')
      if (!b || b.content === 'none') return 0
      if (b.position !== 'absolute' && b.position !== 'fixed') return 0
      if (!b.backgroundColor || b.backgroundColor === 'rgba(0, 0, 0, 0)') return 0
      const w = parseFloat(b.width) || 0
      /* On the START edge, and narrow enough to be a bar rather than a wash. */
      const atStart = parseFloat(b.left) === 0 || parseFloat(b.right) === 0
      const host = el.getBoundingClientRect().width
      return (atStart && w > 0 && w <= host / 4) ? w : 0
    }
    const edgeOf = el => { const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return { left: r.left, inset: r.left + (parseFloat(cs.paddingLeft) || 0), bar: Math.max(barPx(cs.boxShadow), pseudoBar(el)) } }
    const jog = (el, mark, plain, w) => {
      if (Math.abs(mark.left - plain.left) > 1) return
      const cost = mark.inset - plain.inset
      if (Math.abs(cost) > 1)
        fail(name(el), 'this row carries a ' + w + 'px selection edge and its content starts ' + cost.toFixed(1) + 'px further in than the row beside it, so the column staggers. Reserve the bar gutter in the BASE padding, which every row of the column takes, rather than adding the bar to the selected row alone.')
      const clear = mark.inset - (mark.left + w)
      if (clear < 4)
        fail(name(el), 'a ' + w + 'px selection edge sits ' + clear.toFixed(1) + 'px from the first thing in the row, so the two read as one shape. That is worst where the content is an ornament in the accent colour, such as a checked box. Give the gutter the bar plus a step off the spacing scale.')
    }
    for (const tb of all('table')) {
      let mark = null, plain = null, w = 0, cell = null
      for (const r of tb.querySelectorAll('tr')) {
        const td = r.querySelector('td')
        if (!td) continue
        const m = edgeOf(td)
        const bar = Math.max(m.bar, barPx(getComputedStyle(r).boxShadow), pseudoBar(r))
        if (bar > 1) { if (!mark) { mark = m; w = bar; cell = td } }
        else if (!plain) plain = m
      }
      if (mark && plain) jog(cell, mark, plain, w)
    }
    for (const el of all('[aria-current], [aria-selected="true"]')) {
      const mark = edgeOf(el)
      if (mark.bar < 2) continue
      const p = el.parentElement
      if (!p) continue
      for (const sib of p.children) {
        if (sib === el || sib.tagName !== el.tagName) continue
        const plain = edgeOf(sib)
        if (plain.bar > 0) continue
        jog(el, mark, plain, mark.bar)
        break
      }
    }
  })

  /* no-tint-out-saturates-its-ground — A tinted panel keeps its ground's chroma neighbourhood. No fill carries far more colour than what it sits on. */
  await run("no-tint-out-saturates-its-ground", async () => {
    const OK = 0.04
    const cv = document.createElement('canvas'); cv.width = cv.height = 1
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    const oklch = css => { if (!css) return null
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      if (d[3] === 0) return null
      const f = v => { v = v / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      const R = f(d[0]), G = f(d[1]), B = f(d[2])
      const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
      const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
      const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
      const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
      const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
      return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, C: Math.sqrt(A * A + Bb * Bb) } }
    for (const el of all('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 20 || r.height < 20) continue
      if (r.width * r.height < 500) continue
      const cs = getComputedStyle(el)
      const own = oklch(cs.backgroundColor)
      if (!own) continue
      let node = el.parentElement, ground = null
      for (; node; node = node.parentElement) {
        const g = oklch(getComputedStyle(node).backgroundColor)
        if (g) { ground = g; break }
      }
      if (!ground) continue
      if (Math.abs(own.L - ground.L) > 0.15) continue
      const chars = (el.textContent || '').trim().length
      /* A TINT SITS BEHIND SOMETHING. A fill with no text on it at all is a
         MARK, and a mark's colour is its meaning: a chart series, a legend
         dot, a status stripe. Measured on a categorical scale built for
         separation, one segment reads 0.079 against a 0.009 page, and that
         is the palette doing its job rather than a stain. textContent counts
         descendants, so a tinted panel with any words in it is still asked. */
      if (!chars) continue
      if (Math.abs(r.width - r.height) <= 2 && chars <= 3) continue
      const allow = Math.max(OK, ground.C * 1.5)
      if (own.C > allow)
        fail(name(el), 'this fill carries OKLCH chroma ' + own.C.toFixed(3) + ' on a ground at ' + ground.C.toFixed(3) + ', so it reads as a stain rather than a tint. No contrast check sees this, because a ratio measures lightness and both colours can be legal. Mix the meaning colour INTO the ground instead of taking a step off its own ramp.')
    }
  })

  /* a-filled-shape-separates-from-its-ground — A filled shape with no text of its own reads at least 1.2:1 against what is behind it. */
  await run("a-filled-shape-separates-from-its-ground", async () => {
    const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)
      if (!c || c.length < 3) return null
      const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
    const hexOf = rgb => { const m = /rgba?\(([^)]*)\)/.exec(rgb || '')
      if (!m) return null
      const p = m[1].split(',').map(s => parseFloat(s))
      if (p.length < 3 || p.some(n => !isFinite(n))) return null
      if (p.length > 3 && p[3] === 0) return null
      return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }
    for (const el of all('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.width > 64 || r.height > 64) continue
      if (Math.abs(r.width - r.height) > 2) continue
      const cs = getComputedStyle(el)
      const own = hexOf(cs.backgroundColor)
      if (!own) continue
      const edge = hexOf(cs.borderColor)
      if (edge && parseFloat(cs.borderTopWidth) > 0 && edge !== own) continue
      if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') continue
      const txt = (el.textContent || '').trim()
      if (txt.length > 3) continue
      if (el.querySelector('svg, img, input, button, a')) continue
      let node = el.parentElement, ground = null
      for (; node; node = node.parentElement) {
        const g = hexOf(getComputedStyle(node).backgroundColor)
        if (g) { ground = g; break }
      }
      if (!ground || ground === own) continue
      const a = lum(own), b = lum(ground)
      if (a == null || b == null) continue
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      if (ratio < 1.2)
        fail(name(el), 'this shape is drawn by its fill and reads ' + ratio.toFixed(2) + ':1 against the ground behind it, so it is absent rather than subtle. A ground may be quiet because the text on it carries the contrast. A shape has no words to carry it. Give it a role that steps off the surface in BOTH modes, or draw it with a visible edge instead.')
    }
  })

  /* one-token-is-not-one-weight — An icon that declares a stroke also declares vector-effect: non-scaling-stroke. */
  await run("one-token-is-not-one-weight", async () => {
    for (const s of all('svg')) {
      const r = s.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const cs = getComputedStyle(s)
      const kid = s.querySelector('path, circle, rect, line, polyline, polygon, ellipse')
      const kcs = kid ? getComputedStyle(kid) : null
      const stroked = el => el && el.stroke && el.stroke !== 'none' && parseFloat(el.strokeWidth) > 0
      const src = stroked(kcs) ? kcs : (stroked(cs) ? cs : null)
      if (!src) continue
      if (src.vectorEffect === 'non-scaling-stroke') continue
      const vb = (s.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
      if (vb.length !== 4 || !vb[2]) continue
      const scale = r.width / vb[2]
      const sw = parseFloat(src.strokeWidth)
      if (Math.abs(scale - 1) < 0.02) continue
      fail(name(s), 'this icon declares stroke-width ' + sw + ' and paints it at ' + (sw * scale).toFixed(2) + 'px, because an SVG scales its stroke with its viewBox. One token is then a different weight at every size. Add vector-effect: non-scaling-stroke, which makes the number the painted width.')
    }
  })

  /* an-overlay-says-it-is-one — An overlay declares role="dialog" and aria-modal, and takes its name from its own heading. */
  await run("an-overlay-says-it-is-one", async () => {
    const NAMED = '[class*="modal"], [class*="dialog"], [class*="drawer"], [class*="overlay"], [class*="sheet"]'
    for (const el of all(NAMED + ', [role="dialog"], [role="alertdialog"], dialog')) {
      const cs = getComputedStyle(el)
      const claims = el.tagName === 'DIALOG' || el.matches('[role="dialog"], [role="alertdialog"]')
      const outOfFlow = cs.position === 'fixed' || cs.position === 'absolute'
      if (!claims && !outOfFlow) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      if (!(el.textContent || '').trim() && !el.querySelector('input, button, a, img, svg')) continue
      const dlg = claims ? el : el.querySelector('[role="dialog"], [role="alertdialog"], dialog')
      if (!dlg) {
        fail(name(el), 'this paints over the page and never declares itself a dialog: no role="dialog" and no <dialog>. Nothing tells a reader the page behind it is out of play. Put the role on the panel, not on the scrim.')
        continue
      }
      if (dlg.tagName !== 'DIALOG' && dlg.getAttribute('aria-modal') !== 'true')
        fail(name(dlg), 'a dialog that holds the page needs aria-modal="true". Without it a screen reader keeps offering everything behind it.')
      const named = dlg.getAttribute('aria-labelledby') || dlg.getAttribute('aria-label')
      if (!named)
        fail(name(dlg), 'this dialog has no name. Point aria-labelledby at its OWN heading rather than repeating the words in an aria-label, which is how the two drift apart.')
    }
  })

  /* a-split-collapses-before-its-table-scrolls — A scroller never clips while its row still holds two columns and the whole row would fit it. */
  await run("a-split-collapses-before-its-table-scrolls", async () => {
    for (const sc of all('*')) {
      const cs = getComputedStyle(sc)
      if (!/auto|scroll/.test(cs.overflowX)) continue
      const need = sc.scrollWidth
      if (need <= sc.clientWidth + 1) continue
      let row = sc.parentElement, kid = sc
      let found = null
      for (let up = 0; row && up < 8; up++) {
        const rs = getComputedStyle(row)
        if (/flex|grid/.test(rs.display)) {
          const mine = kid.getBoundingClientRect()
          for (const other of row.children) {
            if (other === kid) continue
            const os = getComputedStyle(other)
            if (os.display === 'none' || os.position === 'absolute' || os.position === 'fixed') continue
            const o = other.getBoundingClientRect()
            if (!o.width || !o.height) continue
            const sameBand = o.bottom > mine.top + 1 && o.top < mine.bottom - 1
            const beside = o.left >= mine.right - 1 || o.right <= mine.left + 1
            if (sameBand && beside) { found = { row, other, o } ; break }
          }
          if (found) break
        }
        kid = row
        row = row.parentElement
      }
      if (!found) continue
      const rs2 = getComputedStyle(found.row)
      const rb = found.row.getBoundingClientRect()
      const inner = rb.width - (parseFloat(rs2.paddingLeft) || 0) - (parseFloat(rs2.paddingRight) || 0)
      if (need > inner) continue
      fail(name(sc), 'this clips ' + (need - sc.clientWidth) + 'px on a row that still holds two columns, and its ' + need + 'px of content would fit the row own ' + round(inner) + 'px. ' + name(found.other) + ' sits beside it at ' + round(found.o.width) + 'px. Collapse the split at this width, or size the table side from the table min-content instead of a share.')
    }
  })

  /* a-separator-goes-above-each-item — A separator is drawn above each item, never below. Drawn below, the last one lands on its container own edge. */
  await run("a-separator-goes-above-each-item", async () => {
    for (const run of all('*')) {
      const kids = Array.prototype.filter.call(run.children, el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      if (kids.length < 3) continue
      if (!kids.every(k => k.tagName === kids[0].tagName)) continue
      const rcs = getComputedStyle(run)
      const own = px(rcs.borderBottomWidth)
      if (!(own > 0) || rcs.borderBottomStyle === 'none') continue
      const last = kids[kids.length - 1]
      const lcs = getComputedStyle(last)
      if (!(px(lcs.borderBottomWidth) > 0) || lcs.borderBottomStyle === 'none') continue
      /* THE CORRECT FORM NEVER REACHES HERE. A run separated above carries
         its rule on the TOP edge, so the last item has no bottom border. */
      const rr = run.getBoundingClientRect(), lr = last.getBoundingClientRect()
      const apart = Math.abs((rr.bottom - own) - lr.bottom)
      if (apart > 2) continue
      fail(name(run), 'every item in this run draws its separator BELOW itself, so the last one lands ' + apart.toFixed(2) + 'px from the container own bottom edge: two lines a pixel apart, closing nothing. Draw the rule ABOVE each item instead. The first item then supplies the rule under any group header, the last ends clean, and it needs no :last-child correction that a hidden or reordered row would break.')
    }
  })

  /* a-collapsed-row-still-costs-its-gap — A row that collapses gives up its line gap too. A container charges the gap whether or not anything is in it. */
  await run("a-collapsed-row-still-costs-its-gap", async () => {
    for (const parent of all('*')) {
      const cs = getComputedStyle(parent)
      if (!/flex|grid/.test(cs.display)) continue
      const gap = px(cs.rowGap)
      if (!(gap > 0)) continue
      for (const kid of parent.children) {
        const r = kid.getBoundingClientRect()
        if (r.height > 0.5) continue
        const kcs = getComputedStyle(kid)
        if (kcs.display === 'none' || kcs.position === 'absolute' || kcs.position === 'fixed') continue
        /* THE DECLARATION, NOT THE HEIGHT. Only a box told to collapse. */
        /* READ THE STRING, NEVER px(). max-height computes to none when
           nothing sets it, and px() turns an unparseable value into 0 — so this
           matched every element in the document and reported 24 findings on one
           surface, every one correct code. A box told to collapse says 0px; a
           box nobody told anything says none. Those are different answers. */
        const collapsing = /^0(px)?$/.test(kcs.maxHeight)
          || /(^|\s)0fr(\s|$)/.test(cs.gridTemplateRows || '')
        if (!collapsing) continue
        fail(name(parent), 'this container publishes a ' + gap + 'px row gap and holds a collapsed row, so it is ' + gap + 'px taller than what it shows. A gap is charged whether or not anything is in it. Give the collapsing row the whole distance as its own animated margin or padding and set the container row-gap to zero, so one writer owns the gap.')
        break
      }
    }
  })

  /* card-actions-sit-on-the-bottom-edge — In a row of cards of one height, every action row sits on the bottom edge. */
  await run("card-actions-sit-on-the-bottom-edge", async () => {
    for (const parent of all('*')) {
      const cs = getComputedStyle(parent)
      if (!/flex|grid/.test(cs.display)) continue
      const cards = Array.prototype.filter.call(parent.children, el => {
        const r = el.getBoundingClientRect()
        if (r.width < 40 || r.height < 40) return false
        const ecs = getComputedStyle(el)
        /* A CARD IS A BOX THAT PAINTS AND STACKS ITS OWN CONTENTS. Asking
           for a class would approve whatever nobody thought of. */
        return /flex|grid|block/.test(ecs.display) && el.children.length > 1
      })
      if (cards.length < 2) continue
      const hs = cards.map(c => c.getBoundingClientRect().height)
      if (Math.max.apply(null, hs) - Math.min.apply(null, hs) > 1) continue
      const feet = []
      for (const c of cards) {
        const kids = Array.prototype.filter.call(c.children, el => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
        const last = kids[kids.length - 1]
        if (!last || !last.querySelector(CONTROL)) { feet.length = 0; break }
        const ccs = getComputedStyle(c)
        const foot = c.getBoundingClientRect().bottom - px(ccs.borderBottomWidth) - px(ccs.paddingBottom)
        feet.push(foot - last.getBoundingClientRect().bottom)
      }
      if (feet.length < 2) continue
      const spread = Math.max.apply(null, feet) - Math.min.apply(null, feet)
      if (spread <= 2) continue
      fail(name(parent), 'these ' + feet.length + ' cards are stretched to one height and their action rows end ' + spread.toFixed(2) + 'px apart, so the row reads as ragged. Put margin-block-start: auto on the action row, which takes the free space in a flex column and lands it on the bottom edge wherever the text above ends. A content-sized card has no free space, so the same rule moves nothing there.')
    }
  })

  /* a-rule-sits-inside-its-gap — A rule between sections sits inside that gap, half each side, so a marked boundary takes the same height as an unmarked one. */
  await run("a-rule-sits-inside-its-gap", async () => {
    for (const el of all('*')) {
      const r = el.getBoundingClientRect()
      if (r.height > 3 || r.width < 40) continue
      const cs = getComputedStyle(el)
      /* A RULE IS A LINE THAT PAINTS. Either it IS the ink, or it draws a
         border. Asking for hr or a class name would miss whichever one
         nobody thought of. */
      const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || px(cs.borderTopWidth) > 0 || px(cs.borderBottomWidth) > 0
      if (!paints) continue
      const prev = el.previousElementSibling, next = el.nextElementSibling
      if (!prev || !next) continue
      const pr = prev.getBoundingClientRect(), nr = next.getBoundingClientRect()
      if (!pr.height || !nr.height) continue
      /* A ROW SEPARATOR IN A RUN IS A DIFFERENT RULE. Its neighbours are
         the same kind of thing as each other; a section rule sits between
         two unlike blocks. */
      if (prev.tagName === next.tagName && prev.tagName !== 'DIV') continue
      const above = r.top - pr.bottom, below = nr.top - r.bottom
      if (above < 0 || below < 0) continue
      if (Math.abs(above - below) <= 2) continue
      fail(name(el), 'this rule sits ' + above.toFixed(2) + 'px below what it follows and ' + below.toFixed(2) + 'px above what it precedes, so the boundary it marks is a different height from an unmarked one and the panel loses its rhythm. Give it half the section gap on each side. A line says WHERE a boundary is, never how big.')
    }
  })

  /* a-tab-strip-never-wraps-and-never-scrolls — A tab strip is one line of destinations. It never wraps and never scrolls; a strip that does not fit becomes a select. */
  await run("a-tab-strip-never-wraps-and-never-scrolls", async () => {
    for (const strip of all('nav, [role=tablist]')) {
      const kids = Array.prototype.filter.call(strip.children, el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      if (kids.length < 2) continue
      /* HORIZONTAL means the items do not share an x range. */
      const boxes = kids.map(k => k.getBoundingClientRect())
      /* HORIZONTAL IS A MAJORITY OF ADJACENT PAIRS SHARING A BAND, and both
         simpler forms traded one miss for another. Asking EVERY item to sit
         right of the one before it is false of a wrapped strip, which is the
         case this exists for. Asking only the FIRST pair reported a vertical
         rail as folded, because a rail leads with a section label whose box
         does not line up with the items under it. Measured: six rail items at
         tops 0, 232, 282, 332, 382 and 432 share no band at all, and a six-tab
         strip folded onto two rows shares four of five. */
      let together = 0
      for (let i = 1; i < boxes.length; i++) {
        const a = boxes[i - 1], b = boxes[i]
        if (a.top < b.bottom && b.top < a.bottom) together++
      }
      const sideBySide = together * 2 > boxes.length - 1
      if (!sideBySide) continue
      const cs = getComputedStyle(strip)
      if (/auto|scroll/.test(cs.overflowX)) {
        fail(name(strip), 'this tab strip declares overflow-x: ' + cs.overflowX + ', so a destination can sit scrolled out of view and the scrollbar takes height from this strip and not from the one beside it. A run of destinations that does not fit is a list, and a list you pick from is a select. Swap the bar for one, at the tab font size, padding and box height, so the content below does not jump.')
        continue
      }
      const bands = []
      for (const b of boxes) {
        if (!bands.some(y => b.top < y.bottom && y.top < b.bottom)) bands.push(b)
      }
      if (bands.length < 2) continue
      fail(name(strip), 'this tab strip is folded onto ' + bands.length + ' rows, so it stops reading as one control and the marker on row two looks like a different thing. Measured once at 92px over two rows for four tabs in a 248px pane. Set flex-wrap: nowrap and swap the whole bar for a select at the width where it stops fitting.')
    }
  })

  /* a-label-owns-its-gap — A group label states the distance to what it names. Two bare blocks carry no gap. */
  await run("a-label-owns-its-gap", async () => {
    for (const el of all('*')) {
      if (el.children.length) continue
      const cs = getComputedStyle(el)
      if (!el.textContent.trim()) continue
      const next = el.nextElementSibling
      if (!next) continue
      const ns = getComputedStyle(next)
      if (ns.display === 'none' || ns.position === 'absolute' || ns.position === 'fixed') continue
      if (!next.textContent.trim()) continue
      const parent = el.parentElement
      if (!parent) continue
      const ps = getComputedStyle(parent)
      if ((parseFloat(ps.rowGap) || 0) > 0.5) continue
      if (/^(TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|CAPTION)$/.test(parent.tagName)) continue
      const a = el.getBoundingClientRect(), b = next.getBoundingClientRect()
      if (!a.height || !b.height) continue
      if (b.top < a.bottom - 1) continue
      if (b.left > a.right - 0.5 || a.left > b.right - 0.5) continue
      if (parseFloat(cs.borderBottomWidth) > 0 || parseFloat(ns.borderTopWidth) > 0) continue
      const fill = s => s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : null
      const pf = fill(ps)
      if ((fill(cs) && fill(cs) !== pf) || (fill(ns) && fill(ns) !== pf)) continue
      if (parseFloat(cs.paddingBottom) > 0.5 || parseFloat(ns.paddingTop) > 0.5) continue
      if (parseFloat(cs.marginBottom) > 0.5 || parseFloat(ns.marginTop) > 0.5) continue
      const gap = b.top - a.bottom
      if (gap <= 2)
        fail(name(el), 'this label sits ' + round(gap) + 'px above ' + name(next) + ', which it names. A label with no gap reads as the first row of the group rather than its title. Blocks carry no gap, so state one: a flex parent with a gap fixes the whole group, a margin fixes only this instance.')
    }
  })

  /* a-group-of-buttons-keeps-one-gap — A wrapped run of buttons keeps one gap in both axes. A line break is not a group boundary. */
  await run("a-group-of-buttons-keeps-one-gap", async () => {
    for (const row of all('*')) {
      const cs = getComputedStyle(row)
      if (!/flex|grid/.test(cs.display)) continue
      /* A NAV IS NOT A GROUP OF BUTTONS. Its items are destinations, and the
         gutter between two strips is a step of its own by another rule. */
      if (row.matches('nav, [role=tablist], [role=menubar]') || row.closest('nav')) continue
      const kids = Array.prototype.filter.call(row.children, el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      if (kids.length < 2) continue
      /* EVERY child is a control or wraps one, so this is a run of buttons
         rather than a layout that happens to hold some. */
      if (!kids.every(k => k.matches(CONTROL) || k.querySelector(CONTROL))) continue
      const cg = px(cs.columnGap), rg = px(cs.rowGap)
      if (!(cg > 0) || !(rg > 0)) continue
      if (Math.abs(cg - rg) < 0.5) continue
      /* ONE LINE HAS NO VERTICAL GAP ANYBODY SEES. The row gap is declared
         and never painted, so it is a value waiting rather than a fault. */
      const bands = []
      for (const k of kids) {
        const r = k.getBoundingClientRect()
        if (!bands.some(b => r.top < b.bottom && b.top < r.bottom)) bands.push(r)
      }
      if (bands.length < 2) continue
      fail(name(row), 'this run of buttons is ' + cg + 'px apart across and ' + rg + 'px apart down, so its ' + bands.length + ' lines read as separate action rows. A wrapped run is one group that ran out of width: a line is not a group, and a line break is not a group boundary. Give it one gap in both axes. A proximity ratio needs a real group on each side of it, and here there is only one.')
    }
  })

  /* space-between-spreads-every-gap — space-between splits its slack evenly, so it opens a hole inside a run of like controls. Start the row and give the end group an auto margin. */
  await run("space-between-spreads-every-gap", async () => {
    /* TWO ADJACENT LIKE CONTROLS READ AS ONE GROUP, and space-between splits its
       free space evenly across every gap, so it opens a hole inside that group.
       Measured once on a header: 65.3px between a bell and the menu beside it.
    
       THE GAPS ARE EQUAL BY DEFINITION, so an unequal-gap question is
       unfireable. Five shapes measured in a 520px row and none reached 3:1. The
       fault is a UNIFORM gap too large for a pair that belongs together. */
    const LIKE = '.btn, button, [role=button], .nav-item, .tab, [role=tab]'
    for (const row of all('*')) {
      const cs = getComputedStyle(row)
      if (!cs.display.includes('flex')) continue
      if (cs.justifyContent !== 'space-between') continue
      if (cs.flexDirection.startsWith('column')) continue
      const kids = Array.prototype.slice.call(row.children).filter(visible).filter(boxOf)
      /* Two items is the idiom and has no group to open a hole in. */
      if (kids.length < 3) continue
      const boxes = kids.map(k => k.getBoundingClientRect())
      /* ONE LINE ONLY. A wrapped row is several runs. */
      let wrapped = false
      for (let i = 1; i < boxes.length; i++) if (boxes[i].top - boxes[0].top > 2) wrapped = true
      if (wrapped) continue
      const inner = px(cs.columnGap) || px(tokenValue('--icon-gap')) || 8
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1], b = kids[i]
        /* ── LIKE, AND THE TAG DECIDES IT ──
           A words div beside a button is two kinds of thing, and there is no
           group between them to break. Two controls of the same kind are a run,
           and a run is what a reader takes as one thing. */
        if (!a.matches(LIKE) || !b.matches(LIKE)) continue
        if (a.tagName !== b.tagName) continue
        const d = boxes[i].left - boxes[i - 1].right
        if (d <= inner * 3) continue
        fail(name(b),
          'this control sits ' + round(d) + 'px from the one before it, and both are the same kind, so a reader takes them as one run. The row uses space-between, which splits its free space evenly across every gap and so opens a hole INSIDE that run. Its own gap is ' + round(inner) + 'px. Start the row instead and give the group that belongs at the end an auto margin, so all the slack lands in one place.')
      }
    }
  })

  /* proximity-is-a-ratio — State both gaps together: the gap inside a group and the gap between groups. Proximity is a ratio, and a gutter between columns is a step of its own, never the row default. Three to one, or the two read as one thing. */
  await run("proximity-is-a-ratio", async () => {
    const px = v => parseFloat(v) || 0
    const between = els => {
      const rects = els.map(e => e.getBoundingClientRect())
      let min = Infinity
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const dx = Math.max(a.left - b.right, b.left - a.right)
        const dy = Math.max(a.top - b.bottom, b.top - a.bottom)
        if (dx < 0 && dy < 0) continue   /* stacked in z, not spaced */
        const d = dx >= 0 && dy >= 0 ? Math.min(dx, dy) : Math.max(dx, dy)
        if (d >= 0 && d < min) min = d
      }
      return min === Infinity ? 0 : min
    }
    const inner = el => between(Array.prototype.slice.call(el.children).filter(visible))
    const paintsItsOwn = (el, parentBg) => {
      const cs = getComputedStyle(el)
      for (const side of ['Top', 'Right', 'Bottom', 'Left'])
        if (px(cs['border' + side + 'Width']) > 0) return true
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return true
      const bg = cs.backgroundColor
      const clear = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      return clear && bg !== parentBg
    }
    const isSpecimen = el => !!(el.closest('[data-specimen]')
      || el.querySelector(':scope > * > .row-label, :scope > .row-label'))
    for (const box of all('*')) {
      const cs = getComputedStyle(box)
      if (!/flex|grid/.test(cs.display)) continue
      if (isSpecimen(box)) continue   /* a sheet showing three sizes shows three sizes */
      const byGap = new Map()
      for (const kid of box.children) {
        if (!visible(kid)) continue
        if (!/flex|grid/.test(getComputedStyle(kid).display)) continue
        const gi = inner(kid)
        if (gi <= 0) continue
        if (paintsItsOwn(kid, cs.backgroundColor)) continue
        const key = Math.round(gi * 100) / 100
        if (!byGap.has(key)) byGap.set(key, [])
        byGap.get(key).push(kid)
      }
      for (const entry of byGap) {
        const gi = entry[0], members = entry[1]
        if (members.length < 2) continue   /* one group has no next one */
        const go = between(members)
        if (go <= 0) continue
        const r = go / gi
        if (r >= 3) continue
        fail(name(members[0]), members.length + ' of these sit ' + round(go) + 'px apart and each holds its own contents ' + round(gi) + 'px apart, which is ' + (Math.round(r * 100) / 100) + ':1. Proximity is a ratio: under three to one the two distances read as one, so a group stops being told apart from the next. Raise the outer gap a step, or lower the inner one.')
      }
    }
  })

  /* one-writer-for-one-gap — A container publishes the distance between its children, or each child states its own. Never both. */
  await run("one-writer-for-one-gap", async () => {
    const smallestStep = (() => {
      const root = getComputedStyle(document.documentElement)
      let min = Infinity
      for (const n of ['--space-4xs', '--space-3xs', '--space-2xs', '--space-xs']) {
        const v = parseFloat(root.getPropertyValue(n)); if (v > 0 && v < min) min = v
      }
      return min === Infinity ? 2 : min
    })()
    const declaredAuto = el => {
      for (const prop of ['margin-block-start', 'margin-top'])
        if (el.style.getPropertyValue(prop) === 'auto') return true
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules } catch (e) { continue }
        for (const r of rules) {
          if (!r.selectorText || !r.style) continue
          const v = r.style.getPropertyValue('margin-block-start') || r.style.getPropertyValue('margin-top')
          if (v !== 'auto') continue
          try { if (el.matches(r.selectorText)) return true } catch (e) {}
        }
      }
      return false
    }
    for (const box of all('*')) {
      const cs = getComputedStyle(box)
      if (!/flex|grid/.test(cs.display)) continue
      const gap = cs.rowGap === 'normal' ? 0 : parseFloat(cs.rowGap) || 0
      if (gap <= 0) continue
      for (const kid of box.children) {
        if (kid === box.firstElementChild) continue   /* nothing above it to be spaced from */
        const m = parseFloat(getComputedStyle(kid).marginBlockStart) || 0
        if (m < smallestStep) continue   /* a correction, not a distance */
        if (declaredAuto(kid)) continue
        fail(name(kid), 'sits ' + round(gap + m) + 'px below its previous sibling, because its container publishes a ' + round(gap) + 'px row-gap AND it states a ' + round(m) + 'px margin. A gap and a margin add, so this distance is the sum of two writers rather than a value anybody chose. One of them owns it.')
      }
    }
  })

  /* a-class-styles-something-where-it-sits — Every class on an element is reached by some rule, or it is a name that styles nothing here. */
  await run("a-class-styles-something-where-it-sits", async () => {
    /* ── READ THE TEXT AS WELL AS THE CSSOM ──
       Measured once in a dev server: five sheets, three throwing on access and
       two empty, zero rules read, and a confident report of zero findings. An
       injected fault carrying five dead classes came back clean. */
    const sels = []
    const collect = list => { for (const r of list) {
      if (r.cssRules) collect(r.cssRules)
      else if (r.selectorText) for (const one of r.selectorText.split(",")) sels.push(one.trim())
    } }
    for (const sheet of document.styleSheets) {
      try { collect(sheet.cssRules) } catch (e) { /* read from the text below */ }
    }
    const texts = []
    for (const n of document.querySelectorAll("style")) texts.push(n.textContent || "")
    for (const n of document.querySelectorAll("link[rel=stylesheet]")) {
      try { texts.push(await (await fetch(n.href)).text()) } catch (e) { /* cross-origin */ }
    }
    const bare = texts.join(String.fromCharCode(10))
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
    for (const m of bare.matchAll(/([^{}@]+)\{[^{}]*\}/g)) {
      for (const one of m[1].split(",")) {
        const t = one.trim()
        if (t && !/^@|^\d/.test(t)) sels.push(t)
      }
    }
    /* A RUN THAT READ NO RULES IS NOT A CLEAN RESULT. */
    if (sels.length < 20) {
      fail("(the check itself)", "read only " + sels.length + " selectors, so nothing was measured. Three of five sheets can throw on cssRules access, which is why the stylesheet TEXT is read as well.")
      return
    }
    
    /* WHAT SITS INSIDE A FUNCTIONAL PSEUDO IS NOT A NAME BEING USED. A class
       read inside :not() is being excluded, and counting it called four correct
       classes dead. */
    const blanked = t => t.replace(/:(not|has|is|where)\([^()]*\)/g,
      m => new Array(m.length + 1).join(" "))
    /* AND A STATE CANNOT MATCH AT REST. A rule on :hover is alive and
       unmatchable now, so drop the state before asking whether it reaches. */
    const STATE = /::?(hover|focus|focus-visible|focus-within|active|disabled|checked|indeterminate|placeholder|before|after|first-line|selection|target|visited|open|marker|backdrop)\b(\([^()]*\))?/g
    const norm = t => blanked(t).replace(STATE, "").replace(/\s+/g, " ").trim()
    const names = (t, cls) => blanked(t).indexOf("." + cls) >= 0
    const compoundWith = (t, cls) => {
      const parts = norm(t).split(/\s+|>|\+|~/).filter(Boolean)
      for (const part of parts) if (part.indexOf("." + cls) >= 0) return part
      return ""
    }
    
    let scanned = 0
    for (const el of all("[class]")) {
      scanned++
      for (const cls of Array.prototype.slice.call(el.classList)) {
        const naming = sels.filter(t => names(t, cls))
        /* A CLASS NO STYLESHEET MENTIONS IS A HOOK. A test id or a behaviour
           marker is not this question business, and reporting them buries the
           findings. */
        if (!naming.length) continue
        let alive = false
        for (const t of naming) {
          const n = norm(t)
          if (!n) continue
          try { if (el.matches(n)) { alive = true; break } } catch (e) { /* unsupported */ }
          /* AN ANCESTOR CLASS IS DOING ITS JOB. A row selection class styles the
             CELL, so the class on the row is alive when the row holds such a
             cell. Counting only the subject called that dead. */
          const c = compoundWith(t, cls)
          try { if (c && el.matches(c) && el.querySelector(n)) { alive = true; break } } catch (e) { /* unsupported */ }
        }
        if (alive) continue
        fail(name(el), "the class " + JSON.stringify(cls) + " reaches nothing on this element, and " + naming.length + " rule(s) name it elsewhere. A class that exists in another context styles nothing here and fails in silence: no build error, no console message, and markup that reads as done. An app hosting a document has two class sets. Check which stylesheet applies where this element sits, and what that class actually sets.")
      }
    }
    if (!scanned) fail("(the check itself)", "nothing carried a class, so nothing was measured")
    else note(scanned + " elements measured against " + sels.length + " selectors")
  })

  /* an-inline-box-has-no-size — Anything that paints a box states a display. An inline box has no width or height. */
  await run("an-inline-box-has-no-size", async () => {
    for (const el of all('*')) {
      const cs = getComputedStyle(el)
      if (cs.display !== 'inline') continue
      const bg = cs.backgroundColor
      const open = bg ? bg.indexOf('(') : -1
      const parts = open < 0 ? [] : bg.slice(open + 1, bg.lastIndexOf(')')).split(',')
      const filled = !!bg && bg !== 'transparent' && (parts.length < 4 || parseFloat(parts[3]) > 0)
      const edged = ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(cs['border' + s + 'Width']) > 0)
      const paints = filled || edged || cs.backgroundImage !== 'none'
      if (!paints) continue
      const own = el.style
      const asked = own.width || own.height || own.inlineSize || own.blockSize
      const box = el.getBoundingClientRect()
      if (asked)
        fail(name(el), 'this paints a box and asks for ' + asked + ', and it computes to display: inline, which ignores every width and height. It rendered ' + round(box.width) + ' by ' + round(box.height) + '. Give it display: block, or make it a grid or flex item, which are blockified for you.')
      else if (!box.width || !box.height)
        fail(name(el), 'this paints a box and rendered ' + round(box.width) + ' by ' + round(box.height) + ', because display: inline takes its size from text it does not have. Give it a display that can hold a box.')
    }
  })

  /* a-type-role-is-one-decision — Text takes its size and its leading from the SAME type role. */
  await run("a-type-role-is-one-decision", async () => {
    var ROLE_NAMES = ['display','h1','h2','h3','h4','h5','h6',
      'body-lg','body-md','body-sm','caption','overline','button','code']
    var ROLES = []
    for (const r of ROLE_NAMES) {
      const size = parseFloat(tokenValue('--font-' + r + '-size'))
      const lead = parseFloat(tokenValue('--font-' + r + '-leading'))
      if (size > 0 && lead > 0) ROLES.push({ r: r, size: size, px: size * lead })
    }
    if (ROLES.length) for (const el of all('*')) {
      if (el.children.length) continue
      if (!el.textContent.trim()) continue
      const cs = getComputedStyle(el)
      const size = parseFloat(cs.fontSize)
      const lh = parseFloat(cs.lineHeight)
      if (!(size > 0) || !(lh > 0)) continue
      var host = el, boxed = false
      for (var up = 0; host && up < 4; up++, host = host.parentElement) {
        var hs = getComputedStyle(host)
        if (hs.height === 'auto' && hs.blockSize === 'auto') continue
        var bt = parseFloat(hs.borderTopWidth) || 0
        var bb = parseFloat(hs.borderBottomWidth) || 0
        var content = host.getBoundingClientRect().height - bt - bb
        if (content > 0 && Math.abs(content - lh) < 1.2) { boxed = true; break }
      }
      if (boxed) continue
      const sameSize = ROLES.filter(x => Math.abs(x.size - size) < 0.6)
      if (!sameSize.length) continue
      if (sameSize.some(x => Math.abs(x.px - lh) < 0.8)) continue
      const owner = sameSize.map(x => x.r).join(' or ')
      const lent = ROLES.filter(x => Math.abs(x.px - lh) < 0.8).map(x => x.r)
      fail(name(el), 'this is ' + round(size) + 'px, which is the ' + owner + ' size, and its line height is ' + round(lh) + 'px, which that role does not publish. ' + (lent.length ? 'That leading belongs to ' + lent.join(' or ') + '. ' : '') + 'A type role pairs a size with a leading, so take both from one role rather than the size from one and the leading from whatever element it sits in.')
    }
  })

  /* a-lift-must-not-survive-a-wrap — A transform that centres a row on a heading is removed once that row wraps below it. */
  await run("a-lift-must-not-survive-a-wrap", async () => {
    const tyOf = m => {
      const g = /matrix\(([^)]*)\)/.exec(m)
      if (!g) return 0
      const parts = g[1].split(',')
      return parseFloat(parts[5] || '0') || 0
    }
    for (const el of all('*')) {
      const cs = getComputedStyle(el)
      if (!cs.transform || cs.transform === 'none') continue
      const ty = tyOf(cs.transform)
      if (Math.abs(ty) <= 0.5) continue
      const prev = el.previousElementSibling
      if (!prev) continue
      const ps = getComputedStyle(prev)
      if (ps.display === 'none' || ps.position === 'absolute' || ps.position === 'fixed') continue
      const paintedBox = node => {
        const r = node.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return r
        let l = Infinity, t = Infinity, rr = -Infinity, bb = -Infinity
        for (const k of node.querySelectorAll('*')) {
          const kr = k.getBoundingClientRect()
          if (!kr.width || !kr.height) continue
          if (kr.left < l) l = kr.left
          if (kr.top < t) t = kr.top
          if (kr.right > rr) rr = kr.right
          if (kr.bottom > bb) bb = kr.bottom
        }
        return rr > l ? { left: l, top: t, right: rr, bottom: bb, width: rr - l, height: bb - t } : r
      }
      const a = paintedBox(prev), b = el.getBoundingClientRect()
      if (!a.height || !b.height) continue
      if (b.left > a.right - 0.5 || a.left > b.right - 0.5) continue
      const over = a.bottom - b.top
      if (over <= 0.25) continue
      const had = el.style.transform
      el.style.transform = 'none'
      const clean = el.getBoundingClientRect()
      el.style.transform = had
      if (a.bottom - clean.top > 0.25) continue
      fail(name(el), 'this row carries a ' + round(ty) + 'px vertical transform and overlaps ' + name(prev) + ' above it by ' + round(over) + 'px. Without the transform it does not. A lift that centres a row on a heading has nothing to centre against once the row wraps, and a transform costs no layout, so it pulls the row over whatever sits above. Reset it in the block that declares the collapse.')
    }
  })

  /* a-row-alone-on-its-line-covers-it — An action row that takes a line of its own covers that line. */
  await run("a-row-alone-on-its-line-covers-it", async () => {
    var CTRL = 'button, input, select, textarea, a[href], summary, [role=button],'
      + ' [role=checkbox], [role=radio], [role=tab], [role=switch], [tabindex]'
    for (const el of all('*')) {
      const cs = getComputedStyle(el)
      if (cs.display.indexOf('flex') === -1 || cs.flexDirection !== 'row') continue
      const parent = el.parentElement
      if (!parent) continue
      const ink = []
      for (const c of el.children) {
        if (getComputedStyle(c).display === 'contents') { for (const g of c.children) ink.push(g) }
        else ink.push(c)
      }
      const paint = ink.filter(visible).filter(c => {
        const p = getComputedStyle(c).position
        return p !== 'absolute' && p !== 'fixed'
      })
      if (!paint.length) continue
      if (!paint.some(c => c.matches(CTRL))) continue
      if (paint.some(c => {
        const d = getComputedStyle(c).display
        return !c.matches(CTRL) && /^(block|flow-root)$/.test(d) && c.textContent.trim().length > 60
      })) continue
      const blockish = /^(block|flow-root|list-item)$/.test(cs.display)
        || cs.display === 'flex' && parent && !/flex|grid/.test(getComputedStyle(parent).display)
      const autoSide = p => {
        if (el.style.getPropertyValue(p) === 'auto') return true
        for (const sheet of document.styleSheets) {
          let rules; try { rules = sheet.cssRules } catch (e) { continue }
          for (const r of rules) {
            if (!r.selectorText || !r.style) continue
            if (r.style.getPropertyValue(p) !== 'auto') continue
            try { if (el.matches(r.selectorText)) return true } catch (e) {}
          }
        }
        return false
      }
      const told = cs.flexBasis === '100%' || parseFloat(cs.flexGrow) > 0
        || blockish || autoSide('margin-left') || autoSide('margin-right')
      if (!told) continue
      const pcs = getComputedStyle(parent), pb = parent.getBoundingClientRect()
      const lineW = (pb.right - px(pcs.paddingRight) - px(pcs.borderRightWidth))
        - (pb.left + px(pcs.paddingLeft) + px(pcs.borderLeftWidth))
      const b = el.getBoundingClientRect()
      if (lineW <= 0 || b.width < lineW * 0.95) continue
      const cL = b.left + px(cs.paddingLeft) + px(cs.borderLeftWidth)
      const cR = b.right - px(cs.paddingRight) - px(cs.borderRightWidth)
      let inkL = Infinity, inkR = -Infinity
      for (const c of paint) { const r = c.getBoundingClientRect(); if (r.left < inkL) inkL = r.left; if (r.right > inkR) inkR = r.right }
      const filled = inkR - inkL
      const hole = (cR - cL) - filled
      if (hole <= filled) continue
      fail(name(el), 'this row of ' + paint.length + ' control(s) asked for the whole line, took ' + round(b.width) + 'px of it and filled ' + round(filled) + 'px. ' + round(hole) + 'px is empty. A row that takes a line of its own covers that line: pair the controls two per line and let the last labelled one absorb the slack. A group holding nothing but icon-only controls never needed a line at all — keep it beside the heading.')
    }
  })

  /* a-pair-dissolves-when-a-row-fits — A broken action row pairs two per line. When the row fits, every pair dissolves into one flat row. */
  await run("a-pair-dissolves-when-a-row-fits", async () => {
    /* An action row that breaks, breaks into PAIRS: two per line, equal, across
       the whole width. When the row fits, the pairing dissolves so every button
       sits at its natural width in one flat row.
    
       READ WHAT THE PAGE IS, not what width it is at. A pair at
       display: contents has dissolved and its buttons belong on one line. A pair
       that generates a box is holding a line, and a line holds two at most. */
    for (const row of all('.action-pairs')) {
      const pairs = Array.prototype.slice.call(row.querySelectorAll(':scope > .pair')).filter(visible)
      if (!pairs.length) continue
      const dissolved = pairs.filter(p => getComputedStyle(p).display === 'contents')
      const boxed = pairs.filter(p => getComputedStyle(p).display !== 'contents')
      /* One mechanism at a time. Half dissolved is a row in two arrangements. */
      if (dissolved.length && boxed.length) {
        fail(name(row),
          'this action row holds ' + dissolved.length + ' dissolved pair(s) and ' + boxed.length + ' that still generate a box, so it is in two arrangements at once. Either the row fits and every pair dissolves, or it does not and every pair holds a line.')
        continue
      }
      const btns = all('.btn').filter(b => row.contains(b))
      if (!btns.length) continue
      const lines = {}
      for (const b of btns) {
        const t = Math.round(b.getBoundingClientRect().top)
        const key = Object.keys(lines).find(k => Math.abs(Number(k) - t) <= 2)
        lines[key == null ? t : key] = (lines[key == null ? t : key] || 0) + 1
      }
      const counts = Object.keys(lines).map(k => lines[k])
      if (dissolved.length === pairs.length) {
        /* Dissolved, so one flat row. A row that still breaks has not been
           dissolved because it fits: it has been dissolved too early. */
        if (counts.length > 1) {
          fail(name(row),
            'every pair here has dissolved, which says the row fits, and its ' + btns.length + ' buttons are on ' + counts.length + ' lines. A dissolved row is one flat row at natural widths. Keep the pairing until the row actually fits.')
        }
        continue
      }
      /* Boxed, so each pair holds a line and a line holds two at most. */
      const over = counts.filter(n => n > 2)
      if (over.length) {
        fail(name(row), 'a broken action row puts at most two buttons on a line, and a line here holds ' + Math.max.apply(null, over) + '. Two per line, equal, across the whole width: the pair has to be the CONTAINER, or the count per line is emergent and one long label pushes a third button up.')
      }
    }
  })

  /* a-row-that-cannot-wrap-must-fit — A row that cannot wrap fits its box, or it carries flex-wrap: wrap. */
  await run("a-row-that-cannot-wrap-must-fit", async () => {
    for (const el of all('*')) {
      const cs = getComputedStyle(el)
      if (!/flex/.test(cs.display)) continue
      if (!/^row/.test(cs.flexDirection)) continue
      if (cs.flexWrap !== 'nowrap') continue
      if (cs.position === 'absolute' || cs.position === 'fixed') continue
      const inside = (node, style) => node.getBoundingClientRect().width
        - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
        - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0)
      let avail = inside(el, cs)
      const up = el.parentElement
      if (up) {
        const us = getComputedStyle(up)
        const room = inside(up, us)
        const bleeds = (parseFloat(cs.marginLeft) || 0) < 0 || (parseFloat(cs.marginRight) || 0) < 0
        const cut = /hidden|clip/.test(us.overflowX)
        if (bleeds || cut) continue
        if (room > 0) avail = Math.min(avail, room)
      }
      if (avail <= 0) continue
      let reachable = false
      let node = el
      for (let step = 0; node && step < 12; step++) {
        if (/auto|scroll/.test(getComputedStyle(node).overflowX)) { reachable = true; break }
        node = node.parentElement
      }
      if (reachable) continue
      const layoutKids = parent => {
        const out = []
        for (const kid of parent.children) {
          const ks = getComputedStyle(kid)
          if (ks.position === 'absolute' || ks.position === 'fixed') continue
          if (ks.display === 'none') continue
          if (ks.display === 'contents') { out.push(...layoutKids(kid)); continue }
          out.push(kid)
        }
        return out
      }
      let lo = Infinity, hi = -Infinity, kids = 0
      for (const kid of layoutKids(el)) {
        const k = kid.getBoundingClientRect()
        if (!k.width) continue
        lo = Math.min(lo, k.left)
        hi = Math.max(hi, k.right)
        kids++
      }
      if (kids < 2) continue
      const used = hi - lo
      if (used > avail + 1)
        fail(name(el), 'a row that cannot wrap holds ' + round(used) + 'px of children in the ' + round(avail) + 'px it is given, over by ' + round(used - avail) + '. Nothing on this axis scrolls, so the excess pushes the page sideways and the last control is cut off at the screen edge. A control will not shrink under its own label. Give the row flex-wrap: wrap and it breaks onto a second line instead.')
    }
  })

  /* a-control-holds-one-mark-size — One mark size per control. A mark takes its size from its own control, never from a neighbour. */
  await run("a-control-holds-one-mark-size", async () => {
    /* A CONTROL IS A LEAF, so its marks are ornament rather than siblings in a
       layout. Two of them at two sizes is one control speaking twice. */
    const MARKED = CONTROL + ', .tab, .nav-item, .select-trigger, .chip, .badge'
    for (const c of all(MARKED)) {
      /* An AVATAR is not a mark. It publishes its own size and its own gap. */
      const marks = Array.prototype.slice.call(c.querySelectorAll('svg'))
        .filter(m => visible(m) && !m.closest('.avatar') && boxOf(m))
      if (marks.length < 2) continue
      /* A SPECIMEN ROW EXISTS TO SHOW THREE SIZES, so it cannot be faulted for
         showing three sizes. It says so on itself. */
      if (c.closest('[data-specimen], .specimen, .sizes')) continue
      const sizes = marks.map(m => {
        const r = m.getBoundingClientRect()
        return Math.max(r.width, r.height)
      })
      const spread = Math.max.apply(null, sizes) - Math.min.apply(null, sizes)
      /* WHOLE PIXELS. Half a pixel of difference is not visible, and a
         threshold below one fires on sub-pixel rounding. */
      if (spread < 1) continue
      fail(name(c),
        'this control holds ' + marks.length + ' marks at ' + sizes.map(round).join(', ') + 'px, a spread of ' + round(spread) + 'px. A mark takes its size from its OWN control and never from a neighbour: the published size is one value at every control size, so one control cannot carry two. Read the marks the control already has before adding one.')
    }
  })

  /* an-icon-only-control-is-square — A pressable thing with a mark and no visible words is one to one, at every size. */
  await run("an-icon-only-control-is-square", async () => {
    /* VISIBLE words, so a clipped screen-reader name does not count. A label
       hidden to a pixel has a box, and treating it as words is what let a
       menu button ship at 46x28 with the class never arriving. */
    const showsWords = el => {
      const readable = n => { const b = n.getBoundingClientRect(), cs = getComputedStyle(n)
        return b.width > 4 && b.height > 4 && cs.visibility !== "hidden" && cs.opacity !== "0" }
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true
      for (const n of el.querySelectorAll("*")) {
        const own = Array.prototype.filter.call(n.childNodes,
          x => x.nodeType === 3 && x.textContent.trim())
        if (own.length && readable(n)) return true
      }
      return false
    }
    for (const el of all("button, a[href], .btn, [role=button], .nav-item, .tab, summary")) {
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      /* A MARK, because that is the clause the code dropped last time. */
      if (!el.querySelector("svg, img, .icon")) continue
      if (showsWords(el)) continue
      const ratio = r.width / r.height
      /* TWO PERCENT, because a sub-pixel rounding is not an oblong, and a
         verdict that flips on floating point noise is worse than none. */
      if (Math.abs(ratio - 1) <= 0.02) continue
      fail(name(el), "this control holds a mark and no visible words, and measures " + round(r.width) + "x" + round(r.height) + ", a ratio of " + round(ratio) + ". An oblong reads as a button whose label failed to load. State the shape with aspect-ratio 1 and no width at all: a ratio only makes a size when the other axis is auto, so a stated width is the one thing that defeats it. Where a width rule hides the words, put the shape in the SAME block that hides them.")
    }
  })

  /* a-mark-is-never-a-typed-glyph — A mark comes from the icon set. A typed character is not an icon and a word space is not a gap. */
  await run("a-mark-is-never-a-typed-glyph", async () => {
    /* THE GLYPHS AN ICON SET ALREADY DRAWS. A chevron, a cross, a tick, an
       arrow, a plus, a reload, an overflow run. Written as code points, so
       this file stays readable in any editor. */
    const GLYPH = new RegExp("[" + [0x2b, 0xd7, 0x2715, 0x2713, 0x21ba, 0x22ef,
      0x2192, 0x2190, 0x2191, 0x2193, 0x2039, 0x203a, 0xab, 0xbb]
      .map(c => String.fromCharCode(c)).join("") + "]")
    for (const el of all("button, a[href], .btn, [role=button], .nav-item, .tab, summary")) {
      for (const n of Array.prototype.slice.call(el.childNodes)) {
        if (n.nodeType !== 3) continue
        const t = n.textContent
        if (!GLYPH.test(t)) continue
        fail(name(el), "this control types " + JSON.stringify(t.trim().slice(0, 20)) + " where a mark belongs. A text glyph takes the LABEL size rather than the mark size, and a word space is roughly a quarter of the font size and answers to no spacing token. Use the icon set at the size token for this control step, and the three properties that travel with it: inline-flex, align-items centre, and the published icon gap.")
        break
      }
    }
  })

  /* a-mark-stays-inside-its-control — A control that draws its own mark keeps that mark inside its box. */
  await run("a-mark-stays-inside-its-control", async () => {
    for (const box of all('.checkbox, .switch, [class*=checkbox], [class*=switch], [class*=box]')) {
      const b = box.getBoundingClientRect(); if (!b.width || b.width > 64) continue
      const marks = Array.prototype.slice.call(box.querySelectorAll('svg, img'))
      if (marks.length < 2) continue
      for (const m of marks) {
        const r = m.getBoundingClientRect(); if (!r.width) continue
        const out = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom)
        if (out > 1)
          fail(name(box), 'a mark sits ' + round(out) + 'px outside the control that draws it, so the engine clips it. ' + marks.length + ' marks share this box, and in normal flow they lay out side by side. Put every state in ONE cell.')
      }
    }
  })

  /* a-date-with-a-month-name-is-text — A date carrying a month name stays in the body face. Only an all-figure date takes the mono one. */
  await run("a-date-with-a-month-name-is-text", async () => {
    const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i
    const first = f => (f || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()
    const BODY = first(tokenValue('--font-body-md-family'))
    for (const el of all('*')) {
      if (el.children.length) continue
      const t = (el.textContent || '').trim()
      if (!t || t.length > 40 || !MONTHS.test(t)) continue
      const fam = getComputedStyle(el).fontFamily
      if (BODY && first(fam) === BODY) continue
      if (!/mono|courier|consolas/i.test(fam)) continue
      fail(name(el), 'the text ' + JSON.stringify(t.slice(0, 24)) + ' carries a month name and is set in ' + fam.split(',')[0] + '. A date with a month name is read rather than compared, so it takes the body face. Only an all-figure date takes the mono one.')
    }
  })

  /* a-fixed-height-control-centres-its-label — One mechanism centres a label. A control with a stated height centres its own by line-height; make it a flex box as well and it centres twice. */
  await run("a-fixed-height-control-centres-its-label", async () => {
    const CONTROL = 'button, .btn, .nav-item, a.btn, [role="button"], .select-trigger, .tab'
    for (const el of all(CONTROL)) {
      const cs = getComputedStyle(el)
      /* A STATED HEIGHT is the whole point. A box that fits its content has
         nothing to centre in, and its label sits where the content puts it. */
      const stated = cs.height !== 'auto' && cs.blockSize !== 'auto'
      const floored = parseFloat(cs.minHeight) > 0 || parseFloat(cs.minBlockSize) > 0
      if (!stated && !floored) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      /* Its OWN label, as a text node. A child element's rect can start at an
         ornament, and measuring that reports the mark rather than the words. */
      const tn = Array.prototype.filter.call(el.childNodes, function (n) {
        return n.nodeType === 3 && n.textContent.trim()
      })[0]
      if (!tn) continue
      const range = document.createRange()
      range.selectNode(tn)
      const rects = Array.prototype.filter.call(range.getClientRects(), function (q) { return q.width > 0 })
      if (rects.length !== 1) continue   /* a wrapped label has no single centre */
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
      const m = ctx.measureText('H')
      const base = rects[0].top + m.fontBoundingBoxAscent
      const cap = base - m.actualBoundingBoxAscent
      const off = ((cap + base) / 2) - ((r.top + r.bottom) / 2)
      if (Math.abs(off) <= 1) continue
      fail(name(el), 'this control states its height and its label sits ' + round(off) + 'px from the box centre. Baseline alignment pins a label to the top of a fixed-height box, and so does a single flex line in a box taller than its content. Centre the label: an inline-block with a line-height equal to the CONTENT box, or flex-wrap with align-content centre where the mark still needs the baseline.')
    }
  })

  /* a-menu-control-is-a-sibling-of-the-action-group — A menu control is a button in the action group, always rightmost, and a SIBLING of that group rather than a member. Inside it, it can only go where the group goes. */
  await run("a-menu-control-is-a-sibling-of-the-action-group", async () => {
    const ACTION = "button, a[href], [role=button], .btn"
    const HEADING = "h1, h2, h3"
    /* A BURGER IS THREE STACKED BARS OF ONE SIZE. Read the boxes, never a class
       name: the reader names it whatever they like. */
    const bars = el => {
      const kids = Array.prototype.slice.call(el.children)
      if (kids.length < 3 || kids.length > 4) return false
      if (el.textContent.trim()) return false
      const boxes = kids.map(k => k.getBoundingClientRect())
      if (boxes.some(b => !b.width || !b.height)) return false
      const w = boxes[0].width, h = boxes[0].height
      if (h >= w) return false
      return boxes.every(b => Math.abs(b.width - w) < 0.6 && Math.abs(b.height - h) < 0.6)
    }
    const menus = []
    for (const s of all("details > summary")) if (s.parentElement) menus.push(s.parentElement)
    for (const el of all(ACTION)) {
      if (menus.some(m => m === el || m.contains(el))) continue
      if (Array.prototype.slice.call(el.querySelectorAll("*")).some(bars)) menus.push(el)
    }
    let seen = 0
    for (const ctrl of menus) {
      /* THE HEAD HOLDS THE HEADING AND THE CONTROL, at two levels at most. */
      let head = null
      for (let p = ctrl.parentElement, i = 0; p && i < 2; p = p.parentElement, i++) {
        const kids = Array.prototype.slice.call(p.children)
        if (kids.some(c => c.matches(HEADING) || c.querySelector(HEADING))) { head = p; break }
      }
      if (!head) continue
      seen++
      /* THE GROUP IS A RUN OF PRESSABLE SIBLINGS, never a class name. Walk from
         the control up to the head. A box on that path holding two or more OTHER
         actions IS the action group, so this control is a member of it. */
      for (let p = ctrl.parentElement; p && p !== head; p = p.parentElement) {
        const others = all(ACTION).filter(b => p.contains(b) && b !== ctrl && !ctrl.contains(b))
        if (others.length < 1) continue
        fail(name(ctrl), "a menu control INSIDE the action group " + name(p)
          + ", which holds " + others.length + " other action" + (others.length === 1 ? "" : "s")
          + ". A menu control is a SIBLING of that group."
          + " Inside it, it can only go where the group goes, so it loses the title row the moment the group wraps.")
        break
      }
    }
    /* A RUN THAT MEASURED NOTHING IS NOT A PASS. A menu control belongs to
       the folded layout, so above the fold width it is display: none and this
       check reads zero of them. Measured on this app: shown at 296 and 640,
       hidden at 768, 1024 and 1536. Say so rather than printing a bare 0. */
    if (!seen) note('no menu control on any page head. Above the width where the navigation folds there is none to place, so this rule is UNMEASURED here. Run again at your narrowest width.')
    else note(seen + " menu control(s) on a page head, of " + menus.length + " found. A menu with no burger and no disclosure is not measured.")
  })

  /* an-action-stands-clear-of-its-explanation — An action stands clear of the text that explains it, by 16px. Measure to the button, not to its row. */
  await run("an-action-stands-clear-of-its-explanation", async () => {
    const STEP = px(tokenValue('--space-md')) || 16
    /* A text block is a run of words with no control in it. Four words, so a
       one-word label above a field is not mistaken for an explanation. */
    for (const parent of all('*')) {
      const kids = Array.prototype.filter.call(parent.children, el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
      if (kids.length < 2) continue
      for (let i = 1; i < kids.length; i++) {
        const prev = kids[i - 1], row = kids[i]
        /* AN ACTION, NOT ANY CONTROL. A checkbox after a paragraph is a form
           field and a nav item is a destination. Both were reported before this
           line, and the rule is about neither. */
        const isAct = e => e.matches('button, a[href], [role=button], .btn')
          && !e.matches('.nav-item, .tab, [role=tab], input, select, textarea')
        const btn = isAct(row) ? row : [...row.querySelectorAll('*')].find(isAct)
        if (!btn) continue
        if (prev.matches(CONTROL) || prev.querySelector(CONTROL)) continue
        const words = prev.textContent.trim().split(/\s+/).filter(Boolean)
        if (words.length < 4) continue
        /* ── AN EXPLANATION IS PROSE, AND THE MARKUP SAYS SO ──
           A word count cannot tell a sentence that explains an action from a
           readout in a pager bar. Measured at a 296px pane: four findings, and
           two were a readout span and a specimen span. A paragraph is the
           element prose is written in, so ask for one. */
        if (!(prev.matches('p') || prev.querySelector('p'))) continue
        const pr = prev.getBoundingClientRect(), br = btn.getBoundingClientRect()
        /* Stacked, and the button below the text. */
        if (br.top < pr.bottom - 0.5) continue
        /* ── A TRANSFORMED ROW IS PLACED BY ANOTHER RULE ──
           The actions beside a page heading carry a translate that centres them
           on its cap band, so their distance from the subtitle above is a
           by-product rather than a stated gap. Measured on one page head: 12px,
           and correct. Read the DECLARATION, not the distance. */
        if (getComputedStyle(row).transform !== 'none') continue
        /* AN OUT-OF-FLOW SIBLING SETS NO GAP. The Gallery tooltip specimen
           is an absolutely positioned span floating over its own trigger,
           measured 9.28px from the button and chosen by nobody. */
        if (/absolute|fixed/.test(getComputedStyle(prev).position)) continue
        /* MEASURE TO THE BUTTON, NEVER TO ITS ROW. The 16px lives inside the
           row as padding, so measuring to the row box reads 8 or 12 on correct
           code. That mistake is why this check was a checklist line for a day. */
        const gap = br.top - pr.bottom
        if (gap >= STEP - 0.5) continue
        fail(name(btn), 'this button sits ' + gap.toFixed(2) + 'px below the text that explains it, and the floor is ' + STEP + 'px. A control needs more clearance than the card own rhythm, or it reads as one more line of the paragraph. Put the difference in the action row own padding, so the container gap and the floor have one writer each.')
      }
    }
  })

  /* a-heading-keeps-its-words — A heading keeps every word. A row never crushes it narrower than its own text. */
  await run("a-heading-keeps-its-words", async () => {
    for (const h of all('h1, h2, h3, h4, h5, h6')) {
      const t = textRect(h); if (!t) continue
      const words = (h.textContent || '').trim().split(/\s+/).filter(Boolean).length
      if (!words) continue
      const box = h.getBoundingClientRect()
      if (t.rects > words)
        fail(name(h), (h.textContent || '').trim().slice(0, 24) + ' is set over ' + t.rects + ' lines for ' + words + ' word' + (words === 1 ? '' : 's') + ', so a word broke mid-way. A heading keeps every word and takes the lines it needs. Remove any overflow-wrap that allows a break inside a word.')
      else if (box.width + 1 < t.right - t.left) {
        const par = h.parentElement ? getComputedStyle(h.parentElement).display : ''
        const floor = /grid/.test(par) ? 'A track declared minmax(0, 1fr) has a ZERO floor' : 'A flex child declaring min-width: 0 has a ZERO floor'
        fail(name(h), 'the heading box is ' + round(box.width) + 'px wide around ' + round(t.right - t.left) + 'px of text, so a word is cut. ' + floor + ', so the title collapses rather than letting the row break. Floor the title at max-content and let the row wrap, or move the actions to their own row.')
      }
    }
  })

  console.log('VERIFY  ' + innerWidth + 'x' + innerHeight
    + '  theme=' + (document.documentElement.dataset.theme || 'system')
    + '  pointer=' + (matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine')
    + '  ' + 58 + ' checks')

  /* ── A VERDICT NAMES ITS OWN COVERAGE, AND THE POINTER IS HALF OF IT ──
   *
   * The floor check asks the pointer, never the width, which is right and it
   * means one run measures one floor. A desktop run compares every control
   * against 24px and reports nothing, and that reads as a verdict about the
   * touch case as well.
   *
   * Measured the day this was added, on twelve surfaces that had all passed
   * on a mouse for weeks: 16 controls under the 44px floor at a coarse
   * pointer. An icon-only button 28x44, because a stated width defeated its
   * own aspect ratio. A select 38.26 beside a 44px tab, because a parity calc
   * outweighed the promotion. A nav action 40 beside its own 44px links.
   *
   * So say which half was not measured. In a browser the other half needs
   * device emulation, which the dev tools of every engine can do. */
  const coarseRun = matchMedia('(pointer: coarse)').matches
  console.log('  - UNMEASURED: the ' + (coarseRun ? 'fine' : 'coarse')
    + '-pointer case. Every target floor above was compared against the '
    + (coarseRun ? 'finger' : 'mouse') + ' minimum only. Run this again with '
    + (coarseRun ? 'a mouse' : 'touch emulation on')
    + ' before calling the targets clean.')
  for (const n of notes) console.log('  - ' + n)
  if (!findings.length) { console.log('PASS'); return { pass: true, findings: [] } }

  /* FIX THE CLASS, NOT THE INSTANCE. Five identical nav items produced five
     identical lines, and a wall of repeats is read as noise rather than as one
     fault with five sites. Group on the message and say how many. */
  const groups = []
  for (const f of findings) {
    const key = f.check + '|' + f.msg
    const g = groups.find(g => g.key === key)
    if (g) { g.count++; if (g.count <= 4) g.where.push(f.where) }
    else groups.push({ key, check: f.check, msg: f.msg, count: 1, where: [f.where] })
  }
  const width = Math.max.apply(null, groups.map(g => g.check.length))
  for (const g of groups) {
    const sites = g.count > 1 ? ' [' + g.count + ' sites: ' + g.where.join(', ') + (g.count > 4 ? ', …' : '') + ']' : '  ' + g.where[0]
    console.log('  ' + g.check.padEnd(width) + sites + '  ' + g.msg)
  }
  console.log('')
  console.log('FAIL - ' + groups.length + ' fault' + (groups.length === 1 ? '' : 's')
    + ' across ' + findings.length + ' site' + (findings.length === 1 ? '' : 's'))
  console.log('Fix each one. Do not report it as a limitation of the design system.')
  return { pass: false, findings: findings.slice() }
}

console.log('VERIFY-BROWSER loaded. Run:  await verify()')

})()
