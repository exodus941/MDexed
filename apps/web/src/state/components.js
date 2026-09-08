/* The component set, as defaults rather than as stored data.

   Only what the designer changes is persisted; everything here is expanded at
   derive time. Emission follows the spec's flattening convention — a variant
   becomes `button-primary`, a state becomes `button-primary-hover`, a size
   becomes `button-sm`.

   Properties outside the spec's legal eight (borderColor, gap, boxShadow …)
   are included deliberately. They can't go in the frontmatter, but they do
   reach the file as prose, and an agent building a button needs them. */

/* THE FRAME IS TWO SETS, NOT ONE, BECAUSE FOUR TYPES HAVE NO AXIS.
 *
 * The first version spread one frame into all twelve. A pie has no value axis
 * and no gridlines, so `--cmp-chart-pie-axis-color` would have been published
 * and unreadable by any rule. That is the fault this whole section exists to
 * close, reproduced while closing it: a token nothing can consume.
 *
 * So the labels are shared and the axes are not.
 *
 *   WITH AXES     column, bar, line, area, combo, stacked, grouped, scatter
 *   WITHOUT       pie, donut, heatmap, sparkline
 *
 * A heatmap has category labels on two edges and no quantity axis at all: its
 * separation is the cell gap. A sparkline has no furniture by definition. */
const CHART_LABELS = {
  /* NO `padding`. THE CONTAINER OWNS THE INSET, and publishing one here made
     every plot doubly inset: 24px of card padding plus 16px of its own put
     the plot 17px inside the card's content edge, on all twenty instances.
     A chart's edges sit flush with the inner margins of whatever holds it,
     the same way a table's do. The room the tick labels need is the frame's
     own tick COLUMN, which is content rather than padding. */
  typography: 'caption',
  textColor: '{colors.text-muted}',
}

/* `border` for the axis and `border-subtle` for the gridlines, one step apart
 * and the right way round: an axis is the chart's own outline and a gridline
 * is quieter than it. A gridline in the axis colour turns a plot into a grid
 * of boxes, which is the usual way a calm chart turns noisy.
 *
 * THE GRIDLINES BELONG TO THE VALUE AXIS ALONE. A category axis has no
 * quantity to read against, so a line there separates nothing. That is an
 * arrangement rather than a value, so it lives in `LAYOUT_COMPONENTS`. */
const CHART_AXES = {
  axisColor: '{colors.border}',
  axisWidth: '{borderWidths.hairline}',
  /* THE QUIETEST PUBLISHED STEP THAT STILL CLEARS THE FLOOR. `border-subtle`
     measured 1.94:1 on the card and read as heavy for a gridline, which has
     to sit under the data rather than beside it. `bg-subtle` is 1.48:1.
     `bg` is 1.15 and a hairline under 1.2 is absent, not subtle.

     A SURFACE ROLE FOR A LINE, deliberately. There is no lighter LINE role,
     and a ramp cannot gain a step. The alternative was a new role serving
     one consumer. The axis keeps `border`, so the axis is still heavier
     than any gridline, which is the whole point of the pair. */
  gridColor: '{colors.bg-subtle}',
  gridWidth: '{borderWidths.hairline}',
}

const CHART_FRAME = { ...CHART_LABELS, ...CHART_AXES }

/* A filled series takes a hairline in the page's own border colour, which
   `color/dataviz.js` already states in prose and nothing published. The gap
   between two areas is enough separation; the gap between two touching
   segments is not. */
const FILLED = { borderColor: '{colors.border-subtle}' }

/* One stroke weight for every line in every chart type, the same way one mark
   size serves every button size. A per-type stroke means every rule that
   resizes a chart has to remember to restyle its line, and the button history
   in this file says three of them will not. `thick` is 2px, which reads
   heavier than the 1.5px icon stroke it must not be confused with. */
const STROKE = { lineWidth: '{borderWidths.thick}' }

/* 8px, on the scale. 4px where the points are dense enough to overlap, which
   is scatter and nothing else. */
const MARKER = { markerSize: '{spacing.xs}' }

