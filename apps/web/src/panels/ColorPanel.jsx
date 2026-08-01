/* Colour: the raw material — seeds and the scales generated from them.

   Semantic roles used to live here too, but they're 27 rows deep and the panel
   became unreadable. They have their own tab now and read from these scales. */
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { uid } from '../state/schema.js'
import { RAMP_STEPS, DEFAULT_SHAPE } from '../color/ramp.js'
import { isValidColor } from '../color/convert.js'
import ColorPicker from '../ui/ColorPicker.jsx'
import { SectionHeader, Collapsible, Slider, Toggle, OverrideBadge, ConfirmDelete } from '../ui/controls.jsx'

const PROTECTED_SEEDS = ['accent', 'neutral']

/* Names a design system actually uses, offered in order. `custom-6` tells you
   nothing at the point you next read the file. */
export const SEED_NAME_SUGGESTIONS = [
  'secondary', 'tertiary', 'brand', 'info', 'highlight', 'link',
  'positive', 'negative', 'caution', 'muted', 'surface-tint', 'overlay',
  'selection', 'visited', 'premium', 'chart-1', 'chart-2', 'chart-3',
]

const nextSeedName = seeds => {
  const taken = new Set(seeds.map(s => s.name))
  return SEED_NAME_SUGGESTIONS.find(n => !taken.has(n)) ?? `seed-${seeds.length + 1}`
}

/* ── Seeds ── */
function SeedRow({ seed, ramps, onChange, onRename, onDelete, open, onToggle }) {
  const anchor = ramps[seed.name]?.anchor
  return (
    <div style={{ background: 'var(--surf2)', border: `1px solid ${open ? 'rgba(220,144,85,.35)' : 'var(--bdr)'}`, borderRadius: 9, overflow: 'hidden', transition: 'border-color var(--t) var(--ease)' }}>
      <div onClick={onToggle} style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 12px', cursor: 'pointer' }}>
        <div className="swatch" style={{ width: 26, height: 26, background: seed.hex }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13.5 }}>{seed.name}</div>
          {seed.desc && <div style={{ fontSize: 11, color: 'var(--dim)' }}>{seed.desc}</div>}
        </div>
        <code className="chip">{seed.hex}</code>
        {!PROTECTED_SEEDS.includes(seed.name)
          ? <ConfirmDelete onConfirm={onDelete} title="Remove seed" />
          : <span style={{ width: 23 }} />}
      </div>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bdr)', background: 'var(--surf)' }}>
          <div style={{ marginBottom: 10 }}>
            <label>Seed name</label>
            <input value={seed.name} onChange={e => onRename(e.target.value)}
              list="dmd-seed-names"
              disabled={PROTECTED_SEEDS.includes(seed.name)}
              placeholder="secondary, info, chart-1…"
              style={PROTECTED_SEEDS.includes(seed.name) ? { opacity: .6, cursor: 'not-allowed' } : undefined} />
            {PROTECTED_SEEDS.includes(seed.name) && (
              <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 4 }}>Semantic roles reference this scale by name, so it can't be renamed.</div>
            )}
          </div>
          <ColorPicker value={seed.hex} onChange={onChange} />
          {anchor && (
            <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5 }}>
              This exact colour is pinned at step <strong style={{ color: 'var(--muted)' }}>{anchor}</strong> — the rest of the scale is generated around it.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Generated scale, with per-step override ── */
