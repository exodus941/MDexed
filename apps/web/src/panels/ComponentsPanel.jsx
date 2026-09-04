/* The component matrix.

   Nothing here is stored until you change it — the library supplies defaults
   and only edits are persisted. Entries are shown under the exact name they
   will carry in the file, so the hyphenated flattening the spec requires
   (`button-primary-hover`) is visible while you work rather than a surprise
   at export. */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../state/store.jsx'
import { COMPONENT_LIBRARY, COMPONENT_GROUPS, TAB_STYLES, DEFAULT_TAB_STYLE, SELECTION_STYLES, SELECTION_EDGES, selectionStyle, selectionEdge } from '../state/components.js'
import { SPEC_COMPONENT_PROPS } from '../emit/yaml.js'
import { LAYOUT_BY_NAME, fieldActive } from '../state/componentLayout.js'
import { SectionHeader, Toggle, ResetButton, Banner, Collapsible, Expand, FilterField, Segmented, PAD, SnapSlider, ChoiceCard } from '../ui/controls.jsx'
import { useRevealWithin, revealStyle } from '../ui/reveal.js'
import TokenColorPicker, { paletteGroups } from '../ui/TokenColorPicker.jsx'
import { RAMP_STEPS, resolveRef } from '../color/ramp.js'
import EntrySample from '../preview/EntrySample.jsx'
import { PREVIEW_CSS, varsToStyle } from '../preview/tokens.js'
import { buildCssVars } from '../state/derive.js'
import { gradientCss } from '../color/modes.js'
import { EntryAlerts, useFindings } from '../a11y/PanelAlerts.jsx'

/* Which token group a property should draw from. Offering `{colors.*}` for a
   padding field is noise; offering nothing at all is what made these look like
   "clueless text fields". */
const COLOR_PROPS = ['backgroundColor', 'textColor', 'borderColor', 'outlineColor', 'fill', 'stroke']
/* Spacing steps are the right vocabulary for gaps between things. */
const SPACING_PROPS = ['padding', 'gap', 'margin']
/* Dimensions are not spacing steps — a control's height is its own decision,
   so these get plain pixel values rather than `{spacing.*}` references. */
const SIZE_PROPS = ['height', 'width', 'size', 'minHeight', 'maxHeight', 'outlineOffset', 'iconSize']

/* Swatch references are dotted (`accent.700`) because that's how the scales
   are addressed internally; the colour tokens the file emits are hyphenated
   (`accent-700`). This is the one place the two spellings meet. */
const COLOR_REF = ref => `{colors.${ref.replace('.', '-')}}`

/* Which properties are choices from a named scale, and which scale.
 *
 * Every one of these is a comparative decision — you want the next size up,
 * not a number — and every one of them is derived, so storing the reference
 * keeps it tracking its macro instead of freezing today's pixel value. */
const SNAP_SCALES = {
  rounded:    d => ({ steps: d.rounded, refFor: n => `{rounded.${n}}`, title: 'Corner radius' }),
  typography: d => ({
    steps: d.typography.map(t => ({ name: t.name, value: t.fontSize })),
    refFor: n => n, title: 'Text style',
  }),
  iconSize:   d => ({
    steps: Object.entries(d.icons?.sizes ?? {}).map(([name, px]) => ({ name, value: `${px}px` })),
    refFor: n => `{icons.${n}}`, title: 'Icon size',
  }),
}

/* Components whose sample needs the full width to read.
   A modal squeezed into a 168px column is not a modal, and a table loses its
   columns entirely. These stack above the properties instead, which costs
   height but is the only way the sample says anything true. Everything else
   sits beside its fields, where it stays in view while you drag a slider. */
/* Components a 168px column misrepresents rather than merely shrinks.
 *
 * `select` and `input` joined the set after the sample became a first-class
 * surface rather than a thumbnail. A select is a value on the left and a mark
 * on the right, and the whole point of it is that gap — squeeze it into 118px
 * of usable width and the two collide, which is a picture of a control this
 * system does not contain. Measured: its content wanted 150 and had 118.
 *
 * The sample IS the component here. That is the meta bit of a design tool: the
 * demonstration and the thing demonstrated are the same object, so a sample
 * that lies is a specification that lies. */
const WIDE_SAMPLE = new Set(['modal', 'table', 'card', 'alert', 'textarea', 'select', 'input'])

const PX_SUGGESTIONS = ['20px', '24px', '28px', '32px', '36px', '40px', '44px', '48px', '56px', '64px']
const ICON_SUGGESTIONS = ['{icons.sm}', '{icons.md}', '{icons.lg}', '{icons.xl}', '12px', '14px', '16px', '18px', '20px', '24px']

function optionsFor(propKey, derived) {
  if (COLOR_PROPS.includes(propKey)) {
    return ['transparent', 'currentColor', ...Object.keys(derived.roles.light).map(r => `{colors.${r}}`)]
  }
  if (propKey === 'rounded') return derived.rounded.map(r => `{rounded.${r.name}}`)
  if (propKey === 'typography') return derived.typography.map(t => t.name)
  if (propKey === 'boxShadow') return ['none', ...Object.values(derived.elevation).filter(v => v !== 'none')]
  /* Gradients are the only images a component fill is likely to want. */
  if (propKey === 'backgroundImage') return ['none', ...(derived.gradients ?? []).map(g => `{gradient.${g.name}}`)]
  if (propKey === 'opacity') return ['1', '0.5', '0.38', '0']
  if (SPACING_PROPS.includes(propKey)) {
    return [...derived.spacing.map(s => `{spacing.${s.name}}`), ...derived.spacing.slice(2, 7).map(s => `0 {spacing.${s.name}}`)]
  }
  if (propKey === 'iconSize') return ICON_SUGGESTIONS
  if (SIZE_PROPS.includes(propKey)) return PX_SUGGESTIONS
  return []
}

