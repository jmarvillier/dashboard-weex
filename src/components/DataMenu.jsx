/**
 * DataMenu.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sous-menu "Données" — nouvel ordre :
 *   1. Nouvelle entrée  → formulaire de saisie
 *   2. Parcourir        → DataBrowser
 *   3. Importer         → sous-menu Import (iPad + Google Sheets)
 *   4. Exporter .xlsx   → ExportXlsx
 */

import { useState, useRef } from 'react'
import EntryForm    from './EntryForm.jsx'
import ExportXlsx  from './ExportXlsx.jsx'
import DataBrowser from './DataBrowser.jsx'

// ── Items du menu principal ───────────────────────────────────────────────────

const MENU_ITEMS = [
  {
    id: 'entry',
    icon: '➕',
    title: 'Nouvelle entrée',
    desc: 'Ajoute une ligne manuellement au journal (trade, dépôt…)',
    pill: '✏️ saisir',
    pillClass: 'action-pill',
  },
  {
    id: 'browse',
    icon: '📋',
    title: 'Parcourir',
    desc: 'Voir, modifier et supprimer les entrées du repository',
    pill: '🔍 gérer',
    pillClass: 'browse-pill',
  },
  {
    id: 'import',
    icon: '📥',
    title: 'Importer',
    desc: 'Depuis iPad (xlsx/csv) ou Google Sheets',
    pill: '📥 importer',
    pillClass: 'import-pill',
  },
  {
    id: 'export',
    icon: '📊',
    title: 'Exporter .xlsx',
    desc: 'Télécharge tout le repository en fichier Excel',
    pill: '📤 exporter',
    pillClass: 'action-pill',
  },
]

// ── Items du sous-menu Import ─────────────────────────────────────────────────

const IMPORT_ITEMS = [
  {
    id: 'local',
    icon: '📱',
    title: 'Importer iPad',
    desc: '.xlsx ou .csv depuis iCloud ou l\'app Fichiers',
    pill: '📥 fichier',
    pillClass: 'import-pill',
  },
  {
    id: 'drive',
    icon: '☁️',
    title: 'Google Sheets',
    desc: 'Importer depuis un Google Sheet (publication CSV requise)',
    pill: '📥 sheets',
    pillClass: 'import-pill',
  },
]

// ── Sous-composant : zone import iPad ─────────────────────────────────────────

function LocalImportZone({ loadFromFile, onBack }) {
  const fileInputRef = useRef()
  const [dragging, setDragging] = useState(false)

  function handleFile(file) {
    if (file) loadFromFile(file)
  }

  return (
    <div className="input-card visible">
      <button className="dm-back-btn" onClick={onBack}>← Importer</button>
      <label className="input-label">📱 Importer depuis l'iPad → Repository</label>
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
        onChange={e => handleFile(e.target.files[0])}
      />
      <div className="repo-notice">💾 Le fichier sera sauvegardé dans le repository.</div>
    </div>
  )
}

// ── Sous-composant : zone import Google Sheets ────────────────────────────────

function DriveImportZone({ loadFromDrive, driveErr, setDriveErr, onBack }) {
  const [driveUrl, setDriveUrl] = useState('')
  const [driveBusy, setDriveBusy] = useState(false)

  async function handleLoad() {
    setDriveBusy(true)
    await loadFromDrive(driveUrl)
    setDriveBusy(false)
  }

  return (
    <div className="input-card visible">
      <button className="dm-back-btn" onClick={onBack}>← Importer</button>
      <label className="input-label">☁️ Importer depuis Google Sheets → Repository</label>
      <input
        type="text"
        className="url-input"
        placeholder="https://docs.google.com/spreadsheets/d/…"
        value={driveUrl}
        onChange={e => { setDriveUrl(e.target.value); setDriveErr(null) }}
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
        onClick={handleLoad}
      >
        {driveBusy ? <><span className="spin" />Chargement…</> : '▶ Charger et sauvegarder'}
      </button>
      {driveErr && (
        <div
          className={`msg ${driveErr.type}`}
          dangerouslySetInnerHTML={{ __html: driveErr.msg }}
        />
      )}
      <div className="repo-notice">💾 Les données seront sauvegardées dans le repository.</div>
    </div>
  )
}

// ── Sous-composant : sous-menu Import ─────────────────────────────────────────

function ImportMenu({ loadFromFile, loadFromDrive, driveErr, setDriveErr, onBack }) {
  const [activeImport, setActiveImport] = useState(null)

  function handleBack() {
    setActiveImport(null)
    setDriveErr(null)
  }

  if (activeImport === 'local') {
    return <LocalImportZone loadFromFile={loadFromFile} onBack={handleBack} />
  }

  if (activeImport === 'drive') {
    return (
      <DriveImportZone
        loadFromDrive={loadFromDrive}
        driveErr={driveErr}
        setDriveErr={setDriveErr}
        onBack={handleBack}
      />
    )
  }

  return (
    <div className="dm-container">
      <div className="dm-header">
        <button className="dm-back-btn" onClick={onBack}>← Données</button>
        <div className="dm-title">
          <span className="dm-title-icon">📥</span>
          Importer
        </div>
        <div className="dm-subtitle">Choisissez votre source de données</div>
      </div>

      <div className="dm-grid">
        {IMPORT_ITEMS.map(item => (
          <div
            key={item.id}
            className="choice-card dm-card"
            onClick={() => setActiveImport(item.id)}
          >
            <div className={item.pillClass}>{item.pill}</div>
            <span className="choice-icon">{item.icon}</span>
            <div className="choice-title">{item.title}</div>
            <div className="choice-desc">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function DataMenu({
  repoAvailable,
  loadFromFile,
  loadFromDrive,
  driveErr,
  setDriveErr,
  onRepoUpdated,
  onBack,
}) {
  const [activeAction, setActiveAction] = useState(null)

  function handleItemClick(item) {

    setActiveAction(item.id)
  }

  function handleBack() {
    setActiveAction(null)
    setDriveErr(null)
  }

  // ── Sous-vues ─────────────────────────────────────────────────────────────

  if (activeAction === 'entry') {
    return (
      <EntryForm
        onClose={handleBack}
        onSaved={() => { handleBack(); onRepoUpdated?.() }}
      />
    )
  }

  if (activeAction === 'browse') {
    return (
      <DataBrowser
        onClose={handleBack}
        onDataChanged={() => onRepoUpdated?.()}
      />
    )
  }

  if (activeAction === 'import') {
    return (
      <ImportMenu
        loadFromFile={loadFromFile}
        loadFromDrive={loadFromDrive}
        driveErr={driveErr}
        setDriveErr={setDriveErr}
        onBack={handleBack}
      />
    )
  }

  if (activeAction === 'export') {
    return <ExportXlsx onClose={handleBack} />
  }

  // ── Vue principale ────────────────────────────────────────────────────────

  return (
    <div className="dm-container">

      <div className="dm-header">
        <button className="dm-back-btn" onClick={onBack}>← Accueil</button>
        <div className="dm-title">
          <span className="dm-title-icon">🗄️</span>
          Données
        </div>
        <div className="dm-subtitle">Gérez votre journal de trading</div>
      </div>

      <div className="dm-grid">
        {MENU_ITEMS.map(item => {
          return (
            <div
              key={item.id}
              className={`choice-card dm-card`}
              onClick={() => handleItemClick(item)}
              
            >
              <div className={item.pillClass}>{item.pill}</div>
              
              <span className="choice-icon">{item.icon}</span>
              <div className="choice-title">{item.title}</div>
              <div className="choice-desc">{item.desc}</div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
