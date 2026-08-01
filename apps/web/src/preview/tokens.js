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
  background: ${c('surface', '#fff')};
  border: 1px solid ${c('border-subtle', '#eee')};
  border-radius: ${rd('lg', '16px')};
  padding: ${sp('md', '16px')};
  box-shadow: var(--shadow-raised, none);
}
.dmd .card-flat { box-shadow: none; }
.dmd .card-overlay { box-shadow: var(--shadow-overlay, none); background: ${c('surface-raised', '#fff')}; }
.dmd .well {
  background: ${c('surface-sunken', '#f4f4f4')};
  border-radius: ${rd('md', '8px')};
  padding: ${sp('md', '16px')};
}

/* ── Buttons ── */
.dmd .btn {
  font: inherit;
  font-size: ${ft('body-sm', 'size', '14px')};
  display: inline-flex; align-items: center; justify-content: center;
  gap: ${sp('sm', '8px')};
  padding: ${sp('sm', '8px')} ${sp('md', '16px')};
  border-radius: ${rd('md', '8px')};
  border: 1px solid transparent;
  cursor: pointer;
  transition: background var(--duration-fast, 120ms) var(--ease-standard, ease),
              border-color var(--duration-fast, 120ms) var(--ease-standard, ease),
              color var(--duration-fast, 120ms) var(--ease-standard, ease);
}
.dmd .btn:focus-visible { outline: 2px solid ${c('ring', '#4f6ef7')}; outline-offset: 2px; }
.dmd .btn-primary { background: ${c('accent', '#b8422e')}; color: ${c('accent-fg', '#fff')}; }
.dmd .btn-primary:hover, .dmd .btn-primary.is-hover { background: ${c('accent-hover', '#9c3726')}; }
.dmd .btn-primary:active, .dmd .btn-primary.is-active { background: ${c('accent-active', '#7f2c1e')}; }
.dmd .btn-secondary { background: ${c('surface', '#fff')}; color: ${c('text', '#111')}; border-color: ${c('border', '#ccc')}; }
.dmd .btn-secondary:hover, .dmd .btn-secondary.is-hover { background: ${c('bg-subtle', '#f4f4f4')}; border-color: ${c('border-strong', '#aaa')}; }
.dmd .btn-ghost { background: transparent; color: ${c('text-muted', '#666')}; }
.dmd .btn-ghost:hover, .dmd .btn-ghost.is-hover { background: ${c('accent-subtle', '#f6e9e6')}; color: ${c('accent', '#b8422e')}; }
.dmd .btn-danger { background: ${c('danger', '#c2453c')}; color: ${c('danger-fg', '#fff')}; }
.dmd .btn[disabled], .dmd .btn.is-disabled {
  opacity: .5; cursor: not-allowed; pointer-events: none;
}
.dmd .btn-sm { padding: calc(${sp('xs', '4px')} * 1.2) ${sp('sm', '8px')}; font-size: ${ft('caption', 'size', '12px')}; }
.dmd .btn-lg { padding: ${sp('md', '16px')} ${sp('lg', '32px')}; font-size: ${ft('body-md', 'size', '16px')}; }

/* ── Form controls ── */
.dmd .field { display: flex; flex-direction: column; gap: ${sp('xs', '4px')}; }
.dmd .label { font-size: ${ft('caption', 'size', '12px')}; font-weight: 500; color: ${c('text-muted', '#666')}; }
.dmd .input {
  font: inherit;
  font-size: ${ft('body-sm', 'size', '14px')};
  width: 100%;
  padding: ${sp('sm', '8px')} ${sp('md', '16px')};
  background: ${c('surface', '#fff')};
  color: ${c('text', '#111')};
  border: 1px solid ${c('border', '#ccc')};
  border-radius: ${rd('md', '8px')};
  transition: border-color var(--duration-fast, 120ms) var(--ease-standard, ease);
}
.dmd .input::placeholder { color: ${c('text-subtle', '#999')}; }
.dmd .input:focus { outline: none; border-color: ${c('ring', '#4f6ef7')}; box-shadow: 0 0 0 3px color-mix(in srgb, ${c('ring', '#4f6ef7')} 25%, transparent); }
.dmd .input.is-invalid { border-color: ${c('danger', '#c2453c')}; }
.dmd .input[disabled] { background: ${c('surface-sunken', '#f4f4f4')}; color: ${c('text-subtle', '#999')}; cursor: not-allowed; }

/* ── Badges & status ── */
.dmd .badge {
  display: inline-flex; align-items: center;
  padding: 2px ${sp('sm', '8px')};
  border-radius: ${rd('full', '9999px')};
  font-size: ${ft('caption', 'size', '12px')};
  font-weight: 500;
}
.dmd .badge-accent  { background: ${c('accent-subtle', '#f6e9e6')};  color: ${c('accent', '#b8422e')}; }
.dmd .badge-success { background: ${c('success-subtle', '#e6f2eb')}; color: ${c('success', '#3f8f63')}; }
.dmd .badge-warning { background: ${c('warning-subtle', '#f7efe0')}; color: ${c('warning', '#c08a2e')}; }
.dmd .badge-danger  { background: ${c('danger-subtle', '#f7e8e7')};  color: ${c('danger', '#c2453c')}; }
.dmd .badge-neutral { background: ${c('bg-subtle', '#f0f0f0')};      color: ${c('text-muted', '#666')}; }

/* ── Structure ── */
.dmd .row { display: flex; align-items: center; gap: ${sp('sm', '8px')}; }
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
  width: 32px; height: 32px; border-radius: ${rd('full', '9999px')};
  background: ${c('accent-subtle', '#f6e9e6')}; color: ${c('accent', '#b8422e')};
  display: inline-flex; align-items: center; justify-content: center;
  font-size: ${ft('caption', 'size', '12px')}; font-weight: 600; flex-shrink: 0;
}
.dmd .bar { height: 6px; border-radius: ${rd('full', '9999px')}; background: ${c('bg-subtle', '#eee')}; overflow: hidden; }
.dmd .bar > span { display: block; height: 100%; background: ${c('accent', '#b8422e')}; border-radius: inherit; }
.dmd .nav-item {
  padding: ${sp('sm', '8px')} ${sp('md', '16px')};
  border-radius: ${rd('md', '8px')}; color: ${c('text-muted', '#666')};
  font-size: ${ft('body-sm', 'size', '14px')}; cursor: pointer;
}
.dmd .nav-item.is-active { background: ${c('accent-subtle', '#f6e9e6')}; color: ${c('accent', '#b8422e')}; font-weight: 500; }
`