/** Every flattened entry name a component definition will emit. */
function entriesFor(def, cfg) {
  const out = def.base ? [def.name] : []
  for (const v of Object.keys(def.variants ?? {})) out.push(`${def.name}-${v}`)
  if (cfg.emitSizes !== false) for (const s of Object.keys(def.sizes ?? {})) out.push(`${def.name}-${s}`)
  if (cfg.emitStates !== false) {
    for (const [stateName, byVariant] of Object.entries(def.states ?? {})) {
      for (const variant of Object.keys(byVariant)) {
        out.push(variant === '_' ? `${def.name}-${stateName}` : `${def.name}-${variant}-${stateName}`)
      }
    }
  }
  return out
}

/* Locate the spacing token a slider should drive. Padding is often compound
   ("0 {spacing.md}"), so the slider moves the last token and leaves the
   structure alone. */
function spacingTarget(value, spacing) {
  const matches = [...String(value ?? '').matchAll(/\{spacing\.([\w-]+)\}/g)]
  if (!matches.length) return null
  const last = matches[matches.length - 1]
  const idx = spacing.findIndex(s => s.name === last[1])
  return idx < 0 ? null : { idx, at: last.index, length: last[0].length }
}

/** Resolve a token reference to what it will actually render as. */
function resolveValue(value, derived, mode) {
  if (!value) return null
  const str = String(value)
  const ref = /^\{(colors|rounded|spacing)\.([a-zA-Z0-9_-]+)\}$/.exec(str)
  if (ref) {
    const [, group, key] = ref
    /* Roles first, then scale steps under their emitted hyphenated names —
       both are legal colour references, so both have to preview. */
    if (group === 'colors') {
      const hex = derived.roles[mode][key] ?? resolveRef(key.replace(/-(?=\d+$)/, '.'), derived.ramps)
      return hex ? { kind: 'color', value: hex } : null
    }
    if (group === 'rounded') return { kind: 'text', value: derived.rounded.find(r => r.name === key)?.value }
    if (group === 'spacing') return { kind: 'text', value: derived.spacing.find(s => s.name === key)?.value }
  }
  if (/^#|^rgb|^hsl/.test(str)) return { kind: 'color', value: str }
  const grad = /^\{gradient\.([\w-]+)\}$/.exec(str)
  if (grad) {
    const css = (derived.gradients ?? []).find(g => g.name === grad[1])?.css
    return css ? { kind: 'gradient', value: css } : null
  }
  if (/-gradient\(/.test(str)) return { kind: 'gradient', value: str }
  const icon = /^\{icons\.([\w-]+)\}$/.exec(str)
  if (icon) {
    const px = derived.icons?.sizes?.[icon[1]]
    return px != null ? { kind: 'text', value: `${px}px` } : null
  }
  /* Compound values like `0 {spacing.md}` still resolve, one token at a time. */
  if (str.includes('{')) {
    const out = str.replace(/\{spacing\.([a-zA-Z0-9_-]+)\}/g, (m, k) => derived.spacing.find(s => s.name === k)?.value ?? m)
    return out === str ? null : { kind: 'text', value: out }
  }
  return null
}

function PropRow({ entryName, propKey, defaultValue, override, onSet, onReset, derived, mode, colorGroups }) {
  const [picking, setPicking] = useState(false)
  const swatchRef = useRef(null)
  const legal = SPEC_COMPONENT_PROPS.includes(propKey)
  const set = override != null
  const current = override ?? defaultValue
  const options = optionsFor(propKey, derived)
  const listId = `dmd-opt-${propKey}`
  const resolved = resolveValue(current, derived, mode)

  const key = `${entryName}.${propKey}`
  const spaceTarget = SPACING_PROPS.includes(propKey) ? spacingTarget(current, derived.spacing) : null
  const snapScale = SNAP_SCALES[propKey]?.(derived)
  const sizePx = SIZE_PROPS.includes(propKey) ? parseFloat(current) : NaN
  const hasSizeSlider = !snapScale && SIZE_PROPS.includes(propKey) && Number.isFinite(sizePx)

  const nudgeSpacing = newIdx => {
    const step = derived.spacing[newIdx]
    if (!step || !spaceTarget) return
    const str = String(current)
    onSet(key, str.slice(0, spaceTarget.at) + `{spacing.${step.name}}` + str.slice(spaceTarget.at + spaceTarget.length))
  }

  /* `dense` puts every field in here on the compact size defined in theme.css,
     rather than each input carrying its own padding — which is what left this
     column improvising a size that nothing else in the app shared. */
  return (
    <div className="dense" style={{ padding: '1px 0' }}>
      {/* An always-present reset button: the row used to grow by a pixel the
          moment a value was set, because the badge only existed once there was
          an override. The height comes from the field rather than being pinned
          here — a fixed 26px row with a taller field in it collides with the
          row below, which is exactly what happened. */}
      {/* The columns are stated in CSS, not here, because they have to change
          with the PANE's width and not the window's. A splitter can leave this
          panel 330px wide inside a 1900px screen, and at that width the fixed
          128 + 96 + 16 + 20 plus four gaps ate 292 of it — the value field
          collapsed to nothing and the slider and its unit ran off the edge and
          were clipped, not scrolled. A container query asks the pane. */}
      <div className="prop-row">
        <code className="prop-key" style={{ fontFamily: 'var(--mono)', fontSize: 10, color: legal ? 'var(--text-dim)' : 'var(--warn)' }}>{propKey}</code>

        <input list={options.length ? listId : undefined}
          value={override ?? ''} placeholder={defaultValue}
          onChange={e => onSet(key, e.target.value)}
          title={options.length ? 'Pick a token or type a value' : 'Type a value'}
          style={{
            fontFamily: 'var(--mono)',
            color: set ? 'var(--accent)' : 'var(--muted)',
            borderColor: set ? 'rgb(var(--accent-rgb) / .4)' : 'var(--bdr)',
          }} />
        {options.length > 0 && (
          <datalist id={listId}>{options.map(o => <option key={o} value={o} />)}</datalist>
        )}

        {/* What the value actually resolves to right now. For a colour the
            swatch is the way in: the same picker the gradient stops use, so
            you never have to know that `{colors.accent}` is the syntax. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {resolved?.kind === 'color' && (
            <>
              <button ref={swatchRef} className="swatch" onClick={() => setPicking(true)}
                title="Pick a colour"
                style={{ width: 12, height: 12, background: resolved.value, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolved.value}</code>
              {picking && (
                <TokenColorPicker
                  value={current} resolved={resolved.value}
                  groups={colorGroups} anchor={swatchRef.current}
                  refFor={COLOR_REF}
                  isRef={v => /^\{colors\./.test(String(v ?? ''))}
                  onPick={v => onSet(key, v)}
                  onClose={() => setPicking(false)} />
              )}
            </>
          )}
          {resolved?.kind === 'gradient' && (
            <span style={{ width: 36, height: 12, borderRadius: 4, background: resolved.value, border: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }} />
          )}
          {resolved?.kind === 'text' && (
            <code style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resolved.value}</code>
          )}
        </div>

        {/* Marks a property the frontmatter can't carry. Explained in full in
            the panel banner, so this only has to be a flag, not a paragraph. */}
        <span style={{
          visibility: legal ? 'hidden' : 'visible',
          width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
          border: '1px solid rgb(var(--warn-rgb) / .5)', color: 'var(--warn)',
          fontSize: 10, lineHeight: '11px', textAlign: 'center', fontWeight: 700,
        }}>!</span>

        {/* The orange border already says "overridden", so this is just the
            way back — dimmed, not hidden, so the row never reflows. */}
        <ResetButton onClick={() => onReset(key)} disabled={!set} title="Reset to the default value" />
      </div>

      {/* Direct control for the values worth nudging by feel rather than typing.
       *
       * A scale-valued property gets a SnapSlider that stops on its own named
       * steps and writes the token reference. `rounded` and `typography` had
       * nothing but a datalist before, which made choosing a radius a matter
       * of opening a list, reading names and guessing — for a decision that is
       * entirely comparative. `iconSize` had a raw 0–80px range with no stops
       * at all, so it could land anywhere and usually landed off-scale.
       *
       * Spacing keeps its own slider because the value may be a shorthand
       * (`0 {spacing.md}`) with the token in one position, so it edits a slice
       * of the string rather than replacing it. */}
      {/* The slider belongs to the row above it, so it sits closer to that row
          than the next property does — 3px here against the list's own gap. */}
      {(spaceTarget || snapScale || hasSizeSlider) && (
        <div style={{ display: 'grid', gridTemplateColumns: '128px minmax(0,1fr)', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <span />
          {spaceTarget ? (
            <SnapSlider steps={derived.spacing} value={`{spacing.${derived.spacing[spaceTarget.idx]?.name}}`}
              refFor={n => `{spacing.${n}}`}
              onChange={ref => nudgeSpacing(derived.spacing.findIndex(s => `{spacing.${s.name}}` === ref))}
              title="Spacing step" />
          ) : snapScale ? (
            <SnapSlider steps={snapScale.steps} value={current} refFor={snapScale.refFor}
              onChange={v => onSet(key, v)} title={snapScale.title} />
          ) : (
            <input type="range" min={0} max={80} step={1} value={sizePx}
              onChange={e => onSet(key, `${e.target.value}px`)}
              title="Size in pixels" style={{ height: 12 }} />
          )}
        </div>
      )}
    </div>
  )
}

/** Keep a property if the entry name, the key or the value matches. */
const matches = (query, entryName, key, value) => {
  if (!query) return true
  const q = query.toLowerCase()
  return entryName.toLowerCase().includes(q) || key.toLowerCase().includes(q) || String(value).toLowerCase().includes(q)
}

function EntryBlock({ title, entryName, props, overrides, onSet, onReset, derived, mode, inspect, query, colorGroups, def, sampleVars, tabStyle }) {
  /* The jump targets the exact entry — clicking a small button lands on
     `button-sm`, not merely somewhere inside Button. The scrolling is the
     owning ComponentBlock's job; this only marks itself. */
  const targeted = inspect?.entry === entryName

  /* Filtered after the hooks — an early return above them would change the
     hook order between renders. */
  const shown = Object.entries(props).filter(([k, v]) => matches(query, entryName, k, overrides[`${entryName}.${k}`] ?? v))
  if (!shown.length) return null

  /* Geometry is identical whether or not this entry is the jump target: the
     highlight adds a background and a ring, never padding or margin. It used
     to bleed 8px into the parent on both sides when highlighted, so the one
     entry you had just jumped to was visibly wider than all its siblings. */

  return (
    <div data-entry={entryName} style={{
      padding: PAD.sub,

      ...revealStyle(targeted),
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: PAD.label }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{entryName}</code>
        {title && <span style={{ fontSize: 10, color: 'var(--dim)' }}>{title}</span>}
        {targeted && <span className="chip" style={{ color: 'var(--accent)', borderColor: 'rgb(var(--accent-rgb) / .4)' }}>from preview</span>}
      </div>
      {/* Sample on the right, properties on the left.
       *
       * Above would have been the obvious place and the wrong one: these
       * cards run to a dozen property rows, so a stacked preview pushes the
       * fields it belongs to off the screen exactly when you are adjusting
       * them. Beside them, the sample stays in view while you drag a slider,
       * which is the entire point of having it.
       *
       * It collapses back to one column under 560px, where two columns would
       * leave neither wide enough to read. */}
      <div className={WIDE_SAMPLE.has(def.name) ? 'entry-stack' : 'entry-split'}>
        {/* PAD.row was 4px between rows that were 26px tall and had no
            sliders. Now a row can be a field plus a slider, and 4px between
            two of those reads as one continuous block. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: PAD.sub, minWidth: 0 }}>
          {shown.map(([k, v]) => (
            <PropRow key={k} entryName={entryName} propKey={k} defaultValue={String(v)}
              override={overrides[`${entryName}.${k}`]} onSet={onSet} onReset={onReset}
              derived={derived} mode={mode} colorGroups={colorGroups} />
          ))}
        </div>
        {!query && (
          <div className="entry-sample-slot">
            <EntrySample def={def} entryName={entryName} tabStyle={tabStyle}
              focus={derived.focus} roles={derived.roles[mode]} />
          </div>
        )}
      </div>
      {/* Anything the audit found about *this* entry, under the controls that
          caused it. A 16px checkbox is a fact about the checkbox, so it is
          reported on the checkbox — not in a list somewhere else that you have
          to be holding in your head while you edit. */}
      <EntryAlerts tab="components" entry={entryName} />
    </div>
  )
}

/* Composition rules — how the parts of a component are arranged, as opposed to
   what colour they are. None of it is expressible in the spec's eight
   properties, so it is emitted as guidance; the note says so plainly rather
   than letting the difference be a surprise at export. */
function LayoutBlock({ def, values, onSet }) {
  const changed = def.fields.filter(f => values[f.k] !== f.default).length

  return (
    <div style={{
      /* Same box as an EntryBlock, so the composition card and the property
         rows below it line up on both edges. */
      padding: PAD.sub, borderRadius: 8,
      background: 'var(--surf)', border: '1px solid var(--bdr)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: PAD.label }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{def.label}</span>
        {changed > 0 && <span className="chip" style={{ color: 'var(--accent)' }}>{changed} changed</span>}
        <span style={{ flex: 1 }} />
        <span className="chip" title="Emitted as guidance in the Components section — the DESIGN.md component schema has no slot for arrangement">prose</span>
      </div>
      <p className="panel-note" style={{ marginBottom: PAD.sub }}>{def.desc}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {def.fields.map(field => (
          <Expand key={field.k} open={fieldActive(field, values)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 104 }}>{field.label}</span>
              <Segmented size="sm" value={values[field.k]} onChange={v => onSet(def.name, field.k, v)}
                options={field.options.map(o => ({ value: o.value, label: o.label }))} />
            </div>
          </Expand>
        ))}
      </div>
    </div>
  )
}

function ComponentBlock({ def, cfg, layout, onSetLayout, onToggle, onSet, onReset, derived, mode, inspect, colorGroups, sampleVars, onSetTabStyle, onSetSelection, onSetSelectionEdge }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const enabled = cfg.enabled[def.name] ?? def.on
  const overrides = cfg.overrides ?? {}

  /* A click in the preview opens the owning component and scrolls to it.
     The whole block is brought into view from its header down, not just the
     matched entry — you clicked a modal, so you should be able to see that
     you're in Modal and reach its other entries without scrolling back up. */
  const targeted = inspect && entriesFor(def, cfg).includes(inspect.entry)
  useEffect(() => { if (targeted) setOpen(true) }, [targeted, inspect?.at])

  const rowSelector = useMemo(
    () => (targeted ? `[data-entry="${CSS.escape(inspect.entry)}"]` : null),
    [targeted, inspect?.entry],
  )
  const ref = useRevealWithin(targeted, inspect?.at, rowSelector)

  const entryCount =
    (def.base ? 1 : 0) +
    Object.keys(def.variants ?? {}).length +
    (cfg.emitSizes ? Object.keys(def.sizes ?? {}).length : 0) +
    (cfg.emitStates ? Object.values(def.states ?? {}).reduce((n, byVariant) => n + Object.keys(byVariant).length, 0) : 0)

  const touched = Object.keys(overrides).filter(k => k === def.name || k.startsWith(`${def.name}.`) || k.startsWith(`${def.name}-`)).length

  /* Findings anywhere under this component. Matching on the entry names it
     actually emits rather than on the prefix, so `card` doesn't collect
     `card-elevated`'s neighbours by accident of spelling. */
  const componentFindings = useFindings('components')
  const a11yCount = useMemo(() => {
    const mine = new Set(entriesFor(def, cfg))
    return componentFindings.filter(f => mine.has(f.entry)).length
  }, [componentFindings, def, cfg])

  return (
    <div ref={ref} style={{
      /* Breathing room above the header when a jump scrolls this to the top. */
      scrollMarginTop: 12,
      background: 'var(--surf2)',
      border: `1px solid ${targeted ? 'var(--accent)' : open ? 'rgb(var(--accent-rgb) / .35)' : 'var(--bdr)'}`,
      borderRadius: 8, overflow: 'hidden', opacity: enabled ? 1 : 0.55,
      transition: 'border-color var(--t) var(--ease)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 12px' }}>
        <input type="checkbox" checked={enabled} onChange={e => onToggle(def.name, e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)', padding: 0, flexShrink: 0, alignSelf: 'center' }} />
        <button onClick={() => setOpen(o => !o)} disabled={!enabled}
          style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default', color: 'var(--text)', textAlign: 'left', padding: 0, fontFamily: 'var(--sans)', minWidth: 0 }}>
          <span style={{ fontSize: 14, flex: 1 }}>{def.label}</span>
          {/* Findings live inside the entry cards, which a collapsed component
              never renders — so the count comes up to the header, where it is
              the reason to open the card. It disappears once you have, because
              by then the real alerts are on screen. */}
          {!open && a11yCount > 0 && (
            <span className="chip" style={{ color: 'var(--warn)', borderColor: 'rgb(var(--warn-rgb) / .4)' }}
              title={`${a11yCount} accessibility ${a11yCount === 1 ? 'finding' : 'findings'} in this component`}>
              ⚠ {a11yCount}
            </span>
          )}
          {touched > 0 && <span className="chip" style={{ color: 'var(--accent)' }}>{touched}</span>}
          <span className="chip">{entryCount}</span>
        </button>
        {/* Search within the component: a Button expands to 15 entries and
            scrolling for `gap` is a waste of a scroll wheel. */}
        {open && enabled && <FilterField value={query} onChange={setQuery} width={124} />}
      </div>
      <Expand open={open && enabled}>
        <div style={{ padding: PAD.card, borderTop: '1px solid var(--bdr)', background: 'var(--surf2)', display: 'flex', flexDirection: 'column', gap: PAD.gap }}>
          {query && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>
              Showing properties matching <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{query}</code>
            </div>
          )}
          {/* Base first, then composition.
           *
           * Composition used to sit at the top, which put the one block the
           * preview cannot reach ahead of the one it always lands on. Clicking
           * a modal jumped to the card and the first thing under the heading
           * was a set of controls the click had nothing to do with, while the
           * entry actually being edited was pushed below the fold.
           *
           * The general rule, applied to every component that has both: the
           * blocks a preview click can target come first, in the order the
           * click resolves them (base, then variant, size, state). Anything
           * unreachable from the preview follows, because the only way to
           * reach it is to scroll here deliberately, and someone scrolling
           * deliberately can scroll one block further. */}
          {/* The Tab Style picker belongs to the Tab, not to the panel.
              It writes tab-selected, tab-hover and tab-disabled, so it sits
              above them rather than three cards away at the panel root.
              One treatment was not enough: a strip on a rule wants the
              underline, a strip floating in a toolbar wants the pill, and
              forcing the underline there draws a 2px mark against nothing. */}
          {def.name === 'tab' && !query && (
            <div className="entry-block" style={{ marginBottom: PAD.gap }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>tab</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>style</span>
                <span style={{ flex: 1 }} />
                <span className="chip">{TAB_STYLES[cfg.tabStyle ?? DEFAULT_TAB_STYLE]?.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(TAB_STYLES).map(([key, spec]) => (
                  <TabStyleChoice key={key} id={key} spec={spec} roles={derived.roles[mode]}
                    selected={(cfg.tabStyle ?? DEFAULT_TAB_STYLE) === key}
                    onPick={() => onSetTabStyle(key)} />
                ))}
              </div>
              <div className="panel-note" style={{ marginTop: 8 }}>
                Sets <code>tab-selected</code>, <code>tab-hover</code> and <code>tab-disabled</code> together.
              </div>
            </div>
          )}
          {/* ── THE SELECTED-ROW TREATMENT, BESIDE THE ENTRY IT WRITES ──
           *
           * It began in the Colour panel, next to the ground tint that was
           * decided in the same sitting. It writes `nav-item-*` and
           * `table-row-*` and nothing else, and its state already lived under
           * `components`, so it belongs where a reader hunting for a nav
           * item's states will find it.
           *
           * ONE SETTING, TWO COMPONENTS. A nav marked by a lifted surface
           * beside a table marked by an accent wash reads as two products, so
           * the table row follows this control rather than carrying its own.
           * The Table entry says where it lives. */}
          {def.name === 'nav-item' && !query && (
            <div className="entry-block" style={{ marginBottom: PAD.gap }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>selected</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>treatment</span>
                <span style={{ flex: 1 }} />
                <span className="chip">{SELECTION_STYLES[selectionStyle(cfg.selection)]?.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(SELECTION_STYLES).map(([key, spec]) => (
                  <SelectionChoice key={key} id={key} spec={spec} roles={derived.roles[mode]}
                    edge={SELECTION_EDGES[selectionEdge(cfg.selectionEdge)]}
                    selected={selectionStyle(cfg.selection) === key}
                    onPick={() => onSetSelection(key)} />
                ))}
              </div>
              {SELECTION_STYLES[selectionStyle(cfg.selection)]?.edge && (
                <div style={{ marginTop: PAD.row }}>
                  <Segmented value={selectionEdge(cfg.selectionEdge)} onChange={onSetSelectionEdge} full
                    options={Object.entries(SELECTION_EDGES).map(([key, spec]) => ({ value: key, label: `${spec.label} ${spec.px}px` }))} />
                </div>
              )}
              <div className="panel-note" style={{ marginTop: 8 }}>
                Sets <code>nav-item-selected</code>, <code>nav-item-hover</code>,{' '}
                <code>table-row-selected</code> and <code>table-row-hover</code> together.
                {SELECTION_STYLES[selectionStyle(cfg.selection)]?.edge &&
                  ' The label moves clear of the bar, so each one states its own inset as a sum.'}
              </div>
            </div>
          )}
          {/* The table row follows the nav item's control, so the entry says so
              rather than offering a second one that could disagree. */}
          {def.name === 'table' && !query && (
            <div className="panel-note" style={{ marginBottom: PAD.gap }}>
              <code>table-row-selected</code> takes the selected-row treatment set under{' '}
              <strong>Navigation &rarr; Nav item</strong>, currently{' '}
              <strong>{SELECTION_STYLES[selectionStyle(cfg.selection)]?.label}</strong>. One
              treatment for every selected row in the system.
            </div>
          )}
          {def.base && <EntryBlock entryName={def.name} title="base" props={def.base} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} tabStyle={cfg.tabStyle} />}
          {!query && LAYOUT_BY_NAME[def.name] && (
            <LayoutBlock def={LAYOUT_BY_NAME[def.name]} values={layout[def.name]} onSet={onSetLayout} />
          )}
          {Object.entries(def.variants ?? {}).map(([v, props]) => (
            <EntryBlock key={v} entryName={`${def.name}-${v}`} title="variant" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} tabStyle={cfg.tabStyle} />
          ))}
          {cfg.emitSizes && Object.entries(def.sizes ?? {}).map(([s, props]) => (
            <EntryBlock key={s} entryName={`${def.name}-${s}`} title="size" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} tabStyle={cfg.tabStyle} />
          ))}
          {cfg.emitStates && Object.entries(def.states ?? {}).flatMap(([stateName, byVariant]) =>
            Object.entries(byVariant).map(([variant, props]) => (
              <EntryBlock key={`${stateName}-${variant}`}
                entryName={variant === '_' ? `${def.name}-${stateName}` : `${def.name}-${variant}-${stateName}`}
                title="state" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} tabStyle={cfg.tabStyle} />
            ))
          )}
        </div>
      </Expand>
    </div>
  )
}

/* A tab strip rendered in the document's own colours, which is also the
   control. Picking a look by reading a description is guessing; picking it by
   looking at it is not.
   Three tabs, one selected, one disabled — the three states this setting
   writes — so the row shows the whole decision rather than the happy case. */
function TabStyleChoice({ id, spec, roles, selected, onPick }) {
  const pill = id === 'pill'
  const tab = (label, state) => {
    const on = state === 'on'
    const off = state === 'off'
    return (
      <span key={label} style={{
        display: 'inline-block', lineHeight: pill ? '22px' : '26px',
        padding: pill ? '0 8px' : '0 8px', fontSize: 12,
        whiteSpace: 'nowrap',
        fontWeight: on ? 500 : 400,
        color: off ? roles['text-subtle'] : on ? (pill ? roles.accent : roles.text) : roles['text-muted'],
        ...(pill
          ? { borderRadius: 6, background: on ? roles['accent-subtle'] : 'transparent' }
          /* An inset shadow, never a border: a border would make the selected
             tab taller than its neighbours and push it past the strip's rule. */
          : { boxShadow: on ? `inset 0 -2px 0 ${roles.accent}` : 'none' }),
      }}>{label}</span>
    )
  }

  /* The frame, the selected edge and the name over the description belong to
     every picker in the app equally, so they come from ChoiceCard. Only the
     sample is this picker's own. */
  return (
    <ChoiceCard label={spec.label} desc={spec.desc} selected={selected} onPick={onPick}
      sample={
        /* The sample sits on the document's surface, not the editor's, or the
           strip's own rule is measured against the wrong background. */
        <span style={{
          display: 'flex', gap: 4, flexShrink: 0, padding: pill ? '4px 6px' : '0 6px',
          background: roles.surface, borderRadius: 6,
          borderBottom: pill ? '1px solid transparent' : `1px solid ${roles.border}`,
        }}>
          {tab('Meta', 'idle')}{tab('Colour', 'on')}{tab('Type', 'off')}
        </span>
      } />
  )
}

/* ── A selected row, drawn under whichever treatment is offered ──
 *
 * Two rows, because a selection is only legible against an unselected
 * neighbour. The fill, the label colour and the edge all come from the spec
 * rather than from a branch per treatment, so a fourth option would need no
 * change here. */
function SelectionChoice({ id, spec, roles, edge, selected, onPick }) {
  const tint = id === 'tint'
  const row = (label, on) => (
    <span key={label} style={{
      display: 'block', lineHeight: '18px', fontSize: 11, borderRadius: 4,
      whiteSpace: 'nowrap', overflow: 'hidden',
      fontWeight: on ? 500 : 400,
      background: on ? (tint ? roles['accent-subtle'] : roles['surface-raised']) : 'transparent',
      color: on ? (tint ? roles.accent : roles.text) : roles['text-muted'],
      boxShadow: on && spec.edge ? `inset ${edge.px}px 0 0 ${roles.accent}` : 'none',
      paddingLeft: on && spec.edge ? 6 + edge.px : 6,
      paddingRight: 6,
    }}>{label}</span>
  )

  return (
    <ChoiceCard label={spec.label} desc={spec.desc} selected={selected} onPick={onPick}
      sample={
        /* On the document's own card, not the editor's, or the fill is
           measured against the wrong ground. */
        <span style={{
          display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0,
          width: 86, padding: 4, borderRadius: 6,
          background: roles.surface, border: `1px solid ${roles['border-subtle']}`,
        }}>
          {row('Overview', true)}{row('Accounts', false)}
        </span>
      } />
  )
}

export default function ComponentsPanel({ inspect }) {
  const { state, derived, set } = useStore()
  const cfg = state.components
  const componentFindings = useFindings('components')
  /* Which group holds the inspected entry, so it can be opened too. */
  const targetGroup = inspect
    ? COMPONENT_LIBRARY.find(d => entriesFor(d, cfg).includes(inspect.entry))?.group
    : null

  const upd = (fn, tag) => set(s => ({ ...s, components: fn(s.components) }), tag)
  /* Defaulted here too, so a document saved before the setting existed opens
     on the underline rather than on undefined. */
  const tabStyle = cfg.tabStyle ?? DEFAULT_TAB_STYLE
  const roles = derived.roles[state.color.mode]

  /* Panel-wide search.
   *
   * The panel already had a property filter INSIDE each open component, which
   * only helps once you have found the component. With 30 entries across six
   * closed groups, finding every button meant opening six accordions and
   * reading. Typing "button" should do it.
   *
   * Matches a component's own name, its label, and every flattened entry it
   * emits — so "hover" finds the components that have a hover state, and
   * "danger" finds `button-danger` under Actions. */
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const hits = useMemo(() => {
    const set = new Set()
    for (const def of COMPONENT_LIBRARY) {
      if (!q) { set.add(def.name); continue }
      const haystack = [def.name, def.label, def.group, ...entriesFor(def, cfg)]
      if (haystack.some(s => String(s).toLowerCase().includes(q))) set.add(def.name)
    }
    return set
  }, [q, cfg])

  /* Report entries, not components. "3 components match" is a smaller number
     than the list underneath and reads as a miscount. */
  const matchedEntries = useMemo(
    () => COMPONENT_LIBRARY.filter(d => hits.has(d.name)).reduce((n, d) => n + entriesFor(d, cfg).length, 0),
    [hits, cfg])
  const onToggle = (name, on) => upd(c => ({ ...c, enabled: { ...c.enabled, [name]: on } }))
  const onSet = (key, value) => upd(c => {
    const next = { ...c.overrides }
    if (value === '') delete next[key]; else next[key] = value
    return { ...c, overrides: next }
  }, `comp:${key}`)
  const onReset = key => upd(c => { const n = { ...c.overrides }; delete n[key]; return { ...c, overrides: n } })
  const onSetLayout = (name, field, value) => upd(c => ({
    ...c,
    layout: { ...c.layout, [name]: { ...c.layout?.[name], [field]: value } },
  }), `clayout:${name}.${field}`)

  const proseOnly = derived.components.reduce((n, c) =>
    n + c.properties.filter(p => !SPEC_COMPONENT_PROPS.includes(p.key)).length, 0)

  /* The same swatch grid the gradient stops use. Built once here rather than
     per property row — there are 48 entries and this walks every scale. */
  /* The same custom properties the preview pane injects, for the mode being
     shown. Built once here rather than per entry — there are 48 of them. */
  const sampleVars = useMemo(() => varsToStyle(buildCssVars({
    ...derived, elevationCfg: state.elevation,
    gradients: derived.gradients.map(g => ({ ...g, css: gradientCss(g, { roles: derived.roles[state.color.mode], ramps: derived.ramps, resolveRef }) })),
  }, state.color.mode)), [derived, state.elevation, state.color.mode])

  const colorGroups = useMemo(() => paletteGroups({
    seeds: state.color.seeds,
    roles: derived.roles[state.color.mode],
    ramps: derived.ramps,
    rampSteps: RAMP_STEPS,
    /* Seeds are shown at their own pinned step, matching the Colour tab. */
    resolveRef: ref => resolveRef(ref, derived.ramps),
  }), [state.color.seeds, state.color.mode, derived.roles, derived.ramps])

  return (
    /* The preview's custom properties, set once for the whole panel. Every
       .dmd sample below inherits them. */
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...sampleVars }}>
      {/* Every rule in here is scoped to .dmd, so a second copy in this pane
          styles the entry samples and reaches nothing else. */}
      <style>{PREVIEW_CSS}</style>
      <SectionHeader title="Components" desc="Variants, sizes and states, flattened the way the spec expects."
        right={<span className="chip">{derived.components.length} entries</span>} />

      <Banner tone="info">
        <span style={{
          display: 'inline-block', width: 12, height: 12, borderRadius: '50%', marginRight: 6,
          border: '1px solid rgb(var(--warn-rgb) / .5)', color: 'var(--warn)', fontSize: 10,
          lineHeight: '11px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle',
        }}>!</span>
        A property marked with this isn't one of the eight the DESIGN.md schema allows
        (<code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{SPEC_COMPONENT_PROPS.join(', ')}</code>),
        so it can't sit in the YAML frontmatter. It's written into the Components section of the file as a table
        instead — it still reaches the agent and is applied the same way, it just travels in a different part of
        the file. {proseOnly} propert{proseOnly === 1 ? 'y is' : 'ies are'} taking that route right now.
      </Banner>

      {/* Full width, and directly under the warning, because it is the first
          thing anyone needs on a panel of thirty entries in six closed groups.
          The existing filter lives inside an open component and only helps
          once you have already found it. */}
      <div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search components and properties — try “button”, “hover”, “danger”"
          aria-label="Search components"
          style={{ width: '100%' }} />
        {q && (
          <div className="panel-note" style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span>
              {hits.size === 0
                ? <>Nothing matches <strong>{search.trim()}</strong>.</>
                : <>{hits.size} component{hits.size === 1 ? '' : 's'} match <strong>{search.trim()}</strong>, {matchedEntries} entr{matchedEntries === 1 ? 'y' : 'ies'} in total.</>}
            </span>
            <span style={{ flex: 1 }} />
            {/* A filtered view with no way out reads as a broken panel. */}
            <button type="button" onClick={() => setSearch('')}
              style={{
                background: 'none', border: 0, padding: 0, cursor: 'pointer',
                color: 'var(--accent)', fontFamily: 'var(--sans)', fontSize: 12,
              }}>Clear</button>
          </div>
        )}
      </div>

      <Collapsible title="What Gets Emitted">
        <div style={{ display: 'flex', gap: 16 }}>
          <Toggle label="Emit sizes" checked={cfg.emitSizes} onChange={v => upd(c => ({ ...c, emitSizes: v }))} />
          <Toggle label="Emit states" checked={cfg.emitStates} onChange={v => upd(c => ({ ...c, emitStates: v }))} />
        </div>
      </Collapsible>



      {COMPONENT_GROUPS.map(group => {
        const defs = COMPONENT_LIBRARY.filter(d => d.group === group).filter(d => hits.has(d.name))
        if (!defs.length) return null
        const on = defs.filter(d => cfg.enabled[d.name] ?? d.on).length
        /* Same roll-up as the card headers, one level out. A finding on the
           checkbox is three closed disclosures deep on a fresh load, and a
           warning nobody can reach is not a warning. */
        const groupEntries = new Set(defs.flatMap(d => entriesFor(d, cfg)))
        const groupFindings = componentFindings.filter(f => groupEntries.has(f.entry)).length
        return (
          <Collapsible key={group} title={group} note={`${on}/${defs.length}`}
            right={groupFindings > 0
              ? <span className="chip" style={{ color: 'var(--warn)', borderColor: 'rgb(var(--warn-rgb) / .4)' }}
                  title={`${groupFindings} accessibility ${groupFindings === 1 ? 'finding' : 'findings'} in this group`}>⚠ {groupFindings}</span>
              : null}
            /* A search that finds a match inside a closed accordion has found
               nothing. While a query is active the groups are open, and they
               return to their own state when it clears. */
            defaultOpen={group === 'Actions'}
            open={search ? true : undefined}
            openSignal={targetGroup === group ? inspect.at : null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PAD.gap }}>
              {defs.map(def => (
                <ComponentBlock key={def.name} def={def} cfg={cfg} onSetTabStyle={v => upd(c => ({ ...c, tabStyle: v }))} onSetSelection={v => upd(c => ({ ...c, selection: v }))} onSetSelectionEdge={v => upd(c => ({ ...c, selectionEdge: v }))} onToggle={onToggle} onSet={onSet} onReset={onReset}
                  layout={derived.componentLayout} onSetLayout={onSetLayout}
                  derived={derived} mode={state.color.mode} inspect={inspect} colorGroups={colorGroups}
                  sampleVars={sampleVars} />
              ))}
            </div>
          </Collapsible>
        )
      })}

      {cfg.custom?.length > 0 && (
        <Collapsible title="Imported Components" note={String(cfg.custom.length)}>
          <p className="panel-note" style={{ marginBottom: 8 }}>Carried over from an imported file. Emitted verbatim.</p>
          {cfg.custom.map(c => (
            <div key={c.name} style={{ marginBottom: 8 }}>
              <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{c.name}</code>
              <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                {c.properties.map(p => `${p.key}: ${p.value}`).join(' · ')}
              </div>
            </div>
          ))}
          <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, marginTop: 6 }}
            onClick={() => upd(c => ({ ...c, custom: [] }))}>Remove all</button>
        </Collapsible>
      )}
    </div>
  )
}
