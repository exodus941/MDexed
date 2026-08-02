/* Pick a colour, either from the palette or as a literal.

   Two columns — full picker on the left, the palette as swatches on the right
   — so the popover stays short enough to fit on screen instead of becoming a
   tall scroller. Rendered into a portal because inside a panel it was clipped
   by the overflow and crammed into its own scrollbar.

   The custom picker sits first, not last: deliberately ignoring the palette is
   a normal thing to want and shouldn't be the thing you have to hunt for.

   Shared by gradient stops and by any component property that takes a colour,
   so those two never drift into behaving differently. */
import { createPortal } from 'react-dom'
import ColorPicker from './ColorPicker.jsx'

const WIDTH = 520

/** Build the swatch groups once, from derived state. */
export function paletteGroups({ seeds, roles, ramps, rampSteps, resolveRef }) {
  return [
    { label: 'Seeds', items: seeds.map(s => ({ ref: `${s.name}.500`, hex: resolveRef(`${s.name}.500`) })) },
    { label: 'Roles', items: Object.entries(roles).map(([ref, hex]) => ({ ref, hex })) },
    ...Object.entries(ramps).map(([name, ramp]) => ({
      label: `${name} scale`,
      items: rampSteps.map(step => ({ ref: `${name}.${step}`, hex: ramp.steps[step] })),
    })),
  ]
}

/**
 * @param value     the current raw value — a token reference or a `#hex`
 * @param resolved  what that value renders as right now, for the picker
 * @param groups    swatch groups, from `paletteGroups`
 * @param anchor    the element to position against
 * @param onPick    receives either a reference or a hex, depending on choice
 * @param refFor    wraps a swatch's reference on the way out, e.g. into
 *                  `{colors.accent}`. Identity by default.
 * @param isRef     is this value a palette reference rather than a literal?
 */
export default function TokenColorPicker({
  value, resolved, groups, anchor, onPick, onClose,
  refFor = r => r,
  isRef = v => !/^#/.test(String(v ?? '')),
  note,
}) {
  const rect = anchor?.getBoundingClientRect()
  const left = rect ? Math.min(Math.max(10, rect.left), window.innerWidth - WIDTH - 10) : 40
  const below = rect ? window.innerHeight - rect.bottom : 0
  const openUp = below < 340 && rect && rect.top > below
  const following = isRef(value)

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000 }} />
      <div className="anim-pop" style={{
        position: 'fixed', left,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: (rect?.bottom ?? 0) + 8 }),
        zIndex: 2001, width: WIDTH,
        background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 10,
        boxShadow: '0 18px 44px rgba(0,0,0,.6)', padding: 12,
        display: 'grid', gridTemplateColumns: '208px 1fr', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 8 }}>
            Custom colour
          </div>
          {/* Always available — editing it detaches the value from the palette. */}
          <ColorPicker value={following ? resolved : value} onChange={onPick} compact />
          <p className="panel-note" style={{ fontSize: 10.5, marginTop: 7 }}>
            {note ?? (following
              ? <>Following <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{value}</code>. Adjusting this pins it to a literal colour.</>
              : 'This is a literal colour and ignores the palette.')}
          </p>
        </div>

        {/* paddingRight keeps the swatches off the scrollbar. */}
        <div style={{ borderLeft: '1px solid var(--bdr)', paddingLeft: 12, paddingRight: 10, maxHeight: 300, overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 5 }}>
                {group.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4 }}>
                {group.items.map(item => {
                  const out = refFor(item.ref)
                  return (
                    <button key={item.ref} onClick={() => { onPick(out); onClose() }}
                      title={`${out} — ${item.hex}`}
                      style={{
                        aspectRatio: '1', background: item.hex, borderRadius: 4, cursor: 'pointer', padding: 0,
                        border: value === out ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,.08)',
                      }} />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}
