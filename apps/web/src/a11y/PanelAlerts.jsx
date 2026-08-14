/* Accessibility findings, shown where they were caused.
 *
 * The warnings chip in the preview bar is the inventory: everything wrong,
 * in one list, findable from anywhere. It is not where a fix happens. You
 * read "the emphasis easing overshoots the target", press Fix it, land on
 * Motion — and now the finding is behind you, on a chip in the other pane,
 * while the control that caused it is in front of you unannotated.
 *
 * So each panel carries its own findings at the top. Same audit, same
 * objects, filtered by the `tab` the finding already names. The chip counts
 * them; these say which control to touch.
 *
 * Findings scoped to one entry are quieter still — they render inline next to
 * that entry rather than at the top of the panel, so a 16px checkbox is
 * flagged on the checkbox and nowhere else.
 */
import { useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { audit, REQUIREMENTS } from './audit.js'
import { CloseButton, LINE } from '../ui/controls.jsx'

/* Colour marks the severity; it does not tint the text.
 *
 * These were tinted boxes — body copy on a 10%-alpha wash of its own warning
 * colour. It reads worse than the same words on the panel, which is a strange
 * price to pay for information whose entire subject is legibility. The colour
 * now lives in the icon, where it does the same signalling job against a
 * background chosen for reading. */
const TONE = {
  fail: { fg: 'var(--danger)', word: 'Fails' },
  warn: { fg: 'var(--warn)', word: 'Warning' },
  note: { fg: 'var(--muted)', word: 'Note' },
}

/* A filled triangle for the two that need attention, a circled i for the one
   that doesn't. Currency of the form, drawn rather than typed so it takes the
   tone colour and stays the same size in every font. */
function Icon({ level, fg }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true, style: { flexShrink: 0, marginTop: 1 } }
  if (level === 'note') {
    return (
      <svg {...common} fill="none" stroke={fg} strokeWidth={1.4}>
        <circle cx="8" cy="8" r="6.4" /><path d="M8 7.2v4" strokeLinecap="round" /><circle cx="8" cy="4.9" r=".75" fill={fg} stroke="none" />
      </svg>
    )
  }
  return (
    <svg {...common} fill={fg}>
      <path d="M7.13 1.66a1 1 0 0 1 1.74 0l6.03 10.85a1 1 0 0 1-.87 1.49H1.97a1 1 0 0 1-.87-1.49z" />
      <path d="M8 5.4v4.1M8 11.6v.05" stroke="var(--surf2)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

const REQ_TEXT = Object.fromEntries(REQUIREMENTS.map(r => [r.id, r.text]))

/** Every finding for one tab, memoised against the state that produced it. */
export function useFindings(tab) {
  const { state, derived } = useStore()
  return useMemo(
    () => audit(state, derived).filter(f => f.tab === tab),
    [state, derived, tab],
  )
}

/* Markdown is overkill for the two things that appear in requirement text —
   `code` and nothing else — so this handles exactly that and stays honest
   about it by leaving everything else alone. */
function ticks(text) {
  return String(text).split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2
      ? <code key={i} style={{ fontFamily: 'var(--mono)', fontSize: '0.92em', background: 'var(--surf3)', padding: '1px 4px', borderRadius: 4 }}>{part.slice(1, -1)}</code>
      : part,
  )
}

/**
 * One finding, rendered the same way everywhere it appears.
 *
 * The warnings popover in the preview bar used to draw its own version of
 * this. Two renderers for one object is two chances to restyle only half of
 * them, which is exactly what happened the first time.
 *
 * @param action  optional trailing control — the popover's "Fix it" jump
 */
export function Finding({ f, compact, action }) {
  const t = TONE[f.level] ?? TONE.note
  const [open, setOpen] = useState(false)
  const req = f.req ? REQ_TEXT[f.req] : null

  return (
    <div style={{
      /* No fill and no border — this sits on the panel and is separated from
         it by a rule on the severity side alone, which is enough to group the
         lines without boxing them in. */
      borderLeft: `2px solid ${t.fg}`,
      padding: compact ? '2px 0 2px 8px' : '4px 0 4px 12px',
      fontSize: compact ? 12 : 14, lineHeight: LINE,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Icon level={f.level} fg={t.fg} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* The severity label and the title were two things saying one
              thing — "WARNING" next to "emphasis overshoots the target" adds
              no fact the triangle and the amber had not already given. So the
              label's treatment moved onto the title and the word went away.
              The shape of the icon still carries severity without colour,
              which is the rule this app hands to everyone else. */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.07em',
            textTransform: 'uppercase', color: t.fg,
          }} title={t.word}>
            {f.title}
          </div>
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>{f.detail}</div>
          {/* The fix is the part you act on, so it gets full-strength text and
              a coloured marker rather than being set in the warning colour —
              amber body copy is the thing this restyle was undoing. */}
          {f.fix && (
            <div style={{ color: 'var(--fg)', marginTop: 4 }}>
              <span style={{ color: t.fg, marginRight: 6 }} aria-hidden>→</span>{f.fix}
            </div>
          )}
          <button onClick={() => setOpen(o => !o)} style={{
            marginTop: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 12, color: 'var(--dim)', textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}>{open ? 'Hide' : 'Why'}</button>
          {open && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              {req && <div>{ticks(req)}</div>}
            </div>
          )}
          {/* The criterion is a citation, so it never wraps — a spec number
              broken across two lines stops being one identifier. The container
              is sized to hold the longest of them instead. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)',
              whiteSpace: 'nowrap', flex: 1, minWidth: 0,
            }}>{f.criterion}</span>
            {action}
          </div>
        </div>
        {f.mode && (
          <span style={{
            flexShrink: 0, fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}>{f.mode}</span>
        )}
      </div>
    </div>
  )
}

/**
 * Panel-level findings — everything for this tab that isn't already shown
 * inline beside a specific entry.
 *
 * @param tab      the tab id findings are matched against
 * @param inlined  entry names rendered by <EntryAlerts> elsewhere on the page,
 *                 so they are not repeated here
 */
export default function PanelAlerts({ tab, inlined }) {
  const findings = useFindings(tab)
  const [dismissed, setDismissed] = useState(() => new Set())

  const shown = findings.filter(f =>
    !dismissed.has(f.id) && !(inlined && f.entry && inlined.has(f.entry)))
  if (shown.length === 0) return null

  const failing = shown.some(f => f.level === 'fail')

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
        color: 'var(--dim)',
      }}>
        Accessibility {failing ? 'Findings' : 'Warnings'}
      </div>
      {shown.map(f => (
        <div key={f.id} style={{ position: 'relative' }}>
          <Finding f={f} />
          <div style={{ position: 'absolute', top: 0, right: 0, color: 'var(--dim)' }}>
            {/* Dismissal is per-session and per-finding, not a suppression
                list. Change the token and the finding comes back, because it
                is still true. */}
            <CloseButton onClick={() => setDismissed(d => new Set(d).add(f.id))} label="Hide this finding" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Findings for one named entry, for rendering inside that entry's own card. */
export function EntryAlerts({ tab, entry }) {
  const findings = useFindings(tab)
  const mine = findings.filter(f => f.entry === entry)
  if (mine.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      {mine.map(f => <Finding key={f.id} f={f} compact />)}
    </div>
  )
}