function RampRow({ name, ramp, overrides, onOverride, onResetStep }) {
  const [selected, setSelected] = useState(null)
  const selectedKey = selected != null ? `${name}.${selected}` : null
  const isOverridden = step => overrides[`${name}.${step}`] != null

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text)' }}>{name}</code>
        <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>{RAMP_STEPS.length} steps</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {RAMP_STEPS.map(step => {
          const hex = ramp.steps[step]
          const active = selected === step
          return (
            <button key={step} onClick={() => setSelected(active ? null : step)} title={`${name}-${step} · ${hex}`}
              style={{
                flex: 1, height: 40, background: hex, border: active ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.06)',
                borderRadius: 4, cursor: 'pointer', position: 'relative', padding: 0,
                outline: ramp.anchor === step ? '1px dashed rgba(255,255,255,.45)' : 'none', outlineOffset: -4,
              }}>
              {isOverridden(step) && (
                <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }} />
              )}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
        {RAMP_STEPS.map(step => (
          <div key={step} style={{ flex: 1, textAlign: 'center', fontSize: 8.5, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>{step}</div>
        ))}
      </div>

      {selected != null && (
        <div style={{ marginTop: 10, padding: 12, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', flex: 1 }}>{name}-{selected}</code>
            {overrides[selectedKey] != null && <OverrideBadge onReset={() => onResetStep(selectedKey)} title="Reset to the generated value" />}
            <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setSelected(null)}>Close</button>
          </div>
          <ColorPicker value={ramp.steps[selected]} onChange={hex => onOverride(selectedKey, hex)} compact />
        </div>
      )}
    </div>
  )
}

export default function ColorPanel() {
  const { state, derived, set } = useStore()
  const { color } = state
  const { ramps } = derived
  const [openSeed, setOpenSeed] = useState(null)

  const upd = (fn, tag) => set(s => ({ ...s, color: fn(s.color) }), tag)

  const setSeed = (id, hex) => upd(c => ({ ...c, seeds: c.seeds.map(s => s.id === id ? { ...s, hex } : s) }), `seed:${id}`)
  const renameSeed = (id, name) => upd(c => ({ ...c, seeds: c.seeds.map(s => s.id === id ? { ...s, name } : s) }), `seed-name:${id}`)
  const deleteSeed = id => upd(c => ({ ...c, seeds: c.seeds.filter(s => s.id !== id) }))
  const addSeed = () => {
    const id = uid()
    upd(c => ({ ...c, seeds: [...c.seeds, { id, name: nextSeedName(c.seeds), hex: '#4f6ef7', desc: 'Rename to suit — this becomes a token prefix' }] }))
    setOpenSeed(id)
  }

  const setShape = (key, value) => upd(c => ({ ...c, shape: { ...c.shape, [key]: value } }), `shape:${key}`)
  const setStepOverride = (key, hex) => upd(c => ({ ...c, stepOverrides: { ...c.stepOverrides, [key]: hex } }), `step:${key}`)
  const resetStep = key => upd(c => { const n = { ...c.stepOverrides }; delete n[key]; return { ...c, stepOverrides: n } })

  const stepOverrides = Object.keys(color.stepOverrides ?? {}).length

  return (
    <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Colour" desc="Pick a few seeds; the scales generate from them. Roles are on the next tab." />

      <Collapsible title="Seeds" note={String(color.seeds.length)} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {color.seeds.map(seed => (
            <SeedRow key={seed.id} seed={seed} ramps={ramps}
              open={openSeed === seed.id}
              onToggle={() => setOpenSeed(openSeed === seed.id ? null : seed.id)}
              onChange={hex => setSeed(seed.id, hex)}
              onRename={name => renameSeed(seed.id, name)}
              onDelete={() => deleteSeed(seed.id)} />
          ))}
        </div>
        <button className="btn-add" onClick={addSeed}>+ Add seed</button>
        <datalist id="dmd-seed-names">
          {SEED_NAME_SUGGESTIONS.filter(n => !color.seeds.some(s => s.name === n)).map(n => <option key={n} value={n} />)}
        </datalist>
      </Collapsible>

      <Collapsible title="Scale shape" note="advanced">
        <p className="panel-note" style={{ marginBottom: 12 }}>
          Steps are generated in OKLCH so they step evenly by eye rather than by arithmetic.
        </p>
        <Slider label="Lightest step" value={color.shape.lightMax} onChange={v => setShape('lightMax', v)}
          min={0.85} max={1} step={0.005} defaultValue={DEFAULT_SHAPE.lightMax} format={v => `${Math.round(v * 100)}%`} />
        <Slider label="Darkest step" value={color.shape.lightMin} onChange={v => setShape('lightMin', v)}
          min={0.05} max={0.4} step={0.005} defaultValue={DEFAULT_SHAPE.lightMin} format={v => `${Math.round(v * 100)}%`} />
        <Slider label="Lightness curve" desc="Negative packs steps toward the light end" value={color.shape.curve}
          onChange={v => setShape('curve', v)} min={-1} max={1} step={0.02} defaultValue={DEFAULT_SHAPE.curve}
          format={v => v.toFixed(2)} />
        <Slider label="Chroma peak" desc="Where along the scale saturation is strongest" value={color.shape.chromaPeak}
          onChange={v => setShape('chromaPeak', v)} min={0.1} max={0.9} step={0.01} defaultValue={DEFAULT_SHAPE.chromaPeak}
          format={v => `${Math.round(v * 100)}%`} />
        <Slider label="Saturation" value={color.shape.chromaScale} onChange={v => setShape('chromaScale', v)}
          min={0} max={1.6} step={0.01} defaultValue={DEFAULT_SHAPE.chromaScale} format={v => `${v.toFixed(2)}×`} />
        <Slider label="Hue shift" desc="Rotates hue from light to dark — warm shadows, cool highlights"
          value={color.shape.hueShift} onChange={v => setShape('hueShift', v)} min={-40} max={40} step={1}
          defaultValue={DEFAULT_SHAPE.hueShift} format={v => `${v}°`} />
        <div style={{ marginTop: 10 }}>
          <Toggle label="Pin seed colours into their scale" checked={color.shape.anchorSeed}
            onChange={v => setShape('anchorSeed', v)}
            desc="Keeps your exact brand hex present rather than approximated" />
        </div>
      </Collapsible>

      <Collapsible title="Generated scales" note={stepOverrides ? `${stepOverrides} overridden` : `${Object.keys(ramps).length}`} defaultOpen>
        <p className="panel-note" style={{ marginBottom: 10 }}>Click any step to override it.</p>
        {Object.entries(ramps).map(([name, ramp]) => (
          <RampRow key={name} name={name} ramp={ramp} overrides={color.stepOverrides ?? {}}
            onOverride={setStepOverride} onResetStep={resetStep} />
        ))}
      </Collapsible>

      <Collapsible title="What gets exported">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Toggle label="Include the numbered scales" checked={color.emitRamps}
            onChange={v => upd(c => ({ ...c, emitRamps: v }))}
            desc="Adds accent-50 … neutral-950 alongside the semantic roles" />
          <Toggle label="Include dark mode" checked={color.emitDark}
            onChange={v => upd(c => ({ ...c, emitDark: v }))}
            desc="Emits a dark- prefixed counterpart for every role" />
        </div>
      </Collapsible>

      {color.custom?.length > 0 && (
        <Collapsible title="Custom tokens" note={String(color.custom.length)}>
          <p className="panel-note" style={{ marginBottom: 8 }}>Carried over from an imported file. Emitted verbatim.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {color.custom.map(c => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 8, alignItems: 'center' }}>
                <div className="swatch" style={{ width: 18, height: 18, background: isValidColor(c.value) ? c.value : '#555' }} />
                <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{c.name}</code>
                <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim)' }}>{c.value}</code>
                <ConfirmDelete onConfirm={() => upd(x => ({ ...x, custom: x.custom.filter(k => k.id !== c.id) }))} title="Remove token" />
              </div>
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  )
}
