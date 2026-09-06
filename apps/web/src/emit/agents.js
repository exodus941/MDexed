/* The agent contract.
 *
 * One document, shipped under three names, because you cannot make an agent
 * read a file and the next best thing is to use the names agents already look
 * for. `CLAUDE.md` is read by Claude Code with no prompting. `AGENTS.md` is the
 * emerging cross-tool convention. `README.md` is what everything else opens
 * first, so it stays human and points here in its first line.
 *
 * Inventing a name like INSTRUCTIONS.md would have been the weakest option
 * available. Nothing hunts for it.
 *
 * This file is a contract, not a description. DESIGN.md carries the content.
 * This carries only the rules for using it. That split is why it can stay
 * short, and it has to stay short: a long contract competes with the document
 * it is introducing, and agents skim. The ceilings below are asserted by the
 * test suite against every preset, so length cannot drift without failing the
 * build.
 */

/* ── THE CHECKLIST IS GENERATED, AND THAT IS THE POINT ──
 *
 * It used to be fourteen hand-written lines, and every one of them was
 * something a grep can see: a colour, a number, a token name, a font. Three
 * arrangement faults in one generated build each had a precise rule in
 * DESIGN.md and no line here, so the builder read past all three.
 *
 * The lines now come from `checks.js`, which also writes the two verifiers the
 * payload ships. A rule cannot be worded one way for the reader and coded
 * another way for the tool, and a rule added to the tool cannot fail to reach
 * the reader.
 */
import { SOURCE_CHECKS, RENDER_CHECKS, MANUAL_CHECKS } from './checks.js'
import { VERIFY_NODE, VERIFY_BROWSER } from './verify.js'

const bullets = checks => checks.map(c => '- ' + c.line).join('\n')

/* Ceilings, enforced in test/pipeline.mjs. Chosen from the generated output
   plus about 25% headroom, so ordinary edits pass and a runaway section does
   not.

   THE LINE CAP MOVED AND THE BYTE CAP TIGHTENED, on the same edit. The
   checklist became one generated bullet per rule, and a bullet is one long
   line where the prose it replaced was three wrapped ones. Worst case went
   from 137 lines to 159 while the BYTES fell from 7056 to 7033: the contract
   is shorter to read and taller on screen.

   So the line cap is now 175 and the byte cap comes down from 9000 to 8000.
   Raising a ceiling to fit is how a document bloats, and the guard against
   that is the cap that measures length rather than wrapping. At 7033 the byte
   cap still holds 12% headroom and still bites first on real growth.

   THEN THE CAP STARTED FIGHTING THE RULE SET INSTEAD OF THE PROSE.
   Three simulations in a row earned a new check, and each one had to buy its
   place by shaving a sentence somewhere else. That is the cap measuring the
   wrong thing. Its stated reason is that a long contract competes with the
   DESIGN.md it introduces and agents skim: the PROSE is what gets skimmed,
   and the checklist is the half the last three runs proved gets obeyed.

   So the byte cap now measures the prose alone, with every generated bullet
   removed. The checklist grows with the rule set, which is the point of it,
   and a new rule no longer costs a sentence somewhere unrelated. Measured at
   the split: 8138 bytes whole, 5389 of prose.

   5500 leaves about one sentence of room, which is the tension wanted: a new
   paragraph has to be worth displacing something, and a one-word correction
   does not fail the build.

   AND THE LINE CAP HAD THE SAME FAULT, one argument later. It was left
   measuring the whole file, on the reasoning that height on screen costs the
   reader whatever fills it. That is true and it is not the tension worth
   holding: two new checks in one session took the file to 176 against a cap of
   175, and the fix on offer was to delete a sentence somewhere unrelated.
   Which is the thing this comment already says is the cap measuring the wrong
   thing.

   So the line cap measures PROSE lines too. A bullet is one line per rule, by
   construction, so the checklist's height is a count nobody has to police.
   Measured at this second split: 176 lines whole, 132 of prose. */
export const CONTRACT_MAX_LINES = 165
export const CONTRACT_MAX_BYTES = 5500

/* The three generated blocks, so a caller can subtract them and measure the
   prose alone. Built with the same `bullets` the contract uses, rather than by
   pattern-matching the rendered text: the prose carries hand-written bullets
   of its own, and a `^- ` filter would quietly count those as generated. */
export function checklistBytes () {
  return [SOURCE_CHECKS, RENDER_CHECKS, MANUAL_CHECKS]
    .reduce((n, list) => n + new TextEncoder().encode(bullets(list)).length, 0)
}

/* One line per rule, which is what makes the line cap safe to measure against
   the prose alone. */
export function checklistLines () {
  return [SOURCE_CHECKS, RENDER_CHECKS, MANUAL_CHECKS]
    .reduce((n, list) => n + list.length, 0)
}

/* Only two things vary in length: the project name and the theme list. The
   name is bounded here so a pathological one cannot blow the byte ceiling. */
const NAME_CAP = 60

