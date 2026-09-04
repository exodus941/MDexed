/* The shape of an editor document.

   Only seeds, macros and explicit overrides are stored — every concrete token
   value is computed by derive.js. That keeps saved state small and, more
   importantly, means moving a macro slider retroactively reshapes the whole
   system instead of leaving stale values behind. */
import { DEFAULT_SHAPE } from '../color/ramp.js'
/* Safe: components.js imports nothing, so this cannot cycle back. */
import { DEFAULT_TAB_STYLE, DEFAULT_SELECTION_STYLE, DEFAULT_SELECTION_EDGE } from './components.js'

export const SCHEMA_VERSION = 3

const uid = () => Math.random().toString(36).slice(2, 8)

/* ── Semantic roles ──
   The layer that actually makes agent output coherent. A raw ramp tells an
   agent nothing about where a colour belongs; `surface-raised` and
   `border-subtle` tell it how to build a card. */
export const ROLE_GROUPS = [
  {
    id: 'surface', label: 'Surfaces', desc: 'Page and container backgrounds',
    roles: [
      /* ── FOUR PLANES, FOUR COLOURS ──
       *
       * Two of these used to resolve to one hex, and nothing measured it.
       * `surface` and `surface-raised` were both neutral.50 in light, so a
       * popover on a card had no edge. `bg-subtle` and `surface` were both
       * neutral.900 in dark, so a card on a recessed band had none either.
       * Both were invisible while a shadow covered for them; at depth zero
       * they are simply gone, and a reader called the result unattractive.
       *
       * Light could not fix itself by lifting the raised plane, because
       * neutral.50 is already the lightest step. So the CARD steps down to a
       * point between 50 and 100 and the popover keeps the top, which is the
       * conventional light-mode order: higher is lighter. Dark had room below
       * its card, so the recessed band takes the midpoint under it.
       *
       * A ref between two steps rather than a new step: the ramp is placed by
       * index, so inserting one slides every existing colour along the curve
       * and repaints the palette. Measured after: the audit falls from three
       * findings to one, and no new failure appears. */
      { name: 'bg',              desc: 'Page background',            light: 'neutral.100', dark: 'neutral.950' },
      { name: 'bg-subtle',       desc: 'Recessed page areas',        light: 'neutral.200', dark: 'neutral.950~900@0.5' },
      { name: 'surface',         desc: 'Cards, panels, sheets',      light: 'neutral.50~100@0.4', dark: 'neutral.900' },
      { name: 'surface-raised',  desc: 'Popovers, menus, modals',    light: 'neutral.50',  dark: 'neutral.800' },
      { name: 'surface-sunken',  desc: 'Wells, inset fields',        light: 'neutral.200', dark: 'neutral.950' },
      /* Striping a long list is a readability aid, not decoration: the eye
         loses its row on the way across a wide table, and a band brings it
         back. It needs its own role because nothing else in this group means
         "every other row" — reusing `bg-subtle` measured 1.62:1 against the
         surface, which is a boundary rather than a rhythm.
         THE STRIPE IS THE PAGE SHOWING THROUGH, and that is why it steps the
         way it does: away from the surface, TOWARD the page. In light that is
         darker and in dark it is darker again, because the page sits below the
         card in both. Both land on the same step the `bg` role uses.
         Striping the other way in dark — lighter than the surface — was tried
         and it breaks two things at once: a bordered control on the stripe
         falls to 2.68, and the selected row has nowhere left to go, landing at
         exactly 1.00 against it. Stepping down instead gives the control 4.37
         and the selection 1.63.
         BETWEEN two steps, because neither is right. `neutral.100` reads
         1.27:1, which is a band that divides the table into blocks rather than
         a rhythm that groups its rows. The ramp cannot gain a twelfth step —
         `buildRamp` places each one by index, so inserting one slides every
         existing colour — so the ref names the midpoint instead. It still
         follows the seed, which a typed hex would not. */
      { name: 'row-stripe',      desc: 'Every other row in a list',  light: 'neutral.50~100@0.25', dark: 'neutral.900~950@0.25' },
    ],
  },
  {
    id: 'text', label: 'Text', desc: 'Foreground content',
    roles: [
      { name: 'text',            desc: 'Primary body and headings',  light: 'neutral.900', dark: 'neutral.50'  },
      { name: 'text-muted',      desc: 'Secondary, captions, meta',  light: 'neutral.700', dark: 'neutral.300' },
      /* Disabled only. The description used to read "Placeholders, disabled",
         and that pairing was the whole defect: the two uses have different
         contrast requirements and no single step satisfies both.
         Measured at step 600 it fails AA on three of five light surfaces —
         bg 3.74, bg-subtle 2.93, surface-sunken 2.93 — and on dark
         surface-raised at 3.61, in all seven presets. Raising it to 700 clears
         every pair and lands on `text-muted` exactly, so the system would
         carry two names for one hex and disabled text would stop looking
         disabled. Lightening the surfaces instead puts surface-sunken onto
         `bg` at 1.00:1, which is the invisible-line bug in another place.
         Neither is the fix, because the paint was never wrong. Nothing in the
         matrix ever used this as a placeholder — only `input-disabled` and
         `tab-disabled` reference it, and 1.4.3 exempts both. Faint is the
         point: a disabled control should look disabled. A placeholder is
         readable content and takes `text-muted`, which clears AA on every
         surface in both modes. */
      { name: 'text-subtle',     desc: 'Disabled text and controls', light: 'neutral.600', dark: 'neutral.400' },
      { name: 'text-inverse',    desc: 'On strong-coloured fills',   light: 'neutral.50',  dark: 'neutral.950' },
    ],
  },
  {
    id: 'border', label: 'Borders', desc: 'Dividers, outlines, rings',
    roles: [
      /* Moved off 200/800 because dark `border-subtle` and dark
         `surface-raised` both resolved to neutral.800 — the same hex, 1.00:1,
         a divider inside a popover that cannot be seen at all. An agent
         building from this reported the line as unreadable and substituted
         `border` for every structural rule, which was the right call and had
         to be improvised because nothing here said it.
         A line token must never equal a surface it divides. Mirrored, so
         light 300 pairs with dark 700: surface-raised goes 1.00 to 1.38 in
         dark, and the faintest light case goes 1.28 to 1.67. Still subtle —
         `border` sits at 3.82 on a card — and now visible. */
      { name: 'border-subtle',   desc: 'Hairlines, table rules',     light: 'neutral.300', dark: 'neutral.700' },
      { name: 'border',          desc: 'Default control outline',    light: 'neutral.500', dark: 'neutral.500' },
      { name: 'border-strong',   desc: 'Emphasised outline',         light: 'neutral.600', dark: 'neutral.400' },
      { name: 'ring',            desc: 'Focus indicator',            light: 'accent.600',  dark: 'accent.400'  },
    ],
  },
  {
    id: 'accent', label: 'Accent', desc: 'Primary actions and active state',
    roles: [
      /* accent sits at 700 rather than 600 in light mode so it also clears AA
         as text, not just as a fill — it is routinely used for links.

         In dark the same role sits at 400 and measures 4.03:1 as text on
         `surface-raised`, so the light fix does not carry across. Mirroring it
         to 300 — which every other role pair here does, light 700 against dark
         300 — was tried and reverted: at 300 the ramp has shed enough chroma
         that accent and danger converge under red-green simulation, and the
         editorial and terminal presets both failed the separation check.
         Two accessibility requirements pull opposite ways and the palette
         cannot satisfy both at one step. Colourblind separation wins, because
         its failure has no remedy at the point of use and a low contrast ratio
         does: raise the size, or pick another role. The contrast sweep in the
         exported document names every surface where that applies. */
      { name: 'accent',          desc: 'Primary action fill',        light: 'accent.700',  dark: 'accent.400'  },
      { name: 'accent-hover',    desc: 'Hover state',                light: 'accent.800',  dark: 'accent.300'  },
      { name: 'accent-active',   desc: 'Pressed state',              light: 'accent.900',  dark: 'accent.200'  },
      /* ── A TINTED FILL RECEDES, IN BOTH MODES, BY THE SAME AMOUNT ──
       *
       * These four sat on step 900 in dark, and so did `surface`. A quiet fill
       * was therefore at EXACTLY its card's lightness, separated from it by hue
       * alone. A reader called the result solarized, and that is the right
       * word: a patch of colour with no luminance relationship to what
       * surrounds it reads as a stain rather than as a surface.
       *
       * Measured. In light each fill sits 0.04 of OKLCH lightness BELOW its
       * card, so it recedes. In dark it sat at +0.00. The midpoint between 900
       * and 950 puts it 0.04 below the card as well, which mirrors light
       * exactly, and the text on it goes from 4.6-4.9 to 5.1-5.5. */
      /* ── A DARK TINT MIXES INTO THE GROUND, AND THE FAULT IS CHROMA ──
       *
       * Every `*-subtle` took a step off its own meaning ramp in dark, which
       * puts a saturated patch on a near-neutral surface. They called it
       * solarized, twice, about two different components.
       *
       * Measured across all seven presets, worst case, against the dark card:
       *   before   absolute chroma 0.1544, lift -0.040
       *   after    absolute chroma 0.0373, lift -0.043
       *
       * THE LIGHTNESS WAS NEVER THE PROBLEM. The alert sat 0.038 below the
       * card, which is the conventional band, and its chroma was 1.9x the
       * ground's while danger ran to 3.7x. So the tint is mixed INTO the page
       * step: the result is mostly ground, so it stays in the ground's chroma
       * neighbourhood, and it keeps the downward step a band should have.
       *
       * LIFTING IT WAS THE FIRST ATTEMPT AND IT BROKE THE THIRD PAIR. Mixing
       * into `neutral.800` raised the tint by +0.111, and a lifted ground in
       * dark cannot carry a light meaning colour: the suite reported seven
       * failures per preset, every one being the meaning colour on its own
       * tint. No weight rescued it, because the best pair at any weight was
       * 3.19 against a 4.5 bar. A lifted tint in dark is a LIGHT surface and
       * needs dark text, which is not what an inline badge should be.
       *
       * At 0.1 on the page step the pair reads 4.97 and the band still
       * separates from the card at 1.11:1.
       *
       * LIGHT IS UNCHANGED and stays a step off the meaning ramp. Measured
       * there: lift -0.0473 at chroma 0.0799. At high lightness the eye takes
       * far more chroma before it reads as a stain, which is why one value
       * cannot serve both modes. */
      { name: 'accent-subtle',   desc: 'Tinted background',          light: 'accent.100',  dark: 'neutral.950~accent.500@0.1'  },
      /* ── A FILLED SHAPE, AND `accent-subtle` CANNOT DRAW ONE ──
       *
       * `accent-subtle` is a GROUND: text sits on it and the words carry the
       * contrast, so it is allowed to be quiet. A SHAPE has no words to carry
       * it. Its own fill is the whole signal, and under about 1.2:1 against
       * what is behind it the shape is absent rather than subtle.
       *
       * Measured on the shipped palette, `accent-subtle` against the card:
       * 1.13:1 in light and 1.11:1 in dark. So an avatar disc vanished in both
       * modes and only its initials floated. They saw it in a screenshot.
       *
       * NO ACCENT STEP FIXES IT, so the step was never the answer. Every role
       * in that palette was measured against the card and only neutrals
       * cleared 1.2 in both modes. An accent step near the middle carries the
       * ramp's full chroma, which is a solid button rather than a tint.
       *
       * So mix the accent INTO the raised surface. The result steps UP off the
       * card in both modes, which is the other half of the fault: a subtle
       * tint that steps down in dark reads as a hole. Measured across all
       * seven shipped presets at 0.3, worst case: 1.29 against the card in
       * light, 1.79 in dark, and 6.01 for text on it. 0.25 also clears, at
       * 1.22 in light, which leaves no margin for a seed we have not seen. */
      { name: 'accent-raised',   desc: 'Accent-tinted shape',        light: 'neutral.50~accent.500@0.3', dark: 'neutral.800~accent.500@0.3' },
      { name: 'accent-fg',       desc: 'Content on accent fill',     light: 'neutral.50',  dark: 'neutral.950' },
      /* A SELECTED row, and `accent-subtle` cannot do this job.
       *
       * `accent-subtle` is the background behind accent-coloured content — a
       * chip, a callout — and it is deliberately quiet: 1.26:1 against the
       * surface. Used to mark a selected row it fails, because a selection has
       * to be found by the eye rather than merely noticed once you are already
       * looking at it. Two uses, two different bars, so two roles.
       *
       * It is NEUTRAL, not the accent, and that is the correction they made on
       * sight: "omigod why baby blue for the selection". `accent.200` clears
       * every number — band 1.62, body 8.34, muted 4.56 — and is unbearable
       * across ten rows, because a saturated tint repeated down a table is
       * fatigue rather than information. Carbon reaches the same answer with
       * its `layer-selected`, which is grey. The accent still marks the
       * selection; it does it through the checkbox and a left edge, where it
       * appears once per row instead of filling it.
       *
       * `neutral.200` measures identically to the rejected blue — band 1.62,
       * body 8.38, muted 4.57 — and reads calm.
       *
       * DARK GOES THE OTHER WAY, and that is not a whim. The stripe steps
       * toward the page, which is DOWN in both modes; the selection steps
       * toward the reader, which is down on paper and UP in the dark. So light
       * runs 50 surface, 100 stripe, 200 selected — one direction — while dark
       * runs 900 surface, 950 stripe, 800 selected, diverging from the
       * surface. Diverging is what buys the separation: 1.63 between stripe
       * and selection, against 1.00 for the first arrangement I tried.
       * ONE STEP, not two. It sat at `neutral.200` and read heavy across ten
       * rows — their words, "not sure if i prefer the selected rows to be
       * darkened". It now takes the step the stripe used to hold, and the
       * stripe drops to the midpoint below it. So the two are one ramp step
       * apart instead of two, and the whole table lightens without losing the
       * separation: the selection still reads 1.27:1 against the surface and
       * about 1.14 against the stripe, with the edge and the box carrying the
       * rest. */
      /* THE DESCRIPTION NAMES THE GROUND, because this role resolves to the
         same hex as `bg` in both modes. That is deliberate and the plane check
         exempts the pair: a selected row sits on a CARD, where it is a step
         clear. Put that list straight on the page and the row is invisible at
         1.00:1. "Selected row or item" said nothing about where, so nothing
         warned the reader. */
      { name: 'selected',        desc: 'Selected row, on a card',    light: 'neutral.100', dark: 'neutral.950' },
    ],
  },
  {
    id: 'status', label: 'Status', desc: 'Feedback and validation',
    roles: [
      /* These stay at dark 400 while `accent` moves to 300, and the asymmetry
         is deliberate.
         Mirroring them to 300 for the same text-contrast reason was tried and
         reverted: at 300 the ramps have shed enough chroma that success and
         danger converge under red-green simulation, and six of the seven
         presets failed the separation check. A palette that fails colourblind
         separation is worse than one that fails AA as small text, because the
         second has a remedy at the point of use and the first does not.
         So the fill keeps its step, and the contrast sweep in the exported
         document reports every surface where the colour is too low for body
         text. The limit is stated rather than designed away. */
      { name: 'success',         desc: 'Success fill',               light: 'success.700', dark: 'success.400' },
      { name: 'success-subtle',  desc: 'Success background',         light: 'success.100', dark: 'neutral.950~success.500@0.1' } /* mixes into the ground, see accent-subtle */,
      { name: 'success-fg',      desc: 'Content on success fill',    light: 'neutral.50',  dark: 'neutral.950' },
      /* ── THE ONE ROLE THAT GIVES THIS PALETTE A VALUE STRUCTURE ──
       *
       * Every ramp shares one lightness ladder: `buildRamp` spaces all eleven
       * steps between `lightMin` and `lightMax` identically for each hue, so
       * `accent.400`, `success.400`, `warning.400` and `danger.400` are all at
       * L 0.66. Measured, the spread ACROSS ramps at any step is 0.00. Four
       * meaning colours at one brightness read as a flat screen, and as one
       * grey to a reader with reduced colour discrimination.
       *
       * A seed cannot fix it. A seed sets hue and chroma and the ramp discards
       * its lightness, which is why the shipped seeds span 3.7 points while
       * the roles they generate span 0.2. The STEP is the only lever.
       *
       * WARNING TAKES THE STEP IN BOTH MODES, and it is the only role that
       * can. `accent` and `danger` are FILLS — `button-primary` and
       * `button-danger` — so moving either paints a near-black button. Enumerated:
       * accent has eleven uses and danger seven, against three each for
       * success and warning, and neither of those three is a background.
       *
       * `success` was tried and rejected on measurement, not on taste. At 900
       * in light it collides with danger under deuteranopia, which is a worse
       * finding than the one it clears.
       *
       * The direction is whatever the mode's contrast floor allows, and the two
       * are opposite. In light every meaning role is TEXT on its own pale chip,
       * so it must stay dark: searched all 1331 combinations of the three, and
       * only 16 come back clean, every one of them by DARKENING. In dark the
       * same roles are text on a dark chip, so warning goes light and reads as
       * the amber a caution should be.
       *
       * Measured: light 0.2 to 15.4 points, dark 0.2 to 15.5, no failure and no
       * warning in either. Warning on its own chip reads 10.69:1 in light. */
      { name: 'warning',         desc: 'Warning fill',               light: 'warning.900', dark: 'warning.200' },
      { name: 'warning-subtle',  desc: 'Warning background',         light: 'warning.100', dark: 'neutral.950~warning.500@0.1' } /* mixes into the ground, see accent-subtle */,
      { name: 'warning-fg',      desc: 'Content on warning fill',    light: 'neutral.50',  dark: 'neutral.950' },
      { name: 'danger',          desc: 'Destructive fill',           light: 'danger.700',  dark: 'danger.400'  },
      /* Accent has had a hover role since the start; danger never did, so a
         destructive button's hover was defined as `danger` — the colour it
         already was — and the most consequential button in the app was the one
         that did not respond to the pointer. Steps the same direction accent
         does: darker on paper, lighter in the dark, because a hover has to
         move away from the page rather than always down. */
      { name: 'danger-hover',    desc: 'Destructive hover',          light: 'danger.800',  dark: 'danger.300'  },
      { name: 'danger-subtle',   desc: 'Destructive background',     light: 'danger.100',  dark: 'neutral.950~danger.500@0.1'  } /* mixes into the ground, see accent-subtle */,
      { name: 'danger-fg',       desc: 'Content on destructive fill',light: 'neutral.50',  dark: 'neutral.950' },
    ],
  },
]

