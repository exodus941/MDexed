/* ── ONE MODAL, TWO DOORS ──
 *
 * A first visit opens on an editor with 116 controls in it, and the person who
 * came to get a design system has to become a design-system editor first. This
 * is the other door: a question page each, then a prompt they paste into an
 * agent that drives the app for them.
 *
 * THE THIRD LINE IS NOT A THIRD DOOR. Restoring the last document already
 * works, through a toast that appears on its own. It is offered here as a quiet
 * line rather than a button, because a fork with three equal choices reads as
 * three decisions when there are two.
 *
 * The wizard writes NO document. Its output is text. That is the whole design:
 * the agent makes the decisions inside the app, where the audit can judge them,
 * and the wizard only says what kind of thing to aim for.
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PAD, BTN, MODAL_BTN, CloseButton, Collapsible } from '../ui/controls.jsx'
import { PALETTES, GROUNDS, TYPE_PAIRINGS, TIGHTNESS, SHAPES, DEPTHS, INTENSITIES, THEMES, BLANK, STEPS, BRAND_MAX } from './answers.js'
import { buildPrompt, promptFilename, MDEXED_URL } from './prompt.js'
import { IconSend, IconUser, IconFolder, IconPlus } from '../preview/icons.jsx'
import CrossFade from '../ui/CrossFade.jsx'
import ColorPicker from '../ui/ColorPicker.jsx'
import Sample from './Sample.jsx'

const PANEL_X = 24

/* The prompt page is the OUTPUT, not a question, so it comes out of the count
   the door advertises. Spelled as a word, because a digit in a line of body
   copy reads as data rather than as prose. Falls back to the numeral above
   twelve, where the word is longer than the thing it says. */
const ASKED = STEPS.filter(s => s.id !== 'prompt').length
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve']
const SAY = n => WORDS[n] ?? String(n)
const PANEL_Y = 16

/* A row of choices where each one carries a note. `Segmented` is right for
   three or four bare words and wrong here: six palettes each need a sentence,
   and a sentence does not fit in an equal share of a strip. */
function Choices({ options, value, onChange, columns = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: PAD.row }}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            aria-pressed={on}
            style={{
              textAlign: 'left', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              background: on ? 'var(--accent-subtle)' : 'var(--surf2)',
              border: `1px solid ${on ? 'var(--accent)' : 'var(--bdr)'}`,
              color: 'var(--text)', font: 'inherit',
            }}>
            <span style={{ display: 'block', fontWeight: 550, fontSize: 14 }}>{o.label}</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
              {o.note}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const Field = ({ label, children, note }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{ fontSize: 12, fontWeight: 550, color: 'var(--text)' }}>{label}</span>
    {note && <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: -3 }}>{note}</span>}
    {children}
  </div>
)

/* ── THE FORK ── */

/* One glyph each, from the document's own set rather than drawn here. A stray
   inline icon beside a set that already has one is the fault the strays guard
   exists for. The set is `.dmd`-scoped by convention only: it exports plain
   JSX paths, so a 24-viewBox svg in the chrome renders them identically. */
const Glyph = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ flex: '0 0 auto' }}>
    {d}
  </svg>
)

/* A door. Icon above the words rather than beside them, because the two cards
   sit side by side and a leading icon eats width the description needs. */
function Door({ icon, title, note, primary, onClick }) {
  return (
    <button onClick={onClick} className={primary ? 'btn-primary' : 'btn-secondary'}
      style={{
        ...MODAL_BTN,
        /* A 50% BASIS, NEVER ZERO. `btn-secondary` carries a 2px border and
           `btn-primary` a 1px one, and a zero basis floors at the border width
           under `box-sizing: border-box`. The free space then split evenly on top
           of two different floors: 286 against 288. A 50% basis makes both
           over-run and shrink by the same amount, so the border cancels.
           Measured 0.06px apart. */
        flex: '1 1 50%', minWidth: 0, textAlign: 'left',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        /* 12 between the glyph and the title, 4 between title and note. One gap
           for the whole stack put the icon as close to the words as the two
           lines were to each other, so the three read as one block. The ratio
           is what does the grouping: 12 against 4 is 3:1. */
        gap: 4,
        padding: PAD.sub, borderRadius: 12,
      }}>
      <Glyph d={icon} />
      <span style={{ height: 8 }} aria-hidden="true" />
      <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
      {/* INHERIT the button's colour, never `--muted`. That token is calibrated
          against the panel surface, and on a button's own fill it measured
          1.78:1. No opacity either: at 0.85 the same line read 4.38, under the
          floor for 12px. Size and weight carry the hierarchy instead. */}
      <span style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.5 }}>{note}</span>
    </button>
  )
}

