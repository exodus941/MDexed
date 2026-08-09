/* Substituting the breakpoint conditions into the raw stylesheet.
 *
 * Split out from responsive.js for one reason: this file imports nothing, so
 * plain Node can load it. responsive.js imports the stylesheet with the Vite
 * `?raw` suffix, which Node cannot resolve — importing it from the test suite
 * fails with "Unknown file extension .css" before a single assertion runs.
 *
 * The alternative was for the test to reimplement the substitution. A second
 * copy of a transform drifts from the first, and then the test passes on logic
 * the app does not use, which is worse than no test.
 *
 * So the transform lives here as a pure function of (css, breakpoints, mode).
 * The app feeds it the imported stylesheet; the test feeds it the same file
 * read from disk. One implementation, two callers.
 */

/* Sentinels rather than placeholders. Both are valid CSS, so the stylesheet
   still opens in an editor as a stylesheet with working highlighting, and a
   sentinel that survives substitution produces a rule that simply never
   matches — which the test suite asserts against, because a layout that
   silently never collapses reports nothing at all. */
export const MD_SENTINEL = '@media (max-width: 999901px)'
export const SM_SENTINEL = '@media (max-width: 999902px)'
export const CONTAINER_LINE = '.dmd-frame { container-type: inline-size; container-name: dmd; }'

export function buildResponsiveCss (css, breakpoints = [], mode = 'container') {
  const at = name => breakpoints.find(b => b.name === name)?.px
  /* Two collapse points, named rather than positional: below md the
     multi-column grids halve and side columns stack, and below sm everything
     goes to a single column. Falling back to the conventional values keeps
     this working for a document that renamed or removed them. */
  const md = at('md') ?? breakpoints[1]?.px ?? 768
  const sm = at('sm') ?? breakpoints[0]?.px ?? 640

  /* One hundredth below the breakpoint, so a frame sitting exactly on it gets
     the wide layout. That matches how min-width behaves and removes the
     one-pixel band where both rules would match. */
  const below = px => String(px - 0.02) + 'px'
  const query = px =>
    (mode === 'media' ? '@media (max-width: ' : '@container dmd (max-width: ') + below(px) + ')'

  /* Normalised here, not at the call site. The stylesheet is checked out with
     whatever line endings the platform prefers, and this string ships inside
     exported pages — so a Windows clone would otherwise emit CRLF where a
     Linux clone emits LF, and two payloads would differ for no reason. */
  const raw = css.replace(/\r\n/g, '\n').replace(/^\n+/, '')

  /* The container is the frame around the surface, not the surface itself.
     container-type inline-size measures the CONTENT box, and .dmd carries the
     page padding — declaring it there would compare the breakpoints against a
     width 64px narrower than the surface, and every collapse would fire early
     by exactly the padding. The frame has no padding, so its width is the
     width you asked for. Media mode declares no container, because it measures
     nothing.

     Container mode keeps the declaration and gains a blank line after it;
     media mode drops the text and leaves the newline that followed. Both land
     on the exact spacing the old template literal produced. */
  return '\n' + raw
    .replace(CONTAINER_LINE, mode === 'media' ? '' : CONTAINER_LINE + '\n')
    .split(MD_SENTINEL).join(query(md))
    .split(SM_SENTINEL).join(query(sm))
}
