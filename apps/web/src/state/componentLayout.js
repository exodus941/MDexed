/* Composition rules for components whose *arrangement* matters as much as
   their colours.

   None of this can live in the frontmatter. A DESIGN.md component entry accepts
   exactly eight properties — backgroundColor, textColor, typography, rounded,
   padding, size, height, width — and "the icon sits above the title" is not one
   of them. So these are emitted as a table plus imperative guidance in the
   Components section, the same route elevation and motion take.

   Declared as data rather than hand-written controls so the panel, the CSS
   variables, the preview and the emitted prose all read from one definition and
   cannot drift apart. */

export const LAYOUT_COMPONENTS = [
  {
    name: 'modal',
    label: 'Modal composition',
    desc: 'How the parts of a dialog are arranged. Colours, padding and radius stay in the matrix above.',
    fields: [
      {
        k: 'align', label: 'Alignment', default: 'left',
        options: [
          { value: 'left', label: 'Left', sentence: 'Left-align the icon, title, body and actions.' },
          { value: 'center', label: 'Centre', sentence: 'Centre the icon, title and body; centre the actions unless they are stretched.' },
        ],
      },
      {
        k: 'iconPlacement', label: 'Icon placement', default: 'inline',
        options: [
          { value: 'none', label: 'None', sentence: 'No icon in dialogs.' },
          { value: 'inline', label: 'Beside title', sentence: 'The icon sits on the same line as the title, before it.' },
          { value: 'above', label: 'Above title', sentence: 'The icon sits on its own line above the title.' },
        ],
      },
      {
        k: 'iconSize', label: 'Icon size', default: 'lg', dependsOn: ['iconPlacement', v => v !== 'none'],
        options: [
          { value: 'sm', label: 'sm' }, { value: 'md', label: 'md' },
          { value: 'lg', label: 'lg' }, { value: 'xl', label: 'xl' },
        ],
        sentence: v => `Dialog icons use the \`${v}\` icon size.`,
      },
      {
        k: 'iconStyle', label: 'Icon treatment', default: 'plain', dependsOn: ['iconPlacement', v => v !== 'none'],
        options: [
          { value: 'plain', label: 'Plain', sentence: 'The icon is drawn bare, tinted to match the dialog\'s intent.' },
          { value: 'circle', label: 'Tinted circle', sentence: 'The icon sits in a circular tinted background using the subtle variant of its intent colour.' },
        ],
      },
      {
        k: 'gap', label: 'Title → body gap', default: 'sm',
        options: [
          { value: '2xs', label: '2xs' }, { value: 'xs', label: 'xs' },
          { value: 'sm', label: 'sm' }, { value: 'md', label: 'md' },
        ],
        sentence: v => `Space the title from the body by \`spacing.${v}\`.`,
      },
      {
        k: 'actions', label: 'Actions', default: 'right',
        options: [
          { value: 'right', label: 'Right', sentence: 'Actions sit in a row at the bottom right, primary last.' },
          { value: 'left', label: 'Left', sentence: 'Actions sit in a row at the bottom left, primary first.' },
          { value: 'center', label: 'Centre', sentence: 'Actions are centred in a row at the bottom.' },
          { value: 'stretch', label: 'Full width', sentence: 'Actions stack full-width, primary on top.' },
        ],
      },
      {
        k: 'dismiss', label: 'Close button', default: 'corner',
        options: [
          { value: 'corner', label: 'Corner ×', sentence: 'A close control sits in the top-right corner, in addition to any cancel action.' },
          { value: 'none', label: 'None', sentence: 'No corner close control — dismissal is through the actions only.' },
        ],
      },
    ],
  },
]

export const LAYOUT_BY_NAME = Object.fromEntries(LAYOUT_COMPONENTS.map(c => [c.name, c]))

export const defaultsFor = def => Object.fromEntries(def.fields.map(f => [f.k, f.default]))

/** Stored values merged over the defaults, so an older document is complete. */
export const resolveLayout = (def, stored) => ({ ...defaultsFor(def), ...(stored ?? {}) })

/** Every component's layout, defaulted. Shape: `{ modal: {...} }`. */
export const resolveAllLayouts = stored =>
  Object.fromEntries(LAYOUT_COMPONENTS.map(def => [def.name, resolveLayout(def, stored?.[def.name])]))

/** A field is shown only when whatever it depends on is set to a live value. */
export const fieldActive = (field, values) =>
  !field.dependsOn || field.dependsOn[1](values[field.dependsOn[0]])

/** One imperative line per setting, for the emitted guidance. */
export function layoutSentences(def, values) {
  const out = []
  for (const field of def.fields) {
    if (!fieldActive(field, values)) continue
    const v = values[field.k]
    const opt = field.options?.find(o => o.value === v)
    const sentence = opt?.sentence ?? (typeof field.sentence === 'function' ? field.sentence(v) : null)
    if (sentence) out.push(sentence)
  }
  return out
}

/** Rows for the emitted table: the raw settings, so nothing is ambiguous. */
export function layoutRows(def, values) {
  return def.fields
    .filter(f => fieldActive(f, values))
    .map(f => {
      const opt = f.options?.find(o => o.value === values[f.k])
      return [f.label, `\`${values[f.k]}\`${opt && opt.label !== values[f.k] ? ` — ${opt.label.toLowerCase()}` : ''}`]
    })
}
