/* Meta, Typography, Spacing, Radius, Components and Rationale.

   Carried over from the single-file version and rewired to the store. They now
   show the macro-derived value next to the authored one, and expose a lock so
   an individual token can opt out of its macro. Phase 2 replaces Typography
   and the scales with generated equivalents. */
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { PROSE_SECTIONS, uid } from '../state/schema.js'
import { SPEC_COMPONENT_PROPS } from '../emit/yaml.js'
import { SectionHeader, Empty, Banner } from '../ui/controls.jsx'

const Trash = ({ sz = 13 }) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
const Chevron = ({ open }) => <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9" /></svg>

const LockBtn = ({ locked, onClick }) => (
  <button onClick={onClick} title={locked ? 'Locked — ignores its macro slider' : 'Following the macro slider'}
    style={{ background: 'none', border: 'none', cursor: 'pointer', color: locked ? 'var(--accent)' : 'var(--dim)', padding: 3, display: 'flex' }}>
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {locked ? <path d="M8 11V7a4 4 0 118 0v4" /> : <path d="M8 11V7a4 4 0 117 -2.6" />}
    </svg>
  </button>
)

const SaveCancel = ({ onSave, onCancel, label = 'Save' }) => (
  <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
    <button onClick={onSave} className="btn-primary">{label}</button>
    <button onClick={onCancel} className="btn-ghost">Cancel</button>
  </div>
)

/* ── Meta ── */
export function MetaTab() {
  const { state, set } = useStore()
  const up = (k, v) => set(s => ({ ...s, meta: { ...s.meta, [k]: v } }), `meta:${k}`)
  return (
    <div style={{ maxWidth: 520 }}>
      <SectionHeader title="Project info" desc="Core metadata written into the DESIGN.md frontmatter" />
      <div style={{ marginBottom: 14 }}>
        <label>System name</label>
        <input value={state.meta.name} onChange={e => up('name', e.target.value)} placeholder="My Design System" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label>Description</label>
        <textarea value={state.meta.description} onChange={e => up('description', e.target.value)}
          placeholder="A brief description of this design system…" style={{ minHeight: 70 }} />
      </div>
      <div>
        <label>Spec version</label>
        <input value={state.meta.version} onChange={e => up('version', e.target.value)} placeholder="alpha" style={{ maxWidth: 180 }} />
        <div className="panel-note" style={{ marginTop: 5 }}>The DESIGN.md format version. Currently <code>alpha</code>.</div>
      </div>
    </div>
  )
}

/* ── Typography ── */
const TYP_FIELDS = [
  { k: 'name', label: 'Token name', ph: 'h1, body-md…', mono: false },
  { k: 'fontFamily', label: 'Font family', ph: 'Georgia, Inter…', mono: true },
  { k: 'fontSize', label: 'Font size', ph: '48px, 2rem…', mono: true },
  { k: 'fontWeight', label: 'Font weight', ph: '400, 700…', mono: true },
  { k: 'lineHeight', label: 'Line height', ph: '1.5, 1.1…', mono: true },
  { k: 'letterSpacing', label: 'Letter spacing', ph: '-0.02em…', mono: true },
  { k: 'fontFeature', label: 'Font feature', ph: '"tnum" 1…', mono: true },
  { k: 'fontVariation', label: 'Font variation', ph: '"wght" 400…', mono: true },
]

function TypFields({ token, onChange }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {TYP_FIELDS.map(f => (
          <div key={f.k}>
            <label>{f.label}</label>
            <input value={token[f.k] || ''} onChange={e => onChange(f.k, e.target.value)} placeholder={f.ph}
              style={f.mono ? { fontFamily: 'var(--mono)', fontSize: 12 } : undefined} />
          </div>
        ))}
      </div>
      {(token.fontFamily || token.fontSize) && (
        <div style={{ marginTop: 11, padding: '11px 13px', background: 'var(--surf3)', borderRadius: 7, border: '1px solid var(--bdr)' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 5 }}>Preview</div>
          <div style={{
            fontFamily: token.fontFamily || 'inherit', fontSize: token.fontSize || 'inherit',
            fontWeight: token.fontWeight || 'inherit', lineHeight: token.lineHeight || 'inherit',
            letterSpacing: token.letterSpacing || 'inherit',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)',
          }}>The quick brown fox jumps over the lazy dog</div>
        </div>
      )}
    </div>
  )
}

