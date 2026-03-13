/**
 * sw.js — Service Worker Ydash
 * 1.0.10-pre-5 et cd322a1 sont injectés par vite.config.js au build.
 *
 * Stratégie anti-cache-zombie :
 *  - install  : skipWaiting() immédiat → activation sans attendre
 *  - activate : purge TOUS les anciens caches + clients.claim()
 *  - fetch    :
 *      • sw.js / version.json       → jamais intercepté (réseau direct)
 *      • HTML (index.html, nav)     → Network First (+ fallback cache hors-ligne)
 *      • Assets hashés Vite (js/css)→ Cache First (le hash change à chaque build)
 *      • Autres (fonts, images)     → Network First
 */

const VERSION    = '__VERSION__'
const GIT_SHA    = '__GIT_SHA__'
const CACHE_NAME = `ydash-${VERSION}-${GIT_SHA}`

/* ── Install ─────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log(`[SW] install ${CACHE_NAME}`)
  // skipWaiting immédiat : le nouveau SW prend le contrôle dès qu'il est prêt
  // Pas de précache de index.html — il sera mis en cache au premier fetch
  self.skipWaiting()
})

/* ── Activate ────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log(`[SW] purge : ${k}`)
            return caches.delete(k)
          })
      ))
      .then(() => {
        console.log(`[SW] activate ${CACHE_NAME} → claim`)
        return self.clients.claim()
      })
  )
})

/* ── Fetch ────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer non-GET et hors-origine
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  const path = url.pathname

  // sw.js et version.json → JAMAIS intercepté, toujours réseau direct
  if (path.endsWith('/sw.js') || path.endsWith('/version.json')) return

  // Assets hashés Vite (contiennent un hash dans le nom) → Cache First
  // Ex: /assets/index-bAoQ7yez.css, /assets/index-tesAGcla.js
  if (path.includes('/assets/') && /\.[a-z0-9]{8,}\.(js|css)$/i.test(path)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response?.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // TOUT LE RESTE (HTML, images, fonts…) → Network First
  // C'est la clé : index.html est TOUJOURS servi depuis le réseau si dispo
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response?.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(c => c.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request)) // Fallback hors-ligne
  )
})
