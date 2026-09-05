/* The application shell: a title bar, tab strips, and statistic tiles.
 *
 * These exist because two agents building a tool shell from the exported
 * package reported the same gap: the system defines `tab`, `tab-selected` and
 * `tab-disabled`, and no sample page showed a tab strip. A title bar and a stat
 * tile were missing the same way. A dashboard and a form are documents; chrome
 * is where the hard rules live.
 *
 * ── Written on the shared primitives, and that is the point of it ──
 *
 * The first four versions of this file hand-rolled every value: a fixed height,
 * then padding, then a 6/2 asymmetry, then a hand-set gap, then a heavier line
 * weight. Each was argued for in a comment. Each was arbitrary. The row came
 * out wrong four separate times and they caught all four in screenshots.
 *
 * `.row`, `.stack`, `.divider`, `.avatar`, `.badge`, `.btn` and `.card` already
 * carry this system's rhythm, and the Landing header is built from nothing else.
 * Reaching for an inline value is the signal that a primitive exists and I have
 * not looked for it.
 */
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, IconDownload } from '../icons.jsx'
import { stripStyle } from '../../state/components.js'

/* The tab strip.
 *
 * `--cmp-tab-*` are the component's own tokens, so the strip renders whatever
 * the Tab entry says. The two treatments differ on one axis: an underline sits
 * ON the strip's rule, a pill floats clear of it.
 *
 * The strip renders the treatment the document names, wherever it sits. A
 * promotion to the pill under a major rule was built and then rescinded on
 * sight. Do not reinstate it. */
function TabStrip({ ins, L, tabs, selected, style, label }) {
  const pill = stripStyle(style) === 'pill'
  return (
    <>
    {/* ── Too many tabs to fit: the strip becomes a dropdown ──
     *
     * Their rule, and it replaces the strip rather than shrinking it. A run of
     * destinations that does not fit is not a strip with a scrollbar bolted on;
     * it is a list, and a list you pick from is a select.
     *
     * Both are always in the markup and CSS shows one. It cannot be script: the
     * exported examples are static HTML, and a rule that only works in the
     * editor is a rule the payload cannot demonstrate.
     *
     * The select carries the same type tokens as a tab, so its text lands on
     * the strip's own baseline. That is the part they asked for by name. */}
    <div className="tab-select" data-label={label}>
      <select className="input" aria-label={label} defaultValue={selected}
        {...ins('tab-selected')}>
        {tabs.map(t => <option key={t} value={t}>{L(t)}</option>)}
      </select>
    </div>
    {/* A `nav` landmark, because a tab strip is navigation. The suite asserts
        this for any screen using `.nav-item`, and my first rewrite dropped it —
        a screen reader would have had a row of unlabelled spans. */}
    <nav className="row tab-strip" aria-label={label} style={{
      gap: 'var(--space-2xs)',
      /* A pill needs room above and below; an underline needs the rule it
         sits on. Nothing else here is mine to choose. */
      padding: pill ? 'var(--space-2xs) 0' : 0,
      borderBottom: pill ? 0 : '1px solid var(--c-border-subtle)',
    }}>
      {tabs.map(t => {
        const on = t === selected
        return (
          /* `aria-current` because the strip is a `nav`, so the chosen tab is
             a destination rather than a widget's selection. It is not
             decoration: the mark below is an inset shadow, and forced colors
             ignores box-shadow outright. Measured before this line existed —
             the selected tab carried no attribute and no class, so the
             forced-colors rule written for it matched nothing on any of the
             eleven surfaces and the tab lost its only marker. */
          <span key={t} className="nav-item" aria-current={on ? 'page' : undefined}
            {...ins(on ? 'tab-selected' : 'tab')} style={{
            fontWeight: on ? 500 : 400,
            ...(pill
              ? {
                color: on ? 'var(--c-accent)' : 'var(--c-text-muted)',
                background: on ? 'var(--c-accent-subtle)' : 'transparent',
              }
              : {
                background: 'transparent',
                color: on ? 'var(--c-text)' : 'var(--c-text-muted)',
                borderRadius: 0,
                /* An inset shadow, never a border: a border would make the
                   selected tab taller and push it past the strip's own rule. */
                boxShadow: on ? 'inset 0 -2px 0 var(--c-accent)' : 'none',
              }),
          }}>{L(t)}</span>
        )
      })}
    </nav>
    </>
  )
}

