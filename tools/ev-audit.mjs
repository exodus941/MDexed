/* Which of this session's changes reached which of the five stores.
 *
 * Store 1  ~/.claude/CLAUDE.md, mastered at _tools/core-rules.md
 * Store 2  _tools/skills/*\/SKILL.md
 * Store 3  the project's memory/
 * Store 4  the app's own rules: stylesheet, preview, chrome
 * Store 5  the payload export
 *
 * A rule does NOT belong in every store. Store 5 takes it only if it changes
 * what the receiving agent builds. Store 4 only if the app itself renders it.
 * So the audit records "n/a" as a real answer, and only a missing REQUIRED
 * store is a gap. */
import { readFileSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const T = 'C:/Users/Voidwatcher/Dropbox/VibeCoding/_tools'
const P = 'C:/Users/Voidwatcher/Dropbox/VibeCoding/DesignMohammad/design-md-editor/apps/web'
const M = 'C:/Users/Voidwatcher/.claude/projects/C--Users-Voidwatcher-Dropbox-VibeCoding-DesignMohammad/memory'

const flat = s => s.replace(/\s+/g, ' ').toLowerCase()
const core = flat(readFileSync(`${T}/core-rules.md`, 'utf8'))
const skills = readdirSync(`${T}/skills`).map(d => {
  try { return flat(readFileSync(`${T}/skills/${d}/SKILL.md`, 'utf8')) } catch { return '' }
}).join(' ')
const mem = readdirSync(M).filter(f => f.endsWith('.md'))
  .map(f => flat(readFileSync(`${M}/${f}`, 'utf8'))).join(' ')
const payload = flat(execSync(
  `node -e "import('file:///${P}/src/state/schema.js').then(async s=>{`
  + `const d=await import('file:///${P}/src/state/derive.js');`
  + `const g=await import('file:///${P}/src/emit/designmd.js');`
  + `const st=s.createInitialState();process.stdout.write(g.generateFile(st,d.derive(st)).text)})"`,
  { encoding: 'utf8', maxBuffer: 1 << 24 }))
const appCode = flat([
  'src/preview/preview.css', 'src/preview/screens/Index.jsx', 'src/preview/screens/Dialog.jsx',
  'src/preview/screens/Empty.jsx', 'src/preview/screens/Settings.jsx', 'src/a11y/audit.js',
  'public/sweep-all.js', 'src/panels/TypographyPanel.jsx', 'src/panels/ColorPanel.jsx', 'src/preview/Canvas.jsx', 'src/preview/icons.jsx', 'src/ui/controls.jsx',
].map(f => { try { return readFileSync(`${P}/${f}`, 'utf8') } catch { return '' } }).join(' ') + readFileSync('C:/Users/Voidwatcher/Dropbox/VibeCoding/_tools/bin/layout-tools.js','utf8'))

/* [name, core-rules probe, memory probe, app probe, payload probe]
   null = not required in that store. */
const CHANGES = [
  ['overlay declares itself a dialog',
    'an overlay is not a card in a page', '`aria-*` or `role` in', 'aria-modal="true"', 'role="dialog"'],
  ['dialog named by its own heading',
    'aria-labelledby', 'aria-labelledby', 'aria-labelledby', 'aria-labelledby'],
  ['invalid field points at its message',
    'an invalid field points at its own message', 'aria-describedby', 'aria-describedby', 'aria-describedby'],
  ['disabled vs aria-disabled',
    'are not interchangeable', 'aria-disabled', 'aria-disabled', 'aria-disabled'],
  ['pager announces its range',
    null, 'live region', 'aria-live', 'is a live region'],
  ['loading is the fourth empty state',
    'four states, never one', 'fourth', 'aria-busy', 'fourth** empty state'],
  ['a skeleton holds its shape',
    'holds the shape of what is coming', 'skeleton', 'skeleton-line', 'holds the shape of what is coming'],
  ['a spread replaces a prop',
    'a spread replaces a prop', 'a spread replaces a prop', null, null],
  ['a gated block opens, not appears',
    'opens, it does not appear', 'expand', 'expand', 'opens, it does not appear'],
  ['heading align is a setting',
    'which line is a setting', 'three-way heading align', 'data-heading-align', "centres on the heading's last line"],
  ['the fault lives between breakpoints',
    'the fault lives between two of them', 'between the breakpoints', 'midpoint of each adjacent', null],
  ['a verdict names its coverage',
    'a verdict names its own coverage', 'widthsswept', 'widthsswept', null],
  ['a tool asserts the state landed',
    'must assert the state landed', 'refuses a value it has no option', 'width not applied', null],
  ['a summary that truncates says so',
    'a summary that truncates must say so', 'capped every category', 'no silent cap', null],
  ['a check scoped by closest flips',
    'flips when the markup moves', 'flips', 'walk ancestors', null],
  ['a sample painted in editor colours',
    "editor's own colours is not a sample", 'hard to pick the previews apart', 'entry-sample', null],
  ['a sample that cannot change',
    'a sample that cannot change proves', '64.81px', 'mono face already gives every digit', null],
  /* ── the two newest ── */
  ['the between-groups gap answers to the inside gap',
    'is the between-groups number', 'batch bar', 'column-gap: var(--space-lg', null],
  ['select-all belongs in the header cell',
    'top of the column it controls', 'select-all', 'select all invoices', 'select-all'],
]

const rows = []
for (const [name, c, m, a, p] of CHANGES) {
  const hit = (probe, hay) => probe === null ? 'n/a' : (hay.includes(probe.toLowerCase()) ? 'yes' : 'MISSING')
  rows.push({
    change: name,
    core: hit(c, core),
    skills: c === null ? 'n/a' : (skills.includes('core:begin') || skills.includes('the shared rules are in') ? 'points at core' : 'MISSING'),
    memory: hit(m, mem),
    app: hit(a, appCode),
    payload: hit(p, payload),
  })
}
const pad = (s, n) => String(s).padEnd(n)
console.log(pad('CHANGE', 50) + pad('CORE', 9) + pad('MEM', 9) + pad('APP', 9) + 'PAYLOAD')
for (const r of rows) console.log(pad(r.change, 50) + pad(r.core, 9) + pad(r.memory, 9) + pad(r.app, 9) + r.payload)
const gaps = rows.flatMap(r => ['core', 'memory', 'app', 'payload'].filter(k => r[k] === 'MISSING').map(k => `${r.change} -> ${k}`))
console.log(`\n${gaps.length} gap(s)`)
for (const g of gaps) console.log('  ' + g)
