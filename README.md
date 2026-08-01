# design.md editor

A visual editor for authoring [DESIGN.md](https://github.com/google-labs-code/design.md) files — the open format that gives coding agents a persistent, structured understanding of a design system.

Tune a handful of seeds and five macro sliders. The app generates colour scales, semantic roles, a type scale, spacing, radii, elevation and a component matrix, shows them on live mock screens, and emits a spec-conformant `DESIGN.md` you can drop into any project for Claude Code, Cursor or Codex to build against.

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
| `npm run dev:web` / `npm run dev:api` | One at a time |
| `npm test` | 88-assertion regression suite over the pure layer |
| `npm run build` | Production build |
| `npm run db:migrate:local` | Apply migrations to the local D1 database |

> A green build does **not** mean the app runs. Bundlers don't catch an undefined identifier inside a component. Load the page after any change.

---

## The core idea

The document stores **only seeds, macro values and explicit overrides**. Every concrete token is computed by `derive()`.

```
seeds + shape  ─►  OKLCH scales  ─►  semantic roles  ─┬─►  CSS custom properties  ─►  preview
                                                      └─►  DESIGN.md
macros ─────────────────────────────────────────────────►  (multiply through everything)
```

This is the load-bearing decision. Saved state stays tiny, moving a macro reshapes the system retroactively instead of leaving stale values behind, and — because the preview and the emitter both read `derive()` — what you see is provably what exports. A test asserts the CSS variables equal the emitted values.

**Five macros** multiply through every dependent token:

| Macro | Range | Resolves to |
| --- | --- | --- |
| Type scale | 0.25 – 2 | base font size, px |
| Density | 0 – 2 | base spacing unit, px |
| Roundness | 0 – 4 | base corner radius, px |
| Depth | 0 – 2 | shadow strength, % (offset, blur and opacity together) |
| Motion | 0 – 5 | the `normal` duration, ms |

Each shows both its multiplier and the value it resolves to, and **both are typeable** — enter `20px` for roundness and it back-solves the multiplier. Dragging snaps to the default within 2.5% of the range. Individual tokens can be locked or overridden to opt out.

---

## The panels

### Meta
Project name, description, spec version, and **6 presets** — Studio, Warm editorial, Swiss neutral, Soft product, Terminal, Dense data. Presets replace every token but keep your name and rationale.

### Colour
Seeds → generated scales. Everything downstream reads from here.

- **Palette generator**, inline. Lock the colours you like, hit Generate, and the rest re-roll around them. **7 harmonies** plus free. Works in OKLCH so brightness stays even across a run, and status seeds are constrained to the hue bands that still read as success, warning and danger.
- **Scale generation** in OKLCH: 11 steps per seed with controls for the lightness curve, chroma envelope and hue shift across the ramp (warm shadows, cool highlights). Your seed hex is pinned into its own scale so it survives generation verbatim.
- **Picker**: SV square, hue and alpha strips, five models (HEX / RGB / HSL / **HSB** / OKLCH), eyedropper where the browser supports it, gamut warnings.
- **Gradients**: linear and radial, with stops that reference seeds, roles or scale steps rather than frozen hex — so a gradient tracks the palette. Drag to reorder, one-click reverse, and a swatch-grid picker with a full colour picker for literals.

### Roles
**27 semantic roles** across 5 groups, each mapped to a scale step per mode. This is the layer the exported file leads with: `surface-raised` tells an agent how to build a card; `neutral-800` doesn't.

- Edit **Light only / Dark only / Both** — one mode at a time gets the full panel width, which is what you want when a theme reads well in dark and badly in light.
- **Generate the opposite mode** by mirroring each role's scale position.
- **Contrast**: a free-form checker for any two roles, plus **12 fixed pairs** reported with WCAG ratios and APCA Lc. A test enforces that the shipped palette passes its own checks in both modes.

### Type
- The full **Google Fonts library** (1,942 families), proxied and cached through the Worker with no API key. Windowed list, lazy per-family loading, each row previewed in its own face.
- **Variable-axis sliders** built from each font's own metadata, plus OpenType feature toggles.
- A modular scale (**8 named ratios**) generating **14 text styles**. Line height and tracking follow curves derived from the resulting size — leading tightens and tracking goes negative as type grows — so the scale stays optically consistent rather than merely arithmetically consistent.
- Optional fluid `clamp()` sizing, and a per-token override on any field.

### Layout
Spacing scale from a base unit, breakpoints with container widths, grid columns and gutter, and a maximum measure in `ch`.

### Shape
Radius scale, border widths, the radius nesting rule, icon library with stroke width and size scale, an **icon-to-label gap** token, and a focus-ring spec with a live sample. Focus rings are the single most consistently omitted detail in generated UI.

### Depth
Elevation strategy — **shadow, border or tonal** — with layered two-part shadows tinted from the neutral scale rather than pure black. Scrim colour, opacity and blur, plus blend modes for **overlays and fills**. Borders and shadows have no CSS blend equivalent; the panel says so rather than offering a control that does nothing.

### Motion
Duration scale (125 / 250 / 500ms by default), three personality presets, a **draggable cubic-bezier editor** with playback, and a reduced-motion policy.

### Components
**14 components** across 7 groups, expanding to **48 flattened entries** — variants, sizes and six interaction states, named the way the spec expects (`button-primary-hover`).

- Each card has a **search** matching entry names, property keys and values.
- Property fields offer token pickers scoped to the property type, with resolved previews: swatches for colours, computed px for dimensions, a bar for gradients.
- Per-component and per-size **icon sizing** and gaps.
- Properties outside the spec's legal eight are flagged and routed to prose.

### Directives
Style references, a **12-item anti-pattern checklist**, target framework, and copy conventions. Per unit of effort this is the panel that most changes what an agent produces — negative constraints are the instruction type models follow most reliably.

### Rationale
The eight prose sections. Generated tables are appended automatically, so you write only the reasoning.

This is also where the AI lives — see [AI assistance](#ai-assistance).

### History
Every edit since this browser first opened the project, with before/after values — colours as swatches, gradients as live previews, everything else as from/to. Filterable by **9 categories**, searchable, grouped by day.

**Revert** puts a single change back wherever that token stands now, leaving every other edit alone. It isn't an undo, so it still works fifty changes later. **24 change kinds** are revertible; rationale text isn't, because the log stores word counts rather than the prose.

---

## Preview

Six surfaces — **Dashboard, Landing, Form, Settings, Overlays, Gallery** — with a light/dark toggle. Everything is styled from the 335 CSS custom properties `derive()` produces, so there is no second set of values the preview could drift toward.

**Click anything** to jump to its definition. Clicks resolve innermost-first, so a button inside a card is the button. Elements with two owners — a heading has both a colour role and a text style — offer a choice. The target opens, scrolls into view and highlights. Alt-click interacts with the control instead.

---

## AI assistance

Optional, off unless a key is configured, and confined to the Rationale tab. It writes prose — never tokens.

**Two actions per section.** *Refine* tightens what you wrote; *Draft from tokens* writes the section from the values it governs. Both send the real token facts for that section — the semantic roles for Colors, the generated scale for Typography, the active anti-patterns for Do's and Don'ts — so the model describes what the file actually says instead of guessing. It is told to give imperative guidance and explicitly forbidden from inventing token names or values.

**Nothing is applied until you accept.** The result arrives streaming into a review card with a word-level diff: additions green, deletions struck through, a `+n −n` count, and a toggle to read the new version plain. Accept, Discard, or Regenerate. Accepting logs as *AI rewrite · Rationale · \<section\>*, so the History tab distinguishes prose you typed from prose you accepted, and undo still reverses it.

**The key is a Worker secret and never reaches the browser.** Every call goes through `/api/v1/ai/*`; the built client bundle contains no credential. Without a key the panel degrades to setup instructions rather than an error, and the two buttons don't render at all.

```bash
# deployed
npx wrangler secret put OPENROUTER_API_KEY
```

Locally, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` (gitignored) and fill it in. Wrangler reads `.dev.vars` at startup, so restart the dev server after creating it.

Only **free** models are offered. The catalogue is public, so `GET /api/v1/ai/models` needs no key; it filters to zero-cost text-in/text-out models, sorts by context length and caches for an hour. Free tiers are rate-limited and slow — a 429 comes back as "try another, or wait a moment" rather than a stack trace. Your model choice persists in localStorage and is re-validated against the list, because free models come and go without notice.

---

## Spec conformance

The DESIGN.md frontmatter schema is deliberately narrow. Allowed keys are `version`, `name`, `description`, `omitted`, `colors`, `typography`, `rounded`, `spacing` and `components`; component entries accept only eight properties (`backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`). Variants and states are flattened into hyphenated names.

**Elevation, motion, gradients, breakpoints, icons and focus rings have no slot in that schema.** This editor emits them as tables inside the standard markdown sections rather than inventing frontmatter keys. That keeps the file valid for any consumer, and in practice an agent pays *more* attention to a `## Elevation & Depth` section than it would to an unrecognised YAML key. Gradients specifically cannot be `colors` tokens at all — a gradient is a CSS image, not a colour value.

Generated tables are wrapped in `<!-- design.md:generated -->` comments: invisible when rendered, and precisely strippable on import so re-importing never pastes them into prose you wrote.

Every export is validated before it leaves the app; the preview dialog shows a **Spec valid** badge or the specific errors. A default document emits ~21 kB.

---

## Layout

```
apps/
  web/                         Vite + React 19
    src/
      state/                   schema, derivation, store, migrations,
                               component library, presets, changelog
      color/                   conversion (culori), scale generation,
                               WCAG + APCA contrast, palette harmonies, modes
      type/                    modular scale, Google Fonts catalogue
      emit/                    spec-conformant writer, validator, importer
      preview/                 CSS-var bridge, 6 surfaces, icons, inspect
      panels/                  one per tab
      ai/                      streaming client, prompt construction,
                               word diff, review card
      ui/                      shared controls, colour picker, font picker,
                               bezier editor, app chrome
    test/pipeline.mjs          regression suite
  api/
    src/index.ts               8 endpoints
    migrations/                D1 schema
```

Roughly 9,400 lines across 49 source files.

### API

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/health` | |
| `GET` | `/api/v1/fonts` | Google Fonts catalogue, cached 24h, no key needed |
| `GET` | `/api/v1/ai/models` | Free text models, cached 1h; reports whether a key is set |
| `POST` | `/api/v1/ai/complete` | Streams plain-text deltas; 503 `needsKey` when unconfigured |
| `POST` | `/api/v1/projects` | Returns `{ id, editToken, version }` |
| `GET` | `/api/v1/projects/:id` | Public read |
| `PATCH` | `/api/v1/projects/:id` | Needs `X-Edit-Token`; 409 on version mismatch |
| `DELETE` | `/api/v1/projects/:id` | Soft delete |

Sharing is capability-based: creating a project returns a 32-character edit token and only its SHA-256 hash is stored. Anyone with the `/p/:id` URL can read; only a token holder can write. Concurrent edits are caught by an optimistic version counter.

### Persistence

One `persist()` path serves both destinations, so "saved" means one thing. Local drafts debounce at 600ms, cloud projects at 1500ms. A flash confirms each save and names where it went; a manual Save button forces one immediately. The change log lives in localStorage, separate from the document, and never reaches the exported file.

---

## Testing

`npm test` runs 88 assertions over the pure layer — derivation, macro behaviour, generated scales, fluid sizing, component expansion, spec conformance, round-tripping, migration, presets, preview fidelity, contrast, the word diff and prompt construction. No framework; plain assertions, because that's where the correctness risk lives.

Round-tripping is **byte-identical for the YAML layer**. The prose layer can't be: properties outside the spec's eight exist only in generated markdown, which import strips by design. That loss is reported on import rather than being silent.

---

## Deployment

The web app deploys to Vercel and the API to Cloudflare Workers. `apps/web/vercel.json` rewrites `/api/*` to the Worker and serves `/p/:id` from `index.html`.

Before the first deploy, create a real database and put its id in `apps/api/wrangler.toml` — the one committed there is a local-development placeholder:

```bash
npx wrangler d1 create design-md-editor
npm run db:migrate -w apps/api
npm run deploy -w apps/api
```

Two optional Worker secrets, both server-side only:

- `GOOGLE_FONTS_API_KEY` — uses the official Web Fonts API. Without it the public metadata endpoint is used, which needs no credentials.
- `OPENROUTER_API_KEY` — turns on the Rationale tab's AI. Without it that panel shows setup instructions and everything else works unchanged.

---

## Status

Colour, roles, typography, layout, shape, depth, motion, components, directives, history and AI-assisted prose are complete. Schema is at v3, with migrations from v1 and v2.
