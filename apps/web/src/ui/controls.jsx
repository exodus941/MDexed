/* Shared editor controls. Small, unopinionated, used by every panel. */
import { useState, useEffect } from 'react'

/** How close to the default a drag has to land before it snaps there. */
export const SNAP_FRACTION = 0.025

/* The editor's own spacing, on a 4px base.
 *
 * This existed as a spread of hand-picked numbers — 1, 3, 4, 6, 7, 8, 9, 10,
 * 11, 12, 13, 14, every value in the range — which is an embarrassing thing
 * for a tool that exists to stop people doing exactly that. Nesting reads as
 * nesting only when each level steps by a predictable amount, so cards, the
 * subcards inside them and the rows inside those each get one value and use
 * it everywhere.
 *
 * Doubled from 12/8/8/4/6. The original scale was set when a row was a label
 * and a field at 26px; rows now carry a field and a slider, and at 4px apart
 * two of those read as one block rather than two properties. Doubling keeps
 * the ratios — which is the part that makes nesting legible — and just gives
 * the whole editor room.
 */
export const PAD = {
  card: 24,   // inside a card
  sub: 16,    // inside a subcard
  gap: 16,    // between subcards
  row: 8,     // between rows within a subcard
  label: 12,  // a subcard's heading to its first row
}

/**
 * The optical correction a chip forces on the row that carries it.
 *
 * A chip is a box around small text. Beside a label on a shared baseline it is
 * the taller item, and all of its extra height hangs BELOW that baseline. The
 * row therefore grows downward only, and the label it grew around ends up
 * sitting high inside it. Symmetric padding cannot fix that, because the
 * asymmetry is in the line box, not in the padding.
 *
 * One pixel, moved from the bottom padding to the top. Only where a chip is
 * actually rendered — without one the row is already centred and this would
 * break it. Derived by measurement at 0, 1 and 2px, not by taste.
 */
export const CHIP_OPTICAL_SHIFT = 1

/* Button padding, on a 2px grid.
 *
 * Layout wants 4px steps; controls are too small for that — the gap between
 * a 4px and an 8px button is the difference between compact and chunky, with
 * nothing usable in between. 2px gives four sizes across the range a button
 * actually occupies, and every value stays even.
 *
 * Every button also carries a 1px border, transparent where it isn't drawn,
 * so a filled button and an outlined one at the same size are the same
 * height. Without it the outlined one is 2px taller and every toolbar sits
 * slightly crooked.
 */
export const BTN = {
  xs: '2px 6px',    // chips, icon-adjacent nudges
  sm: '4px 10px',   // inline actions inside a panel
  md: '6px 12px',   // the default
  lg: '8px 16px',   // header and primary actions
  xl: '10px 18px',  // a modal's own actions — see MODAL_BTN
}

/* The buttons at the foot of a modal.
 *
 * Every one of them had been given `BTN.sm` at 12px, which is the size used
 * for a reset link tucked beside a section heading. They are not that: they
 * are the decision the modal exists to ask for, and the last thing you look at
 * before committing. A 28px control asking "replace your whole document?"
 * undersells the question.
 *
 * Exported rather than repeated so the three modals cannot drift apart again,
 * which is how they got here — each one sized on its own, none of them wrong
 * next to itself. */
export const MODAL_BTN = { padding: BTN.xl, fontSize: 14 }

/**
 * A slider that moves between named scale steps, beside a field that accepts
 * anything.
 *
 * Dropdowns were the wrong instrument for these. Choosing a radius or a font
 * size is comparative — you want the next one up, and you want to see what
 * that did — and a select makes you open a list, read names, guess, close it,
 * look, and start again. A slider is the same decision in one gesture.
 *
 * But a scale is not a continuum, so it snaps: every stop is a real token, and
 * dragging writes the token reference rather than the pixel value it happens
 * to resolve to today. That matters because the whole system is derived. A
 * value of `{rounded.lg}` follows the roundness macro forever; `12px` was
 * right once.
 *
 * The field stays, because sometimes the answer genuinely is 3px and no step
 * is going to give you that. Off-scale values are shown as such rather than
 * being silently rounded to the nearest step, and the slider parks at the
 * closest one so it still has somewhere to be.
 *
 * @param steps  [{ name, value }] in scale order
 * @param value  the current raw value: a `{group.name}` reference or a literal
 * @param refFor turns a step name into the reference to store
 */
