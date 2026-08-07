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

/* Where the surfaces collapse now lives in its own module, so the test
   suite can import it. This file cannot be imported by Node at all: the
   `?raw` import above is a Vite feature. Re-exported here so every existing
   caller keeps working. */
export { responsiveCss } from './responsive.js'
