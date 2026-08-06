#!/usr/bin/env node
/* Syntax guard.
 *
 * One trap has cost this project six separate incidents, in two forms:
 *
 *   LOUD — a template literal ends early and what follows parses as code.
 *   Usually a syntax error, but the build reports it at a line nowhere near
 *   the cause, so the search starts in the wrong file.
 *
 *   SILENT — a backtick inside a CSS comment inside a template literal. The
 *   literal closes at that backtick, the rest of the stylesheet becomes
 *   expressions, and the whole thing can still be valid JavaScript. The build
 *   goes green, the app renders nothing, and the error surfaces somewhere
 *   unrelated. That one took the longest to find every single time.
 *
 * The structural fix for the stylesheets was to move them into real .css
 * files, and the suite asserts they stay there. This catches everything else,
 * including the newest variant: a script of mine generating a template literal
 * through a shell, where the shell ate the escapes.
 *
 * Layer one parses every source file with esbuild — the same parser the build
 * uses, so anything it rejects would have broken the build anyway, just later
 * and further from the cause.
 *
 * Layer two looks for the silent form directly: a template literal containing
 * a block comment that never closes inside that literal. That is the exact
 * signature. The comment opened, a stray backtick ended the string, and the
 * `*​/` was left outside.
 *
 * Run: npm run check
 */
import fs from 'node:fs'
import path from 'node:path'
import { transform } from 'esbuild'

const ROOTS = ['apps/web/src', 'apps/web/test', 'apps/web/scripts', 'apps/api/src', 'tools']
const EXT = { '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.ts': 'ts', '.tsx': 'tsx' }

const walk = dir => {
  let out = []
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules') out = out.concat(walk(p)) }
    else if (EXT[path.extname(e.name)]) out.push(p)
  }
  return out
}

/* ── Layer two: the silent form ──
 *
 * A hand-rolled scanner rather than an AST walk, because by the time a parser
 * is involved the damage has already changed what the tokens are. This reads
 * the file the way the JavaScript lexer does — tracking which construct it is
 * inside — and reports template literals that swallowed an unclosed comment.
 */
function danglingCommentsInTemplates(src) {
  const hits = []
  let i = 0, line = 1
  /* Template nesting: each entry is a literal we are inside, remembering
     where it started and what it has accumulated. `${}` can contain another
     template, so this is a stack rather than a flag. */
  const stack = []
  const brace = []

  /* `/*` is only a comment opener where a comment could start: at the
     beginning, or after whitespace or punctuation. Anywhere else it is part of
     something else, and treating it as a comment produced false positives on
     the first run — a URL ending `example.com/*` and a glob `src/**​/*` both
     tripped it. Neither is a comment and neither is a bug. */
  const opensAComment = (body, at) => at === 0 || /[\s;,{}()[\]=:]/.test(body[at - 1])

  const finish = t => {
    for (let at = t.body.lastIndexOf('/*'); at !== -1; at = t.body.lastIndexOf('/*', at - 1)) {
      if (!opensAComment(t.body, at)) continue
      if (t.body.indexOf('*/', at) !== -1) return   // this comment closes; earlier ones did too
      hits.push({ line: t.line, snippet: t.body.slice(Math.max(0, at - 20), at + 60).replace(/\s+/g, ' ') })
      return
    }
  }

  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    if (c === '\n') line++

    if (stack.length === 0) {
      /* Outside any template: skip over the things that can hide a backtick. */
      if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
      if (c === '/' && n === '*') {
        i += 2
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++ }
        i += 2; continue
      }
      if (c === '"' || c === "'") {
        const q = c; i++
        while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; if (src[i] === '\n') line++; i++ }
        i++; continue
      }
      if (c === '`') { stack.push({ line, body: '' }); i++; continue }
      i++; continue
    }

    /* Inside a template literal. */
    const top = stack[stack.length - 1]
    if (c === '\\') { top.body += src.slice(i, i + 2); i += 2; continue }
    if (c === '$' && n === '{') { brace.push(stack.length); i += 2; top.body += '${'; continue }
    if (c === '}' && brace.length && brace[brace.length - 1] === stack.length) { brace.pop(); i++; top.body += '}'; continue }
    if (c === '`' && brace.length === 0) { finish(stack.pop()); i++; continue }
    if (c === '`' && brace.length) { stack.push({ line, body: '' }); i++; continue }
    top.body += c
    i++
  }
  /* An unterminated template is its own bug; esbuild will say so. */
  return hits
}

const files = ROOTS.flatMap(walk)
let bad = 0

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const loader = EXT[path.extname(f)]

  /* Layer one. */
  try {
    await transform(src, { loader, format: 'esm' })
  } catch (err) {
    bad++
    for (const e of err.errors ?? [{ text: err.message }]) {
      const at = e.location ? `:${e.location.line}:${e.location.column}` : ''
      console.log(`\n  SYNTAX  ${f}${at}\n          ${e.text}`)
      if (e.location?.lineText) console.log(`          ${e.location.lineText.trim().slice(0, 100)}`)
    }
  }

  /* Layer two. */
  for (const h of danglingCommentsInTemplates(src)) {
    bad++
    console.log(`\n  TEMPLATE  ${f}:${h.line}`)
    console.log(`            A block comment opens inside a template literal and never closes inside it.`)
    console.log(`            This is what a stray backtick in a CSS comment looks like.`)
    console.log(`            …${h.snippet}…`)
  }
}

if (bad) {
  console.log(`\n${bad} problem${bad === 1 ? '' : 's'} across ${files.length} files.\n`)
  process.exit(1)
}
console.log(`syntax guard: ${files.length} files clean`)
