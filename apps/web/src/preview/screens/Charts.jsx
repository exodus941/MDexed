/* ── CHARTS ──
 *
 * THE COLOUR WAS DONE AND THE FURNITURE PUBLISHED NOTHING. `--chart-1..5`,
 * `--chart-seq-1..8` and `--chart-div-1..8` have shipped for months. No token
 * stated an axis weight, a gridline colour, a plot inset, a bar gap, a line
 * stroke, a marker size or an area fill, so a builder charting anything
 * invented all seven. A chart is mostly furniture, which makes this the most
 * expensive place for that hole to sit.
 *
 * AND TWO OF THE THREE SCALES HAD NO CONSUMER AT ALL. `seq` and `div` were
 * published and never painted, which is the same as not shipping them: a token
 * nobody can see is a token nobody can trust. The heatmap consumes one and the
 * crossing-zero chart consumes the other. Those are the reasons both are on
 * this surface, rather than reasons of completeness.
 *
 * NO CHART LIBRARY. Every chart here is divs, a conic gradient, or an inline
 * SVG path. A builder gets rules it can apply to whatever library it reaches
 * for, and a specimen drawn with a library would be a specimen of that library.
 *
 * ONE `Framed` HELPER, TWELVE USES. The tick column, the plot and the category
 * labels sit in one grid with named areas, because a tick column beside the
 * plot offsets everything to its right. Written out twelve times, the labels
 * drift off their own columns in whichever copy somebody edits last. The
 * helper is also why the grid areas cannot disagree with the CSS.
 *
 * WHAT THIS SURFACE IS FOR, in order:
 *
 *   1  the shared furniture, once, so a reader sees the axis and the gridline
 *      before seeing twelve variations on them
 *   2  the twelve types
 *   3  the SITUATIONS, which is where a chart spec actually fails
 *
 * The situations are last and they are not optional. A chart type is a shape
 * somebody looks up. An empty chart is a screen somebody builds wrongly
 * because no sample ever showed one.
 */

import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'

/* ── Data, once ──
 * Six months, so a category axis has enough ticks to read and few enough to
 * label. The figures are invoice values, because a chart in this system is
 * nearly always money, and money is what exercises the mono face. */
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
const RAISED = [58, 74, 66, 91, 84, 108]
const SETTLED = [41, 55, 52, 68, 71, 86]
const MAX = 120

const LINES = ['Licences', 'Services', 'Support', 'Training', 'Other']
const SPLIT = [34, 26, 18, 13, 9]

const pct = (v, max = MAX) => `${((v / max) * 100).toFixed(2)}%`

/* A polyline through a 0..100 box, so the SVG scales with its container and
   nothing here carries a pixel. */
const poly = (vals, max = MAX) => vals
  .map((v, i) => `${((i / (vals.length - 1)) * 100).toFixed(2)},${(100 - (v / max) * 100).toFixed(2)}`)
  .join(' ')

/* A conic gradient, so a slice costs no element and no path arithmetic. The
   gap between slices is the GROUND showing through, not a stroke: a stroke has
   nothing to attach to on a gradient. */
