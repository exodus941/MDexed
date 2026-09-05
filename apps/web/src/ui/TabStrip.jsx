/* The tab strip, its overflow chevrons, and the scroll test they share.
 *
 * Lifted out of App.jsx so the preview pane can use it too. It lived beside
 * the shell, and Canvas is imported *by* the shell, so the preview could not
 * reach it without a cycle — which is why the preview grew its own switcher
 * with no chevrons and no overflow menu, and why its tabs ran off the end.
 *
 * `scrollableUnder` is exported because the header menus need the same test:
 * a wheel event that would move something is a scroll aimed past the menu, so
 * the menu gets out of the way. One that would not is not.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Strut } from './controls.jsx'

/* ── Tab strip ──
   Same height as the preview pane's surface bar so the two line up across the
   split. The strip scrolls without a visible scrollbar — chevrons appear only
   when there's actually something off-screen in that direction. */
const BAR_H = 44

/* Every tab label in the strip, so the pane title's strut can't drift out of
   step with the thing it is aligning to. Matches `.seg`, which sizes the
   surface buttons on the preview side: the two bars sit on one line across the
   split, so a different size here would put EDITOR and PREVIEW on two
   different baselines however well each aligned to its own tabs. */
const TAB_FS = 12

/* One number for the chevron's width, because two things depend on it: the
   button itself, and the padding that keeps a tab from resting underneath it.
   Written twice, they drift, and the tab that ends up half-covered is the one
   nobody thinks to measure. */
/* 44, matching the strip's own height, because a chevron is an ICON-ONLY
   control and those are square. At 40 it measured 40x44 and read as a button
   whose label failed to load. The strip is the only thing that sets the
   height, so the width follows it rather than the other way round. */
const CHEVRON_W = 44

/* Pixels per 16ms tick at the inner and outer edges of a chevron, so roughly
   78 to 780 px/s. The floor is slow enough to walk a tab into place one at a
   time; the ceiling crosses the whole strip in well under a second. A ten to
   one spread sounds extreme written down, and reads as one control rather
   than two, because the position you pick is the speed you get. */
const SCROLL_SLOW = 1.25
const SCROLL_FAST = 12.5

/* How long the strip takes to reach whatever speed you asked for.
 *
 * Landing on a chevron used to start at full speed on the first tick, which
 * reads as a jolt rather than a movement — the strip is already travelling
 * before the eye has found what it is travelling past. A short ramp fixes it
 * without costing anything: at 180ms you never wait for the scroll, but the
 * start has a beginning.
 *
 * The ramp is a *duration*, not a fixed acceleration, so the run-up takes the
 * same time whether you asked for 1.25 or 12.5 — pick the fast edge and it
 * still spends 180ms getting there rather than arriving instantly because the
 * target happened to be close. It applies in both directions, so sliding back
 * toward the inner edge eases down instead of dropping.
 *
 * Leaving the chevron still stops dead. That is a release, not a deceleration,
 * and coasting after the pointer has gone is the behaviour that made these
 * feel broken when they scrolled on forever. */
const SCROLL_RAMP_MS = 180
const SCROLL_TICK_MS = 16
/* Is there anything under here that a wheel would actually move?
 *
 * Walks up looking for an element that both overflows and is allowed to
 * scroll. `overflow: auto` on a box whose content fits is not scrollable, and
 * that is the case worth catching: a short panel needs no scrollbar, so a
 * wheel over it does nothing and should not count as an interaction. */
export function scrollableUnder(node) {
  for (let el = node; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue
    const overflow = getComputedStyle(el).overflowY
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return true
  }
  return document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
}

/* Declared here rather than inside TabStrip.
 *
 * A component defined in a render body is a new component *type* on every
 * render, so React unmounts and remounts it rather than updating it. That was
 * survivable while these were click-only. It stopped being survivable once
 * they scrolled on hover: the button under the cursor was replaced mid-scroll,
 * and the pointerleave that should have stopped it fired on a node that no
 * longer existed. The scroll ran on with the cursor somewhere else entirely. */
