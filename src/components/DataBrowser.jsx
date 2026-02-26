/**
 * DataBrowser.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Parcourir, éditer et supprimer les entrées du repository.
 *
 * Fonctionnalités :
 *   - Affiche toutes les lignes du journal (avec pagination)
 *   - Édition unitaire en ligne (inline editing)
 *   - Suppression unitaire avec confirmation
 *   - Recherche / filtre rapide
 */

import { useState, useEffect, useCallback } from 'react'
import { listEntries, updateRow, deleteRow } from '../lib/repository.js'

// ── Colonnes du journal ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: 0,  label: 'Date',         type: 'datetime-local', width: '170px' },
  { key: 1,  label: 'Paire',        type: 'text',           width: '110px' },
  { key: 2,  label: 'Sens',         type: 'select',         width: '100px',
    options: ['Achat', 'Vente', 'Dépôt', 'Retrait'] },
  { key: 3,  label: 'Statut',       type: 'select',         width: '110px',
    options: ['Exécuté', 'Annulé', 'En attente'] },
  { key: 4,  label: 'Cours',        type: 'number',         width: '110px' },
  { key: 5,  label: 'USDT',         type: 'number',         width: '100px' },
  { key: 6,  label: 'USDC',         type: 'number',         width: '100px' },
  { key: 7,  label: 'EUR',          type: 'number',         width: '90px'  },
  { key: 10, label: 'Volume',       type: 'number',         width: '100px' },
  { key: 11, label: 'Notes',        type: 'text',           width: '160px' },
  { key: 12, label: 'Dashboard',    type: 'select',         width: '100px',
    options: ['true', 'false'] },
]

const PAGE_SIZE = 20

// ── Sous-composant : ligne en lecture ─────────────────────────────────────────

function ReadRow({ entry, onEdit, onDelete }) {
  const { rowIndex, data } = entry
  const isExcluded = String(data[12]).trim().toLowerCase() === 'false'

  return (
    <tr className={`db-row${isExcluded ? ' db-row-excluded' : ''}`}>
      {COLUMNS.map(col => (
        <td key={col.key} className="db-cell">
          {formatCell(col, data[col.key])}
        </td>
      ))}
      <td className="db-cell db-cell-actions">
        <button
          className="db-btn db-btn-edit"
          onClick={() => onEdit(rowIndex)}
          title="Modifier"
        >✏️</button>
        <button
          className="db-btn db-btn-delete"
          onClick={() => onDelete(rowIndex)}
          title="Supprimer"
        >🗑️</button>
      </td>
    </tr>
  )
}

function formatCell(col, value) {
  if (value === null || value === undefined || value === '') return <span className="db-empty">—</span>
  const s = String(value)
  if (col.key === 2) {
    const classes = { Achat: 'badge-buy', Vente: 'badge-sell', Dépôt: 'badge-depot', Retrait: 'badge-retrait' }
    return <span className={`db-badge ${classes[s] || ''}`}>{s}</span>
  }
  if (col.key === 3) {
    const classes = { 'Exécuté': 'badge-exec', 'Annulé': 'badge-annul', 'En attente': 'badge-wait' }
    return <span className={`db-badge ${classes[s] || ''}`}>{s}</span>
  }
  if (col.key === 12) {
    return <span className={`db-badge ${s === 'false' ? 'badge-annul' : 'badge-exec'}`}>{s}</span>
  }
  return <span className="db-text">{s}</span>
}

// ── Sous-composant : ligne en édition ─────────────────────────────────────────

