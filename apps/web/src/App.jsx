/* Application shell: header, macro bar, panel column, preview column.
   All document state lives in the store; this file only wires things together
   and owns cloud sync. */
import { useState, useRef, useEffect, useMemo } from 'react'
import { StoreProvider, useStore } from './state/store.jsx'
import { createInitialState, MACROS, DEFAULT_MACROS } from './state/schema.js'
import { migrate } from './state/migrate.js'
import { generateFile, validate } from './emit/designmd.js'
import { parseFile } from './emit/parse.js'
import { isValidColor } from './color/convert.js'
import { APP_CSS } from './ui/theme.js'
import { Banner } from './ui/controls.jsx'
import Canvas from './preview/Canvas.jsx'
import ColorPanel from './panels/ColorPanel.jsx'
import { MetaTab, TypographyTab, KVTab, ComponentsTab, RationaleTab } from './panels/legacy.jsx'

/* ── API ── */
const API_BASE = '/api/v1'
const TOKEN_KEY = 'design-md:tokens'
const DRAFT_KEY = 'design-md:draft'

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
   Always visible, above everything. Five sliders that reshape hundreds of
   tokens — the reason the panels below can stay shallow. */
function MacroBar() {
  const { state, set } = useStore()
  const setMacro = (key, value) => set(s => ({ ...s, macros: { ...s.macros, [key]: value } }), `macro:${key}`)
  const reset = () => set(s => ({ ...s, macros: { ...DEFAULT_MACROS } }))
  const anyChanged = MACROS.some(m => state.macros[m.key] !== DEFAULT_MACROS[m.key])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '9px 20px', borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', flexShrink: 0, overflowX: 'auto' }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'var(--dim)', whiteSpace: 'nowrap' }}>System</span>
      {MACROS.map(m => {
        const v = state.macros[m.key]
        const changed = v !== DEFAULT_MACROS[m.key]
        return (
          <div key={m.key} style={{ minWidth: 118, flexShrink: 0 }} title={m.desc}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 1 }}>
              <span style={{ fontSize: 11, color: changed ? 'var(--text)' : 'var(--muted)' }}>{m.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: changed ? 'var(--accent)' : 'var(--dim)', marginLeft: 'auto' }}>{v.toFixed(2)}×</span>
            </div>
            <input type="range" min={m.min} max={m.max} step={m.step} value={v}
              onChange={e => setMacro(m.key, parseFloat(e.target.value))}
              onDoubleClick={() => setMacro(m.key, DEFAULT_MACROS[m.key])} />
          </div>
        )
      })}
      <button className="btn-ghost" onClick={reset} disabled={!anyChanged} style={{ padding: '4px 9px', fontSize: 11, flexShrink: 0 }}>Reset</button>
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, width: '100%', maxWidth: 760, maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

/* ── Shell ── */
const TABS = [
  { id: 'meta',       label: 'Meta' },
  { id: 'colors',     label: 'Colour' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing',    label: 'Spacing' },
  { id: 'rounded',    label: 'Radius' },
  { id: 'components', label: 'Components' },
  { id: 'rationale',  label: 'Rationale' },
]

function Shell() {
  const { state, derived, load, undo, redo, canUndo, canRedo } = useStore()
  const [tab, setTab] = useState('colors')
  const [showFile, setShowFile] = useState(false)
  const [notice, setNotice] = useState(null)
  const [projectId, setProjectId] = useState(null)
  const [editToken, setEditToken] = useState(null)
  const [serverVersion, setServerVersion] = useState(null)
  const [syncStatus, setSyncStatus] = useState('local')
  const [linkCopied, setLinkCopied] = useState(false)
  const isInitialSync = useRef(true)
  const fileRef = useRef(null)

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

  useEffect(() => {
    if (projectId || window.location.pathname.startsWith('/p/')) return
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)) } catch { /* quota */ }
    }, 500)
    return () => clearTimeout(t)
  }, [state, projectId])

  /* Debounced cloud autosave */
  useEffect(() => {
    if (!projectId || !editToken) return
    if (syncStatus === 'readonly' || syncStatus === 'conflict') return
    if (isInitialSync.current) { isInitialSync.current = false; return }
    setSyncStatus('saving')
    const t = setTimeout(async () => {
      try {
        const r = await api.update(projectId, editToken, state, serverVersion)
        if (r.status === 409) { setSyncStatus('conflict'); return }
        if (!r.ok) { setSyncStatus('error'); return }
        const { version } = await r.json()
        setServerVersion(version)
        setSyncStatus('saved')
      } catch { setSyncStatus('offline') }
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, projectId, editToken])

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

  const Panel = {
    meta: MetaTab,
    colors: ColorPanel,
    typography: TypographyTab,
    components: ComponentsTab,
    rationale: RationaleTab,
  }[tab]

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
            <code className="chip" style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.meta.name || 'untitled'}</code>
            <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
              {swatches.map((hex, i) => <div key={i} className="swatch" style={{ width: 12, height: 12, background: hex, cursor: 'default' }} />)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
            <button className="btn-ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ padding: '6px 8px' }}><Undo /></button>
            <button className="btn-ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" style={{ padding: '6px 8px' }}><Undo flip /></button>
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
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} style={{ padding: '6px 11px' }}><Upload />Import</button>
            <button className="btn-ghost" onClick={() => setShowFile(true)} style={{ padding: '6px 11px' }}>Preview file</button>
            <button className="btn-primary" onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Download />Export</button>
          </div>
        </header>

        <MacroBar />

        {notice && (
          <div style={{ padding: '9px 20px', background: 'var(--surf)', borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>
            <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Banner>
          </div>
        )}

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(420px, 46%) 1fr', minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid var(--bdr)' }}>
            <nav style={{ display: 'flex', padding: '0 16px', borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', flexShrink: 0, overflowX: 'auto' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
                  padding: '10px 12px', fontFamily: 'var(--sans)', fontSize: 12.5, whiteSpace: 'nowrap',
                  color: tab === t.id ? 'var(--text)' : 'var(--muted)', fontWeight: tab === t.id ? 500 : 400,
                  borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'all .12s', marginBottom: -1,
                }}>{t.label}</button>
              ))}
            </nav>
            <main style={{ flex: 1, overflow: 'auto', padding: '20px 20px 48px' }}>
              {Panel && <Panel />}
              {tab === 'spacing' && <KVTab section="spacing" macroKey="density" title="Spacing" desc="Spacing scale for layout, padding and margin" label="Spacing token" valuePh="8px, 1rem…" />}
              {tab === 'rounded' && <KVTab section="rounded" macroKey="roundness" title="Border radius" desc="Corner radius scale" label="Radius token" valuePh="4px, 0.5rem…" />}
            </main>
          </div>

          <Canvas />
        </div>
      </div>

      {showFile && <FileModal onClose={() => setShowFile(false)} />}
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
