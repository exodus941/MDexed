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
import { Strut } from '../ui/controls.jsx'
import TabStrip from '../ui/TabStrip.jsx'
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
/* Two buttons, because there are two kinds of finding.
 *
 * Some carry a remedy the app worked out for itself — it knows which ramp the
 * role sits on and which step separates it, so pressing the button changes the
 * document. That one is Fix It, with a wand.
 *
 * The rest need you: a judgement about size, or wording, or which of two
 * colours should move. Sending you to the control is all the app can honestly
 * do, so the button says Investigate and Repair and carries a wrench. Naming
 * the difference matters — a Fix It that only scrolls teaches people the button
 * does nothing. */
const Wand = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
    <path d="m14 7 3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9" />
  </svg>
)
/* Lucide's own wrench and wand rather than an approximation of them. The
   document names Lucide as the icon library, and the first pair I drew by hand
   read as a blob and a stick. Drawn at 12px, where the spanner's open jaw still
   reads. */
const Wrench = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)
function WarningsChip({ onJump, onApply }) {
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
              <Finding key={f.id} f={f} action={(f.apply || f.tab) && (
                <button className="btn-ghost" title={f.apply ? f.apply.label : 'Open the control that causes this'}
                  style={{ padding: '2px 8px', fontSize: 10.5, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    if (f.apply) { onApply?.(f.apply); return }
                    onJump?.(f.tab, f.entry); setOpen(false)
                  }}>
                  {f.apply ? <Wand /> : <Wrench />}
                  <span className="lbl">{f.apply ? 'Fix It' : 'Investigate and Repair'}</span>
                </button>
              )} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Canvas({ onInspect, surface, setSurface, onOpenContrast, onJump, onApply, compact }) {
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

      {/* The day this list outgrew the bar arrived.
          This was a hand-rolled scroller: no chevrons, no overflow menu, and
          the last surfaces ran off the end with nothing to say so. It now uses
          the same TabStrip the editor uses, which is why that component moved
          out of App.jsx — Canvas is imported *by* App.jsx, so it could never
          have reached it there without a cycle. One strip, one set of overflow
          behaviour, both panes. */}
      <TabStrip
        tabs={SURFACES} active={surface} onSelect={setSurface}
        title={compact ? null : 'Preview'}
        actions={
          <>
            {/* Widths come from the breakpoints this document actually declares,
                so the control tests the system rather than a generic set of
                phone sizes. Each snaps just inside its breakpoint, because the
                point is to see the layout the breakpoint produces rather than
                the boundary itself.

                A select rather than a run of segments. There is one entry per
                breakpoint plus two, so a document with six breakpoints put
                eight buttons in a row that also has to hold the theme toggle
                and two status chips. It fitted on a wide desktop and nowhere
                else. */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Width</span>
              <select
                value={width == null ? '' : String(width)}
                onChange={e => setWidth(e.target.value === '' ? null : Number(e.target.value))}
                title="How wide to draw the surface"
                /* Sized to its own longest option rather than squeezed to
                   whatever the row had left. `2px 6px` gave the value nowhere
                   to sit and the arrow no clearance, so a label like
                   "2xl · 1536px" was cut off inside its own box. */
                style={{ width: 'auto', minWidth: 116, fontSize: 11 }}>
                {widths.map(w => (
                  <option key={w.label} value={w.px == null ? '' : String(w.px)}>
                    {w.label}{w.px ? ` · ${w.px}px` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="seg-box" style={{ display: 'flex', gap: 2, background: 'var(--surf3)', padding: 2, borderRadius: 6, border: '1px solid var(--bdr)', flexShrink: 0 }}>
              {['light', 'dark'].map(m => (
                <button key={m} onClick={() => setMode(m)} className={mode === m ? 'seg-on' : 'seg'} style={{ padding: '2px 10px' }}>
                  {m === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Back beside the thing it describes. It was on the macro bar,
                which is where you set values, not where you look at them — and
                the palette it grades is the one rendering two inches below.

                On a phone they leave this row entirely. Four controls in 375px
                left the Width select too narrow to show its own value, and a
                control that cannot display what it is set to is broken. They
                move down to the surface's own edge, where there is room and
                where they are still beside what they grade. */}
            {!compact && (
              <>
                <ContrastChip onOpen={onOpenContrast} />
                <WarningsChip onJump={onJump} onApply={onApply} />
              </>
            )}
          </>
        } />

      {/* Keyed on the mode as well as the surface: the custom properties live
          on the `.dmd` wrapper *inside* the fade, so the outgoing layer keeps
          the old palette and light↔dark genuinely cross-dissolves rather than
          snapping. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: 16 }}>
        {/* The readout sits on the surface's own left edge rather than centred
            in the pane, so it reads as a label for the thing below it. On a
            phone the two status chips join it on the right edge of that same
            box — they were squeezing the Width select out of the toolbar, and
            here they line up with the page they describe.

            Constrained to the surface width when there is one, so both ends
            land on the surface's edges and not the pane's. */}
        {(width || compact) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, marginBottom: 6,
            ...(width ? { width, marginLeft: 'auto', marginRight: 'auto' } : null),
          }}>
            {/* Says "Fit" rather than nothing when there is no fixed width.
                An empty slot reads as a missing value, and the readout is the
                one place that reports what the surface is actually doing. */}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>
              {width ? `${width}px` : 'Fit'}
            </span>
            {compact && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <ContrastChip onOpen={onOpenContrast} />
                <WarningsChip onJump={onJump} onApply={onApply} />
              </span>
            )}
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
