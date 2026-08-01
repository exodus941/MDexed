/* Application shell: header, macro bar, panel column, preview column.
   All document state lives in the store; this file only wires things together
   and owns cloud sync. */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { StoreProvider, useStore } from './state/store.jsx'
import { createInitialState, MACROS, DEFAULT_MACROS, CONTRAST_PAIRS } from './state/schema.js'
import { PRESETS, applyPreset } from './state/presets.js'
import { check } from './color/contrast.js'
import { migrate } from './state/migrate.js'
import { generateFile, validate } from './emit/designmd.js'
import { parseFile } from './emit/parse.js'
import { isValidColor } from './color/convert.js'
import { APP_CSS } from './ui/theme.js'
import { Banner, ResetButton } from './ui/controls.jsx'
import Canvas from './preview/Canvas.jsx'
import ColorPanel from './panels/ColorPanel.jsx'
import RolesPanel from './panels/RolesPanel.jsx'
import TypographyPanel from './panels/TypographyPanel.jsx'
import ComponentsPanel from './panels/ComponentsPanel.jsx'
import DirectivesPanel from './panels/DirectivesPanel.jsx'
import { LayoutPanel, ShapePanel, DepthPanel, MotionPanel } from './panels/system.jsx'
import { MetaTab, RationaleTab } from './panels/basics.jsx'
import HistoryPanel from './panels/HistoryPanel.jsx'

/* ── API ── */
const API_BASE = '/api/v1'
const TOKEN_KEY = 'design-md:tokens'
const DRAFT_KEY = 'design-md:draft'
const ANIM_KEY = 'design-md:ui-anim'

