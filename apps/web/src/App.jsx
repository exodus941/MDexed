/* Application shell: header, macro bar, panel column, preview column.
   All document state lives in the store; this file only wires things together
   and owns cloud sync. */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { StoreProvider, useStore } from './state/store.jsx'
import { createInitialState, MACROS, DEFAULT_MACROS, CONTRAST_PAIRS } from './state/schema.js'
import { PRESETS, applyPreset } from './state/presets.js'
import { check } from './color/contrast.js'
import { migrate } from './state/migrate.js'
import { nextBuild, describeBuild, isBuild } from './state/build.js'
import { generateFile, validate } from './emit/designmd.js'
import { parseFile } from './emit/parse.js'
import { isValidColor } from './color/convert.js'
import { APP_CSS } from './ui/theme.js'
import { loadDocumentFonts } from './type/fonts.js'
import { Banner, ResetButton, CloseButton } from './ui/controls.jsx'
import CrossFade from './ui/CrossFade.jsx'
import ImportModal, { IMPORT_FORMATS } from './ui/ImportModal.jsx'
import Canvas, { SURFACES } from './preview/Canvas.jsx'
import ColorPanel from './panels/ColorPanel.jsx'
import RolesPanel from './panels/RolesPanel.jsx'
import TypographyPanel from './panels/TypographyPanel.jsx'
import ComponentsPanel from './panels/ComponentsPanel.jsx'
import DirectivesPanel from './panels/DirectivesPanel.jsx'
import AccessPanel from './panels/AccessPanel.jsx'
import { LayoutPanel, ShapePanel, DepthPanel, MotionPanel } from './panels/system.jsx'
import { MetaTab, RationaleTab } from './panels/basics.jsx'
import HistoryPanel from './panels/HistoryPanel.jsx'

/* ── API ── */
const API_BASE = '/api/v1'
const TOKEN_KEY = 'design-md:tokens'
const DRAFT_KEY = 'design-md:draft'
const DRAFT_AT_KEY = 'design-md:draft-at'
/* The document from the last session, rotated aside at boot so a fresh start
   never destroys it. Exactly one generation is kept. */
const PREV_KEY = 'design-md:previous'
const PREV_AT_KEY = 'design-md:previous-at'
const ANIM_KEY = 'design-md:ui-anim'
const HUE_KEY = 'design-md:ui-hue'

/* A document nobody has touched. Compared as text against a freshly created
   one — `createInitialState()` is deterministic, with fixed ids and no
   timestamps, so this is exact rather than heuristic. */
const PRISTINE_DOC = JSON.stringify(createInitialState())
const isPristineDoc = raw => raw === PRISTINE_DOC

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

/* Where this document lives. A readout, not a control.
 *
 * It used to say "Local only" inside a bordered pill that looked exactly like
 * every button beside it, so the obvious move was to click it and nothing
 * happened. Now it reads as status: a coloured dot, no border, no pill, and
 * wording that states a fact rather than naming a mode. */
const SyncBadge = ({ status }) => {
  const cfg = {
    local:    { fg: 'var(--muted)',   dot: 'var(--dim)',     txt: 'On this device' },
    saving:   { fg: 'var(--accent)',  dot: 'var(--accent)',  txt: 'Saving…' },
    saved:    { fg: 'var(--success)', dot: 'var(--success)', txt: 'In the cloud' },
    readonly: { fg: 'var(--muted)',   dot: 'var(--dim)',     txt: 'Read-only' },
    conflict: { fg: 'var(--danger)',  dot: 'var(--danger)',  txt: 'Conflict' },
    error:    { fg: 'var(--danger)',  dot: 'var(--danger)',  txt: 'Sync failed' },
    offline:  { fg: 'var(--muted)',   dot: 'var(--warn)',    txt: 'Offline' },
  }[status] ?? { fg: 'var(--muted)', dot: 'var(--dim)', txt: status }
  const help = {
    local: 'Saved in this browser only. Use Save to Cloud to sync it.',
    saving: 'Writing to the cloud…',
    saved: 'Synced. Also kept in this browser.',
    readonly: 'Opened from a share link — changes stay local.',
    conflict: 'The cloud copy changed since you loaded this one.',
    error: 'The last sync failed. Your work is still safe locally.',
    offline: 'No connection. Everything is being kept locally.',
  }[status] ?? 'Where this document is stored'
  return (
    <span title={help} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      fontSize: 11, color: cfg.fg, cursor: 'default',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.txt}
    </span>
  )
}

/* The spec version the exported file will carry. Sits next to the storage
   readout because both answer the same question — what am I looking at. */
/* MDesigner's own build, beside the wordmark because it identifies the tool.
 *
 * Distinct from the chip on the right, which is the *document's* build — the
 * two answer different questions ("which MDesigner am I running" versus
 * "which revision of this design system is this"), so they sit at opposite
 * ends of the header rather than beside each other.
 *
 * Baked in by vite.config.js at compile time; `dev` when the dev server is
 * serving, since nothing was built. */
