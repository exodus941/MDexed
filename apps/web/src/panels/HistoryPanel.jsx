/* Change log.

   Not part of the exported file and not part of the document — it's a record
   of what you did, kept in this browser so it survives a reload. Useful when
   a system drifts and you want to know which edit took it there.

   Entries carry before/after values rather than a category alone: "Colour
   changed" tells you nothing you couldn't have guessed. */
import { useState, useMemo } from 'react'
import { useStore } from '../state/store.jsx'
import { LOG_LIMIT_DEFAULT, LOG_LIMIT_MAX } from '../state/store.jsx'
import { CHANGE_CATEGORIES, CATEGORY_BY_ID, canRevert, revertChange, planRewind } from '../state/changelog.js'
import { gradientCss } from '../color/modes.js'
import { resolveRef } from '../color/ramp.js'
import { SectionHeader, Collapsible, NumField, Banner, ConfirmDelete, PAD, BTN, CloseButton , MODAL_BTN } from '../ui/controls.jsx'

const pad = n => String(n).padStart(2, '0')
const clock = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }

const dayLabel = ts => {
  const d = new Date(ts), now = new Date()
  const same = (a, b) => a.toDateString() === b.toDateString()
  if (same(d, now)) return 'Today'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (same(d, y)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const short = v => {
  if (v == null || v === '') return '—'
  const s = String(v)
  return s.length > 34 ? `${s.slice(0, 33)}…` : s
}

const Chip = ({ children, tone }) => (
  <code style={{
    fontFamily: 'var(--mono)', fontSize: 10.5, padding: '2px 6px', borderRadius: 4,
    background: 'var(--surf3)', border: '1px solid var(--bdr)',
    color: tone ?? 'var(--text-dim)', whiteSpace: 'nowrap',
  }}>{children}</code>
)

const Swatch = ({ hex, size = 14 }) => (
  <span className="swatch" title={hex} style={{ width: size, height: size, background: hex, cursor: 'default' }} />
)

const Arrow = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)

/* Gradient previews are drawn from the stops recorded at the time, resolved
   against the palette as it stands now. */
function GradientBar({ snap, ctx }) {
  if (!snap) return null
  const css = gradientCss(snap, ctx)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ width: 128, height: 20, borderRadius: 4, background: css, border: '1px solid rgba(255,255,255,.1)' }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {snap.stops.map((s, i) => {
          const hex = /^#/.test(s.color) ? s.color : (ctx.roles[s.color] ?? resolveRef(s.color, ctx.ramps) ?? '#888')
          return (
            <span key={i} title={`${s.color} — ${hex} at ${s.position}%`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>
              <Swatch hex={hex} size={9} />{hex}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Detail({ detail, ctx }) {
  if (!detail) return null

  if (detail.kind === 'gradient') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 5 }}>
        {detail.from && <GradientBar snap={detail.from} ctx={ctx} />}
        {detail.from && <div style={{ marginTop: 5 }}><Arrow /></div>}
        <GradientBar snap={detail.to} ctx={ctx} />
      </div>
    )
  }

  if (detail.kind === 'palette') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 5 }}>
        {detail.swatches.map(s => (
          <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {s.from && <Swatch hex={s.from} size={11} />}
              {s.from && s.from !== s.to && <Arrow />}
              {s.from !== s.to && <Swatch hex={s.to} />}
            </div>
            <span style={{ fontSize: 9, color: s.locked ? 'var(--accent)' : 'var(--dim)', fontFamily: 'var(--mono)' }}>
              {s.locked ? '🔒 ' : ''}{s.name}
            </span>
            <span style={{ fontSize: 8.5, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>{s.to}</span>
          </div>
        ))}
      </div>
    )
  }

  if (detail.kind === 'colour') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
        {detail.from ? <><Swatch hex={detail.from} /><Chip>{detail.from}</Chip></> : <Chip>unset</Chip>}
        <Arrow />
        {detail.to ? <><Swatch hex={detail.to} /><Chip tone="var(--accent)">{detail.to}</Chip></> : <Chip>cleared</Chip>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' }}>
      <Chip>{short(detail.from)}</Chip>
      <Arrow />
      <Chip tone="var(--accent)">{short(detail.to)}</Chip>
    </div>
  )
}

