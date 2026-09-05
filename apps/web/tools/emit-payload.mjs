/* ── EMIT THE WHOLE PACKAGE FROM NODE, EXAMPLE PAGES INCLUDED ──
 *
 * Every simulation before this one used a hand-written harness that called
 * `payloadTextFiles` and nothing else. That function does not build the
 * `EXAMPLE-*.html` pages: the app's export loop does, in `App.jsx`, because it
 * needs React SSR and `emit/html.js`.
 *
 * `emit/html.js` reaches `preview/tokens.js`, which does
 * `import previewCss from './preview.css?raw'`. `?raw` is a VITE feature. Bare
 * Node cannot resolve it, so the harness skipped the whole example step,
 * printed "(0 example pages)" and carried on.
 *
 * IT PRINTED A ZERO AND NOBODY READ IT. Twelve simulated builds were handed a
 * package missing 22 of its 34 files, and the missing ones are the only place
 * a reader can see a component built correctly. A run that measured nothing is
 * not a pass, and a count of zero is the loudest way a harness can say so.
 *
 * The fix is to stop working around Vite and use it. Vite is already a
 * dependency here, so `ssrLoadModule` resolves `?raw` exactly as the browser
 * build does, and the same code produces the same files.
 *
 *   node apps/web/tools/emit-payload.mjs <state.json> <out-dir>
 *
 * The output is byte-for-byte what the Export Payload button writes. */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { createServer } from 'vite'

const HERE = path.dirname(url.fileURLToPath(import.meta.url))
const WEB = path.resolve(HERE, '..')

const [stateArg, outArg] = process.argv.slice(2)
if (!stateArg || !outArg) {
  console.error('usage: node apps/web/tools/emit-payload.mjs <state.json> <out-dir>')
  process.exit(1)
}

const vite = await createServer({
  root: WEB,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

try {
  const load = p => vite.ssrLoadModule(p)
  /* VITE FOR THE PROJECT'S OWN SOURCE, NODE FOR THE PACKAGES. Running React
     through the SSR evaluator hands its CommonJS to an ESM runner, which
     throws ERR_AMBIGUOUS_MODULE_SYNTAX. Only this repo's files need the
     transform, and only for `?raw` and JSX. */
  const [payload, migrateMod, deriveMod, htmlMod, canvas] = await Promise.all([
    load('/src/emit/payload.js'),
    load('/src/state/migrate.js'),
    load('/src/state/derive.js'),
    load('/src/emit/html.js'),
    load('/src/preview/Canvas.jsx'),
  ])
  const [React, server] = await Promise.all([import('react'), import('react-dom/server')])

  const raw = JSON.parse(fs.readFileSync(path.resolve(stateArg), 'utf8'))
  const { state, warning } = migrateMod.migrate(raw)
  if (warning) console.log('migrate warning:', warning)
  const derived = deriveMod.derive(state)

  const files = { ...payload.payloadTextFiles(state, derived) }

  /* THE SAME LOOP THE APP RUNS. The markup is rendered once per surface and
     reused for both themes, because the theme is a variable swap and nothing
     else. `createElement` rather than JSX, so this file needs no transform of
     its own. */
  const { createElement: h } = React.default ?? React
  const renderToStaticMarkup = (server.default ?? server).renderToStaticMarkup
  const SURFACES = canvas.SURFACES
  if (!Array.isArray(SURFACES) || !SURFACES.length) throw new Error('no SURFACES exported from Canvas.jsx')

  for (const s of SURFACES) {
    const markup = renderToStaticMarkup(
      h('div', { className: 'dmd-frame' },
        h('div', { className: 'dmd' },
          h(s.Component, { layout: derived.componentLayout, tabStyle: state.components?.tabStyle })))
    )
    for (const mode of payload.HTML_EXAMPLES_MODES) {
      files[payload.exampleFilename(mode, s.id)] =
        htmlMod.previewHtml({ state, derived, markup, surface: s.label, mode })
    }
  }

  const out = path.resolve(outArg)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(out, name), text)

  /* A COUNT OF ZERO IS THE FAULT THIS FILE EXISTS FOR, so it fails rather than
     reporting a clean run. The expected count is every surface in both themes. */
  const pages = Object.keys(files).filter(n => n.startsWith(payload.EXAMPLE_PREFIX)).length
  const want = SURFACES.length * payload.HTML_EXAMPLES_MODES.length
  const kb = n => (n / 1024).toFixed(1) + 'KB'
  console.log(`\n${Object.keys(files).length} files written to ${path.relative(process.cwd(), out)}`)
  console.log(`  ${pages} example pages (${SURFACES.length} surfaces x ${payload.HTML_EXAMPLES_MODES.length} themes)`)
  for (const [name, text] of Object.entries(files).sort((a, b) => b[1].length - a[1].length).slice(0, 8)) {
    console.log('  ' + kb(Buffer.byteLength(text)).padStart(9) + '  ' + name)
  }
  if (pages !== want) {
    console.error(`\nFAIL - ${pages} example pages, expected ${want}. The package is incomplete.`)
    process.exit(1)
  }
  console.log(`\nPASS - the package is complete\n`)
} finally {
  await vite.close()
}
