/* The shape of an editor document.

   Only seeds, macros and explicit overrides are stored — every concrete token
   value is computed by derive.js. That keeps saved state small and, more
   importantly, means moving a macro slider retroactively reshapes the whole
   system instead of leaving stale values behind. */
import { DEFAULT_SHAPE } from '../color/ramp.js'

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
      { name: 'bg',              desc: 'Page background',            light: 'neutral.100', dark: 'neutral.950' },
      { name: 'bg-subtle',       desc: 'Recessed page areas',        light: 'neutral.200', dark: 'neutral.900' },
      { name: 'surface',         desc: 'Cards, panels, sheets',      light: 'neutral.50',  dark: 'neutral.900' },
      { name: 'surface-raised',  desc: 'Popovers, menus, modals',    light: 'neutral.50',  dark: 'neutral.800' },
      { name: 'surface-sunken',  desc: 'Wells, inset fields',        light: 'neutral.200', dark: 'neutral.950' },
    ],
  },
  {
    id: 'text', label: 'Text', desc: 'Foreground content',
    roles: [
      { name: 'text',            desc: 'Primary body and headings',  light: 'neutral.900', dark: 'neutral.50'  },
      { name: 'text-muted',      desc: 'Secondary, captions, meta',  light: 'neutral.700', dark: 'neutral.300' },
      { name: 'text-subtle',     desc: 'Placeholders, disabled',     light: 'neutral.600', dark: 'neutral.400' },
      { name: 'text-inverse',    desc: 'On strong-coloured fills',   light: 'neutral.50',  dark: 'neutral.950' },
    ],
  },
  {
    id: 'border', label: 'Borders', desc: 'Dividers, outlines, rings',
    roles: [
      { name: 'border-subtle',   desc: 'Hairlines, table rules',     light: 'neutral.200', dark: 'neutral.800' },
      { name: 'border',          desc: 'Default control outline',    light: 'neutral.500', dark: 'neutral.500' },
      { name: 'border-strong',   desc: 'Emphasised outline',         light: 'neutral.600', dark: 'neutral.400' },
      { name: 'ring',            desc: 'Focus indicator',            light: 'accent.600',  dark: 'accent.400'  },
    ],
  },
  {
    id: 'accent', label: 'Accent', desc: 'Primary actions and active state',
    roles: [
      /* accent sits at 700 rather than 600 in light mode so it also clears AA
         as text, not just as a fill — it is routinely used for links. */
      { name: 'accent',          desc: 'Primary action fill',        light: 'accent.700',  dark: 'accent.400'  },
      { name: 'accent-hover',    desc: 'Hover state',                light: 'accent.800',  dark: 'accent.300'  },
      { name: 'accent-active',   desc: 'Pressed state',              light: 'accent.900',  dark: 'accent.200'  },
      { name: 'accent-subtle',   desc: 'Tinted background',          light: 'accent.100',  dark: 'accent.900'  },
      { name: 'accent-fg',       desc: 'Content on accent fill',     light: 'neutral.50',  dark: 'neutral.950' },
    ],
  },
  {
    id: 'status', label: 'Status', desc: 'Feedback and validation',
    roles: [
      { name: 'success',         desc: 'Success fill',               light: 'success.600', dark: 'success.400' },
      { name: 'success-subtle',  desc: 'Success background',         light: 'success.100', dark: 'success.900' },
      { name: 'success-fg',      desc: 'Content on success fill',    light: 'neutral.50',  dark: 'neutral.950' },
      { name: 'warning',         desc: 'Warning fill',               light: 'warning.600', dark: 'warning.400' },
      { name: 'warning-subtle',  desc: 'Warning background',         light: 'warning.100', dark: 'warning.900' },
      { name: 'warning-fg',      desc: 'Content on warning fill',    light: 'neutral.50',  dark: 'neutral.950' },
      { name: 'danger',          desc: 'Destructive fill',           light: 'danger.600',  dark: 'danger.400'  },
      { name: 'danger-subtle',   desc: 'Destructive background',     light: 'danger.100',  dark: 'danger.900'  },
      { name: 'danger-fg',       desc: 'Content on destructive fill',light: 'neutral.50',  dark: 'neutral.950' },
    ],
  },
]

