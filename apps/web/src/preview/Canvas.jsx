/* The preview pane. Injects the derived custom properties and the shared
   stylesheet, then renders whichever surface is selected inside them. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { CONTRAST_PAIRS } from '../state/schema.js'
import { check } from '../color/contrast.js'
import { audit } from '../a11y/audit.js'
import { Finding } from '../a11y/PanelAlerts.jsx'
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
import { viewport } from '../ui/zoom.js'

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

  /* All four numbers in the same space. `menu.x/y` come from a pointer event
     and the viewport bounds from `window`, both of which are reported with the
     UI scale already in them — while `left`/`top` are lengths on an element
     that the scale is about to multiply. Convert once, at the boundary. */
  const vp = viewport()

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800 }} />
      <div className="anim-pop" style={{
        position: 'fixed',
        left: Math.min(vp.x(menu.x), vp.w - 280),
        top: Math.min(vp.x(menu.y) + 8, vp.h - 40 - menu.targets.length * 32),
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
/* A tick in a circle for the all-clear, a dot for anything else.
 *
 * Both chips used the same 6px dot in whichever colour applied, so "Contrast
 * OK" and "3 warnings" were the same mark twice and you had to read the words
 * to tell them apart. A tick is what a pass looks like; it also means the good
 * state survives being seen in greyscale, which is the rule the audit next to
 * it is enforcing. */
function ChipMark({ ok }) {
  if (!ok) return <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M4.9 8.2l2.1 2.1 4.1-4.4" stroke="var(--surf)" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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
      <ChipMark ok={!failing} />
      {failing ? `${failing} contrast` : 'Contrast OK'}
    </button>
  )
}

/* Everything the audit found, beside the thing it is judging.
 *
 * This was a tab. A tab is somewhere you go, and nobody goes to an
 * accessibility tab — and once there, four fifths of the page was a fixed
 * list of requirements that never changed no matter what you did, so it read
 * as static even though the findings underneath it were live.
 *
 * The requirements were never for the screen anyway. They go into the
 * exported file, where an agent reads them; keeping a copy here to be
 * scrolled past was the mistake. What is left is the part that is actually
 * about *your* system, and it belongs next to the contrast chip because both
 * answer the same question: is what I am looking at all right.
 *
 * Green when clean, because a system with nothing wrong should say so rather
 * than showing a zero.
 */
function WarningsChip({ onJump }) {
  const { state, derived } = useStore()
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const btnRef = useRef(null)

  const findings = useMemo(() => audit(state, derived), [state, derived])
  const fails = findings.filter(f => f.level === 'fail')
  const rest = findings.filter(f => f.level !== 'fail')
  const count = findings.length

  useEffect(() => {
    if (!open) return
    const inside = t => boxRef.current?.contains(t) || btnRef.current?.contains(t)
    const onDown = e => { if (!inside(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /* A failure is a documented violation and reads red. Warnings are amber.
     Nothing at all is green and says so in words. */
  const tone = fails.length ? 'danger' : count ? 'warn' : 'success'
  const label = fails.length
    ? `${fails.length} failing`
    : count ? `${count} warning${count === 1 ? '' : 's'}` : 'No warnings'

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button ref={btnRef} onClick={() => setOpen(o => !o)} aria-expanded={open}
        title={count ? 'What the accessibility audit found in this system' : 'The accessibility audit found nothing'}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
          background: `rgb(var(--${tone}-rgb) / .12)`,
          border: `1px solid rgb(var(--${tone}-rgb) / .35)`,
          color: `var(--${tone})`,
          borderRadius: 6, padding: '3px 9px', fontSize: 11, fontFamily: 'var(--mono)',
        }}>
        <ChipMark ok={count === 0} />
        {label}
      </button>

      {open && count > 0 && (
        /* Wide enough that the criterion line — a citation like "2.3.3
           Animation from interactions (AAA)" — sits on one line beside the
           Fix it button, and capped against the viewport so a narrow preview
           pane shrinks it rather than pushing it off-screen. */
        <div ref={boxRef} className="anim-pop" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 500,
          background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 10,
          boxShadow: '0 12px 32px var(--shade)',
          width: 'min(440px, calc(100vw - 40px))', maxHeight: 460, overflowY: 'auto',
        }}>
          <div style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700,
            color: 'var(--text-dim)', padding: '11px 14px 10px', borderBottom: '1px solid var(--bdr)',
            position: 'sticky', top: 0, background: 'var(--surf2)', zIndex: 1,
          }}>
            Accessibility {fails.length ? 'Findings' : 'Warnings'}
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...fails, ...rest].map(f => (
              <Finding key={f.id} f={f} action={f.tab && (
                <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 10.5, flexShrink: 0 }}
                  onClick={() => { onJump?.(f.tab, f.entry); setOpen(false) }}>
                  Fix it
                </button>
              )} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Canvas({ onInspect, surface, setSurface, onOpenContrast, onJump }) {
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
        <WarningsChip onJump={onJump} />
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
        {/* The surface's own scale, cancelling the body zoom it sits inside.
         *
         * `--ui-zoom` is already applied by the time anything here is drawn,
         * so dividing it out and multiplying by `--preview-zoom` leaves the
         * surface at exactly the preview scale — 1 by default, meaning one
         * preview pixel is one screen pixel however large the chrome is. The
         * width label above stays outside this: it reports the surface's
         * logical width, which is a fact about the layout rather than part of
         * it, and belongs with the chrome. */}
        <CrossFade id={`${surface}:${mode}`}
          style={{
            zoom: 'calc(var(--preview-zoom, 1) / var(--ui-zoom, 1))',
            ...(width ? { width, margin: '0 auto' } : null),
          }}>
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