export function SnapSlider({ steps, value, onChange, refFor, title }) {
  if (!steps?.length) return null

  const raw = String(value ?? '')
  const named = steps.findIndex(s => raw === refFor(s.name))
  /* Off-scale: find the step it is nearest to in px so the thumb has a home,
     and say so rather than pretending it landed on one. */
  const px = parseFloat(raw)
  const nearest = named >= 0 ? named : (Number.isFinite(px)
    ? steps.reduce((best, s, i) =>
        Math.abs(parseFloat(s.value) - px) < Math.abs(parseFloat(steps[best].value) - px) ? i : best, 0)
    : 0)
  const off = named < 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }} title={title}>
      <input type="range" min={0} max={steps.length - 1} step={1} value={nearest}
        onChange={e => onChange(refFor(steps[Number(e.target.value)].name))}
        /* Ticks make the stops visible before you drag, so the control shows
           how many choices there are rather than making you discover them. */
        list="dmd-snap-ticks"
        style={{ flex: 1, minWidth: 60, height: 12, opacity: off ? .55 : 1 }} />
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0,
        minWidth: 64, textAlign: 'right',
        color: off ? 'var(--dim)' : 'var(--muted)',
      }}>
        {off ? `off scale` : `${steps[nearest].name} · ${steps[nearest].value}`}
      </span>
    </div>
  )
}

/** ── Baseline strut ──
    A zero-width invisible character at someone else's font size.
    Two boxes that each centre their own text in a fixed-height bar do not
    share a baseline unless their text is the same size — centring puts the
    box centre in the same place, and the baseline sits `fontSize·(asc−desc)/2`
    below that, which grows with the size. Dropping a strut at the larger size
    into the smaller label's line box makes both line boxes identical, so
    centring them lands the two baselines on top of each other.
    Only for rows that must stay stretch-aligned; anywhere else use
    `align-items: baseline` and be done.

    Pass `family` when the line being matched is in a different typeface: the
    line box is built from the font's own ascent and descent, so a 17px mono
    strut and a 17px sans strut are not the same height.

    Plain inline, and no `overflow` — an inline-block with overflow other than
    visible takes its baseline from the bottom margin edge instead of its text,
    which is the very thing this is here to avoid. The character is a
    zero-width space, so it costs no horizontal room. */
export const Strut = ({ size, family }) => (
  <span aria-hidden="true" style={{ fontSize: size, fontFamily: family }}>&#8203;</span>
)

/* The space between two sections, as one decision.
 *
 * Two sections are 48px apart. A rule between them does not change that — it
 * sits in the middle of the same 48, taking 24 on each side. So the rhythm of
 * the panel is identical whether or not a section is marked off, and the rule
 * only says where a boundary is, never how big it is.
 *
 * Against the 9px a heading keeps from its own body, that is a ratio of more
 * than five to one. Proximity is a ratio: the separation has to beat the
 * cohesion by enough that nobody has to look twice.
 *
 * A component rather than a value, because the pair only works together. The
 * old code had a bare `hr` carrying 24 over 20 and no answer at all for the
 * unruled case, so the next panel to stack two sections would have invented
 * one. */
/* A real mark, at the same 13px and 2 stroke as the header set.
 *
 * The three Add buttons wrote a literal "+" into the label — "+ Add Seed" —
 * so the glyph was a letter in a sentence rather than an icon beside one. It
 * took the label's font, it took no icon gap, and it sat hard against the A
 * with only a word space between them. A text plus is not an icon, and a word
 * space is not an icon gap. */
