/* Overlays over real content.

   Modals, scrims, tooltips and toasts have nowhere honest to sit on the other
   surfaces — a modal shown inline isn't a modal. This is where the elevation
   strategy, scrim opacity and blend mode are actually visible. */
import { inspectProps } from '../inspect.js'
import { Ico, Check, IconAlert, IconCheck, IconX, IconTrash, IconInfo, IconMore, IconStar } from '../icons.jsx'

export default function Dialog({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)

  return (
    <div className="stack">
      <div>
        <h2>Overlays</h2>
        <p className="muted small" style={{ marginTop: 4 }}>Modal, scrim, tooltip, toast and menu, over live page content.</p>
      </div>

      {/* Modal over a dimmed page — the scrim settings from Depth apply here. */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-lg, 16px)', overflow: 'hidden', border: '1px solid var(--c-border-subtle, #eee)' }}>
        <div style={{ padding: 'var(--space-lg, 24px)' }} className="stack-sm">
          <h3 style={{ fontSize: 'var(--font-h4-size, 25px)' }}>Invoices</h3>
          <p className="muted small">Page content sitting behind the dialog.</p>
          <div className="row">
            <button className="btn btn-secondary btn-sm">Filter</button>
            <button className="btn btn-secondary btn-sm">Export</button>
          </div>
          {['82%', '64%', '91%'].map(w => (
            <div key={w} style={{ height: 9, width: w, borderRadius: 3, background: 'var(--c-bg-subtle, #eee)' }} />
          ))}
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--c-neutral-950, #111)',
          opacity: 'var(--scrim-opacity, .55)',
          mixBlendMode: 'var(--scrim-blend, normal)',
        }} />

        <div {...ins('modal')} style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          width: 'var(--cmp-modal-width, min(400px, 86%))',
          background: 'var(--cmp-modal-background-color, var(--c-surface-raised, #fff))',
          borderRadius: 'var(--cmp-modal-rounded, var(--radius-lg, 16px))',
          padding: 'var(--cmp-modal-padding, var(--space-lg, 24px))',
          boxShadow: 'var(--cmp-modal-box-shadow, var(--shadow-modal, none))',
          border: '1px solid var(--c-border-subtle, #eee)',
          cursor: onInspect ? 'pointer' : undefined,
        }}>
          <div className="row" style={{ marginBottom: 'var(--space-sm, 12px)' }}>
            <span style={{ color: 'var(--c-danger, #c00)', display: 'flex' }}><Ico d={IconAlert} size="lg" /></span>
            <h3 style={{ flex: 1, fontSize: 'var(--font-h5-size, 20px)' }}>Delete this invoice?</h3>
            <button className="icon-btn" {...ins('button-secondary')}><Ico d={IconX} /></button>
          </div>
          <p className="muted small" style={{ marginBottom: 'var(--space-md, 16px)' }}>
            Invoice NW-0421 will be removed permanently. This cannot be undone.
          </p>
          <label className="with-icon" style={{ marginBottom: 'var(--space-md, 16px)', cursor: 'pointer' }} {...ins('checkbox')}>
            <Check /><span className="small">Also notify the customer</span>
          </label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" {...ins('button-ghost')}>Cancel</button>
            <button className="btn btn-danger" {...ins('button-danger')}><Ico d={IconTrash} />Delete</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Toast */}
        <div className="card card-overlay row" {...ins('card-overlay')}>
          <span style={{ color: 'var(--c-success, green)', display: 'flex' }}><Ico d={IconCheck} /></span>
          <span className="small" style={{ flex: 1 }}>Invoice sent to Northwind</span>
          <button className="btn btn-ghost btn-sm" {...ins('button-ghost')}>Undo</button>
        </div>

        {/* Dropdown menu */}
        <div className="card card-overlay" style={{ padding: 4 }} {...ins('card-overlay')}>
          {[['Duplicate', IconStar], ['Details', IconInfo], ['More actions', IconMore]].map(([label, icon]) => (
            <div key={label} className="with-icon nav-item" {...ins('nav-item')}>
              <Ico d={icon} />{label}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip, anchored the way one really is */}
      <div className="card" {...ins('card')}>
        <div className="row" style={{ gap: 'var(--space-xl, 32px)', paddingTop: 26, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <span {...ins('tooltip')} style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              background: 'var(--cmp-tooltip-background-color, var(--c-text, #111))',
              color: 'var(--cmp-tooltip-text-color, var(--c-text-inverse, #fff))',
              borderRadius: 'var(--cmp-tooltip-rounded, var(--radius-sm, 4px))',
              padding: 'var(--cmp-tooltip-padding, 2px 8px)',
              fontSize: 'var(--cmp-tooltip-font-size, var(--font-caption-size, 12px))',
              cursor: onInspect ? 'pointer' : undefined,
            }}>Mark as paid</span>
            <button className="btn btn-secondary btn-sm" {...ins('button-sm')}><Ico d={IconCheck} size="sm" />Paid</button>
          </div>
          <span className="caption">Tooltips sit above their trigger and never wrap.</span>
        </div>
      </div>
    </div>
  )
}
