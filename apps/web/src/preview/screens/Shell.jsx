/* The application shell: a title bar, tab strips, and a row of statistic
   tiles.
 *
 * These three exist because two independent agents building a tool shell from
 * the exported package reported the same gap: the system DEFINES `tab`,
 * `tab-selected` and `tab-disabled`, and not one of the twelve sample pages
 * showed a tab strip anywhere. One of them put it plainly — the component the
 * job most needed a reference for had no worked example. A title bar and a
 * stat tile were missing the same way.
 *
 * A dashboard, a form and a settings list are documents. A tool shell is
 * chrome, and chrome is where the hard rules live: one baseline across runs of
 * five different sizes, a structural rule against a subtle one, an underline
 * that adds no height. None of that is visible on a page of paragraphs.
 *
 * This surface is a specification, not a thumbnail. Every rule the payload
 * states about a title bar is obeyed here on purpose, because whatever renders
 * wrongly here is what every consumer copies. */
import { inspectProps, text } from '../inspect.js'
import { Ico, IconPlus, IconDownload, IconBell, IconMore } from '../icons.jsx'

/* `inspectProps` returns click-to-inspect metadata and NO style — deliberately,
   because a `style` key in a spread replaces the element's own style object and
   once dropped the font sizes off every heading. So `{...txt('caption')}` marks
   a run as caption-coloured for the inspector and applies not one typographic
   property.
 *
 * I built this whole surface on that misreading. Every run inherited body size:
 * a caption timestamp rendered at 16px beside a 12.8px chip, and a stat's label
 * and its value came out identical, which is the one thing a stat tile must
 * never do. The baselines I measured were genuinely aligned, so the check I ran
 * passed while the type was wrong everywhere — I measured the row I was working
 * on rather than the screen.
 *
 * `typeRun` is the fix and the guard: it returns the tokens AND the inspect
 * props from one call, so a run of text in this file cannot be marked without
 * also being styled. */
const TYPE_TOKENS = name => ({
  fontFamily: `var(--font-${name}-family, inherit)`,
  fontSize: `var(--font-${name}-size, 1rem)`,
  fontWeight: `var(--font-${name}-weight, 400)`,
  lineHeight: `var(--font-${name}-leading, normal)`,
  letterSpacing: `var(--font-${name}-tracking, normal)`,
})

/* Every run of text on the bar sits on ONE line, and the line is chosen rather
   than inherited. The row is mostly words, so it takes `baseline`; the boxes
   in it opt in with the line-box technique so they donate their label's
   baseline instead of hiding it inside a flex centre. */
const BAR_H = 44

/* A fixed-height box that still hands its label to the row. Flex centring
   positions the glyphs and tells the row nothing about where they landed, so
   a mark built that way lands on no line at all. `line-height` two under the
   height accounts for the two borders under `box-sizing: border-box`. */
function Mark({ ins, children }) {
  return (
    <span {...ins('avatar')} style={{
      /* 32, matching the buttons beside it. The sweep read the row as
         30, 18, 32, 32, 32 — a mark two pixels under every control it sits
         with, which is the same defect this project's own chrome shipped
         three times. A mark in a control row takes the row's height.
         `minWidth` with `width`, or a squeezed row takes it back and the
         square becomes a rectangle wearing a square's radius. */
      display: 'inline-block', width: 32, minWidth: 32, height: 32,
      /* A transparent border, so the mark's content box matches the buttons'.
         Both are 32px outer, but a button has 1px borders and this did not —
         so `line-height: 30` sized the line against 30px of content there and
         32px here, and the two boxes landed 1px apart in the same baseline row
         at identical heights. Height, borders and line-height are one
         decision. */
      border: '1px solid transparent',
      lineHeight: '30px', textAlign: 'center', alignSelf: 'baseline',
      background: 'var(--c-accent, #333)', color: 'var(--c-accent-fg, #fff)',
      borderRadius: 'var(--radius-md, 6px)',
      fontFamily: 'var(--font-caption-family, inherit)',
      fontSize: 'var(--font-caption-size, 12px)', fontWeight: 700,
      letterSpacing: '0.02em',
    }}>{children}</span>
  )
}

