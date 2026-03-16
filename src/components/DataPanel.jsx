/**
 * DataPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Page "Données" intégrée dans le shell principal.
 * Sous-vues : menu | entry | browse | import | export
 */

import { useState, useRef } from 'react'
import EntryForm   from './EntryForm.jsx'
import ExportXlsx  from './ExportXlsx.jsx'
import DataBrowser from './DataBrowser.jsx'

/* ─── Config des actions ─────────────────────────────────────────────────── */
const ACTIONS = [
  {
    id: 'entry',
    icon: '➕',
    label: 'Nouvelle entrée',
    desc: 'Ajouter un trade, dépôt ou retrait manuellement',
    color: 'gold',
    pill: '✏️ Saisir',
  },
  {
    id: 'browse',
    icon: '📋',
    label: 'Parcourir',
    desc: 'Voir, modifier et supprimer les entrées du journal',
    color: 'green',
    pill: '🔍 Gérer',
  },
  {
    id: 'import',
    icon: '📥',
    label: 'Importer',
    desc: 'Depuis un fichier local (.xlsx, .csv) ou Google Sheets',
    color: 'blue',
    pill: '📥 Importer',
  },
  {
    id: 'export',
    icon: '📤',
    label: 'Exporter .xlsx',
    desc: 'Télécharger tout le journal au format Excel',
    color: 'purple',
    pill: '📤 Exporter',
  },
]

const IMPORT_SOURCES = [
  {
    id: 'local',
    icon: '📱',
    label: 'Fichier local',
    desc: '.xlsx ou .csv depuis votre appareil',
    color: 'blue',
  },
  {
    id: 'drive',
    icon: '☁️',
    label: 'Google Sheets',
    desc: "Via l'URL de publication CSV",
    color: 'green',
  },
]

/* ─── Sous-vues Import ───────────────────────────────────────────────────── */

