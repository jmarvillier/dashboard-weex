/**
 * Landing.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Page d'accueil avec 5 cartes :
 *
 *   1. Mon Dashboard     → ouvre le dashboard (désactivé si repo vide)
 *   2. Nouvelle entrée   → formulaire de saisie → sauvegarde repo
 *   3. Exporter .xlsx    → télécharge le repo en Excel (désactivé si repo vide)
 *   4. Depuis l'iPad     → importe un fichier → sauvegarde repo
 *   5. Google Sheets     → charge depuis GSheets → sauvegarde repo
 */

import { useRef, useState } from 'react'
import EntryForm  from './EntryForm.jsx'
import ExportXlsx from './ExportXlsx.jsx'

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
  const fileInputRef  = useRef()
  const [driveUrl, setDriveUrl]       = useState('')
  const [dragging, setDragging]       = useState(false)
  const [driveBusy, setDriveBusy]     = useState(false)
  const [showEntry, setShowEntry]     = useState(false)
  const [showExport, setShowExport]   = useState(false)

  function handleFile(file) {
    if (file) loadFromFile(file)
  }

  async function handleDriveLoad() {
    setDriveBusy(true)
    await loadFromDrive(driveUrl)
    setDriveBusy(false)
  }

  return (
    <div id="landing">
      <div className="logo">WEEX <span>DASHBOARD</span></div>

      {/* ── Modals ── */}
      {showEntry && (
        <EntryForm
          onClose={() => setShowEntry(false)}
          onSaved={() => { setShowEntry(false); onRepoUpdated?.() }}
        />
      )}
      {showExport && (
        <ExportXlsx onClose={() => setShowExport(false)} />
      )}

      {/* ── Choice grid ── */}
      {!zone && (
        <div className="choice-grid">

          {/* ── Ligne 1 : actions principales ── */}
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
                  ? "Ouvre le dashboard avec les données sauvegardées"
                  : "Importez d'abord ton journal"}
              </div>
            </div>

            {/* 2. Nouvelle entrée */}
            <div className="choice-card action-card" onClick={() => setShowEntry(true)}>
              <div className="action-pill">✏️ saisir</div>
              <span className="choice-icon">➕</span>
              <div className="choice-title">Nouvelle entrée</div>
              <div className="choice-desc">
                Ajoute une ligne manuellement au journal (trade, dépôt…)
              </div>
            </div>

            {/* 3. Exporter .xlsx */}
            <div
              className={`choice-card action-card${repoAvailable ? '' : ' disabled'}`}
              onClick={repoAvailable ? () => setShowExport(true) : undefined}
              title={repoAvailable ? undefined : "Aucune donnée à exporter."}
            >
              <div className="action-pill">📥 exporter</div>
              {!repoAvailable && <div className="locked-pill">🔒 vide</div>}
              <span className="choice-icon">📊</span>
              <div className="choice-title">Exporter .xlsx</div>
              <div className="choice-desc">
                Télécharge tout le repository en fichier Excel
              </div>
            </div>

          </div>

          {/* ── Ligne 2 : sources d'import ── */}
          <div className="choice-row choice-row-import">

            {/* 4. Depuis l'iPad */}
            <div className="choice-card" onClick={() => setZone('local')}>
              <div className="import-pill">📥 importer</div>
              <span className="choice-icon">📱</span>
              <div className="choice-title">Depuis l'iPad</div>
              <div className="choice-desc">
                .xlsx ou .csv depuis iCloud ou l'app Fichiers
              </div>
            </div>

            {/* 5. Google Sheets */}
            <div className="choice-card" onClick={() => setZone('drive')}>
              <div className="import-pill">📥 importer</div>
              <span className="choice-icon">☁️</span>
              <div className="choice-title">Google Sheets</div>
              <div className="choice-desc">
                Colle le lien de ton Google Sheet (publication CSV requise)
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ── Zone fichier local ── */}
      {zone === 'local' && (
        <div className="input-card visible">
          <label className="input-label">📱 Importer depuis l'iPad → Repository</label>
          <div
            className={`dropzone${dragging ? ' drag' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          >
            <div className="dropzone-icon">📂</div>
            <div className="dropzone-text">
              <strong>Appuie ici pour choisir ton fichier</strong><br />
              .xlsx · .xls · .csv<br />
              <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>
                iCloud Drive · Fichiers · AirDrop
              </span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <div className="repo-notice">
            💾 Le fichier sera sauvegardé dans le repository local.
          </div>
          <button className="back-btn" onClick={() => setZone(null)}>← Retour</button>
        </div>
      )}

      {/* ── Zone Google Sheets ── */}
      {zone === 'drive' && (
        <div className="input-card visible">
          <label className="input-label">☁️ Importer depuis Google Sheets → Repository</label>
          <input
            type="text"
            className="url-input"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={driveUrl}
            onChange={(e) => { setDriveUrl(e.target.value); setDriveErr(null) }}
          />
          <div className="info-box">
            <div style={{ color: 'var(--gold)', fontWeight: 700, marginBottom: 10 }}>
              ⚠ Le fichier doit être publié sur le web
            </div>
            <div className="step-row">
              <div className="step-num">1</div>
              <div><strong>Fichier → Partager et exporter → Publier sur le web</strong></div>
            </div>
            <div className="step-row">
              <div className="step-num">2</div>
              <div>Sélectionne <code>Toute la feuille</code> + <code>.csv</code> → <strong>Publier</strong></div>
            </div>
            <div className="step-row">
              <div className="step-num">3</div>
              <div>Colle l'URL ci-dessus et clique Charger</div>
            </div>
          </div>
          <button
            className="btn-load"
            disabled={driveUrl.length < 15 || driveBusy}
            onClick={handleDriveLoad}
          >
            {driveBusy ? <><span className="spin" />Chargement…</> : '▶ Charger et sauvegarder'}
          </button>
          {driveErr && (
            <div
              className={`msg ${driveErr.type}`}
              dangerouslySetInnerHTML={{ __html: driveErr.msg }}
            />
          )}
          <div className="repo-notice">
            💾 Les données seront sauvegardées dans le repository local.
          </div>
          <button
            className="back-btn"
            onClick={() => { setZone(null); setDriveErr(null) }}
          >
            ← Retour
          </button>
        </div>
      )}
    </div>
  )
}
