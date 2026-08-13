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
      { name: 'accent-subtle',   desc: 'Tinted background',          light: 'accent.100',  dark: 'accent.900'  },
      { name: 'accent-fg',       desc: 'Content on accent fill',     light: 'neutral.50',  dark: 'neutral.950' },
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
      { name: 'success-subtle',  desc: 'Success background',         light: 'success.100', dark: 'success.900' },
      { name: 'success-fg',      desc: 'Content on success fill',    light: 'neutral.50',  dark: 'neutral.950' },
      { name: 'warning',         desc: 'Warning fill',               light: 'warning.700', dark: 'warning.400' },
      { name: 'warning-subtle',  desc: 'Warning background',         light: 'warning.100', dark: 'warning.900' },
      { name: 'warning-fg',      desc: 'Content on warning fill',    light: 'neutral.50',  dark: 'neutral.950' },
      { name: 'danger',          desc: 'Destructive fill',           light: 'danger.700',  dark: 'danger.400'  },
      /* Accent has had a hover role since the start; danger never did, so a
         destructive button's hover was defined as `danger` — the colour it
         already was — and the most consequential button in the app was the one
         that did not respond to the pointer. Steps the same direction accent
         does: darker on paper, lighter in the dark, because a hover has to
         move away from the page rather than always down. */
      { name: 'danger-hover',    desc: 'Destructive hover',          light: 'danger.800',  dark: 'danger.300'  },
      { name: 'danger-subtle',   desc: 'Destructive background',     light: 'danger.100',  dark: 'danger.900'  },
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
  { fg: 'text-subtle',  bg: 'surface',        label: 'Placeholder on card' },
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
  { fg: 'ring',         bg: 'bg',             label: 'Focus ring',       ui: true },
]

/* The curated list above is a guess about which combinations get built. The
   sweep below needs no guess: every role that carries words, against every
   role that sits behind them. It reports only what fails, so it costs nothing
   when the system is sound and names the exact pair when it is not. */
export const TEXT_ROLES    = ['text', 'text-muted', 'text-subtle', 'accent', 'success', 'warning', 'danger']
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
]

export const FRAMEWORKS = ['React + Tailwind', 'React + CSS variables', 'Plain HTML + CSS', 'Vue + Tailwind', 'Svelte', 'Unspecified']

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
  'badge-neutral.backgroundColor': '{colors.bg}',
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

     The cost is that accent and success are both teals, thirteen degrees
     apart, separating on lightness rather than hue. Legible, but close;
     moving the accent is the fix if it ever grates.

     Change these freely — the audit in the Access tab will tell you what it
     costs. */
    seeds: [
      { id: 'sd-accent',  name: 'accent',  hex: '#006b72', desc: 'Primary action and emphasis' },
      { id: 'sd-neutral', name: 'neutral', hex: '#627072', desc: 'Surfaces, text, borders' },
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
  icons: { library: 'Lucide', strokeWidth: 1.75, sizes: { sm: 14, md: 16, lg: 20, xl: 24 }, joinStyle: 'round', gap: 'xs' },

  focus: { width: 2, offset: 2, style: 'solid', role: 'ring' },

  states: { disabledOpacity: 0.5, touchTarget: 44, transitionOn: ['background-color', 'border-color', 'color', 'opacity', 'transform'] },

  /* `custom` holds components that came from an imported file or an older
     document — names the library knows nothing about, emitted verbatim. */
  /* `layout` holds composition rules — icon placement, alignment, action
     arrangement — that have no slot in the spec's eight component properties
     and are emitted as guidance instead. Absent in older documents; readers go
     through `resolveAllLayouts`, which fills the defaults. */
  components: { enabled: {}, overrides: defaultComponentOverrides(), custom: [], emitStates: true, emitSizes: true, layout: {} },

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

  /* Build preferences — decisions about the page an agent produces, rather
     than about the system it produces it from.
     `labelCase` exists because a generated build kept the brief's
     capitalisation for labels it was handed and used sentence case for labels
     it invented, then said so in its notes. Both readings were defensible,
     because the document asked for sentence case in prose and demonstrated
     Title Case in its own examples. A stated choice removes the guess. */
  build: {
    labelCase: 'sentence',   // sentence | title
    themeToggle: false,
  },

  prose: emptyProse(),
})

export { uid, emptyProse, defaultRoles }