export const ALL_ROLES = ROLE_GROUPS.flatMap(g => g.roles)

/* Pairs worth checking for contrast. `ui` marks non-text pairs held to the
   3:1 bar instead of 4.5. */
export const CONTRAST_PAIRS = [
  { fg: 'text',         bg: 'bg',             label: 'Body on page' },
  { fg: 'text',         bg: 'surface',        label: 'Body on card' },
  { fg: 'text',         bg: 'surface-raised', label: 'Body on popover' },
  { fg: 'text-muted',   bg: 'bg',             label: 'Muted on page' },
  { fg: 'text-muted',   bg: 'surface',        label: 'Muted on card' },
  { fg: 'text-muted',   bg: 'surface-raised', label: 'Muted on popover' },
  /* Was `text-subtle` on `surface`, and it passed at 4.74 — which is how the
     role's real problem stayed hidden. That one pair was the only surface
     `text-subtle` clears, so measuring it and nothing else reported the
     healthiest case in the set as though it covered the role. The placeholder
     colour is `text-muted` now, and `text-subtle` is disabled-only. */
  { fg: 'text-muted',   bg: 'surface-sunken', label: 'Placeholder in a well' },
  { fg: 'text-subtle',  bg: 'surface-sunken', label: 'Disabled text',  exempt: true },
  { fg: 'accent-fg',    bg: 'accent',         label: 'Label on primary button' },
  { fg: 'accent',       bg: 'bg',             label: 'Accent text on page' },
  /* A status colour used as a word, rather than as a fill, is deliberately
     absent from this list. Its ratio depends on a step the palette cannot move
     without breaking red-green separation, so the system does not guarantee
     it and a row here would read as a promise. The sweep below measures those
     combinations and reports the ones that fall short, which is the honest
     form: a stated limit rather than a guarantee that is sometimes false. */
  { fg: 'success-fg',   bg: 'success',        label: 'Label on success' },
  { fg: 'warning-fg',   bg: 'warning',        label: 'Label on warning' },
  { fg: 'danger-fg',    bg: 'danger',         label: 'Label on destructive' },
  { fg: 'border',       bg: 'surface',        label: 'Control outline',  ui: true },
  /* The same trap the `text-subtle` note above describes, caught a second time
     and in the same shape: `border` was measured on `surface` and nowhere
     else, and `surface` is its BEST case. It reads 3.82 there and 2.36 on a
     recessed band — a button sitting in a selection bar has an outline under
     the 3:1 floor, and nothing said so.
     No step fixes both. At neutral.600 the band still reads 2.93, and
     neutral.700 is a hairline heavy enough to change every control in the
     product. One role cannot serve two grounds at one bar.
     So the limit is stated rather than designed away, the way the disabled
     pair above is: measured, reported, exempt from the count, with the remedy
     at the point of use — a control on a recessed band steps its outline to
     `text-muted`, which reads 4.57 there. */
  { fg: 'border',       bg: 'bg-subtle',      label: 'Control outline on a band', ui: true, exempt: true },
  /* The two new grounds. A row is where body and muted text meet a fill that
     is neither the page nor the card, and neither had a pair. */
  { fg: 'text',         bg: 'selected',       label: 'Body on a selected row' },
  { fg: 'text-muted',   bg: 'selected',       label: 'Muted on a selected row' },
  { fg: 'text-muted',   bg: 'row-stripe',     label: 'Muted on a striped row' },
  { fg: 'ring',         bg: 'bg',             label: 'Focus ring',       ui: true },
]

