/* ── THE WIZARD'S QUESTIONS, AND WHAT EACH ANSWER IS ──
 *
 * Four questions everybody answers, four behind a disclosure. Every answer maps
 * onto a field the schema already has, so the prompt can name a real value
 * instead of a mood. That mapping is the whole reason the wizard can be this
 * short: the agent is told "density 0.85", not "fairly tight".
 *
 * A word, not a swatch. The palette question offers hue RANGES, because a
 * person choosing "warm" has not chosen #b8422e, and offering them the hex
 * pretends they have. The agent picks inside the range and the audit judges the
 * result, which is the division of labour the whole product rests on.
 */

/* A hue range in OKLCH degrees, plus the seed the agent should start from. The
   seeds are lifted from the shipped presets rather than invented, so every one
   of them is a palette that already audits clean. */
export const PALETTES = [
  { id: 'cool',    label: 'Cool',    hue: '180–260°', seed: '#1771bf', neutral: '#5c6a72', note: 'Blues and teals. The safe default for software.' },
  { id: 'warm',    label: 'Warm',    hue: '20–60°',   seed: '#b8422e', neutral: '#7a736c', note: 'Rusts and ambers. Reads editorial.' },
  { id: 'green',   label: 'Green',   hue: '120–170°', seed: '#0d7a70', neutral: '#5f6d64', note: 'Greens through teal. Growth, money, health.' },
  { id: 'violet',  label: 'Violet',  hue: '270–320°', seed: '#6b4fbb', neutral: '#68657a', note: 'Purples and indigos. Reads premium.' },
  { id: 'neutral', label: 'Neutral', hue: 'no hue',   seed: '#5a6066', neutral: '#6b6f73', note: 'Greys only, with one accent. Swiss.' },
  { id: 'bold',    label: 'Bold',    hue: '340–20°',  seed: '#c2334d', neutral: '#7a6a6e', note: 'Reds and magentas. Loud on purpose.' },
]

/* A pairing, never a font list. Each is display over body, with the mono face
   that goes with it, and each combination is one the presets already ship. */
export const TYPE_PAIRINGS = [
  { id: 'neutral',   label: 'Neutral',   display: 'Inter',          body: 'Inter',          mono: 'JetBrains Mono', displayCategory: 'sans-serif', bodyCategory: 'sans-serif', note: 'One sans throughout. Invisible, which is the point.' },
  { id: 'editorial', label: 'Editorial', display: 'Source Serif 4', body: 'Source Serif 4', mono: 'JetBrains Mono', displayCategory: 'serif', bodyCategory: 'serif', note: 'Serif throughout. Unhurried.' },
  { id: 'friendly',  label: 'Friendly',  display: 'Ubuntu',         body: 'Nunito',         mono: 'JetBrains Mono', displayCategory: 'sans-serif', bodyCategory: 'sans-serif', note: 'A quirky humanist sans over a rounded one. Warm, informal.' },
  { id: 'technical', label: 'Technical', display: 'IBM Plex Mono',  body: 'IBM Plex Sans',  mono: 'IBM Plex Mono',  displayCategory: 'monospace',  bodyCategory: 'sans-serif', note: 'Mono headings over a sans body. One superfamily.' },
  { id: 'mono',      label: 'Monospace', display: 'Martian Mono',   body: 'JetBrains Mono', mono: 'JetBrains Mono', displayCategory: 'monospace',  bodyCategory: 'monospace', note: 'A narrow mono for titles over a wider one for text.' },
]

/* Tightness is the spacing macro, and nothing else. One number the agent sets
   once, which then multiplies every step on the scale. */
export const TIGHTNESS = [
  { id: 'airy',     label: 'Airy',     density: 1.25, note: 'Marketing pages, landing screens.' },
  { id: 'balanced', label: 'Balanced', density: 1,    note: 'The designed baseline.' },
  { id: 'compact',  label: 'Compact',  density: 0.85, note: 'Application screens with a lot on them.' },
  { id: 'dense',    label: 'Dense',    density: 0.7,  note: 'Tables, dashboards, terminals.' },
]

export const SHAPES = [
  { id: 'square', label: 'Square', roundness: 0,   note: 'No corner radius at all.' },
  { id: 'soft',   label: 'Soft',   roundness: 1,   note: 'The designed baseline, 8px at the base step.' },
  { id: 'round',  label: 'Round',  roundness: 2.5, cardRounded: '20px', note: 'Pill buttons. Cards rounded, not blobbed.' },
]

