/* Compose the file, and check it against the spec before handing it over. */
import { load as yamlLoad } from 'js-yaml'
import { emitFrontmatter, SPEC_TOP_LEVEL, SPEC_COMPONENT_PROPS, SPEC_TYPOGRAPHY_PROPS } from './yaml.js'
import { emitBody } from './markdown.js'

/**
 * @returns {{ text: string, omitted: string[], dropped: Array }}
 *   `dropped` lists component properties the spec has no room for; they are
 *   still written into the markdown body by emitBody.
 */
export function generateFile(state, derived) {
  const { text: body, omitted } = emitBody(state, derived)
  const { text: frontmatter, dropped } = emitFrontmatter(state, derived, { omitted })
  return {
    text: body ? `${frontmatter}\n\n${body}\n` : `${frontmatter}\n`,
    omitted,
    dropped,
  }
}

/** Convenience for callers that only want the string. */
export const fileText = (state, derived) => generateFile(state, derived).text

/**
 * Validate a rendered DESIGN.md against the published schema.
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validate(text) {
  const errors = []
  const warnings = []

  const fm = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!fm) {
    errors.push('No YAML frontmatter found — the file must open with a `---` delimited block.')
    return { ok: false, errors, warnings }
  }

  let doc
  try {
    doc = yamlLoad(fm[1])
  } catch (e) {
    errors.push(`Frontmatter is not valid YAML: ${e.message}`)
    return { ok: false, errors, warnings }
  }
  if (!doc || typeof doc !== 'object') {
    errors.push('Frontmatter did not parse to a mapping.')
    return { ok: false, errors, warnings }
  }

  if (!doc.name) errors.push('`name` is required.')

  for (const k of Object.keys(doc)) {
    if (!SPEC_TOP_LEVEL.includes(k)) {
      errors.push(`\`${k}\` is not a DESIGN.md frontmatter field. Allowed: ${SPEC_TOP_LEVEL.join(', ')}.`)
    }
  }

  for (const [name, props] of Object.entries(doc.typography ?? {})) {
    for (const p of Object.keys(props ?? {})) {
      if (!SPEC_TYPOGRAPHY_PROPS.includes(p)) {
        errors.push(`typography.${name}.${p} is not a legal typography property.`)
      }
    }
  }

  for (const [name, props] of Object.entries(doc.components ?? {})) {
    for (const p of Object.keys(props ?? {})) {
      if (!SPEC_COMPONENT_PROPS.includes(p)) {
        errors.push(`components.${name}.${p} is not a legal component property. Allowed: ${SPEC_COMPONENT_PROPS.join(', ')}.`)
      }
    }
  }

  /* Every `{token.path}` reference has to resolve, or the agent gets a
     literal brace-wrapped string where a colour should be. */
  const refs = [...text.matchAll(/\{([a-zA-Z0-9_.-]+)\}/g)].map(m => m[1])
  for (const ref of new Set(refs)) {
    const [group, ...rest] = ref.split('.')
    const key = rest.join('.')
    if (!['colors', 'typography', 'rounded', 'spacing'].includes(group)) {
      warnings.push(`Reference \`{${ref}}\` does not point at a known token group.`)
    } else if (key && doc[group] && !(key in doc[group])) {
      warnings.push(`Reference \`{${ref}}\` points at a token that is not defined.`)
    }
  }

  const declaredOmitted = new Set((doc.omitted ?? []).map(o => (typeof o === 'string' ? o : o?.section)))
  const REQUIRED = ['Overview', 'Colors', 'Typography', 'Layout', 'Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts"]
  const present = new Set([...text.matchAll(/^## (.+)$/gm)].map(m => m[1].trim()))
  for (const section of REQUIRED) {
    if (!present.has(section) && !declaredOmitted.has(section)) {
      warnings.push(`Section "${section}" is missing and not declared in \`omitted\`.`)
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}
