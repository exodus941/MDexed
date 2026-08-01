/* The colour system: seeds → generated ramps → semantic roles.

   The three layers are deliberately separate. Seeds are the few decisions a
   designer actually makes; ramps are generated from them; roles are what the
   exported file leads with, because `surface-raised` tells an agent how to
   build a card and `neutral-800` does not. */
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { ROLE_GROUPS, CONTRAST_PAIRS, DEFAULT_MACROS, uid } from '../state/schema.js'
import { RAMP_STEPS, DEFAULT_SHAPE } from '../color/ramp.js'
import { check } from '../color/contrast.js'
import { isValidColor } from '../color/convert.js'
import ColorPicker from '../ui/ColorPicker.jsx'
import { SectionHeader, Collapsible, Slider, Toggle, OverrideBadge, Banner } from '../ui/controls.jsx'

const PROTECTED_SEEDS = ['accent', 'neutral']

/* ── Seeds ── */
function SeedRow({ seed, ramps, onChange, onRename, onDelete, open, onToggle }) {
  const anchor = ramps[seed.name]?.anchor
  return (
    <div style={{ background: 'var(--surf)', border: `1px solid ${open ? 'rgba(220,144,85,.35)' : 'var(--bdr)'}`, borderRadius: 9, overflow: 'hidden', transition: 'border-color .13s' }}>
      <div onClick={onToggle} style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 12px', cursor: 'pointer' }}>
        <div className="swatch" style={{ width: 26, height: 26, background: seed.hex }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13.5 }}>{seed.name}</div>
          {seed.desc && <div style={{ fontSize: 11, color: 'var(--dim)' }}>{seed.desc}</div>}
        </div>
        <code className="chip">{seed.hex}</code>
        {!PROTECTED_SEEDS.includes(seed.name) && (
          <button className="btn-delete" onClick={e => { e.stopPropagation(); onDelete() }} title="Remove seed">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
          </button>
        )}
        {PROTECTED_SEEDS.includes(seed.name) && <span style={{ width: 13 }} />}
      </div>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bdr)', background: 'var(--surf2)' }}>
          <div style={{ marginBottom: 10 }}>
            <label>Seed name</label>
            <input value={seed.name} onChange={e => onRename(e.target.value)}
              disabled={PROTECTED_SEEDS.includes(seed.name)}
              style={PROTECTED_SEEDS.includes(seed.name) ? { opacity: .6, cursor: 'not-allowed' } : undefined} />
            {PROTECTED_SEEDS.includes(seed.name) && (
              <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 4 }}>Semantic roles reference this ramp by name, so it can't be renamed.</div>
            )}
          </div>
          <ColorPicker value={seed.hex} onChange={onChange} />
          {anchor && (
            <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5 }}>
              This exact colour is pinned at step <strong style={{ color: 'var(--muted)' }}>{anchor}</strong> — the rest of the ramp is generated around it.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Generated ramp, with per-step override ── */
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

