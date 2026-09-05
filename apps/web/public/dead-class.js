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
  /* ── READ THE TEXT, NOT ONLY THE CSSOM ──
   *
   * The first version asked `document.styleSheets` for `cssRules` and nothing
   * else. Measured in the dev server: five sheets, THREE throwing on access
   * and two returning nothing, for a total of 0 rules. The tool then reported
   * zero findings, which reads exactly like a clean page, and an injected
   * fault carrying five preview classes came back clean.
   *
   * So the rules are gathered from the text as well: every inline <style>, and
   * every same-origin <link> fetched. The CSSOM is kept as one more source
   * rather than the only one. */
  const rules = []
  const collect = list => {
    for (const r of list) {
      if (r.cssRules) collect(r.cssRules)
      else if (r.selectorText) rules.push(r.selectorText)
    }
  }
  for (const sheet of document.styleSheets) {
    try { collect(sheet.cssRules) } catch { /* cross-origin, read below */ }
  }

  const fromText = css => {
    /* Blank comments rather than deleting them, so nothing joins across one. */
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    for (const m of bare.matchAll(/(^|[}])([^{}]*)\{/g)) {
      const sel = m[2].trim()
      if (!sel || sel.startsWith('@')) continue
      rules.push(sel)
    }
  }
  for (const el of document.querySelectorAll('style')) fromText(el.textContent || '')
  const links = [...document.querySelectorAll('link[rel="stylesheet"][href]')]
    .map(l => l.href)
    .filter(h => { try { return new URL(h).origin === location.origin } catch { return false } })
  for (const href of links) {
    try { fromText(await (await fetch(href)).text()) } catch { /* unreachable, skip */ }
  }

  /* A RUN THAT READ NOTHING IS NOT A PASS, and has to say so. */
  if (!rules.length) {
    console.error('dead-class: 0 rules readable. Nothing was checked, and this is NOT a clean result.')
    return
  }

  /* ── ONLY THE SUBJECT COUNTS ──
   *
   * The first version indexed a selector under every class it mentioned, and
   * called four correct classes dead:
   *
   *   .form-stack > select        styles its CHILDREN, which is its whole job
   *   .seed-lock:hover > span     the same, on hover
   *   header button:not(:has(.keep-lbl))   a MARKER, read and never painted
   *
   * In each of those the class sits to the LEFT of the subject, so the element
   * carrying it correctly does not match, and reporting that faults code that
   * works. The subject of a selector is its last compound: the part after the
   * final combinator at paren depth zero. And a class named inside `:not()` or
   * `:has()` is being tested, never styled.
   */
  const subjectOf = sel => {
    let depth = 0, cut = 0
    for (let i = 0; i < sel.length; i++) {
      const ch = sel[i]
      if (ch === '(' || ch === '[') depth++
      else if (ch === ')' || ch === ']') depth--
      else if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) cut = i + 1
    }
    return sel.slice(cut)
  }
  /* Blank what is inside a functional pseudo-class, so a class only tested
     there is not read as styled. Repeated, because they nest. */
  const stripTests = s => {
    let out = s, prev
    do { prev = out; out = out.replace(/:(?:not|has|is|where)\(([^()]*)\)/g, (m, inner) => ':x(' + inner.replace(/[^\s,]/g, '.') + ')') } while (out !== prev)
    return out
  }

  const byClass = new Map()
  for (const sel of rules) {
    for (const part of sel.split(',')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const subject = stripTests(subjectOf(trimmed))
      for (const m of subject.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
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
