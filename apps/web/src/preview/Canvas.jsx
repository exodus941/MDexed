/* The preview pane. Injects the derived custom properties and the shared
   stylesheet, then renders whichever surface is selected inside them. */
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { PREVIEW_CSS, varsToStyle } from './tokens.js'
import { buildCssVars } from '../state/derive.js'
import { gradientCss } from '../color/modes.js'
import CrossFade from '../ui/CrossFade.jsx'
import { resolveRef } from '../color/ramp.js'
import Dashboard from './screens/Dashboard.jsx'
import Form from './screens/Form.jsx'
import Landing from './screens/Landing.jsx'
import Settings from './screens/Settings.jsx'
import Dialog from './screens/Dialog.jsx'
import Gallery from './Gallery.jsx'

export const SURFACES = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'landing',   label: 'Landing',   Component: Landing },
  { id: 'form',      label: 'Form',      Component: Form },
  { id: 'settings',  label: 'Settings',  Component: Settings },
  { id: 'dialog',    label: 'Overlays',  Component: Dialog },
  { id: 'gallery',   label: 'Gallery',   Component: Gallery },
]

/* When an element resolves to more than one place — a heading has a text style
   and a colour role, and it sits inside a card that has properties of its own
   — ask rather than guess. Entries the element owns come first; the containers
   it happens to sit inside come below a rule, so the common answer is the one
   under the cursor. */
const itemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)',
  fontFamily: 'var(--sans)', fontSize: 12.5, padding: '7px 8px', borderRadius: 6,
}

const KIND_LABEL = { component: 'Component', role: 'Colour', type: 'Type', group: 'Text' }

function MenuItem({ t, open, onOpen, onPick }) {
  const isGroup = t.kind === 'group'
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => onOpen(isGroup ? t : null)}>
      <button style={{ ...itemStyle, background: open ? 'var(--surf3)' : 'none' }}
        onClick={() => (isGroup ? onOpen(t) : onPick(t))}>
        <span style={{ flex: 1 }}>{t.label}</span>
        {isGroup && <span style={{ color: 'var(--muted)', fontSize: 11 }}>›</span>}
      </button>

      {isGroup && open && (
        <div className="anim-pop" style={{
          position: 'absolute', left: '100%', top: -5, marginLeft: 3, zIndex: 802,
          background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 9,
          boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: 5, minWidth: 200,
        }}>
          {t.children.map(child => (
            <button key={`${child.kind}:${child.target}`} style={itemStyle} onClick={() => onPick(child)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surf3)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
              {child.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TargetMenu({ menu, onPick, onClose }) {
  const [openGroup, setOpenGroup] = useState(null)
  useEffect(() => { setOpenGroup(null) }, [menu])
  if (!menu) return null

  const own = menu.targets.filter(t => t.from !== 'container')
  const containers = menu.targets.filter(t => t.from === 'container')
  const pick = t => { onPick(t); onClose() }

  const section = (title, list) => list.length > 0 && (
    <>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', padding: '5px 8px 6px' }}>
        {title}
      </div>
      {list.map(t => (
        <MenuItem key={`${t.kind}:${t.target}`} t={t}
          open={openGroup === t} onOpen={setOpenGroup} onPick={pick} />
      ))}
    </>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800 }} />
      <div className="anim-pop" style={{
        position: 'fixed', left: Math.min(menu.x, window.innerWidth - 280), top: Math.min(menu.y + 8, window.innerHeight - 40 - menu.targets.length * 32),
        zIndex: 801,
        background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 9,
        boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: 5, minWidth: 240,
      }}>
        {section('Edit what?', own)}
        {containers.length > 0 && (
          <div style={{ borderTop: '1px solid var(--bdr)', margin: '5px 0 0' }}>
            {section('Inside', containers)}
          </div>
        )}
      </div>
    </>
  )
}

/* Which surface is showing is lifted to the shell: the header's HTML export
   has to render whatever is currently on screen, and it can't ask for state
   that lives down here. */
export default function Canvas({ onInspect, surface, setSurface }) {
  const { state, derived, set } = useStore()
  const [menu, setMenu] = useState(null)

  /* Straight through when the element itself has exactly one destination — a
     button should still be one click, even though the card behind it is now
     also on offer. Anything ambiguous (a run of text, which has both a font
     and a colour) gets the menu, and the menu carries the containers too. */
  const handleInspect = (targets, e) => {
    const own = targets.filter(t => t.from !== 'container')
    if (own.length === 1 && own[0].kind !== 'group') { onInspect?.(own[0]); return }
    setMenu({ x: e.clientX, y: e.clientY, targets })
  }
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

      {/* Keyed on the mode as well as the surface: the custom properties live
          on the `.dmd` wrapper *inside* the fade, so the outgoing layer keeps
          the old palette and light↔dark genuinely cross-dissolves rather than
          snapping. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: 16 }}>
        <CrossFade id={`${surface}:${mode}`}>
          <div className="dmd" style={{ ...varsToStyle(vars), borderRadius: 10, border: '1px solid var(--bdr)' }}>
            {/* Every surface is inspectable, not just the gallery. */}
            <Component onInspect={onInspect ? handleInspect : undefined} layout={derived.componentLayout} />
          </div>
        </CrossFade>
      </div>

      <TargetMenu menu={menu} onClose={() => setMenu(null)} onPick={t => onInspect?.(t)} />
    </div>
  )
}
