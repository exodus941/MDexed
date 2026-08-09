/* A settings page: dense rows, a sidebar, switches and destructive actions.
   Exercises the tokens that only appear in long-lived application chrome —
   sunken wells, selected nav, disabled controls, danger affordances. */
import { inspectProps, text } from '../inspect.js'
import { Ico, Switch, IconUser, IconFolder, IconBell, IconLock, IconChart, IconCheck, IconTrash, IconAlert } from '../icons.jsx'

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
    <div className="with-aside" style={{ '--aside': '160px' }}>
      {/* Same fold as the dashboard rail. This one was left behind when that
          was fixed, so six links still stacked above the page title.

          The summary names the section you are in rather than the region,
          because on a phone this is the only thing telling you where you are.
          That is how every settings screen on a phone behaves. */}
      {/* Sibling, not child. See the note in Dashboard: a closed `details`
          renders none of its non-summary children, whatever CSS says, so a
          list nested inside one is invisible at every width until it is
          opened. One wrapper keeps `.with-aside` at two children. */}
      <div className="aside-rail">
        <details className="nav-collapse">
          <summary className="nav-summary" {...inspectProps("nav-item", onInspect, { passthrough: true })}>
            <span className="caption" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}
              {...txt('overline', 'text-muted')}>{sections[3]}</span>
            <span className="nav-burger" aria-hidden="true"><span /><span /><span /></span>
          </summary>
        </details>
        <div className="nav-fold">
        <nav className="stack-sm nav-list">
          {sections.map((s, i) => (
            <div key={s} className={`nav-item with-icon${i === 3 ? ' is-active' : ''}`}
              {...ins(i === 3 ? 'nav-item-selected' : 'nav-item')}>
              <Ico d={[IconUser, IconFolder, IconChart, IconBell, IconFolder, IconLock][i]} />{s}
            </div>
          ))}
        </nav>
        </div>
      </div>

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
          {/* The row and the line under it are ONE field, so they sit at the
              field's own spacing and not at the group's. Before this the help
              was a sibling of the row, a full group gap below it, which left
              it floating between the field above and the buttons below and
              belonging to neither. Proximity is what assigns a caption to a
              control, and nothing else does. */}
          <div className="field">
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }} {...ins('input')}>
                <label className="label" {...txt("caption", "text-muted")}>Send to</label>
                <input className="input" defaultValue="accounts@northwind.co" />
              </div>
              <button className="btn btn-secondary" {...ins('button-secondary')}>Verify</button>
            </div>
            <p className="caption field-note" {...txt("caption", "text-muted")}>Changing this signs out other sessions.</p>
          </div>

          {/* The same field in its failing state, so the error treatment is on
              screen beside the resting one rather than described in prose. The
              mark matters as much as the colour: red alone is unreadable to a
              red-green eye and disappears in greyscale. */}
          <div className="field">
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }} {...ins('input-error')}>
                <label className="label" {...txt("caption", "text-muted")}>Billing contact</label>
                <input className="input is-error" defaultValue="billing@northwind" aria-invalid="true" />
              </div>
              <button className="btn btn-secondary" {...ins('button-secondary')}>Verify</button>
            </div>
            <p className="caption field-note is-error" {...txt("caption", "danger")}>
              <Ico d={IconAlert} size="sm" />That address is missing a domain.
            </p>
          </div>
        </div>

        {/* Stacked and reversed at a narrow width, so it reads Save, Discard,
            Reset from the top. Wrapping alone left Reset alone on one line and
            the other two right-aligned on the next, which looks like two
            unrelated groups rather than one footer. */}
        <div className="row stack-narrow-rev" style={{ justifyContent: 'space-between' }}>
          {/* Destructive — it throws away everything on the page — but a
              secondary action sitting beside Save, so it takes the ghost
              treatment in the danger colour rather than a filled red. */}
          <button className="btn btn-danger-ghost" {...ins('button-danger-ghost')}><Ico d={IconTrash} />Reset to defaults</button>
          <div className="row">
            <button className="btn btn-secondary" disabled {...ins('button-primary-disabled')}>Discard</button>
            <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconCheck} />Save changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}