export default function HistoryPanel() {
  const { log, clearLog, logLimit, setLogLimit, derived, state, set } = useStore()
  const [active, setActive] = useState(new Set())
  const [query, setQuery] = useState('')

  /* Puts one change back without touching anything else — not an undo, so it
     works fifty edits later. The revert is itself logged. */
  const revert = entry => {
    const updater = revertChange(entry)
    if (updater) set(updater, `revert:${entry.tag}`)
  }

  /* Rewind everything back to a chosen point. Held as a plan rather than run
     on click: the confirmation has to state how many changes it will undo and
     how many it cannot, and those numbers come from the plan itself. */
  const [rewind, setRewind] = useState(null)
  const askRewind = entry => {
    const index = log.findIndex(e => e === entry)
    if (index < 0) return
    setRewind({ entry, ...planRewind(log, index) })
  }
  const doRewind = () => {
    if (rewind?.updater) set(rewind.updater, `rewind:${rewind.applied}`)
    setRewind(null)
  }

  /* Gradient snapshots store references; they're resolved for display against
     whatever the palette is now. */
  const ctx = { roles: derived.roles[state.color.mode], ramps: derived.ramps, resolveRef }

  const counts = useMemo(() => {
    const c = {}
    for (const e of log) c[e.category] = (c[e.category] ?? 0) + 1
    return c
  }, [log])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return log
      .filter(e => active.size === 0 || active.has(e.category))
      .filter(e => !q
        || e.label.toLowerCase().includes(q)
        || (e.tag ?? '').toLowerCase().includes(q)
        || (e.detail?.subject ?? '').toLowerCase().includes(q)
        || String(e.detail?.to ?? '').toLowerCase().includes(q))
      .slice().reverse()
  }, [log, active, query])

  const groups = useMemo(() => {
    const out = []
    for (const e of filtered) {
      const day = dayLabel(e.at)
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, items: [e] })
      else out[out.length - 1].items.push(e)
    }
    return out
  }, [filtered])

  const toggle = id => setActive(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const nearLimit = log.length >= logLimit * 0.875

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionHeader title="History" desc="Every edit since this browser first opened the project."
        right={<span className="chip">{log.length} / {logLimit}</span>} />

      {nearLimit ? (
        <Banner tone="warn">
          The log is at {log.length} of {logLimit} entries — past seven eighths of the cap. Older entries drop off as
          new ones arrive; raise the cap below, or clear it if you no longer need the trail.
        </Banner>
      ) : (
        <Banner tone="info">
          Kept locally and never written into the exported file. <strong>Revert</strong> puts a single change back
          wherever that token stands now, leaving every other edit alone — it isn't an undo, so it still works
          fifty changes later. Rationale text has no revert: only word counts are recorded, not the prose itself.
        </Banner>
      )}

      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search changes, tokens and values" style={{ fontSize: 12.5 }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        {CHANGE_CATEGORIES.filter(c => counts[c.id]).map(c => {
          const on = active.has(c.id)
          return (
            <button key={c.id} onClick={() => toggle(c.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: on ? `${c.colour}22` : 'transparent',
                border: `1px solid ${on ? c.colour : 'var(--bdr)'}`,
                color: on ? c.colour : 'var(--muted)',
                borderRadius: 6, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer',
                transition: 'all var(--t) var(--ease)',
              }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.colour }} />
              {c.label}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, opacity: .75 }}>{counts[c.id]}</span>
            </button>
          )
        })}
        {active.size > 0 && (
          <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setActive(new Set())}>Clear Filter</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--dim)' }}>{filtered.length} shown</span>
      </div>

      {!filtered.length && (
        <div style={{ textAlign: 'center', padding: '26px 16px', color: 'var(--dim)', fontSize: 13, border: '1px dashed var(--bdr)', borderRadius: 10 }}>
          {log.length ? 'Nothing matches that filter.' : 'No changes recorded yet.'}
        </div>
      )}

      {groups.map(group => (
        <div key={group.day}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 6 }}>{group.day}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {group.items.map(e => {
              const cat = CATEGORY_BY_ID[e.category] ?? CATEGORY_BY_ID.system
              return (
                <div key={e.id} className="log-row" style={{
                  /* The actions sit on the line that names the change, and the
                     detail line hangs below them. They also share a baseline
                     with each other, see below. */
                  display: 'grid', gridTemplateColumns: '8px 1fr auto', gap: 10, alignItems: 'baseline',
                  /* Above, not below. The last entry in the list otherwise
                     draws a rule straight onto the card's own bottom border.
                     A separator belongs between two items, and a top border
                     is that by construction — nothing sits above the first. */
                  padding: PAD.sub, borderTop: '1px solid var(--bdr)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.colour, marginTop: 5, alignSelf: 'start' }} title={cat.label} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{e.label}</span>
                      {e.detail?.subject && (
                        <code style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)' }}>{e.detail.subject}</code>
                      )}
                      {e.count > 1 && <span style={{ color: 'var(--dim)', fontFamily: 'var(--mono)', fontSize: 10 }}>×{e.count}</span>}
                    </div>
                    <Detail detail={e.detail} ctx={ctx} />
                  </div>
                  {/* These three are all one line, so they do share a baseline.
                      Both labels are `.lbl` so each button's baseline comes from
                      its text rather than from the icon in front of it. */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    {/* Hidden until the row is pointed at, because it is the
                        destructive one and should not sit there inviting a
                        stray click on every row at once. Revealed on keyboard
                        focus too — hover-only would put it out of reach of
                        anyone not using a mouse. */}
                    <button className="rewind-btn" onClick={() => askRewind(e)}
                      title="Undo this change and everything after it"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none',
                        border: '1px solid rgb(var(--danger-rgb) / .35)', borderRadius: 5, cursor: 'pointer',
                        color: 'var(--danger)', padding: '2px 8px', fontSize: 10.5, fontFamily: 'var(--sans)',
                      }}>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
                      </svg>
                      <span className="lbl">Rewind to here</span>
                    </button>
                    {canRevert(e) && (
                      <button onClick={() => revert(e)} title="Put this one change back, leaving everything else alone"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none',
                          border: '1px solid var(--bdr)', borderRadius: 5, cursor: 'pointer',
                          color: 'var(--muted)', padding: '2px 8px', fontSize: 10.5, fontFamily: 'var(--sans)',
                          transition: 'color var(--t) var(--ease), border-color var(--t) var(--ease)',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.color = 'var(--accent)'; ev.currentTarget.style.borderColor = 'rgb(var(--accent-rgb) / .4)' }}
                        onMouseLeave={ev => { ev.currentTarget.style.color = 'var(--muted)'; ev.currentTarget.style.borderColor = 'var(--bdr)' }}>
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 2v6h6" /><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3 8.5" />
                        </svg>
                        <span className="lbl">Revert</span>
                      </button>
                    )}
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim)' }}>{clock(e.at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <Collapsible title="Log Settings" note={`${logLimit} kept`}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <NumField label="Entries to keep" value={logLimit} min={20} max={LOG_LIMIT_MAX} step={50}
            width={130} onChange={setLogLimit} />
          <p className="panel-note" style={{ flex: 1 }}>
            Oldest entries drop off once the cap is reached. {LOG_LIMIT_DEFAULT} is the default; a few thousand is
            fine, but the whole log is written to local storage on every edit, so very large values will start to
            cost you on each keystroke.
          </p>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>Clear the entire log</span>
          {log.length > 0
            ? <ConfirmDelete onConfirm={clearLog} title="Clear the log" />
            : <span style={{ fontSize: 11, color: 'var(--dim)' }}>Already empty</span>}
        </div>
      </Collapsible>

      {rewind && (
        <RewindConfirm plan={rewind} onCancel={() => setRewind(null)} onConfirm={doRewind} />
      )}
    </div>
  )
}

