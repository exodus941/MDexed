/* The component set, as defaults rather than as stored data.

   Only what the designer changes is persisted; everything here is expanded at
   derive time. Emission follows the spec's flattening convention — a variant
   becomes `button-primary`, a state becomes `button-primary-hover`, a size
   becomes `button-sm`.

   Properties outside the spec's legal eight (borderColor, gap, boxShadow …)
   are included deliberately. They can't go in the frontmatter, but they do
   reach the file as prose, and an agent building a button needs them. */

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
    sizes: {
      sm: { height: '28px', padding: '0 {spacing.sm}',  typography: 'caption',  gap: '{spacing.3xs}' },
      md: { height: '36px', padding: '0 {spacing.md}',  typography: 'button',   gap: '{spacing.2xs}' },
      lg: { height: '44px', padding: '0 {spacing.lg}',  typography: 'body-md',  gap: '{spacing.xs}' },
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
      gap: '{spacing.2xs}', iconSize: '{icons.md}',
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
      gap: '{spacing.2xs}', iconSize: '{icons.md}',
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
    /* Same as the checkbox: the track to the words beside it. */
    base: { width: '36px', height: '20px', rounded: '{rounded.full}', backgroundColor: '{colors.border}', gap: '{spacing.xs}' },
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
  },
  {
    name: 'nav-item', label: 'Nav item', group: 'Navigation', on: true,
    base: { rounded: '{rounded.md}', padding: '{spacing.xs} {spacing.sm}', typography: 'body-sm', textColor: '{colors.text-muted}', gap: '{spacing.2xs}', iconSize: '{icons.md}' },
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
    base: { padding: '{spacing.xs} {spacing.sm}', typography: 'body-sm', textColor: '{colors.text-muted}', gap: '{spacing.2xs}', iconSize: '{icons.md}' },
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
    base: { size: '32px', rounded: '{rounded.full}', backgroundColor: '{colors.accent-subtle}', textColor: '{colors.accent}', typography: 'caption' },
  },
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
    tabStyle = DEFAULT_TAB_STYLE } = cfg
  const out = []

  for (const rawDef of COMPONENT_LIBRARY) {
    /* The tab's states come from the chosen style rather than the library, so
       one setting swaps the whole treatment and no entry states both. */
    const def = rawDef.name === 'tab'
      ? { ...rawDef, states: (TAB_STYLES[tabStyle] ?? TAB_STYLES[DEFAULT_TAB_STYLE]).states }
      : rawDef
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
