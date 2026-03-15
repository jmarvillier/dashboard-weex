/**
 * Landing.jsx — v5 + carte Scaled Mirror DCA
 */

import { useState, useRef } from 'react'
import Logo from './Logo.jsx'

export default function Landing({
  zone, setZone, driveErr, setDriveErr,
  repoAvailable, openFromRepository, loadFromDrive, loadFromFile,
  onRepoUpdated, onOpenPaires, onOpenDonnees, onOpenDca,
}) {
  const [driveUrl, setDriveUrl]   = useState('')
  const [driveBusy, setDriveBusy] = useState(false)
  const [showQuickImport, setShowQuickImport] = useState(false)
  const fileInputRef = useRef()

  async function handleDriveLoad() {
    setDriveBusy(true)
    await loadFromDrive(driveUrl)
    setDriveBusy(false)
  }

  function handleFile(file) {
    if (file) { loadFromFile(file); setShowQuickImport(false) }
  }

  return (
    <div id="landing">
      <Logo />

      <div className="landing-grid">

        {/* ── Dashboard ── */}
        <div
          className={`landing-card landing-card--gold${repoAvailable ? '' : ' landing-card--disabled'}`}
          onClick={repoAvailable ? openFromRepository : undefined}
          title={repoAvailable ? undefined : "Importez d'abord un fichier."}
        >
          <div className="landing-card-pill landing-card-pill--gold">⚡ accès rapide</div>
          {!repoAvailable && <div className="landing-card-pill landing-card-pill--locked">🔒 vide</div>}
          <span className="landing-card-icon">🚀</span>
          <div className="landing-card-title">Dashboard</div>
          <div className="landing-card-desc">
            {repoAvailable ? 'Vue globale de vos investissements' : "Importez d'abord votre journal"}
          </div>
        </div>

        {/* ── Paires ── */}
        <div
          className={`landing-card landing-card--green${repoAvailable ? '' : ' landing-card--disabled'}`}
          onClick={repoAvailable ? onOpenPaires : undefined}
          title={repoAvailable ? undefined : "Importez d'abord un fichier."}
        >
          <div className="landing-card-pill landing-card-pill--green">📈 paires</div>
          {!repoAvailable && <div className="landing-card-pill landing-card-pill--locked">🔒 vide</div>}
          <span className="landing-card-icon">📊</span>
          <div className="landing-card-title">Paires</div>
          <div className="landing-card-desc">
            {repoAvailable ? 'Détail de chaque paire de trading' : "Importez d'abord votre journal"}
          </div>
        </div>

        {/* ── Données ── */}
        <div className="landing-card landing-card--blue" onClick={onOpenDonnees}>
          <div className="landing-card-pill landing-card-pill--blue">🗄️ gérer</div>
          <span className="landing-card-icon">🗃️</span>
          <div className="landing-card-title">Données</div>
          <div className="landing-card-desc">
            Importer, exporter, saisir et parcourir votre journal
          </div>
          <div className="landing-card-badges">
            <span>➕ Entrée</span>
            <span>📊 Export</span>
            <span>📥 Import</span>
            <span>📋 Parcourir</span>
          </div>
        </div>

        {/* ── Scaled Mirror DCA ── */}
        <div className="landing-card landing-card--gold" onClick={onOpenDca} style={{ cursor: 'pointer' }}>
          <div className="landing-card-pill landing-card-pill--gold">📈 stratégie</div>
          <span className="landing-card-icon">⚖️</span>
          <div className="landing-card-title">Scaled Mirror DCA</div>
          <div className="landing-card-desc">
            Accumulation graduée + distribution symétrique sur BTC
          </div>
          <div className="landing-card-badges">
            <span>🟢 Accumuler</span>
            <span>🔴 Distribuer</span>
            <span>📊 Dette</span>
          </div>
        </div>

      </div>

      {/* Import rapide */}
      {!repoAvailable && (
        <div className="landing-quick-import">
          {!showQuickImport ? (
            <button className="landing-quick-import-btn" onClick={() => setShowQuickImport(true)}>
              📥 Importer rapidement un fichier
            </button>
          ) : (
            <div className="landing-import-zone">
              <div className="landing-import-header">
                <span>📥 Import rapide</span>
                <button onClick={() => setShowQuickImport(false)}>✕</button>
              </div>

              <div className="landing-import-row">
                <input
                  type="text"
                  className="dp-url-input"
                  placeholder="URL Google Sheets…"
                  value={driveUrl}
                  onChange={e => { setDriveUrl(e.target.value); setDriveErr(null) }}
                />
                <button
                  className="dp-btn-primary"
                  disabled={driveUrl.length < 15 || driveBusy}
                  onClick={handleDriveLoad}
                >
                  {driveBusy ? <><span className="spin" />…</> : '▶ Sheets'}
                </button>
              </div>

              {driveErr && (
                <div className={`dp-msg ${driveErr.type}`} dangerouslySetInnerHTML={{ __html: driveErr.msg }} />
              )}

              <button className="landing-file-btn" onClick={() => fileInputRef.current.click()}>
                📂 Choisir un fichier (.xlsx / .csv)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
