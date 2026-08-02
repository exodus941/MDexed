/* The bridge between derived tokens and rendered UI.

   Everything in the preview is styled by this one stylesheet, and it reads
   nothing but the custom properties `derive()` produces. That's what makes the
   preview trustworthy: there is no second set of values it could drift toward.
   Every var() carries a fallback so renaming a token degrades the preview
   instead of collapsing it. */

/** Derived vars → a React inline-style object (React passes `--x` through). */
export const varsToStyle = vars => ({ ...vars })

const sp = (name, fallback) => `var(--space-${name}, ${fallback})`


/* The preview stylesheet, as a real stylesheet.
 *
 * This was a template literal for years, and a backtick typed inside one of
 * its CSS comments silently truncated the sheet — five times. The fix applied
 * to the editor chrome (extract to a .css file) was assumed unavailable here,
 * because this one interpolates: c(), cm(), sp(), rd(), ft().
 *
 * It does not. Every one of those helpers is a pure string builder called with
 * constant arguments — c('bg', '#fff') is always var(--c-bg, #fff) — so the
 * literal never produced anything a .css file could not hold. Expanding them
 * costs some brevity in the source and buys the whole class of bug going away,
 * because a backtick in a .css file is an ordinary character.
 *
 * Verified byte-identical to what the literal produced before the move.
 *
 * responsiveCss below is genuinely dynamic — it reads the document breakpoints
 * — so it stays a function, and its comments are the one place in this file
 * where the trap still exists. */
import previewCss from './preview.css?raw'

export const PREVIEW_CSS = previewCss

/* ── Responsive, against the container ──
 *
 * The preview is a pane inside a pane, so the viewport never changes when you
 * narrow it — a media query would sit there reporting 1280px while the surface
 * renders at 400. Container queries ask the only question that has a useful
 * answer here: how wide is the thing this content is actually in.
 *
 * That also means the width control is testing something real. Narrowing to
 * `sm` shows the layout that this document's `sm` breakpoint produces, not the
 * layout some generic phone width produces.
 *
 * Breakpoint values have to be literal — a container query can't read a custom
 * property in its condition — so this is a function of the document rather
 * than a constant. Conditions are written as `max-width: n - 0.02px`, one
 * hundredth below the breakpoint, so a container sitting exactly on the
 * breakpoint gets the wide layout. That matches how `min-width` media queries
 * behave and avoids the one-pixel band where both rules match.
 */
export function responsiveCss(breakpoints = []) {
  const at = name => breakpoints.find(b => b.name === name)?.px
  /* Two collapse points, named rather than positional: below `md` the
     multi-column grids halve and side columns stack; below `sm` everything
     goes to a single column. Falling back to the conventional values keeps
     this working for a document that renamed or removed them. */
  const md = at('md') ?? breakpoints[1]?.px ?? 768
  const sm = at('sm') ?? breakpoints[0]?.px ?? 640
  const below = px => `${px - 0.02}px`

  /* The container is the frame around the surface, not the surface itself.
     `container-type: inline-size` measures the *content* box, and `.dmd`
     carries the page padding — so declaring it there would compare the
     breakpoints against a width 64px narrower than the surface, and every
     collapse would fire early by exactly the padding. The frame has no
     padding, so its width is the width you asked for. */
  return `
.dmd-frame { container-type: inline-size; container-name: dmd; }

@container dmd (max-width: ${below(md)}) {
  .dmd .cols-3, .dmd .cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* A 180px rail beside 200px of content is not a layout. Stack it. */
  .dmd .with-aside { grid-template-columns: minmax(0, 1fr); }
}

@container dmd (max-width: ${below(sm)}) {
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
