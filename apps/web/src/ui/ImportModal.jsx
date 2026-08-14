/* One way in.
 *
 * There were two import buttons — one for a DESIGN.md, one for a stylesheet —
 * which is one more than the header can afford and one more than the idea
 * deserves. Both answer the same question: "here is something that already
 * exists, take what you can from it." So they share a door, and the door
 * works out which is which.
 *
 * They do very different things once inside, and that difference is the thing
 * the UI has to be loud about:
 *
 *   A DESIGN.md **replaces** the document. It is a whole system; opening one
 *   is opening a file.
 *
 *   A stylesheet **seeds** the document. What comes back from CSS is evidence,
 *   not a system — a brand blue and a one-off blue look identical to a regex,
 *   and only you know which is which. So everything is shown with how often it
 *   appeared, and nothing is applied until you pick it.
 *
 * Seeds, never roles or components. Seeds are the layer the whole system
 * generates from, so importing there means the scales, roles and every
 * component follow automatically. Importing further downstream would paste in
 * values that no longer track anything.
 */
import { useState, useEffect, useRef, Fragment } from 'react'
import { readCss } from '../emit/cssImport.js'
import { mapReference, toImport, SLOTS } from '../emit/cssMap.js'
import { bestOn } from '../color/contrast.js'
import { PAD, BTN, MODAL_BTN, CloseButton } from './controls.jsx'
import { vh, vw } from './zoom.js'

const GROUPS = [...new Set(SLOTS.map(s => s.group))]

/* A stylesheet never opens with a YAML fence, and a DESIGN.md always does.
   That is the whole heuristic, and it is right far more often than anything
   cleverer would be — but the user can still overrule it below. */
const looksLikeDocument = (text, name = '') =>
  /^\s*---\r?\n/.test(text) || /\.(md|markdown|txt)$/i.test(name)

const Swatch = ({ hex, count, picked, role, onClick }) => (
  <button onClick={onClick} title={`${hex} — seen ${count}×`}
    style={{
      position: 'relative', height: 48, borderRadius: 6, cursor: 'pointer', padding: 0,
      background: hex, flex: '1 1 62px', minWidth: 64,
      border: picked ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.1)',
    }}>
    <span style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 1,
      color: bestOn(hex), fontFamily: 'var(--mono)', fontSize: 8, lineHeight: 1.2,
    }}>
      {picked && <strong style={{ fontSize: 10 }}>{role}</strong>}
      <span style={{ opacity: picked ? .75 : .9 }}>{count}×</span>
    </span>
  </button>
)

/* ── The mapping table ──
 *
 * What used to be here: two seats, accent and neutral, and a wall of swatches
 * to click into them. Status colours were left out on the grounds that "a
 * stylesheet's green is rarely *the* success green".
 *
 * That was true of frequency alone, which was the only evidence being used. It
 * stops being true the moment the name is read: `--color-success-600` is not a
 * guess. And where there is no name, hue is a far better prior than nothing —
 * a colour 4° from canonical green is a green.
 *
 * So every slot is proposed, and the price of proposing more is paid by
 * confirming: nothing applies until the table is accepted, each row says where
 * it came from, and each row can be changed or switched off. A wrong guess
 * shown is cheap. A wrong guess applied silently poisons every derived token
 * downstream of the seed.
 */
/* A table. One row per slot, one line per row, columns declared once.
 *
 * There was a sixth column holding the reason for each match — a sentence of
 * prose among five columns of tokens, unreadable at a glance and the only
 * thing forcing everything else narrow. The reason still matters, so it is the
 * Match chip's tooltip now; nothing was lost but the width. */
const COLUMNS = [
  { key: 'seed',   label: 'Seed' },
  { key: 'type',   label: 'Type' },
  { key: 'slug',   label: 'Slug' },
  /* The reason for the match. Prose, so it gets the slack column and clips
     with the full sentence on hover rather than setting the row height. */
  { key: 'source', label: 'Source', flex: true },
  { key: 'match',  label: 'Match' },
  { key: 'value',  label: 'Value', right: true },
]

