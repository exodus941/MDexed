/* The preview pane. Injects the derived custom properties and the shared
   stylesheet, then renders whichever surface is selected inside them. */
import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { PREVIEW_CSS, varsToStyle } from './tokens.js'
import { buildCssVars } from '../state/derive.js'
import { gradientCss } from '../color/modes.js'
import { resolveRef } from '../color/ramp.js'
import Dashboard from './screens/Dashboard.jsx'
import Form from './screens/Form.jsx'
import Landing from './screens/Landing.jsx'
import Settings from './screens/Settings.jsx'
import Gallery from './Gallery.jsx'

const SURFACES = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'landing',   label: 'Landing',   Component: Landing },
  { id: 'form',      label: 'Form',      Component: Form },
  { id: 'settings',  label: 'Settings',  Component: Settings },
  { id: 'gallery',   label: 'Gallery',   Component: Gallery },
]

export default function Canvas({ onInspect }) {
  const { state, derived, set } = useStore()
  const [surface, setSurface] = useState('dashboard')
  const mode = state.color.mode

  const setMode = next => set(s => ({ ...s, color: { ...s.color, mode: next } }), 'preview-mode')

  /* Rebuild vars for the mode being previewed rather than reusing
     derived.cssVars, so the toggle doesn't have to round-trip through state. */
  /* Gradients resolve against the mode being previewed, not the stored one. */
  const vars = buildCssVars({
    ...derived,
    elevationCfg: state.elevation,
    gradients: derived.gradients.map(g => ({ ...g, css: gradientCss(g, { roles: derived.roles[mode], ramps: derived.ramps, resolveRef }) })),
  }, mode)
  const { Component } = SURFACES.find(s => s.id === surface) ?? SURFACES[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, minHeight: 0, background: 'var(--surf2)' }}>
      <style>{PREVIEW_CSS}</style>

      {/* Height matches the editor tab strip so the two bars line up. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 42,
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

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: 16 }}>
        <div className="dmd" style={{ ...varsToStyle(vars), borderRadius: 10, border: '1px solid var(--bdr)' }}>
          {/* Every surface is inspectable, not just the gallery. */}
          <Component onInspect={onInspect} />
        </div>
      </div>
    </div>
  )
}
