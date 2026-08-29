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
        {/* PAIRED. Four controls beside a search field came out 1+2+1 at 296px
            and stranded Sort on a line of its own. The stranding is the same
            fault whether the control is an action or a filter, so the same rule
            applies: two per line, equal, flush both edges.
            Even count, so no lead line — a lead is what an ODD count does with
            its most important control. */}
        <div className="action-pairs">
          <div className="pair">
            <button className="btn btn-secondary select-trigger" {...ins('select')}
              style={{ borderColor: 'var(--c-accent)', color: 'var(--c-accent)' }}>
              {L('Status')}: {L('Overdue')}<Ico d={IconChevron} size="sm" />
            </button>
            <button className="btn btn-secondary select-trigger" {...ins('select')}>
              {L('Due')}: {L('Any')}<Ico d={IconChevron} size="sm" />
            </button>
          </div>
          {/* No `margin-left: auto` on Sort. An auto margin applies to the line
              the item lands on, not to the row, so the moment this row wrapped
              the margin pushed Sort to the right end of its OWN line and left
              the slack beside it — measured 495.3px of empty space at a 736px
              pane, with Sort starting at 1199 while every other control started
              at 703. */}
          <div className="pair">
            <button className="btn btn-ghost" {...ins('button-ghost')}>{L('Clear')}</button>
            <button className="btn btn-secondary select-trigger" {...ins('select')}>
              {L('Sort')}: {L('Newest first')}<Ico d={IconChevron} size="sm" />
            </button>
          </div>
        </div>
      </div>

      <div className="card" {...ins('card')} style={{ padding: 0, overflow: 'hidden' }}>
        {/* The batch bar takes the toolbar's place while a selection exists. */}
        <div className="batch-bar" {...ins('card-overlay')}>
          {/* THE COUNT IS A READOUT, NOT A CONTROL.
           *
           * A select-all checkbox used to sit here beside it. It belongs at the
           * top of the column it controls, so it moved into the table header,
           * where the cell for it was empty.
           *
           * Two things went with it. The `label` wrapper is gone, because a
           * label with no control in it names nothing. And the box's own
           * invisibility went with it: painted in `--c-accent` on this
           * `--c-accent` bar, its fill and its border both measured 1.00:1, so
           * only the indeterminate dash was visible and it read as a stray
           * hyphen before the number. On the table header it sits on `surface`,
           * where its outline is calibrated.
           *
           * A live region, because the count changes as rows are picked and a
           * number that silently rewrites itself is a number nobody hears. */}
          <strong className="small" role="status" aria-live="polite"
            style={{ fontWeight: 600, flexShrink: 0 }}>{selected} {L('Selected')}</strong>
          {/* `btn-sm` STAYS. Promoting these five to the large step was an
              attempt to give the select-all beside them a 44px target while
              keeping the row one height, and it cost far more than it bought:
              the wider labels pushed the bar past its pane and it wrapped, so
              the bar went from 44px to 108 at 824px and to 156 at 393. Six
              actions on four lines is not a bar.
              The target comes from an overhang in the stylesheet instead, which
              reaches into the bar's own padding and moves nothing. The scale is
              not rewritten, and the promotion to the large step belongs to a
              coarse pointer, which this app does not yet ask about. */}
          {/* PAIRED, so breaking this bar strands nothing.
              Wide, the pairs are `display: contents` and all five buttons sit in
              one row at natural widths. Narrow, each pair takes a line: two per
              line, equal, flush on both edges, and a long label takes what it
              needs while its partner shrinks.
              Five is odd, so the most important action is a pair of ONE and goes
              first — a column is pressed from the top. Left to the arithmetic it
              would land last and alone, which is the stranded item the pairing
              removes. */}
          <div className="action-pairs">
            <div className="pair">
              <button className="btn btn-sm" {...ins('button-sm')}>{L('Send reminder')}</button>
            </div>
            <div className="pair">
              <button className="btn btn-sm" {...ins('button-sm')}>{L('Mark as paid')}</button>
              <button className="btn btn-sm" {...ins('button-sm')}>{L('Export')}</button>
            </div>
            {/* Destructive stands apart from the three constructive ones. Fourth
                in a matched run it reads as equally likely. */}
            <div className="pair">
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--c-accent-fg)', opacity: .9 }}>{L('Delete')}</button>
              {/* `batch-end` KEEPS its auto margin, and it still earns it. Wide,
                  the pairs dissolve and this is the last button in one flat row,
                  where the margin holds it against the bar's right edge —
                  dropping it left 618.6px of empty bar at 1280. Narrow, the
                  stylesheet zeroes it by specificity rather than by line order,
                  because inside a pair that margin is slack and slack would eat
                  the half this button is entitled to. */}
              <button className="btn btn-ghost btn-sm batch-end" style={{ color: 'var(--c-accent-fg)' }}>{L('Clear selection')}</button>
            </div>
          </div>
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
                {/* THE SELECT-ALL BOX BELONGS HERE, AT THE TOP OF THE COLUMN IT
                    CONTROLS.
                 *
                 * It was in the batch bar, which detaches it from its own column
                 * and from the row boxes it sets. This header cell was empty.
                 *
                 * Indeterminate, because two of the rows below are selected and
                 * the rest are not. That is the third state, and the only honest
                 * answer here: unchecked claims nothing is selected while rows
                 * plainly are, and checked claims everything is.
                 *
                 * It is the one positional case that needs its OWN name. A row
                 * box is named by its column heading plus its record; this box IS
                 * the column heading, so nothing else can name it. */}
                <th className="sel-col">
                  <Check mixed label={L('Select all invoices')}
                    {...ins('checkbox-indeterminate')} />
                </th>
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
                  {/* No visible label, and that is correct here — the column
                      heading and this row name the box between them. It is one
                      of the four positional cases. It still owes an accessible
                      NAME, so the name says which record it selects rather
                      than "Select row", which would be eleven identical
                      announcements. The CELL carries the target. */}
                  <td className="sel-col">
                    <Check on={r.on} label={`${L('Select invoice')} ${r.id}`}
                      {...ins(r.on ? 'checkbox-checked' : 'checkbox')} />
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
      {/* `space-between`, not an auto margin on the group.
       *
       * An auto margin applies to the LINE an item lands on. On one line it
       * put the group right, which is correct; the moment this row wrapped it
       * put the group at the right end of its own line and left the slack
       * beside it — measured 109px at a 320px pane and 85px at 296.
       *
       * `space-between` normally spreads slack across EVERY gap, which is why
       * it is the wrong tool on a row of three or more. This row holds exactly
       * TWO children, so there is one gap and nothing to spread, and a lone
       * item on a wrapped line packs to the start. Both widths come out
       * right. */}
      <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
        {/* THE COUNT IS THE THING THAT SAYS WHERE YOU ARE, so it announces.
         *
         * This pager has no numbered pages by design, which is why nothing here
         * carries `aria-current`. A run of page buttons cannot state its own
         * width. So the sentence does the whole job, and a page change swaps
         * every row underneath it. Without a live region that happens in
         * silence.
         *
         * `polite`, not `assertive`. A range that updates is worth hearing at
         * the next pause, not worth interrupting for. */}
        <span className="small muted" role="status" aria-live="polite" {...txt('body-sm', 'text-muted')}>
          Showing <span className="figure">1–10</span> of <span className="figure">48</span>
        </span>
        {/* One group, so the label, the dropdown and the arrows travel
            together and the whole thing sits on the sentence's baseline. */}
        <span className="row">
          <span className="small muted" {...txt('body-sm', 'text-muted')}>{L('Rows')}</span>
          <button className="btn btn-secondary btn-sm select-trigger" {...ins('select')}>
            <span className="figure">10</span><Ico d={IconChevron} size="sm" />
          </button>
          {/* A NAMED LANDMARK AROUND THE STEPS, AND ONLY THE STEPS.
           *
           * The rows-per-page select stays outside it. That control changes how
           * much you see, not where you are, so it is not part of the pager.
           *
           * `.row` on the nav, so its own 8px gap replaces the one it takes over
           * from the group. Measured before and after: 8/8/8 either way, because
           * both rows declare the same step. */}
          <nav className="row" aria-label="Invoice pages">
            {/* `aria-disabled`, never `disabled`.
             *
             * `disabled` takes the control out of the tab order, so a reader
             * moving by keyboard never reaches it and never learns which end of
             * the list they are at. The button stays focusable, announces itself
             * as unavailable, and does nothing when pressed. The appearance is
             * unchanged: `.btn[aria-disabled="true"]` carries the same opacity
             * the native state does. */}
            <button className="btn btn-secondary btn-sm icon-only" aria-disabled="true" aria-label="Previous page" {...ins('button-primary-disabled')}><Ico d={IconChevron} className="icon-left" /></button>
            <button className="btn btn-secondary btn-sm icon-only" aria-label="Next page" {...ins('button-secondary')}><Ico d={IconChevron} className="icon-right" /></button>
          </nav>
        </span>
      </div>
    </div>
  )
}
