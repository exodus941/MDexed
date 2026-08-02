# MDexed

A visual editor for [DESIGN.md](https://github.com/google-labs-code/design.md) — the open format that gives coding agents a structured, persistent understanding of a design system.

Live at **[mdexed.vercel.app](https://mdexed.vercel.app)**.

Set a few seed colours and move five sliders. MDexed generates the colour scales, semantic roles, type scale, spacing, radii, elevation and a full component matrix, shows them on live mock screens, checks them for accessibility, and writes a spec-conformant `DESIGN.md` you can hand to Claude Code, Cursor or Codex.

It also exports the things a markdown file cannot enforce on its own: `tokens.css`, a Tailwind preset, a W3C token file and rendered HTML. A `DESIGN.md` is advice. Those are the same values in a form a build can check.

---

## Quick start

Needs **Node 20+**.

```bash
npm install
npm run db:migrate:local   # creates the local D1 database
npm run dev                # web on :5173, API on :8787
```

Open <http://localhost:5173>. Vite proxies `/api` to the Worker on 8787.

| Command | What it does |
| --- | --- |
| `npm run dev` | Both servers |
| `npm run dev:web` / `npm run dev:api` | One at a time |
| `npm test` | 131 assertions over the pure layer |
| `npm run build` | Production build |
| `npm run bump -w apps/web` | Advance the build number before a push |
| `npm run db:migrate:local` | Apply migrations locally |

> A green build does not mean the app runs. Bundlers do not catch an undefined identifier inside a component, a dangling ref after a refactor, or a CSS rule that loses on specificity. Open the page after any change.

---

## How it works

The document stores **only seeds, macro values and explicit overrides**. Everything else is computed by `derive()`.

```
seeds + shape  ─►  OKLCH scales  ─►  semantic roles  ─┬─►  CSS custom properties  ─►  preview
                                                      └─►  DESIGN.md, tokens.css, Tailwind, JSON
macros ─────────────────────────────────────────────────►  (multiply through everything)
```

This is the decision everything else rests on. Saved state stays tiny, moving a macro reshapes the whole system instead of leaving stale values behind, and because the preview and every exporter read the same `derive()`, what you see is what ships. A test asserts the CSS variables equal the emitted values.

**Five macros** multiply through every dependent token:

| Macro | Range | Resolves to |
| --- | --- | --- |
| Type scale | 0.25–2 | base font size, px |
| Density | 0–2 | base spacing unit, px |
| Roundness | 0–4 | base corner radius, px |
| Depth | 0–2 | shadow strength, % — offset, blur and opacity together |
| Motion | 0–5 | the `normal` duration, ms |

Each shows its multiplier and what it resolves to, and **both are typeable**. Enter `20px` for roundness and it back-solves the multiplier. Dragging snaps to the default within a few percent, so getting back to baseline does not need a steady hand. Any individual token can be locked or overridden to opt out.

---

## The panels

### Meta/Global
Project name, description, the five macro sliders, and **6 presets**: Studio, Warm editorial, Swiss neutral, Soft product, Terminal, Dense data. A preset replaces every token but keeps your name and rationale.

### Colour
Seeds feed the generated scales. Everything downstream reads from here.

- **Palette generator**, inline. Lock the colours you like, hit Generate, and the rest re-roll around them. **7 harmonies** plus free. It works in OKLCH, so brightness stays even across a run, and status seeds are held to the hue bands that still read as success, warning and danger.
- **Scale generation**: 11 steps per seed, with controls for the lightness curve, chroma envelope and hue shift across the ramp — warm shadows, cool highlights. Your seed hex is pinned into its own scale, so it survives generation exactly.
- **Picker**: SV square, hue and alpha strips, five models (HEX, RGB, HSL, HSB, OKLCH), an eyedropper where the browser has one, and gamut warnings.
- **Gradients**: linear and radial, with stops that reference seeds, roles or scale steps instead of frozen hex — so a gradient tracks the palette. Drag to reorder, one click to reverse.

The shipped defaults were chosen against the accessibility audit, not by eye. Success is a teal rather than a green, because red-green colour blindness removes hue and every status role sits on the same scale step, which means they share a lightness by construction. A conventional green-amber-red trio cannot survive that.

### Roles
**28 semantic roles** in 5 groups, each mapped to a scale step per mode. This is what the exported file leads with. `surface-raised` tells an agent how to build a card; `neutral-800` does not.

- Edit **Light only, Dark only or Both**. One mode at a time gets the full width, which is what you want when a theme reads well in dark and badly in light.
- **Generate the opposite mode** by mirroring each role's scale position.
- **Contrast**: a free-form checker for any two roles, plus **12 fixed pairs** reported with WCAG ratios and APCA Lc. A test enforces that the shipped palette passes its own checks in both modes.

### Type
- The full **Google Fonts library**, proxied and cached through the Worker with no API key. Windowed list, lazy per-family loading, each row previewed in its own face.
- **Variable-axis sliders** built from each font's own metadata, plus OpenType feature toggles.
- A modular scale (**8 named ratios**) generating **14 text styles**. Line height and tracking follow curves derived from the resulting size, so leading tightens and tracking goes negative as type grows. The scale stays optically consistent, not just arithmetically consistent.
- Optional fluid `clamp()` sizing, and a per-token override on any field.

### Layout
Spacing scale from a base unit, breakpoints with container widths, grid columns and gutter, and a maximum measure in `ch`. These breakpoints drive the preview's width control, so a number you set is a layout you can look at.

The scale starts at **xs / 320px** on purpose. WCAG 1.4.10 asks the layout to survive a 320px viewport — that is a 1280px window at 400% zoom, not a phone — and a scale starting at 640 never names that width, which leaves an agent to invent one.

### Shape
Radius scale, border widths, the radius nesting rule, icon library with stroke width and size scale, an icon-to-label gap token, and a focus-ring spec with a live sample. Focus rings are the single most consistently omitted detail in generated UI.

### Depth
Elevation strategy — **shadow, border or tonal** — with layered two-part shadows tinted from the neutral scale rather than pure black. Scrim colour, opacity and blur, plus blend modes for overlays and fills. Borders and shadows have no CSS blend equivalent, and the panel says so instead of offering a control that does nothing.

### Motion
Duration scale (125 / 250 / 500ms by default), three personality presets, a **draggable cubic-bezier editor** with playback, and a reduced-motion policy.

### Components
**14 components** in 7 groups, expanding to **50 flattened entries** — variants, sizes and six interaction states, named the way the spec expects (`button-primary-hover`).

Every entry shows a **live sample** of itself beside its properties, inert but updating as you type. A modal or table gets the full width above its controls; everything else sits alongside, so the sample stays in view while you drag a slider.

**Composition** is separate from appearance and sits next to the component it governs. A modal's icon placement, icon size, alignment, title-to-body gap, action arrangement and close control are all editable, and the Overlays surface re-renders as you change them. None of it fits the spec's eight component properties, so it goes out as a settings table plus imperative rules — the same route elevation and motion take. Settings that stop applying, like icon size when there is no icon, disappear from both the panel and the file.

- Each card has a **search** matching entry names, property keys and values.
- Property fields offer token pickers scoped to the property type, with resolved previews: swatches for colours, computed px for dimensions, a bar for gradients.
- Properties outside the spec's legal eight are flagged and routed to prose.

### Directives
Style references, a **12-item anti-pattern checklist**, target framework and copy conventions. Per unit of effort this is the panel that most changes what an agent produces — negative constraints are the instruction type models follow most reliably.

### Rationale
The eight prose sections. Generated tables are appended automatically, so you write only the reasoning. This is also where the AI lives.

### History
Every edit since this browser first opened the project, with before and after values — colours as swatches, gradients as live previews, everything else as from and to. Filterable by **9 categories**, searchable, grouped by day.

**Revert** puts a single change back wherever that token stands now, leaving every other edit alone. It is not an undo, so it still works fifty changes later. **Rewind to here** rolls back everything after a point as one step, so Ctrl+Z undoes the whole rewind.

---

## Accessibility

Text contrast is the only accessibility rule most systems check, because it is the only one with an obvious number attached. The rules that actually break interfaces are elsewhere.

There is no Accessibility tab. It was mostly a fixed list that never changed no matter what you did, which is a page nobody reads twice. What is genuinely about *your* system now appears in two places:

- A **chip beside Contrast OK** in the preview bar: green "No warnings" when clean, amber or red with a count when not. Opening it lists every finding with its criterion and a **Fix it** button that jumps to the exact control.
- **Inline alerts in the panel that caused the finding**, so a 16px checkbox is flagged on the checkbox. Component findings roll their count up to the card and group headers, so nothing hides behind a closed disclosure.

| Check | Criterion |
| --- | --- |
| Non-text contrast on borders, control boundaries and focus rings | 1.4.11 (AA) |
| Focus indicator present, thick enough, legible against both adjacent colours | 2.4.7, 2.4.11, 2.4.13 |
| Target size, with the spacing exception applied when the system declares a minimum | 2.5.8 (AA), 2.5.5 (AAA) |
| Reflow: a breakpoint scale that never names 320px, containers wider than the viewport that activates them | 1.4.10 (AA) |
| A heading scale that contradicts the outline — h3 larger than h2, or two levels the same size | 1.3.1 (A) |
| Body size, line height, tracking and measure | 1.4.12 (AA), 1.4.8 (AAA) |
| Reduced-motion policy and long durations | 2.2.2 (A), 2.3.3 (AAA) |
| Colour independence, by simulating deuteranopia and protanopia and measuring what separation survives | 1.4.1 (A) |
| Disabled text legibility, which WCAG exempts and users still have to read | practice |

Every check runs against the derived tokens — the same values the preview renders and the file exports — so a pass is a statement about what ships, not about intent. Findings are advice, not gates. A system that fails the 44px target on purpose, because it is a dense data tool for mouse users, is a legitimate system. What is not legitimate is failing it without knowing.

**Twelve requirements ship inside the exported file**, and six of them are checkable here. The other six — semantic elements, label association, DOM order, focus restoration, live regions, alt text — are about markup, and nothing in a token file predicts them. `REQUIREMENTS` records which is which, because a green badge that means "unmeasured" is how systems ship inaccessible. All twelve go into `DESIGN.md` regardless: the agent writing the markup is the only party who can satisfy the unchecked half.

The default document raises **zero findings**. Shipping a default that fails your own checker teaches people to ignore the checker.

---

## Preview

Six surfaces — Dashboard, Landing, Form, Settings, Overlays, Gallery — with a light and dark toggle. Everything is styled from the **339 CSS custom properties** `derive()` produces, so there is no second set of values the preview could drift toward.

**Click anything** to jump to its definition. Clicks resolve innermost-first, so a button inside a card is the button, and the card is still offered, because a click also collects what its containers answer to. A run of text opens into its font and its colour, which live on different tabs. The target opens, scrolls into view and highlights. Alt-click interacts with the control instead.

**Responsive widths** come from the breakpoints this document declares, not a generic set of phone sizes, so the control tests your system rather than someone else's. The surfaces respond through **container queries**: the viewport never changes when a pane narrows, and a media query would sit there reporting 1280px while the surface renders at 400.

---

## Exports

| Button | Produces |
| --- | --- |
| Preview design.md | The file in a dialog, with a spec-valid badge or the specific errors |
| Export Preview (HTML) | The current surface as a standalone page |
| Export design.md | The file |
| Export Payload | A zip: `DESIGN.md`, `tokens.css`, `tokens.scss`, `tokens.ts`, `tokens.json`, a Tailwind v3 preset, Tailwind v4 CSS, a README, and all six surfaces as HTML |

The token files exist because a `DESIGN.md` is advisory — it tells an agent what to do and nothing checks whether it did. `tokens.css` carries both themes. The Tailwind preset points its colours at those properties rather than at hex, so `bg-surface` works in both themes without a `dark:` variant anywhere. `tokens.json` is W3C Design Tokens format.

The HTML examples carry the same stylesheet the editor's preview uses, container queries included, so the page a developer opens is the page you were looking at. Every value sits in a `:root` block rather than baked into rules, and both palettes ship, switched by `data-theme`.

A default document emits about **25 kB** of `DESIGN.md`.

### Import Reference

The way back in. Hand it a `DESIGN.md` and it opens as a document, replacing what you have. Hand it a **stylesheet** and it works out which of your seeds each thing in the file belongs to, then shows you the mapping before applying anything.

Two sources of signal, in that order:

1. **The name.** `--color-brand-primary` is somebody stating an intent, so named matches win outright. It knows `--primary` beats `--primary-hover`, and that `--blue-500` is the base of its ramp while `--blue-50` is an end.
2. **The colour itself.** A stylesheet with no custom properties still has hue: the most saturated colour is usually the brand, the grey nearest mid-lightness makes the best neutral, and a colour sitting at 145° in OKLCH is a green whatever it was called.

The mapping arrives as a table — Seed, Type, Slug, Source, Match, Value — one row per slot, grouped into Colours, Type and Measurements. Every row says whether it was matched **by name** or **inferred**, hovering the chip explains why, and any row can be re-pointed at a different colour from the file or switched off entirely.

Anything you switch off keeps its current value and stays consistent with everything derived from it. Nothing is blanked, so there are no holes for an agent to guess its way out of.

---

## Editor chrome

The **UI** menu configures the tool, not the design. Nothing here reaches the exported file.

- **Theme** — light or dark, with a **Brightness** slider. Text moves with the surfaces, so dimming reads as a lower lamp rather than as grey ink, and the range never falls below AA.
- **UI Scale**, 75–150%. The chrome is drawn in absolute pixels, which is what makes a dense tool legible at one size — and also makes it exactly one size. This scales all of it.
- **Preview Scale**, with a **Link to UI Scale** checkbox that is off by default. That default is the point: the editor is a tool and can be as large as your eyes want, but the preview is the thing being judged, and "is 14px body text too small" is unanswerable if the app has quietly grown it to 21. Unlinked, a 375px responsive preview is 375 real pixels whatever the chrome is doing.
- **UI Hue** rotates every neutral in the chrome at its own saturation and lightness, so the tonal structure is untouched and only the cast changes. Semantic colours are left out — a hue slider that also turned the error colour green would be a different feature.
- **UI Animation** governs every transition the editor makes. Not the same as the Motion tab: that one defines your system's durations, this one defines the tool's. Content that swaps **cross-dissolves** rather than cutting — editor tabs, preview surfaces, the light/dark toggle, the picker's model tabs. Set it to 0 and every swap is instantaneous.

Toasts obey the animation setting and withdraw on their own: notices after ten seconds with hover pausing the clock, the restore offer after thirty. Tab-strip chevrons scroll while you hover them, ramping up from a standstill over about 180ms, because a strip is a queue you look through and clicking once per 160px is the interaction equivalent of a stuck key. `prefers-reduced-motion` is honoured throughout.

---

## Versions

Two build numbers, at opposite ends of the header, because they answer different questions.

Next to the wordmark is **the app's**, as `YYMMDD-N`: `260803-24` is the twenty-fourth build of 3 August 2026. It comes from `build-number.json`, advanced by `npm run bump` before a push, so the number is decided at commit time and travels with the commit. Rebuilding a commit reproduces its id rather than inventing a new one. The dev server reports `dev`, since nothing was built.

Next to the storage readout is **the document's**, same form, stamped when you export. Edits do not move it — a version that changed on every keystroke would say nothing about which file anyone is holding. A document that has never been exported says `unbuilt`.

---

## Spec conformance

The DESIGN.md frontmatter schema is deliberately narrow. Allowed keys are `version`, `name`, `description`, `omitted`, `colors`, `typography`, `rounded`, `spacing` and `components`. Component entries accept eight properties: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`. Variants and states are flattened into hyphenated names.

**Elevation, motion, gradients, breakpoints, icons, focus rings and accessibility have no slot in that schema.** MDexed emits them as tables inside the standard markdown sections rather than inventing frontmatter keys. That keeps the file valid for any consumer, and in practice an agent pays more attention to a `## Elevation & Depth` section than to an unrecognised YAML key. Gradients cannot be `colors` tokens at all, because a gradient is a CSS image, not a colour value.

Generated tables are wrapped in `<!-- design.md:generated -->` comments — invisible when rendered, and precisely strippable on import, so re-importing never pastes them into prose you wrote.

Every export is validated before it leaves the app.

---

## AI assistance

Optional, off unless a key is configured, and confined to the Rationale tab. It writes prose and never tokens.

**Two actions per section.** *Refine* tightens what you wrote; *Draft from tokens* writes the section from the values it governs. Both send the real token facts for that section — the semantic roles for Colors, the generated scale for Typography, the active anti-patterns for Do's and Don'ts — so the model describes what the file actually says instead of guessing. It is told to give imperative guidance and forbidden from inventing token names or values.

**Nothing is applied until you accept.** The result streams into a review card with a word-level diff: additions green, deletions struck through, a `+n −n` count, and a toggle to read the new version plain. Accept, Discard or Regenerate. Accepting logs as *AI rewrite · Rationale · \<section\>*, so History distinguishes prose you typed from prose you accepted, and undo still reverses it.

**The key is a Worker secret and never reaches the browser.** Every call goes through `/api/v1/ai/*`; the built client bundle contains no credential. Without a key the panel shows setup instructions rather than an error, and the two buttons do not render.

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

Locally, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` (gitignored) and fill it in. Wrangler reads it at startup, so restart the dev server afterwards.

Only **free** models are offered. The catalogue is public, so `GET /api/v1/ai/models` needs no key; it filters to zero-cost text models, sorts by context length and caches for an hour. Free tiers are rate-limited, so a 429 comes back as "try another, or wait a moment" rather than a stack trace. Your model choice persists and is re-validated against the list, because free models come and go without notice.

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
      a11y/                    the audit, and the alerts that surface it
      emit/                    spec-conformant writer, validator, importer,
                               CSS inference and slot mapping,
                               token formats, zip writer
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

Roughly 16,200 lines across 67 source files.

Both stylesheets — the editor chrome and the preview — are real `.css` files imported with `?raw`, not template literals. A backtick typed inside a CSS comment used to truncate the whole sheet: the app rendered nothing and the build stayed green, because the resulting error landed somewhere unrelated. That happened five times. A `.css` file cannot have the problem, and the suite asserts neither file has drifted back into JavaScript.

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

Sharing is capability-based: creating a project returns a 32-character edit token, and only its SHA-256 hash is stored. Anyone with the `/p/:id` URL can read; only a token holder can write. Concurrent edits are caught by an optimistic version counter.

### Persistence

One `persist()` path serves both destinations, so "saved" means one thing. Local drafts debounce at 600ms, cloud projects at 1500ms. A flash confirms each save and names where it went; a manual Save button forces one immediately. The change log lives in localStorage, separate from the document, and never reaches the exported file.

Opening the app gives you a new document rather than whatever you left behind. The previous session is rotated aside and offered back through a toast, guarded so an untouched document never displaces stored work.

---

## Testing

`npm test` runs **131 assertions** over the pure layer: derivation, macro behaviour, generated scales, fluid sizing, component expansion, spec conformance, round-tripping, migration, presets, preview fidelity, contrast, composition, reference mapping, the word diff and prompt construction. No framework, plain assertions, because that is where the correctness risk lives.

Round-tripping is **byte-identical for the YAML layer**. The prose layer cannot be: properties outside the spec's eight exist only in generated markdown, which import strips by design. That loss is reported on import rather than being silent.

Three of the checks are not about design at all. Each exists because the same mistake happened twice:

- **Source encoding.** A file was read as Latin-1 and written back as UTF-8, turning every em-dash into three characters. It survived a build, a test run and a deploy, because mojibake is valid JavaScript.
- **Shared constants are imported.** A constant used but never imported is a runtime `ReferenceError`, not a syntax error, so the build passes and the component blanks the app when it renders. The suite checks that every `SCREAMING_CASE` name used in an evaluated position is declared or imported in the file using it.
- **Stylesheets are stylesheets.** See above.

---

## Deployment

The web app deploys to Vercel, the API to Cloudflare Workers. The root `vercel.json` carries the build settings, rewrites `/api/*` to the Worker and serves `/p/:id` from `index.html`. It lives at the root rather than in `apps/web` so importing the repo needs no per-project configuration.

**The web app deploys itself.** The Vercel project is connected to the repo, so every push to `main` builds and goes live.

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

Colour, roles, typography, layout, shape, depth, motion, components, directives, accessibility, history, AI-assisted prose, responsive previews, reference import and the full export payload are all working. Schema is at v3, with migrations from v1 and v2.

The test worth running and not yet run: hand an exported `DESIGN.md` to a fresh agent, have it build a screen, and compare the result against the preview. Everything here rests on the claim that the file is sufficient. That is the only real measurement of it.