/* ── Semantic roles ── */
function RoleRow({ role, roles, refs, ramps, overrides, onSetRef, onOverride, onResetOverride }) {
  const [open, setOpen] = useState(false)
  const options = [
    ...Object.keys(ramps).flatMap(r => RAMP_STEPS.map(s => `${r}.${s}`)),
    'white', 'black',
  ]

  return (
    <div style={{ borderBottom: '1px solid var(--bdr)' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'grid', gridTemplateColumns: '1fr 22px 22px', gap: 8, alignItems: 'center', padding: '7px 2px', cursor: 'pointer' }}>
        <div style={{ minWidth: 0 }}>
          <code style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text)' }}>{role.name}</code>
          <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 1 }}>{role.desc}</div>
        </div>
        {['light', 'dark'].map(mode => (
          <div key={mode} className="swatch" title={`${mode}: ${roles[mode][role.name]}`}
            style={{ width: 20, height: 20, background: roles[mode][role.name], position: 'relative' }}>
            {overrides[`${role.name}:${mode}`] != null && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
          </div>
        ))}
      </div>

      {open && (
        <div style={{ padding: '4px 0 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {['light', 'dark'].map(mode => {
            const key = `${role.name}:${mode}`
            const overridden = overrides[key] != null
            return (
              <div key={mode} style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 7, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', flex: 1 }}>{mode}</span>
                  {overridden && <OverrideBadge onReset={() => onResetOverride(key)} title="Relink to the scale" />}
                </div>
                <select value={refs[role.name]?.[mode] ?? ''} disabled={overridden}
                  onChange={e => onSetRef(role.name, mode, e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '5px 7px', marginBottom: 7, opacity: overridden ? .5 : 1 }}>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ColorPicker value={roles[mode][role.name]} onChange={hex => onOverride(key, hex)} compact />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Contrast report ── */
function ContrastReport({ roles, mode }) {
  /* `check()` has its own `label` (the WCAG grade), so the pair is kept in a
     separate field rather than spread — otherwise it overwrites the pair's
     descriptive name. */
  const results = CONTRAST_PAIRS.map(pair => {
    const fg = roles[mode][pair.fg], bg = roles[mode][pair.bg]
    if (!fg || !bg) return null
    return { pair, res: check(fg, bg), fgHex: fg, bgHex: bg }
  }).filter(Boolean)

  const isFailing = ({ pair, res }) => (pair.ui ? res.ratio < 3 : !res.pass)
  const failing = results.filter(isFailing)

  return (
    <div>
      {failing.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="warn">
            {failing.length} pair{failing.length === 1 ? '' : 's'} below the accessible minimum in {mode} mode. Agents will reproduce these faithfully — fix them here rather than downstream.
          </Banner>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {results.map(row => {
          const { pair, res, fgHex, bgHex } = row
          const bad = isFailing(row)
          return (
            <div key={`${pair.fg}|${pair.bg}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 9, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--bdr)' }}
              title={`${pair.fg} on ${pair.bg}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <div style={{ width: 22, height: 18, borderRadius: 4, background: bgHex, border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: fgHex, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>A</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pair.label}</span>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim)' }}>Lc {res.lc}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{res.ratio}:1</span>
              <span className={bad ? 'fail' : 'pass'} style={{ fontFamily: 'var(--mono)', fontSize: 10.5, minWidth: 46, textAlign: 'right' }}>
                {pair.ui ? (res.ratio >= 3 ? 'Pass' : 'Fail') : res.label}
              </span>
            </div>
          )
        })}
      </div>
      <p className="panel-note" style={{ marginTop: 9 }}>
        Ratios are WCAG 2.1; Lc is APCA, which models real legibility better — especially for light text on dark backgrounds, where WCAG is known to be over-permissive.
      </p>
    </div>
  )
}

/* ── Panel ── */
export default function ColorPanel() {
  const { state, derived, set } = useStore()
  const { color } = state
  const { ramps, roles } = derived
  const [openSeed, setOpenSeed] = useState(null)

  const upd = (fn, tag) => set(s => ({ ...s, color: fn(s.color) }), tag)

  const setSeed = (id, hex) => upd(c => ({ ...c, seeds: c.seeds.map(s => s.id === id ? { ...s, hex } : s) }), `seed:${id}`)
  const renameSeed = (id, name) => upd(c => ({ ...c, seeds: c.seeds.map(s => s.id === id ? { ...s, name } : s) }), `seed-name:${id}`)
  const deleteSeed = id => upd(c => ({ ...c, seeds: c.seeds.filter(s => s.id !== id) }))
  const addSeed = () => {
    const id = uid()
    upd(c => ({ ...c, seeds: [...c.seeds, { id, name: `custom-${c.seeds.length + 1}`, hex: '#4f6ef7', desc: '' }] }))
    setOpenSeed(id)
  }

  const setShape = (key, value) => upd(c => ({ ...c, shape: { ...c.shape, [key]: value } }), `shape:${key}`)
  const setStepOverride = (key, hex) => upd(c => ({ ...c, stepOverrides: { ...c.stepOverrides, [key]: hex } }), `step:${key}`)
  const resetStep = key => upd(c => { const n = { ...c.stepOverrides }; delete n[key]; return { ...c, stepOverrides: n } })
  const setRoleRef = (role, mode, ref) => upd(c => ({ ...c, roles: { ...c.roles, [role]: { ...c.roles[role], [mode]: ref } } }))
  const setRoleOverride = (key, hex) => upd(c => ({ ...c, roleOverrides: { ...c.roleOverrides, [key]: hex } }), `role:${key}`)
  const resetRole = key => upd(c => { const n = { ...c.roleOverrides }; delete n[key]; return { ...c, roleOverrides: n } })

  const overrideCount = Object.keys(color.stepOverrides ?? {}).length + Object.keys(color.roleOverrides ?? {}).length

  return (
    <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        title="Colour"
        desc="Pick a few seeds; the scales and semantic roles generate from them."
        right={overrideCount > 0 ? <span className="chip">{overrideCount} overridden</span> : null}
      />

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 7 }}>Seeds</div>
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
      </div>

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

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 9 }}>Generated scales <span style={{ color: 'var(--dim)' }}>— click any step to override it</span></div>
        {Object.entries(ramps).map(([name, ramp]) => (
          <RampRow key={name} name={name} ramp={ramp} overrides={color.stepOverrides ?? {}}
            onOverride={setStepOverride} onResetStep={resetStep} />
        ))}
      </div>

      <Collapsible title="Semantic roles" note={`${ROLE_GROUPS.reduce((n, g) => n + g.roles.length, 0)}`} defaultOpen>
        <p className="panel-note" style={{ marginBottom: 10 }}>
          These are what the exported file leads with. Each maps to a step in a scale, per mode.
        </p>
        {ROLE_GROUPS.map(group => (
          <div key={group.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 500 }}>{group.label}</span>
              <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>{group.desc}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 22px 22px', gap: 8, paddingBottom: 3, borderBottom: '1px solid var(--bdr)' }}>
              <span />
              <span style={{ fontSize: 8.5, color: 'var(--dim)', textAlign: 'center' }}>L</span>
              <span style={{ fontSize: 8.5, color: 'var(--dim)', textAlign: 'center' }}>D</span>
            </div>
            {group.roles.map(role => (
              <RoleRow key={role.name} role={role} roles={roles} refs={color.roles} ramps={ramps}
                overrides={color.roleOverrides ?? {}}
                onSetRef={setRoleRef} onOverride={setRoleOverride} onResetOverride={resetRole} />
            ))}
          </div>
        ))}
      </Collapsible>

      <Collapsible title="Contrast" note={color.mode} defaultOpen>
        <ContrastReport roles={roles} mode={color.mode} />
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
        {color.custom?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 6 }}>Custom tokens</div>
            <p className="panel-note" style={{ marginBottom: 8 }}>Carried over from an imported file. Emitted verbatim.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {color.custom.map(c => (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 8, alignItems: 'center' }}>
                  <div className="swatch" style={{ width: 18, height: 18, background: isValidColor(c.value) ? c.value : '#555' }} />
                  <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{c.name}</code>
                  <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim)' }}>{c.value}</code>
                  <button className="btn-delete" onClick={() => upd(x => ({ ...x, custom: x.custom.filter(k => k.id !== c.id) }))}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Collapsible>
    </div>
  )
}
