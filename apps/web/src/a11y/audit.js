/* Accessibility, past the contrast checker.
 *
 * Text contrast is the only accessibility rule most design systems check,
 * because it's the only one with an obvious number attached. The rules that
 * actually break interfaces are elsewhere: a 1px border nobody can see, a
 * focus ring the same colour as the button it surrounds, a 16px checkbox, a
 * red/green pair that reads as one colour to eight percent of men.
 *
 * Every check here runs against the derived tokens — the same values the
 * preview renders and the file exports — so a pass is a statement about what
 * ships, not about intent. And every one of them is computable from the
 * system alone. Things that depend on markup (alt text, heading order, label
 * association) are out of scope by definition: they belong to the code an
 * agent writes, not to the tokens it writes from. Those get emitted as
 * requirements into DESIGN.md instead, which is the only leverage a token
 * file has over them.
 *
 * Findings are advice, not gates. A design system that fails 2.5.5 on purpose
 * — a dense data tool for mouse users — is a legitimate design system. What
 * isn't legitimate is failing it without knowing.
 */
import { parseColor, toOklchObj, toHex } from '../color/convert.js'
import { wcag, apca } from '../color/contrast.js'
import { converter, filterDeficiencyDeuter, filterDeficiencyProt, differenceEuclidean } from 'culori'

const rgb = converter('rgb')

/* ── Severity ──
   `fail` is a documented WCAG violation at the level named. `warn` is either
   a AAA criterion or a well-established practice with no criterion behind it.
   `note` is a judgement call worth seeing once. Nothing here is fatal. */
const FAIL = 'fail', WARN = 'warn', NOTE = 'note'

const px = v => {
  const n = parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : null
}
const ratio = (a, b) => wcag(a, b)?.ratio ?? null
const r1 = n => Math.round(n * 10) / 10

/* ── Non-text contrast · WCAG 1.4.11 (AA) ──
 *
 * The most-missed criterion in the standard. Text gets checked; the 1px line
 * that is the only thing telling you where an input begins does not. 3:1
 * against every adjacent colour, and "adjacent" is the part people skip —
 * a border has a colour on each side and has to clear both.
 */
function nonTextContrast(state, derived, mode) {
  const c = derived.roles[mode]
  const out = []
  const pair = (fg, bg, label, opts = {}) => {
    if (!c[fg] || !c[bg]) return
    const v = ratio(c[fg], c[bg])
    if (v == null || v >= 3) return
    out.push({
      id: `nontext:${fg}:${bg}:${mode}`,
      level: opts.level ?? FAIL, criterion: '1.4.11 Non-text contrast (AA)',
      mode, tab: 'roles', entry: fg,
      title: label,
      detail: `${fg} on ${bg} is ${v}:1. Anything that carries meaning without being text — a border, a control boundary, an icon, a focus ring — needs 3:1.`,
      fix: opts.fix ?? `Darken ${fg} in light mode, or lighten it in dark, until it clears 3:1.`,
      measured: `${v}:1`,
    })
  }

  /* The boundary of a control is what tells you a control is there. */
  pair('border', 'surface', 'Control borders are too faint on cards')
  pair('border', 'bg', 'Control borders are too faint on the page')
  pair('border-strong', 'surface', 'Emphasised borders are too faint')

  /* A focus ring has to clear both what it sits on and what it rings —
     2.4.11 is explicit that the indicator must contrast with adjacent
     colours, plural. A ring that matches the button it surrounds is
     invisible exactly when it matters. */
  const ringRole = state.focus?.role ?? 'ring'
  pair(ringRole, 'bg', 'The focus ring is too faint against the page')
  pair(ringRole, 'surface', 'The focus ring is too faint against cards')
  /* Only when the ring is flush. With an offset, the page sits between the
     ring and the control, so the control's fill is no longer adjacent and
     this pair says nothing. */
  if ((state.focus?.offset ?? 0) === 0) {
    pair(ringRole, 'accent', 'The focus ring disappears against filled buttons', {
      fix: 'Either pick a ring colour that separates from accent, or raise the focus offset above 0 so the page shows between the button and the ring.',
    })
  }

  /* Filled controls draw their own boundary with their fill. */
  pair('accent', 'bg', 'Filled buttons have no visible edge on the page', {
    level: WARN,
    fix: 'Give accent more separation from bg, or give buttons a border of their own.',
  })

  /* Hairlines are decorative by the letter of the standard, so this is a
     note — but a divider you cannot see is not doing its job either. */
  if (c['border-subtle'] && c.surface) {
    const v = ratio(c['border-subtle'], c.surface)
    if (v != null && v < 1.2) {
      out.push({
        id: `nontext:hairline:${mode}`, level: NOTE, criterion: 'Practice',
        mode, tab: 'roles', entry: 'border-subtle',
        title: 'Hairlines are effectively invisible',
        detail: `border-subtle on surface is ${v}:1. Decorative rules are exempt from 1.4.11, but at this separation the line isn't dividing anything.`,
        fix: 'Either push it to a visible weight or drop it and separate with space instead.',
        measured: `${v}:1`,
      })
    }
  }

  return out
}