function BarButton({ ins, primary, children }) {
  const name = primary ? 'button-primary' : 'button-ghost'
  return (
    <button className={'btn ' + (primary ? 'btn-primary' : 'btn-ghost')} {...ins(name)} style={{
      /* inline-block, not flex: the label is centred by the line box AND is
         the element's baseline, so the button sits on the bar's line. */
      display: 'inline-block', height: 32, lineHeight: '30px', padding: '0 12px',
      alignSelf: 'baseline', whiteSpace: 'nowrap',
      borderRadius: 'var(--cmp-button-rounded, var(--radius-md, 6px))',
      fontFamily: 'var(--cmp-button-font-family, inherit)',
      fontSize: 'var(--cmp-button-font-size, 13px)',
      fontWeight: 'var(--cmp-button-font-weight, 500)',
      background: primary ? 'var(--c-accent, #333)' : 'transparent',
      color: primary ? 'var(--c-accent-fg, #fff)' : 'var(--c-text-muted, #666)',
      border: primary ? '1px solid transparent' : '1px solid var(--c-border, #ccc)',
      cursor: 'pointer',
    }}>{children}</button>
  )
}

function TitleBar({ ins, txt }) {
  return (
    <div {...ins('surface')} style={{
      /* Padding, never a fixed height.
       *
       * This had `height: 44` with `align-items: baseline`, and baseline
       * alignment packs to cross-start — so the whole group sat against the top
       * edge and every pixel of slack fell underneath. Measured: 8px above the
       * cap tops against 23px below the baseline, and every control at top 0
       * with 12px beneath it.
       *
       * The payload states this rule and I broke it here. Symmetric padding
       * round the tallest item gives the same 44px and puts it in the middle:
       * a 32px button plus 6 above and 6 below. */
      display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm, 12px)',
      /* Deliberately unequal, and judged by the result rather than the
         symmetry. Equal padding left the ink 2px above the bar's centre,
         because a line box reserves descender space the words never use.
         Candidates measured in the page at 4/4, 5/3, 6/4, 6/2, 7/3 and 8/4:
         6/2 is the first that reads 0.00 without changing the height. Do not
         "tidy" this back to symmetric — that restores the fault. */
      padding: 'calc(var(--space-2xs, 4px) + 2px) var(--space-md, 16px) calc(var(--space-2xs, 4px) - 2px)',
      /* No fill of its own.
       *
       * It was `surface`, which in a light system is near-white against a grey
       * page — a bright slab floating over the shell for no stated reason. A
       * different background has to earn itself by meaning something: a card
       * is raised, a well is recessed. A title bar is neither. It is the top
       * of the page, so it takes the page, and its lower rule does the
       * separating on its own. */
      background: 'transparent',
      /* A title bar's lower edge defines the structure of the page, so it
         takes `border`, not `border-subtle`. */
      borderBottom: '1px solid var(--c-border, #ccc)',
    }}>
      <Mark ins={ins}>MD</Mark>
      <span {...txt('h6')} style={{ ...TYPE_TOKENS('h6'), alignSelf: 'baseline', color: 'var(--c-text, #111)' }}>Northwind</span>
      {/* A chip beside a heading is a box on a line of words, so it takes the
          line-box technique: its label is centred AND is the chip's baseline.
          `line-height` is stated with the height it belongs to, never apart
          from it. */}
      <span className="badge" {...ins('badge-neutral')} style={{
        ...TYPE_TOKENS('caption'),
        display: 'inline-block', alignSelf: 'baseline', height: 18, lineHeight: '18px',
        padding: '0 var(--space-2xs, 6px)',
        borderRadius: 'var(--radius-sm, 4px)',
        background: 'var(--c-bg-subtle, #eee)', color: 'var(--c-text-muted, #666)',
      }}>draft</span>
      <span {...txt('caption', 'text-muted')} style={{
        ...TYPE_TOKENS('caption'), alignSelf: 'baseline', color: 'var(--c-text-muted, #666)',
      }}>Saved 2m ago</span>
      <span style={{ flex: 1 }} />
      <BarButton ins={ins}>Import</BarButton>
      <BarButton ins={ins}>Export</BarButton>
      <BarButton ins={ins} primary><Ico d={IconDownload} />Publish</BarButton>
    </div>
  )
}

/* The tab strip. The selected tab is marked by an underline and nothing else —
   no fill — because a fill inside a strip competes with the strip's own rule.
   The underline is an inset shadow, so it adds no height and cannot push the
   tab past the rule it sits on. A border would do both. */