const CHART_TYPES = [
  {
    name: 'chart-column', label: 'Column chart', group: 'Charts', on: true,
    /* A single-series column chart takes ONE colour, never five. Five colours
       on one series says the categories are five different things, and a
       category axis already said they are one thing measured six times. */
    base: { ...CHART_FRAME, ...FILLED, rounded: '{rounded.sm}', barGap: '{spacing.xs}' },
  },
  {
    name: 'chart-bar', label: 'Bar chart (horizontal)', group: 'Charts', on: true,
    /* THE ONE TYPE WHOSE CATEGORY LABEL HAS ROOM TO BE LONG, which is the
       reason to reach for it. So the label column takes its content and the
       bar shrinks, never the reverse: a bar clipped to fit a name is a value
       nobody can read. */
    base: { ...CHART_FRAME, ...FILLED, rounded: '{rounded.sm}', barGap: '{spacing.xs}' },
  },
  {
    name: 'chart-line', label: 'Line chart', group: 'Charts', on: true,
    base: { ...CHART_FRAME, ...STROKE, ...MARKER },
  },
  {
    name: 'chart-area', label: 'Area chart', group: 'Charts', on: true,
    /* THE ONE VALUE IN THIS WHOLE SET WITH NO HOME ANYWHERE, so it is stated
       here and nowhere else. 0.2 of the series colour keeps the line dominant
       and still clears the ground: a fill must differ from what is behind it,
       and an area at 0.5 competes with its own line while one at 0.05 is
       absent rather than subtle. An opacity belongs to no scale, which is
       exactly why it needs a published home. */
    base: { ...CHART_FRAME, ...STROKE, fillOpacity: '0.2' },
  },
  {
    name: 'chart-pie', label: 'Pie chart', group: 'Charts', on: true,
    /* NO GRIDLINES BEHIND A PIE, EVER. There is no value axis to read
       against, so a gridline there is decoration on top of data. Which is why
       it takes the LABELS and not the frame: publishing an axis colour a pie
       can never paint is the unread-token fault, and turning the grid off with
       an arrangement field would leave the token published anyway. */
    base: { ...CHART_LABELS, sliceGap: '{borderWidths.thick}', sliceGapColor: '{colors.surface}' },
  },
  {
    name: 'chart-donut', label: 'Donut chart', group: 'Charts', on: true,
    /* A PIE WHOSE HOLE CARRIES A TOTAL, which is a different label problem
       and the only reason it earns its own entry. `holeRatio` is a proportion
       rather than a length, so no scale applies. 0.58 leaves a ring wide
       enough to read a slice and a hole wide enough to hold a figure. */
    base: { ...CHART_LABELS, sliceGap: '{borderWidths.thick}', sliceGapColor: '{colors.surface}', holeRatio: '0.58' },
  },
  {
    name: 'chart-combo', label: 'Column + line', group: 'Charts', on: true,
    /* THE ONLY TYPE THAT NEEDS A SECOND VALUE AXIS, and the only one where two
       series measure different quantities. Both axes take the same weight, or
       the chart reads as though one of the two series matters less. */
    base: { ...CHART_FRAME, ...FILLED, ...STROKE, ...MARKER, rounded: '{rounded.sm}', barGap: '{spacing.xs}' },
  },
  {
    name: 'chart-stacked', label: 'Stacked (column, bar, area)', group: 'Charts', on: true,
    /* AN ARRANGEMENT, NOT A TYPE, and it applies to three of them. It earns an
       entry because its segments TOUCH, which is the case the chart palette is
       built around: every pair is separated, not only the pairs that sit side
       by side in a legend. No bar gap of its own, because the gap between
       stacks is the column chart's and the gap inside a stack is zero. */
    base: { ...CHART_FRAME, ...FILLED, rounded: '{rounded.sm}', barGap: '{spacing.xs}' },
  },
  {
    name: 'chart-grouped', label: 'Grouped (column, bar)', group: 'Charts', on: true,
    /* THE OTHER ARRANGEMENT, AND THE ONE THAT STATES A PROXIMITY RATIO. 4px
       inside a group against 16px between them is 4:1, so a group reads as one
       object without anybody having to think about it. Under 3:1 the groups
       dissolve into one run of bars and the category axis stops meaning
       anything. Both numbers are stated together, because a ratio is not a
       value. */
    base: { ...CHART_FRAME, ...FILLED, rounded: '{rounded.sm}', barGap: '{spacing.2xs}', groupGap: '{spacing.md}' },
  },
  {
    name: 'chart-scatter', label: 'Scatter plot', group: 'Charts', on: true,
    /* THE ONLY TYPE WHERE THE MARKER IS THE MARK rather than an ornament on a
       line, which is why it publishes a second, smaller size. A dense cloud at
       8px is a solid shape; at 4px it is a distribution. Both are on the
       scale. */
    base: { ...CHART_FRAME, ...MARKER, markerSizeDense: '{spacing.2xs}' },
  },
  {
    name: 'chart-heatmap', label: 'Heatmap', group: 'Charts', on: true,
    /* THE ONLY NATURAL CONSUMER OF `--chart-seq-1..8`. That scale has shipped
       for as long as the palette has and nothing has ever painted it, so it
       was published and untrustable in exactly the way this file warns about.
       A hairline gap in the ground colour, not a border: a border on every
       cell doubles at each shared edge and the grid reads twice as heavy as
       it should. */
    base: { ...CHART_LABELS, rounded: '{rounded.sm}', cellGap: '{borderWidths.hairline}', cellGapColor: '{colors.surface}' },
  },
  {
    name: 'chart-sparkline', label: 'Sparkline', group: 'Charts', on: true,
    /* THE NO-FURNITURE CASE, and the reason it earns an entry. No axis, no
       gridline, no legend and no tick label, because it lives inside a table
       row or a stat tile where the row already says what it is. It still takes
       the shared stroke: one weight for every line in the system, so a
       sparkline and a full line chart cannot read as two different products.
       It carries no `padding` either — the cell it sits in owns that. */
    base: { ...STROKE, ...MARKER, textColor: '{colors.text-muted}', typography: 'caption' },
  },
]

