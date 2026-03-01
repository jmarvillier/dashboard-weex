/**
 * Landing.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Page d'accueil avec 3 cartes principales :
 *
 *   1. Mon Dashboard  → ouvre le dashboard (désactivé si repo vide)
 *   2. Paires         → ouvre la vue dédiée aux paires (désactivé si repo vide)
 *   3. Données        → sous-menu DataMenu (ajout, import, export, parcourir)
 */

import { useState } from 'react'
import DataMenu from './DataMenu.jsx'
import Logo     from './Logo.jsx'

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
  onOpenPaires,
}) {
  const [showDataMenu, setShowDataMenu] = useState(false)

  // ── Vue : sous-menu Données ───────────────────────────────────────────────
  if (showDataMenu) {
    return (
      <div id="landing">
        <Logo />
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
      <Logo />

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

          {/* 2. Paires ← NOUVEAU */}
          <div
            className={`choice-card paires-card${repoAvailable ? '' : ' disabled'}`}
            onClick={repoAvailable ? onOpenPaires : undefined}
            title={repoAvailable ? undefined : "Importez d'abord un fichier."}
          >
            <div className="paires-pill">📈 paires</div>
            {!repoAvailable && <div className="locked-pill">🔒 vide</div>}
            <span className="choice-icon">📊</span>
            <div className="choice-title">Paires</div>
            <div className="choice-desc">
              {repoAvailable
                ? 'Consulter le détail de chaque paire de trading'
                : "Importez d'abord ton journal"}
            </div>
          </div>

          {/* 3. Données */}
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
