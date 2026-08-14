/* Semantic roles and contrast.

   Split out of Colour because 27 roles across two modes is a panel in its own
   right. It reads the scales generated there and maps them to intent — which
   is the layer the exported file leads with, because `surface-raised` tells an
   agent how to build a card and `neutral-800` doesn't. */
import { useState, useEffect } from 'react'
import { useStore } from '../state/store.jsx'
import { ROLE_GROUPS, CONTRAST_PAIRS, pairFails } from '../state/schema.js'
import { RAMP_STEPS } from '../color/ramp.js'
import { check } from '../color/contrast.js'
import { generateCounterpart, clearOverridesFor } from '../color/modes.js'
import ColorPicker from '../ui/ColorPicker.jsx'
import { SectionHeader, Collapsible, Expand, Segmented, OverrideBadge, Banner, FilterField, PAD, BTN } from '../ui/controls.jsx'
import { useReveal, revealStyle } from '../ui/reveal.js'
import CrossFade from '../ui/CrossFade.jsx'
import PanelAlerts from '../a11y/PanelAlerts.jsx'

/* `open` is owned by the panel, not the row. Switching Light/Dark/Both
   cross-dissolves, which remounts these; state kept here would be wiped by an
   animation, so a scope change would silently collapse everything you had
   expanded. */
function RoleRow({ role, roles, refs, ramps, overrides, onSetRef, onOverride, onResetOverride, scope, inspect, open, onToggle }) {
  const targeted = inspect?.entry === role.name
  const ref = useReveal(targeted, inspect?.at)
  const setOpen = next => onToggle(typeof next === 'function' ? next(open) : next)

  useEffect(() => { if (targeted) setOpen(true) }, [targeted, inspect?.at])
  const options = [
    ...Object.keys(ramps).flatMap(r => RAMP_STEPS.map(s => `${r}.${s}`)),
    'white', 'black',
  ]
  /* Editing one mode at a time gives each editor the full width, which is what
     you want when a theme reads well in dark and badly in light. */
  const modes = scope === 'both' ? ['light', 'dark'] : [scope]

  /* The rule sits ABOVE each row, not below it.
   *
   * A separator belongs between two items. Drawn below, the last row in a card
   * puts one directly against the card's own bottom border — two lines a pixel
   * apart, closing nothing. Drawn above, the first row supplies the rule under
   * the group header and the last row ends clean.
   *
   * No index and no last-child rule needed: a top border on every row IS the
   * between-ness, because nothing sits above the first row to separate it
   * from. */
  return (
    <div ref={ref} style={{ borderTop: '1px solid var(--bdr)', ...revealStyle(targeted) }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'grid', gridTemplateColumns: `1fr ${modes.map(() => '22px').join(' ')}`, gap: 8, alignItems: 'center', padding: PAD.sub, cursor: 'pointer' }}>
        <div style={{ minWidth: 0 }}>
          <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{role.name}</code>
          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>{role.desc}</div>
        </div>
        {modes.map(mode => (
          /* Centred in its track: a 20px swatch left-aligned in a 22px column
             sits 1px off the centre of the L or D label above it. */
          <div key={mode} className="swatch" title={`${mode}: ${roles[mode][role.name]}`}
            style={{ width: 20, height: 20, background: roles[mode][role.name], position: 'relative', justifySelf: 'center' }}>
            {overrides[`${role.name}:${mode}`] != null && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
          </div>
        ))}
      </div>

      <Expand open={open}>
        {/* Two columns when two fit, one when they do not.
         *
         * This was a hard `1fr 1fr`, which is a bet that the pane is always
         * wide enough for two colour pickers. Raising the UI scale breaks that
         * bet without changing anything else: `zoom` leaves the pane the same
         * number of device pixels but makes it fewer CSS pixels, so at 150% a
         * pair of pickers had about two thirds of the room and the right-hand
         * one was clipped at the pane edge.
         *
         * `auto-fit` with a floor asks the question per render instead of
         * assuming the answer, so it reflows at whatever scale, pane width or
         * window size happens to make two columns impossible. */}
        <div style={{
          padding: `0 ${PAD.sub}px ${PAD.sub}px`, display: 'grid',
          gridTemplateColumns: modes.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(248px, 1fr))',
          gap: PAD.gap,
        }}>
          {modes.map(mode => {
            const key = `${role.name}:${mode}`
            const overridden = overrides[key] != null
            return (
              <div key={mode} style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: PAD.sub }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', flex: 1 }}>{mode}</span>
                  {overridden && <OverrideBadge onReset={() => onResetOverride(key)} title="Relink to the scale" />}
                </div>
                <select value={refs[role.name]?.[mode] ?? ''} disabled={overridden}
                  onChange={e => onSetRef(role.name, mode, e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '6px 8px', marginBottom: 8, opacity: overridden ? .5 : 1 }}>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ColorPicker value={roles[mode][role.name]} onChange={hex => onOverride(key, hex)} compact />
              </div>
            )
          })}
        </div>
      </Expand>
    </div>
  )
}