/*
 * Three states, because a control must not vanish from under the cursor.
 *
 *   live     there is somewhere to go; hovering scrolls
 *   spent    the end has been reached, but the pointer is still here, so it
 *            stays put and dims instead of disappearing mid-gesture
 *   leaving  the pointer has gone; fade out and collapse to nothing
 *
 * The middle state is the whole point. Reaching the end used to unmount the
 * button instantly, which yanked it out from under the cursor and snapped
 * 40px of tabs sideways in the same frame. Now the end of travel is just a
 * change of appearance, and the layout only moves once you have stopped
 * pointing at the thing that is about to move.
 *
 * The exit animates `width` rather than opacity alone: collapsing the flex
 * item is what lets the tabs slide into the space, and doing it in the same
 * keyframe as the fade means the gap closes exactly as the button goes.
 */
function Chevron({ dir, state, onEnter, onLeave, onClick }) {
  const spent = state === 'spent'
  return (
    <button data-chevron={dir} title={dir < 0 ? 'Scroll left' : 'Scroll right'}
      onClick={spent ? undefined : onClick} disabled={spent}
      onPointerEnter={spent ? undefined : onEnter} onPointerLeave={onLeave} onPointerCancel={onLeave}
      className={state === 'leaving' ? 'chev chev-out' : 'chev'}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: dir < 0 ? 'flex-start' : 'flex-end',
        width: CHEVRON_W, height: '100%', border: 'none',
        cursor: spent ? 'default' : 'pointer',
        opacity: state === 'leaving' ? 0 : spent ? 0.3 : 1,
        color: 'var(--muted)', padding: dir < 0 ? '0 0 0 12px' : '0 12px 0 0',
        /* Wide hit area, with a fade so tabs slide under it rather than
           colliding with a hard edge. */
        background: `linear-gradient(to ${dir < 0 ? 'right' : 'left'}, var(--surf) 55%, transparent)`,
      }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir < 0 ? 'rotate(180deg)' : 'none' }}>
        <polyline points="9 6 15 12 9 18" />
      </svg>
    </button>
  )
}

