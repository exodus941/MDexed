/* Visual cubic-bezier editor. Drag the two control points; the value is a
   plain CSS `cubic-bezier(...)` string so it round-trips through state and
   into the file unchanged. Y is allowed past 0–1 so overshoot curves are
   reachable. */
import { useRef, useCallback, useState, useEffect } from 'react'

const SIZE = 132
const PAD = 22
const Y_MIN = -0.5
const Y_MAX = 1.5

const parse = str => {
  const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(str ?? '')
  return m ? m.slice(1).map(Number) : [0.25, 0.1, 0.25, 1]
}
const fmt = p => `cubic-bezier(${p.map(v => Math.round(v * 100) / 100).join(', ')})`

const toPx = (x, y) => [PAD + x * (SIZE - PAD * 2), SIZE - PAD - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (SIZE - PAD * 2)]
const fromPx = (px, py) => [
  Math.max(0, Math.min(1, (px - PAD) / (SIZE - PAD * 2))),
  Math.max(Y_MIN, Math.min(Y_MAX, Y_MIN + ((SIZE - PAD - py) / (SIZE - PAD * 2)) * (Y_MAX - Y_MIN))),
]

export default function BezierEditor({ value, onChange, duration = '300ms' }) {
  const [p, setP] = useState(() => parse(value))
  const [dragging, setDragging] = useState(null)
  const [playing, setPlaying] = useState(false)
  const svgRef = useRef(null)
  const last = useRef(value)

  useEffect(() => {
    if (value !== last.current) { setP(parse(value)); last.current = value }
  }, [value])

  const emit = next => {
    setP(next)
    const str = fmt(next)
    last.current = str
    onChange(str)
  }

  const move = useCallback(e => {
    if (dragging == null || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const [x, y] = fromPx(e.clientX - r.left, e.clientY - r.top)
    const next = [...p]
    next[dragging * 2] = x
    next[dragging * 2 + 1] = y
    emit(next)
  }, [dragging, p])

  const [x1, y1] = toPx(p[0], p[1])
  const [x2, y2] = toPx(p[2], p[3])
  const [sx, sy] = toPx(0, 0)
  const [ex, ey] = toPx(1, 1)

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <svg ref={svgRef} width={SIZE} height={SIZE}
        onPointerMove={move}
        onPointerUp={e => { setDragging(null); e.currentTarget.releasePointerCapture?.(e.pointerId) }}
        onPointerLeave={() => setDragging(null)}
        className="preview-box"
        style={{ touchAction: 'none', flexShrink: 0 }}>
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="var(--bdr2)" strokeDasharray="3 3" />
        <line x1={sx} y1={sy} x2={x1} y2={y1} stroke="var(--dim)" strokeWidth={1} />
        <line x1={ex} y1={ey} x2={x2} y2={y2} stroke="var(--dim)" strokeWidth={1} />
        <path d={`M ${sx} ${sy} C ${x1} ${y1}, ${x2} ${y2}, ${ex} ${ey}`} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {[[x1, y1, 0], [x2, y2, 1]].map(([cx, cy, i]) => (
          <circle key={i} cx={cx} cy={cy} r={6} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2}
            style={{ cursor: 'grab' }}
            onPointerDown={e => { setDragging(i); e.currentTarget.setPointerCapture(e.pointerId) }} />
        ))}
        <circle cx={sx} cy={sy} r={3} fill="var(--muted)" />
        <circle cx={ex} cy={ey} r={3} fill="var(--muted)" />
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <code style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 8, wordBreak: 'break-all' }}>
          {fmt(p)}
        </code>
        <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, marginBottom: 8 }}
          onClick={() => { setPlaying(false); requestAnimationFrame(() => setPlaying(true)) }}>
          Preview
        </button>
        <div className="preview-box" style={{ height: 24, position: 'relative', overflow: 'hidden' }}>
          <div
            key={playing ? 'run' : 'idle'}
            onAnimationEnd={() => setPlaying(false)}
            style={{
              position: 'absolute', top: 4, left: 4, width: 16, height: 16, borderRadius: 4, background: 'var(--accent)',
              animation: playing ? `dmd-bez ${duration} ${fmt(p)} both` : 'none',
            }} />
        </div>
        <style>{`@keyframes dmd-bez { from { transform: translateX(0) } to { transform: translateX(calc(100% + 100px)) } }`}</style>
      </div>
    </div>
  )
}
