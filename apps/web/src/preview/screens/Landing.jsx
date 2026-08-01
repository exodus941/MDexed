/* A marketing page. Display type at full size, generous rhythm, and the
   accent doing persuasive work rather than utility work — the conditions
   under which a system built for dashboards usually falls apart. */
import { inspectProps } from '../Gallery.jsx'

export default function Landing({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  return (
    <div style={{ maxWidth: 'var(--measure, 68ch)', margin: '0 auto' }} className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <div className="avatar" {...ins('avatar')}>N</div>
          <strong style={{ fontSize: 'var(--font-body-md-size, 16px)' }}>Northwind</strong>
        </div>
        <div className="row">
          <span className="nav-item" {...ins('nav-item')}>Pricing</span>
          <span className="nav-item" {...ins('nav-item')}>Docs</span>
          <button className="btn btn-primary btn-sm" {...ins('button-sm')}>Start free</button>
        </div>
      </div>

      <hr className="divider" />

      <div className="stack" style={{ padding: 'var(--space-xl, 32px) 0' }}>
        <span className="badge badge-accent" {...ins('badge-accent')} style={{ alignSelf: 'flex-start', cursor: onInspect ? 'pointer' : undefined }}>New — recurring invoices</span>
        <h1 style={{ maxWidth: '14ch' }}>Invoicing that stays out of the way</h1>
        <p style={{ fontSize: 'var(--font-body-lg-size, 18px)', color: 'var(--c-text-muted, #666)', maxWidth: '46ch' }}>
          Send an invoice in twenty seconds. Chase it automatically. Reconcile it without opening a spreadsheet.
        </p>
        <div className="row" style={{ marginTop: 'var(--space-sm, 8px)' }}>
          <button className="btn btn-primary btn-lg" {...ins('button-lg')}>Start free</button>
          <button className="btn btn-secondary btn-lg" {...ins('button-secondary')}>Book a demo</button>
        </div>
        <p className="caption">No card required · Cancel any time</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          ['Send in seconds', 'Templates remember your line items, tax rates and terms.'],
          ['Chase on its own', 'Reminders at 7, 14 and 30 days, in your own words.'],
          ['Reconcile cleanly', 'Match payments to invoices without leaving the page.'],
        ].map(([title, body]) => (
          <div className="card" key={title} {...ins('card')}>
            <h3 style={{ fontSize: 'var(--font-h5-size, 20px)', marginBottom: 'var(--space-xs, 8px)' }}>{title}</h3>
            <p className="small muted">{body}</p>
          </div>
        ))}
      </div>

      <div className="card card-overlay" {...ins('card-overlay')} style={{ textAlign: 'center', padding: 'var(--space-xl, 32px)', cursor: onInspect ? 'pointer' : undefined }}>
        <h2 style={{ marginBottom: 'var(--space-sm, 8px)' }}>Ready when you are</h2>
        <p className="muted" style={{ marginBottom: 'var(--space-md, 16px)' }}>Free for your first ten invoices a month.</p>
        <button className="btn btn-primary btn-lg" {...ins('button-lg')}>Create an account</button>
      </div>
    </div>
  )
}
