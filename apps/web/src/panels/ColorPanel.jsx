/* Colour: the raw material — seeds and the scales generated from them.

   Semantic roles used to live here too, but they're 27 rows deep and the panel
   became unreadable. They have their own tab now and read from these scales. */
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store.jsx'
import { uid } from '../state/schema.js'
import { RAMP_STEPS, DEFAULT_SHAPE, resolveRef } from '../color/ramp.js'
import { generatePalette, HARMONIES, INTENSITIES } from '../color/palette.js'
import { isValidColor } from '../color/convert.js'
import ColorPicker from '../ui/ColorPicker.jsx'
import TokenColorPicker, { paletteGroups } from '../ui/TokenColorPicker.jsx'
import { viewport } from '../ui/zoom.js'
import { GRADIENT_TYPES, GRADIENT_PURPOSES, purposeOf } from '../color/modes.js'
import { SectionHeader, Collapsible, Expand, Slider, NumField, Toggle, OverrideBadge, ConfirmDelete, Banner, Plus, PAD, BTN } from '../ui/controls.jsx'
import { useAi } from '../ai/ui.jsx'
import { complete } from '../ai/client.js'
import { systemPrompt, gradientNotePrompt } from '../ai/prompts.js'

const PROTECTED_SEEDS = ['accent', 'neutral']

/* ── THE SWATCH STRIP IS ONE BAR CUT INTO N, AND THE LOCKS SIT UNDER IT ──
 *
 * Both rows are flex, both hold the same number of children, both give every
 * child the same `flex: 1 1 96px`, and both use this gap. The flex algorithm is
 * deterministic, so column k of one row is exactly column k of the other. That
 * is why the lock lands centred under its own swatch without a grid, and why
 * this value is stated once rather than typed twice. */
const STRIP_GAP = 4
const SEED_BASIS = '1 1 96px'

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
/* Stroke thins as the glyph grows, so a 26px lock doesn't read as a fat
   cartoon next to the 12px one in the seed rows. */
const Lock = ({ locked, size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={size > 18 ? 1.9 : 2} strokeLinecap="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    {locked ? <path d="M8 11V7a4 4 0 118 0v4" /> : <path d="M8 11V7a4 4 0 117-2.6" />}
  </svg>
)

/* ── THE FULL PICKER, HUNG OFF A STRIP SWATCH ──
 *
 * The compact picker in `TokenColorPicker` answers a different question: it
 * offers the palette as swatches, because a component property usually wants a
 * token. A seed IS the palette, so there is nothing to follow and no swatch
 * column. What is left is the picker at full size.
 *
 * 420 is the widest row it holds: three number fields at 74.7 each, the 104px
 * hex field, the 36px eyedropper, and four 8px gaps come to 396.
 *
 * Portalled for the reason the other one is: inside the panel the popover is
 * clipped by the scroll container and crammed into its own scrollbar. */
const SEED_PICKER_W = 420

function SeedPickerPop({ seed, anchor, onChange, onClose }) {
  const vp = viewport()
  const r = anchor?.getBoundingClientRect()
  const rect = r && { left: vp.x(r.left), top: vp.x(r.top), bottom: vp.x(r.bottom) }
  const left = rect
    ? Math.min(Math.max(10, rect.left), vp.w - SEED_PICKER_W - 10)
    : Math.max(10, (vp.w - SEED_PICKER_W) / 2)
  const below = rect ? vp.h - rect.bottom : 0
  const openUp = !!rect && below < 340 && rect.top > below

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000 }} />
      <div className="anim-pop" role="dialog" aria-label={`Edit the ${seed.name} seed`} style={{
        position: 'fixed', left,
        ...(openUp ? { bottom: vp.h - rect.top + 8 } : { top: rect ? rect.bottom + 8 : 80 }),
        zIndex: 2001, width: SEED_PICKER_W,
        background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 12,
        boxShadow: '0 18px 44px rgba(0,0,0,.6)', padding: 12,
      }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 8 }}>
          {seed.name} seed
        </div>
        <ColorPicker value={seed.hex} onChange={onChange} />
        <p className="panel-note" style={{ fontSize: 10, marginTop: 8 }}>
          Every step of the <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{seed.name}</code> scale regenerates from this.
        </p>
      </div>
    </>,
    document.body
  )
}

