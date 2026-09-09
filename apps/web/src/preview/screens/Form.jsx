/* Forms are where a colour system usually fails first: placeholder against
   field, error against surface, focus ring against page. Kept on screen so
   those pairings can't quietly break. */
import { cloneElement, isValidElement, useId } from 'react'
import { inspectProps, text } from '../inspect.js'
import { labeller } from '../casing.js'
import { Ico, Check, Switch, IconCheck, IconX, IconTrash, IconChevron, IconCalendar, IconAlert } from '../icons.jsx'
/* One place that knows how a field is assembled, so the composition settings
   are demonstrated rather than described. Every field on this screen goes
   through it.

   Defined at module scope, not inside Form: a component created during render
   is a new type on every render, so React would unmount and remount every
   field — and anything you were typing in the preview would lose focus. */
function Field({ fl, ins, txt, entry, label, required, help, error, children }) {
  const inline = fl.label === 'inline'
  const marker = fl.required === 'asterisk' && required ? <span style={{ color: 'var(--c-danger, #c00)' }}> *</span>
    : fl.required === 'optional' && !required ? <span className="muted"> (optional)</span>
    : null
  const labelEl = fl.label === 'hidden'
    ? null
    : <label className="label" {...txt('caption', 'text-muted')}>{label}{marker}</label>
  /* "Replaces help" is the default because a field that grows taller the
     moment it fails validation shifts everything below it. */
  const helpEl = help && !(error && fl.error === 'replace')
    ? <span className="caption field-note" {...txt('caption', 'text-muted')}>{help}</span> : null
  /* An error carries a mark, not only a colour.
     Colour alone is the one signal a red-green eye cannot read, and it is also
     the first thing lost in a greyscale print or a screenshot. The icon says
     "something is wrong" without asking anyone to see the hue. */
  /* ── AN INVALID FIELD POINTS AT ITS OWN MESSAGE ──
   *
   * The drawing was right and the wiring was absent, which is the half a
   * picture cannot show. This field rendered the invalid border, the mark and
   * the sentence, and carried no `aria-invalid` and no `aria-describedby`. A
   * reader hearing the page was told nothing at all.
   *
   * `aria-describedby`, never `labelledby`: the label names the FIELD, and
   * replacing it with the complaint loses which field it was.
   *
   * A LIVE REGION, because the message appears after a check rather than with
   * the page. `role="status"` on the note is what announces it.
   *
   * It goes on the COMPONENT, not on the one instance. Every field on this
   * screen goes through here, so the next invalid field is wired by
   * arithmetic rather than by being remembered. Settings.jsx does it by hand
   * on its own one-off field, and that is the instance-not-class trap. */
  const errId = useId()
  const errorEl = error
    ? <span id={errId} role="status" className="caption field-note is-error" {...txt('caption', 'danger')}>
        <Ico d={IconAlert} size="sm" />{error}
      </span> : null

  /* THE CONTROL IS PASSED IN, so the wiring is cloned onto it. A field that
     states its own `aria-describedby` keeps it: a spread REPLACES a prop, and
     silently dropping a caller's value is how a helper deletes a decision. */
  const control = error && isValidElement(children)
    ? cloneElement(children, {
      'aria-invalid': children.props['aria-invalid'] ?? 'true',
      'aria-describedby': children.props['aria-describedby'] ?? errId,
    })
    : children

  const body = (
    <>
      {fl.help === 'under-label' && helpEl}
      {control}
      {fl.help !== 'under-label' && helpEl}
      {errorEl}
    </>
  )

  return (
    <div className={inline ? 'field field-inline' : 'field'} {...ins(entry)}>
      {labelEl}
      {inline ? <div className="field">{body}</div> : body}
    </div>
  )
}

