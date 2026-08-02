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
import { PAD, BTN, CloseButton } from './controls.jsx'
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
      position: 'relative', height: 46, borderRadius: 6, cursor: 'pointer', padding: 0,
      background: hex, flex: '1 1 62px', minWidth: 62,
      border: picked ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.1)',
    }}>
    <span style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 1,
      color: bestOn(hex), fontFamily: 'var(--mono)', fontSize: 8.5, lineHeight: 1.2,
    }}>
      {picked && <strong style={{ fontSize: 9 }}>{role}</strong>}
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
  { key: 'seed',  label: 'Seed' },
  { key: 'type',  label: 'Type' },
  { key: 'slug',  label: 'Slug' },
  { key: 'match', label: 'Match' },
  { key: 'value', label: 'Value', right: true },
]

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
  gridTemplateColumns: 'auto auto auto minmax(max-content, 1fr) auto auto',
  columnGap: 24,
  alignItems: 'center',
}

/* Cells sit in the grid, so they carry the row's rule and dimming themselves.
   `nowrap` without a truncation width: the column grows instead. */
const cell = (dim, extra = {}) => ({
  minWidth: 0, whiteSpace: 'nowrap', padding: '9px 0',
  borderTop: '1px solid var(--bdr)', opacity: dim ? 0.45 : 1, ...extra,
})