/* ── Spacing, in one place ──
 *
 * Every one of these was a separate literal picked in isolation, which is how
 * a table ends up with a 6px row, a 7px header and a 24px group heading that
 * do not belong to the same rhythm. One scale, declared once.
 *
 * COL_GAP is padding *inside* each cell rather than the grid's `column-gap`,
 * and that is not a stylistic preference. Cells carry the row rule on their
 * own top border — they have to, since a single grid cannot also have row
 * wrapper elements — so a real gap between columns cuts the rule into
 * segments with holes where the gaps are. Padding keeps the cells touching,
 * which keeps the line continuous, and still puts 24px between the text. */
const COL_GAP = 24
const ROW_Y = 10          // above and below a row's text
const GROUP_TOP = 26      // air above a group heading
const GROUP_BOT = 14      // group heading to its column header
const PANEL_X = 22        // modal's own side padding
const PANEL_Y = 18
/* A card's inner barrier, the same on all four sides. Nothing a card contains
   — text, control, chevron, checkbox — crosses it. */
const CARD_PAD = 12
/* Every row is as tall as the tallest thing in it, which is a field: 11.5px
   at line-height 1.4, plus the global padding and border, is the standard 36.
   Stating it as a minimum on every cell — the header included — makes the
   header a row rather than a shorter label strip above one. Left to its own
   content it came out short against the rows. */
const FIELD_H = 36
const CELL_H = FIELD_H + ROW_Y * 2

/* One grid for all three tables, not one per table.
 *
 * Content-sized columns and shared alignment are in tension: three separate
 * grids sizing themselves to their own contents will each land on different
 * widths, and the three tables stop lining up. A single container solves both
 * — every column sizes to the longest thing anywhere in it, and there is only
 * one set of tracks so nothing can disagree. Group headings are full-width
 * rows inside the same grid.
 *
 * Which means rows cannot be wrapper elements: a wrapper would be one grid
 * item, not seven. Each cell carries its own top border and dimming instead,
 * which is how a real grid table does it.
 *
 * `auto` on the four text columns so a longer token name widens its column
 * rather than being cut. The slack lands on Slug, the most variable of them. */
const GRID = {
  display: 'grid',
  /* checkbox, then the six columns. Everything hugs its content except the
     Source column, which absorbs the slack. */
  gridTemplateColumns: `auto ${COLUMNS.map(c => (c.flex ? 'minmax(0, 1fr)' : 'auto')).join(' ')}`,
  /* Zero. The gap is cell padding — see COL_GAP. */
  columnGap: 0,
  /* Stretch, not center. Centring shrink-wraps each cell to its own content,
     so in a row where the tallest thing is a 30px control the shorter cells
     float in the middle — and since each cell draws the row rule on its own
     top border, the rule becomes a staircase across seven different heights.
     Stretching puts every top edge on the same line. Cells centre their own
     content instead. */
  alignItems: 'stretch',
}

/* The header's rule is the full-strength one; the rules between rows are the
   same line at half, so ten of them do not read as a grate.
 *
 * Drawn as inset shadows rather than borders. A border is part of the box, so
 * a cell with `min-height: 54` and a 1px rule is 55 while the header — same
 * minimum, rule on the other side — came out 53. Two pixels of disagreement
 * between a header and its rows, from a line that was never meant to occupy
 * space. A shadow paints in the same place and measures nothing. */
const RULE = 'inset 0 -1px 0 var(--bdr)'
const RULE_SOFT = 'inset 0 1px 0 color-mix(in srgb, var(--bdr) 50%, transparent)'

/**
 * A cell. Carries the row's rule and dimming itself, because a single grid
 * spanning three tables cannot also have per-row wrapper elements.
 *
 * @param first  the first row under a header — its rule would double with the
 *               header's own, so it goes without
 * @param last   the rightmost column, which needs no trailing gap
 */