export function TypographyTab() {
  const { state, derived, set } = useStore()
  const [adding, setAdding] = useState(false)
  const [nt, setNt] = useState({ name: '', fontFamily: '', fontSize: '', fontWeight: '', lineHeight: '', letterSpacing: '', fontFeature: '', fontVariation: '' })
  const [open, setOpen] = useState(null)

  const upd = (id, k, v) => set(s => ({ ...s, typography: s.typography.map(t => t.id === id ? { ...t, [k]: v } : t) }), `typ:${id}:${k}`)
  const del = id => set(s => ({ ...s, typography: s.typography.filter(t => t.id !== id) }))
  const toggleLock = id => set(s => ({ ...s, typography: s.typography.map(t => t.id === id ? { ...t, locked: !t.locked } : t) }))
  const save = () => {
    if (!nt.name.trim()) return
    set(s => ({ ...s, typography: [...s.typography, { ...nt, id: uid() }] }))
    setNt({ name: '', fontFamily: '', fontSize: '', fontWeight: '', lineHeight: '', letterSpacing: '', fontFeature: '', fontVariation: '' })
    setAdding(false)
  }

  const scaled = state.macros.scale !== 1

  return (
    <div style={{ maxWidth: 720 }}>
      <SectionHeader title="Typography" desc="Font tokens. The Type scale macro multiplies every size." count={state.typography.length} />
      {scaled && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="info">Sizes are scaled ×{state.macros.scale.toFixed(2)}. The exported value is shown on the right; lock a token to exempt it.</Banner>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!state.typography.length && <Empty msg="No typography tokens yet." />}
        {state.typography.map(t => {
          const out = derived.typography.find(d => d.id === t.id)
          const isOpen = open === t.id
          return (
            <div key={t.id} style={{ background: 'var(--surf)', border: `1px solid ${isOpen ? 'rgba(220,144,85,.35)' : 'var(--bdr)'}`, borderRadius: 9, overflow: 'hidden' }}>
              <div onClick={() => setOpen(isOpen ? null : t.id)} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto auto', gap: 9, alignItems: 'center', padding: '8px 12px', cursor: 'pointer' }}>
                <code className="chip">{t.name}</code>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[t.fontFamily, t.fontSize, t.fontWeight].filter(Boolean).join(' · ') || '—'}
                </span>
                {scaled && out && out.fontSize !== t.fontSize && (
                  <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>→ {out.fontSize}</code>
                )}
                <LockBtn locked={!!t.locked} onClick={e => { e.stopPropagation(); toggleLock(t.id) }} />
                <Chevron open={isOpen} />
                <button className="btn-delete" onClick={e => { e.stopPropagation(); del(t.id) }}><Trash /></button>
              </div>
              {isOpen && (
                <div style={{ padding: '13px 15px', borderTop: '1px solid var(--bdr)', background: 'var(--surf2)' }}>
                  <TypFields token={t} onChange={(k, v) => upd(t.id, k, v)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {adding ? (
        <div style={{ marginTop: 8, background: 'var(--surf2)', border: '1px solid rgba(220,144,85,.3)', borderRadius: 9, padding: 15 }}>
          <TypFields token={nt} onChange={(k, v) => setNt(t => ({ ...t, [k]: v }))} />
          <SaveCancel onSave={save} label="Add token" onCancel={() => setAdding(false)} />
        </div>
      ) : <button className="btn-add" onClick={() => setAdding(true)}>+ Add typography token</button>}
    </div>
  )
}

/* ── Spacing / Radius ── */
export function KVTab({ section, title, desc, label, valuePh, macroKey }) {
  const { state, derived, set } = useStore()
  const [adding, setAdding] = useState(false)
  const [nn, setNn] = useState({ name: '', value: '' })
  const items = state[section]
  const factor = state.macros[macroKey]

  const upd = (id, k, v) => set(s => ({ ...s, [section]: s[section].map(x => x.id === id ? { ...x, [k]: v } : x) }), `${section}:${id}:${k}`)
  const del = id => set(s => ({ ...s, [section]: s[section].filter(x => x.id !== id) }))
  const toggleLock = id => set(s => ({ ...s, [section]: s[section].map(x => x.id === id ? { ...x, locked: !x.locked } : x) }))
  const save = () => {
    if (!nn.name.trim()) return
    set(s => ({ ...s, [section]: [...s[section], { ...nn, id: uid() }] }))
    setNn({ name: '', value: '' })
    setAdding(false)
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <SectionHeader title={title} desc={desc} count={items.length} />
      {factor !== 1 && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="info">Scaled ×{factor.toFixed(2)} by the macro. The exported value is shown on the right.</Banner>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!items.length && <Empty msg={`No ${label.toLowerCase()} tokens yet.`} />}
        {items.map(item => {
          const out = derived[section].find(d => d.id === item.id)
          const changed = out && out.value !== item.value
          return (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 7, alignItems: 'center', background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '6px 9px' }}>
              <input value={item.name} onChange={e => upd(item.id, 'name', e.target.value)} placeholder="name" style={{ fontWeight: 500, fontSize: 13 }} />
              <input value={item.value} onChange={e => upd(item.id, 'value', e.target.value)} placeholder={valuePh} style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }} />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: changed ? 'var(--accent)' : 'var(--dim)', minWidth: 44, textAlign: 'right' }}>
                {changed ? `→ ${out.value}` : ''}
              </code>
              <LockBtn locked={!!item.locked} onClick={() => toggleLock(item.id)} />
              <button className="btn-delete" onClick={() => del(item.id)}><Trash /></button>
            </div>
          )
        })}
      </div>
      {adding ? (
        <div style={{ marginTop: 8, background: 'var(--surf2)', border: '1px solid rgba(220,144,85,.3)', borderRadius: 9, padding: 15 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div><label>Name</label><input value={nn.name} onChange={e => setNn(n => ({ ...n, name: e.target.value }))} placeholder="sm, md, lg…" onKeyDown={e => e.key === 'Enter' && save()} /></div>
            <div><label>Value</label><input value={nn.value} onChange={e => setNn(n => ({ ...n, value: e.target.value }))} placeholder={valuePh} style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }} onKeyDown={e => e.key === 'Enter' && save()} /></div>
          </div>
          <SaveCancel onSave={save} label={`Add ${label}`} onCancel={() => setAdding(false)} />
        </div>
      ) : <button className="btn-add" onClick={() => setAdding(true)}>+ Add {label.toLowerCase()}</button>}
    </div>
  )
}