export const Plus = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const SECTION_GAP = 48

/* The panel body is a flex column with this much between every child, so a
   margin on a child ADDS to it rather than replacing it. That caught me here:
   halving the header's margin from 18 to 9 moved the visible gap from 28 to
   19, not to 14, because 10 of it was never the margin's to give.
 *
 * Both numbers are named and the subtraction is written out, so the value on
 * screen is the value in the code. A bare `marginBottom: 4` would land in the
 * same place and tell the next reader nothing. */
export const PANEL_GAP = 10
export const TITLE_GAP = 12

export function SectionBreak({ rule = true }) {
  return rule
    ? <hr style={{ border: 0, borderTop: '1px solid var(--bdr)', margin: `${SECTION_GAP / 2}px 0` }} />
    : <div aria-hidden="true" style={{ height: SECTION_GAP }} />
}

export function SectionHeader({ title, desc, count, right }) {
  /* Always baseline, description or not. The right-hand slot belongs to the
     title, not to the title-and-description pair, so it sits on the title's
     line. Centring it on the block drops it into the gap between the two. */
  /* 12 on screen, down from 28. A title and its body are one thing, and at 28
     this gap was close enough to the 48 between sections that a heading read
     as floating between the two. Proximity is a ratio: pulling the title in
     and pushing the sections apart are one change, not two. */
  return (
    <div style={{ marginBottom: TITLE_GAP - PANEL_GAP, display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)' }}>{title}</h2>
          {count != null && <span className="chip">{count}</span>}
        </div>
        {desc && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{desc}</p>}
      </div>
      {right}
    </div>
  )
}

/** Current editor animation duration in ms, read from the live CSS variable. */
const uiDuration = () => {
  if (typeof document === 'undefined') return 0
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
}

/**
 * Progressive disclosure. Advanced controls stay out of the way by default.
 *
 * Open and close both animate via a 0fr→1fr grid row, which transitions height
 * without needing a measured pixel value. Children stay mounted for the length
 * of the close so the collapse is visible, then unmount — keeping 27 role rows
 * worth of colour pickers out of the tree while shut.
 */
/**
 * @param openSignal changing this to a new truthy value opens the section.
 *   Callers used to force it open by changing `key`, but a remount starts life
 *   already open and skips the animation — which is what made a jump from the
 *   preview feel like a hard cut.
 */
export function Collapsible({ title, note, children, defaultOpen = false, right, openSignal, open: openProp, onOpenChange }) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen)
  /* Controlled when the caller supplies `open` — needed where the section can
     be remounted underneath itself (a cross-dissolve) and the open state has
     to survive in a parent that isn't remounting. */
  const controlled = openProp !== undefined
  const open = controlled ? openProp : ownOpen
  const setOpen = next => {
    const value = typeof next === 'function' ? next(open) : next
    if (controlled) onOpenChange?.(value)
    else setOwnOpen(value)
  }
  const [mounted, setMounted] = useState(open)

  useEffect(() => { if (openSignal) setOpen(true) }, [openSignal])

  useEffect(() => {
    if (open) { setMounted(true); return }
    const ms = uiDuration()
    if (!ms) { setMounted(false); return }
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open])

  return (
    <div style={{ border: '1px solid var(--bdr)', borderRadius: 8, background: 'var(--surf)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', alignItems: 'baseline', gap: 8,
            /* Symmetric padding does not optically centre this row, and the
               reason is the chip. Label and chip share a baseline, correctly —
               but the chip's box hangs 6.5px below that baseline where the
               label's letters hang 3. The row grows DOWNWARD only: 48px
               without a chip, 52 with one, and the label stays where it was.
               Measured: 20px above the cap, 22 below the baseline.

               So the correction is conditional on the chip, because a header
               without one already reads 0. One pixel off the bottom onto the
               top moves the text band by one and closes the 2px gap exactly.
               Verified at 0, 1 and 2px of shift: 1px is the answer, not a
               guess between two wrongs. */
            paddingTop: PAD.sub + (note ? CHIP_OPTICAL_SHIFT : 0),
            paddingBottom: PAD.sub - (note ? CHIP_OPTICAL_SHIFT : 0),
            paddingLeft: PAD.card, paddingRight: PAD.card,
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)',
            fontFamily: 'var(--sans)', fontSize: 14, textAlign: 'left', minWidth: 0,
          }}>
          {/* No `alignSelf:center`. That centred the chevron on the button's box,
              which put it 1px below the label's optical mid — the icon-beside-a-
              label rule, broken by the one property that looks like it obeys it.
              Baseline instead: an svg has no baseline of its own, so the row sits
              its bottom edge on the label's, and a 10px mark under 13px text
              lands on the cap centre. Measured, not assumed. */}
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--t) var(--ease)', color: 'var(--muted)', flexShrink: 0 }}>
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
          {note && <span className="chip">{note}</span>}
        </button>
        {right && <div style={{ paddingRight: 12, flexShrink: 0 }}>{right}</div>}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows var(--t) var(--ease)',
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {mounted && <div style={{ padding: PAD.card, borderTop: '1px solid var(--bdr)' }}>{children}</div>}
        </div>
      </div>
    </div>
  )
}