/** Does this pair fail? The one place that answers it.
 *
 * The rule was written out at five call sites — two panels, the header chip,
 * the emitter and the suite — each spelling out `p.ui ? ratio < 3 : !pass`.
 * When `exempt` arrived for disabled text, three of the five learned about it
 * and two did not, so a clean document opened reporting "1 contrast" from a
 * pair the document itself grades "Exempt (1.4.3)".
 *
 * A rule copied five times is a rule that will disagree with itself. Every
 * caller asks this now.
 */
export function pairFails(pair, result) {
  if (pair.exempt) return false
  return pair.ui ? result.ratio < 3 : !result.pass
}

/* The curated list above is a guess about which combinations get built. The
   sweep below needs no guess: every role that carries words, against every
   role that sits behind them. It reports only what fails, so it costs nothing
   when the system is sound and names the exact pair when it is not. */
/* `text-subtle` is deliberately absent. It is the disabled-text role, and 1.4.3
   exempts text inside a disabled control — so sweeping it as body text produced
   four warnings that were correct against its old description and wrong against
   what it actually is. Removing it corrects the premise rather than silencing
   the check; the audit's `disabledCheck` covers that role with the right bar. */
export const TEXT_ROLES    = ['text', 'text-muted', 'accent', 'success', 'warning', 'danger']
export const SURFACE_ROLES = ['bg', 'bg-subtle', 'surface', 'surface-raised', 'surface-sunken']

