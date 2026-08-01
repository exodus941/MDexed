/* Typography: three families, one modular scale, and per-token escape hatches.

   Sizes, leading and tracking are all generated. The per-token editors exist
   for the cases where a scale genuinely shouldn't win, and anything you touch
   is marked so you can see at a glance how far the system has been bent. */
import { useEffect, useRef } from 'react'
import { useStore } from '../state/store.jsx'
import { RATIOS, OPENTYPE_FEATURES } from '../type/scale.js'
import { loadDocumentFonts, stackFor } from '../type/fonts.js'
import FontPicker, { useFontCatalog } from '../ui/FontPicker.jsx'
import { SectionHeader, Collapsible, Slider, NumField, Segmented, Toggle, OverrideBadge, Banner } from '../ui/controls.jsx'

const ROLE_LABELS = { display: 'Display', body: 'Body', mono: 'Mono' }
const ROLE_DESC = {
  display: 'Headings and display sizes',
  body: 'Body copy, labels, UI text',
  mono: 'Code, figures, technical values',
}

/* Variable axes come from the font's own metadata, so the controls match what
   the typeface actually supports rather than a fixed guess. */
function AxisControls({ familyMeta, values, onChange }) {
  const axes = (familyMeta?.axes ?? []).filter(a => a.tag !== 'ital')
  if (!axes.length) return <div style={{ fontSize: 11, color: 'var(--dim)' }}>Not a variable font — no axes to adjust.</div>
  return (
    <div>
      {axes.map(axis => (
        <Slider key={axis.tag}
          label={`${axis.tag}${axis.tag === 'wght' ? ' (weight)' : axis.tag === 'wdth' ? ' (width)' : axis.tag === 'opsz' ? ' (optical size)' : ''}`}
          value={values?.[axis.tag] ?? axis.default ?? axis.start}
          min={axis.start} max={axis.end} step={(axis.end - axis.start) > 20 ? 1 : 0.1}
          defaultValue={axis.default ?? axis.start}
          onChange={v => onChange(axis.tag, v)}
          format={v => String(Math.round(v * 10) / 10)} />
      ))}
    </div>
  )
}

function FeatureToggles({ enabled, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {OPENTYPE_FEATURES.map(f => (
        <Toggle key={f.tag} label={<span style={{ fontSize: 12 }}>{f.label} <code style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>{f.tag}</code></span>}
          checked={enabled.includes(f.tag)} onChange={() => onToggle(f.tag)} />
      ))}
    </div>
  )
}

