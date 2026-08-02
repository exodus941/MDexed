/* Pipeline regression test: derivation, macros, spec conformance, round trip.
   Run with `npm test`. No framework — plain assertions over the pure layer,
   which is where the correctness risk actually lives. */
import fs from 'node:fs'
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
/* theme.js re-exports a `?raw` import, which is a Vite feature Node cannot
   resolve, so the chrome stylesheet is read from disk instead. */
const APP_CSS = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8')

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
}

line(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
process.exit(failures ? 1 : 0)
