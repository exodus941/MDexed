/* Pipeline regression test: derivation, macros, spec conformance, round trip.
   Run with `npm test`. No framework — plain assertions over the pure layer,
   which is where the correctness risk actually lives. */
/* Registers a loader for Vite's `?raw` CSS imports, so the emit layer is
   reachable from plain Node. It must be its own file, because a static graph
   resolves before anything in it evaluates. See test/css-hook.mjs. */
import './css-hook.mjs'
import fs from 'node:fs'
import { load as yamlLoad } from 'js-yaml'
import { createInitialState, CONTRAST_PAIRS, ANTI_PATTERNS, pairFails } from '../src/state/schema.js'
import { derive, buildCssVars, Z_LAYERS } from '../src/state/derive.js'
import { migrate } from '../src/state/migrate.js'
import { isOnTypeGrid, isOnSpaceGrid } from '../src/state/grid.js'
import { applyPreset, PRESETS } from '../src/state/presets.js'
import { TAB_STYLES, COMPONENT_LIBRARY, classFor } from '../src/state/components.js'
import { audit, chooseFix } from '../src/a11y/audit.js'
import { toOklchObj, parseColor as parseColorFor } from '../src/color/convert.js'
import { check } from '../src/color/contrast.js'
import { TYPE_ROLES } from '../src/type/scale.js'
import { generateFile, validate } from '../src/emit/designmd.js'
import { parseFile } from '../src/emit/parse.js'
import { collectComponents } from '../src/emit/yaml.js'
import { tokensCss } from '../src/emit/tokens.js'
import { agentContract, checklistBytes, checklistLines, CONTRACT_MAX_LINES, CONTRACT_MAX_BYTES } from '../src/emit/agents.js'
import { payloadTextFiles, REQUIRED_FILES, EXAMPLE_PREFIX, HTML_EXAMPLES_MODES, exampleFilename, exampleModes } from '../src/emit/payload.js'
import { serializeProject, parseProject, projectFilename } from '../src/emit/project.js'
import { diffWords, diffStats } from '../src/ai/diff.js'
import { contextFor, refinePrompt, draftPrompt, systemPrompt } from '../src/ai/prompts.js'
import { PROSE_SECTIONS, TEXT_ROLES, SURFACE_ROLES, ALL_ROLES } from '../src/state/schema.js'
/* theme.js re-exports a `?raw` import, which is a Vite feature Node cannot
   resolve, so the chrome stylesheet is read from disk instead. */
const APP_CSS = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8')
/* The pure substitution, not the wired module. responsive.js imports the
   stylesheet with Vite's `?raw` suffix, which plain Node cannot resolve — it
   throws "Unknown file extension .css" before a single assertion runs. This
   imports the same transform the app uses and feeds it the same file, read
   from disk. */
import { readFileSync as readCssFile } from 'node:fs'
import { buildResponsiveCss } from '../src/preview/responsive.build.js'
import { titleCase, labeller } from '../src/preview/casing.js'
const RESPONSIVE_RULES = readCssFile(
  new URL('../src/preview/responsive.rules.css', import.meta.url), 'utf8')
const responsiveCss = (bps, mode) => buildResponsiveCss(RESPONSIVE_RULES, bps, mode)

const line = s => console.log(s)
let failures = 0
const assert = (cond, msg) => { if (!cond) { failures++; line(`  FAIL  ${msg}`) } else line(`  ok    ${msg}`) }

const state = createInitialState()
const derived = derive(state)
const px = (list, name) => list.find(x => x.name === name)?.value
const ty = (list, name) => list.find(t => t.name === name)

