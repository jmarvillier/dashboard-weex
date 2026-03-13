/**
 * sw.js — Service Worker Ydash
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.0.10-pre-4 et 555c27e sont remplacés par vite.config.js au build.
 *
 * Stratégie :
 *  - Cache nommé par version+sha → purge automatique à chaque déploiement
 *  - Install  : mise en cache des assets + skipWaiting immédiat
 *  - Activate : purge anciens caches + claim + notifie les clients (SW_ACTIVATED)
 *  - Fetch    : version.json → réseau direct | reste → Network First avec fallback cache
 *  - Message  : SKIP_WAITING → activation immédiate (conservé pour compat)
 */

const VERSION    = '1.0.10-pre-4'
const GIT_SHA    = '555c27e'
const CACHE_NAME = `weex-${VERSION}-${GIT_SHA}-assets`

const PRECACHE_URLS = ['./', './index.html', './manifest.json', './version.json']

/* ── Install ──────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => {
        console.log(`[SW] Installed v${VERSION}@${GIT_SHA}`)
        // Activation immédiate sans attendre l'accord de l'app
        return self.skipWaiting()
      })
  )
})

/* ── Activate ─────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log(`[SW] Purge cache obsolète : ${k}`)
          return caches.delete(k)
        })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ includeUncontrolled: true }).then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: VERSION, sha: GIT_SHA }))
        )
      })
      .then(() => console.log(`[SW] Activé v${VERSION}@${GIT_SHA}`))
  )
})

/* ── Message ──────────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting demandé par l\'app')
    self.skipWaiting()
  }
})

/* ── Fetch ────────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return

  // version.json → toujours réseau
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)))
    return
  }

  // index.html → Network First : on essaie toujours le réseau en priorité
  // pour garantir que la dernière version est servie
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Assets (JS, CSS, images) → Cache First (ils ont un hash dans leur nom)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
        }
        return response
      })
    })
  )
})