export const COMPONENT_LIBRARY = [
  {
    name: 'button', label: 'Button', group: 'Actions', on: true,
    /* THE MARK IS ONE SIZE AT EVERY BUTTON SIZE, and it is 14px. It used to
       track the label per size, which is why three separate rules resized a
       button and left the mark behind. The alignment rule in preview.css
       centres the mark on the label's cap band at whatever size it is, so the
       step has no reason to follow the type any more. */
    /* The plain `.btn` IS the md size — there is no `.btn-md` class — so it takes
       its type from HERE and not from `sizes.md`. Changing only the size entry
       left every default button at 16px beside a 14px icon, on 233 rows. The
       label size and the icon size are one decision, so they move together. */
        /* ONE MARK SIZE FOR EVERY BUTTON, and it is the small step. The alignment
       rule centres the mark on the label's cap band at whatever size it is, so
       the step no longer has to track the label. Their number: 14. */
    base: { rounded: '{rounded.md}', typography: 'button', gap: '{spacing.xs}', iconSize: '{icons.sm}' },
    variants: {
      /* backgroundImage takes a `{gradient.name}` reference. It sits above the
         fill colour when set, and is dropped from the output when 'none'. */
      primary:   { backgroundColor: '{colors.accent}',  textColor: '{colors.accent-fg}',  borderColor: 'transparent', backgroundImage: 'none' },
      secondary: { backgroundColor: '{colors.surface}', textColor: '{colors.text}',       borderColor: '{colors.border}' },
      ghost:     { backgroundColor: 'transparent',      textColor: '{colors.text-muted}', borderColor: 'transparent' },
      danger:    { backgroundColor: '{colors.danger}',  textColor: '{colors.danger-fg}',  borderColor: 'transparent' },
      /* Destructive, but not the thing the screen is for. "Delete" in a row of
         list actions should not carry the same weight as "Delete" at the foot
         of a confirmation — one is available, the other is being asked for.
         Filled danger is the second; this is the first.
         *
         Nothing special about it as far as the spec goes: it flattens to
         `button-danger-ghost` like any other variant and its colours are two
         of the eight legal properties. */
      'danger-ghost': { backgroundColor: 'transparent', textColor: '{colors.danger}', borderColor: 'transparent' },
    },
    /* Each size carries its own gap. A 28px button wants less space between
       icon and label than a 44px one; the icon-gap token is the default, and
       these override it per size. */
    /* NO `iconSize` PER SIZE, because the mark is one size at every button
       size and the base above states it.

       These three carried `{icons.sm}`, `{icons.md}` and `{icons.lg}`, so the
       payload published 14px, 16px and 20px for a mark that renders at 14
       everywhere. preview.css reads `--cmp-button-icon-size` for all three
       classes and nothing in this codebase reads the per-size tokens at all,
       so the app was right and the tokens beside it were teaching a reader to
       build three sizes. Absent, only the base token is emitted, and the file
       then says structurally what the rule says in prose. */
    /* THE WEIGHT IS A BUTTON DECISION AND DOES NOT FOLLOW THE SIZE STEP.
       Each size takes its own type role for the SIZE, and those roles carry
       their own weights: caption 400, button 500, body-md 400. Taken as given
       that shipped 400, 500, 400, so only the middle button was set in medium
       and no rule said why. Restating the weight after the role is what makes
       the three read as one control at three sizes. */
    /* ── NO GAP PER SIZE. THE MARK GAP IS ONE VALUE ──

       These read 2, 4 and 8px against the 8 the mark gap publishes, and
       the preview paints 8 for all three. It is the per-size mark pattern
       this system already rejected for the mark SIZE, and for the same
       reason: every rule that resizes a button then has to remember to
       resize its gap.

       The small end was worse than untidy. 2px put a mark against its
       own word, and the legend-dot rule calls that out at 4.

       The base states `gap: {spacing.xs}`, which every size now takes. */
    sizes: {
      sm: { height: '28px', padding: '0 {spacing.sm}',  typography: 'caption',  fontWeight: '500' },
      md: { height: '36px', padding: '0 {spacing.md}',  typography: 'button',   fontWeight: '500' },
      lg: { height: '44px', padding: '0 {spacing.lg}',  typography: 'body-md',  fontWeight: '500' },
    },
    states: {
      hover:    { primary: { backgroundColor: '{colors.accent-hover}' }, secondary: { backgroundColor: '{colors.bg-subtle}' }, ghost: { backgroundColor: '{colors.accent-subtle}', textColor: '{colors.accent}' }, danger: { backgroundColor: '{colors.danger-hover}' }, 'danger-ghost': { backgroundColor: '{colors.danger-subtle}', textColor: '{colors.danger}' } },
      active:   { primary: { backgroundColor: '{colors.accent-active}' }, secondary: { backgroundColor: '{colors.surface-sunken}' } },
      disabled: { primary: { opacity: '{states.disabledOpacity}' } },
    },
  },
  {
    name: 'input', label: 'Text input', group: 'Forms', on: true,
    base: {
      backgroundColor: '{colors.surface}', textColor: '{colors.text}', borderColor: '{colors.border}',
      /* Stated, because it was the one text colour in the system that nothing
         specified. The roles list offered `text-subtle` for it — "Placeholders,
         disabled" — and that role fails AA on three of five light surfaces. A
         placeholder is readable content and is not exempt from 1.4.3, so it
         takes `text-muted`, which clears AA on every surface in both modes
         (worst case 4.57 light, 4.83 dark). Unspecified, an agent reaches for
         whichever muted role it saw last. */
      placeholderColor: '{colors.text-muted}',
      /* A field holds a leading mark often enough that the distance has to be
         published. Left unstated, the builder invents one per field. */
      rounded: '{rounded.md}', height: '36px', padding: '0 {spacing.sm}', typography: 'body-sm',
      gap: '{spacing.xs}', iconSize: '{icons.md}',
    },
    states: {
      focus:    { _: { borderColor: '{colors.ring}', outline: '{focus.width} solid {colors.ring}', outlineOffset: '{focus.offset}' } },
      invalid:  { _: { borderColor: '{colors.danger}' } },
      disabled: { _: { backgroundColor: '{colors.surface-sunken}', textColor: '{colors.text-subtle}' } },
    },
  },
  {
    name: 'textarea', label: 'Textarea', group: 'Forms', on: true,
    base: {
      backgroundColor: '{colors.surface}', textColor: '{colors.text}', borderColor: '{colors.border}',
      placeholderColor: '{colors.text-muted}',
      rounded: '{rounded.md}', padding: '{spacing.sm}', typography: 'body-sm', minHeight: '88px',
    },
  },
  {
    name: 'select', label: 'Select', group: 'Forms', on: true,
    base: {
      backgroundColor: '{colors.surface}', textColor: '{colors.text}', borderColor: '{colors.border}',
      rounded: '{rounded.md}', height: '36px', padding: '0 {spacing.sm}', typography: 'body-sm',
      /* The chevron sits at the far end of the value, and its distance is a
         decision. Unpublished, every select in a build picks its own. */
      gap: '{spacing.xs}', iconSize: '{icons.md}',
    },
  },
  {
    name: 'checkbox', label: 'Checkbox', group: 'Forms', on: true,
    /* The gap is the distance from the box to the words beside it, which every
       checkbox in a form has and nothing here stated. */
    base: { size: '16px', rounded: '{rounded.sm}', borderColor: '{colors.border}', backgroundColor: '{colors.surface}', gap: '{spacing.xs}' },
    states: {
      checked: { _: { backgroundColor: '{colors.accent}', borderColor: '{colors.accent}', textColor: '{colors.accent-fg}' } },
      /* A checkbox has THREE states, not two.
       *
       * Indeterminate is the state a "select all" box is in when some of the
       * rows below it are selected and some are not. It is the only honest
       * answer to that question, and leaving it out forces the box to lie:
       * unchecked says "nothing is selected" while two rows plainly are, and
       * checked says "everything is" while eight are not.
       *
       * It was missing here from the first version, and it went unnoticed
       * because no sample surface had a selectable list. Drawing one found it
       * in a minute. It takes the checked colours and a DASH rather than a
       * tick — the mark is what distinguishes it, never the fill, because a
       * reader who cannot separate the two hues still sees two shapes. */
      indeterminate: { _: { backgroundColor: '{colors.accent}', borderColor: '{colors.accent}', textColor: '{colors.accent-fg}' } },
    },
  },
  {
    name: 'switch', label: 'Switch', group: 'Forms', on: true,
    /* Same as the checkbox: the track to the words beside it.
     *
     * ── 24 IS DELIBERATE, AND IT LIVES HERE NOW ──
     *
     * The track is exactly 2.5.8's minimum. It used to say 20 here and 24 in a
     * default override with no comment, which is two writers for one number
     * and they disagreed. Every stylesheet fallback then had to guess: one
     * said 24 and two said 20, so a build with the token missing drew three
     * different switches. The override is gone and this is the only place the
     * number is stated.
     *
     * The HIT AREA is a separate question and a separate rule: the same
     * document publishes a 44px target, and one value cannot answer both. The
     * target is centred on this track and floored at the published minimum. */
    base: { width: '36px', height: '24px', rounded: '{rounded.full}', backgroundColor: '{colors.border}', gap: '{spacing.xs}' },
    states: { checked: { _: { backgroundColor: '{colors.accent}' } } },
  },
  {
    /* Padding is the density control, and it is kept separate from elevation.
       A dense table card and a pricing tier are the same surface at different
       scales, while flat and overlay say how far off the page something sits.
       Tying the two together means you cannot have a roomy flat panel, and
       sooner or later you want one.

       The three steps are `md`, `lg` and `xl`, which land on 16 / 24 / 32 at
       the default density and move with the Density macro from there. */
    name: 'card', label: 'Card', group: 'Surfaces', on: true,
    base: {
      backgroundColor: '{colors.surface}', borderColor: '{colors.border-subtle}',
      rounded: '{rounded.lg}', padding: '{spacing.lg}', boxShadow: '{elevation.raised}',
      backgroundImage: 'none',
    },
    variants: {
      compact: { padding: '{spacing.md}' },
      roomy:   { padding: '{spacing.xl}' },
      flat:    { boxShadow: 'none' },
      overlay: { backgroundColor: '{colors.surface-raised}', boxShadow: '{elevation.overlay}' },
    },
  },
  {
    name: 'modal', label: 'Modal', group: 'Surfaces', on: true,
    base: {
      backgroundColor: '{colors.surface-raised}', rounded: '{rounded.lg}',
      padding: '{spacing.lg}', boxShadow: '{elevation.modal}', width: 'min(560px, 92vw)',
    },
  },
  {
    name: 'badge', label: 'Badge', group: 'Feedback', on: true,
    /* ── THE GAP, AND WHY IT WAS MISSING ──
     *
     * A badge carries a status dot or a tick beside its word, and this spec
     * published no gap for it. A generated dashboard reached for the smallest
     * step on the spacing scale and put 2px between a 6px dot and the label,
     * inside 6px of padding. The mark read as stuck to the word, and the fault
     * was ours: nothing said what the distance should be.
     *
     * `xs`, which is the step `--icon-gap` already resolves to. The preview
     * reads `var(--cmp-badge-gap, var(--icon-gap, 8px))`, so before this line
     * existed the fallback painted 8px here and the generated build painted 2.
     * Publishing `2xs` would have closed the hole and moved this app's own
     * chips from 8px to 4px, which nobody asked for. `xs` closes the hole and
     * changes no rendered pixel.
     *
     * No `iconSize`. A badge's ornament is a dot, and the icon scale starts at
     * 14px, which is larger than the caption this chip is set in.
     *
     * The vertical padding was a raw `2px`. It is `3xs` exactly, and a literal
     * in this file is the same defect the payload tells its reader to avoid. */
    base: { rounded: '{rounded.full}', padding: '{spacing.3xs} {spacing.xs}', typography: 'caption', gap: '{spacing.xs}' },
    variants: {
      /* Outlined, not filled, and the palette leaves no choice.
       *
       * Every surface in a neutral-derived system is a step on the neutral
       * ramp, so a neutral FILL always collides with one of them. Measured
       * across all seven presets: `bg-subtle` on `surface` is 1.00:1 in dark —
       * the chip disappears completely — and `bg-subtle` on `bg` is 1.28 in
       * light. Moving the fill to `border-subtle` makes it visible and drops
       * the label to 3.50:1, under AA. There is no step that does both.
       *
       * The coloured variants below have no such problem: they carry a hue, so
       * their tint separates from a grey surface on hue as well as lightness.
       * Neutral has only lightness to work with, and the surfaces have taken
       * it.
       *
       * So a neutral chip is drawn by its edge. `border-subtle` reads on every
       * surface (1.38 to 2.26), and the label keeps the surface's own contrast
       * — `text-muted` on `bg` is 5.84, on `surface` 7.40. It also says the
       * right thing: neutral is the chip with no status, and an outline is
       * what "no status" looks like beside a filled success or danger chip. */
      neutral: { backgroundColor: 'transparent', borderColor: '{colors.border-subtle}', textColor: '{colors.text-muted}' },
      accent:  { backgroundColor: '{colors.accent-subtle}',  textColor: '{colors.accent}' },
      success: { backgroundColor: '{colors.success-subtle}', textColor: '{colors.success}' },
      warning: { backgroundColor: '{colors.warning-subtle}', textColor: '{colors.warning}' },
      danger:  { backgroundColor: '{colors.danger-subtle}',  textColor: '{colors.danger}' },
    },
  },
  {
    name: 'alert', label: 'Alert', group: 'Feedback', on: true,
    base: { rounded: '{rounded.md}', padding: '{spacing.sm} {spacing.md}', typography: 'body-sm', gap: '{spacing.sm}', iconSize: '{icons.md}' },
    variants: {
      info:    { backgroundColor: '{colors.bg-subtle}',      textColor: '{colors.text}',    borderColor: '{colors.border-subtle}' },
      success: { backgroundColor: '{colors.success-subtle}', textColor: '{colors.success}', borderColor: '{colors.success}' },
      warning: { backgroundColor: '{colors.warning-subtle}', textColor: '{colors.warning}', borderColor: '{colors.warning}' },
      danger:  { backgroundColor: '{colors.danger-subtle}',  textColor: '{colors.danger}',  borderColor: '{colors.danger}' },
    },
  },
  {
    name: 'tooltip', label: 'Tooltip', group: 'Overlays', on: true,
    base: {
      backgroundColor: '{colors.text}', textColor: '{colors.text-inverse}',
      rounded: '{rounded.sm}', padding: '{spacing.3xs} {spacing.xs}', typography: 'caption',
    },
  },
  {
    name: 'table', label: 'Table', group: 'Data', on: true,
    base: { typography: 'body-sm', borderColor: '{colors.border-subtle}' },
    variants: {
      header: { textColor: '{colors.text-muted}', typography: 'overline', borderColor: '{colors.border}' },
      /* Horizontal padding stated, not left at 0. A cell with no horizontal
         value says the system has no column gutter, which is never true — it
         only means nobody wrote one down. A generated dashboard reached for
         the layout gutter instead and said so in its notes, which is the
         polite version of guessing. */
      cell:   { textColor: '{colors.text}', padding: '{spacing.sm} {spacing.md}' },
    },
    /* ── THE ROW STATES ARE DECLARED HERE, NOT ONLY AT EMIT TIME ──
     *
     * `expandComponents` has always replaced these with the chosen selection
     * treatment, so the emitted values do not come from this object. The
     * PANEL reads the raw library, though, so with no states declared the
     * table had no `table-row-selected` block at all. The one component whose
     * selected row people ask about was the one with nowhere to show it or to
     * set its edge.
     *
     * The values mirror `nav-item`, which is the point: one treatment for
     * every selected row, and each keeps its own inset. */
    states: {
      hover:    { row: { backgroundColor: '{colors.bg-subtle}', textColor: '{colors.text}' } },
      selected: { row: { backgroundColor: '{colors.surface-raised}', textColor: '{colors.text}' } },
    },
  },
  {
    name: 'nav-item', label: 'Nav item', group: 'Navigation', on: true,
    base: { rounded: '{rounded.md}', padding: '{spacing.xs} {spacing.sm}', typography: 'body-sm', textColor: '{colors.text-muted}', gap: '{spacing.xs}', iconSize: '{icons.md}' },
    states: {
      hover:    { _: { backgroundColor: '{colors.bg-subtle}', textColor: '{colors.text}' } },
      selected: { _: { backgroundColor: '{colors.accent-subtle}', textColor: '{colors.accent}' } },
    },
  },
  /* A tab is not a nav item, and leaving it out made an agent prove it.
     Handed a tab strip with no `tab` entry, it took nav-item's padding, type
     and colours, then dropped nav-item-selected's background fill because the
     brief asked for an underline — and wrote a note explaining the conflict it
     had resolved on its own. Both halves of that conflict came from this file:
     the selected nav item is FILLED, and the layout rules say an underline is
     `box-shadow: inset`, never a border. Nothing said which one a tab takes.

     So the two now differ on the axis that matters. A nav item marks the
     current place with a tinted fill, because it sits in a list where a fill
     reads as "you are here". A tab marks it with a 2px underline on the strip's
     own rule, because a fill inside a strip fights the rule underneath it. The
     underline is a shadow so it adds no height and breaks no line. */
  {
    name: 'tab', label: 'Tab', group: 'Navigation', on: true,
    base: { padding: '{spacing.xs} {spacing.sm}', typography: 'body-sm', textColor: '{colors.text-muted}', gap: '{spacing.xs}', iconSize: '{icons.md}' },
    /* States come from TAB_STYLES, chosen by `components.tabStyle`. */
    states: {},
  },
  /* The mark that opens a folded navigation.
   *
   * It had no entry, so clicking it in the preview offered `nav-item` — the
   * links it opens — and there was no way to change the mark itself. A
   * component the payload tells an agent to build, with nothing describing it,
   * is a component the agent invents.
   *
   * `size` is the bar length and `height` its thickness; `backgroundColor` is
   * what paints them. Those are three of the eight properties the spec allows,
   * so the entry survives into the frontmatter rather than into prose. */
  {
    name: 'nav-burger', label: 'Menu mark', group: 'Navigation', on: true,
    base: { size: '16px', height: '2px', backgroundColor: '{colors.text-muted}',
      rounded: '{rounded.sm}', gap: '{spacing.3xs}', padding: '{spacing.3xs}' },
  },
  {
    name: 'avatar', label: 'Avatar', group: 'Data', on: true,
    /* ── A DISC IS A SHAPE, SO IT TAKES `accent-raised` ──
     *
     * This was `accent-subtle`, which is a ground for accent-coloured TEXT and
     * is quiet on purpose. A disc has no words to carry it, so its fill is the
     * whole signal. Measured against the card: 1.13:1 in light and 1.11:1 in
     * dark, both under the 1.2 a shape needs. The circle vanished in both
     * modes and only the initials floated.
     *
     * `accent-raised` mixes the accent into the raised surface, so it steps UP
     * off the card in both modes. Worst case across the shipped presets: 1.29
     * light, 1.79 dark. The initials take `text` rather than `accent`, because
     * an accent on an accent tint is a second signal doing the first one's job. */
    /* ── AN AVATAR IS NOT AN ICON, SO IT PUBLISHES ITS OWN GAP ──
     *
     * It had none, so a row holding one fell back to the row's default and put
     * 8px between a 32px disc and the name beside it. `--icon-gap` is
     * calibrated for a 14px mark against a 14px label; a disc is four times
     * the mark, and at the same distance the two read as touching. One step up
     * the scale, which is 12 against 8. */
    base: { size: '32px', gap: '{spacing.sm}', rounded: '{rounded.full}', backgroundColor: '{colors.accent-raised}', textColor: '{colors.text}', typography: 'caption' },
  },

  /* ── CHARTS ──
   *
   * THE COLOUR WAS ALREADY DONE AND THE FURNITURE PUBLISHED NOTHING. Three
   * chart scales ship — `--chart-1..5`, `--chart-seq-1..8`, `--chart-div-1..8`
   * — and no token stated an axis weight, a gridline colour, a plot inset, a
   * bar gap, a line stroke, a marker size or an area fill. So a builder
   * charting anything invented all seven, which is the missing-token fault at
   * its most expensive: a chart is mostly furniture.
   *
   * ONE ENTRY PER TYPE, which is what they asked for. The shared frame is
   * written ONCE here and spread into each entry, so twelve entries in the
   * panel cost one home in the source. Every value is a REFERENCE, so twelve
   * entries citing `{colors.border}` are twelve pointers to one decision
   * rather than twelve copies of a number.
   *
   * NO `height`. A chart's height belongs to the box that places it, the same
   * way a card's does, and inventing 200px would put a number on the scale
   * that the scale does not contain.
   *
   * `padding` IS THE PLOT INSET, and `typography` and `textColor` are the tick
   * labels. All three are among the eight properties the spec allows in
   * frontmatter, so they reach a reader who never opens the tables. A chart's
   * only text is its labels, so the plain names are unambiguous here.
   */
  ...CHART_TYPES,
]


