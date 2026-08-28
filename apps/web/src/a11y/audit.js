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
 * system alone. Things that depend on markup (alt text, label association,
 * focus restoration) are out of scope by definition: they belong to the code
 * an agent writes, not to the tokens it writes from. Those get emitted as
 * requirements into DESIGN.md instead, which is the only leverage a token
 * file has over them.
 *
 * The line between the two moves, though, and it moves in one direction. A
 * rule about markup often has a token-level precondition — heading order is
 * markup, but a type scale where h3 outsizes h2 makes the correct markup look
 * wrong, and that is arithmetic. Every requirement worth re-examining for a
 * precondition like that has been; see REQUIREMENTS at the foot of the file
 * for which six survived the examination and which six did not.
 *
 * Findings are advice, not gates. A design system that fails 2.5.5 on purpose
 * — a dense data tool for mouse users — is a legitimate design system. What
 * isn't legitimate is failing it without knowing.
 */
import { parseColor, toOklchObj, toHex } from '../color/convert.js'
import { wcag, apca, check } from '../color/contrast.js'
import { TEXT_ROLES, SURFACE_ROLES } from '../state/schema.js'
import { converter, filterDeficiencyDeuter, filterDeficiencyProt, differenceEuclidean } from 'culori'

const rgb = converter('rgb')

/* ── Severity ──
   `fail` is a documented WCAG violation at the level named. `warn` is either
   a AAA criterion or a well-established practice with no criterion behind it.
   `note` is a judgement call worth seeing once. Nothing here is fatal. */
const FAIL = 'fail', WARN = 'warn', NOTE = 'note'

/* Two places, not one, and floored rather than rounded. A ratio of 4.4996
   rounds to "4.5:1", and a finding that reads "4.5:1, which needs 4.5:1" looks
   like the check is broken even when it is right. Contrast is the one number
   here that a reader compares against a threshold by eye.
   Module scope because three checks now need it. The second copy would have
   been the one that drifted. */
