/**
 * InstallPrompt.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gère deux cas distincts :
 *
 *  1. INSTALLATION INITIALE
 *     - iOS/iPadOS Safari  → détection UA corrigée (iPad 13+ = "Macintosh")
 *     - Android / Chrome   → prompt natif beforeinstallprompt
 *     - Dismissable définitivement (localStorage)
 *
 *  2. MISE À JOUR DISPONIBLE
 *     - Détectée via l'événement SW "updatefound" (nouveau SW en attente)
 *     - Un bouton "Mettre à jour" envoie SKIP_WAITING au SW → reload propre
 *     - PAS de désinstallation/réinstallation nécessaire
 *     - Ré-affiché à chaque nouvelle version même si dismissé avant
 */

import { useState, useEffect, useRef } from 'react'

/* ─── Clés localStorage ──────────────────────────────────────────────────── */
const KEY_DISMISSED         = 'ydash-install-dismissed'
const KEY_UPDATE_DISMISSED  = 'ydash-update-dismissed-sha'

/* ─── Version courante (injectée par Vite) ───────────────────────────────── */
export const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0'

/* ─── Helpers détection plateforme ──────────────────────────────────────── */

/**
 * iOS 13+ sur iPad : le UA contient "Macintosh" et non "iPad".
 * On doit aussi vérifier maxTouchPoints pour distinguer iPad de Mac.
 */
function isIosDevice() {
  const ua = navigator.userAgent
  const classicIos = /iphone|ipad|ipod/i.test(ua)
  // iPad 13+ se présente comme "Macintosh" mais avec touch
  const modernIpad = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  return classicIos || modernIpad
}

function isIosSafari() {
  const ua         = navigator.userAgent
  const standalone = window.navigator.standalone === true
  const safari     = /safari/i.test(ua) && !/chrome|crios|fxios|android/i.test(ua)
  return isIosDevice() && safari && !standalone
}

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

/* ─── Composant ──────────────────────────────────────────────────────────── */

export default function InstallPrompt() {
  // 'install-ios' | 'install-android' | 'update' | null
  const [mode, setMode]               = useState(null)
  const [pendingSW, setPendingSW]     = useState(null)   // registration du SW en attente
  const [newSWsha, setNewSWsha]       = useState(null)   // SHA du nouveau SW (pour dédoublonner dismiss)
  const deferredPrompt                = useRef(null)
  const swReg                         = useRef(null)

  /* ── Capture le prompt natif Android ── */
  useEffect(() => {
    const handler = e => {
      e.preventDefault()
      deferredPrompt.current = e
      if (!isStandalone() && !localStorage.getItem(KEY_DISMISSED)) {
        setMode('install-android')
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  /* ── Détection initiale install iOS ── */
  useEffect(() => {
    const t = setTimeout(() => {
      if (isIosSafari() && !localStorage.getItem(KEY_DISMISSED)) {
        setMode('install-ios')
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [])

 /* ── Écoute les mises à jour SW ── */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Quand un nouveau SW prend le contrôle → reload propre
    // (le SW fait skipWaiting automatiquement, donc ça arrive dès le prochain load)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }, [])
  
  /* ── Appliquer la mise à jour ── */
  function applyUpdate() {
    const sw = pendingSW || swReg.current?.waiting
    if (sw) {
      sw.postMessage({ type: 'SKIP_WAITING' })
    } else {
      window.location.reload()
    }
  }

  /* ── Dismiss ── */
  function dismiss() {
    if (mode === 'update') {
      if (newSWsha) localStorage.setItem(KEY_UPDATE_DISMISSED, newSWsha)
    } else {
      localStorage.setItem(KEY_DISMISSED, '1')
    }
    setMode(null)
  }

  /* ── Trigger Android install ── */
  async function triggerAndroidInstall() {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    if (outcome === 'accepted') {
      setMode(null)
      localStorage.setItem(KEY_DISMISSED, '1')
    } else {
      dismiss()
    }
  }

  if (!mode) return null

  return (
    <div className={`install-prompt${mode === 'update' ? ' install-prompt--update' : ''}`}>
      <button className="install-close" onClick={dismiss} aria-label="Fermer">✕</button>

      {/* ── Mise à jour disponible ── */}
      {mode === 'update' && (
        <>
          <div className="install-header">
            <span className="install-icon">🔄</span>
            <div>
              <div className="install-title">Mise à jour disponible</div>
              <div className="install-sub">Une nouvelle version est prête à être installée</div>
            </div>
          </div>
          <div className="install-why" style={{ marginBottom: 12 }}>
            Applique la mise à jour maintenant sans perdre tes données.<br />
            L'app se rechargera automatiquement.
          </div>
          <button className="install-cta install-cta--update" onClick={applyUpdate}>
            🔄 Mettre à jour maintenant
          </button>
        </>
      )}

      {/* ── Installation iOS/iPadOS ── */}
      {mode === 'install-ios' && (
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
              <span>Appuie sur <strong>⎋ Partager</strong> dans Safari</span>
            </div>
            <div className="install-step">
              <span className="install-num">2</span>
              <span>Choisis <strong>"Sur l'écran d'accueil"</strong></span>
            </div>
            <div className="install-step">
              <span className="install-num">3</span>
              <span>Appuie sur <strong>Ajouter</strong></span>
            </div>
          </div>
          <div className="install-why">
            💡 Données permanentes une fois installée — Apple ne les efface pas.
          </div>
        </>
      )}

      {/* ── Installation Android ── */}
      {mode === 'install-android' && (
        <>
          <div className="install-header">
            <span className="install-icon">📲</span>
            <div>
              <div className="install-title">Installer Ydash</div>
              <div className="install-sub">Accès direct · Hors-ligne</div>
            </div>
          </div>
          <div className="install-why" style={{ marginBottom: 12 }}>
            Installe l'app pour y accéder sans navigateur.
          </div>
          <button className="install-cta" onClick={triggerAndroidInstall}>
            📲 Installer la version mobile
          </button>
        </>
      )}
    </div>
  )
}