/* ── Free-form pair checker ──
   The fixed list below covers the pairs a system has to get right. This covers
   the one you're wondering about right now. */
/* The specimen's own metrics. Named rather than inline because the padding and
   the line-height together decide how tall the swatch sits against the readout
   next to it. */
const SPEC_PAD = 10
const SPEC_LH = 1.4
const RATIO_FS = 17

function PairChecker({ roles, mode }) {
  const names = Object.keys(roles[mode])
  const [fg, setFg] = useState('text')
  const [bg, setBg] = useState('accent-subtle')
  const [size, setSize] = useState('body')

  const fgHex = roles[mode][fg] ?? '#000000'
  const bgHex = roles[mode][bg] ?? '#ffffff'
  const r = check(fgHex, bgHex, { large: size === 'large' })
  const bad = !r.pass
  const specFs = size === 'large' ? 20 : 14

  const Select = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12, padding: '6px 6px' }}>
      {names.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  )

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 8 }}>
        <div><label>Foreground</label><Select value={fg} onChange={setFg} /></div>
        <div><label>Background</label><Select value={bg} onChange={setBg} /></div>
        {/* An SVG, not the ⇄ character. Plus Jakarta Sans has no glyph for it,
            so it fell back to a system font whose metrics put it 1px off the
            baseline of the selects beside it. */}
        <button className="btn-ghost btn-field btn-field-icon" title="Swap foreground and background"
          onClick={() => { setFg(bg); setBg(fg) }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 2 21 6 17 10" /><line x1="3" y1="6" x2="21" y2="6" />
            <polyline points="7 14 3 18 7 22" /><line x1="21" y1="18" x2="3" y2="18" />
          </svg>
        </button>
      </div>

      {/* Two blocks, not two items on a line: a two-line swatch beside a
          four-line readout. Neither one's first line is the line the other
          belongs on, so they centre against each other. */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <div className="preview-box" style={{ flex: 1, background: bgHex, padding: `${SPEC_PAD}px 12px`, minWidth: 0 }}>
          <div style={{ color: fgHex, fontSize: specFs, fontWeight: size === 'large' ? 600 : 400, lineHeight: SPEC_LH }}>
            The quick brown fox
          </div>
          <div style={{ color: fgHex, fontSize: 12, opacity: .85, marginTop: 2 }}>{fgHex} on {bgHex}</div>
        </div>
        <div style={{ width: 104, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: RATIO_FS, color: bad ? 'var(--danger)' : 'var(--success)' }}>{r.ratio}:1</div>
          <div className={bad ? 'fail' : 'pass'} style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{r.label}</div>
          <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>Lc {r.lc}</div>
          <div style={{ fontSize: 10, color: 'var(--dim)' }}>{r.use}</div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Segmented value={size} onChange={setSize} size="sm"
          options={[{ value: 'body', label: 'Body Text' }, { value: 'large', label: 'Large / Bold' }]} />
      </div>
    </div>
  )
}

