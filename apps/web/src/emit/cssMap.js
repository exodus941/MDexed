/* Working out which slot each thing in a stylesheet belongs in.
 *
 * `readCss` returns evidence: colours with counts, families, custom
 * properties, a spacing base. Evidence is not an assignment. This file turns
 * it into a set of *proposals* — one per slot the document can take — each
 * carrying where it came from and how much to trust it.
 *
 * Two sources of signal, in that order of authority:
 *
 *   1. **The name.** `--color-brand-primary` is somebody stating an intent.
 *      Nothing inferred from pixels beats a name, so named matches win
 *      outright and are marked `named`.
 *
 *   2. **The colour itself.** A stylesheet with no custom properties still
 *      has hue: the most saturated colour is almost always the brand, the
 *      grey nearest mid-lightness makes the best neutral, and a colour sitting
 *      at 145° in OKLCH is a green whatever it was called. Marked `inferred`,
 *      and only offered when the hue is close enough to mean something.
 *
 * Everything unmatched is left alone. That is the whole reason the document
 * stores seeds and derives the rest: a slot with no evidence keeps its current
 * value and every token downstream of it stays coherent, rather than being
 * blanked into a hole an agent would have to fill by guessing.
 *
 * No proposal applies itself. The modal shows the table and you confirm it.
 */
import { parseColor, toOklchObj } from '../color/convert.js'

/* ── Slots ──
 *
 * `patterns` are matched against a custom-property name with the noise
 * stripped (`--color-`, `--theme-`, trailing numeric steps). `hue` is the
 * OKLCH centre used by the fallback, with `spread` as how far a colour may sit
 * from it and still count — wide for status colours, because a brand's red is
 * allowed to be a coral. */
export const SLOTS = [
  {
    id: 'accent', label: 'Accent', kind: 'color', group: 'Seeds',
    desc: 'Primary action and emphasis',
    patterns: [/^(brand|primary|accent|main|theme|interactive|link)$/, /\b(brand|primary|accent)\b/],
  },
  {
    id: 'neutral', label: 'Neutral', kind: 'color', group: 'Seeds',
    desc: 'Surfaces, text, borders',
    patterns: [/^(neutral|grey|gray|slate|zinc|stone|mono|ink)$/, /\b(neutral|grey|gray|slate|zinc|stone)\b/],
  },
  {
    id: 'success', label: 'Success', kind: 'color', group: 'Seeds',
    desc: 'Confirmation',
    patterns: [/^(success|positive|valid|confirm|good|ok)$/, /\b(success|positive|valid)\b/],
    hue: 155, spread: 55,
  },
  {
    id: 'warning', label: 'Warning', kind: 'color', group: 'Seeds',
    desc: 'Caution',
    patterns: [/^(warning|warn|caution|attention|pending)$/, /\b(warning|warn|caution)\b/],
    hue: 80, spread: 32,
  },
  {
    id: 'danger', label: 'Danger', kind: 'color', group: 'Seeds',
    desc: 'Destructive and errors',
    patterns: [/^(danger|error|negative|destructive|critical|invalid|alert)$/, /\b(danger|error|destructive|negative)\b/],
    hue: 27, spread: 30,
  },
  {
    id: 'fontBody', label: 'Body face', kind: 'font', group: 'Type',
    desc: 'Paragraphs and UI text',
    patterns: [/^(font|body|text|base|sans|default)$/, /\b(body|text|base|sans)\b/],
  },
  {
    id: 'fontDisplay', label: 'Display face', kind: 'font', group: 'Type',
    desc: 'Headings',
    patterns: [/^(display|heading|head|title|serif)$/, /\b(display|heading|title)\b/],
  },
  {
    id: 'fontMono', label: 'Mono face', kind: 'font', group: 'Type',
    desc: 'Code and figures',
    patterns: [/^(mono|code)$/, /\b(mono|code|monospace)\b/],
  },
  {
    id: 'fontBase', label: 'Body size', kind: 'dimension', group: 'Measurements',
    desc: 'Root font size the type scale grows from',
    patterns: [/\b(font-size|text-base|body-size|base-size)\b/], range: [12, 20],
  },
  {
    id: 'spacingBase', label: 'Spacing base', kind: 'dimension', group: 'Measurements',
    desc: 'The unit every spacing step is a multiple of',
    patterns: [/\b(space|spacing|gap|unit)\b/], range: [2, 16],
  },
  {
    id: 'radiusBase', label: 'Radius base', kind: 'dimension', group: 'Measurements',
    desc: 'Corner radius the shape scale grows from',
    patterns: [/\b(radius|rounded|corner)\b/], range: [0, 32],
  },
]

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]))