const AppBuild = () => {
  const { version, sha } = __APP_BUILD__
  const dev = version === 'dev'
  return (
    <span title={dev
      ? 'Running from the dev server — no build was produced'
      : `MDesigner build ${version}${sha ? ` · ${sha}` : ''}`}
      style={{
        fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--dim)',
        letterSpacing: '.02em', whiteSpace: 'nowrap', cursor: 'default',
        alignSelf: 'flex-start', marginTop: 4,
      }}>
      {version}
    </span>
  )
}

/* The build this document last produced.
 *
 * Not "the version you typed" — the version is stamped by exporting, because
 * that is when a file exists to be versioned. Until then there is nothing to
 * name and the chip says so instead of inventing a number. */
const VersionChip = ({ version }) => {
  const v = String(version ?? '').trim()
  const built = isBuild(v)
  return (
    <span title={
      built ? `${describeBuild(v)} — the counter advances each time you export`
        : v ? `Version "${v}" was typed by hand. Exporting replaces it with a build number.`
        : 'Not exported yet. The first export stamps a build number.'
    } style={{
      fontSize: 10.5, fontFamily: 'var(--mono)', color: built ? 'var(--muted)' : 'var(--dim)',
      whiteSpace: 'nowrap', cursor: 'default',
    }}>
      {built ? v : v || 'unbuilt'}
    </span>
  )
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

/* Editor hue. Rotates every neutral in the chrome — surfaces, borders, text,
   scrollbars — at its own saturation and lightness, so the tonal structure is
   untouched and only the cast changes. The semantic colours are deliberately
   excluded; see the `--ui-h` block in theme.js.

   Sits beside the animation speed because both configure the tool rather than
   the design, and neither belongs in the exported file. */
const UI_HUE_DEFAULT = 208

function UiHueControl({ value, onChange }) {
  const [draft, setDraft] = useState(null)
  const changed = value !== UI_HUE_DEFAULT

  const commit = raw => {
    setDraft(null)
    const n = parseFloat(String(raw).replace(/[^\d.]/g, ''))
    /* Wrap rather than clamp — hue is a circle, and typing 370 meaning 10 is
       a reasonable thing to do. */
    if (Number.isFinite(n)) onChange(((Math.round(n) % 360) + 360) % 360)
  }

  /* Same 3% catchment the token macros use: dragging near the default lands
     exactly on it, so returning to baseline doesn't need a steady hand.
     Typing is exempt — an explicit 205 means 205. */
  const snap = v => (Math.abs(v - UI_HUE_DEFAULT) <= 360 * 0.03 ? UI_HUE_DEFAULT : v)

  return (
    <div style={{ width: 156, flexShrink: 0 }} title="The hue of the editor's own chrome. Saturation and lightness are untouched — only the cast changes.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <span style={{ fontSize: 10.5, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>UI Hue</span>
        <ResetButton onClick={() => onChange(UI_HUE_DEFAULT)} disabled={!changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
        {/* A sample of the surface the value produces, so the number means
            something before you drag it. */}
        <span style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          background: `hsl(${value} 14% 15%)`, border: '1px solid var(--bdr2)',
        }} />
        <input
          value={draft ?? `${value}°`}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 5px',
            textAlign: 'right', color: 'var(--text-dim)',
          }} />
      </div>
      {/* The track is the hue circle and the thumb is the hue you are on, so
          the control states its own range and its own value. `--hue` is read
          by the thumb rule in theme.js. */}
      <input type="range" className="hue-slider" min={0} max={360} step={1} value={value}
        onChange={e => onChange(snap(Number(e.target.value)))}
        onDoubleClick={() => onChange(UI_HUE_DEFAULT)}
        style={{ '--hue': value }} />
    </div>
  )
}

function MacroBar({ onOpenContrast, uiSpeed, setUiSpeed, uiHue, setUiHue }) {
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
          borderRadius: 6, padding: '4px 10px', fontSize: 11, fontFamily: 'var(--mono)', marginBottom: 1,
        }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
        {failing ? `${failing} contrast` : 'Contrast OK'}
      </button>

      <button className="btn-ghost" onClick={reset} disabled={!anyChanged} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0, marginBottom: 1 }}>Reset All</button>

      {/* Pushed right so it sits above the preview pane — it tunes the editor,
          not the design, and the separation should be visible. */}
      <div style={{ marginLeft: 'auto', paddingLeft: 20, display: 'flex', alignItems: 'flex-end', gap: 14, flexShrink: 0 }}>
        <UiSpeedControl value={uiSpeed} onChange={setUiSpeed} />
        <UiHueControl value={uiHue} onChange={setUiHue} />
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
          <button className="btn-ghost" style={{ padding: '4px 10px' }}
            onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}>
            <Copy />{copied ? 'Copied' : 'Copy'}
          </button>
          <CloseButton onClick={onClose} label="Close" size={11} />
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
      pointerEvents: 'none',
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

/* Pixels per 16ms tick at the inner and outer edges of a chevron, so roughly
   84 to 920 px/s. The floor is slow enough to walk a tab into place one at a
   time; the ceiling crosses the whole strip in well under a second. An eleven
   to one spread sounds extreme written down, and reads as one control rather
   than two, because the position you pick is the speed you get. */
const SCROLL_SLOW = 1.35
const SCROLL_FAST = 14.7