export const COMPONENT_GROUPS = [...new Set(COMPONENT_LIBRARY.map(c => c.group))]

/* ── Two ways to mark a selected tab ──
 *
 * One treatment was not enough. A strip that sits on a rule wants the
 * underline; a strip floating in a toolbar with no rule under it wants the
 * pill, and forcing the underline there draws a 2px mark against nothing.
 *
 * Two more were built and rejected on sight: a "raised" tab taking the surface
 * fill and breaking the strip's rule, and a "boxed" tab with its bottom edge
 * open. Both are the browser-chrome idiom and both read as dated. They are not
 * offered, because an option nobody picks is a decision the reader still has to
 * make.
 *
 * The pill is NOT the nav-item treatment renamed. A nav item marks the current
 * place in a list; a pill tab marks the active view in a row. They resolve to
 * similar CSS and they answer different questions, so both exist by name. */
export const TAB_STYLES = {
  underline: {
    label: 'Underline',
    desc: 'A 2px mark on the strip’s own rule. No fill.',
    /* An inset shadow, never a border. A 2px border makes the tab 2px taller
       and pushes it past the very rule the mark is meant to sit on. */
    states: {
      hover:    { _: { textColor: '{colors.text}' } },
      selected: { _: { textColor: '{colors.text}', boxShadow: 'inset 0 -2px 0 {colors.accent}' } },
      disabled: { _: { textColor: '{colors.text-subtle}' } },
    },
  },
  pill: {
    label: 'Pill',
    desc: 'A tinted fill with a full radius, detached from any rule.',
    states: {
      hover:    { _: { textColor: '{colors.text}', backgroundColor: '{colors.bg-subtle}' } },
      selected: { _: { textColor: '{colors.accent}', backgroundColor: '{colors.accent-subtle}', rounded: '{rounded.md}' } },
      disabled: { _: { textColor: '{colors.text-subtle}' } },
    },
  },
}

