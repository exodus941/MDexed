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
      "for (const el of all('*')) {",
      "  if (el.children.length) continue",
      "  if (el.closest('table, code, pre, kbd, samp')) continue",
      "  const text = (el.textContent || '').replace(/\\s+/g, ' ').trim()",
      "  if (!text || !FIGURE.test(text)) continue",
      "  const face = getComputedStyle(el).fontFamily",
      "  if (!MONO.test(face)) continue",
      "  fail(name(el), 'this figure reads \"' + text + '\" and sits in the mono face with no column to stack against. A column is what makes that face matter: it gives every digit one width so the digits line up down the page. Alone it buys nothing and costs the page its own voice. A stat tile, a hero price, a badge count and a number inside a sentence all keep the body face.')",
      "}",
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
      "  if (!ground || ground === own) continue",
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
    id: 'proximity-is-a-ratio',
    where: 'render',
    line: 'The gap between groups beats the gap inside one by three to one, or the two read as one thing.',
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
      "  for (const entry of byGap) {",
      "    const gi = entry[0], members = entry[1]",
      "    if (members.length < 2) continue   /* one group has no next one */",
      "    const go = between(members)",
      "    if (go <= 0) continue",
      "    const r = go / gi",
      "    if (r >= 3) continue",
      "    fail(name(members[0]), members.length + ' of these sit ' + round(go) + 'px apart and each holds its own contents ' + round(gi) + 'px apart, which is ' + (Math.round(r * 100) / 100) + ':1. Proximity is a ratio: under three to one the two distances read as one, so a group stops being told apart from the next. Raise the outer gap a step, or lower the inner one.')",
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
      "    fail(name(kid), 'sits ' + round(gap + m) + 'px below its previous sibling, because its container publishes a ' + round(gap) + 'px row-gap AND it states a ' + round(m) + 'px margin. A gap and a margin add, so this distance is the sum of two writers rather than a value anybody chose. One of them owns it.')",
      "  }",
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
      /* THE LINE-BOX TECHNIQUE IS THIS SYSTEM'S OWN RULE, AND THIS CHECK
         FAULTED IT. A control with a stated height centres its label by setting
         `line-height` to the CONTENT box, which is the height minus its
         borders. So a 36px button with a 14px label legitimately carries a
         34px leading, and no type role publishes that pair. Measured on one
         build: eight findings, every one a button or a badge obeying "height
         and line-height are one decision".

         `line-height` also INHERITS, so a label span inside such a control
         reports the same pair one level down. Ask the mechanism rather than the
         element: walk up a bounded number of levels and look for a box whose
         content height IS this leading. Ordinary text in an auto-height block
         never matches, so the check keeps the case it was written for. */
      "  var host = el, boxed = false",
      "  for (var up = 0; host && up < 4; up++, host = host.parentElement) {",
      "    var hs = getComputedStyle(host)",
      "    if (hs.height === 'auto' && hs.blockSize === 'auto') continue",
      "    var bt = parseFloat(hs.borderTopWidth) || 0",
      "    var bb = parseFloat(hs.borderBottomWidth) || 0",
      "    var content = host.getBoundingClientRect().height - bt - bb",
      "    if (content > 0 && Math.abs(content - lh) < 1.2) { boxed = true; break }",
      "  }",
      "  if (boxed) continue",
      "  const sameSize = ROLES.filter(x => Math.abs(x.size - size) < 0.6)",
      "  if (!sameSize.length) continue",
      "  if (sameSize.some(x => Math.abs(x.px - lh) < 0.8)) continue",
      "  const owner = sameSize.map(x => x.r).join(' or ')",
      "  const lent = ROLES.filter(x => Math.abs(x.px - lh) < 0.8).map(x => x.r)",
      "  fail(name(el), 'this is ' + round(size) + 'px, which is the ' + owner + ' size, and its line height is ' + round(lh) + 'px, which that role does not publish. ' + (lent.length ? 'That leading belongs to ' + lent.join(' or ') + '. ' : '') + 'A type role pairs a size with a leading, so take both from one role rather than the size from one and the leading from whatever element it sits in.')",
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
    id: 'a-fixed-height-control-centres-its-label',
    where: 'render',
    line: 'A control with a stated height centres its label. Baseline alignment pins it to the top of the box.',
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