/**
 * Animated show/hide for anything that isn't a full Collapsible — expanded
 * rows, inline editors, selected-step panels. Conditional rendering alone
 * pops; this gives the same 0fr→1fr height transition and unmounts after.
 */
export function Expand({ open, children }) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) { setMounted(true); return }
    const ms = uiDuration()
    if (!ms) { setMounted(false); return }
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open])

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: open ? '1fr' : '0fr',
      transition: 'grid-template-rows var(--t) var(--ease)',
    }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{mounted && children}</div>
    </div>
  )
}

/**
 * Inline search for long lists — sits in a card header beside its count.
 * Deliberately unlike a chip: inset well, pill shape, brighter edge and a
 * legible magnifier, so an input never reads as a static badge.
 */
export function FilterField({ value, onChange, placeholder = 'Search…', width = 128 }) {
  return (
    <div className={`filter-field${value ? ' has-value' : ''}`}
      style={{ position: 'relative', width, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"
        style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: value ? 'var(--accent)' : 'var(--muted)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          fontSize: 12, padding: '4px 24px 4px 24px', fontFamily: 'var(--sans)',
          color: value ? 'var(--accent)' : 'var(--text-dim)',
        }} />
      {value && (
        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 12, lineHeight: 1 }}>
          <CloseButton onClick={() => onChange('')} label="Clear" line={1.4} size={8} />
        </span>
      )}
    </div>
  )
}

/** Circular-arrow reset. Dimmed rather than hidden, so the control never shifts. */
export function ResetButton({ onClick, disabled, title = 'Reset to default' }) {
  return (
    /* Always sits beside a field, so it takes the field's height. The icon
       does not grow — the extra height is hit area, which the 2.5.8 target-size
       check wants anyway. */
    <button onClick={onClick} disabled={disabled} title={title} className="btn-field btn-field-icon"
      style={{
        background: 'none', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--dim)' : 'var(--accent)',
        opacity: disabled ? 0.4 : 1,
        transition: 'color var(--t) var(--ease), opacity var(--t) var(--ease)',
      }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v6h6" /><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3 8.5" />
      </svg>
    </button>
  )
}

/**
 * Slider with a typable readout. Dragging is for exploring; typing is for
 * when you already know the number — every slider needs both.
 */