export const DEFAULT_TAB_STYLE = 'underline'

/* ── Three ways to mark a selected row, and the edge that goes with one ──
 *
 * The shipped treatment was a tinted fill with accent text, and in DARK that
 * resolves to `accent-subtle` at L 23.8 on a surface at L 27.6. The fill is
 * DARKER than the ground it sits on, so a selected row read as a hole with a
 * green label floating in it. The dark chroma floor fixed the ground under it
 * and left the hole intact, because the hole is a role choice rather than a
 * ramp problem.
 *
 * So the treatment is a setting now. The three differ on which channel
 * carries the mark, which is the axis a reader actually reads:
 *
 *   tint       the FILL carries it, and the label goes with it
 *   lift       the LIGHTNESS carries it, and the label goes near-white
 *   lift-edge  the lightness carries it and an accent bar names it
 *
 * `lift` steps UP to `surface-raised`, never down. A selected row is nearer
 * the reader than the rows around it, and every dark dashboard worth copying
 * draws it that way.
 *
 * THE EDGE COSTS PADDING. A bar drawn inside the box eats the label's left
 * inset, so the text has to move by the bar's own width or the two touch. The
 * padding below is the base inset plus that width, which is why the edge
 * thickness and the padding are one decision and one setting. */
/* ── AN EDGE WEIGHT IS A WEIGHT, NOT A LAYOUT LENGTH ──
 *
 * These began as spacing tokens, and the tokens move with the density macro.
 * `{spacing.2xs}`, `{spacing.sm}` and `{spacing.md}` read 4, 8 and 12 at the
 * Dense setting and 4, 12 and 16 at the default one, so the three names meant
 * different bars in different documents while the readout kept saying 4, 8 and
 * 12. Measured: medium rendered a 12px bar with an 8px label beside it.
 *
 * The asked-for numbers are fixed, and a bar's thickness answers to the type
 * beside it rather than to a layout grid — the same reason an icon's stroke is
 * stated as a weight. So they are literal, and `px` is the only source, which
 * is why the readout cannot drift from the bar again.
 *
 * All three are on the space grid anyway, so nothing off-scale ships. */