export const ALL_ROLES = ROLE_GROUPS.flatMap(g => g.roles)

/* Pairs worth checking for contrast. `ui` marks non-text pairs held to the
   3:1 bar instead of 4.5. */
export const CONTRAST_PAIRS = [
  { fg: 'text',         bg: 'bg',        label: 'Body on page' },
  { fg: 'text',         bg: 'surface',   label: 'Body on card' },
  { fg: 'text-muted',   bg: 'bg',        label: 'Muted on page' },
  { fg: 'text-muted',   bg: 'surface',   label: 'Muted on card' },
  { fg: 'text-subtle',  bg: 'surface',   label: 'Placeholder on card' },
  { fg: 'accent-fg',    bg: 'accent',    label: 'Label on primary button' },
  { fg: 'accent',       bg: 'bg',        label: 'Accent text on page' },
  { fg: 'success-fg',   bg: 'success',   label: 'Label on success' },
  { fg: 'warning-fg',   bg: 'warning',   label: 'Label on warning' },
  { fg: 'danger-fg',    bg: 'danger',    label: 'Label on destructive' },
  { fg: 'border',       bg: 'surface',   label: 'Control outline',  ui: true },
  { fg: 'ring',         bg: 'bg',        label: 'Focus ring',       ui: true },
]

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
]

export const FRAMEWORKS = ['React + Tailwind', 'React + CSS variables', 'Plain HTML + CSS', 'Vue + Tailwind', 'Svelte', 'Unspecified']

/* ── Default document ──
   A warm editorial system, deliberately opinionated. Nobody should ever face
   a blank canvas here; tuning something coherent beats assembling from zero. */
export const createInitialState = () => ({
  schemaVersion: SCHEMA_VERSION,
  meta: { name: 'My Design System', description: '', version: 'alpha' },
  macros: { ...DEFAULT_MACROS },

  color: {
    seeds: [
      { id: 'sd-accent',  name: 'accent',  hex: '#0d7a70', desc: 'Primary action and emphasis' },
      { id: 'sd-neutral', name: 'neutral', hex: '#757980', desc: 'Surfaces, text, borders' },
      { id: 'sd-success', name: 'success', hex: '#4a8f3c', desc: 'Confirmation' },
      { id: 'sd-warning', name: 'warning', hex: '#b8801f', desc: 'Caution' },
      { id: 'sd-danger',  name: 'danger',  hex: '#c0392f', desc: 'Destructive and errors' },
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
    emitDark: true,
  },

  type: {
    families: {
      display: { family: 'Space Grotesk', category: 'sans-serif' },
      body:    { family: 'Manrope', category: 'sans-serif' },
      mono:    { family: 'JetBrains Mono', category: 'monospace' },
    },
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
    breakpoints: [
      { name: 'sm', px: 640 }, { name: 'md', px: 768 },
      { name: 'lg', px: 1024 }, { name: 'xl', px: 1280 }, { name: '2xl', px: 1536 },
    ],
    containers: { sm: 600, md: 720, lg: 960, xl: 1140, '2xl': 1320 },
    columns: 12,
    gutter: 'lg',
    maxMeasure: 68,
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
  icons: { library: 'Lucide', strokeWidth: 1.75, sizes: { sm: 14, md: 16, lg: 20, xl: 24 }, joinStyle: 'round', gap: 'xs' },

  focus: { width: 2, offset: 2, style: 'solid', role: 'ring' },

  states: { disabledOpacity: 0.5, touchTarget: 44, transitionOn: ['background-color', 'border-color', 'color', 'opacity', 'transform'] },

  /* `custom` holds components that came from an imported file or an older
     document — names the library knows nothing about, emitted verbatim. */
  /* `layout` holds composition rules — icon placement, alignment, action
     arrangement — that have no slot in the spec's eight component properties
     and are emitted as guidance instead. Absent in older documents; readers go
     through `resolveAllLayouts`, which fills the defaults. */
  components: { enabled: {}, overrides: {}, custom: [], emitStates: true, emitSizes: true, layout: {} },

  voice: {
    casing: 'sentence',        // sentence | title
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

  prose: emptyProse(),
})

export { uid, emptyProse, defaultRoles }
