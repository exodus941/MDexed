/* Pipeline regression test: derivation, macros, spec conformance, round trip.
   Run with `npm test`. No framework — plain assertions over the pure layer,
   which is where the correctness risk actually lives. */
import { load as yamlLoad } from 'js-yaml'
import { createInitialState, CONTRAST_PAIRS } from '../src/state/schema.js'
import { derive, buildCssVars } from '../src/state/derive.js'
import { check } from '../src/color/contrast.js'
import { generateFile, validate } from '../src/emit/designmd.js'
import { parseFile } from '../src/emit/parse.js'

const line = s => console.log(s)
let failures = 0
const assert = (cond, msg) => { if (!cond) { failures++; line(`  FAIL  ${msg}`) } else line(`  ok    ${msg}`) }

const state = createInitialState()
const derived = derive(state)

line('\n- derivation -')
assert(Object.keys(derived.ramps).length === 5, '5 ramps built')
assert(/^#[0-9a-f]{6}$/i.test(derived.ramps.accent.steps[500]), `accent.500 is a hex (${derived.ramps.accent.steps[500]})`)
assert(derived.ramps.accent.anchor != null, `seed anchored at step ${derived.ramps.accent.anchor}`)
assert(Object.keys(derived.roles.light).length === 27, `27 light roles (got ${Object.keys(derived.roles.light).length})`)
assert(derived.roles.light.bg !== derived.roles.dark.bg, 'light and dark bg differ')
assert(derived.elevation.raised.includes('rgba'), 'raised shadow is tinted rgba')
assert(derived.elevation.flat === 'none', 'flat elevation is none')

line('\n- macros -')
const dense = derive({ ...state, macros: { ...state.macros, density: 2 } })
assert(dense.spacing.find(s => s.name === 'md').value === '32px', `density 2 doubles md spacing (${dense.spacing.find(s => s.name === 'md').value})`)
const round = derive({ ...state, macros: { ...state.macros, roundness: 2 } })
assert(round.rounded.find(r => r.name === 'full').value === '9999px', 'pill radius is not scaled')
assert(round.rounded.find(r => r.name === 'md').value === '16px', 'md radius doubles')
const locked = derive({ ...state, macros: { ...state.macros, density: 2 }, spacing: state.spacing.map(s => s.name === 'md' ? { ...s, locked: true } : s) })
assert(locked.spacing.find(s => s.name === 'md').value === '16px', 'locked token ignores its macro')
const scaled = derive({ ...state, macros: { ...state.macros, scale: 1.5 } })
assert(scaled.typography.find(t => t.name === 'h1').fontSize === '72px', `scale 1.5 lifts h1 to 72px (${scaled.typography.find(t => t.name === 'h1').fontSize})`)

line('\n- emit -')
const { text, omitted, dropped } = generateFile(state, derived)
assert(text.startsWith('---\n'), 'opens with frontmatter')
assert(text.includes('name: My Design System'), 'carries the name')
assert(omitted.includes('Overview'), 'empty Overview is declared omitted')
assert(dropped.length === 0, 'no component properties dropped')
assert(text.includes('## Elevation & Depth'), 'has the Elevation section')
assert(text.includes('## Motion'), 'has the Motion section')
assert(/\| `bg` \|/.test(text), 'role table rendered')

line('\n- spec conformance -')
const v = validate(text)
v.errors.forEach(e => line(`  ERROR ${e}`))
v.warnings.forEach(w => line(`  warn  ${w}`))
assert(v.ok, 'validates against the spec')

line('\n- illegal component property -')
const withBad = { ...state, components: [{ id: 'c1', name: 'card', properties: [
  { id: 'p1', key: 'backgroundColor', value: '{colors.surface}' },
  { id: 'p2', key: 'boxShadow', value: '{elevation.raised}' },
] }] }
const bad = generateFile(withBad, derive(withBad))
assert(bad.dropped.length === 1 && bad.dropped[0].key === 'boxShadow', 'boxShadow is kept out of the frontmatter')
assert(bad.text.includes('prose only'), 'boxShadow still reaches the file, as prose')
assert(validate(bad.text).ok, 'file with an illegal property still validates')

line('\n- round trip -')
const rt = parseFile(text)
assert(rt.ok, `import succeeded${rt.error ? ` (${rt.error})` : ''}`)
rt.warnings.forEach(w => line(`  warn  ${w}`))
assert(generateFile(rt.state, derive(rt.state)).text === text, 'export, import, export is byte-identical')

line('\n- authored prose survives -')
const authored = { ...state, prose: { ...state.prose, colors: 'Warm neutrals with one rust accent.' } }
const authoredText = generateFile(authored, derive(authored)).text
const reimported = parseFile(authoredText)
assert(reimported.ok, 'authored file imports')
assert(reimported.state.prose.colors === 'Warm neutrals with one rust accent.',
  `generated tables are stripped from prose on import (got ${JSON.stringify(reimported.state.prose.colors?.slice(0, 60))})`)

line('\n- preview fidelity -')
/* The preview is only trustworthy if the variables driving it are the same
   values the file exports. Checked here rather than in the browser, because
   this is the invariant — the rendering is downstream of it. */
const fmYaml = yamlLoad(/^---\n([\s\S]*?)\n---/.exec(text)[1])
const lightVars = buildCssVars(derived, 'light')
const darkVars = buildCssVars(derived, 'dark')
assert(lightVars['--c-bg'] === fmYaml.colors.bg, `--c-bg matches colors.bg (${lightVars['--c-bg']} / ${fmYaml.colors.bg})`)
assert(lightVars['--c-accent'] === fmYaml.colors.accent, '--c-accent matches colors.accent')
assert(lightVars['--c-surface-raised'] === fmYaml.colors['surface-raised'], '--c-surface-raised matches colors.surface-raised')
assert(darkVars['--c-bg'] === fmYaml.colors['dark-bg'], '--c-bg in dark mode matches colors.dark-bg')
assert(lightVars['--space-md'] === fmYaml.spacing.md, `--space-md matches spacing.md (${lightVars['--space-md']})`)
assert(lightVars['--radius-lg'] === fmYaml.rounded.lg, '--radius-lg matches rounded.lg')
assert(lightVars['--font-h1-size'] === fmYaml.typography.h1.fontSize, '--font-h1-size matches typography.h1.fontSize')
const denseVars = buildCssVars(derive({ ...state, macros: { ...state.macros, density: 1.5 } }), 'light')
assert(denseVars['--space-md'] === '24px', `macro flows through to the preview vars (${denseVars['--space-md']})`)

line('\n- default palette passes its own checks -')
/* A starting system that fails the accessibility check it ships with is a bad
   starting system. Guards against role remapping quietly regressing. */
for (const mode of ['light', 'dark']) {
  const fails = CONTRAST_PAIRS.map(p => {
    const r = check(derived.roles[mode][p.fg], derived.roles[mode][p.bg])
    return (p.ui ? r.ratio < 3 : !r.pass) ? `${p.label} ${r.ratio}:1` : null
  }).filter(Boolean)
  assert(fails.length === 0, `${mode} mode: ${fails.length ? fails.join(' | ') : 'all pairs pass'}`)
}

line('\n- contrast surfacing -')
const okPair = check(derived.roles.light.text, derived.roles.light.bg)
assert(okPair.pass, `default body text passes (${okPair.ratio}:1, Lc ${okPair.lc})`)
const lowContrast = derive({
  ...state,
  color: { ...state.color, roleOverrides: { 'text:light': '#d0d0d0', 'bg:light': '#d4d4d4' } },
})
const badPair = check(lowContrast.roles.light.text, lowContrast.roles.light.bg)
assert(!badPair.pass && badPair.label === 'Fail', `a deliberately broken pair reports Fail (${badPair.ratio}:1)`)
assert(Math.abs(badPair.lc) < 15, `and a near-zero APCA Lc (${badPair.lc})`)

line('\n- malformed input -')
const broken = parseFile('---\nname: [unclosed\n---\n\n## Overview\nhi')
assert(!broken.ok && broken.state === null, 'malformed YAML refuses to load rather than wiping state')
assert(/line \d+/.test(broken.error), `error names a line (${broken.error})`)
assert(!parseFile('# just a readme\n\nnothing here').ok, 'a file with no frontmatter is rejected')

line(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
process.exit(failures ? 1 : 0)
