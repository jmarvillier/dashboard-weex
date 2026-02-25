/**
 * sw.js — Service Worker WEEX Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Stratégie : Cache-first pour les assets statiques, Network-first pour les CSV
 * Google Sheets.
 *
 * Avantage PWA installée sur iPad :
 *   → Apple exempte les PWA installées (ajoutées à l'écran d'accueil) de la
 *     politique ITP de 7 jours. Les données IndexedDB persistent indéfiniment.
 */

const CACHE_NAME    = 'weex-v2'
const ASSETS_CACHE  = 'weex-assets-v2'

// Assets à précacher au premier chargement
const PRECACHE_URLS = [
  '/dashboard-weex/',
  '/dashboard-weex/index.html',
]

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== ASSETS_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = event.request.url

  // Google Sheets CSV → Network-first (données fraîches si dispo, cache sinon)
  if (url.includes('docs.google.com/spreadsheets')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Google Fonts → Network-first avec fallback cache
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone()
          caches.open(ASSETS_CACHE).then(c => c.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Tous les autres assets → Cache-first (app shell offline)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }
        const clone = response.clone()
        caches.open(ASSETS_CACHE).then(c => c.put(event.request, clone))
        return response
      })
    })
  )
})
