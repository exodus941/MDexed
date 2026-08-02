import os from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

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
})
