/* Talking to the model, via the Worker.

   There is no API key in this file, and none in the built bundle. Everything
   goes through `/api/v1/ai/*`, which holds the credential server-side. If you
   ever find yourself wanting a key here, that's the bug. */

const BASE = '/api/v1/ai'

let modelsPromise = null

/**
 * Free models, plus whether the server actually has a key.
 * @returns {{ models: Array, configured: boolean, error: string|null }}
 */
export function loadModels() {
  if (!modelsPromise) {
    modelsPromise = fetch(`${BASE}/models`)
      .then(async r => {
        const data = await r.json().catch(() => ({}))
        return { models: data.models ?? [], configured: !!data.configured, error: data.error ?? null }
      })
      .catch(err => {
        modelsPromise = null
        return { models: [], configured: false, error: err.message }
      })
  }
  return modelsPromise
}

/* A sensible default. The list arrives sorted by context length, so this picks
   the roomiest model from a family known to follow instructions — free-tier
   novelties near the top of the list are rarely what you want. */
export const pickDefaultModel = models =>
  models.find(m => /llama|qwen|mistral|gemma/i.test(m.id))?.id ?? models[0]?.id ?? null

/**
 * Stream a completion. `onChunk` receives text as it arrives.
 *
 * @returns {Promise<{ ok: boolean, text: string, error?: string, needsKey?: boolean }>}
 */
export async function complete({ model, system, prompt, onChunk, signal }) {
  let res
  try {
    res = await fetch(`${BASE}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt }),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, text: '', error: 'Cancelled' }
    return { ok: false, text: '', error: 'Could not reach the server.' }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, text: '', error: data.error ?? `Request failed (${res.status})`, needsKey: !!data.needsKey }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      text += chunk
      onChunk?.(text)
    }
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, text, error: 'Cancelled' }
    return { ok: false, text, error: 'The stream ended early.' }
  }

  const trimmed = text.trim()
  if (!trimmed) return { ok: false, text: '', error: 'The model returned nothing. Try another one.' }
  return { ok: true, text: trimmed }
}
