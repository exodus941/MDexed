import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
  /* Optional. With a key the official Web Fonts API is used; without one the
     public metadata endpoint is, which needs no credentials. */
  GOOGLE_FONTS_API_KEY?: string
  /* Required for the AI endpoints. Set with:
       wrangler secret put OPENROUTER_API_KEY
     Locally, put it in apps/api/.dev.vars (gitignored). It is read only here
     and never sent to the browser. */
  OPENROUTER_API_KEY?: string
}

type FontFamily = {
  family: string
  category: string
  axes: { tag: string; start: number; end: number; default?: number }[]
}

type ProjectRow = {
  id: string
  edit_token_hash: string
  schema_version: number
  state: string
  version: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

const STATE_MAX_BYTES = 1_000_000 // 1 MB upper bound on state JSON
const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghijkmnpqrstvwxyz'

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin
      if (/^http:\/\/localhost:\d+$/.test(origin)) return origin
      if (/^https:\/\/.*\.pages\.dev$/.test(origin)) return origin
      if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return origin
      return null
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Edit-Token'],
  })
)

function nanoid(len: number): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length]
  }
  return out
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const now = () => Date.now()

function rowToReadResponse(row: ProjectRow) {
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    state: JSON.parse(row.state),
    version: row.version,
    updatedAt: row.updated_at,
  }
}

app.get('/api/v1/health', (c) =>
  c.json({ ok: true, deployedAt: now() })
)

/* ── Google Fonts catalogue ──
   Proxied rather than fetched from the browser: neither upstream sends CORS
   headers, and proxying lets the response be cached once for everybody
   instead of per visitor. */

const FONTS_CACHE_KEY = 'https://internal.cache/fonts/v1'
const FONTS_TTL = 60 * 60 * 24 // a day; the library barely moves

const normaliseCategory = (raw: string): string =>
  (raw ?? '').toLowerCase().replace(/\s+/g, '-')

