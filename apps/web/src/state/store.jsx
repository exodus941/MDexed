/* Document store: a reducer with undo/redo, plus memoised derivation.
   Slider drags would otherwise flood the history stack, so consecutive edits
   carrying the same tag inside a short window collapse into one entry. */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState } from 'react'
import { createInitialState } from './schema.js'
import { derive } from './derive.js'
import { changedKeys, describeChange, detailFor } from './changelog.js'

const HISTORY_LIMIT = 60
const COALESCE_MS = 700
export const LOG_LIMIT_DEFAULT = 500
export const LOG_LIMIT_MAX = 5000
const LOG_LIMIT = LOG_LIMIT_DEFAULT
const LOG_KEY = 'design-md:log'
const LOG_MAX_KEY = 'design-md:log-max'

const loadLogLimit = () => {
  try {
    const n = parseInt(localStorage.getItem(LOG_MAX_KEY), 10)
    return Number.isFinite(n) && n >= 20 && n <= LOG_LIMIT_MAX ? n : LOG_LIMIT_DEFAULT
  } catch { return LOG_LIMIT_DEFAULT }
}

/* The log outlives a reload but is deliberately not part of the document:
   it would bloat saved state, count against the API's size cap, and has no
   business in the exported file. */
const loadLog = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
    return Array.isArray(raw) ? raw.slice(-LOG_LIMIT) : []
  } catch { return [] }
}
const saveLog = log => {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-LOG_LIMIT))) } catch { /* quota */ }
}

let logSeq = 0
const initHistory = state => ({ present: state, past: [], future: [], lastTag: null, lastAt: 0, log: loadLog() })

/** Append an entry, folding a repeated tag (a slider drag) into one line. */
function appendLog(log, entry, coalesce, limit = LOG_LIMIT) {
  const last = log[log.length - 1]
  if (coalesce && last && last.tag === entry.tag && entry.at - last.at < COALESCE_MS) {
    /* Keep the original `from` — the whole drag is one change, and its start
       is where it actually began, not where the last frame was. */
    const merged = last.detail && entry.detail
      ? { ...entry.detail, from: last.detail.from }
      : (entry.detail ?? last.detail)
    return [...log.slice(0, -1), { ...last, at: entry.at, detail: merged, count: (last.count ?? 1) + 1 }]
  }
  return [...log, entry].slice(-Math.max(20, limit))
}

function reducer(h, action) {
  switch (action.type) {
    case 'set': {
      const next = typeof action.updater === 'function'
        ? action.updater(h.present)
        : { ...h.present, ...action.updater }
      if (next === h.present) return h
      const coalesce = action.tag != null && action.tag === h.lastTag && action.now - h.lastAt < COALESCE_MS
      const keys = changedKeys(h.present, next)
      const { category, label } = describeChange(action.tag, keys)
      const detail = detailFor(action.tag, h.present, next)
      return {
        present: next,
        past: coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
        future: [],
        lastTag: action.tag ?? null,
        lastAt: action.now,
        log: appendLog(
          h.log,
          { id: `l${++logSeq}-${action.now}`, at: action.now, tag: action.tag ?? null, category, label, detail },
          coalesce,
          action.logLimit
        ),
      }
    }
    case 'undo': {
      if (!h.past.length) return h
      return {
        present: h.past[h.past.length - 1],
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
        lastTag: null, lastAt: 0,
        log: appendLog(h.log, { id: `l${++logSeq}-${action.now}`, at: action.now, tag: 'undo', category: 'system', label: 'Undo' }, false),
      }
    }
    case 'redo': {
      if (!h.future.length) return h
      return {
        present: h.future[0],
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        future: h.future.slice(1),
        lastTag: null, lastAt: 0,
        log: appendLog(h.log, { id: `l${++logSeq}-${action.now}`, at: action.now, tag: 'redo', category: 'system', label: 'Redo' }, false),
      }
    }
    /* Loading a document (import, cloud open) resets history — undoing across
       a document boundary back into someone else's system makes no sense.
       The log carries on, since it's a record of what you did, not of state. */
    case 'load':
      return {
        ...initHistory(action.state),
        log: appendLog(h.log, { id: `l${++logSeq}-${action.now}`, at: action.now, tag: 'load', category: 'system', label: action.label ?? 'Document loaded' }, false),
      }
    case 'clearLog':
      return { ...h, log: [] }
    case 'trimLog':
      return { ...h, log: h.log.slice(-Math.max(20, action.limit)) }
    default:
      return h
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children, initial }) {
  const [h, dispatch] = useReducer(reducer, initial ?? createInitialState(), initHistory)
  const state = h.present

  const [logLimit, setLogLimitState] = useState(loadLogLimit)

  const set = useCallback((updater, tag) =>
    dispatch({ type: 'set', updater, tag, now: Date.now(), logLimit }), [logLimit])

  const setLogLimit = useCallback(n => {
    const clamped = Math.max(20, Math.min(LOG_LIMIT_MAX, Math.round(n) || LOG_LIMIT_DEFAULT))
    setLogLimitState(clamped)
    try { localStorage.setItem(LOG_MAX_KEY, String(clamped)) } catch { /* quota */ }
    dispatch({ type: 'trimLog', limit: clamped })
  }, [])
  const load = useCallback((next, label) => dispatch({ type: 'load', state: next, label, now: Date.now() }), [])
  const undo = useCallback(() => dispatch({ type: 'undo', now: Date.now() }), [])
  const redo = useCallback(() => dispatch({ type: 'redo', now: Date.now() }), [])
  const clearLog = useCallback(() => dispatch({ type: 'clearLog' }), [])

  const derived = useMemo(() => derive(state), [state])

  useEffect(() => { saveLog(h.log) }, [h.log])

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
    state, derived, set, load, undo, redo, clearLog,
    log: h.log, logLimit, setLogLimit,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  }), [state, derived, set, load, undo, redo, clearLog, h.log, logLimit, setLogLimit, h.past.length, h.future.length])

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
