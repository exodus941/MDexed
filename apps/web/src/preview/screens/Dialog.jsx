/* Overlays over real content.

   Modals, scrims, tooltips and toasts have nowhere honest to sit on the other
   surfaces — a modal shown inline isn't a modal. This is where the elevation
   strategy, scrim opacity and blend mode are actually visible. */
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, Check, IconAlert, IconCheck, IconX, IconTrash, IconInfo, IconMore, IconStar } from '../icons.jsx'

/* The composition rules from the Components tab, rendered. This is the only
   way to tell whether "icon above, centred, full-width actions" is what you
   actually meant — a settings list can't show you that. */
/* One id each, stated once and referenced twice, so the dialog's name and its
   description cannot drift from the elements they point at. Constants rather
   than literals because three places use them. */
const TITLE_ID = 'dmd-modal-title'
const DESC_ID = 'dmd-modal-desc'

function Modal({ ins, txt, layout, onInspect }) {
  const centred = layout.align === 'center'
  const showIcon = layout.iconPlacement !== 'none'
  const stacked = layout.iconPlacement === 'above'
  const circle = layout.iconStyle === 'circle'
  const gap = `var(--space-${layout.gap}, 12px)`

  const icon = showIcon && (
    <span {...ins('modal')} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--c-danger, #c00)', flexShrink: 0,
      ...(circle && {
        background: 'var(--c-danger-subtle, #f7e8e7)',
        borderRadius: '50%',
        padding: 'var(--space-xs, 8px)',
      }),
    }}>
      <Ico d={IconAlert} size={layout.iconSize} />
    </span>
  )

  const actionJustify = { right: 'flex-end', left: 'flex-start', center: 'center', stretch: 'stretch' }[layout.actions]
  const actionsStretch = layout.actions === 'stretch'
  /* Primary last when actions sit right, first everywhere else — that is the
     convention each arrangement carries, and the emitted guidance says so. */
  const primaryLast = layout.actions === 'right'
  const cancel = <button key="c" className="btn btn-ghost" {...ins('button-ghost')} style={actionsStretch ? { width: '100%', justifyContent: 'center' } : undefined}>Cancel</button>
  const confirm = <button key="d" className="btn btn-danger" {...ins('button-danger')} style={actionsStretch ? { width: '100%', justifyContent: 'center' } : undefined}><Ico d={IconTrash} />Delete</button>

  return (
    /* ── IT SAYS IT IS A DIALOG ──
     *
     * This surface exists to demonstrate an overlay and carried no `role` and no
     * `aria-*` at all. A keyboard reader met a card in a page, and the page
     * behind it stayed reachable. The a11y section of the emitted file never
     * said `dialog`, `aria-modal` or `role=`, so there was no rule to break.
     *
     * `aria-labelledby` points at the heading this dialog already has, rather
     * than repeating its words in an `aria-label`. Two copies of one name drift
     * the moment either is edited.
     *
     * `alertdialog` rather than `dialog`, because this one destroys something and
     * its message is the reason to stop. The role tells assistive technology to
     * read the description without being asked. */
    <div {...ins('modal')}
      role="alertdialog" aria-modal="true"
      aria-labelledby={TITLE_ID} aria-describedby={DESC_ID}
      style={{
      /* Centred by its parent now, not by a transform. See the stage below.
         `flexShrink: 0` here held it at 400px inside a 296px stage, so it
         overflowed equally on both sides and the clip took the left edge of
         every line. It must be allowed to shrink, and `maxWidth` is what keeps
         it inside the padding. */
      position: 'relative', flexShrink: 1, minWidth: 0, maxWidth: '100%',
      width: 'var(--cmp-modal-width, 400px)',
      background: 'var(--cmp-modal-background-color, var(--c-surface-raised, #fff))',
      borderRadius: 'var(--cmp-modal-rounded, var(--radius-lg, 16px))',
      padding: 'var(--cmp-modal-padding, var(--space-lg, 24px))',
      boxShadow: 'var(--cmp-modal-box-shadow, var(--shadow-modal, none))',
      border: '1px solid var(--c-border-subtle, #eee)',
      textAlign: centred ? 'center' : 'left',
    }}>
      {/* Ghost, not secondary, and the medium size rather than small.
          A bordered box in the corner reads as a third action competing with
          Cancel and Delete, when dismissing is the quietest thing on the
          dialog. At 28px it was also under the touch minimum. */}
      {layout.dismiss === 'corner' && (
        /* An icon-only control with a hidden label owes an accessible name.
           A cross is not a word. */
        <button className="btn btn-ghost icon-only" aria-label="Close" {...ins('button-ghost')}
          style={{ position: 'absolute', top: 'var(--space-sm, 12px)', right: 'var(--space-sm, 12px)' }}>
          <Ico d={IconX} />
        </button>
      )}

      <div style={{
        display: 'flex', gap: 'var(--icon-gap, 8px)', marginBottom: gap,
        ...(stacked
          ? { flexDirection: 'column', alignItems: centred ? 'center' : 'flex-start' }
          : { alignItems: 'center', justifyContent: centred ? 'center' : 'flex-start' }),
      }}>
        {icon}
        <h3 id={TITLE_ID} style={{ fontSize: 'var(--font-h5-size, 20px)' }} {...txt('h5')}>Delete this invoice?</h3>
      </div>

      <p id={DESC_ID} className="muted small" style={{ marginBottom: 'var(--space-md, 16px)' }} {...txt('body-sm', 'text-muted')}>
        Invoice NW-0421 will be removed permanently. This cannot be undone.
      </p>

      {/* `flex`, not the class's own `inline-flex`. This label stands alone in
          a block container, so an inline box puts it on a LINE box — and a
          line box is taller than the element, carrying the strut's descender
          space below it. The stated 24px gap under it measured 27.66. Same
          fault the header's `details` wrapper had, at 3.66px instead of 3.5. */}
      <label className="with-icon" {...ins('checkbox')} style={{
        display: 'flex',
        justifyContent: centred ? 'center' : 'flex-start',
      }}>
        <Check /><span className="small" {...txt('body-sm')}>Also notify the customer</span>
      </label>

      {/* A modal footer is a card's action row. They named modals alongside
          cards, and it takes the same stated distance — the buttons that
          destroy an invoice must not sit against the sentence explaining what
          will be destroyed. The 16px margin that lived on the checkbox above
          is gone: one writer for this gap, and it is the action row. */}
      <div className="card-actions" style={{
        display: 'flex', gap: 'var(--space-xs, 8px)',
        ...(actionsStretch
          ? { flexDirection: 'column' }
          : { justifyContent: actionJustify }),
      }}>
        {primaryLast ? [cancel, confirm] : [confirm, cancel]}
      </div>
    </div>
  )
}

