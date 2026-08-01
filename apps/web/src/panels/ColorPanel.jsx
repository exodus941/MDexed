/* Colour: the raw material — seeds and the scales generated from them.

   Semantic roles used to live here too, but they're 27 rows deep and the panel
   became unreadable. They have their own tab now and read from these scales. */
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store.jsx'
import { uid } from '../state/schema.js'
import { RAMP_STEPS, DEFAULT_SHAPE, resolveRef } from '../color/ramp.js'
import { generatePalette, HARMONIES } from '../color/palette.js'
import { isValidColor } from '../color/convert.js'
import ColorPicker from '../ui/ColorPicker.jsx'
import { GRADIENT_TYPES } from '../color/modes.js'
import { SectionHeader, Collapsible, Slider, NumField, Toggle, OverrideBadge, ConfirmDelete, Banner } from '../ui/controls.jsx'

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
const Lock = ({ locked }) => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    {locked ? <path d="M8 11V7a4 4 0 118 0v4" /> : <path d="M8 11V7a4 4 0 117-2.6" />}
  </svg>
)

function SeedRow({ seed, ramps, onChange, onRename, onDelete, onLock, open, onToggle }) {
  const anchor = ramps[seed.name]?.anchor
  return (
    <div style={{ background: 'var(--surf2)', border: `1px solid ${open ? 'rgba(220,144,85,.35)' : 'var(--bdr)'}`, borderRadius: 9, overflow: 'hidden', transition: 'border-color var(--t) var(--ease)' }}>
      <div onClick={onToggle} style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto auto auto', gap: 10, alignItems: 'center', padding: '8px 12px', cursor: 'pointer' }}>
        <div className="swatch" style={{ width: 26, height: 26, background: seed.hex }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13.5 }}>{seed.name}</div>
          {seed.desc && <div style={{ fontSize: 11, color: 'var(--dim)' }}>{seed.desc}</div>}
        </div>
        <code className="chip">{seed.hex}</code>
        <button onClick={e => { e.stopPropagation(); onLock() }}
          title={seed.locked ? 'Locked — the generator will leave this alone' : 'Unlocked — the generator may replace this'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex',
            color: seed.locked ? 'var(--accent)' : 'var(--dim)',
            transition: 'color var(--t) var(--ease)',
          }}>
          <Lock locked={seed.locked} />
        </button>
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

/* Swatch grid + picker, opened from a stop's swatch.

   Rendered into a portal: inside the card it was clipped by the panel's
   overflow and crammed into its own scrollbar. The custom picker sits at the
   top, because a gradient that deliberately ignores the palette is a normal
   thing to want and shouldn't be the last thing you find. */