export function Slider({ label, desc, value, onChange, min = 0, max = 1, step = 0.01, format, defaultValue, suffix }) {
  const [draft, setDraft] = useState(null)
  const modified = defaultValue != null && Math.abs(value - defaultValue) > 1e-9

  /* Dragging within 2.5% of the default lands exactly on it. Getting back to
     the baseline shouldn't require precision — or arithmetic. */
  const snap = v => {
    if (defaultValue == null) return v
    return Math.abs(v - defaultValue) <= (max - min) * SNAP_FRACTION ? defaultValue : v
  }

  const commit = raw => {
    setDraft(null)
    const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''))
    if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)))
  }

  /* When a formatter is supplied its output is what the user sees, so it also
     has to be what they can edit — parse the digits back out on commit. */
  const display = draft ?? (format ? format(value) : String(Math.round(value * 1000) / 1000))

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0 }}>{label}</span>
        <input
          value={display}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            width: 64, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 6px',
            textAlign: 'right', color: modified ? 'var(--accent)' : 'var(--muted)',
          }} />
        {suffix && <span style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)', width: 20 }}>{suffix}</span>}
        {defaultValue != null && (
          <ResetButton onClick={() => onChange(defaultValue)} disabled={!modified} />
        )}
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(snap(parseFloat(e.target.value)))}
        onDoubleClick={() => defaultValue != null && onChange(defaultValue)} />
      {desc && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 1 }}>{desc}</div>}
    </div>
  )
}

/**
 * Delete that asks first, in place. The trash swaps for a red tick to commit
 * and a grey cross to back out — no dialog, no accidental loss.
 */
export function ConfirmDelete({ onConfirm, title = 'Delete', size = 13 }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  if (!armed) {
    return (
      <button className="btn-delete" title={title} onClick={e => { e.stopPropagation(); setArmed(true) }}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        </svg>
      </button>
    )
  }

  return (
    <span className="anim-fade" style={{ display: 'inline-flex', gap: 1 }}>
      <button className="btn-confirm btn-confirm-yes" title="Confirm delete"
        onClick={e => { e.stopPropagation(); setArmed(false); onConfirm() }}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <button className="btn-confirm btn-confirm-no" title="Cancel"
        onClick={e => { e.stopPropagation(); setArmed(false) }}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  )
}

/* Clamp and snap one typed number, or return null when the text is not one.
 *
 * A VALUE OFF THE STEP MAKES TWO CONTROLS DISAGREE. A field and the slider
 * beside it read one stored value and round it for display differently. A
 * density of 0.825 showed as 0.82 in the field and 0.83 on the slider, so a
 * reader had two answers and neither was the number stored. A control that
 * publishes a step commits onto it, measured from `min` the way a native
 * input steps.
 *
 * ROUND ONCE, AT THE END. Dividing by a fractional step manufactures its own
 * error: 0.825 / 0.01 is 82.49999999999999 in one direction and 82.5 in
 * another, which rounds to two different answers. Scale by the step's own
 * decimal places instead, work in whole units, and trim once. */
export function numberFromText (text, { min, max, step } = {}) {
  if (String(text).trim() === '') return null
  const n = parseFloat(text)
  if (!Number.isFinite(n)) return null
  let v = n
  const s = parseFloat(step)
  if (Number.isFinite(s) && s > 0) {
    const places = (String(step).split('.')[1] || '').length
    const unit = Math.pow(10, places)
    const origin = Number.isFinite(parseFloat(min)) ? parseFloat(min) : 0
    const steps = Math.round((Math.round(v * unit) - Math.round(origin * unit)) / Math.round(s * unit))
    v = (Math.round(origin * unit) + steps * Math.round(s * unit)) / unit
  }
  if (min != null) v = Math.max(parseFloat(min), v)
  if (max != null) v = Math.min(parseFloat(max), v)
  return v
}