export function LaunchFork({ onGuided, onHandsOn, onRestore, restorableName, leaving }) {
  return createPortal(
    <div className={leaving ? 'anim-fade-out' : 'anim-fade'} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className={`${leaving ? 'anim-fall' : 'anim-rise'} modal-panel`} role="dialog"
        aria-modal="true" aria-labelledby="fork-title" style={{
          background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12,
          /* The same width as the wizard, so the two modals are one object that
             changes its contents rather than two that swap sizes. */
          width: 'min(960px, 100%)', display: 'flex', flexDirection: 'column',
        }}>
        <div style={{ padding: `${PANEL_Y + 8}px ${PANEL_X}px ${PANEL_Y}px`, borderBottom: '1px solid var(--bdr)' }}>
          <h2 id="fork-title" style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            Make a Design System
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Two ways in. You can switch at any point.
          </p>
        </div>

        <div style={{ padding: PANEL_X, display: 'flex', flexDirection: 'column', gap: PAD.gap }}>
          {/* Side by side, sharing the width equally: two doors, one decision.
              Stacked, the second one read as an afterthought. */}
          <div style={{ display: 'flex', gap: PAD.gap, alignItems: 'stretch' }}>
            {/* COUNT THE PAGES, NEVER TYPE THE NUMBER. This said "Four" for as
                long as the wizard had four, and the one-aspect-per-page split
                took it to seven without touching the sentence. A number typed
                into copy is a second source of truth that nothing updates. */}
            <Door primary icon={IconSend} title="Guided" onClick={onGuided}
              note={`${SAY(ASKED).replace(/^./, c => c.toUpperCase())} questions, then a prompt for an AI agent to build it.`} />
            <Door icon={IconUser} title="Hands-on" onClick={onHandsOn}
              note="The editor. Every value, yours to set." />
          </div>

          {/* Full width, and marked by an icon rather than by weight. It is not a
              third door: it reopens the one you were already behind. */}
          {restorableName && (
            <button onClick={onRestore} className="btn-ghost" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: PAD.row,
              padding: BTN.md, fontSize: 12, textAlign: 'left',
            }}>
              <Glyph d={IconFolder} size={16} />
              <span>Or Reopen “{restorableName}”</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── THE WIZARD ── */
export default function CasualWizard({ onClose, onBack, leaving }) {
  /* Derived from the page list, never typed. The footer used a literal 2, so
     adding a page would have hidden Next on the one before the last. */
  const LAST = STEPS.length - 1
  const [step, setStep] = useState(0)
  const [a, setA] = useState(BLANK)
  const set = (k, v) => setA(prev => ({ ...prev, [k]: v }))
  const prompt = useMemo(() => buildPrompt(a), [a])
  /* 'idle' | 'done' | 'manual'. A boolean could not distinguish copied from
     could-not-copy, which is exactly the distinction the reader needs. */
  const [copyState, setCopyState] = useState('idle')
  const promptRef = useRef(null)
  const firstField = useRef(null)

  useEffect(() => { if (step === 0) firstField.current?.focus() }, [step])
  useEffect(() => {
    if (copyState === 'idle') return
    /* The manual notice stays longer: it asks the reader to do something. */
    const t = setTimeout(() => setCopyState('idle'), copyState === 'manual' ? 6000 : 1600)
    return () => clearTimeout(t)
  }, [copyState])

  /* ── A FAILED COPY MUST SAY SO ──
   *
   * `navigator.clipboard` needs a secure context and a permission, and it is
   * absent or refused often enough to matter: inside an iframe, over plain
   * http, in a hardened browser. The first version caught the rejection and set
   * `copied` to false, so the button read "Copy" before the click and "Copy"
   * after it. Measured here: the write threw, the label never moved, and
   * nothing was on the clipboard.
   *
   * A silent failure on the one button the whole flow ends with. So the catch
   * selects the text instead and says what to press. Selecting is the fallback
   * every browser has, and it leaves the user one keystroke away. */
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(prompt)
      setCopyState('done')
    } catch {
      const ta = promptRef.current
      if (ta) { ta.focus(); ta.select() }
      setCopyState('manual')
    }
  }

  /* One saver, two extensions. A second copy of this for .txt would be the
     same six lines with one string changed, and the first bug fixed in one of
     them would live on in the other. */
  const save = (ext) => {
    const blob = new Blob([prompt], { type: ext === 'txt' ? 'text/plain' : 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = promptFilename(a, ext)
    document.body.appendChild(el); el.click(); el.remove()
    URL.revokeObjectURL(url)
  }


  return createPortal(
    <div className={leaving ? 'anim-fade-out' : 'anim-fade'} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className={`${leaving ? 'anim-fall' : 'anim-rise'} modal-panel`}
        role="dialog" aria-modal="true" aria-labelledby="wiz-title" style={{
          background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12,
          /* 960. Two panes at 640 left each about 290px, which is not enough for
             "Send Reminder" beside "Dismiss". 880 fitted them at 409px each and
             the panes still read tight, so the extra 80 goes into their padding
             rather than into more content. Stated once and fixed for every page:
             a modal that resizes between steps makes the reader re-find the
             buttons on each one. */
          width: 'min(960px, 100%)', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: PAD.gap,
          padding: `${PANEL_Y}px ${PANEL_X}px`, borderBottom: '1px solid var(--bdr)' }}>
          <h2 id="wiz-title" style={{ margin: 0, flex: 1, fontFamily: 'var(--display)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {STEPS[step].title}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
            {step + 1} of {STEPS.length}
          </span>
          <CloseButton onClick={onClose} label="Close" size={11} />
        </div>

        {/* Steps DISSOLVE rather than cut. Without this the content swapped in
            one frame while the panel around it stayed put, which reads as a
            glitch rather than a step. `CrossFade` keeps both trees mounted for
            one duration and already reads the reduced-motion setting. */}
        <CrossFade id={step} style={{ overflowY: 'auto' }}>
        <div style={{ padding: PANEL_X, display: 'flex', flexDirection: 'column', gap: PAD.gap + 4 }}>
          {/* ── THE PREVIEW COMES FIRST ──

              Below the choices it was the last thing on the page, so a reader
              clicked, then hunted downward for the result. Above them the
              result is already in view when the click lands. */}
          <Sample which={STEPS[step].sample} answers={a} />

          {/* ── ONE ASPECT, ITS CHOICES, ITS SAMPLE ──

              The choices sit above and the sample below, not side by side. Six
              palette cards need two columns to hold their sentences, and a
              second column for the sample would take that away. Stacked, both
              get the full width and the sample lands where the eye goes after
              a click. */}
          {STEPS[step].id === 'building' && (
            <Field label="What You’re Building"
              note="One line is enough, and you can skip it. Leave it empty and the agent asks you before it starts.">
              <input ref={firstField} className="input" value={a.building}
                onChange={e => set('building', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setStep(step + 1) }}
                /* A HINT, NOT A SPECIMEN ANSWER. Worded as a real sentence it
                   fooled me twice from a screenshot, and a reader has no better
                   clue than I did. */
                placeholder="e.g. an invoicing tool, a booking site, an internal dashboard"
                style={{ fontSize: 14 }} />
            </Field>
          )}

          {STEPS[step].id === 'theme' && (
            <Field label="Themes"
              note="Both ships a light block, a dark one, and a visible toggle. Every later preview then shows you two panes.">
              <Choices options={THEMES} value={a.theme} onChange={v => set('theme', v)} columns={3} />
            </Field>
          )}

          {STEPS[step].id === 'colours' && (
            <Field label="Brand Colours"
              note="Up to six. Skip this and the agent chooses inside the hue range you pick next. Anything you add here anchors the palette."
            >
              <BrandColours value={a.brand} onChange={v => set('brand', v)} />
            </Field>
          )}

          {STEPS[step].id === 'palette' && (
            <Field label="Hue Range" note="A range, not a swatch. The agent picks inside it.">
              <Choices options={PALETTES} value={a.palette} onChange={v => set('palette', v)} columns={2} />
            </Field>
          )}

          {STEPS[step].id === 'ground' && (
            <Field label="Ground Tint" note="What every surface and border is made of. Barely visible in light, decisive in dark.">
              <Choices options={GROUNDS} value={a.ground} onChange={v => set('ground', v)} columns={1} />
            </Field>
          )}

          {STEPS[step].id === 'type' && (
            <Field label="Pairing" note="A pairing, not a font list.">
              <Choices options={TYPE_PAIRINGS} value={a.type} onChange={v => set('type', v)} columns={2} />
            </Field>
          )}

          {STEPS[step].id === 'tightness' && (
            <Field label="Spacing" note="How much room everything gets. One number, multiplying every step on the scale.">
              <Choices options={TIGHTNESS} value={a.tightness} onChange={v => set('tightness', v)} columns={2} />
            </Field>
          )}

          {STEPS[step].id === 'more' && (
            <>
              <Field label="Shape">
                <Choices options={SHAPES} value={a.shape} onChange={v => set('shape', v)} columns={3} />
              </Field>
              <Field label="Depth">
                <Choices options={DEPTHS} value={a.depth} onChange={v => set('depth', v)} columns={2} />
              </Field>
              {/* DIRECTLY UNDER THE PAIR IT MODIFIES, because it is the second
                  half of one decision rather than a decision of its own. The
                  note names whichever half the reader is actually setting: a
                  shadow's strength is a macro and an edge's is a ramp step, and
                  a label saying "shadow" over a border control teaches the
                  wrong mechanism. */}
              <Field
                label="Intensity"
                note={a.depth === 'border'
                  ? 'How strongly the edge is drawn. Each step is a weight the palette already publishes.'
                  : 'How far the card lifts. Each step multiplies every offset, blur and tint.'}
              >
                <Choices options={INTENSITIES} value={a.intensity} onChange={v => set('intensity', v)} columns={4} />
              </Field>
            </>
          )}

          {STEPS[step].id === 'prompt' && (
            <>
              {/* ── SAY IT LOUDLY, ONCE ──

                  This was a 12px grey paragraph above a 300px block of mono, so
                  the one instruction that matters read as a caption on the thing
                  it was instructing about. A reader who came through a four-word
                  wizard is not going to hunt for it. */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: PAD.sub, borderRadius: 8,
                background: 'var(--accent-subtle)', border: '1px solid var(--accent)',
              }}>
                <strong style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                  Copy This, and Paste It to an AI Assistant.
                </strong>
                <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                  Anything that can open a web page will do. It opens{' '}
                  <span style={{ fontFamily: 'var(--mono)' }}>{MDEXED_URL.replace('https://', '')}</span>,
                  builds your design system, checks its own work, shows you the
                  result, and hands you a package to give a developer.
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  You do not need to read the text below. It is written for the assistant.
                </span>
              </div>
              <textarea ref={promptRef} readOnly value={prompt} className="input"
                style={{
                  fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.6,
                  height: 300, resize: 'vertical', whiteSpace: 'pre', overflowX: 'auto',
                }} />
            </>
          )}

        </div>
        </CrossFade>

        <div style={{ display: 'flex', alignItems: 'center', gap: PAD.row, position: 'relative',
          padding: `${PANEL_Y}px ${PANEL_X}px`, borderTop: '1px solid var(--bdr)' }}>
          {/* THE READOUT, not a toast. It sits in the footer beside the button
              that produced it, so the answer is where the question was asked.
              `role="status"` because it appears without a page change, and a
              message nobody hears is the silent failure again in a new costume. */}
          <span role="status" aria-live="polite" style={{
            position: 'absolute', left: PANEL_X, bottom: 2, fontSize: 12,
            color: copyState === 'manual' ? 'var(--warn)' : 'var(--muted)',
            pointerEvents: 'none',
          }}>
            {copyState === 'manual' ? 'Could not reach the clipboard. The text is selected — press Ctrl+C.' : ''}
          </span>
          {/* ── BACK GOES WHERE YOU CAME FROM ──

              "I’ll do it myself" used to sit here on the first page. It was a
              second route to the Hands-on door, which is one click behind the
              reader, and it sat in the slot the eye reads as Back. Two ways to
              the same place, one of them wearing another gesture’s clothes.

              Back from page one reopens the fork instead, which is where they
              came from. The Hands-on door is right there when they arrive. */}
          <button className="btn-ghost" style={MODAL_BTN}
            onClick={() => (step === 0 ? onBack() : setStep(step - 1))}>
            Back
          </button>
          <span style={{ flex: 1 }} />
          {step < LAST && (
            <button className="btn-primary" style={MODAL_BTN}

              onClick={() => setStep(step + 1)}>
              Next
            </button>
          )}
          {step === LAST && (
            <>
              <button className="btn-secondary" style={MODAL_BTN} onClick={() => save('md')}>Save as .md</button>
              <button className="btn-secondary" style={MODAL_BTN} onClick={() => save('txt')}>Save as .txt</button>
              <button className="btn-primary" style={MODAL_BTN} onClick={copy}>
                {copyState === 'done' ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── THE DOCUMENT'S OWN PICKER, AND THE SEEDS' OWN SWATCH ──
 *
 * Their instruction: the same picker the Seed selector uses, and swatches the
 * size the Seeds panel draws them. The first version was a native
 * `input[type=color]` beside a hex readout, which is a fourth colour picker in
 * a product that ships one. It also cannot do what theirs does: no model
 * switch, no OKLCH, no eyedropper.
 *
 * SIX, NOT THREE. Their words: if they want to go crazy, let us not stop them.
 *
 * The swatch states its own size. `.swatch` in the chrome sets no dimensions,
 * so a `span` carrying only a background collapses to nothing, which is the
 * class-that-sets-nothing trap. The Seeds panel states 28 inline for the same
 * reason; this states 36, because here the swatch IS the control rather than a
 * marker beside one.
 */
/* 44, matching the large control step. The Seeds panel draws 28 because there
   the swatch sits beside a name and a lock; here the swatch IS the control, and
   44 is the touch step the system already publishes. */
const SWATCH = 44

function BrandColours({ value, onChange }) {
  const [open, setOpen] = useState(null)
  const set = (i, hex) => {
    const next = [...value]
    next[i] = hex
    onChange(next.filter(Boolean))
  }
  const drop = i => {
    onChange(value.filter((_, j) => j !== i))
    setOpen(null)
  }
  /* Every colour chosen so far, plus one empty slot, up to the ceiling. An
     empty row of six reads as six decisions; one "Add" reads as none. */
  const slots = value.length < BRAND_MAX ? value.length + 1 : BRAND_MAX

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: PAD.row }}>
      <div style={{ display: 'flex', gap: PAD.row, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {value.map((hex, i) => {
          const on = open === i
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button onClick={() => setOpen(on ? null : i)}
                aria-label={`Colour ${i + 1}, ${hex}`} aria-expanded={on}
                style={{
                  width: SWATCH, height: SWATCH, padding: 0, cursor: 'pointer',
                  borderRadius: 8, background: hex,
                  border: `2px solid ${on ? 'var(--accent)' : 'rgb(0 0 0 / .2)'}`,
                  font: 'inherit',
                }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>
                {hex.replace('#', '')}
              </span>
            </div>
          )
        })}
        {/* ── AN ACTION POINT, NOT A SQUARE WITH A PLUS IN IT ──

            Their words. The empty slot was a 36px dashed box carrying a 16px
            glyph, which reads as one more swatch that happens to be blank. A
            call to action says what it does, in words, at the size of a button
            somebody is meant to press. */}
        {value.length < BRAND_MAX && (
          <button onClick={() => setOpen(value.length)} className="btn-secondary"
            style={{
              height: SWATCH, padding: `0 ${PAD.sub}px`, borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 550,
              alignSelf: 'flex-start',
            }}>
            <Glyph d={IconPlus} size={16} />
            <span>Add a Colour</span>
          </button>
        )}
      </div>
      {open !== null && (
        <div style={{ border: '1px solid var(--bdr)', borderRadius: 8, padding: PAD.row, background: 'var(--surf2)',
          display: 'flex', flexDirection: 'column', gap: PAD.row }}>
          <ColorPicker value={value[open] || '#5a6066'} onChange={hex => set(open, hex)} compact />
          <div style={{ display: 'flex', gap: PAD.row }}>
            <button className="btn-ghost" style={{ padding: BTN.sm, fontSize: 12 }}
              onClick={() => setOpen(null)}>Done</button>
            {value[open] && (
              <button className="btn-ghost" style={{ padding: BTN.sm, fontSize: 12 }}
                onClick={() => drop(open)}>Remove</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
