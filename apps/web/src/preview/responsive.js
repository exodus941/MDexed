/* ⚠ NO BACKTICKS ANYWHERE BELOW THE `return` IN THIS FILE. ⚠
 *
 * Everything this function returns is one template literal, comments included.
 * A backtick inside a CSS comment ends the string there, and the rest of the
 * stylesheet is then parsed as JavaScript expressions. Sometimes that is a
 * syntax error and sometimes it is valid code that silently produces nothing.
 *
 * I have done this four times in this file alone, always while writing a
 * comment explaining a CSS property, always by quoting the property name.
 * Write the property name as plain words instead: "display contents", not the
 * quoted form. The guard catches it, but only after the build has broken.
 *
 * Where the surfaces collapse, and which question they ask to decide.
 *
 * Split out of tokens.js so the test suite can import it. tokens.js pulls in
 * `./preview.css?raw`, which is a Vite feature Node cannot resolve, so nothing
 * in that file was reachable from a plain `node test/pipeline.mjs`. This module
 * imports nothing, which is the whole point of it being separate.
 *
 * Breakpoint values have to be literal, because neither a container query nor a
 * media query can read a custom property in its condition. So this is a
 * function of the document rather than a constant, and moving a breakpoint in
 * the editor moves the rule.
 *
 * Conditions are written as `max-width: n - 0.02px`, one hundredth below the
 * breakpoint, so a frame sitting exactly on the breakpoint gets the wide
 * layout. That matches how `min-width` behaves and removes the one-pixel band
 * where both rules would match.
 */
const sp = (name, fallback) => `var(--space-${name}, ${fallback})`

/* `mode` picks which question the rules ask.
 *
 *   'container' — how wide is the frame. The editor needs this. Its preview is
 *   a pane inside a pane, so a media query would sit there reporting the
 *   browser width while the surface renders at 400, and the width control
 *   would do nothing.
 *
 *   'media' — how wide is the viewport. The exported pages need this. They are
 *   real standalone pages, and they are a style reference for an agent. The
 *   DESIGN.md beside them says to treat each breakpoint as a min-width, which
 *   is media-query language. Shipping `@container` taught a technique the prose
 *   never mentions, and an agent copying the reference would carry it into an
 *   application that has no frame to measure.
 *
 * Both modes read the same breakpoints and collapse at the same widths, so the
 * exported page still behaves like the thing you were looking at.
 */
