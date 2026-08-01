/* Document store: a reducer with undo/redo, plus memoised derivation.
   Slider drags would otherwise flood the history stack, so consecutive edits
   carrying the same tag inside a short window collapse into one entry. */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react'
import { createInitialState } from './schema.js'
import { derive } from './derive.js'

const HISTORY_LIMIT = 60
const COALESCE_MS = 700

const initHistory = state => ({ present: state, past: [], future: [], lastTag: null, lastAt: 0 })

function reducer(h, action) {
  switch (action.type) {
    case 'set': {
      const next = typeof action.updater === 'function'
        ? action.updater(h.present)
        : { ...h.present, ...action.updater }
      if (next === h.present) return h
      const coalesce = action.tag != null && action.tag === h.lastTag && action.now - h.lastAt < COALESCE_MS
      return {
        present: next,
        past: coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
        future: [],
        lastTag: action.tag ?? null,
        lastAt: action.now,
      }
    }
    case 'undo': {
      if (!h.past.length) return h
      return {
        present: h.past[h.past.length - 1],
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
        lastTag: null, lastAt: 0,
      }
    }
    case 'redo': {
      if (!h.future.length) return h
      return {
        present: h.future[0],
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        future: h.future.slice(1),
        lastTag: null, lastAt: 0,
      }
    }
    /* Loading a document (import, cloud open) resets history — undoing across
       a document boundary back into someone else's system makes no sense. */
    case 'load':
      return initHistory(action.state)
    default:
      return h
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children, initial }) {
  const [h, dispatch] = useReducer(reducer, initial ?? createInitialState(), initHistory)
  const state = h.present

  const set = useCallback((updater, tag) =>
    dispatch({ type: 'set', updater, tag, now: Date.now() }), [])
  const load = useCallback(next => dispatch({ type: 'load', state: next }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  const derived = useMemo(() => derive(state), [state])

  useEffect(() => {
    const onKey = e => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.key.toLowerCase() !== 'z') return
      /* Don't steal undo from a field the user is typing in. */
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return
      e.preventDefault()
      if (e.shiftKey) redo(); else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const value = useMemo(() => ({
    state, derived, set, load, undo, redo,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  }), [state, derived, set, load, undo, redo, h.past.length, h.future.length])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

/* Narrow helpers so panels don't reach through the whole document. */
export function useColor() {
  const { state, set, derived } = useStore()
  const setColor = useCallback((updater, tag) =>
    set(s => ({ ...s, color: typeof updater === 'function' ? updater(s.color) : { ...s.color, ...updater } }), tag), [set])
  return { color: state.color, setColor, ramps: derived.ramps, roles: derived.roles }
}

export function useMacros() {
  const { state, set } = useStore()
  const setMacro = useCallback((key, value) =>
    set(s => ({ ...s, macros: { ...s.macros, [key]: value } }), `macro:${key}`), [set])
  return { macros: state.macros, setMacro }
}
