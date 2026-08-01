/* Forms are where a colour system usually fails first: placeholder against
   field, error against surface, focus ring against page. Kept on screen so
   those pairings can't quietly break. */
import { inspectProps } from '../inspect.js'
export default function Form({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }} className="stack">
      <div>
        <h2>Account settings</h2>
        <p className="muted small" style={{ marginTop: 4 }}>These details appear on invoices and receipts.</p>
      </div>

      <div className="card stack" {...ins('card')}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field" {...ins('input')}>
            <label className="label">Legal name</label>
            <input className="input" defaultValue="Northwind Trading Co." />
          </div>
          <div className="field" {...ins('input')}>
            <label className="label">Trading name</label>
            <input className="input" placeholder="Optional" />
          </div>
        </div>

        <div className="field" {...ins('input-invalid')}>
          <label className="label">Billing email</label>
          <input className="input is-invalid" defaultValue="accounts@northwind" />
          <span className="caption" style={{ color: 'var(--c-danger, #c2453c)' }}>Enter a complete email address.</span>
        </div>

        <div className="field" {...ins('textarea')}>
          <label className="label">Registered address</label>
          <textarea className="input" rows={3} defaultValue={'44 Wharf Road\nBristol BS1 4TR'} />
        </div>

        <div className="field" {...ins('input-disabled')}>
          <label className="label">VAT number</label>
          <input className="input" disabled defaultValue="GB 429 8841 22" />
          <span className="caption">Verified — contact support to change this.</span>
        </div>

        <hr className="divider" />

        <div className="well">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Automatic reminders</div>
              <p className="muted small" style={{ marginTop: 2 }}>Chase unpaid invoices after 7, 14 and 30 days.</p>
            </div>
            <span className="badge badge-success" {...ins('badge-success')}>On</span>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" {...ins('button-ghost')}>Cancel</button>
          <button className="btn btn-secondary" {...ins('button-secondary')}>Save draft</button>
          <button className="btn btn-primary" {...ins('button-primary')}>Save changes</button>
        </div>
      </div>

      <div className="card card-flat" {...ins('card-flat')} style={{ borderColor: 'var(--c-danger, #c2453c)', cursor: onInspect ? 'pointer' : undefined }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500 }}>Close this account</div>
            <p className="muted small" style={{ marginTop: 2 }}>Permanently removes all invoices and history.</p>
          </div>
          <button className="btn btn-danger btn-sm" {...ins('button-danger')}>Close account</button>
        </div>
      </div>
    </div>
  )
}
