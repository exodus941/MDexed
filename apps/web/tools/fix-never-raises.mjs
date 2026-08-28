/* DOES ANY OFFERED REMEDY RAISE THE TOTAL?
 *
 * They opened the Fix It preview and it read failures 3 -> 4. Their words:
 * "it is not trading one failure for another, it is creating additional ones!"
 *
 * WHY IT SHIPPED. `stepThatSeparates` runs INSIDE the audit, so it cannot run
 * the audit. It asked two local questions — is this pair separated now, and does
 * the role keep its own label — and a role sits in many more pairs than the one
 * being repaired. A step answering both can still trip checks it never saw.
 * `chooseFix` runs outside and scores the whole count.
 *
 * THE SHIPPED PRESETS ARE NO TEST. All six audit clean, so the first version of
 * this file offered zero remedies and printed PASS. A pass with nothing in it
 * reads exactly like a pass with everything in it.
 *
 * So the palette is PERTURBED until the check fires: the warning seed is walked
 * round the hue circle, which is precisely how two roles collapse into one
 * colour for red-green vision. That produces the finding they photographed, on
 * palettes nobody has looked at, which is the point.
 */
import { audit, chooseFix } from '../src/a11y/audit.js'
import { derive } from '../src/state/derive.js'
import { PRESETS } from '../src/state/presets.js'

const hex = (h, s, l) => {
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * v).toString(16).padStart(2, '0')
  }
  return '#' + f(0) + f(8) + f(4)
}

let offered = 0, raised = 0, lowered = 0, level = 0, refused = 0, docs = 0
const bad = []

for (const p of PRESETS) {
  const base = p.patch()
  for (let deg = 0; deg < 360; deg += 15) {
    for (const seedName of ['warning', 'danger', 'success']) {
      const doc = {
        ...base,
        color: {
          ...base.color,
          seeds: base.color.seeds.map(s =>
            s.name === seedName ? { ...s, hex: hex(deg, 0.75, 0.4) } : s),
        },
      }
      let d
      try { d = derive(doc) } catch { continue }
      docs++
      const findings = audit(doc, d)
      const before = findings.filter(f => f.level === 'fail' || f.level === 'warn').length
      for (const f of findings) {
        if (!f.apply) continue
        offered++
        const r = chooseFix(doc, d, f.apply, derive)
        if (r.noImprovement) { refused++; continue }
        if (r.total > before) {
          raised++
          bad.push(p.id + ' ' + seedName + '@' + deg + ' / ' + f.id + ': ' + before + ' -> ' + r.total)
        } else if (r.total < before) lowered++
        else level++
      }
    }
  }
}

console.log('documents audited:  ' + docs)
console.log('remedies offered:   ' + offered)
console.log('  lowered the total: ' + lowered)
console.log('  left it level:     ' + level)
console.log('  refused, no step helps: ' + refused)
console.log('  RAISED the total:  ' + raised)
if (!offered) { console.log('\nFAIL - no remedy was ever offered, so this proves nothing'); process.exit(1) }
if (bad.length) { console.log('\n' + bad.slice(0, 12).join('\n')); process.exit(1) }
console.log('\nPASS - no remedy offered to a reader raises the total')
