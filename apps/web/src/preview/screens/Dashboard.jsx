/* A realistic composed screen. The point isn't the content — it's seeing
   whether surfaces, borders, text hierarchy and accent usage hold together
   once they're stacked, which a swatch grid can never tell you. */
import { inspectProps } from '../Gallery.jsx'
export default function Dashboard({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  const rows = [
    ['Northwind Trading', 'Active',   '$12,480', 'AH'],
    ['Meridian Labs',     'Trialing', '$3,200',  'ML'],
    ['Halcyon Group',     'Overdue',  '$8,915',  'HG'],
    ['Ashford & Kline',   'Active',   '$21,050', 'AK'],
  ]
  const badgeFor = s => s === 'Active' ? 'badge-success' : s === 'Overdue' ? 'badge-danger' : 'badge-warning'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 'var(--space-lg, 32px)', alignItems: 'start' }}>
      <nav className="stack-sm">
        <div className="caption" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Workspace</div>
        <div className="nav-item is-active" {...ins('nav-item-selected')}>Overview</div>
        {['Accounts', 'Invoices', 'Reports', 'Settings'].map(t => (
          <div key={t} className="nav-item" {...ins('nav-item')}>{t}</div>
        ))}
      </nav>

      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Overview</h2>
            <p className="muted small" style={{ marginTop: 4 }}>Fourth quarter, all accounts</p>
          </div>
          <div className="row">
            <button className="btn btn-secondary btn-sm" {...ins('button-sm')}>Export</button>
            <button className="btn btn-primary btn-sm" {...ins('button-primary')}>New invoice</button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[['Revenue', '$45,645', '+12.4%'], ['Open invoices', '18', '-3'], ['Avg. days to pay', '21', '+2']].map(([label, value, delta]) => (
            <div className="card" key={label} {...ins('card')}>
              <div className="caption">{label}</div>
              <div style={{ fontSize: 'var(--font-h3-size, 24px)', fontWeight: 'var(--font-h3-weight, 600)', marginTop: 4 }}>{value}</div>
              <div className="caption" style={{ marginTop: 6 }}>{delta} from Q3</div>
            </div>
          ))}
        </div>

        <div className="card" {...ins('card')}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-md, 16px)' }}>
            <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)' }}>Accounts</h3>
            <span className="badge badge-neutral" {...ins('badge-neutral')}>4 shown</span>
          </div>
          <table className="table" {...ins('table')}>
            <thead><tr {...ins('table-header')}><th>Account</th><th>Status</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
            <tbody>
              {rows.map(([name, status, amount, initials]) => (
                <tr key={name}>
                  <td>
                    <div className="row">
                      <span className="avatar" {...ins('avatar')}>{initials}</span>
                      <span>{name}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${badgeFor(status)}`} {...ins(`badge-${badgeFor(status).replace('badge-', '')}`)}>{status}</span></td>
                  <td style={{ textAlign: 'right' }}>{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card" {...ins('card')}>
            <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)', marginBottom: 'var(--space-sm, 8px)' }}>Collection rate</h3>
            <div className="bar"><span style={{ width: '72%' }} /></div>
            <p className="caption" style={{ marginTop: 8 }}>72% of Q4 invoices settled</p>
          </div>
          <div className="card card-overlay" {...ins('card-overlay')}>
            <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)', marginBottom: 4 }}>Renewal due</h3>
            <p className="muted small">Halcyon Group renews in 6 days and has an overdue balance.</p>
            <div className="row" style={{ marginTop: 'var(--space-md, 16px)' }}>
              <button className="btn btn-primary btn-sm" {...ins('button-primary')}>Send reminder</button>
              <button className="btn btn-ghost btn-sm" {...ins('button-ghost')}>Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
