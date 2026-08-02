/* Google Fonts catalogue access and on-demand font loading.

   The catalogue comes through the Worker rather than being fetched directly:
   it avoids a CORS problem, lets the response be cached server-side, and keeps
   an API key out of the client if one is configured.

   Loading is lazy and per-family. The library is ~1,700 families; requesting
   stylesheets for all of them would take the picker down. Only families
   actually scrolled into view get a <link>, and only at the weights needed. */

const CATALOG_URL = '/api/v1/fonts'

let catalogPromise = null

/** Families, categories and variable-axis metadata. Fetched once per session. */
export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL)
      .then(r => {
        if (!r.ok) throw new Error(`catalogue unavailable (${r.status})`)
        return r.json()
      })
      .then(data => (Array.isArray(data.families) ? data.families : []))
      .catch(err => {
        catalogPromise = null   // let a later attempt retry
        throw err
      })
  }
  return catalogPromise
}

export const CATEGORIES = ['serif', 'sans-serif', 'display', 'handwriting', 'monospace']

/** Search and filter over the catalogue. */
export function filterFamilies(families, { query = '', category = null, variableOnly = false } = {}) {
  const q = query.trim().toLowerCase()
  return families.filter(f => {
    if (category && f.category !== category) return false
    if (variableOnly && !f.axes?.length) return false
    if (q && !f.family.toLowerCase().includes(q)) return false
    return true
  })
}

/* ── Lazy stylesheet loading ──
   Keyed by the spec, not the family: the document's faces are requested at
   startup at fixed weights, before the catalogue has arrived, and upgraded to
   full variable-axis ranges once it has. Keying by family alone would pin the
   first request and leave the axis sliders inert. */
const loaded = new Map()   // family → the spec currently linked

const linkId = family => `dmd-font-${family.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`

/** Every weight the type scale asks for, so headings aren't synthesised. */
export const DOCUMENT_WEIGHTS = [300, 400, 500, 600, 700, 800]

const specFor = (family, weights, axes) => {
  const name = family.replace(/ /g, '+')
  if (axes?.length) {
    const tags = axes.map(a => a.tag).filter(t => t !== 'ital').sort()
    const ranges = tags.map(t => {
      const a = axes.find(x => x.tag === t)
      return `${a.start}..${a.end}`
    })
    return `${name}:${tags.join(',')}@${ranges.join(',')}`
  }
  return `${name}:wght@${[...new Set(weights)].sort((a, b) => a - b).join(';')}`
}

/**
 * Inject a stylesheet for one family. Safe to call repeatedly; only re-links
 * when the requested spec actually changes.
 * @param axes when the family is variable, request the full axis ranges so the
 *             sliders actually do something.
 */
export function loadFont(family, { weights = [400, 500, 600, 700], axes = null } = {}) {
  if (!family || typeof document === 'undefined') return
  const spec = specFor(family, weights, axes)
  if (loaded.get(family) === spec) return
  loaded.set(family, spec)

  const href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  const id = linkId(family)
  const existing = document.getElementById(id)
  if (existing) { existing.href = href; return }

  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

/**
 * The faces the document itself uses. Called from the app shell, not from the
 * Typography panel — the preview renders on every tab, so waiting until
 * someone opens Type meant the mock screens spent most of their life in a
 * fallback face that looks nothing like the chosen one.
 *
 * `catalog` is optional: without it the fixed weights are requested straight
 * away, and the same call with a catalogue later upgrades to axis ranges.
 */
export function loadDocumentFonts(families, catalog = []) {
  for (const entry of Object.values(families ?? {})) {
    if (!entry?.family) continue
    const meta = catalog.find(f => f.family === entry.family)
    loadFont(entry.family, { weights: DOCUMENT_WEIGHTS, axes: meta?.axes })
  }
}

/** CSS font-family value with a category-appropriate fallback. */
export function stackFor(family, category) {
  if (!family) return 'system-ui, sans-serif'
  const fallback = {
    serif: 'Georgia, serif',
    'sans-serif': 'system-ui, sans-serif',
    display: 'system-ui, sans-serif',
    handwriting: 'cursive',
    monospace: 'ui-monospace, monospace',
  }[category] ?? 'system-ui, sans-serif'
  return `'${family}', ${fallback}`
}

/* A small offline set so the picker still works when the catalogue can't be
   reached — the app should degrade, not break, if the Worker is down. */
export const FALLBACK_FAMILIES = [
  { family: 'Inter', category: 'sans-serif', axes: [{ tag: 'wght', start: 100, end: 900 }] },
  { family: 'Source Serif 4', category: 'serif', axes: [{ tag: 'wght', start: 200, end: 900 }] },
  { family: 'Georgia', category: 'serif', axes: [] },
  { family: 'DM Sans', category: 'sans-serif', axes: [{ tag: 'wght', start: 100, end: 1000 }] },
  { family: 'Syne', category: 'sans-serif', axes: [{ tag: 'wght', start: 400, end: 800 }] },
  { family: 'JetBrains Mono', category: 'monospace', axes: [{ tag: 'wght', start: 100, end: 800 }] },
  { family: 'Playfair Display', category: 'serif', axes: [{ tag: 'wght', start: 400, end: 900 }] },
  { family: 'Work Sans', category: 'sans-serif', axes: [{ tag: 'wght', start: 100, end: 900 }] },
  { family: 'IBM Plex Sans', category: 'sans-serif', axes: [] },
  { family: 'Space Grotesk', category: 'sans-serif', axes: [{ tag: 'wght', start: 300, end: 700 }] },
]
