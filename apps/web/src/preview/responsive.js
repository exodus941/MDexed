/* Where the surfaces collapse, and which question they ask to decide.
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
}

${query(sm)} {
  .dmd .cols-2, .dmd .cols-3, .dmd .cols-4 { grid-template-columns: minmax(0, 1fr); }
  /* Labels go above their fields — 112px of label leaves nothing for input. */
  .dmd .field-inline { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  /* Header rows carry a title and a cluster of actions; at this width they
     need two lines rather than a squeezed one. */
  .dmd .row-wrap { flex-wrap: wrap; }
  .dmd { padding: ${sp('md', '16px')}; }
}
`
}
