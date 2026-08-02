import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* ── The app's own build number ──
 *
 * `260802-3` — the third build of 2 August 2026. Baked in at compile time,
 * because a running app cannot know when it was compiled.
 *
 * The counter comes from build-number.json, advanced by `npm run bump` before
 * a push. It was derived from the day's commit count first, and that number
 * was wrong in the way that matters: twenty-eight commits had produced three
 * things worth calling a build. Counting builds gives the smaller and truer
 * number, and it costs one committed file.
 *
 * Because the number lives in the repo, rebuilding a commit reproduces its id
 * instead of inventing a new one — the same source is the same build.
 *
 * The short SHA still comes from git, and is allowed to be missing: a tarball
 * or a stripped CI image shouldn't fail a deploy over a version string.
 */
function buildId() {
  let stamp = { date: '000000', n: 0 }
  try { stamp = JSON.parse(fs.readFileSync(new URL('./build-number.json', import.meta.url), 'utf8')) }
  catch { /* keep the placeholder rather than break the build */ }
  let sha = ''
  try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
  catch { /* no git here */ }
  return { version: `${stamp.date}-${stamp.n}`, sha: sha || null }
}

export default defineConfig(({ command }) => ({
  plugins: [react()],

  /* `dev` in the dev server: a build number there would name a build that was
     never produced, and the thing you are looking at is whatever is on disk
     this second. */
  define: {
    __APP_BUILD__: JSON.stringify(command === 'serve' ? { version: 'dev', sha: null } : buildId()),
  },

  /* Vite's dependency cache normally lives in node_modules/.vite. Re-optimising
     replaces that directory with an atomic rename, and if the project sits in a
     synced folder — Dropbox, OneDrive, iCloud — the syncer holds a handle open
     and the rename fails with EBUSY. The dev server then serves a cache that
     half-exists and the page comes up blank, which looks like a code error and
     is not one.

     Keeping the cache in the OS temp directory takes it out of anything's
     watch path. Derived and disposable, so nothing is lost by moving it. */
  cacheDir: path.join(os.tmpdir(), 'vite-design-md-editor'),

  /* The HTML export imports this on demand, so Vite never sees it while
     crawling the entry graph at startup. Without it listed here the first click
     triggers a re-optimisation mid-session; production builds were always
     fine, because the bundler resolves it statically. */
  optimizeDeps: { include: ['react-dom/server'] },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
}))
