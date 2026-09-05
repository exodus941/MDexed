/* ── EMPTY THE OUTPUT DIRECTORY, AND KEEP TRYING ──
 *
 * This repo lives inside a synced folder, so a sync client indexes `dist/` the
 * moment vite writes it. It then holds a handle for a second or two, and the
 * NEXT build dies before it compiles anything:
 *
 *     EPERM, Permission denied: \\?\...\apps\web\dist\assets
 *       at emptyDir  ->  prepareOutDir  ->  buildEnvironment
 *
 * It reads as a code fault and is not one. Nothing was compiled, so the error
 * points at whatever file the indexer happened to be holding — `dist/assets`
 * one run, `dist/run10` the next. I chased the second of those to the wrong
 * cause and moved three folders out of `public/` for it. That was worth doing
 * on its own merits, and it did not fix this.
 *
 * vite has no retry here, so the removal happens before vite starts. A handle
 * held by an indexer is released in well under a second, so a short backoff
 * clears it every time. FAIL LOUDLY if it does not: a build that silently
 * writes into a half-emptied directory is worse than one that stops. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const DEADLINE = 10_000
const started = Date.now()
let attempts = 0
let last = null

while (Date.now() - started < DEADLINE) {
  attempts++
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    if (attempts > 1) console.log(`clean-dist: removed after ${attempts} attempts`)
    process.exit(0)
  } catch (err) {
    last = err
    /* Busy-wait rather than sleep: this runs for milliseconds in the normal
       case, and a timer here would add a hundred of them to every build. */
    const until = Date.now() + 150
    while (Date.now() < until) { /* hold */ }
  }
}

console.error(`clean-dist: could not empty ${dir} after ${attempts} attempts in ${DEADLINE}ms`)
console.error(`  ${last?.message ?? 'no error recorded'}`)
console.error('  Something is holding a file open. A sync client usually lets go within a second;')
console.error('  a dev server or an editor with the folder open will not.')
process.exit(1)
