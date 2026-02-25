/**
 * Landing.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Page d'accueil avec 3 cartes :
 *
 *   1. Mon Dashboard  → ouvre le dashboard depuis le repository (désactivée si vide)
 *   2. Depuis l'iPad  → importe un fichier .xlsx / .csv et sauvegarde dans le repo
 *   3. Google Sheets  → charge depuis un Google Sheet et sauvegarde dans le repo
 */

import { useRef, useState } from 'react'

export default function Landing({
  zone,
  setZone,
  driveErr,
  setDriveErr,
  repoAvailable,
  openFromRepository,
  loadFromDrive,
  loadFromFile,
}) {
  const fileInputRef  = useRef()
  const [driveUrl, setDriveUrl]   = useState('')
  const [dragging, setDragging]   = useState(false)
  const [driveBusy, setDriveBusy] = useState(false)

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

      {/* ── Choice row ── */}
      {!zone && (
        <div className="choice-row" id="choiceRow">

          {/* Carte 1 — Mon Dashboard (depuis le repository) */}
          <div
            className={`choice-card default-card${repoAvailable ? '' : ' disabled'}`}
            onClick={repoAvailable ? openFromRepository : undefined}
            title={repoAvailable ? undefined : 'Aucune donnée en base. Importez d'abord un fichier.'}
          >
            <div className="default-pill">⚡ accès rapide</div>
            {!repoAvailable && <div className="locked-pill">🔒 aucune donnée</div>}
            <span className="choice-icon">🚀</span>
            <div className="choice-title">Mon Dashboard</div>
            <div className="choice-desc">
              {repoAvailable
                ? 'Ouvre directement le dashboard avec les données sauvegardées'
                : 'Importe d'abord ton journal depuis l'iPad ou Google Sheets'}
            </div>
          </div>

          {/* Carte 2 — Depuis l'iPad */}
          <div className="choice-card" onClick={() => setZone('local')}>
            <div className="import-pill">📥 importer</div>
            <span className="choice-icon">📱</span>
            <div className="choice-title">Depuis l'iPad</div>
            <div className="choice-desc">
              Charge ton fichier .xlsx ou .csv depuis iCloud ou l'app Fichiers et
              sauvegarde dans le repository
            </div>
          </div>

          {/* Carte 3 — Google Sheets */}
          <div className="choice-card" onClick={() => setZone('drive')}>
            <div className="import-pill">📥 importer</div>
            <span className="choice-icon">☁️</span>
            <div className="choice-title">Google Sheets</div>
            <div className="choice-desc">
              Colle le lien de ton Google Sheet (publication CSV requise) et
              sauvegarde dans le repository
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
            💾 Le fichier sera sauvegardé dans le repository local. Tu pourras l'ouvrir
            directement depuis "Mon Dashboard" la prochaine fois.
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
            💾 Les données seront sauvegardées dans le repository local. Tu pourras
            rouvrir le dashboard sans connexion internet.
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
