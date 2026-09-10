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

import { hasThemeToggle } from '../state/schema.js'

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
    id: 'a-touch-floor-asks-the-pointer-never-the-width',
    where: 'source',
    line: 'The touch target floor is set inside a POINTER query, never a width one. A narrow window on a desktop is not a finger.',
    /* ── A WIDTH TELLS YOU HOW MUCH ROOM THERE IS, NEVER WHAT IS POINTING ──
     *
     * This cost two rounds of noise in this project's own toolkit. The floor
     * asked `matchMedia('(pointer: coarse)') || innerWidth < 768`, and that
     * second clause is the rule breaking itself. Resizing a browser to 375px
     * to check a layout flipped the floor from 24 to 40 and reported 13
     * correct mouse targets. I then took those to a person as a decision they
     * needed to make, about controls that were already right.
     *
     * A false positive costs more than the miss here, because it spends their
     * attention on a decision that does not exist.
     *
     * SO ASK WHERE THE FLOOR IS DECLARED, WHICH IS A FACT ABOUT THE FILE. Walk
     * the at-rule stack by brace depth. A floor declared inside a condition
     * that mentions a width, and not a pointer, is the fault. A floor at the
     * top level is fine: it applies to both, which is a decision rather than a
     * guess about the device.
     *
     * TWO SHAPES COUNT AS DECLARING THE FLOOR. A custom property whose name
     * carries `target` or `floor`, and a bare `min-height`/`min-width` at or
     * above 40px, which is where a finger floor lands and no mouse floor does.
     * A smaller minimum is an ordinary size and says nothing about a pointer.
     *
     * PROVEN ON ALL THREE SHAPES. A custom property inside a max-width query,
     * a bare 44px minimum inside one, and a whole media block written on ONE
     * line. Four correct cases stay silent: a pointer query, a width AND
     * pointer query together, a floor at the top level, and a 24px minimum
     * inside a width query. This app's own stylesheet reports nothing, because
     * its floor sits in a pointer query.
     *
     * THE ONE-LINE SHAPE WAS THE SECOND DRAFT'S BLIND SPOT, and the suite
     * caught it rather than my own fixture: the shared broken fixture writes
     * that fault on one line, and this project's stylesheet writes every media
     * block over several. So a check proven on the file in front of me was
     * blind to the commonest way the fault is typed. */
    body: [
      "const FLOOR = /--[\\w-]*(?:target|floor)[\\w-]*\\s*:|min-(?:height|width)\\s*:\\s*(?:4[0-9]|[5-9][0-9]|1[0-9]{2})px\\b/",
      "for (const f of files.filter(f => f.css)) {",
      "  /* THE AT-RULE STACK, BY BRACE DEPTH. A condition governs every line",
      "     until its own brace closes, so nothing shorter than a depth walk",
      "     answers which query a declaration sits in.",
      "",
      "     AND A ONE-LINE BLOCK IS A SHAPE OF ITS OWN. The first version",
      "     matched the at-rule opener and then read the NEXT lines, so a whole",
      "     media block written on one line never reached the floor test at",
      "     all. Both the fixture and this project's stylesheet write such",
      "     blocks over several lines, which is why it passed. Walk the line",
      "     CHARACTER BY CHARACTER instead, so the stack is right at every",
      "     position rather than at every line. */",
      "  const stack = []",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    let at = null",
      "    for (let c = 0; c < line.length; c++) {",
      "      if (line[c] === '@') {",
      "        const m = /^@(media|container|supports)([^{]*)\\{/.exec(line.slice(c))",
      "        if (m) { at = m[2].trim(); continue }",
      "      }",
      "      if (line[c] === '{') { stack.push(at || ''); at = null }",
      "      else if (line[c] === '}') stack.pop()",
      "    }",
      "    if (!FLOOR.test(line)) continue",
      "    /* The gates in force where the declaration sits. A one-line block",
      "       pushes and pops inside this same line, so read the stack as it",
      "       stands at the START of the line plus anything opened before the",
      "       declaration on it. */",
      "    const before = line.slice(0, line.search(FLOOR))",
      "    const inline = (before.match(/@(?:media|container|supports)([^{]*)\\{/g) || [])",
      "      .map(s => s.replace(/^@\\w+/, '').replace(/\\{$/, '').trim())",
      "    const gates = stack.concat(inline).filter(Boolean).join(' ')",
      "    const width = /\\b(?:min|max)-(?:inline-size|width)\\b/.test(gates)",
      "    const pointer = /\\bpointer\\b|\\bany-pointer\\b|\\bhover\\b/.test(gates)",
      "    if (width && !pointer) {",
      "      fail(f.path, i + 1, 'a touch floor is declared inside ' + gates.slice(0, 90)",
      "        + ', which is keyed on a width. A narrow window on a desktop is not a finger,'",
      "        + ' so this reports every correct mouse target the moment somebody resizes a browser.'",
      "        + ' Move it into @media (pointer: coarse).')",
      "    }",
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
    id: 'no-published-token-is-redeclared',
    where: 'source',
    line: 'Your own source declares no name this system already publishes.',
    /* ── THE HOLE BESIDE `unknown-token`, AND IT IS SILENT ──
     *
     * That check accepts any property the source declares, which is right: a
     * measured length has to live somewhere. But it means a build can DECLARE
     * a name the token file already publishes, at a different value, and pass.
     * The system is then changed by a line nobody reads as a change.
     *
     * Found by building a page in simulation run 12. Its `:root` carried
     * `--icon-stroke: 1.5` where the system publishes 1, in the same `:root`
     * and after `tokens.css`, so every icon on the page painted at one and a
     * half times the published weight. Both verifiers passed it.
     *
     * A REDECLARATION IS NOT A TYPO, so the message says which value the
     * system ships. And the theme blocks are exempt by construction: this asks
     * only about the source the builder wrote, never about `tokens.css`. */
    body: [
      "for (const f of files) {",
      "  for (const [i, line] of f.bareLines.entries()) {",
      "    for (const m of line.matchAll(/(^|[;{\\s])(--[\\w-]+)\\s*:/g)) {",
      "      const name = m[2]",
      "      if (!tokens.has(name)) continue",
      "      fail(f.path, i + 1, name + ' is a published token and this line declares it again. The system ships ' + (tokenValues.get(name) || 'its own value') + '. Redeclaring it changes the system for the whole page, and no check reading var() can see that. Name your own value something the system does not publish.')",
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
    /* Only exists when the document ships two themes. A single-theme package
       has no control to state, no attribute to keep out of the markup and
       nothing to press. */
    needs: 'themeToggle',
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
    /* Only exists when the document ships two themes. A single-theme package
       has no control to state, no attribute to keep out of the markup and
       nothing to press. */
    needs: 'themeToggle',
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
      "/* PRESENCE IS NOT ASKED HERE EITHER, AND THE FIXTURE PROVED IT. A clause",
      "   failing a build whose pages carry no theme control fired on the",
      "   known-good fixture, which is a small correct build that legitimately",
      "   ships none. So neither side demands one, and the render pass notes",
      "   that it had nothing to press. Cut a check you cannot make honest. */",
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
    id: 'a-stacking-layer-is-a-token',
    where: 'source',
    line: 'A z-index that joins the global order takes a --z-* token. A hand-typed number is an invention.',
    /* ── A MISSING TOKEN GETS INVENTED, AND THIS IS THE ONE ──
     *
     * Nothing published a stacking order, so every build picked its own. This
     * app did too, before the tokens existed: 29 declarations across 12 files
     * at 18 distinct values, including 71, 801 and 2001. Those are not
     * decisions. They are what someone types when they need to sit above
     * whatever was already there.
     *
     * LOCAL STACKING IS NOT A LAYER, so the check has to tell them apart, and
     * the discriminator is the VALUE rather than the selector. A single digit
     * orders two siblings inside a positioned box and never joins the global
     * order. Anything larger is reaching for a layer, and there is a name for
     * every layer it could want.
     *
     * 10 is the boundary because `--z-raised` is 10. Below that, a number is
     * too small to be competing with anything but its own siblings. */
    body: [
      "for (const f of files.filter(f => /\\.(css|jsx?|tsx?)$/.test(f.path))) {",
      "  const lines = f.text.split('\\n')",
      "  for (let i = 0; i < lines.length; i++) {",
      "    const m = /(?:z-index|zIndex)\\s*:\\s*(-?\\d+)/.exec(lines[i])",
      "    if (!m) continue",
      "    const n = Math.abs(Number(m[1]))",
      "    if (n < 10) continue",
      "    fail(f.path, i + 1, 'z-index ' + m[1] + ' is a hand-typed layer. The stacking order is published as nine named tokens, so reach for the one that says what this is: raised, sticky, dropdown, overlay, modal, popover, toast, tooltip. A number invented here has to beat whatever was already on the page, which is how a codebase ends up with 2001.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-backdrop-blur-has-an-opaque-fallback',
    where: 'source',
    line: 'A backdrop blur declares an opaque background outside its support query. Without it an unsupporting build shows everything behind.',
    /* ── THE FALLBACK IS NOT OPTIONAL, AND IT MUST BE OPAQUE ──
     *
     * `backdrop-filter` is unsupported in enough places that a build without
     * it paints the raw translucent fill. Whatever sits behind then reads
     * straight through the surface, and the text on it competes with text it
     * was never meant to share a place with.
     *
     * So the OPAQUE colour is the base declaration and the translucent fill
     * sits inside the query. Written that way round, a browser that
     * understands neither the property nor the query still paints something
     * a person can read.
     *
     * A TRANSLUCENT FALLBACK IS THE SAME FAULT WRITTEN TWICE, so an 8-digit
     * hex, an rgba or hsla under full alpha, and `transparent` all fail to
     * count. A selector LIST is several rules and each answers for itself.
     */
    body: [
      "/* Every rule that asks for a backdrop blur, and the selector it applies to. */",
      "for (const f of files.filter(x => x.css)) {",
      "  const blurred = new Set()",
      "  const opaqueBase = new Set()",
      "  for (const block of f.bare.matchAll(/([^{}]+)\\{([^{}]*)\\}/g)) {",
      "    const selector = block[1].trim()",
      "    const decls = block[2]",
      "    /* A selector list is several rules. Each one answers for itself. */",
      "    const parts = selector.split(',').map(x => x.trim()).filter(Boolean)",
      "    if (/backdrop-filter\\s*:/.test(decls)) {",
      "      for (const one of parts) blurred.add(one)",
      "      continue",
      "    }",
      "    /* ── AN OPAQUE BASE, AND OPAQUE IS THE WHOLE POINT ──",
      "       A background-color that is itself translucent is not a fallback: it is",
      "       the same fault written twice. So an 8-digit hex, an rgba or hsla with",
      "       an alpha under 1, and the keyword transparent all fail to count. */",
      "    const bg = /background(-color)?\\s*:\\s*([^;]+)/.exec(decls)",
      "    if (!bg) continue",
      "    const value = bg[2].trim()",
      "    if (/^transparent$/i.test(value)) continue",
      "    if (/#[0-9a-fA-F]{4}(\\b|$)|#[0-9a-fA-F]{8}(\\b|$)/.test(value)) continue",
      "    if (/(rgba|hsla)\\([^)]*[,\\s][0]?\\.[0-9]+\\s*\\)/.test(value)) continue",
      "    if (/\\/\\s*0?\\.[0-9]+/.test(value)) continue",
      "    for (const one of parts) opaqueBase.add(one)",
      "  }",
      "  for (const sel of blurred) {",
      "    if (opaqueBase.has(sel)) continue",
      "    fail(f.path, 1,",
      "      sel + ' asks for a backdrop blur and no rule outside the support query gives it an opaque background. backdrop-filter is unsupported in enough places that such a build paints the raw translucent fill, and then everything behind reads straight through. Declare the opaque colour as the BASE rule and put the translucent fill inside the query, so a browser that understands neither still paints a surface a person can read.')",
      "  }",
      "}",
    ],
  },
  {
    id: 'a-shadow-drawn-mark-survives-forced-colors',
    where: 'source',
    line: 'A state marked with box-shadow also has a forced-colors outline, or it vanishes in Windows High Contrast.',
    /* ── A SOURCE CHECK, BECAUSE THE RENDER CANNOT TEST IT ──
     *
     * Forced colors cannot be turned on from script. `matchMedia` reads it and
     * nothing sets it, so a render check could only ever measure the mode the
     * browser happens to be in. The question is therefore about the CSS: does
     * this build carry the block at all?
     *
     * Windows High Contrast overrides authored colour, ignores `box-shadow`
     * outright and drops `background-image`. A system that marks its selected
     * row with an inset shadow and its selected tab with an inset underline
     * loses both, and the fill cannot cover for them because
     * `background-color` is disregarded too.
     *
     * ASKS ONLY WHAT IS UNAMBIGUOUS. It fires when a file draws a state with
     * an inset shadow AND has no `forced-colors` block anywhere in it. It says
     * nothing about which selectors that block should carry, because a build
     * marks its states with whatever it likes. */
    body: [
      "for (const f of files.filter(f => /\\.css$/.test(f.path))) {",
      "  if (/forced-colors/.test(f.text)) continue",
      "  const lines = f.text.split('\\n')",
      "  for (let i = 0; i < lines.length; i++) {",
      /* An inset shadow inside a rule whose selector names a STATE. A plain
         elevation shadow is not a marker and is not asked about. */
      "    if (!/box-shadow:\\s*inset/.test(lines[i])) continue",
      "    let sel = ''",
      "    for (let j = i; j >= 0 && j > i - 12; j--) {",
      "      if (/[{]/.test(lines[j])) { sel = lines[j]; break }",
      "    }",
      "    if (!/selected|current|active|checked|is-picked/i.test(sel)) continue",
      "    fail(f.path, i + 1, 'this marks a state with an inset box-shadow, and forced colors ignores box-shadow entirely. In Windows High Contrast the state loses its only marker, because background-color is disregarded there as well. Add a @media (forced-colors: active) block that restores it with an outline at a negative offset, which costs no layout and which that mode preserves.')",
      "    break",
      "  }",
      "}",
    ],
  },

  {
    id: 'no-shorthand-beside-its-own-longhand',
    where: 'source',
    line: 'No style object mixes a shorthand with a longhand for the same property. Order decides, exactly as in a stylesheet.',
    /* ── `rowGap: 6` THEN `gap: 8` SETS BOTH AXES TO 8 ──
     *
     * An inline style object is a cascade of one, and declaration order decides
     * it the same way it does in a stylesheet. So a shorthand written after its
     * own longhand silently deletes it, and the value that never applied is
     * still sitting in the source where a reader can see it and believe it.
     *
     * Nothing reports it. Both keys are legal, the object is valid, and the
     * rendered gap is simply not the one the code appears to ask for.
     *
     * IT READS THE STYLE REGIONS ONLY. `gap` and `rowGap` beside each other in
     * a hook, a config or a token map mean nothing of the kind, so the scan is
     * bounded by the braces of a style object.
     */
    body: [
      "const PAIRS = [",
      "  ['gap', ['rowGap', 'columnGap', 'row-gap', 'column-gap']],",
      "  ['margin', ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginBlock', 'marginInline', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left']],",
      "  ['padding', ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingBlock', 'paddingInline', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']],",
      "  ['inset', ['top', 'right', 'bottom', 'left', 'insetBlock', 'insetInline']],",
      "  ['border', ['borderWidth', 'borderColor', 'borderStyle', 'border-width', 'border-color', 'border-style']],",
      "  ['background', ['backgroundColor', 'backgroundImage', 'background-color', 'background-image']],",
      "  ['flex', ['flexGrow', 'flexShrink', 'flexBasis', 'flex-grow', 'flex-shrink', 'flex-basis']],",
      "]",
      /* THE BRACES OF A STYLE OBJECT, so nothing outside one is read. Both the
         JSX form and the plain-object form, because a component library uses
         one and a token map the other. */
      "const REGION = /style\\s*=\\s*\\{\\{|style\\s*:\\s*\\{/g",
      "for (const f of files.filter(x => !x.css)) {",
      "  let m",
      "  REGION.lastIndex = 0",
      "  while ((m = REGION.exec(f.bare))) {",
      "    let depth = 0, i = f.bare.indexOf('{', m.index + m[0].length - 1)",
      "    let end = i",
      "    for (; end < f.bare.length; end++) {",
      "      if (f.bare[end] === '{') depth++",
      "      else if (f.bare[end] === '}') { depth--; if (!depth) break }",
      "    }",
      "    const region = f.bare.slice(i, end + 1)",
      "    for (const [short, longs] of PAIRS) {",
      "      const shortAt = region.search(new RegExp('(^|[{,\\\\s])' + short + '\\\\s*:'))",
      "      if (shortAt < 0) continue",
      "      for (const long of longs) {",
      "        const longAt = region.search(new RegExp('(^|[{,\\\\s])' + long + '\\\\s*:'))",
      "        if (longAt < 0) continue",
      "        const later = shortAt > longAt ? short : long",
      "        const gone = shortAt > longAt ? long : short",
      "        fail(f.path, lineOf(f, i + Math.max(shortAt, longAt)),",
      "          later + ' is declared after ' + gone + ' in one style object, so ' + gone + ' never applies. An inline style object is a cascade of one and order decides it. Name the longhands you mean, and drop the shorthand.')",
      "      }",
      "    }",
      "  }",
      "}",
    ],
  },

  {
    id: 'an-underline-is-not-a-border',
    where: 'source',
    line: 'Never build an underline from a border. Use box-shadow: inset 0 -2px 0, which adds no height.',
    /* ── A BORDER ADDS HEIGHT, AND A TRANSPARENT ONE COSTS THE SAME ──
     *
     * A 2px border makes the marked item 2px taller and pushes it past its
     * own container rule, breaking that line where the item sits. Giving the
     * unmarked siblings a transparent border spends the same 2px, so they
     * sit wrong too.
     *
     * TWO SCOPE DECISIONS. A STATE selector only, because a bottom border is
     * the ordinary way to draw a divider. And 2px or more, because a
     * hairline under a chosen item is the strip own rule showing through.
     *
     * Measured in our own stylesheets: zero. We obey it, so the fault it
     * exists for lives in the broken fixture.
     */
    body: [
      "/* A STATE SELECTOR, because a bottom border is the ordinary way to draw a",
      "   DIVIDER. Only a selector naming a chosen state is claiming to draw a",
      "   marker, and only then is the added height a fault. */",
      "const STATE = /(is-selected|is-active|is-current|aria-selected|aria-current|\\.selected|\\.active|\\.current)/",
      "for (const f of files.filter(x => x.css)) {",
      "  for (const block of f.bare.matchAll(/([^{}]+)\\{([^{}]*)\\}/g)) {",
      "    const selector = block[1].trim()",
      "    if (!STATE.test(selector)) continue",
      "    /* A ROW is separated by a rule, so its bottom border is a divider and",
      "       the selection bar beside it is a pseudo-element. Not this rule. */",
      "    if (/(^|[\\s>+~])(tr|td|th|li)([\\s.:\\[]|$)/.test(selector)) continue",
      "    for (const d of block[2].matchAll(/(^|[;\\s])border-(bottom|block-end)(-width)?\\s*:\\s*([^;]+)/g)) {",
      "      const value = d[4].trim()",
      "      const w = parseFloat(value)",
      "      /* A HAIRLINE IS A LINE, NOT AN UNDERLINE. One pixel under a chosen",
      "         item is the strip own rule showing through. Two or more is a mark,",
      "         and a mark drawn as a border adds its own height. */",
      "      if (!(w >= 2)) continue",
      "      fail(f.path, lineOf(f, block.index),",
      "        selector + ' marks a chosen state with a ' + w + 'px bottom border. A border adds its own height, so the marked item stands taller than its siblings and its own container rule breaks where it sits. A TRANSPARENT border on the others costs the same height. Draw it with box-shadow: inset 0 -' + w + 'px 0, which paints in the same place and joins no box.')",
      "    }",
      "  }",
      "}",
    ],
  },
  {
    id: 'a-side-is-named-logically',
    where: 'source',
    line: 'Name a side logically, never physically. margin-inline-start, not margin-left; text-align: end, not right.',
    /* ── THE RULE REACHED THE READER AND NOTHING MEASURED THEIR BUILD ──
     *
     * The suite already asserts that this document never names a physical
     * side in its own prose. That is half the job. A reader who ignores it
     * produced a build nothing had an opinion about.
     *
     * Measured in our own stylesheets, which the same rule governs: 35
     * declarations, mostly margin-left and text-align.
     *
     * TWO SCOPE DECISIONS, both to stop the rule being wider than its
     * problem. The INLINE axis only, because direction never flips the block
     * axis. And a rule declaring a transform keeps its inset, because
     * translateX has no logical form and converting the inset alone breaks
     * the pair.
     */
    body: [
      "/* The inline axis only. Direction flips inline and never in the block axis,",
      "   so faulting margin-top would be a rule wider than its problem. */",
      "const INLINE = {",
      "  'margin-left': 'margin-inline-start', 'margin-right': 'margin-inline-end',",
      "  'padding-left': 'padding-inline-start', 'padding-right': 'padding-inline-end',",
      "  'border-left': 'border-inline-start', 'border-right': 'border-inline-end',",
      "  'border-left-width': 'border-inline-start-width',",
      "  'border-right-width': 'border-inline-end-width',",
      "  'border-left-color': 'border-inline-start-color',",
      "  'border-right-color': 'border-inline-end-color',",
      "  'border-left-style': 'border-inline-start-style',",
      "  'border-right-style': 'border-inline-end-style',",
      "  left: 'inset-inline-start', right: 'inset-inline-end',",
      "}",
      "const KEYWORD = {",
      "  'text-align': { left: 'start', right: 'end' },",
      "  float: { left: 'inline-start', right: 'inline-end' },",
      "  clear: { left: 'inline-start', right: 'inline-end' },",
      "}",
      "for (const f of files.filter(x => x.css)) {",
      "  for (const block of f.bare.matchAll(/([^{}]+)\\{([^{}]*)\\}/g)) {",
      "    const decls = block[2]",
      "    /* ── A TRANSFORM HAS NO LOGICAL FORM, SO THE PAIR IS EXEMPT ──",
      "       The centring idiom is inset 50% plus translate -50%, and translateX is",
      "       physical: negative is leftward in every direction. Convert the inset",
      "       alone and the box lands off screen in a right-to-left build. That",
      "       trades one miss for a worse one, so such a rule keeps its inset. */",
      "    const hasTransform = /(^|[\\s;])transform\\s*:/.test(decls)",
      "    for (const d of decls.matchAll(/(^|[;\\s])([a-z-]+)\\s*:\\s*([^;]+)/g)) {",
      "      const prop = d[2].trim()",
      "      const value = d[3].trim()",
      "      let to = null",
      "      if (INLINE[prop]) {",
      "        if (hasTransform && (prop === 'left' || prop === 'right')) continue",
      "        to = INLINE[prop]",
      "      } else if (KEYWORD[prop]) {",
      "        const word = value.split(/\\s+/)[0]",
      "        if (!KEYWORD[prop][word]) continue",
      "        to = prop + ': ' + KEYWORD[prop][word]",
      "      }",
      "      if (!to) continue",
      "      fail(f.path, lineOf(f, block.index),",
      "        block[1].trim() + ' names a physical side: ' + prop + '. Write it as ' + to",
      "        + '. A physical side reads correctly today and cannot flip later. The logical form resolves identically in a left-to-right build, so it costs this build nothing and buys the other one for free.')",
      "    }",
      "  }",
      "}",
    ],
  },
  {
    id: 'an-auto-margin-cannot-also-hold-a-minimum',
    where: 'source',
    line: 'One writer per margin. An auto margin pushes and a stated margin spaces; the same side cannot do both.',
    /* ── AN AUTO MARGIN CONSUMES THE FREE SPACE, SO IT CANNOT HOLD A FLOOR ──
     *
     * `margin-block-start: auto` on the last child of a flex column takes the
     * free space, which is what lands a card's action row on its bottom edge
     * wherever the text above it ends. The moment the card fills up there is no
     * free space, the margin resolves to zero, and the action touches the
     * sentence above it.
     *
     * So the two jobs need two writers: the margin pushes, and PADDING holds
     * the minimum, because padding cannot be consumed.
     *
     * The fault in source is one side declared twice, once as `auto` and once
     * as a length, for one selector. Both are legal, the later one wins, and
     * whichever wins the other was never doing the job its author thought.
     */
    body: [
      "const SIDES = {",
      "  'margin-top': 'block-start', 'margin-block-start': 'block-start',",
      "  'margin-bottom': 'block-end', 'margin-block-end': 'block-end',",
      "  'margin-left': 'inline-start', 'margin-inline-start': 'inline-start',",
      "  'margin-right': 'inline-end', 'margin-inline-end': 'inline-end',",
      "}",
      "for (const f of files.filter(x => x.css)) {",
      /* ONE RULE AT A TIME. Two rules may legitimately disagree about a side —
         that is what a responsive block is for — and only the declarations
         inside one brace pair are a single author's single decision. */
      "  for (const block of f.bare.matchAll(/([^{}]+)\\{([^{}]*)\\}/g)) {",
      "    const decls = block[2]",
      "    const seen = {}",
      "    for (const d of decls.matchAll(/([a-z-]+)\\s*:\\s*([^;]+)/g)) {",
      "      const side = SIDES[d[1].trim()]",
      "      if (!side) continue",
      "      const value = d[2].trim()",
      "      const kind = value === 'auto' ? 'auto' : /^-?[\\d.]/.test(value) || /^calc|^var/.test(value) ? 'length' : null",
      "      if (!kind) continue",
      "      if (seen[side] && seen[side] !== kind) {",
      "        fail(f.path, lineOf(f, block.index),",
      "          block[1].trim() + ' declares its ' + side + ' margin both as auto and as a length. An auto margin CONSUMES the free space, so it cannot also hold a minimum: the moment the box fills up the stated value collapses and the two things touch. Keep the auto margin for the push and put the minimum in padding, which cannot be consumed.')",
      "        break",
      "      }",
      "      seen[side] = kind",
      "    }",
      "  }",
      "}",
    ],
  },

  {
    id: 'an-exemption-carries-no-weight',
    where: 'source',
    line: 'A rule that removes a distance uses :where(), never :is(). :is() takes the weight of its heaviest argument and outranks what it exempts.',
    /* ── `:is()` TOOK THE WEIGHT AND DELETED A DISTANCE SOMEBODY CHOSE ──
     *
     * A default that publishes a gap needs exemptions for the pairs that are
     * GROUPS: a caption directly above a heading, an overline above a title.
     * Written with `:is()` that exemption came out at (0,4,0) and outranked a
     * component's own stated distance, so it deleted a stat tile's 4px and 2px
     * on fifteen tiles. A rule written to remove a distance I added had started
     * removing distances somebody chose.
     *
     * `:where()` contributes nothing, which is exactly what a reset and an
     * exemption are for.
     *
     * A ZEROING DECLARATION IS THE PROPERTY, not the selector. Asking which
     * rules "look like exemptions" is a name list, and it approves whatever
     * nobody thought of. Ask instead which rules set a spacing property to
     * nothing, because that is what an exemption does.
     */
    body: [
      "const ZERO = /(margin|padding|gap|row-gap|column-gap)[a-z-]*\\s*:\\s*(0|0px|0rem|none)\\s*(;|$)/",
      "for (const f of files.filter(x => x.css)) {",
      "  for (const block of f.bare.matchAll(/([^{}]+)\\{([^{}]*)\\}/g)) {",
      "    const sel = block[1].trim()",
      "    if (!/:is\\(/.test(sel)) continue",
      "    if (!ZERO.test(block[2])) continue",
      "    fail(f.path, lineOf(f, block.index),",
      "      sel + ' removes a distance and matches with :is(), which takes the weight of its heaviest argument. So it outranks whatever component stated that distance on purpose: measured once, an exemption at (0,4,0) deleted a stat tile 4px and 2px gap on fifteen tiles. Use :where(), which contributes nothing.')",
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

  {
    id: 'no-retired-token',
    where: 'source',
    line: 'No file uses a token this system has retired.',
    /* ── THE HALF OF DEPRECATION THAT ACTUALLY MOVES A CODEBASE ──
     *
     * `$deprecated` in the interop file and a comment in the stylesheet are
     * both passive: they are true whether or not anybody reads them. Nothing
     * happened until a build could fail on one.
     *
     * READ THE STYLESHEET, not a list compiled into this file. tokens.css
     * carries the marks, so a system that retires a token tomorrow gets the
     * check for nothing and one that has retired nothing pays no attention to
     * an empty list. A comment on the line above a declaration is the shape
     * the emitter writes, and it is the only place the word appears.
     *
     * A DECLARATION IS NOT A USE. tokens.css declares every retired token by
     * definition, and a project that inlines its tokens declares them again.
     * Faulting those would fault the one file that has to hold them. */
    body: [
      "/* retiredTokens is read out of tokens.css in the preamble, beside the",
      "   token set itself. That file is outside the scanned set on purpose. */",
      "if (retiredTokens.size) {",
      "  for (const f of files) {",
      "    for (const [i, line] of f.bareLines.entries()) {",
      "      for (const [tok, use] of retiredTokens) {",
      "        if (!line.includes(tok)) continue",
      "        /* A DECLARATION IS NOT A USE. A project that inlines its tokens",
      "           declares every one of them, and faulting those would fault the",
      "           file that has to hold them. */",
      "        if (new RegExp('^\\\\s*' + tok + '\\\\s*:').test(line)) continue",
      "        fail(f.path, i + 1, tok + ' is retired.' + (use ? ' Use ' + use + ' instead.' : '') + ' It still resolves today and it is going.')",
      "      }",
      "    }",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-widget-owes-its-keys',
    where: 'source',
    line: 'Every ARIA widget role in the build handles the keys its pattern requires.',
    /* ── A CONTRACT NOBODY CAN RUN IS PROSE ──
     *
     * DESIGN.md now states which keys each component answers. Stated and
     * unchecked, that is the same shape as the three rules a simulated build
     * read straight past.
     *
     * HANDLERS TRAVEL, so the keys are looked for across the WHOLE build and
     * the finding is reported where the role sits. A first version asked each
     * file for its own handlers, and faulted the first correct shape it met:
     * a strip declared in one file and driven by a hook in another.
     *
     * TWO NATIVE ELEMENTS OWE NOTHING. A `<dialog>` opened with `showModal()`
     * answers Escape with no script, and a native `<select>` answers every
     * combobox key. Only the roles a builder puts on a `div` are asked. */
    body: [
      "const OWES = [",
      "  { role: 'tablist',     keys: ['ArrowRight', 'ArrowLeft'], pattern: 'Tabs' },",
      "  { role: 'tab',         keys: ['ArrowRight', 'ArrowLeft'], pattern: 'Tabs' },",
      "  { role: 'combobox',    keys: ['ArrowDown', 'Escape'],     pattern: 'Combobox' },",
      "  { role: 'listbox',     keys: ['ArrowDown', 'Escape'],     pattern: 'Listbox' },",
      "  { role: 'menu',        keys: ['ArrowDown', 'Escape'],     pattern: 'Menu' },",
      "  { role: 'menubar',     keys: ['ArrowDown', 'Escape'],     pattern: 'Menu' },",
      "  { role: 'dialog',      keys: ['Escape'],                  pattern: 'Modal dialog' },",
      "  { role: 'alertdialog', keys: ['Escape'],                  pattern: 'Modal dialog' },",
      "  { role: 'tooltip',     keys: ['Escape'],                  pattern: 'Tooltip' },",
      "]",
      "const NL = String.fromCharCode(10)",
      "const everywhere = files.map(f => f.bare).join(NL)",
      "const nativeDialog = /showModal\\s*\\(/.test(everywhere)",
      "/* One finding per missing key set, not one per role. A build holding",
      "   both role=tablist and role=tab with no arrows has one fault. */",
      "const said = new Set()",
      "for (const o of OWES) {",
      "  if (nativeDialog && (o.role === 'dialog' || o.role === 'alertdialog')) continue",
      "  const missing = o.keys.filter(k => !everywhere.includes(k))",
      "  if (!missing.length) continue",
      "  const sig = o.pattern + ':' + missing.join(',')",
      "  if (said.has(sig)) continue",
      "  for (const f of files) {",
      "    const i = f.bareLines.findIndex(l =>",
      "      l.includes('role=\"' + o.role + '\"') || l.includes(\"role='\" + o.role + \"'\"))",
      "    if (i < 0) continue",
      "    said.add(sig)",
      "    fail(f.path, i + 1, 'role=\"' + o.role + '\" is the ' + o.pattern + ' pattern, and nothing in this build handles ' + missing.join(' or ') + '. A keyboard reader cannot operate it. See the Keyboard table in DESIGN.md.')",
      "    break",
      "  }",
      "}",
    ],
  },

  /* ══ RENDER ═══════════════════════════════════════════════════════════ */

  {
    id: 'a-composite-widget-is-one-tab-stop',
    where: 'render',
    line: 'A tablist, menu, listbox, radiogroup or toolbar exposes exactly one tab stop.',
    /* ── THE HALF OF THE CONTRACT A GREP CANNOT SEE ──
     *
     * The source check above asks whether the arrows are handled anywhere.
     * This one asks the page, per instance, and catches the commoner fault: a
     * strip where every item is tabbable. Six tabs then cost six presses to
     * walk past, and the arrows do nothing because focus never sits on the
     * group.
     *
     * `aria-activedescendant` is the other legal shape. Focus stays on the
     * CONTAINER and the items are correctly not tabbable, so a container
     * declaring it is skipped rather than faulted for having no stop. */
    body: [
      "const GROUPS = '[role=\"tablist\"], [role=\"menu\"], [role=\"menubar\"], [role=\"radiogroup\"], [role=\"listbox\"], [role=\"toolbar\"], [role=\"tree\"]'",
      "const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable=\"true\"]'",
      "for (const g of all(GROUPS)) {",
      "  const r = g.getBoundingClientRect()",
      "  if (r.width < 1 || r.height < 1) continue",
      "  if (g.hasAttribute('aria-activedescendant')) continue",
      "  const stops = Array.prototype.filter.call(g.querySelectorAll(FOCUSABLE), function (el) {",
      "    const t = el.getAttribute('tabindex')",
      "    if (t !== null) return Number(t) >= 0",
      "    return !el.disabled",
      "  })",
      "  if (stops.length > 1)",
      "    fail(name(g), 'a composite widget with ' + stops.length + ' tab stops. It owes exactly one. Tab enters the group and lands on the ACTIVE item, and the arrows move within it. Give the active item tabindex=\"0\" and every other item tabindex=\"-1\".')",
      "  else if (stops.length === 0)",
      "    fail(name(g), 'a composite widget with no tab stop at all, so a keyboard cannot enter it. Give the active item tabindex=\"0\", or put aria-activedescendant on this container and make the container itself focusable.')",
      "}",
    ],
  },

  {
    id: 'a-tab-names-its-panel',
    where: 'render',
    line: 'Every tab states aria-selected and names its panel, and the panel names its tab.',
    /* aria-selected goes on EVERY tab, not only the chosen one. Present on one
       and absent on the rest, a reader is told which tab is selected and never
       that the others are not. */
    body: [
      "for (const t of all('[role=\"tab\"]')) {",
      "  if (!t.hasAttribute('aria-selected'))",
      "    fail(name(t), 'a tab states aria-selected. It goes on EVERY tab in the strip, false as well as true, or a reader hears which one is chosen and never that the rest are not.')",
      "  const controls = t.getAttribute('aria-controls')",
      "  if (!controls) {",
      "    fail(name(t), 'a tab names the panel it shows, with aria-controls pointing at that panel id.')",
      "    continue",
      "  }",
      "  if (!document.getElementById(controls))",
      "    fail(name(t), 'aria-controls names ' + controls + ' and no element carries that id, so the tab points at nothing.')",
      "}",
      "for (const p of all('[role=\"tabpanel\"]')) {",
      "  if (!p.getAttribute('aria-labelledby'))",
      "    fail(name(p), 'a tabpanel takes its name from its own tab, with aria-labelledby. Repeating the words in an aria-label is a second copy that drifts.')",
      "}",
    ],
  },

  {
    id: 'an-action-centres-on-its-heading-cap-band',
    where: 'render',
    line: 'A control beside a heading centres its box between that heading’s cap line and baseline.',
    /* ── "CENTRE THE TWO" WAS NOT AN INSTRUCTION, AND NOTHING MEASURED IT ──
     *
     * `icon-on-the-cap-band` asks about a mark beside its OWN label, inside a
     * control. A button beside a page heading is a different shape: the
     * heading is not the button's label, so that check never looked, and the
     * rule had no instrument at all.
     *
     * Measured on a generated dashboard: a 40px title with its cap line at 31
     * and its baseline at 61, and two 36px buttons centred at 58.5. That is
     * 12.5px below the band centre, on the one row a reader looks at first.
     * Both verifiers passed the page.
     *
     * A LINE BOX IS NOT A CAP BAND. The line box carries the leading and the
     * descender space the capitals never use, so `align-items: center` on the
     * row lands the control below the letters. The gap grows with the type.
     *
     * THREE GUARDS, and each is the rule rather than a taste.
     *
     * A SMALL heading shares a BASELINE with the control instead, and the
     * system states the threshold: centring starts once the heading is one and
     * a half times the control's own font size.
     *
     * A WRAPPED heading has no single cap centre. Which line the controls take
     * is a published setting — first, optical centre, or last — so the check
     * accepts any of its lines rather than guessing which was chosen.
     *
     * A control that has DROPPED BELOW the heading is the collapsed
     * arrangement, which the layout rules ask for. It is only on the heading's
     * row that there is anything to centre against. */
    body: [
      "for (const h of all('h1,h2,h3,h4,h5,h6')) {",
      "  const band = capBand(h)",
      "  if (!band) continue",
      "  const hSize = parseFloat(getComputedStyle(h).fontSize) || 0",
      /* ── ASK FOR THE LINES, DO NOT BORROW A FIELD ──
       *
       * `capBand` returns `lines` from `textRect`, and that field is a COUNT
       * rather than a list. Reading `.length` off a number gives undefined, so
       * the first version of this check skipped every heading and reported a
       * page it had already been shown to be wrong by 12.5px. A check that
       * cannot run reads exactly like a check that passed.
       *
       * The rects come from the heading's own range. Several rects can share a
       * line, so they are folded onto distinct tops. */
      "  const range = document.createRange()",
      "  range.selectNodeContents(h)",
      "  const rects = Array.prototype.slice.call(range.getClientRects())",
      "    .filter(function (r) { return r.width > 0 && r.height > 0 })",
      "  if (!rects.length) continue",
      "  const tops = []",
      "  for (const r of rects) {",
      "    if (!tops.some(function (t) { return Math.abs(t - r.top) < 1 })) tops.push(r.top)",
      "  }",
      "  const first = Math.min.apply(null, tops)",
      "  const ascent = band.baseline - first",
      "  const capH = band.baseline - band.cap",
      "  const centres = tops.map(function (t) { return t + ascent - capH / 2 })",
      /* ── THE ROW TEST READS LAYOUT, NOT PAINT ──
       *
       * `getBoundingClientRect` includes transforms, and the correct fix for
       * this very rule uses one. So a heading whose actions had wrapped onto
       * their own line still overlapped it on screen by the size of that
       * shift, and a geometric test called them a row. It would have faulted
       * the collapsed arrangement, which is the layout the rules ask for.
       *
       * `offsetTop` and `offsetHeight` ignore transforms, so they answer where
       * the flex line actually put each item. Compare the two ITEMS, meaning
       * each one's own child of the container they share. */
      "  const pairing = el => {",
      "    let n = el",
      "    for (let i = 0; i < 4 && n; i++) {",
      "      const p = n.parentElement",
      "      if (!p) return null",
      "      if (p.contains(h)) {",
      /* READ THE DECLARATION, NEVER THE GEOMETRY. A container that PARTITIONS
         its children does not put them on one row, and two side-by-side grid
         areas overlap vertically exactly as two items on one line do.

         Measured on one build: a rail of five nav items reported 4.59, 45.24,
         95.07, 144.9 and 194.73px from the page title's cap band. The 49.83px
         steps are the rail's own row pitch, and the title sat in another
         column of the same grid. A pager 400.69px down a card reported too.

         A flex ROW lays its children on one line. A grid assigns them areas
         and a column flex stacks them, so only the first can pair. */
      "        const ps = getComputedStyle(p)",
      "        const rowish = (ps.display === 'flex' || ps.display === 'inline-flex')",
      "          && !/column/.test(ps.flexDirection)",
      "        if (!rowish) return null",
      "        let m = h",
      "        while (m && m.parentElement !== p) m = m.parentElement",
      "        return m && m !== n ? { item: n, headItem: m } : null",
      "      }",
      "      n = p",
      "    }",
      "    return null",
      "  }",
      "  const sameLine = pair =>",
      "    pair.item.offsetTop < pair.headItem.offsetTop + pair.headItem.offsetHeight &&",
      "    pair.item.offsetTop + pair.item.offsetHeight > pair.headItem.offsetTop",
      "  for (const c of all('button, a[href], [role=\"button\"], .btn')) {",
      "    if (h.contains(c) || c.contains(h)) continue",
      "    const r = c.getBoundingClientRect()",
      "    if (!r.width || !r.height) continue",
      "    /* On the heading's ROW. Dropped below it is the collapsed layout. */",
      "    const pair = pairing(c)",
      "    if (!pair || !sameLine(pair)) continue",
      /* ── A CONTROL BEHIND A SCRIM IS NOT BESIDE ANYTHING ──
       *
       * A dialog's heading overlaps whatever the page holds at that height, so
       * an overlay surface reported its own page's toolbar buttons against the
       * dialog's title, 24.64px apart. They are not on that row. They are
       * under it.
       *
       * "No answer" is not "no": `elementFromPoint` returns null for anything
       * outside the viewport, and reading that as covered would drop real
       * findings on a long page. Only a real element that is neither this
       * control nor part of it counts as covering it. */
      "    const cr = c.getBoundingClientRect()",
      "    const onTop = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2)",
      "    if (onTop && onTop !== c && !c.contains(onTop) && !onTop.contains(c)) continue",
      "    const cSize = parseFloat(getComputedStyle(c).fontSize) || 0",
      "    if (!cSize || hSize < cSize * 1.5) continue",
      "    const mid = (r.top + r.bottom) / 2",
      "    let off = null",
      "    for (const centre of centres) {",
      "      const d = mid - centre",
      "      if (off === null || Math.abs(d) < Math.abs(off)) off = d",
      "    }",
      "    if (off === null || Math.abs(off) <= 1) continue",
      "    fail(name(c), 'this control sits ' + round(off) + 'px from the cap-band centre of ' + name(h) + ' beside it. The band is the top of a capital letter to the baseline, and it is ' + round(capH) + 'px on a ' + round(hSize) + 'px heading. A line box is taller than that, because it carries leading and descender space the capitals never use, so centring on the ROW lands the control below the letters. Centre the box between those two lines and let it overhang both equally.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-column-of-figures-takes-the-mono-face',
    where: 'render',
    line: 'Every cell in a column of figures is set in the mono family.',
    /* ── THE HALF THAT MAKES THE EDGE CHECK POSSIBLE ──
     *
     * `an-amount-lines-up-on-its-end-edge` skips a column whose face is wrong,
     * because the two rules are separate and it has no business enforcing this
     * one. That left a hole a build could fall through by getting BOTH halves
     * wrong, and this system's own dashboard did exactly that: an amount
     * column in the body face, beside an invoice table that used the mono
     * primitive correctly. Neither check said anything.
     *
     * A COLUMN IS WHAT MAKES THE FACE MATTER. One figure standing alone has
     * nothing to stack against, so a stat tile, a pricing hero and a badge
     * count all keep the body face. Asking about columns only is not a
     * narrowing for convenience — it is the reason the rule exists.
     *
     * AN ABSENT VALUE IS NOT A NON-FIGURE. A dash where a due date has not
     * been set would otherwise disqualify the whole column, and the check
     * would go quiet on exactly the tables that carry real data. Placeholders
     * are skipped, and at least two real figures still have to remain. */
    body: [
      "const MONO = /mono|courier|consolas|menlo|ui-monospace/i",
      "const FIGURE = /^[^0-9A-Za-z]{0,2}[0-9](?:[0-9,.:/\\u00a0 ]*[0-9])?[^0-9A-Za-z]?$/",
      "const ABSENT = /^(?:[-\\u2013\\u2014\\u2212]|n\\/a|none|)$/i",
      "for (const table of all('table')) {",
      "  const rows = Array.prototype.filter.call(table.querySelectorAll('tbody tr'), function (r) {",
      "    const b = r.getBoundingClientRect(); return b.width > 0 && b.height > 0",
      "  })",
      "  if (rows.length < 2) continue",
      "  const cols = {}",
      "  for (const r of rows) {",
      "    Array.prototype.forEach.call(r.children, function (td, i) {",
      "      (cols[i] = cols[i] || []).push(td)",
      "    })",
      "  }",
      "  for (const key of Object.keys(cols)) {",
      "    const cells = cols[key]",
      "    if (cells.length < 2) continue",
      "    let figures = 0",
      "    let body = 0",
      "    let first = null",
      "    let mixed = false",
      "    for (const td of cells) {",
      "      const text = (td.textContent || '').replace(/\\s+/g, ' ').trim()",
      "      if (ABSENT.test(text)) continue",
      "      if (!FIGURE.test(text)) { mixed = true; break }",
      "      figures++",
      "      const holder = td.querySelector('*') || td",
      "      if (!MONO.test(getComputedStyle(holder).fontFamily)) { body++; if (!first) first = td }",
      "    }",
      "    if (mixed || figures < 2 || !body) continue",
      "    fail(name(first), 'this column holds ' + figures + ' figures and ' + body + ' of them are set in the body face. A column is what makes the mono face matter: it gives every digit one width, so the digits stack. A proportional face cannot line them up however carefully the cells are padded. Set the family on the cell, not on one span inside it, or the next value added lands in the wrong face.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-standalone-figure-keeps-the-body-face',
    where: 'render',
    line: 'A figure with no column to stack against keeps the body face.',
    /* ── THE OTHER HALF, AND ONLY ONE HALF WAS CHECKED ──
     *
     * `a-column-of-figures-takes-the-mono-face` asks that a column IS mono.
     * Nothing asked that everything else is NOT, so a build could set every
     * figure on the page in the mono face and pass. One did: a generated
     * dashboard put its three stat tiles in it at 32px, and a reader spotted
     * it in a screenshot.
     *
     * A COLUMN is what makes the face matter. The mono face exists so digits
     * stack over each other, and one figure standing alone has nothing to
     * stack against — so the face buys it nothing and costs it the page's own
     * voice. A stat tile, a pricing hero, a badge count and a number inside a
     * sentence all keep the body face.
     *
     * TABLES ARE NOT THIS CHECK'S BUSINESS. The column check owns them, and a
     * bare number in a text cell is ambiguous from here. Code is not either:
     * a mono face inside `code`, `pre`, `kbd` or `samp` is the whole point of
     * naming a mono family. */
    body: [
      "const MONO = /mono|courier|consolas|menlo|ui-monospace/i",
      "const FIGURE = /^[^0-9A-Za-z]{0,2}[0-9](?:[0-9,.:/\\u00a0 ]*[0-9])?[^0-9A-Za-z]?$/",
      "/* ── A COLUMN IS A RELATIONSHIP, SO COLLECT EVERY FIGURE FIRST ──",
      "   A tag list found the case somebody thought of, which was a table, and",
      "   approved nothing else. A chart tick column is a run of values read down",
      "   the page, so the mono face is exactly right there, and the check faulted",
      "   all 49 of them. Measured over four surfaces: 68 figures, and 0 sit in",
      "   the mono face with no column beside them. */",
      "const figs = []",
      "for (const el of all('*')) {",
      "  if (el.children.length) continue",
      "  if (el.closest('code, pre, kbd, samp')) continue",
      "  const text = (el.textContent || '').replace(/\\s+/g, ' ').trim()",
      "  if (!text || !FIGURE.test(text)) continue",
      "  figs.push({ el: el, text: text, r: el.getBoundingClientRect() })",
      "}",
      "/* TWO FIGURES SHARING AN INLINE EDGE AT DIFFERENT HEIGHTS ARE A COLUMN.",
      "   Same top is a ROW of figures, which stacks nothing. */",
      "const inColumn = f => figs.some(o => o !== f",
      "  && Math.abs(o.r.top - f.r.top) >= 2",
      "  && (Math.abs(o.r.left - f.r.left) < 2 || Math.abs(o.r.right - f.r.right) < 2))",
      "for (const f of figs) {",
      "  if (!MONO.test(getComputedStyle(f.el).fontFamily)) continue",
      "  /* A TABLE CELL IS A COLUMN BY CONSTRUCTION, even where one row shows. */",
      "  if (f.el.closest('table')) continue",
      "  if (inColumn(f)) continue",
      "  fail(name(f.el), 'this figure reads \"' + f.text + '\" and sits in the mono face with no column to stack against. A column is what makes that face matter: it gives every digit one width so the digits line up down the page. Alone it buys nothing and costs the page its own voice. A stat tile, a hero price, a badge count and a number inside a sentence all keep the body face.')",
      "}",
      "if (!figs.length) note('no figure on this page, so this rule is UNMEASURED here.')",
      "else note(figs.length + ' figure(s) measured, ' + figs.filter(inColumn).length + ' of them in a column.')",
    ],
  },

  {
    id: 'an-amount-lines-up-on-its-end-edge',
    where: 'render',
    line: 'Amounts in one column share an end edge. The mono face alone does not line them up.',
    /* ── A PUBLISHED RULE WITH NO CHECK, FOUND BY A BUILD THAT PASSED ──
     *
     * This system states that an amount takes the mono face AND an end edge,
     * and that the edge is the half that lines the magnitudes up. Nothing
     * measured the edge. A generated dashboard shipped four amounts in one
     * column whose right edges read 773, 763, 763 and 773, through a clean
     * source pass and a clean render pass.
     *
     * The cause was ordinary. A single class at (0,1,0) lost to the base cell
     * rule at (0,1,1), so the alignment it declared never applied.
     *
     * ASK THE COLUMN, NOT THE CELL. One cell has nothing to line up with. So
     * the check gathers a table's body cells by index and compares the ink.
     *
     * AN AMOUNT IS NOT EVERY FIGURE, and getting that wrong makes the check
     * useless. An identifier is set in the same mono face and is deliberately
     * NOT moved to the end, because nobody compares its magnitude. A bare run
     * of digits is ambiguous: 10023 is an order number or a quantity, and the
     * text cannot say which. So the check asks for a MARK — a separator, a
     * decimal, a currency symbol, a sign, or a percent. An amount carries one.
     * An identifier does not. A column of bare integers is skipped, which is a
     * miss rather than a false positive, and that is the safe direction.
     *
     * THE THRESHOLD IS ON THE MOVE. Lining a column up moves each value by the
     * whole difference, not half of it, so 1px here is 1px of repair.
     *
     * THE SECOND HALF IS THE ONE THAT DOES NOT SHOW YET. A column of equal-
     * width values lines up whatever its alignment, because every digit in a
     * mono face is one width. It looks correct and breaks the day a value
     * gains a digit. So when the edges agree AND every value is the same
     * width AND nothing declares an end alignment, say so. Different widths
     * with agreeing edges means something really is aligning them, and that
     * case stays silent. */
    body: [
      "const MONO = /mono|courier|consolas|menlo|ui-monospace/i",
      "const FIGURE = /^[^0-9A-Za-z]{0,2}[0-9](?:[0-9,.\\u00a0 ]*[0-9])?[^0-9A-Za-z]?$/",
      "const MARKED = /[,.]|^[^0-9]|[^0-9]$/",
      "const ENDWISE = /right|end/",
      "for (const table of all('table')) {",
      "  const rows = Array.prototype.filter.call(table.querySelectorAll('tbody tr'), function (r) {",
      "    const b = r.getBoundingClientRect(); return b.width > 0 && b.height > 0",
      "  })",
      "  if (rows.length < 2) continue",
      "  const cols = {}",
      "  for (const r of rows) {",
      "    Array.prototype.forEach.call(r.children, function (td, i) {",
      "      (cols[i] = cols[i] || []).push(td)",
      "    })",
      "  }",
      "  for (const key of Object.keys(cols)) {",
      "    const cells = cols[key]",
      "    if (cells.length < 2) continue",
      "    const rights = []",
      "    const widths = []",
      "    let endwise = false",
      "    let amounts = true",
      "    for (const td of cells) {",
      "      const holder = td.querySelector('*') || td",
      "      const text = (td.textContent || '').replace(/\\s+/g, ' ').trim()",
      "      if (!FIGURE.test(text) || !MARKED.test(text)) { amounts = false; break }",
      "      if (!MONO.test(getComputedStyle(holder).fontFamily)) { amounts = false; break }",
      "      if (ENDWISE.test(getComputedStyle(td).textAlign) || ENDWISE.test(getComputedStyle(holder).textAlign)) endwise = true",
      "      const range = document.createRange()",
      "      range.selectNodeContents(holder)",
      "      const box = range.getBoundingClientRect()",
      "      rights.push(box.right)",
      "      widths.push(box.width)",
      "    }",
      "    if (!amounts || rights.length < 2) continue",
      "    const spread = Math.max.apply(null, rights) - Math.min.apply(null, rights)",
      "    const vary = Math.max.apply(null, widths) - Math.min.apply(null, widths)",
      "    if (spread > 1) {",
      "      fail(name(cells[0]), 'this column holds amounts and their end edges differ by ' + spread.toFixed(1) + 'px, so the magnitudes do not line up. The mono face gives every digit one width. The END EDGE is what stacks the digits over each other, and it is the half that was missing. A single class loses to a descendant selector, so check that whatever sets the alignment actually wins.')",
      "    } else if (vary <= 1 && !endwise) {",
      "      fail(name(cells[0]), 'this column of amounts lines up only because every value is the same width. Nothing here declares an end alignment, so the first value that gains a digit breaks the column. Give the cells text-align: end.')",
      "    }",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-tick-label-centres-on-its-gridline',
    where: 'render',
    line: 'Every value tick sits on the gridline it names, measured from its cap band.',
    /* ── SPACE-BETWEEN DISTRIBUTES THE BOXES, NOT THEIR CENTRES ──
     *
     * So the first tick sits half a line below the top gridline and the last
     * one half a line above the bottom. Measured on a 19.44px line before the
     * repair: 9.72, 4.86, 0.00, -4.86, -9.72. The middle one is right by
     * accident. Extending the column by half a line at each end puts the
     * centres on the boundaries, which is exact rather than tuned.
     *
     * NOTHING ASSERTED IT, so the repair could go in silence. Measured with
     * it in place: 1.22px worst over five ticks, a 1.00px spread, which is
     * under the whole pixel any repair would need.
     *
     * THE PERIOD MAY BE A PERCENTAGE OF THE BOX. Reading the last pixel stop
     * instead takes the 1px LINE for the gap between two, so it invents 227
     * gridlines a pixel apart. Every tick then lands on one and the run
     * reports clean. That was my first version.
     *
     * A GRADIENT IS WHAT PAINTS THEM, not a run of child elements, so this
     * reads the background rather than looking for lines.
     */
    body: [
      "/* THE PERIOD IS THE LAST STOP, in px or as a share of the box. */",
      "const periodOf = (bg, h) => {",
      "  const m = bg.match(/,\\s*[^,]*?\\s([\\d.]+)(px|%)\\s*\\)\\s*$/)",
      "  if (!m) return null",
      "  return m[2] === \"%\" ? (+m[1] / 100) * h : +m[1]",
      "}",
      "let measured = 0",
      "for (const chart of all(\"[class*=chart]\")) {",
      "  const grid = chart.querySelector(\"[class*=grid]\")",
      "  const ticks = chart.querySelector(\"[class*=ticks]\")",
      "  if (!grid || !ticks) continue",
      "  const gb = boxOf(grid); if (!gb || !gb.height) continue",
      "  const p = periodOf(getComputedStyle(grid).backgroundImage, gb.height)",
      "  /* A ONE PIXEL PERIOD IS THE LINE ITSELF, never the gap between two. */",
      "  if (!p || p < 4) continue",
      "  /* The gradient runs bottom up, and the labels run top down. */",
      "  const lines = []",
      "  for (let y = gb.bottom; y >= gb.top - 0.5; y -= p) lines.push(y)",
      "  lines.reverse()",
      "  const labels = Array.prototype.filter.call(ticks.children,",
      "    k => (k.textContent || \"\").trim())",
      "  /* TWO TICKS HAVE NOTHING TO DRIFT. The fault is at the ends. */",
      "  if (labels.length < 3 || labels.length !== lines.length) continue",
      "  measured++",
      "  const offs = []",
      "  for (let i = 0; i < labels.length; i++) {",
      "    const band = capBand(labels[i]); if (!band) continue",
      "    offs.push(((band.cap + band.baseline) / 2) - lines[i])",
      "  }",
      "  if (!offs.length) continue",
      "  const worst = offs.reduce((a, x) => Math.abs(x) > Math.abs(a) ? x : a, 0)",
      "  /* A WHOLE PIXEL, because centring shifts a thing by half the difference",
      "     and nothing under one pixel can be repaired. The recorded fault is",
      "     half a line, which is 9.72 on a 12px caption. */",
      "  if (Math.abs(worst) <= 2) continue",
      "  fail(name(chart), \"this tick label sits \" + round(worst) + \"px from the gridline it names, over \" + labels.length + \" ticks at a \" + round(p) + \"px period. space-between distributes the label BOXES between the plot edges, not their centres, so the ends sit half a line out and the middle one is right by accident. Extend the tick column by half a line at each end with a negative block margin, derived from the caption size and its leading.\")",
      "}",
      "/* A RUN THAT MEASURED NOTHING IS NOT A PASS. */",
      "if (!measured) note(\"no chart paired a gridline gradient with a tick column, so nothing was measured\")",
      "else note(measured + \" tick columns measured against their gridlines\")",
    ],
  },
  {
    id: 'a-declared-line-has-area-to-paint-in',
    where: 'render',
    line: 'A layer that declares an axis or a gridline has area on both sides, or it paints nothing.',
    /* ── A BOX THAT EXISTS IS NOT A BOX THAT PAINTS ──
     *
     * A bar chart put its axis and its gridlines on one absolutely
     * positioned grid item. An absolute box with no inset and no size takes
     * its CONTENT, and a layer has no content, so it measured 1x0 inside a
     * 104px rows box. Its computed inset read 52px top and 52px bottom: the
     * grid area, collapsed to nothing at its own centre.
     *
     * So the value axis was absent on two bar charts, and the gridline
     * gradient had no box to paint in.
     *
     * EVERY GEOMETRIC CHECK PASSED, because the box existed and sat where
     * the grid put it. The quieter-than-its-axis check compares two COLOURS
     * and has no opinion about whether either one reaches the screen.
     *
     * AND THE COMMENT BESIDE IT NAMED A DIFFERENT CAUSE. It warned that
     * `1 / -1` needs explicit rows, which is true, and the markup states
     * them. The template resolved. The inset was the missing half.
     *
     * Measured after the repair: 32 layers over the charts surface, none
     * with a dead axis.
     */
    body: [
      "/* A LAYER DECLARES ITS LINE, so read the declaration rather than guessing",
      "   from a class name. An axis is a border. A gridline set is a repeating",
      "   gradient, which is one box rather than a run of elements. */",
      "let layers = 0",
      "for (const el of all(\"[class*=chart]\")) {",
      "  const cs = getComputedStyle(el)",
      "  const widths = [\"Top\", \"Right\", \"Bottom\", \"Left\"]",
      "    .map(side => parseFloat(cs[\"border\" + side + \"Width\"]) || 0)",
      "  const edges = widths.filter(w => w > 0).length",
      "  const gradient = cs.backgroundImage.indexOf(\"gradient\") >= 0",
      "  if (!edges && !gradient) continue",
      "  layers++",
      "  const r = el.getBoundingClientRect()",
      "  /* ONE PIXEL ON EITHER SIDE. A line needs a length as well as a width, so",
      "     a box thinner than a pixel on either axis paints nothing at all. */",
      "  if (r.width >= 1 && r.height >= 1) continue",
      "  fail(name(el), \"this layer declares \" + (edges ? edges + \" edge(s)\" : \"\") + (edges && gradient ? \" and \" : \"\") + (gradient ? \"a gradient\" : \"\") + \" and measures \" + round(r.width) + \"x\" + round(r.height) + \", so it paints nothing. An absolutely positioned box with no inset takes its CONTENT, and a line layer has none. State inset 0 on both axes: the block side gives an axis its length and the inline side gives a gradient its width. Every geometric check passes on this, because the box exists and sits where the grid put it.\")",
      "}",
      "/* A RUN THAT MEASURED NOTHING IS NOT A PASS. */",
      "if (!layers) note(\"no chart layer declared an edge or a gradient, so nothing was measured\")",
      "else note(layers + \" chart layers measured for area\")",
    ],
  },
  {
    id: 'a-gridline-is-quieter-than-its-axis',
    where: 'render',
    line: 'A chart axis is heavier than its gridlines, and the gridlines come off the value axis alone.',
    /* ── A GRIDLINE IN THE AXIS COLOUR TURNS A PLOT INTO A GRID OF BOXES ──
     *
     * The palette was published and the furniture was not, so a builder
     * charting anything invented an axis weight and a gridline colour. Both
     * have tokens now, and the pair only works in one direction: the axis is
     * the plot's own outline and a gridline sits UNDER the data.
     *
     * READ THE PAINT, NEVER A CLASS NAME. A gridline is a line inside the plot
     * and an axis is a line on its edge, and the computed style is the only
     * thing that knows which is which. Asking for a class would approve any
     * naming nobody thought of.
     *
     * THREE GUARDS. A plot with one line has no pair to compare. A line that
     * paints nothing is not a gridline. And an axis on the edge of the plot is
     * found by its POSITION rather than by its name, because a plot that draws
     * its axis with a border has no element to ask.
     */
    body: [
      "const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)",
      "  if (!c || c.length < 3) return null",
      "  const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255",
      "    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })",
      "  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }",
      "const hexOf = rgb => { const m = /rgba?\\(([^)]*)\\)/.exec(rgb || '')",
      "  if (!m) return null",
      "  const p = m[1].split(',').map(s => parseFloat(s))",
      "  if (p.length < 3 || p.some(n => !isFinite(n))) return null",
      "  if (p.length > 3 && p[3] === 0) return null",
      "  return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }",
      "const ratioOf = (a, b) => { const x = lum(a), y = lum(b)",
      "  if (x == null || y == null) return null",
      "  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }",
      "const axisOf = el => { const cs = getComputedStyle(el)",
      "  for (const side of ['Bottom', 'Top', 'Left', 'Right']) {",
      "    if (px(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none') {",
      "      const c = hexOf(cs['border' + side + 'Color'])",
      "      if (c) return c",
      "    }",
      "  }",
      "  return null }",
      "/* ── A GRIDLINE IS PAINTED, AND A GRADIENT IS HOW. Reading child elements",
      "   alone measured nothing on the shipped charts: fourteen plots, an axis found",
      "   on twelve, and zero gridlines, because a repeating gradient is one box and",
      "   not a run of lines. That reads exactly like a pass. So ask both mechanisms,",
      "   and read the gradient's own opaque stops. */",
      "const stopsOf = el => { const img = getComputedStyle(el).backgroundImage",
      "  if (!img || img === 'none' || !/gradient/.test(img)) return []",
      "  const out = []",
      "  for (const m of img.matchAll(/rgba?\\([^)]*\\)/g)) {",
      "    const hex = hexOf(m[0])",
      "    if (hex) out.push(hex)",
      "  }",
      "  return [...new Set(out)] }",
      "for (const plot of all('[class*=plot]')) {",
      "  const box = plot.getBoundingClientRect()",
      "  if (box.width < 40 || box.height < 40) continue",
      "  let axis = axisOf(plot)",
      "  /* THE AXIS MAY BE ON A CHILD. A bar chart draws its value axis on the grid",
      "     layer inside its rows, because that is where zero actually is. */",
      "  if (!axis) for (const kid of plot.querySelectorAll('*')) { axis = axisOf(kid); if (axis) break }",
      "  if (!axis) continue",
      "  const grid = []",
      "  for (const el of [plot, ...plot.querySelectorAll('*')]) {",
      "    for (const hex of stopsOf(el)) grid.push({ el, hex, how: 'gradient' })",
      "    if (el === plot) continue",
      "    const r = el.getBoundingClientRect()",
      "    if (!r.width || !r.height) continue",
      "    const wide = r.width >= box.width * 0.9 && r.height <= 3",
      "    const tall = r.height >= box.height * 0.9 && r.width <= 3",
      "    if (!wide && !tall) continue",
      "    const paint = hexOf(getComputedStyle(el).backgroundColor)",
      "    if (paint) grid.push({ el, hex: paint, how: 'element' })",
      "  }",
      "  if (!grid.length) continue",
      "  /* A SERIES IS PAINTED TOO, and a bar is not a gridline. Only the lines that",
      "     span the plot and the gradients reach here, so what is left is furniture. */",
      "  const same = grid.filter(g => { const r = ratioOf(g.hex, axis); return r != null && r < 1.02 })",
      "  if (!same.length) continue",
      "  /* A ZERO LINE IS NOT A GRIDLINE. It carries the axis weight on purpose,",
      "     because it is the axis moved off the floor, so a single matching line is",
      "     correct and a gridline SET matching is the fault. */",
      "  if (same.length === 1 && same[0].how === 'element') continue",
      "  fail(name(plot), 'the gridlines inside this plot are painted ' + same[0].hex + ', which is its own axis colour, so the plot reads as a grid of boxes rather than as data on a ground. An axis is the chart outline and a gridline sits UNDER the data: take the gridlines one step quieter than the axis. A single line matching the axis is a zero line and is right to.')",
      "}",    ],
  },

  {
    id: 'a-plot-is-a-shape-not-a-height',
    where: 'render',
    line: 'A chart plot states an aspect ratio, never a height, so it keeps its proportion at every width.',
    /* ── A FIXED HEIGHT GIVES A DIFFERENT PROPORTION AT EVERY WIDTH ──
     *
     * Measured across one set: 3.36:1 to 10.82:1 from a single 140px, so the
     * same chart read as a healthy plot on a wide card and as a strip on a
     * narrow one. A chart is a shape, and its proportion is the shape.
     *
     * THE CHECK IS ABOUT THE DECLARATION, not the measured proportion. A plot
     * whose ratio is correct at this width says nothing about the next one, and
     * that is the whole fault. So it asks whether an `aspect-ratio` is in force
     * and reports the plot that has none.
     *
     * TWO GUARDS, both earned on real shapes. A HORIZONTAL bar chart takes its
     * height from its row count, so a ratio there would crush or stretch the
     * rows; it declares `aspect-ratio: auto` and says so. And a plot inside a
     * grid or flex track that stretches has its height decided by the track,
     * so a ratio is not its to state.
     */
    body: [
      "for (const plot of all('[class*=plot]')) {",
      "  const box = plot.getBoundingClientRect()",
      "  if (box.width < 40 || box.height < 40) continue",
      "  const cs = getComputedStyle(plot)",
      "  /* A ratio IS declared. Nothing to say. */",
      "  if (cs.aspectRatio && cs.aspectRatio !== 'auto') continue",
      "  /* THE ROW-COUNT CASE. A horizontal bar chart is as tall as it has bars,",
      "     and its own class says which type it is. */",
      "  if (plot.closest('[class*=chart-bar]')) continue",
      "  /* A STRETCHED TRACK OWNS THE HEIGHT. Read the parent DECLARATION, not",
      "     the geometry: a stretch container has decided its children fill it. */",
      "  const p = plot.parentElement",
      "  const pcs = p ? getComputedStyle(p) : null",
      "  const stretched = pcs && /flex|grid/.test(pcs.display) &&",
      "    /stretch|normal/.test(cs.alignSelf === 'auto' ? pcs.alignItems : cs.alignSelf)",
      "  if (stretched && px(cs.height) > 0 && !/px/.test(cs.height)) continue",
      "  /* A STATED HEIGHT IS THE FAULT ITSELF. */",
      "  fail(name(plot), 'this plot states a height and no aspect ratio, so it takes a different proportion at every width. Measured across one set, a single fixed height produced 3.36:1 to 10.82:1. Give it an aspect-ratio with a minimum height instead, and cap the box at its track so the floor beats the ratio where the two disagree.')",
      "}",
    ],
  },

  {
    id: 'a-grouped-chart-states-a-ratio',
    where: 'render',
    line: 'A grouped chart keeps at least two to one between the gap inside a group and the gap between groups.',
    /* ── UNDER THE PROXIMITY BAR THE GROUPS DISSOLVE ──
     *
     * A grouped chart is the one arrangement that states a proximity ratio
     * rather than a value: the published pair is the smallest step inside a
     * group against the medium step between them. Under the bar the groups
     * read as one run of bars and the category axis stops meaning anything.
     *
     * ONE BAR FOR THE WHOLE RULE. This demanded three to one while the general
     * proximity rule moved to two on 9 September 2026, and two bars for one
     * rule is how two versions of it end up disagreeing. The shipped chart
     * ratio is 4:1, so it clears either and nothing on screen moves.
     *
     * A CONTROL IS ONE OBJECT AND SO IS A BAR, which is why this reads the
     * GROUP containers rather than every gap on the row. Comparing a bar's own
     * gap against the distance to its neighbour is comparing two different
     * kinds of thing, and that mistake cost a day on a header once.
     *
     * TWO GUARDS. One group is not a run. And a group of one bar has no inner
     * gap, so there is no ratio to take.
     */
    body: [
      "for (const row of all('[class*=chart-grouped] [class*=cols], [class*=chart-grouped] [class*=groups]')) {",
      "  const groups = Array.prototype.filter.call(row.children, el => {",
      "    const r = el.getBoundingClientRect()",
      "    return r.width > 0 && r.height > 0 && el.children.length > 1",
      "  })",
      "  if (groups.length < 2) continue",
      "  const between = px(getComputedStyle(row).columnGap)",
      "  const inner = px(getComputedStyle(groups[0]).columnGap)",
      "  if (!(inner > 0) || !(between > 0)) continue",
      "  if (between / inner >= 2) continue",
      "  fail(name(row), 'this grouped chart puts ' + inner + 'px inside a group and ' + between + 'px between them, a ratio of ' + (between / inner).toFixed(1) + ':1. Under two to one the groups dissolve into one run of bars and the category axis stops meaning anything. Take the between-groups gap up the scale until it clears two to one, and leave the inner gap where it is.')",
      "}",
    ],
  },

  {
    id: 'a-chart-is-named-not-focused',
    where: 'render',
    line: 'A chart takes no focus and answers no keys. It owes a name and a text alternative instead.',
    /* ── A CHART IS A PICTURE OF DATA, NOT A WIDGET ──
     *
     * The keyboard contract says so and nothing measured it. Two faults sit
     * either side of the rule and both ship easily.
     *
     * A plot given a `tabindex` puts a stop in the tab order that answers no
     * key when it is reached, which is worse than no stop at all.
     *
     * A plot with no NAME is a picture a screen reader cannot describe. The
     * exception is a sparkline inside a table row: the row already carries its
     * name and its value in text, so the mark takes `aria-hidden` and a second
     * reading of the same number is noise.
     */
    body: [
      "/* THE FOCUS PASS, over every part of the picture. A tabindex on the",
      "   PLOT is the commonest form of this and the outermost-only guard",
      "   below cannot see it. */",
      "for (const part of all('[class*=chart]')) {",
      "  const tab = part.getAttribute('tabindex')",
      "  if (tab === null || Number(tab) < 0) continue",
      "  /* A CONTROL INSIDE A CHART IS ALLOWED A TAB STOP. A legend that",
      "     filters is a group of buttons, and it answers keys. */",
      "  if (part.matches(CONTROL) || part.getAttribute('role') === 'button') continue",
      "  fail(name(part), 'this is part of a chart, it is in the tab order, and it answers no key when a reader reaches it. That is worse than not being reachable. A chart is a picture of data: no focus, no keys. Take the tabindex off and give the chart a name instead. Where the chart has controls, put the tab stops on those.')",
      "}",
      "for (const chart of all('[class*=chart]')) {",
      "  const box = chart.getBoundingClientRect()",
      "  if (box.width < 40 || box.height < 24) continue",
      "  /* ONE ELEMENT PER CHART. A frame inside a chart inside a card would",
      "     otherwise report the same picture three times. */",
      "  if (chart.parentElement && chart.parentElement.closest('[class*=chart]')) continue",

      "  if (chart.getAttribute('aria-hidden') === 'true') continue",
      "  /* ── A CHART ANNOUNCING A STATE IS NOT A PICTURE OF DATA ──",
      "     Two of them, and both are correct code that this faulted first.",
      "     A LOADING placeholder carries role=status and aria-busy, and its",
      "     shapes are already aria-hidden: naming it as a picture would",
      "     describe data that is not there yet. An EMPTY or NO-RESULTS chart",
      "     holds a message and an action, and role=img would make both",
      "     presentational and silence the only thing worth reading. Ask the",
      "     PROPERTY: a live region says so, and an offered action is a",
      "     control. */",
      "  if (/^(status|alert|progressbar)$/.test(chart.getAttribute('role') || '')) continue",
      "  if (chart.getAttribute('aria-busy') === 'true') continue",
      "  if (chart.querySelector(CONTROL)) continue",
      "  /* A SPARKLINE IN A ROW IS DELIBERATELY SILENT, because the row already",
      "     says its name and its value in words. */",
      "  /* ── A LEGEND IS TEXT, AND ITS WORDS ARE THE ALTERNATIVE ──",
      "     role=img would make every one of those words presentational, which is",
      "     the same fault as putting it on an empty state. Measured on one",
      "     dashboard: the key paints 1% of its own box (five 8px dots and their",
      "     labels) and the strip beside it paints 100%. Nothing sits near 10. */",
      "  const ownBox = chart.getBoundingClientRect()",
      "  let painted = 0",
      "  for (const kid of chart.querySelectorAll('*')) {",
      "    const bg = getComputedStyle(kid).backgroundColor",
      "    if (!opaque(bg)) continue",
      "    const b = kid.getBoundingClientRect()",
      "    painted += b.width * b.height",
      "  }",
      "  const area = ownBox.width * ownBox.height",
      "  if (area > 0 && painted / area < 0.1 && hasWords(chart)) continue",
      "  /* TWO CALLS, NOT A LIST WHOSE RESULT IS KEPT. A selector list picks",
      "     whichever ancestor the markup happens to put nearest, and that is a",
      "     property of the code being audited rather than a decision here. The",
      "     two spell one thing, so the precedence is stated instead. */",
      "  const row = chart.closest('tr') || chart.closest('[role=row]')",
      "  if (row && hasWords(row)) continue",
      "  const named = chart.getAttribute('aria-label') || chart.getAttribute('aria-labelledby')",
      "    || (chart.getAttribute('role') === 'img' && hasWords(chart))",
      "  const figure = chart.closest('figure')",
      "  if (named || (figure && figure.querySelector('figcaption'))) continue",
      "  /* A TABLE BESIDE THE CHART IS THE TEXT ALTERNATIVE, and it is the best",
      "     one. A picture whose figures are also in a table needs nothing. */",
      "  const near = chart.parentElement",
      "  if (near && near.querySelector('table')) continue",
      "  fail(name(chart), 'this chart carries no name, so a screen reader has a picture it cannot describe. Give it role=img with an aria-label carrying the figures, or put a table beside it, or wrap it in a figure with a figcaption. A sparkline inside a table row is the one exception and takes aria-hidden, because the row already says its name and value in text.')",
      "}",
    ],
  },

  {
    id: 'meaning-never-rests-on-colour-alone',
    where: 'render',
    line: 'A marker that names a meaning carries a word or a shape as well as a hue.',
    /* ── A GREEN SUCCESS AND A RED DANGER ARE ONE COLOUR TO MANY READERS ──
     *
     * Under red-green vision loss only lightness and the blue-yellow axis
     * survive. Two status roles usually sit on the same ramp step, so their
     * lightness is identical by construction. Simulated at full severity, a
     * 148-degree green and a 30-degree red become #595027 and #5d531d: the
     * same olive twice.
     *
     * Measured across eleven surfaces: 36 elements carry a semantic class,
     * and none rests on its hue alone. So this is quiet on a real sample.
     *
     * THREE WAYS TO SURVIVE, each a declaration rather than a guess. Its own
     * words. A glyph, which is a shape. Or words beside it, because a legend
     * dot is labelled by its own row.
     */
    body: [
      "/* A class that names a MEANING. The element is claiming to say something,",
      "   and a reader who cannot separate two hues has to be able to read it. */",
      "const SEMANTIC = /(^|[^a-z])(success|warning|danger|error|positive|negative|caution|critical)([^a-z]|$)/",
      "for (const el of all('*')) {",
      "  const cls = el.getAttribute('class') || ''",
      "  if (!SEMANTIC.test(cls)) continue",
      "  const cs = getComputedStyle(el)",
      "  /* ── ONLY A MARKER, which is something that paints its own fill or edge.",
      "     A wrapper carrying the word in its class name paints nothing and says",
      "     nothing, so it is not what a reader is looking at. */",
      "  const marks = cs.backgroundColor !== 'rgba(0, 0, 0, 0)'",
      "    || cs.backgroundImage !== 'none' || px(cs.borderTopWidth) > 0",
      "  if (!marks) continue",
      "  /* ── THREE WAYS TO SURVIVE THE LOSS OF A HUE ──",
      "     Its own words. A glyph, which is a shape rather than a colour. Or words",
      "     BESIDE it: a legend dot is labelled by the row it sits in, and that is",
      "     what makes the picture certain. */",
      "  if ((el.textContent || '').trim()) continue",
      "  if (el.querySelector('svg')) continue",
      "  const near = el.parentElement ? (el.parentElement.textContent || '').trim() : ''",
      "  if (near) continue",
      "  fail(name(el),",
      "    'this marker says ' + cls + ' and carries no words, no glyph and no label beside it, so its meaning rests on its hue alone. No categorical palette survives the loss of red-green vision, so a green success and a red danger land in the same place on the axis that is left. Give it a shape or a word: the colour makes the picture readable and the label makes it certain.')",
      "}",
    ],
  },
  {
    id: 'a-marked-item-says-so',
    where: 'render',
    line: 'The chosen item in a nav or a strip declares aria-current or aria-selected, not only a colour.',
    /* ── PAINT IS NOT A STATE ──
     *
     * Found in this system's own preview, and it had been there from the
     * start. A tab strip marked its chosen tab with an inset shadow and a
     * heavier weight, and carried no attribute and no class. Two consequences,
     * and the second is the expensive one.
     *
     * A screen reader is never told which tab is current.
     *
     * And the forced-colors rule written to save that mark keyed on a class
     * the preview has never had. Measured across eleven surfaces: zero
     * matches. So in Windows High Contrast, which ignores box-shadow outright,
     * the selected tab lost its only marker on every screen, and the rule that
     * existed to prevent exactly that could not fire.
     *
     * READ THE PAINT, NOT A CLASS NAME. The question is whether one item in a
     * run LOOKS different from the rest, and only the computed style answers
     * it. Comparing class names would approve any mark nobody thought of.
     *
     * THREE GUARDS, or it fires on correct code. A run of two has no majority,
     * so nothing can be the odd one out. More than one item differing is a
     * layout with several kinds of item in it, not a marked one. And a
     * container that is not navigation is somebody's card list. */
    body: [
      "const RUNS = 'nav, [role=\"tablist\"], [role=\"menu\"], [role=\"menubar\"], [role=\"tree\"]'",
      "const PAINT = ['fontWeight', 'color', 'backgroundColor', 'boxShadow', 'borderBottomColor', 'borderBottomWidth']",
      "const SAYS = '[aria-current], [aria-selected], [aria-checked], [aria-pressed]'",
      "for (const run of all(RUNS)) {",
      "  const kids = Array.prototype.filter.call(run.children, function (el) {",
      "    const r = el.getBoundingClientRect()",
      "    return r.width > 0 && r.height > 0",
      "  })",
      "  if (kids.length < 3) continue",
      "  const styles = kids.map(function (el) { return getComputedStyle(el) })",
      "  /* The signature of each item across every property that paints. */",
      "  const sigs = styles.map(function (cs) { return PAINT.map(function (p) { return cs[p] }).join('|') })",
      "  const tally = {}",
      "  for (const s of sigs) tally[s] = (tally[s] || 0) + 1",
      "  const odd = sigs.map(function (s, i) { return tally[s] === 1 ? i : -1 }).filter(function (i) { return i >= 0 })",
      "  if (odd.length !== 1) continue",
      "  const el = kids[odd[0]]",
      "  /* A DIFFERENT KIND OF ITEM IS NOT A MARKED ONE, and the tag says which.",
      "     Measured on a real landing nav: a title span, two link items and a",
      "     filled call-to-action button. The button is the only thing painted",
      "     differently and it is not the current destination, so this reported a",
      "     correct nav. A marked item is one of a run of like things, so its tag",
      "     appears more than once. A tag appearing exactly once is a CTA, a",
      "     title, or a search box that happens to sit in the same bar. */",
      "  const sameKind = kids.filter(function (k) { return k.tagName === el.tagName }).length",
      "  if (sameKind < 2) continue",
      "  if (el.matches(SAYS) || el.closest(SAYS) === el) continue",
      "  /* A control INSIDE the item may carry the state instead. */",
      "  if (el.querySelector(SAYS)) continue",
      "  fail(name(el), 'this is the only item in its run that is painted differently, so it reads as the chosen one, and it declares nothing. A screen reader is never told. Worse, a mark drawn with a shadow or a background disappears under forced colors, and the rule that restores it has to key on a state. Add aria-current=\"page\" where the run is navigation, or aria-selected where it is a tablist.')",
      "}",
    ],
  },

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
      /* ── A SPECIMEN SHEET IS EXEMPT, AND THIS CHECK HAD NO EXEMPTION ──
       *
       * A row whose job is to show three button sizes cannot be faulted for
       * showing three button sizes. Measured on the component gallery over 12
       * surfaces at 13 widths: one finding, reading 28, 36, 44, 36, 36, which
       * is the published size scale rendered side by side on purpose.
       *
       * Two markers, and both are declarations the sheet already carries: a
       * `[data-specimen]` ancestor, or a row that holds its own `.row-label`.
       * The proximity check uses the same pair, so the two agree about what a
       * specimen is. */
      "const isSpecimenRow = el => !!(el.closest('[data-specimen]')",
      "  || el.querySelector(':scope > .row-label, :scope > * > .row-label'))",
      "for (const row of rows()) {",
      "  if (isSpecimenRow(row.parent)) continue",
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
      "  /* ── A CHECKBOX BOX IS NOT AN ICON BESIDE A LABEL ──",
      "     The reader sees the BOX, and the tick inside it is ornament. Its size",
      "     answers to control sizing, the 24px minimum and the 44px target, never",
      "     to the cap band. A drawn box is filled and square, so the mark finder",
      "     picks it up: 5 findings on this app and every one a checkbox.",
      "     The test is a SIBLING native input, which is exact. A container",
      "     holding one IS the control's own row. */",
      "  /* ASK THE HOLDER, NOT THE MARK'S PARENT. The tick is an svg INSIDE the",
      "     drawn box, and the mark finder takes an svg first, so its parent is",
      "     that box and holds no input. Two findings survived the narrower test.",
      "     A holder containing a native checkbox or radio IS that control's row,",
      "     and nothing in it is an icon beside a label. */",
      "  if (el.querySelector('input[type=checkbox], input[type=radio]')) continue",
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
      /* ASK WHETHER IT SHOWS WORDS, not whether it holds a direct text node.
         See hasWords: a <span>-wrapped label made textRect return null and sent
         eight labelled controls down this label-less branch. */
      "  if (hasWords(el)) continue   /* it has a label; the cap band rule owns it */",
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
      /* THE HEADING HAS TO SIT ON THE SAME MARGIN, OR THERE IS NOTHING TO
         LINE UP WITH. A table inside a card, under a section heading outside
         it, is a normal arrangement: the card padding is a decision, not a
         stray cell inset. This faulted one at 33px on a correct page. Ask
         whether the two share a padded box, which is the property that
         decides it. */
      "  const first = table.querySelector('tr > *:first-child')",
      "  if (!first) continue",
      "  const box = padded(first), headBox = padded(head)",
      "  if (!box || !headBox || box.el !== headBox.el) continue",
      /* ── THE SELECTION COLUMN IS THE DOCUMENTED EXCEPTION ──
       *
       * A column that carries the selected row's accent bar cannot also sit
       * flush, because the bar would paint over whatever is in the cell. That
       * column reserves the bar plus a step, on every row, and DESIGN.md says
       * so under `table-selection-cell`.
       *
       * This check did not know, so a build that obeyed both rules was
       * faulted for a 24px inset it was told to have. A rule with an exception
       * the checker has not been taught is a rule that fails on correct code. */
      "  if (table.querySelector('tbody td:first-child input[type=\"checkbox\"], tbody td:first-child [role=\"checkbox\"]')) continue",
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
    /* Shipped only when RTL Optimizations is on. The rule is about the START
       edge, and this check reads `left`, which is the start edge in one
       direction out of two. Under `dir="rtl"` it would compare a table's right
       edge against a heading's left and report every correct table as being a
       column-width out. */
    rtlBody: [
      "for (const table of all('table')) {",
      "  let host = table.parentElement, head = null",
      "  for (let i = 0; i < 4 && host && !head; i++) {",
      "    head = Array.prototype.find.call(host.querySelectorAll('h1,h2,h3,h4,h5,h6'), h => !table.contains(h))",
      "    if (!head) host = host.parentElement",
      "  }",
      "  if (!head) continue",
      /* THE HEADING HAS TO SIT ON THE SAME MARGIN, OR THERE IS NOTHING TO
         LINE UP WITH. A table inside a card, under a section heading outside
         it, is a normal arrangement: the card padding is a decision, not a
         stray cell inset. This faulted one at 33px on a correct page. Ask
         whether the two share a padded box, which is the property that
         decides it. */
      "  const first = table.querySelector('tr > *:first-child')",
      "  if (!first) continue",
      "  const box = padded(first), headBox = padded(head)",
      "  if (!box || !headBox || box.el !== headBox.el) continue",
      "  if (table.querySelector('tbody td:first-child input[type=\"checkbox\"], tbody td:first-child [role=\"checkbox\"]')) continue",
      "  const paints = Array.prototype.filter.call(",
      "    first.querySelectorAll('svg, img, [class*=box], [class*=avatar], [class*=dot]'),",
      "    n => { const cs = getComputedStyle(n), b = n.getBoundingClientRect()",
      "           return cs.opacity !== '0' && cs.visibility !== 'hidden' && b.width > 2 && b.height > 2 })",
      "  /* ASK THE ELEMENT WHICH WAY IT RUNS. A table and the heading above it",
      "     can differ: a page in Arabic may hold a table of Latin identifiers",
      "     that is deliberately left to right. Each is read on its own. */",
      "  const startOf = el => {",
      "    const r = el.getBoundingClientRect()",
      "    return getComputedStyle(el).direction === 'rtl' ? r.right : r.left",
      "  }",
      "  const rtl = getComputedStyle(table).direction === 'rtl'",
      "  const box = inner(first)",
      "  const edge = paints.length ? startOf(paints[0]) : (rtl ? box.right : box.left)",
      "  /* Signed INWARD, so a positive number means the same thing either way. */",
      "  const d = (rtl ? -1 : 1) * (edge - startOf(head))",
      "  if (Math.abs(d) > 0.5)",
      "    fail(name(table), 'the first column starts ' + round(d) + 'px off the margin set by ' + name(head) + ' above it, measured from the START edge because this runs ' + (rtl ? 'right to left' : 'left to right') + '. Zero the outer cell padding rather than letting it add to the container own.')",
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
    id: 'target-floor-for-the-pointer',
    where: 'render',
    line: 'Every control clears the published minimum for the pointer in use, as a whole row.',
    /* IT USED TO SKIP ON A MOUSE ENTIRELY, so a build opened on a desktop was
     * never measured against any minimum. The reason was sound at the time:
     * the system published one target, 44, and applying a finger's number to
     * a mouse reports every correct control in the product. A rule that fires
     * everywhere says nothing about anywhere.
     *
     * The system publishes BOTH now, so the floor is chosen rather than
     * skipped. `--target-min` for a finger; `--target-min-pointer` for a
     * mouse, which is WCAG 2.5.8 Target Size (Minimum) at AA.
     *
     * Ask the POINTER, never the width. A narrow window on a desktop is not a
     * finger, and reading the viewport is what made the old version of this
     * check unusable. */
    body: [
      "const coarse = matchMedia('(pointer: coarse)').matches",
      "const floor = coarse",
      "  ? px(tokenValue('--target-min') || '44px')",
      "  : px(tokenValue('--target-min-pointer') || '24px')",
      "for (const el of all('button, a[href], input, select, [role=button]')) {",
      "  if (clippedAway(el)) continue   /* its label is the hit area */",
      "  const r = el.getBoundingClientRect(); if (!r.width) continue",
      "  if (r.height < floor - 0.5 || r.width < floor - 0.5)",
      "    fail(name(el), round(r.width) + 'x' + round(r.height) + ' under the ' + floor + 'px floor for a ' + (coarse ? 'coarse' : 'fine') + ' pointer. Promote the whole row, never one control in it.')",
      "}",
    ],
  },

  {
    id: 'the-toggle-actually-toggles',
    /* Only exists when the document ships two themes. A single-theme package
       has no control to state, no attribute to keep out of the markup and
       nothing to press. */
    needs: 'themeToggle',
    where: 'render',
    line: 'Pressing the theme control changes the painted page. Press it and read the result.',
    /* ── IT PRESSED A CONTROL THAT ITS OWN PRESS DESTROYS ──
     *
     * Two defects, and together they made the run report a working toggle
     * as dead and left the page in the other theme.
     *
     * THE PRESS REPLACES THE ELEMENT. The control re-renders, so a held
     * reference is detached: getComputedStyle on it returns empty strings,
     * and the second click lands on nothing. So the restore never happened.
     * Measured: the theme before a run was dark at rgb(14, 23, 32) and
     * light at rgb(213, 221, 228) after it. Every check ordered later
     * measured the other theme, which is why a finding could appear and
     * vanish between two runs of the same build.
     *
     * AND `document.body` IS NOT ALWAYS THE PAINTED SUBJECT. An app hosting
     * a preview themes the preview scope, not its own body. Measured on this
     * app: the body read rgb(9, 10, 11) before and after, on six presses,
     * while the label went from "Light theme is on" to "Dark theme is on".
     * 9 findings over nine surfaces, every one a working control.
     *
     * So RE-FIND the control by selector before every press, and compare a
     * bounded FINGERPRINT of the painted page rather than one node. Proven:
     * the press changes the fingerprint and one further press restores it.
     *
     * ── THIS READ ONE FRAME INTO A TRANSITION, AND CALLED IT DEAD ──
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
     *
     * `settle()` asks the browser which animations are running and waits
     * for them, so it costs nothing when the switch is instant and cannot
     * be short when it is not. Never lengthen the guess instead. */
    body: [
      "const SEL = \"[aria-pressed][aria-label*=heme], #dmd-dark, [data-theme-toggle], #theme-toggle\"",
      "/* NEVER HOLD THE REFERENCE. The press re-renders the control. */",
      "const find = () => document.querySelector(SEL)",
      "/* NO CONTROL ON THIS PAGE IS NOT A FAULT. A build puts one in a shared",
      "   header, and a page without it has nothing to press. Demanding one per",
      "   page reported 6 of 9 preview surfaces, every one correct. The SOURCE",
      "   check asks whether the build ships a control at all. */",
      "if (!find()) { note(\"no theme control on this page, so there was nothing to press.\") }",
      "else {",
      "  /* A FINGERPRINT OF THE PAINTED PAGE, because the themed scope may be the",
      "     preview root rather than the body. Bounded, so it costs one pass. */",
      "  const paint = () => {",
      "    const els = [document.documentElement, document.body]",
      "      .concat(Array.prototype.slice.call(document.querySelectorAll(\"[class]\"), 0, 60))",
      "    return els.map(e => {",
      "      const cs = getComputedStyle(e)",
      "      return cs.backgroundColor + \" \" + cs.color",
      "    }).join(\";\")",
      "  }",
      "  const before = paint()",
      "  find().click(); await settle(1200)",
      "  const after = paint()",
      "  if (before === after) {",
      "    fail(name(find()), \"a press changed nothing. Every painted colour on the page is identical before and after.\")",
      "  }",
      "  /* PUT IT BACK, or every check after this one measures the other theme. A",
      "     three-way field does not return on one press, so press until it does. */",
      "  let tries = 0",
      "  while (paint() !== before && tries < 3) {",
      "    const again = find()",
      "    if (!again) break",
      "    again.click(); await settle(1200); tries++",
      "  }",
      "  if (paint() !== before) {",
      "    note(\"the theme control did not return to its starting state after \" + tries",
      "      + \" press(es), so any check ordered after this one measured a different theme.\")",
      "  }",
      "  const btn = find()",
      "  const statesItself = !btn || btn.getAttribute(\"aria-pressed\") != null ||",
      "    (btn.tagName === \"INPUT\" && btn.type === \"checkbox\") || btn.getAttribute(\"aria-checked\") != null",
      "  if (!statesItself) {",
      "    fail(name(btn), \"the control never says which theme is on. Give a button aria-pressed, or use a checkbox, which states it natively.\")",
      "  }",
      "}",    ],
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
      /* ── COLLAPSED ON PURPOSE IS A STATE, NOT A CASUALTY ──
         A fold clips its contents while it is shut, which is how a fold works.
         The system's own navigation collapse does exactly that: the list stays
         laid out and the box goes to `grid-template-rows: 0fr`.

         Measured on one build: a five-item rail behind a burger reported five
         findings, at 37.83 to 237.14px, on correct code. There is no remedy,
         because the remedy is to open the menu.

         Ask the PROPERTY rather than the class. A box collapsed to nothing on
         one axis is shut. A box with real height that still cuts its content
         is the fault this check exists for, and it still reports. */
      "  const shutBox = el.getBoundingClientRect()",
      "  if (shutBox.height <= 1 || shutBox.width <= 1) continue",
      /* And the same for an ancestor: the fold is the collapsed box, while the
         thing doing the clipping can be the list inside it. */
      "  let shutAbove = false",
      "  for (let a = el.parentElement, up = 0; a && up < 4; a = a.parentElement, up++) {",
      "    const r = a.getBoundingClientRect()",
      "    if (r.height <= 1 || r.width <= 1) { shutAbove = true; break }",
      "  }",
      "  if (shutAbove) continue",
      "  /* A NATIVE CONTROL DRAWS ITS OWN LIST, AND THE ENGINE OWNS IT. A select",
      "     lays every option out inside a one-line box, so each one measures as",
      "     content cut off by a box that does not scroll. Nothing is unreachable:",
      "     the engine opens the list. Measured on one surface: 4 findings inside",
      "     the document and 967 options on the page. */",
      "  if (el.matches('select, datalist, optgroup')) continue",
      "  const box = el.getBoundingClientRect()",
      /* ── A CHILD THE ENGINE DOES NOT RENDER IS NOT CLIPPED CONTENT ──
       *
       * This walked `el.children` raw, so the harness's paint filter never
       * reached them. A `display: none` child has an EMPTY rect, which is
       * 0,0,0,0 — not "nowhere", but the viewport ORIGIN. So
       * `box.left - k.left` came out as the box's own distance from the left
       * edge of the screen, and the check reported that as content cut off.
       *
       * Measured over 12 surfaces at 13 widths: three findings, on Dashboard,
       * Landing and Settings, all the same `span.caption.nav-title`. It reads
       * 777px on two and 1422.13px on the third, and those are exactly where
       * each nav list sits. The label is hidden on purpose at those widths: a
       * section name belongs inside the folded menu with the links it names.
       *
       * A GENUINELY CLIPPED CHILD STILL HAS A REAL RECT, because
       * `getBoundingClientRect` returns the layout box rather than the visible
       * part of it. So filtering on paint costs the check nothing and removes
       * the whole class. Same shape as one filter serving two questions: the
       * ghost pass needs the invisible and this one must not see it. */
      "  for (const kid of el.children) {",
      "    if (!visible(kid)) continue",
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
      /* WALK TO THE ROOT. A six-level cap gave up inside a table, and the
         check then approved the element, which is "no answer" read as "no".
         Measured: an avatar on an unselected row had a transparent td, tr,
         tbody, table and scroller above it, so the card was the seventh
         ancestor and the walk returned nothing. The fault was worst on exactly
         those rows. A page always has a painted root, so this always answers. */
      "  let node = el.parentElement, ground = null",
      "  for (; node; node = node.parentElement) {",
      "    const g = hexOf(getComputedStyle(node).backgroundColor)",
      "    if (g) { ground = g; break }",
      "  }",
      "  if (!ground) continue",
      "  const a = lum(own), b = lum(ground)",
      "  if (a == null || b == null) continue",
      "  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)",
      /* THE FILL IS ONE OF THREE TREATMENTS THIS SYSTEM OFFERS, and demanding
         it faults the other two. A document may mark a selection by its fill,
         by a lightness step, or by a lightness step plus an accent bar. Where
         the bar does the marking the fill is DELIBERATELY the ground's, so a
         fill-only question reports correct code and offers no remedy.

         Measured on one build: an active nav item read 1.00:1 against its own
         container while carrying a 4px accent bar and brighter text. Its
         document had chosen `lift-edge`.

         So ask whether ANYTHING marks it. A bar is an inset shadow on the
         start edge, or an absolutely placed start-edge pseudo-element, which
         are the two mechanisms the system publishes. */
      "  const barred = /inset/.test(cs.boxShadow || '')",
      "    || (() => { const b = getComputedStyle(el, '::before')",
      "         return !!b && b.content !== 'none' && (b.position === 'absolute' || b.position === 'fixed')",
      "           && !!b.backgroundColor && b.backgroundColor !== 'rgba(0, 0, 0, 0)'",
      "           && (parseFloat(b.left) === 0 || parseFloat(b.right) === 0) })()",
      "  if (barred) continue",
      "  if (ratio < 1.06)",
      "    fail(name(el), 'this row is marked and its fill reads ' + ratio.toFixed(2) + ':1 against the ground behind it, so nothing shows. A selection has to be found rather than noticed once you are already looking. Step the fill off the surface, and give the mark a second channel: an edge, or a full-strength label.')",
      "}",
    ],
  },

  {
    id: 'a-stripe-is-rhythm-and-a-selection-is-a-choice',
    where: 'render',
    line: 'A row stripe is the softest step available, and a selected row stands further off the surface than the stripe does.',
    /* ── THE ORDER OF THE THREE PLANES ON ONE ROW ──
     *
     * Three roles stack on a table row and nothing measured the relationship
     * between them. A collision check asks whether two of them resolved to ONE
     * colour, which is the loudest form of this fault and not the common one.
     *
     * The common one is the ORDER. A stripe carries the rhythm, so it takes
     * the softest step the ramp holds; a selection has to be FOUND, so it
     * stands one step further out. Invert the two and every other row competes
     * with the one the reader picked, while both numbers stay individually
     * legal. No contrast check has an opinion, because a ratio measures one
     * colour against one other.
     *
     * READ THE ALTERNATION, NEVER A CLASS NAME. A stripe is not a name, it is
     * a fill on every other row, and the computed style is the only thing that
     * knows. Asking for a class would approve any striping nobody thought of
     * and fault a table whose class means something else.
     *
     * FOUR GUARDS, and each is a case this fired on before it had them.
     * A run of three cannot show an alternation. A marked row breaks the
     * alternation, so it is measured and never counted as a stripe. A run
     * where every row paints the same colour is not striped at all, which is
     * the plain ruled table and the commonest shape on any page. And a run
     * carrying more than two fills is a list of cards, not a stripe.
     *
     * Measured on the shipped palette: the stripe reads 1.04:1 against the
     * surface in light and 1.06 in dark, the selection 1.15 and 1.22. The
     * arrangement it rejects measured 1.48 and 1.33 with the order inverted.
     */
    body: [
      "const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)",
      "  if (!c || c.length < 3) return null",
      "  const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255",
      "    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })",
      "  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }",
      "const hexOf = rgb => { const m = /rgba?\\(([^)]*)\\)/.exec(rgb || \'\')",
      "  if (!m) return null",
      "  const p = m[1].split(',').map(s => parseFloat(s))",
      "  if (p.length < 3 || p.some(n => !isFinite(n))) return null",
      "  if (p.length > 3 && p[3] === 0) return null",
      "  return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }",
      "const ratioOf = (a, b) => { const x = lum(a), y = lum(b)",
      "  if (x == null || y == null) return null",
      "  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }",
      "const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }",
      "const fillOf = (el, ground) => {",
      "  const own = hexOf(getComputedStyle(el).backgroundColor)",
      "  if (own) return own",
      "  const cells = Array.prototype.filter.call(el.children, shown)",
      "  if (!cells.length) return ground",
      "  const each = cells.map(c => hexOf(getComputedStyle(c).backgroundColor))",
      "  if (each.some(v => !v)) return ground",
      "  return each.every(v => v === each[0]) ? each[0] : ground",
      "}",
      "const CHOSEN = el => el.matches('[aria-selected=true], [aria-current]')",
      "  || !!el.querySelector('[aria-checked=true], input:checked')",
      "for (const run of all('*')) {",
      "  const kids = Array.prototype.filter.call(run.children, shown)",
      "  if (kids.length < 4) continue",
      "  if (!kids.every(k => k.tagName === kids[0].tagName)) continue",
      "  let ground = null",
      "  for (let n = run; n && !ground; n = n.parentElement) ground = hexOf(getComputedStyle(n).backgroundColor)",
      "  if (!ground) continue",
      "  const fills = kids.map(k => fillOf(k, ground))",
      "  const plain = kids.map((k, i) => CHOSEN(k) ? -1 : i).filter(i => i >= 0)",
      "  if (!plain.some(i => fills[i] === ground)) continue",
      "  const others = [...new Set(plain.map(i => fills[i]).filter(f => f !== ground))]",
      "  if (others.length !== 1) continue",
      "  const stripe = others[0]",
      "  const at = plain.filter(i => fills[i] === stripe)",
      "  if (at.length * 3 < kids.length) continue",
      "  if (!at.every(i => i % 2 === at[0] % 2)) continue",
      "  const step = ratioOf(stripe, ground)",
      "  if (step == null) continue",
      "  if (step >= 1.6)",
      "    fail(name(run), 'every other row in this run is filled ' + step.toFixed(2) + ':1 off the ground behind it, which divides the table into blocks rather than grouping its rows. A stripe is rhythm: take it to the softest step the palette publishes, and put a selected row one step further out rather than raising the stripe to reach it.')",
      "  for (let i = 0; i < kids.length; i++) {",
      "    if (!CHOSEN(kids[i])) continue",
      "    const own = fills[i]",
      "    if (own === ground || own === stripe) continue",
      "    const mine = ratioOf(own, ground), gap = ratioOf(own, stripe)",
      "    if (mine == null || gap == null) continue",
      "    if (mine <= step)",
      "      fail(name(kids[i]), 'this row is chosen and reads ' + mine.toFixed(2) + ':1 against the ground, while the plain stripe beside it reads ' + step.toFixed(2) + '. The rhythm is louder than the choice, so every other row competes with the one the reader picked. Step the selection further off the surface than the stripe, and leave the stripe where it is.')",
      "    else if (gap >= 1.5)",
      "      fail(name(kids[i]), 'this row is chosen and sits ' + gap.toFixed(2) + ':1 off the stripe beside it, which is two steps rather than one. Selected rows then read as darkened rather than as chosen, and a table with several picked reads heavy. Close it to one step and let the accent edge and the row checkbox carry the rest of the marking.')",
      "  }",
      "}",    ],
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
      "/* ── TWO MECHANISMS DRAW THIS BAR, AND ASKING ABOUT ONE IS BLINDNESS ──",
      "   An inset shadow is right where nothing crosses the row. Inside a RULED",
      "   set it is wrong: the border paints on top of it, so the bar stops one",
      "   hairline short at every boundary. There the bar is a pseudo-element",
      "   stretched past each end. A check that asks only about box-shadow goes",
      "   silent the moment a build does the correct thing. */",
      "const pseudoBar = el => {",
      "  const b = getComputedStyle(el, '::before')",
      "  if (!b || b.content === 'none') return 0",
      "  if (b.position !== 'absolute' && b.position !== 'fixed') return 0",
      "  if (!b.backgroundColor || b.backgroundColor === 'rgba(0, 0, 0, 0)') return 0",
      "  const w = parseFloat(b.width) || 0",
      "  /* On the START edge, and narrow enough to be a bar rather than a wash. */",
      "  const atStart = parseFloat(b.left) === 0 || parseFloat(b.right) === 0",
      "  const host = el.getBoundingClientRect().width",
      "  return (atStart && w > 0 && w <= host / 4) ? w : 0",
      "}",
      "const edgeOf = el => { const cs = getComputedStyle(el)",
      "  const r = el.getBoundingClientRect()",
      "  return { left: r.left, inset: r.left + (parseFloat(cs.paddingLeft) || 0), bar: Math.max(barPx(cs.boxShadow), pseudoBar(el)) } }",
      /* ── TWO QUESTIONS, AND THE FIRST ONE ALLOWS NOTHING ──
       *
       * A first version let the marked row sit up to the bar's width further
       * in, on the reasoning that the published padding stated that sum. The
       * sum was the fault. Adding the bar to the selected row alone staggers
       * the column by the bar's width, every time: measured on a nav list of
       * five, the selected label at 693 and its four siblings at 689.
       *
       * So the gutter belongs to the BASE, every row reserves it, and the
       * insets must match exactly. Then ask the second question: does the bar
       * have clear space after it? A build with the gutter collapsed put a
       * 4px bar against a 16px checked box, both in the accent, and the two
       * fused into one shape. */
      "const jog = (el, mark, plain, w) => {",
      "  if (Math.abs(mark.left - plain.left) > 1) return",
      "  const cost = mark.inset - plain.inset",
      "  if (Math.abs(cost) > 1)",
      "    fail(name(el), 'this row carries a ' + w + 'px selection edge and its content starts ' + cost.toFixed(1) + 'px further in than the row beside it, so the column staggers. Reserve the bar gutter in the BASE padding, which every row of the column takes, rather than adding the bar to the selected row alone.')",
      "  const clear = mark.inset - (mark.left + w)",
      "  if (clear < 4)",
      "    fail(name(el), 'a ' + w + 'px selection edge sits ' + clear.toFixed(1) + 'px from the first thing in the row, so the two read as one shape. That is worst where the content is an ornament in the accent colour, such as a checked box. Give the gutter the bar plus a step off the spacing scale.')",
      "}",
      "for (const tb of all('table')) {",
      "  let mark = null, plain = null, w = 0, cell = null",
      "  for (const r of tb.querySelectorAll('tr')) {",
      "    const td = r.querySelector('td')",
      "    if (!td) continue",
      "    const m = edgeOf(td)",
      "    const bar = Math.max(m.bar, barPx(getComputedStyle(r).boxShadow), pseudoBar(r))",
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
    /* Shipped only when RTL Optimizations is on. A selection edge is drawn on
       the START of the row, and the body above finds it by reading `left` and
       `padding-left`. Under `dir="rtl"` the bar is on the right, so every
       correct selected row would report its whole padding as a jog. */
    rtlBody: [
      "const barPx = s => { if (!s || s === 'none' || !/inset/.test(s)) return 0",
      "  const m = s.replace(/rgba?\\([^)]*\\)/g, '').match(/(-?[\\d.]+)px/)",
      "  return m ? Math.abs(parseFloat(m[1])) : 0 }",
      "/* Two mechanisms draw this bar. See the note in the plain body: an inset",
      "   shadow suits a row nothing crosses, and a pseudo-element is the only",
      "   thing that can paint over a row rule. Asking about one is blindness. */",
      "const pseudoBar = el => {",
      "  const b = getComputedStyle(el, '::before')",
      "  if (!b || b.content === 'none') return 0",
      "  if (b.position !== 'absolute' && b.position !== 'fixed') return 0",
      "  if (!b.backgroundColor || b.backgroundColor === 'rgba(0, 0, 0, 0)') return 0",
      "  const w = parseFloat(b.width) || 0",
      "  const atStart = parseFloat(b.left) === 0 || parseFloat(b.right) === 0",
      "  const host = el.getBoundingClientRect().width",
      "  return (atStart && w > 0 && w <= host / 4) ? w : 0",
      "}",
      "/* Everything below is measured INWARD from the start edge, so one piece",
      "   of arithmetic serves both directions and no comparison flips sign. */",
      "const edgeOf = el => { const cs = getComputedStyle(el)",
      "  const r = el.getBoundingClientRect()",
      "  const rtl = cs.direction === 'rtl'",
      "  const dir = rtl ? -1 : 1",
      "  const startX = rtl ? r.right : r.left",
      "  const padStart = parseFloat(rtl ? cs.paddingRight : cs.paddingLeft) || 0",
      "  return { startX, dir, padStart, insetX: startX + dir * padStart, bar: Math.max(barPx(cs.boxShadow), pseudoBar(el)) } }",
      "const jog = (el, mark, plain, w) => {",
      "  if (Math.abs(mark.startX - plain.startX) > 1) return",
      "  const cost = mark.dir * (mark.insetX - plain.insetX)",
      "  if (Math.abs(cost) > 1)",
      "    fail(name(el), 'this row carries a ' + w + 'px selection edge and its content starts ' + cost.toFixed(1) + 'px further in than the row beside it, so the column staggers. Reserve the bar gutter in the BASE padding, which every row of the column takes, rather than adding the bar to the selected row alone.')",
      "  /* The clear distance is the start padding less the bar, which needs no",
      "     direction at all once the padding is the start one. */",
      "  const clear = mark.padStart - w",
      "  if (clear < 4)",
      "    fail(name(el), 'a ' + w + 'px selection edge sits ' + clear.toFixed(1) + 'px from the first thing in the row, so the two read as one shape. That is worst where the content is an ornament in the accent colour, such as a checked box. Give the gutter the bar plus a step off the spacing scale.')",
      "}",
      "for (const tb of all('table')) {",
      "  let mark = null, plain = null, w = 0, cell = null",
      "  for (const r of tb.querySelectorAll('tr')) {",
      "    const td = r.querySelector('td')",
      "    if (!td) continue",
      "    const m = edgeOf(td)",
      "    const bar = Math.max(m.bar, barPx(getComputedStyle(r).boxShadow), pseudoBar(r))",
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
    id: 'no-tint-out-saturates-its-ground',
    where: 'render',
    line: 'A tinted panel keeps its ground\'s chroma neighbourhood. No fill carries far more colour than what it sits on.',
    /* ── WHAT "SOLARIZED" ACTUALLY MEASURES ──
     *
     * Chroma, not lightness. A saturated patch on a near-neutral ground reads
     * as a stain, and no contrast check has an opinion about it: a ratio
     * measures lightness only, so both colours can be perfectly legal and the
     * pair still looks wrong.
     *
     * Measured on one dark build, against a card at OKLCH chroma 0.026:
     *   alert          0.049   1.9x
     *   badge-success  0.041   1.6x
     *   badge-warning  0.049   1.9x
     *   badge-danger   0.095   3.7x
     * and across the shipped presets the same roles ran to 0.1544. They named
     * it twice, about two different components, before anything measured it.
     *
     * A RATIO IS THE WRONG METRIC WHEN THE GROUND IS ACHROMATIC. One preset
     * ships a pure neutral, so dividing by its chroma gave ratios in the
     * millions and the first version of this check was unusable. Ask the
     * ABSOLUTE chroma of the fill, and let the ground raise the allowance
     * where the ground is itself tinted.
     *
     * The allowance is generous on purpose: this is for a stain, not for a
     * saturated fill somebody chose. A solid accent button is excluded by the
     * text on it, which is inverse rather than the accent. */
    body: [
      "const OK = 0.04",
      "const cv = document.createElement('canvas'); cv.width = cv.height = 1",
      "const ctx = cv.getContext('2d', { willReadFrequently: true })",
      "const oklch = css => { if (!css) return null",
      "  ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = css",
      "  ctx.fillRect(0, 0, 1, 1)",
      "  const d = ctx.getImageData(0, 0, 1, 1).data",
      "  if (d[3] === 0) return null",
      "  const f = v => { v = v / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }",
      "  const R = f(d[0]), G = f(d[1]), B = f(d[2])",
      "  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)",
      "  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)",
      "  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)",
      "  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s",
      "  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s",
      "  return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, C: Math.sqrt(A * A + Bb * Bb) } }",
      /* ── A STAIN IS A PANEL. A MARK IS NOT ──
       *
       * The first size gate was 16 by 12, and a 16px checked checkbox passed
       * it. That box is filled with the solid accent at chroma 0.133 on a
       * 0.026 ground, which is the whole point of it: a checked box is a mark,
       * and its colour IS the state. Two findings, both correct code.
       *
       * Judge on AREA as well as on sides. A checkbox is 256px square; the
       * smallest badge here is 800. */
      "for (const el of all('*')) {",
      "  const r = el.getBoundingClientRect()",
      "  if (r.width < 20 || r.height < 20) continue",
      "  if (r.width * r.height < 500) continue",
      "  const cs = getComputedStyle(el)",
      "  const own = oklch(cs.backgroundColor)",
      "  if (!own) continue",
      "  let node = el.parentElement, ground = null",
      "  for (; node; node = node.parentElement) {",
      "    const g = oklch(getComputedStyle(node).backgroundColor)",
      "    if (g) { ground = g; break }",
      "  }",
      "  if (!ground) continue",
      /* ── A TINT SITS NEAR ITS GROUND. A SOLID DOES NOT ──
       *
       * Two earlier gates tried to separate the two by looking at the TEXT,
       * and both failed. `own.L > 0.6 && fg.L < 0.4` only ever described a
       * light fill with dark text, so a dark-mode solid accent slipped past.
       * Replacing it with the lightness DISTANCE to the text was worse: a dark
       * tint always carries light text, so it excused every tint and the check
       * went silent on the exact fault it was written for.
       *
       * Ask the GROUND. A tint is a background the eye passes over and sits
       * within a step of what it lies on. A solid is an object and sits far
       * from it. Measured: these tints are 0.04 from the card and a checked
       * accent box is 0.32. */
      "  if (Math.abs(own.L - ground.L) > 0.15) continue",
      /* ── A SHAPE IS NOT A PANEL, AND THE OTHER CHECK OWNS IT ──
       *
       * An avatar disc is tinted on purpose and judged on whether it SEPARATES
       * from its ground, which `a-filled-shape-separates-from-its-ground` asks
       * at the same floor. Asking it for chroma restraint as well faulted five
       * correct discs, and the two demands pull opposite ways: separation wants
       * more colour and restraint wants less.
       *
       * So one object is either a shape or a panel, never both. The definition
       * is the same one that check uses: square-ish, and carrying initials
       * rather than a sentence. */
      "  const chars = (el.textContent || '').trim().length",
      "  /* A TINT SITS BEHIND SOMETHING. A fill with no text on it at all is a",
      "     MARK, and a mark's colour is its meaning: a chart series, a legend",
      "     dot, a status stripe. Measured on a categorical scale built for",
      "     separation, one segment reads 0.079 against a 0.009 page, and that",
      "     is the palette doing its job rather than a stain. textContent counts",
      "     descendants, so a tinted panel with any words in it is still asked. */",
      "  if (!chars) continue",
      "  if (Math.abs(r.width - r.height) <= 2 && chars <= 3) continue",
      /* The allowance rises with the ground's own colour: a tinted ground can
         carry a tinted panel without either reading as a stain. Both numbers
         are measured rather than picked. Across all seven presets, the mixed
         tints top out at chroma 0.0373 and the raw meaning-ramp steps they
         replaced start at 0.0413, so 1.5x with a floor of 0.04 fires on none
         of the good ones and catches 28 of 28 bad ones. The bar sits inside a
         real gap instead of between two samples. */
      "  const allow = Math.max(OK, ground.C * 1.5)",
      "  if (own.C > allow)",
      "    fail(name(el), 'this fill carries OKLCH chroma ' + own.C.toFixed(3) + ' on a ground at ' + ground.C.toFixed(3) + ', so it reads as a stain rather than a tint. No contrast check sees this, because a ratio measures lightness and both colours can be legal. Mix the meaning colour INTO the ground instead of taking a step off its own ramp.')",
      "}",
    ],
  },

  {
    id: 'a-filled-shape-separates-from-its-ground',
    where: 'render',
    line: 'A filled shape with no text of its own reads at least 1.2:1 against what is behind it.',
    /* ── THE AVATAR DISC WAS INVISIBLE AND NOTHING MEASURED IT ──
     *
     * A ground may be quiet, because the text on it carries the contrast. A
     * SHAPE has no words to carry it, so its fill is the whole signal.
     * Measured on one build: an avatar drawn in `accent-subtle` read 1.13:1
     * against the card in light and 1.11 in dark, so the circle vanished and
     * only its initials floated. They saw it in a screenshot.
     *
     * The selection check next door asks the same question at the same floor
     * and only about a MARKED ROW. This one asks about any small filled shape.
     *
     * ASKS ONLY WHAT IS UNAMBIGUOUS. It looks at a box that is round or
     * square, small, painted, and holding no more than a couple of characters.
     * A card, a band and a button are all excluded by size or by their text,
     * and a shape with a visible EDGE is excluded because the edge is the
     * other legitimate way to draw one. */
    body: [
      "const lum = hex => { const c = hex.match(/[0-9a-f]{2}/gi)",
      "  if (!c || c.length < 3) return null",
      "  const v = c.slice(0, 3).map(h => { const s = parseInt(h, 16) / 255",
      "    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })",
      "  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }",
      "const hexOf = rgb => { const m = /rgba?\\(([^)]*)\\)/.exec(rgb || '')",
      "  if (!m) return null",
      "  const p = m[1].split(',').map(s => parseFloat(s))",
      "  if (p.length < 3 || p.some(n => !isFinite(n))) return null",
      "  if (p.length > 3 && p[3] === 0) return null",
      "  return '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') }",
      "for (const el of all('*')) {",
      "  const r = el.getBoundingClientRect()",
      "  if (r.width < 8 || r.height < 8 || r.width > 64 || r.height > 64) continue",
      "  if (Math.abs(r.width - r.height) > 2) continue",
      "  const cs = getComputedStyle(el)",
      "  const own = hexOf(cs.backgroundColor)",
      "  if (!own) continue",
      /* An edge is the other honest way to draw a shape, so a shape that has
         one is not asked about its fill. */
      "  const edge = hexOf(cs.borderColor)",
      "  if (edge && parseFloat(cs.borderTopWidth) > 0 && edge !== own) continue",
      "  if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') continue",
      /* Words of its own mean it is a ground, not a shape. Initials are not
         words: two or three characters inside a disc are ornament. */
      "  const txt = (el.textContent || '').trim()",
      "  if (txt.length > 3) continue",
      "  if (el.querySelector('svg, img, input, button, a')) continue",
      /* ── A TILING DATA CELL IS NOT A SHAPE, AND ITS GROUND IS THE CELL
       *    BESIDE IT ──
       *
       * A heatmap cell shrinks into this size band at a narrow width, and its
       * quiet end is quiet ON PURPOSE: it encodes the lowest value. Comparing
       * it against the card behind it asks the wrong question, because nothing
       * of the card shows between two cells that abut.
       *
       * Measured on the charts surface at 640px: the lightest cell reads
       * 1.15:1 against the card, against a 1.2 floor, and 24 of them tile.
       *
       * ASK THE PROPERTY, NEVER THE CLASS. A box that shares an edge with a
       * SIBLING painting its own fill is part of a surface rather than a mark
       * on one. Measured over five surfaces, 85 candidates: 24 heatmap cells
       * and 3 stacked-bar segments come out as tiling, and every avatar, every
       * legend dot, every scatter point and the lone chart column stay in.
       * Cell-to-cell separation is the chart palette's own floor and a
       * different check owns it. */
      "  const paintsFill = n => { const b = getComputedStyle(n).backgroundColor",
      "    return !!b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent' }",
      "  const tiles = (() => {",
      "    const p = el.parentElement",
      "    if (!p) return false",
      "    for (const sib of p.children) {",
      "      if (sib === el || !paintsFill(sib)) continue",
      "      const b = sib.getBoundingClientRect()",
      "      if (!b.width || !b.height) continue",
      "      const gx = Math.max(r.left - b.right, b.left - r.right)",
      "      const gy = Math.max(r.top - b.bottom, b.top - r.bottom)",
      "      if (Math.max(gx, gy) <= 1.5) return true",
      "    }",
      "    return false",
      "  })()",
      "  if (tiles) continue",
      /* WALK TO THE ROOT. A six-level cap gave up inside a table, and the
         check then approved the element, which is "no answer" read as "no".
         Measured: an avatar on an unselected row had a transparent td, tr,
         tbody, table and scroller above it, so the card was the seventh
         ancestor and the walk returned nothing. The fault was worst on exactly
         those rows. A page always has a painted root, so this always answers. */
      "  let node = el.parentElement, ground = null",
      "  for (; node; node = node.parentElement) {",
      "    const g = hexOf(getComputedStyle(node).backgroundColor)",
      "    if (g) { ground = g; break }",
      "  }",
      /* ── THE EXACT-EQUAL CASE WAS EXEMPT, AND IT IS THE PUREST FAULT ──
       *
       * `ground === own` skipped a shape whose fill IS its ground, which is
       * the one case where nothing whatever shows. Everything one hair off
       * reported, and 1.00:1 did not. Found by injection: a 24px square
       * painted the card colour came back clean, and nudging it four points
       * fired at 1.03:1.
       *
       * A transparent fill is already gone, because hexOf returns null for
       * one. So what is left here is an element that STATES a fill equal to
       * its ground, at 8 to 64px, near-square, with almost no text and no
       * control in it. That is a shape nobody can see.
       *
       * Measured after: the app's twelve surfaces report 0 findings. */
      "  if (!ground) continue",
      "  const a = lum(own), b = lum(ground)",
      "  if (a == null || b == null) continue",
      "  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)",
      "  if (ratio < 1.2)",
      "    fail(name(el), 'this shape is drawn by its fill and reads ' + ratio.toFixed(2) + ':1 against the ground behind it, so it is absent rather than subtle. A ground may be quiet because the text on it carries the contrast. A shape has no words to carry it. Give it a role that steps off the surface in BOTH modes, or draw it with a visible edge instead.')",
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
    id: 'a-separator-goes-above-each-item',
    where: 'render',
    line: 'A separator is drawn above each item, never below. Drawn below, the last one lands on its container own edge.',
    /* ── TWO LINES A PIXEL APART, CLOSING NOTHING ──
     *
     * Drawn below, the last item in a run puts its rule directly onto the
     * container's own bottom border. It reads as a rule waiting for a row that
     * never comes.
     *
     * Drawn above, the first item supplies the rule under any group header, so
     * the header needs no border of its own and the two can never fall out of
     * step. It needs no index and no `:last-child`, because nothing sits above
     * the first row to separate it from.
     *
     * `:last-child { border: 0 }` is not the fix either: that is a correction
     * applied after the fact, and it breaks the moment a row is hidden or
     * reordered. Put the rule on the side that cannot be last.
     *
     * THREE GUARDS. A run of two has no rhythm to read. A container with no
     * edge of its own has nothing for the last rule to land on, which is the
     * commonest and healthiest shape. And a run whose items carry a TOP border
     * is the correct form, so it never reaches the comparison.
     */
    body: [
      "for (const run of all('*')) {",
      "  const kids = Array.prototype.filter.call(run.children, el => {",
      "    const r = el.getBoundingClientRect()",
      "    return r.width > 0 && r.height > 0",
      "  })",
      "  if (kids.length < 3) continue",
      "  if (!kids.every(k => k.tagName === kids[0].tagName)) continue",
      "  const rcs = getComputedStyle(run)",
      "  const own = px(rcs.borderBottomWidth)",
      "  if (!(own > 0) || rcs.borderBottomStyle === 'none') continue",
      "  const last = kids[kids.length - 1]",
      "  const lcs = getComputedStyle(last)",
      "  if (!(px(lcs.borderBottomWidth) > 0) || lcs.borderBottomStyle === 'none') continue",
      "  /* THE CORRECT FORM NEVER REACHES HERE. A run separated above carries",
      "     its rule on the TOP edge, so the last item has no bottom border. */",
      "  const rr = run.getBoundingClientRect(), lr = last.getBoundingClientRect()",
      "  const apart = Math.abs((rr.bottom - own) - lr.bottom)",
      "  if (apart > 2) continue",
      "  fail(name(run), 'every item in this run draws its separator BELOW itself, so the last one lands ' + apart.toFixed(2) + 'px from the container own bottom edge: two lines a pixel apart, closing nothing. Draw the rule ABOVE each item instead. The first item then supplies the rule under any group header, the last ends clean, and it needs no :last-child correction that a hidden or reordered row would break.')",
      "}",
    ],
  },

  {
    id: 'a-collapsed-row-still-costs-its-gap',
    where: 'render',
    line: 'A row that collapses gives up its line gap too. A container charges the gap whether or not anything is in it.',
    /* ── 9px OF DEAD HEIGHT UNDER A PANEL NOBODY HAD OPENED ──
     *
     * An element held at `max-height: 0` is still on a flex line, and the
     * container charges the row gap whether or not anything is in it. Measured
     * on one title bar: 65px tall to hold a 40px button, and 9 of those pixels
     * were a gap beneath a closed panel.
     *
     * So where a row opens and closes, the whole distance belongs to the
     * ROW — its own animated margin or padding — and the container's row-gap
     * goes to zero. One writer per gap.
     *
     * NARROWED ON THE DECLARATION, NEVER ON THE HEIGHT. Every zero-height
     * child is not this fault: a bar of value zero in a column chart is zero
     * tall and correct, and the first version of this reported sixteen of them
     * on one surface. A COLLAPSING element says so — `max-height: 0`, or a
     * `0fr` grid row above it, which are the two mechanisms that animate a
     * height nobody can know in advance.
     */
    body: [
      "for (const parent of all('*')) {",
      "  const cs = getComputedStyle(parent)",
      "  if (!/flex|grid/.test(cs.display)) continue",
      "  const gap = px(cs.rowGap)",
      "  if (!(gap > 0)) continue",
      "  for (const kid of parent.children) {",
      "    const r = kid.getBoundingClientRect()",
      "    if (r.height > 0.5) continue",
      "    const kcs = getComputedStyle(kid)",
      "    if (kcs.display === 'none' || kcs.position === 'absolute' || kcs.position === 'fixed') continue",
      "    /* THE DECLARATION, NOT THE HEIGHT. Only a box told to collapse. */",
      "    /* READ THE STRING, NEVER px(). max-height computes to none when",
      "       nothing sets it, and px() turns an unparseable value into 0 — so this",
      "       matched every element in the document and reported 24 findings on one",
      "       surface, every one correct code. A box told to collapse says 0px; a",
      "       box nobody told anything says none. Those are different answers. */",
      "    const collapsing = /^0(px)?$/.test(kcs.maxHeight)",
      "      || /(^|\\s)0fr(\\s|$)/.test(cs.gridTemplateRows || '')",
      "    if (!collapsing) continue",
      "    fail(name(parent), 'this container publishes a ' + gap + 'px row gap and holds a collapsed row, so it is ' + gap + 'px taller than what it shows. A gap is charged whether or not anything is in it. Give the collapsing row the whole distance as its own animated margin or padding and set the container row-gap to zero, so one writer owns the gap.')",
      "    break",
      "  }",
      "}",
    ],
  },

  {
    id: 'card-actions-sit-on-the-bottom-edge',
    where: 'render',
    line: 'In a row of cards of one height, every action row sits on the bottom edge.',
    /* ── EQUAL CARDS, RAGGED ACTIONS ──
     *
     * Cards stretched to one height do not give their buttons one height: a
     * description that wraps to two lines pushes its own button down, and the
     * row then reads as ragged. Measured on three plan cards of equal height:
     * one button ended 25px from its card's foot and the other two 47.3px.
     *
     * `margin-block-start: auto` on the action row takes the free space in a
     * flex column and lands the action on the bottom wherever the text above
     * it ends. A card sized by its own content has no free space, so the
     * margin resolves to zero and nothing moves — the rule needs no width test
     * and no second class.
     *
     * THREE GUARDS. Cards of DIFFERENT heights are not stretched, so nothing
     * is ragged. A card whose last child holds no control has no action row.
     * And 2px of slack, because a card's own border and padding are read from
     * the computed style and land on fractional pixels.
     */
    body: [
      "for (const parent of all('*')) {",
      "  const cs = getComputedStyle(parent)",
      "  if (!/flex|grid/.test(cs.display)) continue",
      "  const cards = Array.prototype.filter.call(parent.children, el => {",
      "    const r = el.getBoundingClientRect()",
      "    if (r.width < 40 || r.height < 40) return false",
      "    const ecs = getComputedStyle(el)",
      "    /* A CARD IS A BOX THAT PAINTS AND STACKS ITS OWN CONTENTS. Asking",
      "       for a class would approve whatever nobody thought of. */",
      "    return /flex|grid|block/.test(ecs.display) && el.children.length > 1",
      "  })",
      "  if (cards.length < 2) continue",
      "  const hs = cards.map(c => c.getBoundingClientRect().height)",
      "  if (Math.max.apply(null, hs) - Math.min.apply(null, hs) > 1) continue",
      "  const feet = []",
      "  for (const c of cards) {",
      "    const kids = Array.prototype.filter.call(c.children, el => {",
      "      const r = el.getBoundingClientRect()",
      "      return r.width > 0 && r.height > 0",
      "    })",
      "    const last = kids[kids.length - 1]",
      "    if (!last || !last.querySelector(CONTROL)) { feet.length = 0; break }",
      "    const ccs = getComputedStyle(c)",
      "    const foot = c.getBoundingClientRect().bottom - px(ccs.borderBottomWidth) - px(ccs.paddingBottom)",
      "    feet.push(foot - last.getBoundingClientRect().bottom)",
      "  }",
      "  if (feet.length < 2) continue",
      "  const spread = Math.max.apply(null, feet) - Math.min.apply(null, feet)",
      "  if (spread <= 2) continue",
      "  fail(name(parent), 'these ' + feet.length + ' cards are stretched to one height and their action rows end ' + spread.toFixed(2) + 'px apart, so the row reads as ragged. Put margin-block-start: auto on the action row, which takes the free space in a flex column and lands it on the bottom edge wherever the text above ends. A content-sized card has no free space, so the same rule moves nothing there.')",
      "}",
    ],
  },

  {
    id: 'a-rule-sits-inside-its-gap',
    where: 'render',
    line: 'A rule between sections sits inside that gap, half each side, so a marked boundary takes the same height as an unmarked one.',
    /* ── THE LINE SAYS WHERE A BOUNDARY IS, NEVER HOW BIG ──
     *
     * Give the separator half the section gap on each side. A marked boundary
     * and an unmarked one then occupy the same height, so the panel keeps one
     * rhythm either way and the line carries no weight of its own.
     *
     * A bare `hr` with its own margins has no answer for the unruled case, and
     * the next person to need one invents a number. Build it as one component
     * that renders a line or a plain spacer.
     *
     * THREE GUARDS. A rule at the start or end of its container has only one
     * side. A rule inside a RUN of like siblings is a row separator, which is
     * a different rule with its own answer. And 2px of slack, because both
     * distances come off fractional rectangles.
     */
    body: [
      "for (const el of all('*')) {",
      "  const r = el.getBoundingClientRect()",
      "  if (r.height > 3 || r.width < 40) continue",
      "  const cs = getComputedStyle(el)",
      "  /* A RULE IS A LINE THAT PAINTS. Either it IS the ink, or it draws a",
      "     border. Asking for hr or a class name would miss whichever one",
      "     nobody thought of. */",
      "  const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || px(cs.borderTopWidth) > 0 || px(cs.borderBottomWidth) > 0",
      "  if (!paints) continue",
      "  const prev = el.previousElementSibling, next = el.nextElementSibling",
      "  if (!prev || !next) continue",
      "  const pr = prev.getBoundingClientRect(), nr = next.getBoundingClientRect()",
      "  if (!pr.height || !nr.height) continue",
      "  /* A ROW SEPARATOR IN A RUN IS A DIFFERENT RULE. Its neighbours are",
      "     the same kind of thing as each other; a section rule sits between",
      "     two unlike blocks. */",
      "  if (prev.tagName === next.tagName && prev.tagName !== 'DIV') continue",
      "  const above = r.top - pr.bottom, below = nr.top - r.bottom",
      "  if (above < 0 || below < 0) continue",
      "  if (Math.abs(above - below) <= 2) continue",
      "  fail(name(el), 'this rule sits ' + above.toFixed(2) + 'px below what it follows and ' + below.toFixed(2) + 'px above what it precedes, so the boundary it marks is a different height from an unmarked one and the panel loses its rhythm. Give it half the section gap on each side. A line says WHERE a boundary is, never how big.')",
      "}",
    ],
  },

  {
    id: 'a-tab-strip-never-wraps-and-never-scrolls',
    where: 'render',
    line: 'A tab strip is one line of destinations. It never wraps and never scrolls; a strip that does not fit becomes a select.',
    /* ── REPLACE THE BAR, DO NOT SHRINK IT ──
     *
     * A run of destinations that does not fit is a list, and a list you pick
     * from is a select. Give the select the tab's font size, its padding and
     * its box height, so the value keeps the strip's baseline and the content
     * below does not jump when the swap happens. Keep both in the markup and
     * let CSS show one, or the rule cannot work in a page with no script.
     *
     * FOLDED TO TWO ROWS IT STOPS READING AS ONE CONTROL, and the marker on
     * row two looks like a different thing: measured at 92px over two rows for
     * four tabs in a 248px pane.
     *
     * AND NO SCROLLBAR EITHER. Sideways scrolling is a last resort, never a
     * tool: a bar takes 10px of height from one strip and not the one beside
     * it, so the two stop agreeing, and a destination scrolled out of view is
     * a destination nobody visits.
     *
     * A HORIZONTAL STRIP, NOT A VERTICAL LIST, and the geometry says which. A
     * rail's items sit above each other on purpose, so several bands there are
     * correct. Measured on this system's own surfaces: three vertical nav
     * lists reported 3, 5 and 6 bands, and every horizontal strip reported 1.
     * A name list would have approved whichever shape nobody thought of.
     */
    body: [
      "for (const strip of all('nav, [role=tablist]')) {",
      "  const kids = Array.prototype.filter.call(strip.children, el => {",
      "    const r = el.getBoundingClientRect()",
      "    return r.width > 0 && r.height > 0",
      "  })",
      "  if (kids.length < 2) continue",
      "  /* HORIZONTAL means the items do not share an x range. */",
      "  const boxes = kids.map(k => k.getBoundingClientRect())",
      "  /* HORIZONTAL IS A MAJORITY OF ADJACENT PAIRS SHARING A BAND, and both",
      "     simpler forms traded one miss for another. Asking EVERY item to sit",
      "     right of the one before it is false of a wrapped strip, which is the",
      "     case this exists for. Asking only the FIRST pair reported a vertical",
      "     rail as folded, because a rail leads with a section label whose box",
      "     does not line up with the items under it. Measured: six rail items at",
      "     tops 0, 232, 282, 332, 382 and 432 share no band at all, and a six-tab",
      "     strip folded onto two rows shares four of five. */",
      "  let together = 0",
      "  for (let i = 1; i < boxes.length; i++) {",
      "    const a = boxes[i - 1], b = boxes[i]",
      "    if (a.top < b.bottom && b.top < a.bottom) together++",
      "  }",
      "  const sideBySide = together * 2 > boxes.length - 1",
      "  if (!sideBySide) continue",
      "  const cs = getComputedStyle(strip)",
      "  if (/auto|scroll/.test(cs.overflowX)) {",
      "    fail(name(strip), 'this tab strip declares overflow-x: ' + cs.overflowX + ', so a destination can sit scrolled out of view and the scrollbar takes height from this strip and not from the one beside it. A run of destinations that does not fit is a list, and a list you pick from is a select. Swap the bar for one, at the tab font size, padding and box height, so the content below does not jump.')",
      "    continue",
      "  }",
      "  const bands = []",
      "  for (const b of boxes) {",
      "    if (!bands.some(y => b.top < y.bottom && y.top < b.bottom)) bands.push(b)",
      "  }",
      "  if (bands.length < 2) continue",
      "  fail(name(strip), 'this tab strip is folded onto ' + bands.length + ' rows, so it stops reading as one control and the marker on row two looks like a different thing. Measured once at 92px over two rows for four tabs in a 248px pane. Set flex-wrap: nowrap and swap the whole bar for a select at the width where it stops fitting.')",
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
      /* ── IT WAS GATED TO ONE SHAPE SOMEBODY THOUGHT OF ──
       *
       * The gate was `text-transform: uppercase` plus positive tracking, which
       * describes an OVERLINE and nothing else. So the check for "a bare block
       * owns no gap" could only ever see one kind of label.
       *
       * Measured on one dashboard: nine stacked label pairs, five of them at
       * 0.00px, and not one passed the gate. Every pair read
       * `uppercase: false`, including the element classed `.t-overline`. The
       * user found all of it in a screenshot while this check printed nothing.
       *
       * A TAG LIST FINDS THE CASES SOMEBODY ALREADY THOUGHT OF AND APPROVES
       * THE REST. Ask the PROPERTY instead: two stacked siblings, both
       * carrying text, with nothing between them and no gap from the parent.
       *
       * Four things legitimately separate siblings at zero distance, and each
       * is a declaration rather than a guess: a row-gap on the parent, a border
       * on either facing edge, a fill of their own, or a padding that holds the
       * content apart. A margin needs no exemption, because a distance
       * somebody chose is greater than zero. */
      "for (const el of all('*')) {",
      "  if (el.children.length) continue",
      "  const cs = getComputedStyle(el)",
      "  if (!el.textContent.trim()) continue",
      "  const next = el.nextElementSibling",
      "  if (!next) continue",
      "  const ns = getComputedStyle(next)",
      "  if (ns.display === 'none' || ns.position === 'absolute' || ns.position === 'fixed') continue",
      "  if (!next.textContent.trim()) continue",
      "  const parent = el.parentElement",
      "  if (!parent) continue",
      "  const ps = getComputedStyle(parent)",
      /* A parent that spaces its whole group has already answered this. */
      "  if ((parseFloat(ps.rowGap) || 0) > 0.5) continue",
      "  if (/^(TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|CAPTION)$/.test(parent.tagName)) continue",
      "  const a = el.getBoundingClientRect(), b = next.getBoundingClientRect()",
      "  if (!a.height || !b.height) continue",
      "  if (b.top < a.bottom - 1) continue",
      /* Stacked, not side by side. */
      "  if (b.left > a.right - 0.5 || a.left > b.right - 0.5) continue",
      /* A rule between them IS the separation. So is a fill, or an inset. */
      "  if (parseFloat(cs.borderBottomWidth) > 0 || parseFloat(ns.borderTopWidth) > 0) continue",
      "  const fill = s => s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : null",
      "  const pf = fill(ps)",
      "  if ((fill(cs) && fill(cs) !== pf) || (fill(ns) && fill(ns) !== pf)) continue",
      "  if (parseFloat(cs.paddingBottom) > 0.5 || parseFloat(ns.paddingTop) > 0.5) continue",
      /* ── A STATED MARGIN IS A DISTANCE SOMEBODY CHOSE ──
       *
       * The threshold is 2px, so a deliberate 2px margin trips it. A stat
       * tile states `margin-top: 2px` on its delta, because a change belongs
       * to the number above it rather than to the tile. Four correct tiles
       * reported on the first run of the widened check.
       *
       * The fault this catches is an ABSENCE, not a small number. Read the
       * facing margins: if either states one, the distance was decided and
       * this check has no opinion on whether it was decided well. */
      "  if (parseFloat(cs.marginBottom) > 0.5 || parseFloat(ns.marginTop) > 0.5) continue",
      "  const gap = b.top - a.bottom",
      "  if (gap <= 2)",
      "    fail(name(el), 'this label sits ' + round(gap) + 'px above ' + name(next) + ', which it names. A label with no gap reads as the first row of the group rather than its title. Blocks carry no gap, so state one: a flex parent with a gap fixes the whole group, a margin fixes only this instance.')",
      "}",
    ],
  },

  {
    id: 'a-group-of-buttons-keeps-one-gap',
    where: 'render',
    line: 'A wrapped run of buttons keeps one gap in both axes. A line break is not a group boundary.',
    /* ── A PROXIMITY RATIO NEEDS A REAL GROUP ON EACH SIDE OF IT ──
     *
     * This system put the `lg` step between the pairs of a broken action row
     * and the `xs` step inside one, for 3:1, on the proximity argument: at 1:1
     * a reader cannot tell which two buttons belong together.
     *
     * Their correction, 8 September 2026, looking at the rendered row: the
     * vertical gap equals the horizontal one, because they are all part of the
     * same group of buttons.
     *
     * The old argument was right about everything except the answer. A pair
     * here is a LINE rather than a unit anybody reads, so a line break is not
     * a group boundary and there is only one group. At 3:1 the two lines read
     * as two separate action rows. Measured before the change: five instances
     * across three surfaces, all 8px across and 24px down.
     *
     * READ THE PAINT, NOT A CLASS. A run of buttons is a container every one
     * of whose children is a control or wraps one. That covers the pair
     * wrapper this system builds and a flat row of buttons equally.
     *
     * FOUR GUARDS, and each is a shape this is not about. A container holding
     * one line has no vertical gap anybody sees. A container with no gap in
     * one axis has published nothing to compare. A NAV is a run of
     * destinations rather than a group of buttons, and its own rule gives it a
     * gutter of its own. And a container holding something that is not a
     * control is a layout rather than a group.
     */
    body: [
      "for (const row of all('*')) {",
      "  const cs = getComputedStyle(row)",
      "  if (!/flex|grid/.test(cs.display)) continue",
      "  /* A NAV IS NOT A GROUP OF BUTTONS. Its items are destinations, and the",
      "     gutter between two strips is a step of its own by another rule. */",
      "  if (row.matches('nav, [role=tablist], [role=menubar]') || row.closest('nav')) continue",
      "  const kids = Array.prototype.filter.call(row.children, el => {",
      "    const r = el.getBoundingClientRect()",
      "    return r.width > 0 && r.height > 0",
      "  })",
      "  if (kids.length < 2) continue",
      /* ── A GAP SHORTHAND SETS BOTH AXES, SO A COLUMN DECLARES ONE THAT
       *    PAINTS NOTHING ──
       *
       * A `nowrap` column stacks its children, so its `column-gap` is inert
       * and comparing the two axes compares a painted distance against a
       * declaration. Measured on the component gallery: one finding, a
       * `.card.stack-sm` reading 12px across and 16px down with six children
       * on six lines. Nothing sits along the axis the 12px governs.
       *
       * A column that WRAPS does form columns, so it stays in. Ask the
       * declaration that decides the axis. */
      "  if (cs.flexDirection === 'column' && cs.flexWrap === 'nowrap') continue",
      /* ── AND A RUN OF BUTTONS IS BUTTONS, NOT BOXES HOLDING THEM ──
       *
       * This read `k.matches(CONTROL) || k.querySelector(CONTROL)`, and a
       * subtree search is the documented trap: a column of six mixed blocks
       * each containing some control passed as a run of buttons. A control is
       * one object rather than a group of items, so a child that CONTAINS a
       * control is a container.
       *
       * The pair wrapper is the one exception, because pairing two buttons per
       * line is this system's own answer for a broken action row. So a child
       * qualifies when it is a button, or when every control inside it is. */
      "  const BTN = 'button, .btn, [role=button], a.btn'",
      "  const isRunMember = k => {",
      "    if (k.matches(BTN)) return true",
      "    const inner = Array.prototype.slice.call(k.querySelectorAll(CONTROL))",
      "    return inner.length > 0 && inner.every(c => c.matches(BTN))",
      "  }",
      "  if (!kids.every(isRunMember)) continue",
      "  const cg = px(cs.columnGap), rg = px(cs.rowGap)",
      "  if (!(cg > 0) || !(rg > 0)) continue",
      "  if (Math.abs(cg - rg) < 0.5) continue",
      "  /* ONE LINE HAS NO VERTICAL GAP ANYBODY SEES. The row gap is declared",
      "     and never painted, so it is a value waiting rather than a fault. */",
      "  const bands = []",
      "  for (const k of kids) {",
      "    const r = k.getBoundingClientRect()",
      "    if (!bands.some(b => r.top < b.bottom && b.top < r.bottom)) bands.push(r)",
      "  }",
      "  if (bands.length < 2) continue",
      "  fail(name(row), 'this run of buttons is ' + cg + 'px apart across and ' + rg + 'px apart down, so its ' + bands.length + ' lines read as separate action rows. A wrapped run is one group that ran out of width: a line is not a group, and a line break is not a group boundary. Give it one gap in both axes. A proximity ratio needs a real group on each side of it, and here there is only one.')",
      "}",
    ],
  },

  {
    id: 'space-between-spreads-every-gap',
    where: 'render',
    line: 'space-between splits its slack evenly, so it opens a hole inside a run of like controls. Start the row and give the end group an auto margin.',
    /* ── MY FIRST QUESTION WAS UNFIREABLE, AND MEASURING PROVED IT ──
     *
     * I asked whether space-between produced UNEQUAL gaps. It cannot: the
     * mechanism splits the free space evenly, so the gaps are equal by
     * definition. Five shapes measured in a 520px row, and none reached 3:1.
     *
     * THE RECORDED FAULT WAS A UNIFORM GAP. A header put 65.3px between a
     * bell and the menu beside it. Both are the same kind of control, so they
     * read as one run, and the even split opened a hole inside it. The gap on
     * the other side was the same 65.3 and correct, because a title and an
     * action group really are two groups.
     *
     * Measured on the corrected question: 0 findings across eleven surfaces,
     * and 161.38px between two ghost buttons on the recorded shape.
     *
     * THE PROXIMITY CHECK DOES NOT OWN THIS. It compares a group inner gap to
     * the distance between groups, and 279px against 8px is 34:1, correctly
     * silent. This is one level down from that.
     */
    body: [
      "/* TWO ADJACENT LIKE CONTROLS READ AS ONE GROUP, and space-between splits its",
      "   free space evenly across every gap, so it opens a hole inside that group.",
      "   Measured once on a header: 65.3px between a bell and the menu beside it.",
      "",
      "   THE GAPS ARE EQUAL BY DEFINITION, so an unequal-gap question is",
      "   unfireable. Five shapes measured in a 520px row and none reached 3:1. The",
      "   fault is a UNIFORM gap too large for a pair that belongs together. */",
      "const LIKE = '.btn, button, [role=button], .nav-item, .tab, [role=tab]'",
      "for (const row of all('*')) {",
      "  const cs = getComputedStyle(row)",
      "  if (!cs.display.includes('flex')) continue",
      "  if (cs.justifyContent !== 'space-between') continue",
      "  if (cs.flexDirection.startsWith('column')) continue",
      "  const kids = Array.prototype.slice.call(row.children).filter(visible).filter(boxOf)",
      "  /* Two items is the idiom and has no group to open a hole in. */",
      "  if (kids.length < 3) continue",
      "  const boxes = kids.map(k => k.getBoundingClientRect())",
      "  /* ONE LINE ONLY. A wrapped row is several runs. */",
      "  let wrapped = false",
      "  for (let i = 1; i < boxes.length; i++) if (boxes[i].top - boxes[0].top > 2) wrapped = true",
      "  if (wrapped) continue",
      "  const inner = px(cs.columnGap) || px(tokenValue('--icon-gap')) || 8",
      "  for (let i = 1; i < kids.length; i++) {",
      "    const a = kids[i - 1], b = kids[i]",
      "    /* ── LIKE, AND THE TAG DECIDES IT ──",
      "       A words div beside a button is two kinds of thing, and there is no",
      "       group between them to break. Two controls of the same kind are a run,",
      "       and a run is what a reader takes as one thing. */",
      "    if (!a.matches(LIKE) || !b.matches(LIKE)) continue",
      "    if (a.tagName !== b.tagName) continue",
      "    const d = boxes[i].left - boxes[i - 1].right",
      "    if (d <= inner * 3) continue",
      "    fail(name(b),",
      "      'this control sits ' + round(d) + 'px from the one before it, and both are the same kind, so a reader takes them as one run. The row uses space-between, which splits its free space evenly across every gap and so opens a hole INSIDE that run. Its own gap is ' + round(inner) + 'px. Start the row instead and give the group that belongs at the end an auto margin, so all the slack lands in one place.')",
      "  }",
      "}",
    ],
  },
  {
    id: 'proximity-is-a-ratio',
    where: 'render',
    line: 'State both gaps together: the gap inside a group and the gap between groups. Proximity is a ratio, and a gutter between columns is a step of its own, never the row default. Three to one, or the two read as one thing.',
    /* THE RULE EXISTED IN PROSE AND NOTHING ENFORCED IT, so it was broken on
     * the first surface written after it.
     *
     * A charts surface put its section heading 16px below the card above it,
     * which is exactly the gap between two cards. 1:1. A new section read as
     * one more card, and the person reading it asked why the rule had not been
     * obeyed. It had not been obeyed because nothing could see it.
     *
     * A CONTAINER'S GAP AGAINST ITS CHILD'S. Those are the two distances the
     * rule is about: the space between groups, and the space inside one. Any
     * deeper pair is a different question and is not asked here.
     *
     * A CHILD THAT PAINTS ITS OWN EDGE IS EXEMPT, and that is most of them. A
     * card has a border and a fill, so it separates itself from its neighbour
     * whatever the gap does. The ratio is the only signal when there is no
     * other signal, which is where this check applies. Without that exemption
     * it fires on every card in every stack in the product.
     *
     * BOTH AXES, keyed separately. A row of groups answers the same rule
     * sideways, and a container can be right on one axis and wrong on the
     * other. */
    body: [
      "const px = v => parseFloat(v) || 0",
      "const between = els => {",
      "  const rects = els.map(e => e.getBoundingClientRect())",
      "  let min = Infinity",
      "  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {",
      "    const a = rects[i], b = rects[j]",
      "    const dx = Math.max(a.left - b.right, b.left - a.right)",
      "    const dy = Math.max(a.top - b.bottom, b.top - a.bottom)",
      "    if (dx < 0 && dy < 0) continue   /* stacked in z, not spaced */",
      "    const d = dx >= 0 && dy >= 0 ? Math.min(dx, dy) : Math.max(dx, dy)",
      "    if (d >= 0 && d < min) min = d",
      "  }",
      "  return min === Infinity ? 0 : min",
      "}",
      "const inner = el => between(Array.prototype.slice.call(el.children).filter(visible))",
      "const paintsItsOwn = (el, parentBg) => {",
      "  const cs = getComputedStyle(el)",
      "  for (const side of ['Top', 'Right', 'Bottom', 'Left'])",
      "    if (px(cs['border' + side + 'Width']) > 0) return true",
      "  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true",
      "  const bg = cs.backgroundColor",
      "  const clear = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'",
      "  return clear && bg !== parentBg",
      "}",
      /* A SPECIMEN SHEET IS EXEMPT, and it says so two ways. `.row-label`
         marks a single specimen ROW; `data-specimen` marks a whole sheet, and
         keying only on the row missed every sheet-level run. */
      "const isSpecimen = el => !!(el.closest('[data-specimen]')",
      "  || el.querySelector(':scope > * > .row-label, :scope > .row-label'))",
      "for (const box of all('*')) {",
      "  const cs = getComputedStyle(box)",
      "  if (!/flex|grid/.test(cs.display)) continue",
      "  if (isSpecimen(box)) continue   /* a sheet showing three sizes shows three sizes */",
      "  const byGap = new Map()",
      "  for (const kid of box.children) {",
      "    if (!visible(kid)) continue",
      "    if (!/flex|grid/.test(getComputedStyle(kid).display)) continue",
      "    const gi = inner(kid)",
      "    if (gi <= 0) continue",
      "    if (paintsItsOwn(kid, cs.backgroundColor)) continue",
      "    const key = Math.round(gi * 100) / 100",
      "    if (!byGap.has(key)) byGap.set(key, [])",
      "    byGap.get(key).push(kid)",
      "  }",
      /* ── A LINE BREAK IS NOT A GROUP BOUNDARY ──
       *
       * An action row that runs out of width breaks into PAIRS, two per line,
       * and both gaps are the same step on purpose. Their rule, 8 September
       * 2026, with three screenshots: the vertical gap equals the horizontal
       * gap between the buttons, because this is one group of buttons rather
       * than two groups.
       *
       * The old wording here demanded 3:1 and was right about proximity and
       * wrong about what the group is. At 3:1 the two lines read as two
       * separate action rows, which is a relationship nobody intended.
       *
       * So a proximity ratio needs a real group on each side of it. The tell
       * is that the container is ONE RUN OF LIKE THINGS: every leaf inside it
       * is the same kind of control, so a pair is a line rather than a unit
       * anybody reads. A toolbar holding a field beside an action group fails
       * that test, because a field and a button are different kinds.
       *
       * Measured on this system's own preview: 1 finding, two button pairs at
       * 8px inside and 8px between, correct by their rule. Silent after, and
       * an injected label-and-input group at 1:1 still fires. */
      /* ── ASK THE CONTROLS, NOT THE LEAVES ──
       *
       * A first draft asked whether every childless descendant sat inside a
       * button. Every button here holds an svg, so no button is childless and
       * the only leaves were svg paths, which carry no text. The gate found 0
       * leaves and exempted nothing.
       *
       * Three conditions, and each earns its place on a shape measured live:
       *
       *   the box holds more than one control      one control is not a run
       *   every control in it is a BUTTON          a field is a different kind
       *   no text sits outside a button            a label is a different kind
       *
       * Measured on three shapes. The wrapped button pairs come back exempt.
       * A run of label-and-input groups at 1:1 fires, because the input is a
       * control and not a button. A search field beside an action group fires,
       * which is their own worked example of this rule: 8 against 8 makes five
       * things read as one run, and 24 against 8 is exactly three to one. */
      "  const INTERACTIVE = 'button, input, select, textarea, a[href], [role=button], [role=tab], [tabindex], .btn'",
      "  const BUTTONS = 'button, .btn, [role=button], a.btn'",
      "  const ctrls = Array.prototype.slice.call(box.querySelectorAll(INTERACTIVE)).filter(visible)",
      "  var oneRun = ctrls.length > 1 && ctrls.every(c => c.matches(BUTTONS))",
      "  if (oneRun) {",
      "    const strays = Array.prototype.slice.call(box.querySelectorAll('*')).filter(visible)",
      "      .filter(e => Array.prototype.slice.call(e.childNodes)",
      "        .some(n => n.nodeType === 3 && n.textContent.trim()) && !e.closest(BUTTONS))",
      "    if (strays.length) oneRun = false",
      "  }",
      "  for (const entry of byGap) {",
      "    const gi = entry[0], members = entry[1]",
      "    if (members.length < 2) continue   /* one group has no next one */",
      "    if (oneRun) continue   /* a wrapped run of buttons: a line, not a group */",
      "    const go = between(members)",
      "    if (go <= 0) continue",
      "    const r = go / gi",
      /* ── THE BAR IS TWO TO ONE, LOWERED FROM THREE ON 9 SEPTEMBER 2026 ──
       *
       * Measured across 12 surfaces at 6 widths before the change: 25 distinct
       * proximity groups. 13 at six to one or more, 3 between four and six, 4
       * at exactly three, 2 at exactly two, and 3 under two. So the bar
       * decides two cases and both are one shape, content beside its own
       * context at 32 between and 16 inside.
       *
       * Their call, on a drawing of all three ratios at actual size: two
       * columns at two to one are related rather than separate, which is what
       * a record page and its context are. Nothing on screen moved.
       *
       * A case under two is still a fault. Pricing's plan stack reads 1.33 at
       * 296 and 320 and fires at either bar. */
      "    if (r >= 2) continue",
      "    fail(name(members[0]), members.length + ' of these sit ' + round(go) + 'px apart and each holds its own contents ' + round(gi) + 'px apart, which is ' + (Math.round(r * 100) / 100) + ':1. Proximity is a ratio: under two to one the two distances read as one, so a group stops being told apart from the next. Raise the outer gap a step, or lower the inner one.')",
      "  }",
      "}",
    ],
  },
  {
    id: 'one-writer-for-one-gap',
    where: 'render',
    line: 'A container publishes the distance between its children, or each child states its own. Never both.',
    /* A GAP AND A MARGIN ADD, SO TWO WRITERS FOR ONE DISTANCE IS ALWAYS WRONG
     * BY THE SUM OF THEM.
     *
     * It reads as a spacing choice nobody made. Measured while giving a card a
     * default distance between its children: a container publishing 4px met a
     * rule adding 12 and rendered 16, and a 24px row rendered 36. In both
     * cases the container had already answered the question.
     *
     * NOT A CLASS LIST. The first attempt at the rule excluded the container
     * names it knew about and named three of six, which is the tag-list fault:
     * it finds the cases somebody thought of and approves the rest. So this
     * asks the two properties that decide it. Does the container publish a
     * row-gap, and does the child state a block-start margin.
     *
     * AN AUTO MARGIN IS NOT A GAP. getComputedStyle reports the USED value, so
     * a footer pushed to a card bottom edge with an auto block-start margin
     * reads back as a pixel number and looks exactly like a second writer. It
     * is a push rather than a distance, and it is the documented way to put an
     * action row on a stretched card foot. Read the DECLARATION, through the
     * inline style and the CSSOM both: a stylesheet auto leaves el.style
     * empty. Skipping that cost three false positives at 34.25px.
     *
     * A NEGATIVE MARGIN IS NOT A SECOND WRITER EITHER. It cancels the gap,
     * which is one mechanism deliberately undoing another.
     *
     * NOR IS A SUB-PIXEL CORRECTION. A margin below the smallest step on the
     * spacing scale cannot be a spacing decision: nothing on the scale is
     * that small, and a fraction of a pixel is invisible as distance. What it
     * IS, every time, is an optical correction — a field note nudged by
     * 0.152em to answer an asymmetric leading measured 1.82px and looked
     * exactly like a second writer. The floor comes from the document's own
     * smallest space token rather than a constant, so it moves with the
     * scale. That was the only false positive in 73 findings across 77
     * width-and-surface cells; the other 72 were real. */
    body: [
      "const smallestStep = (() => {",
      "  const root = getComputedStyle(document.documentElement)",
      "  let min = Infinity",
      "  for (const n of ['--space-4xs', '--space-3xs', '--space-2xs', '--space-xs']) {",
      "    const v = parseFloat(root.getPropertyValue(n)); if (v > 0 && v < min) min = v",
      "  }",
      "  return min === Infinity ? 2 : min",
      "})()",
      "const declaredAuto = el => {",
      "  for (const prop of ['margin-block-start', 'margin-top'])",
      "    if (el.style.getPropertyValue(prop) === 'auto') return true",
      "  for (const sheet of document.styleSheets) {",
      "    let rules; try { rules = sheet.cssRules } catch (e) { continue }",
      "    for (const r of rules) {",
      "      if (!r.selectorText || !r.style) continue",
      "      const v = r.style.getPropertyValue('margin-block-start') || r.style.getPropertyValue('margin-top')",
      "      if (v !== 'auto') continue",
      "      try { if (el.matches(r.selectorText)) return true } catch (e) {}",
      "    }",
      "  }",
      "  return false",
      "}",
      "for (const box of all('*')) {",
      "  const cs = getComputedStyle(box)",
      /* `normal` is the initial value, and it means no published gap. */
      "  if (!/flex|grid/.test(cs.display)) continue",
      "  const gap = cs.rowGap === 'normal' ? 0 : parseFloat(cs.rowGap) || 0",
      "  if (gap <= 0) continue",
      "  for (const kid of box.children) {",
      "    if (kid === box.firstElementChild) continue   /* nothing above it to be spaced from */",
      "    const m = parseFloat(getComputedStyle(kid).marginBlockStart) || 0",
      "    if (m < smallestStep) continue   /* a correction, not a distance */",
      "    if (declaredAuto(kid)) continue",
      "    /* A SPECIMEN SHEET IS EXEMPT. Two unrelated samples in a row are not",
      "       a group, so a shape rule that spaces a pair reaches them and the",
      "       container gap is added to it. Measured on one: a heading specimen",
      "       above a caption specimen at 12 + 4. The marker is the one the sheet",
      "       already carries, and three other checks read the same list. */",
      "    if (kid.closest('[data-specimen], .specimen, .sizes')) continue",
      "    fail(name(kid), 'sits ' + round(gap + m) + 'px below its previous sibling, because its container publishes a ' + round(gap) + 'px row-gap AND it states a ' + round(m) + 'px margin. A gap and a margin add, so this distance is the sum of two writers rather than a value anybody chose. One of them owns it.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-class-styles-something-where-it-sits',
    where: 'render',
    line: 'Every class on an element is reached by some rule, or it is a name that styles nothing here.',
    /* ── A PRIMITIVE ONLY EXISTS IN THE CONTEXT THAT DEFINES IT ──
     *
     * An app that hosts a document has two class sets, and reaching for the
     * wrong one fails in silence. No build error, no console message, no
     * missing element. The class is real somewhere, so nothing reads as
     * wrong, and the markup says the work is done.
     *
     * Found by hand in a browser tool that ran once and was wired to
     * nothing. Run again today, after months: three faults.
     *
     *   a nav specimen carried the TABLE selection class, so a sample the
     *   gallery exists to show rendered byte-identical to a plain item, and
     *   five published tokens had no demonstration
     *
     *   a chrome readout carried the document figure class, so it took the
     *   body face while its markup asked for the mono one
     *
     *   a chrome button carried the document secondary class, so it fell
     *   back to the browser grey at rgb(107, 107, 107)
     *
     * ASK THE DOM, NEVER THE SOURCE. A build-time version reported 49
     * findings and 46 were correct code, because a panel may render a
     * document sample inside its own preview root.
     */
    body: [
      "/* ── READ THE TEXT AS WELL AS THE CSSOM ──",
      "   Measured once in a dev server: five sheets, three throwing on access and",
      "   two empty, zero rules read, and a confident report of zero findings. An",
      "   injected fault carrying five dead classes came back clean. */",
      "/* AN EMPTY CSSRuleList IS TRUTHY, AND CSS NESTING GAVE EVERY STYLE RULE",
      "   ONE. So `if (r.cssRules)` recursed into nothing for every plain rule and",
      "   its selector was never collected. Measured on this browser: 0 rules read",
      "   out of 970. The text parse below was carrying the whole check on its own",
      "   and hid it. Ask for the LENGTH, and take a rule that has a selector as a",
      "   rule rather than as a container. */",
      "const sels = []",
      "const collect = list => { for (const r of list) {",
      "  if (r.selectorText) for (const one of r.selectorText.split(\",\")) sels.push(one.trim())",
      "  if (r.cssRules && r.cssRules.length) collect(r.cssRules)",
      "} }",
      "for (const sheet of document.styleSheets) {",
      "  try { collect(sheet.cssRules) } catch (e) { /* read from the text below */ }",
      "}",
      "const texts = []",
      "for (const n of document.querySelectorAll(\"style\")) texts.push(n.textContent || \"\")",
      "for (const n of document.querySelectorAll(\"link[rel=stylesheet]\")) {",
      "  try { texts.push(await (await fetch(n.href)).text()) } catch (e) { /* cross-origin */ }",
      "}",
      "const bare = texts.join(String.fromCharCode(10))",
      "  .replace(/\\/\\*[\\s\\S]*?\\*\\//g, m => m.replace(/[^\\n]/g, \" \"))",
      "for (const m of bare.matchAll(/([^{}@]+)\\{[^{}]*\\}/g)) {",
      "  for (const one of m[1].split(\",\")) {",
      "    const t = one.trim()",
      "    if (t && !/^@|^\\d/.test(t)) sels.push(t)",
      "  }",
      "}",
      "/* A RUN THAT READ NO RULES IS NOT A CLEAN RESULT. */",
      "if (sels.length < 20) {",
      "  fail(\"(the check itself)\", \"read only \" + sels.length + \" selectors, so nothing was measured. Three of five sheets can throw on cssRules access, which is why the stylesheet TEXT is read as well.\")",
      "  return",
      "}",
      "",
      "/* WHAT SITS INSIDE A FUNCTIONAL PSEUDO IS NOT A NAME BEING USED. A class",
      "   read inside :not() is being excluded, and counting it called four correct",
      "   classes dead. */",
      "const blanked = t => t.replace(/:(not|has|is|where)\\([^()]*\\)/g,",
      "  m => new Array(m.length + 1).join(\" \"))",
      "/* AND A STATE CANNOT MATCH AT REST. A rule on :hover is alive and",
      "   unmatchable now, so drop the state before asking whether it reaches. */",
      "const STATE = /::?(hover|focus|focus-visible|focus-within|active|disabled|checked|indeterminate|placeholder|before|after|first-line|selection|target|visited|open|marker|backdrop)\\b(\\([^()]*\\))?/g",
      "const norm = t => blanked(t).replace(STATE, \"\").replace(/\\s+/g, \" \").trim()",
      "const names = (t, cls) => blanked(t).indexOf(\".\" + cls) >= 0",
      "const compoundWith = (t, cls) => {",
      "  const parts = norm(t).split(/\\s+|>|\\+|~/).filter(Boolean)",
      "  for (const part of parts) if (part.indexOf(\".\" + cls) >= 0) return part",
      "  return \"\"",
      "}",
      "",
      "let scanned = 0",
      "for (const el of all(\"[class]\")) {",
      "  scanned++",
      "  for (const cls of Array.prototype.slice.call(el.classList)) {",
      "    const naming = sels.filter(t => names(t, cls))",
      "    /* A CLASS NO STYLESHEET MENTIONS IS A HOOK. A test id or a behaviour",
      "       marker is not this question business, and reporting them buries the",
      "       findings. */",
      "    if (!naming.length) continue",
      "    let alive = false",
      "    for (const t of naming) {",
      "      const n = norm(t)",
      "      if (!n) continue",
      "      try { if (el.matches(n)) { alive = true; break } } catch (e) { /* unsupported */ }",
      "      /* AN ANCESTOR CLASS IS DOING ITS JOB. A row selection class styles the",
      "         CELL, so the class on the row is alive when the row holds such a",
      "         cell. Counting only the subject called that dead. */",
      "      const c = compoundWith(t, cls)",
      "      try { if (c && el.matches(c) && el.querySelector(n)) { alive = true; break } } catch (e) { /* unsupported */ }",
      "    }",
      "    if (alive) continue",
      "    fail(name(el), \"the class \" + JSON.stringify(cls) + \" reaches nothing on this element, and \" + naming.length + \" rule(s) name it elsewhere. A class that exists in another context styles nothing here and fails in silence: no build error, no console message, and markup that reads as done. An app hosting a document has two class sets. Check which stylesheet applies where this element sits, and what that class actually sets.\")",
      "  }",
      "}",
      "if (!scanned) fail(\"(the check itself)\", \"nothing carried a class, so nothing was measured\")",
      "else note(scanned + \" elements measured against \" + sels.length + \" selectors\")",
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
    id: 'a-type-role-is-one-decision',
    where: 'render',
    line: 'Text takes its size and its leading from the SAME type role.',
    /* ── A SIZE FROM ONE ROLE AND A LEADING FROM ANOTHER ──
     *
     * The published roles pair a size with a leading. Nothing kept them
     * together, so a heading could take one role’s size and another role’s
     * leading and look almost right.
     *
     * Measured on this system’s own preview screens: eighteen headings wrote
     * their size inline from one role while the element they sat in supplied
     * the leading of a different one. A card title asked for a 20px role and
     * rendered on a 32px role’s leading.
     *
     * The tell was how little a fix moved it. The author rewrote the whole
     * leading ladder, set that role to 1.625, and the title moved 0.5px,
     * because it was still reading the other role’s 1.375.
     *
     * ASK THE RENDERED PAIR, NOT THE MARKUP. A class name, a tag or a
     * comment can all say the wrong thing. What ships is a font-size and a
     * line-height, so those are what get compared.
     *
     * TWO ROLES MAY SHARE A SIZE, and here two do at 18px. So the test is
     * whether ANY role with this size also has this leading. Requiring one
     * particular role would fault a correct page the moment a scale doubles
     * up a step.
     *
     * A SIZE THAT MATCHES NO ROLE IS A DIFFERENT FAULT and a different
     * check owns it. Reporting it here would say "leading" about an
     * off-scale size and send the reader to the wrong line. */
    body: [
      "var ROLE_NAMES = ['display','h1','h2','h3','h4','h5','h6',",
      "  'body-lg','body-md','body-sm','caption','overline','button','code']",
      "var ROLES = []",
      "for (const r of ROLE_NAMES) {",
      "  const size = parseFloat(tokenValue('--font-' + r + '-size'))",
      "  const lead = parseFloat(tokenValue('--font-' + r + '-leading'))",
      "  if (size > 0 && lead > 0) ROLES.push({ r: r, size: size, px: size * lead })",
      "}",
      "if (ROLES.length) for (const el of all('*')) {",
      "  if (el.children.length) continue",
      "  if (!el.textContent.trim()) continue",
      "  const cs = getComputedStyle(el)",
      "  const size = parseFloat(cs.fontSize)",
      "  const lh = parseFloat(cs.lineHeight)",
      "  if (!(size > 0) || !(lh > 0)) continue",
      "  const sameSize = ROLES.filter(x => Math.abs(x.size - size) < 0.6)",
      "  if (!sameSize.length) continue",
      "  if (sameSize.some(x => Math.abs(x.px - lh) < 0.8)) continue",
      /* ── ASK THE FAULT, NOT A LIST OF EXEMPTIONS ──
       *
       * This gate used to be a box test with an exemption bolted onto it, and
       * the box test was a NO-OP. It read `hs.height === "auto"` off computed
       * style, and computed style resolves `height` to the USED value in px
       * for every rendered element, so "auto" was never seen. Any element
       * whose own content box equals its line box was then exempted, which is
       * every single-line block. Proven by injection: a heading at 40px on a
       * 96px leading, a pair no role publishes, came back clean.
       *
       * THE FAULT IS ONE ROLE'S LEADING ON ANOTHER ROLE'S SIZE, which is what
       * the rule says: 18 headings took the h5 size and the h3 leading,
       * because an `h3` tag carried `font-size: var(--font-h5-size)`. So the
       * leading has to belong to a PUBLISHED role. The failure line already
       * computed that and only printed it.
       *
       * Measured on this system's own preview with every exemption removed:
       * 47 candidates at a role size and 0 findings. The buttons at 12/26 and
       * the badges at 12/18 are silent because no role publishes 26 or 18 —
       * they state their own pair, which is a component's business and not a
       * role borrowed from somewhere. The original fault, injected as 20px on
       * the h3 leading of 44.48px, fires and names h3.
       *
       * One question in place of three, and each of the three was wrong in a
       * different direction. */
      "  const lent = ROLES.filter(x => Math.abs(x.px - lh) < 0.8).map(x => x.r)",
      "  if (!lent.length) continue",
      "  const owner = sameSize.map(x => x.r).join(' or ')",
      "  fail(name(el), 'this is ' + round(size) + 'px, which is the ' + owner + ' size, and its line height is ' + round(lh) + 'px, which that role does not publish. That leading belongs to ' + lent.join(' or ') + '. A type role pairs a size with a leading, so take both from one role rather than the size from one and the leading from whatever element it sits in.')",
      "}",
    ],
  },
  {
    id: 'a-lift-must-not-survive-a-wrap',
    where: 'render',
    line: 'A transform that centres a row on a heading is removed once that row wraps below it.',
    /* ── A TRANSFORM COSTS NO LAYOUT, WHICH IS WHY IT CAN OVERLAP ──
     *
     * A row of actions beside a heading is lifted onto the heading's cap band.
     * Once the row WRAPS onto a line of its own there is nothing to centre
     * against, and the same lift pulls it over whatever is above.
     *
     * Nothing caught it, because a transform is invisible to layout. Every
     * geometric check trusts the laid-out box; the `covered` check asks
     * `elementFromPoint`, and the overlap lands in the heading's descender
     * space where there is no ink to obscure.
     *
     * Measured on one dashboard: the action group carried
     * `translateY(-8.6px)`, its top sat 0.6px ABOVE the title's bottom edge,
     * and it began 93.6px inside the title's right edge. The rule was written
     * down and never checked, so the user found it in a screenshot.
     *
     * PROVE THE TRANSFORM IS THE CAUSE. Remove it, re-measure, and report only
     * when the overlap goes with it. A deliberate overlap is a technique, and
     * without that step this would fault every one of them. */
    body: [
      "const tyOf = m => {",
      "  const g = /matrix\\(([^)]*)\\)/.exec(m)",
      "  if (!g) return 0",
      "  const parts = g[1].split(',')",
      "  return parseFloat(parts[5] || '0') || 0",
      "}",
      "for (const el of all('*')) {",
      "  const cs = getComputedStyle(el)",
      "  if (!cs.transform || cs.transform === 'none') continue",
      "  const ty = tyOf(cs.transform)",
      "  if (Math.abs(ty) <= 0.5) continue",
      "  const prev = el.previousElementSibling",
      "  if (!prev) continue",
      "  const ps = getComputedStyle(prev)",
      "  if (ps.display === 'none' || ps.position === 'absolute' || ps.position === 'fixed') continue",
      /* ── `display: contents` IS NOT A BOX, AND ITS CHILDREN ARE ──
         A dissolved wrapper reports 0x0, so comparing against it measures
         nothing and the check bails. `.page-title` is exactly that at the
         width where this fault appears, and its h1 is the real box. Take the
         union of what the wrapper renders. */
      "  const paintedBox = node => {",
      "    const r = node.getBoundingClientRect()",
      "    if (r.width > 0 && r.height > 0) return r",
      "    let l = Infinity, t = Infinity, rr = -Infinity, bb = -Infinity",
      "    for (const k of node.querySelectorAll('*')) {",
      "      const kr = k.getBoundingClientRect()",
      "      if (!kr.width || !kr.height) continue",
      "      if (kr.left < l) l = kr.left",
      "      if (kr.top < t) t = kr.top",
      "      if (kr.right > rr) rr = kr.right",
      "      if (kr.bottom > bb) bb = kr.bottom",
      "    }",
      "    return rr > l ? { left: l, top: t, right: rr, bottom: bb, width: rr - l, height: bb - t } : r",
      "  }",
      "  const a = paintedBox(prev), b = el.getBoundingClientRect()",
      "  if (!a.height || !b.height) continue",
      "  if (b.left > a.right - 0.5 || a.left > b.right - 0.5) continue",
      "  const over = a.bottom - b.top",
      "  if (over <= 0.25) continue",
      "  const had = el.style.transform",
      "  el.style.transform = 'none'",
      "  const clean = el.getBoundingClientRect()",
      "  el.style.transform = had",
      "  if (a.bottom - clean.top > 0.25) continue",
      "  fail(name(el), 'this row carries a ' + round(ty) + 'px vertical transform and overlaps ' + name(prev) + ' above it by ' + round(over) + 'px. Without the transform it does not. A lift that centres a row on a heading has nothing to centre against once the row wraps, and a transform costs no layout, so it pulls the row over whatever sits above. Reset it in the block that declares the collapse.')",
      "}",
    ],
  },
  {
    id: 'a-row-alone-on-its-line-covers-it',
    where: 'render',
    line: 'An action row that takes a line of its own covers that line.',
    /* ── A ROW TOLD TO TAKE THE LINE MUST USE THE LINE ──
     *
     * The document says an action row that breaks, breaks into PAIRS: two per
     * line, equal, covering the whole width. Nothing checked it, and the rule
     * is the easiest in the set to obey halfway. A builder writes the pairing
     * once, proves it on the screen in front of them, and leaves the next
     * header flat. Both then drop below the title and only one covers its line.
     *
     * Measured on two surfaces of one system at 768px: 285px of controls on a
     * 718px line with 433px empty, and a lone 36px toggle on a 534px line with
     * 498px empty. Every other check reported both clean, because nothing was
     * out of line with anything — the line itself was the wrong shape.
     *
     * ASK THE FAULT, NEVER THE MECHANISM. The first version of this asked
     * whether an auto margin sat on a growing box, which was the shape of the
     * one instance in hand. It faulted correct code whose margin a later rule
     * had overridden, and it missed a header holding a single control. Three
     * conditions instead, and no mechanism in any of them:
     *
     *   1. The box was TOLD to take the line — an auto margin, a 100% basis,
     *      or a positive grow. One instruction in three spellings.
     *   2. It took it, so its width is the parent content box.
     *   3. Its content leaves more of that line empty than full.
     *
     * A hole larger than the content is not a matter of taste. It says the
     * instruction bought nothing, and the element asked for it itself.
     *
     * Every child must be a CONTROL, or this is prose, and left-aligned prose
     * is correct. That guard keeps it off headings and paragraphs.
     *
     * STATE THE LIMIT RATHER THAN CLAIMING SAFETY. This asks about a row that
     * spans its whole line. A group that grew to fill only the space LEFT on a
     * shared line has the same fault and a different geometry: its box is flush
     * against the end while its content packs at its own start. Telling that
     * apart from a deliberately start-aligned toolbar needs the cascade, since
     * an auto margin that resolved to zero is invisible to `getComputedStyle`.
     * The author-side toolkit resolves it; this one does not, and a check that
     * fires on correct code costs more than the miss it prevents.
     *
     * FLATTEN A DISSOLVED WRAPPER FIRST. `display: contents` generates no box,
     * so a visibility filter drops the wrapper and everything inside it. The
     * pairing pattern DEPENDS on dissolving a wrapper at wide widths, which
     * makes the shape this check could not otherwise see the shape the
     * document asks for. */
    body: [
      "var CTRL = 'button, input, select, textarea, a[href], summary, [role=button],'",
      "  + ' [role=checkbox], [role=radio], [role=tab], [role=switch], [tabindex]'",
      "for (const el of all('*')) {",
      "  const cs = getComputedStyle(el)",
      "  if (cs.display.indexOf('flex') === -1 || cs.flexDirection !== 'row') continue",
      "  const parent = el.parentElement",
      "  if (!parent) continue",
      "  const ink = []",
      "  for (const c of el.children) {",
      "    if (getComputedStyle(c).display === 'contents') { for (const g of c.children) ink.push(g) }",
      "    else ink.push(c)",
      "  }",
      "  const paint = ink.filter(visible).filter(c => {",
      "    const p = getComputedStyle(c).position",
      "    return p !== 'absolute' && p !== 'fixed'",
      "  })",
      "  if (!paint.length) continue",
      /* ── EVERY CHILD A CONTROL WAS TOO NARROW, AND A PAGER PROVED IT ──
       *
       * A pager holds two buttons and a readout, and the readout is a
       * `role="status"` span. So `every` answered false and the check bailed on
       * a row taking 746px of a 748px line with 387.5px of hole in it. Wider
       * than the content it held.
       *
       * The question is whether a row of CONTROLS took a line and left it
       * mostly empty. A status beside them does not change that. So: at least
       * one control, and no child that is a block of prose. A paragraph is the
       * case `every` was really guarding against, and it can be named
       * directly. */
      "  if (!paint.some(c => c.matches(CTRL))) continue",
      "  if (paint.some(c => {",
      "    const d = getComputedStyle(c).display",
      "    return !c.matches(CTRL) && /^(block|flow-root)$/.test(d) && c.textContent.trim().length > 60",
      "  })) continue",
      /* ── IT ASKED ABOUT FLEX AND MISSED THE COMMONEST CASE ──
       *
       * The test was `flex-basis: 100%`, a positive `flex-grow`, or an INLINE
       * auto margin. A BLOCK fills its container by default, with no flex
       * property involved at all, and that is how most rows take a line.
       *
       * Measured on one dashboard: a pager took 746px of a 748px content
       * width, 99.7% of the line, and its three items filled 358.5px. 387.5px
       * of hole, wider than the content. The check printed nothing.
       *
       * The inline-only margin test missed a second row the same way. An auto
       * margin set by a STYLESHEET computes to a pixel value, so
       * `el.style.marginLeft` is empty and `getComputedStyle` reads 307.438px.
       * Read the declaration through the CSSOM as well.
       *
       * Ask what the box DID, not which mechanism did it: a row occupying
       * essentially its whole line took that line, however it got there. The
       * 95% test below already asks exactly that, so the gate only has to stop
       * excluding the default. */
      "  const blockish = /^(block|flow-root|list-item)$/.test(cs.display)",
      "    || cs.display === 'flex' && parent && !/flex|grid/.test(getComputedStyle(parent).display)",
      "  const autoSide = p => {",
      "    if (el.style.getPropertyValue(p) === 'auto') return true",
      "    for (const sheet of document.styleSheets) {",
      "      let rules; try { rules = sheet.cssRules } catch (e) { continue }",
      "      for (const r of rules) {",
      "        if (!r.selectorText || !r.style) continue",
      "        if (r.style.getPropertyValue(p) !== 'auto') continue",
      "        try { if (el.matches(r.selectorText)) return true } catch (e) {}",
      "      }",
      "    }",
      "    return false",
      "  }",
      "  const told = cs.flexBasis === '100%' || parseFloat(cs.flexGrow) > 0",
      "    || blockish || autoSide('margin-left') || autoSide('margin-right')",
      "  if (!told) continue",
      "  const pcs = getComputedStyle(parent), pb = parent.getBoundingClientRect()",
      "  const lineW = (pb.right - px(pcs.paddingRight) - px(pcs.borderRightWidth))",
      "    - (pb.left + px(pcs.paddingLeft) + px(pcs.borderLeftWidth))",
      "  const b = el.getBoundingClientRect()",
      "  if (lineW <= 0 || b.width < lineW * 0.95) continue",
      "  const cL = b.left + px(cs.paddingLeft) + px(cs.borderLeftWidth)",
      "  const cR = b.right - px(cs.paddingRight) - px(cs.borderRightWidth)",
      "  let inkL = Infinity, inkR = -Infinity",
      "  for (const c of paint) { const r = c.getBoundingClientRect(); if (r.left < inkL) inkL = r.left; if (r.right > inkR) inkR = r.right }",
      "  const filled = inkR - inkL",
      "  const hole = (cR - cL) - filled",
      "  if (hole <= filled) continue",
      "  fail(name(el), 'this row of ' + paint.length + ' control(s) asked for the whole line, took ' + round(b.width) + 'px of it and filled ' + round(filled) + 'px. ' + round(hole) + 'px is empty. A row that takes a line of its own covers that line: pair the controls two per line and let the last labelled one absorb the slack. A group holding nothing but icon-only controls never needed a line at all — keep it beside the heading.')",
      "}",
    ],
  },
  {
    id: 'a-pair-dissolves-when-a-row-fits',
    where: 'render',
    line: 'A broken action row pairs two per line. When the row fits, every pair dissolves into one flat row.',
    /* ── THE PAIR MUST BE THE CONTAINER, AND BOTH WRONG ANSWERS LOOK RIGHT ──
     *
     * With flex: 1 1 0 on every button the count per line is emergent: five
     * buttons rendered one, three, one. With a 50% basis a min-content floor
     * pushes the two bases past the line and the row WRAPS instead of
     * shrinking the partner, so one long label and two long labels render
     * identically. Two children in their own container give both.
     *
     * Measured on the shipped surfaces. At 1280 every pair computes
     * display: contents and all five rows are one line. At 320 every pair is
     * flex and the line count equals the pair count: 2 pairs give 2 lines, 3
     * give 3, and no line ever holds more than two.
     *
     * SO THIS READS WHAT THE PAGE IS, never what width it is at. It holds at
     * any width the reader looks at.
     */
    body: [
      "/* An action row that breaks, breaks into PAIRS: two per line, equal, across",
      "   the whole width. When the row fits, the pairing dissolves so every button",
      "   sits at its natural width in one flat row.",
      "",
      "   READ WHAT THE PAGE IS, not what width it is at. A pair at",
      "   display: contents has dissolved and its buttons belong on one line. A pair",
      "   that generates a box is holding a line, and a line holds two at most. */",
      "for (const row of all('.action-pairs')) {",
      /* ── THE VISIBILITY FILTER REMOVED THE ONE CASE THIS ASKS ABOUT ──
       *
       * A dissolved pair generates NO BOX, so `visible` drops it, so the
       * half-dissolved branch below could never see one. Measured on a
       * fixture built to break it: one boxed pair and one at
       * display: contents came through as a single pair and reported
       * nothing. The branch was structurally unreachable.
       *
       * One filter cannot serve two questions. Keep a pair that is
       * DISSOLVED, and drop only one that is genuinely hidden. */
      "  const pairs = Array.prototype.slice.call(row.querySelectorAll(':scope > .pair'))",
      "    .filter(p => getComputedStyle(p).display === 'contents' || visible(p))",
      "  if (!pairs.length) continue",
      "  const dissolved = pairs.filter(p => getComputedStyle(p).display === 'contents')",
      "  const boxed = pairs.filter(p => getComputedStyle(p).display !== 'contents')",
      "  /* One mechanism at a time. Half dissolved is a row in two arrangements. */",
      "  if (dissolved.length && boxed.length) {",
      "    fail(name(row),",
      "      'this action row holds ' + dissolved.length + ' dissolved pair(s) and ' + boxed.length + ' that still generate a box, so it is in two arrangements at once. Either the row fits and every pair dissolves, or it does not and every pair holds a line.')",
      "    continue",
      "  }",
      "  const btns = all('.btn').filter(b => row.contains(b))",
      "  if (!btns.length) continue",
      "  const lines = {}",
      "  for (const b of btns) {",
      "    const t = Math.round(b.getBoundingClientRect().top)",
      "    const key = Object.keys(lines).find(k => Math.abs(Number(k) - t) <= 2)",
      "    lines[key == null ? t : key] = (lines[key == null ? t : key] || 0) + 1",
      "  }",
      "  const counts = Object.keys(lines).map(k => lines[k])",
      "  if (dissolved.length === pairs.length) {",
      "    /* Dissolved, so one flat row. A row that still breaks has not been",
      "       dissolved because it fits: it has been dissolved too early. */",
      "    if (counts.length > 1) {",
      "      fail(name(row),",
      "        'every pair here has dissolved, which says the row fits, and its ' + btns.length + ' buttons are on ' + counts.length + ' lines. A dissolved row is one flat row at natural widths. Keep the pairing until the row actually fits.')",
      "    }",
      "    continue",
      "  }",
      "  /* Boxed, so each pair holds a line and a line holds two at most. */",
      "  const over = counts.filter(n => n > 2)",
      "  if (over.length) {",
      "    fail(name(row), 'a broken action row puts at most two buttons on a line, and a line here holds ' + Math.max.apply(null, over) + '. Two per line, equal, across the whole width: the pair has to be the CONTAINER, or the count per line is emergent and one long label pushes a third button up.')",
      "  }",
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
    id: 'a-control-holds-one-mark-size',
    where: 'render',
    line: 'One mark size per control. A mark takes its size from its own control, never from a neighbour.',
    /* ── I SIZED ONE CHEVRON WRONGLY TWICE, FROM TWO NEIGHBOURS ──
     *
     * Adding a chevron to a menu button, I took 10px from a picker in a
     * panel, then 12px from the menus beside it in the same bar. The
     * button own folder mark is 14px, which is the published size. So one
     * control carried two marks at two sizes, and the second attempt made
     * it worse rather than better.
     *
     * Measured across the whole app: exactly one control holds two marks,
     * and it reads 14 and 14. Injecting the 10px version gives a spread of
     * 4 and this fires.
     *
     * TWO EXEMPTIONS, both declared rather than guessed. An avatar is not a
     * mark: it publishes its own size and its own gap. And a specimen row
     * exists to show three sizes, so it carries a marker saying so.
     */
    body: [
      "/* A CONTROL IS A LEAF, so its marks are ornament rather than siblings in a",
      "   layout. Two of them at two sizes is one control speaking twice. */",
      "const MARKED = CONTROL + ', .tab, .nav-item, .select-trigger, .chip, .badge'",
      "for (const c of all(MARKED)) {",
      "  /* An AVATAR is not a mark. It publishes its own size and its own gap. */",
      "  const marks = Array.prototype.slice.call(c.querySelectorAll('svg'))",
      "    .filter(m => visible(m) && !m.closest('.avatar') && boxOf(m))",
      "  if (marks.length < 2) continue",
      "  /* A SPECIMEN ROW EXISTS TO SHOW THREE SIZES, so it cannot be faulted for",
      "     showing three sizes. It says so on itself. */",
      "  if (c.closest('[data-specimen], .specimen, .sizes')) continue",
      "  const sizes = marks.map(m => {",
      "    const r = m.getBoundingClientRect()",
      "    return Math.max(r.width, r.height)",
      "  })",
      "  const spread = Math.max.apply(null, sizes) - Math.min.apply(null, sizes)",
      "  /* WHOLE PIXELS. Half a pixel of difference is not visible, and a",
      "     threshold below one fires on sub-pixel rounding. */",
      "  if (spread < 1) continue",
      "  fail(name(c),",
      "    'this control holds ' + marks.length + ' marks at ' + sizes.map(round).join(', ') + 'px, a spread of ' + round(spread) + 'px. A mark takes its size from its OWN control and never from a neighbour: the published size is one value at every control size, so one control cannot carry two. Read the marks the control already has before adding one.')",
      "}",
    ],
  },
  {
    id: 'an-element-does-not-re-implement-its-own-class',
    where: 'render',
    line: 'No element overrides four or more properties its own class already declares.',
    /* ── A STRAY IS A PRIMITIVE RE-IMPLEMENTED INLINE ──
     *
     * Their rule: audit a new screen for strays before calling it done, by
     * query. One surface carried four, and the class-name guard cannot see any
     * of them, because none is a bad NAME. Its own header says so: it cannot
     * see a screen that uses the wrong legal class.
     *
     * THE COUNT OF INLINE DECLARATIONS IS THE WRONG QUESTION. Measured over
     * 547 inline-styled elements on twelve surfaces: at four or more inline
     * properties it reports a swatch's own colour, a chart column's height and
     * a tooltip's position, all of which are DATA that cannot live in a class.
     *
     * SO ASK HOW MANY OF THEM THE ELEMENT'S OWN CLASS ALREADY SETS. That is a
     * duplicate writer, and it is the shape of a re-implemented primitive.
     * Measured at each bar: 1 gives 38, 2 gives 13, 3 gives 9, 4 gives 8, 6
     * gives 4. Their decision, 10 September 2026: four.
     *
     * At four the list is a tab strip overriding its own row-gap and
     * column-gap, four nav items painting a selected state, and three swatches
     * setting a border and an alignment. Six loses the nav items, which sit at
     * five. Three adds a caption's margin, which is a decision rather than a
     * mistake.
     *
     * ONE CHECK, TWO RULES. The tab strip overriding its own gap is also the
     * one-writer-for-one-gap rule.
     *
     * DATA IS EXEMPT BY ARITHMETIC RATHER THAN BY A LIST. A series stroke, an
     * auto margin and a badge's position are one property each.
     */
    body: [
      "/* THE PROPERTY IS THE KEY, so the question is asked once per property",
      "   rather than once per element. Resolving a selector list per element per",
      "   property took an eleven-surface sweep past thirty seconds once. */",
      "const byProp = new Map()",
      "let readRules = 0",
      "const collect = list => { for (const r of list) {",
      "  if (r.selectorText && r.style) {",
      "    readRules++",
      "    for (let i = 0; i < r.style.length; i++) {",
      "      const p = r.style[i]",
      "      if (!byProp.has(p)) byProp.set(p, [])",
      "      byProp.get(p).push(r.selectorText)",
      "    }",
      "  }",
      "  /* AN EMPTY CSSRuleList IS TRUTHY under CSS nesting, so ask its length. */",
      "  if (r.cssRules && r.cssRules.length) collect(r.cssRules)",
      "} }",
      "for (const sheet of document.styleSheets) {",
      "  try { collect(sheet.cssRules) } catch (e) { /* cross-origin, counted below */ }",
      "}",
      "/* A RUN THAT READ NO RULES IS NOT A CLEAN RESULT. */",
      "if (readRules < 20) {",
      "  fail('(the check itself)', 'read only ' + readRules + ' rules, so nothing was measured. A cross-origin sheet throws on cssRules access, and an empty CSSRuleList is truthy, so a walk that asks the wrong question reads nothing and reports clean.')",
      "  return",
      "}",
      "const matched = new Map()",
      "const declaresOn = (el, p) => {",
      "  if (!byProp.has(p)) return false",
      "  if (!matched.has(p)) {",
      "    let s = new Set()",
      "    try { s = new Set(Array.prototype.slice.call(document.querySelectorAll(byProp.get(p).join(',')))) } catch (e) { /* an unparsable list */ }",
      "    matched.set(p, s)",
      "  }",
      "  return matched.get(p).has(el)",
      "}",
      "/* ── COUNT WHAT A PERSON WROTE, NEVER THE LONGHANDS IT EXPANDS TO ──",
      "   `border: 1px solid X` reaches the style object as twelve longhands,",
      "   border-image among them, so one line scored twelve and a bar of four was",
      "   really a bar of one shorthand. Measured on our own swatch: 33 inline",
      "   longhands, 22 of them duplicated, from three things somebody typed.",
      "   Grouped, the same twelve surfaces hold nothing above one group. */",
      "const group = p => p",
      "  .replace(/^border-(top|right|bottom|left)-(color|style|width)$/, 'border')",
      "  .replace(/^border-image-.*$/, 'border')",
      "  .replace(/^border-(top|bottom)-(left|right)-radius$/, 'border-radius')",
      "  .replace(/^(padding|margin)-(top|right|bottom|left)$/, '$1')",
      "  .replace(/^background-.*$/, 'background')",
      "  .replace(/^(row|column)-gap$/, 'gap')",
      "  .replace(/^(inset|overflow|font|flex|grid|place|transition|animation|outline|mask|scroll)-.*$/, '$1')",
      "let asked = 0",
      "for (const el of all('[style]')) {",
      "  const st = el.style",
      "  /* THE SCOPE ROOT CARRIES THE WHOLE TOKEN BLOCK, at 577 declarations on",
      "     our own. It is not an element re-implementing a class. */",
      "  if (st.length > 60) continue",
      "  if (!visible(el)) continue",
      "  asked++",
      "  const dupes = []",
      "  for (let i = 0; i < st.length; i++) {",
      "    const p = st[i]",
      "    if (!declaresOn(el, p)) continue",
      "    const g = group(p)",
      "    if (dupes.indexOf(g) < 0) dupes.push(g)",
      "  }",
      "  /* THREE THINGS SOMEBODY TYPED. Two is a correction plus a value, which",
      "     a person chooses. Three is the primitive rewritten. Measured on the",
      "     two real cases: a strip restating its gap, padding and rule, and an",
      "     item restating its weight, colour and corner. */",
      "  if (dupes.length < 3) continue",
      "  fail(name(el),",
      "    'this element sets ' + dupes.length + ' things inline that a class on it already declares: ' + dupes.slice(0, 6).join(', ') + (dupes.length > 6 ? ' and more' : '') + '. That is the primitive re-implemented in the screen rather than used, so the class carries one answer and the element another, and the next change to the class reaches only one of them. Move the difference into the class, or into a state the markup declares.')",
      "}",
      "if (!asked) note('nothing on this page carries an inline style, so no element was compared against its own classes')",
      "else note(asked + ' inline-styled element(s) compared against the ' + readRules + ' rules that match them')",
    ],
  },
  {
    id: 'a-mark-paints-the-published-size',
    where: 'render',
    line: 'Every mark inside a control paints the size the system publishes for it.',
    /* ── A CONTROL THAT PUBLISHES A MARK SIZE MUST PAINT IT ──
     *
     * Two checks already ask about a mark and neither asks this. The spread
     * check asks whether ONE control carries two sizes, so a mark that is
     * uniformly wrong passes it. The target check asks the box against the
     * pointer floor and has no opinion about the ink inside it.
     *
     * So the recorded fault had nothing looking at it: a 44px button, a 16px
     * label and a 10px icon. Three separate rules resized a button and left
     * the mark behind, and every check on those controls was green.
     *
     * IT NEEDS NO MAP FROM A CLASS TO A TOKEN, because the published size is
     * ONE value at every control. That is their decision of 10 September 2026,
     * taken from four options rendered at actual size: a 14px mark beside the
     * 14px label every one of the six components carries. So the check reads
     * every published mark size, requires them to agree, and compares the
     * painted marks against that one value.
     *
     * A SECOND PUBLISHED VALUE IS THE DRIFT ITSELF. Two sizes across six
     * components is what let three of them drift, because a reader cannot name
     * the axis that separates 14 from 16 and nothing tells a new component
     * which it takes.
     *
     * READ THE SCOPE'S OWN PROPERTIES, not the token set. That set is built
     * from the file on the source side and is empty in a browser. An exported
     * build sets its tokens on the root and an editor sets them on the
     * preview's own scope, and both are inline custom properties on the scope
     * element.
     *
     * THREE EXEMPTIONS, EACH A PROPERTY RATHER THAN A NAME. An avatar is not a
     * mark and publishes its own size. A specimen row exists to show three
     * sizes and says so on itself. And the scope holds marks that are not in a
     * control at all, an empty state's doubled mark among them, so scoping to
     * controls excludes them by construction.
     */
    body: [
      "const el = scopeEl()",
      "const published = []",
      "if (el) {",
      "  /* THE COMPUTED VALUE, NEVER THE INLINE ATTRIBUTE. An exported build",
      "     declares its tokens in a stylesheet on the root and an editor sets",
      "     them inline on the preview's own scope. Reading the attribute finds",
      "     the second and nothing in the first. Computed style enumerates a",
      "     custom property, so one loop covers both: measured 609 of 1086",
      "     entries on our own scope. */",
      "  const cs = getComputedStyle(el)",
      "  for (let i = 0; i < cs.length; i++) {",
      "    const p = cs[i]",
      "    if (!/^--cmp-[a-z0-9-]+-icon-size$/.test(p)) continue",
      "    const v = px(cs.getPropertyValue(p))",
      "    if (v) published.push([p, v])",
      "  }",
      "}",
      "if (!published.length) {",
      "  note('no component publishes a mark size on this scope, so nothing was compared')",
      "} else {",
      "  const distinct = []",
      "  for (const p of published) if (distinct.indexOf(p[1]) < 0) distinct.push(p[1])",
      "  if (distinct.length > 1) {",
      "    fail(name(el),",
      "      'the components publish ' + distinct.length + ' different mark sizes: ' + published.map(p => p[0] + ' at ' + round(p[1]) + 'px').join(', ') + '. A mark is one size at every control and at every size step, so a second value is a drift nobody can name an axis for. Publish one size and let the alignment rule centre it.')",
      "  }",
      "  const want = Math.min.apply(null, distinct)",
      "  const MARKED = CONTROL + ', .tab, .nav-item, .select-trigger'",
      "  let asked = 0",
      "  for (const c of all(MARKED)) {",
      "    if (c.closest('[data-specimen], .specimen, .sizes')) continue",
      "    for (const m of Array.prototype.slice.call(c.querySelectorAll('svg, .icon'))) {",
      "      if (!visible(m) || m.closest('.avatar')) continue",
      "      const r = m.getBoundingClientRect()",
      "      if (!r.width || !r.height) continue",
      "      const painted = Math.max(r.width, r.height)",
      "      asked++",
      "      /* WHOLE PIXELS. A ratio and a border can leave a fraction, and a",
      "         threshold under one fires on rounding. */",
      "      if (Math.abs(painted - want) < 1) continue",
      "      fail(name(c),",
      "        'this control paints its mark at ' + round(painted) + 'px where the system publishes ' + round(want) + 'px. A rule that resizes a control has to restate its mark, and three rules here did not. Read the published size rather than the neighbour: a mark is one size at every control size, so nothing about the box decides it.')",
      "    }",
      "  }",
      "  if (!asked) note('no control on this page holds a mark, so nothing was compared against the published ' + round(want) + 'px')",
      "  else note(asked + ' mark(s) compared against the published ' + round(want) + 'px')",
      "}",
    ],
  },
  {
    id: 'a-control-size-is-a-token',
    where: 'source',
    line: 'A control states its size with the published token, never a number typed in the rule.',
    /* ── THE FLOOR IS THE PUBLISHED TOKEN, AND A TYPED NUMBER CANNOT FOLLOW IT ──
     *
     * A rule that types a control height states a second answer to a question
     * the token already answers. It reads as deliberate and it cannot move
     * when the token moves.
     *
     * Measured on our own sheets the day this shipped. A nav call to action
     * typed 40px, which was what the links beside it carried BEFORE the same
     * file was corrected to read the touch token. So the correction reached
     * the links and stopped twenty lines short of the button: two nav items
     * at 44px and the action at 40, in one column, at every width.
     *
     * Nothing reported it. The row check measures a ROW, and a folded nav is
     * a column, so the two heights never sat on one line. The floor check
     * measures the pointer in use, and a desktop run compares against 24.
     *
     * TWO SCOPE DECISIONS, so it cannot fire on correct work. A SIZING
     * property only, because a typed padding or gap answers to the spacing
     * grid and a different check. And a BARE literal only: a calc, a max, a
     * var and a percentage are all derived from something, so only a number
     * standing alone is this fault.
     *
     * Measured against our own two stylesheets after the repair: zero.
     */
    body: [
      "/* A CONTROL, asked by the words the system publishes for its own",
      "   components. A heading or a card states a height for its own reasons;",
      "   a control states one that a floor has an opinion about. */",
      "const CTRL = /(^|[\\s>+~.])(btn|button|input|select|tab|nav-item|nav-list|checkbox|switch|chip|close|trigger|pager|seg)([\\s.:>[]|$)/",
      "const SIZING = /(?:^|[;\\s])(height|min-height|inline-size|min-inline-size|width|min-width)\\s*:\\s*([^;}]+)/g",
      "for (const f of files.filter(x => x.css)) {",
      "  for (const block of f.bare.matchAll(/([^{}@]+)\\{([^{}]*)\\}/g)) {",
      "    const selector = block[1].split(\",\").map(x => x.trim()).find(x => CTRL.test(x))",
      "    if (!selector) continue",
      "    for (const d of block[2].matchAll(SIZING)) {",
      "      const value = d[2].trim()",
      "      /* A BARE LITERAL ONLY. A calc, a max, a var and a percentage are all",
      "         derived from something and can follow it; a number cannot. */",
      "      if (!/^-?\\d+(\\.\\d+)?px$/.test(value)) continue",
      "      fail(f.path, lineOf(f, block.index),",
      "        selector + \" types \" + d[1] + \": \" + value + \". A control size is a published token, so a typed number is a second answer to a question the token already answers, and it cannot move when the token moves. This is how a touch floor gets missed: the correction reaches the rules that read the token and stops at the one that does not.\")",
      "    }",
      "  }",
      "}",
    ],
  },
  {
    id: 'an-icon-only-control-is-square',
    where: 'render',
    line: 'A pressable thing with a mark and no visible words is one to one, at every size.',
    /* ── AN OBLONG READS AS A BUTTON WHOSE LABEL FAILED TO LOAD ──
     *
     * Measured before the repairs: 46x28 and 70x44 on a menu button, and
     * 28x44 on fifteen controls where a stated width defeated the ratio.
     * Nothing asserted the shape either time.
     *
     * CSS CANNOT ASK THIS, WHICH IS WHY IT IS A RENDER CHECK. A selector
     * cannot ask whether a child is rendered, so a label hidden by a width
     * rule leaves the markup unchanged and the class never arrives. Walk
     * the descendants and ask what the engine renders.
     *
     * AND ICON-ONLY MEANS THERE IS AN ICON. Asking only about the words and
     * the sides faulted every control that paints its own content: 55
     * palette swatches at 63x40 and 5 seed swatches at 129x64, none holding
     * a mark, all rectangles on purpose. 60 findings out of 62. A swatch IS
     * its colour, and no glyph is there whose squareness could be asked.
     *
     * Measured on the shipped surfaces: 11 instances over 7 surfaces, worst
     * ratio 1.000, and nothing lacking the class that should carry it.
     */
    body: [
      "/* VISIBLE words, so a clipped screen-reader name does not count. A label",
      "   hidden to a pixel has a box, and treating it as words is what let a",
      "   menu button ship at 46x28 with the class never arriving. */",
      "const showsWords = el => {",
      "  const readable = n => { const b = n.getBoundingClientRect(), cs = getComputedStyle(n)",
      "    return b.width > 4 && b.height > 4 && cs.visibility !== \"hidden\" && cs.opacity !== \"0\" }",
      "  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true",
      "  for (const n of el.querySelectorAll(\"*\")) {",
      "    const own = Array.prototype.filter.call(n.childNodes,",
      "      x => x.nodeType === 3 && x.textContent.trim())",
      "    if (own.length && readable(n)) return true",
      "  }",
      "  return false",
      "}",
      "for (const el of all(\"button, a[href], .btn, [role=button], .nav-item, .tab, summary\")) {",
      "  const r = el.getBoundingClientRect()",
      "  if (r.width < 4 || r.height < 4) continue",
      "  /* A MARK, because that is the clause the code dropped last time. */",
      "  if (!el.querySelector(\"svg, img, .icon\")) continue",
      "  if (showsWords(el)) continue",
      "  const ratio = r.width / r.height",
      "  /* TWO PERCENT, because a sub-pixel rounding is not an oblong, and a",
      "     verdict that flips on floating point noise is worse than none. */",
      "  if (Math.abs(ratio - 1) <= 0.02) continue",
      "  fail(name(el), \"this control holds a mark and no visible words, and measures \" + round(r.width) + \"x\" + round(r.height) + \", a ratio of \" + round(ratio) + \". An oblong reads as a button whose label failed to load. State the shape with aspect-ratio 1 and no width at all: a ratio only makes a size when the other axis is auto, so a stated width is the one thing that defeats it. Where a width rule hides the words, put the shape in the SAME block that hides them.\")",
      "}",
    ],
  },
  {
    id: 'a-mark-is-never-a-typed-glyph',
    where: 'render',
    line: 'A mark comes from the icon set. A typed character is not an icon and a word space is not a gap.',
    /* ── A TEXT GLYPH TAKES THE LABEL FONT AND THE LABEL SPACING ──
     *
     * Measured on one button reading a plus and then Add Seed: the plus took
     * the label size instead of the mark size, took a word space instead of
     * the icon gap, and would change shape with the typeface. The button had
     * no display, no alignment and no gap, because as far as the code knew
     * there was no mark in it at all.
     *
     * ASK THE DOM, NEVER THE SOURCE. A glyph can arrive from a data string,
     * and a source scan reads only what somebody typed in a component.
     *
     * SCOPE IT TO THE CONTROLS, and to a glyph a set already draws. An
     * ellipsis in a sentence is prose, and a plus inside a formula is a
     * value. A pressable thing is where a mark belongs.
     *
     * Measured on the shipped surfaces and on the editor chrome: zero.
     */
    body: [
      "/* THE GLYPHS AN ICON SET ALREADY DRAWS. A chevron, a cross, a tick, an",
      "   arrow, a plus, a reload, an overflow run. Written as code points, so",
      "   this file stays readable in any editor. */",
      "const GLYPH = new RegExp(\"[\" + [0x2b, 0xd7, 0x2715, 0x2713, 0x21ba, 0x22ef,",
      "  0x2192, 0x2190, 0x2191, 0x2193, 0x2039, 0x203a, 0xab, 0xbb]",
      "  .map(c => String.fromCharCode(c)).join(\"\") + \"]\")",
      "for (const el of all(\"button, a[href], .btn, [role=button], .nav-item, .tab, summary\")) {",
      "  for (const n of Array.prototype.slice.call(el.childNodes)) {",
      "    if (n.nodeType !== 3) continue",
      "    const t = n.textContent",
      "    if (!GLYPH.test(t)) continue",
      "    fail(name(el), \"this control types \" + JSON.stringify(t.trim().slice(0, 20)) + \" where a mark belongs. A text glyph takes the LABEL size rather than the mark size, and a word space is roughly a quarter of the font size and answers to no spacing token. Use the icon set at the size token for this control step, and the three properties that travel with it: inline-flex, align-items centre, and the published icon gap.\")",
      "    break",
      "  }",
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
      /* THE BODY FACE CAN BE A MONO FACE, AND THEN THIS COULD NEVER PASS.
         Asked as a NAME pattern, the check faulted every date in a system whose
         body family IS 'Space Mono'. Nine findings on one page, correct code,
         and no remedy: the date was already in the body face and the rule was
         telling it to move there. The question is not what the family is
         CALLED. It is whether this run of text left the body face. */
      "const first = f => (f || '').split(',')[0].trim().replace(/^[\"']|[\"']$/g, '').toLowerCase()",
      "const BODY = first(tokenValue('--font-body-md-family'))",
      "for (const el of all('*')) {",
      "  if (el.children.length) continue",
      "  const t = (el.textContent || '').trim()",
      "  if (!t || t.length > 40 || !MONTHS.test(t)) continue",
      "  const fam = getComputedStyle(el).fontFamily",
      "  if (BODY && first(fam) === BODY) continue",
      "  if (!/mono|courier|consolas/i.test(fam)) continue",
      "  fail(name(el), 'the text ' + JSON.stringify(t.slice(0, 24)) + ' carries a month name and is set in ' + fam.split(',')[0] + '. A date with a month name is read rather than compared, so it takes the body face. Only an all-figure date takes the mono one.')",
      "}",
    ],
  },

  {
    id: 'the-row-declares-the-baseline-too',
    where: 'render',
    line: 'A child asking for `align-self: baseline` needs its row to declare `align-items: baseline`. The child aligns to the FLEX LINE, and a row centring its items never puts that line on the label.',
    /* ── HALF A MECHANISM READS AS DONE ──
     *
     * `align-self: baseline` aligns a child to its flex LINE'S baseline. A row
     * declaring `align-items: center` does not put that line on the label, so
     * the child is the only member of the baseline set and effectively packs to
     * the start of the line.
     *
     * It hid because a one-line row makes the two answers identical. Inside a
     * folded menu the item grew to 40px and they diverged: spread 2.65 against
     * 0.50 for the same markup at a wider size.
     *
     * ASK THE DECLARATION THAT DECIDES THE AXIS. In a COLUMN flex box the cross
     * axis is horizontal, so `align-self: baseline` is not the row-baseline
     * question at all and falls back to start. Measured before this check
     * shipped: 28 candidates over 12 surfaces, 27 in a row with a baseline
     * parent, and the 1 exception was a badge sitting in a column card. Without
     * the axis gate that badge is a false positive, and it is correct code.
     *
     * A PARENT ALREADY DECLARING BASELINE MAKES THE CHILD REDUNDANT, NOT WRONG.
     * The check asks only about the disagreement.
     *
     * PROVEN BOTH WAYS. Silent on 36 runs, 12 surfaces at 296, 640 and 1024.
     * Then `.with-icon` was set to `align-items: center` in the stylesheet: 3
     * findings, each naming the row and the value it declares. Reverted, the
     * same surfaces report nothing. */
    body: [
      "let seen = 0",
      "for (const el of all('*')) {",
      "  if (getComputedStyle(el).alignSelf !== 'baseline') continue",
      "  const p = el.parentElement",
      "  if (!p) continue",
      "  const ps = getComputedStyle(p)",
      "  if (!/flex/.test(ps.display)) continue",
      "  /* A COLUMN'S CROSS AXIS IS HORIZONTAL, so baseline there is a different",
      "     question and the browser falls back to start. */",
      "  if (/column/.test(ps.flexDirection)) continue",
      "  seen++",
      "  if (ps.alignItems === 'baseline') continue",
      "  fail(name(el), 'asks for align-self: baseline while its row ' + name(p)",
      "    + ' declares align-items: ' + ps.alignItems",
      "    + '. A child aligns to the flex LINE, so the line has to be on the label first.'",
      "    + ' Declare align-items: baseline on the row. A one-line row hides this, because there the two answers land in the same place.')",
      "}",
      "if (!seen) note('no child asks for align-self: baseline inside a row, so this rule is UNMEASURED here.')",
      "else note(seen + ' baseline child/children inside a row.')",
    ],
  },

  {
    id: 'a-fixed-height-control-centres-its-label',
    where: 'render',
    line: 'One mechanism centres a label. A control with a stated height centres its own by line-height; make it a flex box as well and it centres twice.',
    /* ── AN ANTI-PATTERN THIS SYSTEM STATES AND NEVER CHECKED ──
     *
     * The Do's and Don'ts carry it word for word: never baseline-align the
     * contents of a fixed-height control, because baseline pins the label to
     * the top of the box. Nothing measured it.
     *
     * A build read the prose and wrote `align-items: baseline` on its buttons
     * and its nav items. Every button label sat 6.5px above its box centre in
     * a 36px box, and every nav label 3.5px in a 44px box. Both verifiers
     * passed the page, and a person found it in a screenshot.
     *
     * TWO CAUSES, ONE SYMPTOM, and the second is the one a rule about
     * `align-items` misses. A flex row that CANNOT WRAP has one line, that
     * line fills the box, and baseline then places the label at the line's own
     * ascent. So a box taller than its content puts the label near the top
     * even when the alignment is deliberate. `flex-wrap: wrap` with
     * `align-content: center` gives the property a line to centre.
     *
     * ASK THE RESULT, NOT THE DECLARATION. Either cause is legal on its own,
     * and a row aligned on the baseline is correct wherever the box fits its
     * content. What is never correct is a label off the centre of a box whose
     * height was stated. So this measures the label against the box.
     *
     * THE THRESHOLD IS ON THE MOVE. Centring shifts the label by the whole
     * offset, so 1px here is 1px of repair. */
    body: [
      "const CONTROL = 'button, .btn, .nav-item, a.btn, [role=\"button\"], .select-trigger, .tab'",
      "for (const el of all(CONTROL)) {",
      "  const cs = getComputedStyle(el)",
      "  /* A STATED HEIGHT is the whole point. A box that fits its content has",
      "     nothing to centre in, and its label sits where the content puts it. */",
      "  const stated = cs.height !== 'auto' && cs.blockSize !== 'auto'",
      "  const floored = parseFloat(cs.minHeight) > 0 || parseFloat(cs.minBlockSize) > 0",
      "  if (!stated && !floored) continue",
      "  const r = el.getBoundingClientRect()",
      "  if (!r.width || !r.height) continue",
      "  /* Its OWN label, as a text node. A child element's rect can start at an",
      "     ornament, and measuring that reports the mark rather than the words. */",
      "  const tn = Array.prototype.filter.call(el.childNodes, function (n) {",
      "    return n.nodeType === 3 && n.textContent.trim()",
      "  })[0]",
      "  if (!tn) continue",
      "  const range = document.createRange()",
      "  range.selectNode(tn)",
      "  const rects = Array.prototype.filter.call(range.getClientRects(), function (q) { return q.width > 0 })",
      "  if (rects.length !== 1) continue   /* a wrapped label has no single centre */",
      "  const ctx = document.createElement('canvas').getContext('2d')",
      "  ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily",
      "  const m = ctx.measureText('H')",
      "  const base = rects[0].top + m.fontBoundingBoxAscent",
      "  const cap = base - m.actualBoundingBoxAscent",
      "  const off = ((cap + base) / 2) - ((r.top + r.bottom) / 2)",
      "  if (Math.abs(off) <= 1) continue",
      "  fail(name(el), 'this control states its height and its label sits ' + round(off) + 'px from the box centre. Baseline alignment pins a label to the top of a fixed-height box, and so does a single flex line in a box taller than its content. Centre the label: an inline-block with a line-height equal to the CONTENT box, or flex-wrap with align-content centre where the mark still needs the baseline.')",
      "}",
    ],
  },

  /* ══ MANUAL ═══════════════════════════════════════════════════════════ */

  /* ══ THE SPACING RULES A MACHINE CANNOT ANSWER ══════════════════════════
   *
   * Each of these was measured against this system's own twelve surfaces
   * before it was left as a checklist line, and the numbers are why. A stated
   * "no check" is a decision; an absent entry reads as an oversight.
   *
   * A CHECK THAT FIRES ON CORRECT CODE COSTS MORE THAN THE MISS IT PREVENTS,
   * and these are the drafts that did. The measurements are recorded so the
   * next person to try does not repeat them.
   */

  {
    id: 'an-ornament-column-takes-its-content',
    where: 'render',
    line: 'Shrink the ornament columns rather than growing a content one. A checkbox or row-action column takes width: 1%, which means its content and no more, and the slack spreads across the columns holding data.',
    /* ── AN ORNAMENT COLUMN HOLDS A CONTROL AND NO WORDS ──
     *
     * That is a property of the cells, never a class. Every cell in the
     * column holds a pressable thing and none of them holds text.
     *
     * THE TEST IS ITS OWN CONTENT, not a comparison with another column. A
     * row-action column holding three buttons is legitimately wider than a
     * narrow data column, so "narrowest column" is the wrong question.
     * Measured on the one instance here: 16px of drawn box plus 28 and 16 of
     * padding is 60, and the column measures 60.00 exactly.
     *
     * A STRETCHED CHILD MAKES IT UNMEASURABLE, so say so rather than pass. A
     * child at width: 100% reports the content as the whole inner width, and
     * then the sum always equals the column. */
    body: [
      "const PRESS = \"button, input, select, [role=button], [role=checkbox], [role=switch], .btn, .checkbox, .switch\"",
      "let asked = 0",
      "for (const table of all(\"table\")) {",
      "  const rows = Array.prototype.slice.call(table.querySelectorAll(\"tr\")).filter(visible)",
      "  if (rows.length < 2) continue",
      "  let cols = 0",
      "  for (const r of rows) if (r.children.length > cols) cols = r.children.length",
      "  for (let c = 0; c < cols; c++) {",
      "    const cells = rows.map(r => r.children[c]).filter(Boolean).filter(visible)",
      "    if (cells.length < 2) continue",
      "    /* ORNAMENT: a control in every cell, and words in none. */",
      "    if (cells.some(x => x.textContent.trim().length)) continue",
      "    if (!cells.every(x => x.matches(PRESS) || x.querySelector(PRESS))) continue",
      "    const cell = cells[0]",
      "    const cs = getComputedStyle(cell)",
      "    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)",
      "    const box = cell.getBoundingClientRect()",
      "    const inner = box.width - pad",
      "    const kids = Array.prototype.slice.call(cell.children).filter(visible)",
      "    if (!kids.length) continue",
      "    const rects = kids.map(k => k.getBoundingClientRect())",
      "    let lo = Infinity, hi = -Infinity",
      "    for (const r of rects) { if (r.left < lo) lo = r.left; if (r.right > hi) hi = r.right }",
      "    const content = hi - lo",
      "    /* A STRETCHED CHILD CANNOT ANSWER THIS. */",
      "    if (content >= inner - 1) {",
      "      note(\"an ornament column whose child fills the cell, so its own content cannot be measured: \" + name(cell))",
      "      continue",
      "    }",
      "    asked++",
      "    const slack = round(box.width - (content + pad))",
      "    if (slack <= 2) continue",
      "    fail(name(cell), \"an ornament column \" + round(box.width) + \"px wide holding \" + round(content)",
      "      + \"px of content plus \" + round(pad) + \"px of padding, so it has taken \" + slack",
      "      + \"px of slack. A checkbox or row-action column takes its content and no more, at width: 1%,\"",
      "      + \" and the slack belongs to the columns holding data.\")",
      "  }",
      "}",
      "if (!asked) note(\"no ornament column on this page, so this rule is UNMEASURED here. One holds a control in every cell and words in none.\")",
      "else note(asked + \" ornament column(s) measured against their own content.\")",
    ],
  },

  {
    id: 'a-split-goes-by-what-each-side-holds',
    where: 'manual',
    /* ── MEASURED, AND THERE IS NOTHING MECHANICAL LEFT TO ASK ──
     *
     * The rule chooses a RATIO by what each side holds, and a ratio is a design
     * decision. The only mechanical half is whether the split fits, and
     * `nothing-clipped-out-of-reach` and the row-fits checks already own that.
     *
     * Measured over nine surfaces at 768, 1024 and 1536: a percentage-basis
     * probe found 2 candidates and neither is a split. Both are page-head rows
     * whose children carry a 100% basis, which is the own-a-line mechanism.
     * The one real split is a grid at 486 and 200 wide, then 1254 and 200, on
     * one line at both widths. The context column holds a fixed 200 and the
     * content takes the rest, which is the rule obeyed.
     *
     * One instance is not a check. It stays a checklist line, and the
     * instruction it carries is to put the measurement in the comment. */
    line: 'Split a row by what each side holds, never down the middle. Three tiles against one card came 4.4px short at 46 to 54 and fit at 40 to 60; put the measurement in the comment.',
  },

  {
    id: 'a-flexible-box-holds-its-own-label',
    where: 'render',
    line: 'A box at flex: 1 with min-width: 0 can shrink under its own label, and nothing calls that an overflow because nothing leaves the box. Measured once at 73px of word in a 34px box. Floor it at max-content and let the row wrap.',
    /* ── AN OVERHANG IS READABLE, AND A CUT WORD IS THE FAULT ──
     *
     * The first draft asked only whether the widest line of the box own text
     * is wider than its content box. Measured over 417 candidates: 3
     * findings, all chart tick labels at 296px, 21 to 23px of text in a 19px
     * box. Every one is correct code. A tick column is extended by half a
     * line at each end and the label overhangs on purpose, so it paints
     * outside its box and stays fully readable.
     *
     * So the second condition is that the box CUTS the word. It clips on the
     * inline axis, or it breaks the word with overflow-wrap or word-break.
     * An ellipsis is truncation somebody asked for, so it is exempt, the
     * same way the clipping rule exempts it.
     *
     * Measured after: 550 candidates over 36 surface-width cells, 3
     * overhangs correctly skipped, 0 findings.
     *
     * THE WIDEST SINGLE LINE RECT IS THE MEASUREMENT, never scrollWidth. A
     * Range over the box own text nodes returns one rect per line, so one
     * word wider than the box produces one rect wider than the box. */
    body: [
      "/* THE BOX OWN TEXT, never a child element. A wrapper holding a long word in",
      "   a descendant is that descendant question. */",
      "const widestLine = el => {",
      "  let w = 0",
      "  for (const n of el.childNodes) {",
      "    if (n.nodeType !== 3 || !n.textContent.trim()) continue",
      "    const r = document.createRange(); r.selectNode(n)",
      "    for (const b of r.getClientRects()) if (b.width > w) w = b.width",
      "  }",
      "  return w",
      "}",
      "let asked = 0",
      "for (const el of all(\"*\")) {",
      "  const cs = getComputedStyle(el)",
      "  /* THE SHAPE THE RULE IS ABOUT: it grows, and it may shrink to nothing. */",
      "  if (parseFloat(cs.flexGrow) < 1) continue",
      "  if (!(cs.minWidth === \"0px\" || cs.minWidth === \"0\")) continue",
      "  asked++",
      "  const inner = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)",
      "  const line = widestLine(el)",
      "  if (line <= inner + 1) continue",
      "  /* AN OVERHANG IS READABLE. A tick label overhangs its own column by",
      "     design, so the fault needs the box to CUT the word. */",
      "  if (cs.textOverflow === \"ellipsis\") continue",
      "  const clips = /hidden|clip|auto|scroll/.test(cs.overflowX)",
      "  const breaks = /anywhere|break-word/.test(cs.overflowWrap + \" \" + cs.wordBreak)",
      "  if (!clips && !breaks) continue",
      "  fail(name(el), \"holds \" + round(line) + \"px of unbreakable word in a \" + round(inner)",
      "    + \"px box, and the box \" + (clips ? \"clips it\" : \"breaks it mid-word\")",
      "    + \". Nothing leaves the box, so no overflow check reports it. flex: 1 with min-width: 0\"",
      "    + \" lets a box shrink under its own label. Floor it at max-content and let the row wrap.\")",
      "}",
      "if (!asked) note(\"no box at flex-grow 1 with min-width 0 on this page, so this rule is UNMEASURED here.\")",
      "else note(asked + \" flexible box(es) measured against their own text.\")",
    ],
  },

  {
    id: 'two-rules-of-one-weight-do-not-stack',
    where: 'render',
    line: 'Never stack two rules of one weight close together. Three inside 43px say one boundary three times, and repetition reads as noise. Space says how big a boundary is, never weight.',
    /* ── 84 FINDINGS, TWO CAUSES, BOTH CORRECT CODE ──
     *
     * A ROW OF CELLS ON ONE y IS ONE RULE. Three table cells each carry a
     * bottom border and they paint one line across the row. Counting each
     * cell separately reported three stacked rules at a single y, over and
     * over: 1001, 1058, 1115, 1172. So group by y, weight and colour, and
     * ask about DISTINCT positions.
     *
     * AN OUTLINE IS NOT A DIVIDER. A box bordered on all four sides is a
     * control or a card, and its edges divide nothing. Three buttons in one
     * row gave three top edges at one y.
     *
     * Measured after: 34 distinct rules over nine surfaces, 0 stacks.
     *
     * A THIN BOX COUNTS TOO, because a divider may be a 1px filled element
     * rather than a border. It needs a fill to paint, and no border of its
     * own, or the two mechanisms report the same line twice. */
    body: [
      "/* ONE ENTRY PER PAINTED LINE, keyed by position, weight and colour. */",
      "const seen = new Map()",
      "const add = (y, w, c, el) => {",
      "  const k = Math.round(y) + \"|\" + w + \"|\" + c",
      "  if (!seen.has(k)) seen.set(k, { y: y, w: w, c: c, el: el })",
      "}",
      "for (const el of all(\"*\")) {",
      "  const cs = getComputedStyle(el)",
      "  const r = el.getBoundingClientRect()",
      "  /* A RULE CROSSES SOMETHING. A 12px edge is ornament. */",
      "  if (r.width < 24) continue",
      "  const bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0",
      "  const bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0",
      "  if (!(bt > 0 && bb > 0 && bl > 0 && br > 0)) {",
      "    if (bt > 0 && bt <= 2 && cs.borderTopStyle !== \"none\") add(r.top, bt, cs.borderTopColor, el)",
      "    if (bb > 0 && bb <= 2 && cs.borderBottomStyle !== \"none\") add(r.bottom, bb, cs.borderBottomColor, el)",
      "  }",
      "  if (r.height > 0 && r.height <= 2 && bt === 0 && bb === 0 && cs.backgroundColor !== \"rgba(0, 0, 0, 0)\") {",
      "    add(r.top, r.height, cs.backgroundColor, el)",
      "  }",
      "}",
      "const rules = Array.from(seen.values()).sort((a, b) => a.y - b.y)",
      "for (let i = 0; i + 2 < rules.length; i++) {",
      "  const a = rules[i], m = rules[i + 1], c = rules[i + 2]",
      "  if (c.y - a.y > 43) continue",
      "  if (!(a.w === m.w && a.w === c.w && a.c === m.c && a.c === c.c)) continue",
      "  fail(name(a.el), \"three rules of one weight inside \" + round(c.y - a.y) + \"px, at \" + a.w",
      "    + \"px in \" + a.c + \". That says one boundary three times, and repetition reads as noise.\"",
      "    + \" Space says how big a boundary is, never weight. The other two are \" + name(m.el)",
      "    + \" and \" + name(c.el) + \".\")",
      "  i += 2",
      "}",
      "if (!rules.length) note(\"no painted rule on this page, so this rule is UNMEASURED here.\")",
      "else note(rules.length + \" distinct painted rule(s) measured.\")",
    ],
  },

  {
    id: 'a-menu-control-is-a-sibling-of-the-action-group',
    where: 'render',
    line: 'A menu control is a button in the action group, always rightmost, and a SIBLING of that group rather than a member. Inside it, it can only go where the group goes.',
    /* ── I COULD NOT SEE THIS RULE, AND THE REASON WAS THE SELECTOR ──
     *
     * The first draft asked for a disclosure OR aria-expanded OR
     * aria-haspopup. Measured on this app: 4 candidates, and 3 were wrong.
     * Two chrome dropdowns and a readout, none of them navigation.
     *
     * SO ASK WHAT THE CONTROL OPENS. Nothing about it is reachable: the
     * navigation list is not a child, not a sibling and not an
     * aria-controls target. Measured 0 of 4, our own correct control
     * included. That discriminator does not exist in the DOM.
     *
     * TWO SHAPES DO SAY MENU, and both are properties. A disclosure, which
     * is a summary inside a details. Or a BURGER: three or four stacked
     * bars of one size, wider than tall, with no words in any of them.
     * Measured over every element on the page: exactly 1 match, at
     * 16x2 three times, and it is the burger.
     *
     * THE HEAD TEST WAS THE OTHER HALF. Four levels of ancestor reached a
     * wrapper three levels up and put every chrome dropdown on a page
     * head. Two levels, with the heading a child or a grandchild.
     *
     * ONE OTHER ACTION IS ALREADY A GROUP. The floor was two, and a group of
     * one action plus the menu still wraps as a unit, which is the whole
     * reason the rule exists. Proven at a floor of one: the injected wrapper
     * holding one button fires, and nine surfaces stay silent.
     *
     * A LANDING HEADER IS NOT A PAGE HEAD, and the two-level window is what
     * says so. Its menu sits in a `.page-actions` inside `.header-nav` inside
     * a bar row, and the nearest heading is three levels up in the page stack.
     * That is site navigation, not a title row, so this rule does not govern
     * it and the check correctly skips it.
     *
     * THE LIMIT: a menu built as a bare button, with no burger and no
     * disclosure, is invisible here. Nothing in the DOM separates it from
     * a filter dropdown. */
    body: [
      "const ACTION = \"button, a[href], [role=button], .btn\"",
      "const HEADING = \"h1, h2, h3\"",
      "/* A BURGER IS THREE STACKED BARS OF ONE SIZE. Read the boxes, never a class",
      "   name: the reader names it whatever they like. */",
      "const bars = el => {",
      "  const kids = Array.prototype.slice.call(el.children)",
      "  if (kids.length < 3 || kids.length > 4) return false",
      "  if (el.textContent.trim()) return false",
      "  const boxes = kids.map(k => k.getBoundingClientRect())",
      "  if (boxes.some(b => !b.width || !b.height)) return false",
      "  const w = boxes[0].width, h = boxes[0].height",
      "  if (h >= w) return false",
      "  return boxes.every(b => Math.abs(b.width - w) < 0.6 && Math.abs(b.height - h) < 0.6)",
      "}",
      "const menus = []",
      "for (const s of all(\"details > summary\")) if (s.parentElement) menus.push(s.parentElement)",
      "for (const el of all(ACTION)) {",
      "  if (menus.some(m => m === el || m.contains(el))) continue",
      "  if (Array.prototype.slice.call(el.querySelectorAll(\"*\")).some(bars)) menus.push(el)",
      "}",
      "let seen = 0",
      "for (const ctrl of menus) {",
      "  /* THE HEAD HOLDS THE HEADING AND THE CONTROL, at two levels at most. */",
      "  let head = null",
      "  for (let p = ctrl.parentElement, i = 0; p && i < 2; p = p.parentElement, i++) {",
      "    const kids = Array.prototype.slice.call(p.children)",
      "    if (kids.some(c => c.matches(HEADING) || c.querySelector(HEADING))) { head = p; break }",
      "  }",
      "  if (!head) continue",
      "  seen++",
      "  /* THE GROUP IS A RUN OF PRESSABLE SIBLINGS, never a class name. Walk from",
      "     the control up to the head. A box on that path holding two or more OTHER",
      "     actions IS the action group, so this control is a member of it. */",
      "  for (let p = ctrl.parentElement; p && p !== head; p = p.parentElement) {",
      "    const others = all(ACTION).filter(b => p.contains(b) && b !== ctrl && !ctrl.contains(b))",
      "    if (others.length < 1) continue",
      "    fail(name(ctrl), \"a menu control INSIDE the action group \" + name(p)",
      "      + \", which holds \" + others.length + \" other action\" + (others.length === 1 ? \"\" : \"s\")",
      "      + \". A menu control is a SIBLING of that group.\"",
      "      + \" Inside it, it can only go where the group goes, so it loses the title row the moment the group wraps.\")",
      "    break",
      "  }",
      "}",
      "/* A RUN THAT MEASURED NOTHING IS NOT A PASS. A menu control belongs to",
      "   the folded layout, so above the fold width it is display: none and this",
      "   check reads zero of them. Measured on this app: shown at 296 and 640,",
      "   hidden at 768, 1024 and 1536. Say so rather than printing a bare 0. */",
      "if (!seen) note('no menu control on any page head. Above the width where the navigation folds there is none to place, so this rule is UNMEASURED here. Run again at your narrowest width.')",
      "else note(seen + \" menu control(s) on a page head, of \" + menus.length + \" found. A menu with no burger and no disclosure is not measured.\")",
    ],
  },

  {
    id: 'staying-with-the-title-beats-being-rightmost',
    where: 'render',
    line: 'Rightmost and stays-with-the-title cannot both hold in one wrapping row. Staying with the title wins: the action group takes a line of its own, and the menu sits at the end of the row it is on.',
    /* ── THE TEST ONLY EXISTS WHERE THE GROUP HAS LEFT THE ROW ──
     *
     * Both halves of the rule cannot be asked at once. While the action group
     * shares the row, the menu is deliberately NOT rightmost among the
     * buttons, and faulting that would fault the rule.
     *
     * So the check asks two things, and only where the group is on another
     * line. The menu is still on the title line. And it sits at the end of
     * that line, measured against the head CONTENT edge rather than its
     * border box, because a reader head carries padding and ours does not.
     *
     * Measured over four surfaces and five widths: the menu shares the title
     * line on Dashboard and Settings at 296, 320, 480 and 640, the group is
     * on its own line in all eight, and the menu right edge equals the head
     * right edge exactly. Above 768 the control is display: none.
     *
     * THE DETECTOR IS THE SAME TWO SHAPES the sibling rule uses, a disclosure
     * or a burger read by its boxes. Two bodies cannot share a helper, so it
     * is repeated here. Change one, change both. */
    body: [
      "const HEADING = \"h1, h2, h3, h4, h5, h6, [class*=title]\"",
      "const ACTION = \"button, a[href], [role=button], .btn\"",
      "/* A BURGER IS THREE OR FOUR STACKED BARS OF ONE SIZE, wider than tall. */",
      "const bars = el => {",
      "  const kids = Array.prototype.slice.call(el.children)",
      "  if (kids.length < 3 || kids.length > 4) return false",
      "  if (el.textContent.trim()) return false",
      "  const boxes = kids.map(k => k.getBoundingClientRect())",
      "  if (boxes.some(b => !b.width || !b.height)) return false",
      "  const w = boxes[0].width, h = boxes[0].height",
      "  if (h >= w) return false",
      "  return boxes.every(b => Math.abs(b.width - w) < 0.6 && Math.abs(b.height - h) < 0.6)",
      "}",
      "const menus = []",
      "for (const sm of all(\"details > summary\")) if (sm.parentElement) menus.push(sm.parentElement)",
      "for (const el of all(ACTION)) {",
      "  if (menus.some(m => m === el || m.contains(el))) continue",
      "  if (Array.prototype.slice.call(el.querySelectorAll(\"*\")).some(bars)) menus.push(el)",
      "}",
      "let asked = 0",
      "for (const ctrl of menus) {",
      "  const head = ctrl.parentElement",
      "  if (!head) continue",
      "  const title = head.querySelector(HEADING)",
      "  if (!title) continue",
      "  /* THE GROUP IS A RUN OF PRESSABLE SIBLINGS in a box of its own. */",
      "  let group = null",
      "  for (const box of Array.prototype.slice.call(head.children)) {",
      "    if (box === ctrl || box.contains(ctrl) || !visible(box)) continue",
      "    const acts = all(ACTION).filter(b => box === b || box.contains(b))",
      "    if (acts.length >= 2) { group = box; break }",
      "  }",
      "  if (!group) continue",
      "  const c = ctrl.getBoundingClientRect(), g = group.getBoundingClientRect()",
      "  /* WHILE THE GROUP SHARES THE ROW the menu is deliberately not last. */",
      "  const shares = g.top < c.bottom - 0.5 && g.bottom > c.top + 0.5",
      "  if (shares) continue",
      "  asked++",
      "  const t = title.getBoundingClientRect()",
      "  if (!(c.top < t.bottom - 0.5 && c.bottom > t.top + 0.5)) {",
      "    fail(name(ctrl), \"the action group has taken a line of its own and the menu control went with it.\"",
      "      + \" Staying with the title wins, so order the menu BEFORE the group and let the group wrap alone.\")",
      "    continue",
      "  }",
      "  const hs = getComputedStyle(head)",
      "  const edge = head.getBoundingClientRect().right - (parseFloat(hs.paddingRight) || 0)",
      "  const short = round(edge - c.right)",
      "  if (short > 1) fail(name(ctrl), \"the menu control stops \" + short + \"px short of the end of its own row,\"",
      "    + \" and the action group is on another line. Nothing else is on this row to take that seat.\")",
      "}",
      "if (!asked) note(\"no page head where the action group has left the menu row, so this rule is UNMEASURED here. Both halves only exist once the group wraps.\")",
      "else note(asked + \" page head(s) measured with the group on its own line.\")",
    ],
  },

  {
    id: 'a-byline-belongs-to-its-heading',
    where: 'render',
    line: 'A byline belongs to its heading, not under it. The distance is one small step and it has ONE writer: either the container publishes it or the byline states its own margin, never both.',
    /* ── IT WAS A CHECKLIST LINE AND THE MECHANISM WAS ALREADY CHECKED ──
     *
     * `one-writer-for-one-gap` asks the half about two writers, and it was
     * reporting SIX live faults on this app when I came to write this: a
     * `stack-sm` publishing a 12px row-gap under a byline default that adds
     * 4, measured 16 in five title groups and one specimen sheet.
     *
     * THE FIVE WERE REAL AND THE FIX IS STRUCTURAL. A gap belongs to the
     * container and a margin to the child, and a child cannot ask what its
     * parent declared. So the pair becomes ONE child of the stack: it then
     * owns its 4px and the stack still separates it from what follows.
     * Measured after: 44 pairs, every container gap 0, every margin 2 or 4.
     *
     * THE SIXTH WAS A SPECIMEN SHEET, which is correct code. A heading
     * specimen above a caption specimen is two samples, not a pair, so the
     * shape rule reached them and the container gap was added to it.
     *
     * THIS CHECK ASKS THE OTHER HALF: the STEP. The distance has to be
     * findable and small. At 0 the byline reads as a second line of the
     * heading, and at 12 it reads as a floating paragraph. Both were shipped
     * faults here.
     *
     * READ THE DECLARATION, NEVER THE GEOMETRY. An inline heading reports
     * its INK box, so a `strong` above a byline measures 6.19px box to box
     * where the declared distance is 4. Half the line leading sits in
     * between and no repair can remove it.
     *
     * A SECONDARY TYPE CLASS IS THE SUBJECT, never a bare paragraph. Body
     * copy under a heading is a different distance, and a run over nine
     * surfaces with `p` in the list returned 46 pairs of which 12 were card
     * flow rather than bylines.
     *
     * PROVEN IN BOTH DIRECTIONS, 9 September 2026. This shipped as a checklist
     * line first, on the grounds that it was untested, and a manual entry is
     * not a safeguard. Two pairs injected in the SOURCE, in one card, with the
     * container gap at zero so the margin is the whole distance. A 16px margin
     * fired the too-far branch and a 0px margin fired the touching branch, in
     * one run. Reverted, the same surface reports nothing. */
    body: [
      "const STEP = px(tokenValue(\"--space-2xs\")) || 4",
      "const HEAD = \"h1, h2, h3, h4, h5, h6, .t-h1, .t-h2, .t-h3, .t-h4, .t-h5, .t-h6\"",
      "const BY = \".caption, .small, .muted, .subtle, .t-caption\"",
      "let seen = 0",
      "for (const h of all(HEAD)) {",
      "  const by = h.nextElementSibling",
      "  if (!by || !visible(by) || !by.matches(BY)) continue",
      "  /* A SPECIMEN SHEET IS EXEMPT. Two samples in a run are not a pair. */",
      "  if (by.closest(\"[data-specimen], .specimen, .sizes\")) continue",
      "  seen++",
      "  const ps = getComputedStyle(h.parentElement)",
      "  const gap = ps.rowGap === \"normal\" ? 0 : parseFloat(ps.rowGap) || 0",
      "  const m = parseFloat(getComputedStyle(by).marginBlockStart) || 0",
      "  const d = gap + m",
      "  if (d > STEP + 0.5) {",
      "    fail(name(by), \"sits \" + round(d) + \"px under its heading, and the byline step is \" + STEP",
      "      + \"px. At that distance the line reads as a paragraph of its own rather than as part of the title. The pair is one group, so give it one small step.\" + (gap > 0 && m > 0",
      "      ? \" Here a \" + round(gap) + \"px container gap and a \" + round(m) + \"px margin add: wrap the pair so it is ONE child of that container.\"",
      "      : \"\"))",
      "  } else if (d < 0.5) {",
      "    fail(name(by), \"touches its heading. At zero it reads as a second line of the title rather than as a byline. One small step, which is \" + STEP + \"px here.\")",
      "  }",
      "}",
      "if (!seen) note(\"no heading-and-byline pair on this page, so this rule is UNMEASURED here. The subject is a secondary type class directly after a heading.\")",
      "else note(seen + \" heading-and-byline pair(s), against a \" + STEP + \"px step.\")",
    ],
  },

  {
    id: 'an-action-stands-clear-of-its-explanation',
    where: 'render',
    line: 'An action stands clear of the text that explains it, by 16px. Measure to the button, not to its row.',
    /* ── I MADE THIS A CHECKLIST LINE ON A BAD MEASUREMENT ──
     *
     * The probe measured from the text to the action ROW border box. The 16px
     * lives inside that row as padding, so every correct case read 8 or 12 and
     * a 16px floor looked like it would fire seven times.
     *
     * Re-measured to the BUTTON across six surfaces: 13 candidates, at 12, 16,
     * 36.25, 110.78, 179.25, 187.14 and 251.84px. Two under 16. One was a real
     * defect. The other is the page head, where the actions carry a transform
     * that centres them on the heading cap band.
     *
     * FOUR GUARDS. Four words, so a one-word label above a field is not an
     * explanation. The previous sibling holds no control, or this is a control
     * row. The button is below the text. And a transformed row is placed by
     * another rule. */
    body: [
      "const STEP = px(tokenValue('--space-md')) || 16",
      "/* A text block is a run of words with no control in it. Four words, so a",
      "   one-word label above a field is not mistaken for an explanation. */",
      "for (const parent of all('*')) {",
      "  const kids = Array.prototype.filter.call(parent.children, el => {",
      "    const r = el.getBoundingClientRect()",
      "    return r.width > 0 && r.height > 0",
      "  })",
      "  if (kids.length < 2) continue",
      "  for (let i = 1; i < kids.length; i++) {",
      "    const prev = kids[i - 1], row = kids[i]",
      "    /* AN ACTION, NOT ANY CONTROL. A checkbox after a paragraph is a form",
      "       field and a nav item is a destination. Both were reported before this",
      "       line, and the rule is about neither. */",
      "    const isAct = e => e.matches('button, a[href], [role=button], .btn')",
      "      && !e.matches('.nav-item, .tab, [role=tab], input, select, textarea')",
      "    const btn = isAct(row) ? row : [...row.querySelectorAll('*')].find(isAct)",
      "    if (!btn) continue",
      "    if (prev.matches(CONTROL) || prev.querySelector(CONTROL)) continue",
      "    const words = prev.textContent.trim().split(/\\s+/).filter(Boolean)",
      "    if (words.length < 4) continue",
      "    /* ── AN EXPLANATION IS PROSE, AND THE MARKUP SAYS SO ──",
      "       A word count cannot tell a sentence that explains an action from a",
      "       readout in a pager bar. Measured at a 296px pane: four findings, and",
      "       two were a readout span and a specimen span. A paragraph is the",
      "       element prose is written in, so ask for one. */",
      "    if (!(prev.matches('p') || prev.querySelector('p'))) continue",
      "    const pr = prev.getBoundingClientRect(), br = btn.getBoundingClientRect()",
      "    /* Stacked, and the button below the text. */",
      "    if (br.top < pr.bottom - 0.5) continue",
      "    /* ── A TRANSFORMED ROW IS PLACED BY ANOTHER RULE ──",
      "       The actions beside a page heading carry a translate that centres them",
      "       on its cap band, so their distance from the subtitle above is a",
      "       by-product rather than a stated gap. Measured on one page head: 12px,",
      "       and correct. Read the DECLARATION, not the distance. */",
      "    if (getComputedStyle(row).transform !== 'none') continue",
      "    /* AN OUT-OF-FLOW SIBLING SETS NO GAP. The Gallery tooltip specimen",
      "       is an absolutely positioned span floating over its own trigger,",
      "       measured 9.28px from the button and chosen by nobody. */",
      "    if (/absolute|fixed/.test(getComputedStyle(prev).position)) continue",
      "    /* MEASURE TO THE BUTTON, NEVER TO ITS ROW. The 16px lives inside the",
      "       row as padding, so measuring to the row box reads 8 or 12 on correct",
      "       code. That mistake is why this check was a checklist line for a day. */",
      "    const gap = br.top - pr.bottom",
      "    if (gap >= STEP - 0.5) continue",
      "    fail(name(btn), 'this button sits ' + gap.toFixed(2) + 'px below the text that explains it, and the floor is ' + STEP + 'px. A control needs more clearance than the card own rhythm, or it reads as one more line of the paragraph. Put the difference in the action row own padding, so the container gap and the floor have one writer each.')",
      "  }",
      "}",
    ],
  },

  {
    id: 'a-default-goes-first-in-the-file',
    where: 'source',
    line: 'A default that publishes a distance for a container children goes FIRST in the file. Written last it beats every component stating its own, because both sit at the same specificity and order decides a tie.',
    /* ── A PARSER CAN ANSWER THIS EXACTLY, AND ONLY A PARSER CAN ──
     *
     * The render pass reads a computed value and has no opinion about which
     * rule won or where it sat. Order in the file is the whole question, so
     * it belongs on this side.
     *
     * A CONTAINER-FLOW DEFAULT is a child-sibling selector publishing the
     * distance above each child. It cost this project a measured fault:
     * written at the bottom it deleted the auto margin holding an action row
     * on a stretched card foot, and a gap fell from 34.25px to 12 on three
     * cards.
     *
     * THE ZEROING EXEMPTIONS ARE NOT DEFAULTS, so they may follow it. They
     * declare a margin too, which is why the check compares the FIRST flow
     * default against the first rule that is not one.
     *
     * Measured on this stylesheet: the default sits at line 104 and the first
     * other block-start margin at 172, over 13 such rules. The other two
     * sheets publish no flow default and are skipped. */
    body: [
      "const MARGIN = /(^|[;{\\s])margin(-block-start|-top)\\s*:/",
      "const FLOW = />\\s*\\*\\s*\\+\\s*\\*/",
      "for (const f of files.filter(f => f.css)) {",
      "  let flowAt = -1, flowLine = 0, otherAt = -1, otherLine = 0, otherSel = \"\"",
      "  const re = /([^{}@]+)\\{([^{}]*)\\}/g",
      "  let m",
      "  while ((m = re.exec(f.bare))) {",
      "    const sel = m[1].trim(), decl = m[2]",
      "    if (!MARGIN.test(decl)) continue",
      "    const line = f.bare.slice(0, m.index).split(\"\\n\").length",
      "    if (FLOW.test(sel)) { if (flowAt < 0) { flowAt = m.index; flowLine = line } }",
      "    else if (otherAt < 0) { otherAt = m.index; otherLine = line; otherSel = sel.replace(/\\s+/g, \" \") }",
      "  }",
      "  if (flowAt < 0 || otherAt < 0 || flowAt < otherAt) continue",
      "  fail(f.path, flowLine, \"this container-flow default sits AFTER a rule that states its own distance, at line \"",
      "    + otherLine + \" (\" + otherSel.slice(0, 60) + \"). Both weigh the same, so order decides the tie and the default wins.\"",
      "    + \" It then deletes whatever a component chose. Move the default to the top of the file, ahead of every component.\")",
      "}",
    ],
  },

  {
    id: 'alignment-is-stated-never-inherited',
    where: 'render',
    line: 'Alignment is stated, never inherited from a group that may vanish. A header actions sat at the end only because a neighbouring group carried flex: 1, and that group is hidden at narrow widths: measured, 226px of empty bar beside them. Put the auto margin on the thing that must stay at the end.',
    /* ── THE GEOMETRY ALONE FAULTS CORRECT CODE, 13 TIMES OUT OF 13 ──
     *
     * The shape is easy to read: a flex row whose last child sits at the
     * content end, where neither the row nor that child declares it, and
     * where a SIBLING absorbed the slack. Measured over nine surfaces: 69
     * candidates and 13 such rows.
     *
     * ALL 13 WERE CORRECT CODE, because the growth IS the mechanism there. A
     * pair grows its labelled button so the icon keeps its square. An alert
     * grows its body so the action sits at the end. A row grows its field so
     * the button does. Faulting those faults the rules that ask for them.
     *
     * THE MISSING HALF IS WHETHER THAT SIBLING CAN VANISH, and only the CSS
     * knows. The test is a rule inside a media or container query that sets
     * display: none and reaches the grower.
     *
     * THE CSSOM CANNOT ANSWER IT IN A DEV SERVER. Measured: 25 condition
     * blocks found and 0 rules inside them read as display: none, while the
     * source holds 5. So read the stylesheet TEXT, find each at-rule block by
     * its braces, and collect the selectors inside it that hide something.
     * Measured that way: 5 sheets, 352,059 bytes, 6 hide selectors, matching
     * the source. 13 candidates asked, 0 findings.
     *
     * getComputedStyle CANNOT SEE AN AUTO MARGIN. It reports the used value,
     * so a flex child holding one reads back as 0px. The declaration comes
     * from the inline style and the same stylesheet text. */
    body: [
      "const NL = String.fromCharCode(10)",
      "/* THE STYLESHEET TEXT, because the CSSOM returned 0 of 5 in a dev server. */",
      "const texts = []",
      "for (const n of document.querySelectorAll(\"style\")) texts.push(n.textContent || \"\")",
      "for (const n of document.querySelectorAll(\"link[rel=stylesheet]\")) {",
      "  try { texts.push(await (await fetch(n.href)).text()) } catch (e) { /* cross-origin */ }",
      "}",
      "const bare = texts.join(NL).replace(/\\/\\*[\\s\\S]*?\\*\\//g, m => m.replace(/[^\\n]/g, \" \"))",
      "if (!bare.length) { note(\"no stylesheet text could be read, so this rule is UNMEASURED here.\") }",
      "else {",
      "  /* WHAT A CONDITION BLOCK HIDES. Walk each at-rule by its braces. */",
      "  const hide = []",
      "  const AT = /@(media|container|supports)[^{]*\\{/g",
      "  let at",
      "  while ((at = AT.exec(bare))) {",
      "    let i = at.index + at[0].length, depth = 1",
      "    while (i < bare.length && depth > 0) {",
      "      const ch = bare.charAt(i)",
      "      if (ch === \"{\") depth++",
      "      else if (ch === \"}\") depth--",
      "      i++",
      "    }",
      "    const block = bare.slice(at.index + at[0].length, i - 1)",
      "    for (const r of block.matchAll(/([^{}@]+)\\{([^{}]*)\\}/g)) {",
      "      if (!/(^|[;\\s])display\\s*:\\s*none/.test(r[2])) continue",
      "      for (const one of r[1].split(\",\")) { const t = one.trim(); if (t) hide.push(t) }",
      "    }",
      "  }",
      "  /* WHO IS PUSHED TO THE END ON PURPOSE. An auto margin is a declaration and",
      "     computed style reports its USED value, which is 0px on a flex child. */",
      "  const autoSel = []",
      "  for (const r of bare.matchAll(/([^{}@]+)\\{([^{}]*)\\}/g)) {",
      "    if (!/margin(-inline-start|-left)\\s*:\\s*auto/.test(r[2])) continue",
      "    for (const one of r[1].split(\",\")) { const t = one.trim(); if (t) autoSel.push(t) }",
      "  }",
      "  const hits = sel => el => { try { return el.matches(sel) } catch (e) { return false } }",
      "  const statedEnd = el => {",
      "    for (const prop of [\"margin-inline-start\", \"margin-left\"])",
      "      if (el.style.getPropertyValue(prop) === \"auto\") return true",
      "    return autoSel.some(sel => hits(sel)(el))",
      "  }",
      "  const canVanish = el => hide.some(sel => {",
      "    try { return el.matches(sel) || !!el.querySelector(sel) } catch (e) { return false }",
      "  })",
      "  let asked = 0",
      "  for (const row of all(\"*\")) {",
      "    const cs = getComputedStyle(row)",
      "    if (!/flex/.test(cs.display) || /column/.test(cs.flexDirection)) continue",
      "    /* THE ROW MAY STATE IT ITSELF, and then nothing is inherited. */",
      "    if (/end|between|around|evenly/.test(cs.justifyContent)) continue",
      "    const kids = Array.prototype.slice.call(row.children).filter(visible)",
      "    if (kids.length < 2) continue",
      "    const endEdge = row.getBoundingClientRect().right - (parseFloat(cs.paddingRight) || 0)",
      "    const last = kids[kids.length - 1]",
      "    if (Math.abs(endEdge - last.getBoundingClientRect().right) > 1) continue",
      "    if (parseFloat(getComputedStyle(last).flexGrow) > 0) continue",
      "    /* A SIBLING ABSORBED THE SLACK, so the placement is that sibling own. */",
      "    let grower = null",
      "    for (const k of kids.slice(0, -1)) {",
      "      if (parseFloat(getComputedStyle(k).flexGrow) > 0) { grower = k; break }",
      "    }",
      "    if (!grower) continue",
      "    asked++",
      "    if (statedEnd(last)) continue",
      "    /* AND THE GROWTH IS THE MECHANISM unless that sibling can disappear. A",
      "       pair, an alert body and a field row all grow on purpose: 13 of 13. */",
      "    if (!canVanish(grower)) continue",
      "    fail(name(last), \"sits at the end of its row only because \" + name(grower)",
      "      + \" is growing beside it, and a condition block hides that sibling. When it goes,\"",
      "      + \" this packs back to the start and leaves the row empty beside it. Measured once at\"",
      "      + \" 226px of empty bar. Put the auto margin on the thing that must stay at the end.\")",
      "  }",
      "  if (!asked) note(\"no row where a sibling growth places the last child, so this rule is UNMEASURED here.\")",
      "  else note(asked + \" such row(s) measured, against \" + hide.length + \" hide selector(s) read from \" + texts.length + \" sheet(s).\")",
      "}",
    ],
  },

  {
    id: 'never-correct-a-glyph',
    where: 'source',
    line: 'No icon call site states its own geometry. The box is the system decision and the ink inside it belongs to the library, so a per-glyph width, height, viewBox, transform or stroke is a correction that destroys the set optical balance.',
    /* ── THE STYLESHEET CANNOT HOLD THIS FAULT, SO THE STYLESHEET IS THE
     *    WRONG PLACE TO ASK ──
     *
     * My first matcher looked for a stylesheet rule naming one glyph. It
     * found 16 candidates and every one was a SIDE or a SHAPE class:
     * `.icon-left`, `.icon-end`, `.icon-only`. Nothing in the DOM names an
     * individual icon at all. Every icon renders as `class="icon"` with its
     * size read from `--icon-<step>`, so no selector can reach one glyph and
     * the check had zero candidates for as long as it was written that way.
     * A check with no candidates is a no-op, and a no-op reads as a pass.
     *
     * THE REACHABLE SHAPE IS THE CALL SITE. The component spreads `...rest`
     * onto the svg, on purpose, because without it a prop was silently
     * dropped. So a width, a height, a viewBox or a stroke passed at one call
     * site reaches the element and overrides the token.
     *
     * Measured: 82 call sites, 0 stating geometry. One passes a style object
     * and it sets a colour, which is the toast tick and is not geometry. So
     * the check asks the PROPERTY inside the object rather than whether an
     * object is there.
     *
     * `size` IS LEGAL, because it selects a published step. `d` is legal too,
     * and it is the one per-glyph input the rule allows: the ink is the
     * library decision.
     *
     * A className is NOT asked. It would need the stylesheet to answer, and
     * that is a second hop this parser cannot follow honestly. */
    body: [
      "const GEO = /\\b(?:width|height|viewBox|transform|scale|strokeWidth|stroke-width)\\b/",
      "let asked = 0",
      "for (const f of files.filter(f => !f.css && !f.html)) {",
      "  const re = /<Ico\\b([^>]*?)\\/>/g",
      "  let m",
      "  while ((m = re.exec(f.bare))) {",
      "    asked++",
      "    const props = m[1]",
      "    const hit = GEO.exec(props)",
      "    if (!hit) continue",
      "    const line = f.bare.slice(0, m.index).split(\"\\n\").length",
      "    fail(f.path, line, \"this icon states its own \" + hit[0] + \" at the call site. The box comes from the icon size token and the alignment rule centres whatever size it is, so nothing is left for a call site to correct. Measured in one 12px box: a plus paints 8px of ink, a magnifier 10 and a chevron 4. Scaling one to match another changes the drawing. Pass the published size step instead.\")",
      "  }",
      "}",
      "if (!asked) note(\"no icon call site found, so this rule is UNMEASURED here.\")",
      "else note(asked + \" icon call site(s) read.\")",
    ],
  },

  {
    id: 'an-overhang-asks-its-host',
    where: 'source',
    line: 'A target overhang resolves against its host own height, written as a percentage, never against a control height token the host may not use. Half the shortfall each side then makes the floor exactly, from any host, and a min against zero stops a host already above the floor from growing.',
    /* ── THE ARITHMETIC WAS RIGHT FOR ONE HOST IN THREE ──
     *
     * A target bigger than its box costs no layout, which is how a 16px
     * checkbox reaches 44 without moving anything. The first version wrote
     * the overhang against the small-button height, because that is the floor
     * ONE of three hosts states. A table select-all cell derives its height
     * from the header type and states no floor, so the target came out 0.78px
     * short on two surfaces. That was the third instance-not-class miss from
     * this one overhang.
     *
     * A PERCENTAGE IN AN INSET RESOLVES AGAINST THE CONTAINING BLOCK HEIGHT,
     * so `100%` is whatever the host came out as, derived or stated.
     *
     * THE RENDER SIDE CANNOT ASK IT. A rendered inset is a used pixel value,
     * and a token that happens to equal the host height gives the same
     * number. Only the declaration says which question was asked.
     *
     * SCOPED TO AN INSET, because an overhang is a box placed past its host
     * edge. A height, a line-height or a min-height reading the same token is
     * the floor being stated rather than reached, which is correct.
     *
     * Measured on this stylesheet: 1 such rule, 2 insets, both against 100%. */
    body: [
      "const FLOOR = /--[\\w-]*(?:target|floor)[\\w-]*/",
      "const INSET = /(^|[;{\\s])(inset|inset-block|inset-inline|inset-block-start|inset-block-end|inset-inline-start|inset-inline-end|top|bottom|left|right)\\s*:([^;}]*)/g",
      "let asked = 0",
      "for (const f of files.filter(f => f.css)) {",
      "  const re = /([^{}@]+)\\{([^{}]*)\\}/g",
      "  let m",
      "  while ((m = re.exec(f.bare))) {",
      "    const sel = m[1].trim().replace(/\\s+/g, \" \"), decl = m[2]",
      "    if (!FLOOR.test(decl)) continue",
      "    const insets = [...decl.matchAll(INSET)].filter(x => FLOOR.test(x[3]))",
      "    if (!insets.length) continue",
      "    asked += insets.length",
      "    const bare = insets.filter(x => !/100%/.test(x[3]))",
      "    if (!bare.length) continue",
      "    const line = f.bare.slice(0, m.index).split(\"\\n\").length",
      "    fail(f.path, line, \"this overhang on \" + sel.slice(0, 60) + \" reaches the floor from a token instead of from its host, on \" + bare.map(x => x[2]).join(\" and \") + \". A host that derives its own height states no floor, so the overhang comes out short there by half the difference. Subtract 100% instead, which is the host used height whatever produced it, and hold it at min(0px, ...) so a host already above the floor keeps its size.\")",
      "  }",
      "}",
      "if (!asked) note(\"no inset reads a target or floor token, so this rule is UNMEASURED here.\")",
      "else note(asked + \" overhang inset(s) read.\")",
    ],
  },

  {
    id: 'a-subtraction-asks-about-the-parent',
    where: 'source',
    line: 'A calc that subtracts a container published property is written on the parent relationship, with a child combinator. The property inherits, so a descendant reading it cannot tell whether the value came from its own parent or from something further up.',
    /* ── TWO FIXES CHASED THE SAME WRONG MECHANISM ──
     *
     * Publishing a container gap as a custom property and subtracting it in a
     * descendant fails, because a custom property inherits. A landing card
     * subtracted 16px it never had and its action row halved to 8. A modal
     * footer did the same and measured 11.7 against every card 24.
     *
     * THE FIX IS A CHILD COMBINATOR, which states the relationship the calc
     * assumes. `.stack > .card-actions` is true of the pair or it matches
     * nothing.
     *
     * CONTAINER-SCOPED IS THE DISCRIMINATOR, and it is a declaration rather
     * than a judgement. A property declared only on the scope root or on
     * :root is available to every element by design, so subtracting it asks
     * nothing about a parent. A property some component declares on itself is
     * the one that inherits into places that never had it.
     *
     * READING ITS OWN IS EXEMPT. A rule that declares the property and uses
     * it in the same block is asking about itself, and the page head does
     * exactly that with its line offset.
     *
     * Measured: 64 container-scoped properties over 3 stylesheets, 1
     * subtraction of one, 0 findings. */
    body: [
      "const ROOTSEL = /^(?::root|html|\\*|\\.dmd)$/",
      "let asked = 0, scoped = 0",
      "for (const f of files.filter(f => f.css)) {",
      "  const all = []",
      "  const re = /([^{}@]+)\\{([^{}]*)\\}/g",
      "  let m",
      "  while ((m = re.exec(f.bare))) {",
      "    all.push({ sel: m[1].trim().replace(/\\s+/g, \" \"), decl: m[2],",
      "      line: f.bare.slice(0, m.index).split(\"\\n\").length })",
      "  }",
      "  const declared = new Map()",
      "  for (const r of all) {",
      "    for (const d of r.decl.matchAll(/(--[\\w-]+)\\s*:/g)) {",
      "      if (!declared.has(d[1])) declared.set(d[1], [])",
      "      declared.get(d[1]).push(r.sel)",
      "    }",
      "  }",
      "  const container = new Set()",
      "  for (const [prop, sels] of declared) {",
      "    if (sels.some(s => !s.split(\",\").every(one => ROOTSEL.test(one.trim())))) container.add(prop)",
      "  }",
      "  scoped += container.size",
      "  for (const r of all) {",
      "    for (const u of r.decl.matchAll(/-\\s*var\\(\\s*(--[\\w-]+)/g)) {",
      "      const prop = u[1]",
      "      if (!container.has(prop)) continue",
      "      asked++",
      "      if ((declared.get(prop) || []).includes(r.sel)) continue",
      "      if (r.sel.indexOf(\">\") >= 0) continue",
      "      fail(f.path, r.line, \"this rule subtracts \" + prop + \", which a container publishes, and the selector \" + r.sel.slice(0, 50) + \" states no parent. A custom property inherits, so this matches every descendant of every container that ever set it, including the ones that never did. Name the pair with a child combinator, or let the element take the whole step.\")",
      "    }",
      "  }",
      "}",
      "if (!scoped) note(\"no container publishes a custom property, so this rule is UNMEASURED here.\")",
      "else note(asked + \" subtraction(s) of a container property, out of \" + scoped + \" such propert(ies).\")",
    ],
  },

  {
    id: 'a-chart-owes-a-name-or-says-it-is-decoration',
    where: 'render',
    line: 'A chart is not a widget. It takes no focus and answers no keys, and it owes a NAME instead. A sparkline inside a table row is the one exception: it takes aria-hidden, because the row already carries its name and its value in text.',
    /* ── TWO HALVES, AND ONLY ONE IS ANSWERABLE FROM THE DOM ──
     *
     * "No keys" cannot be asked here. A handler may sit in another file, and
     * asking each file for its own faults the first correct shape it meets.
     * What the DOM answers exactly is FOCUS: a chart carrying a tabindex, or
     * holding something that does, is reachable by Tab and should not be.
     *
     * AND THE NAME IS THE OTHER HALF. A chart with neither a name nor
     * `aria-hidden` reads as an unnamed graphic.
     *
     * `aria-hidden` ON AN ANCESTOR COUNTS. The attribute hides a whole
     * subtree, so a chart inside a hidden wrapper is already out of the tree
     * and asking it again would fault the correct answer.
     *
     * IT FOUND THREE ON ITS FIRST RUN. Every sparkline in this system put
     * `aria-hidden` on its inner svg and not on the sparkline itself, so the
     * span stayed in the tree as an unnamed container. Measured after the fix:
     * 18 charts asked over twelve surfaces, 0 findings.
     *
     * BROKEN ON PURPOSE, in a hand-built fragment rather than the app's own
     * tree, because a framework puts a moved node back on its next render. An
     * unnamed chart fires. A chart with a tabindex fires. A named chart is
     * quiet, and a chart under an `aria-hidden` ancestor reports UNMEASURED
     * rather than clean. */
    body: [
      "let asked = 0",
      "for (const c of all('.chart')) {",
      "  if (c.closest('[aria-hidden=\"true\"]')) continue",
      "  asked++",
      "  if (c.hasAttribute('tabindex') || c.querySelector('[tabindex]')) {",
      "    fail(name(c), 'this chart is reachable by Tab. A chart is not a widget: it takes no focus and answers no keys, because there is nothing to operate. Remove the tabindex and give it a name instead.')",
      "    continue",
      "  }",
      "  const named = c.getAttribute('aria-label') || c.getAttribute('aria-labelledby')",
      "    || c.querySelector('figcaption, .caption, strong')",
      "  if (named) continue",
      "  fail(name(c), 'this chart has neither a name nor aria-hidden, so it reads as an unnamed graphic. Give it an aria-label saying what it plots. A sparkline inside a table row is the exception and takes aria-hidden, because the row already carries its name and its value in text.')",
      "}",
      "if (!asked) note('no chart on this page, so this rule is UNMEASURED here.')",
      "else note(asked + ' chart(s) measured.')",
    ],
  },

  {
    id: 'a-mark-beside-words-names-its-side',
    where: 'render',
    line: 'Say which side a mark is on, with a class. A trailing mark carries the end class and a leading one carries none, because leading is the default. CSS cannot answer it: a selector counts elements, and a text label is not an element.',
    /* ── LEADING IS THE DEFAULT, SO ONLY THE TRAILING CASE CARRIES A CLASS ──
     *
     * My first version asked for a side class on EVERY mark and faulted 68 of
     * 73. A leading mark needs no class, because that is where a mark goes
     * unless something says otherwise.
     *
     * WHY A CLASS AT ALL. `:last-child` counts ELEMENTS, and a button's label
     * is a text node. So a leading mark in `<button><Ico/>Export</button>` is
     * both the first and the last element child, matched the trailing rule,
     * and took its gap on the wrong side. Every labelled button, at every
     * width. No selector fixes it, because the thing CSS needs to see is a
     * text node it cannot select.
     *
     * SO ASK THE GEOMETRY AGAINST THE CLASS. The mark's own rectangle sits
     * after the last word or before it, and the class has to agree.
     *
     * TWO SHAPES ARE PLACED BY LAYOUT AND CARRY NO CLASS. A row that spreads
     * its children puts the mark at the far end by `justify-content`, which is
     * what a select trigger does. And a mark pushed with an auto margin is
     * placed by that margin. Both are declarations, so both are read rather
     * than guessed. Measured: 317 marks asked over twelve surfaces, 31 placed
     * by layout, 0 findings. Before the exemptions the four select triggers
     * were the whole finding list.
     *
     * BROKEN ON PURPOSE, both ways. A trailing mark with no class fires. A
     * leading mark carrying the end class fires. The correct trailing form is
     * quiet, and a mark placed by `space-between` reports UNMEASURED. */
    body: [
      "let asked = 0, byLayout = 0",
      "for (const el of all('.btn, .nav-item, .tab, .badge, .alert')) {",
      "  const marks = Array.prototype.slice.call(el.children)",
      "    .filter(k => k.tagName === 'svg' || (k.classList && k.classList.contains('icon')))",
      "  if (!marks.length) continue",
      "  /* THE WORDS, WHICH MAY BE A TEXT NODE OR A WRAPPING SPAN. */",
      "  const words = Array.prototype.slice.call(el.childNodes).filter(n =>",
      "    (n.nodeType === 3 && n.textContent.trim())",
      "    || (n.nodeType === 1 && n.tagName !== 'svg'",
      "        && !(n.classList && n.classList.contains('icon')) && n.textContent.trim()))",
      "  if (!words.length) continue",
      "  const cs = getComputedStyle(el)",
      "  const spread = /space-between|space-around|space-evenly|end|flex-end/.test(cs.justifyContent)",
      "  const pushed = marks.some(m => {",
      "    const ms = getComputedStyle(m)",
      "    return ms.marginInlineStart === 'auto' || ms.marginLeft === 'auto'",
      "  })",
      "  if (spread || pushed) { byLayout++; continue }",
      "  const wr = words.map(n => {",
      "    if (n.nodeType === 1) return n.getBoundingClientRect()",
      "    const r = document.createRange()",
      "    r.selectNodeContents(n)",
      "    return r.getBoundingClientRect()",
      "  }).filter(r => r.width)",
      "  if (!wr.length) continue",
      "  const lastRight = Math.max.apply(null, wr.map(r => r.right))",
      "  for (const m of marks) {",
      "    const mr = m.getBoundingClientRect()",
      "    if (!mr.width) continue",
      "    asked++",
      "    const trailing = mr.left >= lastRight - 0.5",
      "    const says = /icon-end/.test(m.getAttribute('class') || '')",
      "    if (trailing === says) continue",
      "    fail(name(el), trailing",
      "      ? 'this mark renders AFTER the label and carries no end class, so every rule about a trailing mark misses it. A label is a text node, so :last-child matches the leading mark instead and puts the gap on the wrong side. Add the end class.'",
      "      : 'this mark renders BEFORE the label and carries the end class, so it takes a trailing gap on the leading side. Leading is the default and needs no class at all.')",
      "  }",
      "}",
      "if (!asked) note('no control pairs a mark with words here, so this rule is UNMEASURED.')",
      "else note(asked + ' mark(s) measured, plus ' + byLayout + ' placed by layout rather than by order.')",
    ],
  },

  {
    id: 'a-row-collapses-by-rule-never-by-wrap',
    where: 'render',
    line: 'A row collapses by rule, never by flex-wrap. Actions beside a heading move below it by a rule that states the new arrangement, keeping the heading gap floor. A row that breaks onto a second line with nowrap in force has broken rather than collapsed.',
    /* ── ASK THE DECLARATION THAT DECIDES THE AXIS FIRST ──
     *
     * A COLUMN STACKS BY DESIGN. My first version read three stacked children
     * as a wrap and faulted one nav that declares `flex-direction: column` at
     * that width. Read the direction before reading the geometry.
     *
     * AN OUT-OF-FLOW CHILD IS NOT ON A LINE. An absolutely placed child sits
     * wherever its insets put it, so its top says nothing about wrapping.
     *
     * THE FAULT IS A BREAK WITH `nowrap` IN FORCE. That means something other
     * than the wrap rule moved the children: a `display: contents` wrapper, a
     * grid the class did not expect, or a stated width past the line. A row
     * that WRAPS is obeying a rule somebody wrote, and the rule about pairing
     * an action row asks for exactly that.
     *
     * Measured: 36 broken rows over twelve surfaces, all of them wrapping on
     * purpose, 0 findings.
     *
     * BROKEN ON PURPOSE. A nowrap row whose second child is pushed onto a
     * second line fires. A row that wraps by its own rule is quiet. */
    body: [
      "let asked = 0",
      "for (const r of all('.row')) {",
      "  const cs = getComputedStyle(r)",
      "  if (/column/.test(cs.flexDirection)) continue",
      "  const kids = Array.prototype.slice.call(r.children).filter(k =>",
      "    k.getBoundingClientRect().width && !/absolute|fixed/.test(getComputedStyle(k).position))",
      "  if (kids.length < 2) continue",
      "  const rc = kids.map(k => k.getBoundingClientRect())",
      "  let broke = false",
      "  for (let i = 1; i < rc.length; i++) if (rc[i].top >= rc[i - 1].bottom - 0.5) broke = true",
      "  if (!broke) continue",
      "  asked++",
      "  if (cs.flexWrap !== 'nowrap') continue",
      "  fail(name(r), 'this row holds ' + kids.length + ' children on more than one line while flex-wrap is nowrap, so something other than a wrap rule moved them. A row collapses by a rule that states the new arrangement and keeps its gap floor. Find what is placing them: a dissolved wrapper, a grid, or a stated width past the line.')",
      "}",
      "if (!asked) note('no row breaks onto a second line here, so this rule is UNMEASURED.')",
      "else note(asked + ' broken row(s) measured.')",
    ],
  },

  /* ── THIS CHECK USED TO FORBID THE RIGHT ANSWER ──
   *
   * It read "Nothing from an EXAMPLE page was copied as markup", which turned
   * the Gallery into a picture nobody could use. A build obeying it derived
   * every component from the prose and shipped an anti-pattern this system
   * states in its own Do's and Don'ts. The Gallery had the fix all along.
   *
   * The line the package draws now: take the COMPONENT, leave the PAGE. */
  {
    id: 'components-came-from-the-gallery',
    where: 'manual',
    line: 'Every component was extracted from the Gallery and reproduced whole, ornament and variants included.',
  },
  {
    id: 'no-example-page-structure',
    where: 'manual',
    line: 'No page width, section order or sample content was copied from an `EXAMPLE-*.html` page.',
    /* ── NO PROGRAM CAN ASK WHAT A BUILD DECLINED TO COPY ──
     *
     * The rule beside this one has a shape: a component either matches the
     * Gallery's or it does not. This one is about an ABSENCE, and an absence
     * in somebody else's build has no fingerprint. A page 1200px wide may have
     * been measured or copied, and the artefact reads the same either way.
     *
     * The line the package draws is "take the COMPONENT, leave the PAGE", so
     * only the builder knows which side of it they were on. It stays a
     * checklist line for that reason, and not because nobody tried.
     *
     * IT HAD NO REASON AT ALL UNTIL 10 September 2026, which the manual-entry
     * check found: 6 manual entries, five carrying 27 to 159 words and this
     * one carrying none. */
  },
  {
    id: 'choices-listed',
    where: 'manual',
    line: 'Every judgement call is listed under its own heading.',
    /* THESE THREE ASK ABOUT THE REPORT, NOT THE ARTEFACT. Where a component
       came from, what was not copied, and which calls the builder made are
       facts about the WORK. Nothing in the build carries them, so no parser
       and no render pass can read them. They stay checklist lines because they
       are attestations, and an attestation is what a checklist is for. */
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
    where: 'render',
    line: 'A broken action row is ranked. Never more than two buttons per line, and an odd count gives the most important one a line of its own, first. A column is pressed from the top.',
    /* ── THE AXIS DOES NOT DECIDE THIS, AND MY FIRST GUARD READ IT ──
     *
     * The documented structure is a COLUMN whose children are pair rows, so
     * a flex-direction guard excluded the very shape the rule prescribes.
     * Measured: the Dashboard action group reads column at 296px, holding
     * two pairs and four buttons on two lines. Asking the axis reported 0
     * candidates over 36 surface-width cells.
     *
     * THE DISCRIMINATOR IS THE BUTTON WIDTH. A stated one-per-line column
     * gives every button the full width, and that is a different, deliberate
     * arrangement: `.stack-narrow-rev > .btn { width: 100% }`. Three buttons
     * each on their own line at full width is not a wrapped run.
     *
     * Measured after: 8 wrapped runs asked, 6 stated columns skipped, 0
     * findings. The two real shapes are [2,2] for an even count and [1,2]
     * for an odd one. */
    body: [
      "const ACTION = \"button, a[href], [role=button], .btn\"",
      "let asked = 0",
      "for (const row of all(\"[class*=action]\")) {",
      "  if (!/flex/.test(getComputedStyle(row).display)) continue",
      "  const btns = all(ACTION).filter(b => row.contains(b))",
      "  if (btns.length < 3) continue",
      "  /* THE LINES, by the top edge of each button. */",
      "  const lines = new Map()",
      "  for (const x of btns) {",
      "    const y = Math.round(x.getBoundingClientRect().top)",
      "    lines.set(y, (lines.get(y) || 0) + 1)",
      "  }",
      "  if (lines.size < 2) continue   /* it still fits on one line */",
      "  const cs = getComputedStyle(row)",
      "  const inner = row.getBoundingClientRect().width",
      "    - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)",
      "  /* ONE PER LINE AT FULL WIDTH IS A STATED COLUMN, never a wrapped run. */",
      "  if (btns.every(x => x.getBoundingClientRect().width >= inner - 2)) continue",
      "  asked++",
      "  const perLine = Array.from(lines.entries()).sort((a, b) => a[0] - b[0]).map(e => e[1])",
      "  const shape = \"[\" + perLine.join(\",\") + \"]\"",
      "  if (perLine.some(k => k > 2)) {",
      "    fail(name(row), \"a broken action row with \" + btns.length + \" buttons laid out \" + shape",
      "      + \". Never more than two per line: past two the line stops reading as a pair and the\"",
      "      + \" ranking disappears. Put each pair in its own container, so growth splits between two.\")",
      "    continue",
      "  }",
      "  if (btns.length % 2 === 1 && perLine[0] !== 1) {",
      "    fail(name(row), \"an odd action count of \" + btns.length + \" laid out \" + shape",
      "      + \". The most important button takes a line of its own, and that line goes FIRST,\"",
      "      + \" because a column is pressed from the top. In a row the primary reads last only\"",
      "      + \" because the eye ends there.\")",
      "  }",
      "}",
      "if (!asked) note(\"no broken action row on this page, so this rule is UNMEASURED here. A stated one-per-line column is a different arrangement and is not asked.\")",
      "else note(asked + \" broken action row(s) measured.\")",
    ],
  },
  {
    id: 'nav-folds',
    where: 'render',
    line: 'No navigation list reflows. A rail is full or a menu button, never a strip between. A navigation ROW must not permit wrapping, so it cannot become two lines at any width.',
    /* ── THREE DRAFTS, AND ONLY THE DECLARATION CAN FIRE ──
     *
     * COUNTING DISTINCT TOPS FAULTS EVERY RAIL. A column gives each item its
     * own top, which is the shape this rule prescribes at a wide width. 10
     * findings over four widths, every one a rail with items equal to lines:
     * 6 of 6, 7 of 7, 4 of 4.
     *
     * AND IT FAULTS A NOWRAP ROW TOO. Two items of different heights on ONE
     * flex line have two tops unless something stretches them. Measured on
     * the app chrome: two nav rows at flex-wrap: nowrap, 4 items, 2 tops,
     * 54 findings over 27 surface-width cells. A nowrap row has one line by
     * definition, so no geometry can prove otherwise.
     *
     * A REAL BREAK IS AN ITEM BELOW AN EARLIER ITEM BOTTOM. That is exact,
     * and on correct code it can never fire: `nowrap` is the INITIAL value of
     * flex-wrap, so a row nobody asked to wrap already reads nowrap and the
     * geometric pass asked 0 candidates. A check that always measures nothing
     * is not a check.
     *
     * SO THIS DOES NOT DEMAND A STATED NOWRAP. It fails a build that states
     * WRAP on a navigation row. One row here states nowrap and that one is
     * load-bearing: a general `.row { flex-wrap: wrap }` in the narrow block
     * reached the Landing header, so the bar row states its own to win.
     *
     * SO READ THE DECLARATION. A row that PERMITS wrapping is the fault at
     * every width. The geometry only shows it where the items happen not to
     * fit, which is one width out of seven. Measured after: 76 navigation
     * rows over 36 surface-width cells, 0 permitting a wrap.
     *
     * The geometric branch stays for a nav that is NOT a flex box, because
     * inline items wrap with no flex-wrap to read. It asked 0 here. */
    body: [
      "const NAV = \"nav, [class*=nav-list], [role=navigation]\"",
      "let asked = 0",
      "for (const nav of all(NAV)) {",
      "  const cs = getComputedStyle(nav)",
      "  const isFlex = /flex|grid/.test(cs.display)",
      "  /* A RAIL IS A COLUMN, and a column is the correct wide layout. */",
      "  if (isFlex && /column/.test(cs.flexDirection)) continue",
      "  const items = Array.prototype.slice.call(nav.children).filter(visible)",
      "  if (items.length < 2) continue",
      "  asked++",
      "  if (isFlex) {",
      "    if (cs.flexWrap === \"nowrap\") continue",
      "    fail(name(nav), \"a navigation row that PERMITS wrapping, at flex-wrap: \" + cs.flexWrap",
      "      + \", holding \" + items.length + \" items. A nav is one line of destinations.\"",
      "      + \" Folded to two rows it reads as two controls rather than one list.\"",
      "      + \" Declare flex-wrap: nowrap and let a menu button take the narrow width.\")",
      "    continue",
      "  }",
      "  /* A BLOCK ROW HAS NO flex-wrap TO READ, so measure the break. An item whose",
      "     top sits at or below an earlier item bottom is on a second line. */",
      "  const r = items.map(el => el.getBoundingClientRect())",
      "  let broke = false",
      "  for (let i = 1; i < r.length; i++) if (r[i].top >= r[i - 1].bottom - 0.5) broke = true",
      "  if (!broke) continue",
      "  fail(name(nav), \"a navigation row on two lines, holding \" + items.length + \" items.\"",
      "    + \" A nav is one line of destinations, so it is a full rail or a menu button.\")",
      "}",
      "if (!asked) note(\"no navigation ROW on this page, so this rule is UNMEASURED here. A column rail is the other correct answer and is not asked.\")",
      "else note(asked + \" navigation row(s) measured.\")",
    ],
  },
  {
    id: 'breakpoint-moves-a-row',
    where: 'manual',
    line: 'Every breakpoint moved a whole row. Check each one at BOTH widths.',
    /* NOT A PROPERTY OF ONE PAGE STATE. A render pass measures the width it is
       at, so it cannot compare two. This asks the RUNNER to move the width and
       read the difference, which no single pass can do. It stays a checklist
       line for that reason and not because nobody tried. */
  },
  {
    id: 'sweep-between-breakpoints',
    where: 'manual',
    /* The REASON moved to DESIGN.md under Layout, where a reason belongs. A
       checklist line is an instruction, and this one was 170 bytes of the
       contract's 8000. */
    line: 'Run the render pass at every breakpoint AND at the midpoint of each adjacent pair.',
  },
  {
    id: 'a-mark-paints-the-size-its-component-publishes',
    where: 'render',
    line: 'A component that publishes a mark size paints that size. A published value nothing paints is a setting the reader cannot use.',
    /* ── THREE OF SIX COMPONENTS PUBLISHED A MARK SIZE THEY NEVER PAINTED ──
     *
     * Found by hand while drawing a picture of the size options, which means
     * nothing was asking. Every existing mark check asks about POSITION, or
     * about one control holding two sizes. None compared what a component
     * publishes against what it paints.
     *
     * THE SELECT PAINTED THE BUTTON'S SIZE. A select trigger carries `.btn`
     * on purpose, for the box and the border, so a rule written for a button
     * mark reached its chevron too. Both compounds weigh (0,3,0) and the
     * button rule came later in the file, so it won. Three instances
     * published 16px and painted 14.
     *
     * THE FIELD'S TOKEN HAD NO READER AT ALL. Its rule read `.input > .icon`,
     * and an `<input>` is VOID, so a child selector on it can never match. It
     * reached 0 elements over twelve surfaces. The mark painted 16px from its
     * call site, which happened to agree, so no geometry looked wrong.
     *
     * AND THE NAME-BASED GUARD REPORTED CLEAN THROUGH ALL OF IT, correctly
     * about its own question: it counts a token as read the moment the NAME
     * appears in a stylesheet. Only the DOM says whether the rule reaches an
     * element.
     *
     * THE MAP IS DECLARED, BECAUSE TWO OF THE SIX CANNOT BE DERIVED. A token
     * carries the component's name and mostly that is the class, but
     * `--cmp-button-icon-size` belongs to `.btn` and `--cmp-input-icon-size`
     * belongs to the `.input-icon` WRAPPER rather than to the control. A
     * derived name would resolve to nothing for those two and the check would
     * go quiet on them. The suite asserts the map is complete against the
     * component list, so a seventh component publishing a mark size fails the
     * run until somebody pairs it.
     *
     * AN UNPUBLISHED TOKEN IS UNMEASURED, NOT A PASS. With no value there is
     * nothing to compare and the fallback is painting, so it is noted.
     *
     * BROKEN ON PURPOSE. Setting any instance's mark to a size other than its
     * token fires and names both numbers. */
    body: [
      "/* Each entry pairs a published mark size with the class whose instances",
      "   carry that mark. A DIRECT child, so a mark inside a button inside one",
      "   of these keeps its own component's pairing. */",
      "const PAIRS = [",
      "  ['--cmp-button-icon-size', '.btn'],",
      "  ['--cmp-select-icon-size', '.select-trigger'],",
      "  ['--cmp-input-icon-size', '.input-icon'],",
      "  ['--cmp-alert-icon-size', '.alert'],",
      "  ['--cmp-nav-item-icon-size', '.nav-item'],",
      "  ['--cmp-tab-icon-size', '.tab']",
      "]",
      "const root = scopeEl()",
      "if (!root) { note('no scope root, so this rule is UNMEASURED.') }",
      "else {",
      "  const rcs = getComputedStyle(root)",
      "  let asked = 0, unpublished = [], absent = []",
      "  for (const pair of PAIRS) {",
      "    const token = pair[0], sel = pair[1]",
      "    const want = (rcs.getPropertyValue(token) || '').trim()",
      "    if (!want) { unpublished.push(token); continue }",
      "    const px = parseFloat(want)",
      "    if (!(px > 0)) { unpublished.push(token); continue }",
      "    const hosts = all(sel)",
      "    if (!hosts.length) { absent.push(sel); continue }",
      "    let seen = 0",
      "    for (const host of hosts) {",
      "      /* A SELECT TRIGGER IS ALSO A BUTTON, so the button pairing would",
      "         claim its chevron and report the fault against the wrong token.",
      "         The more specific class owns the mark. */",
      "      if (sel === '.btn' && host.classList.contains('select-trigger')) continue",
      "      const marks = Array.prototype.slice.call(host.children).filter(k =>",
      "        k.tagName === 'svg' || (k.classList && k.classList.contains('icon')))",
      "      for (const m of marks) {",
      "        const mr = m.getBoundingClientRect()",
      "        if (!mr.width || !mr.height) continue",
      "        seen++",
      "        asked++",
      "        const got = round(mr.height)",
      "        if (Math.abs(mr.height - px) <= 0.5) continue",
      "        fail(name(host), 'this mark paints ' + got + 'px where ' + token + ' publishes ' + want + '. A published value nothing paints is a setting the reader cannot use, and no geometric check sees it: the mark is centred and square at the wrong size. Find the rule that wins, and ask whether it was written about this component at all.')",
      "      }",
      "    }",
      "    if (!seen) absent.push(sel + ' (present, no mark)')",
      "  }",
      "  if (!asked) note('no component here holds a mark whose size is published, so this rule is UNMEASURED.')",
      "  else note(asked + ' mark(s) compared against a published size.')",
      "  if (unpublished.length) note('unpublished, so the fallback paints: ' + unpublished.join(', '))",
      "  if (absent.length) note('not on this surface, or carrying no mark: ' + absent.join(', '))",
      "}",
    ],
  },
  {
    id: 'a-text-less-wrapper-carries-the-cap-band-rule',
    where: 'render',
    line: 'A wrapper holding only a mark takes the cap-band rule itself. With no text of its own it takes its baseline from its bottom margin edge, so the mark hangs its whole height above the line.',
    /* ── THE MARK BECOMES A GRANDCHILD, AND EVERY CHILD SELECTOR MISSES IT ──
     *
     * An editor that wraps each instance for inspection puts a span between
     * the row and the mark. Under baseline alignment that span has no text, so
     * it takes its baseline from its bottom margin EDGE and hangs the mark's
     * whole height above the line.
     *
     * Measured on the shipped wrapper, by taking its rule away in a stylesheet
     * and reading the geometry back. With the rule: 3.5px above the cap line
     * and 2.5 below the baseline, on a 20px label with a 14px cap band.
     * Without it: 6px above and 0 below.
     *
     * NOTHING SHIPPED COULD SEE THAT. `icon-on-the-cap-band` reads the marks
     * that are CHILDREN of the row, so a mark one level deeper is invisible to
     * it. Proven: the same injection produced 0 findings from all 70 other
     * checks. That is the hole this fills, and it is why the check is worth
     * one candidate.
     *
     * A CONTROL IS NOT A WRAPPER, AND ASKING THE SHAPE ALONE FAULTS EIGHT.
     * An icon-only button is text-less and holds one mark, and the cap-band
     * rule EXCLUDES it: no label means no baseline, so it centres on its own
     * box. Measured before the guard: 12 candidates, 8 of them icon-only
     * buttons, all correct. Ask INTERACTIVITY first, which is a property, then
     * the control classes for the inert spans a preview renders.
     *
     * AND A WRAPPER INSIDE A CONTROL TAKES THAT CONTROL'S RULE, so it is out
     * too. Left in, a checkbox's tick wrapper reported three times.
     *
     * BROKEN ON PURPOSE. Setting the wrapper's transform to none fires and
     * names both overhangs. */
    body: [
      "const CTRL = '.btn, .nav-item, .tab, .select-trigger, .checkbox, .switch, .badge, .chip, .avatar'",
      "const PRESSABLE = 'a, button, input, select, textarea, summary, label, [role=button], [tabindex]'",
      "let asked = 0, controls = 0",
      "for (const el of all('*')) {",
      "  const r = el.getBoundingClientRect()",
      "  if (!r.width || !r.height) continue",
      "  /* ITS OWN text, so a wrapper is told from a labelled row. */",
      "  let own = ''",
      "  for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue",
      "  if (own.trim()) continue",
      "  const kids = Array.prototype.slice.call(el.children)",
      "    .filter(k => k.getBoundingClientRect().width)",
      "  if (kids.length !== 1) continue",
      "  const k = kids[0]",
      "  if (k.tagName !== 'svg' && !(k.classList && k.classList.contains('icon'))) continue",
      "  /* A CONTROL IS A LEAF AND CENTRES ON ITS OWN BOX. */",
      "  if (el.matches(PRESSABLE) || el.matches(CTRL)) { controls++; continue }",
      "  const host = el.closest(PRESSABLE)",
      "  if (host && host !== el) { controls++; continue }",
      "  /* AND THE ROW HAS TO DECLARE THE BASELINE, or there is no line to sit",
      "     on and nothing for the rule to land against. */",
      "  const p = el.parentElement",
      "  if (!p) continue",
      "  const pcs = getComputedStyle(p)",
      "  if (!/^(flex|inline-flex)$/.test(pcs.display)) continue",
      "  if (pcs.alignItems !== 'baseline') continue",
      "  asked++",
      "  const cs = getComputedStyle(el)",
      "  const lifted = cs.transform && cs.transform !== 'none'",
      "  const onLine = cs.alignSelf === 'baseline'",
      "  if (lifted && onLine) continue",
      "  const missing = []",
      "  if (!onLine) missing.push('align-self: baseline')",
      "  if (!lifted) missing.push('the cap-band transform')",
      "  fail(name(el), 'this wrapper holds a mark and no text of its own, and it is missing ' + missing.join(' and ') + '. With no in-flow text it takes its baseline from its bottom margin EDGE, so the mark hangs its whole height above the line. Measured on this shape: 6px above the cap against 0 below the baseline without the rule, and 3.5 against 2.5 with it. Put the rule on the WRAPPER, because a child selector aimed at the mark matches nothing once the mark is a grandchild.')",
      "}",
      "if (!asked) note('no text-less wrapper holds a mark inside a baseline row here, so this rule is UNMEASURED.')",
      "else note(asked + ' wrapper(s) asked, plus ' + controls + ' control(s) skipped as leaves.')",
    ],
  },
]

export const SOURCE_CHECKS = CHECKS.filter(c => c.where === 'source')
export const RENDER_CHECKS = CHECKS.filter(c => c.where === 'render')
export const MANUAL_CHECKS = CHECKS.filter(c => c.where === 'manual')

/* ── ONE RULE LIST, EVERY CONSUMER ──
 *
 * A check tagged `needs` only exists when the document ships the thing it
 * measures. The contract filtered on that and the two VERIFY files did not, so
 * a single-theme package told the reader "do not build a theme toggle" in
 * DESIGN.md and then FAILED their build for not having one.
 *
 * Found by simulation run 13, which built a compliant dashboard and could not
 * pass: `hardcoded-theme` and `toggle-states-itself` in VERIFY.mjs, plus
 * `the-toggle-actually-toggles` in VERIFY-BROWSER.js. The only way to clear
 * them was to build the control the document forbids.
 *
 * The filter lives HERE because it had three call sites and a rule with three
 * homes is how two of them end up disagreeing. That is what happened: I fixed
 * the prose consumer and left both tools enforcing the old answer. */
export function checksFor (list, state) {
  return list.filter(c => !c.needs || CHECK_NEEDS[c.needs](state))
}

const CHECK_NEEDS = {
  themeToggle: hasThemeToggle,
}
