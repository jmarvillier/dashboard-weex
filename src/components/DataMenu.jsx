/**
 * DataMenu.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sous-menu "Données" regroupant toutes les actions liées aux données :
 *   1. Nouvelle entrée   → formulaire de saisie
 *   2. Importer iPad     → fichier local
 *   3. Importer Sheets   → Google Sheets URL
 *   4. Parcourir         → DataBrowser (lecture / édition / suppression)
 *
 * Ce composant gère sa propre navigation interne (action sélectionnée).
 * Il reçoit les handlers d'action depuis Landing.
 */

import { useState, useRef } from 'react'
import EntryForm    from './EntryForm.jsx'
import ExportXlsx  from './ExportXlsx.jsx'
import DataBrowser from './DataBrowser.jsx'

// ── Items du sous-menu ────────────────────────────────────────────────────────

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
    id: 'export',
    icon: '📊',
    title: 'Exporter .xlsx',
    desc: 'Télécharge tout le repository en fichier Excel',
    pill: '📥 exporter',
    pillClass: 'action-pill',
    requiresData: true,
  },
  {
    id: 'local',
    icon: '📱',
    title: 'Importer iPad',
    desc: '.xlsx ou .csv depuis iCloud ou l\'app Fichiers',
    pill: '📥 importer',
    pillClass: 'import-pill',
  },
  {
    id: 'drive',
    icon: '☁️',
    title: 'Google Sheets',
    desc: 'Importer depuis un Google Sheet (publication CSV requise)',
    pill: '📥 importer',
    pillClass: 'import-pill',
  },
  {
    id: 'browse',
    icon: '📋',
    title: 'Parcourir',
    desc: 'Voir, modifier et supprimer les entrées du repository',
    pill: '🔍 gérer',
    pillClass: 'browse-pill',
    requiresData: true,
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
      <button className="dm-back-btn" onClick={onBack}>← Données</button>
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
      <div className="repo-notice">💾 Le fichier sera sauvegardé dans le repository local.</div>
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
      <button className="dm-back-btn" onClick={onBack}>← Données</button>
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
      <div className="repo-notice">💾 Les données seront sauvegardées dans le repository local.</div>
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
  // activeAction : null | 'entry' | 'export' | 'local' | 'drive' | 'browse'
  const [activeAction, setActiveAction] = useState(null)

  function handleItemClick(item) {
    if (item.requiresData && !repoAvailable) return
    setActiveAction(item.id)
  }

  function handleBack() {
    setActiveAction(null)
    setDriveErr(null)
  }

  // ── Rendu des sous-vues ───────────────────────────────────────────────────

  if (activeAction === 'entry') {
    return (
      <EntryForm
        onClose={handleBack}
        onSaved={() => { handleBack(); onRepoUpdated?.() }}
      />
    )
  }

  if (activeAction === 'export') {
    return <ExportXlsx onClose={handleBack} />
  }

  if (activeAction === 'local') {
    return <LocalImportZone loadFromFile={loadFromFile} onBack={handleBack} />
  }

  if (activeAction === 'drive') {
    return (
      <DriveImportZone
        loadFromDrive={loadFromDrive}
        driveErr={driveErr}
        setDriveErr={setDriveErr}
        onBack={handleBack}
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

  // ── Vue : grille du sous-menu ─────────────────────────────────────────────

  return (
    <div className="dm-container">

      {/* Header du sous-menu */}
      <div className="dm-header">
        <button className="dm-back-btn" onClick={onBack}>← Accueil</button>
        <div className="dm-title">
          <span className="dm-title-icon">🗄️</span>
          Données
        </div>
        <div className="dm-subtitle">Gérez votre journal de trading</div>
      </div>

      {/* Grille d'actions */}
      <div className="dm-grid">
        {MENU_ITEMS.map(item => {
          const locked = item.requiresData && !repoAvailable
          return (
            <div
              key={item.id}
              className={`choice-card dm-card${locked ? ' disabled' : ''}`}
              onClick={() => handleItemClick(item)}
              title={locked ? 'Importez d\'abord des données.' : undefined}
            >
              <div className={item.pillClass}>{item.pill}</div>
              {locked && <div className="locked-pill">🔒 vide</div>}
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
