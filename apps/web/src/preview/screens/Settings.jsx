/* A settings page: dense rows, a sidebar, switches and destructive actions.
   Exercises the tokens that only appear in long-lived application chrome —
   sunken wells, selected nav, disabled controls, danger affordances. */
import { inspectProps } from '../Gallery.jsx'

export default function Settings({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  const sections = ['Profile', 'Team', 'Billing', 'Notifications', 'Integrations', 'Security']
  const rows = [
    ['Two-factor authentication', 'Required for everyone on the team', true],
    ['Session timeout', 'Sign out after 30 minutes of inactivity', true],
    ['Weekly digest', 'A Monday summary of outstanding invoices', false],
    ['Product updates', 'Occasional notes about new features', false],
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 'var(--space-xl, 32px)', alignItems: 'start' }}>
      <nav className="stack-sm">
        {sections.map((s, i) => (
          <div key={s} className={`nav-item${i === 3 ? ' is-active' : ''}`}
            {...ins(i === 3 ? 'nav-item-selected' : 'nav-item')}>{s}</div>
        ))}
      </nav>

      <div className="stack">
        <div>
          <h2>Notifications</h2>
          <p className="muted small" style={{ marginTop: 4 }}>Choose what reaches you, and where.</p>
        </div>

        <div className="card" style={{ padding: 0, cursor: onInspect ? 'pointer' : undefined }} {...ins('card')}>
          {rows.map(([title, desc, on], i) => (
            <div key={title} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-md, 16px)',
              padding: 'var(--space-md, 16px)',
              borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle, #eee)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{title}</div>
                <p className="muted small" style={{ marginTop: 2 }}>{desc}</p>
              </div>
              <span className={`badge ${on ? 'badge-success' : 'badge-neutral'}`}
                {...ins(on ? 'badge-success' : 'badge-neutral')}>{on ? 'On' : 'Off'}</span>
            </div>
          ))}
        </div>

        <div className="well stack-sm">
          <div style={{ fontWeight: 500 }}>Notification email</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }} {...ins('input')}>
              <label className="label">Send to</label>
              <input className="input" defaultValue="accounts@northwind.co" />
            </div>
            <button className="btn btn-secondary" {...ins('button-secondary')}>Verify</button>
          </div>
          <p className="caption">Changing this signs out other sessions.</p>
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" {...ins('button-ghost')}>Reset to defaults</button>
          <div className="row">
            <button className="btn btn-secondary" disabled {...ins('button-primary-disabled')}>Discard</button>
            <button className="btn btn-primary" {...ins('button-primary')}>Save changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}
