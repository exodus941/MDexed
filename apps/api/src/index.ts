import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
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
