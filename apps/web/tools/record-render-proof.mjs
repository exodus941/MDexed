/* Write tools/render-proof.json from a measurement taken in the browser.
 *
 * The measurement needs a browser and this file needs to be on disk, so the
 * two are joined by a person typing a list. Typing the PROVEN list means
 * typing most of the check set, and a transcription slip there silently
 * inflates the count the guard prints.
 *
 * So it takes the UNPROVEN list, which is the shorter half and shrinking, and
 * derives the rest from the declared checks. A typo then fails loudly, because
 * every name has to resolve to a declared render check.
 *
 *   node tools/record-render-proof.mjs a-date-with-a-month-name-is-text ...
 *
 * The fixture pages come from the directory rather than the command line, for
 * the same reason the harness reads it.
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)
const { CHECKS } = await load('emit/checks.js')

const RENDER = CHECKS.filter(c => c.where === 'render').map(c => c.id)
if (!RENDER.length) {
  console.error('no render checks were read, so the record would be a guess')
  process.exit(1)
}

const unproven = process.argv.slice(2).filter(a => a && !a.startsWith('--'))
if (!unproven.length) {
  console.error('name the ids that are still unproven. An empty list would claim every check is proven.')
  process.exit(1)
}

const declared = new Set(RENDER)
const unknown = unproven.filter(id => !declared.has(id))
if (unknown.length) {
  console.error('these are not declared render checks, so the list is mistyped:')
  for (const u of unknown) console.error('  ' + u)
  process.exit(1)
}
const dupes = unproven.filter((id, i) => unproven.indexOf(id) !== i)
if (dupes.length) {
  console.error('named twice: ' + dupes.join(', '))
  process.exit(1)
}

const fixtures = path.join(here, '..', 'local', 'fixtures')
const pages = fs.existsSync(fixtures)
  ? fs.readdirSync(fixtures).filter(f => f.endsWith('.html') && f !== 'prove-render.html').sort()
  : []
if (!pages.length) {
  console.error('no fixture pages in local/fixtures, so no proof could have been taken')
  process.exit(1)
}

const skip = new Set(unproven)
const proven = RENDER.filter(id => !skip.has(id)).sort()

const rec = {
  measured: new Date().toISOString().slice(0, 10),
  how: 'node tools/prove-render.mjs, then window.proveRender() at /fixtures/prove-render.html',
  declaredRenderChecks: RENDER.length,
  fixturePages: pages,
  proven,
}
fs.writeFileSync(path.join(here, 'render-proof.json'), JSON.stringify(rec, null, 2) + '\n')
console.log('render-proof.json written: ' + proven.length + ' of ' + RENDER.length
  + ' proven, ' + unproven.length + ' still unproven, over ' + pages.length + ' fixture page(s)')
