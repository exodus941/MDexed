/* The AI surface for the Rationale panel.

   Two actions per section — refine what you wrote, or draft from the tokens —
   and both land in a diff you have to accept. The model never writes into the
   document directly. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { loadModels, pickDefaultModel, complete } from './client.js'
import { systemPrompt, refinePrompt, draftPrompt } from './prompts.js'
import ReviewDiff from './ReviewDiff.jsx'
import { Expand, BTN } from '../ui/controls.jsx'

const MODEL_KEY = 'dmd.ai.model'
const AiCtx = createContext(null)

/* ── Setup ───────────────────────────────────────────────────────────────── */

export function AiProvider({ children }) {
  const [state, setState] = useState({ models: [], configured: false, loading: true, error: null })
  const [model, setModelRaw] = useState(() => { try { return localStorage.getItem(MODEL_KEY) } catch { return null } })

  useEffect(() => {
    let live = true
    loadModels().then(r => {
      if (!live) return
      setState({ models: r.models, configured: r.configured, loading: false, error: r.error })
      /* Keep the stored choice only if it's still on offer — free models come
         and go on OpenRouter without notice. */
      setModelRaw(prev => (prev && r.models.some(m => m.id === prev) ? prev : pickDefaultModel(r.models)))
    })
    return () => { live = false }
  }, [])

  const setModel = useCallback(id => {
    setModelRaw(id)
    try { localStorage.setItem(MODEL_KEY, id) } catch { /* private mode */ }
  }, [])

  return <AiCtx.Provider value={{ ...state, model, setModel }}>{children}</AiCtx.Provider>
}

export const useAi = () => useContext(AiCtx) ?? { models: [], configured: false, loading: true, error: null, model: null, setModel: () => {} }

/** Header strip: model choice, or what to do about the missing key. */
export function AiHeader() {
  const { models, configured, loading, error, model, setModel } = useAi()

  if (loading) return <Note>Checking for available models…</Note>

  if (!configured) {
    return (
      <div style={box}>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 6 }}>
          AI assistance is off — the server has no OpenRouter key.
        </div>
        <p className="panel-note" style={{ marginBottom: 7 }}>
          Get a free key at <code>openrouter.ai/keys</code>, then give it to the Worker. It stays server-side;
          it is never sent to this page.
        </p>
        <pre style={pre}>{'# deployed\nwrangler secret put OPENROUTER_API_KEY\n\n# local — apps/api/.dev.vars (gitignored)\nOPENROUTER_API_KEY=sk-or-...'}</pre>
      </div>
    )
  }

  if (error || !models.length) {
    return <Note>Couldn’t load the model list{error ? ` — ${error}` : ''}. The rest of the editor is unaffected.</Note>
  }

  const chosen = models.find(m => m.id === model)
  return (
    /* Bottom-aligned, not centred.
     *
     * The left column is a label stacked on a select; the right is two lines
     * of text. Centring the two made the text float in the middle of a taller
     * neighbour, which read as a blank line beneath it and put the whole card
     * off its axis. Aligning to the bottom sits the note on the select's
     * baseline, where it belongs — it describes the select. */
    <div style={{ ...box, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <label style={{ marginBottom: 4 }}>Model</label>
        <select value={model ?? ''} onChange={e => setModel(e.target.value)} style={{ width: '100%', display: 'block' }}>
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 190, flexShrink: 0, paddingBottom: 7 }}>
        {models.length} free models{chosen?.context ? `, ${Math.round(chosen.context / 1000)}k context` : ''}.
        {' '}Free tiers are rate-limited.
      </div>
    </div>
  )
}

const Note = ({ children }) => <div style={box}><p className="panel-note">{children}</p></div>

const box = {
  background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 9,
  padding: '10px 12px', marginBottom: 12,
}

const pre = {
  fontFamily: 'var(--mono)', fontSize: 10.5, lineHeight: 1.65, color: 'var(--muted)',
  background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 6,
  padding: '8px 10px', margin: 0, overflowX: 'auto', whiteSpace: 'pre',
}

/* ── Per-section actions ─────────────────────────────────────────────────── */

export function SectionAi({ section, text, onApply, state, derived }) {
  const { configured, model } = useAi()
  const [job, setJob] = useState(null)   // { mode, before, after, streaming, error }
  const abort = useRef(null)

  const run = useCallback(async mode => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl

    const before = mode === 'refine' ? text : ''
    setJob({ mode, before, after: '', streaming: true, error: null })

    const prompt = mode === 'refine'
      ? refinePrompt(section, text, state, derived)
      : draftPrompt(section, state, derived)

    const res = await complete({
      model,
      system: systemPrompt(),
      prompt,
      signal: ctl.signal,
      onChunk: partial => setJob(j => (j && j.streaming ? { ...j, after: partial } : j)),
    })

    if (ctl.signal.aborted) return
    setJob(res.ok
      ? { mode, before, after: res.text, streaming: false, error: null }
      : { mode, before, after: res.text ?? '', streaming: false, error: res.error })
  }, [model, section, text, state, derived])

  const close = useCallback(() => { abort.current?.abort(); setJob(null) }, [])

  useEffect(() => () => abort.current?.abort(), [])

  if (!configured || !model) return null

  const busy = !!job?.streaming

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn-ghost" style={btn} disabled={busy || !text.trim()}
          title={text.trim() ? 'Tighten what you wrote' : 'Write something first'}
          onClick={() => run('refine')}>
          <Sparkle /> Refine
        </button>
        <button className="btn-ghost" style={btn} disabled={busy} onClick={() => run('draft')}
          title={text.trim() ? 'Write a fresh version from the tokens — yours is kept until you accept' : 'Write this section from the tokens'}>
          <Sparkle /> Draft from Tokens
        </button>
      </div>

      <Expand open={!!job}>
        {job && (
          <ReviewDiff
            before={job.before}
            after={job.after}
            streaming={job.streaming}
            error={job.error}
            onRetry={() => run(job.mode)}
            onReject={close}
            onAccept={() => { onApply(job.after); setJob(null) }}
          />
        )}
      </Expand>
    </div>
  )
}

const btn = { padding: BTN.sm, fontSize: 11.5 }

const Sparkle = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
)