/* Two ways to separate a surface from what is behind it, and a system should
   commit to one. Shadows read as physical, borders as drawn.

   THE BORDER ANSWER ALSO STRENGTHENS THE EDGE. Depth 0 on its own removes a
   `0 1px 2px rgba(...,0.06)` shadow, and nobody can see that leave: the two
   choices rendered as the same card. A system that draws its surfaces by their
   edge draws that edge in the border token, not the subtle one.

   BORDERS FIRST, AND FIRST IS THE DEFAULT. `find` falls back to the head of
   the list, so the order and the default are one decision rather than two that
   can disagree. */
export const DEPTHS = [
  { id: 'border', label: 'Borders', note: 'No shadows. Cards are drawn by a visible edge.' },
  { id: 'shadow', label: 'Shadows', cardBorder: '{colors.border-subtle}', note: 'Cards lift off the page on a shadow.' },
]

/* ── HOW MUCH OF IT, AND THE SCALE IS FOUR WHOLE STEPS ──
 *
 * The separator answers WHICH, and nothing answered HOW MUCH. So a system that
 * wanted a whisper of a shadow and one that wanted a slab got the same card.
 *
 * THE STEPS ARE INTEGERS BECAUSE A SHADOW IS A LENGTH. `deriveElevation`
 * multiplies every offset and blur by the depth macro, and the base geometry
 * includes a 1px offset — so any fractional macro ships a fractional pixel.
 * Measured at 0.66: `0px 0.7px 1.3px`. At 1.32: `0px 1.3px 2.6px`. Only whole
 * multipliers survive, which fixes the maximum at 3 and makes the four steps
 * 0, 1, 2 and 3 — exactly the 0, 33, 66 and 100 per cent asked for.
 *
 * LIGHT IS THE DEFAULT, WITH BORDERS. So a fresh document draws its cards on a
 * `border-subtle` hairline and no shadow. Medium is what the two answers
 * shipped before this control existed — depth 2 and `{colors.border}` — and it
 * is still one step away rather than gone.
 *
 * A BORDER HAS NO MACRO, so its intensity is a STEP ON THE NEUTRAL RAMP rather
 * than an opacity. Fading an edge to 33% invents a colour the system never
 * published and lands it between two ramp steps; `border-subtle`, `border` and
 * `border-strong` are three weights the palette already states and the audit
 * already measures. */
export const INTENSITIES = [
  { id: 'none',   label: 'None',   pct: 0,   depth: 0, border: 'transparent',
    note: 'Off. The surface is separated by its fill alone.' },
  { id: 'light',  label: 'Light',  pct: 33,  depth: 1, border: '{colors.border-subtle}',
    note: 'The quietest step the system publishes.' },
  { id: 'medium', label: 'Medium', pct: 66,  depth: 2, border: '{colors.border}',
    note: 'The designed baseline.' },
  { id: 'heavy',  label: 'Heavy',  pct: 100, depth: 3, border: '{colors.border-strong}',
    note: 'Unmistakable. Every card announces itself.' },
]

export const THEMES = [
  { id: 'light', label: 'Light Only', note: 'No dark block and no toggle.' },
  { id: 'dark',  label: 'Dark Only',  note: 'Dark values sit on the root.' },
  { id: 'both',  label: 'Both',       note: 'Both themes, and a visible toggle.' },
]

/* Six, not three. A system with six brand colours is a choice somebody can
   defend, and refusing the sixth is us deciding for them. */
export const BRAND_MAX = 6

export const BLANK = {
  building: '',
  palette: 'cool',
  type: 'neutral',
  tightness: 'balanced',
  brand: [],
  shape: 'soft',
  depth: 'border',
  intensity: 'light',
  theme: 'both',
}

/* ── ONE ASPECT PER PAGE ──
 *
 * Their instruction: every aspect gets its own page with a live preview beside
 * it. Four questions on one page was compact and showed nothing, so a person
 * chose "Warm" from a word and found out what it meant after the agent had
 * built it.
 *
 * The advanced four lose their disclosure and become a page. A fold that
 * carried four decisions was hiding them, not deferring them.
 */
export const STEPS = [
  { id: 'building',  title: 'What Are You Building?', sample: null },
  /* THEME FIRST OF THE LOOKS QUESTIONS, because it decides how every later page
     draws its sample. Choosing "Both" gives those pages two panes. */
  { id: 'theme',     title: 'Light, Dark, or Both?', sample: 'theme' },
  { id: 'colours',   title: 'Your Colours',   sample: 'palette' },
  { id: 'palette',   title: 'Palette',        sample: 'palette' },
  { id: 'type',      title: 'Type',           sample: 'type' },
  { id: 'tightness', title: 'Tightness',      sample: 'tightness' },
  { id: 'more',      title: 'More Choices',   sample: 'more' },
  { id: 'prompt',    title: 'Your Prompt',    sample: null },
]

