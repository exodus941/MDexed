/* Cross-dissolve between two pieces of content.

   A tab switch that swaps content instantly reads as a glitch, and fading out
   to nothing before fading in reads as a flicker at 125ms. A real cross
   dissolve needs both trees on screen at once, so the outgoing one is kept
   mounted for one animation duration and overlaid.

   The outgoing layer is the React element as it was at the moment of the
   switch, which is what makes this work for content whose *styling* changed
   rather than its markup — the preview's light/dark toggle carries its CSS
   custom properties in that captured element, so the old palette really is
   still on screen while it fades.

   Absolute positioning for the outgoing layer, normal flow for the incoming
   one: layout follows the new content, so the scroll height never jumps to
   accommodate a tree that is on its way out. */
import { useEffect, useRef, useState } from 'react'

const uiDuration = () => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--t')
  const ms = parseFloat(raw)
  return Number.isFinite(ms) ? ms : 125
}

/**
 * @param id     changes when the content should dissolve. Same id, no fade.
 * @param style  applied to the positioning wrapper.
 */
export default function CrossFade({ id, children, style }) {
  const [shown, setShown] = useState({ id, outgoing: null })
  const nodeRef = useRef(children)
  const timer = useRef(0)

  /* Both layers have to appear in a single commit. Capturing the outgoing tree
     in an effect instead would render the new content alone first, and the
     re-render that follows would remount the outgoing panel — re-running its
     effects, including the one that scrolls a revealed row into view. So the
     switch is resolved during render, the escape hatch React provides for
     exactly this. */
  if (shown.id !== id) {
    const animated = !document.documentElement.classList.contains('no-anim')
    setShown({ id, outgoing: animated ? { id: shown.id, node: nodeRef.current } : null })
  }
  nodeRef.current = children

  useEffect(() => {
    if (!shown.outgoing) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShown(s => ({ ...s, outgoing: null })), uiDuration())
    return () => clearTimeout(timer.current)
  }, [shown.outgoing])

  const layers = []
  /* Keyed by id alone, and the key is the same whether a layer is incoming or
     outgoing — that is what lets React keep the same fiber and avoid a
     remount when a layer moves from "current" to "on its way out". */
  if (shown.outgoing) {
    layers.push(
      <div key={shown.outgoing.id} aria-hidden className="xfade-out"
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {shown.outgoing.node}
      </div>
    )
  }
  layers.push(
    <div key={id} className={shown.outgoing ? 'xfade-in' : undefined}>{children}</div>
  )

  return <div style={{ position: 'relative', ...style }}>{layers}</div>
}
