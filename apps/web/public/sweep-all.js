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

  /* The preview pane has to be showing, or every surface measures 0x0 and the
     whole run reports clean. That has happened, and it looked like a pass. */
  chrome().filter(e => /^PREVIEW/.test(e.textContent.trim()))[0]?.click()
  await pause(250)

  const SURFACES = ['Dashboard', 'Shell', 'Landing', 'Form', 'Settings', 'Overlays', 'Gallery']
  const rows = []

  for (const name of SURFACES) {
    const tab = chrome().filter(e => e.textContent.trim() === name)[0]
    if (!tab) { rows.push({ surface: name, note: 'TAB NOT FOUND' }); continue }
    tab.click()
    await pause(450)

    const frame = [...document.querySelectorAll('.dmd')].filter(d => d.closest('.dmd-frame'))[0]
    const box = frame?.getBoundingClientRect()
    if (!frame || !box.height || !box.width) {
      rows.push({ surface: name, note: 'NOT VISIBLE — 0x0, nothing measured' })
      continue
    }

    const r = sweep('.dmd')
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
      detail: r.clean ? null : {
        baselines: r.baselines.slice(0, 3),
        heights: r.heights.slice(0, 3),
        other: [...r.ghosts, ...r.covered, ...r.contentSpill, ...r.overflow].slice(0, 3),
      },
    })
  }

  const dirty = rows.filter(x => x.clean === false)
  console.table(rows.map(({ detail, ...rest }) => rest))
  return {
    surfacesSwept: rows.filter(x => x.clean != null).length,
    ofExpected: SURFACES.length,
    allClean: dirty.length === 0,
    dirty: dirty.map(d => ({ surface: d.surface, ...d.detail })),
    skipped: rows.filter(x => x.note).map(x => x.surface + ': ' + x.note),
  }
})()
