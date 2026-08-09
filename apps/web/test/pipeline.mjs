/* Pipeline regression test: derivation, macros, spec conformance, round trip.
   Run with `npm test`. No framework — plain assertions over the pure layer,
   which is where the correctness risk actually lives. */
import fs from 'node:fs'
import { load as yamlLoad } from 'js-yaml'
import { createInitialState, CONTRAST_PAIRS, ANTI_PATTERNS } from '../src/state/schema.js'
import { derive, buildCssVars } from '../src/state/derive.js'
import { migrate } from '../src/state/migrate.js'
import { applyPreset, PRESETS } from '../src/state/presets.js'
import { audit } from '../src/a11y/audit.js'
import { check } from '../src/color/contrast.js'
import { TYPE_ROLES } from '../src/type/scale.js'
import { generateFile, validate } from '../src/emit/designmd.js'
import { parseFile } from '../src/emit/parse.js'
import { agentContract, CONTRACT_MAX_LINES, CONTRACT_MAX_BYTES } from '../src/emit/agents.js'
import { payloadTextFiles, REQUIRED_FILES } from '../src/emit/payload.js'
import { serializeProject, parseProject, projectFilename } from '../src/emit/project.js'
import { diffWords, diffStats } from '../src/ai/diff.js'
import { contextFor, refinePrompt, draftPrompt, systemPrompt } from '../src/ai/prompts.js'
import { PROSE_SECTIONS } from '../src/state/schema.js'
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
    const used = new Set(
      [...code.matchAll(/[={,(]\s*(?:\.\.\.)?\s*([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g)].map(m => m[1]),
    )
    for (const name of used) {
      if (GLOBAL.has(name)) continue
      /* Any assignment counts as a declaration, not just `const NAME`. A
         single `const A = 1, B = 2` declares B without the keyword touching
         it, and a name that is merely *used* never appears to the left of an
         `=`. Also covers `function NAME`. */
      const declared = new RegExp(`\\b${name}\\s*=[^=]`).test(code)
        || new RegExp(`function\\s+${name}\\b`).test(code)
      const imported = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(code)
      if (!declared && !imported) missing.push(`${f.pathname.split('/src/')[1]}: ${name}`)
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
  const promised = [...new Set(named)].filter(f => !f.startsWith('html-examples'))
  const broken = promised.filter(f => !files[f])
  assert(broken.length === 0, `README names only files the payload ships${broken.length ? ` — ${broken.join(', ')}` : ''}`)

  assert(files['README.md'].includes('AGENTS.md'), 'README points agents at the contract')
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
    ['a responsive rule is checked at both widths', ['at **both** widths']],
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
