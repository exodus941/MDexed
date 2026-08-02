/* Meta and Rationale — the two panels that hold plain text rather than tokens. */
import { useStore } from '../state/store.jsx'
import { PROSE_SECTIONS } from '../state/schema.js'
import { PRESETS, applyPreset } from '../state/presets.js'
import { SectionHeader, Collapsible, Banner, PAD } from '../ui/controls.jsx'
import { AiProvider, AiHeader, SectionAi } from '../ai/ui.jsx'

export function MetaTab() {
  const { state, set, load } = useStore()
  const up = (k, v) => set(s => ({ ...s, meta: { ...s.meta, [k]: v } }), `meta:${k}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Project" desc="Metadata written into the DESIGN.md frontmatter" />

      <Collapsible title="Project info" note={state.meta.name || 'untitled'} defaultOpen>
        <div style={{ marginBottom: 14 }}>
          <label>System name</label>
          <input value={state.meta.name} onChange={e => up('name', e.target.value)} placeholder="My Design System" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label>Description</label>
          <textarea value={state.meta.description} onChange={e => up('description', e.target.value)}
            placeholder="A brief description of this design system…" style={{ minHeight: 66 }} />
        </div>
        <div>
          <label>Spec version</label>
          <input value={state.meta.version} onChange={e => up('version', e.target.value)} placeholder="alpha" style={{ maxWidth: 170 }} />
          <div className="panel-note" style={{ marginTop: 5 }}>The DESIGN.md format version. Currently <code>alpha</code>.</div>
        </div>
      </Collapsible>

      <Collapsible title="Start from a preset" note={String(PRESETS.length)}>
        <p className="panel-note" style={{ marginBottom: 10 }}>
          Replaces every token but keeps your name and rationale. Undo works if you change your mind.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => load(applyPreset(p.id, state))}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: PAD.sub, textAlign: 'left',
                background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 9,
                cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--sans)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgb(var(--accent-rgb) / .35)' }}
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
      </Collapsible>
    </div>
  )
}

export function RationaleTab() {
  const { state, derived, set } = useStore()
  const up = (k, v, tag) => set(s => ({ ...s, prose: { ...s.prose, [k]: v } }), tag ?? `prose:${k}`)
  const written = PROSE_SECTIONS.filter(s => state.prose[s.k]?.trim()).length

  return (
    <AiProvider>
      <SectionHeader title="Design rationale"
        desc="The reasoning behind the tokens. Generated tables are appended to each section automatically — write only the why."
        right={<span className="chip">{written}/{PROSE_SECTIONS.length}</span>} />
      <div style={{ marginBottom: 14 }}>
        <Banner tone="info">
          This is what separates a DESIGN.md from a token dump. An agent given reasons makes better choices in the gaps between your tokens.
        </Banner>
      </div>
      <AiHeader />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PROSE_SECTIONS.map((s, i) => (
          <Collapsible key={s.k} title={s.label} defaultOpen={i === 0}
            note={state.prose[s.k]?.trim() ? `${state.prose[s.k].trim().split(/\s+/).length} words` : 'empty'}>
            <p className="panel-note" style={{ marginBottom: 7 }}>{s.desc}</p>
            <textarea value={state.prose[s.k]} onChange={e => up(s.k, e.target.value)}
              placeholder={`Explain your ${s.label.toLowerCase()} decisions…`} style={{ minHeight: 86 }} />
            <SectionAi section={s} text={state.prose[s.k] ?? ''} state={state} derived={derived}
              onApply={v => up(s.k, v, `ai:prose:${s.k}`)} />
          </Collapsible>
        ))}
      </div>
    </AiProvider>
  )
}
