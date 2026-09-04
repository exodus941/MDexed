/* ── ONE RULE LIST, THREE CONSUMERS ──
 *
 * A rule stated in prose and checked by nothing does not land. Four faults in
 * one simulated build proved it: three of them had a precise rule in DESIGN.md
 * and no line in the contract's checklist, so the builder read past them.
 *
 *   the table's first cell sat 8px inside the card's own margin  (DESIGN.md)
 *   the alert's action sat 9px off the message's baseline        (DESIGN.md)
 *   the toggle carried no `aria-pressed` and a bare label        (DESIGN.md)
 *
 * So the checklist and the shipped verifiers now come from this one array.
 * `agents.js` renders `line`. `verify.js` renders `body` into whichever file
 * the `where` names. A rule added here appears in all three, and a rule cannot
 * be worded one way in the contract and coded another way in the tool.
 *
 * ── WHY THE BODIES ARE STRINGS ──
 *
 * The obvious version keeps them as functions and calls `.toString()`. The
 * payload is built in the browser from a minified bundle, so that emits
 * mangled one-liners into a file whose whole purpose is to be read and
 * trusted. Lines of source survive the build byte for byte.
 *
 * NO BACKTICK MAY APPEAR IN A BODY. These lines are joined into a template
 * literal in `verify.js`; one backtick there ends the string and the rest of
 * the file parses as expressions. That is the trap this project keeps hitting,
 * and `no-backtick-in-a-body` below is asserted by the test suite.
 */

/* `where`:
 *   source — runs in Node over the files the agent wrote
 *   render — runs in the browser over the page the agent built
 *   manual — no machine can answer it; it stays a line in the checklist
 */

