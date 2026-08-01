/* Word-level diff for reviewing a rewrite.

   Character diffs are unreadable on prose and line diffs are useless when a
   model reflows a paragraph, so this compares words while keeping the
   whitespace between them. Standard LCS, which is fine at this size — a
   rationale section is hundreds of words, not thousands. */

/** Split into words plus their trailing whitespace, so output can be rejoined. */
const tokenise = text => (text ?? '').match(/\S+\s*|\s+/g) ?? []

/* Words match on their trimmed form only. Whitespace reflow is invisible;
   a capitalisation change is a real edit and shows as one. */
const key = s => s.trim()

/**
 * @returns {Array<{ type: 'same'|'add'|'remove', text: string }>}
 */
export function diffWords(before, after) {
  const a = tokenise(before)
  const b = tokenise(after)

  const n = a.length, m = b.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = key(a[i]) === key(b[j])
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const out = []
  const push = (type, text) => {
    const last = out[out.length - 1]
    if (last && last.type === type) last.text += text
    else out.push({ type, text })
  }

  let i = 0, j = 0
  while (i < n && j < m) {
    if (key(a[i]) === key(b[j])) { push('same', b[j]); i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { push('remove', a[i]); i++ }
    else { push('add', b[j]); j++ }
  }
  while (i < n) { push('remove', a[i]); i++ }
  while (j < m) { push('add', b[j]); j++ }

  return out
}

/** Headline numbers for the review header. */
export function diffStats(parts) {
  const words = t => (t.trim() ? t.trim().split(/\s+/).length : 0)
  let added = 0, removed = 0
  for (const p of parts) {
    if (p.type === 'add') added += words(p.text)
    if (p.type === 'remove') removed += words(p.text)
  }
  return { added, removed, changed: added > 0 || removed > 0 }
}
