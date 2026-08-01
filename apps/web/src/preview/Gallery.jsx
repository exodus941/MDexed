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
import { inspectProps } from './inspect.js'

function Section({ title, note, children }) {
  return (
    <section className="stack-sm" style={{ marginBottom: 'var(--space-lg, 32px)' }}>
      <div>
        <h3 style={{ fontSize: 'var(--font-body-md-size, 16px)' }}>{title}</h3>
        {note && <p className="caption" style={{ marginTop: 2 }}>{note}</p>}
      </div>
      {children}
    </section>
  )
}

const Label = ({ children }) => (
  <div className="caption" style={{ minWidth: 74, textTransform: 'uppercase', letterSpacing: '.06em' }}>{children}</div>
)

export default function Gallery({ onInspect }) {
  const ins = entry => inspectProps(entry, onInspect)
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
        <p className="caption" style={{ marginBottom: 'var(--space-md, 16px)' }}>
          Click any element to jump to its properties. Alt-click to interact with it instead.
        </p>
      )}

      <Section title="Buttons — variants × states" note="Forced states, so every combination is visible at once">
        <div className="stack-sm">
          {variants.map(v => (
            <div className="row" key={v}>
              <Label>{v}</Label>
              {states.map(s => (
                <button key={s.label} className={`btn btn-${v} ${s.cls}`}
                  {...ins(s.key ? `button-${v}-${s.key}` : `button-${v}`)}>{s.label}</button>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons — sizes" note="Interactive: hover, click, and tab to see the focus ring">
        <div className="row">
          <Label>live</Label>
          <button className="btn btn-primary btn-sm" {...ins('button-sm')}>Small</button>
          <button className="btn btn-primary" {...ins('button-md')}>Medium</button>
          <button className="btn btn-primary btn-lg" {...ins('button-lg')}>Large</button>
          <button className="btn btn-secondary" {...ins('button-secondary')}>Secondary</button>
          <button className="btn btn-ghost" {...ins('button-ghost')}>Ghost</button>
        </div>
      </Section>

      <Section title="Buttons with icons" note="Leading, trailing, icon-only — spacing driven by the icon gap token">
        <div className="stack-sm">
          <div className="row">
            <Label>filled</Label>
            <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconPlus} />New invoice</button>
            <button className="btn btn-primary" {...ins('button-primary')}>Continue<Ico d={IconArrow} /></button>
            <button className="btn btn-primary" {...ins('button-md')} style={{ padding: 0, width: 'var(--cmp-button-md-height, 36px)', cursor: 'pointer' }}><Ico d={IconPlus} /></button>
          </div>
          <div className="row">
            <Label>outline</Label>
            <button className="btn btn-secondary" {...ins('button-secondary')}><Ico d={IconSearch} />Search</button>
            <button className="btn btn-secondary" {...ins('button-secondary')}>Sort<Ico d={IconChevron} /></button>
            <button className="icon-btn" {...ins('button-secondary')}><Ico d={IconTrash} /></button>
            <button className="icon-btn" {...ins('button-secondary')}><Ico d={IconStar} /></button>
          </div>
          <div className="row">
            <Label>sizes</Label>
            <button className="btn btn-primary btn-sm" {...ins('button-sm')}><Ico d={IconPlus} size="sm" />Small</button>
            <button className="btn btn-primary" {...ins('button-md')}><Ico d={IconPlus} />Medium</button>
            <button className="btn btn-primary btn-lg" {...ins('button-lg')}><Ico d={IconPlus} size="lg" />Large</button>
          </div>
          <p className="caption" style={{ marginTop: 4 }}>Each size carries its own icon gap — click one to change it.</p>
        </div>
      </Section>

      <Section title="Icon and label pairings" note="Everywhere the two combine — the same gap token governs all of them">
        <div className="card stack-sm">
          <h3 className="with-icon" style={{ fontSize: 'var(--font-h5-size, 20px)' }}><Ico d={IconFolder} size="lg" />Section heading</h3>
          <span className="with-icon caption"><Ico d={IconInfo} size="sm" />Metadata label</span>
          <span className="with-icon badge badge-success"><Ico d={IconCheck} size="sm" />Verified</span>
          <div className="with-icon small"><Ico d={IconStar} />List row with a leading icon</div>
          <div className="row">
            <span className="with-icon nav-item is-active"><Ico d={IconFolder} />Active nav</span>
            <span className="with-icon nav-item"><Ico d={IconSearch} />Inactive nav</span>
          </div>
        </div>
      </Section>

      <Section title="Inputs" note="Default, focused (click in), invalid, disabled">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field" {...ins('input')}><label className="label">Default</label><input className="input" placeholder="Placeholder text" /></div>
          <div className="field" {...ins('input')}><label className="label">Filled</label><input className="input" defaultValue="Northwind Trading" /></div>
          <div className="field" {...ins('input-invalid')}><label className="label">Invalid</label><input className="input is-invalid" defaultValue="not-an-email" /></div>
          <div className="field" {...ins('input-disabled')}><label className="label">Disabled</label><input className="input" disabled defaultValue="Locked" /></div>
        </div>
      </Section>

      <Section title="Choices" note="Checkbox, switch and select — drawn from tokens, not native widgets">
        <div className="card stack-sm">
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox-checked')}>
            <Check on />Send a copy to my accountant
          </label>
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox')}>
            <Check />Attach a payment link
          </label>
          <div className="row" style={{ justifyContent: 'space-between' }} {...ins('switch-checked')}>
            <span className="small">Automatic reminders</span><Switch on />
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }} {...ins('switch')}>
            <span className="small">Weekly digest</span><Switch />
          </div>
          <div className="field" {...ins('select')}>
            <label className="label">Payment terms</label>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Net 30</span><Ico d={IconChevron} />
            </button>
          </div>
        </div>
      </Section>

      <Section title="Tooltip and menu">
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

      <Section title="Search, select and toolbar">
        <div className="stack-sm">
          <div className="input-icon" style={{ maxWidth: 300 }}>
            <Ico d={IconSearch} />
            <input className="input" placeholder="Search invoices" />
          </div>
          <div className="row">
            <button className="btn btn-secondary" style={{ minWidth: 150, justifyContent: 'space-between' }}>
              <span>All accounts</span><Ico d={IconChevron} />
            </button>
            <div className="row" style={{ gap: 2, background: 'var(--c-bg-subtle, #eee)', padding: 3, borderRadius: 'var(--radius-md, 8px)' }}>
              {['Day', 'Week', 'Month'].map((t, i) => (
                <span key={t} className="nav-item" style={{
                  padding: '4px 10px',
                  background: i === 1 ? 'var(--c-surface, #fff)' : 'transparent',
                  color: i === 1 ? 'var(--c-text, #111)' : undefined,
                  boxShadow: i === 1 ? 'var(--shadow-raised, none)' : 'none',
                }}>{t}</span>
              ))}
            </div>
            <div className="row" style={{ marginLeft: 'auto', gap: 4 }}>
              <button className="icon-btn" title="Filter"><Ico d={IconFolder} /></button>
              <button className="icon-btn" title="More"><Ico d={IconInfo} /></button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Badges and status">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {['accent', 'success', 'warning', 'danger', 'neutral'].map(k => (
            <span key={k} className={`badge badge-${k}`} {...ins(`badge-${k}`)}>{k}</span>
          ))}
          <span className="with-icon badge badge-success"><Ico d={IconCheck} size="sm" />with icon</span>
          <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--icon-gap, 8px)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-success, green)' }} />live
          </span>
        </div>
      </Section>

      <Section title="Alerts and toasts">
        <div className="stack-sm">
          {[['success', IconCheck, 'Invoice sent to Northwind Trading.'],
            ['warning', IconInfo, 'Two invoices are overdue by more than 30 days.'],
            ['danger', IconInfo, 'Payment failed — the card on file has expired.']].map(([tone, icon, text]) => (
            <div key={tone} className="with-icon" style={{
              alignItems: 'flex-start',
              background: `var(--c-${tone}-subtle, #eee)`, color: `var(--c-${tone}, #333)`,
              border: `1px solid var(--c-${tone}, #ccc)`,
              borderRadius: 'var(--radius-md, 8px)',
              padding: 'var(--space-xs, 8px) var(--space-sm, 12px)',
              fontSize: 'var(--font-body-sm-size, 14px)',
            }}>
              <Ico d={icon} />{text}
            </div>
          ))}
          <div className="card card-overlay row" style={{ maxWidth: 340 }}>
            <Ico d={IconCheck} />
            <span className="small" style={{ flex: 1 }}>Changes saved</span>
            <button className="btn btn-ghost btn-sm">Undo</button>
          </div>
        </div>
      </Section>

      <Section title="Empty state and loading">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-lg, 24px)' }}>
            <div style={{ display: 'inline-flex', marginBottom: 'var(--space-xs, 8px)', color: 'var(--c-text-subtle, #999)' }}>
              <Ico d={IconFolder} size="xl" />
            </div>
            <div style={{ fontWeight: 500 }}>No invoices yet</div>
            <p className="muted small" style={{ marginTop: 2, marginBottom: 'var(--space-sm, 12px)' }}>Create one to get started.</p>
            <button className="btn btn-primary btn-sm"><Ico d={IconPlus} size="sm" />New invoice</button>
          </div>
          <div className="card stack-sm">
            {['70%', '92%', '48%'].map(w => (
              <div key={w} style={{ height: 10, width: w, borderRadius: 'var(--radius-sm, 4px)', background: 'var(--c-bg-subtle, #eee)' }} />
            ))}
            <div className="bar" style={{ marginTop: 4 }}><span style={{ width: '38%' }} /></div>
            <span className="caption">Loading skeleton and progress</span>
          </div>
        </div>
      </Section>

      <Section title="Surfaces & elevation" note="flat, raised, overlay, sunken">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card card-flat" {...ins('card-flat')}><div className="caption">flat</div><p className="small" style={{ marginTop: 4 }}>Border only</p></div>
          <div className="card" {...ins('card')}><div className="caption">raised</div><p className="small" style={{ marginTop: 4 }}>Cards, panels</p></div>
          <div className="card card-overlay" {...ins('card-overlay')}><div className="caption">overlay</div><p className="small" style={{ marginTop: 4 }}>Menus, popovers</p></div>
          <div className="well"><div className="caption">sunken</div><p className="small" style={{ marginTop: 4 }}>Wells, insets</p></div>
        </div>
      </Section>

      <Section title="Text hierarchy">
        <div className="card stack-sm">
          <h1>Heading one</h1>
          <h2>Heading two</h2>
          <h3>Heading three</h3>
          <p>Body copy at the base size. The quick brown fox jumps over the lazy dog, and keeps jumping until the line wraps so the measure and leading are actually visible.</p>
          <p className="muted small">Secondary text — captions, metadata, supporting detail.</p>
          <p className="subtle small">Subtle text — placeholders and disabled labels.</p>
          <p className="caption">CAPTION / OVERLINE</p>
        </div>
      </Section>

      <Section title="Avatars, progress, dividers">
        <div className="card stack-sm">
          <div className="row">
            {['AH', 'ML', 'HG', 'AK'].map(i => <span className="avatar" key={i}>{i}</span>)}
            <span className="muted small">4 collaborators</span>
          </div>
          <hr className="divider" />
          <div className="bar"><span style={{ width: '45%' }} /></div>
          <div className="bar"><span style={{ width: '82%' }} /></div>
        </div>
      </Section>
    </div>
  )
}