/** Official Web Fonts API — requires a key, returns axes when asked for VF. */
async function fetchOfficial(key: string): Promise<FontFamily[]> {
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(key)}&capability=VF&sort=popularity`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`webfonts api ${res.status}`)
  const data = (await res.json()) as { items?: any[] }
  return (data.items ?? []).map((f) => ({
    family: f.family,
    category: normaliseCategory(f.category),
    axes: (f.axes ?? []).map((a: any) => ({ tag: a.tag, start: a.start, end: a.end })),
  }))
}

/** Public metadata endpoint. No key, but the body carries an XSSI prefix. */
async function fetchPublic(): Promise<FontFamily[]> {
  const res = await fetch('https://fonts.google.com/metadata/fonts')
  if (!res.ok) throw new Error(`metadata ${res.status}`)
  const text = (await res.text()).replace(/^\)\]\}'\s*/, '')
  const data = JSON.parse(text) as { familyMetadataList?: any[] }
  return (data.familyMetadataList ?? []).map((f) => ({
    family: f.family,
    category: normaliseCategory(f.category),
    axes: (f.axes ?? []).map((a: any) => ({
      tag: a.tag,
      start: a.min,
      end: a.max,
      default: a.defaultValue,
    })),
  }))
}

app.get('/api/v1/fonts', async (c) => {
  const cache = caches.default
  const cached = await cache.match(FONTS_CACHE_KEY)
  if (cached) return cached

  let families: FontFamily[]
  let source: string
  try {
    if (c.env.GOOGLE_FONTS_API_KEY) {
      families = await fetchOfficial(c.env.GOOGLE_FONTS_API_KEY)
      source = 'webfonts-api'
    } else {
      families = await fetchPublic()
      source = 'metadata'
    }
  } catch (err) {
    /* One retry on the keyless path before giving up — the client has its own
       small fallback list, so a failure here degrades rather than breaks. */
    try {
      families = await fetchPublic()
      source = 'metadata-fallback'
    } catch {
      console.error('font catalogue unavailable', err)
      return c.json({ error: 'Font catalogue unavailable', families: [] }, 502)
    }
  }

  const res = c.json({ source, count: families.length, families })
  res.headers.set('Cache-Control', `public, max-age=${FONTS_TTL}`)
  c.executionCtx.waitUntil(cache.put(FONTS_CACHE_KEY, res.clone()))
  return res
})

/* ── AI proxy ──
   Every call goes through here so the OpenRouter key stays server-side. The
   browser never sees it, and a build of the client contains no credential. */

const OPENROUTER = 'https://openrouter.ai/api/v1'
/* Bump the version when the filter or the shape of a model entry changes —
   otherwise the hour-long cache keeps serving the old list. */
const MODELS_CACHE_KEY = 'https://internal.cache/or-models/v4'
const MAX_PROMPT_CHARS = 24_000

const isFree = (m: any) =>
  m?.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0

/* The free catalogue includes image and audio generators. Several of them list
   text among their outputs (Lyria is `text+image->text+audio`), so "includes
   text" isn't enough — the output has to be text and nothing else. Image input
   is fine; we just never send any. */
const isTextChat = (m: any) => {
  const arch = m?.architecture ?? {}
  const inputs: string[] = arch.input_modalities ?? []
  const outputs: string[] = arch.output_modalities ?? []
  if (outputs.length) return inputs.includes('text') && outputs.length === 1 && outputs[0] === 'text'
  return typeof arch.modality !== 'string' || arch.modality.endsWith('->text')
}

/* Never let the browser cache this. The Worker cache already throttles the
   upstream call, and a browser copy would keep reporting "no key" for an hour
   after someone actually added one. */
const modelsResponse = (c: any, models: unknown, configured: boolean) => {
  const out = c.json({ models, configured })
  out.headers.set('Cache-Control', 'no-store')
  return out
}

/** Free models only. The catalogue is public, so this needs no key. */
app.get('/api/v1/ai/models', async (c) => {
  const configured = !!c.env.OPENROUTER_API_KEY
  const cache = caches.default

  /* Only the catalogue is cached. `configured` is answered fresh every time —
     baking it into the cached body would mean adding a key had no visible
     effect for an hour. */
  const cached = await cache.match(MODELS_CACHE_KEY)
  if (cached) {
    const models = await cached.json()
    return modelsResponse(c, models, configured)
  }

  try {
    const res = await fetch(`${OPENROUTER}/models`)
    if (!res.ok) throw new Error(`models ${res.status}`)
    const data = (await res.json()) as { data?: any[] }

    const models = (data.data ?? [])
      .filter((m) => isFree(m) && isTextChat(m))
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        context: m.context_length ?? null,
      }))
      /* Longest context first — prose refinement sends the whole section
         plus the token tables around it. */
      .sort((a, b) => (b.context ?? 0) - (a.context ?? 0))

    const entry = new Response(JSON.stringify(models), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    })
    c.executionCtx.waitUntil(cache.put(MODELS_CACHE_KEY, entry))
    return modelsResponse(c, models, configured)
  } catch (err) {
    console.error('model list unavailable', err)
    return c.json({ models: [], configured, error: 'Model list unavailable' }, 502)
  }
})

/**
 * Streams a completion back as plain text deltas, so the client doesn't have
 * to parse SSE. Returns 503 with `needsKey` when no secret is configured,
 * which the UI turns into setup instructions rather than an error.
 */
app.post('/api/v1/ai/complete', async (c) => {
  const key = c.env.OPENROUTER_API_KEY
  if (!key) {
    return c.json({
      error: 'No OpenRouter key is configured on the server.',
      needsKey: true,
    }, 503)
  }

  const body = (await c.req.json().catch(() => null)) as
    | { model?: string; system?: string; prompt?: string }
    | null
  if (!body?.model || !body?.prompt) {
    return c.json({ error: 'model and prompt are required' }, 400)
  }
  if (body.prompt.length + (body.system?.length ?? 0) > MAX_PROMPT_CHARS) {
    return c.json({ error: 'Prompt is too large' }, 413)
  }

  const upstream = await fetch(`${OPENROUTER}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': new URL(c.req.url).origin,
      'X-Title': 'design.md editor',
    },
    body: JSON.stringify({
      model: body.model,
      stream: true,
      messages: [
        ...(body.system ? [{ role: 'system', content: body.system }] : []),
        { role: 'user', content: body.prompt },
      ],
    }),
  })

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    /* Rate limits are the common case on the free tier — pass the status
       through so the client can say something useful. */
    return c.json({
      error: upstream.status === 429
        ? 'That model is rate-limited right now. Try another, or wait a moment.'
        : `The model call failed (${upstream.status}).`,
      detail: detail.slice(0, 400),
    }, upstream.status === 429 ? 429 : 502)
  }

  /* Unwrap SSE into plain text so the client is a single reader loop. */
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  c.executionCtx.waitUntil((async () => {
    const reader = upstream.body!.getReader()
    let buffer = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
            if (delta) await writer.write(encoder.encode(delta))
          } catch { /* keep-alive comments and partial frames */ }
        }
      }
    } catch (err) {
      console.error('stream failed', err)
    } finally {
      await writer.close().catch(() => {})
    }
  })())

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
})