function ContrastReport({ roles, mode }) {
  /* `check()` has its own `label` (the WCAG grade), so the pair is kept in a
     separate field rather than spread — otherwise it overwrites the pair's
     descriptive name. */
  const results = CONTRAST_PAIRS.map(pair => {
    const fg = roles[mode][pair.fg], bg = roles[mode][pair.bg]
    if (!fg || !bg) return null
    return { pair, res: check(fg, bg), fgHex: fg, bgHex: bg }
  }).filter(Boolean)

  /* An exempt pair still reports its ratio and is never a failure. 1.4.3 does
     not cover text inside a disabled control, and a system that dims disabled
     text is doing the right thing — flagging it would report the intent as the
     fault, and someone would "fix" it by making disabled look enabled. */
  const isFailing = ({ pair, res }) => pairFails(pair, res)
  const failing = results.filter(isFailing)

  return (
    <div>
      {failing.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="warn">
            {failing.length} pair{failing.length === 1 ? '' : 's'} below the accessible minimum in {mode} mode. Agents will reproduce these faithfully — fix them here rather than downstream.
          </Banner>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {results.map(row => {
          const { pair, res, fgHex, bgHex } = row
          const bad = isFailing(row)
          return (
            <div key={`${pair.fg}|${pair.bg}`} title={`${pair.fg} on ${pair.bg}`}
              /* Above each row, so the list ends on a row rather than on a
                 rule. Same reason as the role rows: a separator is a thing
                 BETWEEN two items, and drawn below it outlives the last one. */
              style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'baseline', padding: '6px 0', borderTop: '1px solid var(--bdr)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                {/* The "A" is a specimen inside a swatch, not part of the row's
                    line of text — it stays centred in its own chip. */}
                <div style={{ width: 24, height: 20, borderRadius: 4, background: bgHex, border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' }}>
                  <span style={{ color: fgHex, fontSize: 12, fontWeight: 700, lineHeight: 1 }}>A</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pair.label}</span>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>Lc {res.lc}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{res.ratio}:1</span>
              <span className={bad ? 'fail' : 'pass'} style={{ fontFamily: 'var(--mono)', fontSize: 10, minWidth: 48, textAlign: 'right' }}>
                {pair.ui ? (res.ratio >= 3 ? 'Pass' : 'Fail') : res.label}
              </span>
            </div>
          )
        })}
      </div>
      <p className="panel-note" style={{ marginTop: 8 }}>
        Ratios are WCAG 2.1; Lc is APCA, which models real legibility better — especially for light text on dark backgrounds, where WCAG is known to be over-permissive.
      </p>
    </div>
  )
}

export default function RolesPanel({ inspect }) {
  const { state, derived, set } = useStore()
  const { color } = state
  const { ramps, roles } = derived
  const [scope, setScope] = useState('both')

  const upd = (fn, tag) => set(s => ({ ...s, color: fn(s.color) }), tag)
  const setRoleRef = (role, mode, ref) => upd(c => ({ ...c, roles: { ...c.roles, [role]: { ...c.roles[role], [mode]: ref } } }))
  const setRoleOverride = (key, hex) => upd(c => ({ ...c, roleOverrides: { ...c.roleOverrides, [key]: hex } }), `role:${key}`)
  const resetRole = key => upd(c => { const n = { ...c.roleOverrides }; delete n[key]; return { ...c, roleOverrides: n } })

  /* Overrides pinned to the target mode would survive generation and make it
     look like it hadn't worked, so they're cleared alongside. */
  const generateMode = from => upd(c => ({
    ...c,
    roles: generateCounterpart(c.roles, from),
    roleOverrides: clearOverridesFor(c.roleOverrides, from === 'light' ? 'dark' : 'light'),
  }))

  /* Held here so a scope change — which remounts the groups through the
     cross-dissolve — doesn't collapse whatever you had open. */
  const [openGroups, setOpenGroups] = useState(() => new Set(['surface']))
  const [openRows, setOpenRows] = useState(() => new Set())
  const toggle = setter => (key, on) => setter(prev => {
    const next = new Set(prev)
    if (on) next.add(key); else next.delete(key)
    return next
  })
  const toggleGroup = toggle(setOpenGroups)
  const toggleRow = toggle(setOpenRows)

  const targetGroup = inspect ? ROLE_GROUPS.find(g => g.roles.some(r => r.name === inspect.entry))?.id : null
  const overrideCount = Object.keys(color.roleOverrides ?? {}).length
  const failing = CONTRAST_PAIRS.filter(p => {
    const r = check(roles[color.mode][p.fg], roles[color.mode][p.bg])
    return pairFails(p, r)
  }).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PanelAlerts tab="roles" />
      <SectionHeader title="Semantic Roles" desc="What each colour is for. This is what the exported file leads with."
        right={overrideCount > 0 ? <span className="chip">{overrideCount} overridden</span> : null} />

      <Collapsible title="Modes" defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Editing</span>
          <Segmented value={scope} onChange={setScope} size="sm"
            options={[{ value: 'light', label: 'Light only' }, { value: 'dark', label: 'Dark only' }, { value: 'both', label: 'Both' }]} />
          {scope !== 'both' && scope !== color.mode && (
            <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }}
              onClick={() => upd(c => ({ ...c, mode: scope }))}>
              Preview {scope}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: PAD.sub, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>Generate the opposite mode</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>Mirrors each role's scale position. A starting point, not a finished theme.</div>
          </div>
          {/* Full-size, not chip-size. These rewrite every role in a mode,
              which is one of the larger actions in the app. */}
          <button className="btn-ghost" style={{ padding: BTN.lg, whiteSpace: 'nowrap' }} onClick={() => generateMode('light')}>Light → Dark</button>
          <button className="btn-ghost" style={{ padding: BTN.lg, whiteSpace: 'nowrap' }} onClick={() => generateMode('dark')}>Dark → Light</button>
        </div>
      </Collapsible>

      {/* Switching scope swaps one column layout for another — the same kind
          of change as a tab, so it dissolves like one. Open state lives above
          this in the panel, so nothing collapses on the way through. */}
      <CrossFade id={scope}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ROLE_GROUPS.map(group => (
        <Collapsible key={group.id} title={group.label} note={String(group.roles.length)}
          open={openGroups.has(group.id)} onOpenChange={v => toggleGroup(group.id, v)}
          openSignal={targetGroup === group.id ? inspect.at : null}>
          {/* The description and the column headers are one row, not two.
              As two, the middle of the band was an empty full-width cell, and
              the header sat outside the row padding every role row below it
              uses — which put L and D 17px to the right of the swatches they
              label. One row, the same columns and the same padding, and both
              problems go with it. Baseline-aligned, since the description and
              the two letters sit on one line. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `1fr ${(scope === 'both' ? ['', ''] : ['']).map(() => '22px').join(' ')}`,
            gap: 8, alignItems: 'baseline',
            /* The same padding as the role rows underneath, so the header is
               part of the same rhythm rather than a squashed strip above it.
               No border of its own — the first role row draws the rule below
               this one, which is the same line and one less thing to keep in
               step. */
            padding: PAD.sub,
          }}>
            <p className="panel-note" style={{ margin: 0 }}>{group.desc}</p>
            {(scope === 'both' ? ['L', 'D'] : [scope === 'light' ? 'L' : 'D']).map(l => (
              <span key={l} style={{ fontSize: 8, color: 'var(--dim)', textAlign: 'center' }}>{l}</span>
            ))}
          </div>
          {group.roles.map(role => (
            <RoleRow key={role.name} role={role} roles={roles} refs={color.roles} ramps={ramps}
              overrides={color.roleOverrides ?? {}} scope={scope} inspect={inspect}
              open={openRows.has(role.name)} onToggle={v => toggleRow(role.name, v)}
              onSetRef={setRoleRef} onOverride={setRoleOverride} onResetOverride={resetRole} />
          ))}
        </Collapsible>
      ))}
      </div>
      </CrossFade>

      <Collapsible title="Contrast" note={failing ? `${failing} failing` : color.mode} defaultOpen>
        <PairChecker roles={roles} mode={color.mode} />
        <ContrastReport roles={roles} mode={color.mode} />
      </Collapsible>
    </div>
  )
}
