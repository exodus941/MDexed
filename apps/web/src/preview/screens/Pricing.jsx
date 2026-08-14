/* A comparison: three plans, read across.
 *
 * The shape that breaks every other rule in this system. Everywhere else, a run
 * of items that does not fit has too many items and should stack. A comparison
 * is the exception a reader has to be shown, because the whole point is reading
 * ACROSS — "does this plan have the thing the one beside it has" — and a column
 * scrolled out of view is a column nobody compared.
 *
 * So it earns three rules nothing else here demonstrates:
 *
 *   1. ONE grid. The plan cards and the feature rows are laid out by the same
 *      track list, so the card names are the column headers. The first build
 *      used `.cols-3` for the cards and a separate four-track grid for the
 *      rows: measured at 1280, the cell holding Solo's answer stood 180.1px
 *      from the Solo card. Nothing overflowed, so every sweep called it clean.
 *      A comparison whose columns do not line up is three lists in a trench
 *      coat.
 *   2. It keeps its columns while they fit and STACKS when they do not. Never a
 *      middle step, and never a sideways scroll. Squeezed to a 640px pane the
 *      columns came to 43.6px each, holding 56px of the word "Unlimited".
 *   3. A recommended option is marked by its EDGE and a chip, never by a fill.
 *      A filled column beside two unfilled ones reads as selected rather than
 *      as recommended, and nobody has chosen anything yet.
 */
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, IconCheck, IconArrow } from '../icons.jsx'

const PLANS = [
  { name: 'Solo', price: '$0', note: 'For one person, ten invoices a month.',
    cta: 'Start free', variant: 'btn-secondary' },
  { name: 'Team', price: '$24', note: 'Per seat, billed monthly.',
    cta: 'Choose Team', variant: 'btn-primary', pick: true },
  { name: 'Scale', price: '$96', note: 'Per seat, with audit.',
    cta: 'Talk to us', variant: 'btn-secondary' },
]

/* The rows are the comparison. Each is a claim that has to be answerable for
   every column, which is why they are stated as a matrix rather than as three
   separate lists — three lists let a plan quietly omit a row. */
const ROWS = [
  ['Invoices a month', '10', 'Unlimited', 'Unlimited'],
  ['Seats', '1', 'Up to 20', 'Unlimited'],
  ['Automatic chasing', false, true, true],
  ['Reconciliation', false, false, true],
  ['Audit trail', false, false, true],
]

export default function Pricing({ onInspect, casing }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  /* One answer, rendered the same way in both forms. A tick in the wide grid
     and a tick in the stack are the same claim, so they are the same markup —
     two renderings of one value drift the moment either is edited. */
  const answer = cell =>
    cell === true ? <Ico d={IconCheck} size="sm" />
      : cell === false ? <span className="caption subtle" {...txt('caption', 'text-subtle')} aria-label="not included">&mdash;</span>
        : <span className="caption" {...txt('caption', 'text-muted')}>{cell}</span>

  /* The plan card. It is the column header in the wide form and the section
     heading in the stacked one, which is why it is one component. */
  const Card = ({ p }) => (
    <div className={`card stack-sm${p.pick ? ' is-picked' : ''}`}
      {...ins(p.pick ? 'card-overlay' : 'card')}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong {...txt('h6')} style={{ fontSize: 'var(--font-h6-size)' }}>{p.name}</strong>
        {/* The chip carries the recommendation. A fill on the whole column
            would read as chosen; a mark says suggested. */}
        {p.pick && <span className="badge badge-accent" {...ins('badge-accent')}>{L('Popular')}</span>}
      </div>
      <div {...txt('h3')} style={{ fontSize: 'var(--font-h3-size)', fontWeight: 'var(--font-h3-weight)' }}>{p.price}</div>
      <p className="muted small" {...txt('body-sm', 'text-muted')}>{p.note}</p>
      {/* The call to action stands clear of the sentence describing the plan,
          the same distance every other card in the system uses. */}
      <div className="card-actions">
        <button className={`btn ${p.variant}`} {...ins(p.variant === 'btn-primary' ? 'button-primary' : 'button-secondary')}
          style={{ width: '100%', justifyContent: 'center' }}>
          {L(p.cta)}{p.variant === 'btn-primary' && <Ico d={IconArrow} end />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="stack">
      <div className="page-header">
        <div className="row row-wrap page-head">
          <div className="page-title"><h2 {...txt('h2')}>Plans</h2></div>
          <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>
            Every plan includes the invoice editor and unlimited clients.
          </p>
        </div>
      </div>

      {/* ── The offer. Three cards, the full width of the block. ──
       *
       * These were once laid out by the table's track list below, so that each
       * card sat over its own column. The alignment was real and the result
       * was worse than the fault: a label column's worth of width sat empty on
       * the left and the three cards huddled against the right edge of their
       * own block.
       *
       * The cards are the offer. They take the whole width. The table under
       * them is a separate object that describes them, and only its own rows
       * need to agree with each other. */}
      <div className="cols-3 plans">
        {PLANS.map(p => <Card key={p.name} p={p} />)}
      </div>

      {/* ── The comparison: one grid, four tracks, every row a subgrid. ──
             No `stack` class here. This element IS the grid that owns the
             tracks. */}
      <div className="plan-wide">
        {/* The corner cell is not empty. It names what the column below it
            holds, which is what turns five unlabelled rows into a table. An
            empty corner is also the case the system warns about — a box that
            takes a share of the width and paints nothing. */}
        <div className="plan-grid plan-row">
          <span className="caption muted" {...txt('overline', 'text-muted')}
            style={{ textTransform: 'uppercase', letterSpacing: 'var(--font-overline-tracking)' }}>{L('Feature')}</span>
          {PLANS.map(p => (
            <span key={p.name} className={`plan-cell${p.pick ? ' is-picked' : ''}`}>
              <span className="caption" {...txt('caption', 'text-muted')}
                style={{ fontWeight: p.pick ? 500 : 400, color: p.pick ? 'var(--c-accent)' : undefined }}>{p.name}</span>
            </span>
          ))}
        </div>

        {/* A separator goes above each row and never below, so the first row
            carries the rule under the header and the last ends clean. */}
        {/* No border on the ROW. A row-wide rule crosses the recommended
            column and cuts its edge into segments. The divider is drawn by the
            cells that are not in that column, so it stops against it. */}
        {ROWS.map(([label, ...cells]) => (
          <div key={label} className="plan-grid plan-row">
            <span className="small" {...txt('body-sm')} style={{ fontWeight: 500 }}>{L(label)}</span>
            {cells.map((cell, j) => (
              <span key={j} className={`plan-cell${PLANS[j].pick ? ' is-picked' : ''}`}>{answer(cell)}</span>
            ))}
          </div>
        ))}
      </div>

      {/* ── The stacked form: one section per plan, every feature repeated. ──
          The same swap the tab strip makes when it becomes a dropdown: replace
          the component, never shrink it. Each plan keeps its card and gains the
          answers that were its column, as label-and-value rows. */}
      <div className="plan-stack stack">
        {PLANS.map((p, col) => (
          <div key={p.name} className="stack-sm">
            <Card p={p} />
            <div className="card" {...ins('card')}>
              {ROWS.map(([label, ...cells], i) => (
                <div key={label} className="plan-fact" style={{
                  borderTop: i === 0 ? 0 : '1px solid var(--c-border-subtle)',
                }}>
                  <span className="small" {...txt('body-sm')}>{L(label)}</span>
                  {answer(cells[col])}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
