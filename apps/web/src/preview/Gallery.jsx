/* Every component in every variant, size and state, side by side.
   Hover and active are shown twice: as forced `.is-*` classes so all states
   are visible at once, and as genuinely interactive controls so transitions
   and focus rings can be felt rather than just looked at. */

import {
  Ico, Check, Switch,
  IconPlus, IconChevron, IconArrow, IconSearch, IconTrash, IconCheck,
  IconInfo, IconStar, IconFolder,
} from './icons.jsx'

export { inspectProps, cmp, role, type } from './inspect.js'
import { inspectProps, text } from './inspect.js'

/* The gallery's own scaffolding is drawn from the same tokens as everything
   else, so it's inspectable too — there is nothing on this surface that isn't
   answerable. */
function Section({ title, note, children, txt }) {
  return (
    /* `stack-lg`, NOT `stack-sm`. A section holding two grids kept them 28px
       apart while the cards inside sat 16 apart, which is 1.75:1 and under the
       three to one a group boundary needs. */
    /* `data-specimen` is the claim this section makes: its job is to put
       variants side by side. The proximity rule exempts a specimen sheet, and
       its check keyed on `.row-label`, which marks a specimen ROW rather than
       the sheet. Two findings here were the sheet doing its job. */
    <section className="stack-lg" data-specimen style={{ marginBottom: 'var(--space-2xl, 48px)' }}>
      <div>
        <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)' }} {...txt('h6')}>{title}</h3>
        {note && <p className="caption" style={{ marginTop: 2 }} {...txt('caption', 'text-muted')}>{note}</p>}
      </div>
      {children}
    </section>
  )
}

/* `row-label` is what the narrow-width rule keys on.
   Before it, the label took its own line only inside a `matrix-grid`, which is
   how GHOST and DANGER stood alone while LIVE and FILLED shared a line with
   whichever buttons happened to fit beside them. Same component, same job, two
   different layouts decided by an ancestor two levels up. The class puts the
   rule on the label itself, so every specimen row reads the same way. */
const Label = ({ children, txt }) => (
  <div className="caption row-label" style={{ minWidth: 76, textTransform: 'uppercase', letterSpacing: '.06em' }}
    {...txt('overline', 'text-muted')}>{children}</div>
)

