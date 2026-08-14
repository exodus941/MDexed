/* A record page: one thing, examined.
 *
 * The shape no other sample has. A dashboard summarises many things, a form
 * collects one, a settings list configures. A record page SHOWS one — a long
 * title, a row of facts about it, tabs across its sections, and a body split
 * between the content and a column of context.
 *
 * It exists because three rules had nowhere to be seen:
 *
 *   1. A long page title. Every collapse threshold in the header was measured
 *      from "Overview" at 163px, and no surface carried anything longer — so
 *      the wrap, and the controls holding its first line, were rules with no
 *      instance. "Ashford & Kline — Q4 reconciliation" is 2.5 times as wide.
 *   2. A tab strip on a content page rather than in chrome. The Shell shows one
 *      in a tool bar; a reader building a record page needs to see it over a
 *      body, with a rule under it and content beneath.
 *   3. A definition list. Label above value, several across a row, which is how
 *      every record page on earth states its facts and which nothing here did.
 *
 * Built from the shared classes. No value below is invented.
 */
import { inspectProps, text } from '../inspect.js'
import { Ico, IconDownload, IconSend, IconMore, IconCheck, IconAlert } from '../icons.jsx'
import { stripStyle } from '../../state/components.js'
import { labeller } from '../casing.js'

/* Label over value, and the pair is one object.
 *
 * The label takes the overline role and the value the body role, so the two
 * differ by size AND by colour rather than by size alone. A fact whose label
 * looks like its value makes the reader parse the grid twice. */
function Fact({ ins, txt, L, label, value, tone }) {
  return (
    <div className="fact" style={{ flex: '1 1 max-content', minWidth: 'max-content' }}>
      <div className="caption muted" {...txt('overline', 'text-muted')}
        style={{ textTransform: 'uppercase', letterSpacing: 'var(--font-overline-tracking)' }}>{L(label)}</div>
      <div {...txt('body-md', tone ?? 'text')}
        style={{ fontWeight: 500, color: tone ? `var(--c-${tone})` : undefined }}>{value}</div>
    </div>
  )
}

