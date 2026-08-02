/* Accessibility, past the contrast checker.
 *
 * The Roles panel already grades every text pair. This is everything else:
 * the criteria that have no obvious number attached and so get skipped —
 * borders nobody can see, focus rings that vanish against the button they
 * surround, controls too small to hit, and colour pairs that mean opposite
 * things and look identical to eight percent of men.
 *
 * Findings are advice, not gates. A system that fails the 44px target on
 * purpose — a dense data tool for mouse users — is a legitimate system. What
 * isn't legitimate is failing it without knowing. So nothing here blocks
 * anything; every row just names what is true, cites the criterion, shows the
 * measurement, and offers a way in.
 *
 * Every row is also a link. Reading that `checkbox` is 16px and then hunting
 * for the checkbox across twelve tabs is how audits get abandoned. */
import { useMemo } from 'react'
import { useStore } from '../state/store.jsx'
import { audit, summarise, REQUIREMENTS } from '../a11y/audit.js'
import { SectionHeader, Collapsible, Banner, PAD } from '../ui/controls.jsx'

const TONE = {
  fail: { fg: 'var(--danger)',  bg: 'rgb(var(--danger-rgb) / .10)',  bd: 'rgb(var(--danger-rgb) / .32)', label: 'Fails' },
  warn: { fg: 'var(--warn)',    bg: 'rgb(var(--warn-rgb) / .10)', bd: 'rgb(var(--warn-rgb) / .30)', label: 'Warns' },
  note: { fg: 'var(--muted)',   bg: 'var(--surf3)',         bd: 'var(--bdr)',           label: 'Worth a look' },
}

/* Two swatches side by side, the second pair simulated. Nothing explains a
   colour-blindness finding the way seeing it does — the numbers in the row
   above are the evidence, this is the argument. */
function Simulation({ pair, simulated }) {
  const swatch = (hex, key) => (
    <div key={key} style={{ width: 30, height: 20, background: hex, borderRadius: 4, border: '1px solid rgba(127,127,127,.35)' }} />
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, marginTop: PAD.row }}>
      <div style={{ display: 'flex', gap: 2 }}>{pair.map(swatch)}</div>
      <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>normal</span>
      <span style={{ color: 'var(--dim)' }}>→</span>
      <div style={{ display: 'flex', gap: 2 }}>{simulated.map(swatch)}</div>
      <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>deuteranopia</span>
    </div>
  )
}

function Finding({ f, onGo }) {
  const t = TONE[f.level]
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 8,
      padding: PAD.sub, display: 'flex', flexDirection: 'column', gap: PAD.label,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: PAD.gap }}>
        <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500, flex: 1, minWidth: 0 }}>
          {f.title}
        </span>
        {f.mode && <span className="chip" style={{ flexShrink: 0 }}>{f.mode}</span>}
        {f.measured && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: t.fg, flexShrink: 0 }}>{f.measured}</span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: 'var(--muted)' }}>{f.detail}</p>

      {f.pairHex && f.simulated && <Simulation pair={f.pairHex} simulated={f.simulated} />}

      {f.fix && (
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-dim)' }}>
          <strong style={{ color: t.fg, fontWeight: 500 }}>Fix · </strong>{f.fix}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, marginTop: 1 }}>
        <span style={{ fontSize: 10.5, color: 'var(--dim)', fontFamily: 'var(--mono)', flex: 1, minWidth: 0 }}>
          {f.criterion}
        </span>
        {f.tab && (
          <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => onGo(f)}>Go there</button>
        )}
      </div>
    </div>
  )
}

export default function AccessPanel({ onNavigate }) {
  const { state, derived } = useStore()
  const findings = useMemo(() => audit(state, derived), [state, derived])
  const counts = summarise(findings)

  const groups = ['fail', 'warn', 'note']
    .map(level => ({ level, items: findings.filter(f => f.level === level) }))
    .filter(g => g.items.length > 0)

  /* The panel names a tab and an entry; the shell knows what kind of thing
     lives on each tab. Duplicating that mapping here would mean two places to
     get it wrong. */
  const go = f => onNavigate?.(f.tab, f.entry)

  return (
    <div>
      <SectionHeader title="Accessibility"
        note={counts.total === 0 ? 'Nothing to report' : `${counts.fail} failing · ${counts.warn} warnings · ${counts.note} notes`} />

      <p className="panel-note" style={{ marginBottom: PAD.card }}>
        Everything the contrast checker doesn’t cover. These run against the derived tokens —
        the same values the preview renders and the file exports — so a pass is a statement about
        what ships, not about intent.
      </p>

      {counts.total === 0 && (
        <Banner tone="success">
          Nothing failing. Worth remembering that this checks the system, not the screens: markup,
          labels, heading order and keyboard traps live in the code an agent writes, and those
          requirements are emitted into the file below.
        </Banner>
      )}

      {counts.fail > 0 && (
        <div style={{ marginBottom: PAD.card }}>
          <Banner tone="error">
            {counts.fail} documented WCAG {counts.fail === 1 ? 'violation' : 'violations'}. These
            are exported into the file’s Accessibility section as known issues — an agent that knows
            about them can work around them, which beats a file that looks clean.
          </Banner>
        </div>
      )}

      {groups.map(g => (
        <Collapsible key={g.level} title={TONE[g.level].label} note={String(g.items.length)}
          defaultOpen={g.level !== 'note'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: PAD.gap }}>
            {g.items.map(f => <Finding key={f.id} f={f} onGo={go} />)}
          </div>
        </Collapsible>
      ))}

      <Collapsible title="Requirements in the Exported File"
        note={String(REQUIREMENTS.length)} defaultOpen={false}>
        <p className="panel-note" style={{ marginBottom: PAD.gap }}>
          These can’t be checked from tokens — they’re properties of markup, not of a palette. They
          go into the file verbatim because they’re true of every system and an agent gets them wrong
          unless told. This is the part that turns DESIGN.md from a palette into something that
          constrains behaviour.
        </p>
        <ul style={{ margin: 0, paddingLeft: 17, display: 'flex', flexDirection: 'column', gap: PAD.row }}>
          {REQUIREMENTS.map(r => (
            <li key={r.id} style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--muted)' }}>{r.text}</li>
          ))}
        </ul>
      </Collapsible>
    </div>
  )
}