const cell = (dim, { first, last, lead, ...extra } = {}) => ({
  display: 'flex', alignItems: 'center',
  minWidth: 0, whiteSpace: 'nowrap',
  minHeight: CELL_H,
  paddingTop: ROW_Y, paddingBottom: ROW_Y,
  paddingLeft: lead ? CARD_PAD : 0,
  paddingRight: last ? CARD_PAD : COL_GAP,
  boxShadow: first ? 'none' : RULE_SOFT,
  opacity: dim ? 0.45 : 1, ...extra,
})

/* The card's top and bottom inset, as a full-width row of its own.
 *
 * A subgrid container cannot carry padding without shifting its tracks off the
 * parent's, and folding the inset into the header's and last row's padding
 * makes those two rows taller than the rest and pushes their text off-centre.
 * An empty row costs nothing and leaves every real row identical. */
const Spacer = () => <div style={{ gridColumn: '1 / -1', height: CARD_PAD }} />

/* The card each table sits in.
 *
 * It has to span every column *and* keep its children on the parent's tracks,
 * which is exactly what `subgrid` is for — three independent grids would each
 * size to their own contents and the tables would stop lining up with one
 * another, which is the thing the single grid was built to prevent.
 *
 * No padding on the card itself: padding on a subgrid container shifts its
 * tracks off the parent's. The inset comes from the cells instead — CARD_PAD on
 * the first and last columns, CARD_PAD folded into the header's top and the last
 * row's bottom. */
const CARD = {
  gridColumn: '1 / -1',
  display: 'grid',
  gridTemplateColumns: 'subgrid',
  background: 'var(--surf2)',
  border: '1px solid var(--bdr)',
  borderRadius: 8,
}

/* Text that has to clip needs a block inside the flex cell — `text-overflow`
   applies to a block box, not to a flex container's own text. */
const clip = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }

/* ── The Value control ──
 *
 * One box, three contents. It was three: a select and a number input taking
 * the global `input, textarea, select` padding of 8px 12px, and a button with
 * padding of its own — all three then given `height: 30`.
 *
 * With `box-sizing: border-box` that is 30 minus 16 of padding minus 2 of
 * border, leaving a twelve-pixel content box for a line that needs sixteen.
 * The text was not misaligned, it was being cut off at the bottom, which is
 * why it read as sheared rather than as low.
 *
 * So: no fixed height. Padding and line-height decide the box, identically
 * for all three, and they land on the same 30px by construction instead of by
 * assertion. The select gets room on the right for its own arrow, which is
 * drawn by the browser inside the padding box and will sit on the text if it
 * is not given space. */
const CONTROL = {
  width: '100%',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  /* No padding, no height. Both come from the global `input, textarea, select`
     rule in theme.css, which is where the 12px barrier is defined — including
     the room a select needs on the right for its chevron. Overriding either
     here is how this control drifted out of step with the rest of the app in
     the first place. */
}

/* The header is a row like any other — same ROW_Y above and below, same
   centring. It had padding on one side only, which is what made it look
   squashed and then, once it was tall enough, made its text sit low: extra
   space above pushes the content down, it does not lift it.
   The card's own top and bottom insets are spacer rows instead. */
const headCell = ({ last, lead, ...extra } = {}) => ({
  display: 'flex', alignItems: 'center',
  whiteSpace: 'nowrap',
  minHeight: CELL_H,
  paddingTop: ROW_Y, paddingBottom: ROW_Y,
  paddingLeft: lead ? CARD_PAD : 0,
  paddingRight: last ? CARD_PAD : COL_GAP,
  boxShadow: RULE,
  fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
  color: 'var(--dim)', ...extra,
})

/* Select all / none, for a group or for the lot.
 *
 * A checkbox rather than two links, because it is the same control as the one
 * on every row and it can show the third state the rows cannot: some on, some
 * off. Clicking an indeterminate box selects everything, which is what you
 * want after unticking two rows and changing your mind. */
