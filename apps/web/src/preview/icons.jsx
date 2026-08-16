/* Preview icons.

   Sized and stroked from the token values, so changing the icon settings moves
   every icon in every surface at once — which is the point of having them as
   tokens rather than as fixed SVGs. */

/* Decorative by default. Every icon in the surfaces sits beside its own
   label, so a screen reader that reads it out is repeating the label or
   narrating a shape. An icon that ever carries meaning on its own would need
   a title and `aria-hidden={false}` — none currently does. */
/* `end` marks an icon that follows its label rather than leading it.
 *
 * The stylesheet used `:last-child` to spot a trailing icon, which cannot work
 * here: a button's label is a text node, and `:last-child` only counts
 * elements. So a leading icon in `<button><Ico/>Export</button>` was both the
 * first and the last element child, matched the trailing rule, and got its gap
 * on the wrong side — 8px before the icon and nothing between the icon and the
 * word. Every labelled button in every surface, at every width.
 *
 * There is no selector that fixes this, because the thing CSS needs to see is
 * a text node it cannot select. So the markup says which it is. */
/* `...rest` is not a convenience. Without it this component silently DROPPED
   every prop it did not name — I passed a green `style` to the toast tick and
   the tick stayed grey, with nothing anywhere to say the prop had been thrown
   away. A component that discards what it is given is the same fault as a CSS
   property that does nothing: the instruction is written, it looks right in the
   source, and it never reaches the screen. */
export const Ico = ({ d, size = 'md', end = false, className = '', ...rest }) => (
  <svg className={`${end ? 'icon icon-end' : 'icon'}${className ? ' ' + className : ''}`}
    aria-hidden="true" focusable="false"
    width={`var(--icon-${size}, 16px)`} height={`var(--icon-${size}, 16px)`}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
    {...rest}>
    {d}
  </svg>
)

export const IconPlus = <path d="M12 5v14M5 12h14" />
export const IconChevron = <polyline points="6 9 12 15 18 9" />
export const IconArrow = <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>
export const IconSearch = <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
export const IconTrash = <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></>
export const IconCheck = <polyline points="20 6 9 17 4 12" />
export const IconInfo = <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>
export const IconStar = <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8z" />
export const IconFolder = <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
export const IconDownload = <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>
export const IconSend = <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>
export const IconFilter = <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
export const IconBell = <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>
export const IconUser = <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>
export const IconLock = <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>
export const IconMore = <><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>
export const IconX = <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
export const IconAlert = <><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>
export const IconCalendar = <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
export const IconChart = <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>
/* A bulb, because that is the control the document promises when a system
   ships both palettes. A sun and a moon are two marks for one button, and the
   button then has to decide which of them means "now" and which means "next".
   A bulb is one shape in both states, so nothing has to be decided. */
export const IconBulb = <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" /></>

/* ── THE THEME TOGGLE ──
 *
 * It renders only when the document ships BOTH palettes. Under light-only or
 * dark-only there is nothing to toggle, and a control that switches between one
 * thing is the clearest way to contradict the file it ships beside.
 *
 * Operable, not drawn. It flips the surface it sits on, which is what the built
 * page's own button does. A sample control that cannot be operated is a
 * drawing, and a drawing of a toggle proves nothing about a toggle.
 *
 * It carries a name, because it carries no words. `aria-pressed` says which way
 * it is set: an icon-only control with no state is a button whose meaning a
 * screen reader has to guess from an icon it cannot see. */
