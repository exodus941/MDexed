/* A marketing page. Display type at full size, generous rhythm, and the
   accent doing persuasive work rather than utility work — the conditions
   under which a system built for dashboards usually falls apart. */
import { inspectProps, text } from '../inspect.js'
import { Ico, IconArrow, IconPlus, IconCheck, IconStar } from '../icons.jsx'

export default function Landing({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  /* Text has two owners — the text style and the colour role — so it offers
     both rather than picking one. */
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  return (
    <div style={{ maxWidth: 'var(--measure, 68ch)', margin: '0 auto' }} className="stack">
      <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <div className="avatar" {...ins('avatar')}>N</div>
          <strong {...txt('body-md', 'text')} style={{ fontSize: 'var(--font-body-md-size, 16px)', cursor: onInspect ? 'pointer' : undefined }}>Northwind</strong>
        </div>
        {/* A marketing header folds like every other one. Loose links beside a
            button is the desktop bar with nothing done to it, and at this width
            they read as stray text rather than navigation.

            Links, not spans. These are the most-copied lines in the payload,
            and a span cannot be tabbed to or announced as navigation. */}
        <div className="aside-rail header-nav">
          <details className="nav-collapse">
            <summary className="nav-summary" {...inspectProps("nav-item", onInspect, { passthrough: true })}>
              <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}
                {...txt('overline', 'text-muted')}>Menu</span>
              <span className="nav-burger" aria-hidden="true"><span /><span /><span /></span>
            </summary>
          </details>
          <nav className="row nav-list" aria-label="Main">
            <a className="nav-item" href="#pricing" {...ins('nav-item')}>Pricing</a>
            <a className="nav-item" href="#docs" {...ins('nav-item')}>Docs</a>
            <button className="btn btn-primary btn-sm" {...ins('button-sm')}><Ico d={IconPlus} size="sm" />Start free</button>
          </nav>
        </div>
      </div>

      <hr className="divider" />

      <div className="stack" style={{ padding: 'var(--space-xl, 32px) 0' }}>
        <span className="badge badge-accent" {...ins('badge-accent')} style={{ alignSelf: 'flex-start', cursor: onInspect ? 'pointer' : undefined }}>New — recurring invoices</span>
        <h1 style={{ maxWidth: '14ch' }} {...txt('h1', 'text')}>Invoicing that stays out of the way</h1>
        <p {...txt('body-lg', 'text-muted')} style={{ fontSize: 'var(--font-body-lg-size, 18px)', color: 'var(--c-text-muted, #666)', maxWidth: '46ch', cursor: onInspect ? 'pointer' : undefined }}>
          Send an invoice in twenty seconds. Chase it automatically. Reconcile it without opening a spreadsheet.
        </p>
        {/* Two large calls to action. On a narrow screen they stack and go
            full width, primary first — a hero CTA is the one thing the page
            is asking for, and shrinking it to share a line with its own
            alternative is the opposite of that. */}
        <div className="row stack-narrow" style={{ marginTop: 'var(--space-sm, 8px)' }}>
          <button className="btn btn-primary btn-lg" {...ins('button-lg')}>Start free<Ico d={IconArrow} size="lg" end /></button>
          <button className="btn btn-secondary btn-lg" {...ins('button-secondary')}><Ico d={IconStar} size="lg" />Book a demo</button>
        </div>
        <p className="caption" {...txt('caption', 'text-muted')}>No card required · Cancel any time</p>
      </div>

      <div className="cols-3">
        {[
          ['Send in seconds', 'Templates remember your line items, tax rates and terms.'],
          ['Chase on its own', 'Reminders at 7, 14 and 30 days, in your own words.'],
          ['Reconcile cleanly', 'Match payments to invoices without leaving the page.'],
        ].map(([title, body]) => (
          <div className="card" key={title} {...ins('card')}>
            <h3 {...txt('h5', 'text')} style={{ fontSize: 'var(--font-h5-size, 20px)', marginBottom: 'var(--space-xs, 8px)', cursor: onInspect ? 'pointer' : undefined }}>{title}</h3>
            <p className="small muted" {...txt('body-sm', 'text-muted')}>{body}</p>
          </div>
        ))}
      </div>

      <div className="card card-overlay" {...ins('card-overlay')} style={{ textAlign: 'center', padding: 'var(--space-xl, 32px)', cursor: onInspect ? 'pointer' : undefined }}>
        <h2 {...txt('h2', 'text')} style={{ marginBottom: 'var(--space-sm, 8px)', cursor: onInspect ? 'pointer' : undefined }}>Ready when you are</h2>
        <p className="muted" {...txt('body-md', 'text-muted')} style={{ marginBottom: 'var(--space-md, 16px)', cursor: onInspect ? 'pointer' : undefined }}>Free for your first ten invoices a month.</p>
        <button className="btn btn-primary btn-lg" {...ins('button-lg')}><Ico d={IconCheck} size="lg" />Create an account</button>
      </div>
    </div>
  )
}
