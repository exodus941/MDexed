/* A comparison: three plans, read across.
 *
 * The shape that breaks every other rule in this system. Everywhere else, a run
 * of items that does not fit has too many items and should stack. A comparison
 * is the exception a reader has to be shown, because the whole point is reading
 * ACROSS — "does this plan have the thing the one beside it has" — and a
 * stacked comparison cannot answer that.
 *
 * So it earns two rules nothing else here demonstrates:
 *
 *   1. A comparison keeps its columns while they fit, and STACKS when they do
 *      not. It never scrolls sideways. A table of real data scrolls because
 *      columns cannot fold; three cards can, and a horizontal scrollbar in a
 *      pricing block is a layout that gave up.
 *   2. The rows line up across the columns. Cards of independent height drift
 *      by a few pixels and the eye cannot compare a row any more. A grid with
 *      the rows dissolved into it shares one track — which is exactly what the
 *      component matrix in the Gallery does, for the same reason.
 *
 * And one the system states and never shows: a highlighted option is marked by
 * a BORDER and a chip, never by a fill. A filled column beside two unfilled
 * ones reads as selected rather than as recommended, and nobody has chosen
 * anything yet.
 */
import { inspectProps, text } from '../inspect.js'
import { Ico, IconCheck, IconArrow } from '../icons.jsx'

const PLANS = [
  { name: 'Solo', price: '$0', note: 'For one person, ten invoices a month.',
    cta: 'Start free', variant: 'btn-secondary' },
  { name: 'Team', price: '$24', note: 'Per seat, billed monthly. Everything below.',
    cta: 'Choose Team', variant: 'btn-primary', pick: true },
  { name: 'Scale', price: '$96', note: 'Per seat, with reconciliation and audit.',
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

export default function Pricing({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  return (
    <div className="stack" style={{ maxWidth: 'var(--measure, 68ch)', margin: '0 auto' }}>
      <div className="page-header">
        <div className="row row-wrap page-head">
          <div className="page-title"><h2 {...txt('h2')}>Plans</h2></div>
          <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>
            Every plan includes the invoice editor and unlimited clients.
          </p>
        </div>
      </div>

      {/* Three columns while they fit, stacked when they do not. `cols-3` is the
          system's own three-column grid, and it halves then collapses on the
          document's own breakpoints — so this block needs no threshold of its
          own and cannot drift from the rest of the layout. */}
      <div className="cols-3 plans">
        {PLANS.map(p => (
          <div key={p.name}
            className={`card stack-sm${p.pick ? ' is-picked' : ''}`}
            {...ins(p.pick ? 'card-overlay' : 'card')}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong {...txt('h6')} style={{ fontSize: 'var(--font-h6-size)' }}>{p.name}</strong>
              {/* The chip carries the recommendation. A fill on the whole column
                  would read as chosen; a mark says suggested. */}
              {p.pick && <span className="badge badge-accent" {...ins('badge-accent')}>Popular</span>}
            </div>
            <div {...txt('h3')} style={{ fontSize: 'var(--font-h3-size)', fontWeight: 'var(--font-h3-weight)' }}>{p.price}</div>
            <p className="muted small" {...txt('body-sm', 'text-muted')}>{p.note}</p>
            <button className={`btn ${p.variant}`} {...ins(p.variant === 'btn-primary' ? 'button-primary' : 'button-secondary')}>
              {p.cta}{p.variant === 'btn-primary' && <Ico d={IconArrow} end />}
            </button>
          </div>
        ))}
      </div>

      {/* The matrix. One card holding rows that span all three columns, so every
          claim lines up with the plan above it. A separator goes above each row
          and never below, so the last row ends clean against the card's edge. */}
      <div className="card" {...ins('card')} style={{ padding: 0 }}>
        {ROWS.map(([label, ...cells], i) => (
          <div key={label} className="plan-row" style={{
            borderTop: i === 0 ? 0 : '1px solid var(--c-border-subtle)',
          }}>
            <span className="small" {...txt('body-sm')} style={{ fontWeight: 500 }}>{label}</span>
            {cells.map((cell, j) => (
              <span key={j} className="plan-cell">
                {cell === true
                  ? <Ico d={IconCheck} size="sm" />
                  : cell === false
                    ? <span className="caption subtle" {...txt('caption', 'text-subtle')} aria-label="not included">&mdash;</span>
                    : <span className="caption" {...txt('caption', 'text-muted')}>{cell}</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
