/**
 * ExportXlsx.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Exporte le repository (IndexedDB / Firestore) vers un fichier .xlsx.
 * La colonne UID est ajoutée en fin de chaque ligne de données.
 *
 * Compatibilité Safari iPad :
 *   → window.XLSX.writeFile ne fonctionne pas sur Safari mobile.
 *   → On utilise write({ type: 'array' }) + Blob + URL.createObjectURL.
 */

import { useState } from 'react'
import { loadSnapshot } from '../lib/repository.js'
import { auth } from '../lib/firebase.js'

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
  'UID',   // ← colonne tenant
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
  { wch: 32 }, // UID
]

// ── Cast types numériques ─────────────────────────────────────────────────────

function castRow(row, uid) {
  // On tronque à 13 colonnes au cas où la ligne en aurait plus
  const r = row.slice(0, 13).map((cell, i) => {
    if ([4, 5, 6, 7, 10].includes(i)) {
      const n = parseFloat(String(cell).replace(',', '.'))
      return isNaN(n) ? '' : n
    }
    return cell ?? ''
  })
  r.push(uid)  // colonne 13 = UID
  return r
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
      // 1. UID de l'utilisateur connecté
      const uid = auth.currentUser?.uid ?? ''

      // 2. Charge le snapshot
      const snapshot = await loadSnapshot()
      if (!snapshot?.rows || snapshot.rows.length < 2) {
        throw new Error('Aucune donnée à exporter dans le repository.')
      }

      // 3. Prépare les lignes (skip l'en-tête importée si présente)
      const dataRows = snapshot.rows[0]?.includes?.('Paire')
        ? snapshot.rows.slice(1)
        : snapshot.rows

      const nbRows = dataRows.length
      setRowCount(nbRows)

      // 4. Cast + ajout UID
      const data = [HEADERS, ...dataRows.map(row => castRow(row, uid))]

      // 5. Workbook SheetJS
      const wb = window.XLSX.utils.book_new()
      const ws = window.XLSX.utils.aoa_to_sheet(data)
      ws['!cols'] = COL_WIDTHS
      window.XLSX.utils.book_append_sheet(wb, ws, 'Journal')

      // 6. Export array (compatible Safari iPad)
      const wbArray = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })

      // 7. Blob + téléchargement
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

        {/* Header */}
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
                    Toutes les lignes exportées avec les colonnes du journal :
                    Date, Paire, Sens, Statut, Cours, Montants, Volume, Notes,
                    Dashboard, UID.
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

        {/* Footer */}
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
