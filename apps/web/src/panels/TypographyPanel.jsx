/* Typography: three families, one modular scale, and per-token escape hatches.

   Sizes, leading and tracking are all generated. The per-token editors exist
   for the cases where a scale genuinely shouldn't win, and anything you touch
   is marked so you can see at a glance how far the system has been bent. */
import { useEffect, Fragment } from 'react'
import { useStore } from '../state/store.jsx'
import { RATIOS, OPENTYPE_FEATURES } from '../type/scale.js'
import { loadDocumentFonts, stackFor } from '../type/fonts.js'
import FontPicker, { useFontCatalog } from '../ui/FontPicker.jsx'
import { SectionHeader, Collapsible, Slider, NumField, Segmented, Toggle, OverrideBadge, Banner, PAD } from '../ui/controls.jsx'
import { useReveal, revealStyle } from '../ui/reveal.js'
import PanelAlerts from '../a11y/PanelAlerts.jsx'
/* The same recasing the preview surfaces use. A second implementation here
   would let the sample and the surfaces disagree about what Title Case is. */
import { titleCase } from '../preview/casing.js'

/* ── The frame every Text Treatment sample sits in ──
 *
 * One container, so three samples read as three of the same thing rather than
 * as three ad-hoc blocks. It sits ABOVE its control and close to it: the sample
 * and the segmented control are one object, and the next setting is 16px away.
 * A sample that floated equidistant between two controls would label neither. */
