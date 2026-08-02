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
import { useState, useEffect } from 'react'
import { readCss } from '../emit/cssImport.js'
import { bestOn } from '../color/contrast.js'
import { PAD, BTN, CloseButton } from './controls.jsx'

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

/* The seats worth filling from an import. Status colours are deliberately
   absent — a stylesheet's green is rarely *the* success green, and getting
   that wrong is worse than leaving the default. */
const SEATS = ['accent', 'neutral']

export const IMPORT_FORMATS = 'A DESIGN.md (.md) to open, or a stylesheet (.css) to sample colours, typefaces and spacing from'

export default function ImportModal({ onClose, onApply, onOpenDocument }) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState(null)     // null | 'document' | 'css'
  const [found, setFound] = useState(null)
  const [picks, setPicks] = useState({})
  const [family, setFamily] = useState(null)
  const [seat, setSeat] = useState('accent')
  const [over, setOver] = useState(false)

  const read = (source, filename = '') => {
    setText(source); setName(filename)
    setPicks({}); setFamily(null)
    if (!source.trim()) { setKind(null); setFound(null); return }
    if (looksLikeDocument(source, filename)) { setKind('document'); setFound(null); return }
    setKind('css'); setFound(readCss(source))
  }

  /* Reading it the other way is one click, because the heuristic is a
     heuristic — a CSS file with a licence header in `---` fences would trip
     it, and being wrong should cost nothing. */
  const readAsCss = () => { setKind('css'); setFound(readCss(text)) }

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

  const pick = hex => setPicks(p => {
    const next = { ...p }
    /* Clicking a colour already assigned to the current seat clears it. */
    if (next[seat] === hex) delete next[seat]
    else next[seat] = hex
    return next
  })
  const roleOf = hex => Object.keys(picks).find(k => picks[k] === hex)

  const anything = Object.keys(picks).length > 0 || family
    || found?.spacingBase || found?.radiusBase || found?.fontBase

  const reset = () => read('')

  return (
    <div onClick={onClose} className="anim-fade" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise" style={{
        background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12,
        width: '100%', maxWidth: 720, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: PAD.gap, marginBottom: PAD.card }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>
                  {found.counts.colours} colours, {found.counts.families} families, {found.counts.spacing} spacing values
                </span>
                <button className="btn-ghost" style={ghost} onClick={reset}>Start over</button>
              </div>

              <Section title="Colours" note={`Click a swatch to assign it to ${seat}`}>
                <div style={{ display: 'flex', gap: PAD.row, marginBottom: PAD.gap }}>
                  {SEATS.map(s => (
                    <button key={s} className={seat === s ? 'seg-on' : 'seg'} onClick={() => setSeat(s)}>
                      {s}{picks[s] ? ' ✓' : ''}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: PAD.row }}>
                  {found.colours.map(c => (
                    <Swatch key={c.value} hex={c.value} count={c.count}
                      picked={!!roleOf(c.value)} role={roleOf(c.value)} onClick={() => pick(c.value)} />
                  ))}
                </div>
                <p className="panel-note" style={{ marginTop: PAD.row, fontSize: 10.5 }}>
                  Saturated colours first, then greys with the mid-tones leading — a mid grey makes a
                  better neutral than near-black. Status colours aren’t offered: a stylesheet’s green is
                  rarely <em>the</em> success green.
                </p>
              </Section>

              {found.families.length > 0 && (
                <Section title="Typefaces">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: PAD.row }}>
                    {found.families.map(f => (
                      <button key={f.value} className={family === f.value ? 'seg-on' : 'seg'}
                        onClick={() => setFamily(family === f.value ? null : f.value)}
                        title={`seen ${f.count}×`}>
                        {f.value} <span style={{ opacity: .6 }}>{f.count}×</span>
                      </button>
                    ))}
                  </div>
                  <p className="panel-note" style={{ marginTop: PAD.row, fontSize: 10.5 }}>
                    Applied as the body face. It has to exist in Google Fonts to load — otherwise the name
                    is kept and the fallback renders.
                  </p>
                </Section>
              )}

              <Section title="Measurements">
                <div style={{ display: 'flex', gap: PAD.gap, flexWrap: 'wrap' }}>
                  <Stat label="Spacing base" value={found.spacingBase ? `${found.spacingBase}px` : 'no pattern'} />
                  <Stat label="Radius" value={found.radiusBase ? `${found.radiusBase}px` : 'none found'} />
                  <Stat label="Body size" value={found.fontBase ? `${found.fontBase}px` : 'none found'} />
                </div>
                <p className="panel-note" style={{ marginTop: PAD.row, fontSize: 10.5 }}>
                  The spacing base is whichever small number divides most of the values found. “No pattern”
                  means the stylesheet doesn’t have a scale — which is worth knowing on its own.
                </p>
              </Section>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: PAD.row, padding: `${PAD.gap}px ${PAD.card + 4}px`, borderTop: '1px solid var(--bdr)' }}>
          <span style={{ fontSize: 11, color: 'var(--dim)', flex: 1 }}>
            {kind === 'document'
              ? 'Replaces every panel. Undo works.'
              : 'Applied to seeds — the scales, roles and components regenerate from them. Undo works.'}
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
              onClick={() => { onApply({ seeds: picks, family, ...found }); onClose() }}>
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const ghost = { padding: BTN.sm, fontSize: 12 }

const Section = ({ title, note, children }) => (
  <div style={{ marginBottom: PAD.card + 4 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: PAD.gap, marginBottom: PAD.label }}>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
      {note && <span style={{ fontSize: 10.5, color: 'var(--dim)' }}>{note}</span>}
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
