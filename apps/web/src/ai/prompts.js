/* Prompt construction.

   Two jobs, deliberately narrow. Refining tightens prose the designer already
   wrote; drafting turns the tokens of one section into the guidance an agent
   needs. Neither invents tokens — the model is given the real values and told
   to describe them, because a rationale that contradicts the frontmatter is
   worse than no rationale. */

const SYSTEM = `You write design system documentation that is read by AI coding agents.

Rules:
- Write plain, specific prose. No marketing language, no filler, no hedging.
- Never invent token names, colours or values. Use only what you are given.
- Prefer imperative guidance ("Reserve the accent for the primary action")
  over description ("The accent is a teal colour").
- Explain *why* and *when*, not *what* — the values are already in the file.
- British English. No headings, no bullet characters unless asked. No preamble,
  no sign-off, no restating the request. Return only the prose itself.`

const list = (label, rows) => (rows.length ? `${label}:\n${rows.join('\n')}` : '')

/** The token facts relevant to one section, so the model isn't guessing. */
export function contextFor(sectionKey, state, derived) {
  /* Both modes are in the exported file, so say which one these values are —
     otherwise the model writes "the accent is #59a299" and is half wrong. */
  const mode = state.color.mode
  const roles = derived.roles[mode]
  const t = state.type

  switch (sectionKey) {
    case 'colors':
      return [
        list(`Semantic colours (${mode} mode; the file carries both)`,
          Object.entries(roles).slice(0, 18).map(([k, v]) => `  ${k}: ${v}`)),
        `Seeds: ${state.color.seeds.map(s => `${s.name} ${s.hex}`).join(', ')}`,
        state.color.gradients?.length ? `Gradients: ${state.color.gradients.map(g => g.name).join(', ')}` : '',
      ].filter(Boolean).join('\n')

    case 'typography':
      return [
        `Families: display ${t.families.display?.family}, body ${t.families.body?.family}, mono ${t.families.mono?.family}`,
        `Modular scale: base ${t.base}px, ratio ${t.ratio}. Max measure ${t.measure}ch.`,
        list('Styles', derived.typography.slice(0, 10).map(x => `  ${x.name}: ${x.fontSize} / ${x.lineHeight} / ${x.letterSpacing}`)),
      ].filter(Boolean).join('\n')

    case 'layout':
      return [
        list('Spacing', derived.spacing.map(s => `  ${s.name}: ${s.value}`)),
        `Grid: ${state.layout.columns} columns, gutter ${state.layout.gutter}.`,
        `Breakpoints: ${state.layout.breakpoints.map(b => `${b.name} ${b.px}px`).join(', ')}`,
      ].filter(Boolean).join('\n')

    case 'elevation':
      return [
        `Strategy: ${state.elevation.strategy}. Shadows tinted with ${derived.shadowHex}, not black.`,
        list('Levels', Object.entries(derived.elevation).map(([k, v]) => `  ${k}: ${v}`)),
        `Dark mode: ${state.elevation.darkStrategy === 'lighten' ? 'raise the surface colour rather than deepen the shadow' : 'deepen the shadow'}.`,
      ].join('\n')

    case 'shapes':
      return [
        list('Radii', derived.rounded.map(r => `  ${r.name}: ${r.value}`)),
        `Border widths: ${Object.entries(state.radius.borderWidths).map(([k, v]) => `${k} ${v}px`).join(', ')}`,
        state.radius.nesting ? 'Nesting rule in force: inner radius = outer radius minus the gap.' : '',
      ].filter(Boolean).join('\n')

    case 'components':
      return [
        `Components: ${derived.components.slice(0, 24).map(c => c.name).join(', ')}`,
        `Icons: ${state.icons.library}, stroke ${state.icons.strokeWidth}.`,
        `Focus ring: ${state.focus.width}px ${state.focus.style} in ${state.focus.role}, offset ${state.focus.offset}px.`,
      ].join('\n')

    case 'dosDonts':
      return list('Constraints already active', (state.directives.antiPatterns ?? []).filter(a => a.on).map(a => `  ${a.text}`))

    case 'overview':
      return [
        `Name: ${state.meta.name}`,
        state.meta.description ? `Description: ${state.meta.description}` : '',
        state.directives.references?.length ? `Style references: ${state.directives.references.join(', ')}` : '',
        `Target stack: ${state.directives.framework}.`,
        `In ${mode} mode: accent ${roles.accent}, surface ${roles.surface}, text ${roles.text}. Display face ${t.families.display?.family}.`,
      ].filter(Boolean).join('\n')

    default:
      return ''
  }
}

export const systemPrompt = () => SYSTEM

/** Tighten what's already there, preserving the designer's intent and voice. */
export function refinePrompt(section, existing, state, derived) {
  return `Rewrite the "${section.label}" section of a DESIGN.md file.

Keep the author's intent and opinions exactly. Do not add new rules they did
not imply, and do not soften the ones they did. Tighten the wording, cut
filler, and make the guidance actionable for an agent building UI.

Aim for a similar length — this is an edit, not an expansion.

Their current text:
"""
${existing}
"""

The tokens this section governs, for accuracy — do not list them back:
${contextFor(section.k, state, derived)}`
}

/** Write the section from scratch, from the tokens alone. */
export function draftPrompt(section, state, derived) {
  return `Write the "${section.label}" section of a DESIGN.md file.

${section.desc}.

Two or three short paragraphs, or a tight set of rules if that suits the
subject better. Explain when to reach for these tokens and what to avoid.
Do not list the values back — they are already in the file directly above
this prose.

The tokens this section governs:
${contextFor(section.k, state, derived)}`
}