/* Names that mark a *derived* token rather than the token itself. A system
   that defines `--primary` and `--primary-hover` means the first one; taking
   the hover state as the brand seed produces a whole palette one step dark. */
const MODIFIER = /\b(hover|active|focus|pressed|disabled|visited|subtle|muted|faint|soft|strong|emphasis|inverse|contrast|on-[a-z]+|fg|foreground|border|ring|shadow|overlay|scrim|backdrop|gradient|start|end|from|to)\b/

/* Prefixes carrying no information — every token in the file has them. */
const NOISE = /^(-{0,2})(color|colour|c|clr|theme|palette|token|ds|ui|sys|md|global|semantic|brand-color)-/

/* A numeric step. `--blue-500` is the base of its ramp by convention; 50 and
   900 are its ends and make poor seeds. */
const STEP = /-(\d{2,3})$/

function normalise(name) {
  let n = name.toLowerCase()
  let prev
  do { prev = n; n = n.replace(NOISE, '') } while (n !== prev)
  return n
}

/**
 * Score one custom property against one slot. Null means no match at all —
 * scores are only comparable within a slot, never across them.
 */
function scoreName(varName, slot) {
  const base = normalise(varName)
  const step = STEP.exec(base)
  const stem = step ? base.slice(0, -step[0].length) : base

  let score = null
  for (let i = 0; i < slot.patterns.length; i++) {
    if (slot.patterns[i].test(stem)) {
      /* An exact match on the whole stem beats a word appearing inside a
         longer name — `--primary` over `--primary-button-background`. */
      score = 100 - i * 25
      break
    }
  }
  if (score == null) return null

  if (MODIFIER.test(base)) score -= 45
  if (step) {
    /* 500 and 600 are the middle of a ramp and the conventional base. */
    const n = Number(step[1])
    score -= Math.min(30, Math.abs(n - 550) / 20)
  }
  /* Shorter names are more likely to be the canonical token. */
  score -= Math.min(12, stem.split('-').length * 3)
  return score
}

const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Propose a value for every slot.
 *
 * @param found  the object `readCss` returned
 * @returns {{proposals: Object, unmatched: Array}} proposals keyed by slot id;
 *          a slot with no evidence is simply absent, which the caller reads as
 *          "keep what you have".
 */
