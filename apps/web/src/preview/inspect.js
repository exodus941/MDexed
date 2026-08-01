/* Click-to-inspect wiring for the preview surfaces.

   Two things matter here. Clicks must resolve to the *innermost* element the
   pointer is over — a button inside a card is the button, not the card — so
   these listen on the bubble phase and stop propagation. Capture phase runs
   outer-to-inner, which sent every click to the nearest container.

   And some elements have more than one answer: a heading has a colour role
   and a type token, defined on different tabs. Those offer a choice rather
   than guessing. */

export const cmp = (name, label) => ({ kind: 'component', target: name, label: label ?? `Component · ${name}` })
export const role = (name, label) => ({ kind: 'role', target: name, label: label ?? `Colour role · ${name}` })
export const type = (name, label) => ({ kind: 'type', target: name, label: label ?? `Text style · ${name}` })

const normalise = targets =>
  (Array.isArray(targets) ? targets : [targets]).map(t => (typeof t === 'string' ? cmp(t) : t))

/**
 * @param targets   a component entry name, or an array of cmp/role/type targets
 * @param onInspect (targets, event) — Canvas routes or offers a choice
 */
export function inspectProps(targets, onInspect) {
  if (!onInspect) return {}
  const list = normalise(targets)
  return {
    'data-cmp': list.map(t => `${t.kind}:${t.target}`).join(' '),
    title: list.length === 1 ? `${list[0].label} — click to edit` : 'Click to edit — several targets',
    onClick: e => {
      /* Alt-click falls through to the control's own behaviour. */
      if (e.altKey) return
      e.preventDefault()
      e.stopPropagation()
      onInspect(list, e)
    },
    style: { cursor: 'pointer' },
  }
}
