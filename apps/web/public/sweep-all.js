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
  new Function(src + '\nwindow.sweep=sweep;window.probe=probe;window.align=align')()

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
  const rows = []

  for (const name of SURFACES) {
    const tab = chrome().filter(e => e.textContent.trim() === name)[0]
    if (!tab) { rows.push({ surface: name, note: 'TAB NOT FOUND' }); continue }
    tab.click()
    await pause(60)                     // let React commit before asking what is animating

    const frame = [...document.querySelectorAll('.dmd')].filter(d => d.closest('.dmd-frame'))[0]
    const box = frame?.getBoundingClientRect()
    if (!frame || !box.height || !box.width) {
      rows.push({ surface: name, note: 'NOT VISIBLE — 0x0, nothing measured' })
      continue
    }

    /* Measure only once it has stopped moving. Report a surface that never
       settles rather than measuring it anyway — an unsettled reading looks
       exactly like a real fault and wastes the reader's afternoon. */
    const still = await settle(frame)
    if (!still) rows.push({ surface: name, note: 'STILL MOVING — reading may be a frame, not a layout' })

    /* The frame's own element, not the selector. `sweep('.dmd')` took the
       first of four `.dmd` nodes — the preview plus three component samples —
       so every run here had been measuring a surface nobody was looking at. */
    const r = sweep(frame)
    rows.push({
      surface: name,
      clean: r.clean,
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
      detail: r.clean ? null : Object.fromEntries(
        Object.entries(r)
          .filter(([, v]) => Array.isArray(v) && v.length)
          .map(([k, v]) => [k, v.slice(0, 3)])),
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

  const dirty = rows.filter(x => x.clean === false)
  console.table(rows.map(({ detail, ...rest }) => rest))
  return {
    surfacesSwept: rows.filter(x => x.clean != null).length,
    ofExpected: SURFACES.length,
    allClean: dirty.length === 0,
    dirty: dirty.map(d => ({ surface: d.surface, ...d.detail })),
    notices: rows.filter(x => x.notices?.length)
      .map(x => x.surface + ': ' + x.notices.join('; ')),
    skipped: rows.filter(x => x.note).map(x => x.surface + ': ' + x.note),
  }
})()
