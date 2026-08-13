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
import { Ico, IconDownload } from '../icons.jsx'
import { stripStyle } from '../../state/components.js'

/* The tab strip.
 *
 * `--cmp-tab-*` are the component's own tokens, so the strip renders whatever
 * the Tab entry says. The two treatments differ on one axis: an underline sits
 * ON the strip's rule, a pill floats clear of it.
 *
 * `underRule` says a major rule sits directly above. `stripStyle` then promotes
 * an underline to a pill, because two rules that close together read as one
 * doubled line. The Tab entry in the Components panel shows the chosen
 * treatment untouched, so the selector still previews what it selects. */
function TabStrip({ ins, tabs, selected, style, label, underRule }) {
  const pill = stripStyle(style, underRule) === 'pill'
  return (
    /* A `nav` landmark, because a tab strip is navigation. The suite asserts
       this for any screen using `.nav-item`, and my first rewrite dropped it —
       a screen reader would have had a row of unlabelled spans. */
    <nav className="row" aria-label={label} style={{
      gap: 'var(--space-2xs)',
      /* A pill needs room above and below; an underline needs the rule it
         sits on. Nothing else here is mine to choose. */
      padding: pill ? 'var(--space-2xs) 0' : 0,
      borderBottom: pill ? 0 : '1px solid var(--c-border-subtle)',
    }}>
      {tabs.map(t => {
        const on = t === selected
        return (
          <span key={t} className="nav-item" {...ins(on ? 'tab-selected' : 'tab')} style={{
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
          }}>{t}</span>
        )
      })}
    </nav>
  )
}

/* A statistic tile. Three lines, three type roles, so the hierarchy is real.
 * `rose` says which way the number moved. `good` says whether that is welcome.
 * Conflating them painted "Warnings −4" in the danger colour. */
function Stat({ ins, txt, label, value, delta, rose, good }) {
  return (
    <div className="card stack-sm" {...ins('card')} style={{ flex: 1, minWidth: 0 }}>
      <div className="caption muted" {...txt('overline', 'text-muted')}
        style={{ textTransform: 'uppercase', letterSpacing: 'var(--font-overline-tracking)' }}>{label}</div>
      <div {...txt('h4')} style={{ fontSize: 'var(--font-h4-size)', fontWeight: 'var(--font-h4-weight)' }}>{value}</div>
      <div className="caption" {...txt('caption', good ? 'success' : 'danger')}
        style={{ color: good ? 'var(--c-success)' : 'var(--c-danger)' }}>{rose ? '+' : '−'}{delta}</div>
    </div>
  )
}

/* The title bar, on the same four classes the Landing header uses.
 * `.row` is baseline-aligned with an `xs` gap; `.avatar`, `.badge` and `.btn`
 * are the components. No value below is invented. */
function TitleBar({ ins, txt }) {
  return (
    <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
      <div className="row">
        <div className="avatar" {...ins('avatar')}>MD</div>
        <strong {...txt('body-md', 'text')}>Northwind</strong>
        <span className="badge badge-neutral" {...ins('badge-neutral')}>draft</span>
        <span className="caption muted" {...txt('caption', 'text-muted')}>Saved 2m ago</span>
      </div>
      <div className="row">
        <button className="btn btn-secondary btn-sm" {...ins('button-secondary')}>Import</button>
        <button className="btn btn-secondary btn-sm" {...ins('button-secondary')}>Export</button>
        <button className="btn btn-primary btn-sm" {...ins('button-primary')}>
          <Ico d={IconDownload} size="sm" />Publish
        </button>
      </div>
    </div>
  )
}

export default function Shell({ onInspect, tabStyle }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  return (
    /* `.stack` supplies the rhythm, exactly as it does on Landing: the divider
       carries no margin of its own, so the stack's gap sits it inside a
       symmetric space. Nothing here sets a number. */
    <div className="stack">
      <TitleBar ins={ins} txt={txt} />
      <hr className="divider" />

      {/* Two panes, separated by space. A border between them read as one bar
          cut in half by a divider, when they are two independent strips over
          two independent panes. */}
      <div className="shell-split row" style={{ alignItems: 'stretch' }}>
        <div className="stack" style={{ width: '46%', minWidth: 0 }}>
          {/* Four, not five. Five overflowed the pane by 24px and scrolled. */}
          <TabStrip ins={ins} style={tabStyle} underRule selected="Colour" label="Editor sections"
            tabs={['Meta', 'Colour', 'Type', 'Layout']} />

          <div className="card stack-sm" {...ins('card')}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong {...txt('h6')} style={{ fontSize: 'var(--font-h6-size)' }}>Seeds</strong>
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
                  width: 44, height: 14, alignSelf: 'center',
                  background: `var(--c-${n})`,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--c-border-subtle)',
                }} />
              </div>
            ))}
          </div>
        </div>

        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <TabStrip ins={ins} style={tabStyle} underRule selected="Dashboard" label="Preview surfaces" tabs={['Dashboard', 'Form', 'Settings']} />
          <div className="row" style={{ alignItems: 'stretch' }}>
            <Stat ins={ins} txt={txt} label="Tokens"   value="284"   delta="12"  rose good />
            <Stat ins={ins} txt={txt} label="Contrast" value="4.9:1" delta="0.3" rose good />
            {/* Fell by four, and that is the good direction. */}
            <Stat ins={ins} txt={txt} label="Warnings" value="0"     delta="4"   rose={false} good />
          </div>
        </div>
      </div>
    </div>
  )
}
