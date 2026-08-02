# MDesigner

A visual editor for authoring [DESIGN.md](https://github.com/google-labs-code/design.md) files, the open format that gives coding agents a persistent, structured understanding of a design system.

Tune a handful of seeds and five macro sliders. The app generates colour scales, semantic roles, a type scale, spacing, radii, elevation and a component matrix, shows them on live mock screens, audits them for accessibility, and emits a spec-conformant `DESIGN.md` you can drop into any project for Claude Code, Cursor or Codex to build against.

It also exports the things a `DESIGN.md` cannot enforce on its own: a `tokens.css`, a Tailwind preset, a W3C token file and rendered HTML examples. A markdown file is advice. Those are the same values in a form a build can check.

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
| `npm test` | 105-assertion regression suite over the pure layer |
| `npm run build` | Production build |
| `npm run bump -w apps/web` | Advance the app's build number before a push |
| `npm run db:migrate:local` | Apply migrations to the local D1 database |

> A green build does **not** mean the app runs. Bundlers do not catch an undefined identifier inside a component, a dangling ref after a refactor, or a CSS rule that loses on specificity. Load the page after any change.

---

## The core idea

The document stores **only seeds, macro values and explicit overrides**. Every concrete token is computed by `derive()`.

```
seeds + shape  ─►  OKLCH scales  ─►  semantic roles  ─┬─►  CSS custom properties  ─►  preview
                                                      └─►  DESIGN.md, tokens.css, Tailwind, JSON
macros ─────────────────────────────────────────────────►  (multiply through everything)
```

This is the load-bearing decision. Saved state stays tiny, moving a macro reshapes the system retroactively instead of leaving stale values behind, and because the preview and every emitter read the same `derive()`, what you see is provably what exports. A test asserts the CSS variables equal the emitted values.

**Five macros** multiply through every dependent token:

| Macro | Range | Resolves to |
| --- | --- | --- |
| Type scale | 0.25 to 2 | base font size, px |
| Density | 0 to 2 | base spacing unit, px |
| Roundness | 0 to 4 | base corner radius, px |
| Depth | 0 to 2 | shadow strength, % (offset, blur and opacity together) |
| Motion | 0 to 5 | the `normal` duration, ms |

Each shows both its multiplier and the value it resolves to, and **both are typeable**. Enter `20px` for roundness and it back-solves the multiplier. Dragging snaps to the default within a few percent of the range, so returning to baseline does not need a steady hand. Individual tokens can be locked or overridden to opt out.

---

## The panels

### Meta
Project name, description, and **6 presets**: Studio, Warm editorial, Swiss neutral, Soft product, Terminal, Dense data. Presets replace every token but keep your name and rationale.

### Colour
Seeds feed generated scales. Everything downstream reads from here.

- **Palette generator**, inline. Lock the colours you like, hit Generate, and the rest re-roll around them. **7 harmonies** plus free. Works in OKLCH so brightness stays even across a run, and status seeds are constrained to the hue bands that still read as success, warning and danger.
- **Scale generation** in OKLCH: 11 steps per seed with controls for the lightness curve, chroma envelope and hue shift across the ramp (warm shadows, cool highlights). Your seed hex is pinned into its own scale so it survives generation verbatim.
- **Picker**: SV square, hue and alpha strips, five models (HEX, RGB, HSL, **HSB**, OKLCH), eyedropper where the browser supports it, gamut warnings.
- **Gradients**: linear and radial, with stops that reference seeds, roles or scale steps rather than frozen hex, so a gradient tracks the palette. Drag to reorder, one-click reverse, and a swatch-grid picker with a full colour picker for literals.

The shipped defaults are chosen against the accessibility audit rather than by eye. Success is a teal rather than a green, because red-green colour blindness removes hue, and every status role sits on the same scale step, which means they share a lightness by construction. A conventional green, amber and red trio cannot survive that. See [Access](#access).

### Roles
**27 semantic roles** across 5 groups, each mapped to a scale step per mode. This is the layer the exported file leads with. `surface-raised` tells an agent how to build a card; `neutral-800` does not.

- Edit **Light only, Dark only or Both**. One mode at a time gets the full panel width, which is what you want when a theme reads well in dark and badly in light.
- **Generate the opposite mode** by mirroring each role's scale position.
- **Contrast**: a free-form checker for any two roles, plus **12 fixed pairs** reported with WCAG ratios and APCA Lc. A test enforces that the shipped palette passes its own checks in both modes.

### Type
- The full **Google Fonts library** (1,942 families), proxied and cached through the Worker with no API key. Windowed list, lazy per-family loading, each row previewed in its own face.
- **Variable-axis sliders** built from each font's own metadata, plus OpenType feature toggles.
- A modular scale (**8 named ratios**) generating **14 text styles**. Line height and tracking follow curves derived from the resulting size, so leading tightens and tracking goes negative as type grows. The scale stays optically consistent rather than merely arithmetically consistent.
- Optional fluid `clamp()` sizing, and a per-token override on any field.

### Layout
Spacing scale from a base unit, breakpoints with container widths, grid columns and gutter, and a maximum measure in `ch`. The breakpoints here drive the preview's width control, so a number you set is a layout you can look at.

### Shape
Radius scale, border widths, the radius nesting rule, icon library with stroke width and size scale, an **icon-to-label gap** token, and a focus-ring spec with a live sample. Focus rings are the single most consistently omitted detail in generated UI.

### Depth
Elevation strategy (**shadow, border or tonal**) with layered two-part shadows tinted from the neutral scale rather than pure black. Scrim colour, opacity and blur, plus blend modes for **overlays and fills**. Borders and shadows have no CSS blend equivalent; the panel says so rather than offering a control that does nothing.

### Motion
Duration scale (125, 250, 500ms by default), three personality presets, a **draggable cubic-bezier editor** with playback, and a reduced-motion policy.

### Components
**14 components** across 7 groups, expanding to **48 flattened entries**: variants, sizes and six interaction states, named the way the spec expects (`button-primary-hover`).

**Composition** is separate from appearance, and sits alongside the component it governs. A modal's icon placement (none, beside the title, above it), icon size, icon treatment, alignment, title-to-body gap, action arrangement and corner close control are all editable, and the Overlays surface re-renders as you change them. None of it fits the spec's eight component properties, so it is emitted as a settings table plus imperative rules in the Components section, the same route elevation and motion take. Settings that stop applying, such as icon size when there is no icon, disappear from the panel and from the file.

- Each card has a **search** matching entry names, property keys and values.
- Property fields offer token pickers scoped to the property type, with resolved previews: swatches for colours, computed px for dimensions, a bar for gradients.
- Per-component and per-size **icon sizing** and gaps.
- Properties outside the spec's legal eight are flagged and routed to prose.

### Directives
Style references, a **12-item anti-pattern checklist**, target framework, and copy conventions. Per unit of effort this is the panel that most changes what an agent produces. Negative constraints are the instruction type models follow most reliably.

### Access
Everything the contrast checker does not cover. Text contrast is the only accessibility rule most systems check, because it is the only one with an obvious number attached. The rules that actually break interfaces are elsewhere.

| Check | Criterion |
| --- | --- |
| Non-text contrast on borders, control boundaries and focus rings | 1.4.11 (AA) |
| Focus indicator present, thick enough, legible against both adjacent colours | 2.4.7, 2.4.11, 2.4.13 |
| Interactive target size, with the spacing exception applied when the system declares a minimum | 2.5.8 (AA), 2.5.5 (AAA) |
| Body size, line height, tracking and measure | 1.4.12 (AA), 1.4.8 (AAA) |
| Reduced-motion policy, long durations, easing curves that overshoot | 2.2.2 (A), 2.3.3 (AAA) |
| Colour independence, by simulating deuteranopia and protanopia and measuring what separation survives | 1.4.1 (A) |
| Disabled text legibility, which WCAG exempts and users still have to read | practice |

Every check runs against the derived tokens, the same values the preview renders and the file exports, so a pass is a statement about what ships rather than about intent. Findings are advice, not gates. A system that fails the 44px target on purpose, because it is a dense data tool for mouse users, is a legitimate system. What is not legitimate is failing it without knowing.

Each finding cites its criterion, shows the measurement, and links to the control that causes it. Colour findings render the pair as swatches next to their simulated versions, because nothing explains a colour-blindness result the way seeing it does.

The audit also ships **into the exported file**, in two halves. The requirements no palette can check, such as semantic elements, focus trapping and live regions, are emitted verbatim, because they are true of every system and an agent gets them wrong unless told. Anything the current system actually fails is emitted as a known-issues table. An agent that knows two colours collapse under red-green vision will pair them with icons. An agent handed a silently broken palette will not.

### Rationale
The eight prose sections. Generated tables are appended automatically, so you write only the reasoning.

This is also where the AI lives. See [AI assistance](#ai-assistance).

### History
Every edit since this browser first opened the project, with before and after values: colours as swatches, gradients as live previews, everything else as from and to. Filterable by **9 categories**, searchable, grouped by day.

**Revert** puts a single change back wherever that token stands now, leaving every other edit alone. It is not an undo, so it still works fifty changes later. **24 change kinds** are revertible; rationale text is not, because the log stores word counts rather than the prose.

---

## Preview

Six surfaces (**Dashboard, Landing, Form, Settings, Overlays, Gallery**) with a light and dark toggle. Everything is styled from the 335 CSS custom properties `derive()` produces, so there is no second set of values the preview could drift toward.

**Click anything** to jump to its definition. Clicks resolve innermost-first, so a button inside a card is the button, and the card is still on offer, because a click also collects what its containers answer to. A run of text opens into its font and its colour, which live on different tabs. The target opens, scrolls into view and highlights. Alt-click interacts with the control instead.

**Responsive widths** come from the breakpoints this document declares, not a generic set of phone sizes, so the control tests your system rather than someone else's. The surfaces respond through **container queries** rather than media queries: the viewport never changes when a pane narrows, and a media query would sit there reporting 1280px while the surface renders at 400. The query container is a padding-free frame around the surface, because `container-type` measures the content box, and declaring it on the page itself would fire every collapse early by exactly the page padding.

---

## Exports

| Button | Produces |
| --- | --- |
| Preview design.md | The file in a dialog, with a spec-valid badge or the specific errors |
| Export Preview (HTML) | The current surface as a standalone page |
| Export design.md | The file |
| Export Payload | A zip: `DESIGN.md`, `tokens.css`, `tailwind.config.js`, `tokens.json`, a README, and all six surfaces as HTML |

The token files exist because a `DESIGN.md` is advisory. It tells an agent what to do and nothing checks whether it did. `tokens.css` is 670 custom properties across both themes. The Tailwind preset points its colours at those properties rather than at hex, so `bg-surface` works in both themes without a `dark:` variant anywhere. `tokens.json` is W3C Design Tokens format, for anything that reads it.

The HTML examples carry the same stylesheet the editor's preview uses, container queries included, so the page a developer opens is the page you were looking at. Every value sits in a `:root` block rather than baked into rules, and both palettes ship, switched by `data-theme`.

**Import Reference** is the way back in. Give it a `DESIGN.md` and it opens as a document, replacing what you have. Give it a stylesheet and it reads colours, typefaces and spacing out of it, applying nothing until you choose. What comes out of CSS is evidence, not a system: a brand blue and a one-off blue look identical to a regex, and only you know which is which. Everything is offered with how often it appeared, because frequency is the best available evidence that a value was a decision rather than an accident. Imports land on **seeds**, never on roles or components, so the scales, roles and every component regenerate from them.

---

## Editor chrome

Two sliders in the system bar configure the tool rather than the design, and neither reaches the exported file.

**UI Animation** governs every transition the editor makes, as `--t`. It is not the same thing as the Motion tab: that one defines your system's durations, this one defines the tool's. Content that swaps **cross-dissolves** rather than cutting: editor tabs, preview surfaces, the light and dark toggle, the colour picker's model tabs, the AI review's diff toggle. Both trees are on screen at once for the duration, and the outgoing layer is the element as it was at the moment of the switch, which is why light and dark genuinely dissolves between two palettes instead of snapping. Set it to 0 and every swap is instantaneous, with no layering at all.

**UI Hue** rotates every neutral in the chrome at its own saturation and lightness, so the tonal structure is untouched and only the cast changes. Semantic colours are excluded, because a hue slider that also turns the error colour green would be a different feature.

Toasts obey the animation setting and withdraw on their own: notices after ten seconds, with hover pausing the clock, and the restore offer after thirty. Tab-strip chevrons scroll for as long as you hover them, because a strip is a queue you look through, and clicking once per 160px is the interaction equivalent of a stuck key.

Jumps from the preview scroll once, after any accordion has finished opening, at the same duration. `prefers-reduced-motion` is honoured throughout.

---

## Versions

Two build numbers, at opposite ends of the header, because they answer different questions.

Next to the wordmark is **the app's**, in `YYMMDD-N` form: `260802-3` is the third build of 2 August 2026. It comes from `build-number.json`, advanced by `npm run bump` before a push, so the number is decided at commit time and travels with the commit. Rebuilding a commit reproduces its id rather than inventing a new one, because the same source is the same build. The dev server reports `dev`, since nothing was built.

Next to the storage readout is **the document's**, in the same form, stamped when you export. Edits do not move it: a version that changed on every keystroke would say nothing about which file anyone is holding. A document that has never been exported says `unbuilt` rather than inventing a number.

---

## Spec conformance

The DESIGN.md frontmatter schema is deliberately narrow. Allowed keys are `version`, `name`, `description`, `omitted`, `colors`, `typography`, `rounded`, `spacing` and `components`; component entries accept only eight properties (`backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`). Variants and states are flattened into hyphenated names.

**Elevation, motion, gradients, breakpoints, icons, focus rings and accessibility have no slot in that schema.** This editor emits them as tables inside the standard markdown sections rather than inventing frontmatter keys. That keeps the file valid for any consumer, and in practice an agent pays more attention to a `## Elevation & Depth` section than it would to an unrecognised YAML key. Gradients specifically cannot be `colors` tokens at all, because a gradient is a CSS image, not a colour value.

Generated tables are wrapped in `<!-- design.md:generated -->` comments: invisible when rendered, and precisely strippable on import, so re-importing never pastes them into prose you wrote.

Every export is validated before it leaves the app. A default document emits roughly 21 kB.

---

## AI assistance

Optional, off unless a key is configured, and confined to the Rationale tab. It writes prose and never tokens.

**Two actions per section.** *Refine* tightens what you wrote; *Draft from tokens* writes the section from the values it governs. Both send the real token facts for that section: the semantic roles for Colors, the generated scale for Typography, the active anti-patterns for Do's and Don'ts. The model describes what the file actually says instead of guessing. It is told to give imperative guidance and explicitly forbidden from inventing token names or values.

**Nothing is applied until you accept.** The result arrives streaming into a review card with a word-level diff: additions green, deletions struck through, a `+n −n` count, and a toggle to read the new version plain. Accept, Discard, or Regenerate. Accepting logs as *AI rewrite · Rationale · \<section\>*, so the History tab distinguishes prose you typed from prose you accepted, and undo still reverses it.

**The key is a Worker secret and never reaches the browser.** Every call goes through `/api/v1/ai/*`; the built client bundle contains no credential. Without a key the panel degrades to setup instructions rather than an error, and the two buttons do not render at all.

```bash
# deployed
npx wrangler secret put OPENROUTER_API_KEY
```

Locally, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` (gitignored) and fill it in. Wrangler reads `.dev.vars` at startup, so restart the dev server after creating it.

Only **free** models are offered. The catalogue is public, so `GET /api/v1/ai/models` needs no key; it filters to zero-cost text-in and text-out models, sorts by context length and caches for an hour. Free tiers are rate-limited and slow, so a 429 comes back as "try another, or wait a moment" rather than a stack trace. Your model choice persists in localStorage and is re-validated against the list, because free models come and go without notice.

---

## Layout

```
apps/
  web/                         Vite + React 19
    src/
      state/                   schema, derivation, store, migrations,
                               component library and composition,
                               presets, changelog, build numbering
      color/                   conversion (culori), scale generation,
                               WCAG + APCA contrast, palette harmonies, modes
      type/                    modular scale, Google Fonts catalogue
      a11y/                    the accessibility audit
      emit/                    spec-conformant writer, validator, importer,
                               CSS inference, token formats, zip writer
      preview/                 CSS-var bridge, 6 surfaces, icons, inspect
      panels/                  one per tab
      ai/                      streaming client, prompt construction,
                               word diff, review card
      ui/                      shared controls, colour picker, font picker,
                               bezier editor, import modal, app chrome
    test/pipeline.mjs          regression suite
  api/
    src/index.ts               8 endpoints
    migrations/                D1 schema
```

Roughly 12,900 lines across 62 source files.

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

Opening the app gives you a new document rather than whatever you left behind. The previous session is rotated aside and offered back through a toast, guarded so an untouched document never displaces stored work.

---

## Testing

`npm test` runs 105 assertions over the pure layer: derivation, macro behaviour, generated scales, fluid sizing, component expansion, spec conformance, round-tripping, migration, presets, preview fidelity, contrast, component composition, the word diff and prompt construction. No framework, plain assertions, because that is where the correctness risk lives.

Round-tripping is **byte-identical for the YAML layer**. The prose layer cannot be: properties outside the spec's eight exist only in generated markdown, which import strips by design. That loss is reported on import rather than being silent.

---

## Deployment

The web app deploys to Vercel and the API to Cloudflare Workers. The root `vercel.json` carries the build settings, rewrites `/api/*` to the Worker and serves `/p/:id` from `index.html`. It lives at the root rather than in `apps/web` so importing the repo needs no per-project configuration.

**The web app deploys itself.** The Vercel project is connected to the Git repository, so every push to `main` builds and goes live. Nothing to run.

The Worker does not. Cloudflare has no equivalent hook here, so changes under `apps/api` need `npm run deploy -w apps/api` to reach production. It is easy to change the API and wonder why the deployed site has not noticed.

Before the first Worker deploy, create a real database and put its id in `apps/api/wrangler.toml`. The one committed there is a local-development placeholder.

```bash
npx wrangler d1 create design-md-editor
npm run db:migrate -w apps/api
npm run deploy -w apps/api
```

Two optional Worker secrets, both server-side only:

- `GOOGLE_FONTS_API_KEY` uses the official Web Fonts API. Without it the public metadata endpoint is used, which needs no credentials.
- `OPENROUTER_API_KEY` turns on the Rationale tab's AI. Without it that panel shows setup instructions and everything else works unchanged.

---

## Status

Colour, roles, typography, layout, shape, depth, motion, components, directives, accessibility, history, AI-assisted prose, responsive previews and the full export payload are complete. Schema is at v3, with migrations from v1 and v2.

The test worth running and not yet run: hand an exported `DESIGN.md` to a fresh agent, have it build a screen, and compare the result against the preview. Everything here rests on the claim that the file is sufficient. That is the only measurement of it.
