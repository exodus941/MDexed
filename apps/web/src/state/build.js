/* Build numbering: `260802-3`, the third build of 2 August 2026.
 *
 * `alpha` was a placeholder that never changed, which made the version field
 * worse than useless — an agent handed two different DESIGN.md files a week
 * apart had no way to tell them apart, and neither did you.
 *
 * A date plus a counter fixes that with no bookkeeping: it sorts
 * lexicographically, it's readable without a lookup, and it says when the file
 * was produced, which is the question anyone actually has when they find a
 * DESIGN.md in a repo.
 *
 * The counter advances on **export**, because that is when a file exists.
 * Edits don't bump it — a version that changed on every keystroke would say
 * nothing about which file anyone is holding. A document that has never been
 * exported has no build number, and the header says so rather than inventing
 * one.
 */

const two = n => String(n).padStart(2, '0')

/** Today as `YYMMDD`, in local time — the date the person pressed the button. */
export function today(now = new Date()) {
  return `${two(now.getFullYear() % 100)}${two(now.getMonth() + 1)}${two(now.getDate())}`
}

const PATTERN = /^(\d{6})-(\d+)$/

/**
 * The next build id after `current`.
 *
 * Same day, so continue the count; a different day (or anything that isn't a
 * build id — `alpha`, `1.0`, a version someone typed by hand) starts today at
 * one. Hand-written versions are deliberately not preserved: pressing export
 * is a request for a build number.
 */
export function nextBuild(current, now = new Date()) {
  const date = today(now)
  const m = PATTERN.exec(String(current ?? '').trim())
  return m && m[1] === date ? `${date}-${Number(m[2]) + 1}` : `${date}-1`
}

/** Is this a build id rather than something typed by hand? */
export const isBuild = v => PATTERN.test(String(v ?? '').trim())

/** `260802-3` → `2 Aug 2026, build 3`, for a tooltip. */
export function describeBuild(v) {
  const m = PATTERN.exec(String(v ?? '').trim())
  if (!m) return null
  const [, d, n] = m
  const date = new Date(2000 + +d.slice(0, 2), +d.slice(2, 4) - 1, +d.slice(4, 6))
  if (Number.isNaN(date.getTime())) return null
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}, build ${n}`
}
