# MDexed

**A detailed editor for design systems, built around [DESIGN.md](https://github.com/google-labs-code/design.md). That open format hands a coding agent a set of structured and consistent visual guidelines for building a functional interface.**

Live at **[mdexed.vercel.app](https://mdexed.vercel.app)**. **Beta** — every part
of the pipeline works end to end and the format it writes is stable. Expect
polish and new features, not a rewrite.

**Two ways in.** Answer eight questions and hand the prompt to an AI agent,
which sets the system up inside the app while you watch. Or open the editor and
set every value yourself. The fork is the first thing a new visit sees, and
neither side locks you in.

Set a few seed colours and move five sliders. MDexed generates the colour scales, semantic roles, type scale, spacing, radii, elevation, stacking order, chart palettes and a full component matrix. It shows all of it on twelve live mock screens and audits it against WCAG while you work.

The markdown is what an agent reads, and it is not the whole export. The payload also carries `tokens.css`, Sass, TypeScript, W3C design tokens, presets for Tailwind v3 and v4, two verifiers the agent can run on its own work, and every sample screen as standalone HTML in each theme you ship.

A `DESIGN.md` is advice. An agent can read it and still write the wrong hex, and nothing catches that. The other files are the same values as working code. Import `tokens.css` and `var(--c-accent)` can only ever be your accent. A hardcoded colour then shows up in a diff instead of passing for correct.

Very special thanks to the incredible [ninienowrin](https://github.com/ninienowrin/) for taking the trouble to put together the first bones of the project based on my rambling near-incoherent descriptions of a hazy half-formed concept, and then forcing me to go neck-deep into hands-on vibe coding so that I could take it from there myself.

---

## Two Ways In

A first visit used to open on the editor, so the person who came to get a
design system had to become a design-system editor first. There are two doors
now, and the launch screen offers both. **New (Guided)** in the Project menu
reopens the wizard at any point, and **Hands-on** is the editor this whole file
describes.

### Guided

Eight questions, one page each. **Seven** of them draw a live sample of your
answers above the question, in both themes if you ship both. The first asks
what you are building, which nothing can draw. The ninth page is the output.

| Page | Asks | Options |
| --- | --- | --- |
| What Are You Building? | One line, and you can skip it | free text |
| Light, Dark, or Both? | Which themes ship | 3 |
| Your Colours | Your own hexes, first one is the accent | up to 6 |
| Palette | The hue family, if you gave no colours | 6 |
| The Ground | What every surface is tinted with | 3 |
| Type | A display and body pairing | 5 |
| Tightness | Density | 4 |
| More Choices | Corner shape, card edges, lift | 3 / 2 / 4 |

**The wizard writes no document.** Its output is about 630 words of text. You
copy that, or save it as `.md` or `.txt`, and paste it into anything that can
open a web page. The agent then drives `mdexed.vercel.app` itself: it sets the
seeds, reads the app's own audit, shows you the result and exports the package.

That is the whole design. The decisions land **inside the app**, where the
contrast audit can judge them, rather than in a file nobody checked. An agent
writing CSS from a sentence about "warm, editorial" produces a look with no
instrument pointed at it.

The prompt carries six things and nothing else.

1. The URL, and the instruction to open it.
2. Your line about what you are building.
3. The answers, as hue ranges and named values.
4. Enough of the interface to navigate it: where the panels are, where the two
   readouts are, which button exports.
5. The one warning class worth naming in advance. Three role pairs have to stay
   apart for red-green vision, and the prompt states both floors, so the agent
   avoids the fault instead of discovering it.
6. How to read the verdict, and what to do at each outcome. Fix every failure.
   Fix a warning if the fix costs nothing. Never apply a repair that raises the
   total.

It names no token and no field. Those belong to the schema, and the schema
moves. A guard compares the panel and surface names in the prompt against the
running app on every check, so the prompt cannot tell an agent to click a tab
that has been renamed.

**A sample is a stylistic representation, not the output.** The wizard says so
under every one of them. Your later answers and the audit both move those
colours.

### Hands-on

The editor. Twelve panels, and every value in the system is yours to set or
override. Everything below this section is about that door.

---

## Read This Before You Start

**The editor is not a tool for beginners**. It exposes the parts of a design system that most tools hide, and it expects you to know what those parts do. If people call you a control freak, you are going to love it. If they do not, take the guided door and let an agent drive.

**This is not a tool that makes designs from scratch**. It does not invent a look for you. It takes the decisions you make and carries them through every token, every component and every exported file.

**Good output needs design knowledge and taste**. The tool checks contrast, target size and heading order. It cannot tell you that your type scale is dull or that your palette has no point of view. That part is yours, and it stays yours in the guided door too: the agent proposes, the audit measures, and you are the one who says it is right.

**It writes a complete design guideline for machines to follow**. The output covers every component and every style rule, as machine-readable files plus rendered examples. An agent reads it once and follows it exactly. You stop repeating the same corrections across prompts, and you stop paying tokens to do it.

---

## Quick Start

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
| `npm test` | 1,133 assertion sites in 104 groups, over the pure layer |
| `npm run check` | 11 guards: syntax, scope, primitives, strays, the pixel grid, the audit's remedies, prompt drift, component gaps, render proofs, the figures in this file, rule coverage |
| `npm run build` | Production build |
| `npm run db:migrate:local` | Apply migrations locally |

> A green build does not mean the app runs. A bundler does not catch an undefined identifier inside a component. It does not catch a dangling ref after a refactor, or a CSS rule that loses on specificity. Open the page after any change.

---

## How It Works

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

## The Panels

### Meta/Global

Project name, description, the five macro sliders, and **6 presets**: Studio, Warm editorial, Swiss neutral, Soft product, Terminal, Dense data. A preset replaces every token. It keeps your name and your rationale.

### Colour

Seeds feed the generated scales. Everything downstream reads from here.

- **Palette generator**, inline. Lock the colours you like and press Generate. The rest re-roll around them. **7 harmonies**, free among them, **3 intensities**, and a chroma level on top of those. It works in OKLCH, so brightness stays even across a run. Status seeds stay inside the hue bands that still read as success, warning and danger.
- **Scale generation**: **11 steps** per seed. Controls for the lightness curve, the chroma envelope and the hue shift across the ramp, which gives warm shadows and cool highlights. Your seed hex pins into its own scale and survives generation exactly.
- **Ground tint**, which is the decision nobody offers: the neutral seed decides every surface and border, so it decides whether a page reads as a room with a coloured button in it or as a grey slab with a foreign hue stuck on. Three answers — the accent's own hue, a cool low chroma, or a cool vivid. It barely shows in light and decides everything in dark.
- **Picker**: SV square, hue and alpha strips, **4 models** (HSB, HSL, RGB, OKLCH) over a hex field that is always there, an eyedropper where the browser has one, and gamut warnings.
- **Gradients**: linear and radial. Stops reference seeds, roles or scale steps instead of frozen hex, so a gradient tracks the palette. Drag to reorder. One click reverses.
- **Three chart scales**, generated from the accent. Categorical asks which series this is, sequential asks how much of one thing, diverging asks how far either side of zero. The order is the contract: series one is always series one, so two charts of the same data agree.

The shipped defaults come from the accessibility audit rather than from taste. **Success is a teal and not a green.** Red-green colour blindness removes hue, so a green and a red at one lightness become the same olive. Simulated at full severity, a 148° green and a 30° red both come out around #5a5020. Moving the success band from 130–165 to 196–222 took the audit from 3.22 failures per generated palette to 2.15.

**The status roles then sit on different ramp steps, so lightness separates them** whatever their hues do. That is the only lever the ramp leaves, and it is why perturbing a status seed cannot collide anything. "Do these read as one colour" needs hue **and** lightness: a ratio measures lightness alone, so two roles one step apart always read about 1:1 whatever their hue.

The same rule set moved the default warning off yellow. A hue cannot hold chroma at any lightness you please: sRGB holds 0.073 chroma at hue 77 at L 0.35 against 0.167 at L 0.80, so a yellow asked to sit mid-dark comes out brown. The default warning is an amber that sits where its own hue is strong.

### Roles

**32 semantic roles** in 5 groups: Surfaces, Text, Borders, Accent and Status. Each one maps to a scale step per mode. The exported file leads with these. `surface-raised` tells an agent how to build a card. `neutral-800` does not.

- **Themes this system ships** sits at the top: Light only, Dark only, or Light and dark. It decides what gets **emitted**. A dark-only document publishes one palette in `tokens.css`, ships its examples in that theme, carries no toggle for a reader to wire up, and tells the agent not to invent the other palette to fill one. It used to be two controls that could disagree, and the pair could not say "dark only" at all.
- **Editing** is the control below it, and it is a different question: which values you are working on now. Light only, Dark only or Both. One mode at a time gets the full width. That is what you want when a theme reads well in dark and badly in light.
- **Generate the opposite mode** by mirroring the scale position of each role.
- **Contrast**: a free-form checker for any two roles, plus **22 fixed pairs** with WCAG ratios and APCA Lc. A test enforces that the shipped palette passes its own checks in both modes, and that each role's worst ground is in the list rather than its best.
- **The row planes** are three roles, not one: the stripe carries the rhythm, the hover is transient feedback, and the selection is a state. They sit in that order, each one further off the surface than the last, and the audit checks the order rather than pinning a ratio.
- **The selection treatment** is a choice of three — a tint, a lightness step, or a step plus an accent bar — with three edge weights. The padding is stated as a sum of the inset and the bar, so changing the weight moves the label with it.

### Type

- The full **Google Fonts library**, proxied and cached through the Worker, with no API key. The app windows the list. Each family loads lazily, and every row previews in its own face.
- **Variable-axis sliders** built from the metadata inside each font, plus **8** OpenType feature toggles.
- A modular scale with **8 named ratios**, generating **14 text styles**. Line height and tracking follow curves derived from the resulting size. Leading tightens and tracking goes negative as type grows, so the scale stays optically consistent and not merely arithmetically consistent.
- Optional fluid `clamp()` sizing, and a per-token override on any field.

A type role is one class, carrying family, size, weight, leading and tracking together. Splitting them is how an `h3` ends up rendering h5's size on h3's leading, and how a published value never reaches the screen.

### Layout

Spacing scale from a base unit, **6 breakpoints** with container widths, grid columns and gutter, and a maximum measure in `ch`. These breakpoints drive the preview width control, so a number you set becomes a layout you can look at.

The scale starts at **xs / 320px** on purpose. WCAG 1.4.10 asks the layout to survive a 320px viewport. That is a 1280px window at 400% zoom, not a phone. A scale that starts at 640 never names that width, which leaves an agent to invent one.

### Shape

Radius scale, border widths and the radius nesting rule. Icon library with stroke width, size scale and an icon-to-label gap token. A focus-ring spec with a live sample. Generated UI omits focus rings more often than any other detail.

### Depth

Elevation strategy: **shadow, border or tonal**. Layered two-part shadows take their tint from the neutral scale rather than from pure black. Scrim colour, opacity and blur are editable, with blend modes for overlays and fills. Borders and shadows have no CSS blend equivalent. The panel says so instead of offering a control that does nothing.

**Nine stacking layers** ship from here too, and they read as a sequence: a card lifts, a header sticks, a menu opens, a scrim covers, a dialog sits on the scrim, a picker clears the dialog, a toast clears everything, and a tooltip is last. The step leaves room to slot one in without renumbering. Nothing published a stacking order before, so this codebase itself had 29 `z-index` declarations at 18 distinct values, and 2001 was among them. None of those was a decision. The names do the work: a builder reaching for "above a modal" finds `popover` instead of adding a thousand.

### Motion

Duration scale, 125 / 250 / 500ms by default. Three personality presets. A **draggable cubic-bezier editor** with playback, and a reduced-motion policy.

### Components

**28 components** in 8 groups — Actions, Forms, Surfaces, Feedback, Overlays, Data, Navigation and Charts. They expand to **74 flattened entries** across **17 variants**, **3 sizes** and **8 interaction states**, named the way the spec expects, such as `button-primary-hover`.

Twelve of the 28 are chart types, because a chart is mostly furniture and no token stated an axis weight, a gridline colour, a bar gap, a line stroke, a marker size or an area fill. A builder charting anything invented all six.

Every entry shows a **live sample** of itself beside its properties. The sample is inert and updates as you type. A modal or a table takes the full width above its controls. Everything else sits alongside, so the sample stays in view while you drag a slider.

**Composition** is separate from appearance and sits next to the component it governs. **5 components** have one: modal, alert, input, chart and table. A modal's covers alignment, icon placement, icon size, icon treatment, the title-to-body gap, the action arrangement and the close control. The surface re-renders as you change them. None of this fits the eight component properties in the spec, so it leaves as a settings table plus imperative rules. Elevation and motion take the same route. A setting that stops applying, such as icon size when there is no icon, disappears from both the panel and the file.

**Each component states which keys it answers to.** 28 contracts, 13 with keys of their own and 15 declaring none. The source is the ARIA Authoring Practices Guide, so nothing is invented, and an entry that says `none` is a decision rather than an oversight. Two rules run under all of it: a composite widget is one tab stop, and Space is not Enter.

- Each card has a **search** that matches entry names, property keys and values.
- Property fields offer token pickers scoped to the property type, with resolved previews: swatches for colours, computed px for dimensions, a bar for gradients.
- The app flags properties outside the legal eight and routes them to prose.

### Directives

Style references, a **19-item anti-pattern checklist**, target framework and copy conventions. Per unit of effort, this panel changes agent output more than any other. Models follow negative constraints more reliably than any other instruction type.

### Rationale

The **8 prose sections**. The app appends generated tables for you, so you write only the reasoning. The AI lives here.

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
| Every text role against every ground it can paint on, and every line role too | 1.4.3 (AA) |
| A hairline within a hair of the thing it divides | practice |
| The three row planes in order, each far enough off the surface | practice |
| A fill that reads as its own ground | 1.4.11 (AA) |
| Focus indicator present, thick enough, legible against both adjacent colours | 2.4.7, 2.4.11, 2.4.13 |
| Target size, with the spacing exception applied when the system declares a minimum | 2.5.8 (AA), 2.5.5 (AAA) |
| Reflow: a breakpoint scale that never names 320px, containers wider than their viewport | 1.4.10 (AA) |
| A heading scale that contradicts the outline, such as h3 larger than h2 | 1.3.1 (A) |
| Body size, line height, tracking and measure | 1.4.12 (AA), 1.4.8 (AAA) |
| Reduced-motion policy and long durations | 2.2.2 (A), 2.3.3 (AAA) |
| Colour independence, by simulating deuteranopia and protanopia | 1.4.1 (A) |
| A palette too flat to tell apart once hue is gone | 1.4.1 (A) |
| Disabled text legibility, which WCAG exempts and users still have to read | practice |

Every check runs against the derived tokens, which are the same values the preview renders and the file exports. A pass therefore states something about what ships, not about intent. Findings are advice and not gates. A system that fails the 44px target on purpose, because it is a dense data tool for mouse users, is a legitimate system. Failing it without knowing is not.

**A repair shows its arithmetic before it moves anything.** Fix it opens a preview with the failure count before and after, because a remedy that clears the finding you opened and raises the total is worse than no button at all. If nothing in the candidate list lowers the total, the app offers nothing and says why.

**Twelve requirements ship inside the exported file**. Six of them are checkable here. The other six cover semantic elements, label association, DOM order, focus restoration, live regions and alt text. Those are about markup, and nothing in a token file predicts them.

The `REQUIREMENTS` table records which is which. A green badge that means "unmeasured" is how systems ship inaccessible. All twelve go into `DESIGN.md` anyway. The agent writing the markup is the only party who can satisfy the unchecked half.

The default document raises **zero findings**. A default that fails your own checker teaches people to ignore the checker.

---

## Preview

**Twelve surfaces**, with a light and dark toggle: Dashboard, Record, Index, Shell, Landing, Pricing, Form, Settings, Empty, Charts, Overlays and Gallery. The **555 CSS custom properties** from `derive()` style all of it, so no second set of values exists for the preview to drift toward.

Six of those exist because a rule with no rendered instance is the one that rots.

| Surface | The situation nothing else showed |
| --- | --- |
| Record | A long page title, so a wrapped heading and the controls beside it have somewhere to be |
| Index | A list you work in: search, narrow, select, act, page |
| Shell | Chrome rather than a document, which is where a title bar, a tab strip and a stat tile live |
| Pricing | The one shape that must not scroll sideways, and a highlighted column marked without a fill |
| Empty | Four states, not one: first run, no results, failure and loading |
| Charts | The only rendered instance of an axis, a gridline and a zero line, and the two chart scales nothing painted |

**Click anything to jump to its definition**. Clicks resolve innermost first, so a button inside a card is the button. The card is still offered, because a click also collects what its containers answer to. A run of text opens into its font and its colour, which live on different tabs. The target opens, scrolls into view and highlights. Alt-click interacts with the control instead.

**Responsive widths** come from the breakpoints this document declares, not from a generic set of phone sizes. The control therefore tests your own system and not a generic one. The surfaces respond through **container queries**. The viewport never changes when a pane narrows, and a media query would sit there reporting 1280px while the surface renders at 400.

---

## Saving and Sharing

Three destinations, and they answer different questions.

| Action | Writes | For |
| --- | --- | --- |
| Save | `name-YYYYMMDD-HHMM.mdexed.json` on your device | Reopening it here later |
| Save to Cloud | A project at `/p/:id`, then a share link | Another machine, or another person |
| Export Payload | A zip of 36 files | Handing the system to an agent or a developer |

**Save does not write a `DESIGN.md`, and that is deliberate.** The spec allows a component exactly eight properties and has no way to record that a button has variants and sizes. Saving to that format dropped eight property kinds and flattened the component matrix into rows you could no longer edit as a matrix. `DESIGN.md` is a handoff format. The project file is a save format, it holds the editor's own state and no derived values, so a later change to the generators reaches an old save.

**Save to Cloud** creates the project, puts the id in the URL, and keeps the edit token in this browser. Autosave then patches it, with a longer debounce than a local write. Open the link on a machine that has no token and the document is read-only, which the badge says in words. If the cloud copy moved since you loaded yours, the badge reads Conflict and nothing overwrites anything.

The status badge is a readout and not a control: On this device, Saving, In the cloud, Read-only, Conflict, Sync failed, Offline. It used to be a bordered pill that looked like every button beside it, so the obvious move was to click it.

**The previous document is always reachable.** Every session auto-saves to this browser, a restore offer appears on the next visit, and **Load → Restore previous** in the Project menu picks it up after that offer has gone.

---

## Exports

**Export Payload** writes one zip. For a two-theme document that is **36 files**: 12 text files, plus every surface in every theme you ship.

| File | Carries |
| --- | --- |
| `DESIGN.md` | The rules, the reasoning and every generated table |
| `AGENTS.md` | The contract, and the reading order for everything else |
| `CLAUDE.md` | The same contract under the name that agent reads |
| `README.md` | What the package is, for a person opening the folder |
| `tokens.css` | Both themes as custom properties, switched by `data-theme` |
| `_tokens.scss` | The same values as Sass variables |
| `tokens.ts` | The same values, typed |
| `tokens.json` | W3C Design Tokens format |
| `tailwind.config.js` | A v3 preset pointing at the custom properties |
| `tailwind.css` | v4, as `@theme` |
| `VERIFY.mjs` | 30 checks over the files the agent wrote, in Node |
| `VERIFY-BROWSER.js` | 79 checks over the page it built, in the browser |
| `EXAMPLE-<theme>-<surface>.html` | Each surface as a standalone page |

The token files exist because a `DESIGN.md` is advisory. It tells an agent what to do, and nothing checks whether it did. The Tailwind preset points its colours at those properties rather than at hex, so `bg-surface` works in both themes with no `dark:` variant anywhere.

**The two verifiers are the part that closes the loop.** One rule list feeds the checklist in `AGENTS.md` and both files, so a rule cannot be worded one way for the reader and coded another way for the tool.

```bash
node VERIFY.mjs ./src
```

Then paste `VERIFY-BROWSER.js` into the console on the page you built and call `await verify()`. If that page *hosts* your document rather than being it, pass the element carrying the tokens — `await verify('.my-document-root')` — and everything outside it is left alone. Run it at every breakpoint the system publishes and at the midpoint between each adjacent pair, because a fault lives where the layout changes and no declared width sits inside that band.

30 checks run in Node over the source: a literal colour, an invented number, a token that exists nowhere. 79 run in the browser over the rendered page: baselines, cap bands, target sizes, proximity ratios, a dead class, a chart with no accessible name. 6 remain as checklist lines, each stating why no program can ask it.

**A check the document does not ship is not enforced.** A light-only package carries **28** source checks and **78** render checks, because three of them are about a theme toggle its own `DESIGN.md` forbids. An earlier version failed a compliant build for obeying the file.

Every render check has been broken on purpose on a fixture page, and a guard refuses a record that rots. A check nobody has seen fire is a check that went quiet the day its selector stopped matching.

The HTML examples carry the same stylesheet the preview uses, container queries included. A developer opens the same page you saw. Every value sits in a `:root` block rather than baked into rules.

A default document emits about **175 kB** of `DESIGN.md`. It opens with a map of itself, computed from the assembled text rather than written by hand: **29,900 words** across **10 sections**, which of them are read in full, which are looked up as you build, and what share of the file each one is. **Components is 58%** of it and a lookup table. A reader who does not know that reads it linearly, or gives up inside it.

### Import Reference

This is the way back in. Hand it a `DESIGN.md` and it opens as a document, replacing what you have. Hand it a **stylesheet** and it works out which of your seeds each thing in the file belongs to. It shows you the mapping before it applies anything.

Two sources of signal, in this order.

1. **The name.** `--color-brand-primary` is somebody stating an intent, so a named match wins outright. The mapper knows that `--primary` beats `--primary-hover`, and that `--blue-500` is the base of its ramp while `--blue-50` is an end.
2. **The colour itself**. A stylesheet with no custom properties still has hue. The most saturated colour is usually the brand. The grey nearest mid-lightness makes the best neutral. A colour sitting at 145° in OKLCH is a green under any name.

The mapping arrives as a table with columns Seed, Type, Slug, Source, Match and Value. There is one row per slot, grouped into Colours, Type and Measurements. Every row says whether the match came **by name** or **inferred**. Hover the chip to read why. Re-point any row at a different colour from the file, or switch it off.

Anything you switch off keeps its current value and stays consistent with everything derived from it. The app blanks nothing, so no holes remain for an agent to guess its way out of.

---

## Feeding It to an Agent

Four parts of the payload do different jobs. An agent needs all of them, for different reasons.

**`AGENTS.md` is the way in.** It states the reading order, ranks the files, and carries the checklist. Point the agent at the folder and tell it to read this first. Do not summarise the package in your own prompt: a fresh reader who cannot find the way in from the directory alone has found a defect, and a summary hides it.

**`DESIGN.md` carries the rules and the reasoning.** Put it at the root of the project. Most agents read a root `DESIGN.md` on their own. Only this file says *why* you hold the accent back for one thing. Only this file states a rule that no value can express.

**`tokens.css` carries the values.** Import it in the app. A build can check this part. It also stops an agent inventing a hex that is nearly yours.

**The `EXAMPLE-*.html` pages carry the arrangement.** A rule says text on one line shares a baseline. The example shows a row that does. An agent imitates working markup more readily than it follows a sentence. The examples settle what prose alone leaves open.

### Wire It In Once

Referencing the file per prompt works and then stops working, because the reference falls out of context. Put it in whatever file your agent reads every session, such as `CLAUDE.md`, `AGENTS.md` or `.cursorrules`:

```
Follow DESIGN.md at the repo root, and use the tokens in tokens.css.
Never introduce a colour, size, radius or spacing value that is not defined there.
When the arrangement of a row or a component is unclear, read the EXAMPLE pages.
Run VERIFY.mjs before you tell me a screen is done.
```

### Which File Answers Which Question

| Question | Read |
| --- | --- |
| Where do I start | `AGENTS.md` |
| What is this value | `tokens.css`, or `tokens.json` for tooling |
| Why is it that value | The prose sections of `DESIGN.md` |
| What am I forbidden to do | Do's and Don'ts in `DESIGN.md` |
| What does a component look like in every state | The component tables in `DESIGN.md` |
| Which keys does this component answer to | The keyboard table in `DESIGN.md` |
| How does a row go together | The `EXAMPLE-*.html` pages |
| Did I get it right | `VERIFY.mjs`, then `VERIFY-BROWSER.js` |

### When the Agent Drifts

That section is a short list of explicit "never" statements. Name the one it broke rather than describing the problem again. Naming it costs you a line, and it lands harder than a fresh explanation, because the agent can go and read the rule.

Drift usually means the rule was never in context. Check that first. Then run the verifiers, which is cheaper than reading a diff and finds the class rather than the instance.

### Re-export After Changes

The exported file is a snapshot and does not follow the editor. Every file in the zip carries the same build stamp. That tells you whether an agent holds the current system or an older one.

---

## Editor Chrome

The **UI** menu configures the tool and not the design. Nothing here reaches the exported file.

- **Theme**, light or dark, with a **Brightness** slider. Text moves with the surfaces, so dimming reads as a lower lamp rather than as grey ink. The range never falls below AA.
- **UI Scale**, 75–150%, in 12.5% steps. The chrome uses absolute pixels. That is what makes a dense tool legible at one size, and also fixes it at one size. This scales all of it.
- **Preview Scale**, with a **Link to UI Scale** checkbox that is off by default. That default is the point. The editor is a tool and can be as large as your eyes want. The preview is the thing under judgement. "Is 14px body text too small" has no answer if the app quietly grew it to 21. Unlinked, a 375px responsive preview is 375 real pixels whatever the chrome does.
- **UI Hue** rotates every neutral in the chrome at its own saturation and lightness. The tonal structure stays untouched and only the cast changes. Semantic colours stay out of it. A hue slider that also turned the error colour green would be a different feature.
- **UI Animation** governs every transition the editor makes. This is not the Motion tab. That one defines the durations for your design system. This one defines the durations for the editor. Content that swaps **cross-dissolves** rather than cutting: editor tabs, preview surfaces, the light/dark toggle, the model tabs in the picker. Set it to 0 and every swap happens at once.

The chrome obeys the rules it teaches. Its own accent is measured against every ground it paints on, its status colours are measured on washes of themselves, and a guard fails the commit when one of them stops clearing its bar. The header folds by a measured ladder rather than at a round number, and each threshold ships as a sum of the widths it came from.

Toasts obey the animation setting and withdraw on their own. Notices go after ten seconds, and hover pauses the clock. The restore offer goes after thirty, and **Load → Restore previous** is the route after that. Tab-strip chevrons scroll while you hover them and accelerate from a standstill over about 180ms. A strip is a queue you look through, and one click per 160px is the interaction equivalent of a stuck key. The app honours `prefers-reduced-motion` throughout.

---

## Spec Conformance

The DESIGN.md frontmatter schema is deliberately narrow. **Ten allowed keys**: `version`, `name`, `description`, `theme`, `omitted`, `colors`, `typography`, `rounded`, `spacing` and `components`. Component entries accept **eight properties**: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height` and `width`. Variants and states flatten into hyphenated names.

**Nine systems have no slot in that schema**: elevation, motion, gradients, breakpoints, icons, focus rings, stacking order, chart palettes and accessibility. MDexed emits them as tables inside the standard markdown sections rather than inventing frontmatter keys. The file stays valid for any consumer. In practice an agent pays more attention to a `## Elevation & Depth` section than to an unrecognised YAML key. A gradient cannot be a `colors` token at all, because a gradient is a CSS image and not a colour value.

An entry whose every property sits outside the legal eight has no frontmatter entry either. The file says so by name, because absence from the frontmatter never means unstyled.

Generated tables sit inside `<!-- design.md:generated -->` comments. A renderer hides them, and import strips them precisely, so a re-import never pastes them into prose you wrote.

The app checks every export before it leaves.

---

## AI Assistance

Optional, and off until you configure a key. It stays inside the Rationale tab. It writes prose and never tokens.

**Two actions per section.** *Refine* tightens what you wrote. *Draft from tokens* writes the section from the values it governs. Both send the real token facts for that section. Colors gets the semantic roles. Typography gets the generated scale. Do's and Don'ts gets the active anti-patterns. The model therefore describes what the file says instead of guessing. The prompt asks for imperative guidance and forbids invented token names or values.

**Nothing applies until you accept it**. The result streams into a review card with a word-level diff. Additions show green, deletions show struck through, with a `+n −n` count and a toggle to read the new version plain. Accept, Discard or Regenerate. Accepting logs as *AI rewrite · Rationale · \<section\>*, so History separates prose you typed from prose you accepted, and undo still reverses it.

**The key is a Worker secret and never reaches the browser**. Every call goes through `/api/v1/ai/*`, and the built client bundle carries no credential. Without a key the panel shows setup instructions rather than an error, and the two buttons do not render.

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

For local work, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`, which git ignores, and fill it in. Wrangler reads it at startup, so restart the dev server afterwards.

The app offers **free** models only. The catalogue is public, so `GET /api/v1/ai/models` needs no key. It filters to zero-cost text models, sorts by context length and caches for an hour. Free tiers are rate-limited, so a 429 comes back as "try another, or wait a moment" rather than as a stack trace. Your model choice persists, and the app re-checks it against the list, because free models come and go without notice.

---

## Every Number Here Is Checked

The last version of this file said 28 roles where the app had 32, 14 components where it had 28, and 25 kB of `DESIGN.md` where it emits 175. A number in a document goes stale silently, and a reader has no way to tell which ones did.

So `apps/web/tools/readme-facts-guard.mjs` reads every figure stated above out of this file, computes the same figure from the modules that ship, and fails the commit when the two disagree. It runs inside `npm run check` and in the pre-commit hook.
