/* The component matrix.

   Nothing here is stored until you change it â€” the library supplies defaults
   and only edits are persisted. Entries are shown under the exact name they
   will carry in the file, so the hyphenated flattening the spec requires
   (`button-primary-hover`) is visible while you work rather than a surprise
   at export. */
import { useState, useEffect } from 'react'
import { useStore } from '../state/store.jsx'
import { COMPONENT_LIBRARY, COMPONENT_GROUPS } from '../state/components.js'
import { SPEC_COMPONENT_PROPS } from '../emit/yaml.js'
import { SectionHeader, Toggle, ResetButton, Banner, Collapsible, Expand, FilterField } from '../ui/controls.jsx'
import { useReveal, revealStyle } from '../ui/reveal.js'

/* Which token group a property should draw from. Offering `{colors.*}` for a
   padding field is noise; offering nothing at all is what made these look like
   "clueless text fields". */
const COLOR_PROPS = ['backgroundColor', 'textColor', 'borderColor', 'outlineColor', 'fill', 'stroke']
/* Spacing steps are the right vocabulary for gaps between things. */
const SPACING_PROPS = ['padding', 'gap', 'margin']
/* Dimensions are not spacing steps â€” a control's height is its own decision,
   so these get plain pixel values rather than `{spacing.*}` references. */
const SIZE_PROPS = ['height', 'width', 'size', 'minHeight', 'maxHeight', 'outlineOffset', 'iconSize']

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
    if (group === 'colors') return { kind: 'color', value: derived.roles[mode][key] }
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

