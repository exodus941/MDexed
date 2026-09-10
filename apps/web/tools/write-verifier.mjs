/* ── THE SERVED VERIFIER WENT STALE IN SILENCE, AND NOTHING WAS LOOKING ──
 *
 * `public/VERIFY-BROWSER.js` is what the matrix driver fetches, and nothing
 * wrote it. Every fixture script writes its own copy into `local/fixtures/`,
 * so that half stayed current while the served copy aged.
 *
 * Found on 11 September 2026, about to run the matrix: five new render checks
 * were in the source and the served file was from a build before them. A run
 * against it would have measured 74 checks and been labelled 79. That is the
 * stale-page failure pointed at my own instrument, and it produces a confident
 * verdict about a check set that was never loaded.
 *
 * Run:    node tools/write-verifier.mjs
 * Check:  node tools/write-verifier.mjs --check      (exits 1 when it drifted)
 *
 * A CHECK MODE, BECAUSE A WRITER NOBODY RUNS IS THE SAME HOLE. The pre-commit
 * hook takes --check, so the served copy cannot drift from the source without
 * failing a commit.
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)

const { createInitialState } = await load('state/schema.js')
const { verifyBrowserFile } = await load('emit/verify.js')
const { CHECKS } = await load('emit/checks.js')

const RENDER = CHECKS.filter(c => c.where === 'render')
/* A RUN THAT EMITTED NOTHING IS NOT A CLEAN RUN. One broken import would
   otherwise write an empty file over the one the driver depends on. */
if (!RENDER.length) {
  console.error('write-verifier: no render checks were read, so this would serve an empty verifier.')
  console.error('Nothing was written, and that is a failure rather than a clean result.')
  process.exit(1)
}

const text = verifyBrowserFile(createInitialState())
if (text.length < 10000) {
  console.error('write-verifier: the emitted verifier is ' + text.length + ' bytes, which is too'
    + ' short to be the real file. Nothing was written.')
  process.exit(1)
}
/* AND EVERY DECLARED CHECK HAS TO BE IN IT, because the file is what the
   driver runs and a missing id is a check nobody measures. */
const absent = RENDER.filter(c => !text.includes(c.id)).map(c => c.id)
if (absent.length) {
  console.error('write-verifier: these render checks are declared and not in the emitted file:')
  for (const a of absent) console.error('  ' + a)
  process.exit(1)
}

const out = path.join(here, '..', 'public', 'VERIFY-BROWSER.js')
const had = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null

if (process.argv.includes('--check')) {
  if (had === text) {
    console.log('verifier guard: public/VERIFY-BROWSER.js matches the source, '
      + RENDER.length + ' render checks, ' + text.length + ' bytes')
    process.exit(0)
  }
  console.error('verifier guard: public/VERIFY-BROWSER.js has drifted from the source.')
  console.error('  served: ' + (had === null ? 'absent' : had.length + ' bytes'))
  console.error('  source: ' + text.length + ' bytes, ' + RENDER.length + ' render checks')
  console.error('The matrix driver fetches the served copy, so a run against it measures the old')
  console.error('check set and gets labelled with the new one. Run: node tools/write-verifier.mjs')
  process.exit(1)
}

fs.writeFileSync(out, text)
console.log('public/VERIFY-BROWSER.js written: ' + RENDER.length + ' render checks, '
  + text.length + ' bytes'
  + (had === null ? ' (was absent)' : had === text ? ' (unchanged)' : ' (was ' + had.length + ')'))
