/* Reviewing a suggested rewrite.

   Nothing the model produces is applied until it's accepted. The diff is
   shown by default because the whole point is seeing what changed — a wall of
   new text with an Accept button underneath is not a review. */
import { useMemo, useState } from 'react'
import { diffWords, diffStats } from './diff.js'
import { Segmented } from '../ui/controls.jsx'
import CrossFade from '../ui/CrossFade.jsx'

export default function ReviewDiff({ before, after, streaming, error, onAccept, onReject, onRetry }) {
  const [view, setView] = useState('diff')
  const parts = useMemo(() => (before ? diffWords(before, after) : null), [before, after])
  const stats = parts ? diffStats(parts) : null

  return (
    <div style={{
      marginTop: 8, background: 'var(--surf2)', border: '1px solid rgba(220,144,85,.35)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--bdr)' }}>
        <span style={{ fontSize: 12, color: 'var(--accent)', flex: 1 }}>
          {streaming ? 'Writing…' : error ? 'Failed' : 'Suggested rewrite'}
        </span>
        {!streaming && !error && stats && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>
            <span className="pass">+{stats.added}</span> <span className="fail">−{stats.removed}</span>
          </span>
        )}
        {!streaming && !error && before && (
          <Segmented size="sm" value={view} onChange={setView}
            options={[{ value: 'diff', label: 'Diff' }, { value: 'new', label: 'New' }]} />
        )}
      </div>

      <div style={{ padding: '12px 12px', maxHeight: 320, overflowY: 'auto' }}>
        <CrossFade id={streaming ? 'streaming' : error ? 'error' : view}>
        {error ? (
          <p style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.55 }}>{error}</p>
        ) : view === 'diff' && parts ? (
          <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--muted)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {parts.map((p, i) => (
              <span key={i} style={
                p.type === 'add' ? { background: 'rgba(90,173,128,.18)', color: '#9ad9b4' }
                  : p.type === 'remove' ? { background: 'rgba(222,92,92,.15)', color: '#e79a9a', textDecoration: 'line-through' }
                  : { color: 'var(--text-dim)' }
              }>{p.text}</span>
            ))}
          </p>
        ) : (
          <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {after}{streaming && <span style={{ color: 'var(--accent)' }}>▍</span>}
          </p>
        )}
        </CrossFade>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--bdr)' }}>
        {streaming ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--dim)', flex: 1 }}>Streaming from the model…</span>
            <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onReject}>Cancel</button>
          </>
        ) : error ? (
          <>
            <span style={{ flex: 1 }} />
            <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onReject}>Dismiss</button>
            <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onRetry}>Try Again</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: 'var(--dim)', flex: 1 }}>Nothing is saved until you accept.</span>
            <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onRetry}>Regenerate</button>
            <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onReject}>Discard</button>
            <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={onAccept}>Accept</button>
          </>
        )}
      </div>
    </div>
  )
}
