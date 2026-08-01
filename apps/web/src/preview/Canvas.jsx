/* The preview pane. Injects the derived custom properties and the shared
   stylesheet, then renders whichever surface is selected inside them. */
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { PREVIEW_CSS, varsToStyle } from './tokens.js'
import { buildCssVars } from '../state/derive.js'
import Dashboard from './screens/Dashboard.jsx'
import Form from './screens/Form.jsx'
import Gallery from './Gallery.jsx'

const SURFACES = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'form',      label: 'Form',      Component: Form },
  { id: 'gallery',   label: 'Gallery',   Component: Gallery },
]

export default function Canvas() {
  const { state, derived, set } = useStore()
  const [surface, setSurface] = useState('dashboard')
  const mode = state.color.mode

  const setMode = next => set(s => ({ ...s, color: { ...s.color, mode: next } }), 'preview-mode')

  /* Rebuild vars for the mode being previewed rather than reusing
     derived.cssVars, so the toggle doesn't have to round-trip through state. */
  const vars = buildCssVars(derived, mode)
  const { Component } = SURFACES.find(s => s.id === surface) ?? SURFACES[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, background: 'var(--surf2)' }}>
      <style>{PREVIEW_CSS}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', flexShrink: 0,
      }}>
        {SURFACES.map(s => (
          <button key={s.id} onClick={() => setSurface(s.id)} className={surface === s.id ? 'seg-on' : 'seg'}>
            {s.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, background: 'var(--surf3)', padding: 2, borderRadius: 6, border: '1px solid var(--bdr)' }}>
          {['light', 'dark'].map(m => (
            <button key={m} onClick={() => setMode(m)} className={mode === m ? 'seg-on' : 'seg'} style={{ padding: '3px 10px' }}>
              {m === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div className="dmd" style={{ ...varsToStyle(vars), borderRadius: 10, border: '1px solid var(--bdr)' }}>
          <Component />
        </div>
      </div>
    </div>
  )
}
