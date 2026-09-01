/* Export a full payload — text files AND the EXAMPLE pages — outside the browser.
 *
 * The examples need React to render, so App.jsx builds them and the plain-Node
 * exporter cannot. Vite's SSR loader transforms the JSX, so this reaches the
 * same `previewHtml` the button calls and the package a reader receives is the
 * package a simulation reads.
 *
 * Usage: node tools/sim-export.mjs <out-dir> [<state-patch.mjs>]
 * The patch module default-exports a function that mutates the fresh state.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const outDir = process.argv[2]
const patchPath = process.argv[3]
if (!outDir) { console.error('need an output directory'); process.exit(1) }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const load = p => vite.ssrLoadModule(p)

try {
  const { createInitialState } = await load('/src/state/schema.js')
  const { derive } = await load('/src/state/derive.js')
  const { audit } = await load('/src/a11y/audit.js')
  const { payloadTextFiles, exampleFilename, HTML_EXAMPLES_MODES } = await load('/src/emit/payload.js')
  const html = await load('/src/emit/html.js')
  const { SURFACES } = await load('/src/preview/Canvas.jsx')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = await import('react')

  const state = createInitialState()
  if (patchPath) (await import('file:///' + resolve(patchPath).replace(/\\/g, '/'))).default(state)
  const derived = derive(state)

  const findings = audit(state, derived)
  console.log('audit:', findings.length ? findings.map(f => f.level + ':' + f.id).join('  ') : 'CLEAN')

  const files = payloadTextFiles(state, derived)
  for (const s of SURFACES) {
    const markup = renderToStaticMarkup(
      React.createElement('div', { className: 'dmd-frame' },
        React.createElement('div', { className: 'dmd' },
          React.createElement(s.Component, {
            layout: derived.componentLayout,
            tabStyle: state.components?.tabStyle,
          }))))
    for (const mode of HTML_EXAMPLES_MODES)
      files[exampleFilename(mode, s.id)] =
        html.previewHtml({ state, derived, markup, surface: s.label, mode })
  }

  mkdirSync(outDir, { recursive: true })
  let total = 0
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(resolve(outDir, name), text)
    total += text.length
  }
  console.log(`${Object.keys(files).length} files, ${(total / 1024).toFixed(0)} KB`)
} finally {
  await vite.close()
}
