/* The preview pane. Injects the derived custom properties and the shared
   stylesheet, then renders whichever surface is selected inside them. */
import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { CONTRAST_PAIRS } from '../state/schema.js'
import { check } from '../color/contrast.js'
import { PREVIEW_CSS, responsiveCss, varsToStyle } from './tokens.js'
import { buildCssVars } from '../state/derive.js'
import { gradientCss } from '../color/modes.js'
import CrossFade from '../ui/CrossFade.jsx'
import { inspectProps, role } from './inspect.js'
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
/* How the palette currently grades, beside the palette. Counts the same fixed
   pairs the Roles panel reports, in whichever mode is being previewed. */
function ContrastChip({ onOpen }) {
  const { state, derived } = useStore()
  const mode = state.color.mode
  const failing = CONTRAST_PAIRS.filter(p => {
    const r = check(derived.roles[mode][p.fg], derived.roles[mode][p.bg])
    return p.ui ? r.ratio < 3 : !r.pass
  }).length

  return (
    <button onClick={onOpen} title="Open the contrast checker"
      style={{
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'pointer',
        background: failing ? 'rgb(var(--danger-rgb) / .12)' : 'rgb(var(--success-rgb) / .10)',
        border: `1px solid ${failing ? 'rgb(var(--danger-rgb) / .35)' : 'rgb(var(--success-rgb) / .3)'}`,
        color: failing ? 'var(--danger)' : 'var(--success)',
        borderRadius: 6, padding: '3px 9px', fontSize: 11, fontFamily: 'var(--mono)',
      }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {failing ? `${failing} contrast` : 'Contrast OK'}
    </button>
  )
}

export default function Canvas({ onInspect, surface, setSurface, onOpenContrast }) {
  const { state, derived, set } = useStore()
  const [menu, setMenu] = useState(null)
  /* null = fill the pane, which is the honest default: the preview is not a
     device, it's a pane, and pretending otherwise invites reading exact
     pixel sizes off it. */
  const [width, setWidth] = useState(null)

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

  /* Below the smallest breakpoint, then just inside each declared one. A
     breakpoint you can't see the effect of is a number in a file. */
  const bps = state.layout?.breakpoints ?? []
  const widths = [
    { label: 'Fit', px: null, note: 'the full pane' },
    { label: `<${bps[0]?.px ?? 640}`, px: (bps[0]?.px ?? 640) - 24, note: `below ${bps[0]?.name ?? 'sm'}` },
    ...bps.map(b => ({ label: b.name, px: b.px, note: `at ${b.name}` })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, minHeight: 0, background: 'var(--surf2)' }}>
      <style>{PREVIEW_CSS}{responsiveCss(bps)}</style>

      {/* Height matches the editor tab strip so the two bars line up. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 42,
        borderBottom: '1px solid var(--bdr)', background: 'var(--surf)', flexShrink: 0,
      }}>
        {/* Says what the pane is.
            The editor side names itself with a wordmark and a tab strip; this
            side was six unlabelled buttons and a rendered page, which reads as
            part of the app rather than as a sample of the thing being
            designed. Set as a label rather than a tab so it cannot be mistaken
            for something to click, and separated by a rule so the surfaces
            still group as one control. */}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'default',
          userSelect: 'none',
        }}>
          Preview
        </span>
        <span style={{ width: 1, height: 16, background: 'var(--bdr2)', flexShrink: 0, marginRight: 2 }} />

        {/* Surfaces only. The controls that follow moved to their own line so
            these can have the width, and so a seventh surface does not push
            the light/dark toggle off the end. Room here for a pinned tab and
            chevrons the day this list outgrows the bar, matching the editor
            side. */}
        <div className="no-bar" style={{ display: 'flex', gap: 6, minWidth: 0, overflowX: 'auto' }}>
          {SURFACES.map(s => (
            <button key={s.id} onClick={() => setSurface(s.id)} style={{ flexShrink: 0 }}
              className={surface === s.id ? 'seg-on' : 'seg'}>
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Line two: how the surface is shown, rather than which surface.
          Same height and rules as the editor's action row, so the two panes
          stay on one grid. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38,
        borderBottom: '1px solid var(--bdr)', borderTop: '1px solid var(--bdr)',
        background: 'var(--surf)', flexShrink: 0,
      }}>
        {/* Widths come from the breakpoints this document actually declares,
            so the control tests the system rather than some generic set of
            phone sizes. Each snaps just inside its breakpoint — the point is
            to see the layout the breakpoint produces, not the boundary. */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--surf3)', padding: 2, borderRadius: 6, border: '1px solid var(--bdr)', flexShrink: 0 }}>
          {widths.map(w => (
            <button key={w.label} onClick={() => setWidth(w.px)}
              className={width === w.px ? 'seg-on' : 'seg'} style={{ padding: '2px 8px', fontSize: 11 }}
              title={w.px ? `${w.px}px — ${w.note}` : 'Fill the pane'}>
              {w.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 2, background: 'var(--surf3)', padding: 2, borderRadius: 6, border: '1px solid var(--bdr)', flexShrink: 0 }}>
          {['light', 'dark'].map(m => (
            <button key={m} onClick={() => setMode(m)} className={mode === m ? 'seg-on' : 'seg'} style={{ padding: '2px 10px' }}>
              {m === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Back beside the thing it describes. It was on the macro bar, which
            is where you set values, not where you look at them — and the
            palette it grades is the one rendering two inches below this. */}
        <ContrastChip onOpen={onOpenContrast} />
      </div>

      {/* Keyed on the mode as well as the surface: the custom properties live
          on the `.dmd` wrapper *inside* the fade, so the outgoing layer keeps
          the old palette and light↔dark genuinely cross-dissolves rather than
          snapping. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: 16 }}>
        {width && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>
            {width}px
          </div>
        )}
        {/* No transition on the width. Two reasons, and the second is the one
            that matters: animating a width forces a full relayout of every
            element in the preview on every frame, and a CSS transition only
            advances while the page is compositing — so in a pane that isn't
            being painted it sticks at its starting value and the surface
            silently never resizes. The same trap the exit animations hit. */}
        <CrossFade id={`${surface}:${mode}`}
          style={width ? { width, margin: '0 auto' } : undefined}>
          {/* The frame is what the container queries measure — see
              `responsiveCss`. It carries no padding of its own so the width
              the control asks for is the width the breakpoints see. */}
          <div className="dmd-frame">
            {/* The page itself is a token too. Clicking empty space lands on
                the `bg` role — which is also how you discover that the
                background is drawn from the neutral scale, since that is not
                guessable from looking at it. Inner elements stop propagation,
                so this only fires on genuinely blank areas. */}
            <div className="dmd" style={{ ...varsToStyle(vars), borderRadius: 10, border: '1px solid var(--bdr)' }}
              {...(onInspect ? inspectProps(role('bg', 'Page background · bg'), handleInspect) : {})}>
              {/* Every surface is inspectable, not just the gallery. */}
              <Component onInspect={onInspect ? handleInspect : undefined} layout={derived.componentLayout} />
            </div>
          </div>
        </CrossFade>
      </div>

      <TargetMenu menu={menu} onClose={() => setMenu(null)} onPick={t => onInspect?.(t)} />
    </div>
  )
}
