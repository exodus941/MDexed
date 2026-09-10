/* ── A RENDER CHECK NOBODY BROKE ON PURPOSE IS A RENDER CHECK NOBODY TESTED ──
 *
 * The source half asserts every check against a fixture carrying the fault it
 * exists to find. The render half had nothing of the kind, so a check whose
 * selector stops matching goes quiet, and quiet reads exactly like a clean
 * page.
 *
 * `prove-render.mjs` measures which render checks produce a FINDING on a
 * fixture page. That measurement needs a browser, so this guard cannot take
 * it. What it CAN do is refuse the three ways the record goes wrong on its
 * own, which is what an unwatched measurement always does next.
 *
 *   A RECORDED ID THAT IS NO LONGER A DECLARED CHECK. A rename or a deletion
 *   leaves the record claiming a proof for something that does not exist, and
 *   the count keeps reading as progress.
 *
 *   A FIXTURE PAGE THAT IS GONE. The proof came from that page. Without it
 *   the number is a memory.
 *
 *   A DECLARED COUNT THAT HAS MOVED. New render checks arrive unproven, so the
 *   denominator has to be re-read rather than remembered.
 *
 * AND THE FLOOR ONLY RISES. A number that can only go up is a guard somebody
 * keeps. Lowering it is a deliberate edit to this file's record, which shows
 * in a diff, rather than something a quiet regression can do.
 *
 * IT PRINTS ITS DENOMINATOR. A clean line naming no total reads exactly like a
 * run that looked nowhere.
 */
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(here, '..')

const { CHECKS } = await import(path.join(ROOT, 'src', 'emit', 'checks.js').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'))

const RENDER = CHECKS.filter(c => c.where === 'render').map(c => c.id)
/* A RUN THAT READ NOTHING IS NOT A PASS. */
if (!RENDER.length) {
  console.error('render-proof guard: no render checks were read, so nothing could be checked')
  process.exit(1)
}

const recPath = path.join(here, 'render-proof.json')
if (!existsSync(recPath)) {
  console.error('render-proof guard: tools/render-proof.json is absent, so the proven set is UNMEASURED')
  process.exit(1)
}
const rec = JSON.parse(readFileSync(recPath, 'utf8'))

const bad = []

const declared = new Set(RENDER)
const stale = rec.proven.filter(id => !declared.has(id))
if (stale.length) bad.push(stale.length + ' recorded id(s) are no longer a declared render check: ' + stale.join(', '))

const dupes = rec.proven.filter((id, i) => rec.proven.indexOf(id) !== i)
if (dupes.length) bad.push('the record lists ' + dupes.length + ' id twice: ' + dupes.join(', '))

const fixtures = path.join(ROOT, 'local', 'fixtures')
const missing = rec.fixturePages.filter(p => !existsSync(path.join(fixtures, p)))
/* A FRESH CLONE HAS NO local/, and that is not a regression. Say so rather
   than failing, and rebuild them with the fixture tools. */
const noFixtureDir = !existsSync(fixtures)

if (!noFixtureDir && missing.length) {
  bad.push(missing.length + ' fixture page(s) named in the record are gone: ' + missing.join(', '))
}

if (rec.declaredRenderChecks !== RENDER.length) {
  bad.push('the record says ' + rec.declaredRenderChecks + ' declared render checks and there are '
    + RENDER.length + '. Re-measure with prove-render.mjs, because a new check arrives unproven.')
}

const proven = rec.proven.length
const unproven = RENDER.length - proven

console.log('render-proof guard: ' + proven + ' of ' + RENDER.length
  + ' render checks proven to fire on a fixture, ' + unproven + ' never proven'
  + (noFixtureDir ? '  (local/fixtures is not in this checkout, so the pages were not read)' : ''))

if (bad.length) {
  console.log('')
  for (const b of bad) console.log('  ' + b)
  console.log('')
  console.log('  Run: node tools/prove-render.mjs, open /fixtures/prove-render.html,')
  console.log('  read window.proveRender() and write the result into tools/render-proof.json.')
  process.exit(1)
}
process.exit(0)
