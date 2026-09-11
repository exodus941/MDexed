/* ── EVERY FIGURE THE README STATES, READ OFF THE MODULES THAT SHIP ──
 *
 * A rule that states a constant needs a check that reads that constant. The
 * README had no such check, so it drifted in silence: 28 semantic roles where
 * the app had 32, 14 components where it had 28, 339 custom properties where
 * derive() builds 555, and 25 kB of DESIGN.md where a default document emits
 * 175. Nothing in the file told a reader which halves had rotted.
 *
 * So each entry below pairs a pattern over the README's own text with the
 * figure the code computes. A stated number that stops matching fails the run,
 * and so does a pattern that finds nothing, because a figure quietly reworded
 * out of the file is the same hole as a figure gone stale.
 *
 * PURE, AND IT STAYS PURE. `readme-facts-guard.mjs` is the CLI and the suite
 * imports this module directly. Importing a file that runs a tool runs the
 * tool, which is how a coverage script once rewrote its own counts from a
 * test.
 *
 * WORDS COUNT TOO. Prose spells a small number, so "Twelve surfaces" is a
 * stated figure exactly as "**22 fixed pairs**" is.
 */

/* Cardinals and ordinals both, because prose reaches for either. "The ninth
   page is the output" states the page count exactly as "nine pages" would. */
const WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
}

/* A capture is a numeral, a numeral with thousands separators, or a word. */
export function toNumber (raw) {
  if (raw == null) return null
  const s = String(raw).trim().replace(/,/g, '')
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  const w = WORDS[s.toLowerCase()]
  return w == null ? null : w
}

/* Build the table. Async because it imports the shipped modules, and the
   caller decides which README text to read. */
