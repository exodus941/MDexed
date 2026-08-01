/* Change log.

   Not part of the exported file and not part of the document — it's a record
   of what you did, kept in this browser so it survives a reload. Useful when
   a system drifts and you want to know which edit took it there. */
import { useState, useMemo } from 'react'
import { useStore } from '../state/store.jsx'
import { CHANGE_CATEGORIES, CATEGORY_BY_ID } from '../state/changelog.js'
import { SectionHeader, Segmented, Banner, ConfirmDelete } from '../ui/controls.jsx'

const pad = n => String(n).padStart(2, '0')
const clock = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }

const dayLabel = ts => {
  const d = new Date(ts), now = new Date()
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, now)) return 'Today'
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HistoryPanel() {
  const { log, clearLog } = useStore()
  const [active, setActive] = useState(new Set())
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c = {}
    for (const e of log) c[e.category] = (c[e.category] ?? 0) + 1
    return c
  }, [log])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return log
      .filter(e => (active.size === 0 || active.has(e.category)))
      .filter(e => !q || e.label.toLowerCase().includes(q) || (e.tag ?? '').toLowerCase().includes(q))
      .slice()
      .reverse()
  }, [log, active, query])

  /* Group by day so a long session doesn't read as one undifferentiated wall. */
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionHeader title="History" desc="Every edit since this browser first opened the project."
        right={<span className="chip">{log.length}</span>} />

      <Banner tone="info">
        Kept locally and never written into the exported file. Clearing it doesn't touch your design.
      </Banner>

      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search changes" style={{ fontSize: 12.5 }} />

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
                borderRadius: 6, padding: '3px 9px', fontSize: 11.5, cursor: 'pointer',
                transition: 'all var(--t) var(--ease)',
              }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.colour }} />
              {c.label}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, opacity: .75 }}>{counts[c.id]}</span>
            </button>
          )
        })}
        {active.size > 0 && (
          <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setActive(new Set())}>Clear filter</button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--dim)' }}>{filtered.length} shown</span>
          {log.length > 0 && <ConfirmDelete onConfirm={clearLog} title="Clear the log" />}
        </div>
      </div>

      {!filtered.length && (
        <div style={{ textAlign: 'center', padding: '26px 16px', color: 'var(--dim)', fontSize: 13, border: '1px dashed var(--bdr)', borderRadius: 10 }}>
          {log.length ? 'Nothing matches that filter.' : 'No changes recorded yet.'}
        </div>
      )}

      {groups.map(group => (
        <div key={group.day}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 6 }}>{group.day}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {group.items.map(e => {
              const cat = CATEGORY_BY_ID[e.category] ?? CATEGORY_BY_ID.system
              return (
                <div key={e.id} style={{
                  display: 'grid', gridTemplateColumns: '8px 1fr auto auto', gap: 10, alignItems: 'center',
                  padding: '6px 2px', borderBottom: '1px solid var(--bdr)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.colour }} title={cat.label} />
                  <span style={{ fontSize: 12.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.label}
                    {e.count > 1 && <span style={{ color: 'var(--dim)', fontFamily: 'var(--mono)', fontSize: 10, marginLeft: 6 }}>×{e.count}</span>}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>{cat.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim)' }}>{clock(e.at)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
