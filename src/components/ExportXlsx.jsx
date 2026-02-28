/**
 * ExportXlsx.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Exporte le repository (IndexedDB) vers un fichier .xlsx téléchargeable.
 *
 * Compatibilité Safari iPad :
 *   → window.XLSX.writeFile ne fonctionne pas sur Safari mobile.
 *   → On utilise writeXLSX({ type: 'array' }) + Blob + URL.createObjectURL
 *     + clic sur un <a download> pour forcer le téléchargement.
 */

import { useState } from 'react'
import { loadSnapshot } from '../lib/repository.js'

// ── En-têtes colonnes (identiques au journal Excel original) ─────────────────

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
]

// ── Largeurs colonnes ─────────────────────────────────────────────────────────

const COL_WIDTHS = [
  { wch: 18 }, // Date + heure
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
]

// ── Conversion types : string → number quand pertinent ───────────────────────

function castRow(row) {
  return row.map((cell, i) => {
    // Colonnes numériques : Cours[4], USDT[5], USDC[6], EUR[7], Volume[10]
    if ([4, 5, 6, 7, 10].includes(i)) {
      const n = parseFloat(String(cell).replace(',', '.'))
      return isNaN(n) ? '' : n
    }
    return cell ?? ''
  })
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ExportXlsx({ onClose }) {
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)
  const [rowCount, setRowCount] = useState(null)

  async function handleExport() {
    setBusy(true)
    setError(null)

    try {
      // 1. Charge le snapshot
      const snapshot = await loadSnapshot()
      if (!snapshot?.rows || snapshot.rows.length < 2) {
        throw new Error('Aucune donnée à exporter dans le repository.')
      }

      // 2. Prépare les données
      //    rows[0] peut être l'en-tête d'origine (importé) ou une vraie ligne
      //    → on remplace toujours par nos HEADERS propres
      const dataRows = snapshot.rows[0]?.includes?.('Paire')
        ? snapshot.rows.slice(1)   // skip l'en-tête importée
        : snapshot.rows            // pas d'en-tête → toutes les lignes sont des data

      const nbRows = dataRows.length
      setRowCount(nbRows)

      // 3. Cast des types + ajout de l'en-tête propre
      const data = [HEADERS, ...dataRows.map(castRow)]

      // 4. Crée le workbook SheetJS
      const wb = window.XLSX.utils.book_new()
      const ws = window.XLSX.utils.aoa_to_sheet(data)
      ws['!cols'] = COL_WIDTHS
      window.XLSX.utils.book_append_sheet(wb, ws, 'Journal')

      // 5. Export en tableau d'octets (compatible Safari iPad)
      const wbArray = window.XLSX.write(wb, {
        bookType : 'xlsx',
        type     : 'array',
      })

      // 6. Crée un Blob XLSX
      const blob = new Blob([wbArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      // 7. Téléchargement — méthode universelle Safari + Chrome + Firefox
      const fileName = `journal-ydash-${new Date().toISOString().slice(0, 10)}.xlsx`
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()

      // Nettoyage léger
      setTimeout(() => {
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 300)

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)

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
                    Toutes les lignes du repository exportées avec les colonnes
                    du journal : Date, Paire, Sens, Statut, Cours, Montants,
                    Volume, Notes, Dashboard.
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