const getStoredToken = id => {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')[id] || null } catch { return null }
}
const setStoredToken = (id, token) => {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')
    t[id] = token
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
  } catch { /* private mode */ }
}
const api = {
  create: state => fetch(`${API_BASE}/projects`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, schemaVersion: state.schemaVersion ?? 1 }),
  }),
  read: id => fetch(`${API_BASE}/projects/${id}`),
  update: (id, token, state, version) => fetch(`${API_BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Edit-Token': token },
    body: JSON.stringify({ state, version }),
  }),
}

/* ── Icons ── */
const Copy = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
const Upload = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
const Download = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
const Undo = ({ flip }) => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: 'scaleX(-1)' } : undefined}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" /></svg>
const Save = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
)
const Motion = ({ off }) => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h4l3-7 4 14 3-7h4" />
    {off && <line x1="3" y1="21" x2="21" y2="3" strokeWidth={2.2} />}
  </svg>
)

const SyncBadge = ({ status }) => {
  const cfg = {
    local:    { bg: 'var(--surf2)',         fg: 'var(--muted)',   txt: 'Local only' },
    saving:   { bg: 'var(--surf2)',         fg: 'var(--accent)',  txt: 'Saving…' },
    saved:    { bg: 'rgba(90,173,128,.13)', fg: 'var(--success)', txt: 'Saved' },
    readonly: { bg: 'var(--surf2)',         fg: 'var(--muted)',   txt: 'Read-only' },
    conflict: { bg: 'rgba(222,92,92,.13)',  fg: 'var(--danger)',  txt: 'Conflict' },
    error:    { bg: 'rgba(222,92,92,.13)',  fg: 'var(--danger)',  txt: 'Sync error' },
    offline:  { bg: 'var(--surf2)',         fg: 'var(--muted)',   txt: 'Offline' },
  }[status] ?? { bg: 'var(--surf2)', fg: 'var(--muted)', txt: status }
  return <span style={{ fontSize: 11, fontFamily: 'var(--mono)', background: cfg.bg, color: cfg.fg, padding: '4px 9px', borderRadius: 5, border: '1px solid var(--bdr)', whiteSpace: 'nowrap' }}>{cfg.txt}</span>
}

/* ── Macro bar ──
   Always visible, above everything. Five multipliers that reshape hundreds of
   tokens — the reason the panels below can stay shallow.

   Each one shows both the multiplier and what it actually resolves to, and
   both are typeable: entering `12px` for roundness back-solves the multiplier.
   A relative number on its own is hard to judge; the concrete value is the one
   a designer is really choosing. */
function MacroControl({ macro, value, resolved, onChange }) {
  const base = DEFAULT_MACROS[macro.key]
  const changed = Math.abs(value - base) > 1e-9
  const [draft, setDraft] = useState(null)

  /* Dragging within 3% of the range lands exactly on the default — getting
     back to baseline shouldn't need a steady hand. */
  const snap = v => (Math.abs(v - base) <= (macro.max - macro.min) * 0.03 ? base : v)

  const commitResolved = raw => {
    const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''))
    setDraft(null)
    if (!Number.isFinite(n) || !resolved.base) return
    onChange(Math.max(macro.min, Math.min(macro.max, n / resolved.base)))
  }

  return (
    <div style={{ width: 156, flexShrink: 0 }} title={macro.desc}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <span style={{ fontSize: 10.5, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>{macro.label}</span>
        <ResetButton onClick={() => onChange(base)} disabled={!changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
        <input className="num" type="number" min={macro.min} max={macro.max} step={0.01} value={value.toFixed(2)}
          onChange={e => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(Math.max(macro.min, Math.min(macro.max, n))) }}
          title="Multiplier"
          style={{ width: 56, padding: '3px 5px', fontSize: 10.5, color: changed ? 'var(--accent)' : 'var(--muted)' }} />
        <input
          value={draft ?? resolved.display}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commitResolved(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          disabled={!resolved.base}
          title={resolved.hint}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 5px',
            textAlign: 'right', color: 'var(--text-dim)', opacity: resolved.base ? 1 : 0.55,
          }} />
      </div>
      <input type="range" min={macro.min} max={macro.max} step={0.01} value={value}
        onChange={e => onChange(snap(parseFloat(e.target.value)))}
        onDoubleClick={() => onChange(base)} />
    </div>
  )
}

/* Editor animation speed. Sits at the far right of the system bar so it lines
   up above the preview pane, opposite the token macros — it configures the
   tool, not the design. */
const UI_ANIM_DEFAULT = 125
const UI_ANIM_MAX = 1000
const UI_ANIM_STEP = 125

/* Same three-row shape as the token macros so it sits on the same baseline.
   The slider moves in 125ms steps; the field takes any value in range, so an
   odd number is reachable by typing even though dragging won't land on it. */
function UiSpeedControl({ value, onChange }) {
  const [draft, setDraft] = useState(null)
  const changed = value !== UI_ANIM_DEFAULT

  const commit = raw => {
    setDraft(null)
    const n = parseFloat(String(raw).replace(/[^\d.]/g, ''))
    if (Number.isFinite(n)) onChange(Math.max(0, Math.min(UI_ANIM_MAX, Math.round(n))))
  }

  return (
    <div style={{ width: 156, flexShrink: 0 }} title="How fast the editor's own panels and controls animate. 0 disables them.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <span style={{ fontSize: 10.5, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>UI Animation</span>
        <ResetButton onClick={() => onChange(UI_ANIM_DEFAULT)} disabled={!changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
        <input
          value={draft ?? (value ? `${value}ms` : 'off')}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 5px',
            textAlign: 'right', color: value ? 'var(--text-dim)' : 'var(--dim)',
          }} />
      </div>
      <input type="range" min={0} max={UI_ANIM_MAX} step={UI_ANIM_STEP} value={Math.min(value, UI_ANIM_MAX)}
        onChange={e => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(UI_ANIM_DEFAULT)} />
    </div>
  )
}

function MacroBar({ onOpenContrast, uiSpeed, setUiSpeed }) {
  const { state, derived, set } = useStore()
  const setMacro = (key, value) => set(s => ({ ...s, macros: { ...s.macros, [key]: value } }), `macro:${key}`)
  const reset = () => set(s => ({ ...s, macros: { ...DEFAULT_MACROS } }))
  const anyChanged = MACROS.some(m => state.macros[m.key] !== DEFAULT_MACROS[m.key])

  /* What each multiplier resolves to in the unit a designer thinks in. */
  const resolvedFor = key => {
    const v = state.macros[key]
    switch (key) {
      case 'scale':     return { base: state.type.base,  display: `${Math.round(state.type.base * v * 10) / 10}px`, hint: 'Base font size — type a px value' }
      case 'density':   return { base: state.space.base, display: `${Math.round(state.space.base * v * 10) / 10}px`, hint: 'Base spacing unit — type a px value' }
      case 'roundness': return { base: state.radius.base, display: `${Math.round(state.radius.base * v * 10) / 10}px`, hint: state.radius.base ? 'Base corner radius — type a px value' : 'Base radius is 0, so there is nothing to scale' }
      /* Percentage, not pixels: one multiplier drives offset, blur and opacity
         at once, so there is no single px value it could report. */
      case 'depth':     return { base: 0.01, display: `${Math.round(v * 100)}%`, hint: 'Shadow strength as a percentage — scales offset, blur and opacity together. 0% removes shadows.' }
      case 'speed':     return { base: state.motion.durations.normal, display: `${Math.round(state.motion.durations.normal * v)}ms`, hint: 'The `normal` duration — type a value in ms. 0 disables all motion.' }
      default:          return { base: 1, display: `${v}`, hint: '' }
    }
  }

  const failing = CONTRAST_PAIRS.filter(p => {
    const r = check(derived.roles[state.color.mode][p.fg], derived.roles[state.color.mode][p.bg])
    return p.ui ? r.ratio < 3 : !r.pass
  }).length

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, padding: '8px 20px 10px', borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', flexShrink: 0, overflowX: 'auto' }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--dim)', whiteSpace: 'nowrap', paddingBottom: 4 }}>System</span>

      {MACROS.map(m => (
        <MacroControl key={m.key} macro={m} value={state.macros[m.key]} resolved={resolvedFor(m.key)}
          onChange={v => setMacro(m.key, v)} />
      ))}

      <button onClick={onOpenContrast} title="Open the contrast checker"
        style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer',
          background: failing ? 'rgba(222,92,92,.12)' : 'rgba(90,173,128,.10)',
          border: `1px solid ${failing ? 'rgba(222,92,92,.35)' : 'rgba(90,173,128,.3)'}`,
          color: failing ? 'var(--danger)' : 'var(--success)',
          borderRadius: 6, padding: '5px 9px', fontSize: 11, fontFamily: 'var(--mono)', marginBottom: 1,
        }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
        {failing ? `${failing} contrast` : 'Contrast OK'}
      </button>

      <button className="btn-ghost" onClick={reset} disabled={!anyChanged} style={{ padding: '5px 9px', fontSize: 11, flexShrink: 0, marginBottom: 1 }}>Reset all</button>

      {/* Pushed right so it sits above the preview pane — it tunes the editor,
          not the design, and the separation should be visible. */}
      <div style={{ marginLeft: 'auto', paddingLeft: 20, display: 'flex', alignItems: 'flex-end', gap: 14, flexShrink: 0 }}>
        <UiSpeedControl value={uiSpeed} onChange={setUiSpeed} />
      </div>
    </div>
  )
}

/* ── Preview / export modal ── */
function FileModal({ onClose }) {
  const { state, derived } = useStore()
  const { text, omitted, dropped } = useMemo(() => generateFile(state, derived), [state, derived])
  const report = useMemo(() => validate(text), [text])
  const [copied, setCopied] = useState(false)

  return (
    <div onClick={onClose} className="anim-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, width: '100%', maxWidth: 760, maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 17px', borderBottom: '1px solid var(--bdr)', gap: 10 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, flex: 1 }}>DESIGN.md</span>
          <span className="chip" style={{ color: report.ok ? 'var(--success)' : 'var(--danger)', borderColor: report.ok ? 'rgba(90,173,128,.3)' : 'rgba(222,92,92,.3)' }}>
            {report.ok ? 'Spec valid' : `${report.errors.length} error${report.errors.length === 1 ? '' : 's'}`}
          </span>
          <span className="chip">{(text.length / 1024).toFixed(1)} kB</span>
          <button className="btn-ghost" style={{ padding: '5px 10px' }}
            onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}>
            <Copy />{copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>

        {(report.errors.length > 0 || report.warnings.length > 0 || dropped.length > 0) && (
          <div style={{ padding: '10px 17px', borderBottom: '1px solid var(--bdr)', display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 170, overflow: 'auto' }}>
            {report.errors.map((e, i) => <Banner key={`e${i}`} tone="error">{e}</Banner>)}
            {report.warnings.map((w, i) => <Banner key={`w${i}`} tone="warn">{w}</Banner>)}
            {dropped.length > 0 && (
              <Banner tone="info">
                {dropped.length} component propert{dropped.length === 1 ? 'y' : 'ies'} outside the spec schema ({[...new Set(dropped.map(d => d.key))].join(', ')}) — written into the Components section as prose instead.
              </Banner>
            )}
            {omitted.length > 0 && <Banner tone="info">Declared as omitted: {omitted.join(', ')}. Fill these in under Rationale.</Banner>}
          </div>
        )}

        <pre style={{ flex: 1, overflow: 'auto', padding: 17, fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.65, color: 'var(--text)', margin: 0, background: 'var(--bg)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</pre>
      </div>
    </div>
  )
}

/* ── Save flash ──
   Autosave is invisible by nature, which is fine right up until you want to
   close the tab. A brief confirmation costs nothing and answers the question
   without needing to be read. */
function SaveFlash({ savedAt }) {
  const [shown, setShown] = useState(null)
  const [leaving, setLeaving] = useState(false)

  /* Two keyframe animations rather than a transition. A transition needs a
     frame between the start and end states, and the entry animation's `both`
     fill would pin the final opacity and beat any exit transition anyway. */
  useEffect(() => {
    if (!savedAt) return
    setShown(savedAt)
    setLeaving(false)
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    const hold = setTimeout(() => setLeaving(true), 1600)
    const gone = setTimeout(() => setShown(null), 1600 + ms + 40)
    return () => { clearTimeout(hold); clearTimeout(gone) }
  }, [savedAt])

  if (!shown) return null
  return (
    <div key={shown.at} className={leaving ? 'anim-fall' : 'anim-rise'} style={{
      position: 'fixed', right: 18, bottom: 16, zIndex: 900, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 7,
      /* Opaque. A translucent confirmation over a dark editor is unreadable. */
      background: '#12352a', border: '1px solid rgba(90,173,128,.55)',
      color: '#7fd6a4', borderRadius: 7, padding: '7px 12px',
      fontSize: 11.5, fontFamily: 'var(--mono)',
      boxShadow: '0 8px 24px rgba(0,0,0,.5)',
    }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Saved to {shown.where}
    </div>
  )
}

/* ── Tab strip ──
   Same height as the preview pane's surface bar so the two line up across the
   split. The strip scrolls without a visible scrollbar — chevrons appear only
   when there's actually something off-screen in that direction. */
const BAR_H = 42

function TabStrip({ tabs, active, onSelect, right }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const [menuOpen, setMenuOpen] = useState(false)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    })
  }, [])

  useEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure, tabs.length, active])

  const nudge = dir => ref.current?.scrollBy({ left: dir * 160, behavior: 'smooth' })

  const Chevron = ({ dir }) => (
    <button onClick={() => nudge(dir)} title={dir < 0 ? 'Scroll left' : 'Scroll right'}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: dir < 0 ? 'flex-start' : 'flex-end',
        width: 40, height: '100%', border: 'none', cursor: 'pointer',
        color: 'var(--muted)', padding: dir < 0 ? '0 0 0 10px' : '0 10px 0 0',
        /* Wide hit area, with a fade so tabs slide under it rather than
           colliding with a hard edge. */
        background: `linear-gradient(to ${dir < 0 ? 'right' : 'left'}, var(--surf) 55%, transparent)`,
        transition: 'color var(--t) var(--ease)',
      }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir < 0 ? 'rotate(180deg)' : 'none' }}>
        <polyline points="9 6 15 12 9 18" />
      </svg>
    </button>
  )

  /* The active tab is pinned at the left with a menu beside it, so it never
     scrolls out of sight; the rest queue up to its right. */
  const activeTab = tabs.find(t => t.id === active) ?? tabs[0]
  const rest = tabs.filter(t => t.id !== active)

  return (
    <nav style={{
      display: 'flex', alignItems: 'stretch', height: BAR_H, flexShrink: 0,
      borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', paddingRight: 10,
      position: 'relative',
    }}>
      {/* Name and arrow are one control — the whole thing opens the menu, and
          the underline spans the full hit area rather than just the label. */}
      <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0, paddingLeft: 14 }}>
        <button onClick={() => setMenuOpen(o => !o)} title="Switch tab"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 0 9px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
            color: menuOpen ? 'var(--accent)' : 'var(--text)',
            borderBottom: '2px solid var(--accent)', marginBottom: -1,
            transition: 'color var(--t) var(--ease)',
          }}>
          {activeTab.label}
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--t) var(--ease)', opacity: .8 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <span style={{ alignSelf: 'center', width: 1, height: 18, background: 'var(--bdr)', margin: '0 2px' }} />
      </div>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div className="anim-pop" style={{
            position: 'absolute', top: BAR_H - 2, left: 10, zIndex: 71, minWidth: 176,
            background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 9,
            boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: 5,
          }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { onSelect(t.id); setMenuOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', background: t.id === active ? 'var(--surf3)' : 'none',
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12.5,
                  color: t.id === active ? 'var(--accent)' : 'var(--text)', padding: '6px 9px', borderRadius: 6,
                }}
                onMouseEnter={e => { if (t.id !== active) e.currentTarget.style.background = 'var(--surf3)' }}
                onMouseLeave={e => { if (t.id !== active) e.currentTarget.style.background = 'none' }}>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {edges.left && <Chevron dir={-1} />}
      <div ref={ref} className="no-bar" onScroll={measure}
        style={{ display: 'flex', flex: 1, minWidth: 0, overflowX: 'auto' }}>
        {rest.map(t => (
          <button key={t.id} onClick={() => onSelect(t.id)} style={{
            background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
            padding: '0 11px', fontFamily: 'var(--sans)', fontSize: 12.5, whiteSpace: 'nowrap',
            color: 'var(--muted)', fontWeight: 400,
            borderBottom: '2px solid transparent',
            transition: 'color var(--t) var(--ease)', marginBottom: -1,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}>{t.label}</button>
        ))}
      </div>
      {edges.right && <Chevron dir={1} />}
      {right && (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: 10, borderLeft: '1px solid var(--bdr)', marginLeft: 6 }}>
          {right}
        </div>
      )}
    </nav>
  )
}

/* ── Editable title ──
   Edits stay local until confirmed, so a half-typed name never lands in the
   document — and the tick/cross only exist while there's something to decide. */
function TitleField({ name, onCommit }) {
  const [draft, setDraft] = useState(name)
  const [editing, setEditing] = useState(false)

  useEffect(() => { if (!editing) setDraft(name) }, [name, editing])

  /* Compare trimmed, or committing " Name " leaves the field permanently dirty
     because the stored value differs from the draft by whitespace. */
  const dirty = draft.trim() !== name.trim()
  const commit = () => {
    const next = draft.trim() || 'Untitled'
    onCommit(next)
    setDraft(next)
    setEditing(false)
  }
  const discard = () => { setDraft(name); setEditing(false) }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <input
        value={draft}
        onChange={e => { setDraft(e.target.value); setEditing(true) }}
        onFocus={() => setEditing(true)}
        onBlur={() => { if (!dirty) setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') discard()
        }}
        placeholder="Untitled"
        title="Project name"
        style={{
          width: dirty ? 180 : 150, padding: '3px 8px', fontSize: 12,
          fontFamily: 'var(--mono)', background: 'var(--surf2)',
          borderColor: dirty ? 'rgba(220,144,85,.45)' : 'var(--bdr)',
          color: dirty ? 'var(--accent)' : 'var(--muted)',
          transition: 'width var(--t) var(--ease), border-color var(--t) var(--ease)',
        }} />
      {dirty && (
        /* onMouseDown must be swallowed: pressing the button blurs the input
           first, and the resulting re-render replaces the node before mouseup
           lands — so the click never fires. Keeping focus fixes it. */
        <span className="anim-fade" style={{ display: 'inline-flex', gap: 1 }} onMouseDown={e => e.preventDefault()}>
          <button className="btn-confirm" onClick={commit} title="Save name (Enter)" style={{ color: 'var(--success)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button className="btn-confirm btn-confirm-no" onClick={discard} title="Discard (Esc)">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      )}
    </div>
  )
}

/* ── New document ──
   Opening the app used to drop you straight into whatever was last in
   localStorage with no way out. This is the way out. */
function NewDocModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  return (
    <div onClick={onClose} className="anim-fade" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 17px', borderBottom: '1px solid var(--bdr)' }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, flex: 1 }}>New design system</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: '2px 6px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 17, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <label>Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Untitled system" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>Start from</div>
          <p className="panel-note" style={{ marginBottom: 10 }}>
            This replaces the current document. Anything unsaved to the cloud is lost.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => onCreate(p.id, name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', textAlign: 'left',
                  background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 9,
                  cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--sans)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(220,144,85,.4)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)' }}>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {p.swatches.map(c => <div key={c} style={{ width: 16, height: 26, background: c, borderRadius: 3, border: '1px solid rgba(255,255,255,.07)' }} />)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Shell ── */
const TABS = [
  { id: 'meta',       label: 'Meta',       Panel: MetaTab },
  { id: 'colors',     label: 'Colour',     Panel: ColorPanel },
  { id: 'roles',      label: 'Roles',      Panel: RolesPanel },
  { id: 'type',       label: 'Type',       Panel: TypographyPanel },
  { id: 'layout',     label: 'Layout',     Panel: LayoutPanel },
  { id: 'shape',      label: 'Shape',      Panel: ShapePanel },
  { id: 'depth',      label: 'Depth',      Panel: DepthPanel },
  { id: 'motion',     label: 'Motion',     Panel: MotionPanel },
  { id: 'components', label: 'Components', Panel: ComponentsPanel },
  { id: 'directives', label: 'Directives', Panel: DirectivesPanel },
  { id: 'rationale',  label: 'Rationale',  Panel: RationaleTab },
  { id: 'history',    label: 'History',    Panel: HistoryPanel },
]

function Shell() {
  const { state, derived, set, load, undo, redo, canUndo, canRedo } = useStore()
  const [tab, setTab] = useState('colors')
  const [showFile, setShowFile] = useState(false)
  const [showNew, setShowNew] = useState(false)
  /* Carries a timestamp so clicking the same element twice re-triggers the
     jump rather than being deduplicated as an unchanged value. */
  const [inspect, setInspect] = useState(null)
  const [uiSpeed, setUiSpeed] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(ANIM_KEY), 10)
      return Number.isFinite(saved) && saved >= 0 && saved <= UI_ANIM_MAX ? saved : UI_ANIM_DEFAULT
    } catch { return UI_ANIM_DEFAULT }
  })

  /* Drives `--t`, which every editor transition reads. The preview keeps its
     own durations — those are the user's motion tokens, not the tool's. */
  useEffect(() => {
    document.documentElement.style.setProperty('--t', `${uiSpeed}ms`)
    document.documentElement.classList.toggle('no-anim', uiSpeed === 0)
    try { localStorage.setItem(ANIM_KEY, String(uiSpeed)) } catch { /* ignore */ }
  }, [uiSpeed])
  const [notice, setNotice] = useState(null)
  const [projectId, setProjectId] = useState(null)
  const [editToken, setEditToken] = useState(null)
  const [serverVersion, setServerVersion] = useState(null)
  const [syncStatus, setSyncStatus] = useState('local')
  const [linkCopied, setLinkCopied] = useState(false)
  const isInitialSync = useRef(true)
  const fileRef = useRef(null)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  const justSavedTimer = useRef(null)

  /* Open a shared project from /p/:id */
  useEffect(() => {
    const m = window.location.pathname.match(/^\/p\/([^/]+)/)
    if (!m) return
    const id = m[1]
    const token = getStoredToken(id)
    setSyncStatus('saving')
    api.read(id).then(async r => {
      if (!r.ok) { setSyncStatus('local'); setNotice({ tone: 'warn', text: 'That project link could not be opened.' }); return }
      const data = await r.json()
      const { state: migrated, migratedFrom, warning } = migrate(data.state)
      load(migrated)
      setProjectId(id)
      setServerVersion(data.version)
      if (warning) setNotice({ tone: 'warn', text: warning })
      else if (migratedFrom != null) setNotice({ tone: 'info', text: `Upgraded this project from schema v${migratedFrom}. Save to keep the upgrade.` })
      if (token) { setEditToken(token); setSyncStatus('saved') } else setSyncStatus('readonly')
    }).catch(() => setSyncStatus('offline'))
  }, [load])

  /* ── Persistence ──
     One path for both destinations so "saved" means one thing. A cloud
     project PATCHes; anything else writes the local draft. The flash and the
     manual button both go through here. */
  const persist = useCallback(async (reason = 'auto') => {
    if (savingRef.current) return
    const cloud = projectId && editToken && syncStatus !== 'readonly' && syncStatus !== 'conflict'
    savingRef.current = true
    if (cloud) setSyncStatus('saving')
    try {
      if (cloud) {
        const r = await api.update(projectId, editToken, state, serverVersion)
        if (r.status === 409) { setSyncStatus('conflict'); return false }
        if (!r.ok) { setSyncStatus('error'); return false }
        const { version } = await r.json()
        setServerVersion(version)
        setSyncStatus('saved')
      } else {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state))
      }
      setSavedAt({ at: Date.now(), where: cloud ? 'cloud' : 'this browser', reason })
      dirtyRef.current = false
      return true
    } catch {
      if (cloud) setSyncStatus('offline')
      return false
    } finally {
      savingRef.current = false
    }
  }, [state, projectId, editToken, serverVersion, syncStatus])

  /* Debounced autosave. Cloud writes wait longer than local ones. */
  useEffect(() => {
    if (isInitialSync.current) { isInitialSync.current = false; return }
    if (window.location.pathname.startsWith('/p/') && !projectId) return
    dirtyRef.current = true
    setDirty(true)
    const t = setTimeout(() => { persist('auto').then(ok => ok && setDirty(false)) }, projectId ? 1500 : 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  /* Local draft, when not viewing a cloud project */
  useEffect(() => {
    if (window.location.pathname.startsWith('/p/')) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const { state: migrated, warning } = migrate(JSON.parse(raw))
      load(migrated)
      if (warning) setNotice({ tone: 'warn', text: warning })
    } catch { /* corrupt draft — start fresh rather than crash */ }
  }, [load])

  const saveToCloud = async () => {
    if (projectId) return
    setSyncStatus('saving')
    try {
      const r = await api.create(state)
      if (!r.ok) throw new Error('save failed')
      const { id, editToken: tk, version } = await r.json()
      isInitialSync.current = true
      setProjectId(id); setEditToken(tk); setServerVersion(version)
      setStoredToken(id, tk)
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      window.history.pushState({}, '', `/p/${id}`)
      setSyncStatus('saved')
      setSavedAt({ at: Date.now(), where: 'cloud', reason: 'create' })
      setDirty(false)
    } catch {
      setSyncStatus('error')
      setNotice({ tone: 'error', text: 'Could not save to the cloud. Is the API running on localhost:8787?' })
    }
  }

  const reloadFromServer = async () => {
    if (!projectId) return
    const r = await api.read(projectId)
    if (!r.ok) return
    const data = await r.json()
    isInitialSync.current = true
    load(migrate(data.state).state)
    setServerVersion(data.version)
    setSyncStatus('saved')
  }

  const download = () => {
    const { text } = generateFile(state, derived)
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'DESIGN.md'; a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => {
      const result = parseFile(String(ev.target.result))
      /* A failed import leaves the current document untouched. */
      if (!result.ok) { setNotice({ tone: 'error', text: `Could not import ${f.name}. ${result.error}` }); return }
      load(result.state)
      setNotice(result.warnings.length
        ? { tone: 'warn', text: `Imported ${f.name}. ${result.warnings.join(' ')}` }
        : { tone: 'success', text: `Imported ${f.name}.` })
    }
    reader.onerror = () => setNotice({ tone: 'error', text: `Could not read ${f.name}.` })
    reader.readAsText(f)
  }

  const swatches = [derived.roles.light.accent, derived.roles.light.bg, derived.roles.light.surface, derived.roles.light.text, derived.roles.light.success, derived.roles.light.warning, derived.roles.light.danger].filter(isValidColor)

  const Panel = TABS.find(t => t.id === tab)?.Panel ?? MetaTab

  return (
    <>
      <style>{APP_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        <header style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '0 20px', height: 50, borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 12.5, color: '#0b0b0e', flexShrink: 0 }}>D</div>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>
              design<span style={{ color: 'var(--muted)', fontWeight: 400 }}>.md</span>
            </span>
            <TitleField name={state.meta.name}
              onCommit={next => set(s => ({ ...s, meta: { ...s.meta, name: next } }), 'meta:name')} />
            <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
              {swatches.map((hex, i) => <div key={i} className="swatch" style={{ width: 12, height: 12, background: hex, cursor: 'default' }} />)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            <SyncBadge status={syncStatus} />
            {syncStatus === 'conflict' && (
              <button className="btn-ghost" onClick={reloadFromServer} style={{ padding: '6px 10px', color: 'var(--danger)', borderColor: 'rgba(222,92,92,.4)' }}>Reload</button>
            )}
            {!projectId ? (
              <button className="btn-ghost" onClick={saveToCloud} style={{ padding: '6px 11px' }}>Save to cloud</button>
            ) : (
              <button className="btn-ghost" style={{ padding: '6px 11px', color: linkCopied ? 'var(--success)' : 'var(--muted)' }}
                onClick={() => { navigator.clipboard.writeText(window.location.href); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800) }}>
                {linkCopied ? 'Link copied' : 'Copy share URL'}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".md,.txt,.markdown" onChange={importFile} style={{ display: 'none' }} />
            <button className="btn-ghost" onClick={() => setShowNew(true)} style={{ padding: '6px 11px' }}>New</button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} style={{ padding: '6px 11px' }}><Upload />Import</button>
            <button className="btn-ghost" onClick={() => setShowFile(true)} style={{ padding: '6px 11px' }}>Preview file</button>
            <button className="btn-primary" onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Download />Export</button>
          </div>
        </header>

        <MacroBar onOpenContrast={() => setTab('roles')} uiSpeed={uiSpeed} setUiSpeed={setUiSpeed} />

        {notice && (
          <div style={{ padding: '9px 20px', background: 'var(--surf)', borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>
            <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Banner>
          </div>
        )}

        {/* Grid items default to min-height:auto, which stops them shrinking
            below their content — so an overflowing panel pushes the row taller
            instead of scrolling. minHeight:0 on each child is what makes the
            `overflow: auto` below actually engage. */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(420px, 46%) 1fr', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: '1px solid var(--bdr)' }}>
            <TabStrip tabs={TABS} active={tab} onSelect={setTab}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="btn-ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
                    style={{ padding: '5px 9px', gap: 5, color: canUndo ? 'var(--accent)' : undefined, borderColor: canUndo ? 'rgba(220,144,85,.35)' : undefined }}>
                    <Undo />Undo
                  </button>
                  <button className="btn-ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
                    style={{ padding: '5px 9px', color: canRedo ? 'var(--text-dim)' : undefined }}>
                    <Undo flip />
                  </button>
                  {/* Confirms in place: fills, swaps to a tick and reads
                      "Saved" for a moment, so a manual save is unambiguous. */}
                  <button
                    onClick={() => persist('manual').then(ok => {
                      if (!ok) return
                      setDirty(false)
                      setJustSaved(true)
                      clearTimeout(justSavedTimer.current)
                      justSavedTimer.current = setTimeout(() => setJustSaved(false), 2200)
                    })}
                    title={justSaved ? 'Saved' : dirty ? 'Unsaved changes — click to save now' : 'Everything is saved'}
                    className={justSaved ? 'btn-primary' : 'btn-ghost'}
                    style={{
                      padding: '5px 11px', gap: 6, display: 'inline-flex', alignItems: 'center',
                      minWidth: 88, justifyContent: 'center',
                      ...(justSaved
                        ? { background: 'var(--success)', color: '#0b0b0e' }
                        : { color: dirty ? 'var(--warn)' : 'var(--muted)', borderColor: dirty ? 'rgba(216,164,65,.4)' : 'var(--bdr)' }),
                      transition: 'background var(--t) var(--ease), color var(--t) var(--ease), border-color var(--t) var(--ease)',
                    }}>
                    {justSaved
                      ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      : <Save />}
                    {justSaved ? 'Saved' : 'Save'}
                    {!justSaved && dirty && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
                  </button>
                </div>
              } />
            <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 20px 64px' }}>
              <Panel inspect={inspect?.kind === ({ components: 'component', roles: 'role', type: 'type' }[tab]) ? inspect : null} />
            </main>
          </div>

          {/* Route by target kind: components, colour roles and text styles
              each live on their own tab. */}
          <Canvas onInspect={t => {
            setInspect({ entry: t.target, kind: t.kind, at: Date.now() })
            setTab({ component: 'components', role: 'roles', type: 'type' }[t.kind] ?? 'components')
          }} />
        </div>
      </div>

      <SaveFlash savedAt={savedAt} />

      {showFile && <FileModal onClose={() => setShowFile(false)} />}
      {showNew && (
        <NewDocModal
          onClose={() => setShowNew(false)}
          onCreate={(presetId, name) => {
            const fresh = applyPreset(presetId, createInitialState())
            load({ ...fresh, meta: { ...fresh.meta, name: name.trim() || fresh.meta.name } })
            /* A new document is not the old cloud project — detach, or the
               next autosave would overwrite it. */
            setProjectId(null); setEditToken(null); setServerVersion(null); setSyncStatus('local')
            if (window.location.pathname.startsWith('/p/')) window.history.pushState({}, '', '/')
            try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
            setShowNew(false)
            setNotice(null)
          }} />
      )}
    </>
  )
}

export default function App() {
  return (
    <StoreProvider initial={createInitialState()}>
      <Shell />
    </StoreProvider>
  )
}
