/* Reading the UI scale back out, for the two places that need it.
 *
 * `zoom` on the app root means every length written below it is multiplied on
 * the way to the screen. That is invisible to almost everything — a `padding:
 * 8px` simply becomes twelve — but it is not invisible to code that takes a
 * measurement from the browser and hands it back as a length.
 *
 * Pointer coordinates and `getBoundingClientRect()` are both reported in
 * viewport pixels, already including the zoom. Feed one of those straight into
 * `left:` on an element inside the zoomed subtree and it gets multiplied a
 * second time, so a menu opened at the right-hand edge of a 150% window lands
 * half a screen further right than the cursor that opened it.
 *
 * So: measurements come out of the browser in viewport space and have to be
 * divided once before they go back in as lengths. Two call sites need it — the
 * preview's target menu and the token colour picker — and both position
 * themselves from a click.
 */

/** The app root's current zoom factor, or 1 if the scale has not been set. */
export function uiZoom() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'))
  return Number.isFinite(v) && v > 0 ? v : 1
}

/**
 * The viewport, in the coordinate space a fixed element inside the zoomed app
 * root actually uses. Everything a popover needs to clamp itself on-screen,
 * in one consistent set of units — mixing the two spaces is the bug this
 * exists to prevent.
 *
 * @returns {{z: number, x: (n: number) => number, w: number, h: number}}
 */
export function viewport() {
  const z = uiZoom()
  return { z, x: n => n / z, w: window.innerWidth / z, h: window.innerHeight / z }
}

/* Viewport units have the same problem in the other direction.
 *
 * `vh` and `vw` are fractions of the window and take no notice of zoom, so a
 * `max-height: 86vh` inside the scaled body is 86% of the screen multiplied by
 * the scale — at 150% that is a modal a third taller than the display it is
 * trying to fit inside. Dividing here keeps "86% of the screen" meaning what
 * it says at every scale. */
export const vh = pct => `calc(${pct}vh / var(--ui-zoom, 1))`
export const vw = pct => `calc(${pct}vw / var(--ui-zoom, 1))`
