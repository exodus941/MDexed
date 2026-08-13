/* One component entry, rendered on its own.
 *
 * The Components tab shows a property matrix: `height`, `padding`,
 * `backgroundColor`, a resolved swatch beside each. What it never showed was
 * the thing itself. You could set `button-lg` to a 44px height and a 16px
 * radius and have no idea whether that looked like a button until you found
 * one in the preview pane, on a surface that may not even be visible.
 *
 * These samples close that loop. Same stylesheet, same custom properties, same
 * classes the preview surfaces use — so what appears here is the component,
 * not an impression of it. Nothing is drawn from a second set of values.
 *
 * Rendered inside a `.dmd` scope carrying the derived vars, because every rule
 * in PREVIEW_CSS is written against that class. Without it a button here would
 * inherit the editor's chrome and lie about everything.
 */

import { Check, Switch, Ico, IconChevron } from './icons.jsx'

/* Entry names are flattened: `button`, `button-primary`, `button-lg`,
   `button-primary-hover`. The component knows its own variants, sizes and
   states, so the split is a lookup rather than a guess — `nav-item` contains a
   hyphen too, and splitting on it blindly would break that one. */
export function parseEntry(entryName, def, cfg = {}) {
  if (entryName === def.name) return { variant: null, size: null, state: null }
  const rest = entryName.slice(def.name.length + 1)

  const variants = Object.keys(def.variants ?? {})
  const sizes = Object.keys(def.sizes ?? {})
  const states = Object.keys(def.states ?? {})

  if (variants.includes(rest)) return { variant: rest, size: null, state: null }
  if (sizes.includes(rest)) return { variant: null, size: rest, state: null }
  if (states.includes(rest)) return { variant: null, size: null, state: rest }

  /* `<variant>-<state>` is the only compound form the emitter produces. */
  for (const s of states) {
    if (rest.endsWith(`-${s}`)) {
      const v = rest.slice(0, -(s.length + 1))
      if (variants.includes(v)) return { variant: v, size: null, state: s }
    }
  }
  return { variant: null, size: null, state: null }
}

/* A state is shown by forcing the class the stylesheet already keys off, so
   the sample uses the same rule a real hover would. `focus` is the exception:
   the ring is drawn by `:focus-visible`, which cannot be forced from a class,
   so it gets an outline built from the focus tokens instead. */
const STATE_CLASS = { hover: 'is-hover', active: 'is-active', disabled: 'is-disabled', selected: 'is-active', checked: 'is-checked' }

const focusRing = (focus, roles) =>
  focus?.style && focus.style !== 'none'
    ? { outline: `${focus.width}px ${focus.style} ${roles[focus.role] ?? roles.accent}`, outlineOffset: `${focus.offset}px` }
    : undefined

/* Markup per component. Each returns the element the stylesheet expects, with
   the classes that carry the entry's variant and size. */
