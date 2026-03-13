/**
 * sw.js — Service Worker Ydash
 * 1.0.10-pre-5 et a4ac8dd sont remplacés par vite.config.js au build.
 *
 * Stratégie :
 *  - Cache nommé par version+sha → purge automatique à chaque déploiement
 *  - Install  : précache les assets + skipWaiting immédiat
 *  - Activate : purge tous les anciens caches + claim
 *  - Fetch    : Network First sur index.html, Cache First sur assets hashés
 *  - Message  : SKIP_WAITING → activation immédiate
 */

const VERSION    = '1.0.10-pre-5'
const GIT_SHA    = 'a4ac8dd'
const CACHE_NAME = `weex-${VERSION}-${GIT_SHA}`

const PRECACHE_URLS = ['./', './index.html', './manifest.json', './version.json']

/* ── Install ──────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => {
        console.log(`[SW] Installed ${CACHE_NAME}`)
        return self.skipWaiting() // Activation immédiate, sans attendre
      })
  )
})

/* ── Activate ─────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log(`[SW] Suppression cache obsolète : ${k}`)
            return caches.delete(k)
          })
      ))
      .then(() => self.clients.claim()) // Prend le contrôle de tous les onglets ouverts
      .then(() => console.log(`[SW] Actif : ${CACHE_NAME}`))
  )
})

/* ── Message ──────────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

/* ── Fetch ────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return

  // version.json et sw.js → toujours réseau, jamais en cache
  if (url.pathname.endsWith('version.json') || url.pathname.endsWith('sw.js')) {
    event.respondWith(fetch(request))
    return
  }

  // index.html → Network First : la page fraîche en priorité, cache en fallback offline
  if (url.pathname === '/dashboard-weex/' ||
      url.pathname === '/dashboard-weex/index.html' ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request)) // fallback offline
    )
    return
  }

  // Assets JS/CSS/images (noms hashés par Vite) → Cache First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response?.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
        }
        return response
      })
    })
  )
})
