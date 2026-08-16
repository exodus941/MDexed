/* A realistic composed screen. The point isn't the content — it's seeing
   whether surfaces, borders, text hierarchy and accent usage hold together
   once they're stacked, which a swatch grid can never tell you.

   Every run of text is inspectable, not just the components. A click on a
   heading offers its text style and its colour; the card it sits in stays
   reachable underneath, because `inspectProps` collects ancestors too. */
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, ThemeToggle, IconPlus, IconDownload, IconChart, IconFolder, IconBell, IconAlert, IconMore, IconSend } from '../icons.jsx'

export default function Dashboard({ onInspect, layout, casing, theme, mode, onToggleTheme }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  const al = layout?.alert ?? {}
  const tb = layout?.table ?? {}
  const rows = [
    ['Northwind Trading', 'Active',   '$12,480', 'AH'],
    ['Meridian Labs',     'Trialing', '$3,200',  'ML'],
    ['Halcyon Group',     'Overdue',  '$8,915',  'HG'],
    ['Ashford & Kline',   'Active',   '$21,050', 'AK'],
  ]
  const badgeFor = s => s === 'Active' ? 'badge-success' : s === 'Overdue' ? 'badge-danger' : 'badge-warning'

  return (
    <div className="with-aside">
      {/* A sidebar does not become a stack of links above the page title.
          Every navigation on every phone folds behind a control, and pushing
          the title below five list items is not a small screen layout, it is
          a wide one that gave up.

          `details` and `summary` rather than a button and state, because the
          exported examples are static HTML with no script. A React toggle
          would work here and be dead in the payload, which is the half of
          this that an agent actually reads. Open on a wide screen and folded
          on a narrow one is CSS, in responsive.js. */}
      {/* The list is a *sibling* of the details, not a child.
          It was a child, with CSS forcing it visible at wide widths. That
          cannot work: a closed `details` does not render its non-summary
          children at all, and no `display` on the child overrides it. The list
          had layout — 180 by 239, five items — inside a details box 28px tall,
          and painted nothing. The desktop sidebar was empty.

          As a sibling it is an ordinary element the whole time. At a narrow
          width `details:not([open]) ~ nav` hides it, which is plain CSS and
          needs no script, so the exported page behaves the same. */}
      {/* One grid cell holding both, or `.with-aside` sees three children. */}
      <div className="aside-rail">
        <div className="nav-fold">
        <nav className="stack-sm nav-list">
          <span className="caption nav-title" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}
            {...txt('overline', 'text-muted')}>{L('Workspace')}</span>
          <div className="nav-item is-active with-icon" {...ins('nav-item-selected')}><Ico d={IconChart} />{L('Overview')}</div>
          {[['Accounts', IconFolder], ['Invoices', IconSend], ['Reports', IconChart], ['Settings', IconMore]].map(([t, icon]) => (
            <div key={t} className="nav-item with-icon" {...ins('nav-item')}><Ico d={icon} />{L(t)}</div>
          ))}
        </nav>
        </div>
      </div>

      {/* The page header is a SIBLING of the rail, not a child of the content
          column. Only then can the grid put the menu between the title row and
          the body at a narrow width — a menu that opens under the bar that
          owns it. `grid-template-areas` names the three parts, so the wide
          layout reads "rail beside head, rail beside body" and the narrow one
          reads "head, rail, body". */}
      <>
        {/* The heading and its actions share a row. The description sits under
            that row, not inside it.
         *
         * This has now been wrong twice in two different ways. `flex-start`
         * pinned the buttons to the top of the band, floating above a title
         * whose letters sat well below them. Baseline then dropped them onto
         * the title's baseline, which hangs most of a 28px box below a 32px
         * heading — and this project's own DESIGN.md says that plainly: a
         * heading much larger than the control beside it centres instead,
         * because at that size difference a shared baseline reads as a mistake.
         *
         * With the description moved out, the row holds one line of heading
         * and one group of controls, and `center` means what it should. */}
        {/* Named, because the narrow layout has to reorder this block. The
            actions move below the heading AND its description, which means the
            three of them must be siblings in one column. `page-head` becomes
            `display: contents` at that width and hands its children up. */}
        <div className="page-header">
          <div className="row row-wrap page-head">
            <div className="page-title">
              <h2 {...txt('h2')}>Overview</h2>
            </div>
            {/* Small is a desktop choice. These are the page's own actions, and
                at 375px a 28px target beside a 28px icon button is neither
                comfortable to hit nor the right weight for the top of a screen.
                They take the medium size from the same scale — a different step
                of the system, not a number invented outside it. */}
            <div className="row page-actions">
              <button className="btn btn-secondary btn-sm" {...ins('button-sm')}><Ico d={IconDownload} size="sm" />{L('Export')}</button>
              <button className="btn btn-primary btn-sm" {...ins('button-primary')}><Ico d={IconPlus} size="sm" />{L('New invoice')}</button>
              <button className="btn btn-secondary btn-sm icon-only" {...ins('button-secondary')}><Ico d={IconBell} /></button>
              {/* Inside the action group, and before the menu control, because
                  the rightmost seat belongs to navigation. It appears only when
                  the document ships both palettes. */}
              <ThemeToggle theme={theme} mode={mode} onToggle={onToggleTheme} inspect={ins('button-secondary')} />
            </div>
            {/* The menu control is a BUTTON, and it belongs to the action group.
             *
             * It sat beside the heading before, and that was wrong: a control
             * parked against a title reads as part of the title rather than as
             * something you press. It takes the same `.btn` shell as Export and
             * New invoice, and it is the LAST of them, because navigation
             * outranks every action on the page — the rightmost seat is the one
             * a hand reaches first and the one nothing else may take.
             *
             * A sibling of `.page-actions` rather than a child of it, because
             * the ladder keeps this control on the title's row after the other
             * buttons have dropped to a line of their own. Inside the group it
             * could only ever go where the group went. `order` places it. */}
            <details className="nav-collapse">
              <summary className="nav-summary btn btn-secondary btn-sm" aria-label="Workspace menu"
                {...inspectProps(['nav-burger', 'nav-item'], onInspect, { passthrough: true })}>
                <span className="nav-burger" aria-hidden="true"><span /><span /><span /></span>
                <span className="nav-label">{L('Workspace')}</span>
              </summary>
            </details>
            {/* The description lives IN the row, at full width.
             *
             * It was a sibling of the row, and the row used `display: contents`
             * at narrow widths so the actions could land under it. That works
             * and it dissolves the row — which is fine until something has to
             * STAY on the title's line. The menu button does, so the row has to
             * survive. Everything is one wrapping row now, and `order` with a
             * 100% basis says which items own a line of their own. */}
            <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>Fourth quarter, all accounts</p>
          </div>
        </div>

      <div className="stack">
        {/* Alerts belong on the screen that would actually raise one. */}
        <div className="alert alert-warning" {...ins('alert-warning')}>
          {al.icon !== 'none' && <Ico d={IconAlert} />}
          <span className="alert-body" {...txt('body-sm', 'warning')}>
            {al.title === 'bold' && <strong style={{ display: 'block' }}>{L('Payment overdue')}</strong>}
            Two invoices are more than 30 days overdue.
            {al.action === 'below' && (
              <span style={{ display: 'block', marginTop: 'var(--space-xs, 8px)' }}>
                <button className="btn btn-ghost btn-sm" {...ins('button-ghost')}>Review</button>
              </span>
            )}
          </span>
          {al.action === 'inline' && (
            <span className="alert-action">
              <button className="btn btn-ghost btn-sm" {...ins('button-ghost')}>Review</button>
            </span>
          )}
        </div>

        {/* `.stat`, not three inline margins. The label, the number and the
            change each carried a typed distance here, and the change ended up
            6px from the number it describes against the label's 4 — so it read
            as a third separate line rather than as part of the number. The
            class states both distances once, for every tile that uses it. */}
        <div className="cols-3">
          {[['Revenue', '$45,645', '+12.4%'], ['Open invoices', '18', '-3'], ['Avg. days to pay', '21', '+2']].map(([label, value, delta]) => (
            <div className="card stat" key={label} {...ins('card')}>
              <div className="caption" {...txt('caption', 'text-muted')}>{L(label)}</div>
              <div className="stat-value" style={{ fontSize: 'var(--font-h3-size, 24px)', fontWeight: 'var(--font-h3-weight, 600)' }}
                {...txt('h3')}>{value}</div>
              <div className="caption stat-delta" {...txt('caption', 'text-muted')}>{delta} from Q3</div>
            </div>
          ))}
        </div>

        <div className="card" {...ins('card')}>
          <div className="row row-wrap" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-md, 16px)' }}>
            <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)' }} {...txt('h6')}>Accounts</h3>
            <span className="badge badge-neutral" {...ins('badge-neutral')}>4 shown</span>
          </div>
          {/* Numeric alignment, header treatment and row separation all come
              from the table's composition settings. */}
          {/* A table has a floor: three columns of real content will not fold
              into 296px, and squeezing them turns every account name into two
              or three lines. So it scrolls sideways inside its card instead,
              which is the answer every table on a phone reaches for. The
              wrapper is markup rather than CSS because `overflow` needs a box
              of its own — a `table` cannot scroll itself. */}
          <div className="table-scroll">
          <table className={`table table-rows-${tb.rows ?? 'lines'} table-head-${tb.header ?? 'overline'}`} {...ins('table')}>
            <thead><tr {...ins('table-header')}>
              <th>{L('Account')}</th><th>{L('Status')}</th><th className={tb.numeric === 'left' ? '' : 'num-col'}>{L('Balance')}</th>
            </tr></thead>
            <tbody>
              {rows.map(([name, status, amount, initials]) => (
                <tr key={name}>
                  <td>
                    <div className="row">
                      <span className="avatar" {...ins('avatar')}>{initials}</span>
                      <span {...txt('body-sm')}>{name}</span>
                    </div>
                  </td>
                  <td><span className={`badge ${badgeFor(status)}`} {...ins(`badge-${badgeFor(status).replace('badge-', '')}`)}>{L(status)}</span></td>
                  <td className={tb.numeric === 'left' ? '' : 'num-col'}><span {...txt('body-sm')}>{amount}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="cols-2">
          <div className="card" {...ins('card')}>
            <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)', marginBottom: 'var(--space-sm, 8px)' }} {...txt('h6')}>{L('Collection rate')}</h3>
            {/* No progress component in the library, so this stays part of the card. */}
            <div className="bar"><span style={{ width: '72%' }} /></div>
            <p className="caption" style={{ marginTop: 8 }} {...txt('caption', 'text-muted')}>72% of Q4 invoices settled</p>
          </div>
          <div className="card card-overlay" {...ins('card-overlay')}>
            <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)', marginBottom: 4 }} {...txt('h6')}>{L('Renewal due')}</h3>
            <p className="muted small" {...txt('body-sm', 'text-muted')}>Halcyon Group renews in 6 days and has an overdue balance.</p>
            {/* `.card-actions` rather than a typed 16px. The action stands one
                step clear of the sentence explaining it, and that step is
                stated once for every card in the system. */}
            <div className="row card-actions">
              <button className="btn btn-primary btn-sm" {...ins('button-primary')}>{L('Send reminder')}</button>
              {/* Destructive, but not what the card is for — dismissing an
                  overdue renewal loses the reminder, so it should read as
                  destructive without competing with the primary action. That
                  is the whole case for danger-ghost, and putting it here means
                  the variant is visible and clickable rather than only
                  existing in the Components tab. */}
              <button className="btn btn-danger-ghost btn-sm" {...ins('button-danger-ghost')}>Dismiss</button>
            </div>
          </div>
        </div>
      </div>
      </>
    </div>
  )
}