function markup({ base, variant, size, state, cls, style, label, tabStyle }) {
  const sz = size ? ` btn-${size}` : ''
  switch (base) {
    case 'button':
      return <button className={`btn btn-${variant ?? 'primary'}${sz} ${cls}`} style={style} disabled={state === 'disabled'}>{label ?? 'Button'}</button>
    case 'input':
      return <input className={`input ${cls}`} style={style} defaultValue="Input value" readOnly />
    case 'textarea':
      return <textarea className={`input ${cls}`} style={{ minHeight: 54, ...style }} defaultValue="Multiple lines of text" readOnly />
    /* The same markup the Form and the Gallery use, not a lookalike.
     *
     * This was a `.btn` with an inline `justify-content`, which does nothing on
     * an inline-block, plus a hand-drawn chevron that missed every rule the
     * icon class carries. The result put the value and the mark together in the
     * middle of the box — a sample that showed a control this system does not
     * contain. A preview that misreports the component is worse than no preview,
     * because it is the thing people check their tokens against.
     *
     * Third instance of that dead `justify-content`. The other two were fixed
     * hours earlier in the two files anyone would think to look in, and this
     * one survived because nobody looks for a component inside a sample. */
    case 'select':
      return (
        <button className={`btn btn-secondary select-trigger select-trigger-block ${cls}`}
          style={{ maxWidth: 280, height: 'var(--cmp-select-height, 36px)', ...style }}>
          <span>Choose one</span><Ico d={IconChevron} size="sm" />
        </button>
      )
    /* Neither of these has a stylesheet rule — they are drawn from tokens by
       `Check` and `Switch`, the same renderers the Gallery and the Form
       surface use. Inventing classes for them here produced two empty spans,
       which is what a sample looks like when it is styled by nothing. */
    case 'checkbox':
      return (
        <span className="row" style={style}><Check on={state === 'checked'} /><span className="small">Label</span></span>
      )
    case 'switch':
      return (
        <span className="row" style={style}><Switch on={state === 'checked'} /><span className="small">Label</span></span>
      )
    case 'card':
      return (
        <div className={`card ${variant ? `card-${variant}` : ''} ${cls}`} style={{ maxWidth: 260, ...style }}>
          <strong style={{ fontSize: 'var(--font-h5-size)' }}>Card title</strong>
          <p className="small muted" style={{ marginTop: 4 }}>Supporting line of body text.</p>
        </div>
      )
    case 'modal':
      return (
        <div className={`card card-overlay ${cls}`} style={{ maxWidth: 260, ...style }}>
          <strong style={{ fontSize: 'var(--font-h5-size)' }}>Confirm</strong>
          <p className="small muted" style={{ margin: '4px 0 10px' }}>This cannot be undone.</p>
          <span className="row"><button className="btn btn-primary btn-sm">Confirm</button><button className="btn btn-ghost btn-sm">Cancel</button></span>
        </div>
      )
    case 'badge':
      return <span className={`badge ${variant ? `badge-${variant}` : ''} ${cls}`} style={style}>{variant ?? 'Badge'}</span>
    case 'alert':
      return (
        <div className={`alert ${variant ? `alert-${variant}` : ''} ${cls}`} style={style}>
          <span className="small">A short message about what happened.</span>
        </div>
      )
    case 'tooltip':
      return <span className={`tooltip ${cls}`} style={style}>Tooltip text</span>
    case 'table':
      return (
        <table className={`table ${cls}`} style={{ maxWidth: 280, ...style }}>
          <thead><tr><th>Name</th><th>Value</th></tr></thead>
          <tbody><tr><td>First row</td><td>12</td></tr><tr><td>Second row</td><td>34</td></tr></tbody>
        </table>
      )
    case 'nav-item':
      return <span className={`nav-item ${state === 'selected' ? 'is-active' : ''} ${cls}`} style={style}>Navigation</span>
    /* A tab is shown inside a strip, because half of what the entry does is
       relate to the rule under it — an underline sits ON that rule, and a tab
       drawn alone shows a floating mark against nothing.
       This case was missing when the component was added, so the one entry a
       builder most needed a picture of had property rows and no sample. */
    case 'tab': {
      const sel = state === 'selected'
      const disabled = state === 'disabled'
      const pill = tabStyle === 'pill'
      return (
        <span style={{
          display: 'inline-flex', gap: 'var(--space-2xs)',
          padding: pill ? 'var(--space-2xs) var(--space-2xs)' : '0 var(--space-2xs)',
          background: 'var(--c-surface)', borderRadius: 'var(--radius-sm)',
          /* `border-subtle` draws every line that divides, and the rule under a
             tab strip is one. This said `border` — the retired rule, written
             while `border-subtle` was broken. A pill floats clear and needs no
             rule at all. */
          borderBottom: pill ? '1px solid transparent' : '1px solid var(--c-border-subtle)',
        }}>
          <span className={cls} style={{
            display: 'inline-block', lineHeight: pill ? '24px' : '30px',
            padding: '0 10px', whiteSpace: 'nowrap',
            fontFamily: 'var(--cmp-tab-font-family, inherit)',
            fontSize: 'var(--cmp-tab-font-size, 13px)',
            fontWeight: sel ? 500 : 400,
            color: disabled ? 'var(--c-text-subtle)'
              : sel ? (pill ? 'var(--c-accent)' : 'var(--c-text)') : 'var(--c-text-muted)',
            ...(pill
              ? { borderRadius: 'var(--radius-md, 6px)', background: sel ? 'var(--c-accent-subtle)' : 'transparent' }
              /* An inset shadow, never a border: a border would make the
                 selected tab taller and push it past the strip's own rule. */
              : { boxShadow: sel ? 'inset 0 -2px 0 var(--c-accent)' : 'none' }),
            ...style,
          }}>Colour</span>
          <span style={{
            display: 'inline-block', lineHeight: pill ? '24px' : '30px', padding: '0 10px',
            fontFamily: 'var(--cmp-tab-font-family, inherit)',
            fontSize: 'var(--cmp-tab-font-size, 13px)',
            color: 'var(--c-text-muted)', opacity: 0.55,
          }}>Type</span>
        </span>
      )
    }
    case 'avatar':
      return <span className={`avatar ${cls}`} style={style}>AK</span>
    default:
      return null
  }
}

/**
 * @param def       the component definition from the library
 * @param entryName the flattened name being edited, e.g. `button-lg`
 */
export default function EntrySample({ def, entryName, focus, roles, tabStyle }) {
  const { variant, size, state } = parseEntry(entryName, def)
  const cls = STATE_CLASS[state] ?? ''
  const style = state === 'focus' ? focusRing(focus, roles) : undefined
  const el = markup({ base: def.name, variant, size, state, cls, style, tabStyle })
  if (!el) return null

  /* Inert. These are pictures of a state, not controls.
   *
   * `button-primary-hover` renders the hover appearance; pointing at it must
   * not then apply a *second* hover on top, and moving away must not take the
   * state away — the sample would stop showing the entry it is labelled with
   * the moment you tried to look at it closely. `pointer-events: none` on the
   * whole stage settles it for every component at once, including the ones
   * whose states come from `:hover` rules rather than forced classes. */
  /* No vars here. They are set once on the panel root and inherit down —
     spreading 335 custom properties onto each of 48 samples put sixteen
     thousand inline declarations in the tree and made the tab crawl. */
  return (
    <div className="dmd entry-sample" aria-hidden>
      <div style={{ pointerEvents: 'none' }}>{el}</div>
    </div>
  )
}
