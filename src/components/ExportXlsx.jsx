/**
 * ExportXlsx.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Exporte le repository (IndexedDB) vers un fichier .xlsx téléchargeable.
 *
 * Utilise la lib SheetJS (window.XLSX) déjà chargée dans index.html.
 * Reproduit fidèlement la structure du journal original :
 *   en-tête + toutes les lignes de données.
 */

import { useState } from 'react'
import { loadSnapshot } from '../lib/repository.js'

// En-têtes des colonnes (identiques au journal Excel)
const HEADERS = [
  'Date',
  'Paire',
  'Sens',
  'Statut',
  'Prix de saisie',
  'Montant USDT',
  'Montant USDC',
  'Montant EUR',
  '',
  '',
  'Volume',
  'Notes',
  'Dashboard',
]

export default function ExportXlsx({ onClose }) {
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleExport() {
    setBusy(true)
    setError(null)

    try {
      // 1. Charge le snapshot depuis IndexedDB
      const snapshot = await loadSnapshot()
      if (!snapshot || !snapshot.rows || snapshot.rows.length < 2) {
        throw new Error('Aucune donnée à exporter dans le repository.')
      }

      // 2. Prépare les données : en-tête + lignes
      const data = [HEADERS, ...snapshot.rows.slice(1)]

      // 3. Crée le workbook SheetJS
      const wb = window.XLSX.utils.book_new()
      const ws = window.XLSX.utils.aoa_to_sheet(data)

      // 4. Styling de base : largeurs de colonnes
      ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 14 }, // Paire
        { wch: 10 }, // Sens
        { wch: 12 }, // Statut
        { wch: 14 }, // Prix
        { wch: 14 }, // USDT
        { wch: 14 }, // USDC
        { wch: 12 }, // EUR
        { wch: 4  }, // réservé
        { wch: 4  }, // réservé
        { wch: 14 }, // Volume
        { wch: 30 }, // Notes
        { wch: 10 }, // Dashboard
      ]

      window.XLSX.utils.book_append_sheet(wb, ws, 'Journal')

      // 5. Télécharge le fichier
      const date = new Date().toISOString().slice(0, 10)
      window.XLSX.writeFile(wb, `journal-weex-${date}.xlsx`)

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1600)

    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ef-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ef-modal ef-modal-sm">

        {/* Header */}
        <div className="ef-header">
          <div className="ef-title">📥 Exporter le repository</div>
          <button className="ef-close" onClick={onClose}>✕</button>
        </div>

        <div className="ef-body">

          {success && (
            <div className="ef-success">✅ Fichier téléchargé !</div>
          )}

          {error && (
            <div className="ef-error">❌ {error}</div>
          )}

          {!success && (
            <>
              <div className="export-info">
                <div className="export-info-row">
                  <span className="export-info-icon">📊</span>
                  <div>
                    <div className="export-info-title">Fichier Excel (.xlsx)</div>
                    <div className="export-info-desc">
                      Toutes les lignes du repository exportées avec les colonnes
                      du journal original : Date, Paire, Sens, Statut, Prix, Montants,
                      Volume, Notes, Dashboard.
                    </div>
                  </div>
                </div>
                <div className="export-info-row">
                  <span className="export-info-icon">💡</span>
                  <div className="export-info-desc">
                    Le fichier sera nommé <strong>journal-weex-[date].xlsx</strong> et
                    téléchargé directement sur ton iPad (app Fichiers / Téléchargements).
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="ef-footer">
          <button className="ef-btn-cancel" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="ef-btn-save" onClick={handleExport} disabled={busy || success}>
            {busy
              ? <><span className="spin" /> Export…</>
              : '⬇️ Télécharger le .xlsx'
            }
          </button>
        </div>

      </div>
    </div>
  )
}
