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

/* ── The header ladder ──
 *
 * Three more thresholds, and they are NOT breakpoints of the design system.
 * They are measured from what the header row holds, which is the project's own
 * rule: one breakpoint per question, measured from the thing it governs. A
 * document's `sm` and `md` answer "can two panes coexist" and "does a grid
 * halve". None of them answer "does the title still fit beside its actions".
 *
 * Measured on the Dashboard header, at its natural widths:
 *
 *   heading 163 · menu button 136 labelled, 46 bare · actions 251
 *   the head gap is the `lg` step between EVERY pair, so three items mean TWO
 *   gaps of 24 — assuming 8 for the second one put the label threshold 16px
 *   too low, and the heading broke mid-word rather than the label dropping
 *
 * The first two came from arithmetic and one was wrong. Adding the parts gave
 * 606 for the label threshold; forcing the label on and shrinking the frame
 * two pixels at a time showed the row wrapping at 638. Thirty-two pixels of
 * margins and box edges the sum never counted. The number below is the
 * measured one, and the lesson is the general one: derive a threshold by
 * shrinking the real row until it breaks, never by adding up its parts.
 *   group gap 24 · title-to-mark gap 6 · surface padding 24 each side
 *
 *   640  heading + label + mark + actions no longer fit  → drop the label
 *   617  heading + mark + actions no longer fit          → actions take a line
 *   332  heading + label + mark no longer fit            → drop the label again
 *
 * The label reappears at 515 because the actions have left the row and given
 * the space back. That is the ladder they described, and the numbers say the
 * same thing.
 *
 * `Workspace` is the widest label in the samples at 84.8; `Settings` is 68.1.
 * One threshold serves both, sized by the wider, because a container query
 * cannot measure text.
 *
 * ALL OF THE ABOVE IS HISTORY. Kept because it records how four thresholds
 * were arrived at and why three of them were wrong. What ships is below. */

/* ── One threshold, not four ──
 *
 * The ladder had four. Three of them turned out to be machinery with no
 * measured purpose, and they went when the action group started taking a line
 * of its own at every folded width.
 *
 * Once the actions leave the row, the only thing competing for it is the title
 * and the menu control. Measured with the label forced on at every width: the
 * menu never leaves the title's line, and the title never wraps for it. The
 * label was costing nothing, so dropping it twice and restoring it once was
 * three transitions doing no work.
 *
 * What IS real: below some width the labelled control squeezes the title until
 * the heading no longer fits its box. That is one transition, and this is it.
 *
 * And for the first time the arithmetic agrees with the measurement:
 *
 *   threshold = title + gap + labelled control + 2 × surface padding
 *             = 163  + 8   + 160              + 48                = 379
 *   measured: the title starts overflowing just under 380
 *
 * The control is 160 rather than 136 because it takes the large step below the
 * `sm` breakpoint, and a control that grows at a breakpoint has two natural
 * widths. A probe that forced the small padding measured 354 and agreed with
 * the wrong sum — the same trap twice in one hour. Measure the part at the
 * width where it is used.
 *
 * Every earlier attempt to add up a threshold was wrong by 16 to 32px, because
 * the row held four things and a sum missed a gap or a size step. A row with
 * two things in it can be added up. That is the reason to simplify, not tidiness. */
export const LADDER_BARE_SENTINEL = '@media (max-width: 999905px)'    // 384

/* A tab strip that does not fit becomes a dropdown, at the width where it
   stops fitting. Measured by shrinking the real Shell until the left strip's
   scrollWidth passed its clientWidth: 704px, where four tabs needed 264 in a
   262px pane. Rounded up to 712 so the swap happens before the clip, not on
   the pixel it starts. */
export const TABS_SENTINEL = '@media (max-width: 999906px)'          // 712

/* A comparison keeps its columns while they fit and stacks when they do not.
   It never scrolls, and it never passes through a middle step — the same two
   states a side rail has, for the same reason. Three columns squeezed to
   43.6px put 56px of the word "Unlimited" in each of them, which is a
   comparison nobody can read and no overflow check reports.

   Measured by shrinking the real surface with the wide form forced on, and
   reading every cell and label's scrollWidth against its clientWidth. The
   table holds at 396 and spills at 392, so 400 swaps before the spill.

   It moved four times, and every move was a measurement rather than a guess.
   A guess of 664 went in first and was wrong in both directions. A 1.1fr label
   column broke at 880. A max-content label column per row held to 724. Making
   the rows subgrids of one grid — which is what makes the columns line up at
   all — moved it to 788, because the shared label track sizes to "Automatic
   Chasing" rather than "Feature".

   Then the plan cards left this grid and the column gap went to zero, so the
   widest CALL TO ACTION stopped constraining it. The binding item is now the
   widest answer: "Unlimited" at 56px. The arithmetic agrees with the
   measurement for once, which is the sign a derivation is sound — three value
   columns at 56 plus 32 of padding, and a label column at 110 plus 16, comes
   to 390 against a measured 396.

   Recompute it for your own content. The formula is the widest answer plus its
   cell padding, times the number of options, plus the widest row label plus
   its padding. */
export const PLANS_SENTINEL = '@media (max-width: 999907px)'         // 400
export const LADDER = { bare: 384, tabs: 712, plans: 400 }

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
    /* Fixed, because they are measured from the header's content rather than
       taken from the document. A document that renames its breakpoints does
       not move these, and it should not. */
    .split(LADDER_BARE_SENTINEL).join(query(LADDER.bare))
    .split(TABS_SENTINEL).join(query(LADDER.tabs))
    .split(PLANS_SENTINEL).join(query(LADDER.plans))
}