function LocalImportZone({ loadFromFile, onBack }) {
  const fileInputRef = useRef()
  const [dragging, setDragging] = useState(false)

  function handleFile(file) { if (file) loadFromFile(file) }

  return (
    <div className="dp-sub-view">
      <button className="dp-back-btn" onClick={onBack}>← Importer</button>
      <div className="dp-sub-header">
        <div className="dp-sub-icon">📱</div>
        <div className="dp-sub-title">Importer depuis l'appareil</div>
        <div className="dp-sub-desc">Sélectionnez un fichier .xlsx, .xls ou .csv</div>
      </div>

      <div
        className={`dp-dropzone${dragging ? ' drag' : ''}`}
        onClick={() => fileInputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      >
        <div className="dp-dropzone-icon">📂</div>
        <div className="dp-dropzone-text">
          <strong>Cliquez ou glissez votre fichier ici</strong>
          <span>.xlsx · .xls · .csv</span>
          <span className="dp-dropzone-hint">iCloud Drive · Fichiers · AirDrop</span>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
      <div className="dp-notice">💾 Le fichier sera sauvegardé dans le repository local.</div>
    </div>
  )
}

function DriveImportZone({ loadFromDrive, driveErr, setDriveErr, onBack }) {
  const [driveUrl, setDriveUrl] = useState('')
  const [driveBusy, setDriveBusy] = useState(false)

  async function handleLoad() {
    setDriveBusy(true)
    await loadFromDrive(driveUrl)
    setDriveBusy(false)
  }

  return (
    <div className="dp-sub-view">
      <button className="dp-back-btn" onClick={onBack}>← Importer</button>
      <div className="dp-sub-header">
        <div className="dp-sub-icon">☁️</div>
        <div className="dp-sub-title">Importer depuis Google Sheets</div>
        <div className="dp-sub-desc">Collez l'URL de votre Google Sheet publié en CSV</div>
      </div>

      <input
        type="text"
        className="dp-url-input"
        placeholder="https://docs.google.com/spreadsheets/d/…"
        value={driveUrl}
        onChange={e => { setDriveUrl(e.target.value); setDriveErr(null) }}
      />

      <div className="dp-info-box">
        <div className="dp-info-warning">⚠ Le fichier doit être publié sur le web</div>
        <div className="dp-step"><span className="dp-step-num">1</span><span><strong>Fichier → Partager et exporter → Publier sur le web</strong></span></div>
        <div className="dp-step"><span className="dp-step-num">2</span><span>Sélectionnez <code>Toute la feuille</code> + <code>.csv</code> → <strong>Publier</strong></span></div>
        <div className="dp-step"><span className="dp-step-num">3</span><span>Collez l'URL ci-dessus et cliquez Charger</span></div>
      </div>

      <button
        className="dp-btn-primary"
        disabled={driveUrl.length < 15 || driveBusy}
        onClick={handleLoad}
      >
        {driveBusy ? <><span className="spin" />Chargement…</> : '▶ Charger et sauvegarder'}
      </button>

      {driveErr && (
        <div className={`dp-msg ${driveErr.type}`} dangerouslySetInnerHTML={{ __html: driveErr.msg }} />
      )}
      <div className="dp-notice">💾 Les données seront sauvegardées dans le repository local.</div>
    </div>
  )
}

function ImportMenu({ loadFromFile, loadFromDrive, driveErr, setDriveErr, onBack }) {
  const [activeImport, setActiveImport] = useState(null)

  function handleBack() { setActiveImport(null); setDriveErr(null) }

  if (activeImport === 'local') return <LocalImportZone loadFromFile={loadFromFile} onBack={handleBack} />
  if (activeImport === 'drive') return (
    <DriveImportZone loadFromDrive={loadFromDrive} driveErr={driveErr} setDriveErr={setDriveErr} onBack={handleBack} />
  )

  return (
    <div className="dp-sub-view">
      <button className="dp-back-btn" onClick={onBack}>← Données</button>
      <div className="dp-sub-header">
        <div className="dp-sub-icon">📥</div>
        <div className="dp-sub-title">Importer des données</div>
        <div className="dp-sub-desc">Choisissez votre source</div>
      </div>
      <div className="dp-action-grid">
        {IMPORT_SOURCES.map(src => (
          <button
            key={src.id}
            className={`dp-action-card dp-action-card--${src.color}`}
            onClick={() => setActiveImport(src.id)}
          >
            <span className="dp-action-icon">{src.icon}</span>
            <span className="dp-action-label">{src.label}</span>
            <span className="dp-action-desc">{src.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Composant principal ────────────────────────────────────────────────── */
export default function DataPanel({
  repoAvailable,
  loadFromFile,
  loadFromDrive,
  driveErr,
  setDriveErr,
  onRepoUpdated,
}) {
  const [activeAction, setActiveAction] = useState(null)

  function handleBack() { setActiveAction(null); setDriveErr(null) }
  function handleItemClick(item) { setActiveAction(item.id) }

  if (activeAction === 'entry') {
    return (
      <div className="page-content">
        <EntryForm onClose={handleBack} onSaved={() => { handleBack(); onRepoUpdated?.() }} />
      </div>
    )
  }
  if (activeAction === 'browse') {
    return (
      <div className="page-content">
        <DataBrowser onClose={handleBack} onDataChanged={() => onRepoUpdated?.()} />
      </div>
    )
  }
  if (activeAction === 'import') {
    return (
      <div className="page-content">
        <ImportMenu
          loadFromFile={loadFromFile}
          loadFromDrive={loadFromDrive}
          driveErr={driveErr}
          setDriveErr={setDriveErr}
          onBack={handleBack}
        />
      </div>
    )
  }
  if (activeAction === 'export') {
    return (
      <div className="page-content">
        <ExportXlsx onClose={handleBack} />
      </div>
    )
  }

  /* ── Vue principale : grille d'actions ── */
  return (
    <div className="page-content">
      <div className="dp-menu">
        <div className="dp-menu-header">
          <div className="dp-menu-title">🗃️ Gestion des données</div>
          <div className="dp-menu-sub">Importez, exportez et gérez votre journal de trading</div>
        </div>

        <div className="dp-action-grid dp-action-grid--main">
          {ACTIONS.map(item => {
            return (
              <button
                key={item.id}
                className={`dp-action-card dp-action-card--${item.color}`}
                onClick={() => handleItemClick(item)}
              >
                <span className="dp-action-pill">{item.pill}</span>
                <span className="dp-action-icon">{item.icon}</span>
                <span className="dp-action-label">{item.label}</span>
                <span className="dp-action-desc">{item.desc}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
