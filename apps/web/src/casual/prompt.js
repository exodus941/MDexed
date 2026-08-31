/* ── THE PROMPT THE USER COPIES ──
 *
 * The output of the wizard is text, not a document. The user pastes it into an
 * agent, the agent drives mdexed.vercel.app, and a payload comes back. So this
 * file writes for a reader who has never seen the app and cannot see a screen.
 *
 * It carries six things and nothing else:
 *
 *   1. The URL, and the instruction to open it.
 *   2. The user's one line about what they are building.
 *   3. The wizard's answers, as ranges and named values.
 *   4. Enough of the INTERFACE to navigate it.
 *   5. The guardrail numbers, so the agent can avoid the one warning class
 *      rather than discover it.
 *   6. How to read the verdict, and what to do at each outcome.
 *
 * ── THE BOUNDARY, AND WHERE THEY MOVED IT ──
 *
 * The first version of this said the prompt "does not describe MDexed", on the
 * grounds that the exported package ships an `AGENTS.md` whose whole job is to
 * introduce itself. They corrected that on 29 August 2026:
 *
 *   > for 1.3, a little intro of MDexed might be helpful for the agent to
 *   > navigate the program when building the design
 *
 * Both are right, because they are about different artefacts. `AGENTS.md`
 * introduces the PAYLOAD, and it ships inside the export — which happens at the
 * END of the agent's work here. Nothing introduces the APP the agent has to
 * drive to get there, and an agent that cannot find the export button never
 * reaches the file that would have explained everything.
 *
 * So item 4 is a map of the SCREEN, not of the schema. Where the panels are,
 * where the two readouts are, which button exports. It names no token, no role
 * and no field, because those are the schema's to state and the schema changes.
 *
 * Every number and label below was read out of the running app rather than
 * remembered. See `readInterface` at the foot of this file.
 */
import { resolve } from './answers.js'

export const MDEXED_URL = 'https://mdexed.vercel.app'

/* ── WHAT THE AGENT WILL SEE ──
 *
 * Read from the live app on 29 August 2026: 12 editor panels, 11 preview
 * surfaces, two readouts, 116 controls in the chrome.
 *
 * Held as data rather than prose so the drift check can compare it against the
 * running app and fail when a panel is renamed. A prompt that names a tab which
 * no longer exists is worse than one that names none. */
export const INTERFACE = {
  panels: ['Colour', 'Meta/Global', 'Roles', 'Type', 'Layout', 'Shape', 'Depth',
    'Motion', 'Components', 'Directives', 'Rationale', 'History'],
  surfaces: ['Dashboard', 'Record', 'Index', 'Shell', 'Landing', 'Pricing',
    'Form', 'Settings', 'Empty', 'Overlays', 'Gallery'],
  readouts: ['Contrast OK', 'No warnings'],
  exportButton: 'Export Payload',
  undoButton: 'Undo',
}

/* ── THE ONE WARNING CLASS WORTH NAMING ──
 *
 * Everything else the audit reports is a contrast failure with an obvious
 * remedy: darken or lighten until it clears. This one is not obvious, because
 * the two colours look completely different to normal vision and identical to
 * roughly one man in twelve.
 *
 * Naming the thresholds lets the agent avoid it while choosing. Discovering it
 * afterwards costs a repair pass, and the repair is a lightness change that
 * moves a colour the user picked. */
export const GUARDRAIL = {
  pairs: ['success and danger', 'success and warning', 'accent and danger'],
  hueFloor: 0.09,
  lightnessFloor: 0.12,
}

const bullet = (s) => `- ${s}`