export default function Record({ onInspect, tabStyle, casing }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  /* `L` recases a UI LABEL. The record's own name below is content, not a
     label, so it never passes through here — "Ashford & Kline — Q4
     reconciliation" is what the data says, and the interface does not get to
     restyle it. */
  const L = labeller(casing)
  const pill = stripStyle(tabStyle) === 'pill'
  const tabs = ['Overview', 'Invoices', 'Activity', 'Documents']
  const selected = 'Overview'

  return (
    <div className="stack">
      {/* The header, on the same three parts every page header here uses: the
          title row, the description, and the actions. The title is long ON
          PURPOSE — it is the only one in the samples that is, and the rules
          about wrapping and first-line alignment have no instance without it. */}
      <div className="page-header">
        <div className="row row-wrap page-head">
          <div className="page-title">
            <h2 {...txt('h2')}>Ashford &amp; Kline — Q4 reconciliation</h2>
          </div>
          <div className="row page-actions">
            <button className="btn btn-secondary btn-sm" {...ins('button-sm')}><Ico d={IconDownload} size="sm" />{L('Export')}</button>
            <button className="btn btn-primary btn-sm" {...ins('button-primary')}><Ico d={IconSend} size="sm" />{L('Send')}</button>
            <button className="btn btn-secondary btn-sm icon-only" {...ins('button-secondary')}><Ico d={IconMore} /></button>
          </div>
          <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>Opened 12 days ago by A. Halloran</p>
        </div>
      </div>

      {/* The facts about the record, as a row of label-over-value pairs.
          `max-content` on each, so a pair never shrinks under its own label —
          the fault three stat tiles shipped with, 73px of word in a 34px box. */}
      <div className="card row row-wrap" {...ins('card')} style={{ gap: 'var(--space-lg)' }}>
        <Fact ins={ins} txt={txt} L={L} label="Account" value="Ashford &amp; Kline" />
        <Fact ins={ins} txt={txt} L={L} label="Balance" value="$21,050" />
        <Fact ins={ins} txt={txt} L={L} label="Terms" value="Net 30" />
        <Fact ins={ins} txt={txt} L={L} label="Status" value="Open" tone="warning" />
      </div>

      {/* A tab strip over a body, which is where most readers meet one. The
          Shell shows a strip in chrome; this shows the same component doing the
          job it does on a content page. */}
      <nav className="row tab-strip" aria-label="Record sections" style={{
        gap: 'var(--space-2xs)',
        padding: pill ? 'var(--space-2xs) 0' : 0,
        borderBottom: pill ? 0 : '1px solid var(--c-border-subtle)',
      }}>
        {tabs.map(t => {
          const on = t === selected
          return (
            <span key={t} className="nav-item" {...ins(on ? 'tab-selected' : 'tab')} style={{
              fontWeight: on ? 500 : 400,
              ...(pill
                ? { color: on ? 'var(--c-accent)' : 'var(--c-text-muted)',
                    background: on ? 'var(--c-accent-subtle)' : 'transparent' }
                : { background: 'transparent',
                    color: on ? 'var(--c-text)' : 'var(--c-text-muted)',
                    borderRadius: 0,
                    boxShadow: on ? 'inset 0 -2px 0 var(--c-accent)' : 'none' }),
            }}>{L(t)}</span>
          )
        })}
      </nav>
      <div className="tab-select" data-label="Record sections">
        <select className="input" aria-label="Record sections" defaultValue={selected} {...ins('tab-selected')}>
          {tabs.map(t => <option key={t} value={t}>{L(t)}</option>)}
        </select>
      </div>

      {/* Content beside context. The aside carries what you consult rather than
          what you read, which is the distinction that earns a second column at
          all. It stacks under the content at a narrow width like every other
          two-column block here. */}
      {/* `with-context`, not `with-aside`.
       *
       * They look like the same two-column shape and they are not.
       * `with-aside` means "content beside the NAVIGATION rail", and it earned
       * named grid areas when the folded menu had to sit between the header and
       * the body. Two plain columns dropped into it land in the same area and
       * paint on top of each other — which is exactly what happened here first.
       *
       * This pair is content beside CONTEXT: what you read, and what you
       * consult. Same collapse, different meaning, its own class. */}
      <div className="with-context" style={{ '--context': '200px' }}>
        <div className="stack">
          <div className="card stack-sm" {...ins('card')}>
            <strong {...txt('h6')} style={{ fontSize: 'var(--font-h6-size)' }}>{L('Reconciliation notes')}</strong>
            <p className="muted small" {...txt('body-sm', 'text-muted')}>
              Three invoices from October remain unmatched against the bank feed. Two are
              duplicates raised during the migration and can be voided. The third needs a
              credit note before the quarter closes.
            </p>
          </div>

          {/* A short list of events, each a row with a mark, a line and a time.
              Three type sizes on one baseline, which is the rule this project
              states most often and demonstrates least. */}
          <div className="card stack-sm" {...ins('card')}>
            <strong {...txt('h6')} style={{ fontSize: 'var(--font-h6-size)' }}>{L('Activity')}</strong>
            {[
              ['Matched 14 invoices', '2h ago', IconCheck, 'success'],
              ['Flagged duplicate INV-2287', '5h ago', IconAlert, 'warning'],
              ['Statement imported', 'Yesterday', IconDownload, 'text-muted'],
            ].map(([what, when, icon, tone], i) => (
              <div key={what} className="row" style={{
                justifyContent: 'space-between',
                borderTop: i === 0 ? 0 : '1px solid var(--c-border-subtle)',
                /* `undefined`, not 0, on the first row. An inline style beats a
                   stylesheet whatever the selector, so a literal 0 here
                   silently cancelled the optical compensation the sheet gives a
                   card's first icon-led row — the rule matched, and computed
                   0px. Leaving the property unset lets the sheet decide. */
                paddingTop: i === 0 ? undefined : 'var(--space-xs)',
              }}>
                <span className="row" style={{ minWidth: 0 }}>
                  <Ico d={icon} size="sm" />
                  <span className="small" {...txt('body-sm')}>{what}</span>
                </span>
                <span className="caption muted" {...txt('caption', 'text-muted')}>{when}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          {/* `fact`, not `stack-sm`. This is a label over its value, the same
              object as the four in the row above — and it was sitting on the
              stack's 12px while they sit on 4, so one pattern read two ways on
              one surface. The card supplies the padding; the fact supplies the
              gap inside the pair. */}
          <div className="card fact" {...ins('card')}>
            <div className="caption muted" {...txt('overline', 'text-muted')}
              style={{ textTransform: 'uppercase', letterSpacing: 'var(--font-overline-tracking)' }}>{L('Owner')}</div>
            <div className="row">
              <div className="avatar" {...ins('avatar')}>AH</div>
              <span className="small" {...txt('body-sm')}>A. Halloran</span>
            </div>
          </div>
          <div className="well stack-sm">
            {/* The same pair, wrapped rather than the well itself, because a
                third child follows it. The label belongs to the sentence at 4px;
                the button belongs to neither and keeps the well's own step. */}
            <div className="fact">
              <div className="caption muted" {...txt('overline', 'text-muted')}
                style={{ textTransform: 'uppercase', letterSpacing: 'var(--font-overline-tracking)' }}>{L('Next step')}</div>
              <p className="small" {...txt('body-sm')}>Raise a credit note for INV-2291.</p>
            </div>
            <button className="btn btn-secondary btn-sm" {...ins('button-secondary')}>{L('Open invoice')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
