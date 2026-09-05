/* Application shell: header, macro bar, panel column, preview column.
   All document state lives in the store; this file only wires things together
   and owns cloud sync. */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { StoreProvider, useStore, VIEW_TAGS } from './state/store.jsx'
import { createInitialState, MACROS, DEFAULT_MACROS, CONTRAST_PAIRS, pairFails, ALL_ROLES } from './state/schema.js'
import { PRESETS, applyPreset } from './state/presets.js'
import { check } from './color/contrast.js'
import { migrate } from './state/migrate.js'
import { nextBuild, describeBuild, isBuild } from './state/build.js'
import { generateFile, validate } from './emit/designmd.js'
import { parseFile } from './emit/parse.js'
import { agentContract } from './emit/agents.js'
import { serializeProject, parseProject, projectFilename, PROJECT_EXT } from './emit/project.js'
import { isValidColor } from './color/convert.js'
import { APP_CSS } from './ui/theme.js'
import { loadDocumentFonts } from './type/fonts.js'
import { Banner, Toggle, ResetButton, CloseButton, SectionHeader, SectionBreak, Collapsible, Strut, ConfirmDelete, numberFromText, PAD, BTN, MODAL_BTN } from './ui/controls.jsx'
import CrossFade from './ui/CrossFade.jsx'
import TabStrip, { scrollableUnder } from './ui/TabStrip.jsx'
import ImportModal, { IMPORT_FORMATS } from './ui/ImportModal.jsx'
import FixPreview from './a11y/FixPreview.jsx'
import CasualWizard, { LaunchFork } from './casual/CasualMode.jsx'
import { withFinding } from './a11y/audit.js'
import Canvas, { SURFACES } from './preview/Canvas.jsx'
import ColorPanel from './panels/ColorPanel.jsx'
import RolesPanel from './panels/RolesPanel.jsx'
import TypographyPanel from './panels/TypographyPanel.jsx'
import ComponentsPanel from './panels/ComponentsPanel.jsx'
import DirectivesPanel from './panels/DirectivesPanel.jsx'
import { LayoutPanel, ShapePanel, DepthPanel, MotionPanel } from './panels/system.jsx'
import { MetaTab, RationaleTab } from './panels/basics.jsx'
import HistoryPanel from './panels/HistoryPanel.jsx'

/* ── API ── */
const API_BASE = '/api/v1'
const TOKEN_KEY = 'design-md:tokens'
/* One second before the launch fork arrives. Their number. Long enough that
   the editor has drawn and the modal reads as arriving over it. */
const FORK_DELAY = 1000

const DRAFT_KEY = 'design-md:draft'
const DRAFT_AT_KEY = 'design-md:draft-at'
/* The document from the last session, rotated aside at boot so a fresh start
   never destroys it. Exactly one generation is kept. */
const PREV_KEY = 'design-md:previous'
const PREV_AT_KEY = 'design-md:previous-at'
const ANIM_KEY = 'design-md:ui-anim'
const HUE_KEY = 'design-md:ui-hue'
const THEME_KEY = 'design-md:ui-theme'
const BRIGHT_KEY = 'design-md:ui-bright'
const SCALE_KEY = 'design-md:ui-scale'
const PSCALE_KEY = 'design-md:preview-scale'
const PLINK_KEY = 'design-md:preview-link'

/* ── UI scale ──
 *
 * The chrome is drawn in absolute pixels — 10.5px labels, 12.5px body, 24px
 * rows — because that is what makes a dense tool legible at one size. It also
 * makes it exactly one size, and that size is small. Anyone who wants it
 * bigger currently has browser zoom, which scales the whole page including
 * the preview's own scrollbars and leaves the layout guessing about the
 * viewport.
 *
 * So: `zoom` on the app root, which multiplies every used length underneath
 * it without a single value here changing. Not `transform: scale()` — that
 * paints a scaled copy of a box that still occupies its original size, so the
 * layout would be wrong at every edge and fixed positioning would break
 * outright. Not a rem rewrite either; that is the textbook answer and it means
 * touching several hundred literals for a control most people will move once.
 *
 * The preview scales with everything else, deliberately. Holding it at true
 * size while the chrome grows would leave the one thing you are trying to look
 * at as the only thing still small, which inverts the point. The exported
 * values are untouched either way — this changes what you see, never what the
 * document says.
 */
const UI_SCALE = { min: 75, max: 150, def: 100, step: 12.5 }
/* Snap window either side of 100%. Wide enough to land on it without care,
   narrow enough that 95 and 105 stay reachable. */
const SCALE_SNAP = 3

/* A document nobody has touched. Compared as text against a freshly created
   one — `createInitialState()` is deterministic, with fixed ids and no
   timestamps, so this is exact rather than heuristic. */
const PRISTINE_DOC = JSON.stringify(createInitialState())
const isPristineDoc = raw => raw === PRISTINE_DOC