/* A statistic tile. Three lines, three type roles, so the hierarchy is real.
 * `rose` says which way the number moved. `good` says whether that is welcome.
 * Conflating them painted "Warnings −4" in the danger colour. */
function Stat({ ins, txt, L, label, value, delta, rose, good }) {
  return (
    /* `flex: 1` with `min-width: 0` let a tile shrink under its own label:
       "Warnings" needs 73px and had 34, so all three read as cut words. A tile
       grows to share the row and never goes under its content. The row wraps
       instead, which is the answer everywhere else in this system. */
    /* `.stat`, not `.stack-sm`. These are the tiles they pointed at: a label, a
       number and the change under it, and a uniform 12px gap put the change as
       far from its own value as the label was. The class states both distances
       — 4 above the number, 2 below it — so the change reads as part of the
       figure rather than as a third line. The same class does the same job on
       every other surface that shows a tile. */
    <div className="card stat" {...ins('card')} style={{ flex: '1 1 max-content', minWidth: 'max-content' }}>
      <div className="caption muted" {...txt('overline', 'text-muted')}
        style={{ textTransform: 'uppercase', letterSpacing: 'var(--font-overline-tracking)' }}>{L(label)}</div>
      <div className="stat-value" {...txt('h4')} style={{ fontSize: 'var(--font-h4-size)', fontWeight: 'var(--font-h4-weight)' }}>{value}</div>
      <div className="caption stat-delta" {...txt('caption', good ? 'success' : 'danger')}
        style={{ color: good ? 'var(--c-success)' : 'var(--c-danger)' }}>{rose ? '+' : '−'}{delta}</div>
    </div>
  )
}

/* The title bar, on the same four classes the Landing header uses.
 * `.row` is baseline-aligned with an `xs` gap; `.avatar`, `.badge` and `.btn`
 * are the components. No value below is invented. */
function TitleBar({ ins, txt, L }) {
  return (
    <div className="row row-wrap title-bar" style={{ justifyContent: 'space-between' }}>
      {/* The identity and its metadata are two things, not four items.
       *
       * At 296px "Saved 2m ago" wrapped to two lines — 39.9px against a
       * 19.97px line height — and the whole bar grew around it. A title row
       * keeps the title and whatever mark sits beside it. Everything that only
       * describes the title drops to a line of its own underneath.
       *
       * `.title-meta` is `display: contents` at wide widths, so the four items
       * stay one baseline-aligned row exactly as before. */}
      <div className="row title-row">
        <div className="avatar" {...ins('avatar')}>MD</div>
        <strong {...txt('body-md', 'text')}>Northwind</strong>
        <span className="title-meta">
          <span className="badge badge-neutral" {...ins('badge-neutral')}>draft</span>
          <span className="caption muted" {...txt('caption', 'text-muted')}>Saved 2m ago</span>
        </span>
      </div>
      <div className="row">
        <button className="btn btn-secondary btn-sm" {...ins('button-secondary')}>{L('Import')}</button>
        <button className="btn btn-secondary btn-sm" {...ins('button-secondary')}>{L('Export')}</button>
        <button className="btn btn-primary btn-sm" {...ins('button-primary')}>
          <Ico d={IconDownload} size="sm" />{L('Publish')}
        </button>
      </div>
    </div>
  )
}