/* Declared here rather than inside TabStrip.
 *
 * A component defined in a render body is a new component *type* on every
 * render, so React unmounts and remounts it rather than updating it. That was
 * survivable while these were click-only. It stopped being survivable once
 * they scrolled on hover: the button under the cursor was replaced mid-scroll,
 * and the pointerleave that should have stopped it fired on a node that no
 * longer existed. The scroll ran on with the cursor somewhere else entirely. */
/*
 * Three states, because a control must not vanish from under the cursor.
 *
 *   live     there is somewhere to go; hovering scrolls
 *   spent    the end has been reached, but the pointer is still here, so it
 *            stays put and dims instead of disappearing mid-gesture
 *   leaving  the pointer has gone; fade out and collapse to nothing
 *
 * The middle state is the whole point. Reaching the end used to unmount the
 * button instantly, which yanked it out from under the cursor and snapped
 * 40px of tabs sideways in the same frame. Now the end of travel is just a
 * change of appearance, and the layout only moves once you have stopped
 * pointing at the thing that is about to move.
 *
 * The exit animates `width` rather than opacity alone: collapsing the flex
 * item is what lets the tabs slide into the space, and doing it in the same
 * keyframe as the fade means the gap closes exactly as the button goes.
 */
function Chevron({ dir, state, onEnter, onLeave, onClick }) {
  const spent = state === 'spent'
  return (
    <button data-chevron={dir} title={dir < 0 ? 'Scroll left' : 'Scroll right'}
      onClick={spent ? undefined : onClick} disabled={spent}
      onPointerEnter={spent ? undefined : onEnter} onPointerLeave={onLeave} onPointerCancel={onLeave}
      className={state === 'leaving' ? 'chev chev-out' : 'chev'}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: dir < 0 ? 'flex-start' : 'flex-end',
        width: 40, height: '100%', border: 'none',
        cursor: spent ? 'default' : 'pointer',
        opacity: state === 'leaving' ? 0 : spent ? 0.3 : 1,
        color: 'var(--muted)', padding: dir < 0 ? '0 0 0 10px' : '0 10px 0 0',
        /* Wide hit area, with a fade so tabs slide under it rather than
           colliding with a hard edge. */
        background: `linear-gradient(to ${dir < 0 ? 'right' : 'left'}, var(--surf) 55%, transparent)`,
      }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir < 0 ? 'rotate(180deg)' : 'none' }}>
        <polyline points="9 6 15 12 9 18" />
      </svg>
    </button>
  )
}