const defaultRoles = () =>
  Object.fromEntries(ALL_ROLES.map(r => [r.name, { light: r.light, dark: r.dark }]))

/* ── Macro controls ──
   Five sliders that reshape hundreds of tokens at once. This is the answer to
   "granular without overwhelming": start here, reach for overrides only when
   a specific token genuinely needs to break the system. */
export const MACROS = [
  { key: 'scale',     label: 'Type scale', desc: 'Multiplies every font size',      min: 0.25, max: 2,    step: 0.01 },
  /* Bottoms out at 0 — every spacing step collapses to zero. Rarely what you
     want, but it is a legitimate end of the range. */
  { key: 'density',   label: 'Density',    desc: 'Multiplies every spacing step. 0 removes all spacing.', min: 0, max: 2, step: 0.01 },
  { key: 'roundness', label: 'Roundness',  desc: 'Multiplies every corner radius',  min: 0,    max: 4,    step: 0.01 },
  /* Not a pixel value: it scales a shadow's offset, blur *and* opacity
     together, so a percentage of the designed baseline is the honest unit. */
  { key: 'depth',     label: 'Depth',      desc: 'Shadow strength — scales offset, blur and opacity together. 100% is the designed baseline; 0% removes shadows entirely.', min: 0, max: 2, step: 0.01 },
  /* Bottoms out at 0, which zeroes every duration — a legitimate choice for a
     system that wants no motion at all, not just less of it. */
  /* Bottoms out at 0 (no motion at all) and tops out at 5×, which puts the
     `normal` duration at 1000ms — deliberately slow, but a valid choice. */
  { key: 'speed',     label: 'Motion',     desc: 'Multiplies every duration. 0 disables motion entirely; 5× puts `normal` at 1000ms.', min: 0, max: 5, step: 0.01 },
]

