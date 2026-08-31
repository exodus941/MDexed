/* ── A REAL PREVIEW, NOT A DRAWING ──
 *
 * Their instruction: every aspect gets a preview that changes in real time as a
 * choice is selected.
 *
 * It would be quicker to hand-draw a mock with inline colours. That mock would
 * be a second opinion about what "Warm" means. It would also drift from the
 * document the first time a ramp changed. So the sample runs the real pipeline:
 * the answers become a throwaway state, `derive` builds the scales from it, and
 * `buildCssVars` produces the same variables the preview pane uses. The document
 * itself is never touched.
 *
 * A pointer is not a preview, and a marker is not a style. This renders the
 * document's own primitives, under the document's own stylesheet.
 *
 * ── TWO PANES WHEN THEY ASK FOR TWO THEMES ──
 *
 * Choosing "Both" means the system ships a light block and a dark one, so a
 * single pane would show half of what was chosen. Both are drawn side by side,
 * and each pane says which it is.
 *
 * ── AND IT SAYS WHAT IT IS ──
 *
 * A disclaimer, because the sample is one arrangement out of eleven surfaces and
 * a reader who takes it for the finished thing has been misled by us.
 */
import { useMemo, useEffect } from 'react'
import { derive, buildCssVars } from '../state/derive.js'
import { createInitialState } from '../state/schema.js'
import { PREVIEW_CSS, varsToStyle } from '../preview/tokens.js'
import { Ico, IconSearch } from '../preview/icons.jsx'
import { applyAnswers, resolve } from './answers.js'
import { loadDocumentFonts } from '../type/fonts.js'
import { PAD } from '../ui/controls.jsx'

/* One base state, built once. `createInitialState` is not cheap and the answers
   only ever patch it. */
const BASE = createInitialState()

/* Each aspect shows the arrangement that makes it visible, and nothing else.
   A palette needs fills and text on them. Type needs a heading over body. A
   density change is only legible as a stack of rows. Showing all three at once
   would mean no page proves anything in particular. */
function PaletteSample() {
  return (
    <div className="stack-sm">
      <div className="card stack-sm">
        <span className="muted" style={{ fontSize: 12 }}>Revenue</span>
        <h3 style={{ margin: 0 }}>$45,645</h3>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="badge badge-success">Active</span>
          <span className="badge badge-warning">Trialing</span>
          <span className="badge badge-danger">Overdue</span>
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary">Primary</button>
        <button className="btn btn-secondary">Secondary</button>
      </div>
    </div>
  )
}

/* The theme page shows the surfaces, because that is what a theme changes: the
   page, the card standing on it, and the text on both. */
function ThemeSample() {
  return (
    <div className="stack-sm">
      <div className="card stack-sm">
        <h3 style={{ margin: 0 }}>Renewal Due</h3>
        <p style={{ margin: 0, fontSize: 12 }}>Halcyon Group renews in 6 days.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary">Send Reminder</button>
          <button className="btn btn-ghost">Dismiss</button>
        </div>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>Body Text On The Page</span>
    </div>
  )
}

function TypeSample() {
  return (
    <div className="card stack-sm">
      <h2 style={{ margin: 0 }}>Quarterly Review</h2>
      <p style={{ margin: 0 }}>
        The body face carries every sentence a reader actually reads, so it is
        chosen for length rather than for character.
      </p>
      {/* A figure in the mono face, because that rule is invisible in prose. */}
      <span className="figure" style={{ fontSize: 12 }}>INV-2026-0114 · $12,480.00</span>
    </div>
  )
}

function TightnessSample() {
  return (
    <div className="card stack-sm">
      <h3 style={{ margin: 0 }}>Accounts</h3>
      {['Northwind Trading', 'Meridian Labs', 'Halcyon Group'].map(n => (
        <div key={n} className="row" style={{ justifyContent: 'space-between' }}>
          <span>{n}</span>
          <span className="figure muted" style={{ fontSize: 12 }}>$12,480</span>
        </div>
      ))}
    </div>
  )
}

