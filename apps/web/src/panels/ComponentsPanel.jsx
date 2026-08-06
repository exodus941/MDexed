/* The component matrix.

   Nothing here is stored until you change it — the library supplies defaults
   and only edits are persisted. Entries are shown under the exact name they
   will carry in the file, so the hyphenated flattening the spec requires
   (`button-primary-hover`) is visible while you work rather than a surprise
   at export. */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../state/store.jsx'
import { COMPONENT_LIBRARY, COMPONENT_GROUPS } from '../state/components.js'
import { SPEC_COMPONENT_PROPS } from '../emit/yaml.js'
import { LAYOUT_BY_NAME, fieldActive } from '../state/componentLayout.js'
import { SectionHeader, Toggle, ResetButton, Banner, Collapsible, Expand, FilterField, Segmented, PAD, SnapSlider } from '../ui/controls.jsx'
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
const WIDE_SAMPLE = new Set(['modal', 'table', 'card', 'alert', 'textarea'])

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
      <div style={{ display: 'grid', gridTemplateColumns: '128px minmax(0,1fr) 96px 16px 20px', gap: 8, alignItems: 'center' }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: legal ? 'var(--text-dim)' : 'var(--warn)' }}>{propKey}</code>

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
                style={{ width: 13, height: 13, background: resolved.value, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolved.value}</code>
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
            <span style={{ width: 34, height: 13, borderRadius: 3, background: resolved.value, border: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }} />
          )}
          {resolved?.kind === 'text' && (
            <code style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resolved.value}</code>
          )}
        </div>

        {/* Marks a property the frontmatter can't carry. Explained in full in
            the panel banner, so this only has to be a flag, not a paragraph. */}
        <span style={{
          visibility: legal ? 'hidden' : 'visible',
          width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
          border: '1px solid rgb(var(--warn-rgb) / .5)', color: 'var(--warn)',
          fontSize: 9, lineHeight: '11px', textAlign: 'center', fontWeight: 700,
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
        <div style={{ display: 'grid', gridTemplateColumns: '128px minmax(0,1fr)', gap: 8, alignItems: 'center', marginTop: 3 }}>
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
              title="Size in pixels" style={{ height: 13 }} />
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

function EntryBlock({ title, entryName, props, overrides, onSet, onReset, derived, mode, inspect, query, colorGroups, def, sampleVars }) {
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
        <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{entryName}</code>
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
            <EntrySample def={def} entryName={entryName}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 2 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', minWidth: 104 }}>{field.label}</span>
              <Segmented size="sm" value={values[field.k]} onChange={v => onSet(def.name, field.k, v)}
                options={field.options.map(o => ({ value: o.value, label: o.label }))} />
            </div>
          </Expand>
        ))}
      </div>
    </div>
  )
}

function ComponentBlock({ def, cfg, layout, onSetLayout, onToggle, onSet, onReset, derived, mode, inspect, colorGroups, sampleVars }) {
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
      borderRadius: 9, overflow: 'hidden', opacity: enabled ? 1 : 0.55,
      transition: 'border-color var(--t) var(--ease)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '8px 12px' }}>
        <input type="checkbox" checked={enabled} onChange={e => onToggle(def.name, e.target.checked)}
          style={{ width: 14, height: 14, accentColor: 'var(--accent)', padding: 0, flexShrink: 0, alignSelf: 'center' }} />
        <button onClick={() => setOpen(o => !o)} disabled={!enabled}
          style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default', color: 'var(--text)', textAlign: 'left', padding: 0, fontFamily: 'var(--sans)', minWidth: 0 }}>
          <span style={{ fontSize: 13, flex: 1 }}>{def.label}</span>
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
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 8 }}>
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
          {def.base && <EntryBlock entryName={def.name} title="base" props={def.base} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} />}
          {!query && LAYOUT_BY_NAME[def.name] && (
            <LayoutBlock def={LAYOUT_BY_NAME[def.name]} values={layout[def.name]} onSet={onSetLayout} />
          )}
          {Object.entries(def.variants ?? {}).map(([v, props]) => (
            <EntryBlock key={v} entryName={`${def.name}-${v}`} title="variant" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} />
          ))}
          {cfg.emitSizes && Object.entries(def.sizes ?? {}).map(([s, props]) => (
            <EntryBlock key={s} entryName={`${def.name}-${s}`} title="size" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} />
          ))}
          {cfg.emitStates && Object.entries(def.states ?? {}).flatMap(([stateName, byVariant]) =>
            Object.entries(byVariant).map(([variant, props]) => (
              <EntryBlock key={`${stateName}-${variant}`}
                entryName={variant === '_' ? `${def.name}-${stateName}` : `${def.name}-${variant}-${stateName}`}
                title="state" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} colorGroups={colorGroups} def={def} sampleVars={sampleVars} />
            ))
          )}
        </div>
      </Expand>
    </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...sampleVars }}>
      {/* Every rule in here is scoped to .dmd, so a second copy in this pane
          styles the entry samples and reaches nothing else. */}
      <style>{PREVIEW_CSS}</style>
      <SectionHeader title="Components" desc="Variants, sizes and states, flattened the way the spec expects."
        right={<span className="chip">{derived.components.length} entries</span>} />

      <Banner tone="info">
        <span style={{
          display: 'inline-block', width: 13, height: 13, borderRadius: '50%', marginRight: 5,
          border: '1px solid rgb(var(--warn-rgb) / .5)', color: 'var(--warn)', fontSize: 9,
          lineHeight: '11px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle',
        }}>!</span>
        A property marked with this isn't one of the eight the DESIGN.md schema allows
        (<code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{SPEC_COMPONENT_PROPS.join(', ')}</code>),
        so it can't sit in the YAML frontmatter. It's written into the Components section of the file as a table
        instead — it still reaches the agent and is applied the same way, it just travels in a different part of
        the file. {proseOnly} propert{proseOnly === 1 ? 'y is' : 'ies are'} taking that route right now.
      </Banner>

      <Collapsible title="What Gets Emitted">
        <div style={{ display: 'flex', gap: 14 }}>
          <Toggle label="Emit sizes" checked={cfg.emitSizes} onChange={v => upd(c => ({ ...c, emitSizes: v }))} />
          <Toggle label="Emit states" checked={cfg.emitStates} onChange={v => upd(c => ({ ...c, emitStates: v }))} />
        </div>
      </Collapsible>

      {COMPONENT_GROUPS.map(group => {
        const defs = COMPONENT_LIBRARY.filter(d => d.group === group)
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
            defaultOpen={group === 'Actions'}
            openSignal={targetGroup === group ? inspect.at : null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: PAD.gap }}>
              {defs.map(def => (
                <ComponentBlock key={def.name} def={def} cfg={cfg} onToggle={onToggle} onSet={onSet} onReset={onReset}
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
              <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{c.name}</code>
              <div style={{ fontSize: 10.5, color: 'var(--dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                {c.properties.map(p => `${p.key}: ${p.value}`).join(' · ')}
              </div>
            </div>
          ))}
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, marginTop: 6 }}
            onClick={() => upd(c => ({ ...c, custom: [] }))}>Remove all</button>
        </Collapsible>
      )}
    </div>
  )
}
