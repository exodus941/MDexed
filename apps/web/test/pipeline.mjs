/* Pipeline regression test: derivation, macros, spec conformance, round trip.
   Run with `npm test`. No framework — plain assertions over the pure layer,
   which is where the correctness risk actually lives. */
import fs from 'node:fs'
import { load as yamlLoad } from 'js-yaml'
import { createInitialState, CONTRAST_PAIRS, ANTI_PATTERNS, pairFails } from '../src/state/schema.js'
import { derive, buildCssVars } from '../src/state/derive.js'
import { migrate } from '../src/state/migrate.js'
import { applyPreset, PRESETS } from '../src/state/presets.js'
import { TAB_STYLES } from '../src/state/components.js'
import { audit } from '../src/a11y/audit.js'
import { check } from '../src/color/contrast.js'
import { TYPE_ROLES } from '../src/type/scale.js'
import { generateFile, validate } from '../src/emit/designmd.js'
import { parseFile } from '../src/emit/parse.js'
import { collectComponents } from '../src/emit/yaml.js'
import { agentContract, CONTRACT_MAX_LINES, CONTRACT_MAX_BYTES } from '../src/emit/agents.js'
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
assert(Object.keys(derived.roles.light).length === 28, `28 light roles (got ${Object.keys(derived.roles.light).length})`)
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
    const code = fs.readFileSync(f, 'utf8')
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
      const lines = text.split('\n').length
      const bytes = Buffer.byteLength(text, 'utf8')
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
  const doc = ({ casing, themeToggle }) => {
    const s = createInitialState()
    if (casing) s.voice = { ...s.voice, casing }
    s.build = { ...s.build, themeToggle }
    return generateFile(s, derive(s)).text
  }
  const sentence = doc({ casing: 'sentence', themeToggle: false })
  const title    = doc({ casing: 'title',    themeToggle: false })
  const toggled  = doc({ casing: 'sentence', themeToggle: true  })

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

  /* A light-only system must forbid a toggle rather than describe one, however
     the preference is set. Otherwise an agent invents a dark palette to fill
     the control, which is the worst outcome of the three. */
  const s = createInitialState()
  s.color.emitDark = false
  s.build = { themeToggle: true }
  const lightOnly = generateFile(s, derive(s)).text
  assert(/ships one theme/.test(lightOnly) && !/Build a \*\*theme toggle\*\*/.test(lightOnly),
    'a light-only system forbids a toggle even when the preference asks for one')

  /* And an older document without the field takes the defaults rather than
     emitting "no capitalisation stated", which is the gap this closed. */
  const bare = createInitialState()
  delete bare.build
  assert(/Capitalise every UI label/.test(generateFile(bare, derive(bare)).text),
    'a document with no build preferences still states a capitalisation')
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

  /* Every alias must equal the dark block's value for the same role, or the
     name is worse than absent — it resolves, and to the wrong colour. */
  const wrong = aliases.filter(a => darkBlock[a.replace('--c-dark-', '--c-')] !== root[a])
  assert(wrong.length === 0,
    `every dark alias carries the dark value${wrong.length ? ` — ${wrong.slice(0, 3).join(', ')}` : ` (${aliases.length})`}`)

  /* One alias per role, not one per role plus the ones we forgot. */
  const roles = Object.keys(darkBlock).filter(k => !k.startsWith('--c-dark-'))
  assert(aliases.length === roles.length,
    `one alias per role (${aliases.length} aliases, ${roles.length} roles)`)
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
  const total = audit(fresh, derive(fresh)).length
  assert(total === 0, `the shipped default reports nothing at all (${total})`)

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
    ['a checkbox draws at 16 and is hit at its label', ['hit at its label']],
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
    ['the rest pack in priority order', ['packs onto the lines below']],
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
    ['an empty state is three states', ['three states, never one']],
    ['no results offers a way back, never forward', ['a way back', 'never a way forward']],
    ['an empty state is centred, not stretched', ['not `stretch`']],
    ['a comparison keeps its columns and stacks', ['read across, so it keeps its columns']],
    ['a comparison never scrolls sideways', ['never scrolls sideways']],
    ['a comparison puts every row on one grid', ['every row of a comparison on **one** grid']],
    ['a recommendation is marked by its edge', ['never by a fill']],
    ['a marked column is one unbroken edge', ['stop against it rather than crossing it']],
    ['a painting table has no column gap', ['no column gap at all']],
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

line(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
process.exit(failures ? 1 : 0)
