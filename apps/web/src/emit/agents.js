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
   cap still holds 12% headroom and still bites first on real growth. */
export const CONTRACT_MAX_LINES = 175
export const CONTRACT_MAX_BYTES = 8000

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

This package is a design system. It is not a suggestion or a starting point.
Treat every value in it as a decision that has already been made.

## Read in this order

1. This file.
2. \`DESIGN.md\`, in full. It carries the reasoning, not only the values.
3. \`tokens.css\`, to see the names you will actually write.
4. The \`EXAMPLE-*.html\` pages, only after the three above.

Do not skip step 2. The values alone will let you build something that
validates and still looks wrong, because the constraints that matter most are
stated in prose.

## Precedence

If two files disagree, this is the order. \`DESIGN.md\` wins over everything.
\`tokens.css\` wins over the other token formats. The HTML examples never win.

They are generated from one source and cannot really disagree. This rule
exists so that you never have to guess if you think they do.

## Hard rules

Never write a literal colour. No hex, no \`rgb()\`, no named colour. Use a
token.

Never invent a spacing, radius, font size or shadow value. Every value you
need already has a name. If you are typing a number into a CSS property that
has a scale, you are doing it wrong.

Never rename a token. Downstream tooling and the next export both depend on
the names as given.

Never add a font family. The system names every family it uses.

Never change a value to fix a contrast problem. The pairings were checked. If
a pairing looks wrong to you, report it and continue.

Never treat an \`EXAMPLE-*.html\` page as a template. They are style references.
Copy the token usage. Do not copy the markup or the page structure.

## When the system is silent

The system does not cover every case, and this is where you may use judgement.
Use it in this order.

First, derive from what exists. A value between two steps of a scale means you
pick one of the two steps, not a number in between.

Second, follow the nearest documented pattern. A component that is not
specified should borrow from the closest one that is.

Third, if neither works, choose, then say so. List every such choice at the
end of your work under a heading "Choices not covered by the design system".
Do not bury them in comments.

Do not resolve silence by importing a convention from another design system.

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
| \`EXAMPLE-<theme>-<surface>.html\` | Style reference only. Never a template. |

Take \`tokens.css\` plus the one file matching the stack you were asked for.
Ignore the rest. Shipping both Tailwind files is not an invitation to use both.
The two \`VERIFY\` files are not part of that choice; both run whatever you build.

## Theme switching

${both
  ? `Set \`data-theme="dark"\` on the root element. Every token resolves to its
dark value with no second set of rules. With no attribute, the operating
system preference decides. Do not write a separate dark stylesheet.`
  : `This system ships one theme. Do not invent a second one.`}

## The part that decides whether this looks built or thrown together

Tokens are the easy half. What separates a screen that looks made from one that
looks generated is alignment, and it is all in DESIGN.md under **Typography**
and **Layout**. Read those two before you write a component.

The checklist below measures most of it for you. These three it cannot, because
each depends on content it has no way to vary:

- **A control beside a label centres on the label's FIRST line**, not on the
  label as a block. Centring the row is right for one line and wrong the moment
  it wraps, so build it against a label that actually wraps.
- **Proximity is a ratio.** The gap between two groups must clearly beat the gap
  inside one, or they read as a single block.
- **A narrow layout collapses, it never reflows.** Actions beside a heading move
  BELOW the heading and its description. Navigation goes behind one menu button.
  Ask the container, not the window — a rail takes its width off everything else.

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

The hard part is applying this to the row you changed two minutes ago. Two
failures survive everything above:

- A check was silenced to keep the output tidy. A command sent to \`/dev/null\`
  prints nothing when it fails, and that silence reads exactly like success.
- A run that reported nothing was never a pass if it measured nothing. Read the
  file count and the width it printed, not the absence of findings.
`
}