export const DEFAULT_MACROS = { scale: 1, density: 1, roundness: 1, depth: 1, speed: 1 }

export const PROSE_SECTIONS = [
  { k: 'overview',   heading: 'Overview',          label: 'Overview',          desc: 'Brand personality, audience, emotional tone' },
  { k: 'colors',     heading: 'Colors',            label: 'Colors',            desc: 'Colour philosophy, usage rules, meaning' },
  { k: 'typography', heading: 'Typography',        label: 'Typography',        desc: 'Font rationale and typographic hierarchy' },
  { k: 'layout',     heading: 'Layout',            label: 'Layout',            desc: 'Grid, spacing strategy, layout principles' },
  { k: 'elevation',  heading: 'Elevation & Depth', label: 'Elevation & Depth', desc: 'Shadow system, tonal layers, hierarchy' },
  { k: 'shapes',     heading: 'Shapes',            label: 'Shapes',            desc: 'Corner radii, geometry, shape language' },
  { k: 'components', heading: 'Components',        label: 'Components',        desc: 'Component-level decisions and guidelines' },
  { k: 'dosDonts',   heading: "Do's and Don'ts",   label: "Do's and Don'ts",   desc: 'Explicit anti-patterns and guardrails' },
]

const emptyProse = () => Object.fromEntries(PROSE_SECTIONS.map(s => [s.k, '']))

/* ── Scales ──
   Stored as multipliers against a base so the whole scale moves together.
   `full` is a sentinel pill radius, never scaled. */
export const SPACE_STEPS = [
  { name: '3xs', mult: 0.5 }, { name: '2xs', mult: 1 }, { name: 'xs', mult: 2 },
  { name: 'sm', mult: 3 }, { name: 'md', mult: 4 }, { name: 'lg', mult: 6 },
  { name: 'xl', mult: 8 }, { name: '2xl', mult: 12 }, { name: '3xl', mult: 16 },
  { name: '4xl', mult: 24 },
]

export const RADIUS_STEPS = [
  { name: 'none', mult: 0 }, { name: 'sm', mult: 0.5 }, { name: 'md', mult: 1 },
  { name: 'lg', mult: 2 }, { name: 'xl', mult: 3 }, { name: 'full', pill: true },
]

export const ICON_LIBRARIES = ['Lucide', 'Heroicons', 'Phosphor', 'Material Symbols', 'Radix Icons']

/* ── Anti-patterns ──
   Negative constraints are the instructions models follow most reliably, so
   these ship as a checklist rather than being left to freeform prose. */
export const ANTI_PATTERNS = [
  { id: 'pure-black', text: 'Never use pure black (#000) or pure white (#fff) — use the neutral scale.', on: true },
  { id: 'extra-colors', text: 'Never introduce a colour that is not defined in this file.', on: true },
  { id: 'extra-fonts', text: 'Never introduce a third typeface family.', on: true },
  { id: 'arbitrary-spacing', text: 'Never use spacing values outside the defined scale.', on: true },
  { id: 'gradient-text', text: 'No gradients on text.', on: false },
  { id: 'centered-body', text: 'No centred body copy longer than two lines.', on: true },
  { id: 'shadow-flat', text: 'No shadows on flat surfaces — separate them with borders instead.', on: false },
  { id: 'animate-layout', text: 'Never animate layout properties; transform and opacity only.', on: true },
  { id: 'placeholder-label', text: 'Never use a placeholder as a substitute for a label.', on: true },
  { id: 'color-only', text: 'Never convey meaning through colour alone.', on: true },
  { id: 'tiny-text', text: 'No text below 12px.', on: true },
  { id: 'emoji-icons', text: 'No emoji in place of icons.', on: false },
  /* Alignment. Generated UI centres everything by reflex, which is right for a
     block and wrong for a line, and the difference is what makes a row look
     hand-made or not. Stated as constraints because that is the form the file's
     own reasoning says models act on. */
  { id: 'baseline-line', text: 'Never centre two different text sizes independently on one line — give them one shared baseline.', on: true },
  { id: 'baseline-block', text: 'Never pin an item to the first line of a multi-line block, unless it belongs to that block\'s title. Centre it on the block.', on: true },
  { id: 'control-height', text: 'Never let a button beside a field differ in height from that field.', on: true },
  { id: 'icon-baseline', text: 'Never let an icon decide a button\'s baseline. The label decides it.', on: true },
  { id: 'baseline-in-fixed-box', text: 'Never baseline-align the contents of a fixed-height control. Centre them — baseline pins the label to the top of the box.', on: true },
  /* ── TWO WAYS TO WRITE A RULE THAT CAN NEVER TAKE EFFECT ──
   *
   * Both were found in a generated dashboard, both were silent, and each one
   * broke a control completely. An inline `style="opacity:0"` outranked the
   * stylesheet rule meant to switch it, so a select-all box rendered as a
   * solid block with no mark. And a component padding token already carries
   * two values, so putting it in a shorthand beside another value expanded to
   * three and a bar came out 8px on top against 12px underneath. */
  { id: 'inline-state', text: 'Never put a state in an inline style. An inline style outranks every rule in your stylesheet, so the rule meant to switch it can never reach it.', on: true },
  { id: 'token-in-shorthand', text: 'Never put a component padding or margin token inside a shorthand beside another value. Those tokens already carry two values, so the shorthand expands to three and reads them as separate edges.', on: true },
]

