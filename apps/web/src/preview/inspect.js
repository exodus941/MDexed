/* Click-to-inspect wiring for the preview surfaces.

   Three rules, all learned the hard way.

   Clicks resolve to the *innermost* element the pointer is over. These listen
   on the bubble phase and stop propagation; capture phase runs outer-to-inner,
   which sent every click to the nearest container.

   The container is still on offer. Stopping propagation at the innermost
   element used to mean a card's own properties became unreachable once its
   contents were inspectable, so a click also walks up the tree and collects
   whatever its ancestors answer to. Those appear below the element's own
   targets in the menu.

   And some elements have more than one answer. A heading has a text style and
   a colour role, defined on different tabs; `text()` bundles those into one
   menu entry that opens into the two. */

export const cmp = (name, label) => ({ kind: 'component', target: name, label: label ?? `Component · ${name}` })
export const role = (name, label) => ({ kind: 'role', target: name, label: label ?? `Colour role · ${name}` })
export const type = (name, label) => ({ kind: 'type', target: name, label: label ?? `Text style · ${name}` })

/**
 * A run of text: one menu entry that opens into its font and its colour.
 * Pass the type role first — it's the more common destination.
 */
export const text = (typeName, roleName, label) => ({
  kind: 'group',
  target: `${typeName}+${roleName}`,
  label: label ?? `Text · ${typeName}`,
  children: [
    type(typeName, `Font & size · ${typeName}`),
    role(roleName, `Colour · ${roleName}`),
  ],
})

/* Descriptors are hung on the DOM node so a click can read them back off any
   ancestor. An attribute would mean serialising groups; a property costs
   nothing and dies with the node. */
const KEY = '__dmdInspect'

export const targetKey = t => `${t.kind}:${t.target}`

const normalise = targets =>
  (Array.isArray(targets) ? targets : [targets]).map(t => (typeof t === 'string' ? cmp(t) : t))

/** Own targets first, then each ancestor's, nearest first, deduplicated. */
function withAncestors(el, own) {
  const out = own.map(t => ({ ...t, from: 'self' }))
  const seen = new Set(own.map(targetKey))
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.classList?.contains('dmd')) break
    for (const t of p[KEY] ?? []) {
      if (seen.has(targetKey(t))) continue
      seen.add(targetKey(t))
      out.push({ ...t, from: 'container' })
    }
  }
  return out
}

/**
 * @param targets   a component entry name, or an array of cmp/role/type/text targets
 * @param onInspect (targets, event) — Canvas routes or offers a choice
 */
export function inspectProps(targets, onInspect) {
  if (!onInspect) return {}
  const list = normalise(targets)
  return {
    'data-cmp': list.map(targetKey).join(' '),
    title: list.length === 1 ? `${list[0].label} — click to edit` : 'Click to edit — several targets',
    ref: el => { if (el) el[KEY] = list },
    onClick: e => {
      /* Alt-click falls through to the control's own behaviour. */
      if (e.altKey) return
      e.preventDefault()
      e.stopPropagation()
      onInspect(withAncestors(e.currentTarget, list), e)
    },
    /* No `style` here. These props are spread onto elements that carry their
       own inline styles, and a `style` key in the spread silently replaces the
       whole object — which quietly dropped font sizes off headings. The
       pointer cursor comes from a `[data-cmp]` rule in the preview stylesheet
       instead. */
  }
}
