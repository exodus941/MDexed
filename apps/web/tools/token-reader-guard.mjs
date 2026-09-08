/* ── A PUBLISHED TOKEN THAT NOTHING READS IS INVISIBLE ──
 *
 * The alert declared a borderColor on all four variants, the emitter published
 * every one, and no rule consumed them. So the border always took the text
 * colour, and setting it in the editor changed nothing on screen. They found
 * it by trying.
 *
 * Measured then: 362 component tokens published, 86 read by no stylesheet at
 * all. The select was the worst, with every one of its twelve unread, so
 * nothing a person changed about a select changed anything.
 *
 * WHAT THIS GUARD IS FOR. Not the 86, which are a body of work. This stops a
 * NEW one appearing, which is why it ratchets on a recorded count rather than
 * demanding zero. A number that can only fall is a guard somebody keeps.
 *
 * ── FOUR SCOPE DECISIONS, EACH NEEDED TO KEEP IT HONEST ──
 *
 * ONLY --cmp- TOKENS. A colour role, a spacing step or a type metric is read
 * by whatever the reader builds, and this repository is not that build.
 *
 * A TOKEN READ THROUGH A COMPUTED NAME COUNTS AS READ. A stylesheet may
 * consume a family by prefix, and a check that cannot see that would fault
 * correct code. So a prefix match up to the last hyphen counts too.
 *
 * THE PREVIEW IS THE CONSUMER, NOT THE CHROME. `.dmd` styles the hosted
 * document, which is what a component token is for. The editor's own chrome
 * paints itself from its own set.
 *
 * AND A RUN THAT READ NOTHING FAILS. Zero tokens or zero stylesheet bytes is
 * a broken run, and a broken run that prints a pass is worse than no guard.
 *
 * Run: node tools/token-reader-guard.mjs [--record]
 */
import './../test/css-hook.mjs'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const web = path.join(here, '..')
const load = f => import(url.pathToFileURL(path.join(web, 'src', f)).href)

const { createInitialState } = await load('state/schema.js')
const { derive } = await load('state/derive.js')
const { payloadTextFiles } = await load('emit/payload.js')

const st = createInitialState()
const tokensCss = payloadTextFiles(st, derive(st))['tokens.css']

const published = new Set()
for (const m of tokensCss.matchAll(/(--cmp-[\w-]+)\s*:/g)) published.add(m[1])

/* THE WHOLE PREVIEW, not only its stylesheets. EntrySample and Gallery carry
   var(--cmp-select-height) and var(--cmp-tab-font-family) in style objects, so
   a CSS-only scan reports those tokens as unread. */
let css = ''
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full)
    else if (/\.(jsx?|css)$/.test(e.name)) css += fs.readFileSync(full, 'utf8') + '\n'
  }
}
for (const rel of ['src/preview']) {
  const d = path.join(web, rel)
  if (fs.existsSync(d)) walk(d)
}

if (published.size < 100 || css.length < 10000) {
  console.error('token-reader guard: read ' + published.size + ' tokens and '
    + css.length + ' bytes of CSS. Nothing was checked, and that is not a pass.')
  process.exit(1)
}

/* A TOKEN READ THROUGH A COMPUTED NAME COUNTS AS READ. Some families are
   consumed by prefix, so a stylesheet naming the prefix reads them all. */
const readsIt = name => {
  if (css.includes(name)) return true
  const prefix = name.slice(0, name.lastIndexOf('-') + 1)
  return prefix.length > 7 && css.includes(prefix)
}

const unread = [...published].filter(n => !readsIt(n)).sort()

const recordPath = path.join(here, 'token-reader.json')
const record = fs.existsSync(recordPath)
  ? JSON.parse(fs.readFileSync(recordPath, 'utf8'))
  : { unread: unread.length, published: published.size }

const byComponent = {}
for (const n of unread) {
  const c = n.replace(/^--cmp-/, '').split('-')[0]
  ;(byComponent[c] = byComponent[c] || []).push(n)
}

const args = process.argv.slice(2)
if (args.includes('--record')) {
  fs.writeFileSync(recordPath, JSON.stringify({ unread: unread.length, published: published.size }, null, 1) + '\n')
  console.log('token-reader guard: recorded ' + unread.length + ' unread of ' + published.size + ' published')
  process.exit(0)
}

console.log('token-reader guard: ' + published.size + ' component tokens published, '
  + unread.length + ' read by no stylesheet (recorded ' + record.unread + ')')

if (unread.length > record.unread) {
  console.error('\nA NEW UNREAD TOKEN. It reaches tokens.css and no rule consumes it, so')
  console.error('whatever a person sets it to changes nothing on screen.\n')
  for (const [c, list] of Object.entries(byComponent).sort((a, b) => b[1].length - a[1].length))
    console.error('  ' + String(list.length).padStart(3) + '  ' + c + '   '
      + list.slice(0, 5).map(x => x.replace('--cmp-' + c + '-', '')).join(', ')
      + (list.length > 5 ? ', +' + (list.length - 5) : ''))
  console.error('\nEither consume it in the preview stylesheet, or stop publishing it.')
  console.error('Run with --record only when the count is meant to rise.')
  process.exit(1)
}

if (unread.length < record.unread) {
  console.log('  down from ' + record.unread + '. Run with --record to lock the new figure in.')
}
process.exit(0)
