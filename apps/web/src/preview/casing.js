/* The document says how a UI label is capitalised. The preview has to obey it.
 *
 * `voice.casing` has been in the schema from the start, it defaults to `title`,
 * and the emitted file states the rule in plain words: capitalise every UI
 * label as Title Case, and that applies to buttons, tabs, menu items, column
 * headings and section titles alike. Every preview surface ignored it. So the
 * app demonstrated sentence case while its own document demanded Title Case —
 * a specification that lies, in the one place a reader checks first.
 *
 * ONE DIRECTION ONLY. Surfaces author their labels in sentence case, and this
 * upgrades them when the document asks for Title Case. It never converts the
 * other way: lowercasing "Ashford & Kline" back to sentence case would need to
 * know which words are proper nouns, and nothing here can know that. A
 * document set to sentence case therefore gets the source text unchanged,
 * which is already sentence case.
 *
 * CONTENT IS NOT A LABEL. A record's name, a person's name, a sentence of body
 * copy and a timestamp are not UI labels and never pass through here. The rule
 * covers what the interface calls things, not what the data says.
 */

/* The words that stay lowercase inside a title, unless they start it or end
   it. Articles, coordinating conjunctions and short prepositions — the set
   every house style agrees on. Anything longer takes a capital, which is why
   "Between" and "Through" are absent. */
const SMALL = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'nor', 'of', 'off', 'on', 'onto', 'or', 'over', 'per', 'so', 'the', 'to',
  'up', 'via', 'vs', 'with', 'yet',
])

/* A word already carrying an inner capital is a name or an initialism, so it
   is left exactly as written. That protects "CSV", "INV-2287", "iOS" and
   "McKinsey" from being flattened into "Csv" and "Mckinsey". */
const hasInnerCapital = w => /[A-Z]/.test(w.slice(1))

function capitalise (word) {
  if (!word) return word
  if (hasInnerCapital(word)) return word
  /* Split on the first letter rather than the first character, so a leading
     quote or bracket does not eat the capital: "(draft)" becomes "(Draft)". */
  const i = word.search(/[a-z]/i)
  if (i < 0) return word
  return word.slice(0, i) + word[i].toUpperCase() + word.slice(i + 1)
}

export function titleCase (text) {
  if (typeof text !== 'string' || !text) return text
  /* Split on spaces only. A hyphenated pair is one word — "Follow-up" takes
     one capital, not two — and an em dash keeps its spaces either side. */
  const words = text.split(' ')
  const last = words.length - 1
  return words.map((w, i) => {
    const bare = w.toLowerCase()
    if (i !== 0 && i !== last && SMALL.has(bare)) return hasInnerCapital(w) ? w : bare
    return capitalise(w)
  }).join(' ')
}

/* The one entry point a surface uses. Pass the document's setting once and get
   back the function that recases a label. */
export const labeller = casing => text => (casing === 'title' ? titleCase(text) : text)