app.post('/api/v1/projects', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { state?: unknown; schemaVersion?: number }
    | null
  if (!body || typeof body !== 'object')
    return c.json({ error: 'Invalid JSON body' }, 400)

  const { state, schemaVersion = 1 } = body
  if (state == null) return c.json({ error: 'state is required' }, 400)

  const stateJson = JSON.stringify(state)
  if (stateJson.length > STATE_MAX_BYTES)
    return c.json({ error: 'state too large' }, 413)

  const id = nanoid(10)
  const editToken = nanoid(32)
  const editTokenHash = await sha256Hex(editToken)
  const ts = now()

  await c.env.DB.prepare(
    `INSERT INTO projects
       (id, edit_token_hash, schema_version, state, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, editTokenHash, schemaVersion, stateJson, ts, ts)
    .run()

  return c.json({ id, editToken, version: 1 }, 201)
})

app.get('/api/v1/projects/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id, edit_token_hash, schema_version, state, version, created_at, updated_at, deleted_at
       FROM projects
      WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(c.req.param('id'))
    .first<ProjectRow>()

  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(rowToReadResponse(row))
})

app.patch('/api/v1/projects/:id', async (c) => {
  const editToken = c.req.header('x-edit-token')
  if (!editToken) return c.json({ error: 'X-Edit-Token header required' }, 401)

  const body = (await c.req.json().catch(() => null)) as
    | { state?: unknown; version?: number }
    | null
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400)

  const { state, version: clientVersion } = body
  if (state == null || typeof clientVersion !== 'number') {
    return c.json({ error: 'state and version are required' }, 400)
  }

  const stateJson = JSON.stringify(state)
  if (stateJson.length > STATE_MAX_BYTES)
    return c.json({ error: 'state too large' }, 413)

  const row = await c.env.DB.prepare(
    `SELECT edit_token_hash, version FROM projects
      WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(c.req.param('id'))
    .first<{ edit_token_hash: string; version: number }>()

  if (!row) return c.json({ error: 'Not found' }, 404)

  const tokenHash = await sha256Hex(editToken)
  if (tokenHash !== row.edit_token_hash)
    return c.json({ error: 'Invalid edit token' }, 403)

  if (clientVersion !== row.version) {
    return c.json(
      { error: 'Version mismatch', serverVersion: row.version },
      409
    )
  }

  const newVersion = row.version + 1
  await c.env.DB.prepare(
    `UPDATE projects SET state = ?, version = ?, updated_at = ?
      WHERE id = ?`
  )
    .bind(stateJson, newVersion, now(), c.req.param('id'))
    .run()

  return c.json({ version: newVersion })
})

app.delete('/api/v1/projects/:id', async (c) => {
  const editToken = c.req.header('x-edit-token')
  if (!editToken) return c.json({ error: 'X-Edit-Token header required' }, 401)

  const row = await c.env.DB.prepare(
    `SELECT edit_token_hash FROM projects
      WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(c.req.param('id'))
    .first<{ edit_token_hash: string }>()

  if (!row) return c.json({ error: 'Not found' }, 404)

  const tokenHash = await sha256Hex(editToken)
  if (tokenHash !== row.edit_token_hash)
    return c.json({ error: 'Invalid edit token' }, 403)

  await c.env.DB.prepare(
    `UPDATE projects SET deleted_at = ? WHERE id = ?`
  )
    .bind(now(), c.req.param('id'))
    .run()

  return new Response(null, { status: 204 })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal error' }, 500)
})

export default app