function TokenRow({ token, overrides, onOverride, onReset, families, inspect }) {
  const rowRef = useRef(null)
  const targeted = inspect?.entry === token.name

  useEffect(() => {
    if (!targeted) return
    const id = requestAnimationFrame(() => rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    const t = setTimeout(() => rowRef.current?.scrollIntoView({ block: 'center' }), 120)
    return () => { cancelAnimationFrame(id); clearTimeout(t) }
  }, [targeted, inspect?.at])

  const fields = [
    { k: 'fontSize', label: 'Size' },
    { k: 'fontWeight', label: 'Weight' },
    { k: 'lineHeight', label: 'Leading' },
    { k: 'letterSpacing', label: 'Tracking' },
  ]
  const anyOverride = fields.some(f => overrides[`${token.name}.${f.k}`] != null)
  const stack = families[token.family]?.stack ?? 'inherit'

  return (
    <div ref={rowRef} style={{
      borderBottom: '1px solid var(--bdr)', padding: '8px 0',
      ...(targeted && { background: 'rgba(220,144,85,.07)', boxShadow: '0 0 0 1px rgba(220,144,85,.45)', borderRadius: 7, padding: '8px' }),
      transition: 'background var(--t) var(--ease)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 6 }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text)', minWidth: 64 }}>{token.name}</code>
        <span className="preview-box"
          style={{
            flex: 1, fontFamily: stack, fontSize: Math.min(24, token.computedPx),
            fontWeight: token.fontWeight, letterSpacing: token.letterSpacing,
            color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            padding: '3px 8px', lineHeight: 1.35,
          }}>
          Ag — the quick brown fox
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim)' }}>{token.computedPx}px</span>
        {anyOverride && <OverrideBadge onReset={() => onReset(token.name)} title="Reset this token to the scale" />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {fields.map(f => {
          const key = `${token.name}.${f.k}`
          const set = overrides[key] != null
          return (
            <input key={f.k} value={overrides[key] ?? token[f.k] ?? ''} placeholder={String(token[f.k] ?? '')}
              onChange={e => onOverride(key, e.target.value)}
              title={set ? 'Overridden' : 'Generated — type to override'}
              style={{
                fontFamily: 'var(--mono)', fontSize: 11, padding: '4px 6px',
                color: set ? 'var(--accent)' : 'var(--muted)',
                borderColor: set ? 'rgba(220,144,85,.4)' : 'var(--bdr)',
              }} />
          )
        })}
      </div>
    </div>
  )
}

export default function TypographyPanel({ inspect }) {
  const { state, derived, set } = useStore()
  const t = state.type
  const { families: catalog, loading } = useFontCatalog()

  useEffect(() => { loadDocumentFonts(t.families, catalog) }, [t.families, catalog])

  const upd = (fn, tag) => set(s => ({ ...s, type: fn(s.type) }), tag)
  const setFamily = (role, fam) => upd(c => ({
    ...c,
    families: { ...c.families, [role]: { family: fam.family, category: fam.category } },
    axes: { ...c.axes, [role]: {} },   // axis values don't carry across typefaces
  }))
  const setAxis = (role, tag, v) => upd(c => ({ ...c, axes: { ...c.axes, [role]: { ...c.axes[role], [tag]: v } } }), `axis:${role}:${tag}`)
  const toggleFeature = (role, tag) => upd(c => {
    const list = c.features[role] ?? []
    return { ...c, features: { ...c.features, [role]: list.includes(tag) ? list.filter(x => x !== tag) : [...list, tag] } }
  })
  const setField = (k, v) => upd(c => ({ ...c, [k]: v }), `type:${k}`)
  const setFluid = (k, v) => upd(c => ({ ...c, fluid: { ...c.fluid, [k]: v } }), `fluid:${k}`)
  const setOverride = (key, value) => upd(c => {
    const next = { ...c.overrides }
    if (value === '') delete next[key]
    else next[key] = value
    return { ...c, overrides: next }
  }, `ty-ov:${key}`)
  const resetToken = name => upd(c => ({
    ...c,
    overrides: Object.fromEntries(Object.entries(c.overrides).filter(([k]) => !k.startsWith(`${name}.`))),
  }))

  const overrideCount = Object.keys(t.overrides ?? {}).length
  const generated = derived.typography.filter(x => !x.custom)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Typography" desc="Three families and one modular scale generate every text style."
        right={overrideCount > 0 ? <span className="chip">{overrideCount} overridden</span> : null} />

      <Collapsible title="Families" note={t.families.body?.family ?? ''} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {['display', 'body', 'mono'].map(role => {
          const meta = catalog.find(f => f.family === t.families[role]?.family)
          return (
            <div key={role} style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 9, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>{ROLE_LABELS[role]}</span>
                <span style={{ fontSize: 11, color: 'var(--dim)' }}>{ROLE_DESC[role]}</span>
              </div>
              <FontPicker value={t.families[role]?.family} onChange={fam => setFamily(role, fam)} role={role} />
              <div className="preview-box" style={{
                marginTop: 9, padding: '12px 13px',
                fontFamily: stackFor(t.families[role]?.family, t.families[role]?.category),
                fontSize: role === 'display' ? 22 : 15, color: 'var(--text)',
                fontVariationSettings: Object.entries(t.axes?.[role] ?? {}).map(([k, v]) => `"${k}" ${v}`).join(', ') || undefined,
                fontFeatureSettings: (t.features?.[role] ?? []).map(f => `"${f}" 1`).join(', ') || undefined,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {role === 'mono' ? 'const total = 1,234.56;' : 'Handgloves 0123'}
              </div>
              <div style={{ marginTop: 9 }}>
                <Collapsible title="Axes and features" note={meta?.axes?.length ? `${meta.axes.length} axes` : 'static'}>
                  <div style={{ marginBottom: 12 }}>
                    <AxisControls familyMeta={meta} values={t.axes?.[role]} onChange={(tag, v) => setAxis(role, tag, v)} />
                  </div>
                  <FeatureToggles enabled={t.features?.[role] ?? []} onToggle={tag => toggleFeature(role, tag)} />
                </Collapsible>
              </div>
            </div>
          )
        })}
        </div>
      </Collapsible>

      <Collapsible title="Scale" note={`${t.base}px · ${t.ratio}`} defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 12, alignItems: 'end' }}>
          <NumField label="Base size" value={t.base} min={10} max={24} step={1} suffix="px" onChange={v => setField('base', v)} />
          <div>
            <label>Ratio</label>
            <select value={t.ratio} onChange={e => setField('ratio', parseFloat(e.target.value))} style={{ fontSize: 12.5, padding: '6px 8px' }}>
              {RATIOS.map(r => <option key={r.value} value={r.value}>{r.name} — {r.value}</option>)}
            </select>
          </div>
        </div>
        <Slider label="Leading" desc="Multiplies the auto line-height curve" value={t.leading} onChange={v => setField('leading', v)}
          min={0.7} max={1.3} step={0.01} defaultValue={1} format={v => `${v.toFixed(2)}×`} />
        <Slider label="Tracking" desc="Multiplies the auto letter-spacing curve" value={t.tracking} onChange={v => setField('tracking', v)}
          min={0} max={2} step={0.05} defaultValue={1} format={v => `${v.toFixed(2)}×`} />
        <NumField label="Max measure" value={t.measure} min={40} max={110} suffix="ch" onChange={v => setField('measure', v)} width={120} />
      </Collapsible>

      <Collapsible title="Fluid sizing" note={t.fluid.enabled ? 'on' : 'off'}>
        <p className="panel-note" style={{ marginBottom: 10 }}>
          Emits <code>clamp()</code> so type interpolates with the viewport instead of stepping at breakpoints.
        </p>
        <Toggle label="Generate fluid sizes" checked={t.fluid.enabled} onChange={v => setFluid('enabled', v)} />
        {t.fluid.enabled && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <NumField label="Min viewport" value={t.fluid.minVw} min={280} max={768} suffix="px" onChange={v => setFluid('minVw', v)} />
              <NumField label="Max viewport" value={t.fluid.maxVw} min={768} max={2000} suffix="px" onChange={v => setFluid('maxVw', v)} />
            </div>
            <Slider label="Small-screen ratio" desc="A flatter scale on narrow viewports keeps headings readable"
              value={t.fluid.minRatio} onChange={v => setFluid('minRatio', v)} min={1.05} max={1.4} step={0.01} defaultValue={1.15}
              format={v => v.toFixed(2)} />
            <Slider label="Small-screen base" value={t.fluid.minScale} onChange={v => setFluid('minScale', v)}
              min={0.75} max={1} step={0.01} defaultValue={0.9} format={v => `${v.toFixed(2)}×`} />
          </div>
        )}
      </Collapsible>

      <Collapsible key={inspect ? `gen:${inspect.at}` : 'gen'} title="Generated styles" note={String(generated.length)} defaultOpen>
        <p className="panel-note" style={{ marginBottom: 8 }}>Type in any field to override it.</p>
        {loading && <Banner tone="info">Loading the font catalogue…</Banner>}
        <div>
          {generated.map(token => (
            <TokenRow key={token.name} token={token} overrides={t.overrides ?? {}} families={derived.families}
              onOverride={setOverride} onReset={resetToken} inspect={inspect} />
          ))}
        </div>
      </Collapsible>
    </div>
  )
}