export default function Form({ onInspect, layout, casing }) {
  const L = labeller(casing)
  const ins = entry => inspectProps(entry, onInspect)
  const txt = (typeName, roleName = 'text') => inspectProps(text(typeName, roleName), onInspect)
  const fl = layout?.input ?? {}

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }} className="stack">
      <div>
        <h2 {...txt('h2', 'text')}>{L('Account settings')}</h2>
        <p className="muted small" {...txt('body-sm', 'text-muted')} style={{ marginTop: 4, cursor: onInspect ? 'pointer' : undefined }}>
          These details appear on invoices and receipts.
        </p>
      </div>

      <div className="card stack" {...ins('card')}>
        <div className="cols-2">
          <Field fl={fl} ins={ins} txt={txt} entry="input" label="Legal name" required>
            <input className="input" defaultValue="Northwind Trading Co." />
          </Field>
          <Field fl={fl} ins={ins} txt={txt} entry="input" label="Trading name">
            <input className="input" placeholder="Optional" />
          </Field>
        </div>

        <Field fl={fl} ins={ins} txt={txt} entry="input-invalid" label="Billing email" required
          help="Invoices and receipts are sent here."
          error="Enter a complete email address.">
          <input className="input is-invalid" defaultValue="accounts@northwind" />
        </Field>

        <Field fl={fl} ins={ins} txt={txt} entry="textarea" label="Registered address" required>
          <textarea className="input" rows={3} defaultValue={'44 Wharf Road\nBristol BS1 4TR'} />
        </Field>

        <div className="cols-2">
          <Field fl={fl} ins={ins} txt={txt} entry="input-disabled" label="VAT number" help="Verified — contact support to change this.">
            <input className="input" disabled defaultValue="GB 429 8841 22" />
          </Field>
          <Field fl={fl} ins={ins} txt={txt} entry="select" label="Payment terms" required>
            {/* `select-trigger`, not an inline `justify-content`. A `.btn` is
                inline-block, so that property did nothing and the value sat in
                the middle of a full-width control. */}
            <button className="btn btn-secondary select-trigger select-trigger-block" style={{ height: 'var(--cmp-select-height, 36px)' }}>
              <span>Net 30</span><Ico d={IconChevron} />
            </button>
          </Field>
        </div>

        <Field fl={fl} ins={ins} txt={txt} entry="input" label="Invoice date" required>
          <div className="input-icon">
            <Ico d={IconCalendar} />
            <input className="input" defaultValue="14 Mar 2026" />
          </div>
        </Field>

        {/* A CHECKBOX MUST BELONG TO ITS OWN LABEL. These sat 16px apart while
            each box sat 8px from its own words, which is 2:1 and leaves the box
            able to belong to either line. 24 against 8 is three to one. The run
            already takes a wider gap for the 44px target, so this agrees with
            it rather than fighting it. */}
        <div className="stack-lg">
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox-checked')}>
            <Check on /><span className="small" {...txt("body-sm")}>Send a copy to my accountant</span>
          </label>
          <label className="with-icon" style={{ cursor: 'pointer' }} {...ins('checkbox')}>
            <Check /><span className="small" {...txt("body-sm")}>Attach a payment link</span>
          </label>
        </div>

        <hr className="divider" />

        <div className="well">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }} {...txt("body-md")}>{L('Automatic reminders')}</div>
              <p className="muted small" style={{ marginTop: 2 }} {...txt("body-sm", "text-muted")}>Chase unpaid invoices after 7, 14 and 30 days.</p>
            </div>
            {/* Named from the row's own heading. A switch sits apart from its
                text, so nothing announces it without this. */}
            <span {...ins('switch-checked')}><Switch on label={L('Automatic reminders')} /></span>
          </div>
        </div>

        {/* Reversed when stacked, so the primary action is the one nearest the
            thumb and the one read first. Right-aligned in a row puts Save last,
            which is correct on a desktop and backwards on a phone. */}
        <div className="row stack-narrow-rev card-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" {...ins('button-ghost')}><Ico d={IconX} />Cancel</button>
          <button className="btn btn-secondary" {...ins('button-secondary')}>{L('Save draft')}</button>
          <button className="btn btn-primary" {...ins('button-primary')}><Ico d={IconCheck} />{L('Save changes')}</button>
        </div>
      </div>

      <div className="card card-flat" {...ins('card-flat')} style={{ borderColor: 'var(--c-danger, #c2453c)', cursor: onInspect ? 'pointer' : undefined }}>
        {/* On a narrow screen the button drops below the explanation and goes
            full width. Beside the text it squeezed a two-word heading onto two
            lines and left the warning in a 100px column — and it put a
            destructive control within reach before its own explanation had
            been read. Read first, then act. */}
        <div className="row stack-narrow" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500 }} {...txt("body-md")}>{L('Close this account')}</div>
            <p className="muted small" style={{ marginTop: 2 }} {...txt("body-sm", "text-muted")}>Permanently removes all invoices and history.</p>
          </div>
          <button className="btn btn-danger btn-sm" {...ins('button-danger')}><Ico d={IconTrash} size="sm" />{L('Close account')}</button>
        </div>
      </div>
    </div>
  )
}
