/* Fail when a preview screen uses a class the system does not define.
 *
 * WHY THIS EXISTS. I audited a new surface for strays by querying the three I
 * could already name, found none, and reported it clean. It carried four,
 * including filters hand-built from plain buttons while `.select-trigger` sat
 * in the stylesheet with a comment describing exactly that use. Their reply
 * was the right one: "i thought you said you were checking the page for
 * strays".
 *
 * The rule "enumerate every instance, by query" was already in five stores.
 * Knowing it did not make me run it, and a rule I can quote and still skip is
 * a rule that needs a machine behind it.
 *
 * WHAT IT CHECKS. Every `className` string literal in the preview screens is
 * split into classes. A class is legal if the stylesheet defines it, or if it
 * names a declared component. Anything else is a stray: either a typo, or a
 * primitive somebody invented in a screen instead of in the system.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK. It cannot see a screen that uses the
 * wrong legal class — plain `.btn` where `.select-trigger` belongs is invisible
 * here, and that was the actual fault. This narrows the hole rather than
 * closing it. The reviewer still has to ask what a control IS.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const WEB = 'apps/web/src/preview'
const CSS = join(WEB, 'preview.css')
const RESPONSIVE = join(WEB, 'responsive.rules.css')

const css = readFileSync(CSS, 'utf8') + readFileSync(RESPONSIVE, 'utf8')

/* Every class the preview stylesheet defines. */
const defined = new Set()
for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) defined.add(m[1])

/* Every component the schema declares, as a class name and with its variants
   flattened the way the document flattens them. */
const comp = readFileSync('apps/web/src/state/components.js', 'utf8')
for (const m of comp.matchAll(/name:\s*'([\w-]+)'/g)) defined.add(m[1])

/* Utility classes the screens legitimately share with the chrome. */
for (const c of ['small', 'muted', 'subtle', 'caption', 'figure', 'amount']) defined.add(c)

const files = readdirSync(join(WEB, 'screens')).filter(f => f.endsWith('.jsx'))
  .map(f => join(WEB, 'screens', f))
files.push(join(WEB, 'Gallery.jsx'))

let problems = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const seen = new Map()
  /* Only STATIC class strings. A template literal builds its classes at run
     time and this cannot follow it, which is a stated limit rather than a
     silent one. */
  for (const m of src.matchAll(/className="([^"{}]+)"/g)) {
    const line = src.slice(0, m.index).split('\n').length
    for (const c of m[1].split(/\s+/).filter(Boolean)) {
      if (!defined.has(c) && !seen.has(c)) seen.set(c, line)
    }
  }
  for (const [c, line] of seen) {
    console.log(`  STRAY  ${file}:${line}  .${c} is used but nothing defines it`)
    problems++
  }
}

console.log(problems === 0
  ? `strays guard: ${files.length} preview files clean`
  : `\n${problems} stray class${problems === 1 ? '' : 'es'}.`)
process.exit(problems === 0 ? 0 : 1)