function TabStrip({ ins, tabs, selected, style }) {
  const pill = style === 'pill'
  return (
    <div style={{
      display: 'flex', gap: 'var(--space-2xs, 4px)',
      /* A pill floats, so it needs vertical room and no rule to sit on. An
         underline needs the rule, because the mark IS on that line. */
      /* The left edge of the pane is one line, and the strip was the only
         thing off it. Measured down the pane: mark 41, first tab 37, card 41,
         and the tab's label at 49 — four things, three positions, nothing
         agreeing with anything.
         An inactive tab has no visible box, so what a reader sees is its
         LABEL. Inset the container by the content step minus the tab's own
         padding, and the label lands on the column. A pill does have a visible
         box, so its fill takes the content step directly. */
      padding: pill
        ? 'var(--space-2xs, 4px) var(--space-md, 16px)'
        : '0 calc(var(--space-md, 16px) - var(--space-sm, 12px))',
      borderBottom: pill ? 0 : '1px solid var(--c-border, #ccc)',
      /* No sideways scroller.
         It had `overflowX: auto`, and the left strip overflowed its pane by
         24px — so five tabs became four tabs and a scrollbar, with the fifth
         clipped. This project's own payload says a run of items never scrolls
         sideways as the lazy answer, and a scroller hides the failure instead
         of showing it. A strip that does not fit is a strip with too many
         tabs, and here that was mine to fix. */
      minWidth: 0,
    }}>
      {tabs.map(t => {
        const on = t === selected
        return (
          <span key={t} {...ins(on ? 'tab-selected' : 'tab')} style={{
            /* The tab's height comes from the line box alone. It used to take
               the component's full padding AND a 34px line height, so an 8px
               pad sat above and below a 34px box: a 50px tab with the word
               floating in the middle and a wide empty band under it before the
               rule. Height belongs to one property, not two. */
            display: 'inline-block', lineHeight: pill ? '26px' : '30px', whiteSpace: 'nowrap',
            padding: '0 var(--space-sm, 12px)',
            fontFamily: 'var(--cmp-tab-font-family, inherit)',
            fontSize: 'var(--cmp-tab-font-size, 13px)',
            fontWeight: on ? 500 : 400,
            ...(pill
              ? {
                borderRadius: 'var(--radius-md, 6px)',
                color: on ? 'var(--c-accent, #333)' : 'var(--c-text-muted, #666)',
                background: on ? 'var(--c-accent-subtle, #eee)' : 'transparent',
              }
              : {
                color: on ? 'var(--c-text, #111)' : 'var(--c-text-muted, #666)',
                /* An inset shadow, never a border: 2px of border would make the
                   tab 2px taller and push it past the rule the mark sits on. */
                boxShadow: on ? 'inset 0 -2px 0 var(--c-accent, #333)' : 'none',
              }),
            cursor: 'pointer',
          }}>{t}</span>
        )
      })}
    </div>
  )
}

/* A statistic tile. The delta carries a sign as well as a colour, because
   meaning must never rest on colour alone. */
/* `good` and `rose` are two different questions, and conflating them painted
   "Warnings −4" in the danger colour — fewer warnings reported as bad news.
   The arrow says which way the number moved. The colour says whether that is
   welcome. For most metrics they agree; for a count of problems they invert,
   and that is exactly the tile a reader checks first. */
function Stat({ ins, txt, label, value, delta, rose, good }) {
  return (
    <div className="card" {...ins('card')} style={{
      flex: 1, minWidth: 0,
      padding: 'var(--cmp-card-padding, var(--space-md, 16px))',
      background: 'var(--cmp-card-background-color, var(--c-surface, #fff))',
      border: '1px solid var(--c-border-subtle, #eee)',
      borderRadius: 'var(--cmp-card-rounded, var(--radius-lg, 12px))',
    }}>
      {/* Three sizes, three weights, three colours. The label, the value and
          the delta had none of them applied and came out identical, which
          leaves a tile with no hierarchy at all — the one thing a stat tile
          exists to have. `overline` carries its own tracking and uppercase. */}
      <div {...txt('overline', 'text-muted')} style={{
        ...TYPE_TOKENS('overline'),
        textTransform: 'uppercase', color: 'var(--c-text-muted, #666)',
      }}>{label}</div>
      <div {...txt('h4')} style={{
        ...TYPE_TOKENS('h4'),
        color: 'var(--c-text, #111)', margin: 'var(--space-2xs, 6px) 0 2px',
      }}>{value}</div>
      {/* The sign carries the direction and the colour carries the judgement,
          so nothing rests on colour alone and neither says the other's job. */}
      <div {...txt('caption', good ? 'success' : 'danger')} style={{
        ...TYPE_TOKENS('caption'),
        color: good ? 'var(--c-success, #2a7)' : 'var(--c-danger, #c33)',
      }}>{rose ? '+' : '−'}{delta}</div>
    </div>
  )
}

