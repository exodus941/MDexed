/* The shape of an editor document.
   Only seeds, macros and explicit overrides are stored — every concrete token
   value is computed by derive.js. That keeps saved state small and, more
   importantly, means moving a macro slider retroactively reshapes the whole
   system instead of leaving stale values behind. */
import { DEFAULT_SHAPE } from '../color/ramp.js'

export const SCHEMA_VERSION = 2

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
      { name: 'ring',            desc: 'Focus indicator',            light: 'accent.500',  dark: 'accent.400'  },
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

/* Pairs worth checking for contrast. `large` marks pairs where the content is
   display-sized, `ui` marks non-text pairs held to the 3:1 bar instead of 4.5. */
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
  { key: 'scale',     label: 'Type scale', desc: 'Multiplies every font size',      min: 0.75, max: 1.5,  step: 0.01 },
  { key: 'density',   label: 'Density',    desc: 'Multiplies every spacing step',   min: 0.6,  max: 1.6,  step: 0.01 },
  { key: 'roundness', label: 'Roundness',  desc: 'Multiplies every corner radius',  min: 0,    max: 2.5,  step: 0.01 },
  { key: 'depth',     label: 'Depth',      desc: 'Shadow strength across the board',min: 0,    max: 2,    step: 0.01 },
  { key: 'speed',     label: 'Motion',     desc: 'Multiplies every duration',       min: 0.4,  max: 2,    step: 0.01 },
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

/* ── Default document ──
   A warm editorial system, deliberately opinionated. Nobody should ever face
   a blank canvas here; tuning something coherent beats assembling from zero. */
export const createInitialState = () => ({
  schemaVersion: SCHEMA_VERSION,
  meta: { name: 'My Design System', description: '', version: 'alpha' },
  macros: { ...DEFAULT_MACROS },
  color: {
    seeds: [
      { id: 'sd-accent',  name: 'accent',  hex: '#b8422e', desc: 'Primary action and emphasis' },
      { id: 'sd-neutral', name: 'neutral', hex: '#7a736c', desc: 'Surfaces, text, borders' },
      { id: 'sd-success', name: 'success', hex: '#3f8f63', desc: 'Confirmation' },
      { id: 'sd-warning', name: 'warning', hex: '#c08a2e', desc: 'Caution' },
      { id: 'sd-danger',  name: 'danger',  hex: '#c2453c', desc: 'Destructive and errors' },
    ],
    shape: { ...DEFAULT_SHAPE },
    roles: defaultRoles(),
    stepOverrides: {},   // 'accent.600' → '#hex'
    roleOverrides: {},   // 'accent:light' → '#hex'
    custom: [],          // preserved verbatim from imported files
    mode: 'light',
    emitRamps: true,
    emitDark: true,
  },
  /* Legacy flat lists — still driving the not-yet-migrated tabs.
     Phase 2 replaces these with generated scales. */
  typography: [
    { id: 't1', name: 'h1',      fontFamily: 'Georgia', fontSize: '48px', fontWeight: '700', lineHeight: '1.1', letterSpacing: '-0.02em', fontFeature: '', fontVariation: '' },
    { id: 't2', name: 'h2',      fontFamily: 'Georgia', fontSize: '32px', fontWeight: '700', lineHeight: '1.2', letterSpacing: '-0.015em', fontFeature: '', fontVariation: '' },
    { id: 't3', name: 'h3',      fontFamily: 'Georgia', fontSize: '24px', fontWeight: '600', lineHeight: '1.3', letterSpacing: '-0.01em', fontFeature: '', fontVariation: '' },
    { id: 't4', name: 'body-md', fontFamily: 'Georgia', fontSize: '16px', fontWeight: '400', lineHeight: '1.6', letterSpacing: '', fontFeature: '', fontVariation: '' },
    { id: 't5', name: 'body-sm', fontFamily: 'Georgia', fontSize: '14px', fontWeight: '400', lineHeight: '1.55', letterSpacing: '', fontFeature: '', fontVariation: '' },
    { id: 't6', name: 'caption', fontFamily: 'Georgia', fontSize: '12px', fontWeight: '400', lineHeight: '1.4', letterSpacing: '0.01em', fontFeature: '', fontVariation: '' },
  ],
  rounded: [
    { id: 'r1', name: 'sm', value: '4px' },
    { id: 'r2', name: 'md', value: '8px' },
    { id: 'r3', name: 'lg', value: '16px' },
    { id: 'r4', name: 'full', value: '9999px' },
  ],
  spacing: [
    { id: 's1', name: 'xs', value: '4px' },
    { id: 's2', name: 'sm', value: '8px' },
    { id: 's3', name: 'md', value: '16px' },
    { id: 's4', name: 'lg', value: '32px' },
    { id: 's5', name: 'xl', value: '64px' },
  ],
  components: [],
  prose: emptyProse(),
})

export { uid, emptyProse, defaultRoles }
