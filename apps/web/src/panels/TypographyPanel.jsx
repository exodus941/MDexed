/* Typography: three families, one modular scale, and per-token escape hatches.

   Sizes, leading and tracking are all generated. The per-token editors exist
   for the cases where a scale genuinely shouldn't win, and anything you touch
   is marked so you can see at a glance how far the system has been bent. */
import { useEffect, useMemo, Fragment } from 'react'
import { useStore } from '../state/store.jsx'
import { PREVIEW_CSS, varsToStyle } from '../preview/tokens.js'
import { buildCssVars } from '../state/derive.js'
import { RATIOS, OPENTYPE_FEATURES } from '../type/scale.js'
import { loadDocumentFonts, stackFor } from '../type/fonts.js'
import FontPicker, { useFontCatalog } from '../ui/FontPicker.jsx'
import { SectionHeader, Collapsible, Expand, Slider, NumField, Segmented, Toggle, OverrideBadge, Banner, PAD } from '../ui/controls.jsx'
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
 * A sample that floated equidistant between two controls would label neither.
 *
 * IT TAKES `.entry-sample`, THE SAME STAGE THE COMPONENTS TAB USES.
 *
 * The first version painted it in `--surf2` and `--bdr`, which are the editor's
 * own chrome. So the sample was drawn in the same colours as the control under
 * it, and the two read as one block of options rather than as a preview and its
 * setting. The Components tab already solved this: a recessed plane in
 * `--preview`, and the sample itself rendered in the DOCUMENT's tokens rather
 * than the editor's.
 *
 * `.dmd` is what brings the document's tokens in, and it is why the samples
 * below name `--c-text` and `--c-surface` rather than `--text` and `--surf`. */
function TreatmentPreview({ children }) {
  return (
    <div className="dmd entry-sample" style={{
      display: 'block', minHeight: 0, padding: PAD.sub, marginBottom: 6,
    }}>{children}</div>
  )
}

/* ── THE THREE ANSWERS, AS FLEX PLUS ONE OFFSET ──
 *
 * The control's BOX centres on the LINE's box. The distance from a line's edge
 * to the control's centre is the same at the top and at the bottom, so `first`
 * and `last` share one number and differ only in which edge they hang from.
 * `center` uses the block's own centre and takes no offset: a margin there
 * would move it off the centre the alignment just found.
 *
 * The sample's heading is 18px at 1.25 leading and its button is 28px, so the
 * offset is (18 * 1.25 - 28) / 2 = -2.75. The surfaces compute the same thing
 * from tokens; this sample states its own two numbers because they are the
 * sample's, not the document's.
 *
 * Baseline alignment was built here and withdrawn at their request. Measured
 * with font metrics, `align-items: baseline` and `last baseline` put the
 * button's LABEL on the heading's baseline, where this puts it 3.00px below.
 * They saw both and chose this one. */
