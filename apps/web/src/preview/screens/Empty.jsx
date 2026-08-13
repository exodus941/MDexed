/* Empty states: what a screen says when it has nothing to show.
 *
 * The most-invented screen in software. A system that never demonstrates one
 * gets an agent's guess, and the guess is usually a centred grey sentence in
 * the middle of a white page with no way out of it.
 *
 * Three kinds, because they are three different situations and a reader who
 * only sees one will use it for all three:
 *
 *   FIRST RUN   nothing here yet, and that is normal. The screen's job is to
 *               get you started, so it carries the primary action of the whole
 *               feature and explains what will appear.
 *   NO RESULTS  there is data, your filter excluded it. The job is to get you
 *               back, so the action is "clear the filter" and never "create".
 *   ERROR       something failed. The job is to say what, and to offer a retry.
 *               It is not a friendly illustration with an apology.
 *
 * Two rules with no other instance live here:
 *
 *   A capped child does not centre in a `stretch` container. `align-items:
 *   stretch` only centres things with no width of their own, so a block with a
 *   `max-width` lands at the start of the span with the whole remainder on one
 *   side. These use `center` explicitly.
 *
 *   Centred prose takes a measure. A line of explanation running the full width
 *   of a wide pane is unreadable however well it is centred.
 */
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, IconPlus, IconSend, IconAlert, IconFolder, IconMore } from '../icons.jsx'

/* One state. The mark, the line, the explanation, the way out.
 *
 * `align-items: center` rather than `stretch`, because the block inside has a
 * measure and a stretch container leaves a capped child at the start of its
 * span. `text-align: center` on the block, so the two lines agree with the
 * mark above them. */
function State({ ins, txt, L, mark, tone, title, body, primary, secondary, primaryIcon }) {
  return (
    <div className="card stack" {...ins('card')} style={{ alignItems: 'center', textAlign: 'center' }}>
      {/* The mark reads as furniture rather than as a control, so it takes the
          subtle text role and no fill. An empty state that opens with a filled
          circle looks like a button nobody can press. */}
      <span className="empty-mark" style={{ color: `var(--c-${tone})` }} {...ins('avatar')}>
        <Ico d={mark} size="lg" />
      </span>
      <div className="stack-sm" style={{ alignItems: 'center', maxWidth: '38ch' }}>
        <strong {...txt('h5')} style={{ fontSize: 'var(--font-h5-size)' }}>{L(title)}</strong>
        <p className="muted small" {...txt('body-sm', 'text-muted')}>{body}</p>
      </div>
      {/* The way out. One primary, and a secondary only where there genuinely
          is a second thing to do — an empty state with two equal buttons asks
          the reader to choose before they have anything to choose about.
          `secondary`, not `ghost`. A ghost is the variant for an action that
          sits INSIDE something already framed — a row in a table, a toolbar, a
          dialog footer. This pair stands alone in the middle of a card with
          nothing around it, so the second action needs an edge to be a button
          at all. Five other surfaces demonstrate the ghost; none of them
          demonstrate this. */}
      <div className="row stack-narrow card-actions" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" {...ins('button-primary')}>
          {primaryIcon && <Ico d={primaryIcon} />}{L(primary)}
        </button>
        {secondary && (
          <button className="btn btn-secondary" {...ins('button-secondary')}>{L(secondary)}</button>
        )}
      </div>
    </div>
  )
}

export default function Empty({ onInspect, casing }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  return (
    <div className="stack">
      <div className="page-header">
        <div className="row row-wrap page-head">
          <div className="page-title"><h2 {...txt('h2')}>{L('Empty states')}</h2></div>
          <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>
            Three situations that look alike and are not.
          </p>
        </div>
      </div>

      {/* One column, not a grid. Three empty states side by side would read as
          a comparison, and each of these is a whole screen in its own right. */}
      <State ins={ins} txt={txt} L={L} mark={IconFolder} tone="text-subtle"
        title="No invoices yet"
        body="Invoices you raise will appear here, with their status and what is owed. Nothing has been raised on this account."
        primary="New invoice" primaryIcon={IconPlus} secondary="Import from CSV" />

      <State ins={ins} txt={txt} L={L} mark={IconMore} tone="text-muted"
        title="No invoices match this filter"
        body="Four invoices exist on this account. None of them are overdue and unpaid at the same time."
        primary="Clear filters" />

      {/* The error state takes the danger role for its mark and NOT for its
          buttons. A failure is worth marking; a retry is an ordinary action and
          a red button here would read as destructive. */}
      <State ins={ins} txt={txt} L={L} mark={IconAlert} tone="danger"
        title="Could not load invoices"
        body="The billing service did not answer. Nothing has been lost, and your last export is still available."
        primary="Try again" primaryIcon={IconSend} secondary="Download last export" />
    </div>
  )
}
