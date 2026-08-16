/* Saturation/value square, hue and alpha strips, and numeric entry in five
   models. Hex in, hex out.

   HSB is held in local state rather than recomputed from the hex on every
   render: at zero saturation or zero brightness the hue is unrecoverable from
   RGB, so dragging into a corner would otherwise reset the hue to red. */
import { useState, useRef, useEffect, useCallback } from 'react'
import CrossFade from './CrossFade.jsx'
import {
  parseColor, toHex, hexFrom, isValidColor,
  toRgb255, fromRgb255, toHsl360, fromHsl360, toHsb360, fromHsb360,
  toOklchObj, fromOklch, inGamut,
} from '../color/convert.js'
import { NumField, Segmented } from './controls.jsx'

/* HEX is not a MODE. It used to be one of five, so reading the hex meant
   leaving whatever model you were working in, and the value you were adjusting
   went off screen to do it. It is now a field that is present in every model:
   always readable, always copyable, always editable. */
const MODELS = ['RGB', 'HSL', 'HSB', 'OKLCH']
const clamp01 = v => Math.max(0, Math.min(1, v))

function useDragArea(onMove) {
  const ref = useRef(null)
  const handle = useCallback(e => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onMove(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height))
  }, [onMove])
  return {
    ref,
    onPointerDown: e => { e.currentTarget.setPointerCapture(e.pointerId); handle(e) },
    onPointerMove: e => { if (e.buttons & 1) handle(e) },
    style: { touchAction: 'none' },
  }
}

/* `compact` and `stackHex` are two questions, not one.
 *
 * `compact` shrinks the swatch, and the ramp-step picker in the Colour panel
 * asks for it while still being 613px wide. `stackHex` is about the row: only
 * the token popover is narrow enough that a fourth field on it would cut the
 * digits off. Folding them into one flag put the hex on its own line in a
 * container with 613px of room. */
