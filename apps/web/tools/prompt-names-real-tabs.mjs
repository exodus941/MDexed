/* ── THE PROMPT MUST NAME TABS THAT EXIST ──
 *
 * The generated prompt tells an agent to look for "Colour", "Export Payload",
 * eleven preview surfaces and two readouts. None of that is checked by the
 * build, the guards or the audit, so a rename anywhere would leave a prompt
 * sending an agent to a tab that is not there. A prompt naming a tab that has
 * moved is worse than one naming none: the agent hunts instead of asking.
 *
 * So this compares the prompt's INTERFACE constant against the app's own two
 * lists — `TABS` in App.jsx and `SURFACES` in preview/Canvas.jsx — which are
 * where those labels are actually declared.
 *
 * Read from the SOURCE rather than from a running browser on purpose: this has
 * to fail in CI, before a deploy, and a headless run has no app to drive. The
 * live-DOM half is `readInterface` in prompt.js, for a browser probe.
 */
import { readFileSync } from 'node:fs'
import { INTERFACE, GUARDRAIL, buildPrompt } from '../src/casual/prompt.js'
import { BLANK } from '../src/casual/answers.js'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')

/* Pull the labels out of a `{ id: 'x', label: 'Y', ... }` list by its name. */
function labelsOf(src, listName) {
  const at = src.indexOf(`const ${listName} = [`)
  if (at < 0) return null
  let depth = 0, end = at
  for (let i = src.indexOf('[', at); i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  const body = src.slice(at, end)
  return [...body.matchAll(/label:\s*'([^']+)'/g)].map(m => m[1])
}

const app = read('../src/App.jsx')
const canvas = read('../src/preview/Canvas.jsx')

const realPanels = labelsOf(app, 'TABS')
const realSurfaces = labelsOf(canvas, 'SURFACES')

const fail = []
const note = []

if (!realPanels) fail.push('could not find TABS in App.jsx — the parser needs updating')
if (!realSurfaces) fail.push('could not find SURFACES in preview/Canvas.jsx')

const missing = (named, real, what) => {
  if (!real) return
  const gone = named.filter(n => !real.includes(n))
  const unnamed = real.filter(r => !named.includes(r))
  if (gone.length) fail.push(`the prompt names ${what} that no longer exist: ${gone.join(', ')}`)
  /* A NEW tab is not a failure. The prompt lists what an agent needs to find,
     and a panel added since is a thing to mention, not a lie. */
  if (unnamed.length) note.push(`${what} the prompt does not mention: ${unnamed.join(', ')}`)
}

missing(INTERFACE.panels, realPanels, 'editor panels')
missing(INTERFACE.surfaces, realSurfaces, 'preview surfaces')

/* The count is stated in prose as well as implied by the list, and a list that
   grows while the sentence says eleven is the drift this catches. */
const text = buildPrompt(BLANK)
const stated = text.match(/The preview has (\d+) surfaces/)
if (!stated) fail.push('the prompt no longer states a surface count')
else if (Number(stated[1]) !== INTERFACE.surfaces.length)
  fail.push(`the prompt says ${stated[1]} surfaces and lists ${INTERFACE.surfaces.length}`)

/* Every label the prompt promises must appear in the text it produces. A
   constant nothing renders is a constant nobody maintains. */
for (const label of [...INTERFACE.panels, ...INTERFACE.surfaces, ...INTERFACE.readouts,
  INTERFACE.exportButton, INTERFACE.undoButton]) {
  if (!text.includes(label)) fail.push(`INTERFACE names "${label}" and the prompt never prints it`)
}

/* The guardrail numbers come from the audit. If either moves, the prompt is
   telling the agent to avoid the wrong thresholds. */
const audit = read('../src/a11y/audit.js')
const hue = audit.match(/worst\s*<\s*([\d.]+)/)
const light = audit.match(/dl\s*<\s*([\d.]+)/)
if (!hue || !light) fail.push('could not read the colour-blind thresholds out of audit.js')
else {
  if (Number(hue[1]) !== GUARDRAIL.hueFloor)
    fail.push(`the prompt states a hue floor of ${GUARDRAIL.hueFloor} and the audit uses ${hue[1]}`)
  if (Number(light[1]) !== GUARDRAIL.lightnessFloor)
    fail.push(`the prompt states a lightness floor of ${GUARDRAIL.lightnessFloor} and the audit uses ${light[1]}`)
}

console.log(`prompt drift: ${realPanels?.length ?? '?'} panels, ${realSurfaces?.length ?? '?'} surfaces, 2 thresholds checked`)
for (const n of note) console.log('  note  ' + n)
if (fail.length) {
  console.log('')
  for (const f of fail) console.log('  FAIL  ' + f)
  process.exit(1)
}
console.log('PASS - every name and number in the prompt matches the app')
