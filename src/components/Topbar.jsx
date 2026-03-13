/**
 * Topbar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Barre de navigation principale.
 * Affiche un bouton contextuel :
 *  - "📲 Installer"     → si l'app n'est pas encore installée (iOS ou Android)
 *  - "🔄 Mettre à jour" → si un nouveau Service Worker attend (sans réinstaller)
 *
 * iOS 13+ fix : maxTouchPoints > 1 pour détecter l'iPad qui se présente en Macintosh
 */

import { useState, useEffect, useRef } from 'react'
import Logo from './Logo.jsx'

const KEY_DISMISSED        = 'ydash-install-dismissed'
const KEY_UPDATE_DISMISSED = 'ydash-update-dismissed-sha'

/* ─── Helpers ────────────────────────────────────────────────────────────── */
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
export default function Topbar({ excluded }) {
  const n = excluded.size

  const [btnMode, setBtnMode]       = useState(null)
  const [showIosGuide, setShowIos]  = useState(false)
  const deferredPrompt              = useRef(null)
  const pendingSW                   = useRef(null)
  const newSWsha                    = useRef(null)

  /* ── Prompt Android ── */
  useEffect(() => {
    const handler = e => {
      e.preventDefault()
      deferredPrompt.current = e
      if (!isStandalone() && !localStorage.getItem(KEY_DISMISSED)) {
        setBtnMode('android')
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  /* ── Détection iOS + SW updates ── */
  useEffect(() => {
    if (isIosSafari() && !localStorage.getItem(KEY_DISMISSED)) {
      setBtnMode('ios')
    }

    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      const onWaiting = (sw) => {
        const sha = String(Date.now())
        newSWsha.current = sha
        const dismissed = localStorage.getItem(KEY_UPDATE_DISMISSED)
        if (dismissed !== sha) {
          pendingSW.current = sw
          setBtnMode('update')
        }
      }
      if (reg.waiting) onWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const inst = reg.installing
        if (!inst) return
        inst.addEventListener('statechange', () => {
          if (inst.state === 'installed' && navigator.serviceWorker.controller) {
            onWaiting(inst)
          }
        })
      })
    })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }, [])

  /* ── Actions ── */
  async function handleBtn() {
    if (btnMode === 'ios') {
      setShowIos(v => !v)
      return
    }
    if (btnMode === 'android' && deferredPrompt.current) {
      deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      deferredPrompt.current = null
      if (outcome === 'accepted') {
        setBtnMode(null)
        localStorage.setItem(KEY_DISMISSED, '1')
      }
      return
    }
    if (btnMode === 'update') {
      const sw = pendingSW.current
      if (sw) sw.postMessage({ type: 'SKIP_WAITING' })
      else window.location.reload()
    }
  }

  function dismissBtn() {
    if (btnMode === 'update') {
      localStorage.setItem(KEY_UPDATE_DISMISSED, newSWsha.current ?? '')
    } else {
      localStorage.setItem(KEY_DISMISSED, '1')
    }
    setBtnMode(null)
    setShowIos(false)
  }

  const btnLabel = btnMode === 'update' ? '🔄 Mettre à jour' : '📲 Installer'

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Logo small />
        </div>
        <div className="topbar-actions">
          {n > 0 && (
            <span className="excl-counter visible">
              {n} paire{n > 1 ? 's' : ''} exclue{n > 1 ? 's' : ''}
            </span>
          )}
          {btnMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className={`btn-sm btn-install-topbar${btnMode === 'update' ? ' btn-install-update' : ''}`}
                onClick={handleBtn}
              >
                {btnLabel}
              </button>
              <button
                className="btn-install-dismiss"
                onClick={dismissBtn}
                aria-label="Ignorer"
                title="Ne plus afficher"
              >✕</button>
            </div>
          )}
        </div>
      </div>

      {showIosGuide && btnMode === 'ios' && (
        <div className="ios-guide-bar">
          <span>1. <strong>⎋ Partager</strong></span>
          <span className="ios-guide-sep">›</span>
          <span>2. <strong>"Sur l'écran d'accueil"</strong></span>
          <span className="ios-guide-sep">›</span>
          <span>3. <strong>Ajouter</strong></span>
          <button className="ios-guide-close" onClick={() => setShowIos(false)}>✕</button>
        </div>
      )}
    </>
  )
}