function SeedRow({ seed, ramps, onChange, onRename, onDelete, onLock, open, onToggle }) {
  const anchor = ramps[seed.name]?.anchor
  return (
    <div style={{ background: 'var(--surf2)', border: `1px solid ${open ? 'rgb(var(--accent-rgb) / .35)' : 'var(--bdr)'}`, borderRadius: 8, overflow: 'hidden', transition: 'border-color var(--t) var(--ease)' }}>
      {/* A named seed carries a description under it, which makes the left side
          a block rather than a line — the hex then belongs centred on the pair,
          not pinned to the name's baseline. Seeds with no description are a
          single line, and there baseline is right: centring a 13.5px name
          against a 10.5px hex puts their baselines 6.5px apart. */}
      <div onClick={onToggle} style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto auto auto', gap: 12, alignItems: seed.desc ? 'center' : 'baseline', padding: `${PAD.sub}px ${PAD.card}px`, cursor: 'pointer' }}>
        <div className="swatch" style={{ width: 28, height: 28, background: seed.hex, alignSelf: 'center' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{seed.name}</div>
          {seed.desc && <div style={{ fontSize: 12, color: 'var(--dim)' }}>{seed.desc}</div>}
        </div>
        <code className="chip">{seed.hex}</code>
        <button onClick={e => { e.stopPropagation(); onLock() }}
          title={seed.locked ? 'Locked — the generator will leave this alone' : 'Unlocked — the generator may replace this'}
          style={{
            /* The mark stays 12px. The target does not: 4px of padding made
               this a 20px control, and 20px asks a mouse for aim it should not
               need. 24 is the floor where a click stops being a small act of
               marksmanship. Grow the box, not the glyph — centring keeps the
               icon exactly where it was. */
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 24, minHeight: 24,
            color: seed.locked ? 'var(--accent)' : 'var(--dim)',
            transition: 'color var(--t) var(--ease)', alignSelf: 'center',
          }}>
          <Lock locked={seed.locked} />
        </button>
        <span style={{ alignSelf: 'center', display: 'flex' }}>
          {!PROTECTED_SEEDS.includes(seed.name)
            ? <ConfirmDelete onConfirm={onDelete} title="Remove seed" />
            : <span style={{ width: 24 }} />}
        </span>
      </div>
      <Expand open={open}>
        <div style={{ padding: PAD.card, borderTop: '1px solid var(--bdr)', background: 'var(--surf)' }}>
          <div style={{ marginBottom: 12 }}>
            <label>Seed name</label>
            <input value={seed.name} onChange={e => onRename(e.target.value)}
              list="dmd-seed-names"
              disabled={PROTECTED_SEEDS.includes(seed.name)}
              placeholder="secondary, info, chart-1…"
              style={PROTECTED_SEEDS.includes(seed.name) ? { opacity: .6, cursor: 'not-allowed' } : undefined} />
            {PROTECTED_SEEDS.includes(seed.name) && (
              <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>Semantic roles reference this scale by name, so it can't be renamed.</div>
            )}
          </div>
          <ColorPicker value={seed.hex} onChange={onChange} />
          {anchor && (
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 8, lineHeight: 1.5 }}>
              This exact colour is pinned at step <strong style={{ color: 'var(--muted)' }}>{anchor}</strong> — the rest of the scale is generated around it.
            </div>
          )}
        </div>
      </Expand>
    </div>
  )
}

/* ── Generated scale, with per-step override ── */
function RampRow({ name, ramp, overrides, onOverride, onResetStep }) {
  const [selected, setSelected] = useState(null)
  const selectedKey = selected != null ? `${name}.${selected}` : null
  const isOverridden = step => overrides[`${name}.${step}`] != null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{name}</code>
        <span style={{ fontSize: 10, color: 'var(--dim)' }}>{RAMP_STEPS.length} steps</span>
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
                <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 1px rgba(0,0,0,.4)' }} />
              )}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
        {RAMP_STEPS.map(step => (
          <div key={step} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>{step}</div>
        ))}
      </div>

      <Expand open={selected != null}>
        <div style={{ marginTop: PAD.gap, padding: PAD.card, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', flex: 1 }}>{name}-{selected}</code>
            {overrides[selectedKey] != null && <OverrideBadge onReset={() => onResetStep(selectedKey)} title="Reset to the generated value" />}
            <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => setSelected(null)}>Close</button>
          </div>
          {selected != null && <ColorPicker value={ramp.steps[selected]} onChange={hex => onOverride(selectedKey, hex)} compact />}
        </div>
      </Expand>
    </div>
  )
}

