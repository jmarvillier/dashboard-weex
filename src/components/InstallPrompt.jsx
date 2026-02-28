/**
 * InstallPrompt.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Bannière d'invitation à installer la PWA sur l'écran d'accueil de l'iPad.
 *
 * - Détecte si l'app tourne dans Safari iOS et n'est PAS encore installée
 * - S'affiche une seule fois (mémorisé dans localStorage)
 * - Explique les 3 étapes pour ajouter à l'écran d'accueil
 * - Rappelle que l'installation = données permanentes (pas d'éviction ITP)
 */

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'ydash-install-dismissed'

function isIosSafari() {
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  const isStandalone = window.navigator.standalone === true
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)
  return isIos && isSafari && !isStandalone
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed && isIosSafari()) {
      // Petit délai pour ne pas bloquer le rendu initial
      const t = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="install-prompt">
      <button className="install-close" onClick={dismiss} aria-label="Fermer">✕</button>

      <div className="install-header">
        <span className="install-icon">📲</span>
        <div>
          <div className="install-title">Installe Ydash sur ton iPad</div>
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
    </div>
  )
}
