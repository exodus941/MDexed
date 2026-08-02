/* Landing on the thing you clicked in the preview.

   The jump used to fire a smooth scroll and then, ~130ms later, an instant one
   — the second was meant to correct for an accordion that had finished
   expanding, but it cancelled the animation every time and made the jump read
   as a hard cut. Wait for the expansion instead, then scroll once.

   Duration comes from `--t`, the UI animation slider, so a jump moves at
   whatever speed the rest of the editor does. At 0 it is instantaneous by
   choice, and `prefers-reduced-motion` is honoured. */
import { useEffect, useRef } from 'react'

const uiDuration = () => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--t')
  const ms = parseFloat(raw)
  return Number.isFinite(ms) ? ms : 125
}

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/* The box a jump has to land inside is the scrolling panel, not the window —
   the editor column is a fixed-height scroller sitting well inside the
   viewport, so measuring against `window.innerHeight` calls things visible
   that are nowhere near it. */
const viewportOf = el => {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if (oy === 'auto' || oy === 'scroll') return p.getBoundingClientRect()
  }
  return { top: 0, bottom: window.innerHeight }
}

const fullyVisible = el => {
  const r = el.getBoundingClientRect()
  const v = viewportOf(el)
  return r.top >= v.top - 2 && r.bottom <= v.bottom + 2
}

/* Did the scroll actually deliver what was asked for? "Still visible
   somewhere" is not the test — `block: 'start'` means the element should be
   at the top, and a jump that leaves it near the bottom of the panel has
   failed even though it is technically on screen. */
const settled = (el, block) => {
  if (block !== 'start') return fullyVisible(el)
  const r = el.getBoundingClientRect()
  return Math.abs(r.top - viewportOf(el).top) <= 24
}

/**
 * Smooth-scroll, then make sure it actually happened.
 *
 * A smooth scroll needs animation frames, and there are environments that
 * never produce them — a backgrounded tab, an embedded pane. Without the
 * follow-up the target is simply left off screen and the jump silently does
 * nothing. Where the animation does run it has long finished by the time the
 * check fires, so the correction is a no-op.
 *
 * @returns a cancel function for the pending check
 */
function scrollAndConfirm(el, block, instant) {
  el.scrollIntoView({ block, behavior: instant ? 'auto' : 'smooth' })
  if (instant) return () => {}
  const t = setTimeout(() => {
    if (el.isConnected && !settled(el, block)) el.scrollIntoView({ block, behavior: 'auto' })
  }, 700)
  return () => clearTimeout(t)
}

/**
 * Scroll the returned ref into view once `active` turns true, or once `at`
 * changes while it stays true (clicking the same element twice re-jumps).
 *
 * @returns a ref to attach to the element that should end up on screen
 */
export function useReveal(active, at) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active || !ref.current) return
    const ms = uiDuration()
    const instant = ms === 0 || reducedMotion()

    /* Wait out the accordion's own duration so it has finished expanding and
       the target's final position is known — scrolling mid-expansion lands
       short every time.

       A timer rather than requestAnimationFrame: rAF is throttled to nothing
       whenever the page isn't compositing (a background tab, an embedded
       pane), which left the jump never firing at all. */
    let cancelCheck = () => {}
    const timer = setTimeout(() => {
      if (ref.current) cancelCheck = scrollAndConfirm(ref.current, 'center', instant)
    }, instant ? 0 : ms)

    return () => { clearTimeout(timer); cancelCheck() }
  }, [active, at])

  return ref
}

/**
 * Reveal a specific row inside a card, falling back to the card itself.
 *
 * @param rowSelector CSS selector for the row, resolved inside the container
 * @returns a ref for the container
 *
 * This used to scroll the card to the top and then move the row only if it
 * was not fully visible. Both halves of that were wrong. A tall panel shows
 * most of a card at once, so `button-primary` was usually already "visible"
 * after the card scrolled and the second step did nothing — you asked for a
 * variant and landed on the component's heading. And when it did fire,
 * `block: 'nearest'` moved the minimum distance, parking the row against the
 * bottom edge.
 *
 * The row is the target. The card is only what to do when there isn't one.
 *
 * The row may not exist on the first attempt: the card has to open, and its
 * 0fr→1fr transition means the content has no height for a frame or two. So
 * it retries a few times before giving up rather than assuming one timeout is
 * enough — the previous single-shot timing was tuned against one animation
 * duration and broke as soon as that setting changed.
 */
export function useRevealWithin(active, at, rowSelector) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active || !ref.current) return
    const ms = uiDuration()
    const instant = ms === 0 || reducedMotion()

    let cancelCheck = () => {}
    let attempt = 0
    let timer = 0

    const tryReveal = () => {
      const box = ref.current
      if (!box) return
      const row = rowSelector && box.querySelector(rowSelector)

      if (row) {
        /* `start` rather than `nearest`: land it at the top of the panel with
           its siblings below, which is where you read from. `nearest` leaves
           it wherever it already was if that counted as on-screen. */
        cancelCheck = scrollAndConfirm(row, 'start', instant)
        return
      }

      /* Not there yet — the card is still opening. Keep looking for a few
         frames, then settle for the card. */
      if (++attempt < 6) { timer = setTimeout(tryReveal, instant ? 0 : 60); return }
      cancelCheck = scrollAndConfirm(box, 'start', instant)
    }

    timer = setTimeout(tryReveal, instant ? 0 : ms)
    return () => { clearTimeout(timer); cancelCheck() }
  }, [active, at, rowSelector])

  return ref
}

/** The highlight a revealed row wears. Fades with the same `--t` as everything else. */
export const revealStyle = active => ({
  transition: 'background var(--t) var(--ease), box-shadow var(--t) var(--ease)',
  ...(active && {
    background: 'rgb(var(--accent-rgb) / .07)',
    boxShadow: '0 0 0 1px rgb(var(--accent-rgb) / .45)',
    borderRadius: 7,
  }),
})