/* ── Focus visibility · WCAG 2.4.7 (AA), 2.4.11/2.4.13 (AA/AAA) ── */
function focusChecks(state) {
  const f = state.focus ?? {}
  const out = []

  if (f.style === 'none') {
    out.push({
      id: 'focus:none', level: FAIL, criterion: '2.4.7 Focus visible (AA)',
      tab: 'directives',
      title: 'There is no focus indicator',
      detail: 'Keyboard users have no way to tell where they are. This is the single most common way a design system locks people out.',
      fix: 'Set a focus style. Two pixels of solid ring is the floor.',
    })
  }

  if (f.style !== 'none' && (f.width ?? 0) < 2) {
    out.push({
      id: 'focus:width', level: WARN, criterion: '2.4.13 Focus appearance (AAA)',
      tab: 'directives',
      title: `A ${f.width}px focus ring is thinner than the guidance`,
      detail: '2.4.13 asks for a perimeter at least 2px thick. A hairline ring is easy to lose on a busy screen and disappears entirely at low zoom.',
      fix: 'Raise the focus width to 2px.',
      measured: `${f.width}px`,
    })
  }

  /* Offset zero means the ring sits flush on the control, so it only has one
     adjacent colour to contrast against instead of two. That's legal, but it
     removes the margin for error that offset buys you. */
  if (f.style !== 'none' && (f.offset ?? 0) === 0) {
    out.push({
      id: 'focus:offset', level: NOTE, criterion: 'Practice',
      tab: 'directives',
      title: 'The focus ring sits flush against controls',
      detail: 'With no offset the ring has to contrast against the control it surrounds, rather than against the page behind it. It works, but it fails on any control whose fill happens to be near the ring colour.',
      fix: 'Two pixels of offset makes the ring legible against every control at once.',
    })
  }

  return out
}

