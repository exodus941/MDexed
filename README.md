# design.md editor

A visual editor for authoring [DESIGN.md](https://github.com/google-labs-code/design.md) files — the open format that gives coding agents a persistent, structured understanding of a design system.

You tune a handful of seeds and macro sliders; the app generates colour scales, semantic roles, contrast reports and a live preview, then emits a spec-conformant `DESIGN.md` you can drop into any project for Claude Code, Cursor, Codex or Stitch to build against.

---

## Quick start

Requires **Node 20+**.

```bash
npm install
npm run db:migrate:local   # creates the local D1 database
npm run dev                # web on :5173, API on :8787
```

Open <http://localhost:5173>. Vite proxies `/api` through to the Worker on 8787.

| Command | What it does |
| --- | --- |
| `npm run dev` | Both servers, side by side |
| `npm run dev:web` | Vite only |
| `npm run dev:api` | Wrangler only |
| `npm test` | Pipeline regression suite |
| `npm run build` | Production build of the web app |
| `npm run db:migrate:local` | Apply migrations to the local D1 database |

---

## How it works

### Derived tokens

The document stores **only seeds, macro values and explicit overrides**. Every concrete token value is computed by `derive()`.

This is the load-bearing decision in the codebase. It keeps saved state tiny, and it means moving a macro slider reshapes the whole system retroactively rather than leaving stale values scattered behind. Anything that needs a real value — the preview, the emitter, the contrast checker — calls `derive()` and reads from one place.

```
seeds + shape  ──►  OKLCH scales  ──►  semantic roles  ──►  CSS custom properties
                                                        └─►  DESIGN.md
```

Five macros — type scale, density, roundness, depth, motion — multiply through every dependent token. Individual tokens can be locked to opt out.

### Colour

Scales are generated in OKLCH so steps are perceptually even rather than arithmetically even, with controls for the lightness curve, chroma envelope and hue shift across the ramp (which is how you get warm shadows and cool highlights). Your seed colour is pinned into its own scale at whichever step matches it in lightness, so a brand hex survives generation verbatim.

Raw scales are kept separate from **semantic roles** (`surface-raised`, `border-subtle`, `accent-fg`, …). Roles are what the exported file leads with, because they carry intent: `surface-raised` tells an agent how to build a card, `neutral-800` doesn't.

Every role pair is checked for contrast with both WCAG 2.1 ratios and APCA Lc. The shipped default palette passes its own checks in light and dark, and a test enforces that.

### The preview is the output

The preview pane, mock screens and component gallery are styled entirely from the CSS custom properties `derive()` produces — there is no second set of values they could drift toward. A test asserts that the variables driving the preview equal the values written into the file.

---

## Spec conformance

The DESIGN.md frontmatter schema is deliberately narrow. Allowed keys are `version`, `name`, `description`, `omitted`, `colors`, `typography`, `rounded`, `spacing` and `components`, and component entries accept only eight properties (`backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`). Variants and states are flattened into hyphenated names — `button-primary`, `button-primary-hover`.

**Elevation, motion, breakpoints, icons and focus rings have no slot in that schema.** This editor emits them as tables inside the standard markdown sections instead of inventing frontmatter keys. That keeps the file valid for any consumer, and in practice an agent pays *more* attention to a `## Elevation & Depth` section than it would to an unrecognised YAML key. The same applies to component properties outside the legal eight: they still reach the file, marked *prose only*.

Generated tables are wrapped in `<!-- design.md:generated -->` comments — invisible when the markdown renders, and precisely strippable on import so re-importing a file never pastes them into prose you wrote by hand.

Every export is validated before it leaves the app; the preview dialog shows a **Spec valid** badge or the specific errors.

---

## Layout

```
apps/
  web/                    Vite + React 19
    src/
      state/              schema, derivation, store (undo/redo), migrations
      color/              conversion (culori), scale generation, WCAG + APCA
      emit/               spec-conformant writer, validator, js-yaml importer
      preview/            CSS-var bridge, mock screens, component gallery
      panels/             editor panels
      ui/                 shared controls, colour picker, app chrome
    test/pipeline.mjs     regression suite
  api/                    Hono on Cloudflare Workers
    src/index.ts          five endpoints
    migrations/           D1 schema
```

### API

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/health` | |
| `POST` | `/api/v1/projects` | Returns `{ id, editToken, version }` |
| `GET` | `/api/v1/projects/:id` | Public read |
| `PATCH` | `/api/v1/projects/:id` | Needs `X-Edit-Token`; 409 on version mismatch |
| `DELETE` | `/api/v1/projects/:id` | Soft delete |

Sharing is capability-based: creating a project returns a 32-character edit token and only its SHA-256 hash is stored. Anyone with the `/p/:id` URL can read; only a token holder can write. Concurrent edits are caught by an optimistic version counter.

---

## Deployment

The web app deploys to Vercel and the API to Cloudflare Workers. `apps/web/vercel.json` rewrites `/api/*` to the Worker and serves `/p/:id` from `index.html`.

Before the first deploy, create a real database and put its id in `apps/api/wrangler.toml` — the one committed there is a local-development placeholder:

```bash
npx wrangler d1 create design-md-editor
npm run db:migrate -w apps/api
npm run deploy -w apps/api
```

---

## Status

Colour is complete: generated scales, semantic roles, light/dark pairing, a five-model picker, contrast reporting and per-step overrides.

Typography, spacing, radius and components still run on flat editable lists — functional and macro-aware, but not yet generated. Next up is the full Google Fonts library with variable-axis controls, a type scale generator, grid and breakpoints, a layered shadow builder, the component variant matrix, and a first-class anti-patterns panel. After that, AI-assisted prose refinement with reviewable diffs.