const headCell = (extra = {}) => ({
  whiteSpace: 'nowrap', padding: '0 0 7px', borderBottom: '1px solid var(--bdr2)',
  fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
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
      style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', justifySelf: 'start' }} />
  )
  if (compact) return box

  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      fontSize: 10.5, color: on ? 'var(--muted)' : 'var(--dim)', userSelect: 'none',
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
function MapRow({ slot, proposal, on, onToggle, onChange, palette, families }) {
  const [picking, setPicking] = useState(false)
  const conf = CONFIDENCE[proposal.confidence]
  const dim = !on

  /* The control column, one of three shapes but always the same box. */
  const control = slot.kind === 'color' ? (
    <button onClick={() => setPicking(p => !p)} disabled={dim}
      title="Choose a different colour from the file"
      style={{
        width: '100%', height: 30, borderRadius: 6, cursor: dim ? 'default' : 'pointer',
        background: proposal.value, border: '1px solid var(--bdr2)',
        color: bestOn(proposal.value), fontFamily: 'var(--mono)', fontSize: 11,
      }}>{proposal.value}</button>
  ) : slot.kind === 'font' ? (
    <select value={proposal.value} disabled={dim} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', height: 30, fontFamily: 'var(--mono)', fontSize: 11 }}>
      {[proposal.value, ...families.filter(f => f !== proposal.value)].map(f => (
        <option key={f} value={f}>{f}</option>
      ))}
    </select>
  ) : (
    <input type="number" value={proposal.value} disabled={dim} min={0} step={1}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', height: 30, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11 }} />
  )

  return (
    <>
      <div style={cell(dim, { display: 'flex' })}>
        <input type="checkbox" checked={on} onChange={e => onToggle(e.target.checked)}
          style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
          aria-label={`Apply ${slot.label}`} />
      </div>

      <div style={cell(dim, { fontSize: 12.5, color: 'var(--text)' })}>{slot.label}</div>

      <div style={cell(dim, { fontSize: 11, color: 'var(--muted)' })}>{slot.desc}</div>

      <code style={cell(dim, {
        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)',
        overflow: 'hidden', textOverflow: 'ellipsis',
      })} title={proposal.source}>{proposal.source}</code>

      {/* A chip, and the reason for the match is its tooltip.
       *
       * The reason had a column of its own and did not deserve one — a
       * sentence of prose in a table of tokens, too long to read at a glance
       * and the only thing forcing every other column to be narrow. It still
       * matters, because it is what makes an inferred row judgeable without
       * opening the stylesheet, so it hangs off the chip that summarises it. */}
      <div style={cell(dim, {})}>
        <span className="chip" style={{ color: conf.tone, borderColor: conf.tone }}
          title={`${conf.hint}\n\n${proposal.why}`}>
          {conf.label}
        </span>
      </div>

      <div style={cell(dim, { width: 176, justifySelf: 'end' })}>{control}</div>

      {picking && !dim && (
        <div style={{
          gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 0 10px',
        }}>
          {palette.map(hex => (
            <button key={hex} title={hex} onClick={() => { onChange(hex); setPicking(false) }}
              style={{
                width: 30, height: 24, borderRadius: 4, cursor: 'pointer', padding: 0, background: hex,
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
      <div onClick={e => e.stopPropagation()} className="anim-rise" style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, padding: `${PAD.card}px ${PAD.card + 4}px`, borderBottom: '1px solid var(--bdr)', fontSize: 15, lineHeight: 1.5 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, flex: 1 }}>Import a reference</span>
          <CloseButton onClick={onClose} label="Close" size={11} />
        </div>

        <div style={{ padding: PAD.card + 4, overflowY: 'auto', minHeight: 0 }}>
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
                <span style={{ fontSize: 13, color: 'var(--text)' }}>Drop a file, or click to browse</span>
                <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>.css · .md</span>
                <input type="file" accept=".css,.md,.markdown,.txt,text/css,text/markdown"
                  onChange={onFile} style={{ display: 'none' }} />
              </label>

              <p className="panel-note" style={{ marginTop: PAD.gap, fontSize: 10.5 }}>
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
                  background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 7,
                  padding: PAD.sub, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, marginBottom: PAD.gap }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>
                  {found.counts.colours} colours, {found.counts.families} families
                  {found.counts.vars > 0 && `, ${found.counts.vars} custom properties`}
                </span>
                <button className="btn-ghost" style={ghost} onClick={reset}>Start over</button>
              </div>

              <p className="panel-note" style={{ marginBottom: PAD.gap }}>
                Only selected elements from the following list go into a <strong>seed</strong>, and the
                scales, roles and components are generated from there.
              </p>

              {Object.keys(rows).length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: PAD.gap, marginBottom: PAD.gap,
                  padding: `${PAD.row}px 0`, borderTop: '1px solid var(--bdr)', borderBottom: '1px solid var(--bdr)',
                }}>
                  <SelectAll label="Select all" ids={Object.keys(rows)} off={off}
                    onSet={on => setOff(on ? new Set() : new Set(Object.keys(rows)))} />
                </div>
              )}

              {Object.keys(rows).length === 0 ? (
                <p className="panel-note">
                  Nothing in this file mapped to a slot. It may not be a stylesheet, or it may hold only
                  layout rules — neither is a failure, but there is nothing here to import.
                </p>
              ) : (
                <div style={GRID}>
                  {GROUPS.map(group => {
                    const inGroup = SLOTS.filter(s => s.group === group && rows[s.id])
                    if (!inGroup.length) return null
                    const ids = inGroup.map(s => s.id)
                    return (
                      <Fragment key={group}>
                        <div style={{
                          gridColumn: '1 / -1', fontSize: 12, fontWeight: 500, color: 'var(--text)',
                          padding: '18px 0 8px',
                        }}>{group}</div>

                        {/* The group's select-all sits in the checkbox column
                            of its own header, directly above the boxes it
                            controls. */}
                        <div style={headCell({ display: 'flex' })}>
                          <SelectAll ids={ids} off={off} compact onSet={on => setOff(s => {
                            const next = new Set(s)
                            for (const id of ids) { if (on) next.delete(id); else next.add(id) }
                            return next
                          })} />
                        </div>
                        {COLUMNS.map(c => (
                          <div key={c.key} style={headCell(c.right ? { textAlign: 'right' } : {})}>{c.label}</div>
                        ))}

                        {inGroup.map(slot => (
                          <MapRow key={slot.id} slot={slot} proposal={rows[slot.id]}
                            on={!off.has(slot.id)} onToggle={v => toggle(slot.id, v)}
                            onChange={v => setValue(slot.id, v)}
                            palette={palette} families={families} />
                        ))}
                      </Fragment>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: PAD.row, padding: `${PAD.gap}px ${PAD.card + 4}px`, borderTop: '1px solid var(--bdr)' }}>
          {/* The stylesheet case said the same thing the paragraph at the top
              says, one screen further down. One statement, once. */}
          <span style={{ fontSize: 11, color: 'var(--dim)', flex: 1 }}>
            {kind === 'document' ? 'Replaces every panel. Undo works.' : 'Undo works.'}
          </span>
          <button className="btn-ghost" style={ghost} onClick={onClose}>Cancel</button>
          {kind === 'document' ? (
            <button className="btn-primary" style={{ padding: BTN.sm, fontSize: 12 }}
              onClick={() => { onOpenDocument(text, name || 'the pasted document'); onClose() }}>
              Open It
            </button>
          ) : (
            <button className="btn-primary" disabled={!anything}
              style={{ padding: BTN.sm, fontSize: 12, opacity: anything ? 1 : .45, cursor: anything ? 'pointer' : 'not-allowed' }}
              onClick={() => { onApply(toImport(rows, accepted)); onClose() }}>
              Apply {accepted.size > 0 && `${accepted.size} ${accepted.size === 1 ? 'Value' : 'Values'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const ghost = { padding: BTN.sm, fontSize: 12 }

const Section = ({ title, note, right, children }) => (
  <div style={{ marginBottom: PAD.card + 4 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, marginBottom: PAD.label }}>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
      {note && <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>{note}</span>}
      <div style={{ flex: 1 }} />
      {right}
    </div>
    {children}
  </div>
)

const Stat = ({ label, value }) => (
  <div style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 7, padding: PAD.sub, minWidth: 108 }}>
    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>{label}</div>
    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', marginTop: 2 }}>{value}</div>
  </div>
)