/* Shape and depth are both visible on one object: a card with an action in it,
   beside a field that shows the same corner and the same edge. */
function MoreSample() {
  return (
    <div className="stack-sm">
      <div className="card stack-sm">
        <h3 style={{ margin: 0 }}>Renewal Due</h3>
        <p style={{ margin: 0, fontSize: 12 }}>Halcyon Group renews in 6 days.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary">Send Reminder</button>
          <button className="btn btn-ghost">Dismiss</button>
        </div>
      </div>
      {/* THE FIELD IS A LABEL HOLDING A MARK AND A WORD, never a nested input.
          `label.input.with-icon` already IS the field box, so putting an
          `input.input` inside it drew a second box inside the first and left the
          `with-icon` slot empty. It rendered as a field inside a field. This is
          the markup the Index screen uses. */}
      <label className="input with-icon">
        <Ico d={IconSearch} size="sm" />
        <span className="subtle small">Search Accounts</span>
      </label>
    </div>
  )
}

const SAMPLES = {
  theme: ThemeSample,
  palette: PaletteSample,
  type: TypeSample,
  tightness: TightnessSample,
  more: MoreSample,
}

/* One pane. The frame carries the document's page colour, so the sample sits on
   the page it describes rather than on the editor's surface. */
function Pane({ vars, mode, label, Body }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</span>}
      <div className="dmd" data-theme={mode} style={{
        ...varsToStyle(vars),
        /* ── THE GHOST BORDER WAS `min-height: 100%` ──
         *
         * `.dmd` states `min-height: 100%` and 24px of padding, because in the
         * preview pane it IS the page. Here it is a card in a column, and that
         * height resolved against the whole sample block: the shorter pane's
         * frame stretched down past the taller one and its bottom edge came out
         * under the disclaimer, which then read as text overlapping a border.
         *
         * `auto` floors it at its content. The border goes entirely, on their
         * instruction: the frame already reads as a pane through its own page
         * colour against the editor's surface, so the edge was saying it twice. */
        minHeight: 'auto',
        /* ── THE STROKE, AND WHY IT IS `--dim` ──
         *
         * Their reading: the two panes look like different heights. Measured,
         * both were 237px. The illusion has a cause: the dark pane’s page
         * colour reads 1.03:1 against the editor panel, so it has no findable
         * edge, while the light pane reads 13.64 and is unmissable. One box with
         * an outline beside one without cannot be compared.
         *
         * `--bdr` is the obvious token and it is wrong here: 11.09 on the light
         * fill and 1.19 on the dark one, which is under the 1.2 a hairline needs
         * to exist at all. A line calibrated for one ground fails on the other.
         *
         * `--dim` reads 3.62 and 3.64. One token, the same weight on both.
         *
         * And the panes STRETCH, so the stroke tells the truth when the two
         * samples differ in content.
         *
         * FAINT. Their instruction: just the idea of it being there is enough,
         * and it does not need to be high-contrast. At full strength `--dim`
         * reads 3.62 and 3.64, which is a drawn edge rather than a hint.
         *
         * Measured down the alpha: 60% gives 2.02 and 2.10, 35% gives 1.48 on
         * both, 25% gives 1.31 and 1.30, 18% gives 1.21 and 1.20. The floor for
         * a hairline existing at all is about 1.2, so 18% is on it and 25% is
         * the quietest value with room above the floor.
         *
         * Symmetry is the property that matters here, not the number: 1.31
         * against 1.30 means neither pane reads as the outlined one. */
        border: '1px solid color-mix(in srgb, var(--dim) 25%, transparent)',
        flex: '1 1 auto',
        borderRadius: 8, overflow: 'hidden',
        background: 'var(--c-bg)',
        /* EVEN ON ALL FOUR SIDES. Their reading: the vertical insets looked
           bigger than the horizontal ones. The frame's own padding was equal,
           and the card inside is full width, so horizontally the eye sees the
           frame padding alone while vertically it sees that padding plus the
           card's first and last row of its own. One step here instead of two
           closes the difference. Measured after the change. */
        /* ── THE PANE GETS THE EXTRA WIDTH AS PADDING ──
         *
         * This went 8 to 4 when the modal was 880 and the panes were tight, on
         * the reading that the content needed the room. At 960 the room is there,
         * and their instruction is to spend it here: the pane reads as a page the
         * card stands on rather than as a frame clamped round it.
         *
         * One step, matching the card's own rhythm. */
        padding: PAD.sub, minWidth: 0,
      }}>
        <Body />
      </div>
    </div>
  )
}

