/**
 * sw.js — Service Worker WEEX Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Fix v3 :
 *   - Numéro de version incrémenté → force la mise à jour sur Chrome/Safari
 *   - Navigation fallback → renvoie index.html pour TOUTES les requêtes de
 *     navigation (corrige la page blanche sur le shortcut iPad)
 *   - Cache-first sécurisé avec fallback réseau
 */

const VERSION      = 'weex-v3'           // ← incrémenter à chaque déploiement
const ASSETS_CACHE = `${VERSION}-assets`
const DATA_CACHE   = `${VERSION}-data`

const BASE = '/dashboard-weex/'

// Shell minimal à précacher
const PRECACHE_URLS = [
  BASE,
  `${BASE}index.html`,
]

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())   // active immédiatement sans attendre
  )
})

// ── Activate — purge les anciens caches ───────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== ASSETS_CACHE && k !== DATA_CACHE)
          .map(k  => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // prend le contrôle de tous les onglets
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = request.url

  // 1. Google Sheets CSV → Network-first (données toujours fraîches)
  if (url.includes('docs.google.com/spreadsheets')) {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }

  // 2. Google Fonts → Network-first avec mise en cache longue durée
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(networkFirst(request, ASSETS_CACHE))
    return
  }

  // 3. Requêtes de NAVIGATION (ouverture de l'app, raccourci iPad)
  //    → Toujours renvoyer index.html depuis le cache
  //    → C'est ce qui corrige la page blanche sur le shortcut
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(`${BASE}index.html`)
        .then(cached => cached || fetch(request))
        .catch(() => caches.match(`${BASE}index.html`))
    )
    return
  }

  // 4. Tous les autres assets (JS, CSS, images…) → Cache-first
  event.respondWith(cacheFirst(request, ASSETS_CACHE))
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

// ── Message : force l'activation immédiate ────────────────────────────────────
// Reçu depuis index.html quand un nouveau SW est en attente

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})