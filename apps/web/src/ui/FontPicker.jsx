/* Google Fonts browser.

   The catalogue is ~1,900 families. Rendering them all, or requesting a
   stylesheet per family, takes the panel down — so the list is windowed to
   what's on screen and each visible family loads its own font lazily. */
import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react'
import { loadCatalog, filterFamilies, loadFont, CATEGORIES, FALLBACK_FAMILIES, stackFor } from '../type/fonts.js'
import { Segmented } from './controls.jsx'

const ROW_H = 36
const VIEWPORT_H = 264
const OVERSCAN = 4

let sharedCatalog = null

export function useFontCatalog() {
  const [state, setState] = useState(() =>
    sharedCatalog ? { families: sharedCatalog, loading: false, error: null } : { families: [], loading: true, error: null })

  useEffect(() => {
    if (sharedCatalog) return
    let alive = true
    loadCatalog()
      .then(families => {
        sharedCatalog = families
        if (alive) setState({ families, loading: false, error: null })
      })
      .catch(err => {
        /* Degrade to a small built-in list rather than leaving the picker
           unusable when the Worker is unreachable. */
        sharedCatalog = FALLBACK_FAMILIES
        if (alive) setState({ families: FALLBACK_FAMILIES, loading: false, error: err.message })
      })
    return () => { alive = false }
  }, [])

  return state
}

export default function FontPicker({ value, onChange, label, role }) {
  const { families, loading, error } = useFontCatalog()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(null)
  const [variableOnly, setVariableOnly] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const listRef = useRef(null)

  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => filterFamilies(families, { query: deferredQuery, category, variableOnly }),
    [families, deferredQuery, category, variableOnly]
  )

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const end = Math.min(results.length, Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + OVERSCAN)
  const visible = results.slice(start, end)

  /* Only fonts actually on screen get a stylesheet. */
  useEffect(() => {
    if (!open) return
    for (const f of visible) loadFont(f.family, { weights: [400], axes: null })
  }, [open, visible])

  useEffect(() => { if (open) setScrollTop(0), listRef.current && (listRef.current.scrollTop = 0) }, [deferredQuery, category, variableOnly, open])

  const current = families.find(f => f.family === value)

  const select = fam => {
    loadFont(fam.family, { axes: fam.axes })
    onChange(fam)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      {label && <label>{label}</label>}
      <button onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 12px',
          background: 'var(--surf3)', border: `1px solid ${open ? 'var(--accent)' : 'var(--bdr)'}`,
          borderRadius: 6, cursor: 'pointer', color: 'var(--text)', textAlign: 'left', fontFamily: 'var(--sans)',
        }}>
        <span style={{ flex: 1, fontSize: 14, fontFamily: value ? stackFor(value, current?.category) : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Choose a font'}
        </span>
        {current?.axes?.length > 0 && <span className="chip" style={{ color: 'var(--accent)' }}>VF</span>}
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: 'var(--muted)', alignSelf: 'center' }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }} />
          <div className="anim-pop" style={{
            /* One token with the catcher above. They are siblings and this one
               is second, so DOM order puts the list on top. */
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 'var(--z-dropdown)',
            background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,.5)', overflow: 'hidden',
          }}>
            <div style={{ padding: 8, borderBottom: '1px solid var(--bdr)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder={loading ? 'Loading catalogue…' : `Search ${families.length} families`} style={{ fontSize: 14 }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Segmented size="sm" value={category ?? 'all'} onChange={v => setCategory(v === 'all' ? null : v)}
                  options={[{ value: 'all', label: 'All' }, ...CATEGORIES.map(c => ({ value: c, label: c === 'sans-serif' ? 'Sans' : c === 'monospace' ? 'Mono' : c === 'handwriting' ? 'Script' : c[0].toUpperCase() + c.slice(1) }))]} />
                <button className={variableOnly ? 'seg-on' : 'seg'} onClick={() => setVariableOnly(v => !v)} style={{ fontSize: 12 }}>Variable</button>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>{results.length}</span>
              </div>
            </div>

            {error && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--warn)', borderBottom: '1px solid var(--bdr)' }}>
                Catalogue unavailable — showing a built-in shortlist.
              </div>
            )}

            <div ref={listRef} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
              style={{ height: VIEWPORT_H, overflowY: 'auto', position: 'relative' }}>
              {!results.length && !loading && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--dim)', fontSize: 12 }}>No families match.</div>
              )}
              <div style={{ height: results.length * ROW_H, position: 'relative' }}>
                {visible.map((f, i) => {
                  const idx = start + i
                  const active = f.family === value
                  return (
                    <button key={f.family} onClick={() => select(f)}
                      style={{
                        position: 'absolute', top: idx * ROW_H, left: 0, right: 0, height: ROW_H,
                        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
                        background: active ? 'rgb(var(--accent-rgb) / .12)' : 'none', border: 'none',
                        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}>
                      <span style={{ flex: 1, fontSize: 16, color: 'var(--text)', fontFamily: stackFor(f.family, f.category), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.family}
                      </span>
                      {f.axes?.length > 0 && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>VF</span>}
                      <span style={{ fontSize: 10, color: 'var(--dim)', width: 48, textAlign: 'right' }}>{f.category?.replace('-serif', '')}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