function SelectAll({ ids, off, onSet, label, compact }) {
  const ref = useRef(null)
  const on = ids.filter(id => !off.has(id)).length
  const all = on === ids.length && ids.length > 0
  const some = on > 0 && !all

  useEffect(() => { if (ref.current) ref.current.indeterminate = some }, [some])

  /* In a column header there is one checkbox-width of room, so the count
     moves to the tooltip rather than the label being dropped entirely. */
  const box = (
    <input ref={ref} type="checkbox" checked={all} onChange={() => onSet(!all)}
      title={`${on} of ${ids.length} selected — click to select ${all ? 'none' : 'all'}`}
      aria-label={`Select all (${on} of ${ids.length})`}
      style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', justifySelf: 'start' }} />
  )
  if (compact) return box

  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      fontSize: 10, color: on ? 'var(--muted)' : 'var(--dim)', userSelect: 'none',
    }}>
      {box}
      {label} <span style={{ fontFamily: 'var(--mono)' }}>{on}/{ids.length}</span>
    </label>
  )
}

const CONFIDENCE = {
  named:    { label: 'By name',  tone: 'var(--success)', hint: 'A custom property in the file names this slot.' },
  inferred: { label: 'Inferred', tone: 'var(--warn)',    hint: 'Worked out from the colours themselves. Worth a look.' },
}

/* One row. Colour rows open a grid of every colour in the file; font rows get
   the families found; dimension rows get a number. */
