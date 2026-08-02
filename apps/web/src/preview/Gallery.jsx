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
    <section className="stack-sm" style={{ marginBottom: 'var(--space-lg, 32px)' }}>
      <div>
        <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)' }} {...txt('h6')}>{title}</h3>
        {note && <p className="caption" style={{ marginTop: 2 }} {...txt('caption', 'text-muted')}>{note}</p>}
      </div>
      {children}
    </section>
  )
}

const Label = ({ children, txt }) => (
  <div className="caption" style={{ minWidth: 74, textTransform: 'uppercase', letterSpacing: '.06em' }}
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
        <div className="stack-sm">
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
        <div className="stack-sm">
          <div className="row">
            <Label txt={txt}>filled</Label>
            <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconPlus} />New invoice</button>
            <button className="btn btn-primary" {...ins('button-primary')}>Continue<Ico d={IconArrow} /></button>
            <button className="btn btn-primary" {...ins('button-md')} style={{ padding: 0, width: 'var(--cmp-button-md-height, 36px)', cursor: 'pointer' }}><Ico d={IconPlus} /></button>
          </div>
          <div className="row">
            <Label txt={txt}>outline</Label>
            <button className="btn btn-secondary" {...ins('button-secondary')}><Ico d={IconSearch} />Search</button>
            <button className="btn btn-secondary" {...ins('button-secondary')}>Sort<Ico d={IconChevron} /></button>
            <button className="icon-btn" {...ins('button-secondary')}><Ico d={IconTrash} /></button>
            <button className="icon-btn" {...ins('button-secondary')}><Ico d={IconStar} /></button>
          </div>
          <div className="row">
            <Label txt={txt}>sizes</Label>
            <button className="btn btn-primary btn-sm" {...ins('button-sm')}><Ico d={IconPlus} size="sm" />Small</button>
            <button className="btn btn-primary" {...ins('button-md')}><Ico d={IconPlus} />Medium</button>
            <button className="btn btn-primary btn-lg" {...ins('button-lg')}><Ico d={IconPlus} size="lg" />Large</button>
          </div>
          <p className="caption" style={{ marginTop: 4 }} {...txt('caption', 'text-muted')}>Each size carries its own icon gap — click one to change it.</p>
        </div>
      </Section>

      <Section txt={txt} title="Icon and label pairings" note="Everywhere the two combine — the same gap token governs all of them">
        <div className="card stack-sm" {...ins("card")}>
          <h3 className="with-icon" style={{ fontSize: 'var(--font-h5-size, 20px)' }} {...txt('h5')}><Ico d={IconFolder} size="lg" />Section heading</h3>
          <span className="with-icon caption" {...txt('caption', 'text-muted')}><Ico d={IconInfo} size="sm" />Metadata label</span>
          <span className="with-icon badge badge-success" {...ins('badge-success')}><Ico d={IconCheck} size="sm" />Verified</span>
          <div className="with-icon small" {...txt('body-sm')}><Ico d={IconStar} />List row with a leading icon</div>
          <div className="row">
            <span className="with-icon nav-item is-active" {...ins('nav-item-selected')}><Ico d={IconFolder} />Active nav</span>
            <span className="with-icon nav-item" {...ins('nav-item')}><Ico d={IconSearch} />Inactive nav</span>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Inputs" note="Default, focused (click in), invalid, disabled">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field" {...ins('input')}><label className="label" {...txt("caption", "text-muted")}>Default</label><input className="input" placeholder="Placeholder text" /></div>
          <div className="field" {...ins('input')}><label className="label" {...txt("caption", "text-muted")}>Filled</label><input className="input" defaultValue="Northwind Trading" /></div>
          <div className="field" {...ins('input-invalid')}><label className="label" {...txt("caption", "text-muted")}>Invalid</label><input className="input is-invalid" defaultValue="not-an-email" /></div>
          <div className="field" {...ins('input-disabled')}><label className="label" {...txt("caption", "text-muted")}>Disabled</label><input className="input" disabled defaultValue="Locked" /></div>
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
          <div className="row" style={{ justifyContent: 'space-between' }} {...ins('switch-checked')}>
            <span className="small" {...txt("body-sm")}>Automatic reminders</span><Switch on />
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }} {...ins('switch')}>
            <span className="small" {...txt("body-sm")}>Weekly digest</span><Switch />
          </div>
          <div className="field" {...ins('select')}>
            <label className="label" {...txt("caption", "text-muted")}>Payment terms</label>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Net 30</span><Ico d={IconChevron} />
            </button>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Tooltip and menu">
        <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-lg, 24px)' }}>
          <div style={{ position: 'relative', paddingTop: 30 }}>
            <span {...ins('tooltip')} style={{
              position: 'absolute', top: 0, left: 0, whiteSpace: 'nowrap',
              background: 'var(--cmp-tooltip-background-color, var(--c-text, #111))',
              color: 'var(--cmp-tooltip-text-color, var(--c-text-inverse, #fff))',
              borderRadius: 'var(--cmp-tooltip-rounded, var(--radius-sm, 4px))',
              padding: 'var(--cmp-tooltip-padding, 2px 8px)',
              fontSize: 'var(--cmp-tooltip-font-size, var(--font-caption-size, 12px))',
              cursor: 'pointer',
            }}>Copies the invoice link</span>
            <button className="icon-btn" {...ins('button-secondary')}><Ico d={IconStar} /></button>
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
        <div className="stack-sm">
          <div className="input-icon" style={{ maxWidth: 300 }} {...ins("input")}>
            <Ico d={IconSearch} />
            <input className="input" placeholder="Search invoices" />
          </div>
          <div className="row">
            <button className="btn btn-secondary" style={{ minWidth: 150, justifyContent: 'space-between' }} {...ins('select')}>
              <span>All accounts</span><Ico d={IconChevron} />
            </button>
            <div className="row" style={{ gap: 2, background: 'var(--c-bg-subtle, #eee)', padding: 3, borderRadius: 'var(--radius-md, 8px)' }}>
              {['Day', 'Week', 'Month'].map((t, i) => (
                <span key={t} className="nav-item" {...ins(i === 1 ? 'nav-item-selected' : 'nav-item')} style={{
                  padding: '4px 10px',
                  background: i === 1 ? 'var(--c-surface, #fff)' : 'transparent',
                  color: i === 1 ? 'var(--c-text, #111)' : undefined,
                  boxShadow: i === 1 ? 'var(--shadow-raised, none)' : 'none',
                }}>{t}</span>
              ))}
            </div>
            <div className="row" style={{ marginLeft: 'auto', gap: 4 }}>
              <button className="icon-btn" title="Filter" {...ins("button-secondary")}><Ico d={IconFolder} /></button>
              <button className="icon-btn" title="More" {...ins("button-secondary")}><Ico d={IconInfo} /></button>
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
          <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--icon-gap, 8px)' }} {...ins('badge-neutral')}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-success, green)' }} />live
          </span>
        </div>
      </Section>

      <Section txt={txt} title="Alerts and toasts">
        <div className="stack-sm">
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
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-lg, 24px)' }} {...ins('card')}>
            <div style={{ display: 'inline-flex', marginBottom: 'var(--space-xs, 8px)', color: 'var(--c-text-subtle, #999)' }}>
              <Ico d={IconFolder} size="xl" />
            </div>
            <div style={{ fontWeight: 500 }} {...txt("body-md")}>No invoices yet</div>
            <p className="muted small" style={{ marginTop: 2, marginBottom: 'var(--space-sm, 12px)' }} {...txt('body-sm', 'text-muted')}>Create one to get started.</p>
            <button className="btn btn-primary btn-sm" {...ins("button-sm")}><Ico d={IconPlus} size="sm" />New invoice</button>
          </div>
          <div className="card stack-sm" {...ins("card")}>
            {['70%', '92%', '48%'].map(w => (
              <div key={w} style={{ height: 10, width: w, borderRadius: 'var(--radius-sm, 4px)', background: 'var(--c-bg-subtle, #eee)' }} />
            ))}
            <div className="bar" style={{ marginTop: 4 }}><span style={{ width: '38%' }} /></div>
            <span className="caption" {...txt("caption", "text-muted")}>Loading skeleton and progress</span>
          </div>
        </div>
      </Section>

      <Section txt={txt} title="Surfaces & elevation" note="flat, raised, overlay, sunken">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
