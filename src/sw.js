/**
 * sw.js — Service Worker Ydash
 * __APP_VERSION__ et __GIT_SHA__ sont injectés par vite.config.js au build.
 *
 * Stratégie :
 *  - skipWaiting() immédiat dans install → activation sans attendre
 *  - clients.claim() dans activate → contrôle immédiat de tous les onglets
 *  - index.html : Network First → toujours la page la plus récente
 *  - assets JS/CSS (noms hashés) : Cache First → performance
 *  - sw.js / version.json : jamais interceptés → toujours réseau
 */

const VERSION    = '__APP_VERSION__'
const GIT_SHA    = '__GIT_SHA__'
const CACHE_NAME = `ydash-${VERSION}-${GIT_SHA}`

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
]

/* ── Install : précache + activation immédiate ────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => {
        console.log(`[SW] install ${CACHE_NAME}`)
        self.skipWaiting()          // ← clé : pas besoin de message SKIP_WAITING
      })
  )
})

/* ── Activate : purge anciens caches + prise de contrôle immédiate ────────── */
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
        console.log(`[SW] activate ${CACHE_NAME}`)
        return self.clients.claim()  // ← prend le contrôle sans attendre de reload
      })
  )
})

/* ── Fetch ────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requêtes non-GET et hors-origine
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // sw.js et version.json → toujours réseau, jamais intercepté
  const path = url.pathname
  if (path.endsWith('/sw.js') || path.endsWith('/version.json')) return

  // index.html → Network First
  // Garantit que la dernière version est servie quand on est en ligne
  if (path.endsWith('/') || path.endsWith('/index.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(c => c.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))   // fallback hors-ligne
    )
    return
  }

  // Tout le reste (assets JS/CSS/images avec hash Vite) → Cache First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response?.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(request, response.clone()))
        }
        return response
      })
    })
  )
})
