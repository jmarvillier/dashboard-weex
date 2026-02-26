/**
 * Landing.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Page d'accueil avec 2 cartes principales :
 *
 *   1. Mon Dashboard  → ouvre le dashboard (désactivé si repo vide)
 *   2. Données        → sous-menu DataMenu (ajout, import, export, parcourir)
 *
 * Les actions liées aux données ont été regroupées dans la carte "Données"
 * pour une meilleure organisation et maintenabilité.
 */

import { useState } from 'react'
import DataMenu from './DataMenu.jsx'

export default function Landing({
  zone,
  setZone,
  driveErr,
  setDriveErr,
  repoAvailable,
  openFromRepository,
  loadFromDrive,
  loadFromFile,
  onRepoUpdated,
}) {
  // Contrôle si le sous-menu Données est actif
  const [showDataMenu, setShowDataMenu] = useState(false)

  // ── Vue : sous-menu Données ───────────────────────────────────────────────

  if (showDataMenu) {
    return (
      <div id="landing">
        <div className="logo">WEEX <span>DASHBOARD</span></div>
        <DataMenu
          repoAvailable={repoAvailable}
          loadFromFile={loadFromFile}
          loadFromDrive={loadFromDrive}
          driveErr={driveErr}
          setDriveErr={setDriveErr}
          onRepoUpdated={onRepoUpdated}
          onBack={() => { setShowDataMenu(false); setZone(null); setDriveErr(null) }}
        />
      </div>
    )
  }

  // ── Vue : grille d'accueil ────────────────────────────────────────────────

  return (
    <div id="landing">
      <div className="logo">WEEX <span>DASHBOARD</span></div>

      <div className="choice-grid">
        <div className="choice-row choice-row-main">

          {/* 1. Mon Dashboard */}
          <div
            className={`choice-card default-card${repoAvailable ? '' : ' disabled'}`}
            onClick={repoAvailable ? openFromRepository : undefined}
            title={repoAvailable ? undefined : "Importez d'abord un fichier."}
          >
            <div className="default-pill">⚡ accès rapide</div>
            {!repoAvailable && <div className="locked-pill">🔒 vide</div>}
            <span className="choice-icon">🚀</span>
            <div className="choice-title">Mon Dashboard</div>
            <div className="choice-desc">
              {repoAvailable
                ? 'Ouvre le dashboard avec les données sauvegardées'
                : "Importez d'abord ton journal"}
            </div>
          </div>

          {/* 2. Données */}
          <div
            className="choice-card data-card"
            onClick={() => setShowDataMenu(true)}
          >
            <div className="data-pill">🗄️ gérer</div>
            <span className="choice-icon">🗃️</span>
            <div className="choice-title">Données</div>
            <div className="choice-desc">
              Importer, exporter, saisir et parcourir votre journal de trading
            </div>
            <div className="dm-preview-badges">
              <span className="dm-preview-badge">➕ Entrée</span>
              <span className="dm-preview-badge">📊 Export</span>
              <span className="dm-preview-badge">📥 Import</span>
              <span className="dm-preview-badge">📋 Parcourir</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