export function responsiveCss (breakpoints = [], mode = 'container') {
  const at = name => breakpoints.find(b => b.name === name)?.px
  /* Two collapse points, named rather than positional: below `md` the
     multi-column grids halve and side columns stack, and below `sm` everything
     goes to a single column. Falling back to the conventional values keeps this
     working for a document that renamed or removed them. */
  const md = at('md') ?? breakpoints[1]?.px ?? 768
  const sm = at('sm') ?? breakpoints[0]?.px ?? 640
  const below = px => `${px - 0.02}px`
  const query = px => mode === 'media'
    ? `@media (max-width: ${below(px)})`
    : `@container dmd (max-width: ${below(px)})`

  /* The container is the frame around the surface, not the surface itself.
     `container-type: inline-size` measures the *content* box, and `.dmd`
     carries the page padding — so declaring it there would compare the
     breakpoints against a width 64px narrower than the surface, and every
     collapse would fire early by exactly the padding. The frame has no padding,
     so its width is the width you asked for.

     Media mode declares no container, because it measures nothing. */
  return `
${mode === 'media' ? '' : '.dmd-frame { container-type: inline-size; container-name: dmd; }\n'}
${query(md)} {
  .dmd .cols-3, .dmd .cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* A 180px rail beside 200px of content is not a layout. Stack it. */
  .dmd .with-aside { grid-template-columns: minmax(0, 1fr); }

  /* Stacking the rail is only half the job. Left alone it becomes five links
     stacked above the page title, which pushes the heading below the fold and
     reads as a wide layout that gave up. Fold it behind the burger instead.
     The summary keeps the section label, so nothing is unlabelled. */
  /* Sibling, not child. A closed details renders none of its non-summary
     children whatever CSS says, so the list lives outside it and this hides
     it instead. Pure CSS, so the exported page behaves identically.

     Collapsed to a zero row rather than display none, so the fold animates on
     the document's own duration and easing. A system that publishes a motion
     scale should be seen using it. */
  /* The disclosure appears only here. Hidden at every wider width, because a
     desktop header has room for the links themselves. */
  .dmd .nav-collapse { display: block; }
  .dmd .nav-collapse:not([open]) ~ .nav-fold { grid-template-rows: 0fr; }
  .dmd .nav-fold { transition: grid-template-rows var(--duration-normal, 200ms) var(--ease-standard, ease); }
  .dmd .nav-burger { display: flex; }
  .dmd .nav-summary { cursor: pointer; }

  /* A header menu opens downward as a stack, not as a squeezed row. Its call
     to action goes full width, because it is the reason the header exists. */
  .dmd .header-nav .nav-list { flex-direction: column; align-items: stretch; }
  .dmd .header-nav .nav-list > .btn { width: 100%; }
}

${query(sm)} {
  .dmd .cols-2, .dmd .cols-3, .dmd .cols-4 { grid-template-columns: minmax(0, 1fr); }
  /* Labels go above their fields — 112px of label leaves nothing for input. */
  .dmd .field-inline { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  /* Every row wraps at this width, not only the ones opted in by class.
     A footer holding Reset, Discard and Save was 112px wider than the page and
     simply clipped its own primary action. Marking rows one at a time means
     the next row added is clipped again until somebody notices. A row that
     already fits is unaffected by permission to wrap.

     No backticks in this comment. It sits inside a template literal, and one
     would end the string here. */
  .dmd .row { flex-wrap: wrap; }
  /* Nested action groups stay together on their line rather than splitting
     across two, so Discard and Save read as a pair. */
  .dmd .row > .row { flex-wrap: nowrap; }

  /* A row that should stop being a row.
     Wrapping keeps items on the line until they run out of room, which leaves
     a half-width button stranded beside a paragraph. These say the arrangement
     instead: one column, every action at full width.

     The reversed variant puts the primary action first. A footer that reads
     Cancel, Save draft, Save changes is right on a desktop, where the eye ends
     at the right. Stacked on a phone it buries the main action at the bottom,
     furthest from the thumb. */
  .dmd .stack-narrow, .dmd .stack-narrow-rev { flex-direction: column; align-items: stretch; }
  .dmd .stack-narrow-rev { flex-direction: column-reverse; }
  .dmd .stack-narrow > .btn, .dmd .stack-narrow-rev > .btn { width: 100%; }
  /* A nested action group stacks with its parent rather than staying a row
     inside a column. Otherwise a footer reads as two unrelated groups: one
     button alone on a line, then a right-aligned pair under it. */
  .dmd .stack-narrow-rev > .row { flex-direction: column-reverse; align-items: stretch; width: 100%; }
  .dmd .stack-narrow > .row { flex-direction: column; align-items: stretch; width: 100%; }
  .dmd .stack-narrow-rev > .row > .btn, .dmd .stack-narrow > .row > .btn { width: 100%; }

  /* A spec group scrolls, it does not fold.
     Four variants across four states only means anything read across the row,
     so wrapping destroys the one thing it exists to show. It was clipping
     instead, which loses the last column in silence. The scroller sits on the
     group rather than the row, so every row moves together. */
  .dmd .matrix { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .dmd .matrix > .row { flex-wrap: nowrap; min-width: max-content; }

  /* Only the true matrix gets aligned columns.
     Rows of independent flex boxes line up only by luck — measured at 7px of
     drift on the variants grid, where the whole point is comparing one cell
     against the one below it. One grid, with the rows dissolved into it by
     display contents, makes the columns share a track.

     Not applied to the size and icon groups. Those carry a different number of
     items per row, so a shared column means nothing there. */
  .dmd .matrix-grid { display: grid; grid-template-columns: repeat(5, max-content); gap: var(--space-sm, 8px); align-items: center; }
  .dmd .matrix-grid > .row { display: contents; }
}

${query(sm)} {
  /* Below this, a spec group stacks rather than scrolls.
     Sideways scrolling is a last resort, not a layout. A table of real columns
     has no other option, so it keeps its scroller. A run of buttons does have
     one: give the label its own line and let the examples wrap underneath.

     That also removes the second scrollbar. A pane that scrolls down inside a
     page that scrolls down, wrapped around a group that scrolls sideways, is
     three scrollbars for four buttons. */
  .dmd .matrix { overflow-x: visible; }
  .dmd .matrix > .row { flex-wrap: wrap; min-width: 0; }
  .dmd .matrix-grid { display: flex; flex-direction: column; }
  .dmd .matrix-grid > .row { display: flex; flex-wrap: wrap; }

  /* The label takes its own line, and the rule is on the LABEL.
     It used to sit on the first child of a matrix-grid row, so the same
     component behaved two ways depending on an ancestor two levels up: GHOST
     and DANGER stood alone while LIVE and FILLED shared a line with whichever
     buttons happened to fit beside them. A row of specimens must read one way
     down the whole page. Any row carrying a label wraps too, or the label has
     nothing to wrap away from. */
  .dmd .row:has(> .row-label) { flex-wrap: wrap; min-width: 0; }
  .dmd .row-label { flex: 1 0 100%; }

  /* The page's own actions take the medium step of the button scale.
     Small is a desktop density choice. At this width it is an uncomfortable
     target and the wrong weight for the top of a screen. Both values come from
     the system's own scale, so nothing is invented here. */
  .dmd .page-actions > .btn-sm,
  .dmd .stack-narrow > .btn-sm,
  .dmd .stack-narrow-rev > .btn-sm {
    height: var(--cmp-button-md-height, 36px);
    /* Minus the two borders. Under border-box a line height equal to the stated
       height belongs to a box 2px taller than the one the letters live in, so
       the line overflows by a pixel at each end and the text lands a pixel low.
       Measured 13 above the cap and 12 below the baseline. The base button rule
       has always subtracted them. This promotion was written without that and
       inherited the bug that rule exists to prevent. */
    line-height: calc(var(--cmp-button-md-height, 36px) - 2px);
    padding: var(--cmp-button-md-padding, 0 var(--space-md, 16px));
    font-size: var(--cmp-button-md-font-size, var(--font-button-size, 14px));
  }
  .dmd .page-actions > .btn-sm.icon-only { width: var(--cmp-button-md-height, 36px); padding: 0; }

  /* Navigation is a finger target at this width, and 40px is the floor.
     Sized by their own padding these came out 38.3 and 24 — close enough to
     look deliberate in a screenshot and wrong enough to miss on a phone. The
     mark and the label do not change size, only the box that catches the tap.
     A summary needs the box stated explicitly because it has no control
     height of its own to grow. */
  .dmd .nav-item { min-height: 40px; display: flex; align-items: center; }
  .dmd .nav-summary { min-height: 40px; }

  /* The call to action in a nav row is part of that row.
     At 28px beside two 40px links it sat at the top of the band with its text
     5.84px above theirs, which is the one place in a header where a mismatch
     is unmissable. Height and line height together, so the box matches and the
     label still centres — not display flex, which would hand this button's
     baseline to the icon inside it. */
  .dmd .nav-list > .btn {
    height: 40px; line-height: 38px;
    padding: 0 var(--space-md, 16px);
    font-size: var(--cmp-button-md-font-size, var(--font-button-size, 14px));
  }

  /* A two-word heading should not break in half.
     Balancing spreads the words evenly across the lines it does need, which is
     the cheat that stops "Account settings" reading as "Account" over
     "settings". Falls back to normal wrapping where unsupported. */
  .dmd h1, .dmd h2, .dmd h3 { text-wrap: balance; }
  .dmd { padding: ${sp('md', '16px')}; }
}
`
}
