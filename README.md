# MDexed

A visual editor for [DESIGN.md](https://github.com/google-labs-code/design.md). That open format gives coding agents a structured, persistent model of a design system.

Live at **[mdexed.vercel.app](https://mdexed.vercel.app)**.

---

## Read this before you start

**This is not a tool for beginners**. It exposes the parts of a design system that most tools hide. It expects you to know what those parts do.

**This is not a tool that makes designs from scratch**. It does not invent a look for you. It takes the decisions you make and carries them through every token, every component and every exported file.

**Good output needs design knowledge and taste**. The tool checks contrast, target size and heading order. It cannot tell you that your type scale is dull or that your palette has no point of view. That part is yours.

**It is for UI/UX designers and front-end developers who want full control** over their own work, down to very granular detail. If you want a theme picked for you, this is the wrong tool.

**It writes a complete design guideline for machines to follow**. The output covers every component and every style rule, as machine-readable files plus rendered examples. An agent reads it once and follows it exactly. You stop repeating the same corrections across prompts, and you stop paying tokens to do it.

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
| `npm run dev:web` / `npm run dev:api` | One server at a time |
| `npm test` | 131 assertions over the pure layer |
| `npm run build` | Production build |
| `npm run db:migrate:local` | Apply migrations locally |

> A green build does not mean the app runs. A bundler does not catch an undefined identifier inside a component. It does not catch a dangling ref after a refactor, or a CSS rule that loses on specificity. Open the page after any change.

---

## How it works

The document stores **only seeds, macro values and explicit overrides**. `derive()` computes the rest.

```
seeds + shape  ->  OKLCH scales  ->  semantic roles  -+->  CSS custom properties  ->  preview
                                                      +->  DESIGN.md, tokens.css, Tailwind, JSON
macros ------------------------------------------------->  (multiply through everything)
```

Every other decision rests on this one. Saved state stays small. Moving a macro reshapes the whole system and leaves no stale values behind. The preview and every exporter read the same `derive()`, so what you see is what ships. A test asserts that the CSS variables equal the emitted values.

**Five macros** multiply through every dependent token.

| Macro | Range | Resolves to |
| --- | --- | --- |
| Type scale | 0.25–2 | base font size, px |
| Density | 0–2 | base spacing unit, px |
| Roundness | 0–4 | base corner radius, px |
| Depth | 0–2 | shadow strength, % |
| Motion | 0–5 | the `normal` duration, ms |

Each macro shows its multiplier and the value it resolves to. **You can type either one**. Enter `20px` for roundness and the app back-solves the multiplier. Dragging snaps to the default within a few percent, so a return to baseline does not need a steady hand. Lock or override any single token to opt it out.

---

## The panels

### Meta/Global

Project name, description, the five macro sliders, and **6 presets**: Studio, Warm editorial, Swiss neutral, Soft product, Terminal, Dense data. A preset replaces every token. It keeps your name and your rationale.

### Colour

Seeds feed the generated scales. Everything downstream reads from here.

- **Palette generator**, inline. Lock the colours you like and press Generate. The rest re-roll around them. **7 harmonies** plus free. It works in OKLCH, so brightness stays even across a run. Status seeds stay inside the hue bands that still read as success, warning and danger.
- **Scale generation**: 11 steps per seed. Controls for the lightness curve, the chroma envelope and the hue shift across the ramp, which gives warm shadows and cool highlights. Your seed hex pins into its own scale and survives generation exactly.
- **Picker**: SV square, hue and alpha strips, five models (HEX, RGB, HSL, HSB, OKLCH), an eyedropper where the browser has one, and gamut warnings.
- **Gradients**: linear and radial. Stops reference seeds, roles or scale steps instead of frozen hex, so a gradient tracks the palette. Drag to reorder. One click reverses.

The shipped defaults come from the accessibility audit rather than from taste. Success is a teal and not a green. Red-green colour blindness removes hue, and every status role sits on the same scale step, so the three share a lightness by construction. A conventional green-amber-red trio cannot survive that.

### Roles

**28 semantic roles** in 5 groups. Each one maps to a scale step per mode. The exported file leads with these. `surface-raised` tells an agent how to build a card. `neutral-800` does not.

- Edit **Light only, Dark only or Both**. One mode at a time gets the full width. That is what you want when a theme reads well in dark and badly in light.
- **Generate the opposite mode** by mirroring the scale position of each role.
- **Contrast**: a free-form checker for any two roles, plus **12 fixed pairs** with WCAG ratios and APCA Lc. A test enforces that the shipped palette passes its own checks in both modes.

### Type

- The full **Google Fonts library**, proxied and cached through the Worker, with no API key. The app windows the list. Each family loads lazily, and every row previews in its own face.
- **Variable-axis sliders** built from the metadata inside each font, plus OpenType feature toggles.
- A modular scale with **8 named ratios**, generating **14 text styles**. Line height and tracking follow curves derived from the resulting size. Leading tightens and tracking goes negative as type grows, so the scale stays optically consistent and not merely arithmetically consistent.
- Optional fluid `clamp()` sizing, and a per-token override on any field.

### Layout

Spacing scale from a base unit, breakpoints with container widths, grid columns and gutter, and a maximum measure in `ch`. These breakpoints drive the preview width control, so a number you set becomes a layout you can look at.

The scale starts at **xs / 320px** on purpose. WCAG 1.4.10 asks the layout to survive a 320px viewport. That is a 1280px window at 400% zoom, not a phone. A scale that starts at 640 never names that width, which leaves an agent to invent one.

### Shape

Radius scale, border widths and the radius nesting rule. Icon library with stroke width, size scale and an icon-to-label gap token. A focus-ring spec with a live sample. Generated UI omits focus rings more often than any other detail.

### Depth

Elevation strategy: **shadow, border or tonal**. Layered two-part shadows take their tint from the neutral scale rather than from pure black. Scrim colour, opacity and blur are editable, with blend modes for overlays and fills. Borders and shadows have no CSS blend equivalent. The panel says so instead of offering a control that does nothing.

### Motion

Duration scale, 125 / 250 / 500ms by default. Three personality presets. A **draggable cubic-bezier editor** with playback, and a reduced-motion policy.

### Components

**14 components** in 7 groups. They expand to **50 flattened entries** across variants, sizes and six interaction states, named the way the spec expects, such as `button-primary-hover`.

Every entry shows a **live sample** of itself beside its properties. The sample is inert and updates as you type. A modal or a table takes the full width above its controls. Everything else sits alongside, so the sample stays in view while you drag a slider.

**Composition** is separate from appearance and sits next to the component it governs. For a modal you can edit icon placement, icon size, alignment, title-to-body gap, action arrangement and close control. The Overlays surface re-renders as you change them. None of this fits the eight component properties in the spec, so it leaves as a settings table plus imperative rules. Elevation and motion take the same route. A setting that stops applying, such as icon size when there is no icon, disappears from both the panel and the file.

- Each card has a **search** that matches entry names, property keys and values.
- Property fields offer token pickers scoped to the property type, with resolved previews: swatches for colours, computed px for dimensions, a bar for gradients.
- The app flags properties outside the legal eight and routes them to prose.

### Directives

Style references, a **12-item anti-pattern checklist**, target framework and copy conventions. Per unit of effort, this panel changes agent output more than any other. Models follow negative constraints more reliably than any other instruction type.

### Rationale

The eight prose sections. The app appends generated tables for you, so you write only the reasoning. The AI lives here.

### History

Every edit since this browser first opened the project, with before and after values. Colours show as swatches, gradients as live previews, everything else as from and to. Filter by **9 categories**, search, and read it grouped by day.

**Revert** puts a single change back wherever that token stands now and leaves every other edit alone. It is not an undo, so it still works fifty changes later.

**Rewind to here** rolls back everything after a point as one step. Ctrl+Z then reverses the whole rewind.

---

## Accessibility

Text contrast is the only accessibility rule most systems check, because it is the only one with an obvious number attached. The rules that actually break interfaces sit elsewhere.

There is no Accessibility tab. It was mostly a fixed list that never changed whatever you did, and nobody reads that page twice. What is genuinely about *your* system now appears in two places.

- A **chip beside Contrast OK** in the preview bar. It reads green "No warnings" when clean, amber or red with a count when not. Open it to list every finding with its criterion and a **Fix it** button that jumps to the exact control.
- **Inline alerts in the panel that caused the finding**. A 16px checkbox gets flagged on the checkbox. Component findings roll their count up to the card and group headers, so nothing hides behind a closed disclosure.

| Check | Criterion |
| --- | --- |
| Non-text contrast on borders, control boundaries and focus rings | 1.4.11 (AA) |
| Focus indicator present, thick enough, legible against both adjacent colours | 2.4.7, 2.4.11, 2.4.13 |
| Target size, with the spacing exception applied when the system declares a minimum | 2.5.8 (AA), 2.5.5 (AAA) |
| Reflow: a breakpoint scale that never names 320px, containers wider than their viewport | 1.4.10 (AA) |
| A heading scale that contradicts the outline, such as h3 larger than h2 | 1.3.1 (A) |
| Body size, line height, tracking and measure | 1.4.12 (AA), 1.4.8 (AAA) |
| Reduced-motion policy and long durations | 2.2.2 (A), 2.3.3 (AAA) |
| Colour independence, by simulating deuteranopia and protanopia | 1.4.1 (A) |
| Disabled text legibility, which WCAG exempts and users still have to read | practice |

Every check runs against the derived tokens, which are the same values the preview renders and the file exports. A pass therefore states something about what ships, not about intent. Findings are advice and not gates. A system that fails the 44px target on purpose, because it is a dense data tool for mouse users, is a legitimate system. Failing it without knowing is not.

**Twelve requirements ship inside the exported file**. Six of them are checkable here. The other six cover semantic elements, label association, DOM order, focus restoration, live regions and alt text. Those are about markup, and nothing in a token file predicts them.

The `REQUIREMENTS` table records which is which. A green badge that means "unmeasured" is how systems ship inaccessible. All twelve go into `DESIGN.md` anyway. The agent writing the markup is the only party who can satisfy the unchecked half.

The default document raises **zero findings**. A default that fails your own checker teaches people to ignore the checker.

---

## Preview

Six surfaces: Dashboard, Landing, Form, Settings, Overlays and Gallery, with a light and dark toggle. The **339 CSS custom properties** from `derive()` style all of it, so no second set of values exists for the preview to drift toward.

**Click anything to jump to its definition**. Clicks resolve innermost first, so a button inside a card is the button. The card is still offered, because a click also collects what its containers answer to. A run of text opens into its font and its colour, which live on different tabs. The target opens, scrolls into view and highlights. Alt-click interacts with the control instead.

**Responsive widths** come from the breakpoints this document declares, not from a generic set of phone sizes. The control therefore tests your own system and not a generic one. The surfaces respond through **container queries**. The viewport never changes when a pane narrows, and a media query would sit there reporting 1280px while the surface renders at 400.

---

## Exports

| Button | Produces |
| --- | --- |
| Preview design.md | The file in a dialog, with a spec-valid badge or the specific errors |
| Export Preview (HTML) | The current surface as a standalone page |
| Export design.md | The file |
| Export Payload | A zip, listed below |

The zip holds `DESIGN.md`, `tokens.css`, `tokens.scss`, `tokens.ts`, `tokens.json`, a Tailwind v3 preset, Tailwind v4 CSS, a README, and all six surfaces as HTML.

The token files exist because a `DESIGN.md` is advisory. It tells an agent what to do, and nothing checks whether it did. `tokens.css` carries both themes. The Tailwind preset points its colours at those properties rather than at hex. `bg-surface` therefore works in both themes, with no `dark:` variant anywhere. `tokens.json` uses W3C Design Tokens format.

The HTML examples carry the same stylesheet the preview uses, container queries included. A developer opens the same page you saw. Every value sits in a `:root` block rather than baked into rules, and both palettes ship, switched by `data-theme`.

A default document emits about **25 kB** of `DESIGN.md`.

### Import Reference

This is the way back in. Hand it a `DESIGN.md` and it opens as a document, replacing what you have. Hand it a **stylesheet** and it works out which of your seeds each thing in the file belongs to. It shows you the mapping before it applies anything.

Two sources of signal, in this order.

1. **The name.** `--color-brand-primary` is somebody stating an intent, so a named match wins outright. The mapper knows that `--primary` beats `--primary-hover`, and that `--blue-500` is the base of its ramp while `--blue-50` is an end.
2. **The colour itself**. A stylesheet with no custom properties still has hue. The most saturated colour is usually the brand. The grey nearest mid-lightness makes the best neutral. A colour sitting at 145° in OKLCH is a green under any name.

The mapping arrives as a table with columns Seed, Type, Slug, Source, Match and Value. There is one row per slot, grouped into Colours, Type and Measurements. Every row says whether the match came **by name** or **inferred**. Hover the chip to read why. Re-point any row at a different colour from the file, or switch it off.

Anything you switch off keeps its current value and stays consistent with everything derived from it. The app blanks nothing, so no holes remain for an agent to guess its way out of.

---

## Editor chrome

The **UI** menu configures the tool and not the design. Nothing here reaches the exported file.

- **Theme**, light or dark, with a **Brightness** slider. Text moves with the surfaces, so dimming reads as a lower lamp rather than as grey ink. The range never falls below AA.
- **UI Scale**, 75–150%, in 12.5% steps. The chrome uses absolute pixels. That is what makes a dense tool legible at one size, and also fixes it at one size. This scales all of it.
- **Preview Scale**, with a **Link to UI Scale** checkbox that is off by default. That default is the point. The editor is a tool and can be as large as your eyes want. The preview is the thing under judgement. "Is 14px body text too small" has no answer if the app quietly grew it to 21. Unlinked, a 375px responsive preview is 375 real pixels whatever the chrome does.
- **UI Hue** rotates every neutral in the chrome at its own saturation and lightness. The tonal structure stays untouched and only the cast changes. Semantic colours stay out of it. A hue slider that also turned the error colour green would be a different feature.
- **UI Animation** governs every transition the editor makes. This is not the Motion tab. That one defines the durations for your design system. This one defines the durations for the editor. Content that swaps **cross-dissolves** rather than cutting: editor tabs, preview surfaces, the light/dark toggle, the model tabs in the picker. Set it to 0 and every swap happens at once.

Toasts obey the animation setting and withdraw on their own. Notices go after ten seconds, and hover pauses the clock. The restore offer goes after thirty. Tab-strip chevrons scroll while you hover them and accelerate from a standstill over about 180ms. A strip is a queue you look through, and one click per 160px is the interaction equivalent of a stuck key. The app honours `prefers-reduced-motion` throughout.

### Text baselines

Text that shares a line shares a baseline. Where a chip, a count or a button sits next to a single line of text, the two sit on one baseline. Where the neighbour runs to two lines, the single item centres on the block instead. A block has no one line to sit on.

Three CSS traps make this harder than it sounds. All three look identical on screen.

- `align-items: center` leaves nothing in the baseline set. A flex box then takes its baseline from the bottom edge of the first item. An icon in front of a label hands the whole button the wrong one.
- `align-self: stretch` removes an item from the baseline group completely.
- An inline-block with `overflow` other than `visible` reports its bottom margin edge as its baseline.

---

## Versions

Two build numbers sit at opposite ends of the header, because they answer different questions.

Next to the wordmark is **the number for the app**, in the form `YYMMDD-N`. `260806-2` is the second build of 6 August 2026. It comes from `build-number.json`, and a pre-commit hook in `.githooks` advances it. The hook fires only when the branch has no unpushed commit. The first commit after a push therefore starts a new build, and later commits join it. The number therefore counts deploys and not commits. `npm run bump -w apps/web` does the same thing by hand. Because the number lives in the repository, a rebuild of one commit reproduces its id instead of inventing a new one. The dev server reports `dev`, because no build happened.

Next to the storage readout is **the number for the document**, in the same form. The app stamps it when you export. Edits do not move it. A version that changed on every keystroke would say nothing about which file anyone holds. A document that you never exported says `unbuilt`.

---

## Spec conformance

The DESIGN.md frontmatter schema is deliberately narrow. Allowed keys are `version`, `name`, `description`, `omitted`, `colors`, `typography`, `rounded`, `spacing` and `components`. Component entries accept eight properties: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height` and `width`. Variants and states flatten into hyphenated names.

**Seven systems have no slot in that schema**: elevation, motion, gradients, breakpoints, icons, focus rings and accessibility. MDexed emits them as tables inside the standard markdown sections rather than inventing frontmatter keys. The file stays valid for any consumer. In practice an agent pays more attention to a `## Elevation & Depth` section than to an unrecognised YAML key. A gradient cannot be a `colors` token at all, because a gradient is a CSS image and not a colour value.

Generated tables sit inside `<!-- design.md:generated -->` comments. A renderer hides them, and import strips them precisely, so a re-import never pastes them into prose you wrote.

The app validates every export before it leaves.

---

## AI assistance

Optional, and off until you configure a key. It stays inside the Rationale tab. It writes prose and never tokens.

**Two actions per section.** *Refine* tightens what you wrote. *Draft from tokens* writes the section from the values it governs. Both send the real token facts for that section. Colors gets the semantic roles. Typography gets the generated scale. Do's and Don'ts gets the active anti-patterns. The model therefore describes what the file says instead of guessing. The prompt asks for imperative guidance and forbids invented token names or values.

**Nothing applies until you accept it**. The result streams into a review card with a word-level diff. Additions show green, deletions show struck through, with a `+n −n` count and a toggle to read the new version plain. Accept, Discard or Regenerate. Accepting logs as *AI rewrite · Rationale · \<section\>*, so History separates prose you typed from prose you accepted, and undo still reverses it.

**The key is a Worker secret and never reaches the browser**. Every call goes through `/api/v1/ai/*`, and the built client bundle carries no credential. Without a key the panel shows setup instructions rather than an error, and the two buttons do not render.

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

For local work, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`, which git ignores, and fill it in. Wrangler reads it at startup, so restart the dev server afterwards.

The app offers **free** models only. The catalogue is public, so `GET /api/v1/ai/models` needs no key. It filters to zero-cost text models, sorts by context length and caches for an hour. Free tiers are rate-limited, so a 429 comes back as "try another, or wait a moment" rather than as a stack trace. Your model choice persists, and the app re-validates it against the list, because free models come and go without notice.

---

## Project layout

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

Both stylesheets, the editor chrome and the preview, are real `.css` files. The app imports them with `?raw` rather than as template literals. A backtick typed inside a CSS comment used to truncate the whole sheet. The app then rendered nothing while the build stayed green, because the resulting error landed somewhere unrelated. That happened five times. A `.css` file cannot have the problem, and the suite asserts that neither file has drifted back into JavaScript.

### API

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/health` | |
| `GET` | `/api/v1/fonts` | Google Fonts catalogue, cached 24h, no key needed |
| `GET` | `/api/v1/ai/models` | Free text models, cached 1h, reports whether a key exists |
| `POST` | `/api/v1/ai/complete` | Streams plain-text deltas, 503 `needsKey` when unconfigured |
| `POST` | `/api/v1/projects` | Returns `{ id, editToken, version }` |
| `GET` | `/api/v1/projects/:id` | Public read |
| `PATCH` | `/api/v1/projects/:id` | Needs `X-Edit-Token`, 409 on version mismatch |
| `DELETE` | `/api/v1/projects/:id` | Soft delete |

Sharing is capability-based. Creating a project returns a 32-character edit token, and the API stores only its SHA-256 hash. Anyone with the `/p/:id` URL can read. Only a token holder can write. An optimistic version counter catches concurrent edits.

### Persistence

One `persist()` path serves both destinations, so "saved" means one thing. Local drafts debounce at 600ms, cloud projects at 1500ms. A flash confirms each save and names where it went. A manual Save button forces one at once.

The change log lives in localStorage, separate from the document, and never reaches the exported file.

Opening the app gives you a new document rather than whatever you left behind. The app rotates the previous session aside and offers it back through a toast. A guard stops an untouched document from displacing stored work.

---

## Testing

`npm test` runs **131 assertions** over the pure layer. They cover derivation, macro behaviour, generated scales, fluid sizing and component expansion. They also cover spec conformance, round-tripping, migration, presets and preview fidelity. The rest check contrast, composition, reference mapping, the word diff and prompt construction. No framework, plain assertions, because that is where the correctness risk lives.

Round-tripping is **byte-identical for the YAML layer**. The prose layer cannot be. Properties outside the legal eight exist only in generated markdown, which import strips by design. The app reports that loss on import rather than hiding it.

Three of the checks are not about design at all. Each one exists because the same mistake happened twice.

- **Source encoding**. One file went in as Latin-1 and came back as UTF-8. Every em dash turned into three characters. It survived a build, a test run and a deploy, because mojibake is valid JavaScript.
- **Shared constants are imported**. A constant used but never imported is a runtime `ReferenceError` and not a syntax error. The build passes, then the component blanks the app when it renders. The suite checks every `SCREAMING_CASE` name in an evaluated position. The file that uses one must also declare or import it.
- **Stylesheets are stylesheets**. See above.

---

## Deployment

The web app deploys to Vercel, the API to Cloudflare Workers. The root `vercel.json` carries the build settings, rewrites `/api/*` to the Worker and serves `/p/:id` from `index.html`. It lives at the root rather than in `apps/web`, so importing the repository needs no per-project configuration.

**The web app deploys itself**. The Vercel project connects to the repository, so every push to `main` builds and goes live. The build number advances on its own through the pre-commit hook, so a new deploy always reports a new id.

The Worker does not deploy itself. Cloudflare has no equivalent hook here, so changes under `apps/api` need `npm run deploy -w apps/api` to reach production. It is easy to change the API and then wonder why the deployed site has not noticed.

Before the first Worker deploy, create a real database and put its id in `apps/api/wrangler.toml`. The one committed there is a placeholder for local development.

```bash
npx wrangler d1 create design-md-editor
npm run db:migrate -w apps/api
npm run deploy -w apps/api
```

Two optional Worker secrets, both server-side only.

- `GOOGLE_FONTS_API_KEY` uses the official Web Fonts API. Without it the app uses the public metadata endpoint, which needs no credentials.
- `OPENROUTER_API_KEY` turns on the AI in the Rationale tab. Without it that panel shows setup instructions and everything else works unchanged.

---

## Status

Colour, roles, typography, layout, shape, depth, motion, components, directives, accessibility, history, AI-assisted prose, responsive previews, reference import and the full export payload all work. Schema is at v3, with migrations from v1 and v2.

The end-to-end test has run. A fresh agent built a screen from an exported `DESIGN.md`, and the result matched the preview. Everything here rests on the claim that the file carries enough on its own, and that claim holds.