const find = (list, id) => list.find(x => x.id === id) ?? list[0]

/* Resolve the answers into the values the prompt will name. Kept out of the
   component so a test can run it, and so the prompt and any future "apply this
   to the document" path cannot drift into two different readings. */
export function resolve(a) {
  return {
    building: (a.building || '').trim(),
    palette: find(PALETTES, a.palette),
    type: find(TYPE_PAIRINGS, a.type),
    tightness: find(TIGHTNESS, a.tightness),
    shape: find(SHAPES, a.shape),
    depth: find(DEPTHS, a.depth),
    intensity: find(INTENSITIES, a.intensity),
    theme: find(THEMES, a.theme),
    brand: (a.brand || []).filter(Boolean).slice(0, BRAND_MAX),
  }
}

/* THE CARD'S EDGE, FROM BOTH ANSWERS AT ONCE.
 *
 * Chosen SHADOWS, the shadow does the separating and the edge stays the
 * hairline it always was — turning it up as well would say the same thing
 * twice, and the intensity is already in the shadow.
 *
 * Chosen BORDERS, the edge IS the separator, so it takes the step. `none` then
 * leaves the card with no shadow and no edge, separated by its fill: legal,
 * because the plane check already guarantees `surface` differs from `bg`, and
 * it is a real design somebody may want.
 *
 * One writer, so the preview cannot paint an edge the prompt does not ask for. */
export function cardEdge (r) {
  return r.depth.id === 'shadow' ? r.depth.cardBorder : r.intensity.border
}

/* ── THE ANSWERS AS A DOCUMENT ──
 *
 * The wizard writes no document. It needs one anyway, to draw the preview: a
 * throwaway state, derived and rendered and never stored.
 *
 * ONE WRITER. The prompt names these values in prose and the preview paints
 * them, so both read this function. Two readings would let the picture promise
 * something the prompt does not ask for, which is the failure the whole preview
 * exists to prevent.
 */
export function applyAnswers(base, a) {
  const r = resolve(a)
  const seeds = (base.color?.seeds ?? []).map(s => {
    if (s.name === 'accent') return { ...s, hex: r.brand[0] || r.palette.seed }
    /* The palette's own neutral, unless they pinned one. This is what keeps the
       palette page alive once the brand list covers the accent. */
    if (s.name === 'neutral') return { ...s, hex: r.palette.neutral }
    /* A second and third brand colour land on the next two seeds that are not
       the neutral. The neutral carries the surfaces and taking a brand colour
       there would tint every panel. */
    if (s.name === 'success' && r.brand[1]) return { ...s, hex: r.brand[1] }
    if (s.name === 'warning' && r.brand[2]) return { ...s, hex: r.brand[2] }
    return s
  })
  return {
    ...base,
    color: { ...base.color, seeds, theme: r.theme.id },
    /* `type.families`, not `type.roles`. The first version wrote to `roles`,
       which the schema does not have, so every pairing rendered in the default
       face and the preview showed nothing changing. A path that does not exist
       throws nothing and reports nothing.

       The category travels with the family: a picker downstream reads it to
       decide which fallback stack to name. */
    type: {
      ...base.type,
      families: {
        ...base.type?.families,
        display: { family: r.type.display, category: r.type.displayCategory },
        body: { family: r.type.body, category: r.type.bodyCategory },
        mono: { family: r.type.mono, category: 'monospace' },
      },
    },
    macros: {
      ...base.macros,
      density: r.tightness.density,
      roundness: r.shape.roundness,
      /* THE INTENSITY MEANS DIFFERENT THINGS TO THE TWO ANSWERS, because the
         two are separated by different machinery. A shadow has a macro that
         scales it. A border does not, so its strength is a step on the ramp.
         One control, read twice — see `cardEdge` below. */
      depth: r.depth.id === 'shadow' ? r.intensity.depth : 0,
    },
    components: {
      ...base.components,
      overrides: {
        ...base.components?.overrides,
        'card.borderColor': cardEdge(r),
        /* Only when the shape answer caps it. Spreading `undefined` would
           write the key and blank the radius. */
        ...(r.shape.cardRounded ? { 'card.rounded': r.shape.cardRounded } : {}),
      },
    },
  }
}
