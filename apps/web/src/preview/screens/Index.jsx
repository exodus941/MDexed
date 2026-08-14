/* An index: a list you work in.
 *
 * WHY THIS SHAPE. Across the other ten surfaces there was no search field, no
 * filter in its set state, no checkbox column, no sortable header, no
 * selection, and no pagination. That is six components an agent has to invent,
 * on the single most common screen in software after a dashboard. It was found
 * by drawing the screen rather than by listing components — see the comps in
 * the session notes.
 *
 * WHAT DRAWING IT FOUND, before a line of this file existed:
 *   · figures had no stated treatment, so a column of money would not align
 *   · the checkbox had two states and needed three
 *   · a selected row had no role, and `accent-subtle` measures 1.26:1 — a
 *     selection you can only see once you are already looking at it
 *   · a striped row had no role either
 *   · `border` was measured on `surface` alone, its best case, so a control on
 *     any darker ground had an outline nobody had checked
 *
 * THE TABLE IS CARBON'S, ON OUR RAMP. Its header row and its zebra row are the
 * same step off the surface; it keeps the row rules as well as the stripe; and
 * its selection is neutral, with the accent appearing once per row rather than
 * filling it. All three were things this file got wrong first.
 */
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, Check, IconPlus, IconDownload, IconSearch, IconMore, IconCheck, IconAlert, IconChevron } from '../icons.jsx'

const ROWS = [
  { id: 'INV-2291', ini: 'AK', account: 'Ashford & Kline',   status: 'Overdue', due: '12 Aug', amount: '$21,050', on: true },
  { id: 'INV-2290', ini: 'NT', account: 'Northwind Trading', status: 'Paid',    due: '09 Aug', amount: '$12,480' },
  { id: 'INV-2288', ini: 'HG', account: 'Halcyon Group',     status: 'Overdue', due: '05 Aug', amount: '$8,915', on: true },
  { id: 'INV-2287', ini: 'ML', account: 'Meridian Labs',     status: 'Draft',   due: '—',      amount: '$3,200' },
  { id: 'INV-2285', ini: 'NT', account: 'Northwind Trading', status: 'Paid',    due: '28 Jul', amount: '$6,740' },
  { id: 'INV-2284', ini: 'AK', account: 'Ashford & Kline',   status: 'Sent',    due: '24 Jul', amount: '$4,120' },
  { id: 'INV-2283', ini: 'CV', account: 'Calder & Vance',    status: 'Sent',    due: '21 Jul', amount: '$9,380' },
  { id: 'INV-2281', ini: 'ML', account: 'Meridian Labs',     status: 'Paid',    due: '18 Jul', amount: '$2,975' },
  { id: 'INV-2280', ini: 'HG', account: 'Halcyon Group',     status: 'Draft',   due: '—',      amount: '$15,600' },
  { id: 'INV-2278', ini: 'NT', account: 'Northwind Trading', status: 'Paid',    due: '12 Jul', amount: '$7,240' },
]

const BADGE = { Overdue: 'badge-danger', Paid: 'badge-success', Sent: 'badge-warning', Draft: 'badge-neutral' }
/* A sign as well as a hue, because meaning never rests on colour alone. Draft
   carries no icon on purpose: it is the absence of a state, and an outline
   badge with no mark is how the set says so. */
const MARK = { Overdue: IconAlert, Paid: IconCheck, Sent: IconDownload }

/* No local checkbox. This file had one, hand-rolled with eight inline values,
   beside the shared `Check` that Form, Dialog and the Gallery already use — a
   fourth implementation of a component the system declares. It now uses the
   shared one, which gained the third state instead. */

