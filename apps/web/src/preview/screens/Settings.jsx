/* A settings page: dense rows, a sidebar, switches and destructive actions.
   Exercises the tokens that only appear in long-lived application chrome —
   sunken wells, selected nav, disabled controls, danger affordances. */
import { inspectProps, text } from '../inspect.js'
import { Ico, Switch, IconUser, IconFolder, IconBell, IconLock, IconChart, IconCheck, IconTrash } from '../icons.jsx'

export default function Settings({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
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
          <div key={s} className={`nav-item with-icon${i === 3 ? ' is-active' : ''}`}
            {...ins(i === 3 ? 'nav-item-selected' : 'nav-item')}>
            <Ico d={[IconUser, IconFolder, IconChart, IconBell, IconFolder, IconLock][i]} />{s}
          </div>
        ))}
      </nav>

      <div className="stack">
        <div>
          <h2 {...txt("h2")}>Notifications</h2>
          <p className="muted small" style={{ marginTop: 4 }} {...txt("body-sm", "text-muted")}>Choose what reaches you, and where.</p>
        </div>

        <div className="card" style={{ padding: 0, cursor: onInspect ? 'pointer' : undefined }} {...ins('card')}>
          {rows.map(([title, desc, on], i) => (
            <div key={title} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-md, 16px)',
              padding: 'var(--space-md, 16px)',
              borderTop: i === 0 ? 'none' : '1px solid var(--c-border-subtle, #eee)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }} {...txt("body-md")}>{title}</div>
                <p className="muted small" style={{ marginTop: 2 }} {...txt("body-sm", "text-muted")}>{desc}</p>
              </div>
              <span {...ins(on ? 'switch-checked' : 'switch')}><Switch on={on} /></span>
            </div>
          ))}
        </div>

        <div className="well stack-sm">
          <div style={{ fontWeight: 500 }} {...txt("body-md")}>Notification email</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }} {...ins('input')}>
              <label className="label" {...txt("caption", "text-muted")}>Send to</label>
              <input className="input" defaultValue="accounts@northwind.co" />
            </div>
            <button className="btn btn-secondary" {...ins('button-secondary')}>Verify</button>
          </div>
          <p className="caption" {...txt("caption", "text-muted")}>Changing this signs out other sessions.</p>
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" {...ins('button-ghost')}><Ico d={IconTrash} />Reset to defaults</button>
          <div className="row">
            <button className="btn btn-secondary" disabled {...ins('button-primary-disabled')}>Discard</button>
            <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconCheck} />Save changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}
