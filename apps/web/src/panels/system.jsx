/* Layout, Shape, and Depth & Motion.

   All three follow the same pattern: a generated scale driven by a base value
   and its macro slider, with an override field per step. The override input
   shows the generated value as its placeholder, so it's always obvious what
   you're departing from. */
import { useRef, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { ICON_LIBRARIES } from '../state/schema.js'
import { resolveRef, RAMP_STEPS } from '../color/ramp.js'
import BezierEditor from '../ui/BezierEditor.jsx'
import TokenColorPicker, { paletteGroups } from '../ui/TokenColorPicker.jsx'
import { SectionHeader, Collapsible, Slider, NumField, Segmented, Toggle, OverrideBadge, Banner, PAD } from '../ui/controls.jsx'

/* A colour that is stored as a palette reference.
 *
 * Two of these were missing entirely. The shadow tint was a read-only swatch
 * captioned "not black", which stated the point of the feature while offering
 * no way to act on it, and the scrim was a select listing four steps per ramp
 * out of eleven. Both are ordinary colour choices and both now open the same
 * picker every other colour in the app uses, so there is one way to choose a
 * colour rather than three.
 */
function RefSwatch({ value, hex, groups, onPick, label }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} className="swatch" onClick={() => setOpen(true)}
        title={`${label} — ${value}`}
        style={{ width: 22, height: 22, background: hex, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
      {open && (
        <TokenColorPicker value={value} resolved={hex} groups={groups} anchor={ref.current}
          onPick={next => { onPick(next); setOpen(false) }} onClose={() => setOpen(false)}
          note="Stored as a reference, so it follows the palette when the scale regenerates." />
      )}
    </>
  )
}

export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light',
  'darken', 'lighten', 'color-burn', 'color-dodge', 'difference', 'luminosity',
]

