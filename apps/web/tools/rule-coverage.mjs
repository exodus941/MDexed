/* ── ARE WE ENFORCING THE RULES AS WELL AS WE WRITE THEM? ──
 *
 * Their question, 6 September 2026, and the answer was no. Measured that day:
 * the emitted document stated 161 hard instructions and the package shipped 48
 * checks. In the two days before it, four rules were found broken by a person
 * looking at a screenshot, and every one of them was already written down.
 *
 *     an amount takes an end edge
 *     a figure takes the mono face
 *     a control beside a heading centres on its cap band
 *     an action row that breaks, breaks into pairs
 *
 * Each passed both verifiers, because neither verifier had anything to say
 * about them. Nothing linked a rule to its check, so the gap was invisible.
 *
 * A RATCHET, NOT A MATCHER. Pairing prose to checks by keyword is fuzzy, and a
 * fuzzy test either fires on correct code or passes what it should catch. This
 * counts instead. Hard instructions in, checks out, and the RATIO may not
 * fall. Adding rules without checks lowers it and fails, which is "ship the
 * check with the rule" enforced rather than remembered.
 *
 * It cannot say a rule is WELL checked. It can say the system stopped adding
 * rules faster than it adds ways to catch them breaking, and that is the thing
 * that went wrong. */
import url from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const load = f => import(url.pathToFileURL(path.join(here, '..', 'src', f)).href)

const { payloadTextFiles } = await load('emit/payload.js')
const { createInitialState } = await load('state/schema.js')
const { derive } = await load("state/derive.js")
const { CHECKS } = await load('emit/checks.js')

const BASELINE = path.join(here, 'rule-coverage.json')

/* A HARD INSTRUCTION IS ONE A BUILD CAN BREAK. A bullet that explains a reason
   or names a trade-off is prose, and no tool was ever going to check it. The
   test is the verb: this bullet tells the reader to do or not do something. */
const HARD = /\b(never|always|must|do not|don't|cannot|has to|have to|has no|takes the|takes its|goes|keeps|carries|declares)\b/i

function hardRules (md) {
  const out = []
  let section = '(front matter)'
  for (const line of md.split('\n')) {
    const h = /^#{2,4}\s+(.*)$/.exec(line)
    if (h) { section = h[1].trim(); continue }
    if (!/^[-*]\s+/.test(line)) continue
    const text = line.replace(/^[-*]\s+/, '').trim()
    /* Skip a table of contents entry and a bare link. */
    if (/^\[.*\]\(.*\)$/.test(text)) continue
    if (text.length < 25) continue
    if (!HARD.test(text)) continue
    out.push({ section, text })
  }
  return out
}

const state = createInitialState()
const derived = derive(state)
const files = payloadTextFiles(state, derived)
const rules = hardRules(files['DESIGN.md'] ?? '')

const bySection = new Map()
for (const r of rules) bySection.set(r.section, (bySection.get(r.section) ?? 0) + 1)

const source = CHECKS.filter(c => c.where === 'source').length
const render = CHECKS.filter(c => c.where === 'render').length
const checks = source + render
const ratio = checks / rules.length

const prev = fs.existsSync(BASELINE)
  ? JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  : null

const write = process.argv.includes('--accept')
const pad = n => String(n).padStart(4)

console.log('')
console.log('rule coverage')
console.log(`  hard instructions in DESIGN.md ${pad(rules.length)}`)
console.log(`  shipped checks                 ${pad(checks)}   (${source} source, ${render} render)`)
console.log(`  checks per rule                ${ratio.toFixed(4)}`)
if (prev) console.log(`  baseline                       ${prev.ratio.toFixed(4)}   (${prev.checks} checks, ${prev.rules} rules)`)

const worst = [...bySection].sort((a, b) => b[1] - a[1]).slice(0, 8)
console.log('')
console.log('  the sections stating the most rules:')
for (const [name, n] of worst) console.log(`    ${pad(n)}  ${name}`)

if (write) {
  fs.writeFileSync(BASELINE, JSON.stringify({ rules: rules.length, checks, ratio }, null, 2) + '\n')
  console.log(`\n  baseline written: ${checks} checks over ${rules.length} rules\n`)
  process.exit(0)
}

if (!rules.length) {
  console.log('\nNOTHING WAS MEASURED. The document parsed to zero rules, which is not a pass.\n')
  process.exit(1)
}

if (prev && ratio + 1e-9 < prev.ratio) {
  console.log('')
  console.log(`FAIL - coverage fell from ${prev.ratio.toFixed(4)} to ${ratio.toFixed(4)}.`)
  console.log(`       Rules went ${prev.rules} to ${rules.length}, checks went ${prev.checks} to ${checks}.`)
  console.log('       Ship the check with the rule, or run this with --accept and say why.')
  console.log('')
  process.exit(1)
}

console.log(`\nPASS - coverage holds at ${ratio.toFixed(4)} checks per rule\n`)