/* ── Target size · WCAG 2.5.8 (AA, 24px) and 2.5.5 (AAA, 44px) ── */
function targetSize(state, derived) {
  const out = []
  const declared = state.states?.touchTarget ?? 0

  if (declared > 0 && declared < 24) {
    out.push({
      id: 'target:declared', level: FAIL, criterion: '2.5.8 Target size minimum (AA)',
      tab: 'directives',
      title: `The declared minimum target is ${declared}px`,
      detail: '2.5.8 sets the floor at 24×24 CSS pixels. Below that, pointer accuracy — not just touch — starts costing people clicks.',
      fix: 'Raise the minimum target to at least 24px; 44px if you want AAA.',
      measured: `${declared}px`,
    })
  }

  /* The declared minimum is a promise. These are the components that break
     it — which is the useful half, since the promise is easy to write down
     and easy to contradict two panels later. */
  const vars = derived.cssVars ?? {}
  const seen = new Set()
  for (const [key, value] of Object.entries(vars)) {
    const m = /^--cmp-([a-z0-9-]+)-(height|size)$/.exec(key)
    if (!m) continue
    const [, name] = m
    /* `typography` expands to `--cmp-x-font-size` and `iconSize` to
       `--cmp-x-icon-size`, both of which end in `-size` and neither of which
       is a target. A glyph is not a hit area. */
    if (/-(font|icon)$/.test(name)) continue
    const v = px(value)
    if (v == null || v <= 0 || seen.has(name)) continue
    /* Only interactive things have targets. A 16px badge is fine. */
    if (!/button|input|select|switch|checkbox|radio|chip|tab|link|toggle|slider/.test(name)) continue
    if (v >= 24) continue
    seen.add(name)
    out.push({
      id: `target:${name}`, level: v < 24 ? FAIL : WARN,
      criterion: '2.5.8 Target size minimum (AA)',
      tab: 'components', entry: name,
      title: `${name} is ${v}px`,
      detail: `Interactive targets need 24×24. A ${v}px control can still pass if it has 24px of clear space around it, but that has to be deliberate and written down — otherwise an agent will place them in a tight row.`,
      fix: `Either raise ${name} to 24px, or record the spacing exemption in the Directives panel.`,
      measured: `${v}px`,
    })
  }

  /* Small controls that pass 2.5.8 but miss the 44px comfortable target get
     one collective note rather than a row each. */
  if (declared >= 24 && declared < 44) {
    out.push({
      id: 'target:aaa', level: NOTE, criterion: '2.5.5 Target size enhanced (AAA)',
      tab: 'directives',
      title: `Targets are ${declared}px, below the 44px comfortable size`,
      detail: 'Fine for a dense desktop tool, costly on touch. Worth being a decision rather than a default.',
      measured: `${declared}px`,
    })
  }

  return out
}

/* ── Text sizing and spacing · WCAG 1.4.12 (AA), 1.4.8 (AAA) ── */
function textChecks(state, derived) {
  const out = []
  const by = Object.fromEntries(derived.typography.map(t => [t.name, t]))
  const body = by['body-md']

  if (body) {
    /* Fluid sizes are a clamp() string, so read the middle term when there
       is one — that's the size at a normal viewport. */
    const size = px(String(body.fontSize).match(/,\s*([^,)]+),/)?.[1] ?? body.fontSize)
    if (size != null && size < 14) {
      out.push({
        id: 'text:body-size', level: size < 12 ? FAIL : WARN, criterion: 'Practice',
        tab: 'type', entry: 'body-md',
        title: `Body text is ${size}px`,
        detail: 'There is no WCAG minimum for font size, which is exactly why systems drift down. Below 14px, reading speed drops measurably for anyone over forty; below 12px it fails for most people at arm\'s length.',
        fix: 'Raise the base size, or the scale, in the Type panel.',
        measured: `${size}px`,
      })
    }

    const lh = parseFloat(body.lineHeight)
    if (Number.isFinite(lh) && lh < 1.5) {
      out.push({
        id: 'text:leading', level: WARN, criterion: '1.4.12 Text spacing (AA)',
        tab: 'type', entry: 'body-md',
        title: `Body line-height is ${r1(lh)}`,
        detail: '1.4.12 requires that a user can force 1.5 line-height without breaking the layout. Shipping below it is allowed — but a layout built around tight leading is usually the layout that breaks when someone turns it up.',
        fix: 'Raise the leading multiplier in the Type panel, or check that every component survives 1.5.',
        measured: String(r1(lh)),
      })
    }

    const ls = parseFloat(body.letterSpacing)
    if (Number.isFinite(ls) && ls < -0.02) {
      out.push({
        id: 'text:tracking', level: NOTE, criterion: 'Practice',
        tab: 'type', entry: 'body-md',
        title: `Body tracking is ${body.letterSpacing}`,
        detail: 'Negative tracking on body copy closes the gaps that dyslexic readers use to separate words. It belongs on display sizes, not paragraphs.',
        fix: 'Bring body tracking to zero and leave the tightening to the headings.',
        measured: body.letterSpacing,
      })
    }
  }

  /* Small text in a light weight is thin twice over. */
  for (const t of derived.typography) {
    const size = px(t.fontSize)
    const weight = parseInt(t.fontWeight, 10)
    if (size != null && size <= 14 && Number.isFinite(weight) && weight < 400) {
      out.push({
        id: `text:thin:${t.name}`, level: WARN, criterion: 'Practice',
        tab: 'type', entry: t.name,
        title: `${t.name} is ${size}px at weight ${weight}`,
        detail: 'Light weights below 15px lose stroke contrast on standard-density displays, which hits low-vision readers first and everyone else on a bad monitor.',
        fix: `Take ${t.name} to 400 or raise its size.`,
        measured: `${size}px / ${weight}`,
      })
    }
  }

  const measure = state.type?.measure ?? state.layout?.maxMeasure
  if (measure && measure > 80) {
    out.push({
      id: 'text:measure', level: WARN, criterion: '1.4.8 Visual presentation (AAA)',
      tab: 'type',
      title: `Measure is ${measure} characters`,
      detail: '1.4.8 caps a line at 80 characters. Past that the eye loses the return sweep and re-reads lines — the effect is strongest for readers with attention or tracking difficulties.',
      fix: 'Bring the measure down to 80ch or below.',
      measured: `${measure}ch`,
    })
  }

  return out
}

