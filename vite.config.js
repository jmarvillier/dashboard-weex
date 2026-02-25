/**
 * vite.config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Versioning du cache basé sur le SHA Git du commit courant.
 *
 * Résultat dans le SW : ASSETS_CACHE = "weex-a1b2c3d-assets"
 *   → Unique par commit → purge automatique à chaque déploiement
 *   → Traçable : on sait exactement quel commit est en cache
 *
 * Fallback si Git n'est pas disponible (ex: CI sans checkout complet) :
 *   → timestamp base36
 */

import { defineConfig }  from 'vite'
import react             from '@vitejs/plugin-react'
import { readFileSync }  from 'fs'
import { execSync }      from 'child_process'
import { resolve }       from 'path'

// ── Version depuis package.json ───────────────────────────────────────────────

const pkg     = JSON.parse(readFileSync('./package.json', 'utf-8'))
const version = pkg.version

// ── SHA Git court (7 caractères) ──────────────────────────────────────────────

function getGitSha() {
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: 'pipe' })
      .toString()
      .trim()
  } catch {
    // Pas de repo Git ou CI sans historique → fallback timestamp
    console.warn('[vite] Git SHA non disponible, fallback timestamp')
    return Date.now().toString(36)
  }
}

const gitSha = getGitSha()

console.log(`[vite] Build — v${version} @ ${gitSha}`)

// ── Plugin : injecte SHA + version dans src/sw.js → dist/sw.js ───────────────

function swPlugin() {
  return {
    name: 'sw-git-inject',
    generateBundle() {
      const swSrc = readFileSync(resolve(__dirname, 'src/sw.js'), 'utf-8')
      const swOut = swSrc
        .replace(/__APP_VERSION__/g, version)
        .replace(/__GIT_SHA__/g,     gitSha)

      this.emitFile({
        type     : 'asset',
        fileName : 'sw.js',
        source   : swOut,
      })
    },
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

const base = process.env.VITE_BASE ?? '/dashboard-weex/'

export default defineConfig({
  plugins  : [react(), swPlugin()],
  base,
  publicDir: 'public',

  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    'import.meta.env.VITE_GIT_SHA'    : JSON.stringify(gitSha),
  },
})