line('\n- colour -')
assert(Object.keys(derived.ramps).length === 5, '5 ramps built')
assert(/^#[0-9a-f]{6}$/i.test(derived.ramps.accent.steps[500]), `accent.500 is a hex (${derived.ramps.accent.steps[500]})`)
assert(derived.ramps.accent.anchor != null, `seed anchored at step ${derived.ramps.accent.anchor}`)
/* 28 since danger-hover joined the status group. Accent had a hover role from
   the start and danger did not, so a destructive button's hover resolved to
   the colour it already was. */
/* 30 since `row-stripe` and `selected` joined. Both exist because drawing a
   selectable, striped list found that neither had a role: the stripe was being
   improvised from `bg-subtle` and the selection from `accent-subtle`, and each
   was wrong for a measured reason.
 *
 * 31 since `accent-raised`. An avatar disc was drawn in `accent-subtle`, which
 * is a ground for accent TEXT and quiet on purpose: measured 1.13:1 against
 * the card in light and 1.11:1 in dark, so the circle vanished in both modes.
 * A shape has no words to carry it, which is a different requirement, so it is
 * a different role. */
assert(Object.keys(derived.roles.light).length === 31, `31 light roles (got ${Object.keys(derived.roles.light).length})`)

/* ── RTL GUIDANCE IS OPT-IN, AND THE REST IS DIRECTION-NEUTRAL ──
 *
 * Two halves. The general rules are logical whether the switch is on or not,
 * because `inline-start` costs a left-to-right build nothing. The RTL-specific
 * half is noise for a page that will never be Arabic, so it stays out.
 *
 * The second assertion is the one that matters over time: a rule written in
 * physical terms reads correctly today and cannot flip later. */
{
  const off = createInitialState()
  const offMd = payloadTextFiles(off, derive(off))['DESIGN.md']
  assert(!/## Right-to-left/.test(offMd), 'no right-to-left section by default')
  assert(!/\bdir="rtl"/.test(offMd), 'and no rtl instruction leaks into it')

  const on = createInitialState()
  on.meta.rtl = true
  const onMd = payloadTextFiles(on, derive(on))['DESIGN.md']
  assert(/## Right-to-left/.test(onMd), 'the section appears when the document asks for it')
  for (const must of ['dir="rtl"', 'clock', 'mirror']) {
    assert(onMd.toLowerCase().includes(must.toLowerCase()), `and it covers ${must}`)
  }

  /* The general rules never name a physical side for PLACEMENT, in either
     state. A stored setting may still be worded plainly for a person. */
  const physical = [/margin-left:/, /margin-right:/, /padding-left:/, /padding-right:/, /text-align: *right/, /text-align: *left/]
  for (const md of [offMd, onMd]) {
    for (const re of physical) {
      assert(!re.test(md), `no physical placement property in the rules (${re.source})`)
    }
  }
}

/* ── A SHAPE ROLE HOLDS ON EVERY PRESET, IN BOTH MODES ──
 *
 * `accent-raised` exists to draw a filled shape, so its own fill against the
 * card IS the requirement. Measure it on the WORST preset rather than the one
 * it was tuned against: a role checked on its best ground is a report that the
 * role is fine. 1.2 is the floor a shape needs, and `accent-subtle` measured
 * 1.13 light and 1.11 dark, which is what put an invisible avatar on screen. */
{
  const worst = { light: 99, dark: 99, text: 99, where: '' }
  for (const p of [null, ...PRESETS]) {
    const s = p ? applyPreset(p.id, createInitialState()) : createInitialState()
    for (const mode of ['light', 'dark']) {
      const r = derive(s, {}).roles[mode]
      const fill = r['accent-raised'], card = r.surface, text = r.text
      assert(!!fill, `accent-raised resolves in ${mode} (${fill})`)
      const vsCard = check(fill, card).ratio
      const onIt = check(text, fill).ratio
      if (vsCard < worst[mode]) { worst[mode] = vsCard; worst.where = p?.name ?? 'default' }
      worst.text = Math.min(worst.text, onIt)
    }
  }
  assert(worst.light >= 1.2, `a shape drawn in accent-raised is visible in light on every preset (worst ${worst.light.toFixed(2)} on ${worst.where})`)
  assert(worst.dark >= 1.2, `and in dark (worst ${worst.dark.toFixed(2)})`)
  assert(worst.text >= 4.5, `and its initials clear AA on it (worst ${worst.text.toFixed(2)})`)
  /* The fault it replaces, kept as a measurement so nobody reinstates it. */
  const sub = derived.roles.light['accent-subtle']
  assert(check(sub, derived.roles.light.surface).ratio < 1.2,
    `accent-subtle is still a GROUND, not a shape (${check(sub, derived.roles.light.surface).ratio.toFixed(2)})`)
}
assert(derived.roles.light.bg !== derived.roles.dark.bg, 'light and dark bg differ')

line('\n- generated scales -')
assert(derived.typography.length === TYPE_ROLES.length, `${TYPE_ROLES.length} type tokens generated`)
/* Assert the RULE, never the pixel. A test that pins 48.8px pins the fraction
   in place, and the next person to fix it has seven red assertions telling
   them the fix is the bug. */
assert(ty(derived.typography, 'h1').fontSize === '48px', `h1 from the modular scale (${ty(derived.typography, 'h1').fontSize})`)
const offGridType = derived.typography.filter(t => !isOnTypeGrid(parseFloat(t.fontSize))).map(t => `${t.name}=${t.fontSize}`)
assert(offGridType.length === 0, `every type size is on the grid (${offGridType.join(' ') || 'all clean'})`)
const offGridSpace = [...derived.spacing, ...derived.rounded]
  .filter(s => !s.pill && !isOnSpaceGrid(parseFloat(s.value))).map(s => `${s.name}=${s.value}`)
assert(offGridSpace.length === 0, `every space and radius step is on the grid (${offGridSpace.join(' ') || 'all clean'})`)
assert(parseFloat(ty(derived.typography, 'h1').lineHeight) < parseFloat(ty(derived.typography, 'caption').lineHeight),
  'leading tightens as type grows')
assert(parseFloat(ty(derived.typography, 'h1').letterSpacing) < 0, 'display tracking is negative')
assert(px(derived.spacing, 'md') === '16px', `spacing md (${px(derived.spacing, 'md')})`)
assert(px(derived.rounded, 'full') === '9999px', 'pill radius is a sentinel')
assert(derived.elevation.raised.includes('rgba'), 'raised shadow is tinted rgba')
assert(derived.elevation.flat === 'none', 'flat elevation is none')

line('\n- macros -')
assert(px(derive({ ...state, macros: { ...state.macros, density: 2 } }).spacing, 'md') === '32px', 'density 2 doubles md spacing')
const round2 = derive({ ...state, macros: { ...state.macros, roundness: 2 } })
assert(px(round2.rounded, 'full') === '9999px', 'pill radius is not scaled')
/* Assert the DOUBLING, not the pixel. This read `=== '16px'`, which was the
   answer at a base of 8 and pinned that base into a test about a macro. The
   base moved to 4 and the macro was never the thing that changed. */
assert(parseFloat(px(round2.rounded, 'md')) === 2 * parseFloat(px(derived.rounded, 'md')),
  `md radius doubles (${px(derived.rounded, 'md')} -> ${px(round2.rounded, 'md')})`)
const scaled = derive({ ...state, macros: { ...state.macros, scale: 1.5 } })
assert(ty(scaled.typography, 'h1').fontSize === '72px', `scale 1.5 lifts h1 (${ty(scaled.typography, 'h1').fontSize})`)
/* A macro moves every step and lands every one of them on the grid. The macro
   is continuous, so this is the case that used to produce 11.16px. */
const scaledOff = scaled.typography.filter(t => !isOnTypeGrid(parseFloat(t.fontSize))).map(t => `${t.name}=${t.fontSize}`)
assert(scaledOff.length === 0, `a scaled type set stays on the grid (${scaledOff.join(' ') || 'all clean'})`)
const dense = derive({ ...state, macros: { ...state.macros, density: 0.93 } })
const denseOff = dense.spacing.filter(s => !isOnSpaceGrid(parseFloat(s.value))).map(s => `${s.name}=${s.value}`)
assert(denseOff.length === 0, `density 0.93 stays on the grid (${denseOff.join(' ') || 'all clean'})`)
const overridden = derive({ ...state, macros: { ...state.macros, density: 2 }, space: { ...state.space, overrides: { md: '16px' } } })
assert(px(overridden.spacing, 'md') === '16px', 'an overridden step ignores its macro')
assert(px(overridden.spacing, 'lg') === '48px', 'its neighbours still follow the macro')
assert(derive({ ...state, macros: { ...state.macros, speed: 2 } }).motion.durations.normal === '500ms', 'speed doubles durations')
assert(derived.motion.durations.fast === '125ms' && derived.motion.durations.slow === '500ms', 'default durations are 125/250/500')

line('\n- fluid sizing -')
const fluid = derive({ ...state, type: { ...state.type, fluid: { ...state.type.fluid, enabled: true } } })
assert(ty(fluid.typography, 'h1').fontSize.startsWith('clamp('), `h1 emits a clamp (${ty(fluid.typography, 'h1').fontSize.slice(0, 40)}…)`)

line('\n- components -')
assert(derived.components.length > 30, `${derived.components.length} entries expanded`)
assert(derived.components.some(c => c.name === 'button-primary-hover'), 'variant states are flattened with hyphens')
assert(derived.components.some(c => c.name === 'button-sm'), 'sizes are flattened')
assert(derived.components.some(c => c.name === 'input-focus'), 'variant-less components hang states off the base name')
assert(!JSON.stringify(derived.components).includes('{elevation.'), 'elevation references resolve to literals')
assert(!JSON.stringify(derived.components).includes('{focus.'), 'focus references resolve to literals')
assert(derived.components.find(c => c.name === 'card').properties.some(p => p.key === 'boxShadow' && p.value.includes('rgba')),
  'card carries a real shadow value')
const off = derive({ ...state, components: { ...state.components, enabled: { button: false } } })
assert(!off.components.some(c => c.name.startsWith('button')), 'disabling a component removes all its entries')

line('\n- emit -')
const { text, omitted, dropped } = generateFile(state, derived)
assert(text.startsWith('---\n'), 'opens with frontmatter')
assert(omitted.length === 0, 'nothing is omitted once every section generates content')
assert(text.includes('## Elevation & Depth') && text.includes('## Motion'), 'has the Elevation and Motion sections')
assert(text.includes('Focus ring'), 'focus ring reaches the file')
assert(text.includes('Lucide'), 'icon library reaches the file')
assert(text.includes('Never introduce a colour'), 'anti-patterns reach the file')
assert(dropped.length > 0, `${[...new Set(dropped.map(d => d.key))].length} property kinds routed to prose`)

line('\n- spec conformance -')
const v = validate(text)
v.errors.forEach(e => line(`  ERROR ${e}`))
v.warnings.forEach(w => line(`  warn  ${w}`))
assert(v.ok, 'validates against the spec')
assert(v.warnings.length === 0, 'no unresolved token references')

line('\n- round trip -')
const rt = parseFile(text)
assert(rt.ok, `import succeeded${rt.error ? ` (${rt.error})` : ''}`)
const fm = s => /^---\n[\s\S]*?\n---/.exec(s)[0]
const rtText = generateFile(rt.state, derive(rt.state)).text
/* The YAML layer must survive exactly. The prose layer cannot: properties
   outside the spec's legal eight only ever live in generated markdown, which
   import strips by design — so the requirement is that the loss is reported,
   not that it doesn't happen. */
assert(fm(rtText) === fm(text), 'export, import, export leaves the frontmatter byte-identical')
assert(rt.warnings.some(w => /not recovered/.test(w)), 'the prose-only loss is reported rather than silent')
const authored = { ...state, prose: { ...state.prose, colors: 'Warm neutrals with one rust accent.' } }
const reimported = parseFile(generateFile(authored, derive(authored)).text)
assert(reimported.state.prose.colors === 'Warm neutrals with one rust accent.',
  'generated tables are stripped from prose on import')

line('\n- migration -')
const v1 = { meta: { name: 'Old' }, colors: [{ id: 'c1', name: 'primary', value: '#3355ff' }], typography: [{ id: 't1', name: 'h1', fontSize: '40px', fontWeight: '800' }], spacing: [{ id: 's1', name: 'md', value: '20px' }], rounded: [], components: [], prose: {} }
const m1 = migrate(v1)
assert(m1.state.schemaVersion === 3 && m1.migratedFrom === 1, 'v1 migrates to v3')
assert(m1.state.color.seeds.find(s => s.name === 'accent').hex === '#3355ff', 'v1 primary becomes the accent seed')
assert(m1.state.type.overrides['h1.fontSize'] === '40px', 'a matching type token folds into an override')
assert(px(derive(m1.state).spacing, 'md') === '20px', 'a matching spacing token folds into an override')
const m2 = migrate({ schemaVersion: 2, meta: { name: 'Two' }, typography: [{ name: 'hero', fontSize: '90px' }], components: [{ name: 'widget', properties: [{ key: 'padding', value: '4px' }] }] })
assert(m2.state.type.custom.some(t => t.name === 'hero'), 'an unmatched type token is kept as custom')
assert(m2.state.components.custom.some(c => c.name === 'widget'), 'v2 components are kept')
assert(m2.state.components.enabled.button === false, 'imported components switch off the built-in set, so nothing doubles')
assert(derive(m2.state).components.filter(c => c.name === 'widget').length === 1, 'and each entry appears exactly once')

/* A saved document carries its own copy of the anti-pattern checklist. Spread
   it and the document freezes at the length it had when it was saved, so every
   constraint added afterwards silently reaches new documents only. Nothing
   about that looks broken from the outside. */
const stale = migrate({
  schemaVersion: 3,
  directives: { antiPatterns: [{ id: 'pure-black', text: 'stale wording', on: false }] },
})
const ap = stale.state.directives.antiPatterns
assert(ap.length === ANTI_PATTERNS.length, 'a document saved with a short checklist gets the current one')
assert(ap.find(a => a.id === 'pure-black').on === false, 'and a choice already made is kept')
assert(ap.some(a => a.id === 'control-height' && a.on), 'while a newly added constraint arrives at its default')
assert(!ap.some(a => a.id === 'gone'), 'an id that no longer exists is dropped')

line('\n- presets -')
for (const p of PRESETS) {
  const s = applyPreset(p.id, state)
  const d = derive(s)
  const r = validate(generateFile(s, d).text)
  assert(r.ok && r.warnings.length === 0, `${p.label} produces a clean file`)
}

line('\n- preview fidelity -')
const fmYaml = yamlLoad(/^---\n([\s\S]*?)\n---/.exec(text)[1])
const lightVars = buildCssVars(derived, 'light')
assert(lightVars['--c-bg'] === fmYaml.colors.bg, `--c-bg matches colors.bg (${lightVars['--c-bg']})`)
assert(buildCssVars(derived, 'dark')['--c-bg'] === fmYaml.colors['dark-bg'], 'dark vars match dark tokens')
assert(lightVars['--space-md'] === fmYaml.spacing.md, '--space-md matches spacing.md')
assert(lightVars['--radius-lg'] === fmYaml.rounded.lg, '--radius-lg matches rounded.lg')
assert(lightVars['--font-h1-size'] === fmYaml.typography.h1.fontSize, '--font-h1-size matches typography.h1')
assert(lightVars['--focus-width'] === '2px', 'focus width reaches the preview vars')
assert(buildCssVars(derive({ ...state, macros: { ...state.macros, density: 1.5 } }), 'light')['--space-md'] === '24px',
  'macros flow through to the preview vars')

/* ── A preset is a default someone chose on purpose ──
 *
 * The README's argument about defaults applies here with more force: shipping
 * a palette that fails the audit the moment it is applied teaches people to
 * ignore the audit. Three of the six were doing exactly that — fourteen
 * failures between them — because the presets were written before the
 * colour-blindness check existed and nobody re-ran them.
 *
 * This is the guard rather than the fix. A palette that cannot survive having
 * its hue removed does not ship.
 */
line('\n- every preset passes the audit it ships with -')
for (const p of PRESETS) {
  const s = applyPreset(p.id, state)
  const fails = audit(s, derive(s)).filter(f => f.level === 'fail')
  const what = [...new Set(fails.map(f => f.title))].slice(0, 2).join(' | ')
  assert(fails.length === 0, `${p.id}: ${fails.length ? `${fails.length} failing — ${what}` : 'clean'}`)
}

/* ── Everything the file names, the stylesheet emits ──
 *
 * DESIGN.md documented `hairline` and `thick` border widths in its Shapes
 * section and tokens.css never emitted them. An agent reads that table, writes
 * `var(--border-hairline)`, and the whole declaration dies — an undefined
 * custom property with no fallback is invalid at computed-value time, so the
 * border silently falls back to currentColor. It renders as a design choice
 * rather than as an error, which is why three simulated pages shipped with it.
 *
 * Documented and missing is worse than absent. Absent gets noticed.
 */
line('\n- every token the file names exists in the stylesheet -')
{
  const css = Object.keys(buildCssVars(derived, 'light'))
  const groups = [
    ['border', Object.keys(state.radius?.borderWidths ?? {})],
    ['radius', derived.rounded.map(r => r.name)],
    ['space', derived.spacing.map(s => s.name)],
    ['icon', Object.keys(state.icons?.sizes ?? {})],
  ]
  for (const [prefix, names] of groups) {
    const missing = names.filter(n => !css.includes(`--${prefix}-${n}`))
    assert(missing.length === 0,
      `${prefix}: ${missing.length ? `missing ${missing.map(n => `--${prefix}-${n}`).join(', ')}` : `all ${names.length} emitted`}`)
  }
}

line('\n- default palette passes its own checks -')
for (const mode of ['light', 'dark']) {
  const fails = CONTRAST_PAIRS.map(p => {
    const r = check(derived.roles[mode][p.fg], derived.roles[mode][p.bg])
    /* `pairFails` decides, here and in all four other places. The rule was
       written out five times, and when `exempt` arrived for disabled text only
       three of the five learned about it. */
    return pairFails(p, r) ? `${p.label} ${r.ratio}:1` : null
  }).filter(Boolean)
  assert(fails.length === 0, `${mode} mode: ${fails.length ? fails.join(' | ') : 'all pairs pass'}`)
}

line('\n- contrast surfacing -')
const lowContrast = derive({ ...state, color: { ...state.color, roleOverrides: { 'text:light': '#d0d0d0', 'bg:light': '#d4d4d4' } } })
const badPair = check(lowContrast.roles.light.text, lowContrast.roles.light.bg)
assert(!badPair.pass && badPair.label === 'Fail', `a deliberately broken pair reports Fail (${badPair.ratio}:1)`)

line('\n- malformed input -')
const broken = parseFile('---\nname: [unclosed\n---\n\n## Overview\nhi')
assert(!broken.ok && broken.state === null, 'malformed YAML refuses to load rather than wiping state')
assert(/line \d+/.test(broken.error), 'the error names a line')
assert(!parseFile('# just a readme\n\nnothing here').ok, 'a file with no frontmatter is rejected')

line('\n- component composition -')
{
  const { LAYOUT_BY_NAME, resolveAllLayouts, layoutRows, layoutSentences, fieldActive } =
    await import('../src/state/componentLayout.js')
  const modal = LAYOUT_BY_NAME.modal

  /* A document written before composition existed must still resolve. */
  const bare = resolveAllLayouts(undefined).modal
  assert(modal.fields.every(f => bare[f.k] === f.default), 'an absent layout resolves to every default')
  assert(derive({ ...state, components: { ...state.components, layout: undefined } }).componentLayout.modal.align === 'left',
    'derive fills composition defaults for an older document')

  const partial = resolveAllLayouts({ modal: { align: 'center' } }).modal
  assert(partial.align === 'center' && partial.actions === 'right', 'a partial layout keeps defaults for the rest')

  /* Icon size and treatment are meaningless with no icon, and must not be
     emitted as rules the agent would then try to follow. */
  const noIcon = { ...bare, iconPlacement: 'none' }
  assert(!fieldActive(modal.fields.find(f => f.k === 'iconSize'), noIcon), 'icon size hides when there is no icon')
  assert(!layoutRows(modal, noIcon).some(([l]) => /Icon size|Icon treatment/.test(l)),
    'dependent settings are left out of the table when inactive')

  const custom = { ...bare, align: 'center', iconPlacement: 'above', iconSize: 'xl', actions: 'stretch' }
  const sentences = layoutSentences(modal, custom)
  assert(sentences.length === layoutRows(modal, custom).length, 'every emitted row has a matching rule')
  assert(sentences.some(s => /above the title/.test(s)) && sentences.some(s => /full-width/.test(s)),
    'the rules describe the arrangement, not just the setting name')

  const withLayout = { ...state, components: { ...state.components, layout: { modal: custom } } }
  const file = generateFile(withLayout, derive(withLayout)).text
  assert(file.includes('| Icon placement | `above`'), 'composition reaches the exported file as a table')
  assert(file.includes('Actions stack full-width'), 'composition reaches the exported file as guidance')

  /* Composition is guidance, not frontmatter — the spec has no slot for it. */
  const fm = yamlLoad(file.split('---')[1])
  assert(!JSON.stringify(fm).includes('iconPlacement'), 'composition never leaks into the frontmatter')
  assert(validate(file).ok, 'a document with composition still validates')
}

line('\n- word diff -')
{
  /* Shared words carry the rewrite's whitespace, so compare on words alone. */
  const rejoin = (parts, keep) =>
    parts.filter(p => keep.includes(p.type)).map(p => p.text).join('').replace(/\s+/g, ' ').trim()
  const before = 'The accent is reserved for the primary action on a screen.'
  const after  = 'Reserve the accent for the single primary action on a screen.'
  const parts  = diffWords(before, after)
  assert(rejoin(parts, ['same', 'remove']) === before, 'same + removed reconstructs the original')
  assert(rejoin(parts, ['same', 'add']) === after, 'same + added reconstructs the rewrite')
  assert(parts.some(p => p.type === 'same' && /screen/.test(p.text)), 'unchanged words are marked same')

  const stats = diffStats(parts)
  assert(stats.changed && stats.added > 0 && stats.removed > 0, `stats count both sides (+${stats.added} -${stats.removed})`)
  assert(!diffStats(diffWords(before, before)).changed, 'an identical rewrite reports no change')
  assert(!diffStats(diffWords('one   two', 'one two')).changed, 'reflowed whitespace alone is not a change')
  assert(diffWords('', 'brand new text').every(p => p.type === 'add'), 'drafting from empty is all additions')
  assert(diffWords('abc', '').every(p => p.type === 'remove'), 'clearing is all removals')
}

line('\n- prompt construction -')
{
  assert(/never invent/i.test(systemPrompt()), 'the system prompt forbids inventing tokens')
  for (const s of PROSE_SECTIONS) {
    const ctx = contextFor(s.k, state, derived)
    assert(ctx.length > 0 && !/undefined|\[object/.test(ctx), `${s.k}: context resolves without holes`)
  }
  const refine = refinePrompt(PROSE_SECTIONS[1], 'Teal because it is calm.', state, derived)
  assert(refine.includes('Teal because it is calm.'), 'refine carries the author’s text verbatim')
  assert(refine.includes(derived.roles.light.accent), 'refine carries the real accent value')
  const draft = draftPrompt(PROSE_SECTIONS[2], state, derived)
  assert(draft.includes(state.type.families.display.family), 'draft carries the real display family')

  /* Given only the display face, a model fills the gap with "system
     sans-serif" and states a rule the system doesn't contain. */
  const overview = contextFor('overview', state, derived)
  for (const role of ['display', 'body', 'mono']) {
    assert(overview.includes(state.type.families[role].family), `overview names the ${role} face`)
  }
  const longest = Math.max(...PROSE_SECTIONS.map(s => draftPrompt(s, state, derived).length + systemPrompt().length))
  assert(longest < 24_000, `the largest prompt stays under the server cap (${longest} chars)`)
}


/* ── Stylesheets are stylesheets ──
 *
 * Both sheets used to be one enormous backtick string, and a backtick typed
 * inside a CSS comment terminated the literal early. The file still parsed,
 * the app rendered nothing, and the build could stay green because the
 * resulting error landed somewhere unrelated. It happened five times.
 *
 * Both are .css files now, read with ?raw, where a backtick is an ordinary
 * character and the bug cannot be written. This guard remains as the check
 * that they are still *whole* — a truncated or half-saved sheet cannot contain
 * the rule that closes it — and as the thing that fails loudly if either is
 * ever moved back into JavaScript.
 *
 * Read from disk rather than imported: Node cannot resolve Vite's ?raw. */
{
  line('\n- stylesheets -')
  const BT = String.fromCharCode(96)
  const PREVIEW_CSS = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const sheets = [
    ['APP_CSS', APP_CSS, '.dropzone'],
    ['PREVIEW_CSS', PREVIEW_CSS, '.dmd .nav-item'],
  ]
  /* The structural claim, asserted rather than trusted: neither sheet lives in
     a template literal any more. */
  for (const f of ['../src/ui/theme.js', '../src/preview/tokens.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8')
    assert(!new RegExp('CSS = ' + BT).test(src), `${f.split('/').pop()} holds no CSS template literal`)
  }
  for (const [name, css, tail] of sheets) {
    /* Reaching the closing rule is the real test. An escaped backtick is
       legal and harmless — it lands in a CSS comment and nothing cares — so
       flagging every backtick cries wolf. What cannot happen is the literal
       ending early, and a truncated sheet cannot contain its own last rule. */
    assert(css.includes(tail), `${name} runs to the end (${tail} present)`)
    assert(css.split('{').length === css.split('}').length, `${name} has balanced braces`)
    assert(!/`\s*$/.test(css), `${name} does not end mid-literal`)
  }
}

/* ── Reference mapping ──
 *
 * Inference, so it can only be tested against cases with a right answer. Two:
 * a modern stylesheet where every slot is named, and an old one with no custom
 * properties where the only signal is hue. The second is the one that rots —
 * it depends on pass ordering, and getting that wrong is silent. */
{
  line('\n- reference mapping -')
  const { readCss } = await import('../src/emit/cssImport.js')
  const { mapReference, toImport } = await import('../src/emit/cssMap.js')

  const named = readCss(`:root{
    --color-brand-primary:#4f46e5; --color-brand-primary-hover:#4338ca;
    --color-gray-50:#f9fafb; --color-gray-500:#6b7280; --color-gray-900:#111827;
    --color-success-600:#059669; --color-warning-500:#f59e0b; --color-error-600:#dc2626;
    --font-sans:"Inter",sans-serif; --font-mono:"JetBrains Mono",monospace;
    --font-size-base:16px; --space-unit:4px; --radius-md:8px; --seafoam:#7fd4c1; }`)
  const a = mapReference(named).proposals

  assert(a.accent?.value === '#4f46e5', 'named: brand beats its own hover state')
  assert(a.neutral?.value === '#6b7280', 'named: the 500 step beats 50 and 900')
  assert(a.success?.value === '#059669', 'named: success')
  assert(a.danger?.value === '#dc2626', 'named: error maps to danger')
  assert(a.fontMono?.value === 'JetBrains Mono', 'named: mono face')
  assert(a.spacingBase?.value === 4 && a.radiusBase?.value === 8, 'named: measurements')
  assert(Object.values(a).every(p => p.confidence === 'named'), 'named: nothing fell back to inference')
  assert(mapReference(named).unmatched.some(v => v.name === 'seafoam'),
    'named: an unrecognised name is offered rather than dropped')

  /* No custom properties at all. Status slots have hue priors and must claim
     before accent, which has none — otherwise accent eats the green. */
  const bare = readCss(`
    a{color:#b5651d} .btn-primary{background:#b5651d;padding:10px 20px;border-radius:6px}
    .alert-ok{color:#1e7b34;border:1px solid #1e7b34}
    .alert-warn{color:#a37b12} .alert-bad{color:#c0392b}
    .muted{color:#777777} body{font-size:16px}`)
  const b = mapReference(bare).proposals

  assert(b.success?.value === '#1e7b34', 'bare: the green goes to success, not accent')
  assert(b.accent?.value === '#b5651d', 'bare: accent takes what the status hues left')
  assert(b.danger?.value === '#c0392b', 'bare: danger by hue')
  assert(b.neutral?.value === '#777777', 'bare: mid grey for the neutral')
  assert(Object.values(b).every(p => p.confidence === 'inferred'), 'bare: everything marked inferred')

  /* Confirmation is what makes proposing this much safe. */
  const only = toImport(a, new Set(['accent', 'spacingBase']))
  assert(only.seeds.accent === '#4f46e5' && only.spacingBase === 4, 'toImport: accepted slots carry')
  assert(only.radiusBase === undefined && !only.seeds.danger,
    'toImport: an unchecked slot is absent, so the document keeps its own value')
}

/* ── Source encoding ──
 *
 * A placeholder rendered as "gap, colourâ€¦" in the running app. The file had
 * been read as Latin-1 and written back as UTF-8 somewhere in a batch edit, so
 * every em-dash and ellipsis in it became three characters. It survived a
 * build, a test run and a deploy, because nothing here was looking — mojibake
 * is valid JavaScript.
 *
 * `â€` cannot occur in correctly-encoded prose, and a BOM has no business in a
 * source file, so both are cheap to assert and catch the whole family. */
{
  /* ── The examples obey the file they ship beside ──
   *
   * The six surfaces are the most-copied thing in the payload: an agent
   * imitates working markup far more readily than it follows a sentence. They
   * were written as pictures, so they broke four of the rules the document
   * states — nav items that could not be tabbed to, icons a screen reader read
   * aloud, no landmark, no reduced-motion policy. None of that is visible, so
   * nothing was going to catch it by eye.
   */
  line('\n- exported examples follow their own accessibility rules -')
  {
    const src = new URL('../src/preview/', import.meta.url)
    const read = p => fs.readFileSync(new URL(p, src), 'utf8')
    const screens = fs.readdirSync(new URL('screens/', src)).filter(f => f.endsWith('.jsx'))
    assert(screens.length >= 5, `found the surfaces (${screens.length})`)

    const markup = screens.map(f => read(`screens/${f}`)).join('\n')
    assert(!/<span className="nav-item"/.test(markup),
      'no navigation item is a span — a span cannot be tabbed to or announced')
    assert(/aria-hidden="true"/.test(read('icons.jsx')),
      'decorative icons are hidden from screen readers')
    assert(/prefers-reduced-motion/.test(read('preview.css')),
      'the stylesheet honours the reduced-motion policy the document declares')

    /* Anything that looks like navigation needs the landmark around it. */
    for (const f of screens) {
      const s = read(`screens/${f}`)
      if (!/className="nav-item"/.test(s)) continue
      assert(/<nav\b/.test(s), `${f} wraps its navigation in a nav landmark`)
    }
  }

  line('\n- source encoding -')
  const root = new URL('../src/', import.meta.url)
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = new URL(e.name + (e.isDirectory() ? '/' : ''), dir)
    return e.isDirectory() ? walk(p) : (/\.(jsx?|css)$/.test(e.name) ? [p] : [])
  })
  const files = walk(root)
  const bad = []
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    if (/Ã¢â|â€|Â[ ·]/.test(text)) bad.push(`${f.pathname.split('/src/')[1]} (mojibake)`)
    if (text.charCodeAt(0) === 0xFEFF) bad.push(`${f.pathname.split('/src/')[1]} (BOM)`)
  }
  assert(files.length > 40, `walked the source tree (${files.length} files)`)
  assert(bad.length === 0, `every source file is clean UTF-8${bad.length ? ` — ${bad.join(', ')}` : ''}`)
}

/* ── Shared constants are actually imported ──
 *
 * Twice now a shared constant has been referenced in a file that never
 * imported it — PAD and BTN once, MODAL_BTN again — and both times the build
 * passed. It has to: an undefined identifier is a runtime ReferenceError, not
 * a syntax error, so nothing fails until the component renders. The second one
 * blanked the whole app the moment you clicked Preview design.md.
 *
 * This is what a linter would catch, and there isn't one. Narrow substitute:
 * every SCREAMING_CASE identifier a source file uses has to be declared or
 * imported in that file. That is the exact shape of the constants that keep
 * getting missed, and it is cheap enough to run on every commit. */
{
  line('\n- shared constants are imported -')
  const root = new URL('../src/', import.meta.url)
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = new URL(e.name + (e.isDirectory() ? '/' : ''), dir)
    return e.isDirectory() ? walk(p) : (/\.jsx?$/.test(e.name) ? [p] : [])
  })
  /* Browser and language globals that legitimately look like constants. */
  const GLOBAL = new Set(['NaN', 'Infinity', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number',
    'Boolean', 'Date', 'Set', 'Map', 'Promise', 'RegExp', 'Error', 'URL', 'CSS', 'DataTransfer'])
  const missing = []
  for (const f of walk(root)) {
    /* Raw source, deliberately. The first version stripped comments and
       strings first, which needs a parser to do correctly — a quote inside a
       regex literal (`["']` in cssImport) opened a string that swallowed the
       declarations after it, and four real constants were reported missing.
       Scanning raw over-collects names that only appear in prose, but those
       are declared or imported in the same file anyway, so they resolve. */
    const code = fs.readFileSync(f, 'utf8')
    /* Only names in a position where they are evaluated: straight after `=`,
       `{`, `,`, `(`, or a spread. That is where `style={MODAL_BTN}` and
       `{...MODAL_BTN}` live, which is the shape that keeps getting missed.
       A name merely discussed in a comment, or written as
       `OPENROUTER_API_KEY=sk-...` in a help string, sits before the `=` rather
       than after it and is correctly ignored. */
    /* A loop head is an evaluated position too, and it contains no
       punctuation this pattern watches. A constant iterated as
       `for (const r of TEXT_ROLES)` and imported nowhere sat outside the net
       entirely, so the check passed a file that would throw on load.
       Matched as a whole `for (…of NAME)` rather than on the keyword: a bare
       `\bin\s+NAME` is ordinary English and found `in PREVIEW_CSS` inside a
       comment on the first run. A check that fires on correct code is a
       defect in the check. */
    const used = new Set([
      ...[...code.matchAll(/[={,(]\s*(?:\.\.\.)?\s*([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g)].map(m => m[1]),
      ...[...code.matchAll(/\bfor\s*\([^()]*\b(?:of|in)\s+([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\s*\)/g)].map(m => m[1]),
    ])
    for (const name of used) {
      if (GLOBAL.has(name)) continue
      /* Any assignment counts as a declaration, not just `const NAME`. A
         single `const A = 1, B = 2` declares B without the keyword touching
         it, and a name that is merely *used* never appears to the left of an
         `=`. Also covers `function NAME`. */
      const declared = new RegExp(`\\b${name}\\s*=[^=]`).test(code)
        || new RegExp(`function\\s+${name}\\b`).test(code)
      const imported = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(code)
      /* A destructure from a dynamic import brings the name into scope just as
         a static import does, and App.jsx uses one to keep the payload
         emitters out of the main bundle. Without this the check fired on
         correct code, which is a defect in the check and not in the code.
         Kept tight: the name must sit inside a destructuring pattern that is
         assigned from an `await`, so a genuinely missing import still fails. */
      const awaited = new RegExp(`\\{[^{}]*\\b${name}\\b[^{}]*\\}[^=]*=\\s*await\\b`).test(code)
      if (!declared && !imported && !awaited) missing.push(`${f.pathname.split('/src/')[1]}: ${name}`)
    }
  }
  assert(missing.length === 0, `every shared constant is in scope${missing.length ? ` — ${missing.slice(0, 5).join(', ')}` : ''}`)

  /* Same failure, different shape: a *component* used but not imported.
   *
   * The constants check above only looks at SCREAMING_CASE, so when TabStrip
   * moved out of App.jsx it caught the four scroll constants left behind and
   * said nothing about `Strut`, which the strip also used. The app compiled and
   * then threw the moment a tab strip rendered.
   *
   * A JSX opening tag is unambiguous — `<Name` with a capital is always an
   * identifier that has to resolve, never prose and never a string. That makes
   * this cheap and free of the false positives the constants scan has to work
   * around. */
  const missingTags = []
  for (const f of walk(root)) {
    const raw = fs.readFileSync(f, 'utf8')
    /* ── A JSDoc GENERIC IS NOT A JSX TAG ──
     *
     * `@returns Promise<Blob>` matched, and the check reported `Blob` as an
     * unresolved component. The tag pattern is unambiguous in CODE and not in
     * a comment, where `<Name>` is ordinary type notation.
     *
     * Blanked rather than deleted, so nothing below a comment shifts. This
     * check names a file and an identifier and no line, but the habit is the
     * point: removing a comment takes its newlines with it. */
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
    const tags = new Set([...code.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map(m => m[1]))
    for (const name of tags) {
      const declared = new RegExp(`\\b(?:function|const|let|class)\\s+${name}\\b`).test(code)
      const imported = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(code)
      /* A component can arrive by destructuring rather than by name.
         Canvas does `const { Component } = SURFACES.find(...)` and then renders
         `<Component />`, which is correct and which the two tests above both
         miss. Covers a binding pattern and a destructured function parameter. */
      const destructured =
        new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=`).test(code) ||
        new RegExp(`\\(\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*\\)\\s*=>`).test(code) ||
        new RegExp(`function\\s+\\w*\\s*\\(\\s*\\{[^}]*\\b${name}\\b`).test(code)
      if (!declared && !imported && !destructured) missingTags.push(`${f.pathname.split('/src/')[1]}: ${name}`)
    }
  }
  assert(missingTags.length === 0,
    `every JSX component is in scope${missingTags.length ? ` — ${missingTags.slice(0, 5).join(', ')}` : ''}`)
}

/* ── The agent contract stays short ──
 *
 * A long contract competes with the DESIGN.md it introduces, and agents skim.
 * These ceilings are dev-time only. Nothing at runtime reads them, so a user
 * exporting a payload can never hit them. They fail here, when the template is
 * edited, which is the moment the warning is useful.
 *
 * Worst case is measured across every preset plus a pathological project name,
 * because the name is the only input that can move the length. */
{
  const cases = [
    ...PRESETS.map(p => ({ label: p.id, state: applyPreset(p.id, state) })),
    { label: 'no name', state: { ...state, meta: {} } },
    { label: '400-char name', state: { ...state, meta: { ...state.meta, name: 'x'.repeat(400) } } },
  ]
  let worstLines = 0, worstBytes = 0, worstLabel = ''
  let namesOk = true, checklistOk = true
  for (const c of cases) {
    const d = derive(c.state)
    for (const filename of ['AGENTS.md', 'CLAUDE.md']) {
      const text = agentContract(c.state, d, { filename })
      /* The PROSE, with the generated checklist subtracted. BOTH caps measure
         it. The cap exists because a long contract competes with the DESIGN.md
         it introduces, and the prose is the half that gets skimmed. The
         checklist grows with the rule set on purpose, so it must not have to
         buy its place by shaving an unrelated sentence.
       *
         The line cap was left measuring the whole file for one argument
         longer, and then two new checks in a session took it over: the fix on
         offer was to delete a sentence somewhere unrelated. A bullet is one
         line per rule by construction, so the checklist's height needs no
         policing either. */
      const lines = text.split('\n').length - checklistLines()
      const bytes = Buffer.byteLength(text, 'utf8') - checklistBytes()
      if (lines > worstLines) { worstLines = lines; worstLabel = c.label }
      worstBytes = Math.max(worstBytes, bytes)
      /* Each copy must point at its twin, never at itself, or an agent that
         obeys "read only one" reads this one twice and never the other. */
      const twin = filename === 'AGENTS.md' ? 'CLAUDE.md' : 'AGENTS.md'
      if (!text.includes(twin) || text.includes(`identical to\n${filename}`)) namesOk = false
      if (!text.includes('Before you say you are done')) checklistOk = false
    }
  }
  assert(worstLines <= CONTRACT_MAX_LINES,
    `contract within ${CONTRACT_MAX_LINES} lines (worst ${worstLines}, ${worstLabel}, ${Math.round((CONTRACT_MAX_LINES - worstLines) * 100 / CONTRACT_MAX_LINES)}% spare)`)
  assert(worstBytes <= CONTRACT_MAX_BYTES,
    `contract within ${CONTRACT_MAX_BYTES} bytes (worst ${worstBytes}, ${Math.round((CONTRACT_MAX_BYTES - worstBytes) * 100 / CONTRACT_MAX_BYTES)}% spare)`)
  assert(namesOk, 'each contract copy points at its twin, not itself')
  assert(checklistOk, 'contract keeps its before-you-finish checklist')
}

/* ── THE ARCHIVE IS SMALLER, AND STILL AN ARCHIVE ──
 *
 * Deflate is not a free win if the headers are wrong. The CRC and the
 * uncompressed size are always of the ORIGINAL bytes, in both the local
 * header and the central directory. Take either from the compressed copy and
 * the archive opens, lists its files, and reports every one as corrupt.
 *
 * So this does not merely measure the size. It unzips the result with a tool
 * that did not write it, and compares the bytes back. Node's own zlib inflates
 * the entry, which is the same check any unzip program runs.
 *
 * The entry method is checked too. Deflate can make a SHORT file larger, so
 * the writer stores those, and a run where everything came out stored would
 * otherwise pass this silently. */
{
  const { zip } = await import('../src/emit/zip.js')
  const zlib = await import('node:zlib')
  const files = payloadTextFiles(state, derived)
  const raw = Object.values(files).reduce((n, t) => n + Buffer.byteLength(t, 'utf8'), 0)
  const blob = await zip(files, new Date(2026, 0, 1))
  const buf = Buffer.from(await blob.arrayBuffer())

  assert(buf.length < raw, `the archive is smaller than its contents (${buf.length} of ${raw})`)
  assert(buf.readUInt32LE(0) === 0x04034b50, 'it starts with a local file header')

  /* Walk the entries and inflate each one back. */
  let at = 0, checked = 0, deflated = 0
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const method = buf.readUInt16LE(at + 8)
    const crc = buf.readUInt32LE(at + 14)
    const packedLen = buf.readUInt32LE(at + 18)
    const rawLen = buf.readUInt32LE(at + 22)
    const nameLen = buf.readUInt16LE(at + 26)
    const name = buf.subarray(at + 30, at + 30 + nameLen).toString('utf8')
    const body = buf.subarray(at + 30 + nameLen, at + 30 + nameLen + packedLen)
    const back = method === 8 ? zlib.inflateRawSync(body) : body
    assert(back.length === rawLen, `${name}: the stated size matches what came back (${rawLen})`)
    assert(back.toString('utf8') === files[name], `${name}: the bytes survive the round trip`)
    assert(zlib.crc32 ? zlib.crc32(back) === crc : true, `${name}: the CRC is of the original bytes`)
    if (method === 8) deflated++
    checked++
    at += 30 + nameLen + packedLen
  }
  assert(checked === Object.keys(files).length, `every entry was read back (${checked})`)
  assert(deflated > 0, `and at least one is actually deflated (${deflated} of ${checked})`)
}

/* ── The payload contains what its own README promises ──
 *
 * The README prints a table of the files in the zip. Nothing stopped that
 * table from naming a file the manifest no longer produced, and the failure
 * would only show up when someone unzipped it. */
{
  const files = payloadTextFiles(state, derived)
  const missing = REQUIRED_FILES.filter(f => !files[f])
  assert(missing.length === 0, `payload has every required file${missing.length ? ` — missing ${missing.join(', ')}` : ` (${REQUIRED_FILES.length})`}`)
  assert(Object.values(files).every(t => typeof t === 'string' && t.length > 0), 'no payload file is empty')

  /* Every filename the README names in backticks must actually be produced,
     apart from the examples folder, which App.jsx adds after this. */
  const named = [...files['README.md'].matchAll(/`([\w.\-/]+\.\w+)`/g)].map(m => m[1])
  const promised = [...new Set(named)].filter(f => !f.startsWith(EXAMPLE_PREFIX))
  const broken = promised.filter(f => !files[f])
  assert(broken.length === 0, `README names only files the payload ships${broken.length ? ` — ${broken.join(', ')}` : ''}`)

  assert(files['README.md'].includes('AGENTS.md'), 'README points agents at the contract')

  /* The sample pages are named in the contract prose and built in App.jsx,
     which no Node test can run. The joinable part is the name: if the prose
     and the exporter disagree, every instruction about them points at nothing.
     Two simulations reported them missing, both because the reader walked past
     a subfolder — which is why they are flat in the root now, and why the
     prose must carry the same prefix the exporter writes. */
  const contractText = files['AGENTS.md'] + files['README.md'] + files['DESIGN.md'] + files['tokens.css']
  assert(contractText.includes(EXAMPLE_PREFIX + '-'),
    `the contract names the sample pages the exporter writes (${EXAMPLE_PREFIX}-*)`)
  assert(!/html-examples/.test(contractText),
    'no instruction still points at the retired html-examples/ folder')
  for (const mode of HTML_EXAMPLES_MODES) {
    assert(exampleFilename(mode, 'dashboard') === `${EXAMPLE_PREFIX}-${mode}-dashboard.html`,
      `the ${mode} sample name is flat and self-describing (${exampleFilename(mode, 'dashboard')})`)
  }
}

/* ── EVERY SPEC NAME RESOLVES TO SOMETHING YOU CAN WRITE ──
 *
 * DESIGN.md names components `button-primary`; the stylesheet defines
 * `.btn-primary`; and `btn-` appeared ZERO times in 24,507 words. A reader
 * obeying the document's own "flatten the name" instruction wrote
 * `class="button-primary"` and got an unstyled element, silently.
 *
 * Simulation run 13 found it. The bridge closes it, and this keeps the bridge
 * level with the library: a variant added to COMPONENT_LIBRARY and not to the
 * bridge fails here rather than shipping as a name that paints nothing. */
{
  const names = []
  for (const c of COMPONENT_LIBRARY) {
    names.push(c.name)
    for (const v of Object.keys(c.variants ?? {})) names.push(`${c.name}-${v}`)
    for (const z of Object.keys(c.sizes ?? {})) names.push(`${c.name}-${z}`)
    for (const st of Object.keys(c.states ?? {})) names.push(`${c.name}-${st}`)
  }
  const unresolved = names.filter(n => !classFor(n))
  assert(names.length > 40, `the library declares enough names to be worth checking (${names.length})`)
  assert(!unresolved.length,
    `every declared component name resolves to a selector (${unresolved.join(', ') || 'all ' + names.length}）`.replace('）', ')'))

  /* AND THE DOCUMENT CARRIES IT, or the bridge is a module nobody reads. */
  const s = createInitialState()
  const doc = generateFile(s, derive(s)).text
  assert(/\| Spec name \| Write this \|/.test(doc), 'DESIGN.md prints the bridge table')
  assert(doc.includes('.btn.btn-primary'), 'the document names the class a reader must write')
  assert(/The names below are SPEC names/.test(doc), 'and warns that its own names are not classes')

  /* THE ROWS THAT ARE NOT A CLASS ARE THE POINT. A reader not told that
     `table-header` is an element selector invents `.table-header`. */
  assert(/element selector, not a class/.test(doc),
    'the bridge says which names are not classes at all')
}

/* ── A SINGLE-THEME PACKAGE SHIPS NOTHING FROM THE OTHER THEME ──
 *
 * SIXTH SITE OF ONE FAULT, and each site asked its own wrong question.
 * `markdown.js` asked `hasDark`, true for dark-only. `agents.js` asked the
 * shape of the derived object, true always. `payload.js` asked nothing: the
 * mode list was a constant. `html.js` said "one half of a pair" and shipped a
 * working toggle. `tokens.js` promised both themes in two table rows.
 *
 * Measured on one dark-only export before this: eleven `EXAMPLE-light-*.html`
 * pages, 2,506,572 bytes, 47% of the package. Each pinned `data-theme="light"`
 * and painted a palette `tokens.css` does not publish, in a package whose
 * DESIGN.md says "do not invent the other palette to fill one".
 *
 * So the question gets asked ONCE, of the whole package, in both directions.
 * Six wordings of one rule is how two of them end up disagreeing. */
{
  /* Dynamic, so the CSS hook above is registered before this graph resolves. */
  const { previewHtml } = await import('../src/emit/html.js')
  const build = theme => {
    const s = createInitialState()
    s.color = { ...s.color, theme }
    const d = derive(s)
    const files = payloadTextFiles(s, d)
    const modes = exampleModes(s)
    for (const mode of modes) {
      files[exampleFilename(mode, 'dashboard')] =
        previewHtml({ state: s, derived: d, markup: '<div class="dmd"></div>', surface: 'Dashboard', mode })
    }
    return { state: s, files, modes }
  }

  for (const [theme, other] of [['dark', 'light'], ['light', 'dark']]) {
    const { files, modes } = build(theme)
    assert(modes.length === 1 && modes[0] === theme,
      `a ${theme}-only document ships ${theme} sample pages only (got ${modes.join(', ')})`)
    assert(!Object.keys(files).some(f => f.startsWith(`${EXAMPLE_PREFIX}-${other}-`)),
      `a ${theme}-only package contains no ${other} sample page`)

    /* The page must not carry a control for a theme that is not in the zip,
       nor tell the reader to look for a twin that was never written. */
    const page = files[exampleFilename(theme, 'dashboard')]
    assert(!/id="page-theme"/.test(page),
      `a ${theme}-only sample page carries no theme control`)
    assert(!/one half of a pair/.test(page),
      `a ${theme}-only sample page does not describe a twin`)
    assert(new RegExp(`data-theme="${theme}"`).test(page)
      && !new RegExp(`data-theme="${other}"`).test(page),
      `a ${theme}-only sample page pins only its own theme`)

    /* And no prose file may promise the palette that is not shipped. */
    assert(!/Custom properties for both themes/.test(files['README.md']),
      `a ${theme}-only README does not promise both themes`)
    assert(!/The markup is identical between them/.test(files['README.md']),
      `a ${theme}-only README does not describe a pair of pages`)
  }

  /* THE OTHER DIRECTION, or the fix is a blindfold. A two-theme document must
     still get both pages, the control and the pair wording. */
  const { files, modes } = build('both')
  assert(modes.length === 2, `a two-theme document still ships both sets (got ${modes.join(', ')})`)
  const lightPage = files[exampleFilename('light', 'dashboard')]
  assert(/id="page-theme"/.test(lightPage), 'a two-theme sample page still carries the control')
  assert(/one half of a pair/.test(lightPage), 'a two-theme sample page still names its twin')
  assert(/Custom properties for both themes/.test(files['README.md']),
    'a two-theme README still promises both themes')

  /* The twin files carry the same instructions, and each names the OTHER, so
     neither may claim to be byte-identical to it. */
  assert(files['AGENTS.md'] !== files['CLAUDE.md'],
    'the twin contracts differ, because each names the other')
  assert(!/is identical to/i.test(files['AGENTS.md'] + files['CLAUDE.md'] + files['README.md']),
    'no file claims the twin contracts are identical')
}

/* ── The package loads the fonts it names ──
 *
 * Every `--font-*-family` quoted a Google family and nothing fetched one. A
 * project that imported tokens.css and no more rendered the entire system in
 * system-ui, which is the last entry in every stack and looks close enough
 * that nobody checks. The sample pages carried a <link> all along; the
 * stylesheet a real build imports did not. */
{
  const css = payloadTextFiles(state, derived)['tokens.css']
  const families = [...new Set([...css.matchAll(/--font-[\w-]*family:\s*'([^']+)'/g)].map(m => m[1]))]
  assert(families.length > 0, `tokens.css names at least one family (${families.length})`)

  const imports = [...css.matchAll(/@import\s+url\('([^']+)'\)/g)].map(m => m[1])
  assert(imports.length === 1, `tokens.css carries exactly one font import (${imports.length})`)

  const unloaded = families.filter(f => !imports[0]?.includes(f.replace(/ /g, '+')))
  assert(unloaded.length === 0,
    `every family tokens.css names is loaded by its own @import${unloaded.length ? ` — ${unloaded.join(', ')}` : ` (${families.length})`}`)

  /* The import must come before the first rule, or the browser drops it. */
  assert(css.indexOf('@import') < css.indexOf(':root'), '@import precedes the first rule, as CSS requires')
}

/* ── No frontmatter key is emitted with nothing under it ──
 *
 * A component whose every property falls outside the spec's legal eight was
 * emitted as a bare `input-focus:` — which YAML reads as null, and null reads
 * as "this state has no styling". The truth was the opposite: its styling was
 * every property the spec cannot hold, sitting in the table below. Four
 * entries in one export said nothing while looking like they said something. */
{
  const md = payloadTextFiles(state, derived)['DESIGN.md']
  const fm = md.split('\n---\n')[0].split('\n')
  const empty = []
  for (let i = 0; i < fm.length; i++) {
    /* A two-space key is empty only when no four-space child follows it.
       Testing the key alone counts every parent as empty too, which is what
       the first version of this check did — it reported 62. */
    if (!/^ {2}[\w"'-]+:\s*$/.test(fm[i])) continue
    if (!/^ {4}\S/.test(fm[i + 1] ?? '')) empty.push(fm[i].trim())
  }
  assert(empty.length === 0,
    `no frontmatter key is emitted empty${empty.length ? ` — ${empty.join(' ')}` : ''}`)

  /* And the entries left out are named in the prose, or they vanish. */
  const { proseOnly } = collectComponents(derived.components)
  for (const name of proseOnly) {
    assert(md.includes(name), `${name} has no frontmatter entry and is named in the prose instead`)
  }
}

/* ── A build preference that does not move the bytes is decoration ──
 *
 * Two controls were added because a generated build had to guess and said so:
 * it kept the brief's capitalisation for labels it was handed and used sentence
 * case for the ones it invented. A panel that stores a choice and emits the
 * same document either way would leave the next build guessing identically. */
{
  /* `theme` replaced two fields, so these fixtures set one value rather than a
     pair that could disagree. `light` is what "no toggle" now means: a site
     with one theme has nothing to switch to, and that used to be expressible
     as a toggle preference sitting on top of a light-only palette. */
  const doc = ({ casing, theme }) => {
    const s = createInitialState()
    if (casing) s.voice = { ...s.voice, casing }
    s.color = { ...s.color, theme }
    return generateFile(s, derive(s)).text
  }
  const sentence = doc({ casing: 'sentence', theme: 'light' })
  const title    = doc({ casing: 'title',    theme: 'light' })
  const toggled  = doc({ casing: 'sentence', theme: 'both'  })

  /* Capitalisation must be stated in exactly one place. It had two fields —
     `build.labelCase` and `voice.casing` — and the document then carried both
     rules, one section demanding Title Case and another demanding sentence
     case, inside one file with no precedence between them. Two agents found it
     independently and each had to guess. */
  for (const [label, text] of [['sentence', sentence], ['title', title]]) {
    const stated = text.split('\n').filter(l => /^- Capitalise every UI label as/.test(l))
    assert(stated.length === 1, `${label}: the capitalisation rule is stated once (${stated.length})`)
    assert(!/Sentence case for all UI text/.test(text),
      `${label}: no second casing rule contradicts it`)
  }

  assert(sentence !== title, 'the capitalisation choice changes the document')
  assert(sentence !== toggled, 'the theme-toggle choice changes the document')
  assert(/sentence case/i.test(sentence) && /Title Case/.test(title),
    'each capitalisation names itself in the document')
  assert(/Build a \*\*theme toggle\*\*/.test(toggled) && /Do not build a theme toggle/.test(sentence),
    'the toggle instruction states both directions')

  /* A single-theme system must FORBID a toggle rather than describe one.
     Otherwise an agent invents the missing palette to fill the control, which
     is the worst of the three outcomes. One field makes the contradiction
     unrepresentable; this checks the document says so. */
  assert(/ships one theme/.test(sentence) && !/Build a \*\*theme toggle\*\*/.test(sentence),
    'a light-only system forbids a toggle')
  const darkOnly = doc({ theme: 'dark' })
  assert(/ships one theme/.test(darkOnly) && !/Build a \*\*theme toggle\*\*/.test(darkOnly),
    'a dark-only system forbids a toggle too')
  assert(darkOnly !== sentence, 'light-only and dark-only are different documents')

  /* And an older document without the field takes the defaults rather than
     emitting "no capitalisation stated", which is the gap this closed. */
  const bare = createInitialState()
  delete bare.build
  assert(/Capitalise every UI label/.test(generateFile(bare, derive(bare)).text),
    'a document with no build preferences still states a capitalisation')

  /* A document saved before `theme` existed carries `emitDark` instead. It has
     to open, and it has to open as the thing it was. */
  const legacyLight = createInitialState()
  delete legacyLight.color.theme
  legacyLight.color.emitDark = false
  assert(/ships one theme/.test(generateFile(legacyLight, derive(legacyLight)).text),
    'an old document with emitDark false still reads as light only')
  const legacyBoth = createInitialState()
  delete legacyBoth.color.theme
  legacyBoth.color.emitDark = true
  assert(/Build a \*\*theme toggle\*\*/.test(generateFile(legacyBoth, derive(legacyBoth)).text),
    'an old document with emitDark true still reads as both')

  /* ── A SETTING THAT DOES NOT CHANGE THE OUTPUT IS DECORATION ──
     Each of the two new Type settings is generated at both values and the bytes
     compared. A control that stores a choice and emits the same file either way
     leaves the next build guessing, which is the fault this checks for. */
  const typed = (k, v) => {
    const s = createInitialState()
    s.type = { ...s.type, [k]: v }
    return generateFile(s, derive(s)).text
  }
  const tabular = typed('numerals', 'tabular-in-tables')
  const proportional = typed('numerals', 'proportional')
  assert(tabular !== proportional, 'the numerals choice changes the document')
  assert(/ONLY where a column of numbers has to line up/.test(tabular)
    && /including tables/.test(proportional),
    'each numerals value states its own rule')

  const wrapped = typed('headingWrap', 'wrap')
  const truncated = typed('headingWrap', 'truncate')
  assert(wrapped !== truncated, 'the heading-wrap choice changes the document')
  assert(/breaks into more lines/.test(wrapped) && /truncated with an ellipsis/.test(truncated),
    'each heading-wrap value states its own rule')

  /* Three answers, three documents. `last` is the default, so a state with no
     `headingAlign` has to read as `last` rather than as absent. */
  const align = v => { const s = createInitialState(); s.type = { ...s.type, headingWrap: 'wrap', headingAlign: v }; return generateFile(s, derive(s)).text }
  const [aFirst, aCenter, aLast] = ['first', 'center', 'last'].map(align)
  assert(new Set([aFirst, aCenter, aLast]).size === 3, 'each heading-align value changes the document')
  assert(/FIRST line/.test(aFirst) && /heading BLOCK/.test(aCenter) && /LAST line/.test(aLast),
    'each heading-align value states its own rule')
  assert(/margin-top: calc/.test(aFirst) && !/margin-bottom: calc/.test(aFirst)
    && /margin-bottom: calc/.test(aLast) && !/margin-top: calc/.test(aLast)
    && /align-self: center` and no margin/.test(aCenter),
    'the offset hangs from the edge each value names, and centre states none')
  {
    /* The default. A document that never set the field must read as `last`,
       not fall through to nothing. */
    const s = createInitialState()
    delete s.type.headingAlign
    assert(/LAST line/.test(generateFile(s, derive(s)).text), 'an unset heading-align defaults to the last line')
  }
  {
    /* And it is silent under truncation, where all three land in one place. */
    const s = createInitialState()
    s.type = { ...s.type, headingWrap: 'truncate', headingAlign: 'first' }
    const out = generateFile(s, derive(s)).text
    assert(!/FIRST line/.test(out) && !/LAST line/.test(out),
      'a truncated heading states no alignment rule')
  }

  /* And the tokens honour the theme, because "dark only" was not expressible
     before: light was always written to :root. */
  const css = t => {
    const s = createInitialState()
    s.color = { ...s.color, theme: t }
    return tokensCss(s, derive(s))
  }
  const lightCss = css('light'), darkCss = css('dark'), bothCss = css('both')
  assert(!/data-theme="dark"/.test(lightCss) && !/prefers-color-scheme/.test(lightCss),
    'a light-only system emits no dark block')
  assert(!/data-theme="dark"/.test(darkCss) && !/prefers-color-scheme/.test(darkCss),
    'a dark-only system emits no switch either')
  assert(darkCss !== lightCss, 'dark-only and light-only produce different tokens')
  assert(/data-theme="dark"/.test(bothCss) && /prefers-color-scheme/.test(bothCss),
    'both emits the query and the explicit override')
}

/* ── The dark values are reachable by name, and the sentence is true ──
 *
 * The document promised a `dark-` prefixed counterpart for every token and no
 * file defined one. Deleting the sentence would have made the file true;
 * emitting the tokens makes it true and answers what the sentence was for —
 * a dark value you can name while the light theme is in force, which the
 * media-query mechanism cannot give you. */
{
  const css = payloadTextFiles(state, derived)['tokens.css']
  const block = re => {
    const i = css.search(re)
    if (i < 0) return ''
    let depth = 0
    const j = css.indexOf('{', i)
    for (let k = j; k < css.length; k++) {
      if (css[k] === '{') depth++
      else if (css[k] === '}' && --depth === 0) return css.slice(j, k)
    }
    return ''
  }
  const read = text => Object.fromEntries(
    [...text.matchAll(/(--c-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2].toLowerCase()]))

  const root = read(block(/:root\s*\{/))
  const darkBlock = read(block(/:root\[data-theme="dark"\]\s*\{/))

  const aliases = Object.keys(root).filter(k => k.startsWith('--c-dark-'))
  assert(aliases.length > 0, `tokens.css defines the dark aliases (${aliases.length})`)

  /* Every alias must equal what the role RESOLVES to under dark, or the name
     is worse than absent — it resolves, and to the wrong colour.
     Read through the cascade, not out of one block. The dark block carries
     only what dark changes, so a role the theme leaves alone is not in it and
     keeps its :root value. Reading the block alone reported `--c-dark-border`
     as wrong when it is the one role identical in both modes. */
  const underDark = k => darkBlock[k] ?? root[k]
  const wrong = aliases.filter(a => underDark(a.replace('--c-dark-', '--c-')) !== root[a])
  assert(wrong.length === 0,
    `every dark alias carries the dark value${wrong.length ? ` — ${wrong.slice(0, 3).join(', ')}` : ` (${aliases.length})`}`)

  /* One alias per role, not one per role plus the ones we forgot. Count from
     :root, which holds every role; the dark block holds only the changed. */
  const roles = Object.keys(root).filter(k => !k.startsWith('--c-dark-'))
  assert(aliases.length === roles.length,
    `one alias per role (${aliases.length} aliases, ${roles.length} roles)`)

  /* The narrowing above must not lose a role. Anything the dark block sets
     has to exist at :root as well, or the alias for it resolves to nothing. */
  const orphan = Object.keys(darkBlock).filter(k => !(k in root))
  assert(orphan.length === 0,
    `every dark role also stands at :root${orphan.length ? ` — ${orphan.slice(0, 3).join(', ')}` : ` (${Object.keys(darkBlock).length} switched)`}`)
}

/* ── A line is never the colour of what it divides ──
 *
 * Dark `border-subtle` and dark `surface-raised` both resolved to neutral.800:
 * the same hex, 1.00:1, a divider inside a popover that paints nothing. No
 * contrast check looked, because a hairline is decorative and 1.4.11 sets no
 * bar for it. An agent building from the file found it and worked around it. */
{
  const LINES = ['border-subtle', 'border', 'border-strong']
  /* Collected and asserted once. The first version asserted per combination
     and printed 27 failures for one root cause, which buries the diagnosis
     under its own repetitions. */
  const invisible = []
  let checked = 0
  for (const preset of [null, ...PRESETS.map(p => p.id)]) {
    const s = preset ? applyPreset(preset, createInitialState()) : createInitialState()
    const d = derive(s)
    for (const mode of ['light', 'dark']) {
      for (const line of LINES) {
        for (const bg of SURFACE_ROLES) {
          const a = d.roles[mode][line], b = d.roles[mode][bg]
          if (!a || !b) continue
          checked++
          const r = check(a, b).ratio
          if (r < 1.2) invisible.push(`${preset ?? 'default'}/${mode}: ${line} on ${bg} ${r}:1`)
        }
      }
    }
  }
  assert(invisible.length === 0, invisible.length
    ? `${invisible.length} line/surface pairs are invisible — ${invisible.slice(0, 3).join('; ')}`
    : `no line token is invisible on any surface, in any preset or mode (${checked} combinations)`)
}

/* ── One implementation of "does this pair fail" ──
 *
 * The rule lived at five call sites, each spelling out
 * `p.ui ? ratio < 3 : !pass`. When `exempt` arrived for disabled text, three
 * learned about it and two did not — so a clean document opened reporting
 * "1 contrast" from the one pair the document itself grades "Exempt (1.4.3)".
 * Fixing three of five is the class-not-instance failure with a number on it. */
{
  const src = ['src/App.jsx', 'src/preview/Canvas.jsx', 'src/panels/RolesPanel.jsx']
    .map(f => [f, fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')])
  const copies = src.filter(([, t]) => /\.ui \?\s*\w+\.ratio < 3/.test(t)).map(([f]) => f)
  assert(copies.length === 0, copies.length
    ? `the pass/fail rule is spelled out again in ${copies.join(', ')}`
    : `every consumer asks pairFails rather than restating the rule (${src.length})`)

  /* And the rule itself, both ways. */
  const ok = { ratio: 9, pass: true }
  const low = { ratio: 2, pass: false }
  assert(pairFails({ fg: 'a', bg: 'b' }, low), 'a failing text pair fails')
  assert(!pairFails({ fg: 'a', bg: 'b' }, ok), 'a passing text pair does not')
  assert(!pairFails({ fg: 'a', bg: 'b', ui: true }, { ratio: 3.5, pass: false }), 'a ui pair clears at 3:1')
  assert(pairFails({ fg: 'a', bg: 'b', ui: true }, { ratio: 2.1, pass: false }), 'a ui pair below 3:1 fails')
  assert(!pairFails({ fg: 'a', bg: 'b', exempt: true }, low), 'an exempt pair never fails')

  /* The whole point: a fresh document opens with nothing to report. */
  const clean = createInitialState()
  const cd = derive(clean)
  for (const mode of ['light', 'dark']) {
    const n = CONTRAST_PAIRS.filter(p =>
      pairFails(p, check(cd.roles[mode][p.fg], cd.roles[mode][p.bg]))).length
    assert(n === 0, `a fresh document reports no contrast failure in ${mode} (${n})`)
  }
}

/* ── Two meanings must not be one colour ──
 *
 * `accent` and `success` shipped as the same teal: 1.01:1 apart, eleven degrees
 * of hue, 0.2 of lightness. A filled button and a "paid" mark said nothing
 * different, and no contrast check could ever have caught it — a ratio measures
 * lightness, so two roles one step apart on the ramp always read about 1:1
 * whatever their hue.
 *
 * Success is the constrained role: every green candidate collides with danger
 * under deuteranopia, which is why it is a teal. So the accent moved. */
{
  const { PRESETS } = await import('../src/state/presets.js')
  const fresh = createInitialState()
  const collisions = s => audit(s, derive(s)).filter(f => f.id.startsWith('meaning:'))

  assert(collisions(fresh).length === 0, 'the shipped default has no two roles reading as one colour')

  /* ── THE DEFAULT AUDITS CLEAN, AND IT TOOK TWO FIXES TO GET THERE ──
   *
   * This asserted for a while that the default carried exactly one warning,
   * `palette:flat`, and that it was unfixable. Both halves were wrong, and the
   * first one was why the second looked true.
   *
   * The check read the SEEDS. A seed sets hue and chroma and `buildRamp`
   * discards its lightness, spacing all eleven steps between `lightMin` and
   * `lightMax` identically for every hue. So the seeds span 3.7 points, the
   * roles they generate span 0.2, and no seed edit could ever move the number
   * the reader sees. Measured across ramps at every step: 0.00.
   *
   * Pointed at the roles, the remedy is a STEP, and there is one in each mode.
   * `warning` takes it because it is the only meaning role that is not a
   * control fill — see the note beside it in `schema.js`.
   *
   * Nothing left to allow for: no failures and no warnings, in either mode. */
  const findings = audit(fresh, derive(fresh))
  const fails = findings.filter(f => f.level === 'fail')
  assert(fails.length === 0, `the shipped default has no failures (${fails.length})`)
  assert(findings.length === 0,
    `the shipped default audits clean (${findings.map(f => `${f.level}:${f.id}`).join(', ') || 'none'})`)

  /* ── THE DARK GROUND CARRIES HUE, AND THE LIGHT ONE DID NOT MOVE ──
   *
   * The chroma envelope tapered symmetrically while sRGB does not, so every
   * generated dark ground came out a dead grey under a saturated accent. The
   * fix is a dark-only floor, so both halves need pinning: the dark ground
   * has to gain chroma, and no light role may change by a single byte. */
  {
    const d = derive(fresh)
    const L = d.roles.light, D = d.roles.dark
    const cOf = hex => toOklchObj(hex).c

    /* Measured before the floor: bg 0.0040, surface 0.0070. After: 0.0130 and
       0.0140. The floor sits under both, well clear of the old values, so a
       regression to the symmetric envelope fails here rather than shipping. */
    assert(cOf(D.bg) >= 0.010, `the dark page ground carries hue (chroma ${cOf(D.bg).toFixed(4)})`)
    assert(cOf(D.surface) >= 0.010, `the dark card ground carries hue (chroma ${cOf(D.surface).toFixed(4)})`)

    /* The read the whole change exists to fix. 19.0x before, 9.5x after. */
    const jump = cOf(D.accent) / cOf(D.surface)
    assert(jump <= 12, `the dark accent is not a foreign hue on a grey ground (${jump.toFixed(1)}x chroma jump)`)

    /* And the light theme is untouched. Rebuilt with the floor removed, every
       light role must come back identical. */
    const flat = derive(fresh, { darkFloor: 0.2 })
    const moved = Object.keys(L).filter(k => flat.roles.light[k] !== L[k])
    assert(moved.length === 0,
      `no light role moved when dark gained its floor${moved.length ? ` — ${moved.slice(0, 4).join(', ')}` : ''}`)
  }

  /* ── THE STRUCTURE IS IN THE ROLES, SO MEASURE IT THERE ── */
  {
    const spread = (d, mode) => {
      const L = ['accent', 'success', 'warning', 'danger']
        .map(r => toOklchObj(d.roles[mode][r]).l * 100)
      return Math.max(...L) - Math.min(...L)
    }
    const d = derive(fresh)
    for (const mode of ['light', 'dark']) {
      const v = spread(d, mode)
      assert(v >= 10, `the ${mode} meaning roles have a value structure (${v.toFixed(1)} points)`)
    }
  }

  /* ── AND THE CHECK STILL FIRES ON A FLAT ONE ──
   *
   * Injected by putting `warning` back on the step every other role sits on,
   * which is the exact state that shipped. Both modes must report it, or the
   * fix above is a blindfold rather than a repair.
   *
   * DANGER HAS TO COME BACK TOO. It moved off 700/400 for red-green
   * separation, so flattening warning alone leaves danger holding the spread
   * and the injected document is no longer flat. The test then reports the
   * check as broken when the check is fine. Flatten every role the check
   * measures, or the injection is not the state it claims to be. */
  {
    const flatDoc = createInitialState()
    flatDoc.color.roles.warning.light = 'warning.700'
    flatDoc.color.roles.warning.dark = 'warning.400'
    flatDoc.color.roles.danger.light = 'danger.700'
    flatDoc.color.roles.danger.dark = 'danger.400'
    const fd = derive(flatDoc)
    const flat = audit(flatDoc, fd).filter(f => f.id.startsWith('palette:flat'))
    assert(flat.length === 2,
      `a flat palette is reported in both modes (${flat.map(f => f.id).join(', ') || 'none'})`)

    /* ── EVERY REMEDY IT OFFERS MUST LOWER THE COUNT ──
     *
     * The candidate list crosses ramps, because any role with room can widen
     * the spread. Confined to one role it reported "none improves" on the
     * light mode while `warning.900` sat two steps away and clean: `success`
     * tied at the same distance and was enumerated first. */
    for (const f of flat) {
      const c = chooseFix(flatDoc, fd, f.apply, derive)
      assert(c && !c.noImprovement,
        `${f.id} offers a remedy that lowers the total (${c?.before.fail + c?.before.warn} -> ${c?.total})`)
      assert(c.fix.role && c.fix.ref.startsWith(c.fix.role + '.'),
        `${f.id} names the role its chosen step belongs to (${c.fix.role} -> ${c.fix.ref})`)
    }
  }

  /* The fault it was built for, injected. A check that cannot catch this again
     is a blindfold, and this one has already been narrowed once. */
  const old = createInitialState()
  old.color.seeds = old.color.seeds.map(x => (x.name === 'accent' ? { ...x, hex: '#006b72' } : x))
  assert(collisions(old).length === 2,
    'the old teal accent is still reported, in both modes')

  /* And the narrowing must not have silenced anything real. Two presets put a
     rust or red brand beside a red danger — 1° to 9° of hue — and move the
     danger ramp to the ends to separate them: 15.5 points of lightness. That is
     a mitigation at the point of use, and reporting it calls a solved problem
     open. */
  for (const p of PRESETS) {
    const n = collisions(p.patch()).length
    assert(n === 0, `preset ${p.id} reports no colour collision (${n})`)
  }
}

/* ── A role serves one contrast requirement, not two ──
 *
 * `text-subtle` was described as "Placeholders, disabled". Those two uses have
 * different requirements — 1.4.3 exempts text inside a disabled control and
 * does not exempt a placeholder — so no ramp step could satisfy both, and the
 * overload guaranteed one of the two would be wrong. At step 600 it failed AA
 * on three of five light surfaces and on dark surface-raised, in all seven
 * presets.
 *
 * The paint was never wrong. Nothing in the matrix ever used it as a
 * placeholder, and the one curated pair that measured it picked `surface` —
 * the single surface it clears — so the check reported the healthiest case in
 * the set as though it covered the role. */
{
  const subtle = ALL_ROLES.find(r => r.name === 'text-subtle')
  assert(!/placeholder/i.test(subtle.desc),
    `text-subtle is described by one requirement, not two ("${subtle.desc}")`)
  assert(!TEXT_ROLES.includes('text-subtle'),
    'text-subtle is out of the body-text sweep, because 1.4.3 exempts disabled text')

  /* Every component that shows placeholder text names its colour. Unspecified,
     an agent reaches for whichever muted role it saw last — and the roles list
     used to offer it the one that fails. */
  const withPlaceholder = ['input', 'textarea']
  for (const name of withPlaceholder) {
    const props = Object.fromEntries((derived.components.find(c => c.name === name)?.properties ?? []).map(p => [p.key, p.value]))
    assert(!!props.placeholderColor, `${name} states its placeholder colour`)
    assert(!/text-subtle/.test(String(props.placeholderColor)),
      `${name} does not use the disabled role for a placeholder (${props.placeholderColor})`)
  }

  /* And the colour it does use must clear AA on every surface, in every mode
     and preset — a placeholder is readable content. */
  const short = []
  for (const preset of [null, ...PRESETS.map(p => p.id)]) {
    const s = preset ? applyPreset(preset, createInitialState()) : createInitialState()
    const d = derive(s)
    for (const mode of ['light', 'dark']) {
      for (const bg of SURFACE_ROLES) {
        const r = check(d.roles[mode]['text-muted'], d.roles[mode][bg]).ratio
        if (r < 4.5) short.push(`${preset ?? 'default'}/${mode}: on ${bg} ${r}:1`)
      }
    }
  }
  assert(short.length === 0, short.length
    ? `the placeholder colour falls short — ${short.slice(0, 3).join('; ')}`
    : 'the placeholder colour clears AA on every surface, mode and preset')

  /* text-subtle is only ever used where the exemption applies. If it turns up
     on an enabled control, the split has quietly come undone. */
  const misuse = derived.components
    .filter(c => (c.properties ?? []).some(p => String(p.value).includes('text-subtle')))
    .map(c => c.name)
    .filter(n => !/disabled/.test(n))
  assert(misuse.length === 0,
    misuse.length ? `text-subtle is used on an enabled control: ${misuse.join(', ')}`
      : `text-subtle appears only on disabled entries (${derived.components.filter(c => (c.properties ?? []).some(p => String(p.value).includes('text-subtle'))).length})`)
}

/* ── The samples demonstrate the chrome, not only documents ──
 *
 * The package defined `tab`, `tab-selected` and `tab-disabled`, and not one of
 * the twelve sample pages contained a tab strip. Two agents building a tool
 * shell each reported it, one saying the component the job most needed a
 * reference for had no worked example. A title bar and a stat tile were
 * missing the same way.
 *
 * A dashboard, a form and a settings list are documents. Chrome is where the
 * hard rules live — one baseline across five text sizes, a structural rule
 * against a subtle one, an underline that adds no height — and none of it is
 * visible on a page of paragraphs. Canvas.jsx cannot be imported here, so
 * assert against its source. */
{
  const canvas = fs.readFileSync(new URL('../src/preview/Canvas.jsx', import.meta.url), 'utf8')
  assert(/id: 'shell'/.test(canvas), 'the surface list includes a shell')
  const shell = fs.readFileSync(new URL('../src/preview/screens/Shell.jsx', import.meta.url), 'utf8')
  for (const [what, re] of [
    ['a title bar', /function TitleBar/],
    ['a tab strip', /function TabStrip/],
    ['a statistic tile', /function Stat\b/],
  ]) assert(re.test(shell), `the shell demonstrates ${what}`)

  /* ── The shell is built from the shared primitives ──
   *
   * Every layout value in this file used to be one I picked: a height, then
   * padding, then a 6/2 correction, then a gap, then a heavier line. Each was
   * argued for and each was arbitrary, and the row shipped wrong four times.
   * `.row`, `.stack`, `.divider`, `.card`, `.avatar`, `.badge` and `.btn`
   * already carry the rhythm, which is why the Landing header — built from
   * nothing else — was right the whole time.
   *
   * These assertions replace a set that pinned the hand-rolled values in
   * place. A test written around a defect keeps the defect. */
  for (const cls of ['row', 'stack', 'divider', 'card', 'avatar', 'badge', 'btn']) {
    assert(new RegExp('className="[^"]*\\b' + cls + '\\b').test(shell),
      `the shell uses .${cls} rather than rebuilding it`)
  }
  assert(!/alignItems: 'baseline'/.test(shell),
    'no inline baseline row — .row is baseline-aligned already')
  assert(!/TYPE_TOKENS/.test(shell),
    'no hand-applied type tokens — the classes carry the type')
  assert(!/borderBottom: '1px solid var\(--c-border,/.test(shell),
    'no control-outline weight used as a rule — that is border-subtle or .divider')

  /* The three rules this surface exists to show, obeyed in the surface itself.
     A sample that renders a component wrongly is a specification that lies. */
  assert(/className="row row-wrap"/.test(shell), 'the title bar is a .row, which is baseline-aligned')
  assert(/inset 0 -2px 0 var\(--c-accent/.test(shell), 'the selected tab is underlined by an inset shadow')
  assert(!/borderBottom: '2px/.test(shell), 'no underline is built from a border')
  assert(/var\(--c-border-subtle\)/.test(shell), 'rules are drawn in border-subtle, not the control-outline weight')
  assert(/borderTop: i === 0 \? 0 :/.test(shell), 'row separators are drawn above, never below')

  /* ── The chosen treatment stands, wherever the strip sits ──
   *
   * A promotion to the pill under a major rule was built, measured and then
   * rescinded on sight. These assertions exist so nothing reinstates it. */
  const { stripStyle } = await import('../src/state/components.js')
  assert(stripStyle('underline') === 'underline', 'an underlined strip stays underlined')
  assert(stripStyle('pill') === 'pill', 'a pill strip stays a pill')
  assert(stripStyle('nonsense') === 'underline', 'an unknown treatment falls back rather than rendering nothing')
  assert(!/underRule/.test(shell), 'no strip in the shell is promoted by position')
  assert(/stripStyle\(style\)/.test(shell), 'the shell asks stripStyle rather than restating the fallback')

  /* ── A nav scrolls, it never wraps ──
   *
   * `.row` wraps at narrow container widths, and a nav is a `.row`. Four tabs
   * in a 248px pane folded to two rows, 92px tall. The matrix already answered
   * this question the same way. */
  const responsive = fs.readFileSync(new URL('../src/preview/responsive.rules.css', import.meta.url), 'utf8')
  assert(/\.dmd nav\.row \{[^}]*flex-wrap: nowrap/.test(responsive), 'a nav strip does not wrap')
  assert(/\.dmd nav\.row \{[^}]*overflow-x: auto/.test(responsive), 'a nav strip scrolls instead')
  assert(/\.dmd nav\.row::-webkit-scrollbar/.test(responsive),
    'the bar is hidden, so two strips side by side keep one height')
}

/* ── The library covers what the payload tells an agent to build ──
 *
 * A tab strip reached a build with no `tab` entry in the matrix. The agent took
 * nav-item's padding, type and colours, dropped nav-item-selected's background
 * fill because the brief asked for an underline, and wrote a note explaining
 * the conflict it had resolved alone. Both halves of that conflict came from
 * this document. Nothing said which applied to a tab, because there was no tab.
 *
 * A missing component is not a gap an agent reports. It is a gap an agent
 * fills, and then the system contains a component nobody specified. */
{
  const names = new Set(derived.components.map(c => c.name))
  /* Named surfaces the payload's own prose instructs an agent to build. */
  for (const required of ['tab', 'tab-selected', 'nav-item', 'nav-item-selected']) {
    assert(names.has(required), `the matrix defines ${required}, so nothing has to be improvised`)
  }

  const propsOf = (d, n) => Object.fromEntries((d.components.find(c => c.name === n)?.properties ?? []).map(p => [p.key, p.value]))
  const tabSel = propsOf(derived, 'tab-selected')
  const navSel = propsOf(derived, 'nav-item-selected')

  /* The two must differ on the axis that caused the conflict, or the entries
     exist and the ambiguity survives. */
  assert(!tabSel.backgroundColor, 'a selected tab has no background fill — the underline is the whole marker')
  assert(/inset 0 -2px 0/.test(String(tabSel.boxShadow ?? '')),
    `a selected tab is underlined by an inset shadow, which adds no height (${tabSel.boxShadow ?? 'none'})`)
  assert(!!navSel.backgroundColor, 'a selected nav item is marked by a fill, not an underline')
  assert(!/inset 0 -2px/.test(String(navSel.boxShadow ?? '')), 'a selected nav item carries no underline')

  /* ── Two tab styles, and each is only itself ──
   *
   * One treatment was not enough: a strip on a rule wants the underline, a
   * strip floating in a toolbar wants the pill, and forcing the underline
   * there draws a 2px mark against nothing. A raised and a boxed style were
   * built and rejected on sight as the old browser idiom.
   *
   * The failure to guard against is a style that carries BOTH markers — a
   * pill with an underline reads as a stray rule under a fill. */
  const withStyle = tabStyle => {
    const s = createInitialState()
    s.components = { ...s.components, tabStyle }
    return derive(s)
  }
  const styles = Object.keys(TAB_STYLES)
  assert(styles.length === 2 && styles.includes('underline') && styles.includes('pill'),
    `exactly two tab styles ship (${styles.join(', ')})`)

  const under = propsOf(withStyle('underline'), 'tab-selected')
  const pill = propsOf(withStyle('pill'), 'tab-selected')
  assert(JSON.stringify(under) !== JSON.stringify(pill), 'the two styles produce different components')
  assert(/inset 0 -2px 0/.test(String(under.boxShadow ?? '')) && !under.backgroundColor,
    'underline: an inset mark and no fill')
  assert(!!pill.backgroundColor && !/inset 0 -2px/.test(String(pill.boxShadow ?? '')),
    'pill: a fill and no underline')

  /* And an older document with no setting opens on the underline, which is
     what its tab entries already described. */
  const bare = createInitialState()
  delete bare.components.tabStyle
  assert(/inset 0 -2px 0/.test(String(propsOf(derive(bare), 'tab-selected').boxShadow ?? '')),
    'a document with no tab style falls back to the underline')
}

/* ── The contrast section measures every mode, and reports what falls short ──
 *
 * The table carried the words "light mode" and measured light only, beneath a
 * role table that shipped a Dark column. A dark system was exported whose
 * light side passed every pair and whose dark side failed four, and the file
 * said nothing — the unmeasured mode is where the failures live.
 *
 * The curated pair list is a guess about what gets built. The sweep is not: it
 * walks every text role against every surface role and prints the shortfalls,
 * so a pair nobody thought to list still gets measured. */
{
  const md = payloadTextFiles(state, derived)['DESIGN.md']
  const header = md.split('\n').find(l => l.startsWith('| Pair | Tokens'))
  assert(header != null, 'the contrast table is emitted')
  assert(!/light mode/.test(md.slice(md.indexOf('Measured contrast'), md.indexOf('Measured contrast') + 120)),
    'the contrast heading no longer claims to be light-only')

  if (state.color.emitDark) {
    assert(/\| Pair \| Tokens \| Light \| Dark \|/.test(md),
      'a system that ships dark measures every pair in dark as well as light')
    const row = md.split('\n').find(l => l.startsWith('| Body on card |'))
    assert((row.match(/:1/g) ?? []).length === 2, `each pair reports both modes (${row?.trim()})`)
  }

  /* The sweep. It has to be able to say something, or it is decoration. */
  const sweep = md.includes('fall below AA (4.5:1)')
  const swept = []
  for (const fg of TEXT_ROLES) {
    for (const bg of SURFACE_ROLES) {
      for (const mode of state.color.emitDark ? ['light', 'dark'] : ['light']) {
        const set = derived.roles[mode]
        if (set[fg] && set[bg] && check(set[fg], set[bg]).ratio < 4.5) swept.push(`${fg}/${bg}/${mode}`)
      }
    }
  }
  assert(swept.length === 0 ? !sweep : sweep,
    `the sweep block appears exactly when a pair falls short (${swept.length} short)`)
  for (const s of swept.slice(0, 3)) {
    const [fg, bg] = s.split('/')
    assert(md.includes(`\`${fg}\` on \`${bg}\``), `the sweep names ${fg} on ${bg}`)
  }
}

/* ── The project file is lossless, which the DESIGN.md path is not ──
 *
 * Save to Device used to write a DESIGN.md. The spec allows a component eight
 * properties and cannot record variants or sizes, so a save-then-load dropped
 * eight property kinds and turned the component matrix into flat rows. These
 * assertions pin the difference so the save format cannot quietly regress to
 * the handoff format again. */
{
  /* ── Responsive: two modes, one set of breakpoints ──
 *
 * The editor must ask the container, because its preview is a pane inside a
 * pane and a media query would report the browser width, leaving the width
 * control doing nothing. The exported page must ask the viewport, because it
 * is a style reference and the DESIGN.md beside it describes min-width media
 * queries. Both must collapse at the same numbers, or the exported page stops
 * being the thing you were looking at. */
{
/* ── An icon's side is stated, never inferred from position ──
 *
 * The stylesheet used `.btn .icon:last-child` to spot a trailing icon. That
 * cannot work: a button's label is a text node, and `:last-child` counts only
 * elements. So the leading icon in `<button><svg/>Export</button>` was also the
 * last element child, matched the trailing rule, and took its 8px on the wrong
 * side — a gap before the icon and none between the icon and the word.
 *
 * It was wrong at every width, in every surface, and it shipped inside the
 * exported examples, which are the style reference an agent copies from.
 *
 * No positional selector can tell these apart, so none is allowed to try. */
{
  line('\n- icon spacing -')
  const css = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const positional = [...css.matchAll(/^[^{\n]*\.icon[^{\n]*:(?:last|first|only|nth)-[a-z-]+\([^)]*\)?[^{\n]*\{/gm)]
    .map(m => m[0].trim())
  assert(positional.length === 0,
    `no positional selector decides an icon's side${positional.length ? ` — ${positional[0]}` : ''}`)
  assert(/\.icon-end\s*\{[^}]*margin-inline-start/.test(css), 'a trailing icon is marked in the markup and spaced by class')
  assert(/\.btn \.icon \{[^}]*margin-inline-end/.test(css), 'a leading icon is the default and gets its gap after it')

  /* Every trailing icon in the surfaces must carry the flag, or it silently
     falls back to leading and the gap lands on the wrong side again. */
  const surfaces = ['screens/Dashboard.jsx', 'screens/Landing.jsx', 'screens/Form.jsx',
    'screens/Settings.jsx', 'screens/Dialog.jsx', 'Gallery.jsx']
  const unflagged = []
  for (const rel of surfaces) {
    const src = fs.readFileSync(new URL(`../src/preview/${rel}`, import.meta.url), 'utf8')
    /* An `<Ico` preceded on the same line by a word character or a closing
       brace is following a label rather than leading one. */
    for (const m of src.matchAll(/[\w}"']\s*<Ico\s[^>]*\/>/g)) {
      if (!/\bend\b/.test(m[0])) unflagged.push(`${rel}: ${m[0].slice(0, 40)}`)
    }
  }
  assert(unflagged.length === 0,
    `every trailing icon is flagged${unflagged.length ? ` — ${unflagged[0]}` : ''}`)
}

  line('\n- responsive -')
  const bps = state.layout?.breakpoints ?? []
  const inEditor = responsiveCss(bps, 'container')
  const inExport = responsiveCss(bps, 'media')

  assert(inEditor.includes('@container dmd') && !inEditor.includes('@media'),
    'the editor preview asks the container')
  assert(inExport.includes('@media') && !inExport.includes('@container'),
    'the exported page asks the viewport')
  assert(inEditor.includes('container-type: inline-size') && !inExport.includes('container-type'),
    'only the editor declares a container')

  /* The same widths in both, whatever the document's breakpoints are. */
  const widths = css => [...css.matchAll(/max-width:\s*([\d.]+)px/g)].map(m => m[1]).sort()
  assert(widths(inEditor).length > 0 && JSON.stringify(widths(inEditor)) === JSON.stringify(widths(inExport)),
    `both modes collapse at the same widths (${widths(inExport).join(', ')})`)

  /* And those widths come from the document, not from a constant. */
  const moved = responsiveCss(bps.map(b => b.name === 'md' ? { ...b, px: 900 } : b), 'media')
  assert(moved.includes('899.98px'), 'moving a breakpoint moves the rule')

  /* The CSS now lives in a real stylesheet and reaches this function as raw
     text, with the two collapse conditions standing in as sentinel widths.
     A sentinel that survives substitution is a rule that never matches and a
     layout that silently never collapses — no error, nothing in the console,
     just a page that stays wide. Cheap to assert, invisible otherwise. */
  assert(!/99990[12]/.test(inEditor + inExport + moved),
    'no sentinel width survives into the emitted CSS')
  /* The move out of the template literal must have changed nothing. If either
     mode stops producing rules at all, the substitution broke. */
  assert(inEditor.length > 10000 && inExport.length > 10000,
    `both modes still emit the full sheet (${inExport.length}B, ${inEditor.length}B)`)

  const rules = css => [...css.matchAll(/\.dmd[^{]*\{/g)].map(m => m[0].trim()).sort()
  assert(JSON.stringify(rules(inEditor).filter(r => !r.includes('-frame'))) === JSON.stringify(rules(inExport)),
    'both modes carry the same rules, only the question differs')

  /* The generator can be right and the call sites still wrong, and this pair
     is exactly the kind that gets swapped back by a well-meaning edit. Read
     the source rather than trusting the argument order. */
  const htmlSrc = fs.readFileSync(new URL('../src/emit/html.js', import.meta.url), 'utf8')
  const canvasSrc = fs.readFileSync(new URL('../src/preview/Canvas.jsx', import.meta.url), 'utf8')
  assert(/responsiveCss\([^)]*,\s*'media'\s*\)/.test(htmlSrc), 'the exporter asks for media queries')
  assert(!/responsiveCss\([^)]*,\s*'media'\s*\)/.test(canvasSrc), 'the editor canvas does not')
}

/* ── The preview obeys the casing the document states ──
 *
 * `voice.casing` shipped in the schema from the first version and every preview
 * surface ignored it, so the app demonstrated sentence case while its own file
 * demanded Title Case. These pin the helper's behaviour and the wiring, because
 * the failure was silent in both directions: nothing threw, and the screens
 * looked deliberate. */
{
  line('\n- the preview obeys the document casing -')
  assert(titleCase('Reconciliation notes') === 'Reconciliation Notes',
    'a section title takes Title Case')
  assert(titleCase('Invoices a month') === 'Invoices a Month',
    'a short preposition stays lowercase inside a title')
  assert(titleCase('Talk to us') === 'Talk to Us',
    'the last word is capitalised even when it is a small word')
  assert(titleCase('of mice and men') === 'Of Mice and Men',
    'the first word is capitalised even when it is a small word')
  /* "from" is a short preposition, so it stays lowercase mid-title. The first
     draft of this assertion expected "Import From CSV" and the helper was
     right. The initialism is the part under test. */
  assert(titleCase('Import from CSV') === 'Import from CSV',
    'an initialism keeps its own capitals')
  assert(titleCase('Flagged duplicate INV-2287') === 'Flagged Duplicate INV-2287',
    'a code with digits and capitals is left alone')
  assert(titleCase('follow-up call') === 'Follow-up Call',
    'a hyphenated pair takes one capital, not two')
  assert(titleCase('(draft) notes') === '(Draft) Notes',
    'a leading bracket does not eat the capital')
  /* One direction only. Lowercasing a title back to sentence case would need
     to know which words are proper nouns, and nothing here can. */
  assert(labeller('sentence')('Ashford & Kline') === 'Ashford & Kline',
    'sentence case returns the source text untouched')
  assert(labeller('title')('save draft') === 'Save Draft',
    'the labeller applies Title Case when the document asks for it')

  /* The wiring. A helper nothing calls is the same defect as no helper. */
  const SCREENS = ['Dashboard', 'Record', 'Shell', 'Landing', 'Pricing', 'Form',
    'Settings', 'Empty', 'Dialog']
  const unwired = SCREENS.filter(name => {
    const src = fs.readFileSync(
      new URL(`../src/preview/screens/${name}.jsx`, import.meta.url), 'utf8')
    return !src.includes('labeller(casing)') || !src.includes('L(')
  })
  assert(unwired.length === 0,
    `every preview screen recases its labels${unwired.length ? ' — missing: ' + unwired.join(', ') : ''}`)

  /* Canvas has to hand the setting down, or every screen recases against
     `undefined` and silently falls back to leaving the text alone. */
  const canvas = fs.readFileSync(new URL('../src/preview/Canvas.jsx', import.meta.url), 'utf8')
  assert(/casing=\{state\.voice\?\.casing/.test(canvas),
    'Canvas passes the document casing to every surface')
}

/* ── The payload teaches what we learned ──
 *
 * Every design rule discovered while building this app has to reach the file
 * an agent reads, or the tool keeps the lesson and every consumer of its output
 * keeps the bug. These are the rules that cost real time here, each pinned by
 * terms specific enough that a passing match means the rule is genuinely
 * present rather than the words happening to appear.
 *
 * This is a drift guard, not a style check. When a rule is reworded, update the
 * terms. When one is deleted, this fails, which is the point. */
{
  line('\n- payload carries the design rules -')
  const doc = generateFile(state, derived).text.toLowerCase()
  const RULES = [
    ['line-height from the content box', ['border-box', 'line box']],
    ['vertical-align middle is the x-height', ['x-height', 'vertical-align']],
    ['an icon aligns to its label', ['icon', 'label', 'read as one object']],
    ['no text means no baseline, so strut it', ['strut', '200b']],
    ['a large heading centres, never baseline', ['centres instead']],
    ['page actions belong to the heading', ['page actions belong']],
    ['no underline built from a border', ['underline', 'inset 0 -2px']],
    ['equal columns use minmax(0, 1fr)', ['minmax(0, 1fr)']],
    ['orphaned elements take the whole line', ['own line takes the whole line', 'takes the whole line']],
    ['sideways scroll is a last resort', ['last resort']],
    ['breakpoints are measured per question', ['measured', 'breakpoint']],
    ['gaps come from the spacing scale', ['unequal gaps']],
    ['proximity is grouping', ['proximity is grouping']],
    ['a status readout is not a control', ['status readout is not a control']],
    ['never style bare element selectors', ['bare element selector']],
    ['colour fades want the normal step', ['under about 180ms']],
    ['reduced motion is honoured', ['prefers-reduced-motion']],
    ['a flex box takes its baseline from its first item', ['first flex item']],
    ['height and line-height are one decision', ['one decision, never two']],
    ['height, line height and align-items travel together', ['three properties together']],
    ['symmetric padding does not optically centre', ['symmetric padding does not optically centre']],
    ['judge padding by the result, not the symmetry', ['judge padding by the result']],
    ['equal boxes and equal baselines need one font-size', ['pick the size, not the alignment property']],
    ['baseline-aligned boxes of different heights differ at the top', ['must** have different tops']],
    ['grow the box, not the glyph', ['grow the box, not the glyph']],
    ['a control clears the floor when its targets do', ['not when its container does']],
    /* Was `icon-only is matched by structure`, asserting the payload recommended
       `:has(> .icon:only-child)`. That advice was wrong — it counts element
       children and a label is a text node — and it broke real buttons here
       before it was reverted. The guard was faithfully protecting the mistake,
       which is what a drift test does when the thing it guards is bad. */
    ['icon-only is marked with a class, not detected', ['no selector that asks']],
    ['a rule wider than the problem', ['wider than the problem']],
    ['a mark in a field sits above it', ['renders none of it']],
    ['a line mark goes inside the line', ['inside that line']],
    ['a textless control has no baseline to offer', ['nothing to put on a baseline']],
    ['a control centres on the label first line', ['first line']],
    ['centring the control alone is worse', ['centring the control alone is worse']],
    ['equal gaps do not read equal around text', ['do not read equal']],
    ['proximity is a ratio', ['decided by the ratio']],
    /* Was `hit at its label`, and that term had a hole in it: eleven of the
       sixteen checkboxes this app renders have no visible label, because a
       row-selection box is named by its column and its row. The rule was not
       wrong, it was incomplete, so the term tracks the stronger version rather
       than being loosened until it passes. */
    /* Terms are LOWERCASE — `doc` is lowercased before matching, so a term
       carrying the payload's emphasis capitals can never match. Three
       assertions were written with them and all three reported the rule
       missing while it sat in the file. */
    ['a checkbox draws at 16 and is hit at its wrapper', ['hit at its wrapper', 'the cell carries the target']],
    /* A visible label is the default and there are four exceptions. Asserted
       with the count in it, so adding a fifth exception has to be a decision
       rather than a sentence somebody appended. */
    ['a checkbox carries a visible label, four positional exceptions', ['exactly four exceptions', 'label is positional', 'toggle button']],
    ['a positional label still owes an accessible name', ['still owes an accessible name', 'names nothing']],
    /* The pairing rule, and the three things a builder gets wrong without it.
       Terms lowercase, because `doc` is lowercased before matching. */
    ['a broken action row pairs up', ['two per line, equal, covering the whole width', 'its partner shrinks into what is left']],
    ['an odd count leads with the most important', ['odd number of actions gives the most important one a full-width line']],
    ['the pair is its own container', ['build the pair as its own container', 'growth splits between exactly two']],
    ['the pairs dissolve when the row fits', ['dissolve the pairs at any width where the row fits']],
    ['an auto margin takes space rather than making it', ['does not create space', 'resolves to zero while the bar still has room']],
    /* The gap the self-portrait found. The payload discussed segmented controls
       and equal-height baselines and never said the thing underneath them: one
       height per row, stated rather than inherited. An agent then sized a
       segmented control from its content, and the 1px that fell out of centring
       two heights read as a misalignment. */
    ['a control row is one stated height', ['same height, and that height is stated rather than inherited', 'the row was holding two heights']],
    /* Two settings that state a rule. The default branch is asserted here; the
       other branch is exercised in the settings block below, which checks the
       document actually changes. */
    ['tabular figures only where a column aligns', ['only where a column of numbers has to line up', 'reads as a monospaced slab']],
    ['a long heading breaks into lines', ['breaks into more lines', 'never break mid-word']],
    /* Default branch. The other two are exercised in the settings block. */
    ['controls beside a wrapped heading hold its last line', ["centres on the heading's last line", 'align-self: flex-end']],
    ['a gated settings block opens', ['opens, it does not appear', 'grid-template-rows']],
    ['a stroke is a painted weight, not a viewbox length', ['the weight the mark paints', 'vector-effect: non-scaling-stroke']],
    ['do not compensate the stroke per size', ['the two disagree wherever a button']],
    ['three cases are not a disclosure', ['fires on resize', 'while the reader types']],
    /* Measured on this system's own surfaces: ten screens, eleven aria-labels,
       and an overlay surface carrying no role at all. The rules were absent, so
       nothing was being broken. */
    ['an overlay declares itself a dialog', ['role="dialog"', 'aria-modal="true"', 'reading the page underneath']],
    ['a dialog is named by its own heading', ['aria-labelledby', 'two statements of one name drift']],
    ['focus enters an overlay and returns', ['cannot leave while it is open', 'returns to the control that opened it']],
    ['an invalid field points at its message', ['aria-invalid="true"', 'aria-describedby', 'never `labelledby`']],
    ['a pager names its steps and announces its range', ['previous page', 'is a live region', 'cannot state its own width']],
    ['a loading state holds its own shape', ['aria-busy="true"', 'nothing moves when the data lands', 'opacity only']],
    ['loading is the fourth empty state', ['fourth** empty state']],
    ['aria-disabled and disabled are not interchangeable', ['removes the control from the tab order', 'keeps it reachable']],
    /* ── FOUR TERMS FROM THE TOUCH FLOOR, EACH A FAULT THIS SYSTEM SHIPPED ──
       Every one changes what a builder writes, so every one belongs in the
       payload rather than with us. Measured at a coarse pointer over twelve
       surfaces: 16 controls under the floor, from four mechanisms. */
    ['a square comes from the ratio, never a stated width', ['a ratio only makes a size when the other axis is auto', 'aspect-ratio: 1']],
    ['a target is as small as its smaller side', ['smaller side', '28 wide by 44 tall']],
    ['the overhang asks its host, not a token', ['resolves against the containing block', 'min` against zero']],
    ['the floor is a property, never a list of selectors', ['max(its own height', 'the parity rule was the thing defeating the floor']],
    /* Three more from the same session, each a mechanism a builder reaches for
       that looks equivalent to the right one. */
    /* The leading asymmetry itself is stated ONCE, in the spacing section, and
       this rule points at it rather than restating it. The duplicate check
       caught the restatement at 0.83 overlap, which is what it is for. */
    ['a one-line slot is not the cap band', ['a box exactly one line tall', 'needs the font']],
    ['a box in a baseline row declares itself out', ['align-self: flex-start` on that button', '4.63 against 7.13']],
    ['a shared row class publishes the inside-a-group gap', ['gap for a run of like things', '1.0:1, so five things read as one run']],
    /* Two sentences that QUOTED a figure beside their own derived one, and the
       quote had drifted. They derive both halves now. */
    ['the selection direction is read off the figures', ['read the direction off the figures', 'two roles here move opposite ways']],
    ['the outline is measured on every ground it sits on', ['on a recessed band in light', 'every ground it can sit on']],
    /* The tick mechanism. A builder reaching for space-between gets the ends
       half a line out, and the middle one right by accident. */
    ['a tick label centres on its gridline', ['distributes the label boxes', 'half a line at each end']],
    ['the overhang leaves the box, so the chart absorbs it', ['showed 2.28', 'only where a tick column exists']],
    ['the theme toggle is a visible lightbulb control', ['visible icon control carrying a lightbulb', 'same target size as any other control in its row']],
    /* ── THE MECHANISM, AND WHY THIS ASSERTION EXISTS AT ALL ──
     *
     * `tokens.css` has shipped a script-free toggle for months and DESIGN.md
     * told the builder to move `data-theme` with a script. Two answers to one
     * decision, in two files, and AGENTS.md sends the reader to DESIGN.md
     * first — so every generated build took the fragile one. Three
     * simulations reported the toggle dead, each on a page that measured
     * correct when served and did nothing when opened somewhere its inline
     * script could not run.
     *
     * The wording above changed from "button" to "control" for the same
     * reason: the mechanism is a `<label for>`, and a rule that says "button"
     * walks the reader straight back to the version that breaks. */
    ['the theme toggle works with no script', ['works with no javascript at all', 'id="dmd-dark"', 'label for="dmd-dark"', 'only for the two things css cannot do']],
    /* Placement, alignment and naming, learned by building it. Three
       arrangements measured as defects before this one held. */
    ['the theme toggle sits before the navigation menu', ['header action group', 'before the navigation menu']],
    ['a row of fixed-height controls centres', ['aligns on **centre**, not on baseline', 'has no text baseline to share']],
    ['the toggle names the current theme and the next', ['dark theme is on. switch to light', 'one mark in both states']],
    ['an optical correction belongs to its mechanism', ['belongs to the mechanism it corrects']],
    ['a selector needs the class to be on the node', ['actually on the node']],
    ['a demonstration is a real instance', ['demonstration and the thing demonstrated']],
    ['a specimen needs room to be itself', ['room to be itself']],
    /* Found by feeding the payload to an agent: it wrote var(--color-accent)
       for a role the table called `accent`, and the page rendered colourless
       with no error anywhere. Every colour token now appears as the property
       an agent actually types. */
    ['colour roles are shown as the CSS property', ['var(--c-accent)']],
    ['the prefix is stated in words too', ['`--c-` prefix']],
    /* The collapse rules. A generated dashboard reflowed a nav rail into two
       ragged columns and stranded an icon button on a line of its own, because
       the file said what a narrow layout must not do and never said what it
       does instead. */
    ['a narrow action row moves below its heading', ['below** the heading']],
    /* Lower case: `doc` is lowercased above, so a search term with a capital
       in it can never match however present the rule is. */
    ['navigation collapses to one control', ['navigation collapses to one control']],
    ['a rail never becomes a horizontal strip', ['exactly two states']],
    ['the nav list is told not to wrap', ['never let a nav list wrap']],
    ['the most important action takes its own line', ['full-width line to itself']],
    /* Was `packs onto the lines below` — "as many per line as fit at their
       natural widths". Superseded 14 August 2026 by the pairing rule: two per
       line, equal, covering the width. The old term is not deleted quietly,
       because a rule that leaves the document with nothing asserting the
       replacement is how two versions of one decision end up shipping. The
       pairing terms are asserted above. */
    ['the rest go two per line', ['two per line']],
    ['an icon-only button is never left alone on a line', ['alone on a line at its natural width']],
    ['the gap beside a heading has a floor', ['floor under the gap']],
    ['that floor is what triggers the collapse', ['fit with that gap intact']],
    ['a breakpoint moves a row, not an object', ['moves a **row**, never one object']],
    /* The inversion: centring a mostly-text row to settle two boxes. */
    ['count what a row is made of before aligning it', ['count what a row is made of']],
    ['a box in a text run is positioned by the text', ['positioned by that text, not by its own height']],
    ['the baseline is chosen, not read off an element', ['choose the line, then make everything obey it']],
    ['a logotype is text and obeys the line', ['no exceptions for decoration']],
    ['flex centring hides a label from its row', ['hides a label from the row it sits in']],
    ['reach the touch floor before trimming a gap', ['stated touch floor']],
    ['an empty box that grows is never rendered', ['never render an empty box that grows']],
    ['a heading belongs to the block under it', ['belongs to the block under it']],
    ['a rule sits inside the section gap', ['sits inside that gap']],
    ['a margin adds to a container gap', ['two sources feeding one gap']],
    ['every section gets the same container', ['same container']],
    ['a separator is drawn above, not below', ['above each item in a list']],
    ['a glyph is never typed where an icon belongs', ['never type a glyph where an icon belongs']],
    ['a word space is not a gap', ['a word space is not a gap']],
    ['only one animation owns a property', ['only one thing may animate a property at a time']],
    ['a second input changes the first', ['adding a second way to do something is a change to the first way']],
    ['no save message for an unedited document', ['never tell someone you saved a document they did not change']],
    ['a lens is found by diffing the output', ['the test for whether a control is a lens']],
    ['a responsive rule is checked at both widths', ['at **both** widths']],
    ['contrast is measured in every mode shipped', ['the mode nobody measured is the mode the failures live in']],
    ['a token name not defined anywhere is a lie', ['a custom property that no stylesheet declares']],
    ['an empty frontmatter entry is not an unstyled one', ['absence from the frontmatter never means unstyled']],
    ['a named family is a loaded family', ['load a family before you name it']],
    ['a tab and a nav item mark selection differently', ['a tinted fill, never an underline']],
    ['the document names which tab style is in force', ['marks a selected **tab** with an']],
    ['one line weight divides everything', ['draws every line that divides']],
    ['the control outline is not a divider', ['is not a divider']],
    ['label capitalisation is stated, never guessed', ['capitalise every ui label as']],
    ['the theme toggle is a stated decision', ['theme toggle']],
    ['the dark alias serves what reassignment cannot', ['reach for it only when you need the dark value']],
    ['the sample pages are flat in the root', ['pages in the package root']],
    ['a placeholder and disabled text are different requirements', ['not the same colour, because they are not the same requirement']],
    ['a baseline is measured with font metrics, not a rectangle', ['measure a baseline with font metrics, never with a rectangle', 'fontboundingboxascent']],
    ['a row is checked by counting distinct baselines', ['count the distinct values']],
    /* Situations, not components. Each of these came from building the screen
       and finding the rule had nowhere to be read. A component gets a gallery
       entry; a page shape gets nothing unless the file says it. */
    ['a record page is the shape whose title wraps', ['record page** shows one thing']],
    /* Was three. A generated build shipped a spinner for the waiting case and
       a "nothing here" card for the other three, and the file had no rule to
       break, because loading was never one of the states. */
    ['an empty state is four states', ['four states, never one']],
    ['loading is one of them, and it holds the shape', ['loading** is the fourth']],
    ['no results offers a way back, never forward', ['a way back', 'never a way forward']],
    ['an empty state is centred, not stretched', ['not `stretch`']],
    ['a comparison keeps its columns and stacks', ['read across, so it keeps its columns']],
    ['a comparison never scrolls sideways', ['never scrolls sideways']],
    ['a comparison puts every row on one grid', ['every row of a comparison on **one** grid']],
    ['a recommendation is marked by its edge', ['never by a fill']],
    /* Was `stop against it rather than crossing it`. Reversed 15 August 2026 on
       their instruction, having seen it rendered: the marked column must carry
       the dividers, because a comparison is read across and a column with no
       rules in it reads as a panel laid over the table. The mechanism reason was
       still right, so the term now pins BOTH halves — the edge stays unbroken,
       and a border is not how you get there. */
    ['a marked column keeps its edge and carries the dividers', ['keeps one unbroken edge and still carries the row dividers', 'chips that edge once per row']],
    ['a card action row sits on the bottom edge in a row of cards', ['every action sits on the bottom edge', 'resolves to zero and nothing moves']],
    ['the action distance moves to padding, not the auto margin', ['cannot also hold a minimum', 'the margin pushes the action down, the padding holds it clear']],
    ['a painting table has no column gap', ['no column gap at all']],
    /* Narrowed 5 September 2026. The rule used to say every figure, and one
       row of stat tiles then read $45,645, 18 and 21 with only the first
       carrying a mark. The column clause is the whole rule, so the drift test
       asserts it rather than the old opening words. */
    ['figures take the mono family in a COLUMN', ['set figures in the mono family when they sit in a column of figures']],
    ['a standalone figure keeps the body face', ['nothing to stack against', 'keep the body face']],
    ['an amount in a column also takes an end edge', ['takes the mono face and an end edge']],
    ['an amount takes a right edge, an identifier does not', ['reads as a total']],
    ['a checkbox has three states', ['a checkbox has **three** states']],
    ['recase a label, never content', ['not a label on a box']],
    ['recasing runs one direction only', ['which words are proper nouns']],
    ['no fractional pixel ships', ['hold it in their head']],
    ['space sits on a 4px grid', ['a hairline is ink, not space']],
    ['type takes 4 above 24 and 2 below', ['leaves no room for the 14px']],
    ['snapping happens at the last step', ['just moves the fraction downstream']],
    ['a clamp slope and a px line-height are exempt', ['breaks the centring it exists to do']],
    ['every branch of a conditional value is real', ['as real as the first']],
    ['a fallback equals what the token ships', ['a second design nobody chose']],
    ['a table cell has a horizontal gutter', ['commonest omission in a table']],
    ['ornament columns shrink, content columns do not grow', ['shrink the ornament columns']],
    ['a table keeps its two outer edges equal', ['always reads as a lean']],
    ['one mechanism centres a label', ['is centring twice']],
    ['stripe and selection are one step apart', ['one step further']],
    ['a control is checked on every ground it sits on', ['not only the card']],
    ['moving what draws a seam can move the seam', ['the seam can simply move too']],
    ['a bordered cell is stretched, never centred', ['stretch any cell that carries a border']],
    ['a column marker cannot span auto-placed rows', ['names the end of the explicit grid']],
    ['content beside context is not navigation', ['beside **context** is not content beside **navigation**']],
    /* The second pass over the comparison. Every one of these was a real
       defect in the surface that exists to demonstrate the rule it broke. */
    ['a repeated track list is not a shared one', ['is not the same as sharing one', 'subgrid']],
    ['a label column takes max-content, not a fraction', ['never a fraction']],
    ['a comparison collapses on its widest control', ['not its widest answer']],
    ['a variant is chosen by what contains the action', ['a ghost in open space']],
    /* The title bar, third pass. Nine pixels of gap under a closed row, and a
       right edge that was holding only because a neighbour happened to. */
    ['a collapsed row still costs its line gap', ['a collapsed row still costs its line gap']],
    ['no shorthand beside its own longhand', ['never mix a shorthand and a longhand']],
    ['alignment is stated on the element that holds it', ['never leave it to a neighbour']],
    /* The six spacing and casing defects they found in one pass of screenshots.
       Every one of them was a stated value that did not survive contact with a
       second source, or a stated setting the demonstration ignored. */
    ['a byline sits close to its heading', ['belongs to that heading']],
    /* NOT a card rule. It shipped worded that way and measured 8px under a
       warning in a plain row, and 12px under a page description. The term is
       copied out of the emitted document, never from what I meant to write. */
    ['an action stands clear of the prose that explains it', ['any action stands further from the prose that explains it']],
    /* Glass reaches the reader only when the treatment is on, so these are
       asserted against a state that has it on. See the glass block below. */
    ['and a mark size never comes from a neighbour', ['never take a mark size from a neighbour']],
    ['a delta belongs to its number', ['not to the tile']],
    ['an empty-state mark is drawn large', ['twice the largest icon step']],
    ['a gap subtraction is written on the container', ['write the rule on the container']],
    ['a calc property must exist where the calc runs', ['everywhere that calc runs']],
    ['equalise a heading gap on ink, not on boxes', ['two different corrections, not one scaled']],
  ]
  const missing = RULES.filter(([, terms]) => !terms.every(t => doc.includes(t))).map(([n]) => n)
  assert(missing.length === 0,
    `every learned design rule reaches the payload${missing.length ? ` — missing: ${missing.join('; ')}` : ` (${RULES.length})`}`)

  /* ── NO RULE IS STATED TWICE ──
   *
   * The assertion above only checks that a rule ARRIVED. It has no opinion about
   * a rule arriving twice, and 159 of them have accumulated over months. Two had
   * duplicated themselves in different words:
   *
   *   "Every interactive element needs visible hover, active, focus-visible and
   *    disabled states" in Components, against "has a hover, a focus-visible, an
   *    active and a disabled appearance" in Accessibility.
   *
   *   "A button that grows at a breakpoint has two natural widths" stated as its
   *    own rule and then repeated verbatim inside the threshold rule below it.
   *
   * Neither is harmless. A rule with two homes drifts the moment either is
   * edited, and the reader then has two versions with no way to tell which is
   * current. This is the same standing rule the five stores answer to, applied
   * inside the one store that a stranger actually reads.
   *
   * Word-set overlap rather than string distance: the duplicates were the same
   * claim in different words, which no substring check would find. Tables and
   * fences are excluded, because a table row repeating a term is a column, not a
   * restatement. */
  {
    const prose = generateFile(state, derived).text.split('\n')
      .filter(l => !/^\s*\|/.test(l) && !/^\s*```/.test(l))
      .join(' ')
    const sentences = prose.split(/(?<=[.!?])\s+/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(s => s.split(' ').length >= 8)
    const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'is', 'it', 'its', 'to', 'of', 'in',
      'on', 'that', 'this', 'not', 'never', 'so', 'as', 'at', 'by', 'for', 'with', 'from', 'be',
      'are', 'was', 'has', 'have', 'one', 'two', 'no', 'but', 'than', 'then', 'which', 'when',
      'you', 'your'])
    const bag = s => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w)))
    const bags = sentences.map(bag)
    const dupes = []
    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const a = bags[i], b = bags[j]
        /* Six content words at minimum. Below that an overlap is a coincidence
           of vocabulary rather than a restatement, and short instructions like
           "Apply it with :focus-visible" legitimately share their words. */
        if (a.size < 6 || b.size < 6) continue
        let shared = 0
        for (const w of a) if (b.has(w)) shared++
        if (shared / Math.min(a.size, b.size) >= 0.8) dupes.push(sentences[i].slice(0, 64))
      }
    }
    assert(dupes.length === 0,
      `no rule is stated twice in the payload${dupes.length ? ` — ${dupes.length}: ${dupes.slice(0, 3).join(' / ')}` : ` (${sentences.length} sentences)`}`)
  }

  /* The payload is a BUILD GUIDE, never a method.
   *
   * Their boundary, 14 August 2026: the receiving agent builds from the
   * artefact and is never told how we arrived at it. We draw before we build;
   * that agent does not, because it is handed the finished decision. A process
   * instruction changes nothing in its output and spends its attention, which
   * makes it worse than silent.
   *
   * This guard exists because the rule that produced it is one I had just
   * written into four other stores, and the fifth is the one place it must not
   * go. A boundary nothing enforces is a boundary until somebody is tired. */
  const METHOD = [
    'draw the target', 'draw it first', 'visualise the end', 'visualize the end',
    'before you build it', 'sketch it', 'show it and wait', 'run it by',
    'mock it up first', 'wireframe',
  ]
  const leaked = METHOD.filter(t => doc.includes(t))
  assert(leaked.length === 0,
    `the payload carries no instruction about our own method${leaked.length ? ` — leaked: ${leaked.join(', ')}` : ''}`)

  /* The payload must not contradict what this app itself does. It told agents
     to use the fast step for hover, which is the value proved imperceptible
     here, so the tool taught the opposite of its own behaviour. */
  assert(!/use `fast` for hover/.test(doc), 'the payload does not recommend the fast step for a hover fade')
}

line('\n- project file -')
  const saved = serializeProject(state, { savedAt: '2026-01-01T00:00:00.000Z' })
  const r = parseProject(saved)
  assert(r.ok, `project file loads${r.ok ? '' : ` (${r.error})`}`)

  /* Deep equality on the derived output, not on the state: state carries fresh
     ids, and what a user must get back is the same system, not the same
     bookkeeping. */
  const before = derive(state), after = derive(r.state)
  const keys = d => new Set(d.components.flatMap(c => c.properties.map(p => p.key)))
  const lost = [...keys(before)].filter(k => !keys(after).has(k))
  assert(lost.length === 0, `project file keeps every component property${lost.length ? ` — lost ${lost.join(', ')}` : ` (${keys(before).size} kinds)`}`)
  assert(after.components.length === before.components.length,
    `component count survives (${before.components.length})`)
  assert(after.components.every(c => c.source !== 'custom'),
    'components stay editable rather than becoming custom rows')
  assert(JSON.stringify(after.cssVars) === JSON.stringify(before.cssVars), 'every derived token is identical after a load')

  /* THE MINIMUM TARGET REACHES THE PREVIEW.
   *
   * The stylesheet reads `var(--target-min, 44px)` and the default setting is
   * also 44, so measuring the rendered box cannot tell a wired token from a
   * missing one — the fallback paints either way and the reading is identical.
   * That is the trap a fallback sets, so the wiring is asserted here instead of
   * eyeballed there.
   *
   * It was genuinely broken when written: `buildCssVars` was called without
   * `states`, so the var was never emitted at all and the preview showed the
   * fallback. A non-default value is the only test that fails on that. */
  assert(before.cssVars['--target-min'] === `${state.states.touchTarget}px`,
    `the minimum target reaches the preview as a token (${before.cssVars['--target-min']})`)
  const roomier = derive({ ...state, states: { ...state.states, touchTarget: 60 } })
  assert(roomier.cssVars['--target-min'] === '60px',
    `the target token follows the setting rather than the fallback (${roomier.cssVars['--target-min']})`)

  /* The same document through DESIGN.md must still lose things, or the
     assertions above are proving nothing. */
  const viaMarkdown = derive(parseFile(generateFile(state, before).text).state)
  const lostViaMd = [...keys(before)].filter(k => !keys(viaMarkdown).has(k))
  assert(lostViaMd.length > 0, `the DESIGN.md path still loses properties, as the spec forces (${lostViaMd.length} kinds)`)

  assert(!parseProject('{"format":"something-else"}').ok, 'a foreign JSON file is refused')
  assert(!parseProject('not json').ok, 'a non-JSON file is refused')
  assert(!parseProject(JSON.stringify({ format: 'mdexed-project', formatVersion: 99, state: {} })).ok,
    'a newer format version is refused rather than half-loaded')
  assert(/^[a-z0-9-]+-\d{8}-\d{4}\.mdexed\.json$/.test(projectFilename('My Design System!!', new Date(2026, 7, 8, 3, 4))),
    `filename is slugged and sortable (${projectFilename('My Design System!!', new Date(2026, 7, 8, 3, 4))})`)
}

/* ── THE SHIPPED VERIFIERS ────────────────────────────────────────────────
 *
 * A guard nobody broke on purpose is a guard nobody has tested. Every source
 * check below is pointed at a file carrying exactly the fault it exists to
 * find, and the run has to name it. Then the same run is pointed at a clean
 * file, because a check that fires on correct code costs more than the miss it
 * prevents — and one of these did exactly that on its first outing, faulting
 * a thousand token declarations as literal colours.
 */
{
  line('\n- the colour picker s numeric fields -')
  {
    const picker = fs.readFileSync(new URL('../src/ui/ColorPicker.jsx', import.meta.url), 'utf8')
    const controls = fs.readFileSync(new URL('../src/ui/controls.jsx', import.meta.url), 'utf8')

    /* Their order, and the head of the list is the default. One decision, so a
       reorder cannot leave a separately-named default pointing elsewhere. */
    const models = picker.match(/const MODELS = \[([^\]]+)\]/)?.[1].match(/'([A-Z]+)'/g)?.map(s => s.slice(1, -1))
    assert(String(models) === 'HSB,HSL,RGB,OKLCH', `the models read HSB, HSL, RGB, OKLCH (${models})`)
    assert(/useState\(MODELS\[0\]\)/.test(picker), 'the default model is the head of the list, not a second name')

    /* ── THE FIELD KEEPS WHAT YOU TYPED ──
     *
     * Fully controlled and committing every keystroke, the value flowed back
     * through a hex round trip and replaced the digits under the caret. Typing
     * 208 into a hue field produced a run of colours nobody asked for. */
    assert(/value=\{editing \? draft : value\}/.test(controls),
      'a focused field shows its own draft rather than the value flowing back')
    assert(!/Number\.isFinite\(n\) \? n : 0/.test(controls),
      'an empty field no longer commits zero')
    assert(/onBlur=\{\(\) => setDraft\(null\)\}/.test(controls),
      'blurring returns the field to the canonical value')
  }

  line('\n- the verifiers the payload ships -')
  const { CHECKS, SOURCE_CHECKS, RENDER_CHECKS, MANUAL_CHECKS } = await import('../src/emit/checks.js')
  const { verifyNodeFile, verifyBrowserFile, VERIFY_NODE, VERIFY_BROWSER } = await import('../src/emit/verify.js')
  const { execFileSync } = await import('node:child_process')
  const os = await import('node:os')
  const path = await import('node:path')

  const BACKTICK = String.fromCharCode(96)
  /* `rtlBody` is joined into the same template literal as `body`, so it is
     under the same rule. Checking only `body` would have left the direction
     variants outside the net that exists for exactly this. */
  const allBodies = c => [...(c.body || []), ...(c.rtlBody || [])]
  const withBacktick = CHECKS.filter(c => allBodies(c).some(l => l.includes(BACKTICK)))
  assert(withBacktick.length === 0,
    `no check body holds a backtick${withBacktick.length ? ` — ${withBacktick.map(c => c.id).join(', ')}` : ''}`)

  const ids = CHECKS.map(c => c.id)
  assert(new Set(ids).size === ids.length, `every check id is unique (${ids.length})`)
  assert(CHECKS.every(c => c.line && c.line.trim()), 'every check carries a checklist line')
  assert([...SOURCE_CHECKS, ...RENDER_CHECKS].every(c => Array.isArray(c.body) && c.body.length),
    `every runnable check carries a body (${SOURCE_CHECKS.length + RENDER_CHECKS.length})`)
  assert(MANUAL_CHECKS.every(c => !c.body), 'a manual check carries no body it cannot run')

  /* ── THE DIRECTION-AWARE BODIES, AND THE GATE THEY SIT BEHIND ──
   *
   * Two checks read `left` and mean START. Proven in a browser: pointed at a
   * CORRECT right-to-left table, the plain bodies report it as 271.8px off its
   * heading and its selection edge as sitting -4.0px from the content. The
   * direction-aware bodies are silent on the same markup, report exactly the
   * 8px jog injected into one, and 2.0px on a gutter that is bar plus nothing.
   *
   * They ship only when RTL Optimizations is on. An LTR build must pay nothing
   * for a direction it does not use. */
  const withRtl = CHECKS.filter(c => c.rtlBody)
  assert(withRtl.length === 2,
    `two checks carry a direction-aware body (${withRtl.map(c => c.id).join(', ')})`)
  assert(withRtl.every(c => Array.isArray(c.rtlBody) && c.rtlBody.length),
    'and each is a real body')

  const rtlState = { ...state, meta: { ...state.meta, rtl: true } }
  const ltrBrowser = verifyBrowserFile(state)
  const rtlBrowser = verifyBrowserFile(rtlState)
  const READS_DIRECTION = /getComputedStyle\([a-zA-Z]+\)\.direction/
  assert(!READS_DIRECTION.test(ltrBrowser),
    'an LTR build ships no direction-aware body')
  assert(READS_DIRECTION.test(rtlBrowser),
    'and an RTL build does')
  assert(rtlBrowser.length > ltrBrowser.length,
    `the RTL file is the larger of the two (${rtlBrowser.length} against ${ltrBrowser.length})`)
  /* Neither file may lose a check. A gate that drops one is worse than no
     gate: the run still prints PASS. */
  for (const c of RENDER_CHECKS) {
    assert(ltrBrowser.includes(c.id) && rtlBrowser.includes(c.id),
      `${c.id} survives both directions`)
  }
  assert(verifyNodeFile(rtlState).length === verifyNodeFile(state).length,
    'no SOURCE check is direction-aware, so the node file is the same either way')

  const nodeSrc = verifyNodeFile(), browserSrc = verifyBrowserFile()
  let browserParses = true
  try { new Function(browserSrc) } catch { browserParses = false }
  assert(browserParses, `${VERIFY_BROWSER} parses`)

  /* ── A BACKSLASH INSIDE THE TEMPLATE LITERAL IS EATEN BEFORE IT SHIPS ──
   *
   * Both verifiers are written as template literals, so JS resolves every
   * escape at parse time. A regex typed as \s reaches the emitted file as a
   * bare s. That has two outcomes and only one of them is loud. Writing
   * `/,\s*0\)/` produced an unmatched paren, which the parse assertion above
   * caught. Writing `/,\s*0/` would have produced `/,s*0/`: valid, wrong, and
   * silent for as long as nobody measured what it matched.
   *
   * Every intended backslash in those two regions is doubled, so an ODD run
   * is always a mistake. Scoped to the literals, because ordinary code above
   * and below them writes single backslashes correctly. */
  {
    const src = fs.readFileSync(new URL("../src/emit/verify.js", import.meta.url), "utf8")
    const bt = String.fromCharCode(96)
    /* TOGGLE ON PARITY, because neither delimiter has a reliable shape. The
       opener carries content after it and the closer stands alone, so two
       earlier attempts each opened the region in the wrong place: once on a
       comment that names a file, and once on the FIRST literal's closing
       delimiter. A line holding an odd number of delimiters crosses the
       boundary, and that is true of both ends and of neither comment.
       A toggling line is not scanned, so a backslash sharing a line with a
       delimiter is out of scope. The two files have none. */
    let inLit = false
    const odd = []
    src.split(/\r?\n/).forEach((l, i) => {
      const delims = l.split(bt).length - 1
      if (delims % 2) { inLit = !inLit; return }
      if (!inLit) return
      for (const run of l.match(/\\+/g) || []) {
        if (run.length % 2) odd.push(`line ${i + 1}: ${l.trim().slice(0, 60)}`)
      }
    })
    assert(!inLit, 'the literal scan closed every region it opened')
    assert(odd.length === 0,
      `every backslash in the emitted verifiers is doubled${odd.length ? ` — ${odd[0]}` : ''}`)

    /* AND THE SAME TRAP LIVES IN THE CHECK BODIES, one level further out.
       A body line is a JS string in the SOURCE, so a backslash there has to be
       doubled to survive into the value. Measured: a word-count regex written
       as one backslash reached the shipped file with none, splitting on the
       letter s, and "Recent Invoices" counted as one word.

       Scanned on the SOURCE TEXT, never on the imported value. In the value a
       single backslash is correct, which is what the regex needs, so reading
       the values faulted every check that had one. */
    {
      const src = fs.readFileSync(new URL('../src/emit/checks.js', import.meta.url), 'utf8')
      const bad = []
      src.split(/\r?\n/).forEach((l, i) => {
        /* Only the body entries: a line that is a quoted string on its own. */
        if (!/^\s*"/.test(l)) return
        /* An escaped QUOTE is the one legitimate single backslash here: a body
           line is double-quoted, so a quote inside it must be escaped once.
           Blanked rather than counted. */
        const bare = l.replace(/\\["']/g, '')
        for (const run of bare.match(/\\+/g) || []) {
          if (run.length % 2) bad.push(`line ${i + 1}: ${l.trim().slice(0, 60)}`)
        }
      })
      assert(bad.length === 0,
        `every backslash in a check body is doubled${bad.length ? ` — ${bad[0]}` : ''}`)
    }
  }
  assert(SOURCE_CHECKS.every(c => nodeSrc.includes(c.id)), `${VERIFY_NODE} carries every source check`)
  assert(RENDER_CHECKS.every(c => browserSrc.includes(c.id)), `${VERIFY_BROWSER} carries every render check`)

  /* ONE RULE LIST, THREE CONSUMERS. The contract's checklist is generated from
     the same array, so a rule cannot reach the tool and miss the reader. */
  const contract = agentContract(state, derived)
  const absent = CHECKS.filter(c => !contract.includes(c.line))
  assert(absent.length === 0,
    `every check reaches the contract checklist${absent.length ? ` — missing ${absent.map(c => c.id).join(', ')}` : ` (${CHECKS.length})`}`)

  /* ── POINT IT AT A FAULT, ONE PER CHECK ── */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'))
  const write = (n, t) => fs.writeFileSync(path.join(dir, n), t)
  const runVerify = where => {
    fs.writeFileSync(path.join(where, 'VERIFY.mjs'), nodeSrc)
    try {
      /* Return the OUTPUT, never the empty string. A clean run exits zero and
         prints PASS, and swallowing that made the quiet-on-correct-code
         assertion fail against nothing at all. */
      return execFileSync(process.execPath, [path.join(where, 'VERIFY.mjs'), where], { encoding: 'utf8' })
    } catch (err) { return String(err.stdout || '') + String(err.stderr || '') }
  }

  /* One retired token, in the shape the emitter writes: a comment naming the
     replacement, on the line above the declaration. Multi-line, because the
     check reads the NEXT line and a one-line :root has no next line. */
  write('tokens.css', [
    ':root {',
    '  --c-text: #111;',
    '  --space-md: 16px;',
    '  --font-body-md-family: system-ui;',
    '  /* RETIRED. Use --c-text-muted. Split into two roles with different bars. */',
    '  --c-text-faint: #999;',
    '}',
  ].join('\n'))
  write('broken.css', [
    '.a { color: #ff0000; }',                    /* literal-colour */
    '.b { padding: 13px; }',                     /* off-scale-number */
    '.c { color: var(--c-invented); }',          /* unknown-token */
    '.d { color: var(--c-text, #999); }',        /* fallback-hides-a-token */
    '.e { font-family: Helvetica, sans-serif; }' /* named-font-only */,
    /* align-content-needs-a-line-to-align: a flex row that cannot wrap. */
    '.f { display: flex; align-items: baseline; align-content: center; }',
    /* a-container-query-cannot-style-its-container: the shell declares the
       containment and the query then tries to restyle the shell. */
    '.shell { container-type: inline-size; display: grid; }',
    '@container (max-width: 800px) {\n  .shell { grid-template-columns: 1fr; }\n}',
    /* no-multi-value-token-inside-a-shorthand: a component padding token
       already carries two values, so this expands to three. */
    '.h { padding: var(--space-md) var(--cmp-table-cell-padding); }',
    /* a-shadow-drawn-mark-survives-forced-colors: a state marked with an
       inset shadow, in a file carrying no forced-colors block. That mode
       ignores box-shadow, so the row would lose its only marker. */
    '.row.is-selected > td { box-shadow: inset 4px 0 0 var(--c-text); }',
    /* a-stacking-layer-is-a-token: a hand-typed layer, which is the number
       somebody reaches for when nothing published an order. */
    '.j { position: fixed; z-index: 2001; }',
    /* no-retired-token: a USE of the token tokens.css marks as going. */
    '.k { color: var(--c-text-faint); }',
    /* no-published-token-is-redeclared: a name the system already publishes,
       declared again at another value. The value is ON the grid, so nothing
       else objects, and every var(--space-md) on the page silently moves. */
    ':root { --space-md: 20px; }',
    /* an-auto-margin-cannot-also-hold-a-minimum: one side declared twice,
       once as the push and once as a floor. The later one wins and the other
       was never doing the job its author thought. */
    '.actions { margin-block-start: auto; margin-block-start: var(--space-md); }',
    /* an-underline-is-not-a-border: a chosen tab marked by a border, which
       adds its own height and breaks the strip's rule where it sits. A
       transparent border on the siblings spends the same height. */
    '.tab.is-selected { border-bottom: 2px solid var(--c-accent); }',
    /* a-backdrop-blur-has-an-opaque-fallback: a blur with no opaque base, so
       a build without backdrop-filter paints the raw translucent fill and
       everything behind reads straight through. */
    '.hud { background-color: rgba(30, 41, 52, 0.6); backdrop-filter: blur(10px); }',

    /* a-side-is-named-logically: a physical side. It reads correctly today
       and cannot flip later, and the logical form costs this build nothing.
       The centring pair below is the exemption: an inset with a transform
       keeps its physical side, because translateX has no logical form. */
    '.l { margin-left: auto; text-align: right; }',
    '.m { position: absolute; left: 50%; transform: translateX(-50%); }',
    /* an-exemption-carries-no-weight: a zeroing rule matched with :is(),
       which takes the weight of its heaviest argument and outranks whatever
       component stated that distance on purpose. */
    '.card > :is(.overline, .caption) + .title { margin-block-start: 0; }',
    /* a-control-size-is-a-token: today's real fault, kept in the shape it
       arrived in. The nav item beside it reads the touch token; this action
       types the number that token used to hold, so it stayed 40px while the
       links went to 44 — in one column, at every width. */
    '.nav-item { min-height: var(--target-min, 44px); }',
    '.nav-list > .btn { height: 40px; line-height: 38px; }',
  ].join('\n'))
  write('broken.html', [
    '<html data-theme="light">',                 /* hardcoded-theme */
    '<button id="t" onclick="root.dataset.theme=1"><svg></svg></button>',
    /* state-is-not-an-inline-style: an inline style beats every rule. */
    '<svg class="dash" style="opacity:0"></svg>',
    /* a-widget-owes-its-keys: the Tabs pattern with nothing in the build
       handling an arrow. A keyboard reader cannot leave the first tab. */
    '<div role="tablist"><span role="tab">One</span><span role="tab">Two</span></div>',
    '</html>',                                   /* toggle-states-itself + icon-only-is-named */
  ].join('\n'))
  write('broken.js', 'const css = ' + BACKTICK + '.x { color: red; }' + BACKTICK)
  /* no-shorthand-beside-its-own-longhand: `gap` after `rowGap` sets both axes,
     so the row value never applies once. Both keys are legal and the rendered
     gap is simply not the one the code appears to ask for. */
  write('broken.jsx', [
    'export const Row = () => (',
    '  <div style={{ display: "flex", rowGap: 6, gap: 8 }}>',
    '    <span>one</span>',
    '  </div>',
    ')',
  ].join('\n'))

  const dirty = runVerify(dir)
  for (const c of SOURCE_CHECKS) {
    assert(dirty.includes(c.id), `${c.id} fires on the fault it exists for`)
  }

  /* ── AND STAYS QUIET ON CORRECT CODE ── */
  const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-ok-'))
  /* The clean fixture RETIRES a token too, and never uses it. Without that,
     the quiet half would pass on a project that has retired nothing, which
     proves nothing about the check. */
  fs.writeFileSync(path.join(clean, 'tokens.css'), [
    ':root {',
    '  --c-text: #111;',
    '  --space-md: 16px;',
    '  --edge-w: 4px;',
    '  --z-modal: 400;',
    '  --font-body-md-family: system-ui;',
    '  /* RETIRED. Use --c-text-muted. Split into two roles with different bars. */',
    '  --c-text-faint: #999;',
    '}',
  ].join('\n'))
  fs.writeFileSync(path.join(clean, 'good.css'), [
    '/* A comment naming 13px and #ff0000 is prose, not code. */',
    '.a { color: var(--c-text); padding: var(--space-md); }',
    '.b { border: 1px solid var(--c-text); }',
    '.c { font-family: var(--font-body-md-family); }',
    '@media (min-width: 640px) { .a { padding: var(--space-md); } }',
    /* The CORRECT form of the forced-colors case, not merely its absence. A
       state marked with an inset shadow, in a file that restores it. Without
       this the quiet half would pass on a fixture containing no shadow at
       all, which proves nothing about the check. */
    '.row.is-selected > td { box-shadow: inset var(--edge-w) 0 0 var(--c-text); }',
    '@media (forced-colors: active) {\n  .row.is-selected > td { outline: var(--edge-w) solid Highlight; outline-offset: calc(-1 * var(--edge-w)); }\n}',
    /* The CORRECT forms of the stacking rule: a named layer, and a local
       stacking value that orders two siblings and joins no global order. */
    '.k { position: fixed; z-index: var(--z-modal); }',
    '.l { position: relative; z-index: 1; }',
    /* The CORRECT forms of the three spacing rules, not their absence. A
       fixture that lacks the shape a check reads is silent for the wrong
       reason, and that reads exactly like a passing check. */
    '.actions { margin-block-start: auto; padding-block-start: var(--space-md); }',
    '.card > :where(.overline, .caption) + .title { margin-block-start: 0; }',
    '.two-sides { margin-inline-start: auto; margin-inline-end: var(--space-md); }',
  ].join('\n'))
  /* The CORRECT style object: two longhands and no shorthand beside them. */
  fs.writeFileSync(path.join(clean, 'good.jsx'), [
    'export const Row = () => (',
    '  <div style={{ display: \"flex\", rowGap: 6, columnGap: 8 }}>',
    '    <span>one</span>',
    '  </div>',
    ')',
  ].join('\n'))
  fs.writeFileSync(path.join(clean, 'good.html'), [
    '<html>',
    '<button id="t" aria-pressed="false" aria-label="Light theme is on. Switch to dark.">',
    '<svg></svg></button>',
    '<script>document.documentElement.dataset.theme = "dark"</' + 'script>',
    /* The CORRECT form of the keyboard rule, not merely its absence. A tablist
       whose arrows ARE handled, and the handler in a different file from the
       markup — the shape that made a per-file version fault correct code. */
    '<div role="tablist"><span role="tab" tabindex="0">One</span></div>',
    '</html>',
  ].join('\n'))
  fs.writeFileSync(path.join(clean, 'tabs.js'), [
    'export function onKey(e, tabs, i) {',
    '  if (e.key === "ArrowRight") tabs[(i + 1) % tabs.length].focus()',
    '  if (e.key === "ArrowLeft") tabs[(i - 1 + tabs.length) % tabs.length].focus()',
    '}',
  ].join('\n'))
  const quiet = runVerify(clean)
  assert(/\bPASS\b/.test(quiet) && !/FAIL/.test(quiet),
    `no check fires on correct code${/FAIL/.test(quiet) ? ` — ${quiet.split('\n').filter(l => l.trim()).slice(1, 4).join(' | ')}` : ''}`)

  /* A run that measured nothing is not a pass, and must say so. */
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-empty-'))
  fs.writeFileSync(path.join(empty, 'tokens.css'), ':root { --c-text: #111; }')
  assert(/no source files/.test(runVerify(empty)),
    'an empty run reports that it checked nothing rather than printing PASS')

  for (const d of [dir, clean, empty]) fs.rmSync(d, { recursive: true, force: true })
}

/* ── HOW STRONGLY THE CARD IS SEPARATED ──
 *
 * The wizard asked WHICH separator and never HOW MUCH, so a system wanting a
 * whisper and one wanting a slab got the same card. Four levels now, and the
 * three things that could go wrong with them are each asserted.
 */
line('\n- depth intensity -')
{
  const { BLANK, INTENSITIES, DEPTHS, STEPS, applyAnswers, resolve, cardEdge } =
    await import('../src/casual/answers.js')

  /* ── THE DOOR ADVERTISES A COUNT, SO NOTHING MAY TYPE IT ──
   *
   * The Guided door said "Four questions" from the day it shipped. The
   * one-aspect-per-page split took the wizard to seven and never touched the
   * sentence, so the app under-sold itself by three for as long as that lasted.
   * A number typed into copy is a second source of truth that nothing updates.
   * The note counts STEPS now, and this pins what the count means: every page
   * except the one that hands back the prompt. */
  {
    const asked = STEPS.filter(s => s.id !== 'prompt')
    assert(STEPS.at(-1).id === 'prompt', `the prompt is the last page (${STEPS.at(-1).id})`)
    assert(asked.length === STEPS.length - 1, `exactly one page is not a question (${asked.length} of ${STEPS.length})`)
    const src = fs.readFileSync(new URL('../src/casual/CasualMode.jsx', import.meta.url), 'utf8')
    const typed = src.match(/(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|\d+) questions/i)
    assert(!typed, `the door counts its pages rather than naming a number${typed ? ` — "${typed[0]}"` : ''}`)
  }
  const { buildPrompt } = await import('../src/casual/prompt.js')
  const base = createInitialState()
  const depthLine = a => buildPrompt(a).split('\n').find(l => l.startsWith('- Depth'))

  /* ── ONE DECISION, ONE FIELD, AND ONE FULL STOP ──
   *
   * Both found by simulation run 12, in the prompt the wizard hands an agent.
   *
   * The palette bullet always named a start colour and the brand bullet named
   * a different hex as the accent. Nothing said which wins, so a compliant
   * reader could set the accent to either. The seed is the FALLBACK, so it is
   * stated only when nobody gave a colour.
   *
   * And `bullet()` writes the closing stop, so a branch carrying its own
   * shipped "The first is the accent..". Only one of the two branches did,
   * which is how a doubled stop survives every reading of the output. */
  {
    const withBrand = buildPrompt({ ...BLANK, palette: 'green', brand: ['#1b5e4a'] })
    const without = buildPrompt({ ...BLANK, palette: 'green', brand: [] })
    const paletteOf = p => p.split('\n').find(l => l.startsWith('- Palette')) ?? ''
    assert(!/Start from/.test(paletteOf(withBrand)),
      'a given brand colour leaves the palette bullet naming no seed of its own')
    assert(/the brand colour below/.test(paletteOf(withBrand)),
      'and the palette bullet says where the accent does come from')
    assert(/Start from #[0-9a-f]{6}\.$/.test(paletteOf(without)),
      `with no brand colour the palette bullet names the seed — ${paletteOf(without)}`)
    for (const [label, p] of [['with a brand colour', withBrand], ['without one', without]]) {
      const doubled = p.match(/[a-z0-9)]\.\.(\s|$)/g) ?? []
      assert(doubled.length === 0, `${label}, no bullet ends in two full stops (${doubled.join(', ')})`)
    }
  }

  assert(INTENSITIES.length === 4, `four levels (${INTENSITIES.length})`)
  assert(INTENSITIES.map(i => i.pct).join() === '0,33,66,100',
    `the levels are 0, 33, 66 and 100 per cent (${INTENSITIES.map(i => i.pct).join()})`)

  /* A SHADOW IS A LENGTH, so a fractional macro ships a fractional pixel. The
     base geometry carries a 1px offset, so only whole multipliers survive. */
  for (const i of INTENSITIES) {
    assert(Number.isInteger(i.depth), `${i.id} multiplies by a whole number (${i.depth})`)
    const st = applyAnswers(base, { ...BLANK, depth: 'shadow', intensity: i.id })
    const e = derive(st).elevation
    const frac = [...`${e.raised} ${e.overlay} ${e.modal}`.matchAll(/(\d+\.\d+)px/g)].map(m => m[1])
    assert(frac.length === 0, `${i.id} ships no fractional pixel (${frac.join(', ')})`)
  }

  /* ── THE DEFAULT IS BORDERS AT LIGHT, AND THE ORDER SAYS SO ──
   *
   * `find` falls back to the head of each list, so the listed order and the
   * default are one decision. Pinning both means a reorder cannot silently
   * move what a fresh document renders. */
  assert(DEPTHS[0].id === 'border', `borders are listed first (${DEPTHS.map(d => d.id).join()})`)
  assert(BLANK.depth === 'border', `the default separator is borders (${BLANK.depth})`)
  assert(BLANK.intensity === 'light', `the default intensity is light (${BLANK.intensity})`)

  /* ── THE GROUND ANSWER HAS TO MOVE THE SAMPLE ──
   *
   * It shipped reading `palette.neutral` and ignoring the answer entirely, so
   * all three choices rendered one ground: measured #0e1720 under every one of
   * them, identical to the byte. A setting whose sample cannot move is a
   * sample that proves the setting works.
   *
   * Measured on the ROLE rather than the swatch, because the wizard's panes
   * cross-fade and the outgoing layer mounts first. */
  {
    const groundOf = g => derive(applyAnswers(base, { ...BLANK, ground: g })).roles
    const low = groundOf('cool-low'), vivid = groundOf('cool-vivid')
    assert(low.dark.bg !== vivid.dark.bg,
      `the ground answer moves the dark page (${low.dark.bg} against ${vivid.dark.bg})`)
    assert(low.light.bg !== vivid.light.bg,
      `and the light page too (${low.light.bg} against ${vivid.light.bg})`)
    const c = hex => toOklchObj(hex).c
    assert(c(vivid.dark.surface) > c(low.dark.surface),
      `vivid carries more chroma than low (${c(vivid.dark.surface).toFixed(4)} against ${c(low.dark.surface).toFixed(4)})`)
    /* Every tint has to clear the dead-grey case the whole change is about. */
    for (const g of ['accent', 'cool-low', 'cool-vivid']) {
      const r = groundOf(g)
      assert(c(r.dark.surface) >= 0.020, `the ${g} ground is not a dead grey (chroma ${c(r.dark.surface).toFixed(4)})`)
    }
  }

  /* Three treatments, and the edge weight only reaches the one that draws an
     edge. The padding has to state the SUM, or the label sits under the bar. */
  {
    const { SELECTION_STYLES, SELECTION_EDGES, selectedState, gutterFor } =
      await import('../src/state/components.js')
    assert(Object.keys(SELECTION_STYLES).length === 3,
      `three selection treatments (${Object.keys(SELECTION_STYLES).join()})`)
    const pad = '{spacing.xs} {spacing.sm}'
    for (const [name, spec] of Object.entries(SELECTION_STYLES)) {
      const props = selectedState(name, 'thin', pad)
      assert(!!props.boxShadow === !!spec.edge, `${name} draws an edge only when it says it does`)
      /* ── THE SELECTED STATE NEVER RESTATES PADDING ──
       *
       * It used to state the SUM of the base inset and the bar, which is
       * arithmetically right and staggers the column. Measured in the app's
       * own preview: the selected nav label at 693 against 689 for its four
       * siblings. The gutter belongs to the base, where every row takes it. */
      assert(props.padding === undefined,
        `${name} leaves padding to the base, so no row staggers (${props.padding})`)
      /* And the gutter carries the bar, on every row of the set. */
      const base = gutterFor(name, 'thin', pad)
      assert(spec.edge ? base.includes('4px') : base === pad,
        `${name} reserves the bar in its BASE padding (${base})`)
      /* The fill must never be the accent-subtle hole in dark. */
      if (spec.edge || name === 'lift') {
        assert(props.backgroundColor === '{colors.surface-raised}',
          `${name} steps UP off the surface (${props.backgroundColor})`)
      }
    }
    /* ── THE BAR IS THE PIXEL VALUE, AT EVERY DENSITY ──
     *
     * These were spacing tokens, and a spacing token moves with the density
     * macro: `{spacing.sm}` is 8px at the Dense setting and 12px at the
     * default one. So "medium" rendered a 12px bar under a readout that said
     * 8px. Asserted at both densities, because one density is where the bug
     * hid. */
    for (const [weight, spec] of Object.entries(SELECTION_EDGES)) {
      const props = selectedState('lift-edge', weight, pad)
      assert(props.boxShadow.includes(`${spec.px}px`), `the ${weight} edge is ${spec.px}px (${props.boxShadow})`)
      /* The BASE reserves the gutter, so the content clears the bar and every
         row in the set sits on one inset. */
      const base = gutterFor('lift-edge', weight, pad)
      assert(base.includes(`calc(${spec.px}px + {spacing.sm})`),
        `the ${weight} gutter clears the bar (${base})`)
      /* The horizontal inset stays a token, so only the bar is literal. */
      assert(base.includes('{spacing.sm}'),
        `the ${weight} inset is still a token (${base})`)
      /* The table's selection column takes a bigger step, because its content
         is a 16px checkbox rather than a label. */
      const cell = gutterFor('lift-edge', weight, '{spacing.sm} {spacing.md}', '{spacing.lg}')
      assert(cell.includes(`calc(${spec.px}px + {spacing.lg})`),
        `the ${weight} selection column clears it by the lg step (${cell})`)
      /* ── THE INGREDIENT, BESIDE THE SUM ──
       *
       * The padding above is the ready-made answer and it ASSUMES the
       * component kept its own inset. A build flushed a table's first column
       * to the card's content edge, which another rule in the same document
       * pushes toward, then took the sum anyway. Measured: selected rows
       * starting 16px in against 0 for their neighbours, for a 4px bar. Both
       * rules were ours, so the width is published on its own. */
      assert(props.edgeWidth === `${spec.px}px`,
        `the ${weight} edge publishes its own width (${props.edgeWidth})`)
    }
    for (const dens of [1, 0.82]) {
      const s = createInitialState()
      s.macros.density = dens
      s.components.selection = 'lift-edge'
      s.components.selectionEdge = 'medium'
      const d = derive(s)
      const row = d.components.find(c => c.name === 'nav-item-selected')
      const shadow = row.properties.find(p => p.key === 'boxShadow')?.value
      assert(shadow.includes('8px'), `at density ${dens} the medium bar is still 8px (${shadow})`)
    }

    /* ── ONE TREATMENT, TWO COMPONENTS, TWO INSETS ──
     *
     * The nav item and the table row are both a selected row, so the fill and
     * the label must match. Their PADDING must not: a nav item is inset by
     * `sm` and a table cell by `md`, so the edge compensation differs. A
     * shared constant here would put the table's label 4px out. */
    for (const style of Object.keys(SELECTION_STYLES)) {
      const s = createInitialState()
      s.components.selection = style
      const d = derive(s)
      const nav = d.components.find(c => c.name === 'nav-item-selected')
      const row = d.components.find(c => c.name === 'table-row-selected')
      assert(!!row, `the table publishes a selected row under ${style}`)
      const get = (e, k) => e.properties.find(p => p.key === k)?.value
      for (const k of ['backgroundColor', 'textColor']) {
        assert(get(nav, k) === get(row, k),
          `${style}: the two selected rows share their ${k} (${get(nav, k)} / ${get(row, k)})`)
      }
      if (SELECTION_STYLES[style].edge) {
        /* ── NEITHER SELECTED STATE RESTATES PADDING ──
         *
         * The gutter is on each component's BASE, so the selected row paints
         * into space every row already has. Restating it here is what
         * staggered the column by the bar's width. */
        for (const [label, e] of [['nav item', nav], ['table row', row]]) {
          assert(get(e, 'padding') === undefined,
            `${style}: the ${label} selected state leaves padding alone (${get(e, 'padding')})`)
        }
        /* The gutter lands on the base entries instead, one per component. */
        const navBase = d.components.find(c => c.name === 'nav-item')
        const cellBase = d.components.find(c => c.name === 'table-selection-cell')
        assert(get(navBase, 'padding')?.includes('calc('),
          `${style}: the nav item's base reserves the bar (${get(navBase, 'padding')})`)
        assert(get(cellBase, 'padding')?.includes('{spacing.lg}'),
          `${style}: the selection column clears the bar by the lg step (${get(cellBase, 'padding')})`)
      }
      const hov = d.components.find(c => c.name === 'table-row-hover')
      assert(!!hov, `the table publishes a row hover under ${style}`)
      /* Both rows publish the ingredient, or the escape hatch reaches only
         whichever component somebody remembered. */
      if (SELECTION_STYLES[style].edge) {
        for (const [label, e] of [['nav item', nav], ['table row', row]]) {
          assert(/^\d+px$/.test(get(e, 'edgeWidth') || ''),
            `${style}: the ${label} publishes its edge width (${get(e, 'edgeWidth')})`)
        }
      }
    }
    /* And it reaches CSS under a name the builder can read. */
    {
      /* ── TWO WEIGHTS, SET INDEPENDENTLY ──
       *
       * One value drove both rows. A nav item's row starts with a label and a
       * table's selection row starts with a 16px checkbox, so the same bar
       * reads differently against each. Set them apart here, or the test
       * cannot tell a working split from a shared value. */
      const s = createInitialState()
      s.components.selection = 'lift-edge'
      s.components.selectionEdge = 'wide'
      s.components.tableSelectionEdge = 'medium'
      const css = payloadTextFiles(s, derive(s))['tokens.css']
      for (const [c, px] of [['nav-item', 12], ['table-row', 8]]) {
        assert(css.includes(`--cmp-${c}-selected-edge-width: ${px}px`),
          `tokens.css publishes --cmp-${c}-selected-edge-width at ${px}px`)
      }
    }
    /* The render check that catches a build which took the sum anyway. */
    {
      const { CHECKS } = await import('../src/emit/checks.js')
      const c = CHECKS.find(x => x.id === 'a-selection-edge-costs-only-its-own-width')
      assert(!!c && c.where === 'render', `the jog check ships and runs on the render (${c?.where})`)
      const src = c.body.join('\n')
      assert(src.includes('mark.left - plain.left'),
        'it compares rows in ONE column, so a horizontal tab strip cannot trip it')

      /* ── NO CHECK MEASURES ONE FRAME AFTER A CLICK ──
       *
       * `frame()` is a 60ms guess. The toggle check pressed the control and
       * read the body's colour a frame later, which is the INTERPOLATED value
       * of a transition still in flight, so a working toggle read as dead —
       * intermittently, which is worse than always. Every check that presses
       * something waits for the browser to say it has finished. */
      for (const chk of CHECKS) {
        const body = (chk.body || []).join('\n')
        if (!/\.click\(\)/.test(body)) continue
        assert(/settle\(/.test(body) && !/\bframe\(\)/.test(body),
          `${chk.id} settles after pressing, rather than guessing a frame`)
      }
    }
  }

  {
    const d = applyAnswers(base, { ...BLANK })
    assert(d.macros.depth === 0, `a fresh document draws no shadow (${d.macros.depth})`)
    assert(d.components.overrides['card.borderColor'] === '{colors.border-subtle}',
      `a fresh document draws a hairline edge (${d.components.overrides['card.borderColor']})`)

    /* And what the two answers rendered BEFORE this control existed is still
       reachable, one step away, rather than gone. */
    const sh = applyAnswers(base, { ...BLANK, depth: 'shadow', intensity: 'medium' })
    const bd = applyAnswers(base, { ...BLANK, depth: 'border', intensity: 'medium' })
    assert(sh.macros.depth === 2 && sh.components.overrides['card.borderColor'] === '{colors.border-subtle}',
      `shadows at medium still render what the shadow answer used to (${sh.macros.depth}, ${sh.components.overrides['card.borderColor']})`)
    assert(bd.macros.depth === 0 && bd.components.overrides['card.borderColor'] === '{colors.border}',
      `borders at medium still render what the border answer used to (${bd.macros.depth}, ${bd.components.overrides['card.borderColor']})`)
  }

  /* THE CONTROL HAS TO MOVE SOMETHING, or it is a setting that proves itself.
     Every level of each answer must differ from every other. */
  for (const sep of DEPTHS.map(d => d.id)) {
    const seen = new Set()
    for (const i of INTENSITIES) {
      const st = applyAnswers(base, { ...BLANK, depth: sep, intensity: i.id })
      const painted = `${derive(st).elevation.raised}|${st.components.overrides['card.borderColor']}`
      assert(!seen.has(painted), `${sep} at ${i.id} paints something no other level does`)
      seen.add(painted)
    }
  }

  /* ONE WRITER. The prompt must ask for exactly what `applyAnswers` painted,
     or the picture promises a card the agent will not build. */
  for (const sep of DEPTHS.map(d => d.id)) {
    for (const i of INTENSITIES) {
      const a = { ...BLANK, depth: sep, intensity: i.id }
      const st = applyAnswers(base, a)
      const l = depthLine(a)
      assert(l.includes(`depth macro to ${st.macros.depth}`),
        `${sep}/${i.id}: the prompt names the macro the preview used (${l})`)
      assert(l.includes(st.components.overrides['card.borderColor']),
        `${sep}/${i.id}: the prompt names the edge the preview used (${l})`)
      /* A PERCENTAGE ONLY MEANS SOMETHING WHERE THERE IS A MACRO TO SET. For a
         shadow the intensity IS a depth step and the number is actionable. For
         a border there is no macro at all: the intensity picks a step on the
         neutral ramp, which the same line already names as a colour. This
         asserted the number on every strategy, so a reader was sent hunting for
         a 33% control the editor does not have. `answers.js` says so in its own
         comment, four lines from the value. */
      if (sep === 'shadow') {
        assert(l.includes(`${i.pct}%`), `${sep}/${i.id}: the prompt states the percentage`)
      } else {
        assert(!l.includes('%'), `${sep}/${i.id}: the prompt states no percentage, because a border has no macro`)
      }
    }
  }

  /* An edge is a STEP ON THE RAMP, never a faded colour: a 33% border invents
     a value between two published weights. */
  for (const i of INTENSITIES) {
    const edge = cardEdge(resolve({ ...BLANK, depth: 'border', intensity: i.id }))
    assert(edge === 'transparent' || /^\{colors\.border(-subtle|-strong)?\}$/.test(edge),
      `the ${i.id} edge is a published token, not a fade (${edge})`)
  }

  /* And every combination still audits clean. */
  for (const sep of DEPTHS.map(d => d.id)) {
    for (const i of INTENSITIES) {
      const st = applyAnswers(base, { ...BLANK, depth: sep, intensity: i.id })
      const f = audit(st, derive(st))
      assert(f.length === 0, `${sep}/${i.id} audits clean (${f.map(x => x.id).join(', ')})`)
    }
  }
}

/* ── THE SELECTION EDGE, AND WHICH MECHANISM DRAWS IT ──
 *
 * An inset shadow paints inside the border box and the BORDER paints on top of
 * it. A table row carries a bottom hairline, so the bar came out 56px in a
 * 57px row and stopped short at every boundary. A nav item has no rule
 * crossing it, so the shadow is still right there. */
{
  line('\n- the selection edge -')
  const { selectedState } = await import('../src/state/components.js')
  const { CHECKS } = await import('../src/emit/checks.js')

  const plain = selectedState('edge', 'medium')
  const ruled = selectedState('edge', 'medium', { ruled: true })
  assert(typeof plain.boxShadow === 'string' && /inset/.test(plain.boxShadow),
    'which mechanism draws the bar depends on whether a rule crosses the row: an unruled set takes an inset shadow, which costs no element')
  assert(ruled.boxShadow === undefined,
    'and a row that a rule crosses takes a pseudo-element, so a ruled set publishes no shadow at all')
  /* Both publish the INGREDIENTS, so a build that sets its own inset can
     rebuild the bar rather than taking a sum it no longer uses. */
  for (const [what, props] of [['unruled', plain], ['ruled', ruled]]) {
    assert(props.edgeWidth && /^\d+px$/.test(props.edgeWidth),
      `${what}: the bar width is published on its own (${props.edgeWidth})`)
    assert(props.edgeColor === '{colors.accent}',
      `${what}: and so is its colour (${props.edgeColor})`)
  }

  /* A treatment with no edge draws no bar and publishes no ingredients. */
  for (const style of ['tint', 'lift']) {
    const none = selectedState(style, 'medium', { ruled: true })
    assert(none.edgeWidth === undefined && none.boxShadow === undefined,
      `the ${style} treatment publishes no edge at all`)
  }


  /* ── A STRIPE AND A ROW RULE DO DIFFERENT JOBS ──
   *
   * The rule store said "striping replaces the row divider — two ways of
   * saying a new row begins is noise". That was wrong on screen: dropping the
   * rule left ten rows floating in two shades. The band carries the rhythm
   * ACROSS a wide row and the rule marks WHERE one row ends, so a long table
   * takes both. Carbon does. `preview.css` has said so for as long as the
   * setting has existed, and the old wording sat in the rule store
   * contradicting it.
   *
   * So the setting has to OFFER both, and the two have to differ in the
   * emitted instruction. An option that reads the same as its neighbour is a
   * decision the reader still has to make. */
  {
    const { LAYOUT_COMPONENTS } = await import('../src/state/componentLayout.js')
    const rows = LAYOUT_COMPONENTS.find(c => c.name === 'table')
      ?.fields.find(f => f.k === 'rows')
    assert(!!rows, 'the table publishes a row-separation setting')
    const values = rows.options.map(o => o.value)
    for (const want of ['lines', 'zebra', 'both', 'none'])
      assert(values.includes(want), `and it offers ${want}`)
    const say = v => rows.options.find(o => o.value === v).sentence
    assert(/rule/i.test(say('lines')) && !/stripe|zebra|alternat/i.test(say('lines')),
      'rules alone states a rule and no band')
    assert(/stripe|alternat/i.test(say('zebra')) && /no rules/i.test(say('zebra')),
      'zebra alone states a band and says the rules are gone')
    assert(/stripe|alternat/i.test(say('both')) && /rule/i.test(say('both')),
      'and both states the band AND the rule, because a stripe and a row rule do different jobs')
    assert(new Set(['lines', 'zebra', 'both', 'none'].map(say)).size === 4,
      'no two options emit the same instruction')
  }

  /* THE CHECK MUST SEE BOTH MECHANISMS. Asking only about box-shadow goes
     silent the moment a build does the correct thing in a ruled table.
     Proven in a browser on the pseudo-element form: silent on a correct row,
     and firing on an injected jog and on a gutter of bar-plus-nothing. */
  const edgeCheck = CHECKS.find(c => c.id === 'a-selection-edge-costs-only-its-own-width')
  for (const [what, lines] of [['body', edgeCheck.body], ['rtlBody', edgeCheck.rtlBody]]) {
    const src = lines.join('\n')
    assert(/pseudoBar/.test(src) && /::before/.test(src),
      `the edge check reads the pseudo-element too, in its ${what}`)
    assert(/boxShadow/.test(src),
      `and still reads the shadow, in its ${what}`)
  }
}

/* ── THE THREE PLANES ON ONE ROW, AND THE ORDER THEY SIT IN ──
 *
 * Nothing measured this. `planeCollision` asks whether two of them resolved to
 * one hex, which is the loudest form of the fault. The common form is the
 * ORDER: a stripe louder than a selection reads as banded rather than as
 * chosen, and both numbers are individually fine, so no contrast check has an
 * opinion.
 *
 * MEASURED FIRST, THEN THE BAR. Across the six presets in both modes: the
 * stripe reads 1.03 to 1.07 against the surface, the selection 1.15 to 1.23,
 * and the two sit 1.15 to 1.20 apart. The rule's own numbers were 1.13, 1.27
 * and 1.12 when it was written, so a check pinning those constants would fail
 * today on a palette nobody thinks is broken. The RELATIONSHIP is the rule.
 */
{
  line('\n- the three planes on one row -')
  const { audit } = await import('../src/a11y/audit.js')
  const { PRESETS } = await import('../src/state/presets.js')
  const ROW = f => f.id.startsWith('rowplane:') ||
    /^nontext:border:(selected|row-stripe):/.test(f.id)

  const lumOf = hex => {
    const c = hex.replace('#', '').match(/../g).slice(0, 3).map(h => {
      const v = parseInt(h, 16) / 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const ratioOf = (a, b) => {
    const x = lumOf(a), y = lumOf(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }

  let worstStripe = 0, closestOrder = Infinity, widestGap = 0, loudestSel = 0
  for (const p of PRESETS) {
    const s = p.patch()
    const d = derive(s)
    for (const mode of ['light', 'dark']) {
      const R = d.roles[mode]
      const stripe = ratioOf(R.surface, R['row-stripe'])
      const sel = ratioOf(R.surface, R.selected)
      worstStripe = Math.max(worstStripe, stripe)
      closestOrder = Math.min(closestOrder, sel - stripe)
      widestGap = Math.max(widestGap, ratioOf(R['row-stripe'], R.selected))
      const cs = toOklchObj(parseColorFor(R.selected)).c
      const cg = Math.max(toOklchObj(parseColorFor(R.surface)).c, toOklchObj(parseColorFor(R.bg)).c)
      loudestSel = Math.max(loudestSel, cs - cg)
    }
  }
  assert(worstStripe < 1.6,
    `a stripe is rhythm and a band is a boundary, so every stripe stays under the band (worst ${worstStripe.toFixed(2)}:1, bar 1.6)`)
  assert(closestOrder > 0,
    `a selection always stands further off the surface than the stripe (closest margin ${closestOrder.toFixed(2)})`)
  assert(widestGap < 1.5,
    `the stripe and the selection are one step apart, not two (widest ${widestGap.toFixed(2)}:1, bar 1.5)`)
  assert(loudestSel <= 0.01,
    `a selected row is not an accent-subtle background, so no selection is a saturated tint (loudest ${loudestSel.toFixed(3)} of chroma over its own neutral planes, bar 0.01)`)

  /* QUIET ON CORRECT CODE, which is the half that costs more when it is
     missing. A check that fires on a shipped preset trains a reader to skim. */
  for (const p of PRESETS) {
    const s = p.patch()
    const hits = audit(s, derive(s)).filter(ROW)
    assert(hits.length === 0,
      `${p.id} reports nothing about its own rows${hits.length ? ` — ${hits.map(h => h.id).join(', ')}` : ''}`)
  }

  /* AND EVERY BAR FIRES ON THE FAULT IT WAS SET AGAINST. A bar proven on one
     fault says nothing about the others, so each is injected on its own and
     the finding is read by ID rather than counted. */
  const put = (role, light, dark) => {
    const n = structuredClone(createInitialState())
    n.color.roles[role] = { light, dark }
    return n
  }
  const FAULTS = [
    ['row-stripe', 'neutral.300', 'neutral.700', 'stripe-is-a-band',
      'a stripe two steps off the surface, which divides the table into blocks'],
    ['row-stripe', 'neutral.200', 'neutral.800', 'order',
      'a stripe louder than the selection, so the rhythm beats the choice'],
    ['selected', 'accent.200', 'accent.700', 'selection-is-tinted',
      'the baby-blue selection they rejected on sight'],
    ['selected', 'neutral.50~100@0.4', 'neutral.900', 'order',
      'a selection resolving to the surface it sits on'],
  ]
  for (const [role, light, dark, want, why] of FAULTS) {
    const s = put(role, light, dark)
    const ids = audit(s, derive(s)).filter(ROW).map(f => f.id)
    assert(ids.some(id => id.endsWith(':' + want)),
      `${want} fires on ${why}${ids.length ? '' : ' — nothing fired at all'}`)
  }

  /* THE OUTLINE ON THE TWO GROUNDS NOBODY MEASURED IT ON. `border` was asked
     about `surface` and `bg`, the two lightest planes a control stands on. */
  let worstBorder = Infinity
  for (const p of PRESETS) {
    const d = derive(p.patch())
    for (const mode of ['light', 'dark']) {
      const R = d.roles[mode]
      for (const ground of ['selected', 'row-stripe'])
        worstBorder = Math.min(worstBorder, ratioOf(R.border, R[ground]))
    }
  }
  assert(worstBorder >= 3,
    `lightening a selected row also fixes the control on it, so the outline clears 1.4.11 on a selected and a striped row (worst ${worstBorder.toFixed(2)}:1)`)
}

/* ── RETIRING A TOKEN ──
 *
 * A system that never deletes anything becomes unusable, and one that deletes
 * without warning breaks every build that imported the name. */
{
  line('\n- retiring a token -')
  const none = payloadTextFiles(state, derived)
  assert(!/### Retired/.test(none['DESIGN.md']),
    'a system with nothing retired ships no heading about retirement')
  assert(!/\$deprecated/.test(none['tokens.json']),
    'and no $deprecated in the interop file')
  assert(!/RETIRED\./.test(none['tokens.css']),
    'and no mark in the stylesheet')

  const s2 = {
    ...state,
    deprecated: [{ token: 'text-subtle', replacement: '--c-text-muted', reason: 'Split into two roles with different contrast bars.' }],
  }
  const d2 = derive(s2)
  const f2 = payloadTextFiles(s2, d2)

  /* THE VALUE SURVIVES. That is the whole point: nothing breaks today. */
  const json = JSON.parse(f2['tokens.json'])
  const entry = json.color.light['text-subtle']
  assert(entry != null, 'a retired token is still emitted')
  assert(entry.$value === derived.roles.light['text-subtle'],
    'and keeps the value it had')
  assert(typeof entry.$deprecated === 'string' && entry.$deprecated.includes('--c-text-muted'),
    `and its $deprecated names the replacement (${JSON.stringify(entry.$deprecated)})`)
  /* A string rather than `true`, because "deprecated" alone tells a reader to
     stop and never where to go. */
  assert(entry.$deprecated !== true, 'the mark is a message, not a bare true')
  assert(json.color.light['text-muted'].$deprecated === undefined,
    'and nothing else is marked')

  const css2 = f2['tokens.css']
  assert(/RETIRED\. Use --c-text-muted\./.test(css2),
    'tokens.css carries the mark above the declaration')
  assert(new RegExp('RETIRED[^\\n]*\\n\\s*--c-text-subtle\\s*:').test(css2),
    'and the mark sits on the line ABOVE it, which is the shape the check reads')
  assert(css2.includes('--c-text-subtle:'), 'and the declaration is still there')

  const md2 = f2['DESIGN.md']
  assert(/### Retired/.test(md2), 'DESIGN.md gains the Retired section')
  assert(md2.includes('--c-text-subtle') && md2.includes('--c-text-muted'),
    'and names both the retired token and its replacement')
}

/* ── THE CHART SCALES ──
 *
 * Published or not, a builder charting anything picks a palette. Unpublished,
 * it is one that does not follow the brand. */
{
  line('\n- the chart scales -')
  const { buildDataviz, categorical, worstPair, withoutRedGreen, NEIGHBOUR_FLOOR, CATEGORICAL_COUNT }
    = await import('../src/color/dataviz.js')

  const dv = derived.dataviz
  assert(dv.categorical.length === CATEGORICAL_COUNT, `${CATEGORICAL_COUNT} categorical colours (${dv.categorical.length})`)
  assert(dv.sequential.length === 9, `9 sequential steps (${dv.sequential.length})`)
  assert(dv.diverging.length === 9, `9 diverging steps (${dv.diverging.length})`)
  assert(dv.categorical.every(h => /^#[0-9a-f]{6}$/i.test(h)), 'every categorical colour is a hex')

  /* Series one IS the brand, so the first swatch of every chart is the colour
     the reader already associates with the system. */
  const accent = state.color.seeds.find(s => s.name === 'accent').hex
  const hueOf = h => toOklchObj(parseColorFor(h)).h ?? 0
  assert(Math.abs(hueOf(dv.categorical[0]) - hueOf(accent)) < 2,
    `series one carries the accent hue (${hueOf(dv.categorical[0]).toFixed(1)} vs ${hueOf(accent).toFixed(1)})`)

  /* EVERY pair, not only the adjacent ones: two series touch anywhere in a
     pie, and a stacked bar puts any two together when a category is empty. */
  for (const p of [null, ...PRESETS]) {
    const st = p ? applyPreset(p.id, createInitialState()) : createInitialState()
    const set = buildDataviz(st.color.seeds, derive(st).ramps)
    const w = worstPair(set.categorical)
    assert(w.distance >= NEIGHBOUR_FLOOR,
      `${p ? p.id : 'default'}: worst chart pair clears the floor (${w.distance.toFixed(3)} >= ${NEIGHBOUR_FLOOR}, series ${w.a + 1} v ${w.b + 1})`)
  }

  /* THE ORDER IS THE CONTRACT. The same seed must give the same palette, or
     two charts of the same data disagree. */
  assert(categorical(accent).join() === categorical(accent).join(),
    'the palette is deterministic, so series one is always series one')
  /* And it is DERIVED, not a fixed set dressed up as one. */
  assert(categorical(accent).join() !== categorical('#c13e2e').join(),
    'a different seed gives a different palette')

  /* ── THE THREE CURVES, ASSERTED AS CURVES ──
   *
   * This used to assert four cycling lightness levels. The scale sweeps now,
   * and a sweep is what makes it read as a family rather than as a swatch
   * drawer, so the properties worth pinning are the shapes themselves. Assert
   * the RESULT, not the constant, so a change to how it is computed still has
   * to produce a sweep. */
  const cat = dv.categorical
  const okOf = h => toOklchObj(parseColorFor(h))
  const Ls = cat.map(h => okOf(h).l)
  const Cs = cat.map(h => okOf(h).c ?? 0)

  /* ONE turning point: the lightness rises to a peak and comes back down. A
     cycle has three or more, which is exactly what it looked like. */
  let turns = 0
  for (let i = 1; i < Ls.length - 1; i++) {
    const up = Ls[i] > Ls[i - 1], next = Ls[i + 1] > Ls[i]
    if (up !== next) turns++
  }
  assert(turns === 1, `the lightness arcs once rather than cycling (${turns} turning points, ${Ls.map(v => (v * 100).toFixed(0)).join(' ')})`)

  /* The chroma rises the whole way, so the set has a quiet member and a loud
     one instead of alternating between them. */
  const rising = Cs.every((v, i) => i === 0 || v >= Cs[i - 1] - 0.001)
  assert(rising, `the chroma rises along the run (${Cs.map(v => v.toFixed(2)).join(' ')})`)

  /* And the hue turns one way. A sweep that doubles back is a cycle again. */
  const steps = []
  for (let i = 1; i < cat.length; i++) {
    let d = (okOf(cat[i]).h ?? 0) - (okOf(cat[i - 1]).h ?? 0)
    while (d > 180) d -= 360
    while (d < -180) d += 360
    steps.push(d)
  }
  assert(steps.every(d => d < 0) || steps.every(d => d > 0),
    `the hue sweeps one direction (${steps.map(d => d.toFixed(0)).join(', ')})`)

  /* The steps are UNEVEN, because an even walk is the metronome this replaced.
     The reference measures 43, 96, 29 and 23 degrees. */
  const spreadOfSteps = Math.max(...steps.map(Math.abs)) - Math.min(...steps.map(Math.abs))
  assert(spreadOfSteps > 10,
    `the hue steps are uneven (${spreadOfSteps.toFixed(0)} degrees between the widest and narrowest)`)
  const cvdWorst = (() => {
    let m = Infinity
    for (let i = 0; i < dv.categorical.length; i++)
      for (let j = i + 1; j < dv.categorical.length; j++)
        m = Math.min(m, withoutRedGreen(dv.categorical[i], dv.categorical[j]))
    return m
  })()
  assert(cvdWorst > 0.010,
    `four levels beat two without red-green (${cvdWorst.toFixed(3)} against 0.003 on two)`)

  /* The scales reach every consumer, and once each. They do not change with
     the theme, so they belong outside the theme blocks. */
  const files = payloadTextFiles(state, derived)
  const css = files['tokens.css']
  assert((css.match(/--chart-1\s*:/g) || []).length === 1,
    `--chart-1 is declared once in tokens.css (${(css.match(/--chart-1\s*:/g) || []).length})`)
  assert((css.match(/--chart-[a-z0-9-]+\s*:/g) || []).length === 23,
    `all 23 chart tokens reach tokens.css (${(css.match(/--chart-[a-z0-9-]+\s*:/g) || []).length})`)
  const json = JSON.parse(files['tokens.json'])
  assert(Object.keys(json.color?.chart?.categorical ?? {}).length === CATEGORICAL_COUNT,
    'the categorical scale reaches tokens.json')
  assert(json.color.chart.categorical['1'].$type === 'color', 'and carries a DTCG type')

  const md = files['DESIGN.md']
  /* ── EVERY TABLE IS ONE CONTIGUOUS BLOCK ──
   *
   * The stacking-order table shipped as eleven separate entries of a list this
   * emitter joins with a blank line, so markdown read it as eleven paragraphs
   * of pipes rather than as a table. It was the only table in the document
   * written by hand instead of through `table()`, and nothing was looking.
   *
   * A blank line between two pipe lines is a fault UNLESS what follows it is a
   * NEW table, and a new table is exactly a header line with a separator row
   * under it. The Motion section ships two adjacent tables that way — durations
   * then easings — and the first version of this check faulted both. Pointing a
   * new check at correct code before shipping it is the whole reason that was
   * caught here rather than by them. */
  const SEPARATOR = /^\|[\s:|-]+\|$/
  for (const [file, text] of Object.entries(files)) {
    if (!file.endsWith('.md')) continue
    const lines = text.split('\n')
    const broken = []
    for (let i = 1; i < lines.length - 1; i++) {
      if (lines[i].trim() !== '') continue
      if (!lines[i - 1].startsWith('|') || !lines[i + 1].startsWith('|')) continue
      const startsNewTable = SEPARATOR.test(lines[i + 2] ?? '')
      if (!startsNewTable) broken.push(i + 1)
    }
    assert(broken.length === 0,
      `${file} has no blank line inside a table${broken.length ? ` — line ${broken.slice(0, 4).join(', ')}` : ''}`)
  }

  /* ── THE DOCUMENT NAMES A PROPERTY THAT EXISTS ──
   *
   * The families table listed three roles — display, body, mono — while
   * tokens.css publishes families on the SCALE roles, so the mono family lives
   * on `--font-code-family` and the document said "the mono family" and never
   * that name. Building from it, the obvious guess `--font-mono-family`
   * resolved to nothing, painted nothing and reported nothing. The Sass file
   * calls the same family `$font-mono`, so one thing had three names across
   * four files and the document bridged none of them.
   *
   * Assert the bridge rather than the wording: every property the table names
   * has to be declared in tokens.css. */
  {
    const named = [...md.matchAll(/`var\((--font-[a-z0-9-]+-family)\)`/g)].map(m => m[1])
    assert(named.length >= 3, `the families table names a custom property per role (${named.length})`)
    const missing = named.filter(n => !css.includes(`${n}:`))
    assert(missing.length === 0,
      `every family property the document names is declared in tokens.css${missing.length ? ` — ${[...new Set(missing)].join(', ')}` : ''}`)
  }

  assert(/### Charts/.test(md), 'DESIGN.md carries the Charts section')
  assert(md.includes(dv.worst.distance.toFixed(3)), 'and states the measured worst pair')
  assert(md.includes(dv.worstWithoutRedGreen.toFixed(3)),
    'and states the limit without red-green rather than claiming safety')
  assert(md.includes(dv.categorical[0]), 'and lists the actual colours')
}

/* ── TWO MINIMUMS, BECAUSE A FINGER AND A MOUSE ARE DIFFERENT SIZES ──
 *
 * Only the touch target used to be published, so the mouse minimum was a
 * number the layout tool held as a literal and no document stated. A number a
 * tool holds and a document does not is a number nobody can change and a
 * builder will invent.
 *
 * BOTH, IN EVERY FORMAT. A build importing the Sass file and never opening the
 * stylesheet has to find them too, and the DTCG file is what a non-CSS
 * consumer reads. So this asserts the bridge in each, rather than the wording
 * in one.
 */
{
  line('\n- two minimums, in every format -')
  const files = payloadTextFiles(state, derived)
  const md = files['DESIGN.md']

  /* The CSS names, which the render verifier reads off the element. */
  for (const prop of ['--target-min', '--target-min-pointer']) {
    assert(files['tokens.css'].includes(prop + ':'),
      `tokens.css declares ${prop}`)
    assert(files['tailwind.css'].includes(prop),
      `and tailwind.css carries it`)
    assert(files['_tokens.scss'].includes(prop),
      `and _tokens.scss bridges it`)
  }
  /* AND THE SASS NAME, because a Sass consumer writes `$target-min` and only
     the file can join the two. The mono family cost a build for exactly this
     gap: three names across four files and no bridge between any pair. */
  for (const name of ['$target-min', '$target-min-pointer']) {
    assert(files['_tokens.scss'].includes(name + ':'),
      `_tokens.scss declares ${name}`)
  }
  /* The DTCG file is what a consumer that cannot resolve var() reads. */
  {
    const json = JSON.parse(files['tokens.json'])
    const flat = JSON.stringify(json)
    assert(/"target"/.test(flat), 'tokens.json carries a target group')
  }

  /* THE TWO VALUES ARE DIFFERENT, or one of them is not a decision. 44px is a
     finger and 24px is WCAG 2.5.8 at AA for a pointer. */
  const valueOf = prop => {
    const m = new RegExp(prop + ':\\s*([^;]+)').exec(files['tokens.css'])
    return m ? m[1].trim() : null
  }
  const touch = valueOf('--target-min'), fine = valueOf('--target-min-pointer')
  assert(touch && fine && touch !== fine,
    `a finger and a mouse take different minimums (${touch} against ${fine})`)

  /* AND THE DOCUMENT SAYS WHICH IS WHICH. A published pair with no prose is
     two numbers a reader has to guess between. */
  assert(/coarse|finger|touch/i.test(md) && /fine|mouse|pointer/i.test(md),
    'DESIGN.md says which minimum belongs to which pointer')

  /* READ IT OFF THE ELEMENT, NEVER THE ROOT. An exported build sets its tokens
     on :root; an editor hosting a preview sets them on the preview own scope.
     A custom property inherits, so the control answers in both — and asking
     the root read empty inside a hosted preview, which silently restored the
     literal the tool used to hold. */
  const { CHECKS: C2 } = await import('../src/emit/checks.js')
  const floor = C2.find(c => c.id === 'target-floor-for-the-pointer')
  const src = (floor.body ?? []).join('\n')
  assert(/getComputedStyle\((el|row|node|target)/.test(src) || !/documentElement/.test(src),
    'the target check reads the property off the element rather than off the root')
  assert(/pointer: coarse/.test(src),
    'and asks the POINTER rather than the width, because a narrow window on a desktop is not a finger')
}

/* ── THE FURNITURE HALF OF THE CHARTS SECTION ──
 *
 * The section shipped three colour scales and nothing else. Twelve chart types
 * publish an axis colour, a gridline colour, a stroke weight, a marker size, a
 * bar gap and an area fill, and the prose named none of them — so a reader who
 * never opens the component tables learned the palette and invented all six.
 *
 * EVERY NUMBER IS READ OFF THE COMPONENT, and that is what is asserted here.
 * A sentence that types a value is a copy of a decision, and it drifts the
 * first time the decision moves. Three sentences in this file have already
 * done exactly that.
 */
{
  line('\n- the chart furniture reaches the reader -')
  const { LAYOUT_COMPONENTS: LC } = await import('../src/state/componentLayout.js')
  const md = payloadTextFiles(state, derived)['DESIGN.md']
  const css = payloadTextFiles(state, derived)['tokens.css']

  /* Each rule, by the words a reader would search for. */
  const RULES = [
    ['A CHART IS MOSTLY FURNITURE', 'the colour is the easy half'],
    ['THE AXIS IS HEAVIER THAN A GRIDLINE', 'the pair, and the direction'],
    ['GRIDLINES BELONG TO THE VALUE AXIS ALONE', 'a category axis has no quantity to read against'],
    ['A ZERO LINE IS NOT A GRIDLINE', 'it carries the axis weight'],
    ['THE CONTAINER OWNS THE PLOT INSET', 'twenty plots doubly inset'],
    ['ONE STROKE WEIGHT FOR EVERY LINE IN EVERY TYPE', 'one weight, not one per type'],
    ['A SINGLE SERIES TAKES ONE COLOUR, NEVER FIVE', 'five colours say five things'],
    ['AN ARRANGEMENT IS NOT A TYPE', 'stacked and grouped earn entries anyway'],
    ['THE LEGEND IS THE DIRECT LABEL', 'the words are what make it certain'],
    ['AND THE SITUATIONS ARE NOT OPTIONAL', 'six states nobody draws'],
  ]
  for (const [phrase, why] of RULES) {
    assert(md.includes(phrase), `DESIGN.md states ${why}`)
  }

  /* ── THE VALUES COME FROM THE COMPONENTS, NEVER FROM THE PROSE ──
     Read each one back out of the emitted sentence and compare it against the
     component that publishes it. A sentence that hardcoded a value would pass
     a phrase check and fail this. */
  const byName = Object.fromEntries(derived.components.map(c => [c.name, c]))
  const valOf = (name, key) => {
    const hit = (byName[name]?.properties ?? []).find(p => p.key === key)
    return hit ? String(hit.value) : null
  }
  const PREFIX = { colors: '--c-', spacing: '--space-', borderWidths: '--border-', rounded: '--radius-' }
  const propOf = (name, key) => {
    const m = /^\{([a-zA-Z]+)\.([\w-]+)\}$/.exec(valOf(name, key) || '')
    return m && PREFIX[m[1]] ? 'var(' + PREFIX[m[1]] + m[2] + ')' : null
  }
  const NAMED = [
    ['chart-column', 'axisColor', 'the axis colour'],
    ['chart-column', 'gridColor', 'the gridline colour'],
    ['chart-column', 'axisWidth', 'the hairline both draw at'],
    ['chart-line', 'lineWidth', 'the one stroke weight'],
    ['chart-line', 'markerSize', 'the marker size'],
    ['chart-scatter', 'markerSizeDense', 'the dense marker size'],
    ['chart-column', 'barGap', 'the gap between columns'],
    ['chart-grouped', 'barGap', 'the gap inside a group'],
    ['chart-grouped', 'groupGap', 'the gap between groups'],
  ]
  for (const [name, key, what] of NAMED) {
    const prop = propOf(name, key)
    assert(prop && md.includes('`' + prop + '`'),
      `and names the property for ${what} (${prop})`)
    /* ── A DOCUMENT THAT NAMES A PROPERTY MUST DECLARE IT ──
       The mono family cost a build for exactly this: three names across four
       files and no bridge between any pair, so the obvious guess resolved to
       nothing, painted nothing and reported nothing. */
    const bare = prop.replace(/^var\(|\)$/g, '')
    assert(css.includes(bare + ':'),
      `and ${bare} is declared in tokens.css`)
  }
  /* The area fill is a bare number rather than a reference: an opacity belongs
     to no scale, which is exactly why it needs a published home. */
  const fill = valOf('chart-area', 'fillOpacity')
  assert(fill && md.includes('IS ' + fill + ' OF ITS SERIES COLOUR'),
    `and states the area fill from the component (${fill})`)

  /* ── THE ARRANGEMENT FIELDS, WHICH HAD NOWHERE TO LIVE ──
     `components.js` says beside the gridline tokens that the value-axis rule
     is an arrangement rather than a value, so it lives in LAYOUT_COMPONENTS.
     It did not: there was no chart entry at all, so a builder decided where
     the gridlines went, what proportion the plot took and how the series were
     named, differently each time. */
  const chart = LC.find(c => c.name === 'chart')
  assert(!!chart, 'the chart publishes a composition entry of its own')
  for (const k of ['gridlines', 'ratio', 'series', 'values'])
    assert(chart.fields.some(f => f.k === k), `and a ${k} field`)
  const field = k => chart.fields.find(f => f.k === k)
  assert(field('gridlines').default === 'value',
    'the gridlines default to the value axis, which is the rule the tokens assume')
  assert(field('ratio').default === '2 / 1',
    'and the plot to 2 / 1, which is the reading proportion for a plot wider than it is tall')
  /* EVERY OPTION EMITS A DIFFERENT INSTRUCTION. An option that reads the same
     as its neighbour is a decision the reader still has to make. */
  for (const f of chart.fields) {
    const said = f.options.map(o => o.sentence)
    assert(new Set(said).size === said.length,
      `no two ${f.k} options emit the same instruction (${said.length})`)
    assert(said.every(s => s && s.length > 40),
      `and each states a rule rather than a name`)
  }
  /* AND THE ARRANGEMENT REACHES THE READER, not only the panel. */
  const composition = md.slice(md.indexOf('**Chart composition**'))
  assert(md.includes('**Chart composition**'), 'the chart composition reaches DESIGN.md')
  for (const f of chart.fields) {
    const chosen = derived.componentLayout.chart[f.k]
    const opt = f.options.find(o => o.value === chosen)
    assert(composition.includes(opt.sentence.slice(0, 60)),
      `and carries the ${f.k} instruction it is set to`)
  }
}

/* ── THE KEYBOARD CONTRACT, AND THE GUARDS ITS CHECKS EARNED ──
 *
 * A render check cannot run here: it needs a real engine for
 * `getComputedStyle` and a real box for `getBoundingClientRect`, and jsdom
 * gives neither honestly. These three were proven in a browser against
 * fixtures, and every fixture is named below beside the guard it forced.
 *
 * So this asserts the guards STRUCTURALLY. That is weaker than running them,
 * and it is not nothing: each of these clauses exists because the check fired
 * on correct code without it, and a future edit that deletes one fails here
 * with the fixture that proved it. */
{
  line('\n- the keyboard contract -')
  const { CHECKS: KC } = await import('../src/emit/checks.js')
  const bodyOf = id => (KC.find(c => c.id === id)?.body ?? []).join('\n')

  const GUARDS = [
    ['a-marked-item-says-so', 'kids.length < 3',
      'a run of two has no majority, so nothing can be the odd one out'],
    ['a-marked-item-says-so', 'odd.length !== 1',
      'two items differing is a mixed layout, not a marked one'],
    ['a-marked-item-says-so', 'sameKind < 2',
      'a landing nav holding a filled call-to-action button, which is a different KIND of item'],
    ['a-composite-widget-is-one-tab-stop', 'aria-activedescendant',
      'a listbox keeping focus on the container, whose items are correctly not tabbable'],
    ['a-widget-owes-its-keys', 'showModal',
      'a native dialog, which answers Escape with no script'],
    ['a-widget-owes-its-keys', 'said.has(sig)',
      'a build holding both role=tablist and role=tab, which is one fault and not two'],
    ['a-column-of-figures-takes-the-mono-face', 'ABSENT',
      'a column holding a dash where a value is not set, which is an absent value rather than a non-figure'],
    ['a-column-of-figures-takes-the-mono-face', 'figures < 2',
      'a column with one real figure among placeholders, which is not a column of figures'],
    ['a-column-of-figures-takes-the-mono-face', 'mixed',
      'a column mixing figures and words, and a column of dates carrying a month name'],
    ['an-amount-lines-up-on-its-end-edge', 'MARKED',
      'a column of bare integers, which is an order number as readily as a quantity'],
    ['an-amount-lines-up-on-its-end-edge', 'MONO',
      'a column of amounts in the body face, which a different rule owns'],
    ['an-amount-lines-up-on-its-end-edge', 'vary <= 1',
      'a column whose values differ in width, where agreeing edges mean something really aligns them'],
    ['an-amount-lines-up-on-its-end-edge', 'endwise',
      'a column of equal-width amounts that declares its end alignment, and so is right for a reason'],
    /* ── A LINE BREAK IS NOT A GROUP BOUNDARY ──
     *
     * This system put `lg` between the pairs of a broken action row and `xs`
     * inside one, for 3:1, on the proximity argument. Their correction,
     * 8 September 2026, looking at the rendered row: the vertical gap equals
     * the horizontal one, because they are all part of the same group of
     * buttons. A pair here is a LINE rather than a unit anybody reads.
     *
     * Measured before: five instances across Dashboard, Record and Index, all
     * 8px across and 24px down. After: 8 and 8, on every one.
     *
     * Proven on the fixture: `ok-gap` at 8 and 8 wraps to two lines and is
     * silent, `bad-gap-axes` at 8 and 24 wraps to two lines and fires once. */
    ['a-group-of-buttons-keeps-one-gap', 'bands.length < 2',
      'a run on ONE line, whose row gap is declared and never painted'],
    ['a-group-of-buttons-keeps-one-gap', 'role=tablist',
      'a nav, whose items are destinations rather than a group of buttons, and whose gutter is a step of its own by another rule'],
    ['a-group-of-buttons-keeps-one-gap', 'kids.every(k => k.matches(CONTROL)',
      'a layout that happens to hold a control, rather than a run of buttons'],
    /* ── THE FIVE SPACING CHECKS, PROVEN IN A BROWSER ──
     *
     * Two fixtures. All twelve of this system's preview surfaces are the
     * correct-code half and every one is silent on all five.
     * `tools/fixture-spacing.mjs` is the other half: each fault beside the
     * correct form of the same shape, so a finding is read by id rather than
     * counted, and each silent twin reported what it measured.
     *
     *   ok-above   run edge 1px, last item bottom border 0     silent
     *   bad-below  the last rule 0.00px from the run own edge  fires
     *   ok-nogap   a collapsing row found, row gap 0           silent
     *   bad-gap    the same row with 8px charged above it      fires
     *   ok-feet    3 cards at 148px, feet 0/0/0, spread 0      silent
     *   bad-feet   the same three, feet 21px apart             fires
     *   ok-rule    16px above and 16 below                     silent
     *   bad-rule   4px above and 32 below                      fires
     *   ok-strip   horizontal, 1 band, overflow hidden         silent
     *   bad-wrap   the same strip on 2 rows                    fires
     *   bad-scroll and one declaring overflow-x: auto          fires
     *
     * TWO OF THE THREE BUGS THIS BATCH HAD CAME FROM POINTING IT AT CORRECT
     * CODE, and both would have read as passing checks.
     *
     * `px('none')` IS 0. `max-height` computes to `none` when nothing sets it,
     * so a collapse guard written with the helper matched every element in the
     * document: 24 findings on one surface, all of them correct code.
     *
     * AND THE HORIZONTAL TEST REJECTED THE CASE THE CHECK IS FOR. Asking every
     * item to sit right of the one before it is false of a WRAPPED strip, so
     * the fold was skipped as though it were a vertical rail. Judged from the
     * first pair instead, which is what tells a strip from a rail. */
    ['a-separator-goes-above-each-item', 'kids.length < 3',
      'a run of two, which has no rhythm to read'],
    ['a-separator-goes-above-each-item', 'rcs.borderBottomStyle',
      'a container with no edge of its own, which is the commonest and healthiest shape'],
    ['a-collapsed-row-still-costs-its-gap', 'test(kcs.maxHeight)',
      'a zero-height child that nobody told to collapse — a bar of value zero in a column chart, which reported sixteen findings on one surface when the guard used px()'],
    ['a-collapsed-row-still-costs-its-gap', 'gridTemplateRows',
      'the other mechanism that animates a height nobody can know in advance'],
    ['card-actions-sit-on-the-bottom-edge', 'hs) > 1',
      'cards of different heights, which are not stretched and so cannot be ragged'],
    ['card-actions-sit-on-the-bottom-edge', 'spread <= 2',
      'a card own border and padding landing on fractional pixels'],
    ['a-rule-sits-inside-its-gap', 'prev.tagName === next.tagName',
      'a row separator inside a run of like siblings, which is a different rule with its own answer'],
    ['a-rule-sits-inside-its-gap', 'above < 0 || below < 0',
      'a rule overlapping its neighbour, where a subtraction gives a negative number rather than a distance'],
    /* THREE FORMS OF THE HORIZONTALITY TEST, AND THE FIRST TWO EACH TRADED
       ONE MISS FOR ANOTHER. Asking EVERY item to sit right of the one before
       it is false of a wrapped strip, which is the case the check exists for.
       Asking only the FIRST pair reported a vertical rail as folded, because a
       rail leads with a section label whose box does not line up with the
       items under it. A majority of adjacent pairs sharing a band answers
       both: measured, six rail items at tops 0, 232, 282, 332, 382 and 432
       share no band, and a six-tab strip on two rows shares four of five. */
    ['a-tab-strip-never-wraps-and-never-scrolls', 'together * 2 > boxes.length',
      'a WRAPPED strip and a vertical rail at once, which the every-pair and first-pair forms each got wrong in opposite directions'],
    ['a-tab-strip-never-wraps-and-never-scrolls', 'b.top < y.bottom',
      'a vertical nav rail, whose items sit above each other on purpose — measured at 3, 5 and 6 bands on this system own surfaces'],

    /* ── THE FOUR CHART CHECKS, PROVEN IN A BROWSER ──
     *
     * Two fixtures. The app's own Charts surface is the correct-code half —
     * fourteen plots, twelve declaring 2 / 1 and two declaring auto because a
     * horizontal bar chart's height comes from its row count — and
     * `tools/fixture-charts.mjs` is the other, eight plots with each fault
     * injected on its own.
     *
     * POINTING THEM AT CORRECT CODE FOUND TWO HOLES A CLEAN REPORT WOULD HAVE
     * HIDDEN, and each is a guard below.
     *
     * THE GRIDLINE CHECK MEASURED NOTHING. It looked for child line elements,
     * and every shipped chart paints its gridlines with a repeating gradient
     * on one box. Measured: fourteen plots, an axis found on twelve, and zero
     * gridlines read. A run that measured nothing is not a pass.
     *
     * THE FOCUS QUESTION AND THE NAME QUESTION ASK DIFFERENT ELEMENTS. A
     * `tabindex` on the PLOT was invisible, because the one-element-per-chart
     * guard the name pass needs skips anything inside another chart, and a
     * plot always is. One filter cannot serve two questions.
     *
     * AND IT FOUND FIFTEEN REAL FINDINGS on its first run: fifteen charts on
     * this system's own surface carrying no name at all, while the keyboard
     * contract had said for as long as it existed that a chart owes one. */
    ['a-gridline-is-quieter-than-its-axis', 'stopsOf',
      'a gridline painted as a repeating gradient, which is how every shipped chart draws one and how the first version of the check went blind'],
    ['a-gridline-is-quieter-than-its-axis', 'same.length === 1',
      'a zero line, which carries the axis weight on purpose because it is the axis moved off the floor'],
    ['a-gridline-is-quieter-than-its-axis', 'for (const kid of plot.querySelectorAll',
      'a bar chart drawing its value axis on the grid layer inside its rows, where zero actually is'],
    ['a-plot-is-a-shape-not-a-height', 'chart-bar',
      'a horizontal bar chart, whose height comes from its row count and which declares aspect-ratio auto on purpose'],
    ['a-plot-is-a-shape-not-a-height', 'stretched',
      'a plot in a stretched track, where the height is the track s to decide and not the plot s to state'],
    ['a-grouped-chart-states-a-ratio', 'el.children.length > 1',
      'a group of one bar, which has no inner gap and so no ratio to take'],
    ['a-grouped-chart-states-a-ratio', 'groups.length < 2',
      'one group, which is not a run'],
    ['a-chart-is-named-not-focused', 'for (const part of all',
      'a tabindex on the PLOT, which the outermost-only guard the name pass needs cannot see'],
    ['a-chart-is-named-not-focused', 'progressbar',
      'a loading placeholder, which is a live region announcing a state rather than a picture of data'],
    ['a-chart-is-named-not-focused', 'chart.querySelector(CONTROL)',
      'an empty or no-results card, where role=img would make the message and its action presentational'],
    ['a-chart-is-named-not-focused', 'hasWords(row)',
      'a sparkline inside a table row, where the row already carries its name and its value in text'],

    /* ── THE ROW-PLANE CHECK, PROVEN IN A BROWSER ──
     *
     * Six tables in one fixture, and the numbers are recorded so a future
     * edit that widens the check has something to fail against:
     *
     *   own-fill zebra      stripe 1.04, selection 1.15   silent
     *   cell-painted        stripe 1.04, selection 1.15   silent
     *   ruled, no stripe    no stripe found               silent
     *   stripe 2 steps out  stripe 1.94, selection 3.50   boundary + two-step
     *   order inverted      stripe 1.15, selection 1.04   order
     *   selection = accent  stripe 1.04, selection 6.75   two-step
     *
     * The first three were MEASURED, not skipped: the detection reported the
     * stripe it found and the step it read on each. A run that measured
     * nothing is not a pass, and it reads exactly like one. */
    ['a-stripe-is-rhythm-and-a-selection-is-a-choice', 'fillOf',
      'a table row that paints through its CELLS, which is how this system draws a selection and how the first version of the check went blind'],
    ['a-stripe-is-rhythm-and-a-selection-is-a-choice', 'input:checked',
      'a row declaring its choice with a checked box rather than aria-selected, which is what the Index preview ships'],
    ['a-stripe-is-rhythm-and-a-selection-is-a-choice', 'others.length !== 1',
      'a list of cards, where every row paints and there is no stripe to measure'],
    ['a-stripe-is-rhythm-and-a-selection-is-a-choice', 'i % 2 === at[0] % 2',
      'two fills in no pattern, which is a list with two kinds of row in it rather than a stripe'],
    ['a-stripe-is-rhythm-and-a-selection-is-a-choice', 'at.length * 3 < kids.length',
      'a minority fill, so two selected rows are never mistaken for the stripe'],
    ['a-stripe-is-rhythm-and-a-selection-is-a-choice', 'own === ground || own === stripe',
      'a row marked by its edge alone, which is a treatment this system offers and paints no fill of its own'],
  ]
  for (const [id, clause, why] of GUARDS) {
    assert(bodyOf(id).includes(clause),
      `${id} keeps its guard for ${why}`)
  }

  /* Every component in the system has a stated contract, and a stated `none`
     is an answer. An absent entry reads as an oversight. */
  const { KEYBOARD_CONTRACTS } = await import('../src/state/keyboard.js')
  const declared = new Set(KEYBOARD_CONTRACTS.map(c => c.component))
  /* `derived.components` is the EXPANDED list: every variant and every state,
     named `<component>-<variant>`. A contract belongs to the component, not to
     its variants, so each entry is matched back to the longest declared name
     it starts with. That is the stronger assertion: it fails both a component
     with no contract AND a contract for a component nobody ships. */
  const base = n => [...declared].filter(d => n === d || n.startsWith(d + '-'))
    .sort((a, b) => b.length - a.length)[0]
  const orphans = [...new Set((derived.components ?? []).map(c => c.name)
    .filter(n => n && !base(n)))]
  assert(orphans.length === 0,
    `every component states a keyboard contract${orphans.length ? ` — ${orphans.join(', ')}` : ` (${declared.size})`}`)
  const shipped = new Set((derived.components ?? []).map(c => base(c.name)).filter(Boolean))
  const unused = [...declared].filter(d => !shipped.has(d))
  assert(unused.length === 0,
    `every contract belongs to a component this system ships${unused.length ? ` — ${unused.join(', ')}` : ''}`)

  /* And the contract reaches the reader. */
  const md = payloadTextFiles(state, derived)['DESIGN.md']
  assert(/\*\*Keyboard\*\*/.test(md), 'DESIGN.md carries the Keyboard section')
  for (const c of KEYBOARD_CONTRACTS.filter(x => x.keys.length)) {
    assert(md.includes('`' + c.component + '`'),
      `DESIGN.md names the ${c.component} contract`)
  }
  /* Space is not Enter, and that distinction is the whole point of the table.
     A checkbox row naming Enter would be wrong and would read as authority. */
  const cb = KEYBOARD_CONTRACTS.find(c => c.component === 'checkbox')
  assert(cb.keys.every(k => k.key !== 'Enter'),
    'the checkbox contract does not claim Enter, which submits the form around it')
}

/* ── EVERY STACKING LAYER COMES FROM THE SCALE ──
 *
 * Before this ran, our own tree carried 31 z-index declarations at 16 distinct
 * values, including 71, 801, 1100 and 2001. None of those is a decision. Each
 * is what somebody types when they need to sit above whatever was already
 * there, and typing one is how a dialog ends up under its own scrim.
 *
 * LOCAL STACKING IS NOT A LAYER, and the value separates them. `z-index: 1`
 * inside a positioned box orders two siblings and never joins the global
 * order. So the rule is exact: 0 and 1 are local, everything else is a layer
 * and a layer comes from a token. Asking the selector instead would need a
 * name list, which approves whatever nobody thought of. */
{
  line('\n- every stacking layer comes from the scale -')
  const root = new URL('../src/', import.meta.url)
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = new URL(e.name + (e.isDirectory() ? '/' : ''), dir)
    return e.isDirectory() ? walk(p) : (/\.(jsx?|css)$/.test(e.name) ? [p] : [])
  })
  /* Blank a comment, never delete it. Deleting takes its newlines too, and
     every line number below shifts. */
  const blank = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))
  const typed = []
  for (const f of walk(root)) {
    /* derive.js is the home of the scale, so the numbers belong there. */
    if (f.href.endsWith('state/derive.js')) continue
    const code = blank(fs.readFileSync(f, 'utf8'))
    code.split('\n').forEach((lineText, i) => {
      const m = /(?:z-index|zIndex)\s*:\s*(-?\d+)/.exec(lineText)
      if (!m || Math.abs(Number(m[1])) <= 1) return
      typed.push(`${f.href.split('/src/')[1]}:${i + 1} = ${m[1]}`)
    })
  }
  assert(typed.length === 0,
    `no hand-typed stacking value${typed.length ? ` — ${typed.slice(0, 4).join(', ')}${typed.length > 4 ? ` +${typed.length - 4} more` : ''}` : ' (31 migrated)'}`)

  /* Prove the check can fire, on the exact shape it exists for. A guard
     proven on nothing is a guard nobody can trust. */
  const inject = 'const s = { position: "fixed", zIndex: 2001 }'
  assert(/(?:z-index|zIndex)\s*:\s*(-?\d+)/.test(inject)
    && Number(/(?:z-index|zIndex)\s*:\s*(-?\d+)/.exec(inject)[1]) > 1,
    'the scan fires on an injected 2001')
  assert(!(Math.abs(Number(/(?:z-index|zIndex)\s*:\s*(-?\d+)/.exec('.x{z-index:1}')[1])) > 1),
    'and stays quiet on a local z-index: 1')
}

/* ── THE STACKING ORDER REACHES THE PAYLOAD, ONCE ──
 *
 * It reached tokens.css and stopped once before, so a build importing the DTCG
 * file saw no layers and would have invented its own. And when it did reach
 * CSS it arrived five times, once per theme block, which states that the
 * stacking order changes with the theme. */
{
  line('\n- the stacking order reaches the payload, once -')
  const css = payloadTextFiles(state, derived)['tokens.css']
  const names = Object.keys(Z_LAYERS)
  for (const n of names) {
    const hits = (css.match(new RegExp(`--z-${n}\\s*:`, 'g')) || []).length
    assert(hits === 1, `--z-${n} is declared exactly once in tokens.css (${hits})`)
  }
  const json = JSON.parse(payloadTextFiles(state, derived)['tokens.json'])
  assert(Object.keys(json.number ?? {}).length === names.length,
    `all ${names.length} layers reach tokens.json (${Object.keys(json.number ?? {}).length})`)

  /* A theme block says what the THEME decides. Nothing else may be in it. */
  const darkBlock = (() => {
    const i = css.search(/:root\[data-theme="dark"\]\s*\{/)
    const j = css.indexOf('{', i)
    let depth = 0
    for (let k = j; k < css.length; k++) {
      if (css[k] === '{') depth++
      else if (css[k] === '}' && --depth === 0) return css.slice(j, k)
    }
    return ''
  })()
  const strays = [...darkBlock.matchAll(/(--(?:z|space|radius|font|border|width|duration|ease)-[a-z0-9-]+)\s*:/g)]
    .map(m => m[1])
  assert(strays.length === 0,
    `the dark block carries only what the theme decides${strays.length ? ` — ${strays.slice(0, 4).join(', ')}` : ''}`)
}

/* ── A MIX NEVER INVENTS A HUE NEITHER PARENT HAS ──
 *
 * `mixHex` averaged the two hue ANGLES, which treats a near-grey's hue as if
 * it carried information. At chroma 0.0056 that number is noise.
 *
 * Measured on the shipped role table: neutral.800 at hue 107, mixed 30% into
 * accent.500 at hue 182, produced hue 129. That is a green neither parent has,
 * and it painted `accent-raised` on every dark surface. Nothing reported it,
 * because every check asked about lightness and none asked about hue.
 *
 * A CHROMA FLOOR WAS SEARCHED FOR FIRST and there is no such number. Across 24
 * accent hues and three ground tints, no cutoff cleared the drift: the fault is
 * polar interpolation itself. The hue is weighted by chroma now, so a grey
 * contributes nothing and no threshold appears anywhere.
 *
 * The alternative was mixing in OKLab, which also cannot invent a hue and costs
 * more than half the chroma on a colour-to-colour mix. Both numbers are pinned
 * below, so a future edit that reaches for OKLab fails here rather than
 * quietly desaturating every mixed role. */
{
  line('\n- a mix never invents a hue -')
  const { buildRamp, resolveRef } = await import('../src/color/ramp.js')
  const { converter } = await import('culori')
  const ok = converter('oklch')
  const hueOf = hex => ok(hex).h ?? 0
  const chromaOf = hex => ok(hex).c
  const apart = (a, b) => { const x = Math.abs(a - b) % 360; return x > 180 ? 360 - x : x }

  const SHAPE = { lightMax: 0.97, lightMin: 0.05, curve: 0, chromaPeak: 0.55, chromaScale: 1, hueShift: 0, anchorSeed: true }
  /* The warm neutral and teal accent that produced the olive. */
  const ramps = {
    neutral: buildRamp('#8d8c86', SHAPE, {}),
    accent: buildRamp('#15b8a6', SHAPE, {}),
  }
  const accentHue = hueOf(ramps.accent.steps[500])

  /* A GREY CONTRIBUTES NO HUE. The light end is the clearest case: neutral.50
     is nearly white, so the answer must be the accent's own hue. */
  const light = resolveRef('neutral.50~accent.500@0.3', ramps)
  assert(apart(hueOf(light), accentHue) < 1,
    `a near-white mixed into the accent keeps the accent's hue (${hueOf(light).toFixed(0)} against ${accentHue.toFixed(0)})`)

  /* THE ORIGINAL FAULT. 129 was the invented hue; anything within 15 of the
     accent is the accent's family. */
  const raised = resolveRef('neutral.800~accent.500@0.3', ramps)
  assert(apart(hueOf(raised), accentHue) < 15,
    `accent-raised stays in the accent's family (${hueOf(raised).toFixed(0)} against ${accentHue.toFixed(0)})`)
  assert(apart(hueOf(raised), 129) > 30,
    'and nowhere near the olive it used to be')

  /* A SAME-RAMP MIX IS UNTOUCHED, because both parents share one hue. */
  for (const ref of ['neutral.500~600@0.15', 'neutral.900~800@0.4']) {
    const hex = resolveRef(ref, ramps)
    assert(apart(hueOf(hex), hueOf(ramps.neutral.steps[500])) < 12,
      `${ref} keeps the neutral ramp's own hue`)
  }

  /* CHROMA SURVIVES A COLOUR-TO-COLOUR MIX, which is what rules OKLab out.
     Measured: polar 0.117, weighted 0.111, OKLab 0.053. */
  const other = buildRamp('#b85a15', SHAPE, {})
  const pair = { accent: ramps.accent, other }
  const blend = resolveRef('accent.500~other.500@0.5', pair)
  assert(chromaOf(blend) > 0.09,
    `a colour-to-colour mix keeps its chroma (${chromaOf(blend).toFixed(3)}, OKLab would give about 0.053)`)

  /* A PAIR EITHER SIDE OF ZERO DEGREES still meets the short way round. The
     old code had an explicit correction for this and the circular mean now
     does it by construction, so the case has to stay proven. */
  const red = buildRamp('#c13e2e', SHAPE, {})
  const magenta = buildRamp('#b8158a', SHAPE, {})
  const wrap = resolveRef('red.500~magenta.500@0.5', { red, magenta })
  const hr = hueOf(red.steps[500]), hm = hueOf(magenta.steps[500])
  const mid = apart(hueOf(wrap), hr) + apart(hueOf(wrap), hm)
  assert(mid < apart(hr, hm) + 2,
    `a wrapping pair meets between them, not opposite (${hueOf(wrap).toFixed(0)} between ${hr.toFixed(0)} and ${hm.toFixed(0)})`)
}

/* ── THE GENERATOR NEVER EMITS TWO MEANINGS AS ONE COLOUR ──
 *
 * The audit reports a colliding pair, and a warning arrives after the palette
 * is on screen. Nothing stopped it being produced: status seeds are placed in
 * their own hue bands, the accent anywhere, and no step compared the two.
 *
 * A TEST WITH NOTHING IN IT PRINTS THE SAME WORD AS A TEST WITH EVERYTHING, so
 * the input is perturbed until the check can fire: every harmony, every
 * intensity, and a pinned brand walked round the whole hue circle. */
{
  line('\n- two meanings are never one colour -')
  const { generatePalette, HARMONIES, INTENSITIES } = await import('../src/color/palette.js')
  const { audit } = await import('../src/a11y/audit.js')

  /* ── A RANDOM SAMPLE GIVES A RANDOM VERDICT ──
   *
   * `generatePalette` shuffles its lightness rungs and jitters its hues with
   * `Math.random`, so this block drew a fresh 252 palettes on every run and
   * scored whichever ones it got. Measured over six consecutive runs on
   * unchanged code: 8, 5, 2, 2, 1, 0 findings against a bar of 7. So it failed
   * about one run in six on code nobody had touched, and a check that fires on
   * correct code is a defect in the check.
   *
   * THE FIX IS NOT A HIGHER BAR. Raising it to fit the worst run seen is
   * tuning the check to the code, and it throws away the discrimination that
   * makes the number mean anything: the generator this replaced produced 27 of
   * 90, which is 10.7%, and the bar has to sit below that.
   *
   * So the SAMPLE is pinned instead. `Math.random` is replaced by a seeded
   * PRNG for the duration of the block, which makes the count a fact about the
   * generator rather than a coin toss. A regression that raises the collision
   * rate still fails; an unchanged codebase now prints the same number every
   * time. Restored in a `finally`, or every block below inherits the stub. */
  const realRandom = Math.random
  let seed = 0x9e3779b9
  Math.random = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  try {

  /* ── COUNT WHAT A READER SEES, WHICH IS THE ROLE, NOT THE SEED ──
   *
   * This block used to compare the SEEDS with the audit's own hue-and-lightness
   * rule, and that made it certify a repair nobody can see. `accent` and
   * `danger` are both step 500 in the default role map, so two seeds twenty
   * lightness points apart arrive on screen at an IDENTICAL lightness. The old
   * generator cleared every seed-level pair, printed 0 of 90, and shipped 25 of
   * those 90 as visible collisions.
   *
   * So the count comes from the audit, over the derived document. It is the
   * same question the person looking at the screen is asking. */
  const base = migrate(null).state
  const withSeeds = (seeds, out) => ({
    ...base,
    color: { ...base.color, seeds: seeds.map(s => ({ ...s, hex: out[s.id] ?? s.hex })) },
  })
  const count = (seeds, out) => {
    const next = withSeeds(seeds, out)
    return audit(next, derive(next)).filter(r => r.level === 'warn' && /^meaning:/.test(r.id ?? '')).length
  }
  const SEEDS = () => base.color.seeds.map(s => ({ ...s, locked: false }))

  let runs = 0, bad = 0
  for (const h of HARMONIES) for (const i of INTENSITIES) for (let n = 0; n < 12; n++) {
    const seeds = SEEDS()
    bad += count(seeds, generatePalette(seeds, h.id, i.id)); runs++
  }
  assert(runs >= 100, `the sample is big enough to fire (${runs} palettes)`)
  /* A PINNED SAMPLE THAT ALWAYS SAYS THE SAME THING PROVES NOTHING UNTIL THE
     INSTRUMENT IS SHOWN TO FIRE ON IT.

     AND THE INJECTION HAS TO SHARE A RAMP STEP, which is the rule this block
     enforces working against my first attempt at breaking it. Accent and
     danger on one hex is NOT a collision: they sit at different steps, so they
     arrive at L 0.432 and L 0.276 and the lightness separates them. Accent and
     success share a step, so one hue for the two is the real fault. */
  const collide = SEEDS().map(s => (['accent', 'success'].includes(s.name)
    ? { ...s, hex: '#0d7a70' } : s))
  assert(count(collide, {}) > 0,
    'the counter fires when two meanings on one ramp step are put on one hue')
  /* NOT ZERO, AND SAYING SO IS THE POINT. A status seed that lands on its own
     role's step BECOMES that role, so a pair the hue pass separated can
     converge again through the anchor. Measured on the pinned sample: 2 of
     252, against 27 of 90 for the generator that scored seeds. The bar sits
     where those two cannot be confused, which is well above 0.79% and well
     below 10.7%. */
  assert(bad <= runs * 0.03, `a generated palette rarely reads as one colour twice (${bad} of ${runs}, bar ${Math.floor(runs * 0.03)})`)

  /* A PINNED BRAND IS THE CASE THEY HIT, and it has no hue to give: a green
     brand inside the success band is within 25° of every legal success hue.
     Nothing can clear those, because the brand is a decision and the status
     hue is a meaning. The old lightness lever appeared to clear them and did
     not. Measured at role level: 25 of 90 before, 22 to 24 after. */
  let lockRuns = 0, lockBad = 0, wroteALock = 0
  for (let n = 0; n < 90; n++) {
    const seeds = SEEDS().map(s => (s.name === 'accent'
      ? { ...s, hex: `hsl(${(n * 360) / 90} 55% 30%)`, locked: true } : s))
    const out = generatePalette(seeds, 'analogous', 'balanced')
    if (out[seeds.find(s => s.name === 'accent').id]) wroteALock++
    if (count(seeds, out)) lockBad++
    lockRuns++
  }
  assert(lockRuns >= 50, `the pinned sample is big enough to fire (${lockRuns})`)
  assert(lockBad <= 25, `a pinned brand leaves no more collisions than the seed-scoring generator did (${lockBad} of ${lockRuns}, bar 25)`)
  /* A LOCK IS A DECISION. Moving a colour somebody pinned is worse than the
     collision it would clear. */
  assert(wroteALock === 0, `the generator never writes a locked seed (${wroteALock})`)
  } finally { Math.random = realRandom }
  /* AND THE STUB IS GONE. A block below that inherited it would measure a
     sample this one chose, and say nothing about it. */
  assert(Math.random === realRandom, 'the seeded PRNG is put back')

  /* ── THE ROLE STEP HOLDS A FREE ACCENT, AND THE RULE CLAIMED OTHERWISE ──
   *
   * The rule said half the wheel collides with danger on the axis that
   * survives red-green loss, and named the role step as a partial mitigation.
   * A sentence that says a thing collides and then says what separates it is
   * asking to be measured.
   *
   * Walked: 72 accent hues, 5 degrees apart, against the audit's own 0.09
   * floor. Not one falls under it. The worst pair is 0.131 at hue 25, which is
   * 1.5 times the floor, and the lightness gap is 0.155 at every hue. The step
   * is the whole answer.
   *
   * Pinned here because a flatter role ladder breaks it in silence: the hue
   * pass would still pass, and only this figure would move.
   */
  {
    const { filterDeficiencyDeuter, filterDeficiencyProt, differenceEuclidean } = await import('culori')
    const { toOklchObj, hexFrom, parseColor } = await import('../src/color/convert.js')
    const deuter = filterDeficiencyDeuter(1), prot = filterDeficiencyProt(1)
    const dist = differenceEuclidean('oklab')
    const seed0 = createInitialState().color.seeds.find(s => s.name === 'accent')
    const ok = toOklchObj(parseColor(seed0.hex))
    const rows = []
    for (let h = 0; h < 360; h += 5) {
      const s = createInitialState()
      s.color.seeds.find(x => x.name === 'accent').hex = hexFrom({ ...ok, h, mode: 'oklch' })
      const c = derive(s).roles.light
      const A = parseColor(c.accent), D = parseColor(c.danger)
      rows.push({ h,
        worst: Math.min(dist(deuter(A), deuter(D)), dist(prot(A), prot(D))),
        dl: Math.abs(toOklchObj(A).l - toOklchObj(D).l) })
    }
    assert(rows.length === 72, `the accent circle is walked at 5 degrees (${rows.length} hues)`)
    const under = rows.filter(r => r.worst < 0.09)
    assert(under.length === 0,
      `no free accent hue collides with danger under red-green loss (${under.length} of ${rows.length} under the 0.09 floor)`)
    const min = rows.reduce((a, r) => (r.worst < a.worst ? r : a))
    assert(min.worst > 0.12,
      `the closest the pair ever comes is well clear of the floor (${min.worst.toFixed(3)} at hue ${min.h})`)
    /* THE STEP IS WHAT DOES IT, so pin the step and not only the outcome. A
       ladder flattened to half this gap would put the worst pair under the
       floor while every hue rule still passed. */
    const meanDl = rows.reduce((s, r) => s + r.dl, 0) / rows.length
    assert(meanDl > 0.13,
      `and the role step is what holds it, at every hue (mean lightness gap ${meanDl.toFixed(3)})`)
  }
}

/* ── A PALETTE IS A SET OF RELATIONSHIPS, AND NOTHING MEASURED THEM ──
 *
 * The palette module implements every rule below and records the numbers it
 * was built against in its own comments. No assertion read any of them, so the
 * generator could drift back to the shape a person already rejected and every
 * test would still pass. That is the most expensive kind of gap: a bad palette
 * clears every contrast check and still hurts to look at.
 *
 * Each threshold is a measured number rather than a preference. The references
 * are palettes the person who reads the output chose as agreeable.
 */
{
  line('\n- a palette is a set of relationships -')
  const { generatePalette } = await import('../src/color/palette.js')

  const oklch = hex => toOklchObj(parseColorFor(hex))
  /* Round the circle, so 350 and 10 are 20 apart rather than 340. */
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }
  const CHROMATIC = 0.02   /* below this a swatch reads as grey and joins no relationship */

  const shapes = []
  for (const harmony of ['analogous', 'complementary', 'triad', 'split']) {
    for (const intensity of ['muted', 'balanced', 'vivid']) {
      for (const h of [12, 47, 88, 133, 170, 205, 240, 275, 310, 345]) {
        /* THE REAL SEED SET, with only the accent's hue varied. A lone seed is
           not what the generator is ever handed, and `generatePalette` returns
           a map keyed by seed id rather than a list, so both matter. */
        const seeds = createInitialState().color.seeds.map(sd =>
          sd.name === 'accent' ? { ...sd, hex: hueHex(h), locked: false } : { ...sd, locked: false })
        let out = null
        try { out = generatePalette(seeds, harmony, intensity, 1) } catch { continue }
        const set = Object.values(out || {}).filter(v => typeof v === 'string' && /^#/.test(v))
          .map(oklch).filter(c => c && c.c > CHROMATIC)
        if (set.length < 3) continue
        const hues = set.map(c => c.h ?? 0)
        const gaps = []
        for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++)
          gaps.push(hueGap(hues[i], hues[j]))
        gaps.sort((a, b) => a - b)
        const chromas = set.map(c => c.c)
        shapes.push({
          closest: gaps[0],
          span: gaps[gaps.length - 1],
          quietRatio: Math.min(...chromas) / Math.max(...chromas),
          loudest: Math.max(...chromas),
        })
      }
    }
  }

  /* A TEST WITH NOTHING IN IT PRINTS THE SAME WORD AS A TEST WITH EVERYTHING. */
  assert(shapes.length >= 60, `the sample is big enough to fire (${shapes.length} palettes)`)

  /* ── A CLOSE PAIR ──
   * Measured across 196 palettes from a generator whose output a person
   * admires: 71% hold two hues within 20 degrees, and the gap profile runs
   * 10, 29, 68, 114. A separation optimiser produced a close pair in 0% of
   * runs, never, and that is what reads as a box of pencils. */
  const closeShare = shapes.filter(s => s.closest <= 20).length / shapes.length
  assert(closeShare >= 0.5,
    `most palettes hold a close pair (${(closeShare * 100).toFixed(0)}% within 20 degrees, bar 50)`)

  /* ── A QUIET MEMBER ──
   * Theirs run 0.03 to 0.17 of chroma inside one palette. Ours ran 0.13 to
   * 0.21, which is a set with nowhere to rest. Measured WITHIN each palette
   * and then averaged, the quietest sits at 0.18 of the loudest. Averaging
   * across samples first gives 0.71, a shape none of them has. */
  const meanQuiet = shapes.reduce((a, s) => a + s.quietRatio, 0) / shapes.length
  assert(meanQuiet <= 0.6,
    `every palette has somewhere to rest (quietest is ${meanQuiet.toFixed(2)} of the loudest, bar 0.60)`)

  /* ── A SPAN, NOT THE CIRCLE ──
   * Theirs span 190 degrees. Ours spanned 274, which closes the circle and
   * reads as a box of pencils rather than a family. */
  const meanSpan = shapes.reduce((a, s) => a + s.span, 0) / shapes.length
  assert(meanSpan <= 230,
    `the set leaves a gap in the circle (mean span ${meanSpan.toFixed(0)} degrees, bar 230)`)

  /* ── CHROMA IS A CHOICE, AND THE DEFAULT HAS A MEASURED REFERENCE ──
   *
   * Taking the most sRGB holds makes every swatch as loud as the display
   * allows: their most saturated swatch was our average, 0.101 against 0.165.
   *
   * "AT THE GAMUT EDGE" WAS THE FIRST TEST AND IT WOULD HAVE FIRED ON CORRECT
   * CODE. The generator clamps to the gamut on purpose, which the rule itself
   * prescribes, so a clamped swatch sits AT its ceiling by definition.
   * Measured: 182 of 560 swatches at 95% or more of their own ceiling, and the
   * clamp is why. A target and a clamp are indistinguishable in the output, so
   * that question cannot be asked of the artefact.
   *
   * The MEAN at the default setting can. 0.101 is the number recorded when the
   * level control was calibrated, so it is a reference rather than a bar
   * somebody picked. The margin is generous because a curve moved the same
   * setting to 0.087 once, and this has to catch a drift rather than a nudge. */
  const dflt = createInitialState()
  const ref = Object.values(generatePalette(dflt.color.seeds.map(s => ({ ...s, locked: false })), 'analogous', 'balanced', 1) || {})
    .filter(v => typeof v === 'string' && /^#/.test(v)).map(oklch).filter(c => c && c.c > CHROMATIC)
  const meanChroma = ref.reduce((a, c) => a + c.c, 0) / ref.length
  assert(ref.length >= 3, `the default palette has chromatic members to measure (${ref.length})`)
  assert(meanChroma <= 0.14,
    `the default is not louder than its own reference (mean chroma ${meanChroma.toFixed(3)} against a recorded 0.101, bar 0.14)`)

  /* ── BREAK EVERY BAR ON PURPOSE, FROM THE RECORD ──
   *
   * A threshold nobody has seen fail is a threshold nobody knows the position
   * of. Each of these four faults was measured when it shipped, so the
   * historical number is the injection: it has to land on the failing side of
   * its own bar. A later edit that loosens a bar past its own incident then
   * fails here rather than going quiet.
   *
   * The four, as recorded: a separation optimiser held a close pair in 0% of
   * runs; our chroma ran 0.13 to 0.21 inside one palette, a ratio of 0.62;
   * our hue span was 274 degrees against their 190; our mean chroma was 0.165
   * against their 0.101. */
  const wouldFail = [
    ['a close pair in 0% of runs', 0.00 < 0.5],
    ['a quietest member at 0.62 of the loudest', 0.62 > 0.60],
    ['a span of 274 degrees', 274 > 230],
    ['a mean chroma of 0.165', 0.165 > 0.14],
  ]
  const caught = wouldFail.filter(([, fails]) => fails)
  assert(caught.length === wouldFail.length,
    `every bar rejects the fault it was set against (${caught.length} of ${wouldFail.length}: `
    + wouldFail.filter(([, f]) => !f).map(([w]) => w).join(', ') + ')')
}

/* ── THE THREE COLOUR RULES NOTHING WAS ENFORCING ──
 *
 * Each names a number the code holds, and no test read any of them. So the
 * code was free to drift back to a shape a person had rejected. The chart rule
 * did exactly that in the other direction: core-rules.md prescribed the golden
 * angle for a day after the generator measured it and threw it out.
 */
{
  line('\n- the colour rules that had no check -')
  const { strongZone, STRONG_SHARE, ROLE_HUE_BAND, generatePalette } =
    await import('../src/color/palette.js')
  const { COOL_HUE, GROUND_TINTS } = await import('../src/color/ground.js')
  const {
    CATEGORICAL_COUNT, LIGHT_CURVE, HUE_SPAN, NARROW_BAND, NARROW_COST, CHROMA_TARGET,
  } = await import('../src/color/dataviz.js')

  /* ── 1. THE COOL HUE CLEARS EVERY MEANING BAND ──
   *
   * A ground tinted with the cool hue must not read as a status. The rule
   * states the margin to success as 28 degrees against a floor of 25, and says
   * that moving either one needs this checked again. Nothing checked it.
   */
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }
  const BAND_FLOOR = 25
  const margins = []
  for (const [role, [lo, hi]] of Object.entries(ROLE_HUE_BAND)) {
    /* Zero inside the band, so a hue that lands in one cannot pass. */
    const inside = COOL_HUE >= lo && COOL_HUE <= hi
    margins.push({ role, gap: inside ? 0 : Math.min(hueGap(COOL_HUE, lo), hueGap(COOL_HUE, hi)) })
  }
  const tightest = margins.reduce((a, b) => (b.gap < a.gap ? b : a))
  assert(tightest.gap >= BAND_FLOOR,
    `the cool hue clears every meaning band (${COOL_HUE} degrees, nearest is ${tightest.role} at ${tightest.gap.toFixed(0)}, floor ${BAND_FLOOR})`)
  /* AND A TINT READS IT. A cleared constant nothing consumes is not a
     safeguard, which is the failure this whole block exists to close. */
  assert(!!GROUND_TINTS['cool-low'] && !!GROUND_TINTS['cool-vivid'],
    'the two cool tints exist to carry that hue')

  /* ── 2. A PINNED HUE ASKS INSIDE ITS OWN STRONG ZONE ──
   *
   * A yellow sent to a mid-dark rung comes out brown, and no chroma fixes it.
   * So a status role takes the nearest lightness in its hue's strong zone,
   * where the hue holds 80% of its own peak capacity.
   *
   * Measured over 120 palettes: 360 of 360 status roles inside their zone, and
   * the accent 45 of 120. The accent is FREE on purpose, so both halves are
   * asserted. Otherwise a later edit that clamps everything reads as a gain.
   */
  assert(STRONG_SHARE === 0.8, `the strong zone is 80% of a hue's peak (${STRONG_SHARE})`)
  for (const [role, h, lo, hi] of [['warning', 77, 0.65, 0.84], ['success', 209, 0.68, 0.87], ['danger', 29, 0.50, 0.68]]) {
    const z = strongZone(h)
    assert(Math.abs(z.lo - lo) <= 0.02 && Math.abs(z.hi - hi) <= 0.02,
      `${role} at hue ${h} keeps its published zone (${z.lo.toFixed(2)}-${z.hi.toFixed(2)} against ${lo}-${hi})`)
  }

  const realRandom = Math.random
  let prng = 12345
  Math.random = () => { prng = (prng * 1103515245 + 12345) & 0x7fffffff; return prng / 0x7fffffff }
  let statusIn = 0, statusAll = 0, accentIn = 0, accentAll = 0
  try {
    for (const harmony of ['analogous', 'complementary', 'triad', 'split']) {
      for (const intensity of ['muted', 'balanced', 'vivid']) {
        for (let r = 0; r < 10; r++) {
          const seeds = createInitialState().color.seeds.map(sd => ({ ...sd, locked: false }))
          let out = null
          try { out = generatePalette(seeds, harmony, intensity, 1) } catch { continue }
          for (const sd of seeds) {
            const hex = out?.[sd.id]
            if (!hex || !/^#/.test(hex)) continue
            const o = toOklchObj(parseColorFor(hex))
            if (!o || o.c < 0.02) continue
            const z = strongZone(o.h ?? 0)
            const inZone = o.l >= z.lo - 0.02 && o.l <= z.hi + 0.02
            if (['success', 'warning', 'danger'].includes(sd.name)) { statusAll++; if (inZone) statusIn++ }
            else if (sd.name === 'accent') { accentAll++; if (inZone) accentIn++ }
          }
        }
      }
    }
  } finally { Math.random = realRandom }
  assert(statusAll >= 60, `the sample is big enough to fire (${statusAll} status roles)`)
  assert(statusIn === statusAll,
    `every pinned hue lands in its own strong zone (${statusIn} of ${statusAll})`)
  /* THE ASYMMETRY IS THE DECISION, and it was measured both ways over 200
     palettes. Clamped, the free hue costs 0.06 failures per run and 8% quiet
     members. Free, 0.01 and 18%. So an accent always in zone means a clamp. */
  assert(accentAll >= 20 && accentIn < accentAll,
    `the free hue is not clamped (${accentIn} of ${accentAll} land in zone by chance)`)

  /* ── 3. THE CHART SCALE SWEEPS, AND ITS SHAPE IS A CONSTANT ──
   *
   * The assertions above this block cover the rendered palette. These cover
   * the SHAPE. A reader of the rule can only be wrong about a number when
   * nothing compares the rule to the code.
   */
  assert(CATEGORICAL_COUNT === 5,
    `five series, because nothing clears the floor at eight (${CATEGORICAL_COUNT})`)
  assert(Math.abs(HUE_SPAN) <= 230,
    `the hues spread inside a span rather than round the circle (${Math.abs(HUE_SPAN)} degrees, bar 230)`)
  assert(NARROW_COST < 1 && NARROW_BAND[0] < NARROW_BAND[1],
    `the walk hurries through yellow-green (a degree in ${NARROW_BAND.join('-')} costs ${NARROW_COST})`)
  assert(CHROMA_TARGET > 0 && CHROMA_TARGET <= 0.2,
    `the chroma is an absolute target rather than the gamut edge (${CHROMA_TARGET})`)
  /* ONE TURNING POINT IN THE CURVE ITSELF, not only in the rendered set. A
     cycle is a second metronome laid over the hue walk. */
  const turns = LIGHT_CURVE.reduce((n, v, i) =>
    i === 0 || i === LIGHT_CURVE.length - 1 ? n
      : n + ((v - LIGHT_CURVE[i - 1] > 0) !== (LIGHT_CURVE[i + 1] - v > 0) ? 1 : 0), 0)
  assert(LIGHT_CURVE.length === CATEGORICAL_COUNT && turns === 1,
    `the lightness curve arcs once (${turns} turning point, ${LIGHT_CURVE.join(' ')})`)

  /* ── BREAK EACH BAR ON THE FAULT IT WAS SET AGAINST ──
   *
   * Each of these is a shape the code held, or a mechanism it tried and
   * rejected. An edit that reinstates one fails here rather than going quiet.
   */
  const wouldFail = [
    ['the golden angle covers the whole circle', 360 > 230],
    ['a lightness cycle of 38 68 52 78 has three turning points', 3 !== 1],
    ['eight series measured 0.052 against a 0.10 floor', 0.052 < 0.10],
    ['a cool hue at 205 degrees sits inside the success band', 205 >= 196 && 205 <= 222],
  ]
  const caught = wouldFail.filter(([, fails]) => fails)
  assert(caught.length === wouldFail.length,
    `every bar rejects the shape it was set against (${caught.length} of ${wouldFail.length}: `
    + wouldFail.filter(([, f]) => !f).map(([w]) => w).join(', ') + ')')
}

/* ── TWO MORE COLOUR RULES WITH NO CHECK ──
 *
 * Both are SETTINGS. A setting nothing asserts is a control that can quietly
 * stop reaching the output, which is the failure `voice.casing` shipped with:
 * a stored value the document never obeyed.
 */
{
  line('\n- the two colour settings nothing asserted -')
  const { CHROMA_LEVEL, generatePalette } = await import('../src/color/palette.js')
  const { GROUND_TINTS, DEFAULT_GROUND_TINT, groundSeedHex, groundTintOf, tintsCollide, GROUND_L } =
    await import('../src/color/ground.js')

  /* ── HOW LOUD IS A DECISION, SO GIVE IT A CONTROL ──
   *
   * Three named intensities are a palette's SHAPE and none of them is its
   * volume. The level multiplies whichever shape was picked.
   *
   * THE DEFAULT SITS ON THE MEASURED REFERENCE, and the OLD behaviour sits
   * inside the range rather than at its end, so nobody has to leave the scale
   * to get back to it. Measured when it was calibrated: 0.60 gives 0.095, 1.00
   * gives 0.121, 1.60 gives 0.155, and the old behaviour is 1.25.
   */
  assert(CHROMA_LEVEL.default === 1,
    `the chroma level defaults to the measured reference (${CHROMA_LEVEL.default})`)
  assert(CHROMA_LEVEL.max > 1.25 && CHROMA_LEVEL.min < 1,
    `the old behaviour at 1.25 sits inside the range, not at its end (${CHROMA_LEVEL.min} to ${CHROMA_LEVEL.max})`)

  /* AND THE CONTROL HAS TO REACH THE OUTPUT. A stored value the generator
     ignores is decoration. Same seeds, same shape, three levels. */
  const oklch = hex => toOklchObj(parseColorFor(hex))
  const meanChromaAt = level => {
    const realRandom = Math.random
    let prng = 4242
    Math.random = () => { prng = (prng * 1103515245 + 12345) & 0x7fffffff; return prng / 0x7fffffff }
    try {
      const seeds = createInitialState().color.seeds.map(sd => ({ ...sd, locked: false }))
      const out = generatePalette(seeds, 'analogous', 'balanced', level)
      const set = Object.values(out || {}).filter(v => typeof v === 'string' && /^#/.test(v))
        .map(oklch).filter(c => c && c.c > 0.02)
      return set.length ? set.reduce((a, c) => a + c.c, 0) / set.length : 0
    } finally { Math.random = realRandom }
  }
  const quiet = meanChromaAt(0.6), mid = meanChromaAt(1), loud = meanChromaAt(1.6)
  assert(quiet > 0 && quiet < mid && mid < loud,
    `the level reaches the output (0.6 gives ${quiet.toFixed(3)}, 1.0 gives ${mid.toFixed(3)}, 1.6 gives ${loud.toFixed(3)})`)

  /* ── THE GROUND IS A DECISION, AND IT IS THE NEUTRAL SEED'S ──
   *
   * The neutral decides bg, surface and every border, so it decides whether a
   * page reads as a room or as a grey slab with a foreign hue on it. Three
   * grounds: an accent hue, a cool low chroma, and a cool vivid.
   */
  const tints = Object.keys(GROUND_TINTS)
  assert(tints.length === 3, `three ground tints, no more (${tints.join(', ')})`)
  assert(!!GROUND_TINTS[DEFAULT_GROUND_TINT], `the default names a real tint (${DEFAULT_GROUND_TINT})`)

  /* IT WRITES THE SEED, NEVER A SECOND FIELD. A stored name beside a stored
     hex is two sources for one decision, and they disagree the first time
     somebody edits the hex. So the tint is RECOVERED from the seed. */
  const accent = createInitialState().color.seeds.find(s => s.name === 'accent').hex
  for (const name of tints) {
    const hex = groundSeedHex(name, accent)
    assert(/^#[0-9a-f]{6}$/i.test(hex), `${name} writes a hex seed (${hex})`)
    const back = groundTintOf(hex, accent)
    assert(back === name || tintsCollide(accent),
      `${name} is recovered from the seed alone (read back ${back})`)
  }

  /* TWO TINTS CAN LAND ON ONE HEX, AND THE UI HAS TO SAY SO. A blue accent IS
     the cool hue, so "accent hue" and "cool low" write the same colour for it.
     Match the FIXED-hue tint first, or the picker relabels itself when the
     accent moves. */
  const collides = tintsCollide(accent)
  const accentHex = groundSeedHex('accent', accent)
  const coolHex = groundSeedHex('cool-low', accent)
  assert(collides === (accentHex.toLowerCase() === coolHex.toLowerCase()),
    `the collision is reported when it is real (${collides}, accent ${accentHex} against cool ${coolHex})`)
  if (collides) {
    assert(groundTintOf(accentHex, accent) === 'cool-low',
      'and the fixed-hue tint wins the label, so the picker cannot relabel itself')
  }

  assert(GROUND_L > 0 && GROUND_L < 1, `the ground seed sits at a stated lightness (${GROUND_L})`)

  /* ── BREAK EACH BAR ON THE SHAPE IT WAS SET AGAINST ── */
  const wouldFail = [
    ['a default at the old 1.25 behaviour', 1.25 !== 1],
    ['a range that ends at the old behaviour', !(1.25 > 1.25)],
    ['a level the generator ignores, so all three means match', !(0.1 < 0.1)],
    ['a fourth ground tint', 4 !== 3],
  ]
  const caught = wouldFail.filter(([, fails]) => fails)
  assert(caught.length === wouldFail.length,
    `every bar rejects the shape it was set against (${caught.length} of ${wouldFail.length}: `
    + wouldFail.filter(([, f]) => !f).map(([w]) => w).join(', ') + ')')
}

/* ── A TRANSLUCENT COLOUR HAD NO CONTRAST, AND BOTH FORMULAS SAID IT DID ──
 *
 * `wcagContrast` and the APCA luminance both read a colour's channels and had
 * no opinion about its alpha. So a translucent value passed AA while failing
 * it on screen by a factor of five, and the audit reported nothing.
 *
 * Measured before the fix, and each figure is pinned below:
 *
 *     #00000080 on white       reported 21:1      composited 4:1
 *     #33333380 on white       reported 12.63:1   composited 2.85:1
 *     #ffffff80 on #111111     reported 18.88:1   composited 5.33:1
 */
{
  line('\n- a translucent colour is composited before it is measured -')
  const { flatten, alphaOf, wcag, apca } = await import('../src/color/contrast.js')

  /* ── OPAQUE BEHAVIOUR IS UNCHANGED, and that is the half that could break
     every other assertion in this file. Six pairs, measured before the edit
     and pinned to the same numbers. */
  const OPAQUE = [
    ['#ffffff', '#111111', 18.88], ['#111111', '#ffffff', 18.88],
    ['#3366ff', '#ffffff', 4.68], ['#005d59', '#e6faf8', 7.16],
    ['#6d7c8a', '#e6ecf1', 3.6], ['#999999', '#ffffff', 2.85],
  ]
  for (const [fg, bg, want] of OPAQUE) {
    const got = wcag(fg, bg).ratio
    assert(Math.abs(got - want) < 0.01, `${fg} on ${bg} still reads ${want}:1 (${got})`)
  }

  /* ── A TRANSLUCENT FOREGROUND IS COMPOSITED OVER ITS BACKGROUND ──
     Its ground IS the background, so this half is exact. */
  const COMPOSITED = [
    ['#00000080', '#ffffff', 4, 21],
    ['#33333380', '#ffffff', 2.85, 12.63],
    ['#ffffff80', '#111111', 5.33, 18.88],
  ]
  for (const [fg, bg, want, was] of COMPOSITED) {
    const got = wcag(fg, bg).ratio
    assert(Math.abs(got - want) < 0.02,
      `${fg} on ${bg} reads ${want}:1 rather than the ${was}:1 it used to (${got})`)
  }

  /* ── NOT MEASURED IS NOT A PASS ──
     A translucent BACKGROUND has no known ground at this layer: its ground is
     whatever the page puts behind it. A test that cannot run returns null
     rather than a verdict. A caller that knows the ground passes it. */
  const blind = check('#ffffff', '#00000080')
  assert(blind.ratio == null && blind.notMeasured === true,
    `a translucent background with no ground is not measured (ratio ${blind.ratio}, notMeasured ${blind.notMeasured})`)
  const grounded = check('#ffffff', '#00000080', { under: '#ffffff' })
  assert(Math.abs(grounded.ratio - 4) < 0.02,
    `and it measures once the ground is stated (${grounded.ratio}:1 on white)`)
  assert(apca('#ffffff', '#00000080') === null,
    'APCA declines the same pair rather than returning a number')

  /* ── THE HELPERS ── */
  assert(flatten('#00000080', '#ffffff') === '#7f7f7f',
    `flatten composites in sRGB (${flatten('#00000080', '#ffffff')})`)
  assert(flatten('#3366ff', '#ffffff') === '#3366ff',
    'an opaque colour comes back untouched, so nothing moves where nothing is translucent')
  assert(alphaOf('#000000') === 1 && alphaOf('nonsense') === null,
    `alphaOf reports 1 for opaque and null for a colour it cannot parse (${alphaOf('#000000')}, ${alphaOf('nonsense')})`)

  /* ── AND THE VALUE SURVIVES THE PIPELINE ──
     A translucent component override reaches tokens.css verbatim. Measured on
     two properties a person would actually set. */
  {
    const st = createInitialState()
    st.components.overrides['alert-warning.borderColor'] = '#00000033'
    st.components.overrides['card.backgroundColor'] = 'rgba(255,255,255,0.6)'
    let d = null, err = null
    try { d = derive(st) } catch (e) { err = e.message }
    assert(!err, `derive survives a translucent override (${err || 'ok'})`)
    if (d) {
      const css = payloadTextFiles(st, d)['tokens.css']
      for (const [name, want] of [
        ['--cmp-alert-warning-border-color', '#00000033'],
        ['--cmp-card-background-color', 'rgba(255,255,255,0.6)'],
      ]) {
        const m = new RegExp(name + ':\\s*([^;]+);').exec(css)
        assert(m && m[1].trim() === want,
          `${name} reaches tokens.css verbatim (${m ? m[1].trim() : 'ABSENT'})`)
      }
    }
  }

  /* ── BREAK EACH BAR ON THE NUMBER IT REPLACED ── */
  const wouldFail = [
    ['#00000080 on white reported 21:1', Math.abs(21 - 4) >= 0.02],
    ['#33333380 on white reported 12.63:1', Math.abs(12.63 - 2.85) >= 0.02],
    ['#ffffff80 on #111111 reported 18.88:1', Math.abs(18.88 - 5.33) >= 0.02],
  ]
  const caught = wouldFail.filter(([, fails]) => fails)
  assert(caught.length === wouldFail.length,
    `every bar rejects the number it replaced (${caught.length} of ${wouldFail.length})`)
}

/* ── THE ALPHA STRIP EXISTED AND NOBODY TURNED IT ON ──
 *
 * `ColorPicker` takes an `alpha` prop, draws a checkerboard strip when it is
 * true, and defaults it to false. Six call sites and not one passed it.
 *
 * WHERE IT GOES ON IS DECIDED BY WHERE THE VALUE SURVIVES. Measured before
 * wiring anything: a component property reaches tokens.css verbatim, and a
 * seed keeps its alpha at the ramp step and loses it at the role. Offering a
 * control that drops its value is worse than offering none.
 */
{
  line('\n- the opacity strip reaches the two places a value survives -')
  const { toHsb360, fromHsb360, hexFrom, withAlpha } = await import('../src/color/convert.js')
  const fs = await import('node:fs')

  /* ── THE EMIT PATH SERIALISES ALPHA ──
     `emit` is hexFrom(fromHsb360(next)), so the strip's own output is what
     these four numbers are. Anything less and the drag would round back to
     opaque and the control would look broken. */
  const hsb = toHsb360(parseColorFor('#fff4e1'))
  const at = a => hexFrom(fromHsb360({ ...hsb, a }))
  assert(at(1) === '#fff4e0', `an opaque drag stays six digits (${at(1)})`)
  assert(at(0.5) === '#fff4e080', `half opacity writes eight (${at(0.5)})`)
  assert(at(0.2) === '#fff4e033', `a fifth writes eight (${at(0.2)})`)
  assert(at(0) === '#fff4e000', `and fully transparent writes eight (${at(0)})`)
  assert(typeof withAlpha === 'function', 'the converter publishes withAlpha for callers that need it')

  /* ── THE STRIP IS OFFERED WHERE THE VALUE SURVIVES, AND NOWHERE ELSE ──
     A source check, because a rendered panel cannot say which of six call
     sites passed the prop. Two on, four off, and each one deliberate. */
  const src = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
  const forwarded = src('ui/TokenColorPicker.jsx')
  assert(/alpha = false,/.test(forwarded) && /alpha=\{alpha\}/.test(forwarded),
    'TokenColorPicker takes the prop and forwards it, defaulting to off')

  const ON = ['panels/ComponentsPanel.jsx', 'panels/system.jsx']
  for (const f of ON) {
    assert(/\balpha\b\s*(\/|>|\n)/.test(src(f)) || /\salpha\s*$/m.test(src(f)),
      `${f} offers opacity`)
  }
  /* A SEED, A RAMP STEP AND A ROLE MUST NOT OFFER IT. The value is lost on the
     way to a role, so the control would store something and paint nothing. */
  const rolesSrc = src('panels/RolesPanel.jsx')
  assert(!/<ColorPicker[^>]*\salpha\b/.test(rolesSrc), 'a role override does not offer it')
  const colorSrc = src('panels/ColorPanel.jsx')
  assert(!/<ColorPicker[^>]*\salpha\b/.test(colorSrc), 'a seed and a ramp step do not offer it')

  /* ── AND THE REASON, MEASURED ──
     A seed carrying alpha keeps it at the ramp step and loses it at the role.
     That is what makes the four omissions correct rather than an oversight. */
  {
    const st = createInitialState()
    st.color.seeds = st.color.seeds.map(sd => sd.name === 'accent' ? { ...sd, hex: '#3366ff80' } : sd)
    const d = derive(st)
    assert(/^#[0-9a-f]{8}$/i.test(d.ramps.accent.steps[500]),
      `an alpha seed survives to the ramp step (${d.ramps.accent.steps[500]})`)
    const eight = Object.values(d.roles.light).filter(v => typeof v === 'string' && /^#[0-9a-f]{8}$/i.test(v))
    assert(eight.length === 0,
      `and no role carries it, which is why a seed does not offer the strip (${eight.length} roles with alpha)`)
  }
}

/* ── GLASS, AND THE BLUR THAT REACHED NO TOKEN ──
 *
 * `scrim.blur` sat in state, 0 to 24px, and the Depth panel applied it inline
 * in its own preview. So it looked wired while an exported build got a scrim
 * with no blur whatever the setting said. Same class as the 86 published
 * tokens no stylesheet reads, in the state layer instead of the CSS.
 */
{
  line('\n- glass publishes three parts, a fallback, and its own contrast floor -')
  const { audit } = await import('../src/a11y/audit.js')
  const fs = await import('node:fs')

  const withGlass = (o) => {
    const st = createInitialState()
    st.elevation.glass = { on: true, role: 'surface', opacity: 0.72, blur: 12, ...(o || {}) }
    return st
  }

  /* ── OFF BY DEFAULT, AND OFF MEANS NO TOKEN ──
     A token for a look a system has not asked for is a look a builder uses. */
  {
    const st = createInitialState()
    assert(st.elevation.glass?.on === false, 'glass is off by default')
    const css = payloadTextFiles(st, derive(st))['tokens.css']
    const found = (css.match(/--glass-[a-z-]+:/g) || [])
    assert(found.length === 0, `and publishes no glass token while it is off (${found.length})`)
  }

  /* ── THE BLUR THAT EXISTED AND REACHED NOTHING ── */
  {
    const st = createInitialState()
    st.elevation.scrim.blur = 8
    const css = payloadTextFiles(st, derive(st))['tokens.css']
    const m = /--scrim-blur:\s*([^;]+);/.exec(css)
    assert(m && m[1].trim() === '8px', `the scrim blur reaches a token (${m ? m[1].trim() : 'ABSENT'})`)
  }

  /* ── THREE PARTS AND A FALLBACK ──
     The fill is the role at the stated opacity. The FALLBACK is the same role
     at FULL opacity, because a build with no backdrop-filter paints the raw
     translucent fill and everything behind reads straight through. */
  {
    const st = withGlass()
    const css = payloadTextFiles(st, derive(st))['tokens.css']
    const get = (n, from = css) => { const m = new RegExp(n + ':\\s*([^;]+);').exec(from); return m ? m[1].trim() : null }
    assert(get('--glass-fill') === '#e6ecf1b8',
      `the fill is the surface at 72% (${get('--glass-fill')})`)
    assert(get('--glass-fallback') === '#e6ecf1',
      `the fallback is the same role at full opacity (${get('--glass-fallback')})`)
    assert(get('--glass-blur') === '12px', `the blur is published (${get('--glass-blur')})`)
    const dark = css.slice(css.indexOf('data-theme="dark"'))
    assert(get('--glass-fill', dark) === '#1e2934b8',
      `and the dark mode carries its own fill (${get('--glass-fill', dark)})`)
  }

  /* ── THE OPAQUE DECLARATION COMES FIRST ──
     A browser that understands neither the property nor the query still has to
     paint a surface a person can read, so the fallback is the BASE rule and
     the translucent fill sits inside the @supports. */
  {
    const cssSrc = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
    const base = cssSrc.indexOf('.dmd .glass {')
    const supports = cssSrc.indexOf('@supports (backdrop-filter')
    assert(base > 0 && supports > base,
      `the opaque fallback is declared before the @supports block (${base}, ${supports})`)
    const block = cssSrc.slice(base, supports)
    assert(/--glass-fallback/.test(block) && !/--glass-fill/.test(block),
      'the base rule paints the fallback and never the translucent fill')
    assert(/-webkit-backdrop-filter/.test(cssSrc),
      'and the prefixed property ships beside the standard one')
    assert(/\.dmd \.scrim \{[^}]*backdrop-filter/.test(cssSrc.replace(/\r?\n/g, ' ')),
      'the scrim consumes its blur token')
  }

  /* ── TEXT ON GLASS HAS NO FIXED GROUND, SO THE AUDIT MEASURES THE WORST ──
     Measured at four opacities: 0.9 gives nothing, 0.72 gives one finding at
     4.45:1, 0.5 gives two, and 0.25 gives two with the worst at 3.90:1. */
  {
    const clean = createInitialState()
    assert(audit(clean, derive(clean)).filter(f => /^glass:/.test(f.id)).length === 0,
      'no glass finding while the treatment is off')
    const rows = []
    for (const opacity of [0.9, 0.72, 0.5, 0.25]) {
      const st = withGlass({ opacity })
      const g = audit(st, derive(st)).filter(f => /^glass:/.test(f.id))
      rows.push({ opacity, n: g.length, worst: g.length ? g[0].measured : null })
    }
    assert(rows[0].n === 0, `at 90% opacity the ground stops mattering (${rows[0].n} findings)`)
    assert(rows[3].n > 0, `at 25% it does not (${rows[3].n} findings: ${rows[3].worst})`)
    /* MONOTONIC: a thinner fill can only make the worst ground worse. A count
       that fell as the fill thinned would mean the measurement was backwards. */
    const worstOf = o => {
      const st = withGlass({ opacity: o })
      const g = audit(st, derive(st)).filter(f => /^glass:/.test(f.id))
      return g.length ? Math.min(...g.map(f => parseFloat(f.measured))) : 99
    }
    const a = worstOf(0.72), b = worstOf(0.5), c = worstOf(0.25)
    assert(a > b && b > c,
      `a thinner fill only makes the worst ground worse (${a} then ${b} then ${c})`)
    /* AND A BLUR DOES NOT RESCUE A RATIO. It stops what is behind being
       READABLE and does nothing about its lightness. */
    const heavy = withGlass({ opacity: 0.25, blur: 40 })
    const light = withGlass({ opacity: 0.25, blur: 0 })
    const hn = audit(heavy, derive(heavy)).filter(f => /^glass:/.test(f.id)).length
    const ln = audit(light, derive(light)).filter(f => /^glass:/.test(f.id)).length
    assert(hn === ln && hn > 0,
      `a 40px blur clears nothing a 0px blur does not (${hn} against ${ln})`)
  }
}

/* ── PART C: GLASS REACHES THE READER ──
 *
 * A treatment we ship and never teach is one every receiving agent invents
 * differently. So the payload states the three parts, gives the CSS to copy,
 * and publishes the worst-ground figures computed from the real palette.
 */
{
  line('\n- glass reaches the payload, and only when it is on -')
  const { hexFrom, withAlpha } = await import('../src/color/convert.js')
  const withGlass = () => {
    const st = createInitialState()
    st.elevation.glass = { on: true, role: 'surface', opacity: 0.72, blur: 12 }
    return st
  }

  /* ── NOT A WORD WHILE IT IS OFF ──
     A reader told about a look the system has not asked for will use it. */
  {
    const st = createInitialState()
    const md = payloadTextFiles(st, derive(st))['DESIGN.md']
    assert(!/GLASS IS THREE PARTS/.test(md), 'the document says nothing about glass while it is off')
    assert(!/glass-fill|glass-fallback|glass-blur/.test(md),
      'and names none of its tokens')
  }

  /* ── THE THREE PARTS, THE CSS, AND THE WORST GROUND ── */
  {
    const st = withGlass()
    const md = payloadTextFiles(st, derive(st))['DESIGN.md']
    for (const term of [
      'GLASS IS THREE PARTS',
      'THE OPAQUE DECLARATION COMES FIRST',
      'TEXT ON GLASS HAS NO FIXED CONTRAST, SO MEASURE THE WORST GROUND',
      'A BLUR DOES NOT RESCUE A RATIO',
    ]) {
      assert(md.includes(term), `the document states: ${term.slice(0, 44)}`)
    }
    /* The CSS to copy, in the order that matters: a reader who copies it must
       get the opaque base BEFORE the query. */
    const base = md.indexOf('background-color: var(--glass-fallback)')
    const query = md.indexOf('@supports (backdrop-filter')
    assert(base > 0 && query > base,
      `the fallback is shown before the support query (${base}, ${query})`)
    assert(md.includes('-webkit-backdrop-filter'),
      'and the prefixed property is shown beside the standard one')

    /* ── EVERY FIGURE IS DERIVED ──
       The fill, the composited ground and the ratio come from the real
       palette. A number a document computes cannot go stale. */
    const d = derive(st)
    const fill = hexFrom(withAlpha(parseColorFor(d.roles.light.surface), 0.72))
    assert(md.includes(fill), `the light fill in the table is the real one (${fill})`)
    const darkFill = hexFrom(withAlpha(parseColorFor(d.roles.dark.surface), 0.72))
    assert(md.includes(darkFill), `and so is the dark one (${darkFill})`)
    /* The table carries a ratio for each mode, so two rows. */
    const rows = (md.match(/\|\s(light|dark)\s\|\s#[0-9a-f]{8}\s\|/gi) || [])
    assert(rows.length === 2, `one row per mode (${rows.length})`)
  }

  /* ── AND THE READER'S BUILD IS CHECKED ──
     Prose alone is a rule the next build breaks. Proven on a four-case
     fixture: 2 of 2 on the fault, and silent on a correct rule and on a
     selector list that gives both members the same opaque base. */
  {
    const { CHECKS } = await import('../src/emit/checks.js')
    const c = CHECKS.find(x => x.id === 'a-backdrop-blur-has-an-opaque-fallback')
    assert(!!c && c.where === 'source', `the fallback check ships and reads the source (${c?.where})`)
    assert(c.body.some(l => /transparent/.test(l)) && c.body.some(l => /rgba\|hsla/.test(l)),
      'and a translucent fallback does not count, which is the same fault written twice')
  }
}

/* ── A RULE THAT MATCHES NOTHING IS A TOKEN STILL UNREAD ──
 *
 * Consuming 22 unread colour tokens took the count from 79 to 57. Two of my
 * new selectors reached no element on any of eleven surfaces, so those tokens
 * were no more read than before:
 *
 *   .dmd .textarea                the element is <textarea class="input">
 *   .dmd .btn-danger.btn-ghost    the class is .btn-danger-ghost
 *
 * ASKING THE DOM IS THE ONLY WAY TO SEE THAT. A rule sits in the stylesheet,
 * reads correctly, and matches nothing. The guard counts a token as read the
 * moment its NAME appears, so it cannot tell the difference.
 */
{
  line('\n- every rule consuming a token reaches a real element -')
  const fs = await import('node:fs')
  const css = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')

  /* ── THE TWO SELECTORS I GOT WRONG, PINNED ──
     Written as the shape that FAILED, so reinstating either fails here. */
  assert(!/\.dmd \.textarea\s*\{/.test(css),
    'no rule targets .textarea, which this preview never renders')
  assert(/\.dmd textarea\.input\s*\{/.test(css),
    'the textarea is named by its tag and the class it carries')
  assert(!/\.dmd \.btn-danger\.btn-ghost\s*\{/.test(css),
    'no rule targets .btn-danger.btn-ghost, which is two classes for one')
  assert(/\.dmd \.btn-danger-ghost\s*\{/.test(css),
    'the danger ghost is one class, as the preview writes it')

  /* ── THE TOKEN AND THE SAMPLE HAD DISAGREED ──
     The component publishes three indeterminate colours, so the state CAN
     differ from checked. The sample rendered `checkbox is-on` for both, with a
     comment saying the MARK is what separates them. The tokens win on whether
     a build MAY differ, so the sample carries the class and the fallbacks are
     the CHECKED values. Nothing moves by default. */
  const icons = fs.readFileSync(new URL('../src/preview/icons.jsx', import.meta.url), 'utf8')
  assert(/is-indeterminate/.test(icons),
    'the indeterminate sample carries its own class')
  assert(/--cmp-checkbox-indeterminate-background-color, var\(--cmp-checkbox-checked-background-color/.test(css),
    'and its fallback is the checked fill, so the default renders as it did')

  /* ── A CONDITIONAL TOKEN IS READ WITH A FALLBACK ON PURPOSE ──
   *
   * I wrote an assertion here that every token the preview READS must be one
   * the system publishes. It reported four findings and all four were correct
   * code. `--cmp-card-background-image` is dropped by the emitter when it is
   * `none`, under a rule whose own comment says why, and a ghost active state
   * is one a build may add rather than one we ship.
   *
   * So the question cannot be asked statically, and the check is gone. Cut a
   * check you cannot make honest.
   *
   * ── AND THE COUNT COMES FROM THE GUARD, NEVER FROM A SECOND SCAN ──
   *
   * My own recount gave 58 against the guard's 57, because the guard reads the
   * whole preview directory and I read one stylesheet. One scorer, two
   * callers, or the two disagree and neither is trusted.
   */
  const record = JSON.parse(fs.readFileSync(new URL('../tools/token-reader.json', import.meta.url), 'utf8'))
  const st = createInitialState()
  const published = new Set()
  for (const m of payloadTextFiles(st, derive(st))['tokens.css'].matchAll(/(--cmp-[\w-]+)\s*:/g)) published.add(m[1])
  assert(record.published === published.size,
    `the recorded published count is current (${published.size} against ${record.published})`)
  assert(record.unread < 79,
    `the unread count has fallen from the 79 it started at (${record.unread})`)
}

/* ── EVERY PUBLISHED COMPONENT TOKEN NOW HAS A READER ──
 *
 * 359 published, 0 read by nothing. The payload teaches every one of them to a
 * building agent, so a token the sample cannot demonstrate is a pointer rather
 * than a preview.
 *
 * THE TYPE FALLBACK IS `inherit`, WHICH IS WHAT THESE COMPONENTS DO TODAY, so
 * the whole batch moves almost nothing. Measured at a pinned pane width over
 * eleven surfaces: 1483 elements, 0 family changes, 0 weight changes, and the
 * largest tracking shift 0.024px.
 */
{
  line('\n- every published component token has a reader -')
  const fs = await import('node:fs')
  const record = JSON.parse(fs.readFileSync(new URL('../tools/token-reader.json', import.meta.url), 'utf8'))
  assert(record.unread === 0,
    `no published component token is unread (${record.unread} of ${record.published})`)

  const css = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')

  /* ── A GAP ON A BUTTON WOULD ADD TO THE MARGIN THAT ALREADY SPACES ITS MARK ──
     The button spaces its icon with `margin-inline-end`, which reads the token
     already. Declaring a `gap` too gives one distance two writers and puts the
     mark 16px from its label. Measured on the first attempt: 80 elements. */
  assert(/\.dmd \.btn \.icon \{[^}]*margin-inline-end: var\(--cmp-button-gap/.test(css.replace(/\r?\n/g, ' ')),
    'the button mark is spaced by a margin, which reads the gap token')
  const btnRules = css.match(/^\.dmd \.btn \{[^}]*\}/ms) || []
  assert(!/\bgap:/.test(btnRules[0] || ''),
    'and the button rule declares no gap of its own, so the distance has one writer')

  /* ── THE MONO FACE IS RESTATED AFTER THE COMPONENT TYPE RULES ──
     Both are (0,2,0), so order decides. The table rule won and took the mono
     face off three cells: JetBrains Mono became Manrope. A figure in a COLUMN
     of figures takes the mono face, because that is what stacks the digits. */
  const tableType = css.indexOf('--cmp-table-font-family')
  const monoRestated = css.indexOf('.dmd .amount, .dmd .figure, .dmd .table .amount')
  assert(tableType > 0 && monoRestated > tableType,
    `the mono face is declared after the table type rule (${tableType}, ${monoRestated})`)

  /* ── AND THE RESET I ADDED FOR SVGs CAME BACK OUT ──
     It turned 176 inert tracking changes into 240, because every SVG in the
     tree already inherited the document tracking and the reset moved it the
     other way. The property paints nothing on a shape either way. */
  assert(!/\.dmd svg, \.dmd \.icon \{ letter-spacing: normal; \}/.test(css),
    'no blanket letter-spacing reset on marks, which only moved inert values')

  /* ── THREE WEIGHTS NOW SAY WHAT THE PREVIEW PAINTS ──
     Each took its weight from a role carrying 400 while painting heavier. A
     build reading the token alone got a lighter component than the preview
     shows. The badge figure was measured and chosen: at 12px, 500 inks 3.6%
     more pixels and reads 1.74:1 against its own fill where 400 reads 1.64. */
  const st = createInitialState()
  const v = buildCssVars(derive(st), 'light')
  for (const [name, want] of [['badge', '500'], ['avatar', '600'], ['select', '500']]) {
    assert(v['--cmp-' + name + '-font-weight'] === want,
      `the ${name} states weight ${want} (${v['--cmp-' + name + '-font-weight']})`)
  }
  assert(v['--cmp-input-font-weight'] === '400',
    `and a component that really is 400 keeps it (${v['--cmp-input-font-weight']})`)
}

/* ── THE RESPONSIVE SECTION: THREE CHECKS, AND ONE I HAD TO REWRITE ──
 *
 * Each was measured against correct code first, and the third was unfireable
 * as I first wrote it.
 */
{
  line('\n- the responsive rules: two checks shipped, one cut -')
  const { CHECKS } = await import('../src/emit/checks.js')
  const get = id => CHECKS.find(c => c.id === id)

  /* ── AND THE WRAP CHECK WAS CUT, WITH ITS MEASUREMENT ──
   *
   * The rule is right: flex-wrap is what the browser does when nobody made a
   * decision, and it strands whichever item falls past the edge.
   *
   * THE CHECK COULD NOT ASK IT. Measured on five bare wraps in our own
   * stylesheet, every one of them correct code:
   *
   *   .row-wrap       names itself
   *   .action-pairs   names itself
   *   .page-head      ordered in another FILE, with a full-width basis
   *   .batch-bar      ordered in another file
   *   .chart-key      a legend, which is a list that wraps
   *
   * My first version faulted the last three. Widening it to accept "the
   * children are ordered somewhere" needs a cross-file inference from a class
   * name to a rule about its descendants, and that is a guess dressed as a
   * test. A check that fires on correct code three times in five costs more
   * than the miss, so it went.
   *
   * The measurement stays here so nobody writes this one again.
   */
  {
    const gone = CHECKS.find(c => c.id === 'a-row-wraps-only-when-told')
    assert(!gone, `the wrap check is not shipped (${gone ? gone.where : "absent"})`)
  }
  /* ── A PAIR DISSOLVES WHEN THE ROW FITS ──
     Measured on the shipped surfaces. At 1280 every pair computes
     display: contents and all five rows are one line. At 320 every pair is
     flex and the line count equals the pair count, and no line holds more than
     two. So the check reads what the page IS rather than what width it is at. */
  {
    const c = get('a-pair-dissolves-when-a-row-fits')
    assert(!!c && c.where === 'render', `the pair check ships and runs in a browser (${c?.where})`)
    const text = c.body.join('\n')
    assert(/contents/.test(text), 'it asks whether a pair has dissolved, which is a declaration')
    assert(/> 2/.test(text), 'and a boxed pair holds two buttons at most')
  }

  /* ── AND THE THIRD WAS UNFIREABLE AS I FIRST WROTE IT ──
   *
   * I asked whether space-between produced UNEQUAL gaps. It cannot: the
   * mechanism splits its free space evenly, so the gaps are equal by
   * definition. Five shapes measured in a 520px row:
   *
   *   pure space-between      182.25, 182.25   1.00:1
   *   with a declared gap     182.25, 182.25   1.00:1
   *   one child grows         0, 0             skipped by the zero guard
   *   an auto margin          0, 364.5         skipped, and slack is not a gap
   *   a 64px margin           150.25, 214.25   1.43:1
   *
   * THE RECORDED FAULT WAS A UNIFORM GAP. 65.3px between a bell and the menu
   * beside it, both the same kind of control, so the even split opened a hole
   * inside one run. The gap on the other side was the same 65.3 and correct.
   */
  {
    const c = get('space-between-spreads-every-gap')
    assert(!!c && c.where === 'render', `the space-between check ships (${c?.where})`)
    const text = c.body.join('\n')
    assert(/tagName !== b.tagName/.test(text),
      'it compares two ADJACENT LIKE controls, which is what reads as one run')
    assert(!/max \/ min/.test(text),
      'and it does not ask about an unequal gap, which space-between cannot produce')
    assert(/kids.length < 3/.test(text),
      'two items is the idiom and has no run to break')
    /* THE MEASUREMENT THAT KILLED THE FIRST VERSION, kept so nobody writes it
       again: an even split cannot reach the 3:1 a ratio question would need. */
    const evenSplit = [182.25, 182.25]
    assert(Math.max(...evenSplit) / Math.min(...evenSplit) === 1,
      'a pure space-between row splits its slack evenly, so a ratio question is unfireable')
  }
}

/* A hue to a hex at a fixed lightness and chroma, so the sweep above varies
   one thing. Written here rather than imported: the generator's own helpers
   apply its rules, and this has to hand it a raw seed. */
function hueHex(h) {
  const c = 0.13, l = 0.55
  const a = Math.cos(h * Math.PI / 180) * c
  const b = Math.sin(h * Math.PI / 180) * c
  const gamma = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3
  const rgb = [
    +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S,
  ].map(v => Math.max(0, Math.min(1, gamma(v))))
  return '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

/* ── THE ALIGNMENT SECTION: RULES THAT STATED A CONSTANT AND NOTHING READ IT ──
 *
 * Each was measured before it was written. Three held with no assertion. The
 * fourth was the instrument itself, and it was wrong three ways.
 */
{
  line('\n- the alignment rules that had no check -')
  const { SPACE_STEPS } = await import('../src/state/schema.js')
  const PREVIEW = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const button = COMPONENT_LIBRARY.find(c => c.name === 'button')
  const avatar = COMPONENT_LIBRARY.find(c => c.name === 'avatar')

  /* ── THE MARK IS ONE SIZE AT EVERY BUTTON SIZE ──
     Their number, 28 August 2026: 14px. The cap-band rule centres a mark at
     whatever size it is, so nothing is left for a size step to track. A
     per-step mark is how the pairing breaks — three rules resized a button and
     left its mark behind. */
  assert(!!button && !!button.base.iconSize,
    `the button states its mark size once, in its base (${button && button.base.iconSize})`)
  {
    const perStep = Object.entries(button.sizes || {})
      .filter(([, v]) => v && Object.prototype.hasOwnProperty.call(v, 'iconSize'))
      .map(([k]) => k)
    assert(perStep.length === 0,
      `and no size step restates it, so a rule that resizes the box cannot leave the mark behind (${perStep.join(', ') || 'none do'})`)
  }

  /* ── AN AVATAR IS NOT AN ICON, SO IT PUBLISHES ITS OWN GAP ──
     It had none, so a row holding one fell back to the row default and put 8px
     between a 32px disc and the name beside it. The icon gap is calibrated for
     a 14px mark against a 14px label, and a disc is four times the mark. They
     asked for 50% more, which is one step up the scale. */
  {
    assert(!!avatar.base.gap && avatar.base.gap !== button.base.gap,
      `an avatar publishes its own gap rather than the mark gap (${avatar.base.gap} against ${button.base.gap})`)
    const step = t => SPACE_STEPS.findIndex(x => `{spacing.${x.name}}` === t)
    assert(step(avatar.base.gap) === step(button.base.gap) + 1,
      `and it is exactly one step above it, never two (${step(button.base.gap)} to ${step(avatar.base.gap)})`)
  }

  /* ── TWO CONTROLS ARE EXCLUDED FROM THE CAP-BAND LIFT ──
     An ICON-ONLY control has no label, so it has no baseline, and the lift
     dropped a bell and a bulb out of their boxes. A SELECT TRIGGER puts its
     chevron at the far end of a row that sets its own alignment, and
     `align-self: baseline` pulled it to 10px above the cap line against 2.92
     before. Both centre on their own box. Shipping without them is how I found
     both, so the exclusions are asserted rather than remembered. */
  {
    const bare = PREVIEW.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    const carrying = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .filter(b => /translateY\(calc\(\(100% - 0\.75em\)/.test(b[2]))
    /* THREE RULES CARRY IT, and none is a mistake. Assert the SET, never the
       count, so a fourth addition says which one it is.

       The CONTROLS rule is the one with the two exclusions. A LEGEND DOT has
       no text of its own, so without the lift it takes its baseline from its
       bottom margin edge and hangs its whole height above the line. An ALERT'S
       mark used to be centred in a one-line slot, which put it on the line
       box's centre rather than the cap band's: measured 5.5px above the cap
       against 0 below the baseline, on five alerts. */
    const homes = carrying.map(b => b[1].trim().split(',')[0].trim())
    for (const [what, needle] of [
      ['the controls', /\.btn:not\(/],
      ['the legend dot', /chart-key|\.dot/],
      ['an alert mark', /\.alert/],
    ]) {
      assert(carrying.some(b => needle.test(b[1])),
        `the cap-band lift reaches ${what} (${homes.length} rules carry it)`)
    }
    assert(carrying.length === 3,
      `and nothing else carries it (${carrying.length}: ${homes.join(' | ').slice(0, 70)})`)
    const controls = carrying.find(b => /\.btn:not\(/.test(b[1]))
    assert(!!controls, 'one of them is the control rule, found by the exclusion it carries')
    /* BLANK WHAT IS INSIDE `:not()` BEFORE ASKING WHICH BRANCH THIS IS. The
       `.with-icon` branches exclude `.btn` and `.nav-item` by name, so a plain
       search for those words called five branches control branches and then
       faulted three of them for lacking an exclusion they do not need. */
    const branches = (controls ? controls[1] : '').split(',').map(x => x.trim())
      .filter(x => /(^|\s)\.(btn|nav-item)\b/.test(x.replace(/:not\([^)]*\)/g, '')))
    assert(branches.length === 2, `two branches name a control as their own subject (${branches.length})`)
    for (const control of ['.icon-only', '.select-trigger']) {
      assert(branches.length > 0 && branches.every(x => x.includes(`:not(${control})`)),
        `every control branch of the lift excludes ${control} (${branches.length} branches)`)
    }
  }

  /* ── AND THE INSTRUMENT TYPED THE FLOOR IT WAS MEASURING AGAINST ──
   *
   * `layout-tools.js` read `--target-min-pointer` for the mouse and typed 40
   * for the finger, two lines under its own comment about not doing that. The
   * document publishes 44 and the render check enforces 44, so the sweep would
   * have passed a 40px control that the verifier fails.
   *
   * It also measured the HEIGHT alone, and asked a TAG LIST which things are
   * targets. Both were blind to a real fault: an icon-only button 28 wide by
   * 44 tall, and a select at 38.26 beside a 44px tab, because `select` was not
   * in the list. And once the list widened, the DRAWN box was reported while
   * the transparent control covering it went on being filtered out as unpainted
   * — 23 correct controls at once.
   *
   * Measured at a coarse pointer over twelve surfaces: 16 controls under the
   * floor, on a build that had passed on a mouse for weeks.
   */
  {
    const tools = fs.readFileSync(new URL('../public/layout-tools.js', import.meta.url), 'utf8')
    const bare = tools.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    /* THE DECLARATION AND THE CHOICE ARE TWO LINES, so read both. Asking the
       choice alone reported a fault on the repair, because the token name it
       demanded sits on the line above. */
    const lines = bare.split('\n')
    const at = lines.findIndex(l => /const floor = coarse/.test(l))
    const floorLine = at < 0 ? '' : lines[at]
    const above = at < 0 ? '' : lines.slice(Math.max(0, at - 3), at).join(' ')
    assert(/declaredTouch/.test(floorLine) && /getPropertyValue\('--target-min'\)/.test(above),
      `the sweep reads the touch floor off the document rather than typing it (${floorLine.trim().slice(0, 58)})`)
    assert(!/coarse \? 40/.test(bare),
      'and the number it used to type is gone, not merely shadowed')
    assert(/w < floor/.test(bare) && /h < floor/.test(bare),
      'and it measures both axes, because a target is as small as its smaller side')
    const list = bare.split('const INTERACTIVE =')[1] || ''
    assert(/select/.test(list.slice(0, 320)),
      'and it asks interactivity rather than a tag list, so a select counts as a target')
    assert(/partnerOf/.test(bare),
      'and a drawn ornament defers to the transparent control covering it, which is a SIBLING')
  }

  /* ── THE HIT AREA ASKS ITS HOST, NEVER A TOKEN THE HOST MIGHT NOT USE ──
     The overhang was written against the small-button height, which is the
     floor one of three hosts states. The table's select-all cell derives its
     height from the header's type and came out 0.78px short. A percentage in
     `top` resolves against the containing block's height, so one rule reaches
     the floor from any host, and `min` against zero stops a tall row growing. */
  {
    const bare = PREVIEW.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    /* THREE RULES STATE AN OVERHANG AND TWO ARE ABOUT SOMETHING ELSE. A stack
       and the batch bar each reach out half their own gap, so a target fills
       the space between two rows without covering the next one. Only the
       DEFAULT is about reaching the floor, and it is the one whose selector
       carries the bare class with no host in front of it. */
    const rule = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .filter(b => /\.checkbox-input/.test(b[1]) && /(^|[;\s])top\s*:/.test(b[2]))
    assert(rule.length === 3, `three rules state an overhang: the default and two hosts (${rule.length})`)
    const dflt = rule.find(b => b[1].split(',').some(x => x.trim() === '.dmd .checkbox-input'))
    assert(!!dflt, 'the default is the branch with no host in front of the class')
    const decls = dflt ? dflt[2] : ''
    assert(/min\(0px/.test(decls) && /100%/.test(decls),
      'it asks the host height and clamps at zero, so a tall row keeps its own size')
    assert(!/cmp-button-sm-height/.test(decls),
      'and it names no component floor, because two of the three hosts do not state one')
  }
}

/* ── SIX COLOUR RULES STATED A CONSTANT AND NOTHING READ IT ──
 *
 * Found by asking a better question than my first one. A keyword probe said 29
 * of 30 colour rules were covered, and it was wrong: an INTENSITIES hit
 * belonged to the depth feature, not to chroma level. So take each rule's own
 * NUMBERS and ask whether any reader holds them. Measured that way: 39 colour
 * rules state a constant, 33 have a reader, 6 did not.
 *
 * FOUR OF THE SIX HAD DRIFTED, which is the whole reason for this block. A
 * number a document states goes stale the moment the code moves, and only a
 * check joins them.
 *
 * EVERY FIGURE IS A RANGE ACROSS THE SEVEN PALETTES, never one palette's
 * value. A single number is what drifted, and it hid the relationship the rule
 * is actually about.
 */
{
  line('\n- the colour constants nothing was reading -')
  const { wcag: wc } = await import('../src/color/contrast.js')
  const { toOklchObj: ok3, parseColor: pc3 } = await import('../src/color/convert.js')
  const R3 = (a, b) => wc(a, b).ratio
  const L3 = h => toOklchObj(pc3(h)).l * 100
  const palettes = [null, ...PRESETS].map(p => {
    const s = p ? applyPreset(p.id, createInitialState()) : createInitialState()
    return { id: p ? p.id : 'default', d: derive(s) }
  })
  assert(palettes.length === 7, `every shipped palette is measured (${palettes.length})`)
  const span = xs => [Math.min(...xs), Math.max(...xs)]
  const f3 = n => n.toFixed(2)

  /* ── THE SELECTED ROW IS PAINTED BY `selected`, AND THE RULE NAMED
     `accent-subtle`. That role steps UP in light, L 97 against a 94 card, so
     the old claim of "down in both modes" was false in one of them. */
  {
    const light = palettes.map(p => L3(p.d.roles.light.selected))
    const cards = palettes.map(p => L3(p.d.roles.light.surface))
    assert(light.every((l, i) => l < cards[i]),
      `a selected row steps DOWN from its card in light (L ${f3(span(light)[0])}-${f3(span(light)[1])} against ${f3(span(cards)[0])}-${f3(span(cards)[1])})`)
    const dark = palettes.map(p => L3(p.d.roles.dark.selected))
    const dcards = palettes.map(p => L3(p.d.roles.dark.surface))
    assert(dark.every((l, i) => l < dcards[i]),
      `and down again in dark, which is the direction the rule calls a hole (L ${f3(span(dark)[0])}-${f3(span(dark)[1])} against ${f3(span(dcards)[0])}-${f3(span(dcards)[1])})`)
    const tint = palettes.map(p => L3(p.d.roles.light['accent-subtle']))
    assert(tint.every((l, i) => l > cards[i]),
      `accent-subtle is the other role and it steps UP in light, so the two are not interchangeable (L ${f3(span(tint)[0])}-${f3(span(tint)[1])})`)
  }

  /* ── THE OUTLINE FAILS ON THE RECESSED GROUND IN EVERY PRESET ──
     The rule stated 3.82, 2.36 and 4.57. Those were one palette on one day. */
  {
    const card = palettes.map(p => R3(p.d.roles.light.border, p.d.roles.light.surface))
    const sunk = palettes.map(p => R3(p.d.roles.light.border, p.d.roles.light['surface-sunken']))
    const muted = palettes.map(p => R3(p.d.roles.light['text-muted'], p.d.roles.light['surface-sunken']))
    assert(card.every(x => x >= 3),
      `the border clears the UI bar on the card in every preset (${f3(span(card)[0])}-${f3(span(card)[1])})`)
    assert(sunk.every(x => x < 3),
      `and fails it on the recessed ground in every preset, which is the limit to state (${f3(span(sunk)[0])}-${f3(span(sunk)[1])})`)
    assert(muted.every(x => x >= 3),
      `text-muted is the step that clears it there (${f3(span(muted)[0])}-${f3(span(muted)[1])})`)
    /* AND LIGHTENING THE ROW FIXES THE CONTROL ON IT. One step down beats two,
       in every preset, which is the whole claim. */
    const oneStep = palettes.map(p => R3(p.d.roles.light.border, p.d.roles.light.selected))
    assert(oneStep.every((x, i) => x > sunk[i]),
      `one step down reads higher than two, so lightening the row fixes its buttons (${f3(span(oneStep)[0])}-${f3(span(oneStep)[1])} against ${f3(span(sunk)[0])}-${f3(span(sunk)[1])})`)
  }

  /* ── THE CHART SCALE: CHROMA RISES, LIGHTNESS ARCS ONCE, EVERY PAIR CLEARS ── */
  {
    const first = palettes[0].d.dataviz.categorical.map(h => toOklchObj(pc3(h)))
    assert(first.length === 5, `five categorical series (${first.length})`)
    const chroma = first.map(x => x.c)
    assert(chroma.every((c, i) => i === 0 || c > chroma[i - 1]),
      `the chroma rises the whole way, so the set has somewhere to rest (${chroma[0].toFixed(3)} to ${chroma[chroma.length - 1].toFixed(3)})`)
    const light = first.map(x => x.l)
    const turns = light.filter((l, i) => i > 0 && i < light.length - 1
      && ((l - light[i - 1]) > 0) !== ((light[i + 1] - l) > 0)).length
    assert(turns === 1,
      `the lightness arcs once rather than cycling (${turns} turning point, ${light.map(l => l.toFixed(2)).join(' ')})`)
    /* EVERY PAIR, NOT ONLY THE NEIGHBOURS, against the 0.10 floor. */
    const worst = palettes.map(p => p.d.dataviz.worst.distance)
    assert(worst.every(x => x >= 0.10),
      `every pair clears the 0.10 floor in every preset (${worst.reduce((a, b) => Math.min(a, b)).toFixed(3)}-${worst.reduce((a, b) => Math.max(a, b)).toFixed(3)})`)
    /* AND THE LIMIT IS STATED, NOT CLAIMED AWAY. No categorical palette of
       five survives red-green loss on colour alone. */
    const noRG = palettes.map(p => p.d.dataviz.worstWithoutRedGreen)
    const lo = noRG.reduce((a, b) => Math.min(a, b))
    assert(lo < 0.10,
      `and none of them survives red-green loss on colour alone, which is the limit (${lo.toFixed(3)}-${noRG.reduce((a, b) => Math.max(a, b)).toFixed(3)})`)
  }

  /* ── AND THE PAYLOAD QUOTED TWO OF THESE FIGURES BESIDE ITS OWN DERIVED ONES ──
   *
   * One sentence read "the default outline measured 2.36:1 two steps down and
   * 3.02 one step down" and then derived 3.12 in the same breath. Another said
   * `accent-subtle` sits below the surface in BOTH modes at L 89.3, which is
   * the wrong role AND the wrong direction: that role measures L 97 in light,
   * a step UP, and 89.3 belongs to `selected`.
   *
   * A builder following it painted the wrong role and got the opposite result.
   * Both sentences derive every figure now, so neither can go stale.
   */
  {
    const md = payloadTextFiles(state, derived)['DESIGN.md']
    for (const quoted of ['2.36:1 two steps', '3.02 one step down',
      'sits below the surface in BOTH modes', 'which is +3.1 in light']) {
      assert(!md.includes(quoted),
        `the payload no longer quotes "${quoted.slice(0, 34)}" beside a derived figure`)
    }
    /* AND THE DERIVED HALF IS REALLY THERE. Cutting a quote and leaving no
       number is the other way to fail this. */
    assert(/`selected` is L [\d.]+ against a [\d.]+ card in light, down/.test(md),
      'and states the selected row\'s own signed step, derived')
    assert(/[\d.]+:1 on a recessed band in light/.test(md),
      'and measures the outline on the recessed ground, which is where it fails')
  }
}

/* ── THE TWO CHART CONSTANTS NOTHING WAS READING ──
 *
 * Both turned out to be past EVIDENCE rather than live constants: 9.72 and
 * 2.28 are the figures from before each repair, and both mechanisms are in
 * place. Measured on the shipped Charts surface: the worst tick sits 1.22px
 * from its gridline over five ticks, a 1.00px spread, under the whole pixel
 * any repair would need. The clearance reads 28px to the ink.
 *
 * What was missing is the CHECK. Remove the negative margin and the ends go
 * back to half a line out, in silence. Proven by injection in the browser: 0
 * findings clean, 22 with the margin removed, the first at -9.94px.
 */
{
  line('\n- the chart constants nothing was reading -')
  const { CHECKS: CH2 } = await import('../src/emit/checks.js')
  const tick = CH2.find(c => c.id === 'a-tick-label-centres-on-its-gridline')
  assert(!!tick && tick.where === 'render',
    `the tick check ships and runs in a browser (${tick?.where})`)
  const text = (tick?.body || []).join('\n')
  /* THE PERIOD MAY BE A PERCENTAGE, and reading the last pixel stop takes the
     1px LINE for the gap between two. That invents 227 gridlines a pixel
     apart, every tick lands on one, and the run reports clean. */
  assert(/px\|%/.test(text),
    'it reads the gradient period as a percentage as well as a length')
  assert(/p < 4/.test(text),
    'and rejects a one-pixel period, which is the line itself rather than a gap')
  assert(/lines\.reverse\(\)/.test(text),
    'the gradient runs bottom up and the labels top down, so one of them is reversed')
  assert(/backgroundImage/.test(text) && !/querySelectorAll\(.[^)]*line/.test(text),
    'it asks what PAINTS the gridlines, because a repeating gradient has no child elements')
  assert(/labels\.length < 3/.test(text),
    'two ticks have nothing to drift, so the fault needs three')
  assert(/!measured/.test(text),
    'and a run that measured no tick column says so rather than passing')

  /* THE STYLESHEET SIDE: both halves of the mechanism, derived from the type
     tokens rather than typed. A figure typed here is the thing that drifts. */
  {
    const css = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    const col = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .find(b => /\.chart-ticks\s*\{/.test(b[0]) && /margin-block/.test(b[2]))
    assert(!!col, 'the tick column states a block margin')
    assert(/\/\s*-2\s*\)/.test(col ? col[2] : ''),
      'and it is half a line, negative, so the column reaches past both plot edges')
    assert(/font-caption-leading/.test(col ? col[2] : ''),
      'derived from the caption leading, so a type-scale change carries')
    const pad = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .find(b => /:has\(\.chart-ticks\)/.test(b[1]) && /padding-block/.test(b[2]))
    assert(!!pad, 'and the chart absorbs that overhang in its own block padding')
    assert(/:has\(/.test(pad ? pad[1] : ''),
      'only where a tick column exists, because a chart without one has no overhang')
  }
}

line(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
process.exit(failures ? 1 : 0)
