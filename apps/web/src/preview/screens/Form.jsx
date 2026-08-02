/* Forms are where a colour system usually fails first: placeholder against
   field, error against surface, focus ring against page. Kept on screen so
   those pairings can't quietly break. */
import { inspectProps, text } from '../inspect.js'
import { Ico, Check, Switch, IconCheck, IconX, IconTrash, IconChevron, IconCalendar } from '../icons.jsx'
export default function Form({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }} className="stack">
      <div>
        <h2 {...txt('h2', 'text')}>Account settings</h2>
        <p className="muted small" {...txt('body-sm', 'text-muted')} style={{ marginTop: 4, cursor: onInspect ? 'pointer' : undefined }}>
          These details appear on invoices and receipts.
        </p>
      </div>

      <div className="card stack" {...ins('card')}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field" {...ins('input')}>
            <label className="label" {...txt("caption", "text-muted")}>Legal name</label>
            <input className="input" defaultValue="Northwind Trading Co." />
          </div>
          <div className="field" {...ins('input')}>
            <label className="label" {...txt("caption", "text-muted")}>Trading name</label>
            <input className="input" placeholder="Optional" />
          </div>
        </div>

        <div className="field" {...ins('input-invalid')}>
          <label className="label" {...txt("caption", "text-muted")}>Billing email</label>
          <input className="input is-invalid" defaultValue="accounts@northwind" />
          <span className="caption" style={{ color: "var(--c-danger, #c2453c)" }} {...txt("caption", "danger")}>Enter a complete email address.</span>
        </div>

        <div className="field" {...ins('textarea')}>
          <label className="label" {...txt("caption", "text-muted")}>Registered address</label>
          <textarea className="input" rows={3} defaultValue={'44 Wharf Road\nBristol BS1 4TR'} />
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field" {...ins('input-disabled')}>
            <label className="label" {...txt("caption", "text-muted")}>VAT number</label>
            <input className="input" disabled defaultValue="GB 429 8841 22" />
            <span className="caption" {...txt("caption", "text-muted")}>Verified — contact support to change this.</span>
          </div>
          <div className="field" {...ins('select')}>
            <label className="label" {...txt("caption", "text-muted")}>Payment terms</label>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between', height: 'var(--cmp-select-height, 36px)' }}>
              <span>Net 30</span><Ico d={IconChevron} />
            </button>
          </div>
        </div>

        <div className="field" {...ins('input')}>
          <label className="label" {...txt("caption", "text-muted")}>Invoice date</label>
          <div className="input-icon">
            <Ico d={IconCalendar} />
            <input className="input" defaultValue="14 Mar 2026" />
          </div>
        </div>

        <div className="stack-sm">
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox-checked')}>
            <Check on /><span className="small" {...txt("body-sm")}>Send a copy to my accountant</span>
          </label>
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox')}>
            <Check /><span className="small" {...txt("body-sm")}>Attach a payment link</span>
          </label>
        </div>

        <hr className="divider" />

        <div className="well">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }} {...txt("body-md")}>Automatic reminders</div>
              <p className="muted small" style={{ marginTop: 2 }} {...txt("body-sm", "text-muted")}>Chase unpaid invoices after 7, 14 and 30 days.</p>
            </div>
            <span {...ins('switch-checked')}><Switch on /></span>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" {...ins('button-ghost')}><Ico d={IconX} />Cancel</button>
          <button className="btn btn-secondary" {...ins('button-secondary')}>Save draft</button>
          <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconCheck} />Save changes</button>
        </div>
      </div>

      <div className="card card-flat" {...ins('card-flat')} style={{ borderColor: 'var(--c-danger, #c2453c)', cursor: onInspect ? 'pointer' : undefined }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500 }} {...txt("body-md")}>Close this account</div>
            <p className="muted small" style={{ marginTop: 2 }} {...txt("body-sm", "text-muted")}>Permanently removes all invoices and history.</p>
          </div>
          <button className="btn btn-danger btn-sm" {...ins('button-danger')}><Ico d={IconTrash} size="sm" />Close account</button>
        </div>
      </div>
    </div>
  )
}