export const FRAMEWORKS = ['React + Tailwind', 'React + CSS variables', 'Plain HTML + CSS', 'Vue + Tailwind', 'Svelte', 'Unspecified']

/* ── Reading `color.theme` ──
 *
 * Three questions get asked of it, and each one gets a function rather than a
 * second stored field. A document saved before this existed carries
 * `emitDark` instead, so the fallback reads that: an old file must open.
 */
export const themeOf = state =>
  state?.color?.theme ?? (state?.color?.emitDark === false ? 'light' : 'both')
/** Does a dark set of values exist at all? */
export const hasDark = state => themeOf(state) !== 'light'
/** Does a light set exist? False only when the site is dark and nothing else. */
export const hasLight = state => themeOf(state) !== 'dark'
/** Can the reader switch? Only when the site actually has two themes. */
export const hasThemeToggle = state => themeOf(state) === 'both'

/* ── Default document ──
   A warm editorial system, deliberately opinionated. Nobody should ever face
   a blank canvas here; tuning something coherent beats assembling from zero. */
/* Component overrides a new document starts with.
 *
 * The library's own defaults are what a component "naturally" is; these four
 * are decisions about this system specifically, carried over from the payload
 * the defaults were authored in.
 *
 * The switch height is not cosmetic. A 20px switch is a finding the audit
 * raises on an untouched document, and shipping a default that fails your own
 * checker teaches people to ignore it. 24px is exactly 2.5.8's minimum.
 *
 * The checkbox used to be forced to 24px for the same reason, and that was the
 * wrong answer to the right worry. **A checkbox is drawn at 16px and hit at the
 * label**, which is what everyone actually builds and what 2.5.8's spacing
 * exception is for. This document declares a 44px minimum target, so the audit
 * already reports the 16px box as a warning that says exactly that — keep the
 * hit area at 44, with padding on the label rather than a bigger box. Forcing
 * the drawn size to 24 silenced a warning by making the control wrong.
 *
 * A fresh copy per call — a shared object literal would let one document's
 * edits leak into the next New. */
const defaultComponentOverrides = () => ({
  /* Was `{colors.danger}`, which made every ghost button red — a stray from a
     click-test that came back in the next payload corrected. Then it was
     `{colors.ring}`, which is a category error: `ring` is the focus indicator,
     and a focus indicator only owes 3:1 as a non-text mark. Borrowed as a text
     colour it measured 3.95:1 against the page in five presets, under the 4.5
     that text owes. A ghost button's label is the accent. */
  'button-ghost.textColor': '{colors.accent}',
  'switch.height': '24px',
  /* `badge-neutral.backgroundColor: {colors.bg}` used to sit here, with no
     comment saying why — and it painted the chip the page colour. On any
     surface drawn in `bg` the chip vanished: measured `#d6ddde` on `#d6ddde`,
     leaving a word with padding and no chip at all.
     The library already says `{colors.bg-subtle}`, which is one step off the
     page and reads as a chip. A fill has to differ from what is behind it,
     which is the same rule that caught `border-subtle` sitting on
     `surface-raised` at 1.00:1. Removed rather than replaced. */
})

/* Cap on the project name.
 *
 *  on the input stops typing but not every paste, and an imported
 * file never passes through the input at all — so both the editor field and
 * the parser slice to this. 255 because it is the longest a name can be while
 * still being a name.
 */
export const NAME_MAX = 255

