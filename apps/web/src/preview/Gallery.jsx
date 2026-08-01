/* Every component in every variant, size and state, side by side.
   Hover and active are shown twice: as forced `.is-*` classes so all states
   are visible at once, and as genuinely interactive controls so transitions
   and focus rings can be felt rather than just looked at. */

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

export default function Gallery() {
  const variants = ['primary', 'secondary', 'ghost', 'danger']
  const states = [
    { cls: '', label: 'default' },
    { cls: 'is-hover', label: 'hover' },
    { cls: 'is-active', label: 'active' },
    { cls: 'is-disabled', label: 'disabled' },
  ]

  return (
    <div style={{ maxWidth: 780 }}>
      <Section title="Buttons — variants × states" note="Forced states, so every combination is visible at once">
        <div className="stack-sm">
          {variants.map(v => (
            <div className="row" key={v}>
              <Label>{v}</Label>
              {states.map(s => (
                <button key={s.label} className={`btn btn-${v} ${s.cls}`}>{s.label}</button>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons — sizes" note="Interactive: hover, click, and tab to see the focus ring">
        <div className="row">
          <Label>live</Label>
          <button className="btn btn-primary btn-sm">Small</button>
          <button className="btn btn-primary">Medium</button>
          <button className="btn btn-primary btn-lg">Large</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-ghost">Ghost</button>
        </div>
      </Section>

      <Section title="Inputs" note="Default, focused (click in), invalid, disabled">
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field"><label className="label">Default</label><input className="input" placeholder="Placeholder text" /></div>
          <div className="field"><label className="label">Filled</label><input className="input" defaultValue="Northwind Trading" /></div>
          <div className="field"><label className="label">Invalid</label><input className="input is-invalid" defaultValue="not-an-email" /></div>
          <div className="field"><label className="label">Disabled</label><input className="input" disabled defaultValue="Locked" /></div>
        </div>
      </Section>

      <Section title="Badges">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {['accent', 'success', 'warning', 'danger', 'neutral'].map(k => (
            <span key={k} className={`badge badge-${k}`}>{k}</span>
          ))}
        </div>
      </Section>

      <Section title="Surfaces & elevation" note="flat, raised, overlay, sunken">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card card-flat"><div className="caption">flat</div><p className="small" style={{ marginTop: 4 }}>Border only</p></div>
          <div className="card"><div className="caption">raised</div><p className="small" style={{ marginTop: 4 }}>Cards, panels</p></div>
          <div className="card card-overlay"><div className="caption">overlay</div><p className="small" style={{ marginTop: 4 }}>Menus, popovers</p></div>
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
