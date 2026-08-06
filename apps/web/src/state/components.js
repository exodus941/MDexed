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
    /* iconSize is per-component and per-size: a 28px button wants a smaller
       glyph than a 44px one, and the global icon scale can't express that. */
    base: { rounded: '{rounded.md}', typography: 'button', gap: '{spacing.xs}', iconSize: '{icons.md}' },
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
    sizes: {
      sm: { height: '28px', padding: '0 {spacing.sm}',  typography: 'caption',  gap: '{spacing.3xs}', iconSize: '{icons.sm}' },
      md: { height: '36px', padding: '0 {spacing.md}',  typography: 'button',   gap: '{spacing.2xs}', iconSize: '{icons.md}' },
      lg: { height: '44px', padding: '0 {spacing.lg}',  typography: 'body-md',  gap: '{spacing.xs}',  iconSize: '{icons.lg}' },
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
      rounded: '{rounded.md}', height: '36px', padding: '0 {spacing.sm}', typography: 'body-sm',
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
      rounded: '{rounded.md}', padding: '{spacing.sm}', typography: 'body-sm', minHeight: '88px',
    },
  },
  {
    name: 'select', label: 'Select', group: 'Forms', on: true,
    base: {
      backgroundColor: '{colors.surface}', textColor: '{colors.text}', borderColor: '{colors.border}',
      rounded: '{rounded.md}', height: '36px', padding: '0 {spacing.sm}', typography: 'body-sm',
    },
  },
  {
    name: 'checkbox', label: 'Checkbox', group: 'Forms', on: true,
    base: { size: '16px', rounded: '{rounded.sm}', borderColor: '{colors.border}', backgroundColor: '{colors.surface}' },
    states: {
      checked: { _: { backgroundColor: '{colors.accent}', borderColor: '{colors.accent}', textColor: '{colors.accent-fg}' } },
    },
  },
  {
    name: 'switch', label: 'Switch', group: 'Forms', on: true,
    base: { width: '36px', height: '20px', rounded: '{rounded.full}', backgroundColor: '{colors.border}' },
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
    base: { rounded: '{rounded.full}', padding: '2px {spacing.xs}', typography: 'caption' },
    variants: {
      neutral: { backgroundColor: '{colors.bg-subtle}',      textColor: '{colors.text-muted}' },
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
      cell:   { textColor: '{colors.text}', padding: '{spacing.sm} 0' },
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
  {
    name: 'avatar', label: 'Avatar', group: 'Data', on: true,
    base: { size: '32px', rounded: '{rounded.full}', backgroundColor: '{colors.accent-subtle}', textColor: '{colors.accent}', typography: 'caption' },
  },
]

export const COMPONENT_GROUPS = [...new Set(COMPONENT_LIBRARY.map(c => c.group))]

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
  const { enabled = {}, overrides = {}, emitStates = true, emitSizes = true } = cfg
  const out = []

  for (const def of COMPONENT_LIBRARY) {
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
