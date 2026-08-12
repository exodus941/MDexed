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
import * as tokens from './tokens.js'

/* Every file a payload must contain, checked by the suite. A rename that
   forgets one of these fails the build rather than shipping a zip with a
   dangling reference in its README. */
export const REQUIRED_FILES = [
  'AGENTS.md', 'CLAUDE.md', 'README.md', 'DESIGN.md',
  'tokens.css', 'tokens.ts', 'tailwind.css', 'tailwind.config.js',
  '_tokens.scss', 'tokens.json',
]

/* The sample-page folder, named in five places across the contract prose and
   built in one place in the exporter. Nothing joined the two, so a rename
   would have left five instructions pointing at a folder that no longer
   existed — and the reader who noticed would be an agent, mid-build. One
   constant, asserted by the suite against the prose. */
export const HTML_EXAMPLES_DIR = 'html-examples'
export const HTML_EXAMPLES_MODES = ['light', 'dark']

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
  }
}