function conic(parts) {
  let acc = 0
  const stops = parts.map((v, i) => {
    const from = acc
    acc += v
    return `var(--chart-${i + 1}) ${from}% ${acc}%`
  })
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

const SCATTER = [
  [8, 22], [18, 30], [24, 26], [33, 44], [41, 38], [46, 55], [55, 50],
  [62, 66], [70, 60], [78, 74], [86, 70], [92, 84], [14, 52], [30, 62],
  [52, 30], [66, 40], [84, 46],
]

/* Four rows by six months, stepping through the sequential scale. The values
   are indices into `--chart-seq-1..8` rather than data, because the point of
   the specimen is the ramp. */
const HEAT = [
  [2, 3, 3, 4, 5, 7],
  [2, 2, 3, 4, 4, 6],
  [1, 2, 3, 3, 4, 5],
  [1, 1, 2, 3, 3, 4],
]

const DIVERGE = [28, 16, -12, 34, -22, 20]

const SPARKS = [
  ['Northwind Traders', [30, 42, 38, 55, 50, 68, 64, 80], 2, '£12,480'],
  ['Contoso', [70, 62, 66, 50, 54, 40, 44, 32], 5, '£8,120'],
  ['Fabrikam', [44, 46, 45, 48, 47, 50, 49, 52], 1, '£5,940'],
]

const LONG = [
  ['Professional services and implementation', 34],
  ['Licences', 26],
  ['Support and maintenance renewals', 18],
  ['Training', 9],
]

/* ── One frame for every specimen ──
 * A SAMPLE PAINTED IN THE EDITOR'S OWN COLOURS IS NOT A SAMPLE. Every one of
 * these sits in a `.card`, on the document's own surface, in the document's own
 * tokens. Reaching for the same frame every time is what stops two sections'
 * samples drifting into looking like different kinds of thing. */
function Spec({ title, note, children, txt, ins, span }) {
  return (
    /* `stack-lg`, NOT `stack-sm`. The title group needs twice the clearance
       from the chart below it, and the card's own flow is the one writer for
       that distance. A margin on the group would add to this gap instead of
       replacing it. 12px to 24. */
    <div className="card stack-lg" {...ins('card')} style={span ? { gridColumn: '1 / -1' } : undefined}>
      <div>
        <h3 className="t-h6" {...txt('h6')}>{title}</h3>
        {/* ── THE FLAVOUR TEXT AND A CHART LABEL WERE THE SAME THING ──
            Both measured 12px, weight 400, #46515d, 6.79:1. No hierarchy at
            all, so an explanation and an axis label read as one kind of text.

            This is a BYLINE, and the app already has a convention for one:
            `.page-sub` is `body-sm` at `text-muted`, which is 14px. `caption`
            was the wrong role, and it happens to be the chart label's role.

            THE DIFFERENCE IS SIZE, NOT COLOUR, and that is a constraint rather
            than a preference. `text-subtle` would give a second step and
            measures 4.33:1 on the card, under the 4.5 that 12px text needs. A
            chart label is furniture, and it is still text somebody reads. */}
        {note && <p className="muted small" {...txt('body-sm', 'text-muted')}>{note}</p>}
      </div>
      {children}
    </div>
  )
}

/* Tick labels down the value axis. Figures in a COLUMN, so the mono face
   applies and the end edge stacks the digits over each other. */
function Ticks({ max = MAX, steps = 4, txt, end }) {
  return (
    <div className={end ? 'chart-ticks chart-ticks-end' : 'chart-ticks'} {...txt('caption', 'text-muted')}>
      {Array.from({ length: steps + 1 }, (_, i) => (
        <span className="chart-tick figure" key={i}>{Math.round((max / steps) * (steps - i))}</span>
      ))}
    </div>
  )
}

/* THE CATEGORY LABELS LIVE INSIDE THE GRID, and this helper is why they cannot
 * escape it. A tick column beside the plot offsets everything to its right, so
 * labels placed as a sibling of the frame sit off their own columns by the tick
 * width every time.
 *
 * The labels share the columns' BASIS rather than a grid of their own: both
 * rows flex, both hold the same count, and every child takes `flex: 1 1 0` and
 * the same gap. The algorithm is deterministic, so column five of the labels
 * lands under column five of the bars. */
/* NO DEFAULT HEIGHT. An inline `height` beats `aspect-ratio`, so passing one
   here made the 2:1 apply to nothing. Measured across the set: 2.00, 3.33,
   3.78 and 7.08 to one. The plot's proportion is the plot's shape, so the
   stylesheet owns it and a height is an override for a specimen that needs
   a specific one. */
function Framed({ txt, steps = 3, max = MAX, height, cats, axis = 'chart-axis-x', ticksEnd, endMax, children }) {
  return (
    <div className="chart-frame">
      <Ticks txt={txt} steps={steps} max={max} />
      <div className={`chart-plot ${axis}`} style={{ height, '--ch-grid-n': steps }}>
        <div className="chart-grid" />
        {children}
      </div>
      {ticksEnd && <Ticks txt={txt} steps={steps} max={endMax ?? max} end />}
      {cats && (
        <div className="chart-cats">
          {cats.map(c => <span key={c} className="chart-tick">{c}</span>)}
        </div>
      )}
    </div>
  )
}

/* The legend IS the direct label, not decoration. No categorical palette this
   size survives the loss of red-green vision, so the words are what make the
   picture certain. `color/dataviz.js` states it; this obeys it. */
function Key({ items, txt, seq }) {
  return (
    <div className="chart-key">
      {items.map((label, i) => (
        <span key={label} {...txt('caption', 'text-muted')}>
          <span className="dot" style={{ color: seq ? `var(--chart-seq-${i + 2})` : `var(--chart-${i + 1})` }} />
          {label}
        </span>
      ))}
    </div>
  )
}

/* A run of columns, one colour. A SINGLE SERIES TAKES ONE COLOUR, NEVER FIVE:
   five colours on one series says the categories are five different things,
   and a category axis already said they are one thing measured six times. */
const Cols = ({ vals, tone = 1, max = MAX }) => (
  <div className="chart-cols">
    {vals.map((v, i) => (
      <div className="chart-col" key={i} style={{ height: pct(v, max), background: `var(--chart-${tone})` }} />
    ))}
  </div>
)

export default function Charts({ onInspect, casing }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  return (
    <div className="stack-xl">
      {/* THE OUTER STACK OWNS THE SECTION GAP. Cards inside a section sit
          `md` apart, so a section boundary has to beat that by three to one
          or a new section reads as one more card. A margin on the heading
          would add to this gap instead of replacing it. */}
      <div className="stack">
        <div className="page-header">
        <div className="row row-wrap page-head">
          <div className="page-title"><h2 {...txt('h2')}>{L('Charts')}</h2></div>
          <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>
            Twelve types on one set of furniture, and the situations that break them.
          </p>
        </div>
      </div>

      {/* ══ 1. THE FURNITURE ══
          Shown once and at full width, because a reader has to see the axis and
          the gridline before seeing twelve variations on them. */}
      <Spec txt={txt} ins={ins} span
        title={L('The furniture')}
        note="The axis outweighs its gridlines."
      >
        <div className="chart chart-column" {...ins('chart-column')}
          role="img" aria-label="Invoices raised, April to September: 58, 74, 66, 91, 84 and 108 thousand">
          <Framed txt={txt} steps={4} cats={MONTHS}>
            <Cols vals={RAISED} />
          </Framed>
        </div>
      </Spec>

      {/* ══ 2. THE TYPES ══ */}
      <div className="cols-2">
        <Spec txt={txt} ins={ins} title={L('Column')} note="One series, one colour.">
          <div className="chart chart-column" {...ins('chart-column')}
            role="img" aria-label="Invoices raised, April to September: 58, 74, 66, 91, 84 and 108 thousand">
            <Framed txt={txt} cats={MONTHS}><Cols vals={RAISED} /></Framed>
          </div>
        </Spec>

        {/* THE ONE TYPE WHOSE CATEGORY LABEL HAS ROOM TO BE LONG, which is the
            reason to reach for it. The label column takes its content and the
            bar shrinks. A bar clipped to fit a name is a value nobody reads. */}
        <Spec txt={txt} ins={ins} title={L('Bar')} note="The label column takes its content.">
          <div className="chart chart-bar" {...ins('chart-bar')}
            role="img" aria-label="Revenue by line: licences 34, services 26, support 18, training 13, other 9">
            <div className="chart-plot">
              {/* The row count reaches CSS here, because `grid-row: 1 / -1` on the
                  grid layer needs an EXPLICIT row list. With auto-placed rows
                  `-1` is the end of the explicit grid and the layer collapses. */}
              <div className="chart-rows" style={{ '--ch-grid-n': 4, gridTemplateRows: 'repeat(4, auto)' }}>
                <div className="chart-grid" />
                {LINES.slice(0, 4).map((name, i) => (
                  <div key={name} style={{ display: 'contents' }}>
                    <span className="chart-row-label chart-tick">{L(name)}</span>
                    <span className="chart-track">
                      <span className="chart-col" style={{ display: 'block', height: 20, width: pct(SPLIT[i], 40), background: 'var(--chart-1)' }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Spec>

        <Spec txt={txt} ins={ins} title={L('Line')} note="Stroke 2px, marker 8px. One weight.">
          <div className="chart chart-line" {...ins('chart-line')}
            role="img" aria-label="Invoices raised against settled, April to September, both rising">
            <Framed txt={txt} cats={MONTHS}>
              <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="chart-path" points={poly(RAISED)} style={{ stroke: 'var(--chart-1)' }} />
                <polyline className="chart-path" points={poly(SETTLED)} style={{ stroke: 'var(--chart-2)' }} />
              </svg>
              {/* The marker token was published and nothing painted it, which is
                  the fault this whole section closes. */}
              <div className="chart-points">
                {[RAISED, SETTLED].flatMap((s, si) => s.map((v, i) => (
                  <span className="chart-point" key={si + '-' + i}
                    style={{ insetInlineStart: `${(i / (s.length - 1)) * 100}%`,
                      insetBlockStart: `${100 - (v / MAX) * 100}%`,
                      background: `var(--chart-${si + 1})` }} />
                )))}
              </div>
            </Framed>
            <Key items={[L('Raised'), L('Settled')]} txt={txt} />
          </div>
        </Spec>

        <Spec txt={txt} ins={ins} title={L('Area')} note="Fill at 0.2 of its line.">
          <div className="chart chart-area" {...ins('chart-area')}
            role="img" aria-label="Invoices raised, April to September, rising from 58 to 108 thousand">
            <Framed txt={txt} cats={MONTHS}>
              <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon className="chart-fill" points={`0,100 ${poly(RAISED)} 100,100`} style={{ fill: 'var(--chart-2)' }} />
                <polyline className="chart-path" points={poly(RAISED)} style={{ stroke: 'var(--chart-2)' }} />
              </svg>
            </Framed>
          </div>
        </Spec>

        {/* NO GRIDLINES BEHIND A PIE, EVER. There is no value axis to read
            against, so a gridline there is decoration on top of data. Which is
            why `chart-pie` publishes no axis token at all. */}
        <Spec txt={txt} ins={ins} title={L('Pie')} note="No axis, so no gridlines.">
          <div className="chart chart-pie" {...ins('chart-pie')}
            role="img" aria-label="Revenue share: licences 34 per cent, services 26, support 18, training 13, other 9">
            <div className="chart-pie-face" style={{ maxWidth: 148, background: conic(SPLIT) }} role="img"
              aria-label={LINES.map((n, i) => `${n} ${SPLIT[i]} per cent`).join(', ')} />
            <Key items={LINES.map(L)} txt={txt} />
          </div>
        </Spec>

        <Spec txt={txt} ins={ins} title={L('Donut')} note="The hole carries a total.">
          <div className="chart chart-donut" {...ins('chart-donut')}
            role="img" aria-label="Revenue share of 100 thousand: licences 34 per cent, services 26, support 18, training 13, other 9">
            {/* THE STAGE STATES ITS WIDTH. `margin-inline: auto` cancels the
                flex stretch, so a `maxWidth` alone left this 0px wide and the
                face inside it resolved `min(148px, 100%)` to zero. */}
            <div style={{ position: 'relative', inlineSize: 'min(148px, 100%)', marginInline: 'auto' }}>
              <div className="chart-pie-face" style={{ background: conic(SPLIT) }} role="img"
                aria-label={LINES.map((n, i) => `${n} ${SPLIT[i]} per cent`).join(', ')} />
              <div className="chart-hole">
                <strong className="figure" {...txt('h5')}>£428k</strong>
                <span className="chart-tick">{L('Total')}</span>
              </div>
            </div>
            <Key items={LINES.map(L)} txt={txt} />
          </div>
        </Spec>

        {/* THE ONLY TYPE THAT NEEDS A SECOND VALUE AXIS, and the only one where
            two series measure different quantities. Both axes take the same
            weight, or the chart reads as though one series matters less. */}
        <Spec txt={txt} ins={ins} title={L('Column + line')} note="Two value axes, one weight.">
          <div className="chart chart-combo" {...ins('chart-combo')}
            role="img" aria-label="Invoices raised as columns against the settled rate as a line, April to September">
            <Framed txt={txt} cats={MONTHS} ticksEnd endMax={100}>
              <Cols vals={RAISED} />
              <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className="chart-path" points={poly(SETTLED, 100)} style={{ stroke: 'var(--chart-5)' }} />
              </svg>
            </Framed>
            <Key items={[L('Raised'), L('Settlement rate')]} txt={txt} />
          </div>
        </Spec>

        {/* AN ARRANGEMENT, NOT A TYPE, and it earns a specimen because its
            segments TOUCH. That is the case the chart palette is built around:
            every PAIR is separated, not only the pairs that sit side by side in
            a legend. */}
        <Spec txt={txt} ins={ins} title={L('Stacked')} note="Segments touch. The palette rule bites.">
          <div className="chart chart-stacked" {...ins('chart-stacked')}
            role="img" aria-label="Invoices raised and settled stacked by month, April to September">
            <Framed txt={txt} cats={MONTHS}>
              <div className="chart-cols">
                {MONTHS.map((m, i) => (
                  <div className="chart-col" key={m} style={{ height: pct(RAISED[i]) }}>
                    {[0.46, 0.32, 0.22].map((share, si) => (
                      <span className="chart-seg" key={si}
                        style={{ display: 'block', height: `${share * 100}%`, background: `var(--chart-${si + 1})` }} />
                    ))}
                  </div>
                ))}
              </div>
            </Framed>
            <Key items={[L('Licences'), L('Services'), L('Support')]} txt={txt} />
          </div>
        </Spec>

        {/* THE ONE THAT STATES A PROXIMITY RATIO. 4px inside a group against
            16px between them is 4:1, so a group reads as one object. Under 3:1
            the groups dissolve into one run of bars and the category axis stops
            meaning anything. */}
        <Spec txt={txt} ins={ins} title={L('Grouped')} note="4px inside a group, 16px between.">
          <div className="chart chart-grouped" {...ins('chart-grouped')}
            role="img" aria-label="Raised, settled and written off, April to July, three bars a month">
            <Framed txt={txt} cats={MONTHS.slice(0, 4)}>
              <div className="chart-cols">
                {MONTHS.slice(0, 4).map((m, i) => (
                  <div className="chart-group" key={m}>
                    {[RAISED[i], SETTLED[i], SETTLED[i] * 0.7].map((v, si) => (
                      <div className="chart-col" key={si} style={{ height: pct(v), background: `var(--chart-${si + 1})` }} />
                    ))}
                  </div>
                ))}
              </div>
            </Framed>
            <Key items={[L('Raised'), L('Settled'), L('Written off')]} txt={txt} />
          </div>
        </Spec>

        {/* THE ONLY TYPE WHERE THE MARKER IS THE MARK rather than an ornament on
            a line, which is why it publishes a second, smaller size. A dense
            cloud at 8px is a solid shape; at 4px it is a distribution. */}
        <Spec txt={txt} ins={ins} title={L('Scatter')} note="Marker 8px, or 4px when dense.">
          <div className="chart chart-scatter" {...ins('chart-scatter')}
            role="img" aria-label="Invoice value against days to settle, twelve invoices">
            <Framed txt={txt} max={100} axis="chart-axis-x chart-axis-y">
              {/* ELEMENTS, NOT SVG CIRCLES. `preserveAspectRatio="none"` is what
                  lets a path fill a plot of any shape, and it stretches every
                  other thing in the same viewBox. These measured 39.92 by 11.12:
                  stretched 3.59 times, which is the plot's own aspect. */}
              <div className="chart-points">
                {SCATTER.map(([x, y], i) => (
                  <span className="chart-point" key={i}
                    style={{ insetInlineStart: `${x}%`, insetBlockStart: `${100 - y}%`,
                      background: `var(--chart-${i % 2 ? 4 : 2})` }} />
                ))}
              </div>
            </Framed>
          </div>
        </Spec>

        {/* THE ONLY NATURAL CONSUMER OF `--chart-seq-1..8`. That scale has
            shipped for as long as the palette and nothing has ever painted it,
            so it was published and untrustable. */}
        <Spec txt={txt} ins={ins} title={L('Heatmap')} note="The sequential scale only consumer.">
          <div className="chart chart-heatmap" {...ins('chart-heatmap')}
            role="img" aria-label="Settlement rate by month and revenue line, six months by five lines">
            <div className="chart-cells" style={{ gridTemplateColumns: `repeat(${MONTHS.length}, minmax(0, 1fr))` }}>
              {HEAT.map((row, r) => row.map((step, c) => (
                <span className="chart-cell" key={`${r}-${c}`} style={{ background: `var(--chart-seq-${step})` }} />
              )))}
            </div>
            <div className="chart-cats">{MONTHS.map(m => <span key={m} className="chart-tick">{m}</span>)}</div>
            <Key items={[L('Low'), L('Mid'), L('High')]} txt={txt} seq />
          </div>
        </Spec>

        {/* THE NO-FURNITURE CASE. No axis, no gridline, no legend and no tick
            label, because the row it sits in already says what it is. It still
            takes the shared stroke: one weight for every line in the system, so
            a sparkline and a full line chart cannot read as two products. */}
        <Spec txt={txt} ins={ins} title={L('Sparkline')} note="No furniture. The row labels it.">
          <table className="table" {...ins('table')}>
            <thead>
              <tr>
                <th {...txt('caption', 'text-muted')}>{L('Account')}</th>
                <th {...txt('caption', 'text-muted')}>{L('Trend')}</th>
                <th className="num-col" {...txt('caption', 'text-muted')}>{L('Balance')}</th>
              </tr>
            </thead>
            <tbody>
              {SPARKS.map(([name, series, tone, amount]) => (
                <tr key={name}>
                  <td {...txt('body-sm')}>{name}</td>
                  <td>
                    {/* No size here. 88 and 22 were typed, and the 22 was a
                        LINE BOX approximated to a whole pixel: the row's own
                        text measures 21.84. The stylesheet states both now,
                        derived from the body tokens, so a type-scale change
                        carries and no inline value beats the rule. */}
                    <span className="chart chart-sparkline" {...ins('chart-sparkline')}>
                      <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <polyline className="chart-path" points={poly(series, 100)} style={{ stroke: `var(--chart-${tone})` }} />
                      </svg>
                    </span>
                  </td>
                  <td className="num-col amount figure" {...txt('body-sm')}>{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Spec>
      </div>

      </div>

      {/* ══ 3. THE SITUATIONS ══
          Not chart types. Shapes no sample ever has, and each is a decision
          somebody will otherwise invent. */}
      <div className="stack">
        <div className="page-header">
        <div className="row row-wrap page-head">
          <div className="page-title"><h3 {...txt('h4')}>{L('Situations')}</h3></div>
          <p className="muted small page-sub" {...txt('body-sm', 'text-muted')}>
            Where a chart spec fails. None of these is a chart type.
          </p>
        </div>
      </div>

      <div className="cols-2">
        {/* THE ONLY CONSUMER OF `--chart-div-1..8`, and the reason a zero line
            is not a gridline. A diverging chart needs one, and it carries the
            axis weight because it IS the axis, moved off the floor. */}
        <Spec txt={txt} ins={ins} title={L('Crossing zero')} note="A zero line, at axis weight.">
          <div className="chart chart-column" {...ins('chart-column')}
            role="img" aria-label="Net movement by month, April to September, crossing zero in July">
            <div className="chart-frame">
              <div className="chart-ticks" {...txt('caption', 'text-muted')}>
                {['40', '20', '0', '-20'].map(t => <span className="chart-tick figure" key={t}>{t}</span>)}
              </div>
              <div className="chart-plot" style={{ '--ch-grid-n': 3 }}>
                <div className="chart-grid" />
                <div className="chart-cols" style={{ alignItems: 'stretch' }}>
                  {DIVERGE.map((v, i) => (
                    <div key={i} className="chart-diverge">
                      <span className="chart-diverge-up" style={{ height: `${(Math.max(v, 0) / 60) * 100}%` }}>
                        {v > 0 && <span className="chart-col" style={{ display: 'block', height: '100%', background: 'var(--chart-div-7)' }} />}
                      </span>
                      <span className="chart-zero" />
                      <span className="chart-diverge-down" style={{ height: `${(Math.max(-v, 0) / 60) * 100}%` }}>
                        {v < 0 && <span className="chart-col" style={{ display: 'block', height: '100%', background: 'var(--chart-div-2)' }} />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="chart-cats">{MONTHS.map(m => <span key={m} className="chart-tick">{m}</span>)}</div>
            </div>
          </div>
        </Spec>

        {/* NO RESULTS OFFERS A WAY BACK, never a way forward. There is data;
            the filter excluded it. "Create" is the answer to a different
            question. */}
        <Spec txt={txt} ins={ins} title={L('No results')} note="The filter excluded it. Offer BACK.">
          {/* NO `role="img"` HERE, DELIBERATELY, and it is the one chart on
              this surface that must not carry one. `role="img"` makes every
              child presentational, so it would silence the message and the
              button — the only two things in this card worth reading. A chart
              that offers an action is a state, not a picture of data. */}
          <div className="chart chart-column" {...ins('chart-column')}>
            <div className="chart-plot chart-blank">
              <div className="stack-sm" style={{ alignItems: 'center' }}>
                <strong {...txt('body-md')}>{L('No invoices in this period')}</strong>
                {/* `card-actions`, not a bare button. An action stands 16px
                    clear of the text that explains it, and this stack
                    publishes 12. The class makes up the 4. */}
                <div className="row card-actions">
                  <button className="btn btn-secondary btn-sm" {...ins('button-secondary')}>{L('Clear the filter')}</button>
                </div>
              </div>
            </div>
          </div>
        </Spec>

        {/* A LOADING STATE HOLDS THE SHAPE OF WHAT IS COMING, never a spinner.
            A spinner takes no room, so the page assembles under the reader's
            hands when it resolves. These bars are the heights the real bars
            will be, so nothing moves when the data lands. */}
        <Spec txt={txt} ins={ins} title={L('Loading')} note="The shape of what is coming.">
          <div className="chart chart-column" {...ins('chart-column')} role="status" aria-busy="true">
            <div className="chart-frame" aria-hidden="true">
              <Ticks txt={txt} steps={3} />
              <div className="chart-plot chart-axis-x" style={{ '--ch-grid-n': 3 }}>
                <div className="chart-grid" />
                <div className="chart-cols">
                  {RAISED.map((v, i) => (
                    <div className="skeleton" key={i} style={{ height: pct(v), borderRadius: 'var(--radius-sm, 2px)' }} />
                  ))}
                </div>
              </div>
              <div className="chart-cats">{MONTHS.map(m => <span key={m} className="chart-tick">{m}</span>)}</div>
            </div>
            <span className="caption" {...txt('caption', 'text-muted')}>{L('Loading invoices')}</span>
          </div>
        </Spec>

        {/* STATE THE LIMIT RATHER THAN CYCLING THE PALETTE. Five is what the
            scale publishes. A sixth series is a chart asking to be two charts,
            and a palette that wraps gives two series one colour. */}
        <Spec txt={txt} ins={ins} title={L('Too many series')} note="Five is the limit.">
          <div className="chart chart-stacked" {...ins('chart-stacked')}
            role="img" aria-label="Six series stacked, one more than the published scale holds">
            <Framed txt={txt} cats={MONTHS}>
              <div className="chart-cols">
                {MONTHS.map((m, i) => (
                  <div className="chart-col" key={m} style={{ height: pct(RAISED[i]) }}>
                    {[0.3, 0.24, 0.2, 0.14, 0.12].map((share, si) => (
                      <span className="chart-seg" key={si}
                        style={{ display: 'block', height: `${share * 100}%`, background: `var(--chart-${si + 1})` }} />
                    ))}
                  </div>
                ))}
              </div>
            </Framed>
            <Key items={LINES.map(L)} txt={txt} />
            <p className="caption" {...txt('caption', 'text-muted')}>
              {L('A sixth series has no colour. Split the chart.')}
            </p>
          </div>
        </Spec>

        {/* THE LONG CATEGORY NAME, which is the reason a horizontal bar chart
            exists at all. The label column takes its content and the bar
            shrinks. */}
        <Spec txt={txt} ins={ins} span title={L('A long category name')} note="The label wins. The bar shrinks.">
          <div className="chart chart-bar" {...ins('chart-bar')}
            role="img" aria-label="Revenue by line with one long name, five lines">
            <div className="chart-plot">
              <div className="chart-rows" style={{ '--ch-grid-n': 4, gridTemplateRows: 'repeat(4, auto)' }}>
                <div className="chart-grid" />
                {LONG.map(([name, v]) => (
                  <div key={name} style={{ display: 'contents' }}>
                    <span className="chart-row-label chart-tick">{name}</span>
                    <span className="chart-track">
                      <span className="chart-col" style={{ display: 'block', height: 20, width: pct(v, 40), background: 'var(--chart-1)' }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Spec>
        </div>
      </div>
    </div>
  )
}