export default function Sample({ which, answers }) {
  const Body = SAMPLES[which]

  /* Derived from the answers, memoised on them. A fresh derive on every render
     would run the whole colour pipeline for a mouse move. */
  const built = useMemo(() => {
    if (!Body) return null
    const state = applyAnswers(BASE, answers)
    const derived = derive(state)
    const theme = resolve(answers).theme.id
    /* Both means both. A single pane would show half of what was chosen. */
    const modes = theme === 'both' ? ['light', 'dark'] : [theme]
    return { panes: modes.map(m => ({ mode: m, vars: buildCssVars(derived, m) })), families: state.type.families }
  }, [Body, answers])

  /* ── DECLARING A FONT IS NOT LOADING ONE ──
   *
   * The pairing writes a family into the state and the stylesheet names it, and
   * neither of those fetches anything. Without this the sample rendered every
   * pairing in the same fallback, so Editorial and Monospace were the same
   * picture and the page proved nothing.
   *
   * Keyed on the three families rather than the whole answer object, so moving a
   * density slider does not re-request a font. `loadFont` is idempotent. */
  const families = built?.families
  useEffect(() => {
    if (families) loadDocumentFonts(families)
  }, [families?.display?.family, families?.body?.family, families?.mono?.family])

  if (!Body || !built) return null
  const twin = built.panes.length > 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* The stylesheet is the preview's own, so the primitives below mean what
          they mean in the product. Scoped by `.dmd`, exactly as the pane is. */}
      <style>{PREVIEW_CSS}</style>
      {/* 12 between the panes against 4 from a label to its own pane: 3:1.
          At 8 it measured 2.0:1 and the sweep called the two panes one group,
          which is what a reader sees too — the "Dark" label read as belonging
          to the light pane beside it. */}
      <div style={{ display: 'flex', gap: PAD.label, alignItems: 'stretch', minWidth: 0 }}>
        {built.panes.map(p => (
          <Pane key={p.mode} vars={p.vars} mode={p.mode} Body={Body}
            label={twin ? (p.mode === 'light' ? 'Light' : 'Dark') : null} />
        ))}
      </div>
      {/* PADDING ABOVE IT. At 6px the line read as a caption belonging to the
          pane rather than as a note about the whole preview. One step up the
          scale, which is 2:1 against the gap between the panes. */}
      <p style={{
        margin: 0, paddingTop: PAD.sub, fontSize: 12,
        color: 'var(--dim)', lineHeight: 1.5,
      }}>
        A stylistic representation. The final output is based on these choices,
        not limited to this arrangement. These colours are refined further by
        your later answers and by the contrast audit.
      </p>
      {/* AFTER the line, on their instruction: it divides the note from the
          choices below rather than from the panes above. A rule sits INSIDE the
          gap, half each side, so a marked boundary and an unmarked one occupy
          the same height. Same weight as the pane stroke, because one weight
          draws every line that divides. */}
      <hr style={{
        border: 0, borderTop: '1px solid color-mix(in srgb, var(--dim) 25%, transparent)',
        margin: `${PAD.sub}px 0 0`, width: '100%',
      }} />
    </div>
  )
}