/* ── Motion · WCAG 2.2.2 (A), 2.3.3 (AAA) ── */
function motionChecks(state, derived) {
  const out = []
  const durations = derived.motion?.durations ?? {}

  if (!state.motion?.reducedMotion) {
    out.push({
      id: 'motion:policy', level: FAIL, criterion: '2.3.3 Animation from interactions (AAA)',
      tab: 'motion',
      title: 'No reduced-motion policy',
      detail: 'Without a stated policy an agent will emit transitions with no `prefers-reduced-motion` block, and vestibular users get the full set. This is one line of CSS that nobody writes unless told to.',
      fix: 'Pick a reduced-motion behaviour in the Motion panel.',
    })
  }

  for (const [name, value] of Object.entries(durations)) {
    const ms = px(value)
    if (ms == null) continue
    if (ms > 5000) {
      out.push({
        id: `motion:long:${name}`, level: FAIL, criterion: '2.2.2 Pause, stop, hide (A)',
        tab: 'motion', entry: name,
        title: `The ${name} duration is ${ms}ms`,
        detail: 'Anything moving for more than five seconds needs a control to pause it.',
        measured: `${ms}ms`,
      })
    } else if (ms > 700) {
      out.push({
        id: `motion:slow:${name}`, level: NOTE, criterion: 'Practice',
        tab: 'motion', entry: name,
        title: `The ${name} duration is ${ms}ms`,
        detail: 'Past roughly 400ms a transition stops reading as responsive and starts reading as lag. Fine for a page transition, wrong for a hover.',
        measured: `${ms}ms`,
      })
    }
  }

  /* Overshoot is the thing that actually triggers vestibular symptoms — it's
     the reversal, not the speed. Detect it in the curve rather than trusting
     the personality label. */
  const overshoot = Object.entries(state.motion?.easings ?? {}).filter(([, curve]) => {
    const n = String(curve).match(/-?\d*\.?\d+/g)?.map(Number)
    return n?.length === 4 && (n[1] > 1 || n[3] > 1 || n[1] < 0 || n[3] < 0)
  })
  if (overshoot.length > 0 && state.motion?.reducedMotion !== 'none') {
    out.push({
      id: 'motion:overshoot', level: WARN, criterion: '2.3.3 Animation from interactions (AAA)',
      tab: 'motion', entry: overshoot[0][0],
      title: `${overshoot.map(([k]) => k).join(', ')} overshoot${overshoot.length === 1 ? 's' : ''} the target`,
      detail: 'Bounce and elastic curves reverse direction, and it is the reversal — not the speed — that provokes vestibular symptoms. Your reduced-motion setting keeps animating, so the overshoot survives it.',
      fix: 'Either set reduced motion to remove animation entirely, or state that overshoot curves fall back to a standard ease under the media query.',
    })
  }

  return out
}