/* ── Confirming a rewind ──
 *
 * The one action in the log that cannot be shrugged off, so it states its
 * consequences in numbers before it happens rather than describing them
 * afterwards. Three facts, in the order that decides whether you press it:
 * how many changes go, how many cannot be undone, and where you land.
 *
 * The count of unrevertible changes is the honest part. Prose edits log word
 * counts rather than the prose, so a rewind across one cannot restore it —
 * saying so up front is the difference between a tool you trust and one that
 * quietly does less than it promised. */
function RewindConfirm({ plan, onCancel, onConfirm }) {
  const { entry, applied, skipped, total } = plan
  const nothing = applied === 0

  return (
    <div onClick={onCancel} className="anim-fade" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise modal-panel" style={{
        background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12,
        width: '100%', maxWidth: 440, overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${PAD.card}px ${PAD.card + 4}px`, borderBottom: '1px solid var(--bdr)', fontSize: 15, lineHeight: 1.5 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, flex: 1 }}>Rewind to this point?</span>
          <CloseButton onClick={onCancel} label="Cancel" size={11} />
        </div>

        <div style={{ padding: PAD.card + 4, display: 'flex', flexDirection: 'column', gap: PAD.gap }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-dim)', margin: 0 }}>
            This undoes <strong style={{ color: 'var(--text)' }}>{total} change{total === 1 ? '' : 's'}</strong>,
            everything from now back to and including{' '}
            <strong style={{ color: 'var(--text)' }}>{entry.label}</strong> at {clock(entry.at)}.
          </p>

          {skipped > 0 && (
            <Banner tone="warn">
              {skipped} of them cannot be put back. The log records what changed, not every value —
              prose is stored as a word count — so {applied === 0 ? 'none' : `only ${applied}`} of these
              will actually be undone. The rest stay as they are.
            </Banner>
          )}

          <p style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--muted)', margin: 0 }}>
            It lands in the undo stack as one step, so Ctrl+Z takes the whole rewind back.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: PAD.row, padding: `${PAD.gap}px ${PAD.card + 4}px`, borderTop: '1px solid var(--bdr)' }}>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" style={MODAL_BTN} onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} disabled={nothing}
            style={{
              ...MODAL_BTN, fontFamily: 'var(--sans)', fontWeight: 500,
              border: '1px solid transparent', borderRadius: 6,
              background: 'var(--danger)', color: 'var(--bg)',
              cursor: nothing ? 'not-allowed' : 'pointer', opacity: nothing ? .45 : 1,
            }}>
            {nothing ? 'Nothing to undo' : `Undo ${applied} change${applied === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