/* ── Components ── */
export function ComponentsTab() {
  const { state, set } = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const addComp = () => {
    if (!name.trim()) return
    set(s => ({ ...s, components: [...s.components, { id: uid(), name, properties: [] }] }))
    setName(''); setAdding(false)
  }
  const delComp = id => set(s => ({ ...s, components: s.components.filter(c => c.id !== id) }))
  const addProp = cid => set(s => ({ ...s, components: s.components.map(c => c.id === cid ? { ...c, properties: [...c.properties, { id: uid(), key: '', value: '' }] } : c) }))
  const delProp = (cid, pid) => set(s => ({ ...s, components: s.components.map(c => c.id === cid ? { ...c, properties: c.properties.filter(p => p.id !== pid) } : c) }))
  const updProp = (cid, pid, k, v) => set(s => ({ ...s, components: s.components.map(c => c.id === cid ? { ...c, properties: c.properties.map(p => p.id === pid ? { ...p, [k]: v } : p) } : c) }), `prop:${pid}:${k}`)

  return (
    <div style={{ maxWidth: 680 }}>
      <SectionHeader title="Components" desc="Per-component overrides referencing tokens with {path.to.token}" count={state.components.length} />
      <div style={{ marginBottom: 12 }}>
        <Banner tone="info">
          The spec allows eight component properties: <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{SPEC_COMPONENT_PROPS.join(', ')}</code>. Anything else still reaches the file, but as prose rather than YAML.
        </Banner>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!state.components.length && <Empty msg="No component tokens yet. Variants and states are named with hyphens — button-primary, button-primary-hover." />}
        {state.components.map(comp => (
          <div key={comp.id} style={{ border: '1px solid var(--bdr)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', background: 'var(--surf2)' }}>
              <code style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{comp.name}</code>
              <span className="chip">{comp.properties.length} props</span>
              <button className="btn-delete" onClick={() => delComp(comp.id)}><Trash /></button>
            </div>
            <div style={{ padding: 13, background: 'var(--surf)' }}>
              {!comp.properties.length && <div style={{ fontSize: 12, color: 'var(--dim)', padding: '2px 0 9px', textAlign: 'center' }}>No properties yet.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {comp.properties.map(p => {
                  const legal = !p.key || SPEC_COMPONENT_PROPS.includes(p.key)
                  return (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 7, alignItems: 'center' }}>
                      <input list="dmd-comp-props" value={p.key} onChange={e => updProp(comp.id, p.id, 'key', e.target.value)}
                        placeholder="property" style={{ fontFamily: 'var(--mono)', fontSize: 11.5, borderColor: legal ? 'var(--bdr)' : 'rgba(216,164,65,.45)' }} />
                      <input value={p.value} onChange={e => updProp(comp.id, p.id, 'value', e.target.value)}
                        placeholder="{colors.accent}" style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }} />
                      <span className="chip" style={{ visibility: legal ? 'hidden' : 'visible', color: 'var(--warn)', borderColor: 'rgba(216,164,65,.3)' }}>prose</span>
                      <button className="btn-delete" onClick={() => delProp(comp.id, p.id)}><Trash /></button>
                    </div>
                  )
                })}
              </div>
              <button className="btn-add" style={{ marginTop: 9 }} onClick={() => addProp(comp.id)}>+ Add property</button>
            </div>
          </div>
        ))}
      </div>
      <datalist id="dmd-comp-props">{SPEC_COMPONENT_PROPS.map(p => <option key={p} value={p} />)}</datalist>
      {adding ? (
        <div style={{ marginTop: 8, background: 'var(--surf2)', border: '1px solid rgba(220,144,85,.3)', borderRadius: 9, padding: 15 }}>
          <label>Component name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="button-primary, card, nav-link…" onKeyDown={e => e.key === 'Enter' && addComp()} />
          <SaveCancel onSave={addComp} label="Add component" onCancel={() => setAdding(false)} />
        </div>
      ) : <button className="btn-add" onClick={() => setAdding(true)}>+ Add component</button>}
    </div>
  )
}

/* ── Rationale ── */
export function RationaleTab() {
  const { state, set } = useStore()
  const up = (k, v) => set(s => ({ ...s, prose: { ...s.prose, [k]: v } }), `prose:${k}`)
  return (
    <div style={{ maxWidth: 680 }}>
      <SectionHeader title="Design rationale" desc="The prose explaining why. Generated tables are appended to each section automatically — write only the reasoning here." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {PROSE_SECTIONS.map(s => (
          <div key={s.k}>
            <div style={{ marginBottom: 5, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{s.label}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{s.desc}</span>
              {!state.prose[s.k]?.trim() && <span className="chip" style={{ marginLeft: 'auto' }}>omitted</span>}
            </div>
            <textarea value={state.prose[s.k]} onChange={e => up(s.k, e.target.value)}
              placeholder={`Explain your ${s.label.toLowerCase()} decisions…`} style={{ minHeight: 82 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
