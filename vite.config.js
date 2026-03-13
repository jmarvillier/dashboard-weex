import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

// Base path : /dashboard-weex/ en prod, /dashboard-weex/staging/ en staging
const base = process.env.VITE_BASE || '/dashboard-weex/'

function getGitSha() {
  try {
    return execSync('git rev-parse --short=7 HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

/**
 * swPlugin — injecte VERSION / GIT_SHA dans src/sw.js → dist/sw.js
 * et génère version.json dans dist/
 */
function swPlugin() {
  const version = pkg.version
  let sha = 'dev'

  return {
    name: 'ydash-sw',
    buildStart() {
      sha = getGitSha()
    },
    generateBundle() {
      /* ── sw.js ── */
      let swSrc
      try {
        swSrc = readFileSync(resolve(__dirname, 'src/sw.js'), 'utf-8')
      } catch (e) {
        console.warn('[swPlugin] src/sw.js introuvable, skip:', e.message)
        return
      }

      // Remplacement global (toutes les occurrences)
      const swOut = swSrc
        .replaceAll('__VERSION__', version)
        .replaceAll('__GIT_SHA__', sha)

      console.log(`[swPlugin] sw.js → v${version}@${sha}`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swOut })

      /* ── version.json ── */
      const versionJson = JSON.stringify({
        version,
        sha,
        builtAt: new Date().toISOString(),
      })
      this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson })
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), swPlugin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
