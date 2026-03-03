/**
 * InstallPrompt.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bannière d'invitation à installer / mettre à jour la PWA.
 *
 * Cas couverts :
 *  1. iOS/iPadOS Safari  → guide manuel (Partager → Écran d'accueil)
 *  2. Android / Chrome   → prompt natif beforeinstallprompt
 *  3. Version obsolète   → ré-affichage même si déjà dismissée autrefois,
 *                          que ce soit dans le navigateur ou dans l'app installée
 *
 * La version courante est injectée par Vite (VITE_APP_VERSION) et comparée
 * à la version "latest" lue dans /dashboard-weex/version.json (généré au build).
 * En l'absence de ce fichier, seule la détection install est active.
 */

import { useState, useEffect, useRef } from 'react'

/* ─── Clés localStorage ──────────────────────────────────────────────────── */
const KEY_DISMISSED = 'ydash-install-dismissed'
const KEY_DISMISSED_VERSION = 'ydash-install-dismissed-version'

/* ─── Version courante (injectée par Vite) ───────────────────────────────── */
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0'

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Compare semver : retourne true si b > a */
function isNewerVersion(a, b) {
  const parse = v => (v ?? '0.0.0').split('.').map(Number)
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (bMaj !== aMaj) return bMaj > aMaj
  if (bMin !== aMin) return bMin > aMin
  return bPat > aPat
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isIosSafari() {
  const ua = navigator.userAgent
  const standalone = window.navigator.standalone === true
  const safari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
  return isIos() && safari && !standalone
}

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

/* ─── Composant ──────────────────────────────────────────────────────────── */

export default function InstallPrompt() {
  const [mode, setMode] = useState(null)          // null | 'ios' | 'android' | 'update'
  const [latestVersion, setLatestVersion] = useState(null)
  const deferredPrompt = useRef(null)

  /* Capture le prompt natif Android/Chrome */
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      deferredPrompt.current = e
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  /* Récupère la version "latest" depuis version.json (généré au build) */
  useEffect(() => {
    fetch('/dashboard-weex/version.json?t=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.version) setLatestVersion(data.version) })
      .catch(() => {})
  }, [])

  /* Décide si on affiche et dans quel mode */
  useEffect(() => {
    const timer = setTimeout(() => {
      // ── Cas 1 : version obsolète (prioritaire) ──────────────────────────
      if (latestVersion && isNewerVersion(CURRENT_VERSION, latestVersion)) {
        const dismissedAt = localStorage.getItem(KEY_DISMISSED_VERSION)
        if (dismissedAt !== latestVersion) {
          setMode('update')
          return
        }
      }

      // ── Cas 2 : pas encore installée ────────────────────────────────────
      if (!isStandalone()) {
        const dismissed = localStorage.getItem(KEY_DISMISSED)
        if (dismissed) return                 // déjà refusé, on n'insiste pas

        if (isIosSafari()) {
          setMode('ios')
          return
        }

        // Android / Chrome : on attend que le prompt natif soit capturé
        if (deferredPrompt.current) {
          setMode('android')
          return
        }
      }
    }, 1800)

    return () => clearTimeout(timer)
  }, [latestVersion])

  /* Attente du prompt natif (peut arriver après le premier rendu) */
  useEffect(() => {
    if (mode !== null) return
    const handler = () => {
      if (!isStandalone() && !localStorage.getItem(KEY_DISMISSED)) {
        setMode('android')
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [mode])

  /* ── Dismiss ──────────────────────────────────────────────────────────── */
  function dismiss() {
    if (mode === 'update') {
      localStorage.setItem(KEY_DISMISSED_VERSION, latestVersion)
    } else {
      localStorage.setItem(KEY_DISMISSED, '1')
    }
    setMode(null)
  }

  /* ── Trigger install Android ─────────────────────────────────────────── */
  async function triggerAndroidInstall() {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    if (outcome === 'accepted') setMode(null)
    else dismiss()
  }

  if (!mode) return null

  /* ── Rendu ───────────────────────────────────────────────────────────── */

  const isUpdate = mode === 'update'

  return (
    <div className={`install-prompt ${isUpdate ? 'install-prompt--update' : ''}`}>
      <button className="install-close" onClick={dismiss} aria-label="Fermer">✕</button>

      {/* ── Bannière MISE À JOUR ── */}
      {isUpdate && (
        <>
          <div className="install-header">
            <span className="install-icon">🔄</span>
            <div>
              <div className="install-title">Nouvelle version disponible</div>
              <div className="install-sub">
                v{CURRENT_VERSION} → <strong style={{ color: 'var(--gold)' }}>v{latestVersion}</strong>
              </div>
            </div>
          </div>
          <div className="install-why">
            Une mise à jour est disponible. Réinstalle l'application pour bénéficier
            des dernières améliorations et corrections.
          </div>
          {isIosSafari() && (
            <div className="install-steps">
              <div className="install-step">
                <span className="install-num">1</span>
                <span>Supprime l'icône Ydash de ton écran d'accueil</span>
              </div>
              <div className="install-step">
                <span className="install-num">2</span>
                <span>Ouvre ce lien dans Safari puis <strong>⎋ Partager → Écran d'accueil</strong></span>
              </div>
            </div>
          )}
          {mode === 'android' && (
            <button className="install-cta" onClick={triggerAndroidInstall}>
              📲 Installer la mise à jour
            </button>
          )}
          {!isIosSafari() && mode !== 'android' && (
            <div className="install-why">
              Ferme puis réouvre l'application pour charger la nouvelle version.
            </div>
          )}
        </>
      )}

      {/* ── Bannière iOS INSTALL ── */}
      {mode === 'ios' && (
        <>
          <div className="install-header">
            <span className="install-icon">📲</span>
            <div>
              <div className="install-title">Installer Ydash</div>
              <div className="install-sub">Données permanentes · Accès hors-ligne</div>
            </div>
          </div>
          <div className="install-steps">
            <div className="install-step">
              <span className="install-num">1</span>
              <span>Appuie sur <strong>⎋ Partager</strong> en bas de Safari</span>
            </div>
            <div className="install-step">
              <span className="install-num">2</span>
              <span>Choisis <strong>"Sur l'écran d'accueil"</strong></span>
            </div>
            <div className="install-step">
              <span className="install-num">3</span>
              <span>Appuie sur <strong>Ajouter</strong> — c'est tout !</span>
            </div>
          </div>
          <div className="install-why">
            💡 Une fois installée, tes données sont <strong>permanentes</strong> —
            Apple n'efface pas le stockage des apps ajoutées à l'écran d'accueil.
          </div>
        </>
      )}

      {/* ── Bannière Android INSTALL ── */}
      {mode === 'android' && !isUpdate && (
        <>
          <div className="install-header">
            <span className="install-icon">📲</span>
            <div>
              <div className="install-title">Installer Ydash</div>
              <div className="install-sub">Accès direct · Hors-ligne</div>
            </div>
          </div>
          <div className="install-why" style={{ marginBottom: 12 }}>
            Installe l'application sur ton téléphone pour y accéder sans passer par le navigateur.
          </div>
          <button className="install-cta" onClick={triggerAndroidInstall}>
            📲 Installer la version mobile
          </button>
        </>
      )}
    </div>
  )
}

/* ─── Export du helper version (utilisé par Topbar) ─────────────────────── */
export { CURRENT_VERSION, isNewerVersion }
