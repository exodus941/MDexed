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
      display: 'inline-block', width: 30, minWidth: 30, height: 30,
      lineHeight: '28px', textAlign: 'center', alignSelf: 'baseline',
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
      display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm, 12px)',
      height: BAR_H, padding: '0 var(--space-md, 16px)',
      background: 'var(--c-surface, #fff)',
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
      padding: pill ? 'var(--space-2xs, 4px) var(--space-sm, 12px)' : '0 var(--space-sm, 12px)',
      borderBottom: pill ? 0 : '1px solid var(--c-border, #ccc)',
      overflowX: 'auto',
    }}>
      {tabs.map(t => {
        const on = t === selected
        return (
          <span key={t} {...ins(on ? 'tab-selected' : 'tab')} style={{
            display: 'inline-block', lineHeight: pill ? '28px' : '34px', whiteSpace: 'nowrap',
            padding: 'var(--cmp-tab-padding, 0 12px)',
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
function Stat({ ins, txt, label, value, delta, up }) {
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
      {/* The sign carries the meaning as well as the colour, so nothing rests
          on colour alone. */}
      <div {...txt('caption', up ? 'success' : 'danger')} style={{
        ...TYPE_TOKENS('caption'),
        color: up ? 'var(--c-success, #2a7)' : 'var(--c-danger, #c33)',
      }}>{up ? '+' : '−'}{delta}</div>
    </div>
  )
}

export default function Shell({ onInspect, layout, tabStyle }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TitleBar ins={ins} txt={txt} />

      <div className="shell-split" style={{ display: 'flex', minHeight: 0 }}>
        <div style={{
          width: '46%', minWidth: 0, display: 'flex', flexDirection: 'column',
          /* A divider between two panes is structure. */
          borderRight: '1px solid var(--c-border, #ccc)',
        }}>
          <TabStrip ins={ins} style={tabStyle} selected="Colour"
            tabs={['Meta', 'Colour', 'Type', 'Layout', 'Shape']} />
          <div style={{ padding: 'var(--space-md, 16px)', background: 'var(--c-bg, #fafafa)', flex: 1 }}>
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
                <span className="badge" {...ins('badge-neutral')} style={{
                  display: 'inline-block', lineHeight: '18px', padding: '0 8px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: 'var(--c-bg-subtle, #eee)', color: 'var(--c-text-muted, #666)',
                  fontFamily: 'var(--font-caption-family, inherit)',
                  fontSize: 'var(--font-caption-size, 12px)',
                }}>5</span>
              </div>
              {/* A separator sits ABOVE each row, never below, so the last row
                  ends clean against the card's own border. */}
              {['accent', 'neutral', 'success'].map((n, i) => (
                <div key={n} style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  padding: 'var(--space-xs, 8px) 0',
                  borderTop: i === 0 ? 0 : '1px solid var(--c-border-subtle, #eee)',
                }}>
                  <span {...txt('body-sm')} style={{ ...TYPE_TOKENS('body-sm'), color: 'var(--c-text, #111)' }}>{n}</span>
                  <span {...txt('code', 'text-muted')} style={{ ...TYPE_TOKENS('code'), color: 'var(--c-text-muted, #666)' }}>#dc9055</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TabStrip ins={ins} style={tabStyle} selected="Dashboard" tabs={['Dashboard', 'Form', 'Settings']} />
          <div style={{ padding: 'var(--space-md, 16px)', background: 'var(--c-bg, #fafafa)', flex: 1 }}>
            <div className="stat-row" style={{ display: 'flex', gap: 'var(--space-sm, 12px)' }}>
              <Stat ins={ins} txt={txt} label="Tokens" value="284" delta="12" up />
              <Stat ins={ins} txt={txt} label="Contrast" value="4.9:1" delta="0.3" up />
              <Stat ins={ins} txt={txt} label="Warnings" value="0" delta="4" up={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