function TreatmentPreview({ children }) {
  return (
    <div style={{
      background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8,
      padding: PAD.sub, marginBottom: 6, overflow: 'hidden',
    }}>{children}</div>
  )
}

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
  if (!axes.length) return <div style={{ fontSize: 12, color: 'var(--dim)' }}>Not a variable font — no axes to adjust.</div>
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
  const targeted = inspect?.entry === token.name
  const rowRef = useReveal(targeted, inspect?.at)

  const fields = [
    { k: 'fontSize', label: 'Size' },
    { k: 'fontWeight', label: 'Weight' },
    { k: 'lineHeight', label: 'Leading' },
    { k: 'letterSpacing', label: 'Tracking' },
  ]
  const anyOverride = fields.some(f => overrides[`${token.name}.${f.k}`] != null)
  const stack = families[token.family]?.stack ?? 'inherit'
  /* Constant padding: the highlight must not resize the row it lands on. */

  return (
    <div ref={rowRef} style={{
      borderBottom: '1px solid var(--bdr)', padding: PAD.sub,
      ...revealStyle(targeted),
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', minWidth: 64 }}>{token.name}</code>
        <span className="preview-box"
          style={{
            flex: 1, fontFamily: stack, fontSize: Math.min(24, token.computedPx),
            fontWeight: token.fontWeight, letterSpacing: token.letterSpacing,
            color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            padding: '4px 8px', lineHeight: 1.35,
          }}>
          Ag — the quick brown fox
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>{token.computedPx}px</span>
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
                fontFamily: 'var(--mono)', fontSize: 12, padding: '4px 6px',
                color: set ? 'var(--accent)' : 'var(--muted)',
                borderColor: set ? 'rgb(var(--accent-rgb) / .4)' : 'var(--bdr)',
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
  /* Capitalisation is `voice.casing`, edited here and in Directives. One value,
     two ways to reach it — never two values. */
  const casing = state.voice?.casing ?? 'title'
  const upCasing = v => set(s => ({ ...s, voice: { ...s.voice, casing: v } }), 'voice:casing')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PanelAlerts tab="type" />
      <SectionHeader title="Typography" desc="Three families and one modular scale generate every text style."
        right={overrideCount > 0 ? <span className="chip">{overrideCount} overridden</span> : null} />

      {/* ── TEXT TREATMENT ──
       *
       * Three rules about how words are SET, as opposed to which family or size
       * they take. Capitalisation moved here from a Build Preferences section
       * under Meta that held it alone; the other two never existed anywhere, so
       * every generated page got whatever the browser or the agent decided. */}
      <Collapsible title="Text Treatment" note={casing === 'title' ? 'Title Case' : 'Sentence case'} defaultOpen>
        <div style={{ marginBottom: 16 }}>
          {/* The sample renders the state the setting WRITES, above the control
              that writes it. A sentence describing a look is a second thing to
              keep in sync, and the reader still has to imagine it. */}
          <TreatmentPreview>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {['Export payload', 'New invoice', 'Mark as paid'].map(l => (
                <span key={l} style={{
                  fontSize: 12, padding: '4px 8px', borderRadius: 6,
                  background: 'var(--surf3)', border: '1px solid var(--bdr)', color: 'var(--text)',
                }}>{casing === 'title' ? titleCase(l) : l}</span>
              ))}
            </div>
          </TreatmentPreview>
          <label>Label capitalisation</label>
          {/* This edits `voice.casing`, the same value the Directives panel
              shows under Copy and Formatting. It had its own field for one
              session, and the document then stated both rules — one section
              demanding Title Case, another demanding sentence case, in one
              file with no precedence between them. */}
          <Segmented value={casing} onChange={upCasing} size="sm" full
            options={[{ value: 'sentence', label: 'Sentence case' }, { value: 'title', label: 'Title Case' }]} />
          <div className="panel-note" style={{ marginTop: 6 }}>
            Applies to every button, tab, menu item and column heading an agent writes.
            {casing === 'sentence'
              ? ' “Export payload”, not “Export Payload”.'
              : ' “Export Payload”, not “Export payload”.'}
            {' '}Also shown in Directives under Copy and Formatting — one setting, two ways in.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {/* Two rows of figures, right-aligned, in the mono face the system
              names for amounts. Tabular is the whole point of the setting, so
              the sample has to be a COLUMN — one number proves nothing. */}
          <TreatmentPreview>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 16px',
              fontSize: 12, color: 'var(--text)',
            }}>
              {[['Ashford & Kline', '21,050.00'], ['Northwind', '1,118.40'], ['Meridian Labs', '937.75']]
                .map(([who, amt]) => (
                  <Fragment key={who}>
                    <span style={{ color: 'var(--muted)' }}>{who}</span>
                    <span style={{
                      fontFamily: 'var(--mono)', textAlign: 'right',
                      fontVariantNumeric: (t.numerals ?? 'tabular-in-tables') === 'tabular-in-tables'
                        ? 'tabular-nums' : 'proportional-nums',
                    }}>{amt}</span>
                  </Fragment>
                ))}
            </div>
          </TreatmentPreview>
          <label>Numerals</label>
          <Segmented value={t.numerals ?? 'tabular-in-tables'}
            onChange={v => upd(c => ({ ...c, numerals: v }), 'type:numerals')} size="sm" full
            options={[
              { value: 'tabular-in-tables', label: 'Tabular where aligned' },
              { value: 'proportional', label: 'Always proportional' },
            ]} />
          <div className="panel-note" style={{ marginTop: 6 }}>
            {(t.numerals ?? 'tabular-in-tables') === 'tabular-in-tables'
              ? 'Tabular digits in tables and anywhere a column of figures has to line up, and nowhere else. Every digit is the same width there, so the magnitudes compare down the column. A figure in a stat tile, an info card or a sentence keeps the body face’s proportional digits — even spacing outside a column reads as a monospaced slab.'
              : 'Proportional digits everywhere. Columns of figures will not align between rows, so a table of money is compared by reading rather than by looking.'}
          </div>
        </div>

        <div>
          {/* A heading in a box narrow enough to force the decision. Without the
              constraint both settings render identically and the sample teaches
              nothing. */}
          <TreatmentPreview>
            <div style={{ maxWidth: 260 }}>
              <div style={{
                fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 600, color: 'var(--text)',
                lineHeight: 1.25,
                ...((t.headingWrap ?? 'wrap') === 'truncate'
                  ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
                  : { textWrap: 'balance' }),
              }}>Ashford &amp; Kline — Q4 reconciliation</div>
            </div>
          </TreatmentPreview>
          <label>A heading too long for its line</label>
          <Segmented value={t.headingWrap ?? 'wrap'}
            onChange={v => upd(c => ({ ...c, headingWrap: v }), 'type:headingWrap')} size="sm" full
            options={[
              { value: 'wrap', label: 'Break into lines' },
              { value: 'truncate', label: 'Truncate with …' },
            ]} />
          <div className="panel-note" style={{ marginTop: 6 }}>
            {(t.headingWrap ?? 'wrap') === 'wrap'
              ? 'Keeps every word and takes the lines it needs. A heading is what says where you are, so nothing is hidden. Words never break mid-word.'
              : 'Holds one line and ends in an ellipsis. Keeps every row the same height, and the reader cannot see the rest without another affordance — so give the full text a title or a tooltip.'}
          </div>
        </div>
      </Collapsible>

      <Collapsible title="Families" note={t.families.body?.family ?? ''} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {['display', 'body', 'mono'].map(role => {
          const meta = catalog.find(f => f.family === t.families[role]?.family)
          return (
            <div key={role} style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: PAD.card }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{ROLE_LABELS[role]}</span>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{ROLE_DESC[role]}</span>
              </div>
              <FontPicker value={t.families[role]?.family} onChange={fam => setFamily(role, fam)} role={role} />
              <div className="preview-box" style={{
                marginTop: 8, padding: PAD.card,
                fontFamily: stackFor(t.families[role]?.family, t.families[role]?.category),
                fontSize: role === 'display' ? 24 : 16, color: 'var(--text)',
                fontVariationSettings: Object.entries(t.axes?.[role] ?? {}).map(([k, v]) => `"${k}" ${v}`).join(', ') || undefined,
                fontFeatureSettings: (t.features?.[role] ?? []).map(f => `"${f}" 1`).join(', ') || undefined,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {role === 'mono' ? 'const total = 1,234.56;' : 'Handgloves 0123'}
              </div>
              <div style={{ marginTop: 8 }}>
                <Collapsible title="Axes and Features" note={meta?.axes?.length ? `${meta.axes.length} axes` : 'static'}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, alignItems: 'end' }}>
          <NumField label="Base size" value={t.base} min={10} max={24} step={1} suffix="px" onChange={v => setField('base', v)} />
          <div>
            <label>Ratio</label>
            <select value={t.ratio} onChange={e => setField('ratio', parseFloat(e.target.value))} style={{ fontSize: 12, padding: '6px 8px' }}>
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

      <Collapsible title="Fluid Sizing" note={t.fluid.enabled ? 'on' : 'off'}>
        <p className="panel-note" style={{ marginBottom: 12 }}>
          Emits <code>clamp()</code> so type interpolates with the viewport instead of stepping at breakpoints.
        </p>
        <Toggle label="Generate fluid sizes" checked={t.fluid.enabled} onChange={v => setFluid('enabled', v)} />
        {t.fluid.enabled && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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

      <Collapsible title="Generated Styles" note={String(generated.length)} defaultOpen
        openSignal={inspect?.at}>
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
