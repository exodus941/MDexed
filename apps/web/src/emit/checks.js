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
    line: 'Every icon beside a label sits between that label’s cap line and its baseline.',
    body: [
      "for (const el of all('button, a, label, .btn, .nav-item')) {",
      "  const mark = el.querySelector('svg, img'), band = capBand(el)",
      "  if (!mark || !band) continue",
      "  const r = boxOf(mark); if (!r) continue",
      "  const above = band.cap - r.top, below = r.bottom - band.baseline",
      "  if (Math.abs(above - below) > 1)",
      "    fail(name(el), 'mark ' + round(above) + 'px above the cap line against ' + round(below) + 'px below the baseline. Equal overhang is what centred means.')",
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
      "  const d = inner(first).left - head.getBoundingClientRect().left",
      "  if (Math.abs(d) > 0.5)",
      "    fail(name(table), 'the first column starts ' + round(d) + 'px off the margin set by ' + name(head) + ' above it. Zero the outer cell padding rather than letting it add to the container own.')",
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
    body: [
      "const d = document.documentElement",
      "if (d.scrollWidth > innerWidth + 1)",
      "  fail('document', 'the page scrolls sideways: ' + d.scrollWidth + ' in a ' + innerWidth + ' viewport. A table may scroll inside its own box. The page may not.')",
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
    line: 'Run the render pass at every breakpoint AND at the midpoint of each adjacent pair. A fault lives where the layout changes, and no declared width sits inside that band.',
  },
]

export const SOURCE_CHECKS = CHECKS.filter(c => c.where === 'source')
export const RENDER_CHECKS = CHECKS.filter(c => c.where === 'render')
export const MANUAL_CHECKS = CHECKS.filter(c => c.where === 'manual')
