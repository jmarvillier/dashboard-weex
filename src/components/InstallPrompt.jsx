/**
 * InstallPrompt.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gère l'installation PWA uniquement (iOS et Android).
 * La gestion des mises à jour SW est déléguée au SW lui-même
 * (skipWaiting automatique dans install) + reload sur controllerchange.
 */

import { useState, useEffect, useRef } from 'react'

/* ─── Clés localStorage ──────────────────────────────────────────────────── */
const KEY_DISMISSED = 'ydash-install-dismissed'

/* ─── Helpers détection plateforme ──────────────────────────────────────── */
function isIosDevice() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
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
  // 'install-ios' | 'install-android' | null
  const [mode, setMode]     = useState(null)
  const deferredPrompt      = useRef(null)

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

  /* ── Reload automatique quand un nouveau SW prend le contrôle ── */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let reloading = false
    const handler = () => {
      if (reloading) return
      reloading = true
      console.log('[SW] controllerchange → reload')
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler)
  }, [])

  /* ── Dismiss ── */
  function dismiss() {
    localStorage.setItem(KEY_DISMISSED, '1')
    setMode(null)
  }

  /* ── Trigger Android install ── */
  async function triggerAndroidInstall() {
    if (!deferredPrompt.current) return
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    if (outcome === 'accepted') {
      localStorage.setItem(KEY_DISMISSED, '1')
    }
    setMode(null)
  }

  if (!mode) return null

  return (
    <div className="install-prompt">
      <button className="install-close" onClick={dismiss} aria-label="Fermer">✕</button>

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
