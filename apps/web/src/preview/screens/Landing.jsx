/* A marketing page. Display type at full size, generous rhythm, and the
   accent doing persuasive work rather than utility work — the conditions
   under which a system built for dashboards usually falls apart. */
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, ThemeToggle, IconArrow, IconPlus, IconCheck, IconStar } from '../icons.jsx'

export default function Landing({ onInspect, casing, theme, mode, onToggleTheme }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  /* Text has two owners — the text style and the colour role — so it offers
     both rather than picking one. */
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  return (
    <div style={{ maxWidth: 'var(--measure, 68ch)', margin: '0 auto' }} className="stack">
      {/* `bar-row`, not `row-wrap`. A brand and the mark that opens the menu are
          one bar, and this row wrapped at 320px — the burger dropped to a line
          of its own at the LEFT, 275px from where a hand expects it. A bar does
          not wrap. The brand shrinks instead. */}
      <div className="row bar-row" style={{ justifyContent: 'space-between' }}>
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
          {/* THE TOGGLE AND THE BURGER ARE ONE CONTROL ROW, SO THEY ARE
              SIBLINGS IN ONE.
           *
           * Three earlier shapes were each wrong in a way that measured:
           *
           *   a third child of the bar   `space-between` hands every gap to the
           *                              browser, so the slack lands between the
           *                              toggle and the menu as well
           *   its own row beside the     `.header-nav` is a flex COLUMN and it
           *   column                     is taller than the burger, so the row
           *                              centred the toggle on the column and
           *                              left it 7px above the burger at 640px
           *   any bare wrapper           the touch promotion matches a LIST of
           *                              containers, so a name it does not hold
           *                              left a 28px button beside a 44px one
           *
           * `.page-actions` is the primitive for exactly this: the controls at
           * the end of a header row. It already promotes both to 44px on a
           * phone, and its `margin-left: auto` is scoped to `.page-head > `, so
           * it does not reach this bar. The toggle is first, because the
           * rightmost seat belongs to navigation.
           *
           * `.row-controls` for the alignment, because a bare `.row` is
           * baseline. Two buttons in a `.page-actions` share a line-height and
           * agree by accident; a button beside a `details` does not, and the
           * two sat 9px apart at 296px at identical heights. This row holds two
           * fixed-height controls and no prose, so it centres. */}
          <div className="row row-controls page-actions">
            <ThemeToggle theme={theme} mode={mode} onToggle={onToggleTheme} inspect={ins('button-secondary')} />
            <details className="nav-collapse">
              {/* The burger alone. Its label goes inside the menu, with the
                  links it names. See the same change on Dashboard and
                  Settings. */}
              {/* A button, like every other control in this header, and last in
                  the row. See the note on Dashboard. */}
              <summary className="nav-summary btn btn-secondary btn-sm" aria-label="Menu"
                {...inspectProps(['nav-burger', 'nav-item'], onInspect, { passthrough: true })}>
                <span className="nav-burger" aria-hidden="true"><span /><span /><span /></span>
                <span className="nav-label">Menu</span>
              </summary>
            </details>
          </div>
          <div className="nav-fold">
          <nav className="row nav-list" aria-label="Main">
            <span className="caption nav-title" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}
              {...txt('overline', 'text-muted')}>Menu</span>
            <a className="nav-item" href="#pricing" {...ins('nav-item')}>Pricing</a>
            <a className="nav-item" href="#docs" {...ins('nav-item')}>Docs</a>
            <button className="btn btn-primary btn-sm" {...ins('button-sm')}><Ico d={IconPlus} size="sm" />{L('Start free')}</button>
          </nav>
          </div>
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
          <button className="btn btn-primary btn-lg" {...ins('button-lg')}>{L('Start free')}<Ico d={IconArrow} size="lg" end /></button>
          <button className="btn btn-secondary btn-lg" {...ins('button-secondary')}><Ico d={IconStar} size="lg" />{L('Book a demo')}</button>
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
        <p className="muted" {...txt('body-md', 'text-muted')} style={{ marginBottom: 0, cursor: onInspect ? 'pointer' : undefined }}>Free for your first ten invoices a month.</p>
        {/* The action stands clear of the sentence that explains it. At 16px it
            read as the last line of the paragraph rather than as the thing to
            press. `.card-actions` states that distance for every card. */}
        <div className="card-actions">
          <button className="btn btn-primary btn-lg" {...ins('button-lg')}><Ico d={IconCheck} size="lg" />{L('Create an account')}</button>
        </div>
      </div>
    </div>
  )
}