export default function Dialog({ onInspect, layout, casing }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  const modal = layout?.modal ?? {}

  return (
    <div className="stack">
      <div>
        <h2 {...txt("h2")}>Overlays</h2>
        <p className="muted small" style={{ marginTop: 4 }} {...txt("body-sm", "text-muted")}>Modal, scrim, tooltip, toast and menu, over live page content.</p>
      </div>

      {/* Modal over a dimmed page — the scrim settings from Depth apply here. */}
      {/* The stage has to be at least as tall as what it stages.
          The fake page behind the dialog is five short lines, so on a narrow
          screen the modal was taller than its own container. The container
          then scrolled, which is the second scrollbar nobody asked for, and
          before that it clipped. A floor sized to the dialog removes both. */}
      <div style={{ position: 'relative', minHeight: '20rem', borderRadius: 'var(--radius-lg, 16px)', overflow: 'hidden', border: '1px solid var(--c-border-subtle, #eee)' }}>
        <div style={{ padding: 'var(--space-lg, 24px)' }} className="stack-sm">
          <h3 style={{ fontSize: 'var(--font-h4-size, 25px)' }} {...txt("h4")}>Invoices</h3>
          <p className="muted small" {...txt("body-sm", "text-muted")}>Page content sitting behind the dialog.</p>
          <div className="row">
            <button className="btn btn-secondary btn-sm" {...ins('button-sm')}>Filter</button>
            <button className="btn btn-secondary btn-sm" {...ins('button-secondary')}>Export</button>
          </div>
          {['82%', '64%', '91%'].map(w => (
            <div key={w} style={{ height: 8, width: w, borderRadius: 4, background: 'var(--c-bg-subtle, #eee)' }} />
          ))}
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--c-neutral-950, #111)',
          opacity: 'var(--scrim-opacity, .55)',
          mixBlendMode: 'var(--scrim-blend, normal)',
        }} />

        {/* The modal used to sit at top 50% with a translate, inside a box with
            hidden overflow. On a narrow screen it grew taller than the page
            behind it, so it bled past both edges and the clip took its corners
            and its close button with them.

            A flex box centres it without a transform, and the padding gives it
            an edge to stop against. `min-height` on the stage means there is
            something to centre within when the fake page is short. */}
        <div className="modal-stage">
          <Modal ins={ins} txt={txt} layout={modal} onInspect={onInspect} />
        </div>
      </div>

      <div className="cols-2">
        {/* Toast */}
        <div className="card card-overlay row" {...ins('card-overlay')}>
          {/* The tick goes INSIDE the message, not in a slot beside it.
              As its own flex item it had no text to give the row a baseline, so
              every value of align-self left it somewhere else: pinned to the
              top it sat 3.5px above the message's optical mid, and baseline
              alignment only got it to 2.5. Nothing in that slot could align to
              a line it was not part of.
              Inline, `vertical-align` puts it on the label's own middle, and it
              stays on the first line when the message wraps. Same arrangement
              as a field note and a badge. */}
          <span className="small line-icon" style={{ flex: 1 }} {...txt("body-sm")}>
            <Ico d={IconCheck} style={{ color: 'var(--c-success, green)' }} />Invoice sent to Northwind
          </span>
          <button className="btn btn-ghost btn-sm" {...ins('button-ghost')}>Undo</button>
        </div>

        {/* Dropdown menu */}
        <div className="card card-overlay" style={{ padding: 4 }} {...ins('card-overlay')}>
          {[['Duplicate', IconStar], ['Details', IconInfo], ['More actions', IconMore]].map(([label, icon]) => (
            <div key={label} className="with-icon nav-item" {...ins('nav-item')}>
              <Ico d={icon} />{label}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip, anchored the way one really is */}
      <div className="card" {...ins('card')}>
        <div className="row" style={{ gap: 'var(--space-xl, 32px)', paddingTop: 28, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <span {...ins('tooltip')} style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              background: 'var(--cmp-tooltip-background-color, var(--c-text, #111))',
              color: 'var(--cmp-tooltip-text-color, var(--c-text-inverse, #fff))',
              borderRadius: 'var(--cmp-tooltip-rounded, var(--radius-sm, 4px))',
              padding: 'var(--cmp-tooltip-padding, 2px 8px)',
              fontSize: 'var(--cmp-tooltip-font-size, var(--font-caption-size, 12px))',
              cursor: onInspect ? 'pointer' : undefined,
            }}>{L('Mark as paid')}</span>
            <button className="btn btn-secondary btn-sm" {...ins('button-sm')}><Ico d={IconCheck} size="sm" />Paid</button>
          </div>
          <span className="caption" {...txt("caption", "text-muted")}>Tooltips sit above their trigger and never wrap.</span>
        </div>
      </div>
    </div>
  )
}