const r2 = n => (Math.floor(n * 100) / 100).toFixed(2)

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
      req: 'contrast', id: `nontext:${fg}:${bg}:${mode}`,
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
        req: 'contrast', id: `nontext:hairline:${mode}`, level: NOTE, criterion: 'Practice',
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
      req: 'keyboard', id: 'focus:none', level: FAIL, criterion: '2.4.7 Focus visible (AA)',
      tab: 'directives',
      title: 'There is no focus indicator',
      detail: 'Keyboard users have no way to tell where they are. This is the single most common way a design system locks people out.',
      fix: 'Set a focus style. Two pixels of solid ring is the floor.',
    })
  }

  if (f.style !== 'none' && (f.width ?? 0) < 2) {
    out.push({
      req: 'keyboard', id: 'focus:width', level: WARN, criterion: '2.4.13 Focus appearance (AAA)',
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
      req: 'keyboard', id: 'focus:offset', level: NOTE, criterion: 'Practice',
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
      req: 'keyboard', id: 'target:declared', level: FAIL, criterion: '2.5.8 Target size minimum (AA)',
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
    /* Drawn small and hit large, on purpose.
     *
     * A checkbox and a radio are 16px marks inside a label that carries the hit
     * area. That is not a compromise, it is how every serious design system
     * builds them, and inflating the mark to 24 to satisfy a size check makes
     * the control wrong to fix a number.
     *
     * So this stopped being worth reporting once two things were true: the
     * system declares a minimum target, and the exported document TELLS the
     * builder to put that size on the label. Both hold here — the payload
     * carries the rule in words. Warning anyway made this the only finding on
     * an untouched, correct document, which is the fastest way to teach someone
     * that the audit is noise and to stop reading it when it is right about a
     * contrast failure.
     *
     * Without a declared minimum there is no claim to rely on, so it still
     * reports below. That is the case where the spec really is missing
     * something. */
    if (/checkbox|radio/.test(name) && declared >= 24) continue
    seen.add(name)
    /* 2.5.8 has a spacing exception: an undersized target passes if a 24px
       circle centred on it doesn't touch its neighbours. A system that
       declares a minimum target is claiming that spacing, so this is a
       reminder to honour it rather than a violation. Without a declared
       minimum there is nothing making the claim, and it fails. */
    const covered = declared >= 24
    out.push({
      req: 'keyboard', id: `target:${name}`, level: covered ? WARN : FAIL,
      criterion: '2.5.8 Target size minimum (AA)',
      tab: 'components', entry: name,
      title: `${name} draws at ${v}px`,
      detail: covered
        ? `The rule asks for 24px and this draws at ${v}. It still passes, because you have set a ${declared}px minimum target, and the rule lets a small control through when nothing sits close enough to mis-tap. That is the part to protect: crowd these into a tight row and the exemption is gone.`
        : `Anything people click needs 24×24 to hit reliably, and this draws at ${v}. There is no minimum target set on this system, so there is nothing claiming the spacing that would let a smaller control pass.`,
      fix: covered
        ? `Draw the box at ${v}px and make the thing people click ${declared}px. The extra size goes on the label wrapped around it, never on the box itself.`
        : `Either draw ${name} at 24px, or set a minimum target in the Directives panel and keep these ${declared || 24}px apart.`,
      measured: `${v}px`,
    })
  }

  /* Small controls that pass 2.5.8 but miss the 44px comfortable target get
     one collective note rather than a row each. */
  if (declared >= 24 && declared < 44) {
    out.push({
      req: 'keyboard', id: 'target:aaa', level: NOTE, criterion: '2.5.5 Target size enhanced (AAA)',
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
        req: 'contrast', id: 'text:body-size', level: size < 12 ? FAIL : WARN, criterion: 'Practice',
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
        req: 'contrast', id: 'text:leading', level: WARN, criterion: '1.4.12 Text spacing (AA)',
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
        req: 'contrast', id: 'text:tracking', level: NOTE, criterion: 'Practice',
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
        req: 'contrast', id: `text:thin:${t.name}`, level: WARN, criterion: 'Practice',
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
      req: 'contrast', id: 'text:measure', level: WARN, criterion: '1.4.8 Visual presentation (AAA)',
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

  /* Curves that pass the end value and come back. The reversal is what
     provokes vestibular symptoms, not the speed — but only while it is moving
     something, which is why this is evidence for the policy check below rather
     than a finding of its own. */
  const overshoot = Object.entries(state.motion?.easings ?? {}).filter(([, curve]) => {
    const n = String(curve).match(/-?\d*\.?\d+/g)?.map(Number)
    return n?.length === 4 && (n[1] > 1 || n[3] > 1 || n[1] < 0 || n[3] < 0)
  })

  if (!state.motion?.reducedMotion) {
    const names = overshoot.map(([k]) => k).join(', ')
    out.push({
      req: 'motion', id: 'motion:policy', level: FAIL, criterion: '2.3.3 Animation from interactions (AAA)',
      tab: 'motion',
      title: 'No reduced-motion policy',
      detail: 'Without a stated policy an agent will emit transitions with no `prefers-reduced-motion` block, and vestibular users get the full set. This is one line of CSS that nobody writes unless told to.'
        + (names ? ` It matters more here than usual: ${names} overshoot${overshoot.length === 1 ? 's' : ''} the target, and a curve that reverses direction is the kind that provokes symptoms.` : ''),
      fix: 'Pick a reduced-motion behaviour in the Motion panel.',
    })
  }

  for (const [name, value] of Object.entries(durations)) {
    const ms = px(value)
    if (ms == null) continue
    if (ms > 5000) {
      out.push({
        req: 'motion', id: `motion:long:${name}`, level: FAIL, criterion: '2.2.2 Pause, stop, hide (A)',
        tab: 'motion', entry: name,
        title: `The ${name} duration is ${ms}ms`,
        detail: 'Anything moving for more than five seconds needs a control to pause it.',
        measured: `${ms}ms`,
      })
    } else if (ms > 700) {
      out.push({
        req: 'motion', id: `motion:slow:${name}`, level: NOTE, criterion: 'Practice',
        tab: 'motion', entry: name,
        title: `The ${name} duration is ${ms}ms`,
        detail: 'Past roughly 400ms a transition stops reading as responsive and starts reading as lag. Fine for a page transition, wrong for a hover.',
        measured: `${ms}ms`,
      })
    }
  }

  /* There was a finding here for overshoot surviving a "crossfade" policy. It
     was wrong, and wrong in a way worth recording so it does not come back.
     *
     * Its premise was that crossfade "keeps animating rather than stopping",
     * so the bounce reaches people who asked for less motion. But 2.3.3 is
     * about *motion* animation, and a cross-fade is not motion — it is the
     * standard substitute for it. The file says so in as many words: "Under
     * `prefers-reduced-motion`, drop to a cross-fade at `fast`." Nothing
     * translates or scales, so there is no reversal left to feel. Overshoot on
     * an opacity curve pushes the value past 1 and clamps.
     *
     * So a system with any reduced-motion policy satisfies 2.3.3, and one with
     * no policy already gets the FAIL above — which now names the overshooting
     * curves, because that is the case where the reversal genuinely survives.
     * Two findings for one cause, one of them false, is worse than one. */

  return out
}

/* ── Reflow · WCAG 1.4.10 (AA) ──
 *
 * The requirement is that the layout survives 200% zoom and a 320px viewport.
 * Whether it *does* is a property of markup, and no token file can promise it.
 * What a token file can be is the reason it doesn't: 1.4.10's 320px figure is
 * a 1280px viewport at 400% zoom, and if the smallest breakpoint in the system
 * sits above 320 then the system has simply never described that width. An
 * agent reading it has no rule to follow and will pick one, which is the whole
 * failure mode this app exists to prevent.
 *
 * A fixed container wider than the viewport it applies at is the same mistake
 * one level down, and that one is arithmetic.
 */
function reflowChecks(state) {
  const out = []
  const bps = state.layout?.breakpoints ?? []
  const containers = state.layout?.containers ?? {}
  if (bps.length === 0) return out

  const smallest = bps.reduce((a, b) => (b.px < a.px ? b : a))
  if (smallest.px > 320) {
    out.push({
      id: 'reflow:no-320', level: NOTE, criterion: '1.4.10 Reflow (AA)', req: 'zoom',
      tab: 'layout', entry: smallest.name,
      title: `Nothing is defined below ${smallest.px}px`,
      detail: `The narrowest breakpoint is ${smallest.name} at ${smallest.px}px, so the system says nothing about 320px — which is what a 1280px viewport becomes at 400% zoom. Whatever an agent builds there, it builds without you.`,
      fix: 'Either add a breakpoint at or below 320px, or state in Layout that the base (unqualified) styles are the 320px case.',
      measured: `${smallest.px}px`,
    })
  }

  for (const [name, width] of Object.entries(containers)) {
    const bp = bps.find(b => b.name === name)
    const w = px(width)
    if (w == null || w <= 320) continue
    /* A container only has to fit inside the viewport that activates it. The
       one at the smallest tier is the one that can reach a 320px screen. */
    if (bp && bp.px <= 320 || (!bp && w > 320 && name === smallest.name)) {
      out.push({
        id: `reflow:container:${name}`, level: FAIL, criterion: '1.4.10 Reflow (AA)', req: 'zoom',
        tab: 'layout', entry: name,
        title: `The ${name} container is ${w}px wide`,
        detail: `It applies from ${bp?.px ?? smallest.px}px up, so on a 320px viewport it overflows by ${w - 320}px and the page scrolls sideways.`,
        measured: `${w}px`,
      })
    }
  }
  return out
}

/* ── Heading order · WCAG 1.3.1 (A) ──
 *
 * "Heading levels describe the outline, never the type size" is advice about
 * markup — but a type scale can make it impossible to follow. If h3 renders
 * larger than h2, then anyone choosing a level by how it looks picks the wrong
 * one, and choosing by how it looks is exactly what people do. Two levels at
 * the same size is the milder version: the outline is then invisible, so the
 * only thing keeping it correct is discipline.
 */
function headingOrder(derived) {
  const order = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  const sizes = new Map(
    (derived.typography ?? []).filter(t => order.includes(t.name)).map(t => [t.name, t.computedPx ?? px(t.fontSize)]),
  )
  const out = []
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i], b = order[i + 1]
    const sa = sizes.get(a), sb = sizes.get(b)
    if (sa == null || sb == null) continue
    if (sb > sa) {
      out.push({
        id: `heading:inverted:${a}`, level: FAIL, criterion: '1.3.1 Info and relationships (A)', req: 'headings',
        tab: 'type', entry: b,
        title: `${b} is larger than ${a}`,
        detail: `${b} renders at ${r1(sb)}px against ${a} at ${r1(sa)}px. The visual hierarchy now contradicts the document outline, so picking a heading by appearance produces the wrong level.`,
        measured: `${r1(sb)}px vs ${r1(sa)}px`,
      })
    } else if (Math.abs(sa - sb) < 0.5) {
      out.push({
        id: `heading:flat:${a}`, level: NOTE, criterion: '1.3.1 Info and relationships (A)', req: 'headings',
        tab: 'type', entry: b,
        title: `${a} and ${b} are the same size`,
        detail: `Both render at ${r1(sa)}px, so nothing on screen distinguishes one level from the next. That is legal, but the outline becomes invisible and stays correct only by discipline.`,
        measured: `${r1(sa)}px`,
      })
    }
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

/* ── A remedy the app can apply itself ──
 *
 * "Move danger to a different lightness" is correct and still leaves the work
 * to you: find which ramp the role sits on, walk its steps, and check each one
 * against the colour it collides with. The app already knows all three, so it
 * can do the walk and offer the answer.
 *
 * It searches outward from the role's current step and returns the first one
 * that clears both thresholds, so the suggestion is the smallest move that
 * works rather than a jump to the end of the ramp. Returns null when no step
 * on that ramp separates — which happens, and is worth not pretending about.
 */
function stepThatSeparates(derived, mode, role, roleHex, otherHex) {
  const other = parseColor(otherHex)
  if (!other) return null

  /* A candidate has to survive the check it is not being measured against.
     Moving a fill to a lighter step separates it from its neighbour and can
     drop its own label below AA on the way — trading one failure for another,
     which is worse than leaving it alone because the count still goes down. */
  const onIt = derived.roles[mode]?.[`${role}-fg`]
  const keepsItsLabel = hex => !onIt || ratio(onIt, hex) >= 4.5

  /* Which ramp and step is this role sitting on? The resolved hex is enough
     to find it, so this needs no access to the document's refs. */
  let found = null
  for (const [name, ramp] of Object.entries(derived.ramps ?? {})) {
    for (const [step, hex] of Object.entries(ramp.steps ?? {})) {
      if (String(hex).toLowerCase() === String(roleHex).toLowerCase()) { found = { name, step: Number(step), ramp } }
    }
  }
  if (!found) return null

  const steps = Object.keys(found.ramp.steps ?? {}).map(Number).sort((x, y) => x - y)
  const from = steps.indexOf(found.step)
  if (from < 0) return null

  const clears = hex => {
    const cand = parseColor(hex)
    if (!cand) return false
    const dl = Math.abs(toOklchObj(cand).l - toOklchObj(other).l)
    const worst = Math.min(dist(deuter(cand), deuter(other)), dist(prot(cand), prot(other)))
    return (worst >= 0.09 || dl >= 0.12) && keepsItsLabel(hex)
  }

  /* Outward from where it is, nearest first, so the palette moves as little
     as it has to.
   *
   * EVERY candidate, not the first. They opened the remedy for one finding and
   * the preview said failures 3 -> 4. Their words: "it is not trading one
   * failure for another, it is creating additional ones!"
   *
   * The reason is the shape of `clears` above. It asks two local questions —
   * is this pair separated now, and does the role keep its own label — and a
   * role sits in many more pairs than the one being repaired. A step that
   * answers both can still trip three checks it was never shown.
   *
   * The whole audit is the only honest test, and it cannot run here: this
   * function runs INSIDE the audit, so calling it would recurse. So hand back
   * the ranked list and let the preview, which already builds the after-state,
   * choose the first candidate whose TOTAL falls. `ref` stays the nearest one
   * so an existing caller reading it still gets an answer. */
  const candidates = []
  for (let d = 1; d < steps.length; d++) {
    for (const i of [from - d, from + d]) {
      if (i < 0 || i >= steps.length) continue
      const step = steps[i]
      if (clears(found.ramp.steps[step])) {
        candidates.push({ ref: `${found.name}.${step}`, hex: found.ramp.steps[step], from: `${found.name}.${found.step}` })
      }
    }
  }
  if (!candidates.length) return null
  return { ...candidates[0], candidates }
}

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
        req: 'colour', id: `colour-alone:${a}:${b}:${mode}`, level: FAIL, criterion: '1.4.1 Use of colour (A)',
        mode, tab: 'roles', entry: a,
        title: `${label} are the same colour to red-green vision`,
        detail: `Simulated for deuteranopia and protanopia they sit ${r1(worst * 100)} apart on a perceptual scale where about 2 is the threshold of a visible difference, and their lightness differs by only ${r1(dl * 100)}% — so neither hue nor brightness separates them. Around one man in twelve cannot tell these apart.`,
        fix: `Move ${b} to a different lightness, not just a different hue — and pair every use of these with an icon or a word.`,
        /* Present only when a step on the same ramp actually separates the two.
           Absent means the palette cannot resolve it by itself and the choice
           is yours, which is a different button. */
        apply: (() => {
          const s = stepThatSeparates(derived, mode, b, c[b], c[a])
          return s && { kind: 'role-step', role: b, mode, ref: s.ref, from: s.from,
            candidates: s.candidates, label: `Move ${b} to ${s.ref}` }
        })(),
        measured: `Δ${r1(worst * 100)}`,
        pairHex: [c[a], c[b]],
        simulated: [hexOf(deuter(ca)), hexOf(deuter(cb))],
      })
    } else if (worst < 0.09) {
      out.push({
        req: 'colour', id: `colour-alone:${a}:${b}:${mode}`, level: WARN, criterion: '1.4.1 Use of colour (A)',
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

/* The same simulation the rule above is written against, exported so a preview
   can show what the reader with deuteranopia receives. A second implementation
   of this would let the picture disagree with the finding beside it. */
export const simulateDeuter = hex => {
  const c = parseColor(hex)
  return c ? hexOf(deuter(c)) : hex
}

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
    req: 'contrast', id: `disabled:${mode}`, level: WARN, criterion: '1.4.3 exempt — practice',
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
/* The twelve requirements, and — honestly — which of them this app can hold
 * you to.
 *
 * `checked: true` means some check above can catch a violation from the tokens
 * alone, and a violation will surface as an alert in the panel that caused it.
 * `checked: false` means the requirement is about markup or behaviour: whether
 * a control is a real `<button>`, whether focus returns after a modal closes,
 * whether an image's alt text says anything. Nothing in a token file predicts
 * those, and pretending otherwise would be worse than admitting it — a green
 * badge that means "unmeasured" is how systems ship inaccessible.
 *
 * Six and six. The unchecked half is the half that most needs saying, which is
 * why all twelve go into DESIGN.md regardless: the agent writing the markup is
 * the only party that can satisfy them.
 */
/* ── ONE WRITER FOR A REMEDY ──
 *
 * The preview has to show what the button will do. Two implementations of "what
 * the button does" drift, and a preview that drifts from its own action is worse
 * than no preview: it is a promise the app then breaks.
 *
 * So the change is a pure function of the state and the fix. The preview derives
 * a candidate from it and re-audits; the button hands the same result to `set`.
 * Neither can describe a change the other does not make. */
/* ── PICK THE STEP WHOSE TOTAL FALLS, OR PICK NOTHING ──
 *
 * They opened a remedy and the preview read failures 3 -> 4. Their words:
 * "it is not trading one failure for another, it is creating additional ones!"
 *
 * `stepThatSeparates` runs INSIDE the audit, so it cannot run the audit. It
 * asks two local questions — is this pair separated, does the role keep its own
 * label — and a role sits in many more pairs than the one being repaired.
 *
 * This runs OUTSIDE, so it can ask the only question that matters: does the
 * whole count go down. Nearest first, so the first improvement is also the
 * smallest move. Warnings count, because clearing one failure by raising two
 * warnings has moved the problem rather than solved it.
 *
 * Returns `noImprovement` rather than null, so the caller can still SHOW the
 * nearest candidate and say why it is not offered. A silent absence reads as a
 * missing feature.
 *
 * `derive` is passed in rather than imported, because audit.js is imported by
 * the deriver in some paths and a cycle here takes the app down with an
 * undefined name — which renders as a blank screen, not an error. */
export function chooseFix(state, derived, fix, derive) {
  if (!fix) return null
  const count = list => ({
    fail: list.filter(f => f.level === 'fail').length,
    warn: list.filter(f => f.level === 'warn').length,
  })
  const before = count(audit(state, derived))
  const total0 = before.fail + before.warn

  const score = f => {
    const st = withFinding(state, f)
    const d = derive(st)
    const findings = audit(st, d)
    const c = count(findings)
    return { state: st, derived: d, findings, ...c, total: c.fail + c.warn, fix: f }
  }

  const list = fix.candidates?.length ? fix.candidates : [fix]
  const scored = list.map(c => score({ ...fix, ref: c.ref, from: c.from }))
  const win = scored.find(x => x.total < total0)
  return { before, ...(win ?? { ...scored[0], noImprovement: true }) }
}
export function withFinding(state, fix) {
  if (!fix) return state
  if (fix.kind === 'role-step') {
    return {
      ...state,
      color: {
        ...state.color,
        roles: {
          ...state.color.roles,
          [fix.role]: { ...state.color.roles[fix.role], [fix.mode]: fix.ref },
        },
      },
    }
  }
  return state
}

export const REQUIREMENTS = [
  { id: 'semantics',  checked: false, text: 'Use the semantic element. A control that acts like a button is a `<button>`, not a styled `<div>` with a click handler.' },
  { id: 'labels',     checked: false, text: 'Every input has a programmatic label. A placeholder is not a label — it disappears the moment someone types.' },
  { id: 'headings',   checked: true, text: 'Heading levels describe the document outline, never the type size. Style an h2 to look small rather than reaching for h4.' },
  { id: 'order',      checked: false, text: 'Keep the DOM order and the visual order the same. Reordering with CSS breaks keyboard and screen-reader navigation silently.' },
  { id: 'keyboard',   checked: true, text: 'Everything reachable by mouse is reachable by keyboard, in a sensible order, with visible focus at each stop.' },
  /* These two named the behaviour and never the mechanism, so a build could
     agree with both and still ship an overlay that declares nothing. The
     surface demonstrating an overlay in this very system carried no `role` and
     no `aria-*` at all, and this line was in the file the whole time. Name the
     attributes, or the rule is a sentiment. */
  { id: 'escape',     checked: false, text: 'A modal declares itself: `role="dialog"` (or `alertdialog` where it is stopping you), `aria-modal="true"`, and a name from `aria-labelledby` pointing at its own heading. It traps focus while open, restores it to whatever opened it on close, and closes on Escape.' },
  { id: 'live',       checked: false, text: 'Anything that changes without a page load — a toast, a validation message, an async result, a pager\'s range — is announced through a live region. `role="status"` with `aria-live="polite"` for the ordinary case; reserve `assertive` for something that must interrupt.' },
  { id: 'alt',        checked: false, text: 'Images that carry meaning have alt text; decorative ones carry an empty alt so they are skipped.' },
  { id: 'zoom',       checked: true, text: 'The layout survives 200% zoom and a 320px viewport without horizontal scrolling.' },
  { id: 'colour',     checked: true, text: 'Never signal state with colour alone. Pair every colour cue with an icon, a shape, or a word.' },
  { id: 'motion',     checked: true, text: 'Respect `prefers-reduced-motion`. Transitions that move or scale must have a non-moving fallback.' },
  { id: 'contrast',   checked: true, text: 'Do not lower any contrast in this file. The values here are the floor, not a starting point.' },
]

/** Every finding, worst first, both modes. */
/* ── A component's own text against its own fill ──
 *
 * The gap this closes. Everything above checks ROLE pairs — text on bg,
 * accent-fg on accent — and non-text contrast. Nothing checked the pair a
 * component actually paints. A badge takes its text from `success` and its
 * fill from `success-subtle`, and that combination appears in no role pair,
 * so it was never measured anywhere.
 *
 * A generated dashboard shipped `badge-success` at 3.94:1 and `badge-warning`
 * at 4.25:1, both carrying 14.2px text that needs 4.5:1. The file reported
 * zero contrast findings, and the receiving agent found both by hand and had
 * to report them back. A check that cannot see the thing on the screen is not
 * a check.
 */
function componentContrast(state, derived, mode) {
  const roles = derived.roles?.[mode] ?? {}
  const vars = derived.cssVars ?? {}
  const out = []

  /* `{colors.accent}` and bare hexes both appear as values. Anything else —
     `transparent`, a gradient, a spacing ref — has no measurable colour and
     is skipped rather than guessed at. */
  const hexOf = value => {
    const s = String(value ?? '').trim()
    const m = /^\{colors\.([a-z0-9-]+)\}$/i.exec(s)
    if (m) return roles[m[1]] ?? null
    /* `transparent` is a colour to every parser and to no reader. Left to
       `parseColor` it came back as black at zero alpha, and the two ghost
       buttons were measured against a black nobody can see: 3.7:1 and 1.4:1,
       both invented. A control with no fill sits on the page, so the page is
       what its text has to beat. */
    if (!s || s === 'none' || s === 'transparent') return null
    const c = parseColor(s)
    if (!c) return null
    if ((c.alpha ?? 1) === 0) return null
    return s
  }
  /* Only a background may fall back to the page. A text colour that resolves
     to nothing is a component with no text, not a component whose text is the
     page colour. */
  const fillOf = value => hexOf(value) ?? roles.bg ?? null

  const byName = new Map(derived.components.map(c => [c.name, c]))
  const propsOf = name => Object.fromEntries((byName.get(name)?.properties ?? []).map(p => [p.key, p.value]))

  for (const comp of derived.components) {
    const own = propsOf(comp.name)
    /* A variant states its colours and inherits its type from the base entry,
       so `badge-success` alone never reveals what size its text is. */
    const base = comp.name.split('-')[0]
    const merged = { ...propsOf(base), ...own }

    const fg = hexOf(merged.textColor)
    if (!fg) continue
    const bg = fillOf(merged.backgroundColor)
    if (!bg) continue
    const onPage = hexOf(merged.backgroundColor) == null
    /* Disabled controls are exempt under 1.4.3, and `disabledCheck` already
       covers whether they read as disabled at all. */
    if (/-disabled$/.test(comp.name)) continue

    const r = ratio(fg, bg)
    if (r == null) continue
    /* Large text is 24px, or 18.66px at 700 and above. Below that the bar is
       4.5:1 and no rounding gets a component over it. */
    const size = px(vars[`--cmp-${comp.name}-font-size`])
      ?? px(vars[`--cmp-${base}-font-size`])
      ?? px(vars['--font-body-md-size']) ?? 16
    const weight = parseFloat(vars[`--cmp-${base}-font-weight`]) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    if (r >= need) continue

    out.push({
      req: 'contrast', id: `cmp-contrast:${comp.name}:${mode}`,
      level: FAIL, criterion: '1.4.3 Contrast (minimum) (AA)',
      mode, tab: 'components', entry: comp.name,
      title: onPage
        ? `${comp.name} text fails against the page behind it`
        : `${comp.name} text fails against its own background`,
      detail: `Its text colour measures ${r2(r)}:1 against ${onPage ? 'the page background it sits on, since it has no fill of its own' : 'the fill it sits on'}, at ${r1(size)}px, which needs ${need}:1. This pair is not in the contrast table — that table pairs each role against the page and against its own foreground, and a component that combines two roles of its own makes a third pair nobody was looking at.`,
      fix: `Move ${comp.name}'s text colour to a darker step of the same ramp, or lighten its fill. Changing the ramp step keeps the hue and fixes every component that shares it.`,
      measured: `${r2(r)}:1`,
      pairHex: [fg, bg],
    })
  }
  return out
}

/* ── Every text role against every surface role ──
 *
 * The curated pair list held twelve combinations somebody thought to list, and
 * a dark system shipped four failures that all sat outside it. A list measures
 * what you predicted. This asks the whole question instead: it needs no guess,
 * and it is silent when the system is sound.
 *
 * NOT WIRED INTO `audit()`, and that is the point of this note.
 *
 * It went in as a finding and I lowered its severity twice trying to make it
 * quiet enough. First every shortfall was a WARN: 14 on a healthy default
 * system. Splitting by remedy took it to 2 warnings and 12 notes. Fixing the
 * `text-subtle` role took it to 0 warnings and 10 notes.
 *
 * A fresh document still opened saying "10 warnings", because the chip counts
 * every finding and calls them warnings. Ten rows, all between 3.38:1 and
 * 4.48:1, every one legal at large-text size, most of them pairs nothing in
 * the system builds.
 *
 * Three attempts to tune a check that should not have been a check. A finding
 * is something to act on. This is a map of which combinations are safe, which
 * is reference material — and the exported document already carries it as a
 * table, under a heading that says what it is. There it informs. Here it
 * accused a clean system ten times on load.
 *
 * Kept and exported so the payload emitter and the suite can measure the same
 * thing. Do not add it back to `audit()` without a surface that reads as
 * reference rather than as fault. */
export function roleSweep(derived, mode) {
  const roles = derived.roles?.[mode] ?? {}
  const out = []
  for (const fg of TEXT_ROLES) {
    for (const bg of SURFACE_ROLES) {
      if (!roles[fg] || !roles[bg]) continue
      const r = check(roles[fg], roles[bg])
      if (r.ratio >= 4.5) continue
      out.push({
        req: 'contrast', id: `sweep:${mode}:${fg}:${bg}`, level: r.ratio < 3 ? WARN : NOTE,
        criterion: '1.4.3 Contrast minimum (AA)', tab: 'roles', entry: fg, mode,
        title: `${fg} on ${bg} is ${r2(r.ratio)}:1 in ${mode}`,
        detail: `Body text needs 4.5:1. This pair is in no row of the contrast table, because that table lists the combinations we predicted and a real build makes its own. It is a warning rather than a failure: if nothing puts ${fg} text on a ${bg} fill, nothing is wrong.`,
        fix: r.ratio >= 3
          ? `Use it only at large-text size (18.66px bold, or 24px), where 3:1 applies. Otherwise pick another role.`
          : `Below 3:1 there is no size that rescues it. Pick another role for this combination.`,
        measured: `${r2(r.ratio)}:1`,
      })
    }
  }
  return out
}

/* ── A line must never be the colour of what it divides ──
 *
 * Dark `border-subtle` and dark `surface-raised` both resolved to neutral.800:
 * the same hex, 1.00:1, a divider inside a popover that cannot be seen. No
 * contrast check looked, because a hairline is decorative and 1.4.11 sets no
 * bar for it — so nothing had an opinion until an agent building from the file
 * reported the line as unreadable and substituted a different token.
 *
 * There is no WCAG number to cite here. The bar is lower: a line that is
 * within a hair of its background is not subtle, it is absent. */
function hairlineChecks(derived, mode) {
  const roles = derived.roles?.[mode] ?? {}
  const out = []
  const LINES = ['border-subtle', 'border', 'border-strong']
  for (const line of LINES) {
    for (const bg of SURFACE_ROLES) {
      if (!roles[line] || !roles[bg]) continue
      const r = check(roles[line], roles[bg])
      /* 1.2:1 is where a hairline stops being visible on a normal display.
         Set below the decorative range on purpose — `border-subtle` is meant
         to sit around 1.6 to 2.1, and flagging that would be crying wolf. */
      if (r.ratio >= 1.2) continue
      const same = roles[line].toLowerCase() === roles[bg].toLowerCase()
      out.push({
        req: 'contrast', id: `hairline:${mode}:${line}:${bg}`, level: FAIL,
        criterion: 'Practice', tab: 'roles', entry: line, mode,
        title: same
          ? `${line} and ${bg} are the same colour in ${mode}`
          : `${line} is invisible on ${bg} in ${mode} (${r2(r.ratio)}:1)`,
        detail: same
          ? `Both resolve to ${roles[line]}. A rule drawn in the colour of the surface behind it paints nothing, and every layout built on it loses a boundary with no error anywhere.`
          : `At ${r2(r.ratio)}:1 the line does not read as a line. A divider that cannot be seen is not a subtle divider.`,
        fix: `Move ${line} one or two steps away from ${bg} in the Roles panel. A line token must differ from every surface it divides.`,
        measured: `${r2(r.ratio)}:1`,
      })
    }
  }
  return out
}

/* ── Two meanings must not be one colour ──
 *
 * `accent` and `success` shipped 11.4° of hue apart and at the same lightness
 * step: measured 1.01:1 in light, 1.00:1 in dark, both a teal. A reader cannot
 * tell "primary action" from "confirmation", and no existing check looked —
 * `colourAlone` compares success against danger for red-green vision, which is
 * a different question with a different answer.
 *
 * Contrast is the wrong instrument. Two roles at one lightness step always
 * measure about 1:1 whatever their hue, so the ratio says nothing. Hue does.
 *
 * The palette cannot fix this by moving `success`: every green collides with
 * `danger` under deuteranopia, which is why the teal was chosen. So the finding
 * names the conflict and points at the accent, which is the one free choice. */
const MEANING_PAIRS = [
  ['accent', 'success'], ['accent', 'warning'], ['accent', 'danger'],
  ['success', 'warning'],
]
const HUE_MIN = 25
/* Points of OKLCH lightness. See the note in meaningCollision. */
const LIGHTNESS_MIN = 10   // below this two hues read as one colour at a glance

function meaningCollision(derived, mode) {
  const roles = derived.roles?.[mode] ?? {}
  const out = []
  for (const [a, b] of MEANING_PAIRS) {
    if (!roles[a] || !roles[b]) continue
    const x = toOklchObj(roles[a]), y = toOklchObj(roles[b])
    if (!x || !y) continue
    /* A near-grey has no hue worth comparing. */
    if ((x.c ?? 0) < 0.03 || (y.c ?? 0) < 0.03) continue
    const raw = Math.abs((x.h ?? 0) - (y.h ?? 0))
    const gap = Math.min(raw, 360 - raw)
    if (gap >= HUE_MIN) continue
    /* Hue was the wrong question on its own.
     *
     * "Do these read as one colour" is answered by hue AND lightness. The pair
     * this check was built for measured 11° of hue and 0.2 of lightness — the
     * same colour twice. Two presets that deliberately put a rust or red brand
     * beside a red danger measure 1° to 9° of hue and 15.5 of lightness, and
     * their own comments say so: the danger ramp was moved to the ends for
     * exactly this reason. That is a mitigation at the point of use, and a
     * check that cannot see it reports a solved problem as an open one.
     *
     * Ten, between 0.2 and 15.3, and nowhere near either. */
    const dL = Math.abs((x.l ?? 0) - (y.l ?? 0)) * 100
    if (dL >= LIGHTNESS_MIN) continue
    out.push({
      req: 'colour', id: `meaning:${mode}:${a}:${b}`, level: WARN, criterion: '1.4.1 Use of colour (A)',
      tab: 'roles', entry: b, mode,
      title: `${a} and ${b} are the same colour in ${mode}`,
      detail: `Their hues are ${gap.toFixed(1)}° apart — ${roles[a]} against ${roles[b]}. These carry different meanings and a reader tells them apart by colour alone, so one of them is saying nothing.`,
      fix: `Move the ${a} seed to a different part of the wheel. ${b} is usually the constrained one: a green success has to stay clear of danger for red-green vision, which leaves the accent as the free choice.`,
      measured: `${gap.toFixed(1)}° hue`,
    })
  }
  return out
}

export function audit(state, derived) {
  const all = [
    ...focusChecks(state),
    ...targetSize(state, derived),
    ...textChecks(state, derived),
    ...motionChecks(state, derived),
    ...reflowChecks(state),
    ...headingOrder(derived),
    ...['light', 'dark'].flatMap(mode => [
      ...nonTextContrast(state, derived, mode),
      ...colourAlone(derived, mode),
      ...componentContrast(state, derived, mode),
      ...disabledCheck(state, derived, mode),
      /* roleSweep is deliberately NOT here. See the note on the function. */
      ...hairlineChecks(derived, mode),
      ...meaningCollision(derived, mode),
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
