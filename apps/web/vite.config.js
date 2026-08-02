import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* ── The app's own build number ──
 *
 * `260802-3` — the third build of 2 August 2026. Baked in at build time,
 * because a running app cannot know when it was compiled.
 *
 * The counter is the number of commits landed that day, which makes it a real
 * fact about the build rather than a number someone has to remember to
 * increment. Two builds from the same commit get the same id, which is
 * correct: they are the same build.
 *
 * Git may be missing (a tarball, a stripped CI image), so every step degrades
 * rather than failing the build — a version string is not worth a broken
 * deploy.
 */
function buildId() {
  const now = new Date()
  const two = n => String(n).padStart(2, '0')
  const date = `${two(now.getFullYear() % 100)}${two(now.getMonth() + 1)}${two(now.getDate())}`
  const git = cmd => {
    try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
    catch { return '' }
  }
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const count = git(`git log --since="${midnight}" --oneline`).split('\n').filter(Boolean).length
  const sha = git('git rev-parse --short HEAD')
  return { version: `${date}-${Math.max(1, count)}`, sha: sha || null }
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
