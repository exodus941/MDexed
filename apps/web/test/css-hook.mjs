/* Lets the plain-Node suite import the emit layer.
 *
 * Three modules read a stylesheet with Vite's `?raw`, and Node refuses the
 * extension. So `emit/html.js` was unreachable from the suite, and it writes
 * half the package by bytes. That gap cost a real defect: a dark-only export
 * shipped eleven light sample pages, each with a working theme toggle, and no
 * test could open one to notice.
 *
 * The hook resolves `./x.css?raw` to the file beside it and hands back its text
 * as a default export, which is exactly what Vite does. Nothing is stubbed and
 * no content is invented, so a test reads the same string the build ships.
 *
 * REGISTERED FROM ITS OWN FILE, AND THE CONSUMER IS IMPORTED DYNAMICALLY.
 * Resolution of a whole static graph happens before any module evaluates, so a
 * static `import` of html.js would fail before this ever ran.
 */
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RAW = /\.css\?raw$/

registerHooks({
  resolve (spec, ctx, next) {
    if (RAW.test(spec)) {
      return { url: new URL(spec, ctx.parentURL).href, shortCircuit: true }
    }
    return next(spec, ctx)
  },
  load (url, ctx, next) {
    if (RAW.test(url)) {
      const text = readFileSync(fileURLToPath(url.replace('?raw', '')), 'utf8')
      return {
        format: 'module',
        shortCircuit: true,
        source: 'export default ' + JSON.stringify(text),
      }
    }
    return next(url, ctx)
  },
})
