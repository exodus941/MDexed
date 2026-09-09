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

/* ── TWO THINGS ARE EXEMPT, AND ONLY TWO ──
 *
 * The two assertions above say every step is on its grid. Neither says how
 * many ways there are to be off it, and that is the half the rule is about.
 * An exemption is how a snapping rule stops applying, so an unbounded set of
 * them is the rule not existing.
 *
 * THE FIRST DRAFT REPORTED FOUR CORRECT SHAPES, and the fault was the probe.
 * It scanned the emitted CSS text and classified by a keyword in the token
 * NAME, which is a tag list. It called a 9999px pill radius, a 3px shadow
 * blur and a 14px mark off-grid. A radius of "as round as it goes" answers to
 * no grid, a blur is a weight the way an icon stroke is, and 14 is on the TYPE
 * grid, which that classifier never asked. So this reads the DERIVED sets,
 * where the pill carries its own flag and each value knows which scale it
 * came from.
 *
 * THE EXEMPTIONS ARE DECLARATIONS, NOT A LIST OF NAMES:
 *
 *   a clamp middle term    the syntax says so. It is the slope of a line
 *                          joining two endpoints, and BOTH endpoints are
 *                          snapped. Fluid type is off by default, so this is
 *                          measured with it on or the shape has no candidate.
 *   a control line-height  the stylesheet says so, as a calc off that
 *                          control's own height token minus its borders.
 *
 * The pill is neither. It carries `pill: true` on the derived object, so it is
 * excluded by a property rather than let through by an exemption.
 *
 * Measured over 8 documents and both macro extremes: 80 space values, 102
 * bare sizes, 10 clamps, and the only off-grid pixels are the 10 middle
 * terms. In the preview stylesheet: 7 px line-heights, every one a calc off a
 * height token, and 0 bare literals. */
{
  const clampArgs = v => {
    const open = v.indexOf('clamp(')
    if (open < 0) return null
    let depth = 0, start = open + 6
    const out = []
    for (let i = start; i < v.length; i++) {
      const c = v[i]
      if (c === '(') depth++
      else if (c === ')') { if (depth === 0) { out.push(v.slice(start, i)); break } depth-- }
      else if (c === ',' && depth === 0) { out.push(v.slice(start, i)); start = i + 1 }
    }
    return out.length === 3 ? out.map(s => s.trim()) : null
  }

  const fluid = { ...state, type: { ...state.type, fluid: { ...state.type.fluid, enabled: true } } }
  const runs = [['default', state], ['fluid', fluid],
    ['dense', { ...state, macros: { ...state.macros, density: 0.93 } }],
    ['scaled', { ...state, macros: { ...state.macros, scale: 1.5 } }]]
  for (const p of PRESETS) runs.push([p.id, applyPreset(p.id, createInitialState())])

  const shapes = new Map()
  const seen = (kind, where) => {
    if (!shapes.has(kind)) shapes.set(kind, [])
    shapes.get(kind).push(where)
  }
  let onGrid = 0, clamps = 0
  for (const [id, st] of runs) {
    const d = derive(st)
    for (const t of d.typography) {
      const args = clampArgs(String(t.fontSize))
      if (args) {
        clamps++
        for (const [i, a] of args.entries()) {
          for (const m of a.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
            if (i === 1) { seen('a clamp middle term', `${id} ${t.name} ${m[0]}`); continue }
            if (isOnTypeGrid(Number(m[1]))) { onGrid++; continue }
            seen('OFF GRID: a clamp endpoint', `${id} ${t.name} ${m[0]}`)
          }
        }
        continue
      }
      if (isOnTypeGrid(parseFloat(t.fontSize))) { onGrid++; continue }
      seen('OFF GRID: a type size', `${id} ${t.name}=${t.fontSize}`)
    }
    for (const s of [...d.spacing, ...d.rounded]) {
      if (s.pill) { seen('the pill sentinel, excluded by its own flag', `${id} ${s.name}`); continue }
      if (isOnSpaceGrid(parseFloat(s.value))) { onGrid++; continue }
      seen('OFF GRID: a space or radius step', `${id} ${s.name}=${s.value}`)
    }
  }
  assert(clamps > 0, `the clamp shape has candidates, with fluid type on (${clamps})`)
  const off = [...shapes.keys()].filter(k => k.startsWith('OFF GRID'))
  assert(off.length === 0, off.length
    ? `a value is off its grid — ${off.map(k => k + ': ' + shapes.get(k)[0]).slice(0, 3).join('; ')}`
    : `${onGrid} derived value(s) on their grid over ${runs.length} document(s), and the only off-grid pixels are the ${shapes.get('a clamp middle term')?.length ?? 0} clamp middle term(s)`)
  const kinds = [...shapes.keys()].sort()
  assert(kinds.length === 2 && kinds.join(' | ') === 'a clamp middle term | the pill sentinel, excluded by its own flag',
    `exactly two shapes leave the grid, and one of them is a flag rather than an exemption (${kinds.join(' | ')})`)

  /* ── THE SECOND EXEMPTION LIVES IN THE STYLESHEET, SO IT IS READ THERE ──
   *
   * No emitted token carries a px line-height. A leading is a ratio, and the
   * content-box value belongs to one control's own height.
   *
   * SCOPED TO THE PREVIEW. The app chrome is a separate class set with its own
   * tokens and it types six of these as literals: 38px on a 40px control, 42
   * on 44, and 18px beside an 8px padding with a 1px edge. Each is the content
   * box computed by hand. A rule wider than its problem is a bigger bug than
   * the problem, and the grid rule is about what this system PUBLISHES. */
  const sheets = ['../src/preview/preview.css', '../src/preview/responsive.rules.css']
  const bare = [], derivedFrom = []
  for (const rel of sheets) {
    const css = fs.readFileSync(new URL(rel, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    for (const m of css.matchAll(/line-height\s*:\s*([^;}]+)/g)) {
      const v = m[1].trim()
      if (!/px/.test(v)) continue
      const line = css.slice(0, m.index).split('\n').length
      /* ── ASK WHETHER IT IS DERIVED, NOT WHICH ARITHMETIC IT USED ──
         The first matcher demanded `calc(var(--h) - Npx)` and reported two
         correct shapes. A box with no borders states its own size token, so
         the content box IS the height: `var(--cmp-avatar-size, 32px)`. And a
         fractional line box is repaired by rounding the RATIO to a whole even
         pixel: `round(1.56em, 2px)`. Both derive the value. The fault is a
         typed number, which is what stops tracking its control. */
      if (/var\(--[\w-]+/.test(v) || /\dem\b/.test(v)) derivedFrom.push(v)
      else bare.push(rel.split('/').pop() + ':' + line + ' ' + v)
    }
  }
  assert(derivedFrom.length > 0, `the control line-height shape has candidates (${derivedFrom.length})`)
  assert(bare.length === 0, bare.length
    ? `a px line-height is typed rather than derived from its control's height — ${bare.slice(0, 3).join('; ')}`
    : `every px line-height in the preview is derived from a height token or a ratio, never typed (${derivedFrom.length})`)

  /* AND BOTH EXEMPTIONS FIRE ON THE SHAPE THEY LET THROUGH. Without this the
     two assertions above pass on a codebase that snaps everything, which
     proves nothing about the exemptions. */
  const proofs = [
    ['a clamp endpoint off the grid', !isOnTypeGrid(parseFloat('13.22px'))],
    ['a space step off the grid', !isOnSpaceGrid(13)],
    ['a bare px line-height', !(/var\(--[\w-]+/.test('38px') || /\dem\b/.test('38px'))],
    ['a subtraction from a typed number', !(/var\(--[\w-]+/.test('calc(40px - 2px)') || /\dem\b/.test('calc(40px - 2px)'))],
    ['and the two derived forms are let through',
      /var\(--[\w-]+/.test('calc(var(--cmp-button-md-height, 36px) - 2px)') && /\dem\b/.test('round(1.56em, 2px)')],
  ]
  const caught = proofs.filter(([, fires]) => fires)
  assert(caught.length === proofs.length,
    `each gate rejects the shape it was written for (${caught.length} of ${proofs.length}: `
    + proofs.filter(([, f]) => !f).map(([w]) => w).join(', ') + ')')
}

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

/* ── MEASURE A ROLE ON ITS WORST GROUND, NEVER ITS BEST ──
 *
 * This project has paid for the same mistake twice. `text-subtle` was measured
 * on `surface`, the one surface it clears, so the curated table reported the
 * healthiest case in the set as though it covered the role. `border` was
 * measured on `surface` too, where it reads highest at 3.60 to 4.16, and it
 * reads 2.42 to 2.81 on a recessed band. A pair list that names the healthy
 * case and stops is a report that the role is fine.
 *
 * The repair was two exhaustive sweeps, and nothing asserted they are
 * exhaustive. A ground quietly dropped from either loop puts the check back in
 * the state that cost both incidents, and the run stays green.
 *
 * SO INJECT A COLLISION ON EVERY GROUND IN TURN. A role set to the same ramp
 * ref as the fill behind it is exactly 1.00:1, which no bar tolerates. Both
 * sweeps carry the ground in the finding id, so the assertion names the pair
 * rather than counting findings.
 *
 * THE ROLE OBJECTS ARE READ DIRECTLY, not derived from an edited document. A
 * ramp rebuild would move both halves of the pair and the injection would stop
 * being the state it claims to be.
 *
 * A COMPONENT-LOCAL FOREGROUND IS NOT ASKED. `accent-fg` sits on `accent` by
 * construction, so it has no choice of ground and this question is not about
 * it. Every role below can sit on any surface. */
{
  line('\n- every role against every ground -')
  const { roleSweep, hairlineChecks } = await import('../src/a11y/audit.js')
  const base = derive(createInitialState()).roles
  const LINES = ['border-subtle', 'border', 'border-strong']

  const missed = []
  let asked = 0
  for (const mode of ['light', 'dark']) {
    for (const [roles, group, sweep, prefix] of [
      [TEXT_ROLES, 'text', roleSweep, 'sweep'],
      [LINES, 'line', hairlineChecks, 'hairline'],
    ]) {
      for (const fg of roles) {
        for (const bg of SURFACE_ROLES) {
          asked++
          const hurt = { ...base[mode], [fg]: base[mode][bg] }
          const hits = sweep({ roles: { [mode]: hurt } }, mode)
          if (!hits.some(f => f.id === `${prefix}:${mode}:${fg}:${bg}`)) {
            missed.push(`${group} ${fg} on ${bg} in ${mode}`)
          }
        }
      }
    }
  }
  assert(missed.length === 0, missed.length
    ? `a ground is outside a sweep — ${missed.slice(0, 4).join('; ')} (${missed.length} of ${asked})`
    : `both sweeps reach every ground for every role (${asked} pairs, ${TEXT_ROLES.length} text and ${LINES.length} line roles over ${SURFACE_ROLES.length} grounds, in two modes)`)

  /* ── AND EACH ONE STAYS QUIET WHERE IT PROMISES SOMETHING ──
   *
   * Without this half the loop above proves only that both sweeps report on
   * everything they are shown.
   *
   * THE TWO SWEEPS PROMISE DIFFERENT THINGS, and the first version of this
   * assertion asked them the same question. `hairlineChecks` is a FAIL: a rule
   * within a hair of its own ground paints nothing, and there is no reading of
   * that which is correct. `roleSweep` is a NOTE and a WARN, and it is
   * deliberately outside `audit()` for that reason. A status colour used as a
   * WORD depends on a ramp step the palette cannot move without breaking
   * red-green separation, so the system states that as a limit instead of
   * guaranteeing it. Six such combinations report on the shipped default and
   * every one is the stated limit.
   *
   * So the bar is: no hairline finding at all, and no role sweep finding
   * outside the meaning roles. `text` and `text-muted` are the ones the table
   * guarantees, and a finding on either is a real fault. */
  const MEANING = ['accent', 'success', 'warning', 'danger']
  const hair = [], promised = [], stated = []
  for (const mode of ['light', 'dark']) {
    for (const f of hairlineChecks({ roles: base }, mode)) hair.push(mode + ' ' + f.id)
    for (const f of roleSweep({ roles: base }, mode)) {
      (MEANING.includes(f.entry) ? stated : promised).push(f.id + ' ' + f.measured)
    }
  }
  assert(hair.length === 0, hair.length
    ? `a hairline is invisible on the shipped default — ${hair.slice(0, 3).join('; ')}`
    : 'no line on the shipped default is within a hair of its own ground')
  assert(promised.length === 0, promised.length
    ? `a guaranteed text role falls short on the shipped default — ${promised.slice(0, 3).join('; ')}`
    : `every guaranteed text role clears AA on every ground, and the ${stated.length} report(s) are all meaning roles used as words, which the system states as a limit`)

  /* ── THE CURATED LIST IS A GUARANTEE, SO IT NAMES THE WORST CASE ──
   *
   * The sweeps report what fails. The pair table PROMISES what holds, and a
   * promise about a role's best ground is the shape of both incidents above.
   * Measured over the default and six presets, in both modes: the worst ground
   * for `text` and `text-muted` is `bg-subtle` in light and `surface-raised`
   * in dark. Only one of those two was listed for either role.
   *
   * A row may still be missing on purpose, and then it says so with `exempt`
   * and a reason beside it, the way the disabled pair and the recessed outline
   * do. What this refuses is an ABSENT row, which reads as a role nobody
   * needed to check. */
  const gaps = []
  for (const role of ['text', 'text-muted']) {
    const listed = new Set(CONTRAST_PAIRS.filter(p => p.fg === role).map(p => p.bg))
    for (const preset of [null, ...PRESETS.map(p => p.id)]) {
      const d = derive(preset ? applyPreset(preset, createInitialState()) : createInitialState())
      for (const mode of ['light', 'dark']) {
        let worst = null
        for (const bg of SURFACE_ROLES) {
          const r = check(d.roles[mode][role], d.roles[mode][bg]).ratio
          if (!worst || r < worst.r) worst = { bg, r }
        }
        if (!listed.has(worst.bg)) {
          gaps.push(`${role} on ${worst.bg} at ${worst.r}:1 (${preset ?? 'default'}/${mode})`)
        }
      }
    }
  }
  /* SAY HOW MANY WERE LEFT OUT. Both rows were missing and this message showed
     four examples, all of them the same one, so adding that row alone read as
     the whole repair. The second only appeared on the next run. */
  const distinct = [...new Set(gaps.map(g => g.replace(/ \(.*$/, '')))]
  assert(gaps.length === 0, gaps.length
    ? `the pair table skips a role's worst ground, ${distinct.length} distinct — ${distinct.slice(0, 4).join('; ')}`
      + (distinct.length > 4 ? ` and ${distinct.length - 4} more not listed` : '')
    : 'the pair table names the worst ground for every general text role, in both modes and every preset')
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

  /* ── A NAV NEVER WRAPS, AND IT NEVER SCROLLS EITHER ──
   *
   * `.row` wraps at narrow container widths and a nav is a `.row`. Four tabs
   * in a 248px pane folded to two rows, 92px tall, with the pill on row two
   * reading as a different thing. So `nowrap` stays.
   *
   * THESE TWO ASSERTIONS USED TO PIN THE WITHDRAWN ANSWER. They demanded
   * `overflow-x: auto` and a hidden scrollbar, which their correction of
   * 8 September 2026 replaced: a destination scrolled out of view is a
   * destination nobody visits, and a strip that does not fit becomes a select.
   * The rule beside them said so in every store while the test held the old
   * shape in place. A test written around a defect keeps the defect.
   *
   * Measured before removing the scroller: 8 nav scrollers across 12 surfaces
   * at 296, 320, 480 and 640, and not one had `scrollWidth` past its
   * `clientWidth`. It was inert everywhere. */
  const responsive = fs.readFileSync(new URL('../src/preview/responsive.rules.css', import.meta.url), 'utf8')
  const navRule = (responsive.match(/\.dmd nav\.row \{[^}]*\}/g) || []).join(' ')
  assert(/flex-wrap: nowrap/.test(navRule), 'a nav strip does not wrap')
  assert(!/overflow-x:\s*(auto|scroll)/.test(navRule),
    'and it does not scroll, because a destination out of view is one nobody visits')
  assert(!/\.dmd nav\.row::-webkit-scrollbar/.test(responsive),
    'so there is no bar to hide, and no rule pretending there is')
  /* THE SELECT IS WHAT HANDLES THE WIDTH, and its threshold already ships. */
  assert(/TABS_SENTINEL/.test(fs.readFileSync(new URL('../src/preview/responsive.build.js', import.meta.url), 'utf8')),
    'the strip becomes a select at its own measured threshold instead')
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
    /* A THRESHOLD IS PUBLISHED AS A SUM PLUS A REFERENCE, NEVER AS A CONSTANT.
       The number is true of one heading and one set of controls, so a reader
       who copies it gets a threshold measured against text they do not have.
       The document gives the formula, the reference widths and the arithmetic,
       and none of that was pinned. */
    ['a collapse threshold is a sum, not a constant', ['threshold is a sum', 'worked example']],
    ['and the sum comes with the widths it was measured from', ['threshold = widest item']],
    ['a sum only works on a row with two things in it', ['two things can be added up']],
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

  /* ── THE RULES ABOUT MY OWN INSTRUMENTS, ASSERTED OVER THE INSTRUMENTS ──
   *
   * Auditing all 253 process rules found 20 in this class, each a rule about
   * how a check or a tool must be built. Every one had been written down and
   * none was enforced, so the only thing holding them was whoever last read
   * the file.
   *
   * The population is printed beside every verdict. A condition with nothing
   * to ask prints PASS having asked nothing, which is the failure this whole
   * block exists to prevent elsewhere.
   *
   * TWO OF THE TWENTY DO NOT SHIP, and the reason is the rule about cutting a
   * check you cannot make honest.
   *
   *   `closest()` WITH A LIST. The fault was a SCOPE whose alternatives are
   *   different kinds of box, so wrapping two buttons in a nav changed which
   *   one answered. Measured: 15 uses of closest with a list, 14 of them
   *   boolean exemptions where which member matched cannot matter, and the one
   *   assigned result is `tr, [role=row]`, which is one object spelled twice.
   *   Nothing in the source says two alternatives are different KINDS, so the
   *   exact form gives one finding on correct code.
   *
   *   A RENDER CHECK RECORDING ITS PROOF. A check's comment is not on the
   *   object, so the array cannot be asked. Reading the source for the word
   *   would assert the wording rather than the proof. */
  const bodyOf = c => (c.body || []).join('\n')
  const runnable = CHECKS.filter(c => c.body)
  /* One string of every body, so a shape can be asked of the whole set at
     once and the mutation proof can append a fault to it. */
  const bodiesJoined = runnable.map(bodyOf).join('\n')
  /* ── BLANK THE COMMENTS BEFORE SCANNING FOR A PATTERN ──
   *
   * A comment that QUOTES the broken pattern, to stop the bug recurring, is
   * the thing the scan then finds. It happened the first time this project
   * scanned source for a shape, and it happened again on the very first run of
   * the animation-frame assertion below: the toolkit's own note explaining why
   * it must not wait on a frame.
   *
   * Blanked, never deleted, so a line number still points at the real line. */
  const noComments = s => s
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/./g, ' '))
  const readTool = p => noComments(fs.readFileSync(new URL(p, import.meta.url), 'utf8'))
  const VERIFY_SRC = readTool('../src/emit/verify.js')
  const MATRIX_SRC = readTool('../public/verify-matrix.js')
  /* ── THE TOOLKIT IS A COPY, MASTERED OUTSIDE THIS REPO ──
   *
   * `public/layout-tools.js` is gitignored on purpose: the master lives in
   * `_tools`, and tracking a second copy is how two versions of one file end
   * up disagreeing. So a fresh clone does not have it, and a suite that reads
   * it unconditionally throws before its first assertion.
   *
   * A SILENT SKIP IS THE OTHER FAULT. A run that measured nothing is not a
   * pass, so an absent copy prints its own line rather than quietly reducing
   * the block. Present here, so the conditions below do run. */
  let TOOLKIT_SRC = ''
  try { TOOLKIT_SRC = readTool('../public/layout-tools.js') } catch { TOOLKIT_SRC = '' }
  if (!TOOLKIT_SRC) {
    line('  NOTE  layout-tools.js is not in this checkout, so every toolkit rule below is UNMEASURED.')
    line('        It is mastered in _tools and served as an ignored copy. Copy it in to measure them.')
  }
  assert(runnable.length > 50, `there are bodies to ask about (${runnable.length})`)

  /* getComputedStyle().height NEVER RETURNS auto FOR A RENDERED ELEMENT, so a
     guard written as "only where a height is stated" is a no-op. One read that
     way and exempted every single-line block: 47 candidates, 0 findings, for
     as long as it existed. */
  {
    const bad = runnable.filter(c => /height\s*===?\s*['"]auto['"]/.test(bodyOf(c)))
    assert(bad.length === 0,
      `no body tests a computed height for auto, which is never returned (${bad.map(c => c.id).join(', ') || runnable.length + ' bodies'})`)
  }

  /* ROUND ONCE, AT THE END. Four values rounded separately and then subtracted
     manufacture whole pixels out of tenths: 55 of 143 rows once carried a
     fault invented that way. */
  {
    const bad = runnable.filter(c => /round\([^)]*\)\s*-\s*round\(/.test(bodyOf(c)))
    assert(bad.length === 0,
      `no body subtracts two rounded values (${bad.map(c => c.id).join(', ') || runnable.length + ' bodies'})`)
  }

  /* "ONE ROW" MEANS ONE LEVEL, NOT ANY DEPTH. `:scope > * svg` reads as a mark
     inside a direct child and is a DESCENDANT selector, so it matched marks at
     any depth. 3 real spreads became 68 findings from 32 nested vantage
     points. */
  {
    const bad = runnable.filter(c => /:scope > \*\s+[a-z[.]/.test(bodyOf(c)))
    assert(bad.length === 0,
      `no body writes a descendant where one level was meant (${bad.map(c => c.id).join(', ') || runnable.length + ' bodies'})`)
  }

  /* AND A PRESS CAN DESTROY THE CONTROL, so a check that presses twice looks
     its control up at least as often as it presses it. A held reference is
     detached by the re-render, and a click on it does nothing. */
  {
    const pressers = runnable.filter(c => /\.click\(\)/.test(bodyOf(c)))
    assert(pressers.length > 0, `there is a pressing check to ask about (${pressers.length})`)
    const bad = pressers.filter(c => {
      const t = bodyOf(c)
      const clicks = (t.match(/\.click\(\)/g) || []).length
      const lookups = (t.match(/querySelector|all\(|\.find\(/g) || []).length
      return clicks > 1 && lookups < clicks
    })
    assert(bad.length === 0,
      `a pressing check re-finds its control by selector every time (${bad.map(c => c.id).join(', ') || pressers.length + ' pressers'})`)
  }

  /* AN INSTRUMENT LEFT ON THE PAGE BECOMES ONE OF THE THINGS IT MEASURES. The
     token probe is a bare div painted in the very role being hunted, sitting
     in the body with the page's own cards as siblings. Cached between calls,
     the selection check found it and faulted a correct page. */
  {
    assert(/function paints \(token\)/.test(VERIFY_SRC), 'the token probe exists to ask about')
    const block = VERIFY_SRC.slice(VERIFY_SRC.indexOf('function paints (token)'))
      .slice(0, 600)
    assert(/\.remove\(\)/.test(block),
      'the token probe is taken back out of the page in the same function')
  }

  /* NEVER POLL WITH requestAnimationFrame IN A TOOL. A background tab runs no
     animation frames, so the loop never resolves and the run hangs. It is
     indistinguishable from a crash. The toolkit broke this rule while the rule
     sat written down: a two-frame wait after the animations, outside the
     ceiling that was supposed to bound it. */
  {
    const tools = [['verify.js', VERIFY_SRC], ['verify-matrix.js', MATRIX_SRC], ['layout-tools.js', TOOLKIT_SRC]]
    const bad = tools.filter(([, t]) => /requestAnimationFrame\s*\(/.test(t))
    assert(bad.length === 0,
      `no tool waits on an animation frame (${bad.map(t => t[0]).join(', ') || tools.length + ' tools'})`)
  }

  /* AN INFINITE ANIMATION NEVER FINISHES, so its `finished` promise never
     settles and one spinner puts the whole wait on the ceiling. Drop the
     looping ones rather than racing them. */
  {
    for (const [name, src] of [['verify.js', VERIFY_SRC], ['layout-tools.js', TOOLKIT_SRC]]) {
      if (!/getAnimations/.test(src)) continue
      assert(/Infinity/.test(src), `${name} drops the looping animations rather than racing them`)
    }
  }

  /* A VERDICT NAMES ITS OWN COVERAGE, and the skipped list is half of that. A
     surface reported 0x0 was never checked, and a hidden pane measures zero,
     so every check on it passes and that reads exactly like success. */
  {
    for (const field of ['runs', 'notLanded', 'neverSettled', 'unmeasured', 'themeReturned']) {
      assert(new RegExp(field).test(MATRIX_SRC),
        `the matrix report carries ${field}, so a partial run cannot read as a clean one`)
    }
  }

  /* A TOOL THAT SETS STATE MUST ASSERT THE STATE LANDED, on BOTH halves. An
     earlier driver checked the width and only that the surface id was
     non-empty, so a run whose tab click had not landed carried the label of
     the surface I asked for. */
  {
    assert(/got\.w === width && got\.id === want/.test(MATRIX_SRC),
      'the driver asserts the width AND the surface before it measures')
    assert(/const tabFor = /.test(MATRIX_SRC) && /const widthSelect = \(\)/.test(MATRIX_SRC),
      'and it re-finds every control by selector, because a re-render detaches a held one')
  }

  /* A SUMMARY THAT TRUNCATES MUST SAY SO. One read `other: 68` while the array
     held 6, so 62 findings were invisible to anything reading the list. It
     cost three wrong conclusions in one session. */
  {
    const tools = [['verify.js', VERIFY_SRC], ['verify-matrix.js', MATRIX_SRC], ['layout-tools.js', TOOLKIT_SRC]]
    for (const [name, src] of tools) {
      const slices = (src.match(/\.slice\(0,\s*\d+\)/g) || []).length
      if (!slices) continue
      assert(/not listed/.test(src),
        `${name} truncates in ${slices} place(s) and says so`)
    }
  }

  /* A WRONG LINE NUMBER IS WORSE THAN NONE. Stripping comments by deleting
     them takes their newlines too, and every number below shifts. */
  {
    assert(/keepLines/.test(VERIFY_SRC),
      'comments are blanked rather than deleted, so a reported line number is the real one')
  }

  /* ── AND EVERY BLOCKING GUARD FAILS WHEN IT READS NOTHING ──
   *
   * The user read a verification report and asked why a guard had skipped. It
   * had not. `grid-snap` printed "0 values across 0 files", where the 0 files
   * counts files CHANGED, so a clean tree and a tree it never found printed
   * the identical line. The denominator is named now.
   *
   * Then the class: of the six blocking guards, only the two colour ones
   * refused an empty read. The other four printed a clean line and exited
   * zero. A report nothing acts on is silence, and the pre-commit hook reads
   * the exit code.
   *
   * ASSERTED BY RUNNING THEM, not by reading their source. A copy of each
   * root-holding guard is patched to an empty tree, with every relative import
   * rewritten to an absolute file URL because the copy sits elsewhere. Nothing
   * in the repo is touched.
   *
   * The two colour guards refuse on a TOKEN count instead, which is a stronger
   * question than "did I open a file", so they are asserted on their message. */
  {
    const { fileURLToPath, pathToFileURL } = await import('node:url')
    const REPO = fileURLToPath(new URL('../../../', import.meta.url))
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'guards-empty-'))
    fs.mkdirSync(path.join(empty, 'src'), { recursive: true })
    fs.writeFileSync(path.join(empty, 'src', 'notes.md'), 'no component here')
    const EMPTY = empty.replace(/\\/g, '/') + '/'

    const BY_ARG = ['tools/syntax-guard.mjs', 'tools/scope-guard.mjs']
    const BY_ROOT = [
      ['tools/primitives-guard.mjs', /const ROOT = [^\n]*/],
      ['tools/grid-snap.mjs', /const ROOT = fileURLToPath\(new URL\('\.\.\/apps\/web\/', import\.meta\.url\)\)/],
    ]
    const run = (file, args) => {
      try { return { out: execFileSync(process.execPath, [file, ...args], { encoding: 'utf8' }), code: 0 } }
      catch (err) { return { out: String(err.stdout || '') + String(err.stderr || ''), code: err.status ?? 1 } }
    }
    const REFUSED = /Nothing was read|Nothing was checked/

    for (const rel of BY_ARG) {
      const r = run(path.join(REPO, rel), [path.join(EMPTY, 'src')])
      assert(r.code !== 0 && REFUSED.test(r.out),
        `${rel} fails when it reads nothing (exit ${r.code})`)
    }
    for (const [rel, rootRe] of BY_ROOT) {
      const srcPath = path.join(REPO, rel)
      const src = fs.readFileSync(srcPath, 'utf8')
      const base = pathToFileURL(path.dirname(srcPath) + path.sep).href
      let patched = src.replace(rootRe, 'const ROOT = ' + JSON.stringify(EMPTY + 'src'))
      assert(patched !== src, `${rel} still states its root the way this proof patches it`)
      patched = patched.replace(/walk\(join\(ROOT, 'src'\)\)/, 'walk(ROOT)')
      const beforeImports = patched
      patched = patched.replace(/new URL\('(\.\.?\/[^']+)', import\.meta\.url\)/g,
        (m, r) => JSON.stringify(new URL(r, base).href))
      assert(patched !== beforeImports || !/new URL\('\.\.?\//.test(src),
        `${rel} still imports the way this proof rewrites it`)
      const copy = path.join(empty, path.basename(rel))
      fs.writeFileSync(copy, patched)
      const r = run(copy, ['--check'])
      assert(r.code !== 0 && REFUSED.test(r.out),
        `${rel} fails when it reads nothing (exit ${r.code})`)
    }
    for (const rel of ['apps/web/tools/fallback-drift-guard.mjs', 'apps/web/tools/token-reader-guard.mjs']) {
      const src = fs.readFileSync(path.join(REPO, rel), 'utf8')
      assert(/Nothing was checked/.test(src) && /process\.exit\(1\)/.test(src),
        `${rel} refuses an empty read on its token count`)
    }
    fs.rmSync(empty, { recursive: true, force: true })
  }

  /* ── A RUN THAT READ NO RULES IS NOT A CLEAN RESULT ──
   *
   * Measured once in a dev server: five sheets, three throwing on cssRules
   * access and two empty, zero rules read, and a confident report of zero
   * findings. An injected fault carrying five dead classes came back clean.
   *
   * Two repairs, and BOTH are asked here. Read the stylesheet TEXT as well as
   * the CSSOM, because a throwing sheet is the common case. And refuse at zero
   * rather than reporting a pass, because an empty run and a clean one print
   * the same word otherwise.
   *
   * ASKED OF BOTH COPIES. The shipped render check reaches a reader's build.
   * `public/dead-class.js` is the standalone tool we run here. A rule with two
   * homes is how two versions of it end up disagreeing, so neither is taken on
   * the other's word. */
  {
    const dead = CHECKS.find(c => c.id === 'a-class-styles-something-where-it-sits')
    assert(dead && dead.body, 'the dead-class check is a shipped check with a body')
    const shipped = dead.body.join('\n')
    const standalone = readTool('../public/dead-class.js')
    for (const [name, src] of [['the shipped check', shipped], ['dead-class.js', standalone]]) {
      assert(/document\.querySelectorAll\(\s*["']style/.test(src) && /link\[rel/.test(src),
        `${name} reads the stylesheet TEXT as well as the CSSOM`)
      assert(/catch/.test(src),
        `${name} survives a sheet that throws on access rather than losing it`)
      /* THE REFUSAL, and it has to be a refusal rather than a note. The
         shipped one reports through `fail`, which fails the run. The
         standalone one prints to `console.error` and returns before it can
         print a verdict. */
      const refuses = /if \(!(?:rules|sels)\.length\)/.test(src)
        || /read only " \+ sels\.length/.test(src)
      assert(refuses, `${name} refuses when it read no rules`)
      assert(/NOT a clean result|nothing was measured/.test(src),
        `${name} says so in words, so an empty run cannot be read as a pass`)
    }

    /* AND EACH OF THOSE CONDITIONS IS BROKEN ON PURPOSE. A claim pointed only
       at correct code says nothing: a regex that silently stops matching
       passes for ever. Nothing on disk is touched — each condition is
       re-evaluated against a copy with that one line removed. */
    const strip = (src, re) => src.replace(re, '')
    const MUT = [
      ['the text read', s => /document\.querySelectorAll\(\s*["']style/.test(s),
        s => strip(s, /document\.querySelectorAll\(\s*["']style["']\s*\)/g)],
      ['the refusal at zero', s => /if \(!(?:rules|sels)\.length\)/.test(s) || /read only " \+ sels\.length/.test(s),
        s => strip(s, /if \(!(?:rules|sels)\.length\)|read only " \+ sels\.length/g)],
      ['the words that say it is not a pass', s => /NOT a clean result|nothing was measured/.test(s),
        s => strip(s, /NOT a clean result|nothing was measured/g)],
    ]
    for (const [label, holds, break_] of MUT) {
      for (const [name, src] of [['the shipped check', shipped], ['dead-class.js', standalone]]) {
        assert(holds(src) && !holds(break_(src)),
          `${name}: removing ${label} is caught (quiet ${holds(src)}, loud ${!holds(break_(src))})`)
      }
    }
  }

  /* ── AND EVERY ONE OF THOSE IS BROKEN ON PURPOSE HERE ──
   *
   * A GUARD'S OWN RECORD IS NOT EVIDENCE. Each condition above is a claim
   * about a file, and a claim pointed only at correct code says nothing: a
   * regex that silently stops matching passes for ever. So each one is
   * re-evaluated against a MUTATED COPY of the same text, and has to flip.
   *
   * Nothing on disk is touched. The mutation is a string replacement, and the
   * pair of verdicts is the proof: quiet on the real file, loud on the fault. */
  {
    const CASES = [
      /* APPEND THE FAULT TO THE REAL CORPUS, never test it alone. A regex
         proven on the fault string by itself says nothing about whether it
         finds that shape among 94 bodies of correct code. */
      ['a body testing a computed height for auto',
        s => /height\s*===?\s*['"]auto['"]/.test(s),
        s => s + "\nif (getComputedStyle(el).height === 'auto') continue", bodiesJoined],
      ['a body subtracting two rounded values',
        s => /round\([^)]*\)\s*-\s*round\(/.test(s),
        s => s + '\nconst d = round(a.top) - round(b.bottom)', bodiesJoined],
      ['a descendant written where one level was meant',
        s => /:scope > \*\s+[a-z[.]/.test(s),
        s => s + "\nel.querySelectorAll(':scope > * svg')", bodiesJoined],
      ['the token probe left on the page',
        s => !/\.remove\(\)/.test(s.slice(s.indexOf('function paints (token)')).slice(0, 600)),
        s => s.replace(/p\.remove\(\)/, 'void 0'), VERIFY_SRC],
      ['a tool waiting on an animation frame',
        s => /requestAnimationFrame\s*\(/.test(s),
        s => s + '\nawait new Promise(r => requestAnimationFrame(r))', TOOLKIT_SRC],
      ['a settle racing an infinite animation',
        s => !/Infinity/.test(s),
        s => s.replace(/Infinity/g, 'never'), TOOLKIT_SRC],
      ['the driver asserting one half of the state',
        s => !/got\.w === width && got\.id === want/.test(s),
        s => s.replace('got.w === width && got.id === want', 'got.w === width && got.id'), MATRIX_SRC],
      ['the driver holding a control across a re-render',
        s => !(/const tabFor = /.test(s) && /const widthSelect = \(\)/.test(s)),
        s => s.replace('const widthSelect = ()', 'const widthSelect = document'), MATRIX_SRC],
      ['a truncating report with no notice',
        s => (s.match(/\.slice\(0,\s*\d+\)/g) || []).length > 0 && !/not listed/.test(s),
        s => s.replace(/not listed/g, 'omitted'), MATRIX_SRC],
      ['comments deleted rather than blanked',
        s => !/keepLines/.test(s),
        s => s.replace(/keepLines/g, 'dropLines'), VERIFY_SRC],
    ]
    /* A CASE WHOSE SOURCE IS ABSENT CANNOT BE PROVEN EITHER WAY, and running
       it anyway inverts one of them: an empty string holds no `Infinity`, so
       "quiet on the real file" would FAIL on a checkout without the toolkit.
       Gate on the source, and assert the surviving count so the gate cannot
       quietly empty the table. */
    const live = CASES.filter(c => c[3])
    assert(live.length >= 8, `there are conditions to prove (${live.length} of ${CASES.length})`)
    if (live.length < CASES.length) {
      line(`  NOTE  ${CASES.length - live.length} condition(s) UNMEASURED, because their source is not in this checkout.`)
    }
    for (const [label, fires, mutate, src] of live) {
      assert(!fires(src), `quiet on the real file: ${label}`)
      assert(fires(mutate(src)), `and loud on the injected fault: ${label}`)
    }
    /* The report fields are one shape repeated, so they are proven in a loop
       rather than as ten table rows. */
    for (const field of ['runs', 'notLanded', 'neverSettled', 'unmeasured', 'themeReturned']) {
      const gone = MATRIX_SRC.replace(new RegExp(field, 'g'), 'zzz')
      assert(!new RegExp(field).test(gone),
        `and loud on the injected fault: the report dropping ${field}`)
    }
  }

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
    /* a-default-goes-first-in-the-file: the container-flow default written at
       the BOTTOM, after components that state their own distance. Both weigh
       the same, so order decides the tie and the default deletes whatever a
       component chose. Measured once as a card action row falling from
       34.25px off the foot to 12 on three cards. */
    '.card > * + * { margin-block-start: var(--space-md); }',
    /* a-touch-floor-asks-the-pointer-never-the-width: the finger floor keyed
       on a WIDTH. A narrow window on a desktop is not a finger, so resizing a
       browser flips the floor and every correct mouse target reports. This
       project's own toolkit shipped it as `coarse || innerWidth < 768` and
       reported 13 healthy 24px controls. */
    '@media (max-width: 767px) { .dmd { --control-floor: 44px; } }',
    /* an-overhang-asks-its-host: the target overhang reaching the floor from a
       control-height TOKEN. That token is the floor one host in three states.
       A table select-all cell derives its height from the header type and
       states no floor, so the same arithmetic came out 0.78px short there, on
       two surfaces. */
    '.box::after { position: absolute; top: min(0px, calc((var(--target-min, 44px) - var(--btn-sm-height, 28px)) / -2)); }',
    /* a-subtraction-asks-about-the-parent: a container publishes its gap and a
       descendant subtracts it, with nothing joining the two. A custom property
       inherits, so this matches every descendant of every container that ever
       set it, including the ones that never did. A landing card subtracted
       16px it never had and its action row halved to 8. */
    '.stack { --stack-gap: var(--space-md); }',
    '.actions-row { padding-block-start: calc(var(--card-action-gap, 16px) - var(--stack-gap)); }',
  ].join('\n'))
  /* never-correct-a-glyph: a call site stating its own width. The component
     spreads every prop it is given onto the svg, so this reaches the element
     and overrides the size token. Measured in one 12px box: a plus paints 8px
     of ink, a magnifier 10 and a chevron 4. */
  write('glyph.jsx', [
    'import { Ico, IconSearch } from "./icons.jsx"',
    'export const Bar = () => (',
    '  <button className="btn"><Ico d={IconSearch} width={18} />Search</button>',
    ')',
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
    /* The two the overhang and the subtraction read. Declared rather than
       given a fallback, because a fallback would fire two other checks and the
       fixture would then be silent for the wrong reason. */
    '  --target-min: 44px;',
    '  --card-action-gap: 16px;',
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
    /* The CORRECT overhang: the floor reached from the host own height, as a
       percentage, held at min(0px) so a host already above it keeps its size.
       A fixture with no overhang at all would be silent for the wrong reason. */
    '.box::after { position: absolute; top: min(0px, calc((var(--target-min) - 100%) / -2)); }',
    /* The CORRECT subtraction: the same container property, and the selector
       states the parent. Plus the case that needs no combinator, because the
       rule declaring the property is the one reading it. */
    '.stack { --stack-gap: var(--space-md); }',
    '.stack > .actions-row { padding-block-start: calc(var(--card-action-gap) - var(--stack-gap)); }',
    '.head { --line-half: var(--space-md); transform: translateY(calc(50% - var(--line-half))); }',
  ].join('\n'))
  /* The CORRECT icon call sites: a published size step, and a style object
     that touches no geometry. The second is the toast tick, which passes a
     colour, and it is why the check asks the PROPERTY rather than whether a
     style object is present. */
  fs.writeFileSync(path.join(clean, 'good-icons.jsx'), [
    'import { Ico, IconSearch, IconCheck } from "./icons.jsx"',
    'export const Bar = () => (',
    '  <span>',
    '    <Ico d={IconSearch} size="lg" />',
    '    <Ico d={IconCheck} style={{ color: "var(--c-text)" }} />',
    '  </span>',
    ')',
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

  /* ── AND POINT THREE OF THEM AT THIS PROJECT'S OWN SOURCE ──
   *
   * A fixture proves a check fires and a second fixture proves it stays quiet
   * on the shape it was written about. Neither says the shape EXISTS anywhere
   * real. A check with no candidates in the tree it runs over is a no-op, and
   * a no-op reads as a pass.
   *
   * That failure has a measured history here. One exemption read
   * `height === 'auto'`, which getComputedStyle never returns, so the check
   * had 47 candidates and 0 findings for as long as it existed. And my first
   * matcher for the glyph rule looked for a stylesheet rule naming one icon:
   * 16 candidates, every one a side or a shape class, and no selector in this
   * system can reach a single glyph at all.
   *
   * The full verifier cannot run over this tree, because it wants an emitted
   * `tokens.css` and this repo generates that per document. So these three
   * bodies run alone, over the real stylesheets and components, through the
   * same strings the emitter ships. No second implementation.
   *
   * Measured: 81 icon call sites, 2 overhang insets, 64 container-scoped
   * custom properties carrying 1 subtraction. 0 findings on all three.
   *
   * 81, NOT THE 82 IN THE FILES. The 82nd sits inside a comment in
   * `icons.jsx` that quotes the markup shape, and every source check reads
   * the comment-blanked copy. Both numbers are right about different
   * questions, and the check is asked about code. */
  {
    const { fileURLToPath } = await import('node:url')
    const HERE = fileURLToPath(new URL('../src/', import.meta.url))
    const walkSrc = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walkSrc(path.join(d, e.name)) : [path.join(d, e.name)])
    const keepLines = m => m.replace(/[^\n]/g, ' ')
    const realFiles = walkSrc(HERE)
      .filter(p => /\.(css|jsx|js)$/.test(p))
      .map(p => {
        const text = fs.readFileSync(p, 'utf8')
        const css = p.endsWith('.css')
        let bare = text.replace(/\/\*[\s\S]*?\*\//g, keepLines)
        if (!css) bare = bare.replace(/(^|[^:\\])\/\/[^\n]*/g, (m, pre) => pre + keepLines(m.slice(pre.length)))
        return { path: p.slice(HERE.length).replace(/\\/g, '/'), text, bare, css, html: false }
      })
    assert(realFiles.length > 20, `the real source is readable (${realFiles.length} files)`)

    const OVER_SOURCE = [
      ['never-correct-a-glyph', /(\d+) icon call site/, 81],
      ['an-overhang-asks-its-host', /(\d+) overhang inset/, 2],
      ['a-subtraction-asks-about-the-parent', /out of (\d+) such/, 64],
    ]
    for (const [id, shape, want] of OVER_SOURCE) {
      const c = CHECKS.find(x => x.id === id)
      assert(c && c.body, `${id} is a source check with a body`)
      const found = [], said = []
      const body = new Function('files', 'fail', 'note', c.body.join('\n'))
      body(realFiles,
        (p, line, msg) => found.push(p + ':' + line + ' ' + msg),
        msg => said.push(msg))
      /* THE COUNT IS THE POINT. A check that stops matching anything goes
         silent, and this is what refuses to call that a pass. */
      const m = shape.exec(said.join(' '))
      assert(m, `${id} reports what it measured${said.length ? ` — "${said.join(' | ').slice(0, 90)}"` : ' — nothing'}`)
      assert(Number(m[1]) === want,
        `${id} still reads ${want} candidate(s) in this source (${m ? m[1] : '?'})`)
      assert(found.length === 0,
        `${id} is quiet on this project's own source${found.length ? ` — ${found[0].slice(0, 110)}` : ''}`)
    }
  }
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

  /* ── NEVER TUNE THE FLOOR TO FIT THE PALETTE ──
   *
   * Every assertion below reads `NEIGHBOUR_FLOOR` out of the module, which is
   * right for saying what the bar IS and says nothing about whether the bar
   * moved. Lower the constant and every one of them still passes. That is the
   * exact shape of tuning the check to the code, and this rule exists because
   * it is the cheapest way to make a loud palette look quiet.
   *
   * So the constant is pinned to a literal here. 0.10 in OKLab is about four
   * just-noticeable differences, and it was found by searching for the
   * quietest setting that still CLEARS it across every preset and the whole
   * hue circle, rather than by lowering it until a set passed. Measured at
   * that floor: n=3 gives 0.256, n=4 gives 0.136, n=5 gives 0.088 and n=8
   * clears at no hue. Five is the shipped count.
   *
   * A DELIBERATE CHANGE EDITS THIS LINE AND SAYS WHY. That is the whole
   * mechanism: the edit becomes visible instead of silent. */
  assert(NEIGHBOUR_FLOOR === 0.10,
    `the separation floor is the searched 0.10, not a number a palette needed (${NEIGHBOUR_FLOOR})`)
  assert(CATEGORICAL_COUNT === 5,
    `five series, because nothing clears that floor at eight (${CATEGORICAL_COUNT})`)

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

  /* ── AND THE TWO ENDPOINTS ARE READ, BECAUSE THE RULE STATES THEM ──
   *
   * The rule quotes 0.058 to 0.184 on the default palette. The relationship
   * above was already checked and those two numbers were not, so they could
   * drift while every assertion stayed green. A rule states a constant only
   * where a check reads it.
   *
   * The band is generous on purpose. These are a property of the DEFAULT seed,
   * and the point is that the quiet end stays quiet and the loud end stays
   * loud, not that either lands on a hundredth. */
  assert(Cs[0] > 0.03 && Cs[0] < 0.09,
    `the quietest member sits near 0.058 (${Cs[0].toFixed(3)})`)
  assert(Cs[Cs.length - 1] > 0.15 && Cs[Cs.length - 1] < 0.22,
    `and the loudest near 0.184 (${Cs[Cs.length - 1].toFixed(3)})`)
  assert(Cs[Cs.length - 1] - Cs[0] > 0.08,
    `so the set has somewhere to rest and somewhere to land (${(Cs[Cs.length - 1] - Cs[0]).toFixed(3)} apart)`)

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
    /* WAS `kids.every(k => k.matches(CONTROL) || k.querySelector(CONTROL))`,
       and a subtree search is the documented trap. A column of six mixed
       blocks each holding some control passed as a run of buttons, on the
       component gallery, at every width and both pointers. A child qualifies
       now when it IS a button, or when every control inside it is — the pair
       wrapper being the exception this system's own action row asks for. */
    ['a-group-of-buttons-keeps-one-gap', 'kids.every(isRunMember)',
      'a layout that happens to hold a control, rather than a run of buttons'],
    ['a-group-of-buttons-keeps-one-gap', "inner.every(c => c.matches(BTN))",
      'a box whose controls are not all buttons, because a run of buttons is buttons'],
    ['a-group-of-buttons-keeps-one-gap', "cs.flexDirection === 'column' && cs.flexWrap === 'nowrap'",
      'a nowrap column, whose column-gap is a declaration nothing paints'],
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

/* ── ROWS, CONTROLS AND ICONS: TWO SHIPPED AND ONE CUT ──
 *
 * The payload taught both of these and nothing measured either. A square with
 * no assertion was broken twice: 46x28 on a menu button whose label a width
 * rule hid, and 28x44 on fifteen controls where a stated width defeated the
 * ratio. A typed glyph had no check at all, in checks or in the suite.
 *
 * AND THE THIRD FIRED ON CORRECT CODE, so it is not here. "A control's height
 * is STATED, never inherited" is right, and a per-rule source test faults 2 of
 * our 10 padded control rules: `.nav-item` and `.tab` take their height from a
 * LATER rule, which is legal and common. The render form needs a perturbation,
 * and `one-height-per-control-row` already reports the symptom.
 */
{
  line('\n- the rows section: the square and the typed glyph -')
  const { CHECKS: CH3 } = await import('../src/emit/checks.js')
  const sq = CH3.find(c => c.id === 'an-icon-only-control-is-square')
  const gl = CH3.find(c => c.id === 'a-mark-is-never-a-typed-glyph')
  for (const [c, what] of [[sq, 'the square check'], [gl, 'the typed-glyph check']]) {
    assert(!!c && c.where === 'render', `${what} ships and runs in a browser (${c?.where})`)
  }
  {
    const t = (sq?.body || []).join('\n')
    /* CSS CANNOT ASK WHETHER A CHILD IS RENDERED, which is the whole reason
       this is a render check rather than a selector. */
    assert(/visibility|opacity/.test(t),
      'it asks what the engine RENDERS, so a label hidden to a pixel is not words')
    /* AND ICON-ONLY MEANS THERE IS AN ICON. Without that clause it faulted 60
       swatches out of 62 findings and buried the 2 real ones. */
    assert(/svg, img, \.icon/.test(t),
      'and it requires a MARK, because a swatch is its colour and has no glyph to square')
    assert(/0\.02/.test(t),
      'a sub-pixel rounding is not an oblong, so the threshold is not exactly one')
  }
  {
    const t = (gl?.body || []).join('\n')
    assert(/String\.fromCharCode/.test(t),
      'the glyph set is written as code points, so the file reads in any editor')
    assert(/nodeType !== 3/.test(t),
      'and it reads TEXT NODES, because a glyph inside a child element is that child')
    assert(/button, a\[href\]/.test(t),
      'scoped to pressable things: an ellipsis in a sentence is prose')
  }
  /* THE PAYLOAD TEACHES BOTH, and it did before either had a check. */
  {
    const md = payloadTextFiles(state, derived)['DESIGN.md'].toLowerCase()
    assert(md.includes('aspect-ratio: 1'), 'the payload states the square as a ratio')
    assert(md.includes('word space is not a gap'), 'and states that a word space is not a gap')
  }
}

/* ── SHIP NO FRACTIONAL PIXEL: THE TWO HALVES NOTHING WATCHED ──
 *
 * The type grid, the derived snap, the stroke weight and the fallback drift all
 * have readers already. Two things did not.
 *
 * A SLIDER'S PARITY. A track and a thumb are centred by half their difference,
 * so a 3px track under a 12px thumb asks for -4.5 and nothing lands on a whole
 * pixel. Measured on both variants: 4 against 12 and 8 against 16, each wanting
 * -4, each stating -4.
 *
 * AND THE INLINE HALF HAD NO GUARD AT ALL. `grid-snap.mjs` ran once as a
 * codemod and 650 values had already shipped past the CSS guards. One more
 * arrived in the months it sat unwatched: a sparkline typed 88 by 22 in the
 * markup, where the 22 was a line box rounded to a whole pixel. It runs in the
 * pre-commit hook now, and its ternary blind spot is closed.
 */
{
  line('\n- ship no fractional pixel: the slider and the inline half -')
  const theme = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  const groups = {}
  for (const r of theme.matchAll(/([^{}]*input\[type=range\][^{}]*)\{([^{}]*)\}/g)) {
    const sel = r[1].trim(), d = r[2]
    const variant = (sel.match(/range\]([.a-z-]*)/) || [, ''])[1] || '(base)'
    const h = (d.match(/height:\s*([\d.]+)px/) || [])[1]
    const mt = (d.match(/margin-top:\s*(-?[\d.]+)px/) || [])[1]
    groups[variant] = groups[variant] || {}
    if (/track/.test(sel) && h) groups[variant].track = +h
    if (/thumb/.test(sel)) { if (h) groups[variant].thumb = +h; if (mt) groups[variant].margin = +mt }
  }
  const pairs = Object.entries(groups).filter(([, g]) => g.track != null && g.thumb != null)
  assert(pairs.length >= 2, `every slider variant states a track and a thumb (${pairs.length})`)
  for (const [v, g] of pairs) {
    const want = (g.track - g.thumb) / 2
    assert(Number.isInteger(want),
      `${v} centres its thumb on a whole pixel (track ${g.track}, thumb ${g.thumb}, wants ${want})`)
    /* A VARIANT THAT MOVES THE TRACK MUST MOVE THE OFFSET. Changing one and
       not the other is how the arithmetic goes wrong in silence. */
    if (g.margin != null) assert(g.margin === want,
      `${v} states the offset its own numbers ask for (${g.margin} against ${want})`)
  }

  /* THE GUARD IS IN THE HOOK, because a report nothing reads is silence. */
  {
    /* Three levels up: this file is apps/web/test, and the hook is at the repo
       root. Two levels reached apps/ and threw. */
    const hook = fs.readFileSync(new URL('../../../.githooks/pre-commit', import.meta.url), 'utf8')
    assert(/grid-snap\.mjs --check/.test(hook),
      'the grid guard runs in the pre-commit hook, in check mode')
    assert(/exit 1/.test(hook.split('grid-snap.mjs --check')[1] || ''),
      'and refuses the commit, rather than printing to nobody')
    const guard = fs.readFileSync(new URL('../../../tools/grid-snap.mjs', import.meta.url), 'utf8')
    assert(/--check/.test(guard) && /process\.exit\(1\)/.test(guard),
      'the guard exits non-zero on a finding')
    /* THE TERNARY SHAPE, which the first matcher could not see: it required a
       value starting with a digit or a quote, and a ternary starts with a
       letter. Proven by injection: literal fires, px string fires, ternary
       exited zero. */
    assert(/CONDITIONAL, not rewritten/.test(guard),
      'and it reads a conditional value, which the digit-or-quote matcher skipped')
    assert(/never rewritten|not rewritten/i.test(guard),
      'reported rather than rewritten, because snapping one branch edits a decision')
  }

  /* AND THE SPARKLINE STATES NO SIZE IN THE MARKUP. Two typed numbers there
     beat every rule in the stylesheet, so no rule could reach them. */
  {
    const jsx = fs.readFileSync(new URL('../src/preview/screens/Charts.jsx', import.meta.url), 'utf8')
    assert(!/chart-sparkline[\s\S]{0,200}?width:\s*\d/.test(jsx),
      'the sparkline states no width in the markup')
    /* FOUR RULES NAME THAT CLASS, so find the one that SIZES it. Taking the
       first match read the rule that sets the chart custom properties. */
    const css2 = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
    const rule = [...css2.matchAll(/\.dmd \.chart-sparkline \{([^}]*)\}/g)]
      .map(m => m[1]).find(d => /block-size/.test(d)) || ''
    assert(/block-size:\s*calc\(var\(--font-body-sm-size/.test(rule),
      'and the stylesheet derives its height from the body tokens, not the caption')
    /* NOT THE SPARKLINE'S OWN em OR lh. Both resolve against its caption font
       at 12px, so they measured 19.44 and 19.08 against a row of 21.84. */
    assert(!/block-size:\s*1lh/.test(rule) && !/block-size:\s*calc\(1em/.test(rule),
      'and not from its own font, which is the caption rather than the row')
  }

  /* ── AND THE SITUATIONS ARE NOT OPTIONAL ──
   *
   * The file's own header says the situations are last and not optional,
   * because an empty chart is a screen somebody builds wrongly when no sample
   * ever showed one. Nothing asserted the list, so the surface shipped five of
   * the six and the missing one was EMPTY — the exact case the header names.
   *
   * EMPTY IS NOT NO RESULTS. First run has no data at all and offers the
   * feature's own primary action. No results has data and a filter that
   * excluded it, so it offers a way BACK. One card for both tells a reader on
   * their first day that the product is broken. Both are on the surface now,
   * and the pair below asserts they stay two cards rather than one.
   *
   * MATCHED ON THE SPECIMEN TITLE, which is what a reader sees, rather than on
   * a class or a comment. A comment naming a situation is not a situation. */
  {
    const jsx = fs.readFileSync(new URL('../src/preview/screens/Charts.jsx', import.meta.url), 'utf8')
    const titles = [...jsx.matchAll(/title=\{L\('([^']+)'\)\}/g)].map(m => m[1])
    const SITUATIONS = ['Empty', 'No results', 'Loading', 'Crossing zero', 'A long category name', 'Too many series']
    const absent = SITUATIONS.filter(s => !titles.includes(s))
    assert(absent.length === 0, absent.length
      ? `a chart situation has no specimen — ${absent.join(', ')} (${absent.length} of ${SITUATIONS.length})`
      : `all ${SITUATIONS.length} chart situations are demonstrated, among ${titles.length} specimens`)

    /* THE TWO EMPTY STATES OFFER DIFFERENT ACTIONS, or they are one card
       spelled twice. Forward on first run, back when a filter excluded the
       data. The variant says which: primary for the action that is the point
       of the screen, secondary for the way back. */
    /* BLANK THE COMMENTS FIRST. Both cards carry one saying why they take no
       `role="img"`, so a scan of the raw text finds the attribute in the prose
       explaining its absence. That is the recorded rule about reading source,
       and it fired here on the first run. */
    const bareJsx = jsx.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    const cardOf = name => {
      const at = bareJsx.indexOf(`title={L('${name}')}`)
      return at < 0 ? '' : bareJsx.slice(at, bareJsx.indexOf('</Spec>', at))
    }
    assert(/btn-primary/.test(cardOf('Empty')) && !/btn-primary/.test(cardOf('No results')),
      'first run offers its primary action and no results does not, so the two are not one card twice')
    assert(!/role="img"/.test(cardOf('Empty')) && !/role="img"/.test(cardOf('No results')),
      'and neither carries role="img", which would silence the message and the button')
  }
}

/* ── SITUATIONS: A DECLARED LINE WITH NO AREA TO PAINT IN ──
 *
 * Of the ten rules here, eight already had a reader. Two did not, and one of
 * those turned out to be a live fault rather than a missing assertion.
 *
 * `grid-row: 1 / -1` needs explicit rows, and the markup states them, so the
 * template resolved. The INSET was the missing half: an absolutely positioned
 * box with no inset takes its content, and a line layer has none. Two bar
 * charts measured 1px by 0 inside a 104px row group, with a computed inset of
 * 52px top and bottom. The axis was absent and the gradient had no box.
 *
 * Every geometric check passed, because the box existed and sat where the grid
 * put it. `a-gridline-is-quieter-than-its-axis` compares two COLOURS and has
 * no opinion about whether either reaches the screen.
 */
{
  line('\n- a declared line needs area to paint in -')
  const { CHECKS: CH4 } = await import('../src/emit/checks.js')
  const c = CH4.find(x => x.id === 'a-declared-line-has-area-to-paint-in')
  assert(!!c && c.where === 'render', `the check ships and runs in a browser (${c?.where})`)
  const t = (c?.body || []).join('\n')
  assert(/borderTopWidth|border" \+ side/.test(t),
    'it reads the DECLARATION, so an axis is a border rather than a class name')
  assert(/gradient/.test(t),
    'and a gridline set is a repeating gradient, which is one box rather than a run of elements')
  assert(/r\.width >= 1 && r\.height >= 1/.test(t),
    'a line needs a length as well as a width, so both sides are asked')
  assert(/!layers/.test(t),
    'and a run that measured no layer says so rather than passing')

  /* THE STYLESHEET SIDE. The rule needs both axes, and the comment has to name
     the cause the old one missed. */
  {
    const css3 = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
    const rule = (css3.match(/\.dmd \.chart-bar \.chart-rows > \.chart-grid \{[\s\S]*?\n\}/) || [''])[0]
    assert(/inset:\s*0/.test(rule),
      'the bar chart layer states inset 0 on both axes')
    assert(/grid-row:\s*1 \/ -1/.test(rule),
      'and keeps the row span, because the template resolves and was never the fault')
  }

  /* AND THE PAYLOAD CARRIES IT, because a builder puts an axis on an absolute
     layer and reproduces this exactly. */
  {
    const md = payloadTextFiles(state, derived)['DESIGN.md'].toLowerCase()
    assert(md.includes('needs area to paint it'),
      'the payload states that a line layer needs area')
    assert(md.includes('inset: 0` on both axes') || md.includes('inset: 0` on both'),
      'and names both axes, with the reason for each')
  }
}

/* ── REACH FOR THE PRIMITIVE: A CLASS THAT STYLES NOTHING WHERE IT SITS ──
 *
 * The browser tool that asks this ran once and was wired to nothing. Run again
 * months later: three faults, each of which read as done in the markup.
 *
 *   A nav specimen carried the TABLE selection class, so a sample the gallery
 *   exists to show rendered byte-identical to a plain item. Five published
 *   tokens had no demonstration. With the right class it gains the 4px accent
 *   edge, measured rgb(15, 82, 141) inset.
 *
 *   A chrome readout carried the document figure class, so it took the body
 *   face while its markup asked for the mono one.
 *
 *   A chrome button carried the document secondary class, so it fell back to
 *   the browser grey at rgb(107, 107, 107) on a 112px box.
 *
 * IT IS A RENDER CHECK NOW. A build-time version reported 49 findings and 46
 * were correct code, because a panel may render a document sample inside its
 * own preview root. Only the DOM knows which stylesheet applies where.
 */
{
  line('\n- a class styles something where it sits -')
  const { CHECKS: CH5 } = await import('../src/emit/checks.js')
  const c5 = CH5.find(x => x.id === 'a-class-styles-something-where-it-sits')
  assert(!!c5 && c5.where === 'render', `the check ships and runs in a browser (${c5?.where})`)
  const t5 = (c5?.body || []).join('\n')
  assert(/querySelectorAll\("style"\)/.test(t5),
    'it reads the stylesheet TEXT as well as the CSSOM, because three of five sheets can throw')
  assert(/sels\.length < 20/.test(t5),
    'and a run that read no rules fails loudly rather than reporting clean')
  assert(/!naming\.length/.test(t5),
    'a class no stylesheet mentions is a HOOK, so it is skipped rather than reported')
  assert(/not\|has\|is\|where/.test(t5),
    'a class read inside a functional pseudo is being excluded, not used')
  assert(/hover\|focus/.test(t5),
    'and a state cannot match at rest, so the state comes off before asking')
  assert(/querySelector\(n\)/.test(t5),
    'an ANCESTOR class is alive when it reaches a descendant, which counting subjects alone called dead')

  /* THE THREE REPAIRS, so none can drift back. */
  {
    const gal = fs.readFileSync(new URL('../src/preview/Gallery.jsx', import.meta.url), 'utf8')
    assert(/nav-item is-active with-icon/.test(gal),
      'the nav specimen carries the class the stylesheet marks a chosen item with')
    /* BLANK THE COMMENTS FIRST. The replacement comment QUOTES the rule it
       removed, so a raw scan found its own explanation and faulted the fix. */
    const th = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    assert(!/\.seed-lock:hover > span/.test(th),
      'the seed-lock hover rule is gone, because its child is an svg and nothing set a base opacity')
    const cm = fs.readFileSync(new URL('../src/casual/CasualMode.jsx', import.meta.url), 'utf8')
    assert(!/className="btn-secondary"/.test(cm),
      'and the chrome reaches for a class the chrome defines')
  }
}

/* ── A DEMONSTRATION IS THE COMPONENT ──
 *
 * Eight rules here and almost nothing read any of them. Most are method: which
 * situations to sample, where to put a sample, what a new one should spend its
 * slots on. Three are measurable, and all three were satisfied and unasserted.
 *
 * A SAMPLE THAT CANNOT CHANGE PROVES THE SETTING WORKS. A numerals sample once
 * set every amount in the mono face, so tabular and proportional both rendered
 * at 64.81px, at the same left edge. The property moved and no pixel did.
 *
 * Measured today under both values: the three column figures move 5.91, 13.06
 * and 4.28px. The two card figures do not move at all, which is the half a
 * column can never show.
 */
{
  line('\n- a demonstration is the component -')
  const ty = fs.readFileSync(new URL('../src/panels/TypographyPanel.jsx', import.meta.url), 'utf8')

  /* THE SAMPLE CARRIES BOTH CASES, or it teaches half the rule. A column takes
     the mono face and tabular digits. A standalone figure keeps the body face
     under BOTH settings, and that is the case the rule EXCLUDES. */
  assert(/font-mono-family/.test(ty) && /tabular-nums/.test(ty),
    'the numerals sample renders the column case, with the mono face and tabular digits')
  assert(/proportional/.test(ty),
    'and names the proportional case, so the setting has two visible answers')
  /* THE FRAME IS THE RECESSED PLANE, AND ITS CONTENTS ARE THE DOCUMENT'S. A
     sample painted in the editor's own surface reads as one more block of
     options rather than a preview of the thing being designed. */
  assert(/className="dmd entry-sample"/.test(ty),
    'every sample sits under .dmd, which is what brings the document tokens in')
  {
    const th2 = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    const frame = (th2.match(/\.entry-sample\{[^}]*\}/) || [''])[0]
    assert(/var\(--preview\)/.test(frame),
      'and the frame takes the preview plane, never the panel surface beside it')
    assert(/var\(--preview-bdr\)/.test(frame),
      'including its edge, so two panels cannot drift into different kinds of thing')
  }

  /* ── AND THE MENU CHECK IS NO LONGER MANUAL ──
   *
   * The rule is exact and the shape is readable: a page head holding a title,
   * with the menu INSIDE the action group rather than beside it.
   *
   * Measured on nine surfaces: four hold a menu control, all four visible at a
   * 567px pane, and none of them faults. Three sit on a page head as siblings
   * of the action group. The fourth is a landing bar, whose nearest heading is
   * three levels up in the page stack, so it is site navigation rather than a
   * title row and the rule does not govern it.
   *
   * IT IS A RENDER CHECK NOW. It sat manual because I could not break it on
   * purpose, and the reason was the injection rather than the rule: a move in
   * the live DOM is undone by React during settle(), so the check read correct
   * markup. Inject in the SOURCE instead. The section at the end of this file
   * owns the measurements and the assertions.
   */
  {
    const c6 = (await import('../src/emit/checks.js')).CHECKS
      .find(x => x.id === 'a-menu-control-is-a-sibling-of-the-action-group')
    assert(!!c6 && c6.where === 'render',
      `the menu rule ships as a render check (${c6?.where})`)
  }
}

/* ── A RATIO AND A MINIMUM FIGHT, AND THE RATIO WINS BY WIDENING ──
 *
 * A 140px floor at 2:1 asks for 280px of width, so inside a 296px pane the
 * plot grew past its own track: 56px of overflow at 296, 44 at 308, 32 at 320.
 * The floor is the decision, so the ratio has to give.
 *
 * The cap is in place and its measurement sits in the comment beside it.
 * Nothing read either. So this asks the shape rather than the instance: any
 * rule stating a ratio AND a block minimum has to cap its inline size.
 *
 * Measured across three stylesheets: two rules state both, and the second
 * turns the ratio off, so one needs the cap and has it.
 */
{
  line('\n- a ratio with a minimum caps its inline size -')
  const sheets = ['../src/preview/preview.css', '../src/ui/theme.css', '../src/preview/responsive.rules.css']
    .map(rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')))
  let both = 0, capped = 0, ratioOff = 0
  for (const css of sheets) {
    for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const d = m[2]
      const ratio = d.match(/(?:^|[;\s])aspect-ratio\s*:\s*([^;}]+)/)
      if (!ratio) continue
      if (!/(?:^|[;\s])(min-height|min-block-size|min-width|min-inline-size)\s*:\s*(?!0\b)[^;}]+/.test(d)) continue
      both++
      /* A RULE THAT TURNS THE RATIO OFF HAS NO RATIO TO FIGHT. */
      if (/^\s*auto\b/.test(ratio[1])) { ratioOff++; continue }
      if (/(?:^|[;\s])(max-inline-size|max-width)\s*:/.test(d)) capped++
    }
  }
  assert(both >= 1, `at least one rule states a ratio and a minimum together (${both})`)
  assert(capped + ratioOff === both,
    `every one of them caps its inline size or turns the ratio off (${capped} capped, ${ratioOff} off, of ${both})`)
  /* AND THE CAP IS ON THE PLOT, which is the instance the fault came from. */
  {
    const plot = (sheets[0].match(/\.dmd \.chart \.chart-plot \{[^}]*\}/) || [''])[0]
    assert(/max-inline-size:\s*100%/.test(plot),
      'the chart plot caps at its own track, so the floor beats the ratio')
    assert(/min-block-size:\s*140px/.test(plot),
      'and keeps the floor, because a plot too short to read a value in is the fault it prevents')
  }
}

/* ── A MENU CONTROL IS A SIBLING OF THE ACTION GROUP ──
 *
 * This rule sat as a checklist line because I could not make it fire, and the
 * reason was never the rule. Three faults, each measured:
 *
 * THE SELECTOR. The first draft asked for a disclosure OR aria-expanded OR
 * aria-haspopup. 4 candidates on this app and 3 were wrong: two chrome
 * dropdowns and a readout, none of them navigation.
 *
 * WHAT IT OPENS IS NOT REACHABLE. The navigation list is not a child, not a
 * sibling and not an aria-controls target. Measured 0 of 4, our own correct
 * control included, so that discriminator does not exist in the DOM. Two
 * shapes do say menu: a disclosure, and a BURGER read by its boxes — three or
 * four bars of one size, wider than tall, no words. Exactly 1 match on the
 * page, at 16x2 three times.
 *
 * THE HEAD WINDOW. Four levels of ancestor put every chrome dropdown on a
 * page head. Two levels, with the heading a child or a grandchild.
 *
 * AND THE INJECTION WAS REVERTED BEFORE THE CHECK READ IT. Moving the control
 * in the live DOM looked like an injection and React put it back during
 * settle(), so the check read correct markup and reported nothing. The fix is
 * to inject in the SOURCE. Proven both ways: the menu inside a 4-button group
 * fires, a wrapper holding ONE other button fires, and nine surfaces are
 * silent.
 */
{
  line('\n- a menu control is a sibling of the action group -')
  const { CHECKS: CH9 } = await import('../src/emit/checks.js')
  const c9 = CH9.find(x => x.id === 'a-menu-control-is-a-sibling-of-the-action-group')
  assert(!!c9 && c9.where === 'render', `the check ships and runs in a browser (${c9?.where})`)
  const t9 = (c9?.body || []).join('\n')
  assert(/details > summary/.test(t9), 'it admits the disclosure shape')
  assert(/kids\.length < 3 \|\| kids\.length > 4/.test(t9),
    'and a BURGER by its boxes, which is three or four bars')
  assert(/Math\.abs\(b\.width - w\)/.test(t9) && /Math\.abs\(b\.height - h\)/.test(t9),
    'measured as one size, so the reader can name the class anything')
  assert(/if \(h >= w\) return false/.test(t9),
    'and wider than tall, or a column of three dots would count')
  assert(!/aria-expanded|aria-haspopup/.test(t9),
    'it does NOT ask aria-expanded, which was 3 false positives out of 4 candidates')
  assert(/i < 2/.test(t9),
    'the head window is two levels, because four put a chrome dropdown on a page head')
  assert(/others\.length < 1/.test(t9),
    'one other action is already a group, because a group of two still wraps as a unit')
  assert(/!ctrl\.contains\(b\)/.test(t9),
    'and the control own subtree is not counted as an action beside it')
  assert(/p !== head/.test(t9),
    'the walk stops at the head, so the head own buttons never make it a group')
  assert(/UNMEASURED/.test(t9),
    'a run that saw no menu control says so, because the control is display: none above the fold width')

  /* THE REPAIR IT GUARDS. The Dashboard menu is a SIBLING of its action
     group. Blank the comments first: the note beside it quotes the rule, so a
     raw scan finds its own explanation. */
  {
    const dash = fs.readFileSync(new URL('../src/preview/screens/Dashboard.jsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    const open = dash.indexOf('className="row page-actions')
    assert(open > 0, 'the Dashboard head carries an action group')
    /* Walk div tags from that opening tag to its match, so the test asks
       CONTAINMENT rather than line order. */
    let i = dash.indexOf('>', open) + 1, depth = 1, end = -1
    while (i < dash.length && depth > 0) {
      const nx = dash.slice(i).search(/<\/?div\b/)
      if (nx < 0) break
      i += nx
      if (dash.slice(i, i + 5) === '</div') depth--
      else depth++
      i = dash.indexOf('>', i) + 1
      if (depth === 0) end = i
    }
    assert(end > open, 'and the group closes, so the span is measurable')
    assert(!/nav-collapse/.test(dash.slice(open, end)),
      'the menu control sits OUTSIDE it, so the ladder can keep it on the title row')
    assert(/<details className="nav-collapse">/.test(dash),
      'and it is still there to place')
  }
}

/* ── A BYLINE BELONGS TO ITS HEADING ──
 *
 * The other checklist line I had left as manual, and the mechanism half was
 * already checked. `one-writer-for-one-gap` was reporting SIX live faults when
 * I came to write this: a `stack-sm` publishing a 12px row-gap under the byline
 * default's 4px margin, measured 16px.
 *
 * FIVE WERE REAL, and the fix is structural. A gap belongs to the container and
 * a margin to the child, and a child cannot ask what its parent declared, so
 * neither one can subtract the other. The pair becomes ONE child of the stack:
 * it owns its 4px and the stack still separates it from what follows. Three
 * empty states, a record card and a dialog page head. Measured after: 44 pairs,
 * every container gap 0, every margin 2 or 4.
 *
 * THE SIXTH WAS A SPECIMEN SHEET, which is correct code. A heading specimen
 * above a caption specimen is two samples, not a pair. That check now skips on
 * the marker three others already read, and it still fires on an injected 20px
 * doubled gap outside a sheet.
 *
 * THE STEP IS THE OTHER HALF, and this check asks it. At 0 the byline reads as
 * a second line of the heading and at 12 as a floating paragraph. Both were
 * shipped faults here. Proven both ways from the source: a 12px margin fires,
 * a 0px margin fires, and nine surfaces are silent.
 */
{
  line('\n- a byline belongs to its heading -')
  const { CHECKS: CHB } = await import('../src/emit/checks.js')
  const cb = CHB.find(x => x.id === 'a-byline-belongs-to-its-heading')
  assert(!!cb && cb.where === 'render', `the check ships and runs in a browser (${cb?.where})`)
  const tb = (cb?.body || []).join('\n')
  assert(/tokenValue\("--space-2xs"\)/.test(tb),
    'it reads the step off the token rather than stating 4px')
  assert(/\.caption, \.small, \.muted, \.subtle/.test(tb),
    'the subject is a secondary type class, so body copy under a heading is not a byline')
  assert(!/, p"|"p,/.test(tb),
    'and a bare paragraph is out: with p in the list, 12 of 46 pairs were card flow')
  assert(/data-specimen/.test(tb),
    'a specimen sheet is exempt, because two samples in a run are not a pair')
  assert(/ps\.rowGap/.test(tb) && /marginBlockStart/.test(tb),
    'it reads the DECLARED distance, because an inline heading reports its ink box')
  assert(/d < 0\.5/.test(tb),
    'and it fires at zero too, where the byline reads as a second line of the title')
  assert(/UNMEASURED/.test(tb), 'a page with no such pair says so')

  /* AND THE ONE-WRITER CHECK KEEPS THE SPECIMEN GUARD, or the sixth finding
     comes back on correct code. */
  const ow = CHB.find(x => x.id === 'one-writer-for-one-gap')
  assert(/data-specimen/.test((ow?.body || []).join('\n')),
    'one-writer-for-one-gap skips a specimen sheet, which was its only false positive')

  /* THE FIVE STRUCTURAL REPAIRS, so none can drift back. Each pair is ONE
     child of the stack that publishes the gap. */
  {
    const files = {
      'screens/Empty.jsx': 'strong className="t-h5"',
      'screens/Record.jsx': "strong className=\"t-h6\" {...txt('h6')}>{L('Reconciliation notes')}",
      'screens/Dialog.jsx': 'h3 className="t-h4"',
    }
    for (const [rel, needle] of Object.entries(files)) {
      const src = fs.readFileSync(new URL('../src/preview/' + rel, import.meta.url), 'utf8')
      const at = src.indexOf(needle)
      assert(at > 0, `${rel} still holds the pair`)
      /* THE TAG THAT OPENS THE PAIR IS A BARE DIV, never the gapped stack.
         Blank the JSX comments first: each repair carries a note that names
         `stack-sm`, and a raw scan finds its own explanation. */
      const before = src.slice(0, at - 1)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => m.replace(/[^\n]/g, ' '))
      const tags = before.match(/<[a-zA-Z][^>]*>/g) || []
      const last = tags[tags.length - 1] || ''
      assert(last.trim() === '<div>',
        `${rel} opens the pair with a bare div (${last.trim().slice(0, 40)}), so the stack gap cannot add to the byline margin`)
    }
  }
}

/* ── A NAVIGATION ROW NEVER BECOMES A STRIP ──
 *
 * Three drafts, and only the DECLARATION can fire.
 *
 * COUNTING DISTINCT TOPS FAULTS EVERY RAIL. A column gives each item its own
 * top, which is the shape the rule prescribes at a wide width. 10 findings over
 * four widths, each a rail with items equal to lines: 6 of 6, 7 of 7, 4 of 4.
 *
 * AND IT FAULTS A NOWRAP ROW TOO. Two items of different heights on ONE flex
 * line have two tops unless something stretches them. The app chrome carries
 * two such rows: 4 items, 2 tops, flex-wrap nowrap. 54 findings over 27
 * surface-width cells, all correct code.
 *
 * A REAL BREAK IS AN ITEM BELOW AN EARLIER ITEM'S BOTTOM. Exact, and on correct
 * code it can never fire: every navigation row here declares nowrap, so that
 * pass asked 0 candidates. A check that always measures nothing is not a check.
 *
 * SO READ THE DECLARATION. A row that PERMITS wrapping is the fault at every
 * width. Measured after: 76 navigation rows over 36 cells, 0 permitting a wrap.
 * Proven by injecting flex-wrap: wrap on the Landing nav, which fires once.
 */
{
  line('\n- a navigation row never becomes a strip -')
  const { CHECKS: CHN } = await import('../src/emit/checks.js')
  const cn = CHN.find(x => x.id === 'nav-folds')
  assert(!!cn && cn.where === 'render', `the check ships and runs in a browser (${cn?.where})`)
  const tn = (cn?.body || []).join('\n')
  assert(/column/.test(tn), 'it skips a COLUMN rail, which is the correct wide layout')
  assert(/flexWrap === "nowrap"/.test(tn),
    'and reads the declaration, because a row that permits wrapping is the fault at every width')
  assert(/r\[i\]\.top >= r\[i - 1\]\.bottom/.test(tn),
    'a non-flex row keeps the geometric break, measured against an earlier item bottom')
  assert(!/tops\.length/.test(tn),
    'it does NOT count distinct tops, which faulted every rail and every nowrap row')
  assert(/UNMEASURED/.test(tn), 'and a page with no navigation row says so')

  /* NOWRAP IS THE INITIAL VALUE, so correct code passes by not asking for wrap.
     The check fails a build that STATES wrap on a nav row, and it does not
     demand a stated nowrap. One row does state it, and that one is load-bearing:
     a general `.row { flex-wrap: wrap }` in the narrow block reached the Landing
     header and broke it, so the bar row states nowrap to win that. */
  {
    const rr = fs.readFileSync(new URL('../src/preview/responsive.rules.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    assert(/\.row\.bar-row \{[^}]*flex-wrap:\s*nowrap/.test(rr),
      'the header bar row states nowrap, against the general row-wrap rule in the same block')
    assert(/\.dmd \.row \{[^}]*flex-wrap:\s*wrap/.test(rr),
      'and that general rule is real, which is why the bar row has to state its own')
  }
}

/* ── STAYING WITH THE TITLE BEATS BEING RIGHTMOST ──
 *
 * Both halves cannot be asked at once. While the action group shares the row,
 * the menu is deliberately NOT rightmost among the buttons, and faulting that
 * would fault the rule. So the check asks only where the group has left the
 * row: the menu is still on the title line, and it sits at the end of that line.
 *
 * Measured over four surfaces and five widths: the menu shares the title line
 * on Dashboard and Settings at 296, 320, 480 and 640, the group is on its own
 * line in all eight, and the menu right edge equals the head right edge
 * exactly. Above 768 the control is display: none.
 *
 * Proven both branches from the source. `order: 9` sends the menu down with the
 * group and fires. A 40px right margin leaves it short of the row end and fires
 * with the measured 40.
 */
{
  line('\n- staying with the title beats being rightmost -')
  const { CHECKS: CHS } = await import('../src/emit/checks.js')
  const cst = CHS.find(x => x.id === 'staying-with-the-title-beats-being-rightmost')
  assert(!!cst && cst.where === 'render', `the check ships and runs in a browser (${cst?.where})`)
  const ts = (cst?.body || []).join('\n')
  assert(/if \(shares\) continue/.test(ts),
    'it asks nothing while the group shares the row, because the menu is not last there by design')
  assert(/paddingRight/.test(ts),
    'and measures the row end from the head CONTENT edge, since a reader head carries padding')
  assert(/acts\.length >= 2/.test(ts),
    'the group is a run of pressable siblings, never a class name')
  assert(/bars = el =>/.test(ts),
    'and the menu detector is the same two shapes the sibling rule uses')
  assert(/UNMEASURED/.test(ts),
    'a page where the group never leaves the row says so, because neither half exists yet')
}

/* ── A FLEXIBLE BOX HOLDS ITS OWN LABEL ──
 *
 * The first draft asked only whether the widest line of the box's own text is
 * wider than its content box. 417 candidates, 3 findings, all chart tick labels
 * at 296px: 21 to 23px of text in a 19px box, every one correct code. A tick
 * column is extended by half a line at each end, so the label overhangs on
 * purpose and stays fully readable.
 *
 * So the second condition is that the box CUTS the word: it clips on the inline
 * axis, or breaks the word. An ellipsis is truncation somebody asked for.
 * Measured after: 550 candidates over 36 cells, 3 overhangs skipped, 0 findings.
 * Proven by clipping a 460.64px word into a 122px box, which fires.
 */
{
  line('\n- a flexible box holds its own label -')
  const { CHECKS: CHF } = await import('../src/emit/checks.js')
  const cf = CHF.find(x => x.id === 'a-flexible-box-holds-its-own-label')
  assert(!!cf && cf.where === 'render', `the check ships and runs in a browser (${cf?.where})`)
  const tf = (cf?.body || []).join('\n')
  assert(/flexGrow\) < 1/.test(tf) && /minWidth === "0px"/.test(tf),
    'it asks the shape the rule is about: it grows, and it may shrink to nothing')
  assert(/createRange/.test(tf) && /getClientRects/.test(tf),
    'and measures the widest single LINE rect, never scrollWidth')
  assert(/nodeType !== 3/.test(tf),
    'over the box own text nodes, so a long word in a descendant is that descendant question')
  assert(/clips \|\| breaks|!clips && !breaks/.test(tf),
    'an overhang is readable, so the fault needs the box to clip or break the word')
  assert(/textOverflow === "ellipsis"/.test(tf),
    'and an ellipsis is truncation somebody asked for')
}

/* ── TWO RULES OF ONE WEIGHT DO NOT STACK ──
 *
 * 84 findings on the first draft, two causes, all correct code.
 *
 * A ROW OF CELLS ON ONE y IS ONE RULE. Three table cells each carry a bottom
 * border and paint one line across the row. Counting each cell separately
 * reported three stacked rules at a single y, at 1001, 1058, 1115 and 1172.
 *
 * AN OUTLINE IS NOT A DIVIDER. A box bordered on all four sides is a control or
 * a card, and its edges divide nothing. Three buttons in one row gave three top
 * edges at one y.
 *
 * Measured after: 34 distinct rules over nine surfaces, 0 stacks. Proven by
 * three 1px borders inside 32px, which fires once.
 */
{
  line('\n- two rules of one weight do not stack -')
  const { CHECKS: CHR } = await import('../src/emit/checks.js')
  const cr = CHR.find(x => x.id === 'two-rules-of-one-weight-do-not-stack')
  assert(!!cr && cr.where === 'render', `the check ships and runs in a browser (${cr?.where})`)
  const tr = (cr?.body || []).join('\n')
  assert(/new Map\(\)/.test(tr) && /Math\.round\(y\)/.test(tr),
    'it keys one entry per painted line, so a row of cells on one y is one rule')
  assert(/bt > 0 && bb > 0 && bl > 0 && br > 0/.test(tr),
    'and a box bordered on all four sides is an outline, never a divider')
  assert(/c\.y - a\.y > 43/.test(tr),
    'the window is 43px, which is the distance the rule was measured at')
  assert(/r\.width < 24/.test(tr),
    'a rule crosses something, so a narrow edge is ornament')
  assert(/i \+= 2/.test(tr),
    'and one stack reports once rather than three times')
}

/* ── THE THEME CHECK PRESSED A CONTROL THAT ITS OWN PRESS DESTROYS ──
 *
 * Found while injecting a fault for another check: the reported colour did not
 * match the colour I had just measured. Two defects, and together they made the
 * run report a working toggle as dead AND leave the page in the other theme.
 *
 * THE PRESS REPLACES THE ELEMENT. The control re-renders, so a held reference
 * is detached: getComputedStyle returns empty strings and the second click
 * lands on nothing. Measured: the preview was dark at rgb(14, 23, 32) before a
 * run and light at rgb(213, 221, 228) after it. Every check ordered later
 * measured the other theme, which is how a finding appears and vanishes between
 * two runs of one build.
 *
 * AND `document.body` IS NOT ALWAYS THE PAINTED SUBJECT. An app hosting a
 * preview themes the preview scope. The body read rgb(9, 10, 11) before and
 * after six presses while the control's own label changed. 9 findings over nine
 * surfaces, every one a working control.
 *
 * Measured after: the theme is unchanged across nine verify() runs, and the
 * check reports nothing.
 */
{
  line('\n- the theme check puts the theme back -')
  const { CHECKS: CHT } = await import('../src/emit/checks.js')
  const ct = CHT.find(x => x.id === 'the-toggle-actually-toggles')
  assert(!!ct, 'the check still ships')
  const tt = (ct?.body || []).join('\n')
  assert(/const find = \(\) => document\.querySelector\(SEL\)/.test(tt),
    'it re-finds the control by selector, because the press re-renders it')
  assert(!/const btn = document\.querySelector/.test(tt),
    'and never holds the reference across a press')
  assert(/const paint = \(\)/.test(tt) && /querySelectorAll\("\[class\]"\), 0, 60/.test(tt),
    'it compares a bounded fingerprint of the painted page, not one node')
  assert(/while \(paint\(\) !== before && tries < 3\)/.test(tt),
    'it presses until the page is back, because a three-way field needs more than one')
  assert(/measured a different theme/.test(tt),
    'and says so when it could not restore, since every later check then reads the other theme')
  assert(/nothing to press/.test(tt) && !/no theme control found/.test(tt),
    'a page with no control is a note, not a fault: it reported 6 of 9 correct surfaces')
}

/* ── A DEFAULT GOES FIRST IN THE FILE, AND ONLY A PARSER CAN ASK IT ──
 *
 * The render pass reads a computed value and has no opinion about which rule
 * won or where it sat. Order in the file is the whole question.
 *
 * Measured on this stylesheet: the container-flow default sits at line 104 and
 * the first other block-start margin at 172, over 13 such rules. The other two
 * sheets publish no flow default and are skipped. The zeroing exemptions are
 * not defaults and may follow it, which is why the check compares the first
 * flow default against the first rule that is not one.
 *
 * The fault is in `broken.css` now, so the shipped check is proven both ways by
 * the two fixtures above: it fires on the injected default written last, and
 * stays quiet on the clean fixture, which publishes no flow default at all.
 */
{
  line('\n- a default goes first in the file -')
  const { CHECKS: CHD } = await import('../src/emit/checks.js')
  const cd = CHD.find(x => x.id === 'a-default-goes-first-in-the-file')
  assert(!!cd && cd.where === 'source', `the check ships and reads the source (${cd?.where})`)
  const td = (cd?.body || []).join('\n')
  assert(/f\.bare\b/.test(td), 'it reads the comment-blanked text, so a rule quoted in prose is not a rule')
  assert(/margin\(-block-start\|-top\)/.test(td), 'and both spellings of the property')
  assert(/flowAt < otherAt/.test(td),
    'the flow default has to come first, because both weigh the same and order decides the tie')

  /* AND OUR OWN STYLESHEET OBEYS IT, measured rather than assumed. */
  {
    const bare = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    let flowAt = -1, otherAt = -1
    const re = /([^{}@]+)\{([^{}]*)\}/g
    let m
    while ((m = re.exec(bare))) {
      if (!/(^|[;{\s])margin(-block-start|-top)\s*:/.test(m[2])) continue
      if (/>\s*\*\s*\+\s*\*/.test(m[1])) { if (flowAt < 0) flowAt = m.index }
      else if (otherAt < 0) otherAt = m.index
    }
    assert(flowAt >= 0, 'the preview stylesheet publishes a container-flow default')
    assert(flowAt < otherAt, `and it sits ahead of every component stating its own distance (${flowAt} < ${otherAt})`)
  }
}

/* ── AN ORNAMENT COLUMN TAKES ITS CONTENT ──
 *
 * The subject is a property of the cells, never a class: every cell in the
 * column holds a pressable thing and none holds text.
 *
 * THE TEST IS ITS OWN CONTENT, not a comparison with another column. A
 * row-action column holding three buttons is legitimately wider than a narrow
 * data column, so "the narrowest column" is the wrong question. Measured on the
 * one instance here: 16px of drawn box plus 28 and 16 of padding is 60, and the
 * column measures 60.00 exactly.
 *
 * Proven by setting that column to 200px, which fires with 137.14px of slack.
 */
{
  line('\n- an ornament column takes its content -')
  const { CHECKS: CHO } = await import('../src/emit/checks.js')
  const co = CHO.find(x => x.id === 'an-ornament-column-takes-its-content')
  assert(!!co && co.where === 'render', `the check ships and runs in a browser (${co?.where})`)
  const to = (co?.body || []).join('\n')
  assert(/textContent\.trim\(\)\.length/.test(to),
    'an ornament column holds words in no cell, which is a property rather than a class')
  assert(/cells\.every/.test(to),
    'and a control in every cell, so one stray button does not make a data column ornament')
  assert(/content >= inner - 1/.test(to),
    'a stretched child cannot answer this, so it says so rather than passing')
  assert(/slack <= 2/.test(to),
    'and the threshold is on the slack in whole pixels')

  /* THE DECLARATION IT GUARDS. `width: 1%` means content and no more. */
  {
    const css = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
    const rule = (css.match(/\.dmd \.table \.sel-col \{[^}]*\}/) || [''])[0]
    assert(/width:\s*1%/.test(rule), 'the selection column takes width: 1%, which is its content and no more')
    assert(/min-width:\s*var\(--target-min/.test(rule),
      'with a floor at the touch target, because a 16px box asks for less than the minimum')
  }
}

/* ── A BROKEN ACTION ROW IS RANKED, AND THE AXIS DOES NOT DECIDE IT ──
 *
 * The documented structure is a COLUMN whose children are pair rows, so a
 * flex-direction guard excluded the very shape the rule prescribes. Measured:
 * the Dashboard action group reads column at 296px, holding two pairs and four
 * buttons on two lines. Asking the axis reported 0 candidates over 36 cells.
 *
 * THE DISCRIMINATOR IS THE BUTTON WIDTH. A stated one-per-line column gives
 * every button the full width, which is a different deliberate arrangement:
 * `.stack-narrow-rev > .btn { width: 100% }`. Three buttons each on their own
 * line at full width is not a wrapped run.
 *
 * Measured after: 8 wrapped runs asked, 6 stated columns skipped, 0 findings.
 * The two real shapes are [2,2] for an even count and [1,2] for an odd one.
 *
 * Proven both branches from the source. A third button inside one pair fires
 * with [3,2]. Reversing the Record group to column-reverse fires with [2,1].
 */
{
  line('\n- a broken action row is ranked -')
  const { CHECKS: CHA } = await import('../src/emit/checks.js')
  const ca = CHA.find(x => x.id === 'action-row-is-ranked')
  assert(!!ca && ca.where === 'render', `the check ships and runs in a browser (${ca?.where})`)
  const ta = (ca?.body || []).join('\n')
  assert(!/flexDirection/.test(ta),
    'it does NOT read the axis, because the prescribed structure is a column of pairs')
  assert(/inner - 2/.test(ta),
    'a one-per-line column at full width is a stated arrangement and is skipped')
  assert(/lines\.size < 2/.test(ta),
    'and a row that still fits on one line is not broken yet')
  assert(/perLine\.some\(k => k > 2\)/.test(ta), 'never more than two per line')
  assert(/btns\.length % 2 === 1 && perLine\[0\] !== 1/.test(ta),
    'and an odd count puts the primary alone on the FIRST line')
  assert(/UNMEASURED/.test(ta), 'a page with no broken action row says so')

  /* THE PRIMITIVES BOTH BRANCHES READ. */
  {
    const rr = fs.readFileSync(new URL('../src/preview/responsive.rules.css', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    assert(/\.stack-narrow-rev > \.btn|\.stack-narrow > \.btn[^{]*\{[^}]*width:\s*100%/.test(rr),
      'the stated column gives every button the full width, which is what the guard reads')
  }
}

/* ── ALIGNMENT IS STATED, NEVER INHERITED ──
 *
 * The geometry alone faults correct code, 13 times out of 13. A flex row whose
 * last child sits at the content end, where neither the row nor that child
 * declares it, and where a sibling absorbed the slack: 69 candidates over nine
 * surfaces and 13 such rows. Every one is the mechanism working. A pair grows
 * its labelled button so the icon keeps its square. An alert grows its body so
 * the action sits at the end. A row grows its field so the button does.
 *
 * THE MISSING HALF IS WHETHER THAT SIBLING CAN VANISH, and only the CSS knows.
 * The CSSOM cannot answer it in a dev server: 25 condition blocks found and 0
 * rules inside them read as display: none, while the source holds 5. So read
 * the stylesheet TEXT, find each at-rule block by its braces, and collect the
 * selectors inside it that hide something. Measured: 5 sheets, 352,059 bytes,
 * 6 hide selectors, matching the source. 13 candidates asked, 0 findings.
 *
 * Proven by a row holding a growing `.nav-label` and a button, which is the
 * shape the original fault had. It fires once and names both elements.
 */
{
  line('\n- alignment is stated, never inherited -')
  const { CHECKS: CHAL } = await import('../src/emit/checks.js')
  const cal = CHAL.find(x => x.id === 'alignment-is-stated-never-inherited')
  assert(!!cal && cal.where === 'render', `the check ships and runs in a browser (${cal?.where})`)
  const tal = (cal?.body || []).join('\n')
  assert(/querySelectorAll\("style"\)/.test(tal) && /link\[rel=stylesheet\]/.test(tal),
    'it reads the stylesheet TEXT, because the CSSOM returned 0 of 5 hide rules in a dev server')
  assert(/@\(media\|container\|supports\)/.test(tal),
    'and walks each at-rule block by its braces, so a rule inside one is known to be conditional')
  assert(/display\\s\*:\\s\*none/.test(tal),
    'collecting the selectors inside those blocks that set display: none')
  assert(/canVanish/.test(tal),
    'the growth is the mechanism unless that sibling can disappear, which was 13 of 13')
  assert(/style\.getPropertyValue\(prop\) === "auto"/.test(tal) && /autoSel/.test(tal),
    'and an auto margin comes from the declaration, because computed style reports 0px for one')
  assert(/!bare\.length/.test(tal),
    'a run that read no stylesheet text says so rather than reporting clean')
  assert(/justifyContent/.test(tal),
    'a row that states the end itself is skipped, because nothing is inherited there')
}

/* ── THE BROWSER VERIFIER HAD NO SCOPE ──
 *
 * Every query ran over the whole document, which is right for a page you built
 * and wrong for an editor that renders your document inside itself.
 *
 * Measured on this app, nine surfaces, one run: 619 findings, and the three
 * biggest were 529 of them. Every one sat in MDexed's own interface.
 *
 *   target-floor-for-the-pointer            297 findings, 0 in the document
 *   a-standalone-figure-keeps-the-body-face  12 chips,    0 in the document
 *   nothing-clipped-out-of-reach            967 options,  0 in the document
 *
 * So verify() takes a root: an element, or a selector that matches exactly
 * one. Pass nothing and it is the whole document, which is what a built page
 * wants. Measured after, same nine surfaces: 619 findings document-wide and 81
 * scoped to the preview frame.
 *
 * AND THE TOKEN READER HAD THE SAME HOLE. It read document.documentElement, so
 * a hosted document's own tokens were invisible and every check fell back to
 * its literal. The scope element answers both cases, because a custom property
 * inherits.
 */
{
  line('\n- the browser verifier takes a scope root -')
  const { verifyBrowserFile } = await import('../src/emit/verify.js')
  const text = verifyBrowserFile({ meta: {} })
  assert(/function verify \(root\)/.test(text), 'verify() takes a root')
  assert(/s\.querySelectorAll\(sel\)/.test(text),
    'every query resolves the scope again, so a re-render cannot leave it holding a detached node')
  assert(!/const all = sel => Array\.prototype\.slice\.call\(document\./.test(text),
    'and none goes straight to the document any more')
  assert(/const scopeEl = \(\)/.test(text) && /getComputedStyle\(el\)\.getPropertyValue/.test(text),
    'the token reader reads the scope element, never the root, because a hosted document sets its own')
  assert(/found\.length !== 1/.test(text) && /is not a root/.test(text),
    'a selector matching zero or many says so rather than measuring the wrong thing')
  assert(/root=/.test(text), 'and the verdict names the root it measured')

  /* ── A LOST ROOT REFUSES, IT DOES NOT WIDEN ──
   *
   * Falling back to the document turns a scoped run into an unscoped one in
   * silence, and the findings then describe whatever hosts the document.
   *
   * Measured on this editor at 1440px: the first run reported 3 findings and
   * the second 86. One check presses the theme control, that control sits
   * INSIDE the preview, and pressing it writes the document and mounts 17
   * component samples. Each carries the document root's class, so the root
   * went from 1 element to 18 and every later query ran over the chrome. 83
   * of the 86 were the editor's own interface.
   *
   * So the scope returns null, every query comes back empty, and the run says
   * it measured nothing. An empty run is loud; a widened one reads as a page
   * full of faults. */
  assert(/scopeLostWhy/.test(text), 'a lost root records WHY, not merely that it happened')
  assert(/if \(s === null\) return \[\]/.test(text),
    'and a query with no root returns nothing rather than the whole page')
  assert(/return \{ pass: false, findings: \[\], rootAmbiguous/.test(text),
    'an ambiguous root at the door refuses the run instead of widening it')
  assert(!/so the whole document was measured instead/.test(text),
    'the old fallback wording is gone, not merely unreachable')

  /* ── AND A CHECK THAT PRESSES SOMETHING RUNS LAST ──
   * The restore press does put the theme back. It cannot unmount what the
   * change mounted, so ORDER is the fix rather than a better restore. */
  const runIds = [...text.matchAll(/await run\("([a-z0-9-]+)"/g)].map(m => m[1])
  assert(runIds.length > 40, `the run order is readable (${runIds.length} checks)`)
  const pressers = runIds.filter(id => {
    const at = text.indexOf('await run("' + id + '"')
    const end = text.indexOf('await run("', at + 10)
    return text.slice(at, end < 0 ? undefined : end).includes('.click()')
  })
  assert(pressers.length >= 1, `at least one check presses something (${pressers.join(', ')})`)
  assert(pressers.every(id => runIds.indexOf(id) >= runIds.length - pressers.length),
    `and every one of them is ordered last (${pressers.map(id => runIds.indexOf(id) + 1).join(', ')} of ${runIds.length})`)

  /* ── THE STALE ROOT COST A FALSE CLEAN RUN, SO IT IS PINNED ──
   *
   * The first version stored the element. One check presses the theme control,
   * that press re-renders the frame, and the stored element is detached.
   * querySelectorAll still walks its descendants and every rect comes back
   * empty, so every check after that press measured NOTHING and reported
   * clean. Measured: an injected 280px clipping fault returned 0 findings while
   * the same logic replayed by hand found it. The root captured before the run
   * was a different element from the one in the page after it.
   */
  /* ONE HELPER OUTSIDE THE SCOPE DEFEATS THE SCOPE. rows() queried the document
     directly, so 11 findings survived a scoped run and every one sat in the
     host's own interface. Measured after: the nine-surface run went 28 to 19. */
  assert(!/for \(const parent of document\.querySelectorAll/.test(text),
    'the row bander goes through the scope too, or a scoped run still measures the host')
  assert(/const scopeRoot = scope\(\)/.test(text) && /for \(const parent of scopeRoot\.querySelectorAll/.test(text),
    'and it resolves the scope the same lazy way every query does')

  assert(/let scopeLost = false/.test(text), 'a lost root is recorded rather than measured around')
  assert(/document\.contains\(SCOPE_EL\)/.test(text),
    'an element root is watched, because a re-render replaces it')
  assert(/the root stopped being a root during this run/.test(text),
    'and the run says so loudly, since a lost root measures nothing and reads as clean')
  /* A SHORT NEEDLE, because the message is built by concatenation and the
     emitted file carries the join. Matching across it pins the formatting
     rather than the wording. */
  assert(/incomplete rather than clean/.test(text),
    'naming what the short list means, because a truncated clean run reads as a clean page')
  /* The reader-facing instruction still works with no root. */
  assert(/await verify\(\)/.test(text), 'a built page still runs verify() with nothing')
  assert(/await verify\('\.my-document-root'\)/.test(text),
    'and the header shows the hosted form')
}

/* ── A COLUMN IS A RELATIONSHIP, NOT A TAG ──
 *
 * The mono-face check exempted `table, code, pre, kbd, samp` and nothing else,
 * which is the tag-list fault: it found the case somebody thought of and
 * approved none of the others. A chart tick column is a run of values read down
 * the page, so the mono face is exactly right there, and the check faulted all
 * 49 of them.
 *
 * Two figures sharing an inline edge at different heights ARE a column. Same
 * top is a ROW of figures, which stacks nothing. Measured over four surfaces:
 * 68 figures and 0 in the mono face with no column beside them. Charts read 52
 * of 52 in a column, the Dashboard 4 table cells in one, and its three stat
 * tiles keep the body face.
 *
 * Retested by injection: a lone `.figure` reading 42, offset so it shares no
 * edge, fires.
 *
 * Scoped and with the select fix, the nine-surface run went 77 findings to 28.
 */
{
  line('\n- a column is a relationship, not a tag -')
  const { CHECKS: CHFG } = await import('../src/emit/checks.js')
  const cfg = CHFG.find(x => x.id === 'a-standalone-figure-keeps-the-body-face')
  assert(!!cfg && cfg.where === 'render', `the check ships and runs in a browser (${cfg?.where})`)
  const tfg = (cfg?.body || []).join('\n')
  assert(/const figs = \[\]/.test(tfg),
    'it collects every figure first, because a column is a relationship between them')
  assert(/const inColumn = f => figs\.some/.test(tfg), 'and asks whether each one is in a column')
  assert(/Math\.abs\(o\.r\.top - f\.r\.top\) >= 2/.test(tfg),
    'a shared TOP is a row of figures, which stacks nothing')
  assert(/Math\.abs\(o\.r\.left - f\.r\.left\) < 2 \|\| Math\.abs\(o\.r\.right - f\.r\.right\) < 2/.test(tfg),
    'and a shared inline edge is what makes it a column')
  assert(/closest\('code, pre, kbd, samp'\)/.test(tfg),
    'a code context keeps its own exemption, because a lone number there is meant to be mono')
  assert(/closest\('table'\)/.test(tfg),
    'and a table cell is a column by construction, even where one row shows')
  assert(/UNMEASURED/.test(tfg), 'a page with no figure says so')
}

/* ── A CHECKBOX BOX IS NOT AN ICON BESIDE A LABEL ──
 *
 * The rule was already written down and the check had not read it. A drawn
 * checkbox box is filled and square, so the mark finder picks it up and
 * compares it against the cap band. The reader sees the BOX, and the tick
 * inside it is ornament: its size answers to control sizing, the 24px minimum
 * and the 44px target.
 *
 * Measured: 5 findings on this app, every one a checkbox at 4.76px above the
 * cap against 1.24 below. The test is a SIBLING native input, which is exact,
 * because a container holding one IS the control's own row. After: 2 findings,
 * and the nine-surface scoped run went 19 to 16.
 *
 * Retested by injection: a label holding an svg shifted 6px fires with -2
 * above and 6 below.
 */
{
  line('\n- a checkbox box is not an icon beside a label -')
  const { CHECKS: CHIC } = await import('../src/emit/checks.js')
  const cic = CHIC.find(x => x.id === 'icon-on-the-cap-band')
  assert(!!cic, 'the icon check still ships')
  const tic = (cic?.body || []).join('\n')
  /* ASK THE HOLDER, NOT THE MARK'S PARENT. The tick is an svg INSIDE the drawn
     box, and the mark finder takes an svg first, so its parent is that box and
     holds no input. Two findings survived the narrower test: 17 to 15. */
  assert(/el\.querySelector\('input\[type=checkbox\], input\[type=radio\]'\)/.test(tic),
    'it skips a holder that contains a native checkbox or radio, which is that control own row')
  assert(!/mark\.parentElement\.querySelector/.test(tic),
    'never the mark PARENT, because the tick sits inside the drawn box and that box holds no input')
  assert(/svg, img/.test(tic), 'and a real icon is still found first')
}

/* ── THE COLOUR SECTION: THREE RULES A MACHINE COULD ASK AND NOTHING DID ──
 *
 * Worked from the coverage tool's gap list, colour first, 9 September 2026.
 * Eighteen rules read as gaps there and fifteen were a WORDING miss: the rule
 * is checked and the check words it differently. These three were real.
 *
 * Each one was implemented in the source and unread by any test, which is the
 * shape that lets a constant drift while every run stays green.
 */
{
  line('\n- the chroma envelope is asymmetric, and the ratio is physics -')
  const { inGamut } = await import('../src/color/convert.js')
  const { DARK_FLOOR } = await import('../src/color/ramp.js')

  /* The most chroma sRGB holds at this lightness and hue. The rule states it
     was measured by bisecting `inGamut`, so the test measures it the same way
     rather than quoting the answer. */
  const peak = (l, h) => {
    let lo = 0, hi = 0.5
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (inGamut({ mode: 'oklch', l, c: mid, h })) lo = mid
      else hi = mid
    }
    return lo
  }

  const seeds = createInitialState().color.seeds
  const hueOfSeed = name => {
    const s = seeds.find(x => x.name === name)
    return toOklchObj(parseColorFor(s.hex)).h ?? 0
  }

  /* ── THE FLOOR IS A NEUTRAL'S NUMBER, SO MEASURE AT A NEUTRAL'S HUE ──
   * The dark ground comes off the neutral ramp, and the accent sits three
   * degrees away from it in the shipped seed set. Measured: 3.60 at the
   * neutral's hue and 3.96 at the accent's. The rule states 3.83, which is
   * between them, and `DARK_FLOOR` is 0.2 times that. */
  const nRatio = peak(0.20, hueOfSeed('neutral')) / peak(0.97, hueOfSeed('neutral'))
  const aRatio = peak(0.20, hueOfSeed('accent')) / peak(0.97, hueOfSeed('accent'))
  assert(nRatio > 3 && nRatio < 4.5,
    `a chroma envelope that tapers symmetrically is wrong at one end: sRGB holds ${nRatio.toFixed(2)}x more at L 20 than at L 97, at the neutral own hue`)
  const shipped = DARK_FLOOR / 0.2
  assert(shipped >= Math.min(nRatio, aRatio) - 0.3 && shipped <= Math.max(nRatio, aRatio) + 0.3,
    `the dark floor is that measured ratio applied to the same 0.2, not a number picked to taste (${shipped.toFixed(2)} against ${nRatio.toFixed(2)} and ${aRatio.toFixed(2)})`)

  /* ── AND IT IS NOT A GENERAL LAW OF sRGB, WHICH THE RULE'S WORDING IMPLIES ──
   *
   * A check asserting "every hue holds more chroma at the dark end" would fail
   * on correct code. Measured over 72 hues: 17 of them invert, and they run
   * from 95 to 200 degrees. That is the cyan-green region, and it is the same
   * fact as the yellow rule three paragraphs above — a hue wide at the white
   * end is narrow at the black end. The two rules have to agree, so this pins
   * the inversion rather than pretending it is absent. */
  let inverted = 0
  for (let h = 0; h < 360; h += 5) if (peak(0.20, h) / peak(0.97, h) < 1) inverted++
  assert(inverted > 8 && inverted < 30,
    `the asymmetry inverts for a band of hues rather than holding everywhere (${inverted} of 72)`)
  const yellow = peak(0.20, 81) / peak(0.97, 81)
  assert(yellow < 2,
    `a warning yellow is the shallow case, so the floor is a neutral's rule and not a palette's (${yellow.toFixed(2)}x)`)

  /* THE LIGHT END KEEPS 0.2, because there the original premise holds. */
  assert(DARK_FLOOR > 0.2,
    `and only the dark end is raised (${DARK_FLOOR.toFixed(3)} against a light floor of 0.2)`)
}

{
  line('\n- a component own text on its own fill is a third pair -')
  /* ── THE CHECK RAN ON EVERY AUDIT AND HAD NEVER BEEN PROVEN TO FIRE ──
   *
   * `componentContrast` is inside `audit()`, so it ran in dozens of
   * assertions. Every one of them fed it a clean preset, and every preset
   * audits clean, so the path returned an empty array on every input the suite
   * ever gave it. A test with nothing in it prints the same word as a test
   * with everything.
   *
   * A TEXT ROLE THAT PASSES AGAINST THE PAGE CAN STILL FAIL HERE, which is
   * the whole reason the pair exists. `text-subtle` on the input's own fill
   * measures 4.33:1 against a 4.5 bar: 0.17 under it. So the finding depends
   * on the threshold being right rather than on an obvious black-on-black.
   */
  const clean = createInitialState()
  const CMP = s => audit(s, derive(s)).filter(f => /^cmp-contrast:/.test(f.id ?? ''))
  const inject = over => CMP({
    ...clean,
    components: { ...clean.components, overrides: { ...clean.components.overrides, ...over } },
  })

  assert(CMP(clean).length === 0, 'the shipped default has no component pair failing')

  const own = inject({ 'input.textColor': '{colors.text-subtle}' })
  assert(own.length >= 1,
    `a quiet text role on a component's own fill fires (${own.length} finding(s))`)
  assert(own.some(f => f.id === 'cmp-contrast:input:light'),
    'and it names the component, not a role')
  assert(own.every(f => f.level === 'fail'), 'a text pair under AA is a failure, never a warning')
  assert(own.some(f => /its own background/.test(f.title)),
    "a component's own text on its own fill is a third pair, and the finding says which fill it measured")
  assert(own.some(f => Number(String(f.measured).replace(':1', '')) > 4
    && Number(String(f.measured).replace(':1', '')) < 4.5),
    `the case that proves the bar is the deciding number, not the colour (${own[0]?.measured})`)

  /* THE OTHER BRANCH: a component with no fill of its own sits on the page,
     and the finding has to say which ground it measured. */
  const onPage = inject({ 'badge.textColor': '{colors.bg-subtle}' })
  assert(onPage.some(f => /the page behind it/.test(f.title)),
    'a component with no fill is measured against the page, and says so')
  assert(onPage.some(f => /:dark$/.test(f.id ?? '')) && onPage.some(f => /:light$/.test(f.id ?? '')),
    'both modes are asked, because the mode nobody measured is where the failures live')

  /* A DISABLED CONTROL IS EXEMPT UNDER 1.4.3, and the check says so. Proven
     rather than read: the same fault on a disabled variant reports nothing. */
  const dis = inject({ 'button-disabled.textColor': '{colors.bg}' })
  assert(!dis.some(f => /-disabled:/.test(f.id ?? '')),
    'a disabled control is exempt, so the fault reports on nothing disabled')
}

{
  line('\n- a heavier weight buys contrast no ratio reports -')
  /* ── THE BAR DOES NOT MOVE UNTIL 700, AND NOTHING READ THAT BRANCH ──
   *
   * Weight writes no colour channel, so hue, chroma and lightness are
   * identical and the measured ratio cannot move. The rule records the gain as
   * real and invisible: a 12px badge at 500 inks 3.6% more pixels than at 400
   * and reads 1.74:1 against its own fill where 400 reads 1.64, while the
   * nominal figure is 7.16:1 at both.
   *
   * What a machine CAN ask is the half that follows: large text is 24px, or
   * 18.66px at 700 and above, so a 500 weight is normal text whatever it looks
   * like. Measured on one badge at 20px, with only the weight changed:
   *
   *   400  3.76:1  FAIL     500  3.76:1  FAIL     600  3.76:1  FAIL
   *   700  3.76:1  passes   800  3.76:1  passes
   *
   * The ratio is the same five times. Only the bar moves, and only at 700.
   */
  const clean = createInitialState()
  const at = weight => {
    const s = {
      ...clean,
      components: {
        ...clean.components,
        overrides: {
          ...clean.components.overrides,
          'badge.textColor': '{colors.text-subtle}',
          'badge.typography': 'h5',
          'badge.fontWeight': weight,
        },
      },
    }
    const d = derive(s)
    const f = audit(s, d).find(x => x.id === 'cmp-contrast:badge:light')
    return { size: d.cssVars['--cmp-badge-font-size'], fired: !!f, measured: f?.measured ?? null }
  }

  const runs = ['400', '500', '600', '700', '800'].map(w => ({ w, ...at(w) }))
  assert(runs.every(r => r.size === '20px'),
    `every run is the same 20px, so only the weight varies (${runs[0].size})`)
  assert(runs.filter(r => r.fired).map(r => r.w).join(' ') === '400 500 600',
    `the bar is 4.5 up to 600 and 3 from 700 (fires at ${runs.filter(r => r.fired).map(r => r.w).join(' ') || 'none'})`)
  const seen = [...new Set(runs.filter(r => r.measured).map(r => r.measured))]
  assert(seen.length === 1,
    `a heavier weight buys apparent contrast that no ratio reports, so the reported ratio never moves (${seen.join(', ')})`)

  /* A SIZE UNDER 18.66 IS NORMAL TEXT AT ANY WEIGHT. Without this the 700
     branch would read as "bold is always large", which is the misreading the
     rule exists to stop. */
  const small = (() => {
    const s = {
      ...clean,
      components: {
        ...clean.components,
        overrides: {
          ...clean.components.overrides,
          'badge.textColor': '{colors.text-subtle}',
          'badge.typography': 'body-sm',
          'badge.fontWeight': '700',
        },
      },
    }
    const d = derive(s)
    return {
      size: d.cssVars['--cmp-badge-font-size'],
      fired: !!audit(s, d).find(x => x.id === 'cmp-contrast:badge:light'),
    }
  })()
  assert(small.fired,
    `a bold label under 18.66px is still normal text and still owes 4.5 (${small.size} at 700)`)
}

/* ── A VERDICT NAMES ITS OWN COVERAGE, AND THE POINTER IS HALF OF IT ──
 *
 * The responsive section, worked the same way as colour. Two rules there are
 * about the RUNNER rather than the build, and both are still checkable: the
 * runner is a file, `public/sweep-all.js`, and the suite can read it.
 *
 * The width half was already implemented and unread. The POINTER half was
 * missing outright, which is the more expensive of the two. A desktop run
 * compares every control against the 24px mouse floor and reports nothing,
 * and that reads as a verdict about a finger. Measured at a coarse pointer
 * over twelve surfaces: 16 controls under the 44px floor, from four
 * mechanisms, on a build that had passed on a mouse for weeks.
 *
 * So the verdict now says which pointer it measured and which one it did not.
 * "Eleven of eleven clean" is a claim about one width and one pointer, and it
 * has to say so in the same breath.
 */
{
  line('\n- the sweep verdict names its widths and its pointer -')
  const sweeper = fs.readFileSync(new URL('../public/sweep-all.js', import.meta.url), 'utf8')
  /* Blank the comments rather than deleting them, so a line number below is
     still the line number in the file. */
  const bare = sweeper.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

  /* THE VERDICT IS ONE OBJECT LITERAL, so read the keys it returns rather
     than searching the whole file. A name that appears in a helper proves
     nothing about what a caller is handed. */
  const verdict = bare.slice(bare.indexOf('widthsSwept:'))
  assert(verdict.length > 200, 'the runner returns a verdict object')
  assert(/allClean:/.test(verdict), 'and it carries the clean/dirty answer')
  assert(/widthsSwept:/.test(verdict) && /coverage:/.test(verdict),
    'a verdict names its own coverage, so the widths sit beside the answer')
  assert(/pointer:/.test(verdict),
    'and the pointer is the other half of that coverage, so it sits there too')
  assert(/pointerNotMeasured:/.test(verdict),
    'the run says which half was NOT measured, because a mouse run says nothing about a finger')

  /* IT READS THE POINTER, NEVER THE WIDTH. A narrow window on a desktop is
     not a finger, and that mistake is what the whole rule exists to stop. */
  assert(/matchMedia\('\(pointer: coarse\)'\)/.test(bare),
    'it asks the pointer rather than the window width')
  assert(!/innerWidth\s*<\s*\d+\s*\?\s*44/.test(bare),
    'and never guesses the floor from a width')

  /* A RUN THAT COULD NOT SET ITS WIDTH SAYS SO IN THE COVERAGE STRING. A
     `<select>` silently refuses a value it has no option for, so a run that
     cannot reach a width must report that instead of measuring one by
     accident and labelling it. */
  assert(/WIDTH CONTROL NOT FOUND/.test(bare),
    'a run that cannot reach a width says its coverage is unverified')
  assert(/WIDTH NOT APPLIED/.test(bare),
    'and one whose width did not land reports the frame it actually got')

  /* THE FLOORS THEMSELVES ARE PUBLISHED, so the two halves cannot disagree.
     44 for a finger and 24 for a mouse, both in the token file. */
  const css = tokensCss(state, derived)
  assert(/--target-min:\s*44px/.test(css), 'the touch floor is published at 44px')
  assert(/--target-min-pointer:\s*24px/.test(css), 'and the mouse floor at 24px, which is 2.5.8 at AA')
}

/* ── THE ALIGNMENT SECTION: TWO MECHANISMS THE STYLESHEET STATES AND NOTHING
 *    READS ──
 *
 * Ten rules read as gaps there. Eight had a check whose wording the coverage
 * score could not see. These two were real, and both are the same shape: a
 * mechanism chosen over an obvious alternative, with the reason written in a
 * comment beside it and nothing to stop the next edit taking the alternative.
 */
{
  line('\n- the floor is a property, so the next control needs no name -')
  const CSS = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  const { CHECKS: CW2 } = await import('../src/emit/checks.js')

  /* ── A PROMOTION RULE THAT NAMES CONTAINERS MISSES THE NEXT ONE ──
   *
   * The touch promotion is a list of controls, and a list approves whatever
   * nobody thought of. Worse, a rule that DERIVES its own height cannot be
   * promoted by being named at all: the tab-select parity calc weighs the same
   * as its entry in the list and comes later in the file, so it won. The tab
   * measured 44 and the select 38.26. The parity rule was the thing defeating
   * the floor.
   *
   * So the floor is published as a PROPERTY and each control reads
   * `max(its own height, that property)`. A control written tomorrow is
   * promoted by arithmetic rather than by being remembered. */
  assert(/--control-floor:/.test(bare), 'the floor is published as a custom property')

  /* IT IS ZERO AT REST, so a mouse sees no change. That means the declaration
     sits INSIDE the coarse-pointer block, never at the root. A rule reading it
     falls back to 0px, so an absent property promotes nothing. */
  const coarse = bare.split('@media (pointer: coarse)')[1] || ''
  const before = bare.split('@media (pointer: coarse)')[0] || ''
  assert(/--control-floor:/.test(coarse),
    'declared inside the coarse-pointer block, so it is absent on a mouse')
  assert(!/--control-floor:/.test(before),
    'and nowhere above it, or every control would be promoted at every pointer')
  assert(/var\(--control-floor,\s*0px\)/.test(bare),
    'every reader falls back to 0px, so an absent floor promotes nothing')

  /* ── AND THE DERIVED RULE READS IT WITH `max`, WHICH IS THE WHOLE POINT ──
   * The parity calc is right about the type scale and knows nothing about the
   * promotion. `max` lets the type scale decide the ordinary case and the
   * floor decide the touch one, so the two stop arguing. */
  const parity = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .filter(b => /var\(--control-floor/.test(b[2]))
  assert(parity.length >= 1,
    `at least one derived height reads the floor (${parity.length})`)
  /* THROUGH `max()`, NEVER AS A REPLACEMENT. The reader may assign that max to
     a custom property first, which is what a rule setting both a height and
     its line box does, so match the max rather than the property it lands on. */
  assert(parity.every(b => /max\(/.test(b[2]) && /var\(--control-floor/.test(b[2])),
    `and reads it through max(), never as a replacement for its own arithmetic (${parity.length} reader(s))`)
  assert(parity.some(b => /font-body-sm-size/.test(b[2])),
    'the tab-select parity rule is one of them, which is the case that found this')

  /* THE FLOOR ITSELF STILL COMES FROM THE DOCUMENT. A number the stylesheet
     types is a number nobody can change. */
  assert(/--control-floor:\s*var\(--target-min/.test(bare),
    'and the floor is the published touch minimum, never a typed number')

  /* ── AND EVERY RULE THAT STATES A HEIGHT HAS TO READ IT ──
   *
   * A rule stating `height` outweighs the promotion whenever it is more
   * specific, and then no floor reaches the control. Found on the first
   * coarse-pointer run over 12 surfaces at 13 widths: Landing's primary call
   * to action measured 246x36 from 640px up, while the two nav links beside
   * it reached 44.
   *
   * The links were fine for a reason worth pinning: the promotion gives them
   * `min-height`, a different property from the `height` their own rule sets,
   * so both apply and the larger wins. A button takes `height` from both, and
   * specificity decides.
   *
   * ── AND THE GENERAL QUESTION IS NOT ASKED HERE ──
   *
   * A first draft collected every rule stating a height on a control and
   * demanded it read the floor. It reported 10 findings and all were correct
   * code. `.dmd .btn`, `.btn-sm` and `.btn-lg` are the BASE sizes: the
   * promotion has the same weight and comes later, so order settles it. And
   * `.dmd .btn .icon` is a mark's height, which is not a target at all.
   *
   * Answering it honestly needs specificity arithmetic against the promotion,
   * and the browser already does that. `target-floor-for-the-pointer` is the
   * general check and it is what found this fault, over 12 surfaces at 13
   * widths with touch emulated. A source-level copy of it would be a second
   * instrument on one question, worse than the first.
   *
   * So this block pins the INSTANCE and the mechanism, and the render check
   * keeps asking the general form. */
  assert(CW2.some(c => c.id === 'target-floor-for-the-pointer' && c.where === 'render'),
    'the general floor question stays with the render check, which resolves specificity')
  const navBtn = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .find(b => /\.nav-list\s*>\s*\.btn/.test(b[1]))
  assert(!!navBtn, 'the nav-list button rule is found')
  assert(/max\(var\(--cmp-button-md-height[^)]*\),\s*var\(--control-floor/.test(navBtn?.[2] ?? ''),
    'and it takes the larger of its own height and the floor')
  assert(/--nav-btn-h:/.test(navBtn?.[2] ?? '') && /line-height:\s*calc\(var\(--nav-btn-h\)/.test(navBtn?.[2] ?? ''),
    'stating it once, because a height and its line box are one decision')
}

{
  line('\n- a percentage in a transform resolves against the element own box -')
  const CSS = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

  /* ── IT MUST NOT NAME THE CONTROL'S HEIGHT ──
   *
   * Written as `(line - button-sm-height) / 2` the same CSS put a 28px action
   * row 0.59px off the heading's cap-band centre and a 36px row 3.41px off it.
   * The error is half the difference between the real height and the assumed
   * one. A percentage resolves against the element's OWN box, so the height
   * never has to be named and any row lands in the same place. */
  const lift = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .filter(b => /--head-line-offset:/.test(b[2]))
  assert(lift.length >= 1, `the head lift is declared (${lift.length} rule(s))`)
  const decl = lift.map(b => b[2]).join(' ')
  assert(/translateY\(calc\(50% - var\(--head-line-offset\)\)\)/.test(decl),
    'it centres with a percentage of its own box, so no row height is named')
  assert(!/cmp-button-\w+-height/.test(decl),
    'and names no control height, which is the figure that was wrong per surface')
  assert(/--head-line-offset:\s*calc\(var\(--font-h2-size/.test(decl)
    && /--font-h2-leading/.test(decl),
    'the line it subtracts is size times leading, both tokens, so a scale change carries')

  /* ── DO NOT SPLIT IT INTO A MARGIN AND A TRANSFORM ──
   *
   * The arithmetic is identical and the layout is not. A margin joins the flex
   * line, so a 36px action row with 26.6px under it made that line 62.6px tall
   * and pushed the heading's own bottom edge down 9.4px. The offset then
   * measured from a row that had already moved. A transform costs no layout,
   * which is the whole reason it is the tool here.
   *
   * The rule states `margin-bottom: 0` rather than omitting it, so a reader
   * cannot mistake the absence for an oversight. Assert the ZERO. */
  assert(lift.every(b => !/margin-bottom:\s*(?!0)[^;]*(calc|em|px)/.test(b[2])),
    'no margin carries any part of the offset, because a margin joins the flex line')
  assert(lift.some(b => /margin-bottom:\s*0/.test(b[2])),
    'and the zero is stated, so its absence reads as a decision rather than an omission')

  /* AND A TRANSFORM COSTS NO LAYOUT, WHICH IS WHY IT CAN OVERLAP. Where the
     actions wrap onto a line of their own there is nothing to centre against,
     and the same lift pulls them over whatever is above: 18 covered labels and
     captions across three surfaces at 296 to 320px. The reset lives in the
     block that declares the collapse, and a shipped check enforces it. */
  const { CHECKS: CW } = await import('../src/emit/checks.js')
  assert(CW.some(c => c.id === 'a-lift-must-not-survive-a-wrap'),
    'and a render check catches the lift surviving a wrap, which costs no layout to create')
}

/* ── SAMPLE THE SITUATION, NOT THE COMPONENT ──
 *
 * A component already has a gallery and an inline preview, so a missing
 * COMPONENT is rarely the gap. The gap is a SHAPE no sample has: a long page
 * title, an empty state, a comparison. Every situation the rules name is
 * pinned in the payload drift guard, so the prose cannot lose it. Nothing
 * checked that a SAMPLE demonstrates it, and a demonstration is the component.
 *
 * The failure this stops: a screen simplified to one card while the rule it
 * exists to show goes on being published. Four empty states become one, the
 * document still says four, and the sample teaches the opposite.
 */
{
  line('\n- every situation the rules name has a sample -')
  const read = f => fs.readFileSync(new URL(`../src/preview/screens/${f}`, import.meta.url), 'utf8')
  const SITUATIONS = [
    /* [the situation, the file, the shape that proves it is that situation] */
    ['a record page shows one thing', 'Record.jsx', /page-head/],
    ['an empty state', 'Empty.jsx', /page-head/],
    ['a comparison keeps its columns', 'Pricing.jsx', /subgrid/],
    ['a form with an invalid field', 'Form.jsx', /aria-invalid/],
    ['an overlay', 'Dialog.jsx', /role="dialog"|role="alertdialog"/],
    ['a chrome shell, not only documents', 'Shell.jsx', /page-head|tab/],
    ['charts, including their own situations', 'Charts.jsx', /chart/],
  ]
  for (const [what, file, shape] of SITUATIONS) {
    let src = ''
    try { src = read(file) } catch { src = '' }
    assert(src.length > 400 && shape.test(src),
      `${what} has a sample (${file}, ${src.length} bytes)`)
  }

  /* ── AN EMPTY STATE IS FOUR STATES, NEVER ONE ──
   *
   * First run offers the feature's primary action. No results offers a way
   * BACK, which is clear the filter and never a way forward. A failure names
   * what failed and offers a retry. LOADING was missing for months while the
   * other three shipped. One "nothing here" card for all four tells the reader
   * the product is broken when it is new.
   *
   * Read the COPY, because that is what separates them. Four cards with four
   * marks and one message is still one state shown four times. */
  const empty = read('Empty.jsx')
  for (const [state, needle] of [
    ['first run offers the primary action', /No invoices yet/],
    ['and it is a way FORWARD', /primary="New invoice"/],
    ['no results offers a way back', /No invoices match this filter/],
    ['which is clear the filter, never create', /primary="Clear filters"/],
    ['a failure names what failed', /Could not load invoices/],
    ['and offers a retry', /primary="Try again"/],
    ['and loading is the fourth', /<Loading /],
  ]) {
    assert(needle.test(empty), `an empty state is four states: ${state}`)
  }

  /* A LOADING STATE HOLDS THE SHAPE OF WHAT IS COMING, so it is a live region
     rather than a spinner, and its shapes are hidden from a reader who is
     hearing the page. */
  assert(/role="status"/.test(empty) && /aria-busy/.test(empty),
    'the loading state announces itself rather than spinning silently')
  assert(/aria-hidden/.test(empty),
    'and its placeholder shapes are hidden, because they are not content')

  /* ── THREE EMPTY STATES SIDE BY SIDE WOULD READ AS A COMPARISON ──
     Each of these is a whole screen in its own right, so the sample stacks
     them in one column. The comment in the screen says so; assert the shape,
     or the next tidy-up makes it a grid. */
  assert(!/grid-cols|col-3|columns-3/.test(empty),
    'the four are stacked, never gridded, because each is a whole screen')

  /* ── AN INVALID FIELD POINTS AT ITS OWN MESSAGE ──
   *
   * Found by the sample check above, which reported Form.jsx as having no
   * invalid-field sample. It HAD one, drawn correctly: the invalid border, the
   * mark, and the sentence. It carried no `aria-invalid` and no
   * `aria-describedby`, so a reader hearing the page was told nothing.
   *
   * The wiring is on the Field COMPONENT, because every field on that screen
   * goes through it. Settings.jsx wires its own one-off field by hand, which
   * is where the class-versus-instance trap sits. */
  const form = read('Form.jsx')
  assert(/aria-invalid/.test(form), 'an invalid field says it is invalid')
  assert(/aria-describedby/.test(form),
    'and points at its own message, so the reader learns WHAT is wrong')
  assert(!/aria-labelledby.{0,40}err/i.test(form),
    'never labelledby, because the label names the field and the complaint would replace it')
  /* IT IS ON THE COMPONENT, NOT ONE FIELD. A hand-wired instance leaves the
     next invalid field silent. */
  const field = form.slice(form.indexOf('function Field'), form.indexOf('function Field') + 3200)
  assert(/aria-invalid/.test(field) && /aria-describedby/.test(field),
    'the wiring sits in the shared Field, so the next invalid field is wired by arithmetic')
  /* A SPREAD REPLACES A PROP. A caller stating its own description keeps it,
     or the helper silently deletes a decision. */
  assert(/\?\?/.test(field),
    'and a field stating its own description keeps it, because a spread replaces rather than adds')
  /* A LIVE REGION, because the message arrives after a check rather than with
     the page. */
  assert(/role="status"/.test(field),
    'the message is announced when it appears, not left sitting unread')
}

/* ── SHIP NO FRACTIONAL PIXEL: THE STROKE EFFECT AND THE CODEMOD'S SCOPE ──
 *
 * Eight rules read as gaps there and six had a check with different wording.
 * These two were real, and the first is the worst kind of miss because it
 * READS as done: the declaration is in the stylesheet and computed style on
 * the icon agrees with it. Only the child disagrees, and nothing asked.
 */
{
  line('\n- a stroke effect must reach the shapes, not the svg alone -')
  const PV = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const TH = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8')

  /* ── DECLARE IT ON THE SHAPES, NEVER ON THE `<svg>` ALONE ──
   *
   * `vector-effect` applies to drawn geometry and does not inherit. A rule on
   * the root element computes `non-scaling-stroke` on the `<svg>` and `none`
   * on every path inside it, so it changes nothing.
   *
   * Two stylesheets carried it that way for as long as they existed, and one
   * had a comment claiming the weight could not drift again. Measured: 49 of
   * 49 icons scaling, painting 0.58, 0.63, 0.67, 0.75, 0.81, 0.88, 1, 1.13 and
   * 1.25px from a single declared 1.5. */
  for (const [what, css] of [['the preview', PV], ['the chrome', TH]]) {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    const rules = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .filter(b => /vector-effect:\s*non-scaling-stroke/.test(b[2]))
    assert(rules.length >= 1, `${what} declares the effect (${rules.length} rule(s))`)
    /* EVERY such rule must reach a DESCENDANT, or it is the version that
       computes on the svg and nothing else. A trailing `*` in any of the
       selector's branches is what says so. */
    const shapeless = rules.filter(b => !/\*\s*(,|$)/.test(b[1].trim()))
    assert(shapeless.length === 0,
      `and every one reaches the shapes inside, never the svg alone in ${what}`
      + (shapeless.length ? ` — ${shapeless.map(b => b[1].trim().slice(0, 40)).join(' | ')}` : ''))
  }

  /* ── A PER-SIZE TOKEN IS THE WRONG FIX ──
   * The component knows which size it asked for; the STYLESHEET sets the box,
   * in a dozen places. Every small button, icon-only button, select trigger
   * and doubled empty-state mark resized an icon and left the weight behind.
   * Two writers, disagreeing wherever they met. */
  const bareP = PV.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  const perSize = [...bareP.matchAll(/--[a-z-]*stroke[a-z-]*-(sm|md|lg|xs|xl):/g)]
  assert(perSize.length === 0,
    `no per-size stroke token, because the stylesheet is what sets the box (${perSize.length})`)

  /* AND THE WEIGHT IS A WEIGHT, so the grid has no opinion on it. 1.75 is a
     legitimate answer, chosen against the type beside it. Read the file, never
     import it: importing a codemod RUNS it, and the first draft of this block
     printed a dry-run report into the middle of the test output. */
  assert(/stroke-width:\s*var\(/.test(bareP),
    'a stroke width is read from a property rather than typed at the shape')
}

{
  line('\n- a codemod is scoped to style regions -')
  const guard = fs.readFileSync(new URL('../../../tools/grid-snap.mjs', import.meta.url), 'utf8')

  /* ── SCOPE A CODEMOD TO STYLE REGIONS ──
   *
   * `prop: number` means something different nearly everywhere else: an icon
   * stroke weight, a substitution sentinel that breaks if it moves, a viewport
   * rectangle. So the tool matches the BRACES of `style={{…}}` and
   * `style: {…}` and touches nothing outside them.
   *
   * Matching braces rather than a regex is the point. A nested object or a
   * template string inside the region would end a lazy match early, and the
   * rest of the file would then be rewritten as though it were style. */
  assert(/function styleRegions/.test(guard), 'the tool finds style regions before it reads a value')
  assert(/style\\s\*\(\?:=\\s\*\\\{\\\{|style\s*\(\?:=/.test(guard)
    || /style\s*\(\?:=\s*\\\{\\\{/.test(guard)
    || guard.includes('style\\s*(?:=\\s*\\{\\{|:\\s*\\{)'),
    'it matches both the JSX and the object form')
  assert(/depth\+\+/.test(guard) && /depth--/.test(guard),
    'and walks the braces, so a nested object cannot end the region early')
  assert(/=== "'"/.test(guard) || /'\\''/.test(guard) || /\[i\] === "'"/.test(guard),
    'a quoted string inside the region is skipped, or a brace in a string moves the end')

  /* THE REGION IS USED, not merely computed. A helper nothing calls is the
     same defect as no helper. */
  assert(/styleRegions\(/.test(guard.slice(guard.indexOf('for (const path of files'))),
    'and every file is read through those regions rather than whole')

  /* ── A SIZE IS AN ATTRIBUTE, WHICH THE STYLE-REGION SCOPE CANNOT SEE ──
   *
   * The rules recorded this as the second of three widenings of this matcher,
   * and the widening had never landed. `<svg width={13}>` states a length
   * outside every style region, and no CSS guard reaches it either.
   *
   * REPORTED, NEVER REWRITTEN, and for a different reason than the ternary: an
   * `<svg>` width and its `viewBox` are one decision, so snapping the width
   * alone rescales the drawing. */
  assert(/width\|height\)=\\\{/.test(guard) || guard.includes('(width|height)=\\{'),
    'an SVG size is an ATTRIBUTE, and the guard reads one')
  assert(/<\(svg\|use\|image\)/.test(guard) || guard.includes('<(svg|use|image)'),
    'only on a drawing element, because width on an input is a different thing')
  assert(/ATTRIBUTE, not rewritten/.test(guard),
    'and it is reported rather than snapped, since the viewBox is the other half')

  /* ── AND IT ANSWERS TO THE TYPE GRID, NOT THE SPACE GRID ──
   * A mark's box is a SIZE. Snapped against the space grid the first draft
   * reported 46 findings on correct code, because 10 and 14 are not 4px
   * multiples and 14 is the published mark size. A check that fires on
   * correct code costs more than the miss it prevents. */
  const attrBlock = guard.slice(guard.indexOf('let attr = 0'), guard.indexOf('let attr = 0') + 700)
  assert(/snapType\(n\) === n/.test(attrBlock),
    'measured against the type grid, which accepts 10, 12 and 14 and rejects 13')
  assert(!/snapSpace\(n\)/.test(attrBlock),
    'never the space grid, which called the published mark size off-grid')
}

/* ── AN OVERRIDE WITH NO COMMENT, AND A CONTROL THAT DOES THE OBVIOUS THING ──
 *
 * The last two sections of the gap list. Both rules were obeyed in the code and
 * held there by nothing.
 */
{
  line('\n- an override with no comment is a bug waiting to be found -')
  const SCHEMA = fs.readFileSync(new URL('../src/state/schema.js', import.meta.url), 'utf8')

  /* ── THE ONE THAT COST A RED GHOST BUTTON SAT BETWEEN TWO THAT EXPLAINED
   *    THEMSELVES ──
   *
   * A component override is a decision to disagree with the library, so it owes
   * a reason. Three have been removed from this map after their reasons turned
   * out to be wrong or expired: a danger text colour that made every ghost
   * button red, a focus-ring colour used as a text colour at 3.95:1, and a
   * badge fill painted the page colour that made the chip vanish. Each was
   * found by reading the comment beside it, which is why the comment is the
   * rule.
   *
   * An entry with no comment cannot be audited that way at all. */
  const start = SCHEMA.indexOf('const defaultComponentOverrides')
  const end = SCHEMA.indexOf('})', start)
  assert(start > 0 && end > start, 'the override map is found')
  const block = SCHEMA.slice(start, end)
  const lines = block.split('\n')
  let entries = 0
  const bare = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*'([^']+)':/.exec(lines[i])
    if (!m) continue
    entries++
    /* WALK BACK OVER BLANK LINES ONLY. A comment two entries up belongs to
       that entry, so anything else between them breaks the chain. */
    let has = false
    for (let q = i - 1; q >= 0; q--) {
      const t = lines[q].trim()
      if (!t) continue
      if (t.startsWith('*') || t.startsWith('/*') || t.endsWith('*/') || t.startsWith('//')) { has = true }
      break
    }
    if (!has) bare.push(m[1])
  }
  assert(entries >= 1, `the map holds overrides to check (${entries})`)
  assert(bare.length === 0,
    `every override states its reason (${entries} entr(ies)${bare.length ? ', bare: ' + bare.join(', ') : ''})`)
}

{
  line('\n- a control does the obvious thing with its own content -')
  const PANEL = fs.readFileSync(new URL('../src/panels/ColorPanel.jsx', import.meta.url), 'utf8')

  /* ── A COLOUR SWATCH IS A COLOUR, SO CLICKING IT EDITS THE COLOUR ──
   *
   * Ours toggled a lock instead, and nothing on the swatch said so. Two
   * decisions about one object need two controls, not one control and a
   * convention nobody can see. The lock is its own button, under the swatch
   * and aligned to it.
   *
   * Read the HANDLER, because that is the decision. A class name or a title
   * attribute says nothing about what a press does. */
  const swatchBtn = /<button key=\{s\.id\} onClick=\{e => setPick\(/.test(PANEL)
  assert(swatchBtn, 'the seed swatch opens the picker, so pressing a colour edits that colour')
  assert(/className="seed-lock"/.test(PANEL) && /onClick=\{\(\) => toggleLock\(s\.id\)\}/.test(PANEL),
    'and the lock is its own button, never a second meaning on the first one')
  /* THE LOCK IS NOT THE SWATCH'S HANDLER. If the same press did both, the two
     decisions would be one control again. */
  assert(!/<button key=\{s\.id\} onClick=\{[^}]*toggleLock/.test(PANEL),
    'the swatch press does not toggle the lock, which is what it used to do')
  /* AND THE LOCK SAYS WHICH STATE IT IS IN. A toggle button owes
     `aria-pressed`, or a reader hears a button and not a state. */
  assert(/aria-pressed=\{!!s\.locked\}/.test(PANEL),
    'the lock states whether it is on, because paint is not a state')
}

/* ── THE TITLE BAR'S THRESHOLD IS A SUM, AND NOTHING READ IT ──
 *
 * The last live constant on the coverage tool's unread list. Three of the five
 * are past evidence: the line counts of a cleanup, the pixels of a subgrid
 * fault since repaired, the slack in a bar that has moved. Nothing should read
 * those, and pinning them would freeze a story rather than a decision.
 *
 * This one governs code that ships. `BAR_FULL_Q` decides whether the chrome's
 * action buttons stand in the title bar or fold into the Project menu, and the
 * rule publishes it as a sum with the widths it was measured from.
 *
 * A THRESHOLD MOVES WITH THE ROW, AND THE MOVE IS A SUM OF ITS OWN. Adding the
 * guided entry and shortening two labels is three changes to one number:
 *
 *   New (Guided)   144.7  plus one 8px gap   = +152.7
 *   New Project    135.0 -> New   84.1       =  -50.9
 *   Load Project   138.9 -> Load  88.0       =  -50.9
 *                                              ------
 *                                              +50.9
 *
 * So 1570 became 1621, and the query is one pixel under it. The arithmetic is
 * the thing to pin, because the constant is true of these labels and no others.
 */
{
  line('\n- the title bar threshold is a sum, not a constant -')
  const APP = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

  const q = /const BAR_FULL_Q = '\(max-width: (\d+)px\)'/.exec(APP)
  assert(!!q, 'the full-bar query is declared')
  const px = Number(q?.[1] ?? 0)

  /* ── THE COMMENT IS THE SUM, SO READ IT AND CHECK THE ARITHMETIC ──
   * A number with its derivation beside it is only honest while the two
   * agree. This is the pairing nothing was checking. */
  const nums = (APP.match(/\+152\.7|-50\.9|=\s*\+50\.9|1570|1621/g) || [])
  assert(nums.includes('1570') && nums.includes('1621'),
    'and the comment states both the old threshold and the new one')
  assert(nums.includes('+152.7'), 'the button it gained is priced (+152.7 including its gap)')
  assert(nums.filter(n => n === '-50.9').length === 2,
    `and both shortened labels give back the same amount (${nums.filter(n => n === '-50.9').length} of 2)`)
  /* SUBTRACT IN FLOATS AND ROUND THE ANSWER. `1570 + 152.7 - 50.9 - 50.9`
     comes out 1620.8999999999999 in binary, so exact equality on the sum
     fails on correct arithmetic. Compare with a tolerance under a pixel. */
  const sum = 1570 + 152.7 - 50.9 - 50.9
  assert(Math.abs(sum - 1620.9) < 0.01,
    `the sum resolves to ${sum.toFixed(1)}, which is where the query sits`)
  assert(px === 1620,
    `the query is the last pixel below the measured need (${px} against 1621)`)

  /* ── ONE BREAKPOINT PER QUESTION, MEASURED FROM THE THING IT GOVERNS ──
   * `MOBILE_Q` answers whether two panes coexist. It was also answering
   * whether the title bar is cramped, and those are not the same number.
   * Everything between 768 and 1570 got the full desktop bar in a space that
   * could not hold it: the mark, the wordmark, the name field and the swatches
   * printed on top of each other. */
  const mob = /const MOBILE_Q = '\(max-width: (\d+)px\)'/.exec(APP)
  assert(!!mob, 'the pane query is its own constant')
  assert(Number(mob?.[1]) !== px,
    `and it is a different number from the bar's (${mob?.[1]} against ${px})`)
  const trim = /const BAR_TRIM_Q = '\(max-width: (\d+)px\)'/.exec(APP)
  assert(!!trim && Number(trim[1]) < px,
    `the trim step sits below the fold step, so the bar sheds in one order (${trim?.[1]} then ${px})`)

  /* ── AND `min-content` IS NOT THE BREAK, WHICH IS THE OTHER UNREAD RULE ──
   * The row's own min-content reads 1469. That is the width at which the
   * project-name field has already collapsed to nothing, which is the state
   * the threshold exists to prevent. Shrink until the row stops being USABLE,
   * not until it stops fitting. */
  assert(/1469/.test(APP) && /wrong measure/.test(APP),
    'the comment records why min-content is the wrong measure for this row')
  assert(px > 1469,
    `and the shipped threshold is above it, never at it (${px} against 1469)`)
}

/* ── A PAGE TITLE CANNOT SHRINK UNDER ITS OWN LONGEST WORD ──
 *
 * `min-width: 0` on the heading is what lets it wrap at all, and it also lets
 * the box go narrower than a single word, which cannot wrap. Found on the
 * first full run, 12 surfaces at 13 widths with both pointers:
 *
 *   Settings at 296   237.56px of ink in a 194px box   43.56 over
 *   Settings at 320   237.56px of ink in a 218px box   19.56 over
 *   Record   at 296   251.81px of ink in a 246px box    5.81 over, on
 *                     the word "reconciliation"
 *
 * Nothing was cut off the screen. The ink ran past its own column into the
 * action group beside it, which no clipping check can see because nothing
 * clips. `min-content` is the longest word, so the box still shrinks and still
 * wraps and stops where a word would break.
 *
 * TWO STYLESHEETS STATE IT, so both are asserted. The base rule lives in
 * preview.css and a narrow-width block restates it, and a fix to one alone
 * left the other reverting to 0 below 640px. That is how the first attempt
 * measured no change at all.
 */
{
  line('\n- a page title cannot shrink under its own longest word -')
  const base = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const resp = fs.readFileSync(new URL('../src/preview/responsive.rules.css', import.meta.url), 'utf8')
  const blank = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))

  for (const [what, css] of [['the base stylesheet', blank(base)], ['the narrow-width block', blank(resp)]]) {
    const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .filter(b => /\.page-title\s*>\s*h2/.test(b[1]) && /min-width:/.test(b[2]))
    assert(rules.length >= 1, `${what} floors the page title (${rules.length} rule(s))`)
    assert(rules.every(b => /min-width:\s*min-content/.test(b[2])),
      `and at min-content, never 0, in ${what}`)
  }

  /* NO `overflow-wrap: anywhere` ON A TITLE. It broke "Overview" into
     "Overvie" and "w", which is worse than any answer the ladder chooses
     between. The floor is the fix; breaking the word is not. */
  for (const [what, css] of [['the base stylesheet', blank(base)], ['the narrow-width block', blank(resp)]]) {
    const bad = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
      .filter(b => /h1|h2|h3|page-title/.test(b[1]) && /overflow-wrap:\s*(anywhere|break-word)/.test(b[2]))
    assert(bad.length === 0,
      `no heading breaks mid-word in ${what}${bad.length ? ' — ' + bad.map(b => b[1].trim().slice(0, 36)).join(' | ') : ''}`)
  }

  /* AND THE RENDER CHECK STILL ASKS IT, because a floor is a declaration and
     whether the words fit is a measurement. */
  const { CHECKS: CH } = await import('../src/emit/checks.js')
  assert(CH.some(c => c.id === 'a-heading-keeps-its-words' && c.where === 'render'),
    'the heading check ships and runs in a browser')
}

/* ── A CHILD THE ENGINE DOES NOT RENDER IS NOT CLIPPED CONTENT ──
 *
 * The clipping check walked `el.children` raw, so the harness's paint filter
 * never reached them. A `display: none` child has an EMPTY rect, and an empty
 * rect is 0,0,0,0 — not "nowhere" but the viewport ORIGIN. So
 * `box.left - kid.left` came out as the clipping box's own distance from the
 * left edge of the screen.
 *
 * Measured over 12 surfaces at 13 widths: three findings, on Dashboard,
 * Landing and Settings, all the same hidden `span.caption.nav-title`. Two read
 * 777px and one 1422.13px, which are exactly where those nav lists sit. The
 * label is hidden on purpose there: a section name belongs inside the folded
 * menu with the links it names.
 *
 * A GENUINELY CLIPPED CHILD STILL HAS A REAL RECT, because
 * `getBoundingClientRect` returns the layout box rather than the visible part
 * of it. So filtering on paint costs the check nothing.
 *
 * Proven both ways in the browser. The three findings went. An injected card
 * clipping a nowrap action row reported 53.59px cut off, named on the row that
 * lost it. Two earlier injections produced nothing and neither was the shape:
 * block children shrink with their box, so the overflowing thing has to be a
 * row that refuses to.
 */
{
  line('\n- a hidden child is not clipped content -')
  const { CHECKS: CC } = await import('../src/emit/checks.js')
  const cc = CC.find(x => x.id === 'nothing-clipped-out-of-reach')
  assert(!!cc && cc.where === 'render', `the clipping check ships and runs in a browser (${cc?.where})`)
  const t = (cc?.body || []).join('\n')
  assert(/for \(const kid of el\.children\) \{\s*\n\s*if \(!visible\(kid\)\) continue/.test(t),
    'it filters each child on paint before measuring it')
  /* THE ORDER MATTERS: the filter has to come before the rect is read, or the
     zero rect is measured and then discarded, which is the same bug. */
  const loop = t.slice(t.indexOf('for (const kid of el.children)'))
  assert(loop.indexOf('visible(kid)') < loop.indexOf('getBoundingClientRect'),
    'and before it, never after, because a zero rect measured is a zero rect reported')
  /* THE TWO EXEMPTIONS THE CHECK ALREADY CARRIED STAY. An absolutely placed
     child outside its parent is a method, and text asked to truncate is
     clipped on purpose. */
  assert(/position === 'absolute'/.test(t) && /position === 'fixed'/.test(t),
    'an out-of-flow child is a method rather than a casualty')
  assert(/textOverflow === 'ellipsis'/.test(t),
    'and text asked to truncate says so')
}

/* ── THREE JUDGEMENTS FROM THE FULL RUN, EACH DECIDED AGAINST A DRAWING ──
 *
 * Twenty of the 24 faults the coverage run found were mechanical. These three
 * had two defensible answers each, so they went to a rendered comparison
 * first. The chosen answers are pinned here with the mechanism each needs.
 */
{
  line('\n- the avatar is drawn by its edge where its fill cannot carry it -')
  const CSS = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  const avatar = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .find(b => /\.avatar\b/.test(b[1]) && /--cmp-avatar-size/.test(b[2]))
  assert(!!avatar, 'the avatar rule is found')
  const av = avatar?.[2] ?? ''
  /* ── AN OUTLINE, NEVER A BORDER ──
   * The disc centres its initials with the line-box technique, so its
   * `line-height` IS its content box. A 1px border makes it 34px around a
   * 32px line and shifts the letters half a pixel. An outline costs no layout.
   * The stacked-bar segment uses one for the same reason. */
  assert(/outline:\s*var\(--border-hairline/.test(av),
    'it carries a hairline outline, because accent-raised reads 1.12:1 on the page ground')
  assert(/outline-offset:\s*calc\(-1/.test(av),
    'at a negative offset, so the edge draws inside the disc and follows its radius')
  assert(!/(?:^|[;\s])border(?:-\w+)?:\s*var\(--border-hairline/.test(av),
    'and never a border, which would widen a box whose line-height is its content box')
  /* THE FILL STAYS, because a shape drawn by its edge still needs a fill on a
     card, where accent-raised clears the floor. */
  assert(/--cmp-avatar-background-color/.test(av), 'the fill is unchanged')

  line('\n- a table first column starts on the margin its heading sets -')
  const outer = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .filter(b => /\.table (?:th|td):first-child/.test(b[1]) || /\.table (?:th|td):last-child/.test(b[1]))
  assert(outer.length >= 2, `the outer cells are stated on both edges (${outer.length} rule(s))`)
  const flush = outer.filter(b => !/:has\(/.test(b[1]))
  assert(flush.length === 2 && flush.every(b => /padding-inline-(start|end):\s*0/.test(b[2])),
    'both outer edges are zeroed, so the table cannot read as leaning')
  /* ── THE BAR GUTTER GOES IN THE BASE, NOT ON THE SELECTED ROW ──
   * The first version gave the selected row alone the bar's 4px, and its own
   * check caught it in one run: the content started 4.0px further in than the
   * row beside it, and the bar then sat 0.0px from the label. */
  const gutter = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .find(b => /\.table:has\(tr\.is-selected\)/.test(b[1]) && /padding-inline-start/.test(b[2]))
  assert(!!gutter, 'a table carrying a selection reserves the bar gutter')
  assert(/calc\(var\(--cmp-table-row-selected-edge-width[^)]*\)\s*\+/.test(gutter?.[2] ?? ''),
    'as the bar width plus a step, so the bar never sits against the label')
  assert(!/tr\.is-selected\s*>\s*td:first-child\s*\{[^}]*padding-inline-start/.test(bare),
    'and no rule pads the selected row alone, which is what staggered the column')

  line('\n- a card action row covers the line it takes -')
  const pairRule = bare.slice(bare.indexOf('@container dmd-card'))
  assert(/@container dmd-card \(max-width: 640px\)/.test(bare),
    'the pairing is bounded at 640px, twice the published field width')
  assert(/nth-child\(2\)\)[\s\S]{0,60}not\([\s\S]{0,30}nth-child\(3\)/.test(pairRule),
    'and asks for exactly two children, because three per line is never the answer')
  assert(/flex:\s*1 1 0/.test(pairRule.slice(0, 400)),
    'two equal halves, which is the shape a broken action row already uses')
  /* THE FRAMED BOX IS THE CONTAINER, and a modal footer is the same box. The
     first version named `.card` alone and the Overlays modal footer, at 510px
     filling 186.89, was not reached. */
  const holder = [...bare.matchAll(/([^{}@]+)\{([^{}]*)\}/g)]
    .find(b => /container-name:\s*dmd-card/.test(b[2]))
  assert(!!holder && /\.card/.test(holder[1]) && /\.modal/.test(holder[1]),
    `both framed boxes are containers (${holder?.[1].trim().slice(0, 40)})`)
}

/* ── A STACK CLASS READS THE STEP ITS NAME PROMISES ──
 *
 * `.stack-xl` published `--space-2xl` at 48px for as long as it existed,
 * because 48 was the first step clearing three to one. The name said xl and
 * the token said 2xl, and nothing could see the disagreement.
 *
 * The bar moved to two to one on 9 September 2026, so the first step that
 * clears it is `--space-xl` at 32. Asserting the PAIRING rather than the
 * number, because a base change moves every step and the name is the rule.
 */
{
  line('\n- a stack class reads the step its own name promises -')
  const CSS = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  const stepOf = cls => {
    const m = new RegExp('\\.dmd \\.' + cls + '\\s*\\{[^}]*?gap:\\s*var\\(--space-([a-z0-9]+)').exec(CSS)
    return m ? m[1] : null
  }
  const PAIRS = [['stack-sm', 'sm'], ['stack', 'md'], ['stack-lg', 'lg'], ['stack-xl', 'xl']]
  for (const [cls, want] of PAIRS) {
    const got = stepOf(cls)
    assert(got === want, `.${cls} reads --space-${want} (${got})`)
  }
  /* AND THE STEPS RISE WITH THE NAMES, or two classes mean one distance. */
  const pxOf = n => parseFloat(px(derived.spacing, n))
  const seq = PAIRS.map(([, n]) => pxOf(n))
  assert(seq.every((v, i) => i === 0 || v > seq[i - 1]),
    `each step is larger than the one below it (${seq.join(', ')})`)
  /* `.stack` is the run-of-like-things step, so `.stack-xl` over it must clear
     the shipped proximity bar. That is what makes a section read as a section. */
  const { CHECKS: CS } = await import('../src/emit/checks.js')
  const bar = Number(/r\s*>=\s*(\d+(?:\.\d+)?)\s*\)\s*continue/
    .exec((CS.find(c => c.id === 'proximity-is-a-ratio')?.body || []).join('\n'))?.[1])
  assert(pxOf('xl') / pxOf('md') >= bar,
    `the section step clears the bar against the run step (${pxOf('xl')}/${pxOf('md')} = ${(pxOf('xl') / pxOf('md')).toFixed(1)}:1 against ${bar}:1)`)
}

/* ── THE PLAN STACK IS A ROW OF GROUPS, SO IT STATES ITS OWN STEP ──
 *
 * Each child is one plan's card plus the card holding that plan's answers,
 * bound at `.stack-sm`'s 12px. `.stack` publishes the step for a run of like
 * things, so the shared class handed both distances one number: 16 against 12,
 * which is 1.33:1 and fired at the old bar as well as the new one. Measured at
 * 296, 308 and 320px, the three widths where the stacked form is the one on
 * screen.
 *
 * `lg` is the first step above `md` and gives exactly two to one. Assert the
 * RATIO against the shipped bar, never the pixel: a base change moves both
 * numbers and the relationship is what the rule states.
 */
{
  line('\n- a row of groups states its own step, and it is not the run step -')
  const CSS = fs.readFileSync(new URL('../src/preview/preview.css', import.meta.url), 'utf8')
  /* `\s*\{` is what keeps `.dmd .stack` off `.dmd .stack-sm`: the brace has to
     follow the selector, so the longer class cannot match the shorter query. */
  const gapOf = sel => {
    const lit = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(lit + '\\s*\\{[^}]*?gap:\\s*var\\(--space-([a-z0-9]+)').exec(CSS)
    return m ? m[1] : null
  }
  const innerStep = gapOf('.dmd .stack-sm')
  const runStep = gapOf('.dmd .stack')
  /* ── RESOLVE THE STEP, DO NOT ASK WHETHER A TOKEN NAME APPEARS ──
   *
   * The first version compared the DECLARED name against the run step. With
   * the declaration deleted that reads `null` against `md`, which differs, so
   * the assertion passed on the exact shape it was written to catch. Proven by
   * rebuilding the original: it came back quiet.
   *
   * The element carries `plan-stack` AND `stack`, so the step in force is its
   * own where it states one and the run's where it does not. */
  const declared = gapOf('.dmd .plan-stack')
  const outerStep = declared ?? runStep
  assert(!!declared, `the plan stack states its own gap step (${declared})`)
  assert(innerStep === 'sm', `and the group inside it keeps the small step (${innerStep})`)
  assert(outerStep !== runStep,
    `and the step IN FORCE is not the run-of-like-things step, which is what handed both one number (${outerStep} against ${runStep})`)

  const step = n => parseFloat(px(derived.spacing, n))
  const ratio = step(outerStep) / step(innerStep)
  const { CHECKS: CB } = await import('../src/emit/checks.js')
  const bar = Number(/r\s*>=\s*(\d+(?:\.\d+)?)\s*\)\s*continue/
    .exec((CB.find(c => c.id === 'proximity-is-a-ratio')?.body || []).join('\n'))?.[1])
  assert(ratio >= bar,
    `${step(outerStep)}px between and ${step(innerStep)}px inside clears the shipped bar (${ratio.toFixed(2)}:1 against ${bar}:1)`)

  /* THE OUTER GAP IS THE ONE THAT MOVED. Lowering the inside to 8 clears the
     same bar and states the wrong relationship, so pin which half was raised. */
  assert(step(outerStep) > step(runStep),
    `the OUTER gap is what was raised, never the inner one (${step(outerStep)} over the run's ${step(runStep)})`)

  /* AND THE STACKED FORM IS THE ONE ON SCREEN AT THOSE WIDTHS, or the fix is
     in a block nothing renders. Both halves are stated, in two files. */
  assert(/\.dmd \.plan-stack \{[^}]*display:\s*none/.test(CSS),
    'the stacked form is hidden by default')
  assert(/\.dmd \.plan-stack \{\s*display:\s*flex/.test(RESPONSIVE_RULES),
    'and the narrow branch is what shows it')
  assert(!/\.plan-stack[^{]*\{[^}]*gap:/.test(RESPONSIVE_RULES),
    'and no narrow-width block restates the gap, so one writer owns it')
}

/* ── ONE PROXIMITY BAR, READ BY EVERY CONSUMER ──
 *
 * Their decision, 9 September 2026, on a drawing of all three ratios at actual
 * size: the bar is TWO to one, not three.
 *
 * It was measured before it was moved. 12 surfaces at 6 widths hold 25
 * distinct proximity groups: 13 at six to one or more, 3 between four and six,
 * 4 at exactly three, 2 at exactly two, 3 under two. So the bar decides two
 * cases and both are one shape, content beside its own context at 32 between
 * and 16 inside. Nothing on screen moved.
 *
 * TWO CHECKS STATE IT AND A THIRD FILE TEACHES IT. The general rule, the
 * grouped chart's own application of it, and the payload prose. Two bars for
 * one rule is how two versions of it end up disagreeing, so this asserts they
 * agree rather than asserting the number twice.
 */
{
  line('\n- one proximity bar, and every consumer reads the same one -')
  const { CHECKS: CP } = await import('../src/emit/checks.js')
  const general = CP.find(c => c.id === 'proximity-is-a-ratio')
  const chart = CP.find(c => c.id === 'a-grouped-chart-states-a-ratio')
  assert(!!general && !!chart, 'both checks ship')

  const barOf = c => {
    const t = (c?.body || []).join('\n')
    const m = /(?:r|between \/ inner)\s*>=\s*(\d+(?:\.\d+)?)\s*\)\s*continue/.exec(t)
    return m ? Number(m[1]) : null
  }
  const gBar = barOf(general), cBar = barOf(chart)
  assert(gBar === 2, `the general rule states two to one (${gBar})`)
  assert(cBar === gBar, `and the grouped chart reads the same bar (${cBar} against ${gBar})`)

  /* THE WORDING FOLLOWS THE NUMBER, or a reader obeys a figure the code does
     not enforce. That is how the golden angle survived two days past its own
     measurement. */
  for (const [what, c] of [['the general rule', general], ['the grouped chart', chart]]) {
    const words = (c?.line || '') + ' ' + (c?.body || []).join('\n')
    assert(/two to one/.test(words), `${what} says two to one in its own words`)
    assert(!/three to one/.test(words), `and never three, which it used to say, in ${what}`)
  }

  /* AND THE PAYLOAD TEACHES THE SAME BAR. A rule the reader obeys from prose
     while the check enforces another number is two systems. */
  const doc = generateFile(state, derived).text
  assert(/two to one/.test(doc), 'the payload states two to one')
  assert(!/under three to one/.test(doc), 'and no longer states three')

  /* THE SHIPPED CHART RATIO CLEARS IT WITH ROOM, which is why nothing moved.
     Read it off the component rather than quoting it. */
  const grouped = derived.components.find(c => c.name === 'chart-grouped')
  const propOf = k => (grouped?.properties ?? []).find(p => p.key === k)?.value
  const stepPx = t => {
    const m = /\{spacing\.([\w-]+)\}/.exec(String(t ?? ''))
    return m ? parseFloat(px(derived.spacing, m[1])) : parseFloat(t)
  }
  const inner = stepPx(propOf('barGap')), outer = stepPx(propOf('groupGap'))
  assert(inner > 0 && outer > 0, `the chart publishes both gaps (${inner} inside, ${outer} between)`)
  assert(outer / inner >= gBar,
    `and their ratio clears the bar (${(outer / inner).toFixed(1)}:1 against ${gBar}:1)`)
}

line(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`)
process.exit(failures ? 1 : 0)