/* ── Not by colour alone · WCAG 1.4.1 (A) ──
 *
 * The only genuinely hard check here, because "conveyed by colour alone" is a
 * property of a screen, not of a palette. What a palette *can* tell you is
 * whether two colours that mean opposite things are separable without hue —
 * in greyscale, and under the two common forms of red-green blindness. If
 * they aren't, then every place the system uses them as a signal is relying
 * on colour alone whether the designer meant to or not.
 */
const deuter = filterDeficiencyDeuter(1)
const prot = filterDeficiencyProt(1)
const dist = differenceEuclidean('oklab')

function colourAlone(derived, mode) {
  const c = derived.roles[mode]
  const out = []
  const pairs = [
    ['success', 'danger', 'Success and danger'],
    ['success', 'warning', 'Success and warning'],
    ['accent', 'danger', 'Accent and danger'],
  ]

  for (const [a, b, label] of pairs) {
    const ca = parseColor(c[a]), cb = parseColor(c[b])
    if (!ca || !cb) continue

    /* Lightness first: if two colours are the same lightness they are the
       same colour to a greyscale display, a monochrome print, and anyone
       with achromatopsia. */
    const la = toOklchObj(ca).l, lb = toOklchObj(cb).l
    const dl = Math.abs(la - lb)

    /* Then the two red-green deficiencies, which together cover most of the
       affected population. Distance in Oklab because it is perceptually
       uniform — the whole point of using it is that one threshold means the
       same thing across the space. */
    const dd = dist(deuter(ca), deuter(cb))
    const dp = dist(prot(ca), prot(cb))
    const worst = Math.min(dd, dp)

    if (worst < 0.09 && dl < 0.12) {
      out.push({
        id: `colour-alone:${a}:${b}:${mode}`, level: FAIL, criterion: '1.4.1 Use of colour (A)',
        mode, tab: 'roles', entry: a,
        title: `${label} are the same colour to red-green vision`,
        detail: `Simulated for deuteranopia and protanopia they sit ${r1(worst * 100)} apart on a perceptual scale where about 2 is the threshold of a visible difference, and their lightness differs by only ${r1(dl * 100)}% — so neither hue nor brightness separates them. Around one man in twelve cannot tell these apart.`,
        fix: `Move ${b} to a different lightness, not just a different hue — and pair every use of these with an icon or a word.`,
        measured: `Δ${r1(worst * 100)}`,
        pairHex: [c[a], c[b]],
        simulated: [hexOf(deuter(ca)), hexOf(deuter(cb))],
      })
    } else if (worst < 0.09) {
      out.push({
        id: `colour-alone:${a}:${b}:${mode}`, level: WARN, criterion: '1.4.1 Use of colour (A)',
        mode, tab: 'roles', entry: a,
        title: `${label} share a hue under red-green vision`,
        detail: `Simulated they sit only ${r1(worst * 100)} apart in hue, so lightness is doing all the work — ${r1(dl * 100)}% of it. That survives, but barely, and not at small sizes or low brightness.`,
        fix: 'Widen the lightness gap, and never rely on the hue alone to carry the meaning.',
        measured: `Δ${r1(worst * 100)}`,
        pairHex: [c[a], c[b]],
        simulated: [hexOf(deuter(ca)), hexOf(deuter(cb))],
      })
    }
  }
  return out
}

const hexOf = c => toHex({ ...rgb(c), alpha: 1 })

/* ── Disabled state ──
 *
 * Disabled controls are explicitly exempt from contrast requirements, which
 * is why every system dims them to the point of illegibility and stops
 * thinking about it. The exemption covers the legal question, not the one
 * that matters: can the user read what the button they can't press says.
 */
