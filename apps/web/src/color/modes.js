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

/* ── Gradients ──
   A gradient is a CSS *image*, not a colour, so it can never be a `colors`
   token — the spec's map takes colour values. It rides in the markdown body
   instead, and drives a CSS variable for the preview. */
export const GRADIENT_TYPES = ['linear', 'radial']

/* ── What a gradient is for ──
 *
 * A gradient can never be a component property — `backgroundImage` is not one
 * of the spec's legal eight — so it reaches an agent as prose or not at all.
 * Prose that says only "here is a gradient called brand-sweep" gives it
 * nothing to act on. Prose that says where the gradient belongs does.
 *
 * A fixed list rather than free text for the first field, because a value an
 * agent can match against a CSS selector is worth more than a sentence it has
 * to interpret. The detail field underneath is where the sentence goes.
 *
 * `selector` is the hint the emitted file leads with; `label` is what the
 * panel shows. Where the two differ it is because a designer says "page
 * background" and a stylesheet says `body`.
 */
export const GRADIENT_PURPOSES = [
  { value: 'page',       label: 'Page background',      selector: 'body, .page',      desc: 'Behind everything' },
  { value: 'hero',       label: 'Hero / banner',        selector: '.hero',            desc: 'Large feature area at the top of a page' },
  { value: 'section',    label: 'Section background',   selector: 'section',          desc: 'A band of content set apart from the page' },
  { value: 'card',       label: 'Card surface',         selector: '.card',            desc: 'A raised container' },
  { value: 'button',     label: 'Button fill',          selector: '.btn-primary',     desc: 'A primary action' },
  { value: 'nav',        label: 'Nav / sidebar',        selector: 'nav, .sidebar',    desc: 'Persistent navigation' },
  { value: 'header',     label: 'App header bar',       selector: 'header',           desc: 'The top chrome of an app' },
  { value: 'title',      label: 'Title text',           selector: 'h1, .display',     desc: 'Clipped to text with background-clip' },
  { value: 'overlay',    label: 'Overlay / scrim',      selector: '.scrim',           desc: 'Over an image, usually to carry text' },
  { value: 'divider',    label: 'Divider / rule',       selector: 'hr',               desc: 'A fading horizontal line' },
  { value: 'chart',      label: 'Chart / data fill',    selector: '.chart-series',    desc: 'Area fills and bars' },
  { value: 'accent',     label: 'Accent detail',        selector: '.accent-bar',      desc: 'A small emphasis element' },
  { value: 'decorative', label: 'Decorative only',      selector: null,               desc: 'No fixed placement — use at your discretion' },
]

export const purposeOf = value => GRADIENT_PURPOSES.find(p => p.value === value) ?? null

/** Resolve a stop's colour, which may be a role name, a scale ref, or a hex. */
export const resolveStop = (value, roles, resolveRef, ramps) => {
  if (!value) return '#000000'
  if (/^#|^rgb|^hsl/.test(value)) return value
  return roles?.[value] ?? resolveRef?.(value, ramps) ?? '#000000'
}

export function gradientCss(g, { roles, ramps, resolveRef }) {
  const stops = (g.stops ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(s => `${resolveStop(s.color, roles, resolveRef, ramps)} ${s.position}%`)
    .join(', ')
  if (!stops) return 'none'
  if (g.type === 'radial') return `radial-gradient(circle at ${g.cx ?? 50}% ${g.cy ?? 50}%, ${stops})`
  return `linear-gradient(${g.angle ?? 90}deg, ${stops})`
}

/** Role-level overrides pinned to the target mode would defeat generation. */
export function clearOverridesFor(roleOverrides = {}, mode) {
  return Object.fromEntries(Object.entries(roleOverrides).filter(([k]) => !k.endsWith(`:${mode}`)))
}
