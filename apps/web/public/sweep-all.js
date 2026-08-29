/* Sweep EVERY preview surface, in one call.
 *
 * Why this file exists: I kept sweeping the surface I was working on, or worse,
 * hand-writing a probe for the property I was already thinking about. Each time
 * the screen had faults outside what I thought to ask, and each time the user
 * found them in a screenshot.
 *
 * The toolkit was never the problem. Remembering to point it at everything was.
 * So this is one paste with nothing to compose and nothing to leave out.
 *
 *   const s = await (await fetch('/sweep-all.js')).text(); await new Function(s)()
 *
 * It clicks through every surface tab, sweeps each, and prints one table. Read
 * every row. A surface missing from the table is a surface nobody checked.
 */
return (async () => {
  const src = await (await fetch('/layout-tools.js?v=' + Date.now())).text()
  /* `inkband` has to be exported here too, or this run finds whatever a previous
     manual load happened to leave on `window`. On a freshly reloaded page it
     found nothing and the whole sweep died with "inkband is not defined". A tool
     that works only after you have used it by hand is not wired up. */
  new Function(src + '\nwindow.sweep=sweep;window.probe=probe;window.align=align;window.inkband=inkband')()
  if (typeof window.inkband !== 'function') throw new Error('layout-tools loaded without inkband')

  const chrome = () => [...document.querySelectorAll('button')].filter(e => !e.closest('.dmd'))
  const pause = ms => new Promise(r => setTimeout(r, ms))

  /* ── Wait for the surface to STOP MOVING ──
     A fixed pause is a guess, and a guess that is 50ms short measures a frame
     of the entrance animation. That produced two findings in one session which
     both vanished on the next pass: a row 1px out of alignment, and an icon
     reported covered by a button that was not over it by the time anyone
     looked. A moving target is not a defect, and reporting it as one trains
     the reader to ignore the table.

     So ask the browser instead of counting milliseconds. `getAnimations()`
     names every running animation and transition, and its `finished` promise
     settles when the element has come to rest. The rect check afterwards
     catches anything driven by script rather than by CSS. */
  const settle = async (root, tries = 40) => {
    /* An INFINITE animation never finishes, so its `finished` promise never
       settles and a bare `Promise.all` waits for ever. A spinner is enough to
       hang the whole eleven-surface run — measured, it stopped completing
       inside thirty seconds while a single `sweep()` took 168ms.

       So drop the looping ones, which have no rest position to wait for, and
       race what is left against a deadline. Asking the browser is right;
       trusting it to answer is not. */
    const anims = (root.ownerDocument.getAnimations?.() ?? [])
      .filter(a => a.effect?.target && root.contains(a.effect.target))
      .filter(a => (a.effect.getComputedTiming?.().iterations ?? 1) !== Infinity)
    const wait = ms => new Promise(r => setTimeout(r, ms))
    await Promise.race([Promise.all(anims.map(a => a.finished.catch(() => {}))), wait(1200)])

    /* Start the stability clock AFTER the animation wait, never before. Set
       first, a 1200ms animation race left the poll about 300ms, so five
       surfaces reported STILL MOVING while an idle page settles in 32ms. A
       deadline that includes the wait it follows is not a deadline. */
    const stop = Date.now() + 1500

    /* Poll on a TIMER, never on `requestAnimationFrame`. A background tab does
       not run animation frames at all, so an rAF loop simply never resolves —
       and this run hung for thirty seconds against a `sweep()` that takes 168
       milliseconds. A timer is throttled in the background; it still fires.
       Every wait is bounded by one wall-clock deadline, so no arrangement of
       animations can stall the run. */
    let last = ''
    while (Date.now() < stop) {
      await wait(32)
      const now = [...root.querySelectorAll('*')].slice(0, 60)
        .map(e => { const r = e.getBoundingClientRect(); return `${r.top.toFixed(1)},${r.left.toFixed(1)}` }).join('|')
      if (now === last) return true
      last = now
    }
    return false
  }

  /* The preview pane has to be showing, or every surface measures 0x0 and the
     whole run reports clean. That has happened, and it looked like a pass. */
  chrome().filter(e => /^PREVIEW/.test(e.textContent.trim()))[0]?.click()
  await pause(250)

  const SURFACES = ['Dashboard', 'Record', 'Index', 'Shell', 'Landing', 'Pricing', 'Form', 'Settings', 'Empty', 'Overlays', 'Gallery']

  /* ── THE RUN OWNS THE WIDTH. THE READER DOES NOT. ──
   *
   * This file swept whatever width the preview happened to be set to, and said
   * nothing about which one that was. Every "11 of 11 clean" it ever printed
   * meant eleven surfaces at ONE width, chosen by accident.
   *
   * It cost a real finding. A batch bar on Index puts 12px between its two
   * groups and 8px inside one of them, a 1.5:1 ratio where the rule wants 3:1.
   * It exists between 360px and 600px and nowhere else: below that the groups
   * wrap onto separate lines, above it the ratio clears. Every earlier run was
   * on "Fit" or 296. 296 is outside the band, and "Fit" is not a width at all
   * — it is whatever the browser window happens to be. So the finding did not
   * appear because the code changed. It appeared because the window did.
   *
   * Two consequences, both handled below. The run drives the width control
   * itself, over every value the document declares. And it never reports "Fit"
   * as a width, because nobody chose it.
   *
   * The declared list comes from the control rather than from a constant here,
   * so a document that adds a breakpoint gets swept at it without this file
   * being edited. */
  const widthSelect = [...document.querySelectorAll('select')]
    .filter(s => !s.closest('.dmd'))
    .find(s => [...s.options].some(o => /\d+px/.test(o.textContent)))
  /* ── A SELECT CANNOT HOLD A VALUE IT HAS NO OPTION FOR ──
   *
   * The first version of the midpoint sweep set `value = '480'` and dispatched
   * change. A `<select>` silently refuses a value with no matching option, so
   * `value` became '' — which is "Fit" — and the frame went to whatever the
   * window happened to give. Every midpoint measured 429px, one accidental
   * width, and 429 happens to sit inside the band this failsafe was written to
   * catch. So it reported the right finding six times for entirely the wrong
   * reason, and would have reported nothing on a different window.
   *
   * Inject the value as a real option, select it, fire change, drop the option.
   * React reads `e.target.value`, stores the number, and the frame follows.
   * Verified: asking for 308, 480, 704 and 896 gives frames of exactly those. */
  const setWidth = v => {
    let temp = null
    if (![...widthSelect.options].some(o => o.value === String(v))) {
      temp = document.createElement('option')
      temp.value = String(v)
      temp.textContent = v + 'px'
      widthSelect.appendChild(temp)
    }
    const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    set.call(widthSelect, String(v))
    widthSelect.dispatchEvent(new Event('change', { bubbles: true }))
    return temp
  }
  /* ── THE DECLARED WIDTHS ARE NOT ENOUGH, AND THAT IS THE POINT ──
   *
   * Sweeping every breakpoint the document declares STILL missed the batch bar.
   * Its band is 360 to 600, and the declared list runs 296, 320, 640, 768,
   * 1024, 1280, 1536. Not one value falls inside it. Seventy-seven sweeps came
   * back clean over a fault that had been on screen the whole time.
   *
   * A breakpoint is where the layout CHANGES. The arrangement BETWEEN two of
   * them is the one nobody declared, nobody chose and nobody has looked at, so
   * that is where a fault survives. "Test the bands, not the corners" was
   * already written down; this is the tool doing it instead of me remembering.
   *
   * So: every declared width, plus the midpoint of each adjacent pair. 320 and
   * 640 give 480, which is inside the band and catches it. The midpoints are
   * labelled `mid` so a finding at one is legible as "between two breakpoints"
   * rather than as a width somebody chose.
   *
   * The empty-valued option is "Fit" and stays excluded: a width nobody chose
   * cannot be part of a coverage claim. */
  const declared = widthSelect
    ? [...widthSelect.options].filter(o => o.value)
      .map(o => ({ px: Number(o.value), label: o.textContent.trim() }))
      .sort((a, b) => a.px - b.px)
    : []
  const WIDTHS = declared.flatMap((w, i) => {
    const next = declared[i + 1]
    if (!next) return [w]
    const mid = Math.round((w.px + next.px) / 2)
    /* Skip a midpoint that lands on a declared value, which happens when two
       breakpoints are one or two pixels apart. */
    return mid === w.px || mid === next.px ? [w] : [w, { px: mid, label: `mid ${mid}px`, mid: true }]
  })
  const keptWidth = widthSelect ? widthSelect.value : null

  const rows = []
  /* The surface id measured on the previous pass. A frame still drawing it is a
     frame that has not finished cross-fading, and measuring it labels every
     finding one surface out of place. */
  let lastDrawn = null

  /* If the control is missing the run still works, at one width, and SAYS SO.
     Silence here would put the file back where it started. */
  if (!WIDTHS.length) rows.push({
    surface: '(width control)',
    note: 'NOT FOUND — swept at one unknown width. Coverage across widths is unverified.',
  })

  for (const width of (WIDTHS.length ? WIDTHS : [null])) {
    let temp = null
    if (width) { temp = setWidth(width.px); await pause(320); lastDrawn = null }

  const at = width ? width.label : '(unknown width)'

  /* ── ASSERT THE WIDTH LANDED, BEFORE MEASURING ANYTHING AT IT ──
   *
   * The reason this exists is the bug above: a width that failed to apply left
   * the frame somewhere else entirely, and eleven surfaces were then swept and
   * attributed to a width they were never at. A run that cannot set the width
   * it claims must say so, not measure and label. */
  if (width) {
    const probe = [...document.querySelectorAll('.dmd-frame')]
      .find(f => !f.closest('.xfade-out') && !f.closest('[aria-hidden="true"]') && f.getBoundingClientRect().width > 0)
    const got = probe ? Math.round(probe.getBoundingClientRect().width) : null
    if (got !== width.px) {
      rows.push({ at, surface: '(all)', note: `WIDTH NOT APPLIED — asked ${width.px}px, frame is ${got}px. Nothing measured at this width.` })
      temp?.remove()
      continue
    }
  }

  for (const name of SURFACES) {
    const tab = chrome().filter(e => e.textContent.trim() === name)[0]
    if (!tab) { rows.push({ at, surface: name, note: 'TAB NOT FOUND' }); continue }
    tab.click()
    await pause(60)                     // let React commit before asking what is animating

    /* ── MEASURE THE INCOMING SURFACE, NEVER THE OUTGOING ONE ──
     *
     * A tab switch cross-dissolves, and a dissolve needs BOTH trees on screen
     * at once. The outgoing layer is pushed into the DOM first, so
     * `querySelectorAll('.dmd')[0]` is the surface that is leaving. The pause
     * above is 60ms and the fade is `--t`, 125ms by default, so this run landed
     * inside the fade every single time.
     *
     * The consequence was not a missed finding, which would at least look like
     * a gap. It was every finding attributed to the WRONG SURFACE, one place
     * out. A `shell-split` fault was reported against Landing; sweeping Landing
     * by hand came back clean, correctly, because the fault is Shell's. Two
     * investigations went into that, and it produced a confident report that
     * the findings did not reproduce.
     *
     * The outgoing layer says what it is — `.xfade-out`, `aria-hidden`,
     * `pointer-events: none` — so this reads the DECLARATION rather than
     * guessing from geometry or waiting longer and hoping. */
    const candidates = [...document.querySelectorAll('.dmd')]
      .filter(d => d.closest('.dmd-frame'))
      .filter(d => !d.closest('.xfade-out'))
      .filter(d => !d.closest('[aria-hidden="true"]'))
    /* A selector that matches more than one element is not a root. If two
       survive the filter, say so rather than taking the first and reporting a
       surface nobody was looking at. */
    if (candidates.length > 1) {
      rows.push({ at, surface: name, note: `AMBIGUOUS — ${candidates.length} live frames, nothing measured` })
      continue
    }
    const frame = candidates[0]
    const box = frame?.getBoundingClientRect()
    if (!frame || !box.height || !box.width) {
      rows.push({ at, surface: name, note: 'NOT VISIBLE — 0x0, nothing measured' })
      continue
    }
    /* ASSERT the attribution rather than trusting it, and assert the thing that
       actually goes wrong.
     *
     * The first version compared the frame's id against this list's label,
     * folding case, on the assumption that the two differ by nothing else. They
     * do: the tab reads "Overlays" and the surface id is `dialog`. So a correct
     * surface was reported `WRONG FRAME` and skipped — and a skipped surface
     * reads exactly like a clean one, which is the failure this whole file was
     * written to stop.
     *
     * The staleness is what matters, and staleness has a precise shape: the
     * frame is still drawing the surface we measured LAST time. That needs no
     * mapping between labels and ids, and it names the real fault. The drawn id
     * is reported either way, so the attribution is visible rather than
     * trusted. */
    const drawn = frame.closest('.dmd-frame')?.dataset.surface
    if (drawn && drawn === lastDrawn) {
      rows.push({ at, surface: name, note: `STALE FRAME — still drawing "${drawn}", nothing measured` })
      continue
    }
    if (drawn) lastDrawn = drawn

    /* Measure only once it has stopped moving. Report a surface that never
       settles rather than measuring it anyway — an unsettled reading looks
       exactly like a real fault and wastes the reader's afternoon. */
    const still = await settle(frame)
    if (!still) rows.push({ at, surface: name, note: 'STILL MOVING — reading may be a frame, not a layout' })

    /* The frame's own element, not the selector. `sweep('.dmd')` took the
       first of four `.dmd` nodes — the preview plus three component samples —
       so every run here had been measuring a surface nobody was looking at. */
    const r = sweep(frame)
    /* The cap-band check rasterises, so it is async and cannot live inside
       the synchronous sweep. Run it here and fold its findings in, or a
       surface with an oversized icon reports clean. */
    const cb = await window.inkband(frame)
    const cbN = (cb.findings || []).length
    rows.push({
      at,
      surface: name,
      clean: r.clean && cbN === 0,
      inkband: cbN,
      baselines: r.baselines.length,
      heights: r.heights.length,
      ghosts: r.ghosts.length,
      covered: r.covered.length,
      spill: r.contentSpill.length,
      overflow: r.overflow.length,
      scrollers: r.scrollers.length,
      targets: r.smallTargets.length,
      icons: r.iconOffCentre.length,
      text: r.textOffCentre.length,
      edges: r.edges.length,
      gaps: r.gaps.length,
      /* Every non-empty field, named. The old version listed four of them by
         hand, so a surface with only an `edges` finding reported as dirty with
         an empty body — a verdict I could not act on and nearly skipped. What
         the sweep found is the sweep's answer, not a list I curate here. */
      /* NO SILENT CAP. This sliced each category to three and said nothing, so
         a surface with four findings reported three and read as complete. I hit
         it on the Index pager: three findings existed, two reached the summary,
         and I spent a round trip deciding the third check was broken. A bound on
         coverage has to announce itself, or the report claims a completeness it
         does not have. */
      inkbandDetail: cbN ? cb.findings.map(x => x.el + " -> " + x.finding) : null,
      detail: r.clean ? null : Object.fromEntries(
        Object.entries(r)
          .filter(([, v]) => Array.isArray(v) && v.length)
          .map(([k, v]) => [k, v.length > 3
            ? [...v.slice(0, 3), `+ ${v.length - 3} more ${k} not listed`]
            : v])),
      /* Notices, which `clean` excludes on purpose: a sideways scroller, an
         uneven gap, a small target. Each is a question rather than a fault, so
         it must not fail the run — and it must not vanish either. Returned for
         every surface, clean ones included, because the old version attached
         detail only to dirty rows and a notice on a clean surface was
         invisible to anything reading the value. */
      notices: [
        ...r.scrollers.map(x => 'scroller ' + x.axis + ' on ' + x.el),
        ...r.gaps.map(x => 'gaps ' + JSON.stringify(x).slice(0, 90)),
        ...r.smallTargets.map(x => 'small target ' + JSON.stringify(x).slice(0, 90)),
      ],
    })
  }
    temp?.remove()
  }

  /* Put the control back where it was found. A tool that leaves the app on the
     last width it happened to try makes the NEXT reading depend on this one. */
  if (keptWidth !== null) { setWidth(keptWidth); await pause(200) }

  const dirty = rows.filter(x => x.clean === false)
  console.table(rows.map(({ detail, ...rest }) => rest))

  /* ── THE VERDICT NAMES ITS OWN COVERAGE ──
   *
   * `allClean` on its own is a claim about the widths that were swept, and the
   * old version never said what those were. So it reads as a claim about the
   * layout. `widthsSwept` and `coverage` are returned beside it, and a run that
   * covered one width says so in the same breath as saying it was clean. */
  const swept = [...new Set(rows.filter(x => x.clean != null).map(x => x.at))]
  return {
    widthsSwept: swept,
    coverage: `${SURFACES.length} surfaces x ${swept.length} width(s)`
      + (WIDTHS.length ? '' : ' — WIDTH CONTROL NOT FOUND, coverage unverified'),
    surfacesSwept: rows.filter(x => x.clean != null).length,
    ofExpected: SURFACES.length * (WIDTHS.length || 1),
    allClean: dirty.length === 0,
    /* Findings carry the width they were found at. A ratio that only breaks
       between 360 and 600 is a different piece of work from one that breaks
       everywhere, and the old shape could not tell them apart. */
    /* THE CAP-BAND FINDINGS BELONG IN THE BODY TOO. `detail` is keyed on the
       SWEEP’s verdict, and the cap-band check is a second, asynchronous one.
       A surface the sweep called clean and the cap-band called dirty came out
       as a dirty row with a null body: 89 of them, each unactionable, and the
       run read as 89 unexplained failures. Spread both. */
    dirty: dirty.map(d => ({ at: d.at, surface: d.surface, ...d.detail,
      ...(d.inkbandDetail ? { inkband: d.inkbandDetail } : {}) })),
    notices: rows.filter(x => x.notices?.length)
      .map(x => x.at + ' ' + x.surface + ': ' + x.notices.join('; ')),
    skipped: rows.filter(x => x.note).map(x => (x.at ? x.at + ' ' : '') + x.surface + ': ' + x.note),
  }
})()
