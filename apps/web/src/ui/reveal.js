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

    /* One frame so any accordion opening in the same commit has started, then
       the accordion's own duration so it has finished and the target's final
       position is known. Scrolling mid-expansion lands short every time. */
    let scrollTimer = 0
    let checkTimer = 0
    const frame = requestAnimationFrame(() => {
      scrollTimer = setTimeout(() => {
        const el = ref.current
        if (!el) return
        el.scrollIntoView({ block: 'center', behavior: instant ? 'auto' : 'smooth' })
        if (instant) return

        /* A smooth scroll needs animation frames, and there are environments
           that never produce them — a backgrounded tab, an embedded pane. If
           nothing has moved well after the animation should have finished,
           land it anyway rather than leaving the target off screen. A working
           smooth scroll is already done by now, so this is a no-op. */
        checkTimer = setTimeout(() => {
          const target = ref.current
          if (!target) return
          const box = target.getBoundingClientRect()
          if (box.bottom < 0 || box.top > window.innerHeight) {
            target.scrollIntoView({ block: 'center', behavior: 'auto' })
          }
        }, 700)
      }, instant ? 0 : ms)
    })

    return () => { cancelAnimationFrame(frame); clearTimeout(scrollTimer); clearTimeout(checkTimer) }
  }, [active, at])

  return ref
}

/** The highlight a revealed row wears. Fades with the same `--t` as everything else. */
export const revealStyle = active => ({
  transition: 'background var(--t) var(--ease), box-shadow var(--t) var(--ease)',
  ...(active && {
    background: 'rgba(220,144,85,.07)',
    boxShadow: '0 0 0 1px rgba(220,144,85,.45)',
    borderRadius: 7,
  }),
})