export default function Shell({ onInspect, layout, tabStyle }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TitleBar ins={ins} txt={txt} />

      {/* Two panes, separated by space rather than a line.
       *
       * The left pane carried a right border, so the two tab strips read as ONE
       * bar cut in half by a divider — two groups of tabs pretending to be a
       * single control. They are two independent strips over two independent
       * panes. A gap says that; a line says the opposite.
       *
       * The row also had no vertical breathing room at all: the strips sat
       * flush against the title bar above and the content below. */}
      <div className="shell-split" style={{
        display: 'flex', gap: 'var(--space-md, 16px)', minHeight: 0,
        padding: 'var(--space-sm, 12px) var(--space-md, 16px) 0',
      }}>
        <div style={{ width: '46%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Four, not five. Five needed 358px in a 334px pane. */}
          <TabStrip ins={ins} style={tabStyle} selected="Colour"
            tabs={['Meta', 'Colour', 'Type', 'Layout']} />
          <div style={{ padding: 'var(--space-md, 16px) 0', flex: 1 }}>
            <div className="card" {...ins('card')} style={{
              padding: 'var(--cmp-card-padding, var(--space-md, 16px))',
              background: 'var(--cmp-card-background-color, var(--c-surface, #fff))',
              border: '1px solid var(--c-border-subtle, #eee)',
              borderRadius: 'var(--cmp-card-rounded, var(--radius-lg, 12px))',
            }}>
              {/* A heading and its count chip share one line. */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm, 12px)', marginBottom: 'var(--space-xs, 8px)' }}>
                <span {...txt('h6')} style={{ ...TYPE_TOKENS('h6'), color: 'var(--c-text, #111)' }}>Seeds</span>
                <span style={{ flex: 1 }} />
                {/* `align-self: baseline` explicitly. The `.badge` class in the
                    preview stylesheet sets `flex-start`, which pins the chip to
                    the top of the row and takes it out of the baseline set —
                    the sweep measured both tops at 309 and the baselines 6.00px
                    apart. A chip beside a heading sits on the heading's line. */}
                <span className="badge" {...ins('badge-neutral')} style={{
                  ...TYPE_TOKENS('caption'),
                  display: 'inline-block', alignSelf: 'baseline',
                  height: 18, lineHeight: '18px', padding: '0 var(--space-2xs, 6px)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: 'var(--c-bg-subtle, #eee)', color: 'var(--c-text-muted, #666)',
                }}>5</span>
              </div>
              {/* A separator sits ABOVE each row, never below, so the last row
                  ends clean against the card's own border. */}
              {/* Each row draws its own role, so the three differ and they
                  track the document. They were three hard-coded `#dc9055`
                  strings — a colour tool showing three seeds as one colour,
                  which is a picture of a system nobody has. A swatch is also
                  the honest control here: a hex typed into a sample is a
                  value from nowhere. */}
              {/* Three roles that exist. The middle row said `neutral` and drew
                  `var(--c-neutral, #999)` — there is no `neutral` role, only a
                  neutral ramp, so the swatch rendered the #999 fallback and
                  looked like a considered grey. A fallback is how a missing
                  token stays invisible: the rule does not fail, it just paints
                  a value from nowhere. Measuring the FIX caught it; measuring
                  only the fault would not have. */}
              {['accent', 'success', 'danger'].map((n, i) => (
                <div key={n} style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  gap: 'var(--space-sm, 12px)',
                  padding: 'var(--space-xs, 8px) 0',
                  borderTop: i === 0 ? 0 : '1px solid var(--c-border-subtle, #eee)',
                }}>
                  <span {...txt('body-sm')} style={{ ...TYPE_TOKENS('body-sm'), color: 'var(--c-text, #111)' }}>{n}</span>
                  {/* A swatch has no text, so it has no baseline of its own and
                      would sit on its bottom edge in a baseline row. `alignSelf`
                      takes it out of the baseline set and centres it on the
                      row's own line instead. */}
                  {/* No colour fallback. If the role ever stops existing the
                      swatch must render as nothing and be noticed, rather than
                      quietly painting a grey nobody chose. */}
                  <span {...ins(n)} style={{
                    width: 44, height: 14, flexShrink: 0, alignSelf: 'center',
                    borderRadius: 'var(--radius-sm, 3px)',
                    background: `var(--c-${n})`,
                    border: '1px solid var(--c-border-subtle, #eee)',
                  }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TabStrip ins={ins} style={tabStyle} selected="Dashboard" tabs={['Dashboard', 'Form', 'Settings']} />
          <div style={{ padding: 'var(--space-md, 16px) 0', flex: 1 }}>
            <div className="stat-row" style={{ display: 'flex', gap: 'var(--space-sm, 12px)' }}>
              <Stat ins={ins} txt={txt} label="Tokens"   value="284"   delta="12"  rose good />
              <Stat ins={ins} txt={txt} label="Contrast" value="4.9:1" delta="0.3" rose good />
              {/* Fell by four, and that is the good direction. */}
              <Stat ins={ins} txt={txt} label="Warnings" value="0"     delta="4"   rose={false} good />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