export const ThemeToggle = ({ theme, mode, onToggle, inspect }) => {
  if (theme !== 'both') return null
  const dark = mode === 'dark'
  /* COMPOSE THE TWO HANDLERS. `inspectProps` returns its own `onClick`, and a
     spread replaces a prop rather than adding to it, so spreading it after the
     button's own handler silently deleted the toggle. It measured as a control
     that renders, names itself and does nothing: every check on it passed.
     Pull the inspector's handler out by name and call both. */
  const { onClick: inspectClick, ...rest } = inspect ?? {}
  return (
    <button type="button" className="btn btn-secondary btn-sm icon-only"
      aria-pressed={dark}
      aria-label={dark ? 'Dark theme is on. Switch to light.' : 'Light theme is on. Switch to dark.'}
      title={dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      {...rest}
      onClick={e => {
        e.stopPropagation()
        onToggle?.(dark ? 'light' : 'dark')
        /* Alt-click is the inspector's own escape hatch, so it stays. */
        inspectClick?.(e)
      }}>
      <Ico d={IconBulb} />
    </button>
  )
}

/* Form controls drawn from tokens rather than native widgets, so radius,
   colour and size all follow the system. */
/* `className="checkbox"` is not decoration. The preview stylesheet already
   centres `.row > .checkbox`, because a box with no text in it cannot sit on a
   baseline — it has nothing to put there, so a baseline row aligns it by its
   bottom edge and it rides high beside its label. The rule was written and this
   component never carried the class, so the rule matched nothing for as long as
   both existed. A selector is only as good as the class actually on the node. */
/* THREE states, not two. `mixed` is the honest answer for a select-all box
   when some of the rows below it are chosen and some are not: unchecked claims
   nothing is selected while rows plainly are, and checked claims everything
   is. It takes the checked colours and a DASH, because the mark is what
   separates the two — a reader who cannot tell the hues apart still sees two
   shapes. The state was missing from this component and from the schema, and
   it stayed missing because no sample had a selectable list. */
/* A REAL control, not a picture of one.
 *
 * Every instance of this was a bare `<span>`: no `input`, no `role`, no
 * `aria-checked`, no `tabindex`, on any of eleven surfaces. Five sat inside a
 * `<label>` that held no control and carried no `for`, so that label named
 * nothing and clicking it did nothing.
 *
 * That is what made the target measurement meaningless rather than merely
 * wrong. The document publishes a 44px minimum and the boxes measured 16, so
 * the obvious repair is padding — and padding a span to 44px passes the check
 * while demonstrating nothing.
 *
 * The input is TRANSPARENT and stretched over its host, so the host decides
 * how big the target is. Three hosts do: a `<label>` around visible text, a
 * `td.sel-col` in a table, and the batch bar's own label. Each declares
 * `position: relative` and its own minimum. The drawn box keeps every
 * correction it already had, because a fragment leaves it a direct child of
 * whatever contained it — so `.row > .checkbox` still matches.
 *
 * `checked` with a no-op `onChange` rather than `defaultChecked`: this is a
 * SPECIMEN of a stated state, so the state is pinned. React reconciles the box
 * back to the prop, and the control stays focusable and announced.
 *
 * `indeterminate` is a DOM property with no attribute, so it can only be set
 * through the node. Third state, same as the mark. */
export const Check = ({ on, mixed, label }) => {
  const filled = on || mixed
  return (
    <>
      <input
        type="checkbox" className="checkbox-input"
        checked={!!on} onChange={() => {}}
        ref={el => { if (el) el.indeterminate = !!mixed && !on }}
        aria-label={label}
      />
      <span className="checkbox" aria-hidden="true" style={{
        width: 'var(--cmp-checkbox-size, 16px)', height: 'var(--cmp-checkbox-size, 16px)',
        borderRadius: 'var(--cmp-checkbox-rounded, var(--radius-sm, 4px))',
        border: `1px solid ${filled ? 'var(--cmp-checkbox-checked-border-color, var(--c-accent, #333))' : 'var(--cmp-checkbox-border-color, var(--c-border, #ccc))'}`,
        background: filled ? 'var(--cmp-checkbox-checked-background-color, var(--c-accent, #333))' : 'var(--cmp-checkbox-background-color, var(--c-surface, #fff))',
        color: 'var(--cmp-checkbox-checked-text-color, var(--c-accent-fg, #fff))',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {on && <svg aria-hidden="true" focusable="false" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
        {mixed && !on && <svg aria-hidden="true" focusable="false" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
      </span>
    </>
  )
}

/* A REAL control, for the same reason `Check` is one.
 *
 * Seven of these were bare spans across three surfaces — no input, no role, no
 * name — and they survived the checkbox fix because I repaired one component and
 * left its sibling. That is the class-versus-instance failure exactly, and the
 * operability check found all seven the first time it ran.
 *
 * `role="switch"` on a checkbox input is the standard pairing: the state is
 * checked or not, and the role tells a reader it is a switch rather than a tick
 * box. The track and knob stay decoration. */
export const Switch = ({ on, label }) => (
  <>
    <input
      type="checkbox" role="switch" className="switch-input"
      checked={!!on} onChange={() => {}}
      aria-label={label}
    />
    <span className="switch" aria-hidden="true" style={{
      width: 'var(--cmp-switch-width, 36px)', height: 'var(--cmp-switch-height, 20px)',
      borderRadius: 'var(--cmp-switch-rounded, 9999px)',
      background: on ? 'var(--cmp-switch-checked-background-color, var(--c-accent, #333))' : 'var(--cmp-switch-background-color, var(--c-border, #ccc))',
      display: 'inline-flex', alignItems: 'center', padding: 2, flexShrink: 0,
      justifyContent: on ? 'flex-end' : 'flex-start',
      transition: 'background var(--duration-fast, 120ms) var(--ease-standard, ease)',
    }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--c-surface, #fff)' }} />
    </span>
  </>
)
