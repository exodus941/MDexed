/* Advance the build number.
 *
 * Run before pushing — `npm run bump -w apps/web` — so the number is decided
 * at commit time and travels with the commit. Vercel then builds whatever the
 * file says, which is the behaviour you want: rebuilding the same commit is
 * the same build and keeps the same number, rather than inventing a new one.
 *
 * Deliberately not wired into `npm run build`. Every local build during a
 * day's work would burn a number, and the counter would say thirty when three
 * things had actually shipped — which is the problem this replaced.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build-number.json')

const two = n => String(n).padStart(2, '0')
const now = new Date()
const date = `${two(now.getFullYear() % 100)}${two(now.getMonth() + 1)}${two(now.getDate())}`

let prev = { date: '', n: 0 }
try { prev = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* first run */ }

/* A new day starts at one. The date is part of the id, so the counter only
   ever has to be unique within it. */
const next = { date, n: prev.date === date ? Number(prev.n) + 1 : 1 }

fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
console.log(`${next.date}-${next.n}`)