const getStoredToken = id => {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')[id] || null } catch { return null }
}
const setStoredToken = (id, token) => {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')
    t[id] = token
    localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
  } catch { /* private mode */ }
}
const api = {
  create: state => fetch(`${API_BASE}/projects`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, schemaVersion: state.schemaVersion ?? 1 }),
  }),
  read: id => fetch(`${API_BASE}/projects/${id}`),
  update: (id, token, state, version) => fetch(`${API_BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Edit-Token': token },
    body: JSON.stringify({ state, version }),
  }),
}

/* ── Icons ── */
const Copy = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
const Upload = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
const Download = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
const Undo = ({ flip }) => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: 'scaleX(-1)' } : undefined}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" /></svg>
const Save = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
)
/* Lucide, inlined at the same 13px and 2 stroke as the set above. Inlined
   rather than imported because the whole icon need of this header is six
   glyphs, and a dependency for that would cost more than it saves. */
const I = p => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{p}</svg>
const FilePlus = () => I(<><path d="M15 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7Z" /><path d="M14 2v4a2 2 0 002 2h4" /><path d="M9 15h6" /><path d="M12 18v-6" /></>)
const FolderOpen = () => I(<path d="m6 14 1.5-2.9A2 2 0 019.24 10H20a2 2 0 011.94 2.5l-1.54 6a2 2 0 01-1.95 1.5H4a2 2 0 01-2-2V5a2 2 0 012-2h3.9a2 2 0 011.69.9l.81 1.2a2 2 0 001.67.9H18a2 2 0 012 2v2" />)
/* A wand, for the guided entry. The shaft runs corner to corner and the three
   sparks sit off it, so the glyph reads at 14px without the star colliding
   with the stick. */
const Wand = () => I(<><path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" /><path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" /></>)
const DriveDown = () => I(<><path d="M12 2v8" /><path d="m16 6-4 4-4-4" /><rect width="20" height="8" x="2" y="14" rx="2" /><path d="M6 18h.01" /><path d="M10 18h.01" /></>)
const CloudUp = () => I(<><path d="M12 13v8" /><path d="M4 14.9A7 7 0 1115.71 8h1.79a4.5 4.5 0 012.5 8.24" /><path d="m8 17 4-4 4 4" /></>)
const Eye = () => I(<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>)
/* Two menus sat side by side wearing the same three lines, with their labels
   hidden at this width, so there was no way to tell Project from UI without
   opening one. A hamburger means "a menu", which both of them are — it says
   nothing about which. These say what they open. */
const Folder = () => I(<path d="M4 20h16a2 2 0 002-2V8a2 2 0 00-2-2h-7.9a2 2 0 01-1.69-.9l-.81-1.2A2 2 0 007.9 3H4a2 2 0 00-2 2v13a2 2 0 002 2z" />)
const Pencil = () => I(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" /></>)
const Sliders = () => I(<><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="1" x2="7" y1="14" y2="14" /><line x1="9" x2="15" y1="8" y2="8" /><line x1="17" x2="23" y1="16" y2="16" /></>)

const Motion = ({ off }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h4l3-7 4 14 3-7h4" />
    {off && <line x1="3" y1="21" x2="21" y2="3" strokeWidth={2.2} />}
  </svg>
)

/* One height for everything in the title bar, in both layouts.
   Measured from the buttons, which are 36 in each. The mark used to be 26 and
   read as a smaller class of thing parked in a row of controls. */
const BAR_CTRL = 36

/* The four document actions, declared once.
 *
 * The desktop header renders them as buttons and the mobile Project menu
 * renders them as rows. Two call sites, one list, so the order and the wording
 * cannot drift apart between the two layouts. */
const PROJECT_ACTIONS = [
  /* "New" and "Load", not "New Project" and "Load Project". The word Project
     is the same in both and in the menu that holds them, so it named nothing
     and spent width the guided entry needed. */
  { id: 'newProject', label: 'New', Icon: FilePlus, hint: 'Start a new document from a preset' },
  /* The wizard was reachable only from the launch fork, which appears once on
     a first visit. Somebody who dismissed it had no way back to the guided
     path at all. */
  { id: 'newGuided', label: 'New (Guided)', Icon: Wand, hint: 'Answer eight questions and get a prompt for an agent' },
  { id: 'loadProject', label: 'Load', Icon: FolderOpen, hint: 'Open a DESIGN.md you saved earlier' },
  { id: 'saveToDevice', label: 'Save to Device', Icon: DriveDown, hint: 'Download a dated copy of this document' },
  { id: 'saveToCloud', label: 'Save to Cloud', Icon: CloudUp, hint: 'Save online and get a shareable link' },
]

/* Where this document lives. A readout, not a control.
 *
 * It used to say "Local only" inside a bordered pill that looked exactly like
 * every button beside it, so the obvious move was to click it and nothing
 * happened. Now it reads as status: a coloured dot, no border, no pill, and
 * wording that states a fact rather than naming a mode. */
const SyncBadge = ({ status }) => {
  const cfg = {
    local:    { fg: 'var(--muted)',   dot: 'var(--dim)',     txt: 'On this device' },
    saving:   { fg: 'var(--accent)',  dot: 'var(--accent)',  txt: 'Saving…' },
    saved:    { fg: 'var(--success)', dot: 'var(--success)', txt: 'In the cloud' },
    readonly: { fg: 'var(--muted)',   dot: 'var(--dim)',     txt: 'Read-only' },
    conflict: { fg: 'var(--danger)',  dot: 'var(--danger)',  txt: 'Conflict' },
    error:    { fg: 'var(--danger)',  dot: 'var(--danger)',  txt: 'Sync failed' },
    offline:  { fg: 'var(--muted)',   dot: 'var(--warn)',    txt: 'Offline' },
  }[status] ?? { fg: 'var(--muted)', dot: 'var(--dim)', txt: status }
  const help = {
    local: 'Saved in this browser only. Use Save to Cloud to sync it.',
    saving: 'Writing to the cloud…',
    saved: 'Synced. Also kept in this browser.',
    readonly: 'Opened from a share link — changes stay local.',
    conflict: 'The cloud copy changed since you loaded this one.',
    error: 'The last sync failed. Your work is still safe locally.',
    offline: 'No connection. Everything is being kept locally.',
  }[status] ?? 'Where this document is stored'
  return (
    <span title={help} style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap',
      fontSize: 12, color: cfg.fg, cursor: 'default',
    }}>
      {/* Centred, and out of the baseline set — an item with no text would
          otherwise donate its bottom edge as this badge's baseline, which is
          what the header row aligns everything else to. */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0, alignSelf: 'center' }} />
      {cfg.txt}
    </span>
  )
}

/* The spec version the exported file will carry. Sits next to the storage
   readout because both answer the same question — what am I looking at. */
/* MDexed's own build, beside the wordmark because it identifies the tool.
 *
 * Distinct from the chip on the right, which is the *document's* build — the
 * two answer different questions ("which MDexed am I running" versus
 * "which revision of this design system is this"), so they sit at opposite
 * ends of the header rather than beside each other.
 *
 * Baked in by vite.config.js at compile time; `dev` when the dev server is
 * serving, since nothing was built. */
const AppBuild = () => {
  const { version, sha } = __APP_BUILD__
  const dev = version === 'dev'
  return (
    <span title={dev
      ? 'Running from the dev server — no build was produced'
      : `MDexed build ${version}${sha ? ` · ${sha}` : ''}`}
      style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)',
        letterSpacing: '.02em', whiteSpace: 'nowrap', cursor: 'default',
      }}>
      {version}
    </span>
  )
}

/* The build this document last produced.
 *
 * Not "the version you typed" — the version is stamped by exporting, because
 * that is when a file exists to be versioned. Until then there is nothing to
 * name and the chip says so instead of inventing a number. */
const VersionChip = ({ version }) => {
  const v = String(version ?? '').trim()
  const built = isBuild(v)
  return (
    <span title={
      built ? `${describeBuild(v)} — the counter advances each time you export`
        : v ? `Version "${v}" was typed by hand. Exporting replaces it with a build number.`
        : 'Not exported yet. The first export stamps a build number.'
    } style={{
      /* The chip holds one of two different things, and they take different
         faces. A build number is a FIGURE, so it takes the mono face like
         every other figure in the system. The word "unbuilt" is a word, and
         it belongs in the body face beside the badge it sits next to — one
         size, one family, so the pair reads as a single status line rather
         than as two unrelated readouts. */
      fontSize: 12, fontFamily: v ? 'var(--mono)' : 'var(--sans)',
      color: built ? 'var(--muted)' : 'var(--dim)',
      whiteSpace: 'nowrap', cursor: 'default',
    }}>
      {built ? v : v || 'unbuilt'}
    </span>
  )
}

/* ── Macro bar ──
   Always visible, above everything. Five multipliers that reshape hundreds of
   tokens — the reason the panels below can stay shallow.

   Each one shows both the multiplier and what it actually resolves to, and
   both are typeable: entering `12px` for roundness back-solves the multiplier.
   A relative number on its own is hard to judge; the concrete value is the one
   a designer is really choosing. */
function MacroControl({ macro, value, resolved, onChange }) {
  const base = DEFAULT_MACROS[macro.key]
  const changed = Math.abs(value - base) > 1e-9
  const [draft, setDraft] = useState(null)
  const [mulDraft, setMulDraft] = useState(null)

  /* Dragging within 3% of the range lands exactly on the default — getting
     back to baseline shouldn't need a steady hand. */
  const snap = v => (Math.abs(v - base) <= (macro.max - macro.min) * 0.03 ? base : v)

  const commitResolved = raw => {
    const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''))
    setDraft(null)
    if (!Number.isFinite(n) || !resolved.base) return
    onChange(Math.max(macro.min, Math.min(macro.max, n / resolved.base)))
  }

  return (
    <div style={{ width: '100%', minWidth: 0 }} title={macro.desc}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>{macro.label}</span>
        <ResetButton onClick={() => onChange(base)} disabled={!changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {/* ── ITS OWN INPUT, AND IT HAD ITS OWN BUGS ──
             This was a raw input beside the shared NumField rather than one of
             them, so it missed both of that component's repairs. Fully
             controlled, it re-formatted the digits under the caret between
             keystrokes. And it committed whatever parseFloat returned, so a
             value landed off the 0.01 step this control publishes: a density
             of 0.825 read as 0.82 here and 0.83 on the slider beside it, and
             neither was the number stored.

             The arithmetic now comes from one place. */}
        <input className="num" type="number" min={macro.min} max={macro.max} step={0.01}
          value={mulDraft ?? value.toFixed(2)}
          onFocus={e => { setMulDraft(value.toFixed(2)); e.target.select() }}
          onChange={e => {
            setMulDraft(e.target.value)
            const v = numberFromText(e.target.value, { min: macro.min, max: macro.max, step: 0.01 })
            if (v != null) onChange(v)
          }}
          onBlur={() => setMulDraft(null)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
          title="Multiplier"
          style={{ width: 56, padding: '4px 6px', fontSize: 10, color: changed ? 'var(--accent)' : 'var(--muted)' }} />
        <input
          value={draft ?? resolved.display}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commitResolved(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          disabled={!resolved.base}
          title={resolved.hint}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 6px',
            textAlign: 'right', color: 'var(--text-dim)', opacity: resolved.base ? 1 : 0.55,
          }} />
      </div>
      <input type="range" min={macro.min} max={macro.max} step={0.01} value={value}
        onChange={e => onChange(snap(parseFloat(e.target.value)))}
        onDoubleClick={() => onChange(base)} />
    </div>
  )
}

/* Editor animation speed. Sits at the far right of the system bar so it lines
   up above the preview pane, opposite the token macros — it configures the
   tool, not the design. */
const UI_ANIM_DEFAULT = 125
const UI_ANIM_MAX = 1000
const UI_ANIM_STEP = 125

/* Same three-row shape as the token macros so it sits on the same baseline.
   The slider moves in 125ms steps; the field takes any value in range, so an
   odd number is reachable by typing even though dragging won't land on it. */
function UiSpeedControl({ value, onChange }) {
  const [draft, setDraft] = useState(null)
  const changed = value !== UI_ANIM_DEFAULT

  const commit = raw => {
    setDraft(null)
    const n = parseFloat(String(raw).replace(/[^\d.]/g, ''))
    if (Number.isFinite(n)) onChange(Math.max(0, Math.min(UI_ANIM_MAX, Math.round(n))))
  }

  return (
    <div style={{ width: '100%', minWidth: 0 }} title="How fast the editor's own panels and controls animate. 0 disables them.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>UI Animation</span>
        <ResetButton onClick={() => onChange(UI_ANIM_DEFAULT)} disabled={!changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          value={draft ?? (value ? `${value}ms` : 'off')}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 6px',
            textAlign: 'right', color: value ? 'var(--text-dim)' : 'var(--dim)',
          }} />
      </div>
      <input type="range" min={0} max={UI_ANIM_MAX} step={UI_ANIM_STEP} value={Math.min(value, UI_ANIM_MAX)}
        onChange={e => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(UI_ANIM_DEFAULT)} />
    </div>
  )
}

/* How dark the dark is, and how bright the bright is.
 *
 * One slider, two ranges: 0-33 belongs to the dark theme and 66-100 to the
 * light one, so the value carries which theme it was set for and each theme
 * remembers its own setting. The gap between them is not reachable, because
 * there is nothing sensible in the middle — a 50% chrome is neither.
 *
 * The label reads in the direction the theme thinks: a dark theme gets
 * lighter as the number rises, a light theme gets brighter. Same slider, same
 * direction of travel, opposite starting point.
 */
/* Equal spans, 33 wide on each side, so the same default reads as the same
   percentage in both themes and a step means the same amount of light in
   either. The unreachable gap between them is what makes the value itself
   say which theme it belongs to. */
const UI_B = { dark: { min: 0, max: 33, def: 11 }, light: { min: 67, max: 100, def: 78 } }
const UI_B_DEFAULTS = { dark: UI_B.dark.def, light: UI_B.light.def }

/* A percentage slider with a typed field, shared by the two scales.
   See the UI_SCALE block for why scaling is `zoom` rather than a rem rewrite. */
function ScaleSlider({ label, title, value, onChange, disabled, children }) {
  const [draft, setDraft] = useState(null)
  const changed = value !== UI_SCALE.def

  const commit = input => {
    setDraft(null)
    const n = parseFloat(String(input).replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n)) return
    onChange(Math.max(UI_SCALE.min, Math.min(UI_SCALE.max, Math.round(n))))
  }
  /* Same snap-near-default the hue slider has: 100% is the size everything was
     drawn at, so it should be the easy one to get back to by dragging. */
  const slide = n => onChange(Math.abs(n - UI_SCALE.def) <= SCALE_SNAP ? UI_SCALE.def : n)

  return (
    <div style={{ width: '100%', minWidth: 0, opacity: disabled ? 0.55 : 1 }} title={title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <ResetButton onClick={() => onChange(UI_SCALE.def)} disabled={disabled || !changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          value={draft ?? `${value}%`} disabled={disabled}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 6px',
            textAlign: 'right', color: 'var(--text-dim)',
          }} />
      </div>
      <input type="range" min={UI_SCALE.min} max={UI_SCALE.max} step={UI_SCALE.step} value={value} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(UI_SCALE.def)} />
      {children}
    </div>
  )
}

/* The preview at its own size.
 *
 * Unlinked by default, and that default is the whole reason this exists. The
 * editor is a tool and can be as large as your eyes want; the preview is the
 * thing being judged, and judging "is 14px body text too small" is impossible
 * if the app has quietly grown it to 21. Held at 100%, a 375px responsive
 * preview is 375 real pixels whatever the chrome is doing.
 *
 * Linking is there for the other half of the day, when you are not measuring
 * anything and just want to see it.
 */
function PreviewScaleControl({ value, onChange, linked, setLinked, uiScale }) {
  return (
    <ScaleSlider
      label="Preview Scale"
      title="How large the preview surface draws, independent of the editor around it. The document is unchanged either way — this is magnification, not a token."
      value={linked ? uiScale : value} onChange={onChange} disabled={linked}>
      <label className="check" style={{ marginTop: 8, color: linked ? 'var(--text)' : 'var(--muted)' }} title="Follow the UI Scale slider instead of keeping its own value.">
        <input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
        Link to UI Scale
      </label>
    </ScaleSlider>
  )
}

function UiBrightnessControl({ value, onChange, theme }) {
  const r = UI_B[theme]
  const [draft, setDraft] = useState(null)
  const pct = Math.round(((value - r.min) / (r.max - r.min)) * 100)
  const changed = value !== r.def

  /* Typed as a percentage and stored as a raw slider position, so the number
     you read is the number you can type back. */
  const commit = input => {
    setDraft(null)
    const n = parseFloat(String(input).replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n)) return
    const clamped = Math.max(0, Math.min(100, n))
    onChange(Math.round(r.min + (clamped / 100) * (r.max - r.min)))
  }

  return (
    <div style={{ width: '100%', minWidth: 0 }}
      title={theme === 'dark'
        ? 'How far the dark theme lifts off black. Text follows, so contrast stays inside AA across the range.'
        : 'How bright the paper is. Text darkens as the page dims, so the page reads as a lower lamp rather than as grey ink.'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>
          Brightness
        </span>
        <ResetButton onClick={() => onChange(r.def)} disabled={!changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          value={draft ?? `${pct}%`}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 6px',
            textAlign: 'right', color: 'var(--text-dim)',
          }} />
      </div>
      <input type="range" min={r.min} max={r.max} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(r.def)} />
    </div>
  )
}

/* Editor hue. Rotates every neutral in the chrome — surfaces, borders, text,
   scrollbars — at its own saturation and lightness, so the tonal structure is
   untouched and only the cast changes. The semantic colours are deliberately
   excluded; see the `--ui-h` block in theme.js.

   Sits beside the animation speed because both configure the tool rather than
   the design, and neither belongs in the exported file. */
const UI_HUE_DEFAULT = 208

function UiHueControl({ value, onChange }) {
  const [draft, setDraft] = useState(null)
  const changed = value !== UI_HUE_DEFAULT

  const commit = raw => {
    setDraft(null)
    const n = parseFloat(String(raw).replace(/[^\d.]/g, ''))
    /* Wrap rather than clamp — hue is a circle, and typing 370 meaning 10 is
       a reasonable thing to do. */
    if (Number.isFinite(n)) onChange(((Math.round(n) % 360) + 360) % 360)
  }

  /* Same 3% catchment the token macros use: dragging near the default lands
     exactly on it, so returning to baseline doesn't need a steady hand.
     Typing is exempt — an explicit 205 means 205. */
  const snap = v => (Math.abs(v - UI_HUE_DEFAULT) <= 360 * 0.03 ? UI_HUE_DEFAULT : v)

  return (
    <div style={{ width: '100%', minWidth: 0 }} title="The hue of the editor's own chrome. Saturation and lightness are untouched — only the cast changes.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: changed ? 'var(--text)' : 'var(--muted)', flex: 1, whiteSpace: 'nowrap' }}>UI Hue</span>
        <ResetButton onClick={() => onChange(UI_HUE_DEFAULT)} disabled={!changed} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          value={draft ?? `${value}°`}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0, fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 6px',
            textAlign: 'right', color: 'var(--text-dim)',
          }} />
      </div>
      {/* The track is the hue circle and the thumb is the hue you are on, so
          the control states its own range and its own value. `--hue` is read
          by the thumb rule in theme.js. */}
      <input type="range" className="hue-slider" min={0} max={360} step={1} value={value}
        onChange={e => onChange(snap(Number(e.target.value)))}
        onDoubleClick={() => onChange(UI_HUE_DEFAULT)}
        style={{ '--hue': value }} />
    </div>
  )
}

function GlobalMetrics() {
  const { state, derived, set } = useStore()
  const setMacro = (key, value) => set(s => ({ ...s, macros: { ...s.macros, [key]: value } }), `macro:${key}`)
  const reset = () => set(s => ({ ...s, macros: { ...DEFAULT_MACROS } }))
  const anyChanged = MACROS.some(m => state.macros[m.key] !== DEFAULT_MACROS[m.key])

  /* What each multiplier resolves to in the unit a designer thinks in. */
  const resolvedFor = key => {
    const v = state.macros[key]
    switch (key) {
      case 'scale':     return { base: state.type.base,  display: `${Math.round(state.type.base * v * 10) / 10}px`, hint: 'Base font size — type a px value' }
      case 'density':   return { base: state.space.base, display: `${Math.round(state.space.base * v * 10) / 10}px`, hint: 'Base spacing unit — type a px value' }
      case 'roundness': return { base: state.radius.base, display: `${Math.round(state.radius.base * v * 10) / 10}px`, hint: state.radius.base ? 'Base corner radius — type a px value' : 'Base radius is 0, so there is nothing to scale' }
      /* Percentage, not pixels: one multiplier drives offset, blur and opacity
         at once, so there is no single px value it could report.

         `base` is what the typed number is DIVIDED by to recover the
         multiplier, and the display is `v * 100`, so the inverse is `n / 100`.
         It read 0.01, which multiplies by a hundred instead of dividing —
         typing 45% asked for a multiplier of 4500 and every entry slammed
         straight to the maximum. Found by typing a value in, which is the half
         of this control a slider never exercises. */
      case 'depth':     return { base: 100, display: `${Math.round(v * 100)}%`, hint: 'Shadow strength as a percentage — scales offset, blur and opacity together. 0% removes shadows.' }
      case 'speed':     return { base: state.motion.durations.normal, display: `${Math.round(state.motion.durations.normal * v)}ms`, hint: 'The `normal` duration — type a value in ms. 0 disables all motion.' }
      default:          return { base: 1, display: `${v}`, hint: '' }
    }
  }

  /* `pairFails`, not a fifth copy of the rule. Five call sites each spelled it
     out; when `exempt` arrived for disabled text, three learned about it and
     two did not, so a clean document opened reporting a contrast failure the
     document itself grades "Exempt (1.4.3)". */
  const failing = CONTRAST_PAIRS.filter(p =>
    pairFails(p, check(derived.roles[state.color.mode][p.fg], derived.roles[state.color.mode][p.bg]))).length

  return (
    <div>
      <SectionHeader title="Global Metrics"
        desc="Five multipliers that reshape every dependent token at once. Everything below them in the app is derived, so these move the whole system rather than one value."
        right={
          <button className="btn-ghost" onClick={reset} disabled={!anyChanged} style={{ padding: BTN.sm, fontSize: 12 }}>
            Reset All
          </button>
        } />

      {/* In a card, like every other section in the app.
       *
       * This was the one block anywhere that sat bare on the panel — every
       * other panel puts its content in a Collapsible, and a lone unbordered
       * stack read as a different KIND of thing rather than the same thing
       * without a border.
       *
       * And the spacing was the wrong way round. Each macro is internally
       * tight, 3px between its label, its field and its slider, while the
       * macros themselves sat 24px apart — eight times their own rhythm, for
       * five items in one list. Proximity is a ratio, and that one said the
       * five controls were five separate sections. `PAD.row` is the step for
       * rows inside a card, which is exactly what these are. */}
      <Collapsible title="Multipliers" note={String(MACROS.length)} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: PAD.row }}>
          {MACROS.map(m => (
            <MacroControl key={m.key} macro={m} value={state.macros[m.key]} resolved={resolvedFor(m.key)}
              onChange={v => setMacro(m.key, v)} />
          ))}
        </div>
      </Collapsible>


    </div>
  )
}

/* ── Tool settings ──
 *
 * Behind a menu because none of it is design work. Animation speed, chrome
 * hue and light or dark configure the tool, they never reach the exported
 * file, and they are set once and forgotten. Sitting them permanently across
 * the top of the window cost a whole row of chrome for controls nobody
 * touches twice in a session.
 */
/* Below this the two panes cannot both be useful at once, so the layout stops
   trying. 768px is the usual tablet floor: above it the split still works once
   the editor column's 420px floor relaxes. */
const MOBILE_Q = '(max-width: 767px)'

/* One breakpoint per question, each measured from the thing it governs.
 *
 * MOBILE_Q answers "can two panes coexist", which is about pane width. It was
 * also answering "is the title bar cramped", which is about the title bar's
 * own contents, and those are not the same number. Everything between 768 and
 * 1570 got the full desktop bar in a space that could not hold it, and the
 * result was the mark, the wordmark, the name field and the swatches printed
 * on top of each other.
 *
 * BAR_FULL_Q: the run of action buttons plus the left block needs 1621px,
 * measured. Below that they fold into the Project menu.
 *
 * IT MOVED WITH THE ROW, AND THE MOVE IS A SUM OF TWO THINGS. The guided
 * entry is a seventh button, and "New Project" and "Load Project" lost the
 * word they shared. Measured on the rendered buttons:
 *
 *   New (Guided)   144.7   plus one 8px gap   = +152.7
 *   New Project 135.0 -> New   84.1           =  -50.9
 *   Load Project 138.9 -> Load  88.0          =  -50.9
 *                                               ------
 *                                               +50.9
 *
 * So 1570 becomes 1621. Stated as the sum and the widths it came from, not as
 * a constant, because the number is true of these labels and no others. The
 * row's own min-content reads 1469, and that is the wrong measure here: it
 * lets the project-name field collapse to nothing, which is the state this
 * threshold exists to prevent.
 *
 * BAR_TRIM_Q: below this the wordmark, the build chip and the palette go too.
 * They are decoration next to a name you can edit and an action you can press.
 */
const BAR_FULL_Q = '(max-width: 1620px)'
const BAR_TRIM_Q = '(max-width: 1099px)'

function useMedia (query) {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

/* Click-outside, Escape and scroll-away, shared by both header menus.
   Lifted out of ToolsMenu when the Project menu needed the same three rules —
   two copies would have drifted the first time one of them was tuned. */
function useDismiss (open, close, ...refs) {
  useEffect(() => {
    if (!open) return
    const inside = t => refs.some(r => r.current?.contains(t))
    const onDown = e => { if (!inside(e.target)) close() }
    const onKey = e => { if (e.key === 'Escape') close() }
    const onWheel = e => { if (!inside(e.target) && scrollableUnder(e.target)) close() }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

/* The four document actions as a menu, for when the header has no room for
   them as buttons. Same list as the desktop header, from PROJECT_ACTIONS. */
function ProjectMenu ({ items, onAction, projectId }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const btnRef = useRef(null)
  useDismiss(open, () => setOpen(false), boxRef, btnRef)

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button ref={btnRef} className="btn-ghost" onClick={() => setOpen(o => !o)}
        title="Project — new, load, save" aria-expanded={open}
        style={{ padding: BTN.lg, gap: 6, color: open ? 'var(--accent)' : 'var(--muted)' }}>
        <Folder /><span className="lbl">Project</span>
      </button>
      {open && (
        <div ref={boxRef} className="anim-pop" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 'var(--z-dropdown)',
          background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 12,
          boxShadow: '0 12px 32px var(--shade)', width: 232, padding: '6px',
        }}>
          {items.map(a => (
            <button key={a.id} onClick={() => { setOpen(false); onAction(a.id) }} title={a.hint}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                /* 44px, the touch target this app requires of everyone else. */
                minHeight: 44, padding: '0 12px', borderRadius: 8,
                background: 'transparent', border: 0, cursor: 'pointer',
                font: '400 13px/44px var(--sans)', color: 'var(--text)', textAlign: 'left',
              }}
              onPointerEnter={e => { e.currentTarget.style.background = 'var(--surf3)' }}
              onPointerLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <a.Icon />
              {a.id === 'saveToCloud' && projectId ? 'Copy Share URL' : a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolsMenu({ uiSpeed, setUiSpeed, uiHue, setUiHue, uiTheme, setUiTheme, uiBright, setUiBright, uiScale, setUiScale, prevScale, setPrevScale, prevLink, setPrevLink }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const inside = t => boxRef.current?.contains(t) || btnRef.current?.contains(t)
    const onDown = e => { if (!inside(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    /* Same rule as the tab menu: a wheel that would move something is a scroll
       aimed past this, so get out of the way. One that would not is not. */
    const onWheel = e => { if (!inside(e.target) && scrollableUnder(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('wheel', onWheel)
    }
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button ref={btnRef} className="btn-ghost" onClick={() => setOpen(o => !o)}
        title="Editor settings — theme, scale, animation, chrome hue"
        aria-expanded={open}
        style={{ padding: BTN.lg, gap: 6, color: open ? 'var(--accent)' : 'var(--muted)' }}>
        {/* Sliders, not three bars. The Project menu beside this one wore the
            same hamburger, and with both labels hidden at a narrow width there
            was no way to tell them apart without opening one. */}
        <Sliders />
        <span className="lbl">UI</span>
      </button>

      {open && (
        /* Padding on the panel, gaps between the groups, and a ruled header —
         * rather than the one flat 12px everywhere that had the rainbow track
         * sitting on the bottom border and every label jammed against the
         * left edge.
         *
         * A range input's thumb overhangs its track by a few pixels top and
         * bottom, so a slider as the last child needs more clearance below it
         * than a line of text does. Hence the extra on the bottom. */
        <div ref={boxRef} className="anim-pop" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 'var(--z-dropdown)',
          background: 'var(--surf2)', border: '1px solid var(--bdr2)', borderRadius: 12,
          boxShadow: '0 12px 32px var(--shade)', width: 288,
          padding: '0 0 6px',
        }}>
          {/* Same treatment as the EDITOR and PREVIEW pane titles: 10px, 700,
              .1em, --text-dim. Three headings that name a region should not be
              three slightly different headings. */}
          <div style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em',
            color: 'var(--text-dim)', fontWeight: 700,
            padding: '12px 16px 12px', borderBottom: '1px solid var(--bdr)',
          }}>
            App UI
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 16px 8px' }}>
            <ThemeToggle value={uiTheme} onChange={setUiTheme} />
            <UiBrightnessControl theme={uiTheme} value={uiBright[uiTheme]}
              onChange={v => setUiBright(b => ({ ...b, [uiTheme]: v }))} />
            <ScaleSlider label="UI Scale" value={uiScale} onChange={setUiScale}
              title="Scales the editor chrome. The preview has its own control below." />
            <PreviewScaleControl value={prevScale} onChange={setPrevScale}
              linked={prevLink} setLinked={setPrevLink} uiScale={uiScale} />
            <UiHueControl value={uiHue} onChange={setUiHue} />
            <UiSpeedControl value={uiSpeed} onChange={setUiSpeed} />
          </div>
        </div>
      )}
    </div>
  )
}

/* Light or dark for the app itself. A bulb rather than a sun and moon,
   because the two-icon version always leaves you guessing whether the icon is
   the current state or the one you would switch to. A bulb is lit or it
   isn't, and the label says the rest. */
function ThemeToggle({ value, onChange }) {
  const light = value === 'light'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--muted)', flex: 1 }}>Appearance</span>
      <button onClick={() => onChange(light ? 'dark' : 'light')}
        title={light ? 'Switch to the dark theme' : 'Switch to the light theme'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          background: light ? 'rgb(var(--warn-rgb) / .14)' : 'var(--surf3)',
          border: `1px solid ${light ? 'rgb(var(--warn-rgb) / .4)' : 'var(--bdr)'}`,
          color: light ? 'var(--warn)' : 'var(--muted)',
          borderRadius: 6, padding: BTN.xs, fontSize: 12, fontFamily: 'var(--sans)',
          transition: 'background var(--t) var(--ease), color var(--t) var(--ease), border-color var(--t) var(--ease)',
        }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6" /><path d="M10 22h4" />
          <path d="M15.1 14c.4-1.4 1.4-2.4 2.2-3.5A6 6 0 1 0 6.7 10.5c.8 1.1 1.8 2.1 2.2 3.5" />
          {/* Rays only when lit. The bulb is the state, not a decoration. */}
          {light && <><path d="M12 1v1.5" /><path d="M4.2 4.2l1 1" /><path d="M19.8 4.2l-1 1" />
            <path d="M1.5 12H3" /><path d="M21 12h1.5" /></>}
        </svg>
        {light ? 'Light' : 'Dark'}
      </button>
    </div>
  )
}

/* ── Preview / export modal ── */
function FileModal({ onClose }) {
  const { state, derived } = useStore()
  const { text, omitted, dropped } = useMemo(() => generateFile(state, derived), [state, derived])
  const report = useMemo(() => validate(text), [text])
  const [copied, setCopied] = useState(false)

  return (
    <div onClick={onClose} className="anim-fade modal-back" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise modal-panel" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, width: '100%', maxWidth: 760, maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', padding: '12px 16px', borderBottom: '1px solid var(--bdr)', gap: 12 }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, flex: 1 }}>DESIGN.md</span>
          <span className="chip" style={{ color: report.ok ? 'var(--success)' : 'var(--danger)', borderColor: report.ok ? 'rgb(var(--success-rgb) / .3)' : 'rgb(var(--danger-rgb) / .3)' }}>
            {report.ok ? 'Spec valid' : `${report.errors.length} error${report.errors.length === 1 ? '' : 's'}`}
          </span>
          <span className="chip">{(text.length / 1024).toFixed(1)} kB</span>
          {/* This modal has no footer — the file itself fills it — so Copy is
              its one action and takes the modal-action size where it stands. */}
          <button className="btn-ghost" style={MODAL_BTN}
            onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })}>
            <Copy /><span className="lbl">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <span style={{ alignSelf: 'center', display: 'flex' }}>
            <CloseButton onClick={onClose} label="Close" size={11} />
          </span>
        </div>

        {(report.errors.length > 0 || report.warnings.length > 0 || dropped.length > 0) && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bdr)', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 172, overflow: 'auto' }}>
            {report.errors.map((e, i) => <Banner key={`e${i}`} tone="error">{e}</Banner>)}
            {report.warnings.map((w, i) => <Banner key={`w${i}`} tone="warn">{w}</Banner>)}
            {dropped.length > 0 && (
              <Banner tone="info">
                {dropped.length} component propert{dropped.length === 1 ? 'y' : 'ies'} outside the spec schema ({[...new Set(dropped.map(d => d.key))].join(', ')}) — written into the Components section as prose instead.
              </Banner>
            )}
            {omitted.length > 0 && <Banner tone="info">Declared as omitted: {omitted.join(', ')}. Fill these in under Rationale.</Banner>}
          </div>
        )}

        <pre style={{ flex: 1, overflow: 'auto', padding: 16, fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.65, color: 'var(--text)', margin: 0, background: 'var(--bg)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</pre>
      </div>
    </div>
  )
}

/* ── Save flash ──
   Autosave is invisible by nature, which is fine right up until you want to
   close the tab. A brief confirmation costs nothing and answers the question
   without needing to be read. */
function SaveFlash({ savedAt }) {
  const [shown, setShown] = useState(null)
  const [leaving, setLeaving] = useState(false)

  /* Two keyframe animations rather than a transition. A transition needs a
     frame between the start and end states, and the entry animation's `both`
     fill would pin the final opacity and beat any exit transition anyway. */
  useEffect(() => {
    if (!savedAt) return
    setShown(savedAt)
    setLeaving(false)
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    const hold = setTimeout(() => setLeaving(true), 1600)
    const gone = setTimeout(() => setShown(null), 1600 + ms + 40)
    return () => { clearTimeout(hold); clearTimeout(gone) }
  }, [savedAt])

  if (!shown) return null
  return (
    <div key={shown.at} className={leaving ? 'anim-fall' : 'anim-rise'} style={{
      pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 8,
      /* Opaque. A translucent confirmation over a dark editor is unreadable. */
      background: '#12352a', border: '1px solid rgb(var(--success-rgb) / .55)',
      color: '#7fd6a4', borderRadius: 8, padding: '8px 12px',
      fontSize: 12, fontFamily: 'var(--mono)',
      boxShadow: '0 8px 24px rgba(0,0,0,.5)',
    }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Saved to {shown.where}
    </div>
  )
}


/* ── Editable title ──
   Edits stay local until confirmed, so a half-typed name never lands in the
   document — and the tick/cross only exist while there's something to decide. */
/* `full` fills the line rather than sitting at a fixed 150px.
   An element given its own row should use that row. A 150px field floating in
   351px is a half-measure that looks like it landed there by accident. */
function TitleField({ name, onCommit, full = false }) {
  const [draft, setDraft] = useState(name)
  const [editing, setEditing] = useState(false)

  useEffect(() => { if (!editing) setDraft(name) }, [name, editing])

  /* Compare trimmed, or committing " Name " leaves the field permanently dirty
     because the stored value differs from the draft by whitespace. */
  const dirty = draft.trim() !== name.trim()
  const commit = () => {
    const next = draft.trim() || 'Untitled'
    onCommit(next)
    setDraft(next)
    setEditing(false)
  }
  const discard = () => { setDraft(name); setEditing(false) }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, width: full ? '100%' : undefined }}>
      <input
        value={draft}
        onChange={e => { setDraft(e.target.value); setEditing(true) }}
        onFocus={() => setEditing(true)}
        onBlur={() => { if (!dirty) setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') discard()
        }}
        placeholder="Untitled"
        title="Project name"
        style={{
          ...(full ? { flex: 1, width: '100%', height: 36, fontSize: 14 } : { width: dirty ? 180 : 152, fontSize: 12 }),
          padding: '4px 12px',
          fontFamily: 'var(--mono)', background: 'var(--surf2)',
          borderColor: dirty ? 'rgb(var(--accent-rgb) / .45)' : 'var(--bdr)',
          color: dirty ? 'var(--accent)' : 'var(--muted)',
          transition: 'width var(--t) var(--ease), border-color var(--t) var(--ease)',
        }} />
      {dirty && (
        /* onMouseDown must be swallowed: pressing the button blurs the input
           first, and the resulting re-render replaces the node before mouseup
           lands — so the click never fires. Keeping focus fixes it. */
        <span className="anim-fade" style={{ display: 'inline-flex', gap: 1 }} onMouseDown={e => e.preventDefault()}>
          <button className="btn-confirm" onClick={commit} title="Save name (Enter)" style={{ color: 'var(--success)' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button className="btn-confirm btn-confirm-no" onClick={discard} title="Discard (Esc)">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      )}
    </div>
  )
}

/* ── Restore offer ──
   Deliberately a toast and not a modal. Starting fresh is the common case and
   shouldn't need dismissing; the previous session is one click away for the
   times it isn't. Stays until acted on rather than timing out — a restore you
   missed because you were reading is worse than a toast that lingers. */
const ago = at => {
  if (!at) return null
  const mins = Math.round((Date.now() - at) / 60000)
  if (mins < 1) return 'moments ago'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function RestoreToast({ offer, onRestore, onDismiss }) {
  const [leaving, setLeaving] = useState(false)

  const close = after => {
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    setLeaving(true)
    setTimeout(after, ms)
  }

  /* Thirty seconds, then it withdraws the offer quietly.
   *
   * Longer than the notice bar's ten because this one is asking a question
   * rather than reporting something — you have to read it, decide whether you
   * want the old project back, and reach for a button. But it can't sit there
   * forever either: an offer that never expires is a permanent obstruction in
   * the corner of a tool you're trying to work in.
   *
   * Nothing is lost when it goes. The previous document is still in
   * localStorage; this was only the shortcut back to it. */
  useEffect(() => {
    if (!offer || leaving) return
    const t = setTimeout(() => close(onDismiss), 30000)
    return () => clearTimeout(t)
  }, [offer, leaving, onDismiss])

  if (!offer) return null
  const when = ago(offer.at)

  return (
    <div className={leaving ? 'anim-fall' : 'anim-rise'} style={{
      /* Centred: the message is two lines, so Restore is sitting beside a block
         rather than beside a line. Baseline-aligning it to the first line left
         it hanging off the top of the pair. */
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--surf2)', border: '1px solid var(--bdr2)',
      borderRadius: 8, padding: '8px 12px 8px 12px',
      /* No fixed cap. The second line names the project, and a name the user
         chose is not something to replace with an ellipsis when there is room
         on the screen for it — the toast floats, so growing costs nothing.
         Bounded against the viewport rather than a magic number; the name
         field itself is capped at 255 characters, which is what actually
         keeps this from running away. */
      maxWidth: 'min(720px, calc(100vw - 48px))',
      boxShadow: '0 10px 30px rgba(0,0,0,.5)',
    }}>
      {/* A restore glyph, in the success green — the one strong colour in the
          editor chrome, so the eye finds this against a bright preview. */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, alignSelf: 'center',
        background: 'rgb(var(--success-rgb) / .16)', color: 'var(--success)',
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v6h6" />
          <path d="M3.5 14a9 9 0 1 0 2.1-9.4L3 7" />
        </svg>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)' }}>
          Started a new project.
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, overflowWrap: 'anywhere' }}>
          “{offer.name}” is saved{when ? ` from ${when}` : ''}.
        </div>
      </div>
      <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, flexShrink: 0 }}
        onClick={() => close(onRestore)}>
        Restore
      </button>
      <span style={{ alignSelf: 'center', display: 'flex' }}>
        <CloseButton onClick={() => close(onDismiss)} size={10} />
      </span>
    </div>
  )
}

/* ── The notice bar ──
 *
 * Ten seconds, then it fades out on its own. A notice that stays until
 * clicked becomes furniture — you stop reading it, and the next one looks
 * like the last one still being there.
 *
 * Hovering pauses the clock. Ten seconds is not long for an error message
 * you are still reading, and the cost of getting that wrong is that the
 * explanation for a failed import vanishes mid-sentence.
 *
 * Both the timer and the fade go through the animation setting: with UI
 * animation off, it disappears the moment the ten seconds are up rather than
 * animating out over a duration that has been set to zero. */
function NoticeBar({ notice, onClose }) {
  const [leaving, setLeaving] = useState(false)
  const [held, setHeld] = useState(false)

  useEffect(() => { setLeaving(false) }, [notice])

  useEffect(() => {
    if (!notice || held) return
    const t = setTimeout(() => setLeaving(true), 10000)
    return () => clearTimeout(t)
  }, [notice, held])

  useEffect(() => {
    if (!leaving) return
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [leaving, onClose])

  if (!notice) return null
  return (
    <div className={leaving ? 'anim-fade-out' : 'anim-fade'}
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
      style={{ padding: '8px 20px', background: 'var(--surf)', borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>
      <Banner tone={notice.tone} onDismiss={() => setLeaving(true)}>{notice.text}</Banner>
    </div>
  )
}

/* ── New document ──
   Opening the app used to drop you straight into whatever was last in
   localStorage with no way out. This is the way out. */
function NewDocModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  return (
    <div onClick={onClose} className="anim-fade modal-back" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="anim-rise modal-panel" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--bdr)' }}>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, flex: 1 }}>New design system</span>
          <CloseButton onClick={onClose} label="Close" size={11} />
        </div>

        <div style={{ padding: 16, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <label>Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Untitled system" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Start from</div>
          <p className="panel-note" style={{ marginBottom: 12 }}>
            This replaces the current document. Anything unsaved to the cloud is lost.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => onCreate(p.id, name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', textAlign: 'left',
                  background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8,
                  cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--sans)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgb(var(--accent-rgb) / .4)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)' }}>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {p.swatches.map(c => <div key={c} style={{ width: 16, height: 28, background: c, borderRadius: 4, border: '1px solid rgba(255,255,255,.07)' }} />)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{p.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Document identity and the five multipliers, on one tab.
 *
 * They belong together: the name, the description and the macros are all
 * statements about the system as a whole rather than about any one token, and
 * a designer opening a document wants the same three answers each time. What
 * is this, how big is it, how round is it.
 *
 * A divider rather than a second card, because the macro block already
 * carries its own heading and nesting it would be three borders deep. */
/* ── RTL, LAST AND OFF ──
 *
 * Every rule the payload states is already written in logical terms, so a
 * left-to-right build loses nothing by leaving this alone. What the switch
 * adds is the RTL-SPECIFIC half: what mirrors, what must not, and how
 * bidirectional text behaves. That is noise for a page that will never be
 * Arabic, Persian, Urdu or Hebrew, and a reader should not have to decide
 * whether it applies to them. So it ships out of the payload by default.
 *
 * Last in the tab, because it is the narrowest decision here. */
function RtlSection() {
  const { state, set } = useStore()
  const on = Boolean(state.meta?.rtl)
  return (
    <Collapsible title="RTL Optimizations" note={on ? 'on' : 'off'}>
      <Banner tone="warn">
        Turn this on <strong>only</strong> for pages that ship in Arabic, Persian,
        Urdu or Hebrew. It adds a right-to-left section to DESIGN.md covering
        mirroring, bidirectional text and numerals. Every other rule in the
        payload is already written in logical terms, so a left-to-right build
        needs nothing from here and gets the same layout with this off.
      </Banner>
      {/* `Toggle`, not a bare input. The chrome styles `input:not(.dmd *)` as
          a FIELD, so a raw checkbox here measured 283px wide and threw its
          label to the far side of the row. Every other switch in this panel
          uses this primitive. */}
      <div style={{ marginTop: PAD.gap }}>
        <Toggle label="Enable RTL optimizations" checked={on}
          desc="Adds a Right-to-left section to DESIGN.md, and swaps two checks to measure from the start edge."
          onChange={v => set(s => ({ ...s, meta: { ...s.meta, rtl: v } }))} />
      </div>
      <p className="panel-note" style={{ marginTop: PAD.sub }}>
        {on
          ? 'DESIGN.md carries a Right-to-left section, and two checks in VERIFY-BROWSER.js now measure from the START edge rather than from the left. Pointed at a correct right-to-left table, the plain versions report it as 271.8px off its heading.'
          : 'Nothing right-to-left reaches the payload. Two checks read the left edge and mean start, which is correct in this direction and would fault every right-to-left table.'}
      </p>
    </Collapsible>
  )
}

/* ── RETIRING A TOKEN ──
 *
 * A design system that never deletes anything becomes unusable, and one that
 * deletes without warning breaks every build that imported the name. So a
 * retired token keeps its value and carries a mark.
 *
 * The list is empty by default and the section says so, rather than shipping
 * an empty heading into DESIGN.md. */
function RetiredSection() {
  const { state, set } = useStore()
  const rows = state.deprecated ?? []
  const write = next => set(s => ({ ...s, deprecated: next }), 'deprecated')
  const upd = (i, k, v) => write(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  /* Every colour role, so a name is CHOSEN rather than typed. A typo here
     retires nothing and reads in the output exactly like a real entry. */
  const names = ALL_ROLES.map(r => r.name)
  const taken = new Set(rows.map(r => r.token))
  const free = names.filter(n => !taken.has(n))

  return (
    <Collapsible title="Retired Tokens" note={rows.length ? `${rows.length}` : 'none'}>
      <p className="panel-note">
        A retired token still resolves, so nothing breaks today, and it carries a
        mark saying it is going: <code>$deprecated</code> in <code>tokens.json</code>,
        a comment above the declaration in <code>tokens.css</code>, and a row in
        DESIGN.md. <code>VERIFY.mjs</code> fails any file that still uses one and
        names the replacement.
      </p>
      {/* ── EVERY CLASS HERE IS A CHROME CLASS ──
       *
       * The first version reached for `.card`, `.row`, `.card-actions`,
       * `.btn` and `.btn-sm`. All five are scoped to `.dmd` in preview.css and
       * do not exist out here, so they styled nothing and no guard fired,
       * because every name is real somewhere.
       *
       * Measured before the fix: two buttons carrying one class, at 19px and
       * 49px, because each was sized by its own words. `.btn-add` and
       * `.btn-delete` are the chrome's own primitives for exactly this shape,
       * and `.btn-delete` already floors itself at the 24px target. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: PAD.row, marginTop: PAD.gap }}>
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 12px', color: 'var(--dim)', fontSize: 12, border: '1px dashed var(--bdr)', borderRadius: 8 }}>
            Nothing is retired, so nothing about retirement reaches the payload.
          </div>
        )}
        {rows.map((r, i) => (
          <div key={i} style={{ border: '1px solid var(--bdr2)', borderRadius: 8, padding: PAD.sub }}>
            <div className="action-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: PAD.sub }}>
              <select value={r.token} style={{ flex: 1, minWidth: 0 }}
                aria-label="Retired role"
                onChange={e => upd(i, 'token', e.target.value)}>
                {[r.token, ...free].filter(Boolean).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              {/* `ConfirmDelete`, never a typed glyph in a button. It carries
                  the icon set's own trash mark, asks before it acts, and its
                  shell is the same `.btn-delete` every other row uses. */}
              <ConfirmDelete title={`Restore ${r.token}`}
                onConfirm={() => write(rows.filter((_, j) => j !== i))} />
            </div>
            <div style={{ marginBottom: PAD.sub }}>
              <label>Use instead</label>
              <select value={r.replacement ?? ''} onChange={e => upd(i, 'replacement', e.target.value)}>
                <option value="">— none —</option>
                {names.filter(n => n !== r.token).map(n => (
                  <option key={n} value={`--c-${n}`}>{`--c-${n}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Why</label>
              <input value={r.reason ?? ''} onChange={e => upd(i, 'reason', e.target.value)}
                placeholder="Split into two roles with different contrast bars." />
            </div>
          </div>
        ))}
      </div>
      {free.length > 0 && (
        <button className="btn-add"
          onClick={() => write([...rows, { token: free[0], replacement: '', reason: '' }])}>
          Retire a token
        </button>
      )}
    </Collapsible>
  )
}