export function mapReference(found) {
  const proposals = {}
  const vars = found.vars ?? []
  const claimed = new Set()

  /* ── Pass one: names ── */
  for (const slot of SLOTS) {
    const kindOk = slot.kind === 'color' ? v => v.kind === 'color'
      : slot.kind === 'font' ? v => v.kind === 'text' && /[a-z]/i.test(v.value)
      : v => v.px != null

    let best = null
    for (const v of vars) {
      if (!kindOk(v) || claimed.has(v.name)) continue
      const score = scoreName(v.name, slot)
      if (score == null || score <= 0) continue
      if (slot.range && (v.px < slot.range[0] || v.px > slot.range[1])) continue
      if (!best || score > best.score) best = { v, score }
    }
    if (!best) continue

    claimed.add(best.v.name)
    proposals[slot.id] = {
      slot: slot.id,
      confidence: 'named',
      source: `--${best.v.name}`,
      why: 'Matched by name.',
      ...normaliseValue(slot, best.v),
    }
  }

  /* ── Pass two: the colours themselves ──
     Only for slots pass one left empty. A stylesheet written before custom
     properties existed still has a brand colour in it somewhere. */
  const palette = (found.colours ?? []).map(c => {
    const parsed = parseColor(c.value)
    const { l, c: chroma, h } = parsed ? toOklchObj(parsed) : {}
    return { ...c, l, chroma, h: h ?? 0 }
  }).filter(c => c.l != null)

  const used = new Set(Object.values(proposals).map(p => p.value))

  /* Status colours claim first, and the order is the whole point.
   *
   * Accent has no hue prior — a brand can be any colour — so an accent pass
   * run first will happily take the greenest green in the file and leave
   * success empty. Success, warning and danger *do* have priors: a colour at
   * 155° is a green whatever else is true of it. Letting the constrained slots
   * pick before the unconstrained one is the difference between a plausible
   * mapping and a wrong one. Tested on a stylesheet with no custom properties
   * at all, which is exactly where this path runs. */
  for (const slot of SLOTS.filter(s => s.hue != null)) {
    if (proposals[slot.id]) continue
    const pick = palette
      .filter(c => !c.grey && !used.has(c.value) && c.chroma > 0.04)
      .map(c => ({ c, d: hueDistance(c.h, slot.hue) }))
      .filter(x => x.d <= slot.spread)
      /* Nearest hue, then most-used, so a two-shade green picks the one that
         carries the weight rather than the one a degree closer. */
      .sort((a, b) => a.d - b.d || b.c.count - a.c.count)[0]
    if (!pick) continue
    used.add(pick.c.value)
    proposals[slot.id] = {
      slot: slot.id, confidence: 'inferred', value: pick.c.value,
      source: `${pick.c.value} · ${pick.c.count}×`,
      why: `Sits ${Math.round(pick.d)}° from where a ${slot.label.toLowerCase()} colour usually sits. Nothing in the file named it.`,
    }
  }

  if (!proposals.accent) {
    /* Frequency times chroma: the brand is the colour that is both saturated
       and actually used, not whichever one is most lurid. */
    const pick = palette.filter(c => !c.grey && !used.has(c.value))
      .sort((a, b) => (b.chroma * Math.log1p(b.count)) - (a.chroma * Math.log1p(a.count)))[0]
    if (pick) {
      used.add(pick.value)
      proposals.accent = {
        slot: 'accent', confidence: 'inferred', value: pick.value,
        source: `${pick.value} · ${pick.count}×`,
        why: 'The most saturated colour left once the status hues were accounted for, weighted by how often it appears. No name in the file said so.',
      }
    }
  }

  if (!proposals.neutral) {
    const pick = palette.filter(c => c.grey && !used.has(c.value))
      .sort((a, b) => Math.abs(a.l - 0.5) - Math.abs(b.l - 0.5))[0]
    if (pick) {
      used.add(pick.value)
      proposals.neutral = {
        slot: 'neutral', confidence: 'inferred', value: pick.value,
        source: `${pick.value} · ${pick.count}×`,
        why: 'The grey closest to mid-lightness. A ramp generated from a mid grey reaches both ends; one generated from near-black does not.',
      }
    }
  }

  /* Families and measurements the old reader already worked out, for slots
     still empty. These were always inference; they are just labelled now. */
  if (!proposals.fontBody && found.families?.length) {
    const f = found.families.find(x => !/mono|code|courier|consolas|menlo/i.test(x.value)) ?? found.families[0]
    proposals.fontBody = {
      slot: 'fontBody', confidence: 'inferred', value: f.value,
      source: `${f.value} · ${f.count}×`, why: 'The most-used family in the file.',
    }
  }
  if (!proposals.fontMono) {
    const f = found.families?.find(x => /mono|code|courier|consolas|menlo/i.test(x.value))
    if (f) {
      proposals.fontMono = {
        slot: 'fontMono', confidence: 'inferred', value: f.value,
        source: `${f.value} · ${f.count}×`, why: 'Named like a monospace face.',
      }
    }
  }
  for (const [id, value, why] of [
    ['spacingBase', found.spacingBase, 'The small number that divides most of the spacing values found.'],
    ['radiusBase', found.radiusBase, 'The most-used border radius.'],
    ['fontBase', found.fontBase, 'The most-used size in the range body text occupies.'],
  ]) {
    if (proposals[id] || value == null) continue
    proposals[id] = {
      slot: id, confidence: 'inferred', value, source: `${value}px`, why,
    }
  }

  /* Colour custom properties nobody claimed. Shown as a tail so a name the
     matcher didn't know — `--seafoam`, `--client-blue` — can still be dragged
     into a slot by hand rather than silently dropped. */
  const unmatched = vars
    .filter(v => v.kind === 'color' && !claimed.has(v.name) && !MODIFIER.test(v.name))
    .slice(0, 40)

  return { proposals, unmatched }
}

/* Slot-specific coercion. A dimension slot wants a number, not "16px". */
function normaliseValue(slot, v) {
  if (slot.kind === 'color') return { value: v.hex }
  if (slot.kind === 'dimension') return { value: Math.round(v.px * 100) / 100 }
  return { value: v.value.split(',')[0].trim().replace(/^["']|["']$/g, '') }
}

/** Turn confirmed proposals into the shape `applyCssImport` already takes. */
export function toImport(proposals, accepted) {
  const out = { seeds: {}, families: {} }
  for (const [id, p] of Object.entries(proposals)) {
    if (accepted && !accepted.has(id)) continue
    const slot = SLOT_BY_ID[id]
    if (!slot) continue
    if (slot.kind === 'color') out.seeds[id] = p.value
    else if (id === 'fontBody') out.families.body = p.value
    else if (id === 'fontDisplay') out.families.display = p.value
    else if (id === 'fontMono') out.families.mono = p.value
    else out[id] = p.value
  }
  return out
}
