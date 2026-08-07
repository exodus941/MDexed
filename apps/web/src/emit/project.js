/* The project file. MDexed reads it, nothing else does.
 *
 * Save to Device used to write a DESIGN.md, which cannot hold this document.
 * The spec allows a component exactly eight properties and has no way to
 * record that a button has variants and sizes. So a save-then-load dropped
 * eight property kinds — gap, iconSize, borderColor, opacity, outline,
 * outlineOffset, minHeight, boxShadow — and flattened the component matrix
 * into rows you could no longer edit as a matrix.
 *
 * That was the wrong file for the job. DESIGN.md is a handoff format, built to
 * be read by an agent. This is a save format, built to be read by this editor
 * and nothing else. Export Payload remains the handoff.
 *
 * It is plain JSON, holding the editor's own state and nothing foreign. No
 * derived values: everything downstream regenerates from these on load, so the
 * file stays small and a later change to the generators reaches old saves.
 */
import { migrate } from '../state/migrate.js'

export const PROJECT_FORMAT = 'mdexed-project'
export const PROJECT_EXT = '.mdexed.json'
/* Bumped only when the envelope changes, not when the document schema does.
   Document versioning is already handled by `schemaVersion` and `migrate`. */
export const PROJECT_FORMAT_VERSION = 1

export function serializeProject (state, opts = {}) {
  return JSON.stringify({
    format: PROJECT_FORMAT,
    formatVersion: PROJECT_FORMAT_VERSION,
    /* Carried at the top level too, so a human reading the file can see which
       document schema it holds without hunting through the state. */
    schemaVersion: state.schemaVersion ?? null,
    app: opts.build ?? null,
    savedAt: opts.savedAt ?? new Date().toISOString(),
    state,
  }, null, 2)
}

/* Mirrors parseFile's contract: never throws, never half-loads. The caller
   keeps its current document unless `ok` is true. */
export function parseProject (text) {
  let doc
  try {
    doc = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  if (!doc || typeof doc !== 'object') return { ok: false, error: 'That file does not contain a project.' }
  if (doc.format !== PROJECT_FORMAT) {
    return { ok: false, error: 'That JSON file was not saved by MDexed.' }
  }
  if (!doc.state || typeof doc.state !== 'object') {
    return { ok: false, error: 'The project file has no document in it.' }
  }
  if (Number(doc.formatVersion) > PROJECT_FORMAT_VERSION) {
    return { ok: false, error: `That file was saved by a newer version of MDexed (format ${doc.formatVersion}). Update this tab and try again.` }
  }
  /* Same migration path as any other document, so a save from an older schema
     upgrades on load rather than loading wrong. */
  const { state, migratedFrom, warning } = migrate(doc.state)
  const warnings = []
  if (warning) warnings.push(warning)
  if (migratedFrom != null && migratedFrom < (state.schemaVersion ?? 0)) {
    warnings.push(`Upgraded from schema v${migratedFrom} on load.`)
  }
  return { ok: true, state, warnings, savedAt: doc.savedAt ?? null }
}

/* Sortable, so repeated saves sit in the order they were made when a folder is
   sorted by name. Anything friendlier to read sorts wrongly at a month roll. */
export function projectFilename (name, at = new Date()) {
  const p = n => String(n).padStart(2, '0')
  const date = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}`
  const time = `${p(at.getHours())}${p(at.getMinutes())}`
  const slug = String(name || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design-system'
  return `${slug}-${date}-${time}${PROJECT_EXT}`
}
