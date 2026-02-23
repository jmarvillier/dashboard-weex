import { useRef, useState } from 'react'
import { DEFAULT_SHEET_URL } from '../lib/config.js'

export default function Landing({ zone, setZone, driveErr, setDriveErr, loadDefault, loadFromDrive, loadFromFile }) {
  const fileInputRef = useRef()
  const [driveUrl, setDriveUrl]   = useState('')
  const [dragging, setDragging]   = useState(false)
  const [driveBusy, setDriveBusy] = useState(false)

  function handleFile(file) { if (file) loadFromFile(file) }

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
          <div className="choice-card default-card" onClick={loadDefault}>
            <div className="default-pill">⚡ accès rapide</div>
            <span className="choice-icon">🚀</span>
            <div className="choice-title">Mon Journal WEEX</div>
            <div className="choice-desc">Charge directement ton Google Sheet de trading par défaut</div>
          </div>
          <div className="choice-card" onClick={() => setZone('local')}>
            <span className="choice-icon">📱</span>
            <div className="choice-title">Depuis l'iPad</div>
            <div className="choice-desc">Ouvre ton fichier .xlsx ou .csv depuis iCloud ou l'app Fichiers</div>
          </div>
          <div className="choice-card" onClick={() => setZone('drive')}>
            <span className="choice-icon">☁️</span>
            <div className="choice-title">Google Drive</div>
            <div className="choice-desc">Colle le lien de ton Google Sheet (publication CSV requise)</div>
          </div>
        </div>
      )}

      {/* ── Zone fichier local ── */}
      {zone === 'local' && (
        <div className="input-card visible">
          <label className="input-label">📱 Fichier depuis l'iPad</label>
          <div
            className={`dropzone${dragging ? ' drag' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          >
            <div className="dropzone-icon">📂</div>
            <div className="dropzone-text">
              <strong>Appuie ici pour choisir ton fichier</strong><br />
              .xlsx · .xls · .csv<br />
              <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>iCloud Drive · Fichiers · AirDrop</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
          <button className="back-btn" onClick={() => setZone(null)}>← Retour</button>
        </div>
      )}

      {/* ── Zone Google Drive ── */}
      {zone === 'drive' && (
        <div className="input-card visible">
          <label className="input-label">☁️ Google Sheets</label>
          <input
            type="text"
            className="url-input"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={driveUrl}
            onChange={e => { setDriveUrl(e.target.value); setDriveErr(null) }}
          />
          <div className="info-box">
            <div style={{ color: 'var(--gold)', fontWeight: 700, marginBottom: 10 }}>⚠ Le fichier doit être publié sur le web</div>
            <div className="step-row"><div className="step-num">1</div><div><strong>Fichier → Partager et exporter → Publier sur le web</strong></div></div>
            <div className="step-row"><div className="step-num">2</div><div>Sélectionne <code>Toute la feuille</code> + <code>.csv</code> → <strong>Publier</strong></div></div>
            <div className="step-row"><div className="step-num">3</div><div>Colle l'URL ci-dessus et clique Charger</div></div>
          </div>
          <button className="btn-load" disabled={driveUrl.length < 15 || driveBusy} onClick={handleDriveLoad}>
            {driveBusy ? <><span className="spin" />Chargement…</> : '▶ Charger'}
          </button>
          {driveErr && (
            <div className={`msg ${driveErr.type}`} dangerouslySetInnerHTML={{ __html: driveErr.msg }} />
          )}
          <button className="back-btn" onClick={() => { setZone(null); setDriveErr(null) }}>← Retour</button>
        </div>
      )}
    </div>
  )
}