const HEAD_LINE = 18 * 1.25
const HEAD_BTN = 28
const HEAD_OFFSET = (HEAD_LINE - HEAD_BTN) / 2
const HEAD_ALIGN = {
  first: { row: { alignItems: 'flex-start' }, item: { marginTop: HEAD_OFFSET } },
  center: { row: { alignItems: 'center' }, item: {} },
  last: { row: { alignItems: 'flex-end' }, item: { marginBottom: HEAD_OFFSET } },
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

  /* The document's own custom properties, so the Text Treatment samples render
     in the system being designed rather than in the editor's chrome. Built the
     same way the Components tab builds them, and set once on the panel root so
     every `.dmd` sample below inherits them. */
  const sampleVars = useMemo(() => varsToStyle(buildCssVars({
    ...derived, elevationCfg: state.elevation,
  }, state.color.mode)), [derived, state.elevation, state.color.mode])

  useEffect(() => { loadDocumentFonts(t.families, catalog) }, [t.families, catalog])

  const upd = (fn, tag) => set(s => ({ ...s, type: fn(s.type) }), tag)
  /* Capitalisation is `voice.casing`, edited here and in Directives. One value,
     two ways to reach it — never two values. */
  const casing = state.voice?.casing ?? 'title'
  const upCasing = v => set(s => ({ ...s, voice: { ...s.voice, casing: v } }), 'voice:casing')
  const wraps = (t.headingWrap ?? 'wrap') === 'wrap'
  const headAlign = t.headingAlign ?? 'last'
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
    /* The document's tokens, set once for the whole panel, so every `.dmd`
       sample under here inherits them. Same arrangement as the Components tab,
       and the reason the two tabs' samples now read as the same kind of thing. */
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...sampleVars }}>
      {/* Every rule in here is scoped to `.dmd`, so this copy styles the
          Text Treatment samples and reaches nothing else in the panel. */}
      <style>{PREVIEW_CSS}</style>
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
            {/* `.btn` rather than three hand-rolled spans. The primitive is
                what the samples on the other tabs use, and it carries the
                document's own radius, border and label size. */}
            <div className="dmd" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {['Export payload', 'New invoice', 'Mark as paid'].map(l => (
                <span key={l} className="btn btn-secondary btn-sm">
                  {casing === 'title' ? titleCase(l) : l}
                </span>
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
          {/* THE SAMPLE NEEDS BOTH HALVES, AND THE FIRST VERSION HAD ONE.
           *
           * It was a column of amounts in the mono face, and it never changed.
           * Measured: "21,050.00" is 64.81px wide under `tabular-nums` and
           * 64.81px under `proportional-nums`, at the same left edge, because a
           * mono face already gives every digit one width. The property moved
           * and no pixel did. Reading the declaration called that a pass.
           *
           * So the sample shows the two places a figure lands, and the rule is
           * the boundary between them:
           *
           *   an info card    the body face, proportional, under BOTH settings
           *   a column        tabular where the setting allows it
           *
           * In the body face the difference is 16.5px on six digits — "111111"
           * is 43.2 tabular against 26.72 proportional — so the column visibly
           * goes ragged when the setting turns tabular off. */}
          <TreatmentPreview>
            {/* A figure in a card is never tabular. These two do not react, and
                that is the half of the rule the column cannot show. */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['Open invoices', '18'], ['Avg. days to pay', '21']].map(([k, v]) => (
                <div key={k} className="card" style={{ flex: 1, minWidth: 0, padding: '6px 8px' }}>
                  <div className="caption" style={{ color: 'var(--c-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
                  {/* Body face, proportional, stated rather than inherited. */}
                  <div style={{ fontSize: 18, color: 'var(--c-text)', fontVariantNumeric: 'proportional-nums' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 16px',
              fontSize: 12, color: 'var(--c-text)',
            }}>
              {[['Ashford & Kline', '21,050.00'], ['Northwind', '1,118.40'], ['Meridian Labs', '937.75']]
                .map(([who, amt]) => (
                  <Fragment key={who}>
                    <span style={{ color: 'var(--c-text-muted)' }}>{who}</span>
                    <span style={(t.numerals ?? 'tabular-in-tables') === 'tabular-in-tables'
                      /* The column gets the treatment the setting names: the
                         mono face and tabular digits, which is what lines a
                         column up. Turned off, it falls back to the body face
                         and its proportional digits, like any other figure. */
                      ? { fontFamily: 'var(--font-mono-family, monospace)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
                      : { textAlign: 'right', fontVariantNumeric: 'proportional-nums' }}>{amt}</span>
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

        {/* No conditional margin here. The separation belongs to the block that
            appears, so it collapses WITH it — a margin on this block would jump
            from 0 to 16 while the block below was still opening. One writer per
            distance. */}
        <div>
          {/* A heading in a box narrow enough to force the decision. Without the
              constraint both settings render identically and the sample teaches
              nothing.
           *
           * The BUTTON is in the sample too, because the wrap setting and the
           * alignment setting share one picture: you cannot see where a control
           * sits against a heading without both of them. */}
          <TreatmentPreview>
            <div style={{ maxWidth: 300, display: 'flex', gap: 8, ...HEAD_ALIGN[headAlign].row }}>
              <div style={{
                minWidth: 0, flex: '0 1 auto',
                fontFamily: 'var(--font-h2-family, var(--font-body-family))',
                fontSize: 18, fontWeight: 600, color: 'var(--c-text)', lineHeight: 1.25,
                ...(wraps ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
              }}>Ashford &amp; Kline — Q4 reconciliation</div>
              {/* The offset is the same formula the surfaces use: half the
                  difference between one line and the control. Here the line is
                  18 x 1.25 and the control is the sample button. */}
              <span className="btn btn-secondary btn-sm" style={{ flex: '0 0 auto', ...HEAD_ALIGN[headAlign].item }}>Export</span>
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
            {wraps
              ? 'Keeps every word and takes the lines it needs. A heading is what says where you are, so nothing is hidden. Words never break mid-word.'
              : 'Holds one line and ends in an ellipsis. Keeps every row the same height, and the reader cannot see the rest without another affordance — so give the full text a title or a tooltip.'}
          </div>
        </div>

        {/* ASKED ONLY WHERE IT HAS AN ANSWER.
         *
         * A truncated heading is one line, so all three alignments land in the
         * same place. Offering the choice there is offering a decision that
         * changes nothing, which is worse than not offering it.
         *
         * `Expand` rather than a bare conditional, so the block opens and closes
         * instead of appearing. It is the same primitive every other disclosure
         * in the editor uses, and it already reads the UI-animation setting: it
         * unmounts immediately when animations are off and after the transition
         * when they are on. A block that pops in moves everything below it with
         * no warning, which reads as the panel having jumped. */}
        <Expand open={wraps}>
          {/* The 16px that separates this from the setting above it lives here,
              inside the collapsing box, so it opens and closes with the block
              rather than appearing under it. */}
          <div style={{ paddingTop: 16 }}>
            <label>Controls beside a wrapped heading</label>
            <Segmented value={headAlign}
              onChange={v => upd(c => ({ ...c, headingAlign: v }), 'type:headingAlign')} size="sm" full
              options={[
                { value: 'first', label: 'First line' },
                { value: 'center', label: 'Optical centre' },
                { value: 'last', label: 'Last line' },
              ]} />
            <div className="panel-note" style={{ marginTop: 6 }}>
              {headAlign === 'first'
                ? 'Every control on the heading’s row centres on its FIRST line, so the row reads the same however many lines the heading takes. A long heading then grows downward away from its buttons.'
                : headAlign === 'center'
                  ? 'Controls centre on the whole heading block. Two lines and they sit between them; the more lines the heading takes, the further they drift from any one of them.'
                  : 'Controls centre on the heading’s LAST line, so they sit level with where the title finishes and the page continues. One line makes all three identical — only a heading that wraps shows the difference.'}
            </div>
          </div>
        </Expand>
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
        {/* Opens with the toggle. The four fields below it are half this
            section's height, so appearing was the biggest jump in the panel. */}
        <Expand open={t.fluid.enabled}>
          <div style={{ paddingTop: 12 }}>
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
        </Expand>
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
