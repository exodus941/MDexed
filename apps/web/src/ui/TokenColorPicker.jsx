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
import { viewport } from './zoom.js'

/* ── THE LEFT COLUMN HOLDS THREE NUMBER FIELDS, SO IT IS SIZED BY THEM ──
 *
 * At 208px each field came out 51.3px wide, and a field spends 36px of that on
 * padding: 12 at the left and 24 at the right for the degree or percent suffix.
 * That leaves 13px of content box. Measured in the field's own 14px face:
 *
 *   "66"     16.7px    cut off by  3.7
 *   "100"    25.7px    cut off by 12.7
 *   "360"    27.1px    cut off by 14.1
 *   "0.375"  38.7px    cut off by 25.7   (the OKLCH chroma)
 *
 * So the widest legal value in the picker needs 38.7px of ink, and the column
 * has to carry three of those plus their padding and gaps:
 *   3 * (38.7 + 36) + 2 * 6 = 236, rounded up to the 4px grid at 240.
 *
 * 312 is that with room to spare, and it is also the 50% they asked for. The
 * popover grows by the same 104px so the swatch column keeps its 274px; taking
 * it out of the swatches instead would have reflowed the 11-across grid. */
const LEFT_COL = 312
const WIDTH = 520 + (LEFT_COL - 208)

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
  /* An anchor can legitimately be missing: a ref that has not attached yet, or
     a swatch held in a ref array that a re-render has moved. The old fallback
     put the panel at 40,8 — the top-left corner of the window, nowhere near
     whatever was clicked, which reads as the picker having failed to open
     rather than as having opened somewhere odd. Centring it is unambiguous:
     it is clearly a panel that appeared, and it is clearly about the thing you
     just clicked because nothing else is open. */
  /* The rect and the window bounds are both reported in viewport pixels, with
     the UI scale already applied; `left` and `bottom` are lengths on an
     element the scale is about to apply again. `vp` converts once so every
     number below is in the same space. */
  const vp = viewport()
  const r = anchor?.getBoundingClientRect()
  const rect = r && { left: vp.x(r.left), top: vp.x(r.top), bottom: vp.x(r.bottom) }
  const left = rect
    ? Math.min(Math.max(10, rect.left), vp.w - WIDTH - 10)
    : Math.max(10, (vp.w - WIDTH) / 2)
  const below = rect ? vp.h - rect.bottom : 0
  const openUp = !!rect && below < 340 && rect.top > below
  const following = isRef(value)

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-popover)' }} />
      <div className="anim-pop" style={{
        position: 'fixed', left,
        ...(openUp ? { bottom: vp.h - rect.top + 8 } : { top: rect ? rect.bottom + 8 : 80 }),
        /* One token with the catcher above, which is its earlier sibling. */
        zIndex: 'var(--z-popover)', width: WIDTH,
        background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 12,
        boxShadow: '0 18px 44px rgba(0,0,0,.6)', padding: 12,
        display: 'grid', gridTemplateColumns: `${LEFT_COL}px 1fr`, gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 8 }}>
            Custom colour
          </div>
          {/* Always available — editing it detaches the value from the palette. */}
          {/* `stackHex` only here. This column is the one narrow enough that a
              fourth field on the row cuts the digits off. */}
          <ColorPicker value={following ? resolved : value} onChange={onPick} compact stackHex />
          <p className="panel-note" style={{ fontSize: 10, marginTop: 8 }}>
            {note ?? (following
              ? <>Following <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{value}</code>. Adjusting this pins it to a literal colour.</>
              : 'This is a literal colour and ignores the palette.')}
          </p>
        </div>

        {/* paddingRight keeps the swatches off the scrollbar. */}
        <div style={{ borderLeft: '1px solid var(--bdr)', paddingLeft: 12, paddingRight: 12, maxHeight: 300, overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 6 }}>
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
