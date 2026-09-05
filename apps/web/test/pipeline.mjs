/* Pipeline regression test: derivation, macros, spec conformance, round trip.
   Run with `npm test`. No framework — plain assertions over the pure layer,
   which is where the correctness risk actually lives. */
import fs from 'node:fs'
import { load as yamlLoad } from 'js-yaml'
import { createInitialState, CONTRAST_PAIRS, ANTI_PATTERNS, pairFails } from '../src/state/schema.js'
import { derive, buildCssVars, Z_LAYERS } from '../src/state/derive.js'
import { migrate } from '../src/state/migrate.js'
import { isOnTypeGrid, isOnSpaceGrid } from '../src/state/grid.js'
import { applyPreset, PRESETS } from '../src/state/presets.js'
import { TAB_STYLES } from '../src/state/components.js'
import { audit, chooseFix } from '../src/a11y/audit.js'
import { toOklchObj, parseColor as parseColorFor } from '../src/color/convert.js'
import { check } from '../src/color/contrast.js'
import { TYPE_ROLES } from '../src/type/scale.js'
import { generateFile, validate } from '../src/emit/designmd.js'
import { parseFile } from '../src/emit/parse.js'
import { collectComponents } from '../src/emit/yaml.js'
import { tokensCss } from '../src/emit/tokens.js'
import { agentContract, checklistBytes, checklistLines, CONTRACT_MAX_LINES, CONTRACT_MAX_BYTES } from '../src/emit/agents.js'
import { payloadTextFiles, REQUIRED_FILES, EXAMPLE_PREFIX, HTML_EXAMPLES_MODES, exampleFilename } from '../src/emit/payload.js'
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
   * fix above is a blindfold rather than a repair. */
  {
    const flatDoc = createInitialState()
    flatDoc.color.roles.warning.light = 'warning.700'
    flatDoc.color.roles.warning.dark = 'warning.400'
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
  assert(/\.icon-end\s*\{[^}]*margin-left/.test(css), 'a trailing icon is marked in the markup and spaced by class')
  assert(/\.btn \.icon \{[^}]*margin-right/.test(css), 'a leading icon is the default and gets its gap after it')

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
    ['a card action stands clear of the body', ['the action row stands further from the body']],
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
      assert(l.includes(`${i.pct}%`), `${sep}/${i.id}: the prompt states the percentage`)
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
    'an unruled set draws the bar with an inset shadow, which costs no element')
  assert(ruled.boxShadow === undefined,
    'a RULED set publishes no shadow, or a builder taking it reproduces the fault')
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
  const { buildDataviz, categorical, worstPair, withoutRedGreen, NEIGHBOUR_FLOOR, CATEGORICAL_COUNT, LIGHTNESS_LEVELS }
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

  /* FOUR LIGHTNESS LEVELS, and the reason is measured. Two levels took the
     worst pair without red-green to 0.003, which is the same colour twice. */
  assert(LIGHTNESS_LEVELS.length === 4, `four lightness levels (${LIGHTNESS_LEVELS.length})`)
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
  assert((css.match(/--chart-[a-z0-9-]+\s*:/g) || []).length === 26,
    `all 26 chart tokens reach tokens.css (${(css.match(/--chart-[a-z0-9-]+\s*:/g) || []).length})`)
  const json = JSON.parse(files['tokens.json'])
  assert(Object.keys(json.color?.chart?.categorical ?? {}).length === CATEGORICAL_COUNT,
    'the categorical scale reaches tokens.json')
  assert(json.color.chart.categorical['1'].$type === 'color', 'and carries a DTCG type')

  const md = files['DESIGN.md']
  assert(/### Charts/.test(md), 'DESIGN.md carries the Charts section')
  assert(md.includes(dv.worst.distance.toFixed(3)), 'and states the measured worst pair')
  assert(md.includes(dv.worstWithoutRedGreen.toFixed(3)),
    'and states the limit without red-green rather than claiming safety')
  assert(md.includes(dv.categorical[0]), 'and lists the actual colours')
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

line(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
process.exit(failures ? 1 : 0)
