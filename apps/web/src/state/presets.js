/* Starting points.

   A blank canvas is the wrong place to begin a design system — tuning
   something coherent is faster and produces better results than assembling
   one token at a time. Each preset is a complete, internally consistent
   system; they differ in the decisions that actually distinguish systems from
   each other, not in surface colour. */
import { createInitialState } from './schema.js'

const preset = (id, label, desc, swatches, patch) => ({ id, label, desc, swatches, patch })

export const PRESETS = [
  preset('studio', 'Studio',
    'Space Grotesk over Manrope, cool neutrals, a deep teal accent. The default.',
    ['#0d7a70', '#e2e4e6', '#26282b'],
    () => createInitialState()),

  preset('editorial', 'Warm editorial',
    'Serif throughout, warm neutrals, one rust accent. Calm and unhurried.',
    ['#b8422e', '#dedbd7', '#2a2825'],
    () => {
      const s = createInitialState()
      s.meta.name = 'Editorial'
      s.color.seeds = s.color.seeds.map(x =>
        x.name === 'accent' ? { ...x, hex: '#b8422e' } :
        x.name === 'neutral' ? { ...x, hex: '#7a736c' } :
        x.name === 'success' ? { ...x, hex: '#3f8f63' } :
        x.name === 'warning' ? { ...x, hex: '#c08a2e' } : x)
      s.type.families = {
        display: { family: 'Source Serif 4', category: 'serif' },
        body: { family: 'Source Serif 4', category: 'serif' },
        mono: { family: 'JetBrains Mono', category: 'monospace' },
      }
      s.type.ratio = 1.25
      s.type.leading = 1.1
      s.layout.maxMeasure = 62
      s.directives.references = ['Print-inspired', 'Warm minimal']
      return s
    }),

  preset('swiss', 'Swiss neutral',
    'Grotesque sans, near-grey palette, flat surfaces separated by rules.',
    ['#1a1a1a', '#f2f2f2', '#c8102e'],
    () => {
      const s = createInitialState()
      s.meta.name = 'Swiss'
      s.color.seeds = s.color.seeds.map(x =>
        x.name === 'accent' ? { ...x, hex: '#c8102e' } :
        x.name === 'neutral' ? { ...x, hex: '#767676' } : x)
      s.color.shape = { ...s.color.shape, chromaScale: 0.35, hueShift: 0 }
      s.type.families = {
        display: { family: 'Inter', category: 'sans-serif' },
        body: { family: 'Inter', category: 'sans-serif' },
        mono: { family: 'JetBrains Mono', category: 'monospace' },
      }
      s.type.ratio = 1.2
      s.type.tracking = 1.3
      s.radius.base = 0
      s.elevation.strategy = 'border'
      s.motion.personality = 'snappy'
      s.directives.references = ['Swiss editorial', 'High-contrast utilitarian']
      s.macros.roundness = 0
      return s
    }),

  preset('product', 'Soft product',
    'Rounded, shadowed, generous. The familiar SaaS shape, done carefully.',
    ['#4f6ef7', '#f7f8fb', '#1c2333'],
    () => {
      const s = createInitialState()
      s.meta.name = 'Soft product'
      s.color.seeds = s.color.seeds.map(x =>
        x.name === 'accent' ? { ...x, hex: '#4f6ef7' } :
        x.name === 'neutral' ? { ...x, hex: '#6b7280' } : x)
      s.type.families = {
        display: { family: 'DM Sans', category: 'sans-serif' },
        body: { family: 'DM Sans', category: 'sans-serif' },
        mono: { family: 'JetBrains Mono', category: 'monospace' },
      }
      s.type.ratio = 1.25
      s.radius.base = 10
      s.macros.roundness = 1.4
      s.macros.density = 1.15
      s.elevation.strategy = 'shadow'
      s.motion.personality = 'bouncy'
      s.directives.references = ['Airy consumer', 'Soft neumorphic']
      return s
    }),

  preset('terminal', 'Terminal',
    'Monospace, near-black, square corners, one phosphor accent.',
    ['#3ddc84', '#0d0f0e', '#c9d1cd'],
    () => {
      const s = createInitialState()
      s.meta.name = 'Terminal'
      s.color.seeds = s.color.seeds.map(x =>
        x.name === 'accent' ? { ...x, hex: '#3ddc84' } :
        x.name === 'neutral' ? { ...x, hex: '#6b7a72' } : x)
      s.color.mode = 'dark'
      s.type.families = {
        display: { family: 'JetBrains Mono', category: 'monospace' },
        body: { family: 'JetBrains Mono', category: 'monospace' },
        mono: { family: 'JetBrains Mono', category: 'monospace' },
      }
      s.type.ratio = 1.2
      s.type.base = 14
      s.radius.base = 2
      s.macros.roundness = 0.5
      s.macros.density = 0.85
      s.elevation.strategy = 'border'
      s.motion.personality = 'snappy'
      s.icons.library = 'Lucide'
      s.icons.strokeWidth = 1.5
      s.directives.references = ['Terminal / monospace', 'Dense data-first']
      return s
    }),

  preset('dense', 'Dense data',
    'Compact, small type, tight rows. Built for tables and long sessions.',
    ['#2563a8', '#eef1f4', '#20262e'],
    () => {
      const s = createInitialState()
      s.meta.name = 'Dense data'
      s.color.seeds = s.color.seeds.map(x =>
        x.name === 'accent' ? { ...x, hex: '#2563a8' } :
        x.name === 'neutral' ? { ...x, hex: '#6e767f' } : x)
      s.type.families = {
        display: { family: 'IBM Plex Sans', category: 'sans-serif' },
        body: { family: 'IBM Plex Sans', category: 'sans-serif' },
        mono: { family: 'JetBrains Mono', category: 'monospace' },
      }
      s.type.base = 14
      s.type.ratio = 1.2
      s.type.features = { ...s.type.features, body: ['liga', 'tnum'] }
      s.macros.density = 0.75
      s.macros.scale = 0.95
      s.radius.base = 4
      s.elevation.strategy = 'border'
      s.layout.maxMeasure = 80
      s.directives.references = ['Dense data-first']
      return s
    }),
]

/** Apply a preset while keeping the document's own name and prose. */
export function applyPreset(id, current) {
  const found = PRESETS.find(p => p.id === id)
  if (!found) return current
  const next = found.patch()
  return {
    ...next,
    meta: { ...next.meta, name: current.meta.name || next.meta.name, description: current.meta.description },
    prose: current.prose,
  }
}
