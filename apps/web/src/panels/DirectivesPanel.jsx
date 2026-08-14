/* Voice and directives.

   The least visual panel and, per unit of effort, the one that most changes
   what an agent produces. Style references give a model a prior to work from
   in a handful of words; hard constraints are the instruction type models
   follow most reliably; the target stack changes the shape of everything it
   writes. */
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { ANTI_PATTERNS, FRAMEWORKS, uid } from '../state/schema.js'
import { SectionHeader, Collapsible, Segmented, Toggle, Banner, CloseButton } from '../ui/controls.jsx'
import PanelAlerts from '../a11y/PanelAlerts.jsx'

const SUGGESTED_REFERENCES = [
  'Swiss editorial', 'Brutalist', 'Soft neumorphic', 'Print-inspired', 'Terminal / monospace',
  'Warm minimal', 'High-contrast utilitarian', 'Playful geometric', 'Dense data-first', 'Airy consumer',
]

function References({ value, onChange }) {
  const [draft, setDraft] = useState('')
  const add = text => {
    const t = text.trim()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setDraft('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {value.map(r => (
          <span key={r} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgb(var(--accent-rgb) / .12)',
            border: '1px solid rgb(var(--accent-rgb) / .3)', color: 'var(--accent)', borderRadius: 6,
            padding: '4px 6px 4px 8px', fontSize: 12,
          }}>
            {r}
            <CloseButton onClick={() => onChange(value.filter(x => x !== r))} label={`Remove ${r}`} line={1.2} size={8} />
          </span>
        ))}
        {!value.length && <span style={{ fontSize: 12, color: 'var(--dim)' }}>None yet — one or two is plenty.</span>}
      </div>
      <input value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(draft) } }}
        placeholder="Describe the feel, then press Enter" style={{ fontSize: 12, marginBottom: 8 }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {SUGGESTED_REFERENCES.filter(s => !value.includes(s)).map(s => (
          <button key={s} className="seg" onClick={() => add(s)} style={{ fontSize: 12, border: '1px dashed var(--bdr2)' }}>+ {s}</button>
        ))}
      </div>
    </div>
  )
}

export default function DirectivesPanel() {
  const { state, set } = useStore()
  const d = state.directives
  const v = state.voice

  const upd = (key, fn, tag) => set(s => ({ ...s, [key]: fn(s[key]) }), tag)
  const setDir = (k, val) => upd('directives', x => ({ ...x, [k]: val }), `dir:${k}`)
  const setVoice = (k, val) => upd('voice', x => ({ ...x, [k]: val }), `voice:${k}`)
  const toggleAnti = id => upd('directives', x => ({
    ...x, antiPatterns: x.antiPatterns.map(a => a.id === id ? { ...a, on: !a.on } : a),
  }))
  const addAnti = text => upd('directives', x => ({ ...x, antiPatterns: [...x.antiPatterns, { id: uid(), text, on: true, custom: true }] }))
  const removeAnti = id => upd('directives', x => ({ ...x, antiPatterns: x.antiPatterns.filter(a => a.id !== id) }))

  const [draft, setDraft] = useState('')
  const activeCount = d.antiPatterns.filter(a => a.on).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PanelAlerts tab="directives" />
      <SectionHeader title="Voice & Directives" desc="What the agent should aim for, and what it must never do." />

      <Collapsible title="Style References" note={String(d.references.length)} defaultOpen>
        <p className="panel-note" style={{ marginBottom: 12 }}>
          Models hold strong priors on labels like these. A couple of words here moves output further than most token changes.
        </p>
        <References value={d.references} onChange={val => setDir('references', val)} />
      </Collapsible>

      <Collapsible title="Hard Constraints" note={`${activeCount} active`} defaultOpen>
        <Banner tone="info">Negative constraints are the instructions models follow most reliably. These become the Do's and Don'ts section.</Banner>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
          {d.antiPatterns.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Toggle label={<span style={{ fontSize: 12, color: a.on ? 'var(--text)' : 'var(--muted)' }}>{a.text}</span>}
                  checked={a.on} onChange={() => toggleAnti(a.id)} />
              </div>
              {a.custom && <CloseButton onClick={() => removeAnti(a.id)} label="Remove" line={1.5} size={9} />}
            </div>
          ))}
        </div>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); addAnti(draft.trim()); setDraft('') } }}
          placeholder="Add your own constraint, then press Enter" style={{ fontSize: 12 }} />
      </Collapsible>

      <Collapsible title="Output Preferences" note={d.framework} defaultOpen>
        <div style={{ marginBottom: 12 }}>
          <label>Target stack</label>
          <select value={d.framework} onChange={e => setDir('framework', e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
            {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Class naming</label>
          <Segmented value={d.classNaming} onChange={val => setDir('classNaming', val)} size="sm"
            options={[{ value: 'utility', label: 'Utility' }, { value: 'semantic', label: 'Semantic' }, { value: 'either', label: 'No preference' }]} />
        </div>
        <label>Additional instructions</label>
        <textarea value={d.notes} onChange={e => setDir('notes', e.target.value)}
          placeholder="Anything else an agent should know before it writes a line of UI…" style={{ minHeight: 72 }} />
      </Collapsible>

      <Collapsible title="Copy and Formatting" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label>Casing</label>
            <Segmented value={v.casing} onChange={val => setVoice('casing', val)} size="sm"
              options={[{ value: 'sentence', label: 'Sentence case' }, { value: 'title', label: 'Title Case' }]} />
          </div>
          <div>
            <label>Button labels</label>
            <Segmented value={v.buttonStyle} onChange={val => setVoice('buttonStyle', val)} size="sm"
              options={[{ value: 'verb-first', label: 'Verb first' }, { value: 'noun', label: 'Noun' }]} />
          </div>
          <div>
            <label>Error tone</label>
            <Segmented value={v.errorTone} onChange={val => setVoice('errorTone', val)} size="sm"
              options={[{ value: 'plain', label: 'Plain' }, { value: 'terse', label: 'Terse' }, { value: 'apologetic', label: 'Apologetic' }]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label>Date format</label><input value={v.dateFormat} onChange={e => setVoice('dateFormat', e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} /></div>
            <div><label>Numbers</label><input value={v.numberFormat} onChange={e => setVoice('numberFormat', e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} /></div>
            <div><label>Currency</label><input value={v.currency} onChange={e => setVoice('currency', e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} /></div>
          </div>
        </div>
      </Collapsible>
    </div>
  )
}
