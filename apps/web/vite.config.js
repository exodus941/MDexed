import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* ── The app's own build number ──
 *
 * `260802-3` — the third build of 2 August 2026. Baked in at compile time,
 * because a running app cannot know when it was compiled.
 *
 * The counter comes from build-number.json, advanced by the pre-commit hook in
 * .githooks — once per batch of commits, so it still counts deploys and not
 * commits. `npm run bump -w apps/web` does the same thing by hand.
 *
 * It has to be advanced by something. Forgetting means Vercel rebuilds and
 * stamps the id it already had, which reads as a deploy that never happened.
 *
 * It was derived from the day's commit count first, and that number
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

/* ── The syntax guard, at save time ──
 *
 * The guard already runs in the pre-commit hook, and the hook already refuses
 * a broken commit. That is the last line, not the first. Between writing the
 * fault and reaching a commit there were two builds, and one of those I read
 * wrong: the guard had caught it and I had sent its output to /dev/null, so I
 * saw silence and called it a pass.
 *
 * This closes both gaps. The report arrives about a second after the save, in
 * the browser overlay, where it cannot be silenced or misread as success.
 *
 * It shells out to the same script the hook runs rather than reimplementing
 * the checks. A second copy of a detector drifts from the first, and a drifted
 * detector is the exact class of bug this whole guard exists for.
 */
function syntaxGuardOnSave() {
  const script = fileURLToPath(new URL('../../tools/syntax-guard.mjs', import.meta.url))
  const cwd = fileURLToPath(new URL('.', import.meta.url))
  let running = false

  /* Shared by both entry points below. Returns the report on failure, null on
     a clean run. */
  const run = () => {
    try {
      execSync(`node "${script}" src`, { cwd, stdio: 'pipe' })
      return null
    } catch (err) {
      return [err.stdout, err.stderr].map(b => (b ? b.toString() : '')).join('')
    }
  }

  return {
    name: 'syntax-guard-on-save',
    apply: 'serve',

    /* Once at startup as well as on every save. `handleHotUpdate` fires on a
       CHANGE, so a fault already on disk when the server boots produces no
       event and no report — the page just comes up blank, which is the
       original symptom with the alarm switched off. */
    configureServer(server) {
      const report = run()
      if (report) console.error('\n' + report)
    },

    handleHotUpdate({ file, server }) {
      if (!/\.(js|jsx)$/.test(file)) return
      /* One at a time. A save that touches several files would otherwise start
         several scans and report the same fault more than once. */
      if (running) return
      running = true
      try {
        const report = run()
        if (!report) return
        console.error('\n' + report)
        server.ws.send({
          type: 'error',
          err: {
            message: 'Syntax guard refused this save\n\n' + report,
            /* Vite's overlay wants a stack. An empty one renders an empty
               panel, which is a guard that reports nothing — the failure mode
               this plugin exists to remove. */
            stack: `at ${file}`,
            plugin: 'syntax-guard-on-save',
            id: file,
          },
        })
        /* Stop the update here. Left to continue, the next hot update repainted
           the client and took the overlay with it — measured: the report
           reached the terminal, the browser went blank, and the overlay was
           gone by the time anyone looked. A blank page with no explanation is
           exactly the symptom this trap produces on its own. */
        return []
      } finally {
        running = false
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), syntaxGuardOnSave()],

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

  /* ── ONE 977KB CHUNK, SPLIT BY HOW OFTEN EACH PART CHANGES ──
   *
   * Vite warned about this on every build and the warning was ignored. The cost
   * is not the total, which barely moves: it is that every edit to any source
   * file invalidated the whole 977KB, so a returning reader re-downloaded React
   * and the colour maths to pick up a one-line change.
   *
   * Split on CHANGE RATE, not on size. `react` and `react-dom` change when they
   * are upgraded, a few times a year. `culori` is the colour maths behind every
   * ramp and conversion, and it changes never. The app changes on every commit.
   * Three chunks, and two of them stay in cache across a deploy.
   *
   * Named functions rather than an object map, because `manualChunks` as an
   * object cannot express "anything under this path" without listing files. */
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          /* `react-dom/server` is EXCLUDED, and that exclusion is the whole
             difference between this helping and hurting.
           *
             The HTML export imports it dynamically, so Rollup gives it its own
             185KB async chunk that a reader who never exports never downloads.
             Naming `react-dom` here pulled it into the always-loaded chunk:
             measured 385KB for react against 200KB, and first-load bytes went
             from 992KB to 1191KB. The split made the number worse while the
             warning went quiet.

             So match the client renderer and the scheduler, and let the server
             renderer keep the async chunk it already had. */
          if (/[\\/]node_modules[\\/]react-dom[\\/].*server/.test(id)) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/[\\/]node_modules[\\/]culori[\\/]/.test(id)) return 'colour'
        },
      },
    },
    /* Just above the app chunk at 760KB, so the warning still fires the next
       time it grows. Silencing it outright would remove the only thing that
       reported the problem, and leaving it below the current size makes it fire
       on every build, which trains the reader to skim it.
     *
     * The app chunk is the next thing to split if it passes this. The panels are
     * the obvious seam: eleven of them, and a reader opens one at a time. */
    chunkSizeWarningLimit: 800,
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
}))