export const CHECKS = [

  /* ══ SOURCE ═══════════════════════════════════════════════════════════ */

  {
    id: 'literal-colour',
    where: 'source',
    line: 'No literal colour appears anywhere.',
    body: [
      "const RE = /#[0-9a-fA-F]{3,8}\\b|\\brgba?\\(|\\bhsla?\\(|\\boklch\\(/",
      "for (const f of files) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    /* A line DECLARING a custom property is the token itself. That is the",
      "       one place a hex belongs, and a page that inlines its tokens holds a",
      "       thousand of them. Faulting those buries every real finding. */",
      "    if (/^\\s*--[\\w-]+\\s*:/.test(line)) continue",
      "    const hit = line.match(RE)",
      "    if (hit) fail(f.path, i + 1, 'literal colour ' + hit[0] + '. Use a token.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'off-scale-number',
    where: 'source',
    line: 'No number appears where a scale token exists. A measured length goes in a custom property, on the space grid.',
    /* ── A MEASURED THRESHOLD IS NOT A TOKEN, AND CANNOT BE ──
     *
     * Layout tells the builder to derive a threshold by shrinking the real row,
     * and to floor a split at the table's own min-content. Those numbers come
     * out of a measurement, so no token can hold them. A build that obeyed got
     * faulted for the one it had just been told to compute: `minmax(660px, 3fr)`
     * on a grid whose table needs 660.
     *
     * A media or container condition was already skipped, which is why the
     * thresholds passed and the grid floor did not.
     *
     * The document's own answer is the fix: give the value a name of your own.
     * So a CUSTOM PROPERTY DECLARATION is where a measured length lives, and
     * it still has to sit on the published space grid — multiples of 4, or of
     * 2 below 8, plus 1 for a hairline. 660 passes. A 13px invented at the
     * moment of the problem does not, whatever it is called. */
    body: [
      "const SKIP = /@media|@container|@supports|viewBox|stroke-width|aspect-ratio|z-index|flex|opacity|line-height:\\s*[\\d.]+\\s*;/",
      "const onGrid = n => n === 1 || (n < 8 ? n % 2 === 0 : n % 4 === 0)",
      "for (const f of files.filter(f => f.css)) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    if (SKIP.test(line)) continue",
      "    const hit = line.match(/(?<![\\w.-])(?!0px|1px)\\d+(\\.\\d+)?(px|rem)\\b/)",
      "    if (!hit) continue",
      "    const own = /^\\s*--[\\w-]+\\s*:/.test(line)",
      "    const n = parseFloat(hit[0])",
      "    if (own && hit[0].endsWith('px') && Number.isInteger(n) && onGrid(n)) continue",
      "    if (own) fail(f.path, i + 1, hit[0] + ' is off the space grid, so naming it does not make it a decision. Multiples of 4, or of 2 below 8.')",
      "    else fail(f.path, i + 1, hit[0] + ' is not a token. Every length has a name. A measured length goes in a custom property your own source declares.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'unknown-token',
    where: 'source',
    line: 'Every name you read with `var()` is a published token or one your own source declares.',
    /* ── IT FAULTED THE DOCUMENT'S OWN INSTRUCTION ──
     *
     * Layout tells the builder that a value which changes at a breakpoint
     * belongs in a custom property rather than in a constant, because a media
     * query can reach a property and cannot reach a compiled value. A build
     * that obeyed that got three findings for the two names it had just been
     * told to create.
     *
     * The `--local-` prefix was the escape hatch and NOTHING IN THE PAYLOAD
     * SAYS SO. A convention that lives only in a checker's source is a rule
     * the reader cannot follow. Read the DECLARATIONS instead: a typo is
     * declared nowhere, so it still fails, and no convention has to be
     * remembered. The prefix keeps working for anyone already using it. */
    body: [
      "for (const f of files) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    for (const m of line.matchAll(/var\\(\\s*(--[\\w-]+)/g)) {",
      "      if (!tokens.has(m[1]) && !declared.has(m[1]) && !m[1].startsWith('--local-'))",
      "        fail(f.path, i + 1, m[1] + ' is in no token file and your source never declares it. A fallback would have hidden this.')",
      "    }",
      "  }",
      "}",
    ],
  },

  {
    id: 'fallback-hides-a-token',
    where: 'source',
    line: 'No `var()` carries a fallback. A fallback paints a value nobody chose.',
    body: [
      "for (const f of files) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    const m = line.match(/var\\(\\s*--[\\w-]+\\s*,/)",
      "    if (m) fail(f.path, i + 1, 'a var() fallback. It hides a missing token and paints a value from no palette.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'hardcoded-theme',
    where: 'source',
    line: 'No `data-theme` sits on `<html>` in the source. Absence is the follow-the-system state.',
    body: [
      "for (const f of files.filter(f => f.html)) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    if (/<html[^>]*\\sdata-theme\\s*=/i.test(line))",
      "      fail(f.path, i + 1, 'data-theme is hardcoded on <html>. With the attribute absent the operating system decides, and a page whose script fails still opens in the right theme.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'toggle-states-itself',
    where: 'source',
    line: 'The theme control says which theme is on: `aria-pressed` on a button, or a checkbox, and a label naming the current theme and the next.',
    /* A NATIVE CHECKBOX ALREADY STATES ITS STATE, and demanding `aria-pressed`
       of one is wrong. This asked for the attribute and nothing else, so it
       failed a build whose control was a checkbox driving a CSS-only switch,
       which is the more robust of the two shapes. Ask the QUESTION: can a
       reader who cannot see the mark tell which theme is on? */
    body: [
      "for (const f of files.filter(f => f.html)) {",
      "  if (!/data-theme|dmd-dark/.test(f.text)) continue",
      "  const saysPressed = /aria-pressed/.test(f.text)",
      "  const isCheckbox = /<input[^>]+type=[\"']checkbox[\"'][^>]*>/i.test(f.text)",
      "  if (saysPressed || isCheckbox) continue",
      "  fail(f.path, 0, 'a theme control that never says which theme is on. Give a button aria-pressed, or make the control a checkbox, which states it natively.')",
      "}",
    ],
  },

  {
    id: 'icon-only-is-named',
    where: 'source',
    line: 'Every control with a mark and no words carries an `aria-label`.',
    body: [
      "for (const f of files.filter(f => f.html)) {",
      "  for (const m of f.text.matchAll(/<button\\b([^>]*)>([\\s\\S]*?)<\\/button>/gi)) {",
      "    const words = m[2].replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()",
      "    if (words) continue",
      "    if (!/aria-label|aria-labelledby/.test(m[1]))",
      "      fail(f.path, lineOf(f, m.index), 'an icon-only button with no accessible name.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'named-font-only',
    where: 'source',
    line: 'Every `font-family` resolves to a token. The system names every family it uses.',
    body: [
      "for (const f of files.filter(f => f.css)) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    if (/font-family\\s*:/.test(line) && !/var\\(/.test(line) && !/inherit|initial|unset/.test(line))",
      "      fail(f.path, i + 1, 'a font-family that names no token.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'align-content-needs-a-line-to-align',
    where: 'source',
    line: 'align-content does nothing on a flex row that cannot wrap. Give it wrap, or centre the items.',
    /* ── A DECLARATION THAT LOOKS LIKE THE FIX AND DOES NOTHING ──
     *
     * `align-content` positions flex LINES, and a container with the default
     * `nowrap` has one line that always fills the container. So the property
     * is ignored, silently, and the items stay packed where `align-items`
     * put them.
     *
     * Measured on a generated dashboard: a nav item held the 44px touch floor
     * with `align-items: baseline` and `align-content: center`. Its label sat
     * 13.08px from the top against 13.92 from the bottom only AFTER wrap was
     * added; before it, the content was packed to the top of a 44px box and
     * read as a tall selection with its contents in a corner. That is the
     * exact fault a reader reports as "the nav items are broken".
     *
     * A grid is exempt: `align-content` is meaningful there with no wrap. */
    body: [
      "for (const f of files.filter(f => /\\.css$/.test(f.path))) {",
      "  const rules = f.bare.split('}')",
      "  let at = 1",
      "  for (const r of rules) {",
      "    const line = at; at += (r.match(/\\n/g) || []).length",
      "    if (!/align-content\\s*:/.test(r)) continue",
      "    if (/display\\s*:\\s*(inline-)?grid/.test(r)) continue",
      "    if (!/display\\s*:\\s*(inline-)?flex/.test(r)) continue",
      "    if (/flex-wrap\\s*:\\s*wrap/.test(r) || /flex-flow\\s*:[^;]*wrap/.test(r)) continue",
      "    fail(f.path, line, 'align-content on a flex container that cannot wrap. One line always fills its container, so this is ignored and the items stay where align-items put them. Add flex-wrap: wrap, or centre the items instead.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-container-query-cannot-style-its-container',
    where: 'source',
    line: 'A container query styles descendants of the container, never the container itself.',
    /* ── THE HALF THAT APPLIES HIDES THE HALF THAT DOES NOT ──
     *
     * `@container` matches inside the containment context, so a rule for the
     * element that declares `container-type` never applies. A collapse
     * written that way half-works, which is worse than not working: the
     * descendant rules fire and the container's own rule does not.
     *
     * Measured on a generated dashboard. The shell declared `container-type`
     * and the query held both `.shell { grid-template-columns }` and
     * `.rail { display: none }`. The rail hid, its 224px column stayed with
     * nothing in it, the content column came out 96px wide, and the page
     * overflowed by 177px at a 320px viewport. Put the containment on a
     * WRAPPER and leave the shell a descendant. */
    body: [
      "for (const f of files.filter(f => /\\.css$/.test(f.path))) {",
      /* BLANK THE COMMENTS, never skip them. A selector capture reaches back
         to the previous brace, so a comment EXPLAINING the rule was read as
         part of it: a note naming .shell above a .app rule made the check
         report .shell as its own container. Blanking keeps every newline, so
         the line numbers below still point at the real declaration. */
      "  const text = f.bare",
      "  const named = {}",
      "  const declRe = /([^{}]+)\\{([^{}]*container-type[^{}]*)\\}/g",
      "  let d",
      "  while ((d = declRe.exec(text))) {",
      "    for (const sel of d[1].split(',')) {",
      "      const cls = sel.trim().match(/\\.[A-Za-z0-9_-]+/g)",
      "      if (cls) for (const c of cls) named[c] = true",
      "    }",
      "  }",
      "  if (!Object.keys(named).length) continue",
      "  const blockRe = /@container[^{]*\\{/g",
      "  let m",
      "  while ((m = blockRe.exec(text))) {",
      "    let depth = 1, i = m.index + m[0].length",
      "    while (i < text.length && depth > 0) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++ }",
      "    const inner = text.slice(m.index + m[0].length, i - 1)",
      "    const line = f.text.slice(0, m.index).split('\\n').length",
      "    for (const sel of inner.split('{').map(s => s.split('}').pop().trim()).filter(Boolean)) {",
      "      const bare = sel.replace(/\\s+/g, ' ').trim()",
      "      for (const c of Object.keys(named)) {",
      "        if (bare === c || bare.split(',').map(x => x.trim()).indexOf(c) >= 0)",
      "          fail(f.path, line, 'this container query targets ' + c + ', which is the element that declares container-type. A container query never matches its own container, so this rule is inert while the rules for its descendants fire. Move the containment to a wrapper.')",
      "      }",
      "    }",
      "  }",
      "}",
    ],
  },

  {
    id: 'state-is-not-an-inline-style',
    where: 'source',
    line: 'A state belongs in the stylesheet. An inline style beats every rule you write.',
    /* ── I WROTE THE THING THAT MADE MY OWN RULE UNREACHABLE ──
     *
     * An inline `style` attribute outranks any stylesheet selector, so a
     * state the stylesheet is meant to switch can never switch. Measured on a
     * a generated dashboard: the indeterminate dash carried
     * `style="opacity:0"` in the markup, the rule for
     * `input:indeterminate + .box .dash` was correct, and the select-all box
     * rendered as a solid block with no mark for as long as that attribute
     * existed. One writer per property.
     *
     * A layout VALUE is a different thing. A meter's own percentage is data
     * and has nowhere else to live, so only `opacity`, `display` and
     * `visibility` are faulted. */
    body: [
      "for (const f of files.filter(f => /\\.(html|jsx|tsx|vue|svelte)$/.test(f.path))) {",
      "  const re = /style\\s*=\\s*[\"']([^\"']*)[\"']/g",
      "  let m",
      "  while ((m = re.exec(f.bare))) {",
      "    const prop = m[1].match(/\\b(opacity|display|visibility)\\s*:/)",
      "    if (!prop) continue",
      "    const line = f.text.slice(0, m.index).split('\\n').length",
      "    fail(f.path, line, 'an inline style sets ' + prop[1] + ', which is a STATE. An inline style outranks every rule in your stylesheet, so the rule meant to switch this can never reach it. Move it to a class.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'no-multi-value-token-inside-a-shorthand',
    where: 'source',
    line: 'A token holding two values cannot go inside a shorthand beside another value.',
    /* Component padding ships as a pair, such as `8px 12px`. Interpolated
       into `padding: <one value> var(--that)` it expands to THREE values, and
       the shorthand then reads them as top / sides / bottom. Measured: a
       selection bar came out 8px on top against 12px underneath, from a
       declaration that looked symmetrical. */
    body: [
      "const PAIR = /--cmp-[a-z0-9-]*-(padding|margin)\\b/",
      "for (const f of files.filter(f => /\\.css$/.test(f.path))) {",
      "  const lines = f.text.split('\\n')",
      "  lines.forEach((l, i) => {",
      /* Anchored on a declaration boundary rather than the line start, so a
         rule written on one line is still seen. The boundary also keeps it
         off `padding-inline`, which is a longhand and takes one value. */
      "    const m = l.match(/(?:^|[;{])\\s*(padding|margin)\\s*:\\s*([^;}]+)/)",
      "    if (!m) return",
      "    const val = m[2]",
      "    if (!PAIR.test(val)) return",
      "    const parts = val.trim().split(/\\s+(?![^(]*\\))/)",
      "    if (parts.length < 2) return",
      "    fail(f.path, i + 1, 'this ' + m[1] + ' shorthand holds a component token that itself carries two values, beside ' + (parts.length - 1) + ' more. It expands to three or four values and the shorthand reads them as separate edges. Use the token alone, or name the longhands.')",
      "  })",
      "}",
    ],
  },

  {
    id: 'css-not-in-a-literal',
    where: 'source',
    line: 'No stylesheet is built from a JavaScript template literal.',
    body: [
      "for (const f of files.filter(f => /\\.(js|jsx|ts|tsx|mjs)$/.test(f.path))) {",
      /* \x60 is a backtick. Written as itself it would end the template
         literal this line is interpolated into, which is the exact fault the
         check exists to find. The escape is the rule obeying itself. */
      "  if (/=\\s*\\x60[^\\x60]*\\{[^\\x60]*:[^\\x60]*;[^\\x60]*\\x60/.test(f.text))",
      "    fail(f.path, 0, 'CSS inside a template literal. One backtick in a comment there ends the string, and the build still goes green while the page renders nothing.')",
      "}",
    ],
  },

  /* ══ RENDER ═══════════════════════════════════════════════════════════ */

  {
    id: 'one-baseline-per-row',
    where: 'render',
    line: 'Every row of text sits on one baseline.',
    /* ── LETTERS INSIDE A CENTRED MARK ARE PART OF THE GRAPHIC ──
     *
     * This document holds two rules that met head on. A square taller than
     * the words beside it takes the ROW CENTRE, which is right, and centring
     * its box necessarily lifts its own letters off the row's baseline. So
     * this check then faulted the correct construction.
     *
     * Measured on a generated dashboard: a 32px brand square centred to 9.23
     * above the label's cap line against 9.77 below its baseline, with its
     * initials 2.59px off that baseline. Both readings are right, and only
     * one of them is a fault.
     *
     * The resolution is in the payload's own words. Initials in an avatar are
     * text on the line when the avatar sits ON that line. A mark the row
     * CENTRES has left the baseline set, so its letters are ornament inside a
     * graphic rather than a run of text on the row. Ask the declaration: is
     * this run inside a mark whose row is centring it? */
    body: [
      "const centredMark = el => {",
      "  let n = el",
      "  for (let i = 0; i < 4 && n && n.parentElement; i++, n = n.parentElement) {",
      "    const r = n.getBoundingClientRect()",
      "    if (!r.width || !r.height) continue",
      "    const ratio = r.width / r.height",
      "    if (ratio < 0.7 || ratio > 1.45) continue",
      "    const cs = getComputedStyle(n), parent = getComputedStyle(n.parentElement)",
      "    const centred = cs.alignSelf === 'center' ||",
      "      (parent.display.indexOf('flex') >= 0 && parent.alignItems === 'center' && cs.alignSelf === 'auto')",
      "    if (!centred) continue",
      "    const bg = cs.backgroundColor",
      "    const open = bg ? bg.indexOf('(') : -1",
      "    const parts = open < 0 ? [] : bg.slice(open + 1, bg.lastIndexOf(')')).split(',')",
      "    const filled = !!bg && bg !== 'transparent' && (parts.length < 4 || parseFloat(parts[3]) > 0)",
      "    if (filled || parseFloat(cs.borderTopWidth) > 0) return true",
      "  }",
      "  return false",
      "}",
      "for (const row of rows()) {",
      "  const runs = row.items.filter(i => i.text && i.lines === 1 && !(i.el && centredMark(i.el)))",
      "  if (runs.length < 2) continue",
      "  const bl = runs.map(i => i.baseline)",
      "  const spread = Math.max.apply(null, bl) - Math.min.apply(null, bl)",
      "  if (spread > 0.5)",
      "    fail(row.name, round(spread) + 'px between ' + runs.length + ' baselines on one line: ' + runs.map(i => i.label + '@' + round(i.baseline)).join(', '))",
      "}",
    ],
  },

  {
    id: 'one-height-per-control-row',
    where: 'render',
    line: 'Every control on one line states the same height.',
    body: [
      "for (const row of rows()) {",
      "  const ctl = row.items.filter(i => i.control)",
      "  if (ctl.length < 2) continue",
      "  const hs = ctl.map(i => Math.round(i.rect.height))",
      "  if (new Set(hs).size > 1)",
      "    fail(row.name, 'heights ' + hs.join(', ') + ' in one row. A row that centres two heights MUST show two tops, and that reads as a misalignment it is not.')",
      "}",
    ],
  },

  {
    id: 'icon-on-the-cap-band',
    where: 'render',
    line: 'Every mark beside a label sits between that label’s cap line and its baseline.',
    /* ── A MARK THAT CARRIES ITS OWN TEXT IS STILL A MARK ──
     *
     * This asked only for `svg, img`, so an avatar or a brand square was
     * never measured. Those are the ones that go furthest wrong, because a
     * box taller than the cap band it sits beside is positioned by its OWN
     * letters rather than by the band.
     *
     * Measured on a generated dashboard: a 32px brand square beside an 18px
     * name hung 6px above the cap line against 13px below the baseline, so it
     * sat 3.5px low. Its initials were exactly on the row's baseline and the
     * spread across the row read 0.00, which is why every baseline check
     * passed. The BOX was the thing out of place.
     *
     * The container is asked too, not just a control, because a brand lockup
     * is a plain box holding a square and a word. */
    body: [
      "const HOLDERS = 'button, a, label, .btn, .nav-item, .brand, [class*=brand], [class*=lockup]'",
      "/* A LABEL CLIPPED TO A PIXEL IS NOT A LABEL. A visually hidden name",
      "   has a box, and comparing a 16px mark against it produced 13.5px",
      "   above the cap against -9.5 below on a correct icon-only control. */",
      "const readable = el => { const b = el.getBoundingClientRect()",
      "  const cs = getComputedStyle(el)",
      "  return b.width > 4 && b.height > 4 && cs.visibility !== 'hidden' && cs.opacity !== '0' }",
      "for (const el of all(HOLDERS)) {",
      "  /* ASK THE PROPERTY, NOT THE CLASS NAME. A list of names finds the",
      "     cases somebody already thought of: a square built as .sq rather",
      "     than .brand-mark was never measured. A mark is a DRAWING, or a",
      "     sibling that paints its own box and is roughly square. */",
      "  const paintsABox = n => { const cs = getComputedStyle(n), b = n.getBoundingClientRect()",
      "    if (!b.width || !b.height) return false",
      "    const ratio = b.width / b.height",
      "    if (ratio < 0.7 || ratio > 1.45) return false",
      "    const bg = cs.backgroundColor",
      "    const open = bg ? bg.indexOf('(') : -1",
      "    const parts = open < 0 ? [] : bg.slice(open + 1, bg.lastIndexOf(')')).split(',')",
      "    const filled = !!bg && bg !== 'transparent' && (parts.length < 4 || parseFloat(parts[3]) > 0)",
      "    const edged = parseFloat(cs.borderTopWidth) > 0",
      "    return filled || edged || cs.backgroundImage !== 'none' }",
      "  let mark = el.querySelector('svg, img')",
      "  if (!mark) {",
      "    for (const kid of el.children) if (paintsABox(kid)) { mark = kid; break }",
      "  }",
      "  if (!mark) continue",
      "  const r = boxOf(mark); if (!r) continue",
      "  /* FIND THE MARK FIRST, THEN ITS OWN LABEL. Looking for the first",
      "     text-bearing descendant found the MARK, because a brand square",
      "     carries initials, and the check then compared the mark with",
      "     itself and skipped. The label is a SIBLING of the mark: without",
      "     that, a container holding another control reports a mark against",
      "     a heading rows away from it. */",
      "  let band = readable(el) ? capBand(el) : null",
      "  if (!band) {",
      "    for (const sib of Array.prototype.slice.call(mark.parentElement.children)) {",
      "      if (sib === mark || sib.contains(mark)) continue",
      "      if (!readable(sib)) continue",
      "      const b = capBand(sib)",
      "      if (b) { band = b; break }",
      "    }",
      "  }",
      "  if (!band) continue",
      "  const above = band.cap - r.top, below = r.bottom - band.baseline",
      "  if (Math.abs(above - below) > 1)",
      "    fail(name(el), 'mark ' + round(above) + 'px above the cap line against ' + round(below) + 'px below the baseline. Equal overhang is what centred means. A mark TALLER than the cap band centres its own BOX on that band; putting its own letters on the row baseline positions it by the wrong thing.')",
      "}",
    ],
  },

  {
    id: 'selection-stands-on-its-own-ground',
    where: 'render',
    line: 'A selected row sits on a card, where its fill is a step clear of the ground.',
    /* ── THE ROLE IS THE SAME HEX AS THE PAGE, AND THAT IS DELIBERATE ──
     *
     * `selected` is designed one step off the CARD. It resolves to the same
     * colour as `bg` in both modes, and the plane check exempts that pair for
     * exactly that reason. Put the list straight on the page instead and the
     * chosen row is invisible at 1.00:1, with no error and nothing to see.
     *
     * The discriminator is a PROPERTY, not a class name. A selected row is one
     * of several same-tag siblings, and at least one of those siblings paints
     * differently. That is what a selection IS, whatever the builder called
     * it, and it cannot match the page itself: `body` has no such sibling.
     * An explicit selection attribute is accepted too, so a single chosen item
     * with no unchosen neighbour is still reached. */
    body: [
      "const sel = paints('--c-selected')",
      "if (sel) for (const el of all('*')) {",
      "  if (getComputedStyle(el).backgroundColor !== sel) continue",
      "  const p = el.parentElement; if (!p) continue",
      "  const marked = el.matches('[aria-selected=true], [aria-current], .selected, .is-selected')",
      "  if (!marked) {",
      "    const sibs = Array.prototype.slice.call(p.children).filter(s => s !== el && s.tagName === el.tagName)",
      "    if (!sibs.length) continue",
      "    if (!sibs.some(s => getComputedStyle(s).backgroundColor !== sel)) continue",
      "  }",
      "  const g = ground(el); if (!g || g.bg !== sel) continue",
      "  fail(name(el), 'a selected row painted ' + sel + ' stands on a ground of the same colour, so nobody can see it is chosen. This role is a step off the CARD, not off the page. Put the list on a surface, or mark the selection some other way.')",
      "}",
    ],
  },

  {
    id: 'lone-mark-centres-on-its-box',
    where: 'render',
    line: 'A control with a mark and no words centres that mark on its own box, both axes.',
    /* THE CAP-BAND RULE DOES NOT REACH A CONTROL WITH NO LABEL, and applying
       it anyway is the commonest way to break one. There is no cap line and no
       baseline to sit between, so the transform simply pushes the mark out of
       its box. Measured on a generated dashboard: a lightbulb sat 8.25px above
       the centre of its 36px square button. */
    body: [
      "for (const el of all('button, a[href], label, [role=button]')) {",
      "  if (textRect(el)) continue   /* it has a label; the cap band rule owns it */",
      "  const mark = el.querySelector('svg, img'); if (!mark) continue",
      "  const b = el.getBoundingClientRect(), m = mark.getBoundingClientRect()",
      "  if (!b.width || !m.width) continue",
      "  const dy = ((m.top + m.bottom) / 2) - ((b.top + b.bottom) / 2)",
      "  const dx = ((m.left + m.right) / 2) - ((b.left + b.right) / 2)",
      "  if (Math.abs(dy) > 0.75 || Math.abs(dx) > 0.75)",
      "    fail(name(el), 'a mark with no label sits ' + round(dx) + ', ' + round(dy) + ' off its own box centre. With no label there is no cap band to sit in, so it centres on the box.')",
      "}",
    ],
  },

  {
    id: 'outer-cell-on-the-heading-margin',
    where: 'render',
    line: 'A table’s first column starts on the same margin as the headings above it.',
    /* MEASURED AGAINST THE HEADING, NOT AGAINST A PADDING BOX.
     *
     * The first version walked up to the nearest ancestor with a horizontal
     * padding and compared the cell to that. A card that zeroes its own
     * padding so the cells can carry it, which is the normal way to build a
     * table card, sent the walk two levels further up to the page container.
     * It then reported the first cell 13px out and the last cell 791px out,
     * against a box the table has nothing to do with.
     *
     * The rule's own wording says what to measure: the first column must not
     * start further in than every heading above it. So find a heading in the
     * same container and compare the two left edges. No padding assumption,
     * and it is the symptom a reader actually sees. */
    body: [
      "for (const table of all('table')) {",
      "  let host = table.parentElement, head = null",
      "  for (let i = 0; i < 4 && host && !head; i++) {",
      "    head = Array.prototype.find.call(host.querySelectorAll('h1,h2,h3,h4,h5,h6'), h => !table.contains(h))",
      "    if (!head) host = host.parentElement",
      "  }",
      "  if (!head) continue",
      "  const first = table.querySelector('tr > *:first-child')",
      "  if (!first) continue",
      /* THE CELL WAS ON THE MARGIN AND THE PAINTED MARK WAS NOT.
         *
         * This measured the cell's content edge, which is what CSS positions.
         * A reader sees the first thing that PAINTS. A checkbox drawn at 16px
         * and hit at the 44px floor centres its box in that area, so the
         * visible mark lands 14px further in while the cell sits exactly on
         * the margin.
         *
         * Measured from a card's own left edge: its title, its selection
         * count and its pager range all at 13px, and the checkbox at 27px.
         * This check passed, because the cell was at 1px. */
      "  /* WHAT PAINTS, not the first element that matches. A visually hidden",
      "     input fills the whole hit area, so picking it read the cell's own",
      "     edge and the check stayed silent while the visible box sat 14px in. */",
      "  const paints = Array.prototype.filter.call(",
      "    first.querySelectorAll('svg, img, [class*=box], [class*=avatar], [class*=dot]'),",
      "    n => { const cs = getComputedStyle(n), b = n.getBoundingClientRect()",
      "           return cs.opacity !== '0' && cs.visibility !== 'hidden' && b.width > 2 && b.height > 2 })",
      "  const edge = paints.length ? paints[0].getBoundingClientRect().left : inner(first).left",
      "  const d = edge - head.getBoundingClientRect().left",
      "  if (Math.abs(d) > 0.5)",
      "    fail(name(table), 'the first column starts ' + round(d) + 'px off the margin set by ' + name(head) + ' above it. Zero the outer cell padding rather than letting it add to the container own. If a hit area wider than its mark is centring that mark, give the outer column start alignment so the area grows inward instead.')",
      "}",
    ],
  },

  /* ── A CHECK I COULD NOT MAKE HONEST, AND WHY IT IS NOT HERE ──
   *
   * A badge shipped with 2px between its status dot and the word, inside 6px
   * of padding, and it reads as one smudge. The obvious check compares the
   * ornament gap against the container's own padding.
   *
   * It fires on every correct button. Measured: the badge is 2 inside 6 and a
   * medium button is 4 inside 12. The same 1:3, one wrong and one right, so
   * the ratio is not what separates them. Every other framing I tried came out
   * tuned to those two samples rather than to a rule.
   *
   * The real difference is not visible in the DOM at all. The button's 4px is
   * `--cmp-button-md-gap`, a value the system published. The badge's 2px was
   * invented, because `--cmp-badge-gap` did not exist to be used.
   *
   * So the prevention sits where the cause is: `components.js` now publishes a
   * gap for every component that can hold a mark beside a label, and
   * `tools/component-gaps-guard.mjs` fails the build if one stops doing so.
   * Shipping a check that cries wolf on a dozen correct buttons would have
   * cost more than the fault it was meant to catch.
   */

  {
    id: 'target-floor-on-a-finger',
    where: 'render',
    line: 'On a coarse pointer every control clears the published target, as a whole row.',
    body: [
      "if (!matchMedia('(pointer: coarse)').matches) { note('skipped: this pointer is fine, not coarse'); return }",
      "const floor = px(tokenValue('--target-min') || '44px')",
      "for (const el of all('button, a[href], input, select, [role=button]')) {",
      "  if (clippedAway(el)) continue   /* its label is the hit area */",
      "  const r = el.getBoundingClientRect(); if (!r.width) continue",
      "  if (r.height < floor - 0.5 || r.width < floor - 0.5)",
      "    fail(name(el), round(r.width) + 'x' + round(r.height) + ' under a ' + floor + 'px floor. Promote the whole row, never one control in it.')",
      "}",
    ],
  },

  {
    id: 'the-toggle-actually-toggles',
    where: 'render',
    line: 'Pressing the theme control changes the painted page. Press it and read the result.',
    body: [
      "const btn = document.querySelector('[aria-pressed][aria-label*=heme], #dmd-dark, [data-theme-toggle], #theme-toggle')",
      "if (!btn) { fail('document', 'no theme control found. The system asks for a visible one.'); return }",
      /* ── THIS READ ONE FRAME INTO A TRANSITION, AND CALLED IT DEAD ──
       *
       * `frame()` is a 60ms guess and a theme transition runs longer, so
       * `getComputedStyle` returned the INTERPOLATED colour barely off its
       * start. Compared against the start it read equal, and the check
       * reported a toggle that works as broken.
       *
       * That is the worst shape a finding can have. It is intermittent, so a
       * slower machine passes by luck, nothing reproduces, and every
       * investigation ends in a clean result. Measured on one sweep: the same
       * build reported dead at 320 and 536 and clean at 296, 308 and 535.
       * Three earlier simulation runs reported this toggle dead and each one
       * measured correct when a person served it.
       *
       * `settle()` asks the browser which animations are running and waits
       * for them, so it costs nothing when the switch is instant and cannot
       * be short when it is not. Never lengthen the guess instead. */
      "const before = getComputedStyle(document.body).backgroundColor",
      "btn.click(); await settle(1200)",
      "const after = getComputedStyle(document.body).backgroundColor",
      "btn.click(); await settle(1200)",
      "if (before === after)",
      "  fail(name(btn), 'a press changed nothing. The page painted ' + before + ' before and after.')",
      "const statesItself = btn.getAttribute('aria-pressed') != null ||",
      "  (btn.tagName === 'INPUT' && btn.type === 'checkbox') || btn.getAttribute('aria-checked') != null",
      "if (!statesItself)",
      "  fail(name(btn), 'the control never says which theme is on. Give a button aria-pressed, or use a checkbox, which states it natively.')",
    ],
  },

  {
    id: 'nothing-clipped-out-of-reach',
    where: 'render',
    line: 'Nothing is clipped with no way to reach it.',
    body: [
      "for (const el of all('*')) {",
      "  const cs = getComputedStyle(el)",
      "  const clips = /hidden|clip/.test(cs.overflowX) || /hidden|clip/.test(cs.overflowY)",
      "  if (!clips) continue",
      "  if (/auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflowY)) continue",
      "  if (cs.textOverflow === 'ellipsis') continue",
      "  const box = el.getBoundingClientRect()",
      "  for (const kid of el.children) {",
      "    const ks = getComputedStyle(kid)",
      "    if (ks.position === 'absolute' || ks.position === 'fixed') continue",
      "    const k = kid.getBoundingClientRect()",
      "    const over = Math.max(k.right - box.right, box.left - k.left, k.bottom - box.bottom)",
      "    if (over > 1) fail(name(kid), round(over) + 'px cut off by ' + name(el) + ', which does not scroll. No error, no scrollbar, and the content is simply gone.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'the-page-never-scrolls-sideways',
    where: 'render',
    line: 'The page never scrolls sideways, down to the narrowest width you ship.',
    /* ── THE INSTRUMENT GREW WITH THE FAULT IT WAS LOOKING FOR ──
     *
     * This compared `scrollWidth` against `innerWidth`, and `innerWidth`
     * COUNTS the sideways overflow. So the two rose together and the test was
     * 497 > 497, which is false. Measured on a generated dashboard at a 320px
     * viewport: a table rendered 572px wide, the document came to 497, and
     * this check reported clean.
     *
     * `documentElement.clientWidth` is the viewport itself and does not move.
     * That is the number a person sees. Also report BOTH, so a reader can see
     * the overflow rather than a bare verdict.
     *
     * ── AND THE ROOT'S OWN scrollWidth OVER-REPORTS A CLIPPED TABLE ──
     *
     * Read the content box, `body.scrollWidth`, not the root's. A table inside
     * an `overflow-x: auto` box keeps its full laid-out rect, and the ROOT
     * counts that rect even though the scroller clips it. So a correctly
     * clamped table reported the page as scrolling by 448px at a 320px
     * viewport, while `scrollLeft` refused to move off zero and every box from
     * the card upward measured exactly 320.
     *
     * Measured on the two builds that separate the cases, both at 320px:
     *
     *   a real fault, a pair of buttons nothing clipped
     *     root 362   body 361   viewport 320   -> both fire
     *   a table correctly clamped inside its own scroller
     *     root 768   body 320   viewport 320   -> only the root fires
     *
     * The body respects the intermediate clip, which is the whole question.
     * Content clipped with no way to reach it is a different check and owns
     * that case; this one asks whether the PAGE moves. */
    body: [
      "const d = document.documentElement",
      "const vw = d.clientWidth",
      "const page = document.body ? document.body.scrollWidth : d.scrollWidth",
      "if (page > vw + 1)",
      "  fail('document', 'the page scrolls sideways: ' + page + ' of content in a ' + vw + 'px viewport, over by ' + (page - vw) + '. A table may scroll inside its own box. The page may not. A scroller cannot clamp until every ancestor between it and the page carries min-width: 0.')",
    ],
  },

  {
    id: 'a-selected-row-is-a-step-off-its-ground',
    where: 'render',
    line: 'A selected row differs from the ground it sits on by a step the eye can find.',
    /* ── THE FILL AND THE GROUND WERE THE SAME COLOUR ──
     *
     * A selection has to be FOUND, not noticed once you are already looking.
     * The failure this catches is the fill resolving to the surface it sits on,
     * which happens whenever a role is reused for two jobs: measured 1.00:1 on
     * one build, where the row was marked and nothing showed.
     *
     * ASKS ONLY WHAT IS UNAMBIGUOUS. Which DIRECTION the step goes is a
     * treatment decision: a tinted band a little darker than the card is the
     * conventional marked row in light, and the same step in dark reads as a
     * hole. DESIGN.md carries that judgement with the numbers. A checker that
     * enforced one direction would fault a treatment this system offers, and a
     * check that fires on a shipped option is noise.
     *
     * 1.06 is the floor a hairline needs to be seen at all, and it is the same
     * number the stripe and the selection were separated by when those were
     * measured: 1.13 and 1.27 against the surface, 1.12 between them. */
    body: [
      "const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)",
      "  if (!c || c.length < 3) return null",
      "  const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255",
      "    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })",
      "  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }",
      /* ── A TRANSPARENT COLOUR IS NOT BLACK ──
       *
       * `getComputedStyle` reports no fill as `rgba(0, 0, 0, 0)`, and a regex
       * that reads three channels and ignores the fourth returns black for it.
       * The ground walk then stopped at the FIRST transparent parent and
       * compared a light row against #000000, which is a huge ratio, so an
       * injected 1.00:1 selection came back clean. Read the alpha. */
      "const hexOf = rgb => { const m = /rgba?\\(([^)]*)\\)/.exec(rgb || '')",
      "  if (!m) return null",
      "  const p = m[1].split(',').map(s => parseFloat(s))",
      "  if (p.length < 3 || p.some(n => !isFinite(n))) return null",
      "  if (p.length > 3 && p[3] === 0) return null",
      "  return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }",
      "for (const el of all('[aria-current], [aria-selected=\"true\"]')) {",
      "  const cs = getComputedStyle(el)",
      "  const own = hexOf(cs.backgroundColor)",
      "  if (!own) continue",
      "  let node = el.parentElement, ground = null",
      "  for (let up = 0; node && up < 6; up++, node = node.parentElement) {",
      "    const g = hexOf(getComputedStyle(node).backgroundColor)",
      "    if (g) { ground = g; break }",
      "  }",
      "  if (!ground) continue",
      "  const a = lum(own), b = lum(ground)",
      "  if (a == null || b == null) continue",
      "  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)",
      "  if (ratio < 1.06)",
      "    fail(name(el), 'this row is marked and its fill reads ' + ratio.toFixed(2) + ':1 against the ground behind it, so nothing shows. A selection has to be found rather than noticed once you are already looking. Step the fill off the surface, and give the mark a second channel: an edge, or a full-strength label.')",
      "}",
    ],
  },

  {
    id: 'a-selection-edge-costs-only-its-own-width',
    where: 'render',
    line: 'A selection edge moves the label by its own width, and by nothing else.',
    /* ── THE READY-MADE SUM ASSUMED A PADDING THE CELL NO LONGER HAD ──
     *
     * The selected padding is published as a whole shorthand, and it adds the
     * bar's width to the component's OWN inset. That is the right answer for a
     * cell that kept that inset. A build flushed a table's first column to the
     * card's content edge, which the margin rule pushes toward, and then took
     * the shorthand anyway. Measured: selected rows started 16px in and their
     * unselected neighbours at 0, for a bar 4px wide. A 16px jog down the first
     * column, and the render verifier had no opinion about it.
     *
     * Both halves were the document's own rules, so the fix was to publish the
     * INGREDIENT beside the sum. `edge-width` is one value and assumes nothing.
     *
     * ASKS ONLY WHAT IS UNAMBIGUOUS. The bar's own width is read off what is
     * PAINTED, so the check needs no token and no guessed base. It compares a
     * marked row against a bar-less one in the same column, and the difference
     * between their content edges must be the bar and nothing more.
     *
     * The same-left guard is what keeps it quiet on a TAB STRIP. Siblings in a
     * horizontal run sit at different left edges by design, so their content
     * insets differ by the whole layout. A vertical list shares one left edge,
     * which reduces the comparison to the padding. */
    body: [
      "const barPx = s => { if (!s || s === 'none' || !/inset/.test(s)) return 0",
      "  const m = s.replace(/rgba?\\([^)]*\\)/g, '').match(/(-?[\\d.]+)px/)",
      "  return m ? Math.abs(parseFloat(m[1])) : 0 }",
      "const edgeOf = el => { const cs = getComputedStyle(el)",
      "  const r = el.getBoundingClientRect()",
      "  return { left: r.left, inset: r.left + (parseFloat(cs.paddingLeft) || 0), bar: barPx(cs.boxShadow) } }",
      "const jog = (el, mark, plain, w) => {",
      "  if (Math.abs(mark.left - plain.left) > 1) return",
      "  const cost = mark.inset - plain.inset",
      "  if (cost <= w + 1) return",
      "  fail(name(el), 'this row carries a ' + w + 'px selection edge and its label starts ' + cost.toFixed(1) + 'px further in than the row beside it, so the marked row jogs out of the column. The published padding adds the bar to the component OWN inset, and a cell whose padding you changed no longer has that inset. Add the edge-width token to your own value rather than taking the ready-made sum.')",
      "}",
      "for (const tb of all('table')) {",
      "  let mark = null, plain = null, w = 0, cell = null",
      "  for (const r of tb.querySelectorAll('tr')) {",
      "    const td = r.querySelector('td')",
      "    if (!td) continue",
      "    const m = edgeOf(td)",
      "    const bar = Math.max(m.bar, barPx(getComputedStyle(r).boxShadow))",
      "    if (bar > 1) { if (!mark) { mark = m; w = bar; cell = td } }",
      "    else if (!plain) plain = m",
      "  }",
      "  if (mark && plain) jog(cell, mark, plain, w)",
      "}",
      "for (const el of all('[aria-current], [aria-selected=\"true\"]')) {",
      "  const mark = edgeOf(el)",
      "  if (mark.bar < 2) continue",
      "  const p = el.parentElement",
      "  if (!p) continue",
      "  for (const sib of p.children) {",
      "    if (sib === el || sib.tagName !== el.tagName) continue",
      "    const plain = edgeOf(sib)",
      "    if (plain.bar > 0) continue",
      "    jog(el, mark, plain, mark.bar)",
      "    break",
      "  }",
      "}",
    ],
  },

  {
    id: 'one-token-is-not-one-weight',
    where: 'render',
    line: 'An icon that declares a stroke also declares vector-effect: non-scaling-stroke.',
    /* ── THE DOCUMENT STATED THIS AND NOTHING MEASURED IT ──
     *
     * An SVG scales its stroke with its viewBox, so one `stroke-width` token
     * paints a different weight at every size. Measured across eleven
     * surfaces of one system: 0.73px, 1.02, 1.17, 1.33, 1.75 and 2.33, all
     * from a single declaration, with the icons getting heavier as they grew.
     *
     * `non-scaling-stroke` takes the stroke out of that transform, so the
     * number becomes the painted width and cannot drift. DESIGN.md has said
     * so for a while and shipped no check, which is the failure this file
     * exists to close: a rule the reader cannot run does not land.
     *
     * ASKS A DECLARATION, so it cannot be ambiguous. A mark drawn with a fill
     * and no stroke has no weight to keep, and is not asked about. */
    body: [
      "for (const s of all('svg')) {",
      "  const r = s.getBoundingClientRect()",
      "  if (r.width < 1 || r.height < 1) continue",
      "  const cs = getComputedStyle(s)",
      "  const kid = s.querySelector('path, circle, rect, line, polyline, polygon, ellipse')",
      "  const kcs = kid ? getComputedStyle(kid) : null",
      "  const stroked = el => el && el.stroke && el.stroke !== 'none' && parseFloat(el.strokeWidth) > 0",
      "  const src = stroked(kcs) ? kcs : (stroked(cs) ? cs : null)",
      "  if (!src) continue",
      "  if (src.vectorEffect === 'non-scaling-stroke') continue",
      "  const vb = (s.getAttribute('viewBox') || '').split(/[\\s,]+/).map(Number)",
      "  if (vb.length !== 4 || !vb[2]) continue",
      "  const scale = r.width / vb[2]",
      "  const sw = parseFloat(src.strokeWidth)",
      "  if (Math.abs(scale - 1) < 0.02) continue",
      "  fail(name(s), 'this icon declares stroke-width ' + sw + ' and paints it at ' + (sw * scale).toFixed(2) + 'px, because an SVG scales its stroke with its viewBox. One token is then a different weight at every size. Add vector-effect: non-scaling-stroke, which makes the number the painted width.')",
      "}",
    ],
  },

  {
    id: 'an-overlay-says-it-is-one',
    where: 'render',
    line: 'An overlay declares role="dialog" and aria-modal, and takes its name from its own heading.',
    /* ── ANOTHER RULE THE DOCUMENT STATED AND NOTHING MEASURED ──
     *
     * One surface existed to demonstrate an overlay and carried zero `aria-*`
     * and no `role`. An overlay is not a card in a page: the reader cannot
     * see that the page behind it is out of play, and a screen reader is
     * never told.
     *
     * READ THE DECLARATION, NOT THE NAME. A first version matched on a class
     * holding `sheet`, and faulted a dashboard's main content wrapper — named
     * `.sheet` because it is the page's paper, sitting in normal flow, and
     * covering nothing. A name list faults whatever shares a word. So a
     * candidate must be OUT OF FLOW before its name counts, or already claim
     * a dialog role by its own statement.
     *
     * `popover` is deliberately absent. A popover is not modal, so demanding
     * `aria-modal` of one would fault correct code. */
    body: [
      "const NAMED = '[class*=\"modal\"], [class*=\"dialog\"], [class*=\"drawer\"], [class*=\"overlay\"], [class*=\"sheet\"]'",
      "for (const el of all(NAMED + ', [role=\"dialog\"], [role=\"alertdialog\"], dialog')) {",
      "  const cs = getComputedStyle(el)",
      "  const claims = el.tagName === 'DIALOG' || el.matches('[role=\"dialog\"], [role=\"alertdialog\"]')",
      "  const outOfFlow = cs.position === 'fixed' || cs.position === 'absolute'",
      "  if (!claims && !outOfFlow) continue",
      "  const r = el.getBoundingClientRect()",
      "  if (r.width < 1 || r.height < 1) continue",
      "  if (!(el.textContent || '').trim() && !el.querySelector('input, button, a, img, svg')) continue",
      "  const dlg = claims ? el : el.querySelector('[role=\"dialog\"], [role=\"alertdialog\"], dialog')",
      "  if (!dlg) {",
      "    fail(name(el), 'this paints over the page and never declares itself a dialog: no role=\"dialog\" and no <dialog>. Nothing tells a reader the page behind it is out of play. Put the role on the panel, not on the scrim.')",
      "    continue",
      "  }",
      "  if (dlg.tagName !== 'DIALOG' && dlg.getAttribute('aria-modal') !== 'true')",
      "    fail(name(dlg), 'a dialog that holds the page needs aria-modal=\"true\". Without it a screen reader keeps offering everything behind it.')",
      "  const named = dlg.getAttribute('aria-labelledby') || dlg.getAttribute('aria-label')",
      "  if (!named)",
      "    fail(name(dlg), 'this dialog has no name. Point aria-labelledby at its OWN heading rather than repeating the words in an aria-label, which is how the two drift apart.')",
      "}",
    ],
  },

  {
    id: 'a-split-collapses-before-its-table-scrolls',
    where: 'render',
    line: 'A scroller never clips while its row still holds two columns and the whole row would fit it.',
    /* ── A SCROLLBAR UNDER A TABLE ON A WIDE DESKTOP ──
     *
     * A table scrolling at 320px is the documented answer. A table scrolling
     * at 1400px, with a rail still on screen and a context column beside it,
     * is a split whose collapse threshold is set too low. Measured on a
     * generated dashboard: a seven-column table needing 774px was given three
     * fifths of the content column, came out 628px, and cut 146px off its
     * last two columns.
     *
     * NO THRESHOLD IS GUESSED HERE, and that is the whole design of the
     * check. It asks three questions, all geometry:
     *
     *   is this scroller actually clipping on x
     *   does its row still lay two children side by side
     *   would the table fit if it had the row to itself
     *
     * The third is what keeps it honest. A table too wide for the full row
     * cannot be helped by collapsing, so it is not this finding. And at a
     * width where the split has already stacked there is no second column, so
     * the check goes quiet on its own with no width to tune. */
    body: [
      "for (const sc of all('*')) {",
      "  const cs = getComputedStyle(sc)",
      "  if (!/auto|scroll/.test(cs.overflowX)) continue",
      "  const need = sc.scrollWidth",
      "  if (need <= sc.clientWidth + 1) continue",
      "  let row = sc.parentElement, kid = sc",
      "  let found = null",
      "  for (let up = 0; row && up < 8; up++) {",
      "    const rs = getComputedStyle(row)",
      "    if (/flex|grid/.test(rs.display)) {",
      "      const mine = kid.getBoundingClientRect()",
      "      for (const other of row.children) {",
      "        if (other === kid) continue",
      "        const os = getComputedStyle(other)",
      "        if (os.display === 'none' || os.position === 'absolute' || os.position === 'fixed') continue",
      "        const o = other.getBoundingClientRect()",
      "        if (!o.width || !o.height) continue",
      "        const sameBand = o.bottom > mine.top + 1 && o.top < mine.bottom - 1",
      "        const beside = o.left >= mine.right - 1 || o.right <= mine.left + 1",
      "        if (sameBand && beside) { found = { row, other, o } ; break }",
      "      }",
      "      if (found) break",
      "    }",
      "    kid = row",
      "    row = row.parentElement",
      "  }",
      "  if (!found) continue",
      "  const rs2 = getComputedStyle(found.row)",
      "  const rb = found.row.getBoundingClientRect()",
      "  const inner = rb.width - (parseFloat(rs2.paddingLeft) || 0) - (parseFloat(rs2.paddingRight) || 0)",
      "  if (need > inner) continue",
      "  fail(name(sc), 'this clips ' + (need - sc.clientWidth) + 'px on a row that still holds two columns, and its ' + need + 'px of content would fit the row own ' + round(inner) + 'px. ' + name(found.other) + ' sits beside it at ' + round(found.o.width) + 'px. Collapse the split at this width, or size the table side from the table min-content instead of a share.')",
      "}",
    ],
  },

  {
    id: 'a-label-owns-its-gap',
    where: 'render',
    line: 'A group label states the distance to what it names. Two bare blocks carry no gap.',
    /* ── A LABEL WITH NO GAP READS AS A DEAD FIRST ROW ──
     *
     * An overline above a list is two block siblings, and a block carries no
     * gap of its own. Measured on a generated rail: a section label sat
     * 0.00px above the first navigation item, so it read as a row of the list
     * rather than as the list's name. Nothing reported it. Both boxes were
     * where the engine put them and every alignment check agreed.
     *
     * ASK THE PROPERTY, NOT THE TAG. A label is small, uppercase and
     * positively tracked, which is what the `overline` type role publishes
     * and what nothing else on a page looks like. A heading is neither
     * uppercase nor tracked out, and body copy is neither.
     *
     * Fire only at a gap this small, because that is the case with no reading
     * at all. Anything at or above the smallest space step is a decision.
     *
     * AND THE NAMED THING HAS TO BE BELOW. A column heading is uppercase and
     * tracked out, so it IS a label, and its next sibling is the heading
     * BESIDE it. Subtracting a bottom from a top then gives a negative
     * number, and the first version reported seven table headers at -35.22px
     * on a correct table. Require the sibling to start at or below the
     * label's own bottom edge, which excludes a row of cells outright. */
    body: [
      "for (const el of all('*')) {",
      "  if (el.children.length) continue",
      "  const cs = getComputedStyle(el)",
      "  if (cs.textTransform !== 'uppercase') continue",
      "  if (parseFloat(cs.letterSpacing) <= 0) continue",
      "  if (!el.textContent.trim()) continue",
      "  const next = el.nextElementSibling",
      "  if (!next) continue",
      "  const ns = getComputedStyle(next)",
      "  if (ns.display === 'none' || ns.position === 'absolute' || ns.position === 'fixed') continue",
      "  if (!next.textContent.trim()) continue",
      "  const a = el.getBoundingClientRect(), b = next.getBoundingClientRect()",
      "  if (!a.height || !b.height) continue",
      "  if (b.top < a.bottom - 1) continue",
      "  const gap = b.top - a.bottom",
      "  if (gap <= 2)",
      "    fail(name(el), 'this label sits ' + round(gap) + 'px above ' + name(next) + ', which it names. A label with no gap reads as the first row of the group rather than its title. Blocks carry no gap, so state one: a flex parent with a gap fixes the whole group, a margin fixes only this instance.')",
      "}",
    ],
  },

  {
    id: 'an-inline-box-has-no-size',
    where: 'render',
    line: 'Anything that paints a box states a display. An inline box has no width or height.',
    /* ── FOUR DATA BARS RENDERED 0 BY 0 AND EVERY CHECK PASSED ──
     *
     * A `<span>` is inline, and `width`, `height`, `inline-size` and
     * `overflow` do not apply to an inline box. Measured on a generated
     * dashboard's ageing panel: four fills carrying 20%, 28%, 33% and 19%
     * each rendered 0 by 0. The bars were the whole point of the panel and
     * the reader saw four empty tracks.
     *
     * NOTHING REPORTED IT. The declarations were all present and computed
     * style agreed with every one of them. A geometric check reads a 0-width
     * box as an absent one rather than a broken one, and the alignment checks
     * skip anything with no area. So the panel measured healthy.
     *
     * The tell is not the size. It is a box that PAINTS asking to be inline:
     * a fill, an image or an edge, on an element the engine lays out as text.
     * Two shapes, and both are always a mistake.
     *
     * A grid or flex item is blockified, so the TRACK in that same panel came
     * out a correct 404 by 6 while its child did not. That is why this asks
     * the computed display rather than the tag. */
    body: [
      "for (const el of all('*')) {",
      "  const cs = getComputedStyle(el)",
      "  if (cs.display !== 'inline') continue",
      "  const bg = cs.backgroundColor",
      "  const open = bg ? bg.indexOf('(') : -1",
      "  const parts = open < 0 ? [] : bg.slice(open + 1, bg.lastIndexOf(')')).split(',')",
      "  const filled = !!bg && bg !== 'transparent' && (parts.length < 4 || parseFloat(parts[3]) > 0)",
      "  const edged = ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(cs['border' + s + 'Width']) > 0)",
      "  const paints = filled || edged || cs.backgroundImage !== 'none'",
      "  if (!paints) continue",
      "  const own = el.style",
      "  const asked = own.width || own.height || own.inlineSize || own.blockSize",
      "  const box = el.getBoundingClientRect()",
      "  if (asked)",
      "    fail(name(el), 'this paints a box and asks for ' + asked + ', and it computes to display: inline, which ignores every width and height. It rendered ' + round(box.width) + ' by ' + round(box.height) + '. Give it display: block, or make it a grid or flex item, which are blockified for you.')",
      "  else if (!box.width || !box.height)",
      "    fail(name(el), 'this paints a box and rendered ' + round(box.width) + ' by ' + round(box.height) + ', because display: inline takes its size from text it does not have. Give it a display that can hold a box.')",
      "}",
    ],
  },

  {
    id: 'a-row-that-cannot-wrap-must-fit',
    where: 'render',
    line: 'A row that cannot wrap fits its box, or it carries flex-wrap: wrap.',
    /* ── THE CLIP CHECK NEEDS A CLIP, AND THIS ROW PUSHES INSTEAD ──
     *
     * A pair of buttons is meant to break onto a second line at a narrow
     * width. The document says so, and says the two then measure 100/100. It
     * never said the pair must WRAP, and a flex container does not wrap by
     * default. So the two buttons stayed on one line, refused to shrink under
     * their own labels, and pushed the page sideways.
     *
     * Measured on a generated record page at a 320px viewport: the pair came
     * to 341.4px inside a 280px row, the buttons 173.4 and 162, and the
     * document scrolled 42px with the primary cut off at the screen edge.
     * With flex-wrap: wrap the same pair is 280px over two lines, 280 and 280,
     * and the page does not scroll. It costs nothing wider: at 375px both
     * labels still share one line.
     *
     * NEITHER EXISTING CHECK COULD SEE IT. `nothing-clipped-out-of-reach`
     * requires the parent to clip, and this parent has visible overflow.
     * `the-page-never-scrolls-sideways` only fires once the excess reaches the
     * DOCUMENT: at 375px the row was already 6.4px over and the page reported
     * zero. That is the same fault, smaller, and silent.
     *
     * A SCROLLER IS THE EXEMPTION, because it is the declaration that says the
     * content is reachable. A tab strip scrolls and a table scrolls, both
     * deliberately, and both hold more than their box. Ask the ancestors for
     * overflow-x, never the geometry.
     *
     * Take the UNION of the children, not the sum. A centred row spills both
     * ways, and `scrollWidth` counts one direction only.
     *
     * AND MEASURE AGAINST THE WIDTH THE PARENT CAN GIVE, NOT THE ROW'S OWN
     * RECT. The first version compared the children against the row itself and
     * came back clean on the very fault it was written for. A `nowrap` row
     * GROWS to its own min-content, so its children always fit it exactly:
     * measured 341.4px of buttons inside a 341.4px pair. The overflow is one
     * level up, where that pair sat in a 280px container. Take the smaller of
     * the two boxes.
     *
     * A ROW, NEVER A COLUMN. `nowrap` is the default, so a flex COLUMN matches
     * it too, and there the union across vertically stacked children measures
     * the widest child rather than a line that will not fit. Pointed at a
     * correct app it faulted a form column 34px wide of its own box, where
     * `flex-wrap: wrap` is not the repair at all: it would start a SECOND
     * column. That is the clipped-content question, and another check owns it.
     * Ask the direction. */
    body: [
      "for (const el of all('*')) {",
      "  const cs = getComputedStyle(el)",
      "  if (!/flex/.test(cs.display)) continue",
      "  if (!/^row/.test(cs.flexDirection)) continue",
      "  if (cs.flexWrap !== 'nowrap') continue",
      "  if (cs.position === 'absolute' || cs.position === 'fixed') continue",
      "  const inside = (node, style) => node.getBoundingClientRect().width",
      "    - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)",
      "    - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0)",
      "  let avail = inside(el, cs)",
      "  const up = el.parentElement",
      "  if (up) {",
      "    const us = getComputedStyle(up)",
      "    const room = inside(up, us)",
      "    const bleeds = (parseFloat(cs.marginLeft) || 0) < 0 || (parseFloat(cs.marginRight) || 0) < 0",
      "    const cut = /hidden|clip/.test(us.overflowX)",
      "    if (bleeds || cut) continue",
      "    if (room > 0) avail = Math.min(avail, room)",
      "  }",
      "  if (avail <= 0) continue",
      "  let reachable = false",
      "  let node = el",
      "  for (let step = 0; node && step < 12; step++) {",
      "    if (/auto|scroll/.test(getComputedStyle(node).overflowX)) { reachable = true; break }",
      "    node = node.parentElement",
      "  }",
      "  if (reachable) continue",
      /* ── `display: contents` IS NOT A CHILD, ITS CHILDREN ARE ──
       *
       * A dissolved wrapper generates no box, so it measured zero width, hit
       * the `!k.width` skip, and took its two real buttons out of the count
       * with it. The row then had fewer than two children and the check bailed.
       *
       * Measured on one build: a card's action row 157px wide holding 251px of
       * buttons, 53px of it past the page's own edge, and this check reported
       * clean. Forcing the same wrapper to `display: flex` and changing nothing
       * else made it fire at once. That is the whole fault: the pair-wrap
       * pattern DEPENDS on dissolving a wrapper, so the shape this check was
       * blind to is the shape the layout rules ask for.
       *
       * Walk through such a wrapper to whatever really lays out. */
      "  const layoutKids = parent => {",
      "    const out = []",
      "    for (const kid of parent.children) {",
      "      const ks = getComputedStyle(kid)",
      "      if (ks.position === 'absolute' || ks.position === 'fixed') continue",
      "      if (ks.display === 'none') continue",
      "      if (ks.display === 'contents') { out.push(...layoutKids(kid)); continue }",
      "      out.push(kid)",
      "    }",
      "    return out",
      "  }",
      "  let lo = Infinity, hi = -Infinity, kids = 0",
      "  for (const kid of layoutKids(el)) {",
      "    const k = kid.getBoundingClientRect()",
      "    if (!k.width) continue",
      "    lo = Math.min(lo, k.left)",
      "    hi = Math.max(hi, k.right)",
      "    kids++",
      "  }",
      "  if (kids < 2) continue",
      "  const used = hi - lo",
      "  if (used > avail + 1)",
      "    fail(name(el), 'a row that cannot wrap holds ' + round(used) + 'px of children in the ' + round(avail) + 'px it is given, over by ' + round(used - avail) + '. Nothing on this axis scrolls, so the excess pushes the page sideways and the last control is cut off at the screen edge. A control will not shrink under its own label. Give the row flex-wrap: wrap and it breaks onto a second line instead.')",
      "}",
    ],
  },

  {
    id: 'a-mark-stays-inside-its-control',
    where: 'render',
    line: 'A control that draws its own mark keeps that mark inside its box.',
    /* ── HIDING ONE MARK DOES NOT RECLAIM THE SPACE IT TOOK ──
     *
     * A checkbox has three states and two of them draw a mark. Put both in a
     * flex or flow box and they are laid out SIDE BY SIDE: measured, two 14px
     * marks in a 14px content box overflowed by 6px and 8px, and each was
     * clipped by the box. The checked box then showed the right-hand half of
     * its tick, which is the long diagonal, and read as a slash.
     *
     * `opacity: 0` on the other mark changes nothing, because an invisible
     * flex item still takes its share of the line. The states have to share
     * ONE cell. Nothing else caught this: the box measured 16x16, the mark
     * measured 14x14, and both numbers were right. */
    body: [
      "for (const box of all('.checkbox, .switch, [class*=checkbox], [class*=switch], [class*=box]')) {",
      "  const b = box.getBoundingClientRect(); if (!b.width || b.width > 64) continue",
      "  const marks = Array.prototype.slice.call(box.querySelectorAll('svg, img'))",
      "  if (marks.length < 2) continue",
      "  for (const m of marks) {",
      "    const r = m.getBoundingClientRect(); if (!r.width) continue",
      "    const out = Math.max(b.left - r.left, r.right - b.right, b.top - r.top, r.bottom - b.bottom)",
      "    if (out > 1)",
      "      fail(name(box), 'a mark sits ' + round(out) + 'px outside the control that draws it, so the engine clips it. ' + marks.length + ' marks share this box, and in normal flow they lay out side by side. Put every state in ONE cell.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-date-with-a-month-name-is-text',
    where: 'render',
    line: 'A date carrying a month name stays in the body face. Only an all-figure date takes the mono one.',
    /* The mono rule is stated in the Colors and Typography prose and it still
       gets over-applied, because "figures take the mono face" is the half a
       builder remembers. A date a person READS is not a figure they compare. */
    body: [
      "const MONTHS = /\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\b/i",
      "for (const el of all('*')) {",
      "  if (el.children.length) continue",
      "  const t = (el.textContent || '').trim()",
      "  if (!t || t.length > 40 || !MONTHS.test(t)) continue",
      "  const fam = getComputedStyle(el).fontFamily",
      "  if (!/mono|courier|consolas/i.test(fam)) continue",
      "  fail(name(el), 'the text ' + JSON.stringify(t.slice(0, 24)) + ' carries a month name and is set in ' + fam.split(',')[0] + '. A date with a month name is read rather than compared, so it takes the body face. Only an all-figure date takes the mono one.')",
      "}",
    ],
  },

  /* ══ MANUAL ═══════════════════════════════════════════════════════════ */

  {
    id: 'no-example-markup',
    where: 'manual',
    line: 'Nothing from an `EXAMPLE-*.html` page was copied as markup.',
  },
  {
    id: 'choices-listed',
    where: 'manual',
    line: 'Every judgement call is listed under its own heading.',
  },
  {
    id: 'a-heading-keeps-its-words',
    where: 'render',
    line: 'A heading keeps every word. A row never crushes it narrower than its own text.',
    /* ── THE HALF OF THE COLLAPSE RULE A TOOL CAN ANSWER ──
     *
     * "An action row moves below its heading" was a MANUAL line, so nothing
     * ran it, and the fault it prevents is exactly measurable.
     *
     * A heading beside an action row in a grid whose title track is
     * minmax(0, 1fr) has a ZERO floor. So the track collapses instead of the
     * row breaking, and the heading is left to wrap inside nothing. Measured
     * on a generated dashboard at a 390px viewport: the title box came out
     * 0 by 280 pixels, one word over EIGHT lines, against its own min-content
     * width of 108. The columns read 0px and 330px.
     *
     * Two questions, both exact. More lines than words means a word broke, and
     * a heading never breaks mid-word. A box narrower than the text inside it
     * means a track with no floor took the room.
     *
     * Nothing else saw it. The page did not overflow, because the heading gave
     * way instead. */
    body: [
      "for (const h of all('h1, h2, h3, h4, h5, h6')) {",
      "  const t = textRect(h); if (!t) continue",
      "  const words = (h.textContent || '').trim().split(/\\s+/).filter(Boolean).length",
      "  if (!words) continue",
      "  const box = h.getBoundingClientRect()",
      "  if (t.rects > words)",
      "    fail(name(h), (h.textContent || '').trim().slice(0, 24) + ' is set over ' + t.rects + ' lines for ' + words + ' word' + (words === 1 ? '' : 's') + ', so a word broke mid-way. A heading keeps every word and takes the lines it needs. Remove any overflow-wrap that allows a break inside a word.')",
      "  else if (box.width + 1 < t.right - t.left) {",
      /* ── NAME THE MECHANISM YOU CAN SEE, NOT THE ONE YOU EXPECTED ──
       *
       * This named `minmax(0, 1fr)` only. The fault then turned up on a FLEX
       * row, where `min-width: 0` is the same zero floor, and the message sent
       * the reader hunting a grid track that does not exist in that file. So
       * the finding reports the parent's own display and names the floor that
       * belongs to it. */
      "    const par = h.parentElement ? getComputedStyle(h.parentElement).display : ''",
      "    const floor = /grid/.test(par) ? 'A track declared minmax(0, 1fr) has a ZERO floor' : 'A flex child declaring min-width: 0 has a ZERO floor'",
      "    fail(name(h), 'the heading box is ' + round(box.width) + 'px wide around ' + round(t.right - t.left) + 'px of text, so a word is cut. ' + floor + ', so the title collapses rather than letting the row break. Floor the title at max-content and let the row wrap, or move the actions to their own row.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'action-row-is-ranked',
    where: 'manual',
    line: 'A broken action row is ranked. The primary leads its own line, the rest pair up.',
  },
  {
    id: 'nav-folds',
    where: 'manual',
    line: 'No navigation list reflows. A rail is full or a menu button, never a strip between.',
  },
  {
    id: 'breakpoint-moves-a-row',
    where: 'manual',
    line: 'Every breakpoint moved a whole row. Check each one at BOTH widths.',
  },
  {
    id: 'sweep-between-breakpoints',
    where: 'manual',
    /* The REASON moved to DESIGN.md under Layout, where a reason belongs. A
       checklist line is an instruction, and this one was 170 bytes of the
       contract's 8000. */
    line: 'Run the render pass at every breakpoint AND at the midpoint of each adjacent pair.',
  },
]

export const SOURCE_CHECKS = CHECKS.filter(c => c.where === 'source')
export const RENDER_CHECKS = CHECKS.filter(c => c.where === 'render')
export const MANUAL_CHECKS = CHECKS.filter(c => c.where === 'manual')
