/**
 * ExportXlsx.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Exporte le repository (Firestore) vers un fichier .xlsx téléchargeable.
 *
 * Compatibilité Safari iPad :
 *   → window.XLSX.writeFile ne fonctionne pas sur Safari mobile.
 *   → On utilise write({ type: 'array' }) + Blob + URL.createObjectURL.
 */

import { useState } from 'react'
import { loadSnapshot } from '../lib/repository.js'

// ── En-têtes colonnes ────────────────────────────────────────────────────────

const HEADERS = [
  'Date',
  'Paire',
  'Sens',
  'Statut',
  'Cours',
  'Montant USDT',
  'Montant USDC',
  'Montant EUR',
  '',
  '',
  'Volume',
  'Notes',
  'Dashboard',
  'DCA',
]

// ── Largeurs colonnes ─────────────────────────────────────────────────────────

const COL_WIDTHS = [
  { wch: 18 }, // Date
  { wch: 14 }, // Paire
  { wch: 10 }, // Sens
  { wch: 12 }, // Statut
  { wch: 14 }, // Cours
  { wch: 14 }, // USDT
  { wch: 14 }, // USDC
  { wch: 12 }, // EUR
  { wch: 4  }, // réservé
  { wch: 4  }, // réservé
  { wch: 14 }, // Volume
  { wch: 30 }, // Notes
  { wch: 10 }, // Dashboard
  { wch: 8  }, // DCA
]

// ── Cast types numériques ─────────────────────────────────────────────────────

function castRow(row) {
  const base = row.slice(0, 13).map((cell, i) => {
    if ([4, 5, 6, 7, 10].includes(i)) {
      const n = parseFloat(String(cell).replace(',', '.'))
      return isNaN(n) ? '' : n
    }
    return cell ?? ''
  })
  // Colonne DCA (14) — dérivée des Notes (11)
  const notes = String(row[11] ?? '')
  base.push(notes.includes('[DCA]') ? 'true' : 'false')
  return base
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ExportXlsx({ onClose }) {
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(false)
  const [rowCount, setRowCount] = useState(null)

  async function handleExport() {
    setBusy(true)
    setError(null)

    try {
      const snapshot = await loadSnapshot()
      if (!snapshot?.rows || snapshot.rows.length < 2) {
        throw new Error('Aucune donnée à exporter dans le repository.')
      }

      const dataRows = snapshot.rows[0]?.includes?.('Paire')
        ? snapshot.rows.slice(1)
        : snapshot.rows

      setRowCount(dataRows.length)

      const data = [HEADERS, ...dataRows.map(castRow)]

      const wb = window.XLSX.utils.book_new()
      const ws = window.XLSX.utils.aoa_to_sheet(data)
      ws['!cols'] = COL_WIDTHS
      window.XLSX.utils.book_append_sheet(wb, ws, 'Journal')

      const wbArray = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })

      const blob     = new Blob([wbArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const fileName = `journal-ydash-${new Date().toISOString().slice(0, 10)}.xlsx`
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 300)

      setSuccess(true)
      setTimeout(() => { setSuccess(false); onClose() }, 2000)

    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ef-overlay">
      <div className="ef-modal ef-modal-sm">

        <div className="ef-header">
          <div className="ef-title">📥 Exporter le repository</div>
          <button className="ef-close" onClick={onClose}>✕</button>
        </div>

        <div className="ef-body">

          {success && (
            <div className="ef-success">
              ✅ {rowCount} ligne{rowCount > 1 ? 's' : ''} exportée{rowCount > 1 ? 's' : ''} !
              <br />
              <span style={{ fontSize: '.62rem', opacity: .8 }}>
                Vérifie l'app Fichiers → Téléchargements
              </span>
            </div>
          )}

          {error && <div className="ef-error">❌ {error}</div>}

          {!success && (
            <div className="export-info">
              <div className="export-info-row">
                <span className="export-info-icon">📊</span>
                <div>
                  <div className="export-info-title">Fichier Excel (.xlsx)</div>
                  <div className="export-info-desc">
                    Toutes les lignes du repository exportées avec les colonnes
                    du journal : Date, Paire, Sens, Statut, Cours, Montants,
                    Volume, Notes, Dashboard, DCA.
                    Les valeurs numériques sont correctement typées.
                  </div>
                </div>
              </div>
              <div className="export-info-row">
                <span className="export-info-icon">📱</span>
                <div className="export-info-desc">
                  Sur iPad — Safari : le fichier s'ouvre dans l'app <strong>Fichiers</strong>.
                  Appuie sur <strong>Télécharger</strong> si une fenêtre de prévisualisation apparaît.
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="ef-footer">
          <button className="ef-btn-cancel" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="ef-btn-save" onClick={handleExport} disabled={busy || success}>
            {busy
              ? <><span className="spin" /> Génération…</>
              : '⬇️ Télécharger le .xlsx'
            }
          </button>
        </div>

      </div>
    </div>
  )
}
