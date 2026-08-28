/* What Fix It is about to do, before it does it.
 *
 * The button changed the document on the first click. That is fine for a
 * spacing nudge and wrong for a colour: the fix moves a semantic role to a
 * different step of its ramp, and a role is a decision somebody made. Pressing
 * a button labelled Fix It should not silently overwrite one.
 *
 * Their instruction: show a visual preview of what is going to change, as an
 * overlay modal.
 *
 * THE PREVIEW SHOWS THE MEASUREMENT, NOT ONLY THE SWATCH.
 *
 * Two teals side by side tell a reader almost nothing, because the whole fault
 * is invisible to normal vision. The numbers are the point: the pair sits 7.9
 * apart under simulation and the fix takes it to some other figure. So the
 * modal re-runs the audit against a candidate document and reports what the
 * finding count actually becomes.
 *
 * That also catches a fix that helps here and hurts elsewhere. `stepThatSeparates`
 * already refuses a candidate that drops its own label below AA, and this is the
 * second net: if the total gets worse, the modal says so and the reader can
 * still decline.
 *
 * The simulated swatches sit beside the real ones, because the fault is defined
 * under deuteranopia and a reader cannot check the claim without seeing it. */
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store.jsx'
import { derive } from '../state/derive.js'
import { audit, withFinding, simulateDeuter } from './audit.js'

/* ── THE CHROME AND THE PREVIEW HAVE DIFFERENT PRIMITIVES ──
 *
 * The first version of this reached for `.row`, `.swatch` and `.figure`, which
 * is the right instinct in the wrong context. `.row` and `.figure` are scoped to
 * `.dmd` and do not exist out here, so both computed to `display: block`.
 * `.swatch` DOES exist in the chrome and sets no `display`, so a `<span>`
 * carrying it stays inline and ignores width and height.
 *
 * Measured before the fix: the four swatches rendered 2x20 instead of 36x36, and
 * the two chips stacked instead of sitting side by side.
 *
 * So the layout is stated here, and `.swatch` is kept only for the radius, the
 * border and the hover it genuinely provides. */
const SWATCH = { width: 36, height: 36, display: 'block', flexShrink: 0 }
/* A count is a figure, so it takes the mono face. `.figure` is the preview's
   class for this and is unavailable here. */
const FIGURE = { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }

/* A swatch pair: the role as it is, and as red-green vision receives it. */
function Chip({ hex, label }) {
  const sim = useMemo(() => simulateDeuter(hex), [hex])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <div className="swatch" style={{ ...SWATCH, background: hex }} />
        {/* The same colour under deuteranopia, which is the vision the rule is
            written for. Dashed, so it never reads as a second brand colour. */}
        <div className="swatch" style={{ ...SWATCH, background: sim, borderStyle: 'dashed' }}
          title={`${hex} under deuteranopia: ${sim}`} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--dim)', ...FIGURE }}>{hex}</span>
      <span style={{ fontSize: 10, color: 'var(--dim)' }}>{label}</span>
    </div>
  )
}

export default function FixPreview({ fix, onCancel, onConfirm }) {
  const { state, derived } = useStore()

  /* The candidate, and what the audit says about it. Both derived from the same
     `withFinding` the button uses, so the preview cannot promise a change the
     button does not make. */
  const after = useMemo(() => {
    if (!fix) return null
    const s = withFinding(state, fix)
    const d = derive(s)
    return { state: s, derived: d, findings: audit(s, d) }
  }, [state, fix])

  if (!fix || !after) return null

  const now = audit(state, derived)
  const n = (list, level) => list.filter(f => f.level === level).length
  const before = { fail: n(now, 'fail'), warn: n(now, 'warn') }
  const next = { fail: n(after.findings, 'fail'), warn: n(after.findings, 'warn') }
  const worse = (next.fail + next.warn) > (before.fail + before.warn)
  const settled = (next.fail + next.warn) < (before.fail + before.warn)

  const fromHex = derived.roles?.[fix.mode]?.[fix.role]
  const toHex = after.derived.roles?.[fix.mode]?.[fix.role]

  return createPortal(
    <div onClick={onCancel} role="presentation" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise modal-panel"
        role="dialog" aria-modal="true" aria-labelledby="fixprev-title"
        style={{
          background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12,
          width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--bdr)' }}>
          <h2 id="fixprev-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            {fix.label}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            {fix.mode} mode. Nothing changes until you apply it, and undo reverses it.
          </p>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* The change itself. The dashed square beside each is the same colour
              under deuteranopia, so the claim can be checked rather than taken. */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <Chip hex={fromHex} label={`now · ${fix.from ?? ''}`} />
            <span style={{ fontSize: 18, color: 'var(--dim)', paddingBottom: 20 }} aria-hidden="true">&rarr;</span>
            <Chip hex={toHex} label={`after · ${fix.ref}`} />
          </div>

          {/* THE NUMBER, because the swatches cannot carry it. A reader with
              normal vision sees two similar colours in both columns. */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '6px 16px',
            fontSize: 12, alignItems: 'baseline',
            background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: 12,
          }}>
            <span style={{ color: 'var(--dim)' }} />
            <span style={{ color: 'var(--dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}>Now</span>
            <span style={{ color: 'var(--dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}>After</span>

            <span style={{ color: 'var(--muted)' }}>Failures</span>
            <span style={FIGURE}>{before.fail}</span>
            <span style={{ ...FIGURE, color: next.fail > before.fail ? 'var(--warn)' : 'var(--text)' }}>{next.fail}</span>

            <span style={{ color: 'var(--muted)' }}>Warnings</span>
            <span style={FIGURE}>{before.warn}</span>
            <span style={{ ...FIGURE, color: next.warn > before.warn ? 'var(--warn)' : 'var(--text)' }}>{next.warn}</span>
          </div>

          {/* A fix that makes the total worse is still offered, and it says so.
              The alternative is hiding a remedy because one number moved, and the
              reader is the one who knows which finding they care about. */}
          {worse && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--warn)' }}>
              This clears the finding you opened and raises the total. Something
              else in the palette now trips a check that was quiet.
            </p>
          )}
          {!worse && !settled && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
              The total does not move. This finding is replaced by another of the
              same weight.
            </p>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: 16, borderTop: '1px solid var(--bdr)', justifyContent: 'flex-end',
        }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onConfirm(fix)}>Apply the change</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
