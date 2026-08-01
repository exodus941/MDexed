/* Pipeline regression test: derivation, macros, spec conformance, round trip.
   Run with `npm test`. No framework — plain assertions over the pure layer,
   which is where the correctness risk actually lives. */
import { load as yamlLoad } from 'js-yaml'
import { createInitialState, CONTRAST_PAIRS } from '../src/state/schema.js'
import { derive, buildCssVars } from '../src/state/derive.js'
import { migrate } from '../src/state/migrate.js'
import { applyPreset, PRESETS } from '../src/state/presets.js'
import { check } from '../src/color/contrast.js'
import { TYPE_ROLES } from '../src/type/scale.js'
import { generateFile, validate } from '../src/emit/designmd.js'
import { parseFile } from '../src/emit/parse.js'
import { diffWords, diffStats } from '../src/ai/diff.js'
import { contextFor, refinePrompt, draftPrompt, systemPrompt } from '../src/ai/prompts.js'
import { PROSE_SECTIONS } from '../src/state/schema.js'

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
assert(Object.keys(derived.roles.light).length === 27, `27 light roles (got ${Object.keys(derived.roles.light).length})`)
assert(derived.roles.light.bg !== derived.roles.dark.bg, 'light and dark bg differ')

line('\n- generated scales -')
assert(derived.typography.length === TYPE_ROLES.length, `${TYPE_ROLES.length} type tokens generated`)
assert(ty(derived.typography, 'h1').fontSize === '48.8px', `h1 from the modular scale (${ty(derived.typography, 'h1').fontSize})`)
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
assert(px(round2.rounded, 'md') === '16px', 'md radius doubles')
assert(ty(derive({ ...state, macros: { ...state.macros, scale: 1.5 } }).typography, 'h1').fontSize === '73.2px',
  `scale 1.5 lifts h1 (${ty(derive({ ...state, macros: { ...state.macros, scale: 1.5 } }).typography, 'h1').fontSize})`)
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

line('\n- default palette passes its own checks -')
for (const mode of ['light', 'dark']) {
  const fails = CONTRAST_PAIRS.map(p => {
    const r = check(derived.roles[mode][p.fg], derived.roles[mode][p.bg])
    return (p.ui ? r.ratio < 3 : !r.pass) ? `${p.label} ${r.ratio}:1` : null
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
  const longest = Math.max(...PROSE_SECTIONS.map(s => draftPrompt(s, state, derived).length + systemPrompt().length))
  assert(longest < 24_000, `the largest prompt stays under the server cap (${longest} chars)`)
}

line(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
process.exit(failures ? 1 : 0)