function MapRow({ slot, proposal, on, onToggle, onChange, palette, families, first }) {
  const [picking, setPicking] = useState(false)
  const conf = CONFIDENCE[proposal.confidence]
  const dim = !on

  /* The control column, one of three shapes but always the same box. */
  const control = slot.kind === 'color' ? (
    <button onClick={() => setPicking(p => !p)} disabled={dim}
      title="Choose a different colour from the file"
      style={{
        ...CONTROL, padding: '8px 12px', lineHeight: 1.4, borderRadius: 6, cursor: dim ? 'default' : 'pointer',
        background: proposal.value, border: '1px solid var(--bdr2)',
        color: bestOn(proposal.value),
      }}>{proposal.value}</button>
  ) : slot.kind === 'font' ? (
    <select value={proposal.value} disabled={dim} onChange={e => onChange(e.target.value)}
      style={CONTROL}>
      {[proposal.value, ...families.filter(f => f !== proposal.value)].map(f => (
        <option key={f} value={f}>{f}</option>
      ))}
    </select>
  ) : (
    <input type="number" value={proposal.value} disabled={dim} min={0} step={1}
      onChange={e => onChange(Number(e.target.value))}
      style={{ ...CONTROL, textAlign: 'right' }} />
  )

  return (
    <>
      <div style={cell(dim, { first, lead: true, display: 'flex' })}>
        <input type="checkbox" checked={on} onChange={e => onToggle(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
          aria-label={`Apply ${slot.label}`} />
      </div>

      <div style={cell(dim, { first, fontSize: 12, color: 'var(--text)' })}>{slot.label}</div>

      <div style={cell(dim, { first, fontSize: 12, color: 'var(--muted)' })}>{slot.desc}</div>

      <code style={cell(dim, { first, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' })}>
        {proposal.source}
      </code>

      {/* Where the match came from. The one piece of prose in the table, so it
          takes the slack column and clips; the full sentence is the tooltip.
          It is what makes an inferred row judgeable without going and reading
          the stylesheet, which is why it is worth a column at all. */}
      <div style={cell(dim, { first, fontSize: 12, color: 'var(--dim)' })} title={proposal.why}>
        <span style={clip}>{proposal.why}</span>
      </div>

      <div style={cell(dim, { first })}>
        <span className="chip" style={{ color: conf.tone, borderColor: conf.tone }} title={conf.hint}>
          {conf.label}
        </span>
      </div>

      <div style={cell(dim, { first, last: true, width: 176, justifyContent: 'flex-end' })}>
        <div style={{ width: '100%' }}>{control}</div>
      </div>

      {picking && !dim && (
        <div style={{
          gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 4,
          paddingBottom: ROW_Y, marginTop: -2,
        }}>
          {palette.map(hex => (
            <button key={hex} title={hex} onClick={() => { onChange(hex); setPicking(false) }}
              style={{
                width: 32, height: 24, borderRadius: 4, cursor: 'pointer', padding: 0, background: hex,
                border: hex === proposal.value ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.12)',
              }} />
          ))}
        </div>
      )}
    </>
  )
}

export const IMPORT_FORMATS = 'A DESIGN.md (.md) to open, or a stylesheet (.css) to sample colours, typefaces and spacing from'

export default function ImportModal({ onClose, onApply, onOpenDocument }) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState(null)     // null | 'document' | 'css'
  const [found, setFound] = useState(null)
  /* The proposals, editable. Confirming is the point of the screen, so the
     table is state rather than a derived view — changing a swatch changes what
     will be applied, not what was suggested. */
  const [rows, setRows] = useState({})
  const [off, setOff] = useState(() => new Set())
  const [over, setOver] = useState(false)

  const ingest = source => {
    const f = readCss(source)
    setFound(f)
    setRows(mapReference(f).proposals)
    setOff(new Set())
  }

  const read = (source, filename = '') => {
    setText(source); setName(filename)
    if (!source.trim()) { setKind(null); setFound(null); setRows({}); return }
    if (looksLikeDocument(source, filename)) { setKind('document'); setFound(null); return }
    setKind('css'); ingest(source)
  }

  /* Reading it the other way is one click, because the heuristic is a
     heuristic — a CSS file with a licence header in `---` fences would trip
     it, and being wrong should cost nothing. */
  const readAsCss = () => { setKind('css'); ingest(text) }

  const onFile = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) f.text().then(t => read(t, f.name))
  }

  /* Paste with no text box.
   *
   * The visible affordance is the file loader, because that is the flow that
   * happens: you have a stylesheet, you load it. But a stylesheet copied out
   * of devtools was never a file, and making someone save one just to hand it
   * over is friction with nothing on the other side of it. So the window
   * listens, and the hint below the drop zone says so. Only while nothing has
   * been read yet — once you're picking swatches, Ctrl+V belongs to the page. */
  useEffect(() => {
    if (kind) return
    const onPaste = e => {
      const t = e.clipboardData?.getData('text')
      if (t && t.trim().length > 12) { e.preventDefault(); read(t) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [kind])

  const setValue = (id, value) => setRows(r => ({ ...r, [id]: { ...r[id], value } }))
  const toggle = (id, on) => setOff(s => {
    const next = new Set(s)
    if (on) next.delete(id); else next.add(id)
    return next
  })

  /* Every colour in the file, deduplicated, as the choices a colour row can be
     changed to — including the ones the matcher never claimed, since a name it
     didn't recognise is exactly the case where you need to reach in by hand. */
  const palette = found ? [...new Set([
    ...found.colours.map(c => c.value),
    ...found.vars.filter(v => v.hex).map(v => v.hex),
  ])] : []
  const families = found ? found.families.map(f => f.value) : []

  const accepted = new Set(Object.keys(rows).filter(id => !off.has(id)))
  const anything = accepted.size > 0

  const reset = () => read('')

  return (
    <div onClick={onClose} className="anim-fade" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise modal-panel" style={{
        background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12,
        /* Wide. The mapping table is eleven rows of five columns, and every
           one of them — a token name, a hex, a family, a sentence explaining
           the match — is something you read across rather than down. Wrapping
           any of it turns a scannable table into a wall. Bounded by the window
           rather than by a maximum, since there is no width at which this
           stops being easier to read. */
        width: `min(1240px, ${vw(94)})`, maxHeight: vh(88),
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, padding: `${PANEL_Y}px ${PANEL_X}px`, borderBottom: '1px solid var(--bdr)', fontSize: 16, lineHeight: 1.5 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, flex: 1 }}>Import a reference</span>
          <CloseButton onClick={onClose} label="Close" size={11} />
        </div>

        <div style={{ padding: `${PANEL_Y}px ${PANEL_X}px ${PANEL_Y + 6}px`, overflowY: 'auto', minHeight: 0 }}>
          {!kind && (
            <>
              <p className="panel-note" style={{ marginBottom: PAD.card }}>
                A <strong>DESIGN.md</strong> opens as a document and replaces what you have. A{' '}
                <strong>stylesheet</strong> gets read for colours, typefaces and spacing — and nothing
                from it is applied until you choose it, because what comes out of CSS is evidence,
                not a system.
              </p>

              <label className={`dropzone${over ? ' over' : ''}`}
                onDragOver={e => { e.preventDefault(); setOver(true) }}
                onDragLeave={() => setOver(false)}
                onDrop={e => {
                  e.preventDefault(); setOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) f.text().then(t => read(t, f.name))
                }}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .55 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5-5 5 5" /><path d="M12 5v13" />
                </svg>
                <span style={{ fontSize: 14, color: 'var(--text)' }}>Drop a file, or click to browse</span>
                <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>.css · .md</span>
                <input type="file" accept=".css,.md,.markdown,.txt,text/css,text/markdown"
                  onChange={onFile} style={{ display: 'none' }} />
              </label>

              <p className="panel-note" style={{ marginTop: PAD.gap, fontSize: 10 }}>
                You can also paste — ⌘V / Ctrl+V anywhere in this window — for the case where the CSS
                came out of devtools and was never a file.
              </p>
            </>
          )}

          {kind === 'document' && (
            <>
              <Section title="This looks like a DESIGN.md">
                <p className="panel-note" style={{ marginBottom: PAD.gap }}>
                  Opening it <strong>replaces the current document</strong> — every panel, not just the
                  colours. Undo works, but it is one step across the whole system rather than a
                  selective merge.
                </p>
                <pre style={{
                  background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8,
                  padding: PAD.sub, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--muted)',
                  maxHeight: 220, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap',
                }}>
                  {text.slice(0, 1400)}{text.length > 1400 ? '\n…' : ''}
                </pre>
              </Section>
              <button className="btn-ghost" style={ghost} onClick={readAsCss}>
                It isn’t — read it as CSS instead
              </button>
            </>
          )}

          {kind === 'css' && found && (
            <>
              {/* Three stacked blocks that were four, eight and eight pixels
                  apart, which is why the top of this read as one crowded
                  paragraph with a checkbox in it. Same scale as the table. */}
              {/* What the file turned out to contain, as cards rather than a
                  sentence. Three numbers reading as prose is three numbers
                  nobody reads; the count is the point, so the count is the
                  large thing. Start over has moved to the footer with the
                  other actions — up here it was a button adrift in a line of
                  statistics. */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <Stat label="Colours" value={found.counts.colours} />
                <Stat label="Families" value={found.counts.families} />
                <Stat label="Custom properties" value={found.counts.vars} />
              </div>

              {/* ROW_Y here and GROUP_TOP on the heading below add to the same
                  36px every other group boundary uses. */}
              <p className="panel-note" style={{ marginBottom: ROW_Y }}>
                Only selected elements from the following list go into a <strong>seed</strong>, and the
                scales, roles and components are generated from there.
              </p>

              {/* There was a global select-all here, with a rule above it that
                  belonged to nothing and sat against the checkbox. It was also
                  redundant: everything arrives selected, and the three group
                  boxes cover every row between them. */}

              {Object.keys(rows).length === 0 ? (
                <p className="panel-note">
                  Nothing in this file mapped to a slot. It may not be a stylesheet, or it may hold only
                  layout rules — neither is a failure, but there is nothing here to import.
                </p>
              ) : (
                <div style={GRID}>
                  {GROUPS.map((group, gi) => {
                    const inGroup = SLOTS.filter(s => s.group === group && rows[s.id])
                    if (!inGroup.length) return null
                    const ids = inGroup.map(s => s.id)
                    return (
                      <Fragment key={group}>
                        {/* A heading has to outrank the rows under it. At 12px
                            and weight 500 this was the same size as the Seed
                            column beside it, so "Colours" read as another row
                            rather than as the name of the table. */}
                        <div style={{
                          gridColumn: '1 / -1',
                          fontFamily: 'var(--display)', fontSize: 16, fontWeight: 600,
                          letterSpacing: '-0.01em', color: 'var(--text)',
                          /* Every heading the same, the first included — the
                             select-all row above it is spaced like a table
                             row, so this gap is the same gap as everywhere
                             else in the list. */
                          paddingTop: GROUP_TOP,
                          paddingBottom: GROUP_BOT,
                        }}>{group}</div>

                        <div style={CARD}>
                          <Spacer />
                          {/* The group's select-all sits in the checkbox column
                              of its own header, directly above the boxes it
                              controls. */}
                          <div style={headCell({ lead: true, display: 'flex' })}>
                            <SelectAll ids={ids} off={off} compact onSet={on => setOff(s => {
                              const next = new Set(s)
                              for (const id of ids) { if (on) next.delete(id); else next.add(id) }
                              return next
                            })} />
                          </div>
                          {COLUMNS.map((c, ci) => (
                            <div key={c.key} style={headCell({
                              last: ci === COLUMNS.length - 1,
                              ...(c.right ? { justifyContent: 'flex-end' } : null),
                            })}>{c.label}</div>
                          ))}

                          {inGroup.map((slot, i) => (
                            <MapRow key={slot.id} slot={slot} proposal={rows[slot.id]}
                              first={i === 0}
                              on={!off.has(slot.id)} onToggle={v => toggle(slot.id, v)}
                              onChange={v => setValue(slot.id, v)}
                              palette={palette} families={families} />
                          ))}
                          <Spacer />
                        </div>
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: PAD.row, padding: `${PANEL_Y - 4}px ${PANEL_X}px`, borderTop: '1px solid var(--bdr)' }}>
          {/* Start over on the left, the other two on the right. No copy: the
              paragraph at the top already says what happens, and "Undo works"
              is true of every action in the app — saying it here made it read
              as a caveat. The DESIGN.md case keeps its line, because that one
              genuinely does replace the whole document. */}
          {kind === 'css'
            ? <button className="btn-ghost" style={footBtn} onClick={reset}>Start over</button>
            : <span style={{ fontSize: 12, color: 'var(--dim)' }}>Replaces every panel. Undo works.</span>}
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" style={footBtn} onClick={onClose}>Cancel</button>
          {kind === 'document' ? (
            <button className="btn-primary" style={footBtn}
              onClick={() => { onOpenDocument(text, name || 'the pasted document'); onClose() }}>
              Open It
            </button>
          ) : (
            <button className="btn-primary" disabled={!anything}
              style={{ ...footBtn, opacity: anything ? 1 : .45, cursor: anything ? 'pointer' : 'not-allowed' }}
              onClick={() => { onApply(toImport(rows, accepted)); onClose() }}>
              Apply {accepted.size} of {Object.keys(rows).length} Values
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const ghost = { padding: BTN.sm, fontSize: 12 }
const footBtn = MODAL_BTN

const Section = ({ title, note, right, children }) => (
  <div style={{ marginBottom: PAD.card + 4 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, marginBottom: PAD.label }}>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
      {note && <span style={{ fontSize: 10, color: 'var(--dim)' }}>{note}</span>}
      <div style={{ flex: 1 }} />
      {right}
    </div>
    {children}
  </div>
)

/* What the file contained, one card per count.
 *
 * The number leads and the label follows, because the number is the fact and
 * the label only says which fact — reading "21 colours, 0 families, 36 custom
 * properties" as a sentence buries all three. A zero greys out rather than
 * disappearing: "no families in this file" is worth knowing, and an absent
 * card would leave you wondering whether it had been looked for. */
const Stat = ({ label, value }) => (
  <div style={{
    background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8,
    padding: '12px 16px 12px', minWidth: 116,
  }}>
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 20, lineHeight: 1.15,
      color: value ? 'var(--text)' : 'var(--dim)',
    }}>{value}</div>
    <div style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em',
      color: 'var(--muted)', marginTop: 6,
    }}>{label}</div>
  </div>
)