/* ── Gradients ──
   Stops reference roles or scale steps, so a gradient follows the palette
   instead of freezing hex values into it. */
/* What the gradient is for, and where it goes.
 *
 * The one field that decides whether a gradient survives the trip to an
 * agent. `backgroundImage` is not among the spec's eight legal component
 * properties, so a gradient can never be attached to a component in the
 * frontmatter — it reaches the far end as prose or not at all. A named
 * placement is the difference between prose an agent can act on and a
 * glossary entry it skims.
 *
 * A fixed list first, free text second. The list gives the emitter a CSS
 * selector to lead with; the sentence carries the judgement the list cannot.
 */
function GradientPurpose({ grad, css, onChange }) {
  const { configured, model } = useAi()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null)
  const purpose = purposeOf(grad.purpose)

  const refine = async () => {
    setBusy(true); setDraft('')
    try {
      let out = ''
      await complete({
        model, system: systemPrompt(),
        prompt: gradientNotePrompt({
          name: grad.name, css, purpose: purpose?.label ?? 'unspecified',
          selector: purpose?.selector, existing: grad.note,
        }),
        onChunk: t => { out += t; setDraft(out) },
      })
      setDraft(out.trim())
    } catch { setDraft(null) } finally { setBusy(false) }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div>
          <label>Purpose</label>
          <select value={grad.purpose ?? ''} onChange={e => onChange({ ...grad, purpose: e.target.value || undefined })}
            style={{ fontSize: 12, padding: '6px 8px' }}>
            <option value="">Unspecified</option>
            {GRADIENT_PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'end', paddingBottom: 8, fontSize: 10, color: 'var(--dim)', lineHeight: 1.45 }}>
          {purpose
            ? <>{purpose.desc}{purpose.selector && <> · <code style={{ fontFamily: 'var(--mono)' }}>{purpose.selector}</code></>}</>
            : 'Without one, the file lists this gradient but cannot tell an agent where to use it.'}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: PAD.label }}>
        <label style={{ marginBottom: 0, flex: 1 }}>Notes for the implementer</label>
        {configured && (
          <button className="btn-ghost" onClick={refine} disabled={busy}
            style={{ padding: BTN.xs, fontSize: 10 }}
            title="Draft or tighten this note with the model chosen in the Rationale tab">
            {busy ? 'Writing…' : grad.note?.trim() ? 'Refine' : 'Draft'}
          </button>
        )}
      </div>
      <textarea value={grad.note ?? ''} onChange={e => onChange({ ...grad, note: e.target.value })}
        placeholder="When to reach for this one, and when not to. Goes into the file verbatim."
        style={{ minHeight: 56, fontSize: 12, lineHeight: 1.5 }} />

      {/* Never overwritten in place — the same rule the Rationale tab follows. */}
      {draft != null && (
        <div style={{
          marginTop: PAD.row, padding: PAD.sub, borderRadius: 8,
          background: 'rgb(var(--accent-rgb) / .07)', border: '1px solid rgb(var(--accent-rgb) / .3)',
        }}>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)', marginBottom: PAD.row }}>
            {draft || <span style={{ color: 'var(--dim)' }}>…</span>}
          </div>
          {!busy && (
            <div style={{ display: 'flex', gap: PAD.row }}>
              <button className="btn-primary" style={{ padding: BTN.xs, fontSize: 12 }}
                onClick={() => { onChange({ ...grad, note: draft }); setDraft(null) }}>Use it</button>
              <button className="btn-ghost" style={{ padding: BTN.xs, fontSize: 12 }}
                onClick={() => setDraft(null)}>Discard</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
    <div style={{ background: 'var(--surf2)', border: `1px solid ${open ? 'rgb(var(--accent-rgb) / .35)' : 'var(--bdr)'}`, borderRadius: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto auto', gap: 12, alignItems: 'center', padding: `${PAD.sub}px ${PAD.card}px`, cursor: 'pointer' }}>
        <div style={{ height: 28, borderRadius: 6, background: css, border: '1px solid rgba(255,255,255,.08)' }} />
        <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{grad.name}</code>
        <button onClick={e => { e.stopPropagation(); reverse() }} title="Reverse the gradient"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 2 21 6 17 10" /><path d="M21 6H9a4 4 0 00-4 4" />
            <polyline points="7 22 3 18 7 14" /><path d="M3 18h12a4 4 0 004-4" />
          </svg>
        </button>
        <span className="chip">{grad.type}</span>
        <ConfirmDelete onConfirm={onDelete} title="Remove gradient" />
      </div>
      <Expand open={open}>
        <div style={{ padding: PAD.card, borderTop: '1px solid var(--bdr)', background: 'var(--surf)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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

          <GradientPurpose grad={grad} css={css} onChange={onChange} />

          {grad.type === 'linear' && (
            <Slider label="Angle" value={grad.angle ?? 90} onChange={v => onChange({ ...grad, angle: v })}
              min={0} max={360} step={1} defaultValue={90} format={v => `${Math.round(v)}°`} />
          )}
          {grad.type === 'radial' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <NumField label="Centre X" value={grad.cx ?? 50} min={0} max={100} suffix="%" onChange={v => onChange({ ...grad, cx: v })} />
              <NumField label="Centre Y" value={grad.cy ?? 50} min={0} max={100} suffix="%" onChange={v => onChange({ ...grad, cy: v })} />
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 6px' }}>Stops</div>
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
                  background: 'var(--surf2)', borderRadius: 8, padding: 8, position: 'relative',
                  border: `1px solid ${dragOver === i ? 'var(--accent)' : 'var(--bdr)'}`,
                  opacity: dragging === i ? 0.45 : 1,
                  transition: 'border-color var(--t) var(--ease), opacity var(--t) var(--ease)',
                }}>
                <div style={{ display: 'grid', gridTemplateColumns: '14px 26px minmax(0,1fr) 78px 20px', gap: 8, alignItems: 'center' }}>
                  {/* Drag handle — stop order is the gradient's order. */}
                  <span title="Drag to reorder" style={{ cursor: 'grab', color: 'var(--dim)', display: 'flex' }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                    </svg>
                  </span>
                  <button className="swatch" ref={el => { swatchRefs.current[i] = el }}
                    onClick={() => setOpenStop(openStop === i ? null : i)}
                    title="Choose a colour"
                    style={{ width: 24, height: 24, background: resolved[i], padding: 0, border: openStop === i ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.1)' }} />
                  <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: /^#/.test(s.color) ? 'var(--muted)' : 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.color}
                    {!/^#/.test(s.color) && <span style={{ color: 'var(--dim)' }}> · {resolved[i]}</span>}
                  </code>
                  <NumField value={s.position} min={0} max={100} suffix="%" onChange={v => setStop(i, { position: v })} />
                  <ConfirmDelete size={11} title="Remove stop"
                    onConfirm={() => onChange({ ...grad, stops: grad.stops.filter((_, j) => j !== i) })} />
                </div>
                {openStop === i && (
                  <TokenColorPicker value={s.color} resolved={resolved[i]} groups={options} anchor={swatchRefs.current[i]}
                    onPick={colour => setStop(i, { color: colour })}
                    onClose={() => setOpenStop(null)} />
                )}
              </div>
            ))}
          </div>
          <button className="btn-add" style={{ marginTop: 8 }}
            onClick={() => onChange({ ...grad, stops: [...grad.stops, { color: 'accent', position: 100 }] })}>
            <Plus />Add stop
          </button>
          <code style={{ display: 'block', marginTop: 12, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', wordBreak: 'break-all' }}>{css}</code>
        </div>
      </Expand>
    </div>
  )
}

export default function ColorPanel() {
  const { state, derived, set } = useStore()
  const { color } = state
  const { ramps } = derived
  const [openSeed, setOpenSeed] = useState(null)
  /* Which strip swatch has the full picker open, and the element it hangs
     from. `{ id, el }` rather than two states, because they are one fact. */
  const [pick, setPick] = useState(null)
  const [harmony, setHarmony] = useState('analogous')
  const [intensity, setIntensity] = useState('balanced')

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
    const next = generatePalette(c.seeds, harmony, intensity)
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
  const stopOptions = paletteGroups({ seeds: color.seeds, roles: derived.roles[color.mode], ramps, rampSteps: RAMP_STEPS, resolveRef: resolveStopHex })
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionHeader title="Colour" desc="Pick a few seeds; the scales generate from them. Roles are on the next tab." />

      <Collapsible title="Seeds" note={`${color.seeds.length}${lockedCount ? ` · ${lockedCount} locked` : ''}`} defaultOpen>
        {/* Generator, inline rather than on its own screen — locking a colour
            and re-rolling the rest is a loop you want to stay inside. */}
        <div style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: PAD.card, marginBottom: 12 }}>
          <div className="dense form-stack" style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>Generate a palette</span>
            <select value={intensity} onChange={e => setIntensity(e.target.value)}
              title="How saturated the run is — and how much colour the neutral carries, which is what tints the page"
              style={{ width: 'auto' }}>
              {INTENSITIES.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
            <select value={harmony} onChange={e => setHarmony(e.target.value)}
              style={{ width: 'auto' }}>
              {HARMONIES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
            </select>
            <button className="btn-primary btn-field" onClick={roll} style={{ whiteSpace: 'nowrap' }}>
              Generate
            </button>
          </div>
          {/* A SWATCH IS A COLOUR, SO CLICKING IT EDITS THE COLOUR.
              It used to toggle the lock, which is a different decision about
              the same object, and nothing on the swatch said so. The lock now
              has its own control under each swatch, where a padlock reads as a
              padlock instead of as an overlay that appears on hover. */}
          <div style={{ display: 'flex', gap: STRIP_GAP, height: 64, borderRadius: 6, overflow: 'hidden', marginBottom: STRIP_GAP }}>
            {color.seeds.map(s => (
              <button key={s.id} onClick={e => setPick({ id: s.id, el: e.currentTarget })}
                title={`${s.name}. Click to edit ${s.hex}`}
                style={{
                  /* 96 is the intended swatch, and the basis states it. The
                     PAINTED width is the strip's width less its gaps, over
                     five: the palette is one rounded bar cut into five, so
                     it stays flush to both edges rather than holding a fixed
                     96 and leaving a hole at the end. At a 496px strip the
                     two agree exactly; at 511 the swatch renders 99. */
                  flex: SEED_BASIS, background: s.hex, border: 'none', cursor: 'pointer', padding: 0,
                  outline: s.locked ? '2px solid var(--accent)' : 'none', outlineOffset: -2,
                }} />
            ))}
          </div>

          {/* THE LOCK ROW. Each cell takes the same basis as the swatch above
              it, so the button centres under its own colour. The button itself
              is square and 24px: an icon-only control is 1:1, and 24 is the
              floor where a click stops being an act of marksmanship. */}
          <div style={{ display: 'flex', gap: STRIP_GAP, marginBottom: 8 }}>
            {color.seeds.map(s => (
              <div key={s.id} style={{ flex: SEED_BASIS, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                <button onClick={() => toggleLock(s.id)} className="seed-lock"
                  aria-pressed={!!s.locked}
                  aria-label={`${s.name}: ${s.locked ? 'locked, click to release' : 'unlocked, click to lock'}`}
                  title={`${s.name}. ${s.locked ? 'Locked, so the generator will leave it alone' : 'Unlocked, so the generator may replace it'}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    width: 24, height: 24, aspectRatio: '1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.locked ? 'var(--accent)' : 'var(--dim)',
                    transition: 'color var(--t) var(--ease)',
                  }}>
                  <Lock locked={s.locked} size={14} />
                </button>
              </div>
            ))}
          </div>
          {pick && color.seeds.some(s => s.id === pick.id) && (
            <SeedPickerPop seed={color.seeds.find(s => s.id === pick.id)} anchor={pick.el}
              onChange={hex => setSeed(pick.id, hex)} onClose={() => setPick(null)} />
          )}

          <p className="panel-note">
            Click a swatch to edit it, or lock the ones you like and generate again. Locked colours anchor the hue and weight of everything else.
            Status seeds stay inside the hue bands that still read as success, warning and danger.
            {' '}<strong style={{ color: 'var(--text-dim)', fontWeight: 500 }}>The page background comes from the neutral seed</strong>,
            not the accent — so a deep blue or oxblood interface starts by giving <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>neutral</code> that
            colour, or by running the generator on <strong style={{ color: 'var(--text-dim)', fontWeight: 500 }}>Vivid</strong>, which lets the neutral carry real chroma.
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
        <button className="btn-add" onClick={addSeed}><Plus />Add Seed</button>
        <datalist id="dmd-seed-names">
          {SEED_NAME_SUGGESTIONS.filter(n => !color.seeds.some(s => s.name === n)).map(n => <option key={n} value={n} />)}
        </datalist>
      </Collapsible>

      <Collapsible title="Scale Shape" note="advanced">
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
        <div style={{ marginTop: 12 }}>
          <Toggle label="Pin seed colours into their scale" checked={color.shape.anchorSeed}
            onChange={v => setShape('anchorSeed', v)}
            desc="Keeps your exact brand hex present rather than approximated" />
        </div>
      </Collapsible>

      <Collapsible title="Generated Scales" note={stepOverrides ? `${stepOverrides} overridden` : `${Object.keys(ramps).length}`} defaultOpen>
        <p className="panel-note" style={{ marginBottom: 12 }}>Click any step to override it.</p>
        {Object.entries(ramps).map(([name, ramp]) => (
          <RampRow key={name} name={name} ramp={ramp} overrides={color.stepOverrides ?? {}}
            onOverride={setStepOverride} onResetStep={resetStep} />
        ))}
      </Collapsible>

      <Collapsible title="Gradients" note={String(color.gradients?.length ?? 0)}>
        <Banner tone="info">
          A gradient is a CSS <em>image</em>, not a colour, so it can't be a <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>colors</code> token —
          the spec's map takes colour values. Gradients are written into the Colors section as a table instead, and reach the preview as CSS variables.
        </Banner>
        <p className="panel-note" style={{ margin: '12px 0' }}>
          Stops take a role name (<code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>accent</code>), a scale step
          (<code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>accent.400</code>) or a literal hex — so a gradient tracks the palette rather than freezing it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!color.gradients?.length && (
            <div style={{ textAlign: 'center', padding: '20px 12px', color: 'var(--dim)', fontSize: 12, border: '1px dashed var(--bdr)', borderRadius: 8 }}>
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
        <button className="btn-add" onClick={addGradient}><Plus />Add gradient</button>
        <p className="panel-note" style={{ marginTop: 12 }}>
          Gradient <strong>strokes</strong> have no direct CSS property. They need
          <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}> border-image</code>, or a two-layer background with
          <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}> background-clip</code>. That technique note is written into the file so an agent doesn't invent one.
        </p>
      </Collapsible>

      <Collapsible title="What Gets Exported">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Toggle label="Include the numbered scales" checked={color.emitRamps}
            onChange={v => upd(c => ({ ...c, emitRamps: v }))}
            desc="Adds accent-50 … neutral-950 alongside the semantic roles" />
          <Toggle label="Include dark mode" checked={color.emitDark}
            onChange={v => upd(c => ({ ...c, emitDark: v }))}
            desc="Emits a dark- prefixed counterpart for every role" />
        </div>
      </Collapsible>

      {color.custom?.length > 0 && (
        <Collapsible title="Custom Tokens" note={String(color.custom.length)}>
          <p className="panel-note" style={{ marginBottom: 8 }}>Carried over from an imported file. Emitted verbatim.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {color.custom.map(c => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 8, alignItems: 'center' }}>
                <div className="swatch" style={{ width: 20, height: 20, background: isValidColor(c.value) ? c.value : '#555' }} />
                <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{c.name}</code>
                <code style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>{c.value}</code>
                <ConfirmDelete onConfirm={() => upd(x => ({ ...x, custom: x.custom.filter(k => k.id !== c.id) }))} title="Remove token" />
              </div>
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  )
}