function StopPicker({ value, resolved, groups, anchor, onPick, onClose }) {
  const isLiteral = /^#/.test(value)
  const rect = anchor?.getBoundingClientRect()
  /* Two columns — picker left, swatches right — so the popover stays short
     enough to fit on screen instead of becoming a tall scroller. */
  const width = 520
  const left = rect ? Math.min(Math.max(10, rect.left), window.innerWidth - width - 10) : 40
  const below = rect ? window.innerHeight - rect.bottom : 0
  const openUp = below < 340 && rect && rect.top > below

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000 }} />
      <div className="anim-pop" style={{
        position: 'fixed', left,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: (rect?.bottom ?? 0) + 8 }),
        zIndex: 2001, width,
        background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 10,
        boxShadow: '0 18px 44px rgba(0,0,0,.6)', padding: 12,
        display: 'grid', gridTemplateColumns: '208px 1fr', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', flex: 1 }}>
              Custom colour
            </span>
          </div>
          {/* Always available — editing it detaches the stop from the palette. */}
          <ColorPicker value={isLiteral ? value : resolved} onChange={onPick} compact />
          <p className="panel-note" style={{ fontSize: 10.5, marginTop: 7 }}>
            {isLiteral
              ? 'This stop is a literal colour and ignores the palette.'
              : <>Following <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{value}</code>. Adjusting this pins it to a literal colour.</>}
          </p>
        </div>

        <div style={{ borderLeft: '1px solid var(--bdr)', paddingLeft: 12, maxHeight: 300, overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 5 }}>
                {group.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4 }}>
                {group.items.map(item => (
                  <button key={item.ref} onClick={() => { onPick(item.ref); onClose() }}
                    title={`${item.ref} — ${item.hex}`}
                    style={{
                      aspectRatio: '1', background: item.hex, borderRadius: 4, cursor: 'pointer', padding: 0,
                      border: value === item.ref ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.08)',
                    }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}

/* ── Gradients ──
   Stops reference roles or scale steps, so a gradient follows the palette
   instead of freezing hex values into it. */
function GradientRow({ grad, css, options, resolved, onChange, onDelete }) {
  const [open, setOpen] = useState(false)
  const [openStop, setOpenStop] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const swatchRefs = useRef([])
  const setStop = (i, patch) => onChange({ ...grad, stops: grad.stops.map((s, j) => j === i ? { ...s, ...patch } : s) })

  const reorder = (from, to) => {
    if (from == null || to == null || from === to) return
    const next = [...grad.stops]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange({ ...grad, stops: next })
  }

  /* Reversing means mirroring the positions as well as the order, or the
     colours swap but the distribution doesn't. */
  const reverse = () => onChange({
    ...grad,
    stops: [...grad.stops].reverse().map(s => ({ ...s, position: 100 - s.position })),
  })

  return (
    <div style={{ background: 'var(--surf2)', border: `1px solid ${open ? 'rgba(220,144,85,.35)' : 'var(--bdr)'}`, borderRadius: 9, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto auto', gap: 10, alignItems: 'center', padding: '8px 12px', cursor: 'pointer' }}>
        <div style={{ height: 26, borderRadius: 5, background: css, border: '1px solid rgba(255,255,255,.08)' }} />
        <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{grad.name}</code>
        <button onClick={e => { e.stopPropagation(); reverse() }} title="Reverse the gradient"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 3, display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 2 21 6 17 10" /><path d="M21 6H9a4 4 0 00-4 4" />
            <polyline points="7 22 3 18 7 14" /><path d="M3 18h12a4 4 0 004-4" />
          </svg>
        </button>
        <span className="chip">{grad.type}</span>
        <ConfirmDelete onConfirm={onDelete} title="Remove gradient" />
      </div>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--bdr)', background: 'var(--surf)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 11 }}>
            <div>
              <label>Name</label>
              <input value={grad.name} onChange={e => onChange({ ...grad, name: e.target.value.replace(/\s+/g, '-') })}
                style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
            </div>
            <div>
              <label>Type</label>
              <select value={grad.type} onChange={e => onChange({ ...grad, type: e.target.value })} style={{ fontSize: 12, padding: '6px 8px' }}>
                {GRADIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {grad.type === 'linear' && (
            <Slider label="Angle" value={grad.angle ?? 90} onChange={v => onChange({ ...grad, angle: v })}
              min={0} max={360} step={1} defaultValue={90} format={v => `${Math.round(v)}°`} />
          )}
          {grad.type === 'radial' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <NumField label="Centre X" value={grad.cx ?? 50} min={0} max={100} suffix="%" onChange={v => onChange({ ...grad, cx: v })} />
              <NumField label="Centre Y" value={grad.cy ?? 50} min={0} max={100} suffix="%" onChange={v => onChange({ ...grad, cy: v })} />
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 0 6px' }}>Stops</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {grad.stops.map((s, i) => (
              <div key={i}
                draggable
                onDragStart={e => { setDragging(i); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={e => { e.preventDefault(); if (dragging != null && dragging !== i) setDragOver(i) }}
                onDragLeave={() => setDragOver(o => (o === i ? null : o))}
                onDrop={e => { e.preventDefault(); reorder(dragging, i); setDragging(null); setDragOver(null) }}
                onDragEnd={() => { setDragging(null); setDragOver(null) }}
                style={{
                  background: 'var(--surf2)', borderRadius: 7, padding: 8, position: 'relative',
                  border: `1px solid ${dragOver === i ? 'var(--accent)' : 'var(--bdr)'}`,
                  opacity: dragging === i ? 0.45 : 1,
                  transition: 'border-color var(--t) var(--ease), opacity var(--t) var(--ease)',
                }}>
                <div style={{ display: 'grid', gridTemplateColumns: '14px 26px minmax(0,1fr) 78px 20px', gap: 8, alignItems: 'center' }}>
                  {/* Drag handle — stop order is the gradient's order. */}
                  <span title="Drag to reorder" style={{ cursor: 'grab', color: 'var(--dim)', display: 'flex' }}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                    </svg>
                  </span>
                  <button className="swatch" ref={el => { swatchRefs.current[i] = el }}
                    onClick={() => setOpenStop(openStop === i ? null : i)}
                    title="Choose a colour"
                    style={{ width: 24, height: 24, background: resolved[i], padding: 0, border: openStop === i ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.1)' }} />
                  <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: /^#/.test(s.color) ? 'var(--muted)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.color}
                    {!/^#/.test(s.color) && <span style={{ color: 'var(--dim)' }}> · {resolved[i]}</span>}
                  </code>
                  <NumField value={s.position} min={0} max={100} suffix="%" onChange={v => setStop(i, { position: v })} />
                  <ConfirmDelete size={11} title="Remove stop"
                    onConfirm={() => onChange({ ...grad, stops: grad.stops.filter((_, j) => j !== i) })} />
                </div>
                {openStop === i && (
                  <StopPicker value={s.color} resolved={resolved[i]} groups={options} anchor={swatchRefs.current[i]}
                    onPick={colour => setStop(i, { color: colour })}
                    onClose={() => setOpenStop(null)} />
                )}
              </div>
            ))}
          </div>
          <button className="btn-add" style={{ marginTop: 8 }}
            onClick={() => onChange({ ...grad, stops: [...grad.stops, { color: 'accent', position: 100 }] })}>
            + Add stop
          </button>
          <code style={{ display: 'block', marginTop: 10, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', wordBreak: 'break-all' }}>{css}</code>
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
  const [harmony, setHarmony] = useState('analogous')

  const upd = (fn, tag) => set(s => ({ ...s, color: fn(s.color) }), tag)

  const setSeed = (id, hex) => upd(c => ({ ...c, seeds: c.seeds.map(s => s.id === id ? { ...s, hex } : s) }), `seed:${id}`)
  const renameSeed = (id, name) => upd(c => ({ ...c, seeds: c.seeds.map(s => s.id === id ? { ...s, name } : s) }), `seed-name:${id}`)
  const deleteSeed = id => upd(c => ({ ...c, seeds: c.seeds.filter(s => s.id !== id) }))
  const addSeed = () => {
    const id = uid()
    upd(c => ({ ...c, seeds: [...c.seeds, { id, name: nextSeedName(c.seeds), hex: '#4f6ef7', desc: 'Rename to suit — this becomes a token prefix' }] }))
    setOpenSeed(id)
  }

  const toggleLock = id => upd(c => ({ ...c, seeds: c.seeds.map(s => s.id === id ? { ...s, locked: !s.locked } : s) }), `seed-lock:${id}`)
  /* Tagged, so the log records it as a palette generation rather than an
     anonymous colour edit — and so the entry can carry the whole before/after
     palette rather than a single hex. */
  const roll = () => upd(c => {
    const next = generatePalette(c.seeds, harmony)
    return { ...c, seeds: c.seeds.map(s => next[s.id] ? { ...s, hex: next[s.id] } : s) }
  }, `palette:${harmony}`)
  const lockedCount = color.seeds.filter(s => s.locked).length

  const setShape = (key, value) => upd(c => ({ ...c, shape: { ...c.shape, [key]: value } }), `shape:${key}`)
  const setStepOverride = (key, hex) => upd(c => ({ ...c, stepOverrides: { ...c.stepOverrides, [key]: hex } }), `step:${key}`)
  const resetStep = key => upd(c => { const n = { ...c.stepOverrides }; delete n[key]; return { ...c, stepOverrides: n } })

  const stepOverrides = Object.keys(color.stepOverrides ?? {}).length

  const resolveStopHex = value =>
    /^#/.test(value) ? value : (derived.roles[color.mode][value] ?? resolveRef(value, ramps) ?? '#888888')

  /* Grouped for the swatch grid: seeds first — the colours you actually
     picked — then roles, then the full scales. */
  const stopOptions = [
    { label: 'Seeds', items: color.seeds.map(s => ({ ref: `${s.name}.500`, hex: resolveStopHex(`${s.name}.500`) })) },
    { label: 'Roles', items: Object.entries(derived.roles[color.mode]).map(([ref, hex]) => ({ ref, hex })) },
    ...Object.entries(ramps).map(([name, ramp]) => ({
      label: `${name} scale`,
      items: RAMP_STEPS.map(step => ({ ref: `${name}.${step}`, hex: ramp.steps[step] })),
    })),
  ]
  const updGradient = (id, next) => upd(c => ({ ...c, gradients: c.gradients.map(g => g.id === id ? next : g) }), `grad:${id}`)
  const addGradient = () => upd(c => ({
    ...c,
    gradients: [...(c.gradients ?? []), {
      id: uid(),
      name: `gradient-${(c.gradients?.length ?? 0) + 1}`,
      type: 'linear', angle: 90, cx: 50, cy: 50,
      stops: [{ color: 'accent', position: 0 }, { color: 'accent-subtle', position: 100 }],
    }],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Colour" desc="Pick a few seeds; the scales generate from them. Roles are on the next tab." />

      <Collapsible title="Seeds" note={`${color.seeds.length}${lockedCount ? ` · ${lockedCount} locked` : ''}`} defaultOpen>
        {/* Generator, inline rather than on its own screen — locking a colour
            and re-rolling the rest is a loop you want to stay inside. */}
        <div style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 9, padding: 11, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>Generate a palette</span>
            <select value={harmony} onChange={e => setHarmony(e.target.value)}
              style={{ width: 'auto', fontSize: 11.5, padding: '4px 7px' }}>
              {HARMONIES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
            </select>
            <button className="btn-primary" onClick={roll} style={{ padding: '6px 13px', whiteSpace: 'nowrap' }}>
              Generate
            </button>
          </div>
          <div style={{ display: 'flex', gap: 3, height: 34, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            {color.seeds.map(s => (
              <button key={s.id} onClick={() => toggleLock(s.id)} title={`${s.name} — ${s.locked ? 'locked' : 'click to lock'}`}
                style={{
                  flex: 1, background: s.hex, border: 'none', cursor: 'pointer', position: 'relative',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 3,
                  outline: s.locked ? '2px solid var(--accent)' : 'none', outlineOffset: -2,
                }}>
                <span style={{ color: '#fff', mixBlendMode: 'difference', display: 'flex' }}>
                  {s.locked && <Lock locked />}
                </span>
              </button>
            ))}
          </div>
          <p className="panel-note">
            Lock the ones you like, then generate again — locked colours anchor the hue and weight of everything else.
            Status seeds stay inside the hue bands that still read as success, warning and danger.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {color.seeds.map(seed => (
            <SeedRow key={seed.id} seed={seed} ramps={ramps}
              open={openSeed === seed.id}
              onToggle={() => setOpenSeed(openSeed === seed.id ? null : seed.id)}
              onChange={hex => setSeed(seed.id, hex)}
              onRename={name => renameSeed(seed.id, name)}
              onLock={() => toggleLock(seed.id)}
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

      <Collapsible title="Gradients" note={String(color.gradients?.length ?? 0)}>
        <Banner tone="info">
          A gradient is a CSS <em>image</em>, not a colour, so it can't be a <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>colors</code> token —
          the spec's map takes colour values. Gradients are written into the Colors section as a table instead, and reach the preview as CSS variables.
        </Banner>
        <p className="panel-note" style={{ margin: '10px 0' }}>
          Stops take a role name (<code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>accent</code>), a scale step
          (<code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>accent.400</code>) or a literal hex — so a gradient tracks the palette rather than freezing it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {!color.gradients?.length && (
            <div style={{ textAlign: 'center', padding: '18px 12px', color: 'var(--dim)', fontSize: 12.5, border: '1px dashed var(--bdr)', borderRadius: 9 }}>
              No gradients yet.
            </div>
          )}
          {(color.gradients ?? []).map((g, i) => (
            <GradientRow key={g.id} grad={g} css={derived.gradients[i]?.css ?? 'none'} options={stopOptions}
              resolved={g.stops.map(s => resolveStopHex(s.color))}
              onChange={next => updGradient(g.id, next)}
              onDelete={() => upd(c => ({ ...c, gradients: c.gradients.filter(x => x.id !== g.id) }))} />
          ))}
        </div>
        <button className="btn-add" onClick={addGradient}>+ Add gradient</button>
        <p className="panel-note" style={{ marginTop: 10 }}>
          Gradient <strong>strokes</strong> have no direct CSS property. They need
          <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}> border-image</code>, or a two-layer background with
          <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}> background-clip</code>. That technique note is written into the file so an agent doesn't invent one.
        </p>
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