export const createInitialState = () => ({
  schemaVersion: SCHEMA_VERSION,
  /* No version until the first export. `version` is a build number stamped by
     exporting — see state/build.js — so a document that has produced no file
     has nothing to name. */
  meta: { name: 'My Design System', description: '', version: '' },
  macros: { ...DEFAULT_MACROS },

  color: {
  /* ── The default seeds ──
     Chosen against the accessibility audit rather than by eye alone, because
     the previous set failed WCAG 1.4.1 six times over and nothing in the app
     was saying so.

     The structural problem: every status role sits on the same ramp step, so
     they all share a lightness by construction. Red-green colour blindness
     collapses hue, and once hue is gone, three colours of identical lightness
     are one colour. A conventional green/amber/red trio cannot survive that —
     which is exactly why 1.4.1 exists.

     So success is a teal rather than a green. It keeps blue content, which is
     the channel deuteranopia and protanopia leave intact, and it stays clearly
     separate from both the amber and the red under simulation. Accent is an
     indigo, far enough from the teal to never be confused with it. The result
     passes every colour-alone check and every contrast pair in both modes.

     The second pass was about whether anyone would want to look at it. The
     first set passed every check and was joyless: a cold grey page, a muted
     indigo, nothing above 0.11 chroma anywhere. Passing an audit is a floor,
     not a design, and a first launch that looks like a wireframe is its own
     kind of failure.

     This set came out of the palette generator and is kept for its own sake:
     a petrol accent against a cool grey-green neutral. Accent, neutral and
     warning are exactly as generated.

     Success and danger are not. As generated they were a leaf green and a
     rust, and a green cannot survive beside an amber and a rust. Red-green
     blindness removes the hue; every status role reads the same ramp step so
     they already share a lightness; and all three then collapse into one
     olive. A sweep of the space confirms no green works here, whatever its
     lightness — the hue has to carry blue, so success is a teal. Danger keeps
     its hue family and gains chroma, which suits a destructive colour anyway.

     It grated. The accent WAS a petrol teal, and it and success measured
     1.01:1 apart with eleven degrees of hue between them — the same colour by
     every practical test, so a filled button and a "paid" mark said nothing
     different. Contrast could never have caught it: a ratio measures lightness,
     and two roles one step apart on the ramp always read about 1:1 whatever
     their hue. `meaningCollision` in the audit compares OKLCH hue instead.

     Success is the constrained role and cannot move. Every green candidate
     tried — #1c7a42, #127a3a, #2e7d32, #0f7b45, #1f7a4d — produced four audit
     failures, because a green collides with danger under deuteranopia. That is
     the whole reason success is a teal.

     So the accent moved, to a blue they specified in HSB: hue 208, saturation
     88, brightness 75. Brightness is the fine-tuning axis and 75 is the bottom
     of the range they gave, because the derivation darkens the accent until it
     clears its contrast requirement and a brighter seed comes out MORE
     saturated: 89% rendered at 75, against 98% at 80 and 100% at 82. 75 lands
     the rendered accent at 208/89/55, which is the colour they asked for.

     Measured after: 60° from success in light, 61° in dark, accent on bg
     5.84:1, accent-fg on accent 7.40:1, zero failures and zero warnings.

     Change these freely — the audit in the Access tab will tell you what it
     costs. */
    seeds: [
      { id: 'sd-accent',  name: 'accent',  hex: '#1771bf', desc: 'Primary action and emphasis' },
      { id: 'sd-neutral', name: 'neutral', hex: '#606f7e', desc: 'Surfaces, text, borders' },
      { id: 'sd-success', name: 'success', hex: '#007974', desc: 'Confirmation' },
      { id: 'sd-warning', name: 'warning', hex: '#966b00', desc: 'Caution' },
      { id: 'sd-danger',  name: 'danger',  hex: '#c13e2e', desc: 'Destructive and errors' },
    ],
    shape: { ...DEFAULT_SHAPE },
    roles: defaultRoles(),
    stepOverrides: {},
    roleOverrides: {},
    custom: [],
    /* Gradients can't live in the spec's `colors` map — that expects CSS
       colour values, and a gradient is an image. They're emitted as a table in
       the Colors section instead, and exposed to the preview as CSS vars. */
    gradients: [],
    mode: 'light',
    emitRamps: true,
    /* ── WHICH THEMES THE SITE HAS. One decision, one field. ──
     *
     * This used to be two: `color.emitDark` in Roles decided whether dark
     * tokens existed, and `build.themeToggle` under Meta decided whether the
     * page could switch. Nothing stopped them disagreeing, and the pair could
     * not say "dark only" at all — light was always emitted.
     *
     *   light   only a light theme. No dark block, no toggle.
     *   dark    only a dark theme. Dark values sit on :root itself.
     *   both    both themes, and the page carries a visible toggle.
     *
     * `emitDark` is derived from this and kept as a read-only convenience for
     * the six places that already ask the question that way. */
    theme: 'both',
  },

  type: {
    families: {
      display: { family: 'Space Grotesk', category: 'sans-serif' },
      body:    { family: 'Manrope', category: 'sans-serif' },
      mono:    { family: 'JetBrains Mono', category: 'monospace' },
    },
    /* ── TABULAR FIGURES, AND ONLY WHERE THEY EARN IT ──
     *
     * Tabular digits are all one width, so a column of them lines up between
     * rows. That is the whole reason to use them, and it is also the whole
     * limit: outside a column there is nothing to line up with, and the even
     * spacing reads as a monospaced slab in the middle of a sentence. A figure
     * inside an info card, a stat tile or a paragraph takes the body face's own
     * proportional digits.
     *
     * On by default, because every product has tables and the fault it prevents
     * — a column of money that does not align — is visible at a glance. */
    numerals: 'tabular-in-tables',   // tabular-in-tables | proportional
    /* ── WHAT A LONG HEADING DOES ──
     *
     * `wrap` takes the lines it needs and keeps every word. `truncate` holds one
     * line and ends in an ellipsis. Nothing in this system stated either, so
     * every generated page got whatever the browser happened to do. */
    headingWrap: 'wrap',             // wrap | truncate
    /* ── WHERE THE CONTROLS BESIDE A WRAPPED HEADING SIT ──
     *
     * Only asked when the heading wraps. A truncated heading is one line, so all
     * three answers land in the same place.
     *
     * `last` is the default, set 16 August 2026. It replaces a hard-wired rule
     * that pinned them to the FIRST line, which was right for the case it was
     * measured on and was never a choice the reader could make.
     *
     * Each value is one formula against the tokens, so a type-scale change
     * carries and no number is typed:
     *
     *   first    flex-start, margin-top:    (line − control) / 2
     *   center   the block's own centre, no margin
     *   last     flex-end,   margin-bottom: (line − control) / 2
     *
     * One line makes all three identical, which is why a short title hides a
     * wrong answer here. */
    headingAlign: 'last',            // first | center | last
    base: 16,
    ratio: 1.25,
    leading: 1,     // multiplier on the auto line-height curve
    tracking: 1,    // multiplier on the auto tracking curve
    measure: 68,    // max line length, ch
    fluid: { enabled: false, minVw: 360, maxVw: 1280, minRatio: 1.15, minScale: 0.9 },
    axes: { display: {}, body: {}, mono: {} },
    features: { display: [], body: ['liga'], mono: ['liga', 'zero'] },
    overrides: {},
    custom: [],
  },

  space: { base: 4, steps: SPACE_STEPS.map(s => ({ ...s })), overrides: {} },
  radius: { base: 8, steps: RADIUS_STEPS.map(s => ({ ...s })), overrides: {}, nesting: true, borderWidths: { hairline: 1, thick: 2 } },

  layout: {
    /* `xs` at 320 is not one of Tailwind's five, and it is here deliberately.
       1.4.10 requires the layout to survive a 320px viewport — which is a
       1280px window at 400% zoom, not a phone — and a scale starting at 640
       never names that width. An agent reading it has no rule for the
       narrowest case and will invent one. Naming the floor costs a line and
       removes the question. */
    breakpoints: [
      { name: 'xs', px: 320 }, { name: 'sm', px: 640 }, { name: 'md', px: 768 },
      { name: 'lg', px: 1024 }, { name: 'xl', px: 1280 }, { name: '2xl', px: 1536 },
    ],
    /* 288 = 320 minus 16px of gutter each side. */
    containers: { xs: 288, sm: 600, md: 720, lg: 960, xl: 1140, '2xl': 1320 },
    columns: 12,
    gutter: 'lg',
    maxMeasure: 68,
    /* Widths that live outside the spacing scale, because none of them is
       spacing. Without them every page invents its own — the simulated
       dashboard reached for 216px and 320px, both off any scale in the file,
       which is the agent guessing where the system went quiet. Naming them
       does not freeze them: the exported file says they are starting points.

       A field needs three steps, not one. With a single `field: 320` an agent
       building a search box into a title bar had nothing narrower to reach
       for. It obeyed the rule it was given — change the token, never one
       page — and reported the mismatch instead of fixing it, which was
       correct and left the bar wrong. The system said "take a different step"
       and published no other step. Three widths is a scale it can obey. */
    fixedWidths: { rail: 224, 'field-sm': 200, field: 320, 'field-lg': 480 },
  },

  elevation: {
    strategy: 'shadow',      // shadow | border | tonal
    tintRole: 'neutral.950',
    tintStrength: 1,
    darkStrategy: 'lighten', // dark mode raises surfaces instead of deepening shadows
    /* Blend mode for shadow and scrim layers. CSS box-shadow can't take one,
       so this governs scrims/overlays and is emitted as guidance for anything
       composited — see the Elevation section of the output. */
    blendMode: 'normal',
    /* Fills can blend with what sits behind them via mix-blend-mode. Borders
       cannot — CSS has no border-blend-mode — so there is no control for it. */
    fillBlend: 'normal',
    scrim: { color: 'neutral.950', opacity: 0.55, blur: 0 },
  },

  motion: {
    personality: 'smooth',   // snappy | smooth | bouncy
    durations: { instant: 0, fast: 125, normal: 250, slow: 500 },
    easings: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      entrance: 'cubic-bezier(0, 0, 0, 1)',
      exit:     'cubic-bezier(0.3, 0, 1, 1)',
      emphasis: 'cubic-bezier(0.3, 0, 0, 1.2)',
    },
    reducedMotion: 'crossfade', // crossfade | none
  },

  /* `gap` is the space between an icon and its label — in buttons, menu items,
     list rows, anywhere the two pair up. It is one decision, not a per-
     component one, so it lives with the icons. */
  icons: { library: 'Lucide', strokeWidth: 1, sizes: { sm: 14, md: 16, lg: 20, xl: 24 }, joinStyle: 'round', gap: 'xs' },

  focus: { width: 2, offset: 2, style: 'solid', role: 'ring' },

  states: { disabledOpacity: 0.5, touchTarget: 44, transitionOn: ['background-color', 'border-color', 'color', 'opacity', 'transform'] },

  /* `custom` holds components that came from an imported file or an older
     document — names the library knows nothing about, emitted verbatim. */
  /* `layout` holds composition rules — icon placement, alignment, action
     arrangement — that have no slot in the spec's eight component properties
     and are emitted as guidance instead. Absent in older documents; readers go
     through `resolveAllLayouts`, which fills the defaults. */
  /* `tabStyle` picks which treatment marks a selected tab. See TAB_STYLES:
     `underline` for a strip that sits on a rule, `pill` for one that floats. */
  /* `selection` picks which channel marks a selected row, and `selectionEdge`
     the bar's weight where the treatment draws one. Both live here rather
     than under `color`, because they are component STATE definitions exactly
     like `tabStyle` is. Their control sits in the Colour panel, next to the
     seed the ground tint moves, which is a question about where a person
     looks rather than about what the value is. See SELECTION_STYLES. */
  components: { enabled: {}, overrides: defaultComponentOverrides(), custom: [], emitStates: true, emitSizes: true, layout: {}, tabStyle: DEFAULT_TAB_STYLE, selection: DEFAULT_SELECTION_STYLE, selectionEdge: DEFAULT_SELECTION_EDGE },

  voice: {
    /* The single source of truth for label capitalisation.
       Build Preferences under Meta/Global edits this same value. A second
       field lived there briefly and the document then carried both rules —
       "Title Case for every UI label" in one section and "Sentence case for
       all UI text" in another, in one file, with no precedence between them.
       Two agents found it independently and each had to pick. Two controls
       for one decision is the defect; rewording either one only hides it. */
    casing: 'title',           // sentence | title
    buttonStyle: 'verb-first', // verb-first | noun
    errorTone: 'plain',        // plain | apologetic | terse
    emptyTone: 'helpful',
    dateFormat: 'D MMM YYYY',
    numberFormat: '1,234.56',
    currency: 'GBP',
  },

  directives: {
    references: [],
    antiPatterns: ANTI_PATTERNS.map(a => ({ ...a })),
    framework: 'React + Tailwind',
    classNaming: 'utility',
    notes: '',
  },

  /* Build preferences — decisions about the page an agent produces, rather
     than about the system it produces it from.
     Capitalisation is deliberately NOT here. It lives in `voice.casing`,
     because it is one decision and one decision gets one field. The Build
     Preferences panel edits that value directly. */
  build: {
    themeToggle: true,
  },

  prose: emptyProse(),
})

export { uid, emptyProse, defaultRoles }