function TabStrip({ tabs, active, onSelect, right }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const [menuOpen, setMenuOpen] = useState(false)
  /* What each chevron is doing, which lags `edges` on purpose: null, 'live',
     'spent' or 'leaving'. See the Chevron comment for why. */
  const [phase, setPhase] = useState({ left: null, right: null })
  const [hovered, setHovered] = useState(null)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)

  /* Dismissal, without a click-catching overlay.
   *
   * This used to be a fixed, full-screen div at z-index 70. It caught the
   * outside click, and it also caught the wheel: the cursor was over the
   * editor or the preview, but the event landed on an element that could not
   * scroll, so neither pane moved and the menu just sat there.
   *
   * Listening on the document instead leaves both panes uncovered, so a wheel
   * scrolls the thing under the cursor natively. All this has to do is get
   * out of the way, which is what closing on the same gesture achieves.
   *
   * `passive` on the wheel listener because it never calls preventDefault:
   * the scroll is the browser's to perform, and marking it passive means the
   * browser does not have to wait on this handler before doing it. */
  useEffect(() => {
    if (!menuOpen) return
    const inside = t => menuRef.current?.contains(t) || triggerRef.current?.contains(t)
    const onDown = e => { if (!inside(e.target)) setMenuOpen(false) }
    /* Wheel closes wherever it happens, including over the menu: a list of
       thirteen tabs is not scrollable, so a wheel there is a scroll aimed at
       whatever is behind it. */
    const onWheel = () => setMenuOpen(false)
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('wheel', onWheel, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  /* Only writes state when an edge actually flips.
   *
   * It used to hand back a fresh object every call, which re-rendered the
   * strip on every scroll event. Harmless at one call per wheel tick, not
   * harmless once hover-scrolling calls it sixty times a second: the chevrons
   * remounted on every frame, and the pointerleave that should have stopped
   * the scroll landed on a node that had already been replaced. */
  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const next = {
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    }
    setEdges(prev => (prev.left === next.left && prev.right === next.right ? prev : next))
  }, [])

  /* Drive the phases off the edges and the pointer.
   *
   * The only interesting transition is losing an edge: if the pointer is on
   * that chevron it goes `spent` and holds its place, otherwise it starts
   * leaving immediately. Regaining an edge always goes straight back to
   * `live`, including mid-exit, so scrolling back the other way catches a
   * half-faded chevron rather than waiting for it to finish disappearing. */
  useEffect(() => {
    setPhase(prev => {
      const next = { ...prev }
      for (const side of ['left', 'right']) {
        if (edges[side]) next[side] = 'live'
        else if (prev[side] === 'live' || prev[side] === 'spent') {
          next[side] = hovered === side ? 'spent' : 'leaving'
        }
      }
      return next.left === prev.left && next.right === prev.right ? prev : next
    })
  }, [edges, hovered])

  /* Unmount once the exit has played. The duration is read live rather than
     captured, so turning UI animation off mid-exit doesn't strand a chevron
     at zero width. */
  useEffect(() => {
    const going = ['left', 'right'].filter(s => phase[s] === 'leaving')
    if (!going.length) return
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    const t = setTimeout(() => {
      setPhase(prev => {
        const next = { ...prev }
        for (const s of going) if (next[s] === 'leaving') next[s] = null
        return next.left === prev.left && next.right === prev.right ? prev : next
      })
    }, ms)
    return () => clearTimeout(t)
  }, [phase])

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

  /* ── Hover to scroll ──
   *
   * Pointing at a chevron scrolls for as long as you stay there, rather than
   * making you click once per 160px. The tab strip is a queue you are looking
   * *through*, so the gesture should be "keep going" — clicking repeatedly to
   * travel in one direction is the interaction equivalent of a stuck key.
   *
   * A timer rather than requestAnimationFrame: rAF is throttled whenever the
   * page isn't compositing, which this codebase has already been caught by
   * twice. `behavior: auto` because the steps are small and frequent — smooth
   * scrolling on top of a 16ms tick fights itself and stutters.
   *
   * The timer lives here rather than in `Chevron` because `Chevron` is
   * redefined on every render, so React remounts it each time and any
   * interval it owned would be torn down mid-scroll.
   */
  const scroller = useRef(0)
  /* Pixels per tick, live. Set from the pointer's depth into the chevron so
     the speed can change without restarting the timer. */
  const speed = useRef(SCROLL_SLOW)
  const stopScroll = useCallback(() => { clearInterval(scroller.current); scroller.current = 0 }, [])
  const startScroll = useCallback(dir => {
    stopScroll()
    /* Start slow. The pointermove below corrects within a frame, but without
       this the first tick would inherit whatever speed the other chevron was
       left at. */
    speed.current = SCROLL_SLOW
    scroller.current = setInterval(() => {
      const el = ref.current
      if (!el) return stopScroll()
      el.scrollBy({ left: dir * speed.current, behavior: 'auto' })
      measure()
    }, 16)
  }, [stopScroll, measure])

  /* One listener owns everything that depends on where the pointer is:
     whether to scroll, how fast, and which chevron is being pointed at.
     Splitting those across three handlers means three answers that can
     disagree by a frame.

     It has to be a window listener rather than the button's own
     `pointerleave`. A chevron can leave from under a stationary cursor when
     the strip stops overflowing, the pointer can leave the window entirely,
     and a remount swaps the node any element listener was bound to. All three
     end with the strip scrolling on its own, which is the failure that makes
     this worse than the clicks it replaced. */
  useEffect(() => {
    const check = e => {
      const chevron = e.target?.closest?.('[data-chevron]')
      if (!chevron) { stopScroll(); setHovered(null); return }
      const dir = Number(chevron.dataset.chevron)
      /* Which side, so a chevron that runs out of travel while you are on it
         knows to hold its place rather than disappear mid-gesture. */
      setHovered(dir < 0 ? 'left' : 'right')
      /* Faster the closer you are to the outer edge, which is the direction
         you are travelling. Nudging into the chevron creeps; pushing to the
         edge of the strip runs. */
      const box = chevron.getBoundingClientRect()
      const into = (e.clientX - box.left) / (box.width || 1)
      const t = Math.min(1, Math.max(0, dir < 0 ? 1 - into : into))
      speed.current = SCROLL_SLOW + (SCROLL_FAST - SCROLL_SLOW) * t
    }
    window.addEventListener('pointermove', check, { passive: true })
    window.addEventListener('pointerdown', check, { passive: true })
    const gone = () => { stopScroll(); setHovered(null) }
    document.addEventListener('pointerleave', gone)
    window.addEventListener('blur', gone)
    return () => {
      window.removeEventListener('pointermove', check)
      window.removeEventListener('pointerdown', check)
      document.removeEventListener('pointerleave', gone)
      window.removeEventListener('blur', gone)
      stopScroll()
    }
  }, [stopScroll])

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
        <button ref={triggerRef} onClick={() => setMenuOpen(o => !o)} title="Switch tab"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 0 10px',
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
        <div ref={menuRef} className="anim-pop" style={{
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
      )}

      {phase.left && <Chevron dir={-1} state={phase.left} onEnter={() => startScroll(-1)} onLeave={stopScroll} onClick={() => nudge(-1)} />}
      <div ref={ref} className="no-bar" onScroll={measure}
        style={{ display: 'flex', flex: 1, minWidth: 0, overflowX: 'auto' }}>
        {rest.map(t => (
          <button key={t.id} onClick={() => onSelect(t.id)} style={{
            background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
            padding: '0 12px', fontFamily: 'var(--sans)', fontSize: 12.5, whiteSpace: 'nowrap',
            color: 'var(--muted)', fontWeight: 400,
            borderBottom: '2px solid transparent',
            transition: 'color var(--t) var(--ease)', marginBottom: -1,
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}>{t.label}</button>
        ))}
      </div>
      {phase.right && <Chevron dir={1} state={phase.right} onEnter={() => startScroll(1)} onLeave={stopScroll} onClick={() => nudge(1)} />}
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

/* ── Restore offer ──
   Deliberately a toast and not a modal. Starting fresh is the common case and
   shouldn't need dismissing; the previous session is one click away for the
   times it isn't. Stays until acted on rather than timing out — a restore you
   missed because you were reading is worse than a toast that lingers. */
const ago = at => {
  if (!at) return null
  const mins = Math.round((Date.now() - at) / 60000)
  if (mins < 1) return 'moments ago'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function RestoreToast({ offer, onRestore, onDismiss }) {
  const [leaving, setLeaving] = useState(false)

  const close = after => {
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    setLeaving(true)
    setTimeout(after, ms)
  }

  /* Thirty seconds, then it withdraws the offer quietly.
   *
   * Longer than the notice bar's ten because this one is asking a question
   * rather than reporting something — you have to read it, decide whether you
   * want the old project back, and reach for a button. But it can't sit there
   * forever either: an offer that never expires is a permanent obstruction in
   * the corner of a tool you're trying to work in.
   *
   * Nothing is lost when it goes. The previous document is still in
   * localStorage; this was only the shortcut back to it. */
  useEffect(() => {
    if (!offer || leaving) return
    const t = setTimeout(() => close(onDismiss), 30000)
    return () => clearTimeout(t)
  }, [offer, leaving, onDismiss])

  if (!offer) return null
  const when = ago(offer.at)

  return (
    <div className={leaving ? 'anim-fall' : 'anim-rise'} style={{
      display: 'flex', alignItems: 'center', gap: 11,
      background: 'var(--surf2)', border: '1px solid var(--bdr2)',
      borderRadius: 9, padding: '9px 10px 9px 11px', maxWidth: 400,
      boxShadow: '0 10px 30px rgba(0,0,0,.5)',
    }}>
      {/* A restore glyph, in the success green — the one strong colour in the
          editor chrome, so the eye finds this against a bright preview. */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(90,173,128,.16)', color: 'var(--success)',
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v6h6" />
          <path d="M3.5 14a9 9 0 1 0 2.1-9.4L3 7" />
        </svg>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text)' }}>
          Started a new project.
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          “{offer.name}” is saved{when ? ` from ${when}` : ''}.
        </div>
      </div>
      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, flexShrink: 0 }}
        onClick={() => close(onRestore)}>
        Restore
      </button>
      <CloseButton onClick={() => close(onDismiss)} size={10} />
    </div>
  )
}

/* ── The notice bar ──
 *
 * Ten seconds, then it fades out on its own. A notice that stays until
 * clicked becomes furniture — you stop reading it, and the next one looks
 * like the last one still being there.
 *
 * Hovering pauses the clock. Ten seconds is not long for an error message
 * you are still reading, and the cost of getting that wrong is that the
 * explanation for a failed import vanishes mid-sentence.
 *
 * Both the timer and the fade go through the animation setting: with UI
 * animation off, it disappears the moment the ten seconds are up rather than
 * animating out over a duration that has been set to zero. */
function NoticeBar({ notice, onClose }) {
  const [leaving, setLeaving] = useState(false)
  const [held, setHeld] = useState(false)

  useEffect(() => { setLeaving(false) }, [notice])

  useEffect(() => {
    if (!notice || held) return
    const t = setTimeout(() => setLeaving(true), 10000)
    return () => clearTimeout(t)
  }, [notice, held])

  useEffect(() => {
    if (!leaving) return
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  if (!notice) return null
  return (
    <div className={leaving ? 'anim-fade-out' : 'anim-fade'}
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
      style={{ padding: '9px 20px', background: 'var(--surf)', borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>
      <Banner tone={notice.tone} onDismiss={() => setLeaving(true)}>{notice.text}</Banner>
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
          <CloseButton onClick={onClose} label="Close" size={11} />
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
                  display: 'flex', alignItems: 'center', gap: 11, padding: '8px 16px', textAlign: 'left',
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
  { id: 'access',     label: 'Access',     Panel: AccessPanel },
  { id: 'rationale',  label: 'Rationale',  Panel: RationaleTab },
  { id: 'history',    label: 'History',    Panel: HistoryPanel },
]

/* Which kind of thing each tab's rows are, so a jump from anywhere can hand
   the destination panel something it recognises. One table, one place to be
   wrong. */
const TAB_KIND = { components: 'component', roles: 'role', type: 'type' }
const KIND_TAB = { component: 'components', role: 'roles', type: 'type' }

function Shell() {
  const { state, derived, set, load, undo, redo, canUndo, canRedo } = useStore()
  const [tab, setTab] = useState('colors')
  const [showFile, setShowFile] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  /* Carries a timestamp so clicking the same element twice re-triggers the
     jump rather than being deduplicated as an unchanged value. */
  const [inspect, setInspect] = useState(null)
  /* A jump from one panel to a row on another. The accessibility audit is the
     first caller: reading that `checkbox` is 16px and then hunting for the
     checkbox across thirteen tabs is how audits get abandoned. */
  const navigate = useCallback((toTab, entry) => {
    setTab(toTab)
    setInspect(entry && TAB_KIND[toTab] ? { entry, kind: TAB_KIND[toTab], at: Date.now() } : null)
  }, [])
  /* The previous session's document, offered rather than loaded. */
  const [restorable, setRestorable] = useState(null)
  /* Owned here rather than in Canvas so the HTML export can render it. */
  const [surface, setSurface] = useState('dashboard')
  const [uiSpeed, setUiSpeed] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(ANIM_KEY), 10)
      return Number.isFinite(saved) && saved >= 0 && saved <= UI_ANIM_MAX ? saved : UI_ANIM_DEFAULT
    } catch { return UI_ANIM_DEFAULT }
  })
  /* Kept in localStorage rather than in the document: it's a preference about
     the tool, and it should follow you between projects rather than travelling
     inside a file you hand to someone else. */
  const [uiHue, setUiHue] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(HUE_KEY), 10)
      return Number.isFinite(saved) && saved >= 0 && saved <= 360 ? saved : UI_HUE_DEFAULT
    } catch { return UI_HUE_DEFAULT }
  })

  /* The document's own typefaces, requested here rather than in the Typography
     panel. The preview renders on every tab, so panel-scoped loading meant the
     mock screens spent most of their life showing a fallback face — the one
     thing a type preview must never do. The Typography panel re-requests the
     same families with their full variable-axis ranges once the catalogue has
     loaded; `loadFont` upgrades the existing link rather than duplicating it. */
  useEffect(() => { loadDocumentFonts(state.type.families) }, [state.type.families])

  /* Drives `--t`, which every editor transition reads. The preview keeps its
     own durations — those are the user's motion tokens, not the tool's. */
  useEffect(() => {
    document.documentElement.style.setProperty('--t', `${uiSpeed}ms`)
    document.documentElement.classList.toggle('no-anim', uiSpeed === 0)
    try { localStorage.setItem(ANIM_KEY, String(uiSpeed)) } catch { /* ignore */ }
  }, [uiSpeed])

  /* Drives `--ui-h`, which every chrome neutral is expressed against. */
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-h', String(uiHue))
    try { localStorage.setItem(HUE_KEY, String(uiHue)) } catch { /* ignore */ }
  }, [uiHue])
  const [notice, setNotice] = useState(null)
  const [projectId, setProjectId] = useState(null)
  const [editToken, setEditToken] = useState(null)
  const [serverVersion, setServerVersion] = useState(null)
  const [syncStatus, setSyncStatus] = useState('local')
  const [linkCopied, setLinkCopied] = useState(false)
  const isInitialSync = useRef(true)
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
        localStorage.setItem(DRAFT_AT_KEY, String(Date.now()))
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

  /* Opening the app gives you a new document, not whatever you left behind.
     The previous session isn't discarded, though — it's rotated aside and
     offered back through a toast.

     The rotation is guarded: an untouched document never displaces the stored
     one. Without that, opening the app twice without editing would quietly
     overwrite real work with a pristine default, which is precisely the data
     loss this flow exists to avoid. */
  useEffect(() => {
    if (window.location.pathname.startsWith('/p/')) return
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft && !isPristineDoc(draft)) {
        localStorage.setItem(PREV_KEY, draft)
        localStorage.setItem(PREV_AT_KEY, localStorage.getItem(DRAFT_AT_KEY) ?? '')
      }
      localStorage.removeItem(DRAFT_KEY)

      const prev = localStorage.getItem(PREV_KEY)
      if (!prev || isPristineDoc(prev)) return
      const at = Number(localStorage.getItem(PREV_AT_KEY))
      setRestorable({
        raw: prev,
        name: JSON.parse(prev)?.meta?.name?.trim() || 'Untitled',
        at: Number.isFinite(at) && at > 0 ? at : null,
      })
    } catch { /* corrupt draft — start fresh rather than crash */ }
  }, [])

  const restorePrevious = useCallback(() => {
    if (!restorable) return
    try {
      const { state: migrated, warning } = migrate(JSON.parse(restorable.raw))
      load(migrated)
      if (warning) setNotice({ tone: 'warn', text: warning })
    } catch {
      setNotice({ tone: 'error', text: 'That saved project could not be read.' })
    }
    setRestorable(null)
  }, [restorable, load])

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

  const saveAs = (text, filename, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  /* Stamp the build, then emit against the stamped state.
   *
   * `set` is async, so the state in scope is still the old one when this
   * returns — generating from it would ship the previous build number in a
   * file the header claims is the new one. So the version is computed once
   * and threaded into both. */
  const stampBuild = () => {
    const version = nextBuild(state.meta.version)
    set(s => ({ ...s, meta: { ...s.meta, version } }), 'meta:version')
    return { ...state, meta: { ...state.meta, version } }
  }

  const download = () => {
    const stamped = stampBuild()
    saveAs(generateFile(stamped, derived).text, 'DESIGN.md', 'text/markdown')
  }

  /* The surface as a standalone page, for handing to someone who has the
     DESIGN.md but not this app.

     Rendered fresh through `renderToStaticMarkup` rather than lifted out of
     the live DOM: passing no `onInspect` means `inspectProps` contributes
     nothing, so the output carries no `data-cmp` attributes, no click
     handlers and none of React's bookkeeping — just the markup a developer
     would have written. The renderer is imported on demand so it stays out of
     the main bundle. */
  const [exportingHtml, setExportingHtml] = useState(false)
  const exportPreviewHtml = async () => {
    setExportingHtml(true)
    try {
      const [{ renderToStaticMarkup }, { previewHtml, slugify }] = await Promise.all([
        import('react-dom/server'),
        import('./emit/html.js'),
      ])
      const entry = SURFACES.find(s => s.id === surface) ?? SURFACES[0]
      const markup = renderToStaticMarkup(
        <div className="dmd-frame"><div className="dmd"><entry.Component layout={derived.componentLayout} /></div></div>
      )
      const html = previewHtml({ state, derived, markup, surface: entry.label, mode: state.color.mode })
      saveAs(html, `${slugify(state.meta.name)}-${entry.id}.html`, 'text/html')
    } catch {
      setNotice({ tone: 'error', text: 'Could not build the HTML preview.' })
    } finally {
      setExportingHtml(false)
    }
  }

  /* Everything a developer needs, in one archive: the file for the agent, the
     token formats a build can enforce, and every surface as a page they can
     open and read the markup of. Same `derive()` behind all of it, so nothing
     in the zip can contradict anything else in it. */
  const [packaging, setPackaging] = useState(false)
  const exportPackage = async () => {
    setPackaging(true)
    try {
      const [{ renderToStaticMarkup }, html, tokens, { zip }] = await Promise.all([
        import('react-dom/server'),
        import('./emit/html.js'),
        import('./emit/tokens.js'),
        import('./emit/zip.js'),
      ])
      /* One stamp for the whole package, so the DESIGN.md, the README and
         every token file in the zip name the same build. */
      const stamped = stampBuild()
      const slug = html.slugify(stamped.meta.name)
      const files = {
        'README.md': tokens.packageReadme(stamped),
        'DESIGN.md': generateFile(stamped, derived).text,
        'tokens.css': tokens.tokensCss(stamped, derived),
        'tailwind.config.js': tokens.tailwindPreset(stamped, derived),
        'tokens.json': tokens.tokensJson(stamped, derived),
      }
      for (const s of SURFACES) {
        const markup = renderToStaticMarkup(
          <div className="dmd-frame"><div className="dmd"><s.Component layout={derived.componentLayout} /></div></div>
        )
        files[`html-examples/${s.id}.html`] =
          html.previewHtml({ state: stamped, derived, markup, surface: s.label, mode: stamped.color.mode })
      }
      const url = URL.createObjectURL(zip(files))
      const a = document.createElement('a')
      a.href = url; a.download = `${slug}-design-package.zip`; a.click()
      URL.revokeObjectURL(url)
      setSavedAt({ at: Date.now(), where: `a package of ${Object.keys(files).length} files`, reason: 'export' })
    } catch {
      setNotice({ tone: 'error', text: 'Could not build the design package.' })
    } finally {
      setPackaging(false)
    }
  }

  /* Seeds only, because seeds are what everything else generates from — set
     those and the scales, roles and every component follow. Writing further
     downstream would paste in values that no longer track anything. */
  const applyCssImport = ({ seeds, family, spacingBase, radiusBase, fontBase }) => {
    set(s => {
      const next = { ...s }
      if (seeds && Object.keys(seeds).length) {
        next.color = { ...s.color, seeds: s.color.seeds.map(x => seeds[x.name] ? { ...x, hex: seeds[x.name] } : x) }
      }
      if (family) {
        next.type = { ...s.type, families: { ...s.type.families, body: { family, category: 'sans-serif' } } }
      }
      if (fontBase) next.type = { ...(next.type ?? s.type), base: fontBase }
      if (spacingBase) next.space = { ...s.space, base: spacingBase }
      if (radiusBase) next.radius = { ...s.radius, base: radiusBase }
      return next
    }, 'css-import')
    setNotice({ tone: 'info', text: 'Imported into the seeds. Everything downstream regenerated — undo if it isn’t what you wanted.' })
  }

  /* The modal has already read the text, so this only has to parse it. A
     failed parse leaves the current document untouched — the whole point of
     doing the work here rather than optimistically loading and rolling back. */
  const openDocument = (text, label) => {
    const result = parseFile(text)
    if (!result.ok) { setNotice({ tone: 'error', text: `Could not import ${label}. ${result.error}` }); return }
    load(result.state)
    setNotice(result.warnings.length
      ? { tone: 'warn', text: `Imported ${label}. ${result.warnings.join(' ')}` }
      : { tone: 'success', text: `Imported ${label}.` })
  }

  const swatches = [derived.roles.light.accent, derived.roles.light.bg, derived.roles.light.surface, derived.roles.light.text, derived.roles.light.success, derived.roles.light.warning, derived.roles.light.danger].filter(isValidColor)

  const Panel = TABS.find(t => t.id === tab)?.Panel ?? MetaTab

  return (
    <>
      <style>{APP_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        <header style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '0 20px', height: 50, borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
            {/* Two letters in the same box the single D had, so the mark
                keeps its size — tighter tracking rather than a smaller face,
                which would make it read as secondary next to the wordmark. */}
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 11.5, letterSpacing: '-0.04em', color: 'var(--bg)', flexShrink: 0 }}>MD</div>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>
              MD<span style={{ color: 'var(--muted)', fontWeight: 400 }}>esigner</span>
            </span>
            <AppBuild />
            <TitleField name={state.meta.name}
              onCommit={next => set(s => ({ ...s, meta: { ...s.meta, name: next } }), 'meta:name')} />
            <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
              {swatches.map((hex, i) => <div key={i} className="swatch" style={{ width: 12, height: 12, background: hex, cursor: 'default' }} />)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {/* Two readouts, then the controls. Tighter gap between them than
                to the buttons, so they group as one unit rather than reading
                as two more things to click. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 2 }}>
              <VersionChip version={state.meta.version} />
              <SyncBadge status={syncStatus} />
            </div>
            {syncStatus === 'conflict' && (
              <button className="btn-ghost" onClick={reloadFromServer} style={{ padding: '6px 12px', color: 'var(--danger)', borderColor: 'rgba(222,92,92,.4)' }}>Reload</button>
            )}
            {!projectId ? (
              <button className="btn-ghost" onClick={saveToCloud} style={{ padding: '6px 12px' }}>Save to Cloud</button>
            ) : (
              <button className="btn-ghost" style={{ padding: '6px 12px', color: linkCopied ? 'var(--success)' : 'var(--muted)' }}
                onClick={() => { navigator.clipboard.writeText(window.location.href); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800) }}>
                {linkCopied ? 'Link copied' : 'Copy share URL'}
              </button>
            )}
            <button className="btn-ghost" onClick={() => setShowNew(true)} style={{ padding: '6px 12px' }}>New</button>
            {/* One door for anything that already exists — a DESIGN.md to open
                or a stylesheet to sample. The modal works out which. */}
            <button className="btn-ghost" onClick={() => setShowImport(true)} style={{ padding: '6px 12px' }}
              title={IMPORT_FORMATS}><Upload />Import Reference</button>
            <button className="btn-ghost" onClick={() => setShowFile(true)} style={{ padding: '6px 12px' }}>Preview design.md</button>
            <button className="btn-outline" onClick={exportPreviewHtml} disabled={exportingHtml}
              title={`Save the ${(SURFACES.find(s => s.id === surface) ?? SURFACES[0]).label} surface as a standalone HTML page`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Download />{exportingHtml ? 'Building…' : 'Export Preview (HTML)'}
            </button>
            <button className="btn-primary" onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Download />Export design.md</button>
            <button className="btn-package" onClick={exportPackage} disabled={packaging}
              title="DESIGN.md, tokens.css, a Tailwind preset, tokens.json and every surface as HTML — one zip"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Download />{packaging ? 'Packaging…' : 'Export Payload'}
            </button>
          </div>
        </header>

        <MacroBar onOpenContrast={() => setTab('roles')} uiSpeed={uiSpeed} setUiSpeed={setUiSpeed} uiHue={uiHue} setUiHue={setUiHue} />

        <NoticeBar notice={notice} onClose={() => setNotice(null)} />

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
                    style={{ padding: '4px 10px', gap: 5, color: canUndo ? 'var(--accent)' : undefined, borderColor: canUndo ? 'rgba(220,144,85,.35)' : undefined }}>
                    <Undo />Undo
                  </button>
                  <button className="btn-ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
                    style={{ padding: '4px 10px', color: canRedo ? 'var(--text-dim)' : undefined }}>
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
                      padding: '4px 10px', gap: 6, display: 'inline-flex', alignItems: 'center',
                      minWidth: 88, justifyContent: 'center',
                      ...(justSaved
                        ? { background: 'var(--success)', color: 'var(--bg)' }
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
              <CrossFade id={tab}>
                <Panel inspect={inspect?.kind === TAB_KIND[tab] ? inspect : null} onNavigate={navigate} />
              </CrossFade>
            </main>
          </div>

          {/* Route by target kind: components, colour roles and text styles
              each live on their own tab. */}
          <Canvas surface={surface} setSurface={setSurface} onInspect={t => {
            setInspect({ entry: t.target, kind: t.kind, at: Date.now() })
            setTab(KIND_TAB[t.kind] ?? 'components')
          }} />
        </div>
      </div>

      {/* One bottom-right stack rather than two independently positioned
          toasts. The restore offer appears at boot and the save flash fires
          ~600ms later on the first autosave, so anchoring both to the same
          corner separately would overlap them on every cold start. */}
      <div style={{
        position: 'fixed', right: 18, bottom: 16, zIndex: 900,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
        pointerEvents: 'none',
      }}>
        {/* Save confirmation on top, restore offer beneath it. The save flash
            is transient and its own arrival is the message; the restore offer
            waits to be acted on, so it takes the lower, calmer slot. */}
        <SaveFlash savedAt={savedAt} />
        {restorable && (
          <div style={{ pointerEvents: 'auto' }}>
            <RestoreToast offer={restorable} onRestore={restorePrevious} onDismiss={() => setRestorable(null)} />
          </div>
        )}
      </div>

      {showFile && <FileModal onClose={() => setShowFile(false)} />}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)}
          onApply={applyCssImport} onOpenDocument={openDocument} />
      )}
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