export function buildPrompt(answers) {
  const a = resolve(answers)
  /* Every colour they gave, in order. The first anchors the accent and the
     rest land on the other seeds. Naming a count as well as the list, because
     an agent reading six hexes needs to know none of them is optional. */
  const brand = a.brand.length
    ? `${a.brand.length} given, use them all: ${a.brand.join(', ')}. The first is the accent.`
    : 'none given, so choose inside the hue range above'

  const lines = [
    'Build me a design system.',
    '',
    `Open ${MDEXED_URL} in a browser you can drive. It is a design-system editor.`,
    'You will set it up, check its own audit, show me the result, and export a',
    'package. Do not write any CSS yourself.',
    '',
    '## What I am building',
    '',
    a.building || '(not stated — ask me before you start)',
    '',
    '## What I chose',
    '',
    bullet(`Palette: ${a.palette.label}. Hue range ${a.palette.hue}. Start from ${a.palette.seed}.`),
    bullet(`Brand colours: ${brand}.`),
    bullet(`Type: ${a.type.label}. ${a.type.display} for display, ${a.type.body} for body, ${a.type.mono} for mono.`),
    bullet(`Tightness: ${a.tightness.label}. Set the density macro to ${a.tightness.density}.`),
    bullet(`Shape: ${a.shape.label}. Set the roundness macro to ${a.shape.roundness}.`),
    bullet(`Depth: ${a.depth.label}. Set the depth macro to ${a.depth.depth}, and the card's border colour to ${a.depth.cardBorder}.`),
    bullet(`Theme: ${a.theme.label}.`),
    '',
    '## The screen',
    '',
    'Two columns. The editor is on the left, a live preview on the right.',
    '',
    bullet(`The editor's panels, in a strip along the top: ${INTERFACE.panels.join(', ')}. Colour holds the seeds every scale is generated from, so it is where you start.`),
    bullet(`The preview has ${INTERFACE.surfaces.length} surfaces, also as a strip: ${INTERFACE.surfaces.join(', ')}. They are real screens, not swatch sheets.`),
    bullet(`Two readouts sit at the top right and are the app's verdict on your work: "${INTERFACE.readouts[0]}" and "${INTERFACE.readouts[1]}". Click either one to open the panel that lists what it found. Each finding names the fault, the remedy, and has a button that jumps to the control.`),
    bullet(`"${INTERFACE.undoButton}" reverses one step and restores the state exactly.`),
    bullet(`"${INTERFACE.exportButton}" writes the package. That is the last thing you do.`),
    '',
    'Change values through the controls. Do not edit the page with script.',
    '',
    '## The one thing to get right while choosing',
    '',
    `Three role pairs must stay apart for red-green vision: ${GUARDRAIL.pairs.join('; ')}.`,
    `The audit simulates deuteranopia and protanopia. A pair fails when it is under`,
    `${GUARDRAIL.hueFloor} apart in hue AND under ${GUARDRAIL.lightnessFloor} apart in lightness. Under the hue`,
    'floor alone is a warning. So separate them on LIGHTNESS, not only on hue,',
    'and you will not meet this at all.',
    '',
    '## What to do with the verdict',
    '',
    bullet('Both readouts clean: go on to the preview.'),
    bullet('Failures: fix every one. Click the readout, read the remedy, use the jump button.'),
    bullet('Warnings only: fix them if the fix costs nothing. Tell me about any you leave.'),
    bullet('A repair offers a preview before it changes anything, and it shows the failure count before and after. If a repair raises the total, do not apply it. Tell me instead.'),
    '',
    '## Show me before you export',
    '',
    'You cannot render a screen, so do one of these:',
    '',
    bullet('Point me at the browser tab you already have open, and tell me which preview surface to look at.'),
    bullet('Or export first and open one of the EXAMPLE pages the package ships.'),
    '',
    'Then ask me one question with three answers: it is right, change something,',
    'or start again. Wait for my answer.',
    '',
    '## Export',
    '',
    `On my go, click "${INTERFACE.exportButton}" and tell me where the file landed.`,
    'Then print a second prompt I can give to whoever builds the product. Keep it',
    'short: where the package is, the instruction to read its AGENTS.md before',
    'anything else, and a blank line labelled "your notes" for me to fill in.',
    'Do not summarise the package in that prompt. It opens with a map of itself.',
  ]
  return lines.join('\n')
}

/* The extension is a parameter, so .md and .txt cannot drift into two naming
   rules. Markdown is the default because the prompt uses headings and lists;
   .txt is there for anywhere that refuses an .md attachment. */
export function promptFilename(answers, ext = 'md') {
  const a = resolve(answers)
  const slug = (a.building || 'design-system')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `${slug || 'design-system'}-brief.${ext}`
}

/* ── THE DRIFT CHECK'S EYES ──
 *
 * Returns what the running app actually shows, in the same shape as INTERFACE,
 * so a test can diff the two. Nothing in the prompt is allowed to name a tab
 * that has been renamed, and only the live DOM can settle that.
 *
 * Takes a document so it can run against a test page as well as the real one. */
export function readInterface(doc = document) {
  const inChrome = e => !e.closest('.dmd')
  const labels = [...doc.querySelectorAll('button')].filter(inChrome)
    .map(b => (b.textContent || '').trim())
  const has = re => labels.filter(t => re.test(t))
  return {
    panels: has(/^(Colour|Meta\/Global|Roles|Type|Layout|Shape|Depth|Motion|Components|Directives|Rationale|History)$/),
    surfaces: has(/^(Dashboard|Record|Index|Shell|Landing|Pricing|Form|Settings|Empty|Overlays|Gallery)$/),
    readouts: has(/Contrast|warning|failure/i),
    exportButton: labels.find(t => /^Export/.test(t)) ?? null,
    undoButton: labels.find(t => /^Undo$/.test(t)) ?? null,
  }
}