export function agentContract (state, derived, opts = {}) {
  const raw = state.meta?.name?.trim() || 'this design system'
  const name = raw.length > NAME_CAP ? raw.slice(0, NAME_CAP - 1) + '…' : raw
  const both = Boolean(derived?.roles?.dark && derived?.roles?.light)
  const themes = both ? 'light and dark' : 'a single theme'
  const filename = opts.filename ?? 'AGENTS.md'
  const twin = filename === 'AGENTS.md' ? 'CLAUDE.md' : 'AGENTS.md'

  return `# Agent instructions for ${name}

Read this file completely before you write any code. It is identical to
${twin} in this package, so read only one.

This is a design system, not a starting point. Every value in it is a decision
already made.

## Read in this order

1. This file.
2. \`DESIGN.md\`, in full. It carries the reasoning, not only the values.
3. \`tokens.css\`, to see the names you will actually write.
4. \`EXAMPLE-<theme>-gallery.html\`, before you write a single component.
5. The other \`EXAMPLE-*.html\` pages, as you need them.

Do not skip step 2. The values alone will let you build something that
validates and still looks wrong, because the constraints that matter most are
stated in prose.

## Precedence

If two files disagree: the Gallery wins on how a component is BUILT, DESIGN.md
wins on everything else, and \`tokens.css\` wins over the other token formats.

## Hard rules

Never write a literal colour. No hex, no \`rgb()\`, no named colour. Use a
token.

Never invent a spacing, radius, font size or shadow value. Typing a number into
a property that has a scale is always wrong.

Never rename a token. Downstream tooling and the next export depend on the
names as given.

Never invent a token or class name. A token holding two values has no \`-x\` or
\`-y\` half, and an invented name paints nothing and reports nothing.

Never add a font family. The system names every family it uses.

Never change a value to fix a contrast problem. The pairings were checked. If
a pairing looks wrong to you, report it and continue.

## Build your components from the Gallery

\`EXAMPLE-<theme>-gallery.html\` is every component this system ships, built
correctly. Extract the ones you need, reproduce each 1:1, then compose your
screen from them. Never derive a component from the prose.

THE PAGE IS NOT A TEMPLATE. THE COMPONENTS IN IT ARE. Take the whole one: its
box, its ornament, its variants, its states, and what its MARKUP renders. Half
a component contradicts itself. DESIGN.md's Components section says how.

## When the system is silent

The system does not cover every case, and this is where you may use judgement.
Use it in this order.

First, derive from what exists. A value between two steps of a scale means one
of the two steps, never a number in between.

Second, borrow from the nearest component in the Gallery.

Third, choose, then say so, under a heading "Choices not covered by the design
system". Do not bury them in comments, and do not import a convention from
another design system.

## The files

| File | Use it for |
| --- | --- |
| \`DESIGN.md\` | The system and its reasoning. Read first, obey always. |
| \`tokens.css\` | Custom properties for ${themes}. Import this. Start here. |
| \`tokens.ts\` | Literal values, for code that cannot resolve a CSS variable. |
| \`tailwind.css\` | Tailwind v4 only. An \`@theme\` block, imported after \`tokens.css\`. |
| \`tailwind.config.js\` | Tailwind v3 only. A preset to merge, never to replace. |
| \`_tokens.scss\` | Sass variables and maps. |
| \`tokens.json\` | W3C Design Tokens, for Style Dictionary and Figma. |
| \`${VERIFY_NODE}\` | Run it on your source before you report. Not optional. |
| \`${VERIFY_BROWSER}\` | Paste into the console of the page you built. Not optional. |
| \`EXAMPLE-<theme>-gallery.html\` | Every component, built correctly. Extract from it. Read it before you write one. |
| \`EXAMPLE-<theme>-<surface>.html\` | A screen using those components. Take the arrangement, never the page. |

Take \`tokens.css\` plus the one file matching the stack you were asked for.
Ignore the rest. Shipping both Tailwind files is not an invitation to use both.
The two \`VERIFY\` files are not part of that choice; both run whatever you build.

## Theme switching

${both
  ? `Label a visually hidden \`#dmd-dark\` checkbox with your visible control.
\`tokens.css\` answers it with no script, and \`data-theme\` is what a script sets
later. Write neither into your markup: absence follows the system preference.`
  : `This system ships one theme. Do not invent a second one.`}

## The part that decides whether this looks built or thrown together

Tokens are the easy half. Alignment is what separates a screen that looks made
from one that looks generated, and it is in DESIGN.md under **Typography** and
**Layout**. Read those two before you write a component.

The checklist measures most of it. These three it cannot, because each depends
on content it has no way to vary:

- **A control beside a label centres on the label's FIRST line**, not on the
  block. Build it against a label that actually wraps.
- **Proximity is a ratio.** The gap between two groups must clearly beat the gap
  inside one, or they read as one block.
- **A narrow layout collapses, it never reflows.** Actions move BELOW the
  heading and its description, navigation goes behind one menu button, and the
  width that decides it is the CONTAINER's rather than the window's.

## Before you say you are done

Two of these run. Run them; do not read them and agree with yourself.

\`\`\`
node ${VERIFY_NODE} <your source directory>
\`\`\`

${bullets(SOURCE_CHECKS)}

Then open the page you built and paste \`${VERIFY_BROWSER}\` into the console:

\`\`\`
await verify()
\`\`\`

${bullets(RENDER_CHECKS)}

These ${MANUAL_CHECKS.length} no tool can answer. Check them yourself.

${bullets(MANUAL_CHECKS)}

If any check fails, fix it before you report. Do not report the failure as a
limitation of the design system.

## Run it again after the last edit

Let both checkers print. Silence reads exactly like success, and a run that
measured nothing was never a pass: read the counts, not the absence.
`
}