export async function facts () {
  const base = new URL('../src/', import.meta.url)
  const load = p => import(new URL(p, base).href)

  const [schema, derive, presets, palette, comps, kb, scaleMod, audit,
    yaml, payload, designmd, checks, changelog, answers, ground, prompt] = await Promise.all([
    load('state/schema.js'), load('state/derive.js'), load('state/presets.js'),
    load('color/palette.js'), load('state/components.js'), load('state/keyboard.js'),
    load('type/scale.js'), load('a11y/audit.js'), load('emit/yaml.js'),
    load('emit/payload.js'), load('emit/designmd.js'), load('emit/checks.js'),
    load('state/changelog.js'), load('casual/answers.js'), load('color/ground.js'),
    load('casual/prompt.js'),
  ])
  const verify = await load('emit/verify.js')
  const layout = await load('state/componentLayout.js')

  const state = schema.createInitialState()
  const derived = derive.derive(state)
  const lightOnly = { ...state, color: { ...state.color, theme: 'light' } }
  const md = designmd.fileText(state, derived)
  const mdBytes = Buffer.byteLength(md, 'utf8')

  /* The surfaces live in a component file, so they are read as text rather
     than imported: pulling in Canvas.jsx would pull in React. */
  const { readFileSync } = await import('node:fs')
  const canvas = readFileSync(new URL('preview/Canvas.jsx', base), 'utf8')
  const surfaceBlock = canvas.slice(canvas.indexOf('export const SURFACES = ['))
  const surfaces = [...surfaceBlock.slice(0, surfaceBlock.indexOf('\n]'))
    .matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map(m => m[1])

  /* The picker's model tabs are a module-private const in a JSX file, so they
     are read as text too rather than restated here. A figure typed into this
     table is the same hole as a figure typed into the README. */
  const picker = readFileSync(new URL('ui/ColorPicker.jsx', base), 'utf8')
  const models = (picker.match(/const MODELS = \[([^\]]*)\]/)?.[1] ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)

  /* The panel strip, read the same way and for the same reason. */
  const app = readFileSync(new URL('App.jsx', base), 'utf8')
  const tabBlock = app.slice(app.indexOf('const TABS = ['))
  const panels = [...tabBlock.slice(0, tabBlock.indexOf('\n]'))
    .matchAll(/\{\s*id:\s*'([a-z]+)'/g)].map(m => m[1])

  const suite = readFileSync(new URL('../test/pipeline.mjs', base), 'utf8')
  const assertSites = (suite.match(/\bassert\(/g) || []).length
  const groups = [...suite.matchAll(/line\((['"`])\\n- (.+?) -\1\)/g)].length

  const pkg = JSON.parse(readFileSync(new URL('../../../package.json', base), 'utf8'))
  const guards = (pkg.scripts.check.match(/\bnode\s/g) || []).length

  /* The map the document writes about itself, parsed back out of it. Every
     figure the README quotes about the file's shape comes from here, so the
     two cannot state different numbers for one question. */
  const map = md.slice(md.indexOf('## How to read this file'), md.indexOf('\n## Overview'))
  const mapWords = Number((map.match(/About ([\d,]+) words/)?.[1] ?? '0').replace(/,/g, ''))
  const mapRows = [...map.matchAll(/^- \*\*(.+?)\*\* — (\d+)%$/gm)]
  const mapSections = mapRows.length
  const mapBiggest = Math.max(0, ...mapRows.map(r => Number(r[2])))

  const report = audit.audit(state, derived)
  const findings = report?.findings ?? report?.items ?? (Array.isArray(report) ? report : [])

  const examples = surfaces.length * payload.exampleModes(state).length
  const textFiles = Object.keys(payload.payloadTextFiles(state, derived)).length

  /* `re` captures one figure per group. `slack` allows a rounded figure: a
     file size and a word count are stated to the nearest unit a reader can
     hold, never to the byte. */
  return [
    /* ── The two doors ── */
    { label: 'preview surfaces, in the opening paragraph',
      re: /on (\w+) live mock screens/, actual: surfaces.length },
    { label: 'questions the guided door advertises',
      re: /Answer (\w+) questions and hand/, actual: answers.STEPS.filter(s => s.id !== 'prompt').length },
    { label: 'wizard pages', re: /The (\w+) page is the output/, actual: answers.STEPS.length },
    { label: 'question pages carrying a sample', re: /\*\*(\w+)\*\* of them draw a live sample/,
      actual: answers.STEPS.filter(s => s.id !== 'prompt' && s.sample).length },
    { label: 'editor panels', re: /The editor\. (\w+) panels,/, actual: panels.length },
    { label: 'themes the wizard offers',
      re: /\| Light, Dark, or Both\? \| Which themes ship \| (\d+) \|/, actual: answers.THEMES.length },
    { label: 'brand colours the wizard accepts',
      re: /first one is the accent \| up to (\d+) \|/, actual: answers.BRAND_MAX },
    { label: 'hue families',
      re: /if you gave no colours \| (\d+) \|/, actual: answers.PALETTES.length },
    { label: 'ground tints the wizard offers',
      re: /What every surface is tinted with \| (\d+) \|/, actual: answers.GROUNDS.length },
    { label: 'type pairings',
      re: /A display and body pairing \| (\d+) \|/, actual: answers.TYPE_PAIRINGS.length },
    { label: 'tightness steps',
      re: /\| Tightness \| Density \| (\d+) \|/, actual: answers.TIGHTNESS.length },
    { label: 'corner shapes',
      re: /Corner shape, card edges, lift \| (\d+) \/ \d+ \/ \d+ \|/, actual: answers.SHAPES.length },
    { label: 'card edge treatments',
      re: /Corner shape, card edges, lift \| \d+ \/ (\d+) \/ \d+ \|/, actual: answers.DEPTHS.length },
    { label: 'lift steps',
      re: /Corner shape, card edges, lift \| \d+ \/ \d+ \/ (\d+) \|/, actual: answers.INTENSITIES.length },
    /* Stated to the nearest ten, because the figure moves with the answers and
       a reader only needs its order of magnitude. */
    { label: 'words in the generated prompt', re: /about (\d+) words of text/,
      actual: prompt.buildPrompt(answers.BLANK).split(/\s+/).filter(Boolean).length, slack: 25 },
    { label: 'role pairs the prompt names', re: /(\w+) role pairs have to stay/,
      actual: prompt.GUARDRAIL.pairs.length },

    /* ── Quick start ── */
    { label: 'assertion sites in the suite',
      re: /\| ([\d,]+) assertion sites in \d+ groups/, actual: assertSites },
    { label: 'groups in the suite',
      re: /\| [\d,]+ assertion sites in (\d+) groups/, actual: groups },
    { label: 'guards in npm run check',
      re: /`npm run check` \| (\d+) guards/, actual: guards },

    /* ── The panels ── */
    { label: 'presets', re: /\*\*(\d+) presets\*\*/, actual: presets.PRESETS.length },
    { label: 'harmonies', re: /\*\*(\d+) harmonies\*\*/, actual: palette.HARMONIES.length },
    { label: 'generator intensities', re: /\*\*(\d+) intensities\*\*/, actual: palette.INTENSITIES.length },
    { label: 'ramp steps per seed', re: /\*\*(\d+) steps\*\* per seed/, actual: derive.RAMP_STEPS.length },
    { label: 'chart scales', re: /\*\*(\w+) chart scales\*\*/,
      actual: ['categorical', 'sequential', 'diverging'].filter(k => derived.dataviz?.[k]).length },
    { label: 'ground tints in the editor', re: /(\w+) answers — the accent/,
      actual: Object.keys(ground.GROUND_TINTS).length },
    { label: 'semantic roles', re: /\*\*(\d+) semantic roles\*\*/, actual: schema.ALL_ROLES.length },
    { label: 'role groups', re: /\*\*\d+ semantic roles\*\* in (\d+) groups/, actual: schema.ROLE_GROUPS.length },
    { label: 'fixed contrast pairs', re: /\*\*(\d+) fixed pairs\*\*/, actual: schema.CONTRAST_PAIRS.length },
    { label: 'selection treatments', re: /a choice of (\w+) —/, actual: Object.keys(comps.SELECTION_STYLES).length },
    { label: 'selection edge weights', re: /with (\w+) edge weights/, actual: Object.keys(comps.SELECTION_EDGES).length },
    { label: 'OpenType feature toggles', re: /plus \*\*(\d+)\*\* OpenType feature toggles/, actual: scaleMod.OPENTYPE_FEATURES.length },
    { label: 'named type ratios', re: /\*\*(\d+) named ratios\*\*/, actual: scaleMod.RATIOS.length },
    { label: 'colour models in the picker', re: /\*\*(\d+) models\*\* \(HSB/, actual: models.length },
    { label: 'text styles', re: /generating \*\*(\d+) text styles\*\*/, actual: derived.typography.length },
    { label: 'breakpoints', re: /\*\*(\d+) breakpoints\*\*/, actual: (state.layout?.breakpoints ?? []).length },
    { label: 'stacking layers', re: /\*\*(\w+) stacking layers\*\*/, actual: Object.keys(derive.Z_LAYERS).length },
    { label: 'components', re: /\*\*(\d+) components\*\* in \d+ groups/, actual: comps.COMPONENT_LIBRARY.length },
    { label: 'component groups', re: /\*\*\d+ components\*\* in (\d+) groups/, actual: comps.COMPONENT_GROUPS.length },
    { label: 'flattened entries', re: /\*\*(\d+) flattened entries\*\*/,
      actual: Object.keys(comps.expandComponents(state.components ?? {})).length },
    { label: 'component variants', re: /\*\*(\d+) variants\*\*/,
      actual: new Set(comps.COMPONENT_LIBRARY.flatMap(c => Object.keys(c.variants ?? {}))).size },
    { label: 'component sizes', re: /\*\*(\d+) sizes\*\*/,
      actual: new Set(comps.COMPONENT_LIBRARY.flatMap(c => Object.keys(c.sizes ?? {}))).size },
    { label: 'interaction states', re: /\*\*(\d+) interaction states\*\*/,
      actual: new Set(comps.COMPONENT_LIBRARY.flatMap(c => Object.keys(c.states ?? {}))).size },
    { label: 'components with a composition', re: /\*\*(\d+) components\*\* have one/,
      actual: layout.LAYOUT_COMPONENTS.length },
    { label: 'fields in the modal composition', re: /A modal's covers ([^.]+)\./,
      actual: layout.LAYOUT_COMPONENTS.find(c => c.name === 'modal').fields.length,
      count: s => s.split(/,| and /).filter(x => x.trim()).length },
    { label: 'chart components', re: /(\w+) of the \d+ are chart types/,
      actual: comps.COMPONENT_LIBRARY.filter(c => c.group === 'Charts').length },
    { label: 'components, restated beside the chart share', re: /\w+ of the (\d+) are chart types/,
      actual: comps.COMPONENT_LIBRARY.length },
    { label: 'keyboard contracts', re: /(\d+) contracts, \d+ with keys of their own/, actual: kb.KEYBOARD_CONTRACTS.length },
    { label: 'contracts with keys', re: /\d+ contracts, (\d+) with keys of their own/, actual: kb.INTERACTIVE_CONTRACTS.length },
    { label: 'contracts declaring none', re: /and (\d+) declaring none/,
      actual: kb.KEYBOARD_CONTRACTS.length - kb.INTERACTIVE_CONTRACTS.length },
    { label: 'anti-patterns', re: /\*\*(\d+)-item anti-pattern checklist\*\*/, actual: schema.ANTI_PATTERNS.length },
    { label: 'prose sections', re: /\*\*(\d+) prose sections\*\*/, actual: schema.PROSE_SECTIONS.length },
    { label: 'history categories', re: /\*\*(\d+) categories\*\*/, actual: changelog.CHANGE_CATEGORIES.length },

    /* ── Accessibility ── */
    { label: 'accessibility requirements shipped', re: /\*\*(\w+) requirements ship inside/, actual: audit.REQUIREMENTS.length },
    { label: 'requirements checkable here', re: /(\w+) of them are checkable here/,
      actual: audit.REQUIREMENTS.filter(r => r.checked).length },
    { label: 'findings on the default document', re: /raises \*\*(\w+) findings\*\*/, actual: findings.length },

    /* ── Preview ── */
    { label: 'preview surfaces', re: /\*\*(\w+) surfaces\*\*, with a light and dark toggle/, actual: surfaces.length },
    { label: 'CSS custom properties', re: /\*\*(\d+) CSS custom properties\*\*/,
      actual: Object.keys(derive.buildCssVars(derived, 'light')).length },

    /* ── Export ── */
    { label: 'payload files, in the saving table', re: /A zip of (\d+) files/, actual: textFiles + examples },
    { label: 'payload files', re: /that is \*\*(\d+) files\*\*/, actual: textFiles + examples },
    { label: 'payload text files', re: /\*\*\d+ files\*\*: (\d+) text files/, actual: textFiles },
    { label: 'source checks, in the file table', re: /`VERIFY\.mjs` \| (\d+) checks/, actual: checks.SOURCE_CHECKS.length },
    { label: 'render checks, in the file table', re: /`VERIFY-BROWSER\.js` \| (\d+) checks/, actual: checks.RENDER_CHECKS.length },
    { label: 'source checks', re: /(\d+) checks run in Node over the source/, actual: checks.SOURCE_CHECKS.length },
    { label: 'render checks', re: /(\d+) run in the browser over the rendered page/, actual: checks.RENDER_CHECKS.length },
    { label: 'manual checklist lines', re: /(\d+) remain as checklist lines/, actual: checks.MANUAL_CHECKS.length },
    /* A single-theme package ships fewer, because a check the document forbids
       must not be enforced. Counted off the emitted files rather than by
       subtracting, so a check that changes side is caught. */
    { label: 'source checks in a light-only package', re: /carries \*\*(\d+)\*\* source checks/,
      actual: (verify.verifyNodeFile(lightOnly).match(/^ {2}run\(/gm) || []).length },
    { label: 'render checks in a light-only package', re: /and \*\*(\d+)\*\* render checks/,
      actual: (verify.verifyBrowserFile(lightOnly).match(/await run\(/g) || []).length },
    { label: 'checks a light-only package drops', re: /because (\w+) of them are about a theme toggle/,
      actual: checks.SOURCE_CHECKS.length + checks.RENDER_CHECKS.length
        - (verify.verifyNodeFile(lightOnly).match(/^ {2}run\(/gm) || []).length
        - (verify.verifyBrowserFile(lightOnly).match(/await run\(/g) || []).length },
    { label: 'DESIGN.md size in kB', re: /emits about \*\*(\d+) kB\*\*/, actual: Math.round(mdBytes / 1024), slack: 5 },
    /* THE DOCUMENT'S OWN MAP IS THE WRITER, so these are read off the emitted
       file rather than recomputed. My first pass counted the whole file's
       words and its own byte shares, and got 31,000 and 54% where the map
       states 29,900 and 58%. Two figures for one question is how a document
       ends up arguing with itself. */
    { label: 'the word count the map states', re: /\*\*([\d,]+) words\*\* across/, actual: mapWords },
    { label: 'the sections the map lists', re: /words\*\* across \*\*(\d+) sections\*\*/, actual: mapSections },
    { label: 'the biggest section share, as the map puts it', re: /\*\*Components is (\d+)%\*\*/, actual: mapBiggest },

    /* ── Spec conformance ── */
    { label: 'frontmatter keys', re: /\*\*(\w+) allowed keys\*\*/, actual: yaml.SPEC_TOP_LEVEL.length },
    { label: 'component properties', re: /\*\*(\w+) properties\*\*: `backgroundColor`/, actual: yaml.SPEC_COMPONENT_PROPS.length },

    /* ── The closing section names three live figures as well as three old
          ones, so the anecdote can go stale too. ── */
    { label: 'roles, in the closing note', re: /said \d+ roles where the app had (\d+)/, actual: schema.ALL_ROLES.length },
    { label: 'components, in the closing note', re: /\d+ components where it had (\d+)/, actual: comps.COMPONENT_LIBRARY.length },
    { label: 'DESIGN.md size, in the closing note', re: /where it emits (\d+)/, actual: Math.round(mdBytes / 1024), slack: 5 },
  ]
}

/* Score the README against the table. Returns a row per entry so a caller can
   print them all rather than stopping at the first. */
export async function checkReadme (text, extra = []) {
  const rows = [...(await facts()), ...extra]
  return rows.map(f => {
    const m = text.match(f.re)
    if (!m) return { ...f, stated: null, ok: false, why: 'the README no longer states this figure' }
    /* Some figures are stated as a LIST rather than as a number, and a list
       that quietly loses an item is the same drift. `count` turns the captured
       run into the figure it states. */
    const stated = f.count ? f.count(m[1]) : toNumber(m[1])
    if (stated == null) return { ...f, stated: m[1], ok: false, why: `"${m[1]}" is not a number this checker reads` }
    const slack = f.slack ?? 0
    const ok = Math.abs(stated - f.actual) <= slack
    return { ...f, stated, ok, why: ok ? '' : `the README says ${stated}, the code says ${f.actual}` }
  })
}
