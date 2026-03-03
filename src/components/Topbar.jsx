import { useState, useEffect, useRef } from 'react'
import Logo from './Logo.jsx'
import { CURRENT_VERSION, isNewerVersion } from './InstallPrompt.jsx'

const KEY_DISMISSED = 'ydash-install-dismissed'
const KEY_DISMISSED_VERSION = 'ydash-install-dismissed-version'

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function isIosSafari() {
  const ua = navigator.userAgent
  const standalone = window.navigator.standalone === true
  const safari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
  return /iphone|ipad|ipod/i.test(ua) && safari && !standalone
}

export default function Topbar({ loadedAt, excluded, backToLanding }) {
  const n = excluded.size
  const [showInstallBtn, setShowInstallBtn] = useState(false)
  const [installMode, setInstallMode] = useState(null)   // 'ios' | 'android' | 'update'
  const [latestVersion, setLatestVersion] = useState(null)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const deferredPrompt = useRef(null)

  /* Capture le prompt natif Android */
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      deferredPrompt.current = e
      evaluateInstall(latestVersion)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [latestVersion])

  /* Récupère la version latest */
  useEffect(() => {
    fetch('/dashboard-weex/version.json?t=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.version) {
          setLatestVersion(data.version)
          evaluateInstall(data.version)
        }
      })
      .catch(() => {})

    // Évalue aussi sans version.json
    evaluateInstall(null)
  }, [])

  function evaluateInstall(latest) {
    // Cas update (prioritaire)
    if (latest && isNewerVersion(CURRENT_VERSION, latest)) {
      const dismissedAt = localStorage.getItem(KEY_DISMISSED_VERSION)
      if (dismissedAt !== latest) {
        setInstallMode('update')
        setShowInstallBtn(true)
        return
      }
    }
    // Cas non installée
    if (!isStandalone()) {
      const dismissed = localStorage.getItem(KEY_DISMISSED)
      if (!dismissed) {
        if (isIosSafari()) {
          setInstallMode('ios')
          setShowInstallBtn(true)
          return
        }
        if (deferredPrompt.current) {
          setInstallMode('android')
          setShowInstallBtn(true)
          return
        }
      }
    }
    setShowInstallBtn(false)
  }

  async function handleInstallClick() {
    if (installMode === 'ios') {
      setShowIosGuide(v => !v)
      return
    }
    if (installMode === 'android' && deferredPrompt.current) {
      deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      deferredPrompt.current = null
      if (outcome === 'accepted') {
        setShowInstallBtn(false)
        localStorage.setItem(KEY_DISMISSED, '1')
      }
      return
    }
    if (installMode === 'update') {
      // Rafraîchit l'app pour récupérer la nouvelle version
      window.location.reload(true)
    }
  }

  function dismissInstall() {
    if (installMode === 'update') {
      localStorage.setItem(KEY_DISMISSED_VERSION, latestVersion)
    } else {
      localStorage.setItem(KEY_DISMISSED, '1')
    }
    setShowInstallBtn(false)
    setShowIosGuide(false)
  }

  const btnLabel =
    installMode === 'update'
      ? `🔄 v${latestVersion} dispo`
      : '📲 Installer'

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Logo small />
        </div>
        <div className="topbar-actions">
          <div className="live-dot" />
          <span style={{ fontSize: '.58rem', color: 'var(--text2)' }}>
            {loadedAt ? `Chargé à ${loadedAt}` : ''}
          </span>
          {n > 0 && (
            <span className="excl-counter visible">
              {n} paire{n > 1 ? 's' : ''} exclue{n > 1 ? 's' : ''}
            </span>
          )}

          {/* Bouton install / mise à jour */}
          {showInstallBtn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                className={`btn-sm btn-install-topbar ${installMode === 'update' ? 'btn-install-update' : ''}`}
                onClick={handleInstallClick}
              >
                {btnLabel}
              </button>
              <button
                className="btn-install-dismiss"
                onClick={dismissInstall}
                aria-label="Ignorer"
                title="Ne plus afficher"
              >✕</button>
            </div>
          )}

          <button className="btn-sm" onClick={backToLanding}>← Menu principal</button>
        </div>
      </div>

      {/* Guide iOS inline sous la topbar */}
      {showIosGuide && installMode === 'ios' && (
        <div className="ios-guide-bar">
          <span>1. Appuie sur <strong>⎋ Partager</strong></span>
          <span className="ios-guide-sep">›</span>
          <span>2. <strong>"Sur l'écran d'accueil"</strong></span>
          <span className="ios-guide-sep">›</span>
          <span>3. <strong>Ajouter</strong></span>
          <button className="ios-guide-close" onClick={() => setShowIosGuide(false)}>✕</button>
        </div>
      )}
    </>
  )
}