function MetaGlobalTab() {
  return (
    <div>
      <MetaTab />
      {/* One decision, in one place. 48 between two sections, and a rule sits
          in the middle of that 48 rather than adding to it. Pass rule={false}
          where a boundary needs no line. */}
      <SectionBreak />
      <GlobalMetrics />
      <SectionBreak />
      <RetiredSection />
      <SectionBreak />
      <RtlSection />
    </div>
  )
}

/* ── Shell ── */
const TABS = [
  { id: 'meta',       label: 'Meta/Global', Panel: MetaGlobalTab },
  { id: 'colors',     label: 'Colour',     Panel: ColorPanel },
  { id: 'roles',      label: 'Roles',      Panel: RolesPanel },
  { id: 'type',       label: 'Type',       Panel: TypographyPanel },
  { id: 'layout',     label: 'Layout',     Panel: LayoutPanel },
  { id: 'shape',      label: 'Shape',      Panel: ShapePanel },
  { id: 'depth',      label: 'Depth',      Panel: DepthPanel },
  { id: 'motion',     label: 'Motion',     Panel: MotionPanel },
  { id: 'components', label: 'Components', Panel: ComponentsPanel },
  { id: 'directives', label: 'Directives', Panel: DirectivesPanel },
  { id: 'rationale',  label: 'Rationale',  Panel: RationaleTab },
  { id: 'history',    label: 'History',    Panel: HistoryPanel },
]