/* Shared: a generated scale with per-step overrides. */
function ScaleRows({ items, overrides, onOverride, onReset, unit = 'px' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {items.map(item => {
        const set = overrides?.[item.name] != null
        return (
          <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 92px 22px', gap: 8, alignItems: 'center' }}>
            <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{item.name}</code>
            <div style={{ height: 10, background: 'var(--surf3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: item.pill ? '100%' : `${Math.min(100, (parseFloat(item.value) || 0) / 0.96)}%`,
                background: set ? 'var(--accent)' : 'var(--bdr2)', borderRadius: 3,
              }} />
            </div>
            <input value={overrides?.[item.name] ?? ''} placeholder={item.value}
              onChange={e => onOverride(item.name, e.target.value)}
              disabled={item.pill}
              style={{
                fontFamily: 'var(--mono)', fontSize: 11, padding: '4px 7px', textAlign: 'right',
                color: set ? 'var(--accent)' : 'var(--muted)',
                borderColor: set ? 'rgb(var(--accent-rgb) / .4)' : 'var(--bdr)',
                opacity: item.pill ? 0.5 : 1,
              }} />
            <span>{set && <OverrideBadge onReset={() => onReset(item.name)} />}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Layout ── */
export function LayoutPanel() {
  const { state, derived, set } = useStore()
  const upd = (key, fn, tag) => set(s => ({ ...s, [key]: fn(s[key]) }), tag)

  const setOverride = (name, value) => upd('space', c => {
    const next = { ...c.overrides }
    if (value === '') delete next[name]; else next[name] = value
    return { ...c, overrides: next }
  }, `sp-ov:${name}`)
  const resetStep = name => upd('space', c => { const n = { ...c.overrides }; delete n[name]; return { ...c, overrides: n } })
  const setLayout = (k, v) => upd('layout', l => ({ ...l, [k]: v }), `layout:${k}`)
  const setBreakpoint = (i, px) => upd('layout', l => ({ ...l, breakpoints: l.breakpoints.map((b, j) => j === i ? { ...b, px } : b) }), `bp:${i}`)
  const setContainer = (name, px) => upd('layout', l => ({ ...l, containers: { ...l.containers, [name]: px } }), `ct:${name}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Layout" desc="One spacing scale, one grid. The Density macro moves the whole scale." />

      <Collapsible title="Spacing scale" note={`${state.space.base}px base`} defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
          <NumField label="Base unit" value={state.space.base} min={2} max={8} suffix="px" width={104}
            onChange={v => upd('space', c => ({ ...c, base: v }), 'space:base')} />
          <p className="panel-note" style={{ flex: 1, marginTop: 14 }}>Every step is a multiple of this.</p>
        </div>
        <ScaleRows items={derived.spacing} overrides={state.space.overrides} onOverride={setOverride} onReset={resetStep} />
      </Collapsible>

      <Collapsible title="Breakpoints and containers" note={`${state.layout.breakpoints.length}`} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.layout.breakpoints.map((b, i) => (
            <div key={b.name} style={{ display: 'grid', gridTemplateColumns: '46px 1fr 1fr', gap: 8, alignItems: 'center' }}>
              <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{b.name}</code>
              <NumField value={b.px} min={320} max={2560} suffix="px" onChange={v => setBreakpoint(i, v)} />
              <NumField value={state.layout.containers?.[b.name] ?? 0} min={0} max={2560} suffix="max" onChange={v => setContainer(b.name, v)} />
            </div>
          ))}
        </div>
        <p className="panel-note" style={{ marginTop: 9 }}>Left column is the breakpoint min-width, right is the container width inside it.</p>
      </Collapsible>

      <Collapsible title="Grid" note={`${state.layout.columns} col`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <NumField label="Columns" value={state.layout.columns} min={1} max={24} onChange={v => setLayout('columns', v)} />
          <div>
            <label>Gutter</label>
            <select value={state.layout.gutter} onChange={e => setLayout('gutter', e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
              {derived.spacing.map(s => <option key={s.name} value={s.name}>{s.name} — {s.value}</option>)}
            </select>
          </div>
          <NumField label="Max measure" value={state.layout.maxMeasure} min={40} max={110} suffix="ch" onChange={v => setLayout('maxMeasure', v)} />
        </div>
      </Collapsible>
    </div>
  )
}

/* ── Shape ── */
export function ShapePanel() {
  const { state, derived, set } = useStore()
  const upd = (key, fn, tag) => set(s => ({ ...s, [key]: fn(s[key]) }), tag)

  const setOverride = (name, value) => upd('radius', c => {
    const next = { ...c.overrides }
    if (value === '') delete next[name]; else next[name] = value
    return { ...c, overrides: next }
  }, `rd-ov:${name}`)
  const resetStep = name => upd('radius', c => { const n = { ...c.overrides }; delete n[name]; return { ...c, overrides: n } })
  const setBorder = (k, v) => upd('radius', c => ({ ...c, borderWidths: { ...c.borderWidths, [k]: v } }), `bw:${k}`)
  const setFocus = (k, v) => upd('focus', f => ({ ...f, [k]: v }), `focus:${k}`)
  const setIcons = (k, v) => upd('icons', ic => ({ ...ic, [k]: v }), `icons:${k}`)
  const setIconSize = (k, v) => upd('icons', ic => ({ ...ic, sizes: { ...ic.sizes, [k]: v } }), `icsz:${k}`)
  const setStates = (k, v) => upd('states', st => ({ ...st, [k]: v }), `states:${k}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Shape" desc="Radii, borders, icons and focus — the details agents most often invent." />

      <Collapsible title="Corner radius" note={`${state.radius.base}px base`} defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
          <NumField label="Base radius" value={state.radius.base} min={0} max={24} suffix="px" width={104}
            onChange={v => upd('radius', c => ({ ...c, base: v }), 'radius:base')} />
          <div className="preview-box" style={{ display: 'flex', gap: 6, marginTop: 16, padding: '7px 9px' }}>
            {derived.rounded.slice(0, 5).map(r => (
              <div key={r.name} title={`${r.name} — ${r.value}`}
                style={{ width: 26, height: 26, background: 'var(--surf3)', border: '1px solid var(--bdr2)', borderRadius: r.value }} />
            ))}
          </div>
        </div>
        <ScaleRows items={derived.rounded} overrides={state.radius.overrides} onOverride={setOverride} onReset={resetStep} />
        <div style={{ marginTop: 12 }}>
          <Toggle label="Document the radius nesting rule" checked={state.radius.nesting}
            onChange={v => upd('radius', c => ({ ...c, nesting: v }))}
            desc="Inner radius = outer radius − padding. Concentric corners look wrong otherwise." />
        </div>
      </Collapsible>

      <Collapsible title="Border widths">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {Object.entries(state.radius.borderWidths ?? {}).map(([k, v]) => (
            <NumField key={k} label={k} value={v} min={0} max={8} step={0.5} suffix="px" onChange={n => setBorder(k, n)} />
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Iconography" note={state.icons.library} defaultOpen>
        <div style={{ marginBottom: 11 }}>
          <label>Library</label>
          <select value={state.icons.library} onChange={e => setIcons('library', e.target.value)} style={{ fontSize: 12.5, padding: '6px 8px' }}>
            {ICON_LIBRARIES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <Slider label="Stroke width" value={state.icons.strokeWidth} onChange={v => setIcons('strokeWidth', v)}
          min={1} max={3} step={0.25} defaultValue={1.75} format={v => `${v}`} />
        <div className="preview-box" style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '4px 0 12px', padding: '12px 14px' }}>
          {Object.entries(state.icons.sizes).map(([k, px]) => (
            <svg key={k} width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
              strokeWidth={state.icons.strokeWidth} strokeLinecap={state.icons.joinStyle} strokeLinejoin={state.icons.joinStyle}>
              <circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" />
            </svg>
          ))}
          <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>live at each size</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
          {Object.entries(state.icons.sizes).map(([k, v]) => (
            <NumField key={k} label={k} value={v} min={10} max={48} suffix="px" onChange={n => setIconSize(k, n)} />
          ))}
        </div>
        <Segmented value={state.icons.joinStyle} onChange={v => setIcons('joinStyle', v)} size="sm"
          options={[{ value: 'round', label: 'Round joins' }, { value: 'square', label: 'Square' }, { value: 'miter', label: 'Miter' }]} />

        <div style={{ marginTop: 14 }}>
          <label>Icon-to-label gap</label>
          <p className="panel-note" style={{ marginBottom: 7 }}>
            The space between an icon and its text — in buttons, menu items, list rows, labels, anywhere the two pair up.
          </p>
          <Segmented value={state.icons.gap ?? 'xs'} onChange={v => setIcons('gap', v)} size="sm"
            options={derived.spacing.slice(0, 6).map(s => ({ value: s.name, label: `${s.name} · ${s.value}` }))} />
          <div className="preview-box" style={{ marginTop: 10, padding: '10px 12px', display: 'flex', gap: 14, alignItems: 'center' }}>
            {['left', 'right', 'only'].map(pos => (
              <div key={pos} style={{
                display: 'inline-flex', alignItems: 'center',
                gap: derived.spacing.find(s => s.name === (state.icons.gap ?? 'xs'))?.value ?? '8px',
                padding: '6px 12px', borderRadius: derived.rounded.find(r => r.name === 'md')?.value ?? '8px',
                background: derived.roles[state.color.mode].accent, color: derived.roles[state.color.mode]['accent-fg'],
                fontSize: 12,
              }}>
                {pos !== 'right' && (
                  <svg width={state.icons.sizes.md} height={state.icons.sizes.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={state.icons.strokeWidth} strokeLinecap={state.icons.joinStyle} strokeLinejoin={state.icons.joinStyle}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
                {pos !== 'only' && <span>Label</span>}
                {pos === 'right' && (
                  <svg width={state.icons.sizes.md} height={state.icons.sizes.md} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={state.icons.strokeWidth} strokeLinecap={state.icons.joinStyle} strokeLinejoin={state.icons.joinStyle}>
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Focus and states" defaultOpen>
        <Banner tone="info">Focus rings are the single most consistently omitted detail in generated UI. Specifying one here means it appears.</Banner>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '11px 0' }}>
          <NumField label="Ring width" value={state.focus.width} min={1} max={6} suffix="px" onChange={v => setFocus('width', v)} />
          <NumField label="Offset" value={state.focus.offset} min={0} max={8} suffix="px" onChange={v => setFocus('offset', v)} />
          <div>
            <label>Style</label>
            <select value={state.focus.style} onChange={e => setFocus('style', e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }}>
              {['solid', 'dashed', 'double'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="preview-box" style={{ padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            padding: '7px 15px', background: derived.roles[state.color.mode].accent, color: derived.roles[state.color.mode]['accent-fg'],
            borderRadius: derived.rounded.find(r => r.name === 'md')?.value ?? '8px', fontSize: 13,
            outline: `${state.focus.width}px ${state.focus.style} ${derived.roles[state.color.mode][state.focus.role]}`,
            outlineOffset: `${state.focus.offset}px`,
          }}>Focused button</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <NumField label="Disabled opacity" value={state.states.disabledOpacity} min={0.2} max={0.9} step={0.05} onChange={v => setStates('disabledOpacity', v)} />
          <NumField label="Min touch target" value={state.states.touchTarget} min={24} max={60} suffix="px" onChange={v => setStates('touchTarget', v)} />
        </div>
      </Collapsible>
    </div>
  )
}

/* ── Depth & Motion ── */
const MOTION_PRESETS = {
  snappy: {
    durations: { instant: 0, fast: 75, normal: 150, slow: 300 },
    easings: { standard: 'cubic-bezier(0.3, 0, 0.1, 1)', entrance: 'cubic-bezier(0, 0, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 1, 1)', emphasis: 'cubic-bezier(0.2, 0, 0, 1)' },
  },
  smooth: {
    durations: { instant: 0, fast: 125, normal: 250, slow: 500 },
    easings: { standard: 'cubic-bezier(0.2, 0, 0, 1)', entrance: 'cubic-bezier(0, 0, 0, 1)', exit: 'cubic-bezier(0.3, 0, 1, 1)', emphasis: 'cubic-bezier(0.3, 0, 0, 1.2)' },
  },
  bouncy: {
    durations: { instant: 0, fast: 175, normal: 350, slow: 650 },
    easings: { standard: 'cubic-bezier(0.34, 1.4, 0.64, 1)', entrance: 'cubic-bezier(0.16, 1.3, 0.3, 1)', exit: 'cubic-bezier(0.5, 0, 0.75, 0)', emphasis: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  },
}

export function DepthPanel() {
  const { state, derived, set } = useStore()
  const upd = (key, fn, tag) => set(s => ({ ...s, [key]: fn(s[key]) }), tag)
  const setElev = (k, v) => upd('elevation', e => ({ ...e, [k]: v }), `elev:${k}`)

  const mode = state.color.mode
  const roles = derived.roles[mode]

  /* Every seed, role and scale step, the same set the gradient stops and the
     component properties offer. A shadow tint and a scrim are colour choices
     like any other and should not have a shorter menu than the rest. */
  const swatchGroups = paletteGroups({
    seeds: state.color.seeds, roles, ramps: derived.ramps, rampSteps: RAMP_STEPS,
    resolveRef: ref => resolveRef(ref, derived.ramps),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Depth" desc="How surfaces separate from one another." />

      <Collapsible title="Elevation" note={state.elevation.strategy} defaultOpen>
        <Segmented value={state.elevation.strategy} onChange={v => setElev('strategy', v)}
          options={[{ value: 'shadow', label: 'Shadows' }, { value: 'border', label: 'Borders' }, { value: 'tonal', label: 'Tonal' }]} />
        <p className="panel-note" style={{ marginTop: 8 }}>
          {state.elevation.strategy === 'shadow' && 'Surfaces lift with layered, tinted shadows.'}
          {state.elevation.strategy === 'border' && 'A flat system — surfaces are separated by borders only. No shadows are emitted.'}
          {state.elevation.strategy === 'tonal' && 'Surfaces separate by changing colour rather than casting shadows. No shadows are emitted.'}
        </p>

        <div className="preview-box" style={{ display: 'flex', gap: 12, margin: '14px 0', padding: 16, background: roles.bg }}>
          {Object.entries(derived.elevation).map(([name, shadow]) => (
            <div key={name} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 42, background: name === 'flat' ? roles.surface : roles['surface-raised'],
                borderRadius: 6, boxShadow: shadow === 'none' ? 'none' : shadow,
                border: state.elevation.strategy === 'border' ? `1px solid ${roles.border}` : `1px solid ${roles['border-subtle']}`,
                marginBottom: 5,
              }} />
              <span style={{ fontSize: 9.5, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>{name}</span>
            </div>
          ))}
        </div>

        {state.elevation.strategy === 'shadow' && (
          <>
            <Slider label="Tint strength" desc="How much of the neutral hue carries into the shadow"
              value={state.elevation.tintStrength} onChange={v => setElev('tintStrength', v)}
              min={0} max={2} step={0.05} defaultValue={1} format={v => `${v.toFixed(2)}×`} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--muted)' }}>
              <span>Tinted with</span>
              <RefSwatch label="Shadow tint" value={state.elevation.tintRole ?? 'neutral.950'}
                hex={derived.shadowHex} groups={swatchGroups}
                onPick={ref => setElev('tintRole', ref)} />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{state.elevation.tintRole ?? 'neutral.950'}</code>
              <span style={{ color: 'var(--dim)' }}>not black</span>
            </div>
          </>
        )}
        <div style={{ marginTop: 12 }}>
          <Toggle label="Dark mode raises surfaces instead of deepening shadows"
            checked={state.elevation.darkStrategy === 'lighten'}
            onChange={v => setElev('darkStrategy', v ? 'lighten' : 'shadow')}
            desc="Shadows barely register on a dark background — real systems lighten the surface" />
        </div>
      </Collapsible>

      {/* Blend mode.
          CSS `box-shadow` takes no blend mode, so this cannot be faked onto a
          shadow — it governs composited layers (scrims, overlays, tinted
          surfaces) and is emitted as guidance for anything that composites. */}
      <Collapsible title="Blending" note={state.elevation.blendMode === 'normal' && state.elevation.fillBlend === 'normal' ? 'normal' : 'set'}>
        <Banner tone="info">
          Blending is per-property in CSS, not global. <strong>Fills</strong> can blend with what's behind them
          (<code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>mix-blend-mode</code>), and so can
          <strong> overlays and scrims</strong>. <strong>Borders and shadows cannot</strong> — there is no
          <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}> border-blend-mode</code>, and
          <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}> box-shadow</code> renders unblended. So
          there are two controls here rather than four.
        </Banner>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0' }}>
          <div>
            <label>Overlays and scrims</label>
            <select value={state.elevation.blendMode} onChange={e => setElev('blendMode', e.target.value)} style={{ fontSize: 12.5, padding: '6px 8px' }}>
              {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label>Filled surfaces</label>
            <select value={state.elevation.fillBlend ?? 'normal'} onChange={e => setElev('fillBlend', e.target.value)} style={{ fontSize: 12.5, padding: '6px 8px' }}>
              {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {state.elevation.fillBlend !== 'normal' && (
          <p className="panel-note" style={{ marginBottom: 12 }}>
            A blended fill affects its own text too unless the element sets <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>isolation: isolate</code>.
            That caveat is written into the exported file alongside the value.
          </p>
        )}

        {/* Filled elements over a patterned ground, where a blend is visible. */}
        <div className="preview-box" style={{ padding: 14, marginBottom: 12, background: roles.bg, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `repeating-linear-gradient(45deg, ${roles['bg-subtle']} 0 12px, ${roles.bg} 12px 24px)`,
          }} />
          <div style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'center' }}>
            {[roles.accent, roles.success, roles.danger].map((bg, i) => (
              <div key={i} style={{
                padding: '7px 14px', background: bg, color: roles['accent-fg'],
                borderRadius: derived.rounded.find(r => r.name === 'md')?.value ?? '8px',
                fontSize: 12, mixBlendMode: state.elevation.fillBlend ?? 'normal',
              }}>Filled</div>
            ))}
            <span style={{ fontSize: 10.5, color: 'var(--dim)', marginLeft: 'auto' }}>
              {state.elevation.fillBlend === 'normal' ? 'no blend' : state.elevation.fillBlend}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <NumField label="Scrim opacity" value={state.elevation.scrim?.opacity ?? 0.55} min={0} max={1} step={0.05}
            onChange={v => setElev('scrim', { ...state.elevation.scrim, opacity: v })} />
          <NumField label="Scrim blur" value={state.elevation.scrim?.blur ?? 0} min={0} max={24} suffix="px"
            onChange={v => setElev('scrim', { ...state.elevation.scrim, blur: v })} />
          <div>
            <label>Scrim colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 32 }}>
              <RefSwatch label="Scrim colour" value={state.elevation.scrim?.color ?? 'neutral.950'}
                hex={derived.scrimColor} groups={swatchGroups}
                onPick={ref => setElev('scrim', { ...state.elevation.scrim, color: ref })} />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {state.elevation.scrim?.color ?? 'neutral.950'}
              </code>
            </div>
          </div>
        </div>

        {/* A modal over content — the case where the blend mode is visible. */}
        <div className="preview-box" style={{ position: 'relative', height: 116, overflow: 'hidden', background: roles.bg }}>
          <div style={{ padding: 12 }}>
            <div style={{ height: 9, width: '62%', background: roles['border-strong'], borderRadius: 3, marginBottom: 7 }} />
            <div style={{ height: 9, width: '84%', background: roles.border, borderRadius: 3, marginBottom: 7 }} />
            <div style={{ height: 9, width: '45%', background: roles.border, borderRadius: 3 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <div style={{ width: 54, height: 22, background: roles.accent, borderRadius: 5 }} />
              <div style={{ width: 54, height: 22, background: roles['accent-subtle'], borderRadius: 5 }} />
            </div>
          </div>
          <div style={{
            position: 'absolute', inset: 0,
            background: derived.scrimColor,
            opacity: state.elevation.scrim?.opacity ?? 0.55,
            mixBlendMode: state.elevation.blendMode,
            backdropFilter: state.elevation.scrim?.blur ? `blur(${state.elevation.scrim.blur}px)` : undefined,
          }} />
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            background: roles['surface-raised'], color: roles.text,
            padding: '10px 16px', borderRadius: 8, fontSize: 12,
            boxShadow: derived.elevation.modal === 'none' ? 'none' : derived.elevation.modal,
            border: `1px solid ${roles['border-subtle']}`,
          }}>Modal over a scrim</div>
        </div>
      </Collapsible>
    </div>
  )
}

/* ── Motion ──
   Its own panel. It has nothing to do with how surfaces stack; it was only
   sharing a tab with elevation because both were small at the time. */
export function MotionPanel() {
  const { state, derived, set } = useStore()
  const upd = (key, fn, tag) => set(s => ({ ...s, [key]: fn(s[key]) }), tag)
  const setDuration = (k, v) => upd('motion', m => ({ ...m, durations: { ...m.durations, [k]: v } }), `dur:${k}`)
  const setEasing = (k, v) => upd('motion', m => ({ ...m, easings: { ...m.easings, [k]: v } }), `ease:${k}`)
  const applyPreset = name => upd('motion', m => ({ ...m, personality: name, ...MOTION_PRESETS[name] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Motion" desc="How quickly anything moves, and along what curve." />

      <Collapsible title="Durations" note={state.motion.personality} defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>Personality</span>
          <Segmented value={state.motion.personality} onChange={applyPreset} size="sm"
            options={['snappy', 'smooth', 'bouncy']} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 13 }}>
          {Object.entries(state.motion.durations).map(([k, v]) => (
            <NumField key={k} label={k} value={v} min={0} max={1200} step={10} suffix="ms" onChange={n => setDuration(k, n)} />
          ))}
        </div>
        <p className="panel-note" style={{ marginBottom: 9 }}>
          Emitted values include the Motion macro (×{state.macros.speed.toFixed(2)}): {Object.entries(derived.motion.durations).map(([k, v]) => `${k} ${v}`).join(' · ')}
        </p>
        {Object.entries(state.motion.easings).map(([k, v]) => (
          <Collapsible key={k} title={k} note={v.replace('cubic-bezier', '').replace(/[()]/g, '').slice(0, 22)}>
            <BezierEditor value={v} onChange={next => setEasing(k, next)} duration={derived.motion.durations.normal} />
          </Collapsible>
        ))}
        <div style={{ marginTop: 12 }}>
          <label>Reduced motion</label>
          <Segmented value={state.motion.reducedMotion} onChange={v => upd('motion', m => ({ ...m, reducedMotion: v }))} size="sm"
            options={[{ value: 'crossfade', label: 'Cross-fade' }, { value: 'none', label: 'No transition' }]} />
        </div>
      </Collapsible>
    </div>
  )
}