export default function Gallery({ onInspect, layout }) {
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  const al = layout?.alert ?? {}
  const variants = ['primary', 'secondary', 'ghost', 'danger']
  const states = [
    { key: '', cls: '', label: 'default' },
    { key: 'hover', cls: 'is-hover', label: 'hover' },
    { key: 'active', cls: 'is-active', label: 'active' },
    { key: 'disabled', cls: 'is-disabled', label: 'disabled' },
  ]

  return (
    <div style={{ maxWidth: 820 }}>
      {onInspect && (
        <p className="caption" style={{ marginBottom: "var(--space-md, 16px)" }} {...txt("caption", "text-muted")}>
          Click any element to jump to its properties. Alt-click to interact with it instead.
        </p>
      )}

      <Section txt={txt} title="Buttons — variants × states" note="Forced states, so every combination is visible at once">
        <div className="stack-sm matrix matrix-grid">
          {variants.map(v => (
            <div className="row" key={v}>
              <Label txt={txt}>{v}</Label>
              {states.map(s => (
                <button key={s.label} className={`btn btn-${v} ${s.cls}`}
                  {...ins(s.key ? `button-${v}-${s.key}` : `button-${v}`)}>{s.label}</button>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section txt={txt} title="Buttons — sizes" note="Interactive: hover, click, and tab to see the focus ring">
        <div className="row">
          <Label txt={txt}>live</Label>
          <button className="btn btn-primary btn-sm" {...ins('button-sm')}>Small</button>
          <button className="btn btn-primary" {...ins('button-md')}>Medium</button>
          <button className="btn btn-primary btn-lg" {...ins('button-lg')}>Large</button>
          <button className="btn btn-secondary" {...ins('button-secondary')}>Secondary</button>
          <button className="btn btn-ghost" {...ins('button-ghost')}>Ghost</button>
        </div>
      </Section>

      <Section txt={txt} title="Buttons with icons" note="Leading, trailing, icon-only — spacing driven by the icon gap token">
        <div className="stack-sm matrix">
          <div className="row">
            <Label txt={txt}>filled</Label>
            <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconPlus} />New invoice</button>
            <button className="btn btn-primary" {...ins('button-primary')}>Continue<Ico d={IconArrow} end /></button>
            {/* `icon-only`, not a hand-rolled padding-and-width. The inline
                version reproduced the class's box and none of its centring, so
                this icon sat 4px left of the middle. */}
            <button className="btn btn-primary icon-only" {...ins('button-md')}><Ico d={IconPlus} /></button>
          </div>
          <div className="row">
            <Label txt={txt}>outline</Label>
            <button className="btn btn-secondary" {...ins('button-secondary')}><Ico d={IconSearch} />Search</button>
            <button className="btn btn-secondary" {...ins('button-secondary')}>Sort<Ico d={IconChevron} end /></button>
            {/* Medium, like the two beside them. This row is about where an
                icon sits, not how big a button is — `btn-sm` here made the row
                28, 36, 36, 28 and put two of the four 4px lower than the rest.
                The size scale has its own row below. */}
            <button className="btn btn-secondary icon-only" {...ins('button-secondary')}><Ico d={IconTrash} /></button>
            <button className="btn btn-secondary icon-only" {...ins('button-secondary')}><Ico d={IconStar} /></button>
          </div>
          <div className="row">
            <Label txt={txt}>sizes</Label>
            <button className="btn btn-primary btn-sm" {...ins('button-sm')}><Ico d={IconPlus} size="sm" />Small</button>
            <button className="btn btn-primary" {...ins('button-md')}><Ico d={IconPlus} />Medium</button>
            <button className="btn btn-primary btn-lg" {...ins('button-lg')}><Ico d={IconPlus} size="lg" />Large</button>
          </div>
          {/* The enclosing `.stack-sm` publishes 12px, so a 4px margin here
              made 16 rather than replacing it. One writer per gap. */}
          <p className="caption" {...txt('caption', 'text-muted')}>Each size carries its own icon gap — click one to change it.</p>
        </div>
      </Section>

      <Section txt={txt} title="Icon and label pairings" note="Everywhere the two combine — the same gap token governs all of them">
        <div className="card stack-sm" {...ins("card")}>
          <h3 className="with-icon" style={{ fontSize: 'var(--font-h5-size, 20px)' }} {...txt('h5')}><Ico d={IconFolder} size="lg" />Section heading</h3>
          <span className="with-icon caption" {...txt('caption', 'text-muted')}><Ico d={IconInfo} size="sm" />Metadata label</span>
          <span className="with-icon badge badge-success" {...ins('badge-success')}><Ico d={IconCheck} size="sm" />Verified</span>
          <div className="with-icon small" {...txt('body-sm')}><Ico d={IconStar} />List row with a leading icon</div>
          <div className="row">
            <span className="with-icon nav-item is-active" aria-current="page" {...ins('nav-item-selected')}><Ico d={IconFolder} />Active nav</span>
            <span className="with-icon nav-item" {...ins('nav-item')}><Ico d={IconSearch} />Inactive nav</span>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Inputs" note="Default, focused (click in), invalid, disabled">
        <div className="cols-2">
          <div className="field" {...ins('input')}><label className="label" {...txt("caption", "text-muted")}>Default</label><input className="input" placeholder="Placeholder text" /></div>
          <div className="field" {...ins('input')}><label className="label" {...txt("caption", "text-muted")}>Filled</label><input className="input" defaultValue="Northwind Trading" /></div>
          <div className="field" {...ins('input-invalid')}><label className="label" {...txt("caption", "text-muted")}>Invalid</label><input className="input is-invalid" defaultValue="not-an-email" /></div>
          <div className="field" {...ins('input-disabled')}><label className="label" {...txt("caption", "text-muted")}>Disabled</label><input className="input" disabled defaultValue="Locked" /></div>
        </div>
        {/* A TEXTAREA WAS DECLARED AND NEVER SHOWN. It takes the input's OWN
            class, which is the sort of thing a reader cannot guess: the spec
            names it `textarea` and there is no `.textarea`. */}
        <div className="field" {...ins('textarea')}>
          <label className="label" htmlFor="g-note" {...txt("caption", "text-muted")}>Note</label>
          <textarea className="input" id="g-note" rows={3} defaultValue="Paid by transfer, reference on the remittance advice." />
        </div>
      </Section>

      <Section txt={txt} title="Choices" note="Checkbox, switch and select — drawn from tokens, not native widgets">
        <div className="card stack-sm" {...ins("card")}>
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox-checked')}>
            <Check on />Send a copy to my accountant
          </label>
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox')}>
            <Check />Attach a payment link
          </label>
          {/* THE THIRD STATE. A checkbox has three, and indeterminate is the
              honest answer when some of the rows below a select-all are chosen
              and some are not. Without it the box must lie in one direction.
              It takes the SAME fill as checked — the MARK is what separates
              them, a dash against a tick, so a reader who cannot tell two hues
              apart still sees two shapes. */}
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox-indeterminate')}>
            <Check mixed />Some line items are taxable
          </label>
          {/* The text sits at the other end of a `space-between` row rather than
              beside the control, so it cannot label it by position. Each switch
              states its own name. */}
          {/* Each Switch sits in its OWN span, as it does on Form and Settings.
              Without one, the transparent input covers the nearest positioned
              box — here the whole `space-between` row — so the hit area measured
              212px wide and 23.1 tall, spanning the label at the far end and
              missing the published minimum in the axis that matters. The wrapper
              makes the host the switch itself, so one overhang rule serves every
              instance. */}
          <div className="row" style={{ justifyContent: 'space-between' }} {...ins('switch-checked')}>
            <span className="small" {...txt("body-sm")}>Automatic reminders</span>
            <span><Switch on label="Automatic reminders" /></span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }} {...ins('switch')}>
            <span className="small" {...txt("body-sm")}>Weekly digest</span>
            <span><Switch label="Weekly digest" /></span>
          </div>
          <div className="field" {...ins('select')}>
            <label className="label" {...txt("caption", "text-muted")}>Payment terms</label>
            {/* `select-trigger`, not an inline `justify-content`. A `.btn` is
                inline-block, so that property did nothing and the value sat in
                the middle of a full-width control. */}
            <button className="btn btn-secondary select-trigger select-trigger-block" style={{ height: 'var(--cmp-select-height, 36px)' }}>
              <span>Net 30</span><Ico d={IconChevron} />
            </button>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Tooltip and menu">
        <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-lg, 24px)' }}>
          <div style={{ position: 'relative', paddingTop: 32 }}>
            <span {...ins('tooltip')} style={{
              position: 'absolute', top: 0, left: 0, whiteSpace: 'nowrap',
              background: 'var(--cmp-tooltip-background-color, var(--c-text, #111))',
              color: 'var(--cmp-tooltip-text-color, var(--c-text-inverse, #fff))',
              borderRadius: 'var(--cmp-tooltip-rounded, var(--radius-sm, 4px))',
              padding: 'var(--cmp-tooltip-padding, 2px 8px)',
              fontSize: 'var(--cmp-tooltip-font-size, var(--font-caption-size, 12px))',
              cursor: 'pointer',
            }}>Copies the invoice link</span>
            <button className="btn btn-secondary btn-sm icon-only" {...ins('button-secondary')}><Ico d={IconStar} /></button>
          </div>
          <div className="card card-overlay" style={{ padding: 4, minWidth: 168 }} {...ins('card-overlay')}>
            {[['Duplicate', IconPlus], ['Download PDF', IconFolder], ['Delete', IconTrash]].map(([label, icon]) => (
              <div key={label} className="with-icon nav-item" style={{ width: '100%' }} {...ins('nav-item')}>
                <Ico d={icon} />{label}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Search, select and toolbar">
        <div className="stack-sm matrix">
          <div className="input-icon" style={{ maxWidth: 300 }} {...ins("input")}>
            <Ico d={IconSearch} />
            <input className="input" placeholder="Search invoices" />
          </div>
          <div className="row">
            <button className="btn btn-secondary select-trigger" style={{ minWidth: 152 }} {...ins('select')}>
              <span>All accounts</span><Ico d={IconChevron} />
            </button>
            <div className="row" style={{ gap: 2, background: 'var(--c-bg-subtle, #eee)', padding: 4, borderRadius: 'var(--radius-md, 8px)' }}>
              {['Day', 'Week', 'Month'].map((t, i) => (
                <span key={t} className="nav-item" {...ins(i === 1 ? 'nav-item-selected' : 'nav-item')} style={{
                  padding: '4px 12px',
                  background: i === 1 ? 'var(--c-surface, #fff)' : 'transparent',
                  color: i === 1 ? 'var(--c-text, #111)' : undefined,
                  boxShadow: i === 1 ? 'var(--shadow-raised, none)' : 'none',
                }}>{t}</span>
              ))}
            </div>
            <div className="row" style={{ marginLeft: 'auto', gap: 4 }}>
              <button className="btn btn-secondary btn-sm icon-only" title="Filter" {...ins("button-secondary")}><Ico d={IconFolder} /></button>
              <button className="btn btn-secondary btn-sm icon-only" title="More" {...ins("button-secondary")}><Ico d={IconInfo} /></button>
            </div>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Badges and status">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {['accent', 'success', 'warning', 'danger', 'neutral'].map(k => (
            <span key={k} className={`badge badge-${k}`} {...ins(`badge-${k}`)}>{k}</span>
          ))}
          <span className="with-icon badge badge-success" {...ins("badge-success")}><Ico d={IconCheck} size="sm" />with icon</span>
          {/* The dot is a class now, not an inline flex box. Inline styles here
              were overriding the badge's own display and taking its baseline
              with them, which is what put this badge 2px below its neighbours. */}
          <span className="badge badge-neutral" {...ins('badge-neutral')}>
            <span className="dot" style={{ background: 'var(--c-success, green)' }} />live
          </span>
        </div>
      </Section>

      <Section txt={txt} title="Alerts and toasts">
        <div className="stack-sm matrix">
          {[['success', IconCheck, 'Invoice sent to Northwind Trading.'],
            ['warning', IconInfo, 'Two invoices are overdue by more than 30 days.'],
            ['danger', IconInfo, 'Payment failed — the card on file has expired.']].map(([tone, icon, body]) => (
            <div key={tone} className={`alert alert-${tone}`} {...ins(`alert-${tone}`)}>
              {al.icon !== 'none' && <Ico d={icon} />}
              <span className="alert-body" {...txt('body-sm')}>
                {al.title === 'bold' && <strong style={{ display: 'block' }}>{tone[0].toUpperCase() + tone.slice(1)}</strong>}
                {body}
              </span>
            </div>
          ))}
          {/* Deliberately long, so the first-line alignment is visible rather
              than merely asserted. */}
          <div className="alert alert-warning" {...ins('alert-warning')}>
            {al.icon !== 'none' && <Ico d={IconInfo} />}
            <span className="alert-body" {...txt('body-sm')}>
              {al.title === 'bold' && <strong style={{ display: 'block' }}>Overdue accounts</strong>}
              Three invoices have been outstanding for more than sixty days, and two of those
              accounts have no payment method on file — chase them before the quarter closes.
              {al.action === 'below' && (
                <span style={{ display: 'block', marginTop: 'var(--space-xs, 8px)' }}>
                  <button className="btn btn-ghost btn-sm" {...ins('button-ghost')}>Review</button>
                </span>
              )}
            </span>
            {al.action === 'inline' && (
              <span className="alert-action">
                <button className="btn btn-ghost btn-sm" {...ins('button-ghost')}>Review</button>
              </span>
            )}
          </div>
          <div className="card card-overlay row" style={{ maxWidth: 340 }} {...ins("card-overlay")}>
            <Ico d={IconCheck} />
            <span className="small" style={{ flex: 1 }} {...txt('body-sm')}>Changes saved</span>
            <button className="btn btn-ghost btn-sm" {...ins("button-ghost")}>Undo</button>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Empty state and loading">
        <div className="cols-2">
          {/* THIS WAS A HAND-ROLLED COPY OF A COMPONENT THAT ALREADY EXISTS.
              It carried a plain `.card` with an inline `textAlign` and
              `padding`, a mark built from three inline values beside the
              `.empty-mark` the real screen uses, and an inline `marginTop: 2`
              between the title and its explanation.

              A demonstration IS the component, so a hand-rolled sample is a
              specification that lies: a reader copying this Gallery card gets
              none of `.empty-mark`'s derived icon size.

              It was found by measuring, not by reading. Once the card owned
              the distance between its children, the mark's inline 8px and the
              card's 12px ADDED to 20 — an inline-level box's margin does not
              collapse with a sibling's. So the stray showed up as the only
              doubling left in 378 cards. `.stack` states the flow itself, and
              the title and its explanation go inside a `.stack-sm` so they
              read as one group. Same shape as `screens/Empty.jsx`. */}
          <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }} {...ins('card')}>
            <span className="empty-mark" style={{ color: 'var(--c-text-subtle, #999)' }} {...ins('avatar')}>
              <Ico d={IconFolder} size="lg" />
            </span>
            <div className="stack-sm" style={{ alignItems: 'center' }}>
              <div style={{ fontWeight: 500 }} {...txt("body-md")}>No invoices yet</div>
              <p className="muted small" {...txt('body-sm', 'text-muted')}>Create one to get started.</p>
            </div>
            {/* The stated card action distance, not a typed 12px. */}
            <div className="card-actions">
              <button className="btn btn-primary btn-sm" {...ins("button-sm")}><Ico d={IconPlus} size="sm" />New invoice</button>
            </div>
          </div>
          <div className="card stack-sm" {...ins("card")}>
            {['70%', '92%', '48%'].map(w => (
              <div key={w} style={{ height: 12, width: w, borderRadius: 'var(--radius-sm, 4px)', background: 'var(--c-bg-subtle, #eee)' }} />
            ))}
            {/* The `.stack-sm` above owns the 12px. A 4px margin added to it. */}
            <div className="bar"><span style={{ width: '38%' }} /></div>
            <span className="caption" {...txt("caption", "text-muted")}>Loading skeleton and progress</span>
          </div>
        </div>
      </Section>

      {/* ── THE TABLE, WHICH WAS NOT ON THIS SURFACE AT ALL ──
          This is called "every component this system ships, built correctly",
          and the contract tells a builder to extract from it 1:1. There was no
          table. Simulation run 13 built a financial dashboard and had to derive
          one from the prose, which the same contract forbids.

          One instance carries five declared names: the table, its header, its
          cells, a selected row and a hover row. The figures follow the mono
          rule too — an amount takes the face AND an end edge, a reference takes
          the face alone, and a date with a month name stays in the body face. */}
      <Section txt={txt} title="Table" note="Header, rows, a selected row, and the three kinds of figure">
        <div className="card" {...ins('card')}>
          <div className="table-scroll">
            <table className="table" {...ins('table')}>
              <thead {...ins('table-header')}>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Client</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num-col">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr {...ins('table-cell')}>
                  <td>6 Sep 2026</td>
                  <td><span className="figure">INV-2043</span></td>
                  <td>Northwind Trading</td>
                  <td><span className="badge badge-success"><span className="dot" aria-hidden="true"></span>Paid</span></td>
                  <td className="num-col"><span className="amount">1,480.00</span></td>
                </tr>
                <tr className="is-selected" {...ins('table-selected')}>
                  <td>4 Sep 2026</td>
                  <td><span className="figure">INV-2041</span></td>
                  <td>Fabrikam Logistics</td>
                  <td><span className="badge badge-warning"><span className="dot" aria-hidden="true"></span>Due</span></td>
                  <td className="num-col"><span className="amount">-620.50</span></td>
                </tr>
                <tr className="is-hover" {...ins('table-hover')}>
                  <td>1 Sep 2026</td>
                  <td><span className="figure">INV-2038</span></td>
                  <td>Contoso Insurance</td>
                  <td><span className="badge badge-danger"><span className="dot" aria-hidden="true"></span>Overdue</span></td>
                  <td className="num-col"><span className="amount">12,004.16</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── A TAB STRIP AND THE CONTROL THAT FOLDS A NAVIGATION ──
          `tab` and `nav-burger` were declared, styled, and rendered nowhere
          here. The burger is a `summary` inside a `details`, which is the shape
          its own CSS keys on, so a reader copying a bare button gets a control
          that answers no key. */}
      <Section txt={txt} title="Tabs and navigation" note="A strip with one tab current, and the control that folds a rail">
        <div className="card stack-sm" {...ins('card')}>
          <div className="row" role="tablist" aria-label="Invoice views" style={{ gap: 'var(--space-2xs, 4px)' }}>
            <button className="tab is-selected" role="tab" aria-selected="true" {...ins('tab')}>Open</button>
            <button className="tab" role="tab" aria-selected="false" {...ins('tab')}>Paid</button>
            <button className="tab" role="tab" aria-selected="false" {...ins('tab')}>Draft</button>
          </div>
          <div className="divider"></div>
          <div className="row" style={{ gap: 'var(--space-sm, 12px)' }}>
            <details className="nav-collapse" style={{ display: 'block' }}>
              <summary className="nav-summary btn btn-secondary" aria-label="Workspace menu" {...ins('nav-burger')}>
                <span className="nav-burger" aria-hidden="true" style={{ display: 'flex' }}><span></span><span></span><span></span></span>
                <span className="nav-label">Menu</span>
              </summary>
            </details>
            <a className="nav-item is-selected with-icon" href="#gallery" aria-current="page" {...ins('nav-item-selected')}>
              <Ico d={IconFolder} /><span>Current</span>
            </a>
            <a className="nav-item with-icon" href="#gallery" {...ins('nav-item')}>
              <Ico d={IconStar} /><span>Another</span>
            </a>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Surfaces & elevation" note="flat, raised, overlay, sunken">
        {/* card-compact and card-roomy were declared variants emitting their own
            padding tokens, with no class consuming either and no instance here.
            Both render now, so the padding step is visible beside the default. */}
        <div className="cols-2" style={{ marginBottom: 'var(--space-md, 16px)' }}>
          <div className="card card-compact" {...ins('card-compact')}><div className="caption" {...txt("caption", "text-muted")}>compact</div><p className="small" style={{ marginTop: 4 }} {...txt("body-sm")}>Tighter padding</p></div>
          <div className="card card-roomy" {...ins('card-roomy')}><div className="caption" {...txt("caption", "text-muted")}>roomy</div><p className="small" style={{ marginTop: 4 }} {...txt("body-sm")}>Looser padding</p></div>
        </div>
        <div className="cols-4">
          <div className="card card-flat" {...ins('card-flat')}><div className="caption" {...txt("caption", "text-muted")}>flat</div><p className="small" style={{ marginTop: 4 }} {...txt("body-sm")}>Border only</p></div>
          <div className="card" {...ins('card')}><div className="caption" {...txt("caption", "text-muted")}>raised</div><p className="small" style={{ marginTop: 4 }} {...txt("body-sm")}>Cards, panels</p></div>
          <div className="card card-overlay" {...ins('card-overlay')}><div className="caption" {...txt("caption", "text-muted")}>overlay</div><p className="small" style={{ marginTop: 4 }} {...txt("body-sm")}>Menus, popovers</p></div>
          <div className="well"><div className="caption" {...txt("caption", "text-muted")}>sunken</div><p className="small" style={{ marginTop: 4 }} {...txt("body-sm")}>Wells, insets</p></div>
        </div>
      </Section>

      {/* The one place every text style is on screen at once, so every line
          here goes straight to its own row in the Type tab. */}
      <Section txt={txt} title="Text hierarchy" note="Click any line for its font, size and colour">
        <div className="card stack-sm" {...ins("card")}>
          <h1 {...txt('h1')}>Heading one</h1>
          <h2 {...txt('h2')}>Heading two</h2>
          <h3 {...txt('h3')}>Heading three</h3>
          <p {...txt('body-md')}>Body copy at the base size. The quick brown fox jumps over the lazy dog, and keeps jumping until the line wraps so the measure and leading are actually visible.</p>
          <p className="muted small" {...txt('body-sm', 'text-muted')}>Secondary text — captions, metadata, supporting detail.</p>
          <p className="subtle small" {...txt('body-sm', 'text-subtle')}>Subtle text — placeholders and disabled labels.</p>
          <p className="caption" {...txt('caption', 'text-muted')}>CAPTION / OVERLINE</p>
          <code style={{ fontFamily: 'var(--font-code-family, monospace)', fontSize: 'var(--font-code-size, 14px)' }}
            {...txt('code')}>const total = subtotal * 1.2</code>
        </div>
      </Section>

      <Section txt={txt} title="Avatars, progress, dividers">
        <div className="card stack-sm" {...ins("card")}>
          <div className="row">
            {['AH', 'ML', 'HG', 'AK'].map(i => <span className="avatar" key={i} {...ins('avatar')}>{i}</span>)}
            <span className="muted small" {...txt('body-sm', 'text-muted')}>4 collaborators</span>
          </div>
          <hr className="divider" />
          <div className="bar"><span style={{ width: '45%' }} /></div>
          <div className="bar"><span style={{ width: '82%' }} /></div>
        </div>
      </Section>
    </div>
  )
}
