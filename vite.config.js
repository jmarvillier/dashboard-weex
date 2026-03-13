import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

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
      const swSrc = readFileSync(resolve(__dirname, 'src/sw.js'), 'utf-8')
      const swOut = swSrc
        .replace('__VERSION__', version)
        .replace('__GIT_SHA__', sha)

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
  base: '/dashboard-weex/',
  plugins: [react(), swPlugin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
})