/* ── A FIELD YOU CAN TYPE INTO KEEPS WHAT YOU TYPED ──
 *
 * This was fully controlled by the value flowing back in, and it committed on
 * every keystroke. In a colour picker that value has been round-tripped
 * through a hex, so the digits under the caret were REPLACED between
 * keystrokes. Typing 208 into a hue field gave a run of colours nobody asked
 * for, and often not 208 at the end of it.
 *
 * While the field has focus the DRAFT is what shows. The prop is ignored for
 * display, so nothing downstream can rewrite the caret's line. It still emits
 * on every keystroke that parses, so a swatch keeps following along live.
 * On blur the draft goes and the canonical value comes back, which is where a
 * lossy round trip is allowed to show itself.
 *
 * AN EMPTY FIELD IS NOT ZERO. Clearing it used to commit 0 at once, and the
 * field then snapped to "0" before a replacement digit arrived. An empty draft
 * now commits nothing and blurs back to the value it had.
 *
 * The emitted number is clamped and the draft is not. Typing 208 where the
 * ceiling is 100 emits 100 and still shows 208, so the keystrokes on the way
 * to a legal number are never eaten. */
export function NumField({ label, value, onChange, min, max, step = 1, suffix, width }) {
  const [draft, setDraft] = useState(null)
  const editing = draft !== null

  /* ── A VALUE OFF THE STEP MAKES TWO CONTROLS DISAGREE ──
   *
   * The field and the slider beside it read one state value and round it for
   * display in different ways. A density of 0.825 showed as 0.82 in the field
   * and 0.83 on the slider, so a reader had two answers and neither was the
   * number stored. The field publishes a step, so a committed value belongs
   * on it, measured from `min` the way a native input steps.
   *
   * Rounded at the END, on the derived value. A fractional step multiplied
   * back out manufactures its own error, so the arithmetic is done once and
   * then trimmed to the step's own precision. */
  const commit = text => {
    const v = numberFromText(text, { min, max, step })
    if (v != null) onChange(v)
  }

  return (
    <div style={{ minWidth: 0, width }}>
      {label && <label>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input className="num" type="number" min={min} max={max} step={step}
          value={editing ? draft : value}
          onFocus={e => { setDraft(String(value)); e.target.select() }}
          onChange={e => { setDraft(e.target.value); commit(e.target.value) }}
          onBlur={() => setDraft(null)}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
            /* Escape abandons the edit rather than committing it. The last
               emitted value stands, because every keystroke already emitted. */
            if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
          }}
          style={suffix ? { paddingRight: 24 } : undefined} />
        {suffix && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--dim)', pointerEvents: 'none', fontFamily: 'var(--mono)' }}>{suffix}</span>}
      </div>
    </div>
  )
}

/**
 * @param full  stretch to the container and share the width equally between
 *              options, instead of each one hugging its own label. Use it when
 *              the control sits above something full-width — a row of buttons
 *              that stops short of a slider beneath it reads as unfinished,
 *              and the ragged right edge is the first thing you see.
 */
export function Segmented({ options, value, onChange, size = 'md', full }) {
  return (
    <div style={{
      display: full ? 'flex' : 'inline-flex', width: full ? '100%' : undefined,
      gap: 2, background: 'var(--surf3)', padding: 2, borderRadius: 6, border: '1px solid var(--bdr)',
    }}>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return (
          <button key={val} onClick={() => onChange(val)} className={value === val ? 'seg-on' : 'seg'}
            style={{
              ...(size === 'sm' ? { padding: '2px 6px', fontSize: 12 } : null),
              /* Equal shares rather than content-sized, so the divisions land
                 on a regular rhythm instead of tracking label length.
                 *
                 The type comes down and the side padding nearly goes, because
                 the width is now fixed and the longest label has to live
                 inside it — five equal shares of a 239px picker is 45px, and
                 OKLCH at 11px with 6px of padding either side does not fit in
                 that. Shrinking the label is the whole fix. */
              ...(full ? {
                /* Grow to fill, but never below the label's own width.
                 *
                 * Equal shares (`flex: 1; min-width: 0`) looked tidy and
                 * clipped OKLCH the moment the container got tight — the token
                 * picker is 205px, so a fifth of it is 38px against a label
                 * that needs 40. Sharing only the *leftover* keeps the control
                 * full-width, which is what was actually asked for, and lets
                 * the one long label take the room it needs.
                 *
                 * Smaller type as well, since that is the other half of making
                 * it fit, with the weight up a shade to pay for the size: ten
                 * pixels of 400 reads lighter than eleven did. */
                flex: '1 1 auto', minWidth: 'max-content',
                padding: '4px 4px', fontSize: 10, fontWeight: 550,
                textAlign: 'center', whiteSpace: 'nowrap',
              } : null),
            }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ label, checked, onChange, desc }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal', fontSize: 14, color: 'var(--text)', fontWeight: 400, marginBottom: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0, padding: 0 }} />
      <span>
        {label}
        {desc && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 1 }}>{desc}</div>}
      </span>
    </label>
  )
}

