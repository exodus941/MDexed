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
import { resolve, cardEdge, BRAND_SLOTS } from './answers.js'
import { GROUND_TINTS } from '../color/ground.js'

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
  /* WHERE EACH SETTING LIVES. Six agents out of six had to guess the panel for
     the multipliers, the card and the theme, and three different guesses came
     back for the theme alone. Read off the source on 3 October 2026. */
  where: {
    seeds: 'Colour panel → Seeds',
    ground: 'Colour panel → Ground Tint',
    type: 'Type panel',
    multipliers: 'Meta/Global panel → Multipliers',
    card: 'Components panel → Card',
    theme: 'Roles panel → "Themes this system ships"',
  },
  /* The wizard says "Both" and the app's control says "Light and dark". An
     agent looking for "Both" finds no such option. */
  themeLabel: { light: 'Light only', dark: 'Dark only', both: 'Light and dark' },
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
 * moves a colour the user picked.
 *
 * THE FIRST NUMBER IS NOT A HUE. This was called `hueFloor` and the prompt said
 * "0.09 apart in hue". The audit compares the two colours AFTER simulating
 * red-green colour blindness, as a distance in Oklab. Five agents of six asked
 * what unit 0.09 was in, and none could have found out from the old wording. */
export const GUARDRAIL = {
  pairs: ['success and danger', 'success and warning', 'accent and danger'],
  simulatedFloor: 0.09,
  lightnessFloor: 0.12,
}

const bullet = (s) => `- ${s}`
const row = (...cells) => `| ${cells.join(' | ')} |`

export function buildPrompt(answers) {
  const a = resolve(answers)
  const W = INTERFACE.where

  /* ── A TABLE, BECAUSE IT WAS MEASURED AGAINST PROSE ──
   *
   * An A/B test on 3 October 2026 gave the same brief, written two ways, to six
   * fresh agents. Both versions scored 16 of 16 on the settings and the steps.
   * The table was 35% shorter. And every agent reading the prose split one
   * choice into settings nobody asked for, such as a "Friendly" type preset
   * and a separate "66%" intensity control. No agent reading the table did.
   *
   * Every row names its control and its panel, because all six agents had
   * to guess the panels the old wording left out. */
  const settings = [
    row('Setting', 'Value', 'Where'),
    row('---', '---', '---'),
  ]
  if (a.brand.length) {
    /* EACH BRAND COLOUR NAMES ITS SEED. The old line said "use them all" and
       named a role for the first only. Six agents of six had to guess where the
       other two went. `applyAnswers` writes them in this order. */
    a.brand.forEach((hex, i) => {
      settings.push(row(`${BRAND_SLOTS[i]} seed`, `${hex} (my brand colour, exact)`, `${W.seeds} → ${BRAND_SLOTS[i].toLowerCase()}`))
    })
  } else {
    /* The range is stated only when it decides something. With a brand colour
       the wizard skips the palette page, so no range reaches the prompt. The
       old prompt named both, and six agents of six asked which one wins. */
    settings.push(row('Accent seed', `${a.palette.seed}, or another hex inside ${a.palette.hue} (${a.palette.label})`, `${W.seeds} → accent`))
  }
  settings.push(
    row('Ground Tint', GROUND_TINTS[a.ground.tint]?.label ?? a.ground.label, W.ground),
    row('Display font', a.type.display, W.type),
    row('Body font', a.type.body, W.type),
    row('Mono font', a.type.mono, W.type),
    row('Density', String(a.tightness.density), W.multipliers),
    row('Roundness', String(a.shape.roundness), W.multipliers),
    row('Depth', String(a.depth.id === 'shadow' ? a.intensity.depth : 0), W.multipliers),
    /* ONE FIELD, NAMED BY THE APP'S OWN KEY. The old line explained that a
       border's intensity "IS that colour", and still sent three agents of three
       hunting for a separate intensity control. */
    row('Card border colour', cardEdge(a), `${W.card} → borderColor`),
  )
  /* THE ROUND SHAPE CAPS THE CARD, and the prompt never said so. The wizard
     preview painted a 20px card that no agent could know to build. */
  if (a.shape.cardRounded) settings.push(row('Card corner radius', a.shape.cardRounded, `${W.card} → rounded`))
  settings.push(row('Themes this system ships', INTERFACE.themeLabel[a.theme.id], W.theme))

  /* ── NEVER MOVE A BRAND COLOUR ──
   *
   * Their decision, 3 October 2026. The audit's repair for a red-green clash
   * moves the SECOND colour of the pair to another ramp step. For success and
   * warning that second colour can be a brand colour, so the rule has to name
   * the repair as well as the seed. */
  const brandRule = a.brand.length
    ? [
        '',
        'My brand colours stay exact. Do not edit their seeds, and do not apply a repair that moves one of them.',
        'If a pair clashes and both of its colours are mine, stop and ask me.',
      ]
    : []

  const lines = [
    '# Task',
    `Build me a design system in the editor at ${MDEXED_URL}. Drive it in a browser you can control.`,
    'Steps: set the values below → clear the audit → show me → export on my go.',
    'Rules: change values only through the app\'s controls. No CSS. No page scripts.',
    '',
    '# Product',
    a.building || '(not stated: ask me before you start)',
    '',
    '# Settings',
    'Set the seeds before the Ground Tint, because one tint follows the accent.',
    '',
    ...settings,
    ...brandRule,
    '',
    '# Screen map',
    bullet(`Left: the editor. Panel strip: ${INTERFACE.panels.join(', ')}. Start in Colour.`),
    bullet(`Right: the live preview. The preview has ${INTERFACE.surfaces.length} surfaces: ${INTERFACE.surfaces.join(', ')}.`),
    bullet(`Top right: two readouts, "${INTERFACE.readouts[0]}" and "${INTERFACE.readouts[1]}". Click one to list its findings. Each finding gives the fault, the remedy, and a button that jumps to the control.`),
    bullet(`"${INTERFACE.undoButton}" reverses one step exactly. "${INTERFACE.exportButton}" writes the package. Use it last.`),
    '',
    '# Colour-blindness check',
    `Pairs: ${GUARDRAIL.pairs.join('; ')}.`,
    `A pair FAILS when both are true: simulated for red-green colour blindness, the two colours are under ${GUARDRAIL.simulatedFloor} apart in Oklab distance; and their OKLCH lightness (0 to 1) differs by under ${GUARDRAIL.lightnessFloor}.`,
    `Under ${GUARDRAIL.simulatedFloor} with enough lightness is a WARNING.`,
    `→ Keep each pair at least ${GUARDRAIL.lightnessFloor} apart in lightness, and the check cannot fail.`,
    '',
    '# Audit outcomes',
    bullet('Both readouts clean: go to "Show me".'),
    bullet('Failures: fix every one. Readout → remedy → jump button.'),
    bullet('Warnings only: fix a warning when the fix is free. Free means the failure and warning totals do not rise, and no value in the Settings table changes. Tell me about every warning you leave.'),
    bullet('A repair previews its failure count before and after. If the count rises, do not apply it. Tell me instead.'),
    '',
    '# Show me, then wait',
    'You cannot judge a screen, so leave the browser tab open and tell me which preview surface to look at.',
    'Ask me one question with three answers: it is right / change something / start again. Wait for my answer. Do not export yet.',
    '',
    '# Export, on my go',
    `1. Click "${INTERFACE.exportButton}". Tell me where the file landed.`,
    '2. Print a short second prompt for whoever builds the product: where the package is, the instruction to read its AGENTS.md before anything else, and a blank line labelled "your notes". Do not summarise the package. It opens with a map of itself.',
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
