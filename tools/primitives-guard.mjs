/* A preview screen may not re-implement a primitive inline.
 *
 * Every layout value in `preview/screens/` has a class behind it. `.row` is a
 * baseline-aligned flex row with an `xs` gap. `.stack` is a column with an `md`
 * gap. `.divider` is a 1px rule with no margin, so a stack's gap sits it in a
 * symmetric space. `.card`, `.avatar`, `.badge`, `.btn` are the components.
 *
 * I rebuilt one title bar four times, hand-writing a height, then padding, then
 * an asymmetric correction, then a gap, then a heavier line. Each was argued
 * for in a comment and each was arbitrary. Every one of them had a class that
 * already answered it, and the Landing header — built from nothing but those
 * classes — was correct the whole time.
 *
 * Writing the rule into five stores did not stop me. This does.
 *
 * ── Scope, and why it is not "every file you point me at" ──
 *
 * These classes live under `.dmd`, the region that hosts somebody else's design.
 * The editor's own chrome never loads that stylesheet, so `.row` is not
 * available there and `alignItems: 'baseline'` in `App.jsx` is the correct way
 * to write the same thing. Run on the whole tree, the first version reported
 * exactly that and called it a defect. A check that fires on correct code buries
 * the findings that matter, so this one walks to find `preview/` files and
 * ignores the rest, whatever directory it is given.
 *
 * Run: node tools/primitives-guard.mjs [dir]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.argv[2] ?? 'apps/web/src/preview'

/* Each rule: the inline pattern, and the primitive that already does it. */
/* Only rules that are unambiguous, because a check firing on correct code is
   worse than the miss it prevents. Padding, line-height and column layouts all
   have legitimate one-off uses — a modal's inner rhythm, an icon's inset — and
   flagging those buries the real findings.
   These three have no legitimate inline form in a preview screen. */
/* `only` narrows a rule to the files it was written about. A surface fill on a
   whole screen means "this is a card, drawn by hand". The same fill on a switch
   knob or a sample's backing is the correct token for a small part, and the
   first version reported both. A rule wider than the problem is a bigger bug
   than the problem. */
const RULES = [
  { re: /alignItems:\s*'baseline'/, use: '.row — it is baseline-aligned already' },
  { re: /borderBottom:\s*'1px solid var\(--c-border[,)]/, use: 'hr.divider, or --c-border-subtle. `border` is a control outline, not a rule' },
  { re: /background:\s*'var\(--c-surface[,)]/, use: '.card — a fill has to mean something', only: /screens[\\/]/ },
  { re: /borderRadius:\s*'var\(--cmp-card-rounded/, use: '.card' },
]

/* Only files that render inside `.dmd`. */
const inScope = file => /[\\/]preview[\\/]/.test(file) && /\.jsx$/.test(file)

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full, out) }
    else if (inScope(full)) out.push(full)
  }
  return out
}

const files = walk(ROOT)

const findings = []
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  /* Comments explain these patterns on purpose. Blank them, or the file that
     documents the trap becomes the file that fails.
     Blank, not delete: a comment replaced by nothing takes its newlines with it
     and every line number below it shifts. The first version did that and
     reported a hit 46 lines above the code it had found. */
  const blank = m => m.replace(/[^\n]/g, ' ')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank)
  const lines = code.split('\n')
  for (const rule of RULES) {
    if (rule.only && !rule.only.test(file)) continue
    /* Every occurrence, not the first. One `break` per rule per file hid the
       second copy of the same mistake, which is the copy that drifts. */
    for (let i = 0; i < lines.length; i++) {
      if (!rule.re.test(lines[i])) continue
      findings.push({ file: path.relative(ROOT, file), line: i + 1, use: rule.use, text: lines[i].trim().slice(0, 64) })
    }
  }
}

if (!findings.length) {
  console.log('primitives guard: ' + files.length + ' preview files clean')
  process.exit(0)
}
console.log('primitives guard: ' + findings.length + ' inline value(s) a class already provides\n')
for (const f of findings) {
  console.log('  ' + f.file + ':' + f.line + '  ' + f.text)
  console.log('      use ' + f.use + '\n')
}
process.exit(1)
