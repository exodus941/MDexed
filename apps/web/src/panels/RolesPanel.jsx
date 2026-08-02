/* Semantic roles and contrast.

   Split out of Colour because 27 roles across two modes is a panel in its own
   right. It reads the scales generated there and maps them to intent — which
   is the layer the exported file leads with, because `surface-raised` tells an
   agent how to build a card and `neutral-800` doesn't. */
import { useState, useEffect } from 'react'
import { useStore } from '../state/store.jsx'
import { ROLE_GROUPS, CONTRAST_PAIRS } from '../state/schema.js'
import { RAMP_STEPS } from '../color/ramp.js'
import { check } from '../color/contrast.js'
import { generateCounterpart, clearOverridesFor } from '../color/modes.js'
import ColorPicker from '../ui/ColorPicker.jsx'
import { SectionHeader, Collapsible, Expand, Segmented, OverrideBadge, Banner, FilterField, PAD } from '../ui/controls.jsx'
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

  return (
    <div ref={ref} style={{ borderBottom: '1px solid var(--bdr)', ...revealStyle(targeted) }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'grid', gridTemplateColumns: `1fr ${modes.map(() => '22px').join(' ')}`, gap: 8, alignItems: 'center', padding: PAD.sub, cursor: 'pointer' }}>
        <div style={{ minWidth: 0 }}>
          <code style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text)' }}>{role.name}</code>
          <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 1 }}>{role.desc}</div>
        </div>
        {modes.map(mode => (
          <div key={mode} className="swatch" title={`${mode}: ${roles[mode][role.name]}`}
            style={{ width: 20, height: 20, background: roles[mode][role.name], position: 'relative' }}>
            {overrides[`${role.name}:${mode}`] != null && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
          </div>
        ))}
      </div>

      <Expand open={open}>
        <div style={{ padding: `0 ${PAD.sub}px ${PAD.sub}px`, display: 'grid', gridTemplateColumns: modes.length === 1 ? '1fr' : '1fr 1fr', gap: PAD.gap }}>
          {modes.map(mode => {
            const key = `${role.name}:${mode}`
            const overridden = overrides[key] != null
            return (
              <div key={mode} style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 7, padding: PAD.sub }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                  <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', flex: 1 }}>{mode}</span>
                  {overridden && <OverrideBadge onReset={() => onResetOverride(key)} title="Relink to the scale" />}
                </div>
                <select value={refs[role.name]?.[mode] ?? ''} disabled={overridden}
                  onChange={e => onSetRef(role.name, mode, e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '5px 7px', marginBottom: 7, opacity: overridden ? .5 : 1 }}>
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
function PairChecker({ roles, mode }) {
  const names = Object.keys(roles[mode])
  const [fg, setFg] = useState('text')
  const [bg, setBg] = useState('accent-subtle')
  const [size, setSize] = useState('body')

  const fgHex = roles[mode][fg] ?? '#000000'
  const bgHex = roles[mode][bg] ?? '#ffffff'
  const r = check(fgHex, bgHex, { large: size === 'large' })
  const bad = !r.pass

  const Select = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '5px 6px' }}>
      {names.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  )

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 7, alignItems: 'end', marginBottom: 9 }}>
        <div><label>Foreground</label><Select value={fg} onChange={setFg} /></div>
        <div><label>Background</label><Select value={bg} onChange={setBg} /></div>
        <button className="btn-ghost" title="Swap" style={{ padding: '4px 10px' }} onClick={() => { setFg(bg); setBg(fg) }}>⇄</button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
        <div className="preview-box" style={{ flex: 1, background: bgHex, padding: '10px 12px', minWidth: 0 }}>
          <div style={{ color: fgHex, fontSize: size === 'large' ? 20 : 14, fontWeight: size === 'large' ? 600 : 400, lineHeight: 1.4 }}>
            The quick brown fox
          </div>
          <div style={{ color: fgHex, fontSize: 11, opacity: .85, marginTop: 2 }}>{fgHex} on {bgHex}</div>
        </div>
        <div style={{ width: 104, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 17, color: bad ? 'var(--danger)' : 'var(--success)' }}>{r.ratio}:1</div>
          <div className={bad ? 'fail' : 'pass'} style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{r.label}</div>
          <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>Lc {r.lc}</div>
          <div style={{ fontSize: 9.5, color: 'var(--dim)' }}>{r.use}</div>
        </div>
      </div>

      <div style={{ marginTop: 9 }}>
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

  const isFailing = ({ pair, res }) => (pair.ui ? res.ratio < 3 : !res.pass)
  const failing = results.filter(isFailing)

  return (
    <div>
      {failing.length > 0 && (
        <div style={{ marginBottom: 10 }}>
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
              style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 9, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--bdr)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <div style={{ width: 22, height: 18, borderRadius: 4, background: bgHex, border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: fgHex, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>A</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pair.label}</span>
              </div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim)' }}>Lc {res.lc}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{res.ratio}:1</span>
              <span className={bad ? 'fail' : 'pass'} style={{ fontFamily: 'var(--mono)', fontSize: 10.5, minWidth: 46, textAlign: 'right' }}>
                {pair.ui ? (res.ratio >= 3 ? 'Pass' : 'Fail') : res.label}
              </span>
            </div>
          )
        })}
      </div>
      <p className="panel-note" style={{ marginTop: 9 }}>
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
    return p.ui ? r.ratio < 3 : !r.pass
  }).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PanelAlerts tab="roles" />
      <SectionHeader title="Semantic Roles" desc="What each colour is for. This is what the exported file leads with."
        right={overrideCount > 0 ? <span className="chip">{overrideCount} overridden</span> : null} />

      <Collapsible title="Modes" defaultOpen>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Editing</span>
          <Segmented value={scope} onChange={setScope} size="sm"
            options={[{ value: 'light', label: 'Light only' }, { value: 'dark', label: 'Dark only' }, { value: 'both', label: 'Both' }]} />
          {scope !== 'both' && scope !== color.mode && (
            <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 10.5 }}
              onClick={() => upd(c => ({ ...c, mode: scope }))}>
              Preview {scope}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: PAD.sub, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>Generate the opposite mode</div>
            <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 1 }}>Mirrors each role's scale position. A starting point, not a finished theme.</div>
          </div>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => generateMode('light')}>Light → Dark</button>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => generateMode('dark')}>Dark → Light</button>
        </div>
      </Collapsible>

      {/* Switching scope swaps one column layout for another — the same kind
          of change as a tab, so it dissolves like one. Open state lives above
          this in the panel, so nothing collapses on the way through. */}
      <CrossFade id={scope}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ROLE_GROUPS.map(group => (
        <Collapsible key={group.id} title={group.label} note={String(group.roles.length)}
          open={openGroups.has(group.id)} onOpenChange={v => toggleGroup(group.id, v)}
          openSignal={targetGroup === group.id ? inspect.at : null}>
          <p className="panel-note" style={{ marginBottom: 8 }}>{group.desc}</p>
          <div style={{ display: 'grid', gridTemplateColumns: scope === 'both' ? '1fr 22px 22px' : '1fr 22px', gap: 8, paddingBottom: 3, borderBottom: '1px solid var(--bdr)' }}>
            <span />
            {(scope === 'both' ? ['L', 'D'] : [scope === 'light' ? 'L' : 'D']).map(l => (
              <span key={l} style={{ fontSize: 8.5, color: 'var(--dim)', textAlign: 'center' }}>{l}</span>
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
