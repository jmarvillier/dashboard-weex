/**
 * src/sw.js — Service Worker WEEX Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Stratégie anti cache-post-déploiement :
 *
 *   index.html / sw.js   → Network-first TOUJOURS
 *                          Le navigateur récupère toujours la dernière version.
 *                          C'est index.html qui charge les bons JS/CSS hashés.
 *
 *   Assets hashés         → Cache-first (sûr car le hash change à chaque build)
 *   *.js, *.css, *.png    Les anciens ne sont jamais re-servis car leur URL change.
 *
 *   Google Sheets CSV     → Network-first (données toujours fraîches)
 *   Google Fonts          → Cache-first longue durée (immuables)
 *
 * Versioning automatique :
 *   __APP_VERSION__ et __BUILD_HASH__ sont injectés par Vite au build.
 *   Le nom du cache change à chaque build → purge automatique des anciens.
 */

const APP_VERSION  = '__APP_VERSION__'
const BUILD_HASH   = '__BUILD_HASH__'

const ASSETS_CACHE = `weex-${APP_VERSION}-${BUILD_HASH}-assets`
const DATA_CACHE   = `weex-${APP_VERSION}-${BUILD_HASH}-data`

const BASE = '/dashboard-weex/'

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log(`[SW] Install — v${APP_VERSION} build:${BUILD_HASH}`)
  // Précache uniquement index.html — les assets hashés se cachent à la demande
  event.waitUntil(
    caches.open(ASSETS_CACHE)
      .then(cache => cache.add(`${BASE}index.html`))
      .then(() => self.skipWaiting())
  )
})

// ── Activate — purge les caches obsolètes ─────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activate — purge caches obsolètes`)
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== ASSETS_CACHE && k !== DATA_CACHE)
          .map(k => {
            console.log(`[SW] Supprime : ${k}`)
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

  // 1. Google Sheets CSV → Network-first (données toujours fraîches)
  if (url.hostname === 'docs.google.com') {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }

  // 2. Google Fonts → Cache-first longue durée (URLs immuables)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, ASSETS_CACHE))
    return
  }

  // 3. index.html et sw.js → Network-first TOUJOURS
  //    Garantit que le navigateur voit toujours la dernière version déployée.
  //    Le fallback cache couvre le mode offline / raccourci iPad.
  if (
    request.mode === 'navigate' ||
    url.pathname === `${BASE}` ||
    url.pathname === `${BASE}index.html` ||
    url.pathname === `${BASE}sw.js`
  ) {
    event.respondWith(networkFirst(request, ASSETS_CACHE))
    return
  }

  // 4. Assets avec hash dans le nom (ex: index-Bx3kqA2f.js)
  //    → Cache-first : leur URL est unique par build, jamais de conflit
  if (url.pathname.match(/\.[a-f0-9]{8}\.(js|css|png|svg|woff2?)$/)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE))
    return
  }

  // 5. Tout le reste → Network-first avec fallback cache
  event.respondWith(networkFirst(request, ASSETS_CACHE))
})

// ── Message ───────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
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
    const cached = await caches.match(request)
    return cached || Response.error()
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