function PropRow({ entryName, propKey, defaultValue, override, onSet, onReset, derived, mode }) {
  const legal = SPEC_COMPONENT_PROPS.includes(propKey)
  const set = override != null
  const current = override ?? defaultValue
  const options = optionsFor(propKey, derived)
  const listId = `dmd-opt-${propKey}`
  const resolved = resolveValue(current, derived, mode)

  const key = `${entryName}.${propKey}`
  const spaceTarget = SPACING_PROPS.includes(propKey) ? spacingTarget(current, derived.spacing) : null
  const sizePx = SIZE_PROPS.includes(propKey) ? parseFloat(current) : NaN
  const hasSizeSlider = SIZE_PROPS.includes(propKey) && Number.isFinite(sizePx)

  const nudgeSpacing = newIdx => {
    const step = derived.spacing[newIdx]
    if (!step || !spaceTarget) return
    const str = String(current)
    onSet(key, str.slice(0, spaceTarget.at) + `{spacing.${step.name}}` + str.slice(spaceTarget.at + spaceTarget.length))
  }

  return (
    <div style={{ padding: '1px 0' }}>
      {/* Fixed row height and an always-present reset button: the row used to
          grow by a pixel the moment a value was set, because the badge only
          existed once there was an override. */}
      <div style={{ display: 'grid', gridTemplateColumns: '128px minmax(0,1fr) 96px 16px 20px', gap: 8, alignItems: 'center', height: 26 }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: legal ? 'var(--text-dim)' : 'var(--warn)' }}>{propKey}</code>

        <input list={options.length ? listId : undefined}
          value={override ?? ''} placeholder={defaultValue}
          onChange={e => onSet(key, e.target.value)}
          title={options.length ? 'Pick a token or type a value' : 'Type a value'}
          style={{
            fontFamily: 'var(--mono)', fontSize: 10.5, padding: '3px 6px',
            color: set ? 'var(--accent)' : 'var(--muted)',
            borderColor: set ? 'rgba(220,144,85,.4)' : 'var(--bdr)',
          }} />
        {options.length > 0 && (
          <datalist id={listId}>{options.map(o => <option key={o} value={o} />)}</datalist>
        )}

        {/* What the value actually resolves to right now. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {resolved?.kind === 'color' && (
            <>
              <span className="swatch" style={{ width: 13, height: 13, background: resolved.value, cursor: 'default' }} />
              <code style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolved.value}</code>
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
          border: '1px solid rgba(216,164,65,.5)', color: 'var(--warn)',
          fontSize: 9, lineHeight: '11px', textAlign: 'center', fontWeight: 700,
        }}>!</span>

        {/* The orange border already says "overridden", so this is just the
            way back â€” dimmed, not hidden, so the row never reflows. */}
        <ResetButton onClick={() => onReset(key)} disabled={!set} title="Reset to the default value" />
      </div>

      {/* Direct control for the values worth nudging by feel rather than typing. */}
      {(spaceTarget || hasSizeSlider) && (
        <div style={{ display: 'grid', gridTemplateColumns: '128px minmax(0,1fr)', gap: 8, alignItems: 'center', marginBottom: 3 }}>
          <span />
          {spaceTarget ? (
            <input type="range" min={0} max={derived.spacing.length - 1} step={1} value={spaceTarget.idx}
              onChange={e => nudgeSpacing(Number(e.target.value))}
              title={`Spacing step â€” ${derived.spacing[spaceTarget.idx]?.name}`}
              style={{ height: 13 }} />
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

function EntryBlock({ title, entryName, props, overrides, onSet, onReset, derived, mode, inspect, query }) {
  /* The jump targets the exact entry â€” clicking a small button lands on
     `button-sm`, not merely somewhere inside Button. */
  const targeted = inspect?.entry === entryName
  const ref = useReveal(targeted, inspect?.at)

  /* Filtered after the hooks â€” an early return above them would change the
     hook order between renders. */
  const shown = Object.entries(props).filter(([k, v]) => matches(query, entryName, k, overrides[`${entryName}.${k}`] ?? v))
  if (!shown.length) return null

  return (
    <div ref={ref} style={{
      marginBottom: 10,
      ...revealStyle(targeted),
      ...(targeted && { padding: '7px 8px', margin: '0 -8px 10px' }),
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{entryName}</code>
        {title && <span style={{ fontSize: 10, color: 'var(--dim)' }}>{title}</span>}
        {targeted && <span className="chip" style={{ color: 'var(--accent)', borderColor: 'rgba(220,144,85,.4)' }}>from preview</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {shown.map(([k, v]) => (
          <PropRow key={k} entryName={entryName} propKey={k} defaultValue={String(v)}
            override={overrides[`${entryName}.${k}`]} onSet={onSet} onReset={onReset}
            derived={derived} mode={mode} />
        ))}
      </div>
    </div>
  )
}

function ComponentBlock({ def, cfg, onToggle, onSet, onReset, derived, mode, inspect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const enabled = cfg.enabled[def.name] ?? def.on
  const overrides = cfg.overrides ?? {}

  /* A click in the gallery opens the owning component and scrolls to it. */
  const targeted = inspect && entriesFor(def, cfg).includes(inspect.entry)
  /* Only opens the component â€” the matching EntryBlock does the scrolling, so
     the view lands on the exact entry rather than the top of the block. */
  useEffect(() => { if (targeted) setOpen(true) }, [targeted, inspect?.at])

  const entryCount =
    (def.base ? 1 : 0) +
    Object.keys(def.variants ?? {}).length +
    (cfg.emitSizes ? Object.keys(def.sizes ?? {}).length : 0) +
    (cfg.emitStates ? Object.values(def.states ?? {}).reduce((n, byVariant) => n + Object.keys(byVariant).length, 0) : 0)

  const touched = Object.keys(overrides).filter(k => k === def.name || k.startsWith(`${def.name}.`) || k.startsWith(`${def.name}-`)).length

  return (
    <div style={{
      background: 'var(--surf2)',
      border: `1px solid ${targeted ? 'var(--accent)' : open ? 'rgba(220,144,85,.35)' : 'var(--bdr)'}`,
      borderRadius: 9, overflow: 'hidden', opacity: enabled ? 1 : 0.55,
      transition: 'border-color var(--t) var(--ease)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px' }}>
        <input type="checkbox" checked={enabled} onChange={e => onToggle(def.name, e.target.checked)}
          style={{ width: 14, height: 14, accentColor: 'var(--accent)', padding: 0, flexShrink: 0 }} />
        <button onClick={() => setOpen(o => !o)} disabled={!enabled}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default', color: 'var(--text)', textAlign: 'left', padding: 0, fontFamily: 'var(--sans)', minWidth: 0 }}>
          <span style={{ fontSize: 13, flex: 1 }}>{def.label}</span>
          {touched > 0 && <span className="chip" style={{ color: 'var(--accent)' }}>{touched}</span>}
          <span className="chip">{entryCount}</span>
        </button>
        {/* Search within the component: a Button expands to 15 entries and
            scrolling for `gap` is a waste of a scroll wheel. */}
        {open && enabled && <FilterField value={query} onChange={setQuery} placeholder="gap, colourâ€¦" width={124} />}
      </div>
      <Expand open={open && enabled}>
        <div style={{ padding: '11px 13px', borderTop: '1px solid var(--bdr)', background: 'var(--surf2)' }}>
          {query && (
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 8 }}>
              Showing properties matching <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{query}</code>
            </div>
          )}
          {def.base && <EntryBlock entryName={def.name} title="base" props={def.base} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} />}
          {Object.entries(def.variants ?? {}).map(([v, props]) => (
            <EntryBlock key={v} entryName={`${def.name}-${v}`} title="variant" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} />
          ))}
          {cfg.emitSizes && Object.entries(def.sizes ?? {}).map(([s, props]) => (
            <EntryBlock key={s} entryName={`${def.name}-${s}`} title="size" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} />
          ))}
          {cfg.emitStates && Object.entries(def.states ?? {}).flatMap(([stateName, byVariant]) =>
            Object.entries(byVariant).map(([variant, props]) => (
              <EntryBlock key={`${stateName}-${variant}`}
                entryName={variant === '_' ? `${def.name}-${stateName}` : `${def.name}-${variant}-${stateName}`}
                title="state" props={props} overrides={overrides} onSet={onSet} onReset={onReset} derived={derived} mode={mode} inspect={inspect} query={query} />
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

  const proseOnly = derived.components.reduce((n, c) =>
    n + c.properties.filter(p => !SPEC_COMPONENT_PROPS.includes(p.key)).length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader title="Components" desc="Variants, sizes and states, flattened the way the spec expects."
        right={<span className="chip">{derived.components.length} entries</span>} />

      <Banner tone="info">
        <span style={{
          display: 'inline-block', width: 13, height: 13, borderRadius: '50%', marginRight: 5,
          border: '1px solid rgba(216,164,65,.5)', color: 'var(--warn)', fontSize: 9,
          lineHeight: '11px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle',
        }}>!</span>
        A property marked with this isn't one of the eight the DESIGN.md schema allows
        (<code style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{SPEC_COMPONENT_PROPS.join(', ')}</code>),
        so it can't sit in the YAML frontmatter. It's written into the Components section of the file as a table
        instead â€” it still reaches the agent and is applied the same way, it just travels in a different part of
        the file. {proseOnly} propert{proseOnly === 1 ? 'y is' : 'ies are'} taking that route right now.
      </Banner>

      <Collapsible title="What gets emitted">
        <div style={{ display: 'flex', gap: 14 }}>
          <Toggle label="Emit sizes" checked={cfg.emitSizes} onChange={v => upd(c => ({ ...c, emitSizes: v }))} />
          <Toggle label="Emit states" checked={cfg.emitStates} onChange={v => upd(c => ({ ...c, emitStates: v }))} />
        </div>
      </Collapsible>

      {COMPONENT_GROUPS.map(group => {
        const defs = COMPONENT_LIBRARY.filter(d => d.group === group)
        const on = defs.filter(d => cfg.enabled[d.name] ?? d.on).length
        return (
          <Collapsible key={group} title={group} note={`${on}/${defs.length}`}
            defaultOpen={group === 'Actions'}
            openSignal={targetGroup === group ? inspect.at : null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {defs.map(def => (
                <ComponentBlock key={def.name} def={def} cfg={cfg} onToggle={onToggle} onSet={onSet} onReset={onReset}
                  derived={derived} mode={state.color.mode} inspect={inspect} />
              ))}
            </div>
          </Collapsible>
        )
      })}

      {cfg.custom?.length > 0 && (
        <Collapsible title="Imported components" note={String(cfg.custom.length)}>
          <p className="panel-note" style={{ marginBottom: 8 }}>Carried over from an imported file. Emitted verbatim.</p>
          {cfg.custom.map(c => (
            <div key={c.name} style={{ marginBottom: 8 }}>
              <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{c.name}</code>
              <div style={{ fontSize: 10.5, color: 'var(--dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                {c.properties.map(p => `${p.key}: ${p.value}`).join(' Â· ')}
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
