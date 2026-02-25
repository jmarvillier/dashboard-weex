/**
 * src/sw.js — Service Worker WEEX Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPLATE — les placeholders sont remplacés par Vite au build :
 *
 *   __APP_VERSION__  → "version" de package.json       ex: "1.1.0"
 *   __GIT_SHA__      → SHA court du commit Git          ex: "a1b2c3d"
 *
 * Nom du cache résultant : "weex-1.1.0-a1b2c3d-assets"
 *   → Unique par commit → purge automatique à chaque déploiement
 *   → Traçable depuis les DevTools (Application → Cache Storage)
 *
 * Stratégies :
 *   index.html / sw.js    → Network-first  (toujours la dernière version)
 *   Assets hashés .js/.css → Cache-first   (URL unique par build, sûr)
 *   Google Sheets          → Network-first  (données fraîches)
 *   Google Fonts           → Cache-first    (immuables côté Google)
 *   Reste                  → Network-first  avec fallback cache
 */

const APP_VERSION  = '__APP_VERSION__'
const GIT_SHA      = '__GIT_SHA__'

const CACHE_KEY    = `weex-${APP_VERSION}-${GIT_SHA}`
const ASSETS_CACHE = `${CACHE_KEY}-assets`
const DATA_CACHE   = `${CACHE_KEY}-data`

const BASE = '/dashboard-weex/'

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log(`[SW] Install — v${APP_VERSION} @ ${GIT_SHA}`)
  event.waitUntil(
    caches.open(ASSETS_CACHE)
      .then(cache => cache.add(`${BASE}index.html`))
      .then(() => self.skipWaiting())
  )
})

// ── Activate — purge les caches des commits précédents ───────────────────────

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activate — purge caches != ${CACHE_KEY}`)
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_KEY))
          .map(k => {
            console.log(`[SW] Supprime cache obsolète : ${k}`)
            return caches.delete(k)
          })
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Google Sheets → Network-first
  if (url.hostname === 'docs.google.com') {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }

  // Google Fonts → Cache-first (URLs immuables)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, ASSETS_CACHE))
    return
  }

  // index.html + sw.js → Network-first (toujours la version du dernier commit)
  if (
    request.mode === 'navigate' ||
    url.pathname === BASE ||
    url.pathname === `${BASE}index.html` ||
    url.pathname === `${BASE}sw.js`
  ) {
    event.respondWith(networkFirst(request, ASSETS_CACHE))
    return
  }

  // Assets hashés (ex: index-Bx3kqA2f.js) → Cache-first
  // Sûr car Vite change le hash à chaque modification du fichier
  if (url.pathname.match(/\.[a-f0-9]{8,}\.(js|css|png|svg|woff2?)$/)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE))
    return
  }

  // Tout le reste → Network-first avec fallback cache
  event.respondWith(networkFirst(request, ASSETS_CACHE))
})

// ── Message ───────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  // Permet d'interroger la version depuis l'app React
  if (event.data?.type === 'GET_VERSION') {
    event.source.postMessage({
      type    : 'VERSION',
      version : APP_VERSION,
      sha     : GIT_SHA,
      cache   : CACHE_KEY,
    })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return caches.match(request).then(c => c || Response.error())
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return Response.error()
  }
}