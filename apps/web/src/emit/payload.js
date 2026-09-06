/* The payload manifest.
 *
 * Lifted out of App.jsx so the test suite can assert what a user actually
 * receives. The suite is plain Node and cannot import JSX, so while this list
 * lived inside the component the contents of the zip were unguarded — the only
 * way to check them was to export one by hand and look.
 *
 * Only the text files live here. The HTML examples need React to render, so
 * App.jsx adds those on top of what this returns.
 */
import { generateFile } from './designmd.js'
import { agentContract } from './agents.js'
import { themeOf, hasThemeToggle } from '../state/schema.js'
import { verifyNodeFile, verifyBrowserFile, VERIFY_NODE, VERIFY_BROWSER } from './verify.js'
import * as tokens from './tokens.js'

/* Every file a payload must contain, checked by the suite. A rename that
   forgets one of these fails the build rather than shipping a zip with a
   dangling reference in its README. */
export const REQUIRED_FILES = [
  'AGENTS.md', 'CLAUDE.md', 'README.md', 'DESIGN.md',
  'tokens.css', 'tokens.ts', 'tailwind.css', 'tailwind.config.js',
  '_tokens.scss', 'tokens.json',
  /* THE TWO FILES THAT CAN RUN. Everything above is read; a reader with 700
     lines of prose in front of it obeys the first fifty. Three arrangement
     faults in one generated build each had a precise rule in DESIGN.md and no
     way to check it. These two answer the rules rather than restating them,
     and `checks.js` writes both of them and the contract's checklist. */
  VERIFY_NODE, VERIFY_BROWSER,
]

/* The sample pages, named in the contract prose and built in the exporter.
   Nothing joined the two, so a rename would have left every instruction
   pointing at files that no longer existed — and the reader who noticed would
   be an agent, mid-build. One place, asserted by the suite against the prose.

   Flat, in the zip root, and not in a folder. Two simulations reported the
   samples missing, both times because the reader took the text files and left
   a subfolder behind. That is a reader error twice over, which makes it a
   packaging problem: a name in the root cannot be walked past, and a folder
   evidently can. `EXAMPLE-dark-dashboard.html` says what it is, which theme it
   shows and which surface, before anyone opens it. */
export const HTML_EXAMPLES_MODES = ['light', 'dark']

/* WHICH of those two ship is the document's decision, and it was not being
   asked. FOURTH VARIANT OF ONE FAULT. `markdown.js` asked `hasDark`, true for
   dark-only. `agents.js` asked the shape of the derived object, true always.
   This asked nothing at all: the list was a constant.

   So a dark-only package shipped eleven `EXAMPLE-light-*.html` pages, each
   pinned to `data-theme="light"`, painting a palette `tokens.css` does not
   publish and DESIGN.md forbids inventing. Measured on one export: 2,506,572
   bytes of light pages in a 5,325,788-byte package. 47% of what the reader
   downloads demonstrated a theme the document says does not exist.

   The comment at the call site named its own reason and the reason had
   expired. It said `tokens.css` ships both regardless, which was true while
   the theme was an editing preference. The theme is a three-way field now, and
   it decides what gets EMITTED. */
export const exampleModes = state =>
  hasThemeToggle(state) ? HTML_EXAMPLES_MODES : [themeOf(state)]

export const EXAMPLE_PREFIX = 'EXAMPLE'
export const exampleFilename = (mode, id) => `${EXAMPLE_PREFIX}-${mode}-${id}.html`

export function payloadTextFiles (state, derived) {
  /* The same contract under both names agents already hunt for. Claude Code
     opens CLAUDE.md unprompted, and AGENTS.md is the cross-tool convention.
     README.md stays human and points at them on line one. The duplication is
     deliberate: about 4KB buys the odds that whichever agent receives the zip
     finds the rules without being told to look. */
  const contract = filename => agentContract(state, derived, { filename })
  return {
    'AGENTS.md': contract('AGENTS.md'),
    'CLAUDE.md': contract('CLAUDE.md'),
    'README.md': tokens.packageReadme(state),
    'DESIGN.md': generateFile(state, derived).text,
    'tokens.css': tokens.tokensCss(state, derived),
    'tokens.ts': tokens.tokensTs(state, derived),
    'tailwind.css': tokens.tailwindV4Css(state, derived),
    'tailwind.config.js': tokens.tailwindPreset(state, derived),
    '_tokens.scss': tokens.tokensScss(state, derived),
    'tokens.json': tokens.tokensJson(state, derived),
    /* The state decides whether the direction-aware check bodies ship. An LTR
       build gets the file it has always had, byte for byte. */
    [VERIFY_NODE]: verifyNodeFile(state),
    [VERIFY_BROWSER]: verifyBrowserFile(state),
  }
}
