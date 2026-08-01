/* Shared editor controls. Small, unopinionated, used by every panel. */
import { useState } from 'react'

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

/** Progressive disclosure. Advanced controls stay out of the way by default. */
export function Collapsible({ title, note, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--bdr)', borderRadius: 9, background: 'var(--surf)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)',
          fontFamily: 'var(--sans)', fontSize: 13, textAlign: 'left',
        }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--muted)', flexShrink: 0 }}>
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span style={{ flex: 1 }}>{title}</span>
        {note && <span className="chip">{note}</span>}
      </button>
      {open && <div style={{ padding: '4px 12px 14px', borderTop: '1px solid var(--bdr)' }}>{children}</div>}
    </div>
  )
}

/** Slider with a live readout and a double-click-to-reset default. */
export function Slider({ label, desc, value, onChange, min = 0, max = 1, step = 0.01, format, defaultValue }) {
  const display = format ? format(value) : value
  const modified = defaultValue != null && Math.abs(value - defaultValue) > 1e-9
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1 }}>{label}</span>
        {modified && (
          <button onClick={() => onChange(defaultValue)} title="Reset to default"
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: 0 }}>
            reset
          </button>
        )}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: modified ? 'var(--accent)' : 'var(--muted)', minWidth: 42, textAlign: 'right' }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => defaultValue != null && onChange(defaultValue)} />
      {desc && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>{desc}</div>}
    </div>
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
