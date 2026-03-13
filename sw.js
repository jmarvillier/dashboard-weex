/**
 * sw.js — Service Worker Ydash
 * 1.0.10-pre-6 et dc60c3a sont injectés par vite.config.js au build.
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

const VERSION    = '1.0.10-pre-6'
const GIT_SHA    = 'dc60c3a'
const CACHE_NAME = `ydash-${VERSION}-${GIT_SHA}`

/* ── Install ─────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log(`[SW] install ${CACHE_NAME}`)
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

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  const path = url.pathname

  // sw.js et version.json → JAMAIS intercepté, toujours réseau direct
  if (path.endsWith('/sw.js') || path.endsWith('/version.json')) return

  // Assets hashés Vite (contiennent un hash dans le nom) → Cache First
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
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response?.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(c => c.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
