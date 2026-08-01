/* Deriving one mode from the other.

   A dark theme isn't an inverted light theme, but mirroring the scale position
   gets ~80% of the way there in one click — the darkest text step becomes the
   lightest, surfaces flip, and accents move to where they read against a dark
   background. What's left is tuning, which is the part worth a designer's
   attention. */

const MIRROR = {
  50: 950, 100: 900, 200: 800, 300: 700, 400: 600,
  500: 500,
  600: 400, 700: 300, 800: 200, 900: 100, 950: 50,
}

/** `accent.700` → `accent.300`; literals flip; anything else is left alone. */
export function mirrorRef(ref) {
  if (ref === 'white') return 'black'
  if (ref === 'black') return 'white'
  if (typeof ref !== 'string') return ref
  const dot = ref.lastIndexOf('.')
  if (dot < 0) return ref
  const step = MIRROR[ref.slice(dot + 1)]
  return step == null ? ref : `${ref.slice(0, dot)}.${step}`
}

/**
 * Mirror every role's reference from one mode into the other.
 * @param roles state.color.roles
 * @param from  the mode to copy *from*
 */
export function generateCounterpart(roles, from = 'light') {
  const to = from === 'light' ? 'dark' : 'light'
  const next = {}
  for (const [name, pair] of Object.entries(roles ?? {})) {
    next[name] = { ...pair, [to]: mirrorRef(pair[from]) }
  }
  return next
}

/** Role-level overrides pinned to the target mode would defeat generation. */
export function clearOverridesFor(roleOverrides = {}, mode) {
  return Object.fromEntries(Object.entries(roleOverrides).filter(([k]) => !k.endsWith(`:${mode}`)))
}