export default function TabStrip({ tabs, active, onSelect, right, title, actions }) {
  const ref = useRef(null)

  /* The wheel's glide, held where the chevron can reach it.
   *
   * Only one thing may drive `scrollLeft` at a time. Whoever starts second
   * cancels the first, and the chevron starts second by definition — you
   * cannot hover it without having stopped turning the wheel. */
  const glideTarget = useRef(null)
  const glideFrame = useRef(0)
  const cancelGlide = useCallback(() => {
    if (glideFrame.current) cancelAnimationFrame(glideFrame.current)
    glideFrame.current = 0
    glideTarget.current = null
  }, [])

  const [edges, setEdges] = useState({ left: false, right: false })
  const [menuOpen, setMenuOpen] = useState(false)
  /* What each chevron is doing, which lags `edges` on purpose: null, 'live',
     'spent' or 'leaving'. See the Chevron comment for why. */
  const [phase, setPhase] = useState({ left: null, right: null })
  const [hovered, setHovered] = useState(null)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  /* Pinned only when the tabs will not all fit. Mirrored into a ref because
     `measure` runs on scroll and resize and must read the current value
     without being rebuilt — a new callback identity there remounts the
     chevrons mid-scroll, which is the bug the comment above `measure`
     describes. */
  const [pinned, setPinned] = useState(false)
  const pinnedRef = useRef(false)
  const activeWRef = useRef(0)
  const triggerWRef = useRef(0)

  /* Dismissal, without a click-catching overlay.
   *
   * This used to be a fixed, full-screen div at z-index 70. It caught the
   * outside click, and it also caught the wheel: the cursor was over the
   * editor or the preview, but the event landed on an element that could not
   * scroll, so neither pane moved and the menu just sat there.
   *
   * Listening on the document instead leaves both panes uncovered, so a wheel
   * scrolls the thing under the cursor natively. All this has to do is get
   * out of the way, which is what closing on the same gesture achieves.
   *
   * `passive` on the wheel listener because it never calls preventDefault:
   * the scroll is the browser's to perform, and marking it passive means the
   * browser does not have to wait on this handler before doing it. */
  useEffect(() => {
    if (!menuOpen) return
    const inside = t => menuRef.current?.contains(t) || triggerRef.current?.contains(t)
    const onDown = e => { if (!inside(e.target)) setMenuOpen(false) }
    /* Close only when the wheel is going to move something.
     *
     * Closing on every wheel meant a flick over a pane that already fitted on
     * screen dismissed the menu for nothing. The gesture had no effect, so it
     * should not have had a side effect either. Over the menu itself is the
     * exception: nothing there scrolls, but the wheel is plainly aimed at what
     * the menu is covering, so it gets out of the way. */
    const onWheel = e => {
      if (menuRef.current?.contains(e.target) || scrollableUnder(e.target)) setMenuOpen(false)
    }
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('wheel', onWheel, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('wheel', onWheel)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  /* Only writes state when an edge actually flips.
   *
   * It used to hand back a fresh object every call, which re-rendered the
   * strip on every scroll event. Harmless at one call per wheel tick, not
   * harmless once hover-scrolling calls it sixty times a second: the chevrons
   * remounted on every frame, and the pointerleave that should have stopped
   * the scroll landed on a node that had already been replaced. */
  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const next = {
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    }
    setEdges(prev => (prev.left === next.left && prev.right === next.right ? prev : next))

    /* Does this strip need the pinned tab at all?
     *
     * The pinned tab exists so the active one never scrolls out of reach. When
     * every tab already fits, it earns nothing and costs a duplicate: the same
     * name appears once beside its chevron and again in the row.
     *
     * The measurement has to survive its own effect. Pinning removes the active
     * tab from the strip, which makes the content narrower, which could unpin,
     * which puts the tab back — a strip that flickers between two states at one
     * particular width. So both sides of the comparison are adjusted back to
     * the unpinned layout: add the active tab's width to what is needed, and
     * add the trigger's width to what is available. Then the question asked is
     * always "would the plain bar fit", whichever state we are currently in.
     *
     * Plus 24px of hysteresis on the way out, so dragging a splitter across the
     * threshold settles instead of oscillating. */
    const activeBtn = el.querySelector('[data-active="1"]')
    if (activeBtn) activeWRef.current = activeBtn.offsetWidth
    const triggerW = triggerRef.current ? triggerRef.current.parentElement.offsetWidth : 0
    if (triggerW) triggerWRef.current = triggerW
    const needed = el.scrollWidth + (pinnedRef.current ? activeWRef.current : 0)
    const room = el.clientWidth + (pinnedRef.current ? triggerWRef.current : 0)
    setPinned(was => {
      const next2 = was ? needed > room - 24 : needed > room + 1
      pinnedRef.current = next2
      return next2 === was ? was : next2
    })
  }, [])

  /* The wheel scrolls the strip sideways.
   *
   * A vertical wheel does nothing to a horizontal scroller on its own —
   * measured before this existed: three notches over the tabs left
   * `scrollLeft` at 0. The only ways across the strip were the chevrons and a
   * touchpad, which is a poor deal for anyone on a mouse.
   *
   * Wheel up scrolls LEFT, wheel down scrolls right. Up and left are both
   * "back towards the start", so the two gestures agree.
   *
   * A horizontal swipe keeps its own direction and is not remapped. Only the
   * vertical wheel is an arbitrary mapping onto a sideways axis. Inverting a
   * gesture that already has a direction would make a touchpad feel broken.
   *
   * Bound here rather than with `onWheel`, because React attaches wheel
   * listeners passively and `preventDefault` is a no-op inside one. It matters:
   * without it the page scrolls as well and the tabs slide while the panel
   * underneath moves too.
   *
   * The listener sits on the scroller, and the chevrons are its flex siblings
   * rather than its children — so hovering a chevron never reaches this, which
   * is what was asked for and needs no test on the target.
   *
   * Only prevents the default when the strip actually moved. At either end the
   * gesture falls through to the page, so the wheel never feels trapped.
   *
   * Each notch glides rather than jumps. The animation chases a target that
   * the wheel moves, so notches compound into one longer glide instead of
   * restarting a tween three times. */
  useEffect(() => {
    const el = ref.current
    if (!el) return

    /* Where the strip is heading, which is not where it is. Each notch adds to
       this and the loop chases it, so three quick notches compound into one
       longer glide instead of three fights over the same property.
     *
     * In refs, not closure variables, because the chevron's loop has to be
     * able to STOP this one. Two animations writing `scrollLeft` together do
     * not average out — they fight, and the one with the bigger step wins by a
     * few pixels a frame. Measured with a glide still running: a chevron
     * asking for 6px a tick moved the strip 8px in half a second instead of
     * 180, and reversed direction twice doing it. That is the jitter, and the
     * "works about half the time" is whether the glide had already finished. */

    /* Exponential ease-out: close a fixed fraction of the remaining distance
       each frame. Fast at the start, slow at the end, and it settles wherever
       the target moved to mid-flight without restarting.
     *
     * The fraction comes from the chrome's own duration token rather than a
     * number picked here, because an interface that publishes a motion scale
     * should move on it. --t is 125ms; a time constant of a third of that puts
     * roughly 95% of the distance inside the stated duration. */
    const glideMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--t')) || 125
    /* Three time constants is about 95% of the distance, so the glide is over
       within `glideMs`. That is the number to change: it is milliseconds, and
       the token it reads is 125. */
    const tau = Math.max(16, glideMs / 3)
    const closePerFrame = 1 - Math.exp(-16 / tau)

    const tick = () => {
      const target = glideTarget.current
      if (target == null) { glideFrame.current = 0; return }
      const remaining = target - el.scrollLeft
      /* Under half a pixel there is nothing left to see. Land exactly, so the
         edge test that drives the chevrons gets a whole number. */
      if (Math.abs(remaining) < 0.5) {
        el.scrollLeft = target
        glideTarget.current = null
        glideFrame.current = 0
        return
      }
      el.scrollLeft += remaining * closePerFrame
      glideFrame.current = requestAnimationFrame(tick)
    }

    const onWheel = e => {
      /* Whichever axis the gesture leads with. A touchpad swipe reports
         deltaX, a mouse reports deltaY, and both mean the same thing here. */
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!raw) return
      /* deltaMode 1 counts lines, not pixels. A mouse that reports lines moved
         the strip by three pixels a notch without this. */
      const step = e.deltaMode === 1 ? raw * 16 : e.deltaMode === 2 ? raw * el.clientWidth : raw

      const max = el.scrollWidth - el.clientWidth
      const from = glideTarget.current == null ? el.scrollLeft : glideTarget.current
      const next = Math.max(0, Math.min(max, from + step))
      /* Already against that end, so let the page have the gesture. */
      if (next === from) return

      glideTarget.current = next
      e.preventDefault()
      if (!glideFrame.current) glideFrame.current = requestAnimationFrame(tick)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      cancelGlide()
    }
  }, [])

  /* Drive the phases off the edges and the pointer.
   *
   * The only interesting transition is losing an edge: if the pointer is on
   * that chevron it goes `spent` and holds its place, otherwise it starts
   * leaving immediately. Regaining an edge always goes straight back to
   * `live`, including mid-exit, so scrolling back the other way catches a
   * half-faded chevron rather than waiting for it to finish disappearing. */
  useEffect(() => {
    setPhase(prev => {
      const next = { ...prev }
      for (const side of ['left', 'right']) {
        if (edges[side]) next[side] = 'live'
        else if (prev[side] === 'live' || prev[side] === 'spent') {
          next[side] = hovered === side ? 'spent' : 'leaving'
        }
      }
      return next.left === prev.left && next.right === prev.right ? prev : next
    })
  }, [edges, hovered])

  /* Unmount once the exit has played. The duration is read live rather than
     captured, so turning UI animation off mid-exit doesn't strand a chevron
     at zero width. */
  useEffect(() => {
    const going = ['left', 'right'].filter(s => phase[s] === 'leaving')
    if (!going.length) return
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    const t = setTimeout(() => {
      setPhase(prev => {
        const next = { ...prev }
        for (const s of going) if (next[s] === 'leaving') next[s] = null
        return next.left === prev.left && next.right === prev.right ? prev : next
      })
    }, ms)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure, tabs.length, active])

  const nudge = dir => ref.current?.scrollBy({ left: dir * 160, behavior: 'smooth' })

  /* ── Hover to scroll ──
   *
   * Pointing at a chevron scrolls for as long as you stay there, rather than
   * making you click once per 160px. The tab strip is a queue you are looking
   * *through*, so the gesture should be "keep going" — clicking repeatedly to
   * travel in one direction is the interaction equivalent of a stuck key.
   *
   * A timer rather than requestAnimationFrame: rAF is throttled whenever the
   * page isn't compositing, which this codebase has already been caught by
   * twice. `behavior: auto` because the steps are small and frequent — smooth
   * scrolling on top of a 16ms tick fights itself and stutters.
   *
   * The timer lives here rather than in `Chevron` because `Chevron` is
   * redefined on every render, so React remounts it each time and any
   * interval it owned would be torn down mid-scroll.
   */
  const scroller = useRef(0)
  /* Two speeds, and the distinction is the whole of the ramp.
     `target` is what the pointer's depth into the chevron is asking for and
     can change every frame; `actual` is what the strip is doing and is only
     allowed to close the gap so fast. */
  const target = useRef(SCROLL_SLOW)
  const actual = useRef(0)
  const stopScroll = useCallback(() => { clearInterval(scroller.current); scroller.current = 0 }, [])
  const startScroll = useCallback(dir => {
    stopScroll()
    /* Take sole ownership of scrollLeft. A wheel glide still in flight would
       otherwise keep pulling the strip back towards where the wheel left off,
       and the two would trade pixels for as long as the pointer stayed on the
       chevron. */
    cancelGlide()
    /* Start slow. The pointermove below corrects within a frame, but without
       this the first tick would inherit whatever speed the other chevron was
       left at. */
    target.current = SCROLL_SLOW
    /* From a standstill every time, so the ramp is a property of arriving at
       a chevron rather than of whichever one you were last on. */
    actual.current = 0
    scroller.current = setInterval(() => {
      const el = ref.current
      if (!el) return stopScroll()
      const want = target.current
      /* Scaled to the faster of the two, not to the target alone. Off the
         target only, slowing down crawls — dropping from 12.5 to 1.25 in steps
         sized for 1.25 takes a second and a half, so pulling back off the edge
         would leave the strip still racing.
         *
         Speeding up is then linear and reaches any target in ~180ms. Slowing
         down eases out instead, because the step shrinks with the speed: about
         400ms from the fast end to the slow one, front-loaded. That asymmetry
         is the right way round — you want the response to your asking for
         speed to be prompt, and the coast back down to feel like lifting off
         rather than braking. */
      const step = Math.max(want, actual.current) * (SCROLL_TICK_MS / SCROLL_RAMP_MS)
      actual.current = actual.current < want
        ? Math.min(want, actual.current + step)
        : Math.max(want, actual.current - step)
      el.scrollBy({ left: dir * actual.current, behavior: 'auto' })
      measure()
    }, SCROLL_TICK_MS)
  }, [stopScroll, measure, cancelGlide])

  /* One listener owns everything that depends on where the pointer is:
     whether to scroll, how fast, and which chevron is being pointed at.
     Splitting those across three handlers means three answers that can
     disagree by a frame.

     It has to be a window listener rather than the button's own
     `pointerleave`. A chevron can leave from under a stationary cursor when
     the strip stops overflowing, the pointer can leave the window entirely,
     and a remount swaps the node any element listener was bound to. All three
     end with the strip scrolling on its own, which is the failure that makes
     this worse than the clicks it replaced. */
  useEffect(() => {
    const check = e => {
      const chevron = e.target?.closest?.('[data-chevron]')
      if (!chevron) { stopScroll(); setHovered(null); return }
      const dir = Number(chevron.dataset.chevron)
      /* Which side, so a chevron that runs out of travel while you are on it
         knows to hold its place rather than disappear mid-gesture. */
      setHovered(dir < 0 ? 'left' : 'right')
      /* Faster the closer you are to the outer edge, which is the direction
         you are travelling. Nudging into the chevron creeps; pushing to the
         edge of the strip runs. */
      const box = chevron.getBoundingClientRect()
      const into = (e.clientX - box.left) / (box.width || 1)
      const t = Math.min(1, Math.max(0, dir < 0 ? 1 - into : into))
      target.current = SCROLL_SLOW + (SCROLL_FAST - SCROLL_SLOW) * t
    }
    window.addEventListener('pointermove', check, { passive: true })
    window.addEventListener('pointerdown', check, { passive: true })
    const gone = () => { stopScroll(); setHovered(null) }
    document.addEventListener('pointerleave', gone)
    window.addEventListener('blur', gone)
    return () => {
      window.removeEventListener('pointermove', check)
      window.removeEventListener('pointerdown', check)
      document.removeEventListener('pointerleave', gone)
      window.removeEventListener('blur', gone)
      stopScroll()
    }
  }, [stopScroll])

  /* Pinned only when it earns its place.
     The active tab sits at the left with a menu beside it so it never scrolls
     out of sight — worth a whole control when the tabs overflow, and pure
     duplication when they do not: the same name once beside its chevron and
     again in the row. Below the threshold this is an ordinary tab bar. */
  const activeTab = tabs.find(t => t.id === active) ?? tabs[0]
  const rest = pinned ? tabs.filter(t => t.id !== active) : tabs

  return (
    <>
      <nav style={{
        display: 'flex', alignItems: 'stretch', height: BAR_H, flexShrink: 0,
        borderBottom: actions ? 'none' : '1px solid var(--bdr)', background: 'var(--surf)', paddingRight: 12,
        position: 'relative',
      }}>
        {/* Names the pane. The editor and the preview are two halves of one
            window with near-identical furniture, and without a word on each the
            only way to tell which is which is to recognise the tab names. */}
        {title && (
          <span style={{
            /* The gap after the label lives HERE, not on whatever follows.
               It used to come from the pinned trigger's own left padding, so
               the moment that trigger stopped rendering the label sat flush
               against the first tab. Spacing that belongs to one element must
               not be paid for by its neighbour — the neighbour can leave.
               12 here plus the tab's own 12 makes 24 between the two words,
               which is what the pinned layout gave (14 + 10). */
            alignSelf: 'center', paddingLeft: 16, paddingRight: 12, flexShrink: 0,
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--text-dim)', whiteSpace: 'nowrap', userSelect: 'none', cursor: 'default',
          }}>
            {/* Sized to the tabs beside it, so the label and the tab names sit
                on one baseline instead of each centring its own text in the
                bar. The row can't simply be baseline-aligned: the tabs draw
                their underline by stretching to the full height. */}
            {title}<Strut size={TAB_FS} />
          </span>
        )}
        {/* Name and arrow are one control — the whole thing opens the menu, and
            the underline spans the full hit area rather than just the label.
            Rendered only while pinned, which is only while the tabs overflow. */}
        {pinned && (
        <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0, paddingLeft: 16 }}>
          <button ref={triggerRef} onClick={() => setMenuOpen(o => !o)} title="Switch tab"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 0 12px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--sans)', fontSize: TAB_FS, fontWeight: 500, whiteSpace: 'nowrap',
              color: menuOpen ? 'var(--accent)' : 'var(--text)',
              /* The underline is painted, not built.
                 A 2px border with `marginBottom: -1` made this tab 43px inside
                 a 42px bar, so it hung a pixel past the bar's own bottom rule
                 and broke that line where the tab sat. An inset shadow paints
                 in the same place and joins no box. */
              boxShadow: 'inset 0 -2px 0 var(--accent)',
              transition: 'color var(--t) var(--ease), box-shadow var(--t) var(--ease)',
            }}>
            {activeTab.label}
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--t) var(--ease)', opacity: .8 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <span style={{ alignSelf: 'center', width: 1, height: 20, background: 'var(--bdr)', margin: '0 2px' }} />
        </div>
        )}

        {pinned && menuOpen && (
          <div ref={menuRef} className="anim-pop" style={{
            position: 'absolute', top: BAR_H - 2, left: 12, zIndex: 'var(--z-dropdown)', minWidth: 176,
            background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: 6,
          }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => { onSelect(t.id); setMenuOpen(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', background: t.id === active ? 'var(--surf3)' : 'none',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12,
                    color: t.id === active ? 'var(--accent)' : 'var(--text)', padding: '6px 8px', borderRadius: 6,
                  }}
                  onMouseEnter={e => { if (t.id !== active) e.currentTarget.style.background = 'var(--surf3)' }}
                  onMouseLeave={e => { if (t.id !== active) e.currentTarget.style.background = 'none' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {phase.left && <Chevron dir={-1} state={phase.left} onEnter={() => startScroll(-1)} onLeave={stopScroll} onClick={() => nudge(-1)} />}
        {/* No padding for the chevrons, and that was checked rather than
            assumed. A probe reported a tab 51.6% covered by one, so I padded
            the scroller by a chevron's width — and the probe was wrong. It was
            measuring tabs that had SCROLLED OUT: a clipped tab keeps a layout
            rect at its old position, and that position sits under a chevron
            while the tab itself is unreachable. Clipped is not covered.
            Measured against the visible part of each tab, at three scroll
            positions: 0% covered everywhere. The chevrons are flex siblings of
            this scroller, so they cannot overlap it at all. */}
        <div ref={ref} className="no-bar" onScroll={measure}
          style={{ display: 'flex', flex: 1, minWidth: 0, overflowX: 'auto' }}>
          {rest.map(t => {
            /* Unpinned, the active tab lives in this row and has to show it —
               same underline the pinned trigger wears, so switching between
               the two layouts changes what is on screen and not how it reads.
               `data-active` is also what `measure` finds to learn this tab's
               width, which is what keeps the pin threshold from oscillating. */
            const on = !pinned && t.id === active
            return (
            <button key={t.id} onClick={() => onSelect(t.id)} data-active={on ? '1' : undefined} style={{
              background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
              padding: '0 12px', fontFamily: 'var(--sans)', fontSize: TAB_FS, whiteSpace: 'nowrap',
              color: on ? 'var(--text)' : 'var(--muted)', fontWeight: on ? 500 : 400,
              /* No border here either. A transparent 2px border still adds to
                 the box, so these inactive tabs were the same 1px too tall as
                 the pinned one and sat a pixel low against the bar's rule. */
              boxShadow: on ? 'inset 0 -2px 0 var(--accent)' : 'none',
              transition: 'color var(--t) var(--ease)',
            }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.color = 'var(--muted)' }}>{t.label}</button>
            )
          })}
        </div>
        {phase.right && <Chevron dir={1} state={phase.right} onEnter={() => startScroll(1)} onLeave={stopScroll} onClick={() => nudge(1)} />}
        {right && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: 12, borderLeft: '1px solid var(--bdr)', marginLeft: 6 }}>
            {right}
          </div>
        )}
      </nav>
      {/* A second line, for the actions that belong to the pane rather than
          to the tab. They used to ride on the right of the tab strip, which
          meant the tabs and the buttons competed for the same width and the
          tabs lost first. Full width here, and the tab strip gets the whole
          line above to itself. */}
      {/* `minHeight`, not `height`. A fixed 38 was shorter than the 36px
          controls plus their clearance, so a control taller than 34 poked out
          of the top of its own row. The row grows to hold what it is given.

          And it WRAPS. Every control in here refuses to shrink — correctly, a
          status readout squeezed to 40px says nothing — so a row that cannot
          wrap has only one way to fail: run off the end. In a 370px PANE
          inside a 790px window it ran 149px past the edge, and the parent
          clipped it with no scrollbar to reach what was cut off.

          The phone media query could never have caught that, because the
          window was 790 and a media query asks the window. Wrapping asks
          nobody and holds at every width.

          Both of these comments live OUTSIDE the expression below. A JSX
          comment between a logical AND and its element is a second child of an
          expression that takes one, and it takes the whole module down with a
          500. Second time in this project.

          And never write the comment closing sequence inside a comment. Naming
          the delimiter in prose ended this block early, and the rest of the
          sentence rendered on screen as page text — in both panes. Same trap
          as a backtick inside a template literal: describe the syntax in
          words, never type it. */}
      {actions && (
        <div className="action-row" style={{
          /* 20 between groups against 6 inside them, which clears the 3:1
             proximity wants. At 6 and 6 the row read as one run of four
             controls rather than as history, save and import. 18 said the
             same thing and is off the space grid, which takes multiples of
             4 from 8 up; 16 would drop the ratio to 2.67:1. */
          display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, flexWrap: 'wrap',
          padding: '6px 12px', minHeight: 40, background: 'var(--surf)',
          borderBottom: '1px solid var(--bdr)', borderTop: '1px solid var(--bdr)',
        }}>
          {actions}
        </div>
      )}
    </>
  )
}