export const SELECTION_EDGES = {
  thin:   { label: 'Thin',   px: 4 },
  medium: { label: 'Medium', px: 8 },
  wide:   { label: 'Wide',   px: 12 },
}

export const DEFAULT_SELECTION_EDGE = 'thin'

export const SELECTION_STYLES = {
  tint: {
    label: 'Accent tint',
    desc: 'The fill carries the mark. An accent wash with an accent label.',
    edge: false,
    states: {
      hover:    { _: { backgroundColor: '{colors.bg-subtle}', textColor: '{colors.text}' } },
      selected: { _: { backgroundColor: '{colors.accent-subtle}', textColor: '{colors.accent}' } },
    },
  },
  lift: {
    label: 'Lift',
    desc: 'The lightness carries the mark. A raised surface with a full-strength label.',
    edge: false,
    states: {
      hover:    { _: { backgroundColor: '{colors.bg-subtle}', textColor: '{colors.text}' } },
      selected: { _: { backgroundColor: '{colors.surface-raised}', textColor: '{colors.text}' } },
    },
  },
  'lift-edge': {
    label: 'Lift with edge',
    desc: 'A raised surface, a full-strength label, and an accent bar on the leading edge.',
    edge: true,
    states: {
      hover:    { _: { backgroundColor: '{colors.bg-subtle}', textColor: '{colors.text}' } },
      selected: { _: { backgroundColor: '{colors.surface-raised}', textColor: '{colors.text}' } },
    },
  },
}

export const DEFAULT_SELECTION_STYLE = 'lift-edge'

/** The chosen selection treatment, or the default when the name is unknown. */
export function selectionStyle(name) {
  return SELECTION_STYLES[name] ? name : DEFAULT_SELECTION_STYLE
}

/** The chosen edge weight, or the default when the name is unknown. */
export function selectionEdge(name) {
  return SELECTION_EDGES[name] ? name : DEFAULT_SELECTION_EDGE
}

/* The selected state, with the edge and its padding folded in.
 *
 * ONE WRITER, TWO COMPONENTS. A nav item and a table row are both a selected
 * row, and the treatment is one decision for the system rather than one per
 * component: a nav marked by a lifted surface beside a table marked by an
 * accent wash reads as two products. Each caller passes its OWN base padding,
 * because a nav item is inset by `sm` and a table cell by `md`.
 *
 * The bar is an inset box-shadow, never a border. A border makes the row wider
 * by its own width and pushes every label in the list across by it, so only
 * the selected row would line up differently from its neighbours. */
export function selectedState(styleName, edgeName, { ruled = false } = {}) {
  const style = SELECTION_STYLES[selectionStyle(styleName)]
  const props = { ...style.states.selected._ }
  if (!style.edge) return props
  const edge = SELECTION_EDGES[selectionEdge(edgeName)]
  const w = `${edge.px}px`
  /* ── A ROW INSIDE A RULED SET NEEDS A DIFFERENT MECHANISM ──
   *
   * An inset shadow paints inside the border box and the BORDER paints on top
   * of it. A table row carries a 1px bottom rule, so the bar came out 56px in
   * a 57px row and stopped short at every boundary. It reads as a dash
   * between the rules rather than as the row's own edge.
   *
   * A nav item has no rule crossing it, so the shadow is still right there,
   * and it costs no extra element. Where a rule DOES cross, the bar has to
   * paint over it, and only a pseudo-element can: a background is clipped to
   * the border box and a border widens the cell.
   *
   * So a ruled set publishes the INGREDIENTS and no shadow. Publishing both
   * would be two mechanisms for one mark, and a builder taking the shadow
   * would reproduce the fault this replaces. */
  if (!ruled) props.boxShadow = `inset ${w} 0 0 {colors.accent}`
  props.edgeColor = '{colors.accent}'
  /* ── THE BAR'S OWN WIDTH, PUBLISHED SEPARATELY ──
   *
   * The shorthand below is the ready-made answer, and it ASSUMES the cell
   * still carries its own base inset. A build that flushed a table's first
   * column to the card's edge — which the margin rule pushes toward — took
   * that shorthand anyway and got a 16px jog where the bar is 4: measured,
   * selected rows at 16px from the card's content edge and unselected at 0.
   *
   * Both rules were the document's, and they collided. So the INGREDIENT is
   * published too. A builder who changed the cell's inset adds this to their
   * own value rather than taking a sum computed from a padding they no longer
   * use. */
  props.edgeWidth = w
  /* ── THE SELECTED STATE DOES NOT RESTATE PADDING ──
   *
   * It used to, as a SUM of the base inset and the bar. That is arithmetically
   * right and it staggers the column: the selected row's label sits the bar's
   * width further in than every unselected row beside it. Measured in this
   * app's own preview, on a 4px bar, a nav list of five: the selected label at
   * 693 and its four siblings at 689.
   *
   * Worse where the first thing in the row is an ORNAMENT rather than a label.
   * A table's selection column holds a 16px checkbox, and staggering it breaks
   * the one thing a column of checkboxes has to do. They caught it in a
   * screenshot: the bar and the checked box are both the accent, and with the
   * inset collapsed they touched and fused into one green shape.
   *
   * So the GUTTER belongs to the base, where every row in the set reserves it.
   * The selected row then paints the bar into space that is already there, and
   * no row moves. `gutterFor` below builds that base padding. */
  return props
}

