/* The CLI for `readme-facts.mjs`. Refuses a commit whose README states a
 * figure the code no longer computes.
 *
 * A RUN THAT MEASURED NOTHING IS NOT A PASS. An absent README, or a table that
 * matched no figure at all, fails rather than printing a clean line, because a
 * checker that looked nowhere reads exactly like one that found nothing wrong.
 */
import { readFileSync, existsSync } from 'node:fs'
import { checkReadme } from './readme-facts.mjs'

const path = new URL('../../../README.md', import.meta.url)

if (!existsSync(path)) {
  console.error('readme facts: no README.md at the repo root. Unmeasured, so this is a failure.')
  process.exit(1)
}

const rows = await checkReadme(readFileSync(path, 'utf8'))
const bad = rows.filter(r => !r.ok)

if (!rows.length) {
  console.error('readme facts: the table is empty, so nothing was measured.')
  process.exit(1)
}

for (const r of bad) console.error(`  FAIL  ${r.label}: ${r.why}`)

if (bad.length) {
  console.error(`\nreadme facts: ${bad.length} of ${rows.length} figures are wrong or missing.`)
  console.error('Fix the README, or fix the code it describes. A stated number drifts in silence.')
  process.exit(1)
}

console.log(`readme facts: ${rows.length} stated figures, every one matching the code.`)