/** Marks a token that has broken away from its generated value. */
export function OverrideBadge({ onReset, title = 'Overridden — click to relink' }) {
  return (
    <button onClick={onReset} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgb(var(--accent-rgb) / .12)',
        border: '1px solid rgb(var(--accent-rgb) / .3)', color: 'var(--accent)', borderRadius: 4,
        padding: '2px 6px', fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer', lineHeight: 1.6,
      }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
      set
    </button>
  )
}

export function Empty({ msg = 'Nothing here yet.' }) {
  return <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--dim)', fontSize: 14, border: '1px dashed var(--bdr)', borderRadius: 12, lineHeight: 1.6 }}>{msg}</div>
}

/* The one close control.
 *
 * Every hand-rolled `×` in this app sat a couple of pixels above the first
 * line of text beside it, and the cause was never the flex alignment — it was
 * the glyph. `×` is a multiplication sign: the font positions its ink around
 * the maths axis, well above the centre of the em box, and every face puts it
 * somewhere slightly different. No amount of `align-items` fixes a character
 * whose ink is off-centre inside its own box.
 *
 * So: an SVG, whose ink is exactly centred by construction, inside a box
 * exactly one line-box tall (`LINE`em against the inherited font size). Two
 * boxes of equal height, both aligned to the top of the row, have coincident
 * centres — the cross lands on the first line's optical centre and stays there
 * whatever the text does.
 *
 * `font: inherit` is load-bearing. It makes `em` resolve against the
 * container's font size rather than the browser's button default, which is
 * what keeps the box the same height as the line it is aligning to. */
export const LINE = 1.5

export function CloseButton({ onClick, label = 'Dismiss', line = LINE, size = 9 }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="close-x"
      style={{
        flexShrink: 0, width: `${line}em`, height: `${line}em`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', padding: 0, margin: 0,
        color: 'inherit', font: 'inherit', cursor: 'pointer', borderRadius: 4,
      }}>
      <svg width={size} height={size} viewBox="0 0 10 10" fill="none"
        stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
      </svg>
    </button>
  )
}

export function Banner({ tone = 'info', children, onDismiss }) {
  const tones = {
    info:    { bg: 'var(--surf3)',           fg: 'var(--muted)',   bd: 'var(--bdr)' },
    warn:    { bg: 'rgb(var(--warn-rgb) / .10)',   fg: 'var(--warn)',    bd: 'rgb(var(--warn-rgb) / .3)' },
    error:   { bg: 'rgb(var(--danger-rgb) / .10)',    fg: 'var(--danger)',  bd: 'rgb(var(--danger-rgb) / .32)' },
    success: { bg: 'rgb(var(--success-rgb) / .10)',   fg: 'var(--success)', bd: 'rgb(var(--success-rgb) / .3)' },
  }[tone]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, background: tones.bg, border: `1px solid ${tones.bd}`,
      color: tones.fg, borderRadius: 8, padding: '8px 12px', fontSize: 12, lineHeight: LINE,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onDismiss && <CloseButton onClick={onDismiss} />}
    </div>
  )
}
