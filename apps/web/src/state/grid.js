/* ── The pixel grid ──

   A scale is only useful if a person can hold it in their head. 12, 16, 24, 32
   is a scale someone repeats from memory a week later; 12.8, 15.1, 22.6 is a
   lookup table. Both are equally "correct" arithmetic, and only one of them
   gets used correctly by the person building from it.

   So no value in this system is fractional. Two rules cover everything:

   SPACE — every gap, padding, size and radius sits on a 4px grid. Below 8px a
   multiple of 2 is allowed, because the small end needs finer steps than 4 to
   be useful at all. So the legal small values are 2, 4 and 6, plus 1 for a
   hairline — a 1px rule is ink and has no coarser form. 3, 5 and 7 are not
   exempt: a 3px padding is space, and space answers to the grid.

   TYPE — the same idea with the boundary moved. Multiples of 4 from 24px up,
   multiples of 2 below it. Type cannot use the 4px grid all the way down,
   because 12, 16, 20 leaves no room for the 14px and 18px that nearly every
   interface needs for secondary and lead text. Reading sizes need the finer
   step; display sizes do not, and 60 is a number somebody remembers where 61
   is a number somebody looks up. The modular ratio still shapes the scale;
   snapping only decides where each step lands.

   A base of 16 at a major third comes out 12, 14, 16, 18, 20, 24, 32, 40, 48,
   60 — which is Tailwind's published scale, arrived at from the ratio rather
   than copied off it.

   The snapping happens at the LAST step, on the derived pixel value, never on
   the ratio or the multiplier. Snapping an input and then multiplying it
   re-introduces fractions downstream, which is how 0.01 on a density slider
   became 11.16px of card padding. */

/** Snap a spacing, size or radius value to the grid. */
export function snapSpace (px) {
  const n = Math.abs(px)
  if (n === 0) return 0
  const sign = px < 0 ? -1 : 1
  if (n <= 1) return sign                                   // a hairline stays a hairline
  if (n < 8) return sign * Math.round(n / 2) * 2
  return sign * Math.round(n / 4) * 4
}

/** Snap a font size: multiples of 4 from 24px up, multiples of 2 below. */
export function snapType (px) {
  const n = Math.max(8, px)
  return n < 24 ? Math.round(n / 2) * 2 : Math.round(n / 4) * 4
}

/** True when a value is a legal spacing pixel. */
export function isOnSpaceGrid (px) {
  const n = Math.abs(px)
  if (!Number.isFinite(n) || n === 0) return true
  if (!Number.isInteger(n)) return false
  if (n === 1) return true                                  // a hairline
  if (n < 8) return n % 2 === 0
  return n % 4 === 0
}

/** True when a value is a legal font size. */
export function isOnTypeGrid (px) {
  if (!Number.isInteger(px)) return false
  return px < 24 ? px % 2 === 0 : px % 4 === 0
}
