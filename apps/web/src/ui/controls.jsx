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
 */
export const PAD = {
  card: 12,   // inside a card
  sub: 8,     // inside a subcard
  gap: 8,     // between subcards
  row: 4,     // between rows within a subcard
  label: 6,   // a subcard's heading to its first row
}

export function SectionHeader({ title, desc, count, right }) {
  return (
    <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)' }}>{title}</h2>
          {count != null && <span className="chip">{count}</span>}
        </div>
        {desc && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>{desc}</p>}
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
    <div style={{ border: '1px solid var(--bdr)', borderRadius: 9, background: 'var(--surf)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)',
            fontFamily: 'var(--sans)', fontSize: 13, textAlign: 'left', minWidth: 0,
          }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--t) var(--ease)', color: 'var(--muted)', flexShrink: 0 }}>
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
          {note && <span className="chip">{note}</span>}
        </button>
        {right && <div style={{ paddingRight: 10, flexShrink: 0 }}>{right}</div>}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: 'grid-template-rows var(--t) var(--ease)',
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {mounted && <div style={{ padding: `4px ${PAD.card}px ${PAD.card}px`, borderTop: '1px solid var(--bdr)' }}>{children}</div>}
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
export function FilterField({ value, onChange, placeholder = 'Filter', width = 128 }) {
  return (
    <div className={`filter-field${value ? ' has-value' : ''}`}
      style={{ position: 'relative', width, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"
        style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: value ? 'var(--accent)' : 'var(--muted)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          fontSize: 11, padding: '4px 22px 4px 25px', fontFamily: 'var(--sans)',
          color: value ? 'var(--accent)' : 'var(--text-dim)',
        }} />
      {value && (
        <button onClick={() => onChange('')} title="Clear"
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
      )}
    </div>
  )
}

/** Circular-arrow reset. Dimmed rather than hidden, so the control never shifts. */
export function ResetButton({ onClick, disabled, title = 'Reset to default' }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{
        background: 'none', border: 'none', padding: 2, display: 'flex', flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--dim)' : 'var(--accent)',
        opacity: disabled ? 0.4 : 1,
        transition: 'color var(--t) var(--ease), opacity var(--t) var(--ease)',
      }}>
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1, minWidth: 0 }}>{label}</span>
        <input
          value={display}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            width: 62, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 5px',
            textAlign: 'right', color: modified ? 'var(--accent)' : 'var(--muted)',
          }} />
        {suffix && <span style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)', width: 18 }}>{suffix}</span>}
        {defaultValue != null && (
          <ResetButton onClick={() => onChange(defaultValue)} disabled={!modified} />
        )}
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(snap(parseFloat(e.target.value)))}
        onDoubleClick={() => defaultValue != null && onChange(defaultValue)} />
      {desc && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>{desc}</div>}
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

export function NumField({ label, value, onChange, min, max, step = 1, suffix, width }) {
  return (
    <div style={{ minWidth: 0, width }}>
      {label && <label>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input className="num" type="number" min={min} max={max} step={step} value={value}
          onChange={e => {
            const n = parseFloat(e.target.value)
            onChange(Number.isFinite(n) ? n : 0)
          }}
          style={suffix ? { paddingRight: 22 } : undefined} />
        {suffix && <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--dim)', pointerEvents: 'none', fontFamily: 'var(--mono)' }}>{suffix}</span>}
      </div>
    </div>
  )
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surf3)', padding: 2, borderRadius: 6, border: '1px solid var(--bdr)' }}>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return (
          <button key={val} onClick={() => onChange(val)} className={value === val ? 'seg-on' : 'seg'}
            style={size === 'sm' ? { padding: '3px 8px', fontSize: 11 } : undefined}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ label, checked, onChange, desc }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal', fontSize: 13, color: 'var(--text)', fontWeight: 400, marginBottom: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 15, height: 15, marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0, padding: 0 }} />
      <span>
        {label}
        {desc && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>{desc}</div>}
      </span>
    </label>
  )
}

/** Marks a token that has broken away from its generated value. */
export function OverrideBadge({ onReset, title = 'Overridden — click to relink' }) {
  return (
    <button onClick={onReset} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(220,144,85,.12)',
        border: '1px solid rgba(220,144,85,.3)', color: 'var(--accent)', borderRadius: 4,
        padding: '1px 5px', fontSize: 9.5, fontFamily: 'var(--mono)', cursor: 'pointer', lineHeight: 1.6,
      }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
      set
    </button>
  )
}

export function Empty({ msg = 'Nothing here yet.' }) {
  return <div style={{ textAlign: 'center', padding: '26px 16px', color: 'var(--dim)', fontSize: 13, border: '1px dashed var(--bdr)', borderRadius: 10, lineHeight: 1.6 }}>{msg}</div>
}

export function Banner({ tone = 'info', children, onDismiss }) {
  const tones = {
    info:    { bg: 'var(--surf3)',           fg: 'var(--muted)',   bd: 'var(--bdr)' },
    warn:    { bg: 'rgba(216,164,65,.10)',   fg: 'var(--warn)',    bd: 'rgba(216,164,65,.3)' },
    error:   { bg: 'rgba(222,92,92,.10)',    fg: 'var(--danger)',  bd: 'rgba(222,92,92,.32)' },
    success: { bg: 'rgba(90,173,128,.10)',   fg: 'var(--success)', bd: 'rgba(90,173,128,.3)' },
  }[tone]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, background: tones.bg, border: `1px solid ${tones.bd}`,
      color: tones.fg, borderRadius: 8, padding: '9px 12px', fontSize: 12.5, lineHeight: 1.5,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: .7, fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
      )}
    </div>
  )
}