/**
 * The base padding a selectable row needs, with the bar's gutter reserved.
 *
 * Every row in the set takes this, selected or not, so the column cannot
 * stagger. The gap after the bar is a STEP on the scale rather than whatever
 * the inset happens to leave: at the `sm` step a 16px checkbox read as
 * touching a 4px bar, and they asked for double.
 *
 * @param {string} styleName  the chosen selection treatment
 * @param {string} edgeName   the chosen edge weight
 * @param {string} basePadding the component's own padding shorthand
 * @param {string} gapToken   the step to leave between the bar and the content
 */
export function gutterFor(styleName, edgeName, basePadding, gapToken) {
  const parts = String(basePadding ?? '{spacing.xs} {spacing.sm}').trim().split(/\s+/)
  const y = parts[0], x = parts[1] ?? parts[0]
  const style = SELECTION_STYLES[selectionStyle(styleName)]
  if (!style.edge) return basePadding ?? `${y} ${x}`
  const w = `${SELECTION_EDGES[selectionEdge(edgeName)].px}px`
  /* The bar, then a real step, then the content. The horizontal inset stays a
     TOKEN so a density change still carries; only the bar is literal. */
  return `${y} ${x} ${y} calc(${w} + ${gapToken ?? x})`
}

/* The document's treatment, or the default when the name is unknown.
 *
 * A promotion once lived here: a strip under a major rule was forced to the
 * pill, because an underlined strip repeats the page rule about 47px below it.
 * They rejected the look on sight and asked for it to be rescinded, so the
 * chosen treatment now stands everywhere. Do not reinstate it.
 *
 * The function stays, because the fallback still needs one implementation. Two
 * call sites restating it would disagree the first time one changed. */
export function stripStyle(tabStyle) {
  return TAB_STYLES[tabStyle] ? tabStyle : DEFAULT_TAB_STYLE
}

/** Merge an override map over a property set. */
const applyOverrides = (props, overrides, prefix) => {
  const out = { ...props }
  for (const [key, value] of Object.entries(overrides)) {
    if (!key.startsWith(`${prefix}.`)) continue
    const prop = key.slice(prefix.length + 1)
    if (value === null) delete out[prop]
    else out[prop] = value
  }
  return out
}

const toProps = obj =>
  Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    /* `backgroundImage: none` is the resting state, not a decision — emitting
       it on every component would be noise. */
    .filter(([key, v]) => !(key === 'backgroundImage' && v === 'none'))
    .map(([key, value]) => ({ id: `${key}`, key, value: String(value) }))

/**
 * Expand the library into flattened DESIGN.md component entries.
 *
 * @returns [{ name, properties: [{key, value}], source }]
 */
export function expandComponents(cfg = {}) {
  const { enabled = {}, overrides = {}, emitStates = true, emitSizes = true,
    tabStyle = DEFAULT_TAB_STYLE,
    selection = DEFAULT_SELECTION_STYLE, selectionEdgeWeight = DEFAULT_SELECTION_EDGE,
    /* The table's own weight. Falls back to the nav item's, so a document
       saved before the split keeps one consistent bar. */
    tableSelectionEdgeWeight = selectionEdgeWeight } = cfg
  const out = []

  for (const rawDef of COMPONENT_LIBRARY) {
    /* The tab's states come from the chosen style rather than the library, so
       one setting swaps the whole treatment and no entry states both. */
    let def = rawDef
    if (rawDef.name === 'tab') {
      def = { ...rawDef, states: (TAB_STYLES[tabStyle] ?? TAB_STYLES[DEFAULT_TAB_STYLE]).states }
    }
    /* Same for the two components that mark a selected ROW. One treatment for
       both, and each takes its own base inset: a nav item is padded by `sm`
       and a table cell by `md`, so the edge compensation differs. */
    /* ── THE GUTTER GOES ON THE BASE, NOT ON THE SELECTED STATE ──
     *
     * Both components reserve the bar's space on EVERY row, so the selected
     * one paints into it and the column never staggers. A nav item's content
     * is a label, so it keeps its own `sm` inset after the bar. A table's
     * selection column holds a 16px checkbox, and at that inset the box read
     * as touching the bar, so it takes the `lg` step. */
    if (rawDef.name === 'nav-item') {
      const chosen = SELECTION_STYLES[selectionStyle(selection)]
      def = {
        ...rawDef,
        base: { ...rawDef.base, padding: gutterFor(selection, selectionEdgeWeight, rawDef.base?.padding) },
        states: {
          ...rawDef.states,
          hover: chosen.states.hover,
          selected: { _: selectedState(selection, selectionEdgeWeight) },
        },
      }
    }
    if (rawDef.name === 'table') {
      const chosen = SELECTION_STYLES[selectionStyle(selection)]
      const cellPad = rawDef.variants?.cell?.padding
      def = {
        ...rawDef,
        variants: {
          ...rawDef.variants,
          /* The column that carries the bar, published separately from the
             ordinary cell so a builder cannot apply it to every column. */
          'selection-cell': { padding: gutterFor(selection, tableSelectionEdgeWeight, cellPad, '{spacing.lg}') },
        },
        states: {
          ...rawDef.states,
          hover: { row: chosen.states.hover._ },
          /* Ruled: every row carries a bottom rule, so the bar cannot be an
             inset shadow. See selectedState. */
          selected: { row: selectedState(selection, tableSelectionEdgeWeight, { ruled: true }) },
        },
      }
    }
    const isOn = enabled[def.name] ?? def.on
    if (!isOn) continue

    if (def.base) {
      const props = applyOverrides(def.base, overrides, def.name)
      if (Object.keys(props).length) out.push({ name: def.name, properties: toProps(props), source: 'base' })
    }

    for (const [variant, props] of Object.entries(def.variants ?? {})) {
      const key = `${def.name}-${variant}`
      out.push({ name: key, properties: toProps(applyOverrides(props, overrides, key)), source: 'variant' })
    }

    if (emitSizes) {
      for (const [size, props] of Object.entries(def.sizes ?? {})) {
        const key = `${def.name}-${size}`
        out.push({ name: key, properties: toProps(applyOverrides(props, overrides, key)), source: 'size' })
      }
    }

    if (emitStates) {
      for (const [state, byVariant] of Object.entries(def.states ?? {})) {
        for (const [variant, props] of Object.entries(byVariant)) {
          /* `_` means the component has no variants — the state hangs off the
             base name instead of a variant name. */
          const key = variant === '_' ? `${def.name}-${state}` : `${def.name}-${variant}-${state}`
          out.push({ name: key, properties: toProps(applyOverrides(props, overrides, key)), source: 'state' })
        }
      }
    }
  }

  return out.filter(c => c.properties.length)
}