export default function Shell({ onInspect, tabStyle, casing }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  return (
    /* `.stack` supplies the rhythm, exactly as it does on Landing: the divider
       carries no margin of its own, so the stack's gap sits it inside a
       symmetric space. Nothing here sets a number. */
    <div className="stack">
      <TitleBar ins={ins} txt={txt} L={L} />
      <hr className="divider" />

      {/* Two panes, separated by space. A border between them read as one bar
          cut in half by a divider, when they are two independent strips over
          two independent panes.

          The gutter is a step of its own, not the row's. `.row` gives 8px, and
          the tabs inside each strip sit 4px apart: two to one, so the two
          strips read as one long strip. Proximity is a ratio and it wants more
          than three to one.

          The gutter is now `2xl`, not `lg`, because 24 was chosen against the
          strips' 4px and never checked against the PANES. Those are `.stack` at
          16, where 24 reads 1.5:1 — one value answering two relationships with
          different bars. 48 clears both: 3.0:1 against the panes, 12:1 against
          the strips.

          `stack-narrow` because raising the gutter took its 24px out of the
          content pane, and this split never stopped being a row. It squeezed
          instead: measured 104.8 and 109.2 at a 296px frame, a rail and a
          content column of the same width. Squeezing is not responding. Below
          `sm` it becomes one column and the content pane gets the full 262. */}
      <div className="shell-split row stack-narrow">
        {/* 40, not 46. The right column carries three tiles and the left
            carries one card, so an even-handed split starves the side with
            more in it: the tiles came out 4.4px short of fitting and wrapped
            two-and-one at every width. Measured after: 390px against the 356px
            the three tiles need.

            A CUSTOM PROPERTY, not a bare 40%. Once the split stacks, this pane
            is alone on its line and an orphan takes the whole line — and a
            container query cannot reach an inline style at all, so a plain
            `width: 40%` left it 104.8px wide in a 262px column. The property is
            reachable, so the narrow branch sets it to 100% in the stylesheet
            beside every other collapse rule. */}
        <div className="stack" style={{ width: 'var(--split-left, 40%)', minWidth: 0 }}>
          {/* Four, not five. Five overflowed the pane by 24px and scrolled. */}
          <TabStrip ins={ins} L={L} style={tabStyle} selected="Colour" label="Editor sections"
            tabs={['Meta', 'Colour', 'Type', 'Layout']} />

          <div className="card stack-sm" {...ins('card')}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong {...txt('h6')} style={{ fontSize: 'var(--font-h6-size)' }}>{L('Seeds')}</strong>
              <span className="badge badge-neutral" {...ins('badge-neutral')}>5</span>
            </div>
            {/* A separator goes above each row, never below, so the last row
                ends clean against the card's own border. */}
            {['accent', 'success', 'danger'].map((n, i) => (
              <div key={n} className="row" style={{
                justifyContent: 'space-between',
                borderTop: i === 0 ? 0 : '1px solid var(--c-border-subtle)',
                paddingTop: i === 0 ? 0 : 'var(--space-xs)',
              }}>
                <span className="small" {...txt('body-sm')}>{n}</span>
                {/* No colour fallback. A missing role must paint nothing and be
                    noticed, rather than a grey nobody chose. */}
                <span className="swatch" {...ins(n)} style={{
                  width: 44, height: 16, alignSelf: 'center',
                  background: `var(--c-${n})`,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--c-border-subtle)',
                }} />
              </div>
            ))}
          </div>
        </div>

        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <TabStrip ins={ins} L={L} style={tabStyle} selected="Dashboard" label="Preview surfaces" tabs={['Dashboard', 'Form', 'Settings']} />
          {/* The tiles wrap rather than clip. `.row` only wraps once the FRAME
              is narrow, and this pane is narrow inside a wide frame — the
              container is the wrong size to ask. */}
          <div className="row row-wrap" style={{ alignItems: 'stretch', flexWrap: 'wrap' }}>
            <Stat ins={ins} txt={txt} L={L} label="Tokens"   value="284"   delta="12"  rose good />
            <Stat ins={ins} txt={txt} L={L} label="Contrast" value="4.9:1" delta="0.3" rose good />
            {/* Fell by four, and that is the good direction. */}
            <Stat ins={ins} txt={txt} L={L} label="Warnings" value="0"     delta="4"   rose={false} good />
          </div>
        </div>
      </div>
    </div>
  )
}
