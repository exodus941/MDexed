/* Every identifier a file references must resolve to a binding.
 *
 * `tabStyle={cfg.tabStyle}` was pasted into a component with no `cfg` in
 * scope. It compiled. It bundled. It passed the syntax guard and the whole
 * test suite. Then it blacked out the app the moment that component rendered,
 * because an undefined identifier is a runtime error and nothing before
 * runtime looks for one.
 *
 * The suite already had a scope check, and it could not have caught this: it
 * only watches SCREAMING_CASE names, so a lowercase `cfg` walks past it.
 *
 * A regex cannot do this job. I tried, and the first version reported 154
 * false positives on healthy code, because nested arrow functions inside a
 * component defeat any brace-counting scope model. This uses Babel's own
 * scope analysis, which is the same machinery the bundler trusts.
 *
 * Run: node tools/scope-guard.mjs [dir ...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const parser = require('@babel/parser')
const traverseModule = require('@babel/traverse')
const traverse = traverseModule.default ?? traverseModule

/* Browser and runtime names Babel will not find a binding for. Kept short on
   purpose: a name added here is a name the guard stops checking. */
const GLOBALS = new Set([
  'window', 'document', 'console', 'navigator', 'location', 'history', 'screen',
  'fetch', 'Request', 'Response', 'Headers', 'FormData', 'Blob', 'File', 'FileReader',
  'URL', 'URLSearchParams', 'Image', 'Audio', 'Event', 'CustomEvent', 'PointerEvent',
  'MouseEvent', 'KeyboardEvent', 'WheelEvent', 'ResizeObserver', 'IntersectionObserver',
  'MutationObserver', 'AbortController', 'localStorage', 'sessionStorage', 'crypto',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia',
  'structuredClone', 'performance', 'TextEncoder', 'TextDecoder', 'DOMParser',
  /* The zip writer deflates through these rather than through a bundled
     library. Guarded with `typeof` at the call site, because a browser without
     them stores the entry instead of failing the export. */
  'CompressionStream', 'DecompressionStream',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Set',
  'Map', 'WeakMap', 'WeakSet', 'Promise', 'RegExp', 'Error', 'TypeError', 'Symbol',
  'Proxy', 'Reflect', 'BigInt', 'Intl', 'globalThis', 'process', 'import', 'require',
  'undefined', 'NaN', 'Infinity', 'HTMLElement', 'SVGElement', 'Node', 'CSS',
  'parseFloat', 'parseInt', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'atob', 'btoa', 'Function',
  'Uint8Array', 'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array',
  'ArrayBuffer', 'DataView', 'Range', 'Element', 'Text', 'CanvasRenderingContext2D',
  /* Vite replaces this at build time, so it never has a binding in source. */
  '__APP_BUILD__',
])

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
  const p = path.join(dir, d.name)
  if (d.isDirectory()) return d.name === 'node_modules' ? [] : walk(p)
  return /\.jsx?$/.test(d.name) ? [p] : []
})

const roots = process.argv.slice(2)
if (!roots.length) roots.push('apps/web/src')

let files = 0
const findings = []

for (const root of roots) {
  if (!fs.existsSync(root)) { console.error('no such path: ' + root); process.exit(2) }
  for (const file of walk(root)) {
    files++
    const code = fs.readFileSync(file, 'utf8')
    let ast
    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'topLevelAwait'],
      })
    } catch (e) {
      findings.push({ file, line: e.loc?.line ?? 0, name: '(parse error)', why: e.message.slice(0, 90) })
      continue
    }

    traverse(ast, {
      ReferencedIdentifier (p) {
        const name = p.node.name
        if (GLOBALS.has(name)) return
        /* A JSX element name that starts lowercase is an HTML tag. */
        if (p.parent.type === 'JSXOpeningElement' && /^[a-z]/.test(name)) return
        if (p.scope.hasBinding(name, true)) return
        findings.push({
          file, line: p.node.loc?.start.line ?? 0, name,
          why: 'no binding in scope',
        })
      },
    })
  }
}

const seen = new Set()
const uniq = findings.filter(f => {
  const k = f.file + ':' + f.line + ':' + f.name
  if (seen.has(k)) return false
  seen.add(k); return true
})

if (!uniq.length) {
  console.log('scope guard: ' + files + ' files clean')
  process.exit(0)
}
console.log('scope guard: ' + uniq.length + ' undefined reference(s) in ' + files + ' files\n')
for (const f of uniq) {
  console.log('  ' + f.file.replace(/\\/g, '/') + ':' + f.line + '  ' + f.name + '  — ' + f.why)
}
process.exit(1)