/* ── THE BRIDGE FROM A SPEC NAME TO THE CLASS YOU ACTUALLY WRITE ──
 *
 * DESIGN.md names every component `button-primary`, `table-header`,
 * `input-invalid`. The stylesheet defines `.btn-primary`, and `btn-` appeared
 * ZERO times in 24,507 words. Nothing joined the two, so a reader obeying
 * "variants and states are flattened into the component name" wrote
 * `class="button-primary"` and got an unstyled element. Silently, which is the
 * exact fault the package's own hard rules warn about, with the invented name
 * coming from the document.
 *
 * Found by simulation run 13. Every row below was verified against the
 * stylesheet rather than guessed: 52 declared names, checked one at a time.
 *
 * THE ROWS THAT ARE NOT A CLASS ARE THE POINT. `table-header` is `thead th`,
 * an element selector. `input-focus` is a pseudo-class. `button-md` is the
 * unmodified base, because there is no `.btn-md`. A reader who is not told
 * these invents `.table-header` and gets nothing, which is what happened.
 */
export const CLASS_BRIDGE = {
  /* One entry per shape, keyed by the spec name the document prints. */
  'button': '`.btn`',
  'button-md': '`.btn` — the plain class IS the md size; there is no `.btn-md`',
  'button-sm': '`.btn.btn-sm`',
  'button-lg': '`.btn.btn-lg`',
  'button-hover': '`.btn.is-hover`, or the real `:hover`',
  'button-active': '`.btn.is-active`, or the real `:active`',
  'button-disabled': '`.btn.is-disabled`, or the `disabled` attribute',
  'input': '`.input`',
  'input-focus': '`.input:focus` — a pseudo-class, not a class. `.is-active` only for a sample',
  'input-invalid': '`.input.is-invalid`',
  'input-disabled': '`.input.is-disabled`, or the `disabled` attribute',
  'textarea': '`<textarea class="input">` — the same class as an input',
  'select': '`<select class="input">`, or `.btn.select-trigger` for a custom one',
  'checkbox': '`.checkbox` beside a real `<input type="checkbox" class="checkbox-input">`',
  'checkbox-checked': '`.checkbox.is-on`',
  'checkbox-indeterminate': '`.checkbox.is-on` — the same fill; the MARK separates them',
  'switch': '`.switch` beside a real `<input class="switch-input">`',
  'switch-checked': '`.switch.is-on`',
  'card': '`.card`',
  'card-compact': '`.card.card-compact`',
  'card-roomy': '`.card.card-roomy`',
  'card-flat': '`.card.card-flat`',
  'card-overlay': '`.card.card-overlay`',
  'modal': '`.modal`',
  'badge': '`.badge`',
  'alert': '`.alert`',
  'alert-info': '`.alert` — the base IS info; there is no `.alert-info`',
  'tooltip': '`.tooltip`',
  'table': '`.table`',
  'table-header': '`.table thead th` — an element selector, not a class',
  'table-cell': '`.table td` — an element selector, not a class',
  'table-hover': '`.table tbody tr.is-hover`, or the real `:hover`',
  'table-selected': '`.table tbody tr.is-selected`',
  'nav-item': '`.nav-item`',
  'nav-item-hover': '`.nav-item.is-hover`, or the real `:hover`',
  'nav-item-selected': '`.nav-item.is-selected`, plus `aria-current="page"`',
  'tab': '`.tab`',
  'nav-burger': '`.nav-burger`, inside a `<summary class="nav-summary">`',
  'avatar': '`.avatar`',
  /* Every chart type is `.chart` plus its own class, the same shape as
     `.btn.btn-primary`. The base carries the frame; the type carries what
     is its own. Without these rows a reader has twelve component names and
     no way to know what to write in the markup. */
  'chart-column': '`.chart.chart-column`',
  'chart-bar': '`.chart.chart-bar`',
  'chart-line': '`.chart.chart-line`',
  'chart-area': '`.chart.chart-area`',
  'chart-pie': '`.chart.chart-pie`',
  'chart-donut': '`.chart.chart-donut`',
  'chart-combo': '`.chart.chart-combo`',
  'chart-stacked': '`.chart.chart-stacked`',
  'chart-grouped': '`.chart.chart-grouped`',
  'chart-scatter': '`.chart.chart-scatter`',
  'chart-heatmap': '`.chart.chart-heatmap`',
  'chart-sparkline': '`.chart.chart-sparkline`',
}

/* Variants follow one rule, so they need no row each: the base class plus the
   variant name, on the base's OWN prefix. `button-ghost` is `.btn.btn-ghost`,
   `badge-success` is `.badge.badge-success`. */
const VARIANT_PREFIX = { button: 'btn' }

/** The class to write for a spec name, or null where nothing is published. */
export function classFor(specName) {
  if (CLASS_BRIDGE[specName]) return CLASS_BRIDGE[specName]
  for (const c of COMPONENT_LIBRARY) {
    for (const v of Object.keys(c.variants ?? {})) {
      if (specName !== `${c.name}-${v}`) continue
      const p = VARIANT_PREFIX[c.name] ?? c.name
      return `\`.${p}.${p}-${v}\``
    }
  }
  return null
}