export default function Index ({ onInspect, casing, layout }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  const tb = layout?.table ?? {}
  const selected = ROWS.filter(r => r.on).length

  return (
    <div className="stack">
      <div className="page-header">
        <div className="row row-wrap page-head">
          <div className="page-title"><h2 {...txt('h2')}>Invoices</h2></div>
          {/* The byline says what the footer does not. It counted the rows once
              and the footer counted them again, which is one fact twice. */}
          <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>
            {/* `.figure`, not `.amount`. It is a sum, but it sits in a
                sentence rather than in a column, and there is nothing beside
                it to line up with. The right edge belongs to the column. */}
            <span className="figure">$184,320</span> outstanding · 2 overdue
          </p>
          <div className="row page-actions">
            <button className="btn btn-secondary" {...ins('button-secondary')}><Ico d={IconDownload} />{L('Export')}</button>
            <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconPlus} />{L('New invoice')}</button>
            <button className="btn btn-secondary icon-only" {...ins('button-secondary')}><Ico d={IconMore} /></button>
          </div>
        </div>
      </div>

      {/* Narrow it, then arrange it. The two groups are separated by the auto
          margin rather than by `space-between`, which would spread the slack
          across every gap inside them. */}
      {/* `.input` for the search and `.btn` for the rest.
       *
       * Every control here was an `.input` first, and `.input` declares
       * `width: 100%`. In a row that makes each one ask for the whole line, so
       * the search field was crushed to 24px holding 84px of placeholder. A
       * filter and a sort are not fields you type into — they are controls you
       * press that open a list. The button is the right primitive, and it
       * brings the row to one height for free. */}
      <div className="row row-wrap row-controls">
        {/* No inline display or centring: `label.input.with-icon` states both,
            so a second copy here would be the hand-rolling the guard exists to
            catch. `min-width` floors it at its own content — measured, it shrank
            to 80px holding 84. */}
        <label className="input with-icon" {...ins('input')}
          style={{ flex: '1 1 14rem', minWidth: 'min-content' }}>
          <Ico d={IconSearch} size="sm" />
          <span className="subtle small" {...txt('body-sm', 'text-subtle')}>{L('Search invoices')}</span>
        </label>
        {/* A FILTER IS A DROPDOWN, so it uses the component that exists for
            exactly this: `.select-trigger`, a value on the left and a chevron
            on the right. These were plain buttons with a colon in the label —
            no chevron, nothing to say they open anything, and no relation to
            the declared `select`. A control that opens a list must look like
            one.
            A filter that is SET says so by its EDGE, and it replaced a chip
            row that contradicted it: one read "All" while the other read
            "Overdue", which is two controls for one decision. */}
        {/* NO dot. It was a red mark on a blue control, which is two colour
            signals in one object saying different things: the accent says
            "this filter is set" and the danger dot said nothing at all — the
            value already reads "Overdue". A mark that carries no meaning still
            looks like it carries one. One control, one signal, and here the
            signal is the edge. */}
        <button className="btn btn-secondary select-trigger" {...ins('select')}
          style={{ borderColor: 'var(--c-accent)', color: 'var(--c-accent)', flexShrink: 0 }}>
          {L('Status')}: {L('Overdue')}<Ico d={IconChevron} size="sm" />
        </button>
        <button className="btn btn-secondary select-trigger" {...ins('select')} style={{ flexShrink: 0 }}>
          {L('Due')}: {L('Any')}<Ico d={IconChevron} size="sm" />
        </button>
        <button className="btn btn-ghost" {...ins('button-ghost')} style={{ flexShrink: 0 }}>{L('Clear')}</button>
        <button className="btn btn-secondary select-trigger" {...ins('select')} style={{ flexShrink: 0, marginLeft: 'auto' }}>
          {L('Sort')}: {L('Newest first')}<Ico d={IconChevron} size="sm" />
        </button>
      </div>

      <div className="card" {...ins('card')} style={{ padding: 0, overflow: 'hidden' }}>
        {/* The batch bar takes the toolbar's place while a selection exists. */}
        <div className="batch-bar" {...ins('card-overlay')}>
          {/* The box and its count are ONE item in this row, not two. Loose,
              the 16px box sat among 28px buttons and the row held two heights
              — and a control row is one height. Grouped, the bar's children
              are uniform and the box centres inside its own group. */}
          <span className="row" style={{ gap: 'var(--space-2xs)', flexShrink: 0 }}>
            <Check mixed {...ins('checkbox-indeterminate')} />
            <strong className="small" style={{ fontWeight: 600 }}>{selected} {L('Selected')}</strong>
          </span>
          <button className="btn btn-sm" {...ins('button-sm')}>{L('Send reminder')}</button>
          <button className="btn btn-sm" {...ins('button-sm')}>{L('Mark as paid')}</button>
          <button className="btn btn-sm" {...ins('button-sm')}>{L('Export')}</button>
          {/* Destructive stands apart from the three constructive ones. Fourth
              in a matched run it reads as equally likely. */}
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--c-accent-fg)', opacity: .9 }}>{L('Delete')}</button>
          <button className="btn btn-ghost btn-sm batch-end" style={{ color: 'var(--c-accent-fg)' }}>{L('Clear selection')}</button>
        </div>

        {/* A table of real columns cannot fold, so it scrolls — the one shape
            where sideways scrolling is the answer rather than the failure. */}
        <div className="table-scroll">
          {/* Every class here is READ FROM THE DOCUMENT, not chosen.
           *
           * This said `tb.head`, and the field is called `header` — so the
           * setting had no effect at all and the header rendered the same
           * whatever the editor said. The row separation was hard-coded to
           * zebra for the same reason: I picked what I wanted to demonstrate
           * instead of demonstrating what the document states. A sample that
           * ignores a setting is the setting's strongest argument for not
           * existing. */}
          <table {...ins('table')} className={[
            'table',
            tb.header === 'plain' ? 'table-head-plain' : '',
            tb.rows === 'zebra' ? 'table-rows-zebra' : tb.rows === 'both' ? 'table-rows-both'
              : tb.rows === 'none' ? 'table-rows-none' : '',
            tb.density === 'compact' ? 'table-dense' : tb.density === 'roomy' ? 'table-roomy' : '',
          ].filter(Boolean).join(' ')}>
            <thead>
              <tr>
                <th className="sel-col" />
                <th>{L('Invoice')}</th>
                <th>{L('Account')}</th>
                <th>{L('Status')}</th>
                <th>{L('Due')}</th>
                <th className="num-col">{L('Amount')}</th>
                <th className="act-col" />
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r.id} className={r.on ? 'is-selected' : undefined}>
                  <td className="sel-col">
                    <Check on={r.on} {...ins(r.on ? 'checkbox-checked' : 'checkbox')} />
                  </td>
                  {/* An identifier: the mono face, and NO right edge. Nobody
                      compares its magnitude, and a right-aligned reference
                      reads as a total. */}
                  <td><span className="figure small">{r.id}</span></td>
                  <td>
                    <span className="row" style={{ minWidth: 0 }}>
                      <span className="avatar" {...ins('avatar')}>{r.ini}</span>
                      <span className="small">{r.account}</span>
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${BADGE[r.status]}`} {...ins(`badge-${BADGE[r.status].replace('badge-', '')}`)}>
                      {MARK[r.status] && <Ico d={MARK[r.status]} size="sm" />}{L(r.status)}
                    </span>
                  </td>
                  <td><span className="small muted">{r.due}</span></td>
                  {/* An amount: the mono face AND the right edge. */}
                  <td className="num-col">
                    <span className="amount small">{r.amount}</span>
                  </td>
                  <td className="act-col">
                    <button className="btn btn-ghost btn-sm icon-only" {...ins('button-ghost')}><Ico d={IconMore} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Where you are, and one step either way.
       *
       * The numbered pages are gone. A run of page buttons grows with the data
       * — this one already needed an ellipsis at 48 rows — so it is a row that
       * cannot state its own width, and it ran off the end of the card. Two
       * arrows do the same job at a fixed size, and the count beside them says
       * where you are better than a highlighted "1" does.
       *
       * "Showing 1–10 of 48" is PROSE, so it is not recased. It read "Showing
       * 1–10 Of 48" because the label helper had been pointed at a sentence.
       * `Rows` is a label and keeps its capital. */}
      <div className="row row-wrap">
        <span className="small muted" {...txt('body-sm', 'text-muted')}>
          Showing <span className="figure">1–10</span> of <span className="figure">48</span>
        </span>
        {/* One group, so the label, the dropdown and the arrows travel
            together and the whole thing sits on the sentence's baseline. */}
        <span className="row" style={{ marginLeft: 'auto' }}>
          <span className="small muted" {...txt('body-sm', 'text-muted')}>{L('Rows')}</span>
          <button className="btn btn-secondary btn-sm select-trigger" {...ins('select')}>
            <span className="figure">10</span><Ico d={IconChevron} size="sm" />
          </button>
          <button className="btn btn-secondary btn-sm icon-only" disabled aria-label="Previous page" {...ins('button-primary-disabled')}><Ico d={IconChevron} className="icon-left" /></button>
          <button className="btn btn-secondary btn-sm icon-only" aria-label="Next page" {...ins('button-secondary')}><Ico d={IconChevron} className="icon-right" /></button>
        </span>
      </div>
    </div>
  )
}