function EditRow({ entry, onSave, onCancel, saving }) {
  const { rowIndex, data } = entry
  const [draft, setDraft] = useState([...data])

  function set(colKey, value) {
    setDraft(prev => {
      const next = [...prev]
      next[colKey] = value
      return next
    })
  }

  return (
    <tr className="db-row db-row-editing">
      {COLUMNS.map(col => (
        <td key={col.key} className="db-cell db-cell-input">
          {col.type === 'select' ? (
            <select
              className="db-input"
              value={String(draft[col.key] ?? '')}
              onChange={e => set(col.key, e.target.value)}
            >
              {col.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : col.type === 'datetime-local' ? (
            <input
              className="db-input"
              type="datetime-local"
              value={toDatetimeLocal(draft[col.key])}
              onChange={e => set(col.key, e.target.value)}
            />
          ) : (
            <input
              className="db-input"
              type={col.type}
              step="any"
              value={draft[col.key] ?? ''}
              onChange={e => set(col.key, e.target.value)}
            />
          )}
        </td>
      ))}
      <td className="db-cell db-cell-actions">
        <button
          className="db-btn db-btn-save"
          onClick={() => onSave(rowIndex, draft)}
          disabled={saving}
          title="Sauvegarder"
        >{saving ? '…' : '✅'}</button>
        <button
          className="db-btn db-btn-cancel"
          onClick={onCancel}
          disabled={saving}
          title="Annuler"
        >✕</button>
      </td>
    </tr>
  )
}

function toDatetimeLocal(val) {
  if (!val) return ''
  // Try parse as ISO or french date
  const s = String(val).trim()
  if (s.includes('T') && s.length >= 16) return s.slice(0, 16)
  // Try DD/MM/YYYY HH:MM
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`
  return s
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function DataBrowser({ onClose, onDataChanged }) {
  const [state, setState]         = useState('loading') // loading | ready | error
  const [header, setHeader]       = useState([])
  const [allEntries, setAll]      = useState([])
  const [filter, setFilter]       = useState('')
  const [page, setPage]           = useState(0)
  const [editingIndex, setEditing] = useState(null)  // rowIndex en cours d'édition
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // rowIndex à confirmer

  // ── Chargement des données ────────────────────────────────────────────────

  const reload = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      const result = await listEntries()
      if (!result) {
        setState('error')
        setError('Aucune donnée dans le repository.')
        return
      }
      setHeader(result.header)
      setAll(result.entries)
      setState('ready')
    } catch (e) {
      setState('error')
      setError(e.message)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // ── Filtrage ──────────────────────────────────────────────────────────────

  const filtered = filter.trim()
    ? allEntries.filter(({ data }) =>
        data.some(cell => String(cell ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : allEntries

  const pageCount  = Math.ceil(filtered.length / PAGE_SIZE)
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function onFilterChange(v) {
    setFilter(v)
    setPage(0)
    setEditing(null)
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSave(rowIndex, newData) {
    setSaving(true)
    setError(null)
    try {
      await updateRow(rowIndex, newData)
      await reload()
      setEditing(null)
      onDataChanged?.()
    } catch (e) {
      setError('Erreur sauvegarde : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(rowIndex) {
    setSaving(true)
    setError(null)
    try {
      await deleteRow(rowIndex)
      await reload()
      setDeleteConfirm(null)
      setEditing(null)
      onDataChanged?.()
    } catch (e) {
      setError('Erreur suppression : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="db-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="db-modal">

        {/* Header */}
        <div className="db-header">
          <div className="db-title">
            <span className="db-title-icon">📋</span>
            Journal de trading
            {state === 'ready' && (
              <span className="db-count">{allEntries.length} entrée{allEntries.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="db-header-actions">
            <button className="db-btn-refresh" onClick={reload} title="Actualiser">🔄</button>
            <button className="db-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Toolbar */}
        {state === 'ready' && (
          <div className="db-toolbar">
            <div className="db-search-wrap">
              <span className="db-search-icon">🔍</span>
              <input
                className="db-search"
                type="text"
                placeholder="Filtrer par paire, sens, statut…"
                value={filter}
                onChange={e => onFilterChange(e.target.value)}
              />
              {filter && (
                <button className="db-search-clear" onClick={() => onFilterChange('')}>✕</button>
              )}
            </div>
            <div className="db-filter-count">
              {filter ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}` : ''}
            </div>
          </div>
        )}

        {/* Erreur globale */}
        {error && <div className="db-error">⚠️ {error}</div>}

        {/* Corps */}
        <div className="db-body">
          {state === 'loading' && (
            <div className="db-empty-state">
              <div className="db-spinner" />
              Chargement…
            </div>
          )}

          {state === 'error' && (
            <div className="db-empty-state">
              <span style={{ fontSize: '2rem' }}>📭</span>
              {error}
            </div>
          )}

          {state === 'ready' && filtered.length === 0 && (
            <div className="db-empty-state">
              <span style={{ fontSize: '2rem' }}>🔎</span>
              Aucune entrée ne correspond au filtre.
            </div>
          )}

          {state === 'ready' && filtered.length > 0 && (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <th key={col.key} className="db-th" style={{ minWidth: col.width }}>
                        {col.label}
                      </th>
                    ))}
                    <th className="db-th db-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPage.map(entry =>
                    editingIndex === entry.rowIndex ? (
                      <EditRow
                        key={entry.rowIndex}
                        entry={entry}
                        saving={saving}
                        onSave={handleSave}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <ReadRow
                        key={entry.rowIndex}
                        entry={entry}
                        onEdit={ri => { setEditing(ri); setDeleteConfirm(null) }}
                        onDelete={ri => setDeleteConfirm(ri)}
                      />
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="db-pagination">
            <button
              className="db-page-btn"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >← Préc.</button>
            <span className="db-page-info">
              Page {page + 1} / {pageCount}
            </span>
            <button
              className="db-page-btn"
              disabled={page >= pageCount - 1}
              onClick={() => setPage(p => p + 1)}
            >Suiv. →</button>
          </div>
        )}

        {/* Footer */}
        <div className="db-footer">
          <button className="db-btn-close" onClick={onClose}>Fermer</button>
        </div>

      </div>

      {/* Modale de confirmation suppression */}
      {deleteConfirm !== null && (
        <div className="db-confirm-overlay">
          <div className="db-confirm">
            <div className="db-confirm-icon">🗑️</div>
            <div className="db-confirm-msg">
              Supprimer cette entrée ?<br />
              <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>
                Cette action est irréversible.
              </span>
            </div>
            <div className="db-confirm-actions">
              <button
                className="db-btn-cancel-confirm"
                onClick={() => setDeleteConfirm(null)}
                disabled={saving}
              >Annuler</button>
              <button
                className="db-btn-delete-confirm"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={saving}
              >{saving ? '…' : 'Supprimer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