/* Which kind of thing each tab's rows are, so a jump from anywhere can hand
   the destination panel something it recognises. One table, one place to be
   wrong. */
const TAB_KIND = { components: 'component', roles: 'role', type: 'type' }
const KIND_TAB = { component: 'components', role: 'roles', type: 'type' }

function Shell() {
  const { state, derived, set, load, undo, redo, canUndo, canRedo, lastTag } = useStore()
  const [tab, setTab] = useState('colors')
  const [showFile, setShowFile] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)

  /* ── Phone layout ──
   *
   * Below 768px the two panes cannot both be useful, so one shows at a time
   * and a tab bar switches between them. Stack Panes is the escape hatch for
   * anyone who wants the old behaviour: both panes down the page, with the
   * tabs scrolling to whichever you press.
   *
   * The editor is the default. You open this to work. Reviewing is one tap
   * away either way, and the choice persists for the session. */
  const isMobile = useMedia(MOBILE_Q)
  /* The title bar folds on its own schedule, measured from its own contents.
     `barCompact` is true on a phone too, since a phone is narrower than any
     of these thresholds. */
  const barCompact = useMedia(BAR_FULL_Q)
  const barTrim = useMedia(BAR_TRIM_Q)
  /* Does the words group have anything left to show? Every child of it is
     behind one of these two guards, so on a phone it renders empty — and an
     empty flex child still takes the free space. Ask before rendering it. */
  const hasWords = !barTrim || !isMobile
  const [mobilePane, setMobilePane] = useState('editor')
  const [stackPanes, setStackPanes] = useState(false)
  /* The name field is folded away on a phone and the pencil unfolds it.
     A second line spent permanently on a field you edit once a session is a
     poor trade for a 375px screen. It rolls back up when you leave it. */
  const [nameOpen, setNameOpen] = useState(false)
  const nameRef = useRef(null)
  useEffect(() => {
    if (!nameOpen) return
    /* Focus after the fold has started, or the browser scrolls to a field
       that is still zero height. */
    const t = setTimeout(() => nameRef.current?.querySelector('input')?.focus(), 90)
    return () => clearTimeout(t)
  }, [nameOpen])
  const editorPaneRef = useRef(null)
  const previewPaneRef = useRef(null)

  /* Stacked mode turns the tabs into anchors rather than a switch.
   *
   * Not `scrollIntoView`. That puts the target's top at the viewport's top,
   * which here is underneath the sticky title bar and tab bar — so the first
   * hundred pixels of the pane you asked for land behind the chrome and it
   * reads as scrolling past it.
   *
   * Measured at click time rather than stored: the title bar is one line on a
   * phone and the tab bar only exists at this width, so the number changes
   * with the layout and a constant would be wrong the moment either did. */
  const stickyRef = useRef(null)
  const showPane = id => {
    setMobilePane(id)
    if (!stackPanes) return
    const el = (id === 'editor' ? editorPaneRef : previewPaneRef).current
    if (!el) return
    const chrome = stickyRef.current?.getBoundingClientRect().height ?? 0
    const top = el.getBoundingClientRect().top + window.scrollY - chrome
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }
  /* Carries a timestamp so clicking the same element twice re-triggers the
     jump rather than being deduplicated as an unchanged value. */
  const [inspect, setInspect] = useState(null)
  /* A jump from one panel to a row on another. The accessibility audit is the
     first caller: reading that `checkbox` is 16px and then hunting for the
     checkbox across thirteen tabs is how audits get abandoned. */
  const navigate = useCallback((toTab, entry) => {
    setTab(toTab)
    setInspect(entry && TAB_KIND[toTab] ? { entry, kind: TAB_KIND[toTab], at: Date.now() } : null)
  }, [])

  /* Applies a finding's own remedy, where it has one the app computed.
     It still navigates afterwards: the change lands in front of you rather
     than somewhere you have to go and verify, and undo reverses it like any
     other edit. */
  /* ── FIX IT ASKS FIRST ──
   *
   * It used to change the document on the first click. That is fine for a
   * spacing nudge and wrong for a colour: the remedy moves a semantic role to a
   * different step of its ramp, and a role is a decision somebody made.
   *
   * So the button now opens a preview. `pendingFix` holds what it would do until
   * the reader agrees. */
  const [pendingFix, setPendingFix] = useState(null)

  const applyFinding = useCallback(fix => {
    if (!fix) return
    /* `withFinding` is the one writer. The preview derives its candidate from
       the same function, so the picture cannot promise a change this does not
       make. */
    set(s => withFinding(s, fix), `role:${fix.role}:${fix.mode}`)
    setPendingFix(null)
    /* Still navigates. The change lands in front of you rather than somewhere
       you have to go and verify, and undo reverses it like any other edit. */
    navigate('roles', fix.role)
  }, [set, navigate])
  /* The previous session's document, offered rather than loaded. */
  const [restorable, setRestorable] = useState(null)

  /* ── THE LAUNCH FORK ──
   *
   * `null` until the mount effect has decided, so the fork cannot flash on a
   * reload that is about to restore a document. 'fork' shows the two doors,
   * 'wizard' the seven question pages, and 'off' the editor as it has always been.
   *
   * A saved cloud project (`/p/...`) never sees it. That URL is a request for
   * one specific document, and a modal over it asks a question already
   * answered by the link they clicked. */
  const [casual, setCasual] = useState(null)
  /* Held in a ref so the effect can clear it. A stray timeout firing after an
     unmount is the React warning that means a leak somewhere else. */
  const forkTimer = useRef(0)
  /* Owned here rather than in Canvas so the HTML export can render it. */
  const [surface, setSurface] = useState('dashboard')
  const [uiSpeed, setUiSpeed] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(ANIM_KEY), 10)
      return Number.isFinite(saved) && saved >= 0 && saved <= UI_ANIM_MAX ? saved : UI_ANIM_DEFAULT
    } catch { return UI_ANIM_DEFAULT }
  })
  /* Kept in localStorage rather than in the document: it's a preference about
     the tool, and it should follow you between projects rather than travelling
     inside a file you hand to someone else. */
  const [uiTheme, setUiTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
  })
  /* One entry per theme, so switching back finds the setting you left. */
  const [uiBright, setUiBright] = useState(() => {
    try { return { ...UI_B_DEFAULTS, ...JSON.parse(localStorage.getItem(BRIGHT_KEY) || '{}') } }
    catch { return { ...UI_B_DEFAULTS } }
  })
  const [uiHue, setUiHue] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(HUE_KEY), 10)
      return Number.isFinite(saved) && saved >= 0 && saved <= 360 ? saved : UI_HUE_DEFAULT
    } catch { return UI_HUE_DEFAULT }
  })

  const readScale = key => {
    try {
      const saved = parseInt(localStorage.getItem(key), 10)
      return Number.isFinite(saved) && saved >= UI_SCALE.min && saved <= UI_SCALE.max
        ? saved : UI_SCALE.def
    } catch { return UI_SCALE.def }
  }
  const [uiScale, setUiScale] = useState(() => readScale(SCALE_KEY))
  const [prevScale, setPrevScale] = useState(() => readScale(PSCALE_KEY))
  /* Unlinked unless you say otherwise — see PreviewScaleControl. */
  const [prevLink, setPrevLink] = useState(() => {
    try { return localStorage.getItem(PLINK_KEY) === 'true' } catch { return false }
  })

  /* The document's own typefaces, requested here rather than in the Typography
     panel. The preview renders on every tab, so panel-scoped loading meant the
     mock screens spent most of their life showing a fallback face — the one
     thing a type preview must never do. The Typography panel re-requests the
     same families with their full variable-axis ranges once the catalogue has
     loaded; `loadFont` upgrades the existing link rather than duplicating it. */
  useEffect(() => { loadDocumentFonts(state.type.families) }, [state.type.families])

  /* Drives `--t`, which every editor transition reads. The preview keeps its
     own durations — those are the user's motion tokens, not the tool's. */
  useEffect(() => {
    document.documentElement.style.setProperty('--t', `${uiSpeed}ms`)
    document.documentElement.classList.toggle('no-anim', uiSpeed === 0)
    try { localStorage.setItem(ANIM_KEY, String(uiSpeed)) } catch { /* ignore */ }
  }, [uiSpeed])

  /* Drives `--ui-h`, which every chrome neutral is expressed against. */
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-h', String(uiHue))
    try { localStorage.setItem(HUE_KEY, String(uiHue)) } catch { /* ignore */ }
  }, [uiHue])

  /* Drives `--ui-zoom`, the unitless factor the app root multiplies by.
   *
   * On the root element rather than on the app's own div, because the two
   * things that have to agree about it are the zoom and the viewport height —
   * `100vh` is not affected by zoom, so a zoomed root would overflow by
   * exactly the zoom factor and `overflow: hidden` would eat the bottom of the
   * page. The root div divides by this to compensate, and the popovers that
   * position themselves from pointer coordinates divide by it too. */
  useEffect(() => {
    document.documentElement.style.setProperty('--ui-zoom', String(uiScale / 100))
    try { localStorage.setItem(SCALE_KEY, String(uiScale)) } catch { /* ignore */ }
  }, [uiScale])

  /* Drives `--preview-zoom`, the scale the preview surface ends up at.
   *
   * Absolute, not relative: the preview divides this by `--ui-zoom` to cancel
   * the body zoom it is already sitting inside, so the two multiply back to
   * exactly this number. Setting it to 1 means one preview pixel is one screen
   * pixel no matter what the chrome is doing, which is the only way "is this
   * text too small" stays a question the preview can answer. */
  useEffect(() => {
    const effective = prevLink ? uiScale : prevScale
    document.documentElement.style.setProperty('--preview-zoom', String(effective / 100))
    try {
      localStorage.setItem(PSCALE_KEY, String(prevScale))
      localStorage.setItem(PLINK_KEY, String(prevLink))
    } catch { /* ignore */ }
  }, [prevScale, prevLink, uiScale])

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-b', String(uiBright[uiTheme]))
    try { localStorage.setItem(BRIGHT_KEY, JSON.stringify(uiBright)) } catch { /* ignore */ }
  }, [uiBright, uiTheme])

  /* Selects the light block in theme.js, and tells the browser which way the
     page leans so its own form controls and scrollbars follow. */
  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', uiTheme)
    try { localStorage.setItem(THEME_KEY, uiTheme) } catch { /* ignore */ }
  }, [uiTheme])
  const [notice, setNotice] = useState(null)
  const [projectId, setProjectId] = useState(null)
  const [editToken, setEditToken] = useState(null)
  const [serverVersion, setServerVersion] = useState(null)
  const [syncStatus, setSyncStatus] = useState('local')
  const [linkCopied, setLinkCopied] = useState(false)
  const isInitialSync = useRef(true)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [justSaved, setJustSaved] = useState(false)
  const justSavedTimer = useRef(null)

  /* Open a shared project from /p/:id */
  useEffect(() => {
    const m = window.location.pathname.match(/^\/p\/([^/]+)/)
    if (!m) return
    const id = m[1]
    const token = getStoredToken(id)
    setSyncStatus('saving')
    api.read(id).then(async r => {
      if (!r.ok) { setSyncStatus('local'); setNotice({ tone: 'warn', text: 'That project link could not be opened.' }); return }
      const data = await r.json()
      const { state: migrated, migratedFrom, warning } = migrate(data.state)
      load(migrated)
      setProjectId(id)
      setServerVersion(data.version)
      if (warning) setNotice({ tone: 'warn', text: warning })
      else if (migratedFrom != null) setNotice({ tone: 'info', text: `Upgraded this project from schema v${migratedFrom}. Save to keep the upgrade.` })
      if (token) { setEditToken(token); setSyncStatus('saved') } else setSyncStatus('readonly')
    }).catch(() => setSyncStatus('offline'))
  }, [load])

  /* ── Persistence ──
     One path for both destinations so "saved" means one thing. A cloud
     project PATCHes; anything else writes the local draft. The flash and the
     manual button both go through here. */
  const persist = useCallback(async (reason = 'auto') => {
    if (savingRef.current) return
    const cloud = projectId && editToken && syncStatus !== 'readonly' && syncStatus !== 'conflict'
    savingRef.current = true
    if (cloud) setSyncStatus('saving')
    try {
      if (cloud) {
        const r = await api.update(projectId, editToken, state, serverVersion)
        if (r.status === 409) { setSyncStatus('conflict'); return false }
        if (!r.ok) { setSyncStatus('error'); return false }
        const { version } = await r.json()
        setServerVersion(version)
        setSyncStatus('saved')
      } else {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(state))
        localStorage.setItem(DRAFT_AT_KEY, String(Date.now()))
      }
      setSavedAt({ at: Date.now(), where: cloud ? 'cloud' : 'this browser', reason })
      dirtyRef.current = false
      return true
    } catch {
      if (cloud) setSyncStatus('offline')
      return false
    } finally {
      savingRef.current = false
    }
  }, [state, projectId, editToken, serverVersion, syncStatus])

  /* Debounced autosave. Cloud writes wait longer than local ones. */
  useEffect(() => {
    if (isInitialSync.current) { isInitialSync.current = false; return }
    if (window.location.pathname.startsWith('/p/') && !projectId) return

    /* A lens change is not an edit, so it raises no toast and sets no dirty
       flag. It still rides along with the next real save, which is why it is
       a `return` here rather than a write of its own — the choice survives a
       reload as soon as anything else is saved, and until then nobody has
       been told their untouched document was written to disk.

       Switching the preview between Light and Dark used to announce "Saved to
       this browser" every time, on a document where nothing had changed. */
    if (VIEW_TAGS.has(lastTag)) return

    dirtyRef.current = true
    setDirty(true)
    const t = setTimeout(() => { persist('auto').then(ok => ok && setDirty(false)) }, projectId ? 1500 : 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  /* Opening the app gives you a new document, not whatever you left behind.
     The previous session isn't discarded, though — it's rotated aside and
     offered back through a toast.

     The rotation is guarded: an untouched document never displaces the stored
     one. Without that, opening the app twice without editing would quietly
     overwrite real work with a pristine default, which is precisely the data
     loss this flow exists to avoid. */
  useEffect(() => {
    if (window.location.pathname.startsWith('/p/')) return
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft && !isPristineDoc(draft)) {
        localStorage.setItem(PREV_KEY, draft)
        localStorage.setItem(PREV_AT_KEY, localStorage.getItem(DRAFT_AT_KEY) ?? '')
      }
      localStorage.removeItem(DRAFT_KEY)

      /* DECIDED BEFORE THE EARLY RETURN BELOW. The first version sat after it,
         so a genuine first visit — no previous document, nothing to restore —
         returned before the fork was ever set, and the one case the fork exists
         for was the one case it never appeared in.

         EVERY RELOAD, not once per session: it was gated on a sessionStorage
         flag, so a reload in the same tab went straight to the editor. A `/p/`
         URL never reaches here, which is right — that link already answered the
         question. */

      /* ── A BEAT, THEN THE FADE ──
       *
       * It appeared in the same frame the editor did, so the reader met two new
       * things at once and the fade had nothing to fade FROM. A second of the
       * editor first gives the modal something to arrive over.
       *
       * The beat is tied to the animation preference rather than being its own
       * setting. Somebody who has turned UI animation off has asked for no
       * theatre, and a one-second wait before a modal is theatre. At 0 it opens
       * in the same frame, as it did before.
       *
       * The fade itself is already there: the scrim carries `anim-fade` and the
       * panel `anim-rise`, both over `--t`. */
      const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
      if (!ms) setCasual('fork')
      else forkTimer.current = setTimeout(() => setCasual('fork'), FORK_DELAY)

      const prev = localStorage.getItem(PREV_KEY)
      if (!prev || isPristineDoc(prev)) return
      const at = Number(localStorage.getItem(PREV_AT_KEY))
      setRestorable({
        raw: prev,
        name: JSON.parse(prev)?.meta?.name?.trim() || 'Untitled',
        at: Number.isFinite(at) && at > 0 ? at : null,
      })
    } catch { /* corrupt draft — start fresh rather than crash */ }
    return () => clearTimeout(forkTimer.current)
  }, [])

  /* ── LEAVE, THEN UNMOUNT ──
   *
   * A modal that unmounts on click vanishes in one frame. The enter animation
   * was there from the start and the exit was not, which reads as no animation
   * at all: you see the arrival once and the departure every time.
   *
   * So `leaving` marks it, the panel plays `anim-fall`, and the unmount waits
   * one duration. The duration is read from the token rather than typed, so a
   * reader who turns UI animation down gets a shorter wait and one who turns it
   * off unmounts at once. */
  const [leaving, setLeaving] = useState(false)
  const closeCasual = useCallback((then) => {
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--t'), 10) || 0
    if (!ms) { setLeaving(false); setCasual('off'); then?.(); return }
    setLeaving(true)
    setTimeout(() => { setLeaving(false); setCasual('off'); then?.() }, ms)
  }, [])

  const restorePrevious = useCallback(() => {
    if (!restorable) return
    try {
      const { state: migrated, warning } = migrate(JSON.parse(restorable.raw))
      load(migrated)
      if (warning) setNotice({ tone: 'warn', text: warning })
    } catch {
      setNotice({ tone: 'error', text: 'That saved project could not be read.' })
    }
    setRestorable(null)
  }, [restorable, load])

  const saveToCloud = async () => {
    if (projectId) return
    setSyncStatus('saving')
    try {
      const r = await api.create(state)
      if (!r.ok) throw new Error('save failed')
      const { id, editToken: tk, version } = await r.json()
      isInitialSync.current = true
      setProjectId(id); setEditToken(tk); setServerVersion(version)
      setStoredToken(id, tk)
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      window.history.pushState({}, '', `/p/${id}`)
      setSyncStatus('saved')
      setSavedAt({ at: Date.now(), where: 'cloud', reason: 'create' })
      setDirty(false)
    } catch {
      setSyncStatus('error')
      setNotice({ tone: 'error', text: 'Could not save to the cloud. Is the API running on localhost:8787?' })
    }
  }

  const reloadFromServer = async () => {
    if (!projectId) return
    const r = await api.read(projectId)
    if (!r.ok) return
    const data = await r.json()
    isInitialSync.current = true
    load(migrate(data.state).state)
    setServerVersion(data.version)
    setSyncStatus('saved')
  }

  const saveAs = (text, filename, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  /* Stamp the build, then emit against the stamped state.
   *
   * `set` is async, so the state in scope is still the old one when this
   * returns — generating from it would ship the previous build number in a
   * file the header claims is the new one. So the version is computed once
   * and threaded into both. */
  const stampBuild = () => {
    const version = nextBuild(state.meta.version)
    set(s => ({ ...s, meta: { ...s.meta, version } }), 'meta:version')
    return { ...state, meta: { ...state.meta, version } }
  }

  /* Saves the editor's own state, not a DESIGN.md.
     A DESIGN.md cannot hold this document: the spec allows a component eight
     properties and cannot record variants or sizes at all, so a save-then-load
     through it dropped eight property kinds and flattened the component
     matrix. Export Payload is the handoff. This is the save file. */
  const saveToDevice = () => {
    const stamped = stampBuild()
    const filename = projectFilename(stamped.meta.name)
    saveAs(serializeProject(stamped, { build: stamped.meta.version }), filename, 'application/json')
    setNotice({ tone: 'success', text: `Saved ${filename}. Open it with Load.` })
  }

  /* Accepts either format and tells them apart by content, not by extension.
     A project file restores everything. A DESIGN.md still loads, and still
     warns about what the spec could not carry.

     Both paths parse before they replace, so a bad file leaves the current
     document untouched. The input resets to '' after every pick, or choosing
     the same file twice in a row fires no change event and looks broken. */
  const fileInput = useRef(null)
  const loadProject = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let text
    try {
      text = await file.text()
    } catch {
      setNotice({ tone: 'error', text: `Could not read ${file.name}.` })
      return
    }
    if (text.trimStart().startsWith('{')) {
      const r = parseProject(text)
      if (!r.ok) { setNotice({ tone: 'error', text: `Could not open ${file.name}. ${r.error}` }); return }
      load(r.state)
      setNotice({
        tone: 'success',
        text: `Opened ${file.name}.${r.warnings.length ? ' ' + r.warnings.join(' ') : ''}`,
      })
      return
    }
    openDocument(text, file.name)
  }

  const copyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1800)
  }

  /* One dispatcher for both call sites. The desktop header renders these as
     buttons and the phone header renders them as menu rows, so routing them
     through the same function stops the two from doing different things under
     the same label. Resolved on call, not on definition, because half of
     these are declared further down the component. */
  const runProjectAction = id => ({
    newProject: () => setShowNew(true),
    /* Straight to the questions, not to the fork. Somebody who picked this
       has already chosen the guided path, and the fork would ask again. */
    newGuided: () => setCasual('wizard'),
    loadProject: () => fileInput.current?.click(),
    saveToDevice,
    saveToCloud: projectId ? copyShareUrl : saveToCloud,
    previewFile: () => setShowFile(true),
  }[id]?.())

  /* Everything a developer needs, in one archive: the file for the agent, the
     token formats a build can enforce, and every surface as a page they can
     open and read the markup of. Same `derive()` behind all of it, so nothing
     in the zip can contradict anything else in it. */
  const [packaging, setPackaging] = useState(false)
  const exportPackage = async () => {
    setPackaging(true)
    try {
      const [{ renderToStaticMarkup }, html, { payloadTextFiles, exampleFilename, HTML_EXAMPLES_MODES }, { zip }] = await Promise.all([
        import('react-dom/server'),
        import('./emit/html.js'),
        import('./emit/payload.js'),
        import('./emit/zip.js'),
      ])
      /* One stamp for the whole package, so the DESIGN.md, the README and
         every token file in the zip name the same build. */
      const stamped = stampBuild()
      const slug = html.slugify(stamped.meta.name)
      /* The text files come from a module the test suite can import, so what
         a user receives is asserted rather than assumed. See emit/payload.js. */
      const files = payloadTextFiles(stamped, derived)
      /* Both themes, every surface, always.
         The dark palette is half the work in the document and none of it was
         shipping — an agent got six light pages and a table of dark hex codes,
         which is not the same thing. Dark mode is where a system usually comes
         apart: surfaces have to lift instead of the shadows deepening, and a
         colour that carried on paper stops carrying on ink. Showing it is the
         only way that reads.

         Not conditional on the editing mode. That setting says which theme you
         are working on, and `tokens.css` ships both regardless — so gating the
         examples on it would leave half the exported system undemonstrated
         while the values for it sat right there in the file.

         The markup is rendered once and reused. It is identical between the
         two, because the theme is a variable swap and nothing else — which is
         itself worth demonstrating. */
      const modes = HTML_EXAMPLES_MODES
      for (const s of SURFACES) {
        const markup = renderToStaticMarkup(
          <div className="dmd-frame"><div className="dmd"><s.Component layout={derived.componentLayout} tabStyle={stamped.components?.tabStyle} /></div></div>
        )
        for (const mode of modes) {
          files[exampleFilename(mode, s.id)] =
            html.previewHtml({ state: stamped, derived, markup, surface: s.label, mode })
        }
      }
      /* `zip` deflates through the browser's own CompressionStream, so it is
         async now. The whole export already sits inside a try and a
         `setPackaging` guard, so the await costs nothing here. */
      const url = URL.createObjectURL(await zip(files))
      const a = document.createElement('a')
      a.href = url; a.download = `${slug}-design-package.zip`; a.click()
      URL.revokeObjectURL(url)
      setSavedAt({ at: Date.now(), where: `a package of ${Object.keys(files).length} files`, reason: 'export' })
    } catch {
      setNotice({ tone: 'error', text: 'Could not build the design package.' })
    } finally {
      setPackaging(false)
    }
  }

  /* Seeds only, because seeds are what everything else generates from — set
     those and the scales, roles and every component follow. Writing further
     downstream would paste in values that no longer track anything. */
  /* Only the slots the mapping table confirmed. Anything absent is untouched
     — which is the point: a seed left alone keeps every scale, role and
     component derived from it coherent, where blanking it would leave a hole
     an agent has to guess its way out of. */
  const applyCssImport = ({ seeds, families, spacingBase, radiusBase, fontBase }) => {
    const n = Object.keys(seeds ?? {}).length + Object.keys(families ?? {}).length
      + [spacingBase, radiusBase, fontBase].filter(v => v != null).length

    set(s => {
      const next = { ...s }
      if (seeds && Object.keys(seeds).length) {
        next.color = { ...s.color, seeds: s.color.seeds.map(x => seeds[x.name] ? { ...x, hex: seeds[x.name] } : x) }
      }
      if (families && Object.keys(families).length) {
        next.type = {
          ...s.type,
          families: Object.fromEntries(Object.entries(s.type.families).map(([role, cur]) =>
            [role, families[role] ? { ...cur, family: families[role] } : cur])),
        }
      }
      if (fontBase) next.type = { ...(next.type ?? s.type), base: fontBase }
      if (spacingBase) next.space = { ...s.space, base: spacingBase }
      if (radiusBase) next.radius = { ...s.radius, base: radiusBase }
      return next
    }, 'css-import')

    setNotice({
      tone: 'info',
      text: `Imported ${n} ${n === 1 ? 'value' : 'values'}. Everything downstream regenerated from them; anything you left unchecked kept what it had. Undo if it isn’t what you wanted.`,
    })
  }

  /* The modal has already read the text, so this only has to parse it. A
     failed parse leaves the current document untouched — the whole point of
     doing the work here rather than optimistically loading and rolling back. */
  const openDocument = (text, label) => {
    const result = parseFile(text)
    if (!result.ok) { setNotice({ tone: 'error', text: `Could not import ${label}. ${result.error}` }); return }
    load(result.state)
    setNotice(result.warnings.length
      ? { tone: 'warn', text: `Imported ${label}. ${result.warnings.join(' ')}` }
      : { tone: 'success', text: `Imported ${label}.` })
  }

  const swatches = [derived.roles.light.accent, derived.roles.light.bg, derived.roles.light.surface, derived.roles.light.text, derived.roles.light.success, derived.roles.light.warning, derived.roles.light.danger].filter(isValidColor)

  const Panel = TABS.find(t => t.id === tab)?.Panel ?? MetaTab

  return (
    <>
      <style>{APP_CSS}</style>
      {/* The zoom itself is on `body` (see theme.css) so that portalled
          overlays are inside it — the token colour picker renders into
          document.body and would otherwise be the one panel still drawn at
          100% while everything around it grew.
          *
          The height divides the zoom back out: `vh` is a viewport unit and
          does not scale, so a zoomed 100vh overflows by exactly the zoom
          factor and the hidden overflow swallows the bottom of the app. */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        /* Stacked mode is the one layout that scrolls the document rather
           than a pane inside it. A fixed height with hidden overflow would
           clip the second pane away entirely. */
        ...(isMobile && stackPanes
          ? { minHeight: 'calc(100vh / var(--ui-zoom, 1))', overflow: 'visible' }
          : { height: 'calc(100vh / var(--ui-zoom, 1))', overflow: 'hidden' }),
      }}>

        {/* The title bar and the pane tabs stick as one unit.
            They were two sticky elements, and the second needed a `top` equal
            to the height of the first — a number I had to guess, guessed 39
            against a real 50, and the tab bar slid under the title bar. One
            sticky wrapper has no number to get wrong. */}
        <div ref={stickyRef} style={{ position: 'sticky', top: 0, zIndex: 'var(--z-sticky)', flexShrink: 0, background: 'var(--surf)' }}>
        {/* Two lines on a phone, one on a desktop.
            Five things in 375px left the project name showing "My Desi", which
            names nothing, and squeezed everything else against it. Wrapping is
            free vertical space, and a title bar is allowed to use it. Line one
            is what this document is. Line two is what you can do to it. */}
        <header style={{
          /* Centred on a phone, baseline-aligned on a desktop.
             Every control on the phone row is a flex button carrying an icon,
             and a flex box with centred contents puts nothing in the baseline
             set — so each one synthesises a baseline from its icon's bottom
             edge, and they came out 2.5px apart. Equal heights plus centring
             puts their text within 0.4px without asking for baselines at all.
             The desktop row mixes text and controls, so it still wants them. */
          /* Baseline, because this row is mostly TEXT.
           *
           * It was centred for one commit, to settle a 0.5px step between the
           * mark and the buttons. That worked on the boxes and broke every word
           * in the row: centring removes each item from the baseline set, so a
           * 15px wordmark, a 9.5px chip and a 13px button label each centred on
           * their own box and landed on three different lines. Measured against
           * the button labels at 29.00 — wordmark 29.75, dev 26.88, unbuilt
           * 27.63. They spotted it and marked the corrections on a screenshot:
           * one up, two down, one down. Those are these numbers.
           *
           * Boxes are the minority here and they opt out with `align-self`.
           * Text is the majority and it keeps the baseline. That is the right
           * way round — a row of words with a square in it is not a row of
           * squares. */
          /* Count what the row holds, and the answer differs by width.
           *
           * Wide, it is mostly words — a wordmark, a build chip, a name field,
           * button labels at five sizes — so it takes baseline and they share
           * one line.
           *
           * On a phone every one of those words is gone. What is left is five
           * controls of one height and no free text at all, so it centres.
           * Under baseline the two that still had a word sat at 9.5 and the
           * three icon-only ones synthesised a baseline from an edge and sat at
           * 8. Nothing was misaligned by the rules; the rules were being asked
           * a question the row no longer contained.
           *
           * Inline, not in the stylesheet, because an inline style beats a rule
           * and a media query cannot reach this. */
          display: 'flex', alignItems: isMobile ? 'center' : 'baseline',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          /* Both axes named, and no `gap` shorthand.
           *
           * This read `rowGap: isMobile ? 6 : 0, gap: isMobile ? 8 : 13`, and
           * the 6 never once applied: a style object obeys declaration order
           * like a stylesheet, so the shorthand written after it set BOTH axes
           * and overwrote the row value. The bar ran an 8px row gap that
           * nothing had chosen.
           *
           * Zero, not 6, because the row that wraps supplies its own spacing.
           * The project name row animates `margin-top` from 0 to 6 as it
           * opens, and a margin on a flex child ADDS to the container's gap —
           * so the open gap was 14 and, worse, the CLOSED one was 8. A row
           * collapsed to `max-height: 0` still sits on a flex line, and the
           * line gap is charged whether or not anything is in it. Measured:
           * the bar stood 65px tall to hold 40px of button, and 9 of those
           * pixels were a gap under a row nobody had opened. */
          /* 8 is the base gap between header children, and it IS the gap
             between Project and Export Payload — they are one action group.
             The two 16s are group separators, carried as margins on the two
             children that need them: the readouts before Project, and Export
             Payload before UI. Stated by them, 14 August 2026. */
          columnGap: 8, rowGap: 0,
          /* Symmetric. 7 over 5 shifted the whole row 1px off centre inside its
             own band, which is invisible until something in it is measured. */
          padding: isMobile ? '8px 12px' : '6px 20px',
          borderBottom: '1px solid var(--bdr)', background: 'var(--surf)',
        }}>
          {/* The mark sits HERE, beside the text group rather than inside it.
           *
           * It is a square, not a word, and a square inside a baseline-aligned
           * run of words is positioned by those words. Measured while it was in
           * there: the text group's box ran 7 to 43 against the buttons' 6 to
           * 42 — same 36px height, one pixel lower, because the two groups had
           * different ascents above the shared baseline (22 against 23). The
           * mark then centred in the wrong box.
           *
           * Out here it centres against the header band and lands within 0.5px
           * of the buttons, which is half a CSS pixel and below the threshold
           * worth chasing. The words keep their baseline either way. */}
          {/* Two letters in the same box the single D had, so the mark
              keeps its size — tighter tracking rather than a smaller face,
              which would make it read as secondary next to the wordmark. */}
          {/* Square, and the same height as the buttons beside it.
              At 26 against their 36 it read as a smaller class of object
              sitting in a row of controls. A mark in a control row is part
              of that row, so it takes the row's height and stays 1:1. */}
          {/* `minWidth` as well as `width`, or a squeezed flex row takes it
              back down. It measured 32 by 36 with `width` alone, which is a
              rectangle wearing a square's border radius. */}
          {/* The size comes from a custom property, not from BAR_CTRL.
              The constant said 36 and matched the buttons, until the touch
              breakpoint promoted every header button to 40 and could not
              reach an inline style to promote this with them. It measured 36
              against their 40 on a phone — a mark half a step short of the
              row it belongs to, which is the fault the constant was added to
              prevent. A custom property lets the same media query move both. */}
          {/* baseline, not center. The letters in here are text on the row's
              line and belong on the row's baseline — they sat at 30 against
              everyone else's 29 while this centred. Sizing and the line box
              live in the stylesheet, where the touch breakpoint can reach
              them; flex centring is gone because it hides the letters from the
              row and tells it nothing about where they landed. */}
          <div className="bar-mark" style={{ borderRadius: 8, background: 'var(--accent)', alignSelf: 'baseline', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.04em', color: 'var(--bg)', flexShrink: 0 }}>MD</div>

          {/* The words. Baseline-aligned, so every size in here shares one
              line with the button labels across the bar.
           *
           * `hasWords` because every child below is behind a trim guard, and on
           * a phone all of them go. The group then rendered as an empty box
           * with `flex: 1`, which still claims the free space — measured 38.9px
           * of nothing between the mark and the first button, and those 38.9px
           * were exactly what pushed the last button onto a second row.
           *
           * It never showed while the mark lived inside this group, because the
           * group was never empty. Moving the mark out to fix a baseline made an
           * empty flex child possible for the first time. A restructure creates
           * states the old structure could not reach, which is the argument for
           * re-measuring the row you touched rather than the fault you fixed. */}
          {hasWords && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 1, minWidth: 0 }}>
            {/* The wordmark, build number and palette are the first things to
                go. The squircle already says which app this is, and the name
                field is the only part of this group you can act on. */}
            {!barTrim && (
              <>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>
                  MD<span style={{ color: 'var(--muted)', fontWeight: 400 }}>exed</span>
                </span>
                <AppBuild />
              </>
            )}
            {!isMobile && (
              <TitleField name={state.meta.name}
                onCommit={next => set(s => ({ ...s, meta: { ...s.meta, name: next } }), 'meta:name')} />
            )}
            {!barTrim && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 4, alignSelf: 'center' }}>
                {swatches.map((hex, i) => <div key={i} className="swatch" style={{ width: 12, height: 12, background: hex, cursor: 'default' }} />)}
              </div>
            )}
          </div>
          )}

          {/* Scrolls rather than clips.
           *
           * This row was `flexShrink: 0` against a title that could shrink to
           * nothing, so below about 1220px the buttons ran off the right edge
           * and simply became unreachable — no scrollbar, no wrap, no way to
           * press Export at all. A 14" laptop with any browser zoom lands
           * there. Now the row keeps its own size and the header scrolls to
           * it, so the far end is always reachable even when the window is
           * too narrow to show everything at once. */}
          {/* Baseline, and no 1px pad. The padding was a correction and it is
              gone. The alignment is not: this group has to donate a baseline to
              the header, and a centred flex container donates nothing — it
              leaves the baseline set empty and the header then synthesises one
              from an edge. That is what put the wordmark, the build chip and
              the name field on three different lines.

              Its own buttons are all one height, so baseline and centre agree
              inside here. The difference only shows one level up. */}
          {/* `marginLeft: auto`, so the actions sit against the right edge
              whatever else is on the bar.
           *
           * They were held there by the words group's `flex: 1` — the wordmark,
           * the name field and the palette. That group is behind `hasWords` and
           * goes entirely on a narrow bar, and the actions then packed left
           * against the mark with 226px of empty bar to their right. The mark
           * belongs on the left and everything else belongs on the right, and
           * nothing in the layout said so: it was a side effect of a group that
           * is allowed to disappear.
           *
           * An auto margin rather than `space-between` on the bar. Between
           * spreads the slack across EVERY gap, so the four action groups would
           * drift apart from each other as the bar widened. The margin puts all
           * of it in one place and leaves the groups packed. Where the words
           * group does render, its `flex: 1` takes the free space first and the
           * margin resolves to zero, so one rule covers both widths. */}
          <div className="no-bar" style={{
            /* 8, the same step as the header's own gap. One number covers
               every gap in this bar: button to button in here, and header
               child to header child out there. */
            display: 'flex', gap: 8, alignItems: 'baseline',
            minWidth: 0, marginLeft: 'auto', overflowX: 'auto', overflowY: 'hidden',
            scrollbarWidth: 'none',
          }}>
            {/* Two readouts, then the controls. Tighter gap between them than
                to the buttons, so they group as one unit rather than reading
                as two more things to click.

                State both gaps together, because proximity is a ratio. The
                buttons sit 6px apart and the two readouts 8px, so a 2px margin
                left the whole thing one undifferentiated run — the readouts
                read as two more things to click, which is the exact opposite
                of what this group is for. 24px to the first button is 4:1
                against the button gap and clears the 3:1 bar.

                A margin on a flex child ADDS to its container's gap, so the
                margin is 16 less that gap — written as the subtraction to keep
                the 16 visible. One value covers both widths, because the row
                and the header now share an 8px gap: wide, the next thing is
                the first button inside this row; compact, the buttons are gone
                and it is the Project menu out in the header. */}
            {!barTrim && (
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                marginRight: 'calc(var(--space-md, 16px) - 8px)',
              }}>
                <VersionChip version={state.meta.version} />
                <SyncBadge status={syncStatus} />
              </div>
            )}
            {syncStatus === 'conflict' && (
              <button className="btn-ghost" onClick={reloadFromServer} style={{ padding: BTN.lg, color: 'var(--danger)', borderColor: 'rgb(var(--danger-rgb) / .4)' }}>Reload</button>
            )}
            {/* Ordered by the life of a document: make one, open one, save it
                two ways, look at it, hand it over. Export Payload sits last
                and carries the only filled style, because it is the one
                action the whole app exists to produce.

                On a phone this whole run collapses into the Project menu. */}
            {!barCompact && PROJECT_ACTIONS.map(a => {
              /* Once saved, the cloud button has nothing left to do, so the
                 slot turns into the thing you actually want next. */
              if (a.id === 'saveToCloud' && projectId) return (
                <button key={a.id} className="btn-ghost" onClick={copyShareUrl}
                  style={{ padding: BTN.lg, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, color: linkCopied ? 'var(--success)' : 'var(--muted)' }}>
                  <Copy /><span className="lbl">{linkCopied ? 'Link copied' : 'Copy share URL'}</span>
                </button>
              )
              return (
                <button key={a.id} className={a.id === 'saveToCloud' ? 'btn-fill' : 'btn-ghost'}
                  onClick={() => runProjectAction(a.id)} title={a.hint}
                  style={{ padding: BTN.lg, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <a.Icon /><span className="lbl">{a.label}</span>
                </button>
              )
            })}
            {/* The accent in outline form, one step below the filled Export it
                sits beside. Reading the file and shipping it are the same act
                at two levels of commitment, so they share a colour. */}
            {!barCompact && (
              <button className="btn-outline" onClick={() => setShowFile(true)} title="Read the generated file before you export it"
                style={{ padding: BTN.lg, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Eye /><span className="lbl">Preview DESIGN.md</span>
              </button>
            )}
            {/* Off-screen rather than hidden: a `display:none` input cannot be
                opened by `.click()` in every browser. */}
            <input ref={fileInput} type="file" accept={`${PROJECT_EXT},.json,.md,.markdown,.txt,application/json,text/markdown`} onChange={loadProject}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} tabIndex={-1} aria-hidden="true" />
          </div>

          {/* Outside the scrolling row on purpose. An absolutely positioned
              popover is clipped by any ancestor with overflow, and the row
              above is now a scroller — leaving the menu inside it painted the
              dropdown into a 44px-tall slot, so it opened and was invisible.
              It also should not scroll out of reach: whatever else is too
              narrow to fit, the settings stay put. */}
            {/* Preview DESIGN.md joins the menu here, because its own button is
                hidden at this width. Without this it had no route at all on a
                phone, which is worse than the crowding it was hidden to fix. */}
            {barCompact && (
              <ProjectMenu projectId={projectId} onAction={runProjectAction}
                items={[...PROJECT_ACTIONS, { id: 'previewFile', label: 'Preview DESIGN.md', Icon: Eye, hint: 'Read the generated file' }]} />
            )}
            {/* Sits AFTER the Project menu, and outside the scrolling row.
             *
             * Inside the row it came before Project, because Project renders
             * out here to keep its popover clear of the row's overflow — an
             * absolutely positioned menu is clipped by any scrolling ancestor.
             * So the one action the whole app exists to produce was landing to
             * the LEFT of the menu that collapses everything else.
             *
             * Out here it keeps the order at both widths: the run of project
             * buttons, then Project where they collapse into it, then Export.
             * It also stops scrolling out of reach, which is right for a
             * primary action — the same reason the settings stay put. */}
            <button className="btn-primary" onClick={exportPackage} disabled={packaging}
              title="AGENTS.md, DESIGN.md, tokens.css, a Tailwind preset, tokens.json and every surface as HTML — one zip"
              /* 16 to the UI menu beside it: Export closes the document group,
                 and UI is settings, a different thing. 16 less the header's
                 own 8px gap. */
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                marginRight: 'calc(var(--space-md, 16px) - 8px)' }}>
              <Download /><span className="lbl keep-lbl">{packaging ? "Packaging…" : "Export Payload"}</span>
            </button>
            {/* The name folds away, and the pencil unfolds it.
                A permanent second line for a field you touch once a session is
                a poor trade on a 375px screen. Open it, type, leave it, and it
                rolls back up. Same duration and easing as the rest of the
                chrome, so it reads as part of the same machine. */}
            {isMobile && (
              <button className="btn-ghost" onClick={() => setNameOpen(o => !o)}
                title={nameOpen ? 'Done renaming' : 'Rename this project'}
                aria-expanded={nameOpen} aria-controls="project-name-row"
                style={{ padding: BTN.lg, flexShrink: 0, color: nameOpen ? 'var(--accent)' : 'var(--muted)' }}>
                <Pencil />
              </button>
            )}
            {isMobile && (
              <div id="project-name-row" ref={nameRef}
                onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setNameOpen(false) }}
                style={{
                  flex: '1 0 100%', minWidth: 0, order: 2,
                  overflow: 'hidden',
                  maxHeight: nameOpen ? 52 : 0,
                  opacity: nameOpen ? 1 : 0,
                  marginTop: nameOpen ? 6 : 0,
                  transition: 'max-height var(--t) var(--ease), opacity var(--t) var(--ease), margin-top var(--t) var(--ease)',
                }}>
                <TitleField full name={state.meta.name}
                  onCommit={next => {
                    set(s => ({ ...s, meta: { ...s.meta, name: next } }), 'meta:name')
                    setNameOpen(false)
                  }} />
              </div>
            )}
            <ToolsMenu uiSpeed={uiSpeed} setUiSpeed={setUiSpeed} uiHue={uiHue} setUiHue={setUiHue}
              uiScale={uiScale} setUiScale={setUiScale}
              prevScale={prevScale} setPrevScale={setPrevScale} prevLink={prevLink} setPrevLink={setPrevLink}
              uiTheme={uiTheme} setUiTheme={setUiTheme} uiBright={uiBright} setUiBright={setUiBright} />
        </header>

        {/* ── The phone pane switcher ──
         *
         * Sticky under the title bar. In switch mode it shows one pane at a
         * time. In stacked mode both panes run down the page and these become
         * anchors, which is why the pressed state follows `mobilePane` either
         * way — it is the last thing you asked for, not a mode. */}
        {isMobile && (
          <nav style={{
            display: 'flex', alignItems: 'stretch',
            padding: '0 6px', background: 'var(--surf)',
            borderBottom: '1px solid var(--bdr)',
          }}>
            {[{ id: 'editor', label: 'EDITOR' }, { id: 'preview', label: 'PREVIEW' }].map(t => {
              const on = mobilePane === t.id
              return (
                <button key={t.id} onClick={() => showPane(t.id)} aria-pressed={on}
                  style={{
                    /* A fixed height, and the underline drawn as an inset
                       shadow rather than a border. A 2px border made these
                       49px against the 44px STACK label beside them, and
                       unequal heights put their baselines 2px apart. A shadow
                       paints in the same place without joining the box. */
                    flex: 1, height: 44, border: 0, background: 'transparent', cursor: 'pointer',
                    fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                    color: on ? 'var(--accent)' : 'var(--text-dim)',
                    boxShadow: on ? 'inset 0 -2px 0 var(--accent)' : 'none',
                    transition: 'color var(--t) var(--ease), box-shadow var(--t) var(--ease)',
                  }}>
                  {t.label}
                </button>
              )
            })}
            {/* A real checkbox, so it is reachable by keyboard and announced
                as a toggle without any ARIA of my own. */}
            <label title="Show both panes down the page instead of one at a time"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 44,
                padding: '0 12px 0 16px', marginLeft: 6, cursor: 'pointer', flexShrink: 0,
                fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700,
                letterSpacing: '.08em', color: stackPanes ? 'var(--accent)' : 'var(--text-dim)',
                borderLeft: '1px solid var(--bdr)',
              }}>
              <input type="checkbox" checked={stackPanes} onChange={e => setStackPanes(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', margin: 0, flexShrink: 0 }} />
              STACK
            </label>
          </nav>
        )}

        </div>

        <NoticeBar notice={notice} onClose={() => setNotice(null)} />

        {/* Grid items default to min-height:auto, which stops them shrinking
            below their content — so an overflowing panel pushes the row taller
            instead of scrolling. minHeight:0 on each child is what makes the
            `overflow: auto` below actually engage. */}
        {/* The 420px floor is what broke this on a phone: a 390px viewport
            could never satisfy it, so the editor alone was wider than the
            screen and the preview sat off the right edge. On a phone the
            grid becomes one column and the floor goes away. */}
        <div style={{
          flex: 1, display: 'grid', minHeight: 0,
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(420px, 46%) 1fr',
          overflow: isMobile && stackPanes ? 'visible' : 'hidden',
        }}>
          <div ref={editorPaneRef} style={{
            display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
            borderRight: isMobile ? 0 : '1px solid var(--bdr)',
            ...(isMobile && !stackPanes && mobilePane !== 'editor' ? { display: 'none' } : null),
            /* Stacked: each pane gets a screen of its own, so the tab anchors
               land on something rather than scrolling past it. */
            ...(isMobile && stackPanes ? { minHeight: '80vh', borderBottom: '1px solid var(--bdr)' } : null),
          }}>
            {/* The pane title goes on a phone, where the tab bar above already
                says EDITOR and repeating it wastes a line of a small screen. */}
            <TabStrip tabs={TABS} active={tab} onSelect={setTab} title={isMobile ? null : 'Editor'}
              actions={
                <>
                  {/* ── UNDO AND REDO ARE ONE GROUP ──
                    *
                    * They were four flat children with one 6px gap, so the row
                    * read as a single run of four controls: 6px between the
                    * groups against 6px inside them, at 1.0:1 where proximity
                    * wants three to one. History is one thing, Save is another
                    * and Import is a third. The pair keeps the small gap and
                    * the row takes the larger one. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button className="btn-ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
                      style={{ padding: '4px 12px', gap: 6, color: canUndo ? 'var(--accent)' : undefined, borderColor: canUndo ? 'rgb(var(--accent-rgb) / .35)' : undefined }}>
                      <Undo />Undo
                    </button>
                    {/* Icon-only, so SQUARE at the row's own control height. It
                        measured 40x28 from a 12px horizontal padding it has no
                        label to need. */}
                    <button className="btn-ghost icon-only" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
                      style={{ padding: 0, width: 28, justifyContent: 'center', color: canRedo ? 'var(--text-dim)' : undefined }}>
                      <Undo flip />
                    </button>
                  </div>
                  {/* Confirms in place: fills, swaps to a tick and reads
                      "Saved" for a moment, so a manual save is unambiguous. */}
                  <button
                    onClick={() => persist('manual').then(ok => {
                      if (!ok) return
                      setDirty(false)
                      setJustSaved(true)
                      clearTimeout(justSavedTimer.current)
                      justSavedTimer.current = setTimeout(() => setJustSaved(false), 2200)
                    })}
                    title={justSaved ? 'Saved' : dirty ? 'Unsaved changes — click to save now' : 'Everything is saved'}
                    className={justSaved ? 'btn-primary' : 'btn-ghost'}
                    style={{
                      padding: '4px 12px', gap: 6, display: 'inline-flex', alignItems: 'center',
                      minWidth: 88, justifyContent: 'center',
                      ...(justSaved
                        ? { background: 'var(--success)', color: 'var(--bg)' }
                        : { color: dirty ? 'var(--warn)' : 'var(--muted)', borderColor: dirty ? 'rgb(var(--warn-rgb) / .4)' : 'var(--bdr)' }),
                      transition: 'background var(--t) var(--ease), color var(--t) var(--ease), border-color var(--t) var(--ease)',
                    }}>
                    {justSaved
                      ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      : <Save />}
                    {justSaved ? 'Saved' : 'Save'}
                    {!justSaved && dirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button className="btn-fill" onClick={() => setShowImport(true)}
                    style={{ padding: '4px 12px' }} title={IMPORT_FORMATS}><Upload /><span className="lbl">Import Reference</span></button>
                </>
              } />
            <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 20px 64px',
              /* A query container, so panels can respond to this column's
                 width rather than the window's — the split is draggable and
                 the two are unrelated. */
              containerType: 'inline-size' }}>
              <CrossFade id={tab}>
                <Panel inspect={inspect?.kind === TAB_KIND[tab] ? inspect : null} onNavigate={navigate} />
              </CrossFade>
            </main>
          </div>

          {/* Route by target kind: components, colour roles and text styles
              each live on their own tab. */}
          <div ref={previewPaneRef} style={{
            display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
            ...(isMobile && !stackPanes && mobilePane !== 'preview' ? { display: 'none' } : null),
            ...(isMobile && stackPanes ? { minHeight: '80vh' } : null),
          }}>
            <Canvas surface={surface} setSurface={setSurface} compact={isMobile} onOpenContrast={() => setTab('roles')} onJump={navigate} onApply={setPendingFix} onInspect={t => {
              setInspect({ entry: t.target, kind: t.kind, at: Date.now() })
              setTab(KIND_TAB[t.kind] ?? 'components')
            }} />
          </div>
        </div>
      </div>

      {/* One bottom-right stack rather than two independently positioned
          toasts. The restore offer appears at boot and the save flash fires
          ~600ms later on the first autosave, so anchoring both to the same
          corner separately would overlap them on every cold start. */}
      {/* Anchored to a corner on a desktop, where a toast should stay out of
          the way of the work. On a phone there is no "out of the way": pinned
          to the right it ran off the edge, and a 343px card in a 375px screen
          has no corner to sit in. So it spans the width with a gutter each
          side and centres what it holds. */}
      <div style={{
        position: 'fixed', bottom: 16, zIndex: 'var(--z-toast)',
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
        /* `center`, not `stretch`. The toast carries its own maxWidth of
           `100vw - 48px`, so stretching a 351px span gave it 327px and parked
           it at the start, with the leftover 24px all on the right. Stretch
           only centres things that have no width of their own. */
        ...(isMobile
          ? { left: 12, right: 12, alignItems: 'center' }
          : { right: 20, alignItems: 'flex-end' }),
      }}>
        {/* Save confirmation on top, restore offer beneath it. The save flash
            is transient and its own arrival is the message; the restore offer
            waits to be acted on, so it takes the lower, calmer slot. */}
        <SaveFlash savedAt={savedAt} />
        {restorable && casual !== 'fork' && casual !== 'wizard' && (
          <div style={{ pointerEvents: 'auto' }}>
            <RestoreToast offer={restorable} onRestore={restorePrevious} onDismiss={() => setRestorable(null)} />
          </div>
        )}
      </div>

      {/* ── THE LAUNCH FORK AND THE WIZARD ──

          Above the restore toast in the stack, and it dismisses the toast when
          it opens: two things offering to open a document at once is two
          questions, and the fork already carries the restore as its third line.

          `dismiss` records the visit before changing the view, so a reload
          during the wizard does not put the fork back over it. */}
      {casual === 'fork' && (
        <LaunchFork
          restorableName={restorable?.name ?? null}
          leaving={leaving}
          onGuided={() => setCasual('wizard')}
          onHandsOn={() => closeCasual()}
          onRestore={() => closeCasual(restorePrevious)}
        />
      )}
      {casual === 'wizard' && (
        <CasualWizard
          leaving={leaving}
          onClose={() => closeCasual()}
          /* Back from page one reopens the fork rather than closing. No exit
             animation: the two panels are the same size in the same place, so
             a fall-then-rise reads as a flicker. */
          onBack={() => setCasual('fork')}
        />
      )}

      {/* Fix It opens this rather than changing the document. */}
      <FixPreview fix={pendingFix} onCancel={() => setPendingFix(null)} onConfirm={applyFinding} />
      {showFile && <FileModal onClose={() => setShowFile(false)} />}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)}
          onApply={applyCssImport} onOpenDocument={openDocument} />
      )}
      {showNew && (
        <NewDocModal
          onClose={() => setShowNew(false)}
          onCreate={(presetId, name) => {
            const fresh = applyPreset(presetId, createInitialState())
            load({ ...fresh, meta: { ...fresh.meta, name: name.trim() || fresh.meta.name } })
            /* A new document is not the old cloud project — detach, or the
               next autosave would overwrite it. */
            setProjectId(null); setEditToken(null); setServerVersion(null); setSyncStatus('local')
            if (window.location.pathname.startsWith('/p/')) window.history.pushState({}, '', '/')
            try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
            setShowNew(false)
            setNotice(null)
          }} />
      )}
    </>
  )
}

export default function App() {
  return (
    <StoreProvider initial={createInitialState()}>
      <Shell />
    </StoreProvider>
  )
}
