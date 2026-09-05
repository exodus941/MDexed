/* Find a class that styles NOTHING where it sits.
 *
 * This app has two class sets. `preview.css` is scoped to `.dmd` and styles
 * the document being designed. `theme.css` styles the editor around it.
 * Reaching for the wrong one fails SILENTLY: no build error, no console
 * message, and no guard, because every name is real somewhere.
 *
 * ── WHAT IT COST ──
 *
 * A settings section in the chrome reached for `.card`, `.row`,
 * `.card-actions`, `.btn` and `.btn-sm`. All five are preview classes. Two
 * buttons carrying one class then measured 19px and 49px, because each was
 * sized by its own words. The source read as though the work was done.
 *
 * Earlier, a modal used `.row`, `.swatch` and `.figure`, and four swatches
 * rendered 2x20 instead of 36x36.
 *
 * ── WHY THIS RUNS IN THE BROWSER AND NOT AT BUILD TIME ──
 *
 * The question is not "does this file mention a preview class". A panel may
 * legitimately render a document sample inside its own `.dmd` root, and then
 * every preview class in it is correct. Answering that from source needs to
 * know JSX nesting, and the first attempt reported 49 findings of which 46
 * were correct code — a check that fires on correct code costs more than the
 * miss it prevents.
 *
 * The DOM knows exactly. For each element it asks the only question that
 * matters: does any rule in any stylesheet, whose selector names this class,
 * match this element? That reads the PROPERTY rather than a name list, so a
 * class added tomorrow is covered with no edit here.
 *
 *   const s = await (await fetch('/dead-class.js')).text(); await new Function(s)()
 */

;(async () => {
  /* Every rule, flattened out of any at-rule wrapper. A rule inside a media
     query still styles the element; whether the query matches today is a
     different question and not this one. */
  const rules = []
  const collect = list => {
    for (const r of list) {
      if (r.cssRules) collect(r.cssRules)
      else if (r.selectorText) rules.push(r.selectorText)
    }
  }
  for (const sheet of document.styleSheets) {
    try { collect(sheet.cssRules) } catch { /* cross-origin, skip */ }
  }

  /* Selector fragments that name a given class, split on commas so one rule
     with five selectors is five candidates. */
  const byClass = new Map()
  for (const sel of rules) {
    for (const part of sel.split(',')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      for (const m of trimmed.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        if (!byClass.has(m[1])) byClass.set(m[1], [])
        byClass.get(m[1]).push(trimmed)
      }
    }
  }

  const findings = []
  const seen = new Set()
  for (const el of document.querySelectorAll('[class]')) {
    const cls = el.getAttribute('class')
    if (!cls) continue
    for (const name of cls.split(/\s+/).filter(Boolean)) {
      const candidates = byClass.get(name)
      /* A class no stylesheet mentions at all is a HOOK: a test id, a
         behaviour marker, something a script queries. Not this check's
         business, and reporting them buries the real findings. */
      if (!candidates) continue
      let matched = false
      for (const sel of candidates) {
        try { if (el.matches(sel)) { matched = true; break } } catch { /* :has etc */ }
      }
      if (matched) continue
      /* Report the CLASS once per context, not once per element. Fifteen list
         items carrying one dead class are one fault. */
      const where = el.closest('.dmd') ? 'preview' : 'chrome'
      const key = name + '|' + where + '|' + el.tagName
      if (seen.has(key)) continue
      seen.add(key)
      findings.push({
        class: name,
        where,
        on: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
        beside: (cls.split(/\s+/).filter(c => c !== name).join(' ') || '(none)'),
        text: (el.textContent || '').trim().slice(0, 28),
      })
    }
  }

  const scanned = document.querySelectorAll('[class]').length
  if (!scanned) {
    console.error('dead-class: nothing carried a class. Nothing was checked.')
    return
  }
  console.log(`dead-class: ${scanned} elements, ${rules.length} rules, ${findings.length} finding(s)`)
  if (findings.length) console.table(findings)
  window.__DEAD_CLASS = findings
  return findings
})()
