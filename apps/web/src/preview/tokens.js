/* The bridge between derived tokens and rendered UI.

   Everything in the preview is styled by this one stylesheet, and it reads
   nothing but the custom properties `derive()` produces. That's what makes the
   preview trustworthy: there is no second set of values it could drift toward.
   Every var() carries a fallback so renaming a token degrades the preview
   instead of collapsing it. */

/** Derived vars → a React inline-style object (React passes `--x` through). */
export const varsToStyle = vars => ({ ...vars })

const c = (name, fallback) => `var(--c-${name}, ${fallback})`
const sp = (name, fallback) => `var(--space-${name}, ${fallback})`
const rd = (name, fallback) => `var(--radius-${name}, ${fallback})`
const ft = (name, prop, fallback) => `var(--font-${name}-${prop}, ${fallback})`

/* Component-matrix override, falling back to the raw scale. Editing a
   component in the Components tab lands here, so the preview moves with it. */
const cm = (entry, prop, fallback) => `var(--cmp-${entry}-${prop}, ${fallback})`

export const PREVIEW_CSS = `
.dmd {
  background: ${c('bg', '#fff')};
  color: ${c('text', '#111')};
  font-family: ${ft('body-md', 'family', 'system-ui, sans-serif')};
  font-size: ${ft('body-md', 'size', '16px')};
  line-height: ${ft('body-md', 'leading', '1.6')};
  min-height: 100%;
  padding: ${sp('lg', '32px')};
  transition: background var(--duration-normal, 200ms) var(--ease-standard, ease);
}
.dmd *, .dmd *::before, .dmd *::after { box-sizing: border-box; }
/* Form controls don't inherit the font in any browser, so anything without an
   explicit rule — an icon button, a bare select — silently renders in the UA
   default and makes the preview lie about the chosen typeface. Low specificity
   so the component rules below still win where they set a family. */
.dmd button, .dmd input, .dmd textarea, .dmd select, .dmd optgroup { font-family: inherit; }
/* Inspectable elements get their cursor from here rather than from an inline
   style, which would overwrite the styles the element already carries. */
.dmd [data-cmp] { cursor: pointer; }
/* Disabled controls swallow pointer events entirely, so a click on one never
   reaches the wrapper that knows where to send you. In the preview nothing is
   really interactive anyway — the click is for inspection. */
.dmd [disabled], .dmd .is-disabled { pointer-events: none; }
.dmd [data-cmp] [disabled], .dmd [data-cmp] .is-disabled { pointer-events: none; }
.dmd h1, .dmd h2, .dmd h3 { margin: 0; }
.dmd h1 { font-family: ${ft('h1', 'family', 'inherit')}; font-size: ${ft('h1', 'size', '48px')}; font-weight: ${ft('h1', 'weight', '700')}; line-height: ${ft('h1', 'leading', '1.1')}; letter-spacing: ${ft('h1', 'tracking', 'normal')}; }
.dmd h2 { font-family: ${ft('h2', 'family', 'inherit')}; font-size: ${ft('h2', 'size', '32px')}; font-weight: ${ft('h2', 'weight', '700')}; line-height: ${ft('h2', 'leading', '1.2')}; letter-spacing: ${ft('h2', 'tracking', 'normal')}; }
.dmd h3 { font-family: ${ft('h3', 'family', 'inherit')}; font-size: ${ft('h3', 'size', '24px')}; font-weight: ${ft('h3', 'weight', '600')}; line-height: ${ft('h3', 'leading', '1.3')}; letter-spacing: ${ft('h3', 'tracking', 'normal')}; }
.dmd p { margin: 0; }
.dmd .muted { color: ${c('text-muted', '#666')}; }
.dmd .subtle { color: ${c('text-subtle', '#999')}; }
.dmd .small { font-size: ${ft('body-sm', 'size', '14px')}; line-height: ${ft('body-sm', 'leading', '1.55')}; }
.dmd .caption { font-size: ${ft('caption', 'size', '12px')}; letter-spacing: ${ft('caption', 'tracking', 'normal')}; color: ${c('text-muted', '#666')}; }

/* ── Surfaces ── */
.dmd .card {
  background-color: ${cm('card', 'background-color', c('surface', '#fff'))};
  background-image: ${cm('card', 'background-image', 'none')};
  border: 1px solid ${cm('card', 'border-color', c('border-subtle', '#eee'))};
  border-radius: ${cm('card', 'rounded', rd('lg', '16px'))};
  padding: ${cm('card', 'padding', sp('md', '16px'))};
  box-shadow: ${cm('card', 'box-shadow', 'var(--shadow-raised, none)')};
}
.dmd .card-flat { box-shadow: ${cm('card-flat', 'box-shadow', 'none')}; }
.dmd .card-overlay {
  box-shadow: ${cm('card-overlay', 'box-shadow', 'var(--shadow-overlay, none)')};
  background: ${cm('card-overlay', 'background-color', c('surface-raised', '#fff'))};
}
.dmd .well {
  background: ${c('surface-sunken', '#f4f4f4')};
  border-radius: ${rd('md', '8px')};
  padding: ${sp('md', '16px')};
}

/* ── Buttons ── */
.dmd .btn {
  font-family: ${cm('button', 'font-family', 'inherit')};
  font-size: ${cm('button', 'font-size', ft('body-sm', 'size', '14px'))};
  font-weight: ${cm('button', 'font-weight', '500')};
  letter-spacing: ${cm('button', 'tracking', 'normal')};
  display: inline-flex; align-items: center; justify-content: center;
  gap: ${cm('button', 'gap', 'var(--icon-gap, 8px)')};
  height: ${cm('button-md', 'height', 'auto')};
  padding: ${cm('button-md', 'padding', `0 ${sp('md', '16px')}`)};
  border-radius: ${cm('button', 'rounded', rd('md', '8px'))};
  border: 1px solid transparent;
  cursor: pointer;
  transition: background var(--duration-fast, 120ms) var(--ease-standard, ease),
              border-color var(--duration-fast, 120ms) var(--ease-standard, ease),
              color var(--duration-fast, 120ms) var(--ease-standard, ease);
}
.dmd .btn:focus-visible {
  outline: var(--focus-width, 2px) var(--focus-style, solid) ${c('ring', '#4f6ef7')};
  outline-offset: var(--focus-offset, 2px);
}
/* Filled elements carry the fill blend mode; borders and shadows never do —
   CSS has no equivalent for those. */
.dmd .btn-primary {
  background-color: ${cm('button-primary', 'background-color', c('accent', '#b8422e'))};
  background-image: ${cm('button-primary', 'background-image', 'none')};
  color: ${cm('button-primary', 'text-color', c('accent-fg', '#fff'))};
  border-color: ${cm('button-primary', 'border-color', 'transparent')};
  mix-blend-mode: var(--fill-blend, normal);
}
.dmd .btn-danger, .dmd .badge-accent, .dmd .badge-success,
.dmd .badge-warning, .dmd .badge-danger, .dmd .bar > span, .dmd .avatar {
  mix-blend-mode: var(--fill-blend, normal);
}
.dmd .btn-primary:hover, .dmd .btn-primary.is-hover { background: ${cm('button-primary-hover', 'background-color', c('accent-hover', '#9c3726'))}; }
.dmd .btn-primary:active, .dmd .btn-primary.is-active { background: ${cm('button-primary-active', 'background-color', c('accent-active', '#7f2c1e'))}; }
.dmd .btn-secondary {
  background: ${cm('button-secondary', 'background-color', c('surface', '#fff'))};
  color: ${cm('button-secondary', 'text-color', c('text', '#111'))};
  border-color: ${cm('button-secondary', 'border-color', c('border', '#ccc'))};
}
.dmd .btn-secondary:hover, .dmd .btn-secondary.is-hover { background: ${cm('button-secondary-hover', 'background-color', c('bg-subtle', '#f4f4f4'))}; border-color: ${c('border-strong', '#aaa')}; }
.dmd .btn-ghost {
  background: ${cm('button-ghost', 'background-color', 'transparent')};
  color: ${cm('button-ghost', 'text-color', c('text-muted', '#666'))};
}
.dmd .btn-ghost:hover, .dmd .btn-ghost.is-hover {
  background: ${cm('button-ghost-hover', 'background-color', c('accent-subtle', '#f6e9e6'))};
  color: ${cm('button-ghost-hover', 'text-color', c('accent', '#b8422e'))};
}
.dmd .btn-danger {
  background: ${cm('button-danger', 'background-color', c('danger', '#c2453c'))};
  color: ${cm('button-danger', 'text-color', c('danger-fg', '#fff'))};
}
.dmd .btn[disabled], .dmd .btn.is-disabled {
  opacity: ${cm('button-primary-disabled', 'opacity', '.5')}; cursor: not-allowed; pointer-events: none;
}
.dmd .btn-sm {
  height: ${cm('button-sm', 'height', 'auto')};
  padding: ${cm('button-sm', 'padding', `0 ${sp('xs', '8px')}`)};
  font-size: ${cm('button-sm', 'font-size', ft('caption', 'size', '12px'))};
  gap: ${cm('button-sm', 'gap', cm('button', 'gap', 'var(--icon-gap, 8px)'))};
}
.dmd .btn-lg {
  height: ${cm('button-lg', 'height', 'auto')};
  padding: ${cm('button-lg', 'padding', `0 ${sp('lg', '24px')}`)};
  font-size: ${cm('button-lg', 'font-size', ft('body-md', 'size', '16px'))};
  gap: ${cm('button-lg', 'gap', cm('button', 'gap', 'var(--icon-gap, 8px)'))};
}

/* ── Form controls ── */
.dmd .field { display: flex; flex-direction: column; gap: ${sp('xs', '4px')}; }
.dmd .label { font-size: ${ft('caption', 'size', '12px')}; font-weight: 500; color: ${c('text-muted', '#666')}; }
.dmd .input {
  font-family: ${cm('input', 'font-family', 'inherit')};
  font-size: ${cm('input', 'font-size', ft('body-sm', 'size', '14px'))};
  width: 100%;
  height: ${cm('input', 'height', 'auto')};
  padding: ${cm('input', 'padding', `${sp('xs', '8px')} ${sp('sm', '12px')}`)};
  background: ${cm('input', 'background-color', c('surface', '#fff'))};
  color: ${cm('input', 'text-color', c('text', '#111'))};
  border: 1px solid ${cm('input', 'border-color', c('border', '#ccc'))};
  border-radius: ${cm('input', 'rounded', rd('md', '8px'))};
  transition: border-color var(--duration-fast, 120ms) var(--ease-standard, ease);
}
/* A textarea has its own entry, and no fixed height. */
.dmd textarea.input {
  height: auto;
  min-height: ${cm('textarea', 'min-height', '88px')};
  padding: ${cm('textarea', 'padding', sp('xs', '8px'))};
  border-radius: ${cm('textarea', 'rounded', rd('md', '8px'))};
}
.dmd .input::placeholder { color: ${c('text-subtle', '#999')}; }
.dmd .input:focus {
  outline: none;
  border-color: ${cm('input-focus', 'border-color', c('ring', '#4f6ef7'))};
  box-shadow: 0 0 0 3px color-mix(in srgb, ${c('ring', '#4f6ef7')} 25%, transparent);
}
.dmd .input.is-invalid { border-color: ${cm('input-invalid', 'border-color', c('danger', '#c2453c'))}; }
.dmd .input[disabled] {
  background: ${cm('input-disabled', 'background-color', c('surface-sunken', '#f4f4f4'))};
  color: ${cm('input-disabled', 'text-color', c('text-subtle', '#999'))};
  cursor: not-allowed;
}

/* ── Badges & status ── */
.dmd .badge {
  display: inline-flex; align-items: center;
  padding: ${cm('badge', 'padding', `2px ${sp('xs', '8px')}`)};
  border-radius: ${cm('badge', 'rounded', rd('full', '9999px'))};
  font-size: ${cm('badge', 'font-size', ft('caption', 'size', '12px'))};
  font-weight: 500;
}
.dmd .badge-accent  { background: ${cm('badge-accent', 'background-color', c('accent-subtle', '#f6e9e6'))};  color: ${cm('badge-accent', 'text-color', c('accent', '#b8422e'))}; }
.dmd .badge-success { background: ${cm('badge-success', 'background-color', c('success-subtle', '#e6f2eb'))}; color: ${cm('badge-success', 'text-color', c('success', '#3f8f63'))}; }
.dmd .badge-warning { background: ${cm('badge-warning', 'background-color', c('warning-subtle', '#f7efe0'))}; color: ${cm('badge-warning', 'text-color', c('warning', '#c08a2e'))}; }
.dmd .badge-danger  { background: ${cm('badge-danger', 'background-color', c('danger-subtle', '#f7e8e7'))};  color: ${cm('badge-danger', 'text-color', c('danger', '#c2453c'))}; }
.dmd .badge-neutral { background: ${cm('badge-neutral', 'background-color', c('bg-subtle', '#f0f0f0'))};      color: ${cm('badge-neutral', 'text-color', c('text-muted', '#666'))}; }

/* ── Alerts ──
   Anything beside a block of text — the icon, a trailing action — is centred
   on the *first line*, not on the block and not on the padding box. Those two
   look identical while the message fits on one line and fall apart the moment
   it wraps: centring on the block drifts the icon downward as lines are added,
   and flex-start pins it to the cap height instead of the line's optical
   middle.

   The --line-box property is one line of the alert's own text: 1em resolves
   against the alert's font-size, multiplied by its leading. Slots are fixed to
   exactly that height and centre their contents, so an element taller than a
   line — a button — overflows the slot symmetrically and still reads as
   centred on line one.

   (No backticks in this comment: it lives inside a template literal, and one
   stray backtick ends the string and turns the CSS below into JavaScript.) */
.dmd .alert {
  --line-box: calc(1em * ${ft('body-sm', 'leading', '1.55')});
  display: flex;
  align-items: flex-start;
  gap: var(--icon-gap, 8px);
  background-color: ${cm('alert', 'background-color', c('bg-subtle', '#f4f4f4'))};
  color: ${cm('alert', 'text-color', c('text', '#111'))};
  border: 1px solid currentColor;
  border-radius: ${cm('alert', 'rounded', rd('md', '8px'))};
  padding: ${cm('alert', 'padding', `${sp('xs', '8px')} ${sp('sm', '12px')}`)};
  font-size: ${cm('alert', 'font-size', ft('body-sm', 'size', '14px'))};
  line-height: ${ft('body-sm', 'leading', '1.55')};
}
.dmd .alert > .icon,
.dmd .alert > .alert-action {
  height: var(--line-box);
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.dmd .alert > .alert-body { flex: 1; min-width: 0; }
.dmd .alert-success { background-color: ${cm('alert-success', 'background-color', c('success-subtle', '#e6f2eb'))}; color: ${cm('alert-success', 'text-color', c('success', '#3f8f63'))}; }
.dmd .alert-warning { background-color: ${cm('alert-warning', 'background-color', c('warning-subtle', '#f7efe0'))}; color: ${cm('alert-warning', 'text-color', c('warning', '#c08a2e'))}; }
.dmd .alert-danger  { background-color: ${cm('alert-danger', 'background-color', c('danger-subtle', '#f7e8e7'))};  color: ${cm('alert-danger', 'text-color', c('danger', '#c2453c'))}; }

/* ── Structure ── */
/* Icon + label pairings, wherever they appear. One gap token governs them all. */
.dmd .with-icon { display: inline-flex; align-items: center; gap: var(--icon-gap, 8px); }
.dmd .icon { flex-shrink: 0; }
/* Per-component icon sizing overrides the global scale, so a small button can
   carry a smaller glyph than a large one. */
.dmd .btn .icon { width: ${cm('button-md', 'icon-size', cm('button', 'icon-size', 'var(--icon-md, 16px)'))}; height: ${cm('button-md', 'icon-size', cm('button', 'icon-size', 'var(--icon-md, 16px)'))}; }
.dmd .btn-sm .icon { width: ${cm('button-sm', 'icon-size', 'var(--icon-sm, 14px)')}; height: ${cm('button-sm', 'icon-size', 'var(--icon-sm, 14px)')}; }
.dmd .btn-lg .icon { width: ${cm('button-lg', 'icon-size', 'var(--icon-lg, 20px)')}; height: ${cm('button-lg', 'icon-size', 'var(--icon-lg, 20px)')}; }
.dmd .nav-item .icon { width: ${cm('nav-item', 'icon-size', 'var(--icon-md, 16px)')}; height: ${cm('nav-item', 'icon-size', 'var(--icon-md, 16px)')}; }
.dmd svg { stroke-width: var(--icon-stroke, 1.75); }
.dmd .icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: ${cm('button-md', 'height', '36px')}; height: ${cm('button-md', 'height', '36px')};
  padding: 0; border-radius: ${cm('button', 'rounded', rd('md', '8px'))};
  border: 1px solid transparent; cursor: pointer;
  background: ${c('surface', '#fff')}; color: ${c('text-muted', '#666')};
  border-color: ${c('border', '#ccc')};
  transition: background var(--duration-fast, 120ms) var(--ease-standard, ease);
}
.dmd .icon-btn:hover { background: ${c('bg-subtle', '#f4f4f4')}; color: ${c('text', '#111')}; }
.dmd .input-icon { position: relative; display: flex; align-items: center; }
.dmd .input-icon > svg { position: absolute; left: ${sp('sm', '12px')}; color: ${c('text-subtle', '#999')}; pointer-events: none; }
.dmd .input-icon > .input { padding-left: calc(${sp('sm', '12px')} + var(--icon-md, 16px) + var(--icon-gap, 8px)); }

.dmd .row { display: flex; align-items: center; gap: ${sp('xs', '8px')}; }
.dmd .stack { display: flex; flex-direction: column; gap: ${sp('md', '16px')}; }
.dmd .stack-sm { display: flex; flex-direction: column; gap: ${sp('sm', '8px')}; }
.dmd .grid { display: grid; gap: ${sp('md', '16px')}; }
.dmd .divider { height: 1px; background: ${c('border-subtle', '#eee')}; border: 0; margin: 0; }

.dmd .table { width: 100%; border-collapse: collapse; font-size: ${ft('body-sm', 'size', '14px')}; }
.dmd .table th {
  text-align: left; font-size: ${ft('caption', 'size', '12px')};
  text-transform: uppercase; letter-spacing: .06em;
  color: ${c('text-muted', '#666')}; font-weight: 500;
  padding: ${sp('sm', '8px')} 0; border-bottom: 1px solid ${c('border', '#ccc')};
}
.dmd .table td { padding: ${sp('sm', '8px')} 0; border-bottom: 1px solid ${c('border-subtle', '#eee')}; }

.dmd .avatar {
  width: ${cm('avatar', 'size', '32px')}; height: ${cm('avatar', 'size', '32px')};
  border-radius: ${cm('avatar', 'rounded', rd('full', '9999px'))};
  background: ${cm('avatar', 'background-color', c('accent-subtle', '#f6e9e6'))};
  color: ${cm('avatar', 'text-color', c('accent', '#b8422e'))};
  display: inline-flex; align-items: center; justify-content: center;
  font-size: ${cm('avatar', 'font-size', ft('caption', 'size', '12px'))}; font-weight: 600; flex-shrink: 0;
}
.dmd .bar { height: 6px; border-radius: ${rd('full', '9999px')}; background: ${c('bg-subtle', '#eee')}; overflow: hidden; }
.dmd .bar > span { display: block; height: 100%; background: ${c('accent', '#b8422e')}; border-radius: inherit; }
.dmd .nav-item {
  padding: ${cm('nav-item', 'padding', `${sp('xs', '8px')} ${sp('sm', '12px')}`)};
  border-radius: ${cm('nav-item', 'rounded', rd('md', '8px'))};
  color: ${cm('nav-item', 'text-color', c('text-muted', '#666'))};
  font-size: ${cm('nav-item', 'font-size', ft('body-sm', 'size', '14px'))};
  cursor: pointer;
  transition: background var(--duration-fast, 120ms) var(--ease-standard, ease);
}
.dmd .nav-item:hover { background: ${cm('nav-item-hover', 'background-color', c('bg-subtle', '#f4f4f4'))}; }
.dmd .nav-item.is-active {
  background: ${cm('nav-item-selected', 'background-color', c('accent-subtle', '#f6e9e6'))};
  color: ${cm('nav-item-selected', 'text-color', c('accent', '#b8422e'))};
  font-weight: 500;
}
`