function disabledCheck(state, derived, mode) {
  const o = state.states?.disabledOpacity
  if (o == null) return []
  const c = derived.roles[mode]
  if (!c.text || !c.surface) return []

  /* Composite the dimmed text over the surface it sits on. Opacity is not a
     colour, so the only way to know what the user sees is to blend it. */
  const t = rgb(parseColor(c.text)), s = rgb(parseColor(c.surface))
  if (!t || !s) return []
  const mix = hexOf({
    mode: 'rgb',
    r: t.r * o + s.r * (1 - o),
    g: t.g * o + s.g * (1 - o),
    b: t.b * o + s.b * (1 - o),
  })
  const lc = Math.abs(apca(mix, c.surface) ?? 0)
  if (lc >= 30) return []

  return [{
    id: `disabled:${mode}`, level: WARN, criterion: '1.4.3 exempt — practice',
    mode, tab: 'directives',
    title: `Disabled text lands at Lc ${r1(lc)}`,
    detail: `At ${Math.round(o * 100)}% opacity, disabled labels effectively vanish. WCAG exempts disabled controls, so nothing will flag this downstream — but a user who can't read the disabled button can't work out why it's disabled either.`,
    fix: 'Raise the disabled opacity to around 0.6, or signal disabled with a muted colour role instead of transparency.',
    measured: `Lc ${r1(lc)}`,
  }]
}

/* ── Things tokens can't check ──
 *
 * Emitted into the file rather than reported here, because they are true of
 * every system and an agent needs them stated. This is the list that turns
 * DESIGN.md from a palette into something that constrains behaviour. */
export const REQUIREMENTS = [
  { id: 'semantics',  text: 'Use the semantic element. A control that acts like a button is a `<button>`, not a styled `<div>` with a click handler.' },
  { id: 'labels',     text: 'Every input has a programmatic label. A placeholder is not a label — it disappears the moment someone types.' },
  { id: 'headings',   text: 'Heading levels describe the document outline, never the type size. Style an h2 to look small rather than reaching for h4.' },
  { id: 'order',      text: 'Keep the DOM order and the visual order the same. Reordering with CSS breaks keyboard and screen-reader navigation silently.' },
  { id: 'keyboard',   text: 'Everything reachable by mouse is reachable by keyboard, in a sensible order, with visible focus at each stop.' },
  { id: 'escape',     text: 'Modals and popovers trap focus while open, restore it on close, and close on Escape.' },
  { id: 'live',       text: 'Anything that changes without a page load — toasts, validation, async results — is announced through a live region.' },
  { id: 'alt',        text: 'Images that carry meaning have alt text; decorative ones carry an empty alt so they are skipped.' },
  { id: 'zoom',       text: 'The layout survives 200% zoom and a 320px viewport without horizontal scrolling.' },
  { id: 'colour',     text: 'Never signal state with colour alone. Pair every colour cue with an icon, a shape, or a word.' },
  { id: 'motion',     text: 'Respect `prefers-reduced-motion`. Transitions that move or scale must have a non-moving fallback.' },
  { id: 'contrast',   text: 'Do not lower any contrast in this file. The values here are the floor, not a starting point.' },
]

/** Every finding, worst first, both modes. */
export function audit(state, derived) {
  const all = [
    ...focusChecks(state),
    ...targetSize(state, derived),
    ...textChecks(state, derived),
    ...motionChecks(state, derived),
    ...['light', 'dark'].flatMap(mode => [
      ...nonTextContrast(state, derived, mode),
      ...colourAlone(derived, mode),
      ...disabledCheck(state, derived, mode),
    ]),
  ]
  const rank = { fail: 0, warn: 1, note: 2 }
  return all.sort((a, b) => rank[a.level] - rank[b.level])
}

/** Counts for a badge, without re-reading the list. */
export function summarise(findings) {
  return {
    fail: findings.filter(f => f.level === FAIL).length,
    warn: findings.filter(f => f.level === WARN).length,
    note: findings.filter(f => f.level === NOTE).length,
    total: findings.length,
  }
}
