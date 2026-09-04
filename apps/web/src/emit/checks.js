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
    line: 'No number appears where a scale token exists.',
    body: [
      "const SKIP = /@media|@container|@supports|viewBox|stroke-width|aspect-ratio|z-index|flex|opacity|line-height:\\s*[\\d.]+\\s*;/",
      "for (const f of files.filter(f => f.css)) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    if (SKIP.test(line)) continue",
      "    const hit = line.match(/(?<![\\w.-])(?!0px|1px)\\d+(\\.\\d+)?(px|rem)\\b/)",
      "    if (hit) fail(f.path, i + 1, hit[0] + ' is not a token. Every length has a name.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'unknown-token',
    where: 'source',
    line: 'Every token name you used exists in `tokens.css`.',
    body: [
      "for (const f of files) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    for (const m of line.matchAll(/var\\(\\s*(--[\\w-]+)/g)) {",
      "      if (!tokens.has(m[1]) && !m[1].startsWith('--local-'))",
      "        fail(f.path, i + 1, m[1] + ' is in no token file. A fallback would have hidden this.')",
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
    body: [
      "for (const row of rows()) {",
      "  const runs = row.items.filter(i => i.text && i.lines === 1)",
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
      "const before = getComputedStyle(document.body).backgroundColor",
      "btn.click(); await frame()",
      "const after = getComputedStyle(document.body).backgroundColor",
      "btn.click(); await frame()",
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
     * the overflow rather than a bare verdict. */
    body: [
      "const d = document.documentElement",
      "const vw = d.clientWidth",
      "if (d.scrollWidth > vw + 1)",
      "  fail('document', 'the page scrolls sideways: ' + d.scrollWidth + ' of content in a ' + vw + 'px viewport, over by ' + (d.scrollWidth - vw) + '. A table may scroll inside its own box. The page may not. A scroller cannot clamp until every ancestor between it and the page carries min-width: 0.')",
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
    id: 'action-row-collapses',
    where: 'manual',
    line: 'No action row wraps. Below its fitting width it sits under its heading, breaking into pairs.',
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
