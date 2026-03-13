/**
 * useVersionCheck.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Au démarrage, récupère version.json depuis le réseau (jamais depuis le cache)
 * et compare avec la version stockée localement.
 * Si la version a changé → purge tous les caches SW + reload.
 *
 * Entièrement automatique, aucune intervention manuelle requise.
 */

const VERSION_URL     = '/dashboard-weex/version.json'
const LS_KEY_VERSION  = 'ydash-cached-version'

export async function checkAndRefreshVersion() {
  try {
    // Fetch version.json en forçant le réseau (bypass cache HTTP et SW)
    const res = await fetch(VERSION_URL, { cache: 'no-store' })
    if (!res.ok) return

    const { version, sha } = await res.json()
    const remoteKey  = `${version}-${sha}`
    const cachedKey  = localStorage.getItem(LS_KEY_VERSION)

    console.log(`[Version] Local: ${cachedKey ?? 'aucune'} / Réseau: ${remoteKey}`)

    if (cachedKey === remoteKey) return  // Rien à faire, on est à jour

    console.log('[Version] Nouvelle version détectée → purge des caches…')

    // Purge tous les caches SW
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => {
        console.log(`[Version] Suppression cache : ${k}`)
        return caches.delete(k)
      }))
    }

    // Désenregistre le SW pour forcer le rechargement complet
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
    }

    // Sauvegarde la nouvelle version
    localStorage.setItem(LS_KEY_VERSION, remoteKey)

    console.log('[Version] Purge terminée → reload')
    window.location.reload()

  } catch (e) {
    // Pas de réseau → on continue avec le cache, pas bloquant
    console.warn('[Version] Vérification impossible (hors ligne ?):', e.message)
  }
}