export default function ColorPicker({ value, onChange, alpha: allowAlpha = false, compact = false, stackHex = false }) {
  const [model, setModel] = useState('HSL')
  const [hexDraft, setHexDraft] = useState(value)
  const parsed = parseColor(value)
  const valid = parsed != null

  const [hsb, setHsb] = useState(() => (parsed ? toHsb360(parsed) : { h: 0, s: 0, b: 0, a: 1 }))
  const lastEmitted = useRef(value)

  /* Resync only when the value changed from outside this picker. */
  useEffect(() => {
    if (value === lastEmitted.current) return
    const c = parseColor(value)
    if (c) setHsb(toHsb360(c))
    setHexDraft(value)
  }, [value])

  const emit = next => {
    setHsb(next)
    const hex = hexFrom(fromHsb360(next))
    lastEmitted.current = hex
    setHexDraft(hex)
    onChange(hex)
  }
  const emitHex = hex => {
    lastEmitted.current = hex
    const c = parseColor(hex)
    if (c) setHsb(toHsb360(c))
    onChange(hex)
  }

  const svDrag = useDragArea((x, y) => emit({ ...hsb, s: Math.round(x * 100), b: Math.round((1 - y) * 100) }))
  const hueDrag = useDragArea(x => emit({ ...hsb, h: Math.round(x * 360) }))
  const alphaDrag = useDragArea(x => emit({ ...hsb, a: Math.round(x * 100) / 100 }))

  const rgb = valid ? toRgb255(parsed) : { r: 0, g: 0, b: 0, a: 1 }
  const hsl = valid ? toHsl360(parsed) : { h: 0, s: 0, l: 0, a: 1 }
  const okl = valid ? toOklchObj(parsed) : { l: 0, c: 0, h: 0, a: 1 }
  const outOfGamut = valid && !inGamut(fromOklch(okl))

  const swatchSize = compact ? 108 : 132

  /* THE HEX FIELD, present in every model.
   *
   * Declared once and placed twice, because wide and compact want it on
   * different axes and two copies of an input drift the moment either is
   * edited. The wrapper at each site states the width; the field itself has no
   * opinion about it. */
  const hexField = (
    <div style={{ width: '100%' }}>
      <label style={{
        display: 'block', fontSize: 10, textTransform: 'uppercase',
        letterSpacing: '.07em', color: 'var(--muted)', marginBottom: 4,
      }}>Hex</label>
      <input
        value={hexDraft}
        onChange={e => {
          setHexDraft(e.target.value)
          if (isValidColor(e.target.value)) emitHex(toHex(parseColor(e.target.value)))
        }}
        onBlur={() => setHexDraft(value)}
        onFocus={e => e.target.select()}
        spellCheck={false}
        aria-label="Hex value"
        placeholder="#000000"
        style={{
          fontFamily: 'var(--mono)', fontSize: 14, width: '100%',
          borderColor: isValidColor(hexDraft) ? 'var(--bdr)' : 'var(--danger)',
        }} />
    </div>
  )

  return (
    <div>
      {/* Saturation / brightness */}
      <div {...svDrag} style={{
        ...svDrag.style, position: 'relative', height: swatchSize, borderRadius: 8, cursor: 'crosshair',
        border: '1px solid var(--bdr)', overflow: 'hidden', marginBottom: 8,
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsb.h},100%,50%))`,
      }}>
        <div style={{
          position: 'absolute', left: `${hsb.s}%`, top: `${100 - hsb.b}%`,
          width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: '50%',
          border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.4), inset 0 0 0 1px rgba(0,0,0,.2)',
          background: valid ? value : '#000', pointerEvents: 'none',
        }} />
      </div>

      {/* Hue */}
      <div {...hueDrag} style={{
        ...hueDrag.style, position: 'relative', height: 12, borderRadius: 6, cursor: 'pointer', marginBottom: 8,
        background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
        border: '1px solid var(--bdr)',
      }}>
        <div style={{
          position: 'absolute', left: `${(hsb.h / 360) * 100}%`, top: '50%',
          width: 12, height: 12, marginLeft: -6.5, marginTop: -6.5, borderRadius: '50%',
          border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.4)',
          background: `hsl(${hsb.h},100%,50%)`, pointerEvents: 'none',
        }} />
      </div>

      {/* Alpha */}
      {allowAlpha && (
        <div {...alphaDrag} style={{
          ...alphaDrag.style, position: 'relative', height: 12, borderRadius: 6, cursor: 'pointer', marginBottom: 8,
          border: '1px solid var(--bdr)',
          backgroundImage: `linear-gradient(to right, transparent, ${valid ? toHex({ ...parsed, alpha: 1 }) : '#000'}), linear-gradient(45deg,#3a3a44 25%,transparent 25%,transparent 75%,#3a3a44 75%),linear-gradient(45deg,#3a3a44 25%,#22222a 25%,#22222a 75%,#3a3a44 75%)`,
          backgroundSize: '100% 100%, 8px 8px, 8px 8px',
          backgroundPosition: '0 0, 0 0, 4px 4px',
        }}>
          <div style={{
            position: 'absolute', left: `${(hsb.a ?? 1) * 100}%`, top: '50%',
            width: 12, height: 12, marginLeft: -6.5, marginTop: -6.5, borderRadius: '50%',
            border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.4)', pointerEvents: 'none',
          }} />
        </div>
      )}

      {/* The model selector gets the row to itself.
       *
       * The eyedropper used to sit at the end of it behind a flex spacer, and
       * five model buttons plus a button already exceed the width the picker
       * is given inside a role card — so it hung off the right edge. It now
       * sits beside the value field below, where there is always room because
       * that row is one input wide, and where it is arguably better placed
       * anyway: it produces a value, so it belongs next to the value. */}
      <div style={{ marginBottom: 8 }}>
        <Segmented options={MODELS} value={model} onChange={setModel} size="sm" full />
      </div>

      {/* Numeric entry. Switching model swaps one set of fields for another,
          which is a tab change in everything but name — dissolve it. */}
      {/* WIDE: the hex sits BESIDE the model's own fields, as a fourth field on
          the same row. COMPACT: it goes UNDER them, because the popover's left
          column cannot hold four fields — measured at 13px of content box
          against 27.1px for "360". Same field either way; only the axis moves.

          `align-items: flex-end` on the row, NOT flex-start. Every field is a
          label above an input, and the eyedropper is an input-height button with
          no label. Top-aligned it sat level with the LABELS, a whole line above
          the boxes it belongs beside. Bottom-aligned, its box and theirs share
          both edges, because they are the same height. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
        <CrossFade id={model}>
      {model === 'RGB' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {['r', 'g', 'b'].map(k => (
            <NumField key={k} label={k.toUpperCase()} value={rgb[k]} min={0} max={255}
              onChange={v => emitHex(hexFrom(fromRgb255({ ...rgb, [k]: v })))} />
          ))}
        </div>
      )}

      {model === 'HSL' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <NumField label="H" suffix="°" value={hsl.h} min={0} max={360} onChange={v => emitHex(hexFrom(fromHsl360({ ...hsl, h: v })))} />
          <NumField label="S" suffix="%" value={hsl.s} min={0} max={100} onChange={v => emitHex(hexFrom(fromHsl360({ ...hsl, s: v })))} />
          <NumField label="L" suffix="%" value={hsl.l} min={0} max={100} onChange={v => emitHex(hexFrom(fromHsl360({ ...hsl, l: v })))} />
        </div>
      )}

      {model === 'HSB' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <NumField label="H" suffix="°" value={hsb.h} min={0} max={360} onChange={v => emit({ ...hsb, h: v })} />
          <NumField label="S" suffix="%" value={hsb.s} min={0} max={100} onChange={v => emit({ ...hsb, s: v })} />
          <NumField label="B" suffix="%" value={hsb.b} min={0} max={100} onChange={v => emit({ ...hsb, b: v })} />
        </div>
      )}

      {model === 'OKLCH' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <NumField label="L" suffix="%" value={Math.round(okl.l * 100)} min={0} max={100} onChange={v => emitHex(hexFrom(fromOklch({ ...okl, l: v / 100 })))} />
            <NumField label="C" value={okl.c} min={0} max={0.4} step={0.005} onChange={v => emitHex(hexFrom(fromOklch({ ...okl, c: v })))} />
            <NumField label="H" suffix="°" value={okl.h} min={0} max={360} onChange={v => emitHex(hexFrom(fromOklch({ ...okl, h: v })))} />
          </div>
          {outOfGamut && (
            <div style={{ fontSize: 10, color: 'var(--warn)', marginTop: 6, lineHeight: 1.4 }}>
              Outside the sRGB gamut — chroma was reduced to fit.
            </div>
          )}
        </div>
      )}
        </CrossFade>
          </div>

          {/* Wide only: a stated width, because it holds exactly seven mono
              characters and a share of the row would steal room from the fields
              carrying the digits. */}
          {!stackHex && <div style={{ width: 104, flexShrink: 0 }}>{hexField}</div>}

          {/* Square, so it matches the field height rather than sitting proud of
              it, and only rendered where the browser can actually open one. */}
          {typeof window !== 'undefined' && 'EyeDropper' in window && (
            <button className="btn-ghost" title="Pick a colour from anywhere on screen"
              aria-label="Pick a colour from anywhere on screen"
              style={{ padding: 0, width: 36, height: 36, flexShrink: 0, justifyContent: 'center' }}
              onClick={async () => {
                try {
                  const { sRGBHex } = await new window.EyeDropper().open()
                  emitHex(sRGBHex)
                } catch { /* the user dismissed the picker */ }
              }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 22l1-4 9-9 3 3-9 9-4 1z" /><path d="M15 6l3 3" /><path d="M17.5 3.5a2.12 2.12 0 013 3L18 9l-3-3 2.5-2.5z" />
              </svg>
            </button>
          )}
        </div>

        {/* Compact only: its own line, full width. */}
        {stackHex && hexField}
      </div>
    </div>
  )
}
