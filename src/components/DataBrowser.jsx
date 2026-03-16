/**
 * DataBrowser.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Parcourir, éditer et supprimer les entrées du repository.
 *
 * Améliorations :
 *   - Tri anti-chronologique + par paire sur même date
 *   - Boutons édition/suppression en début de ligne
 *   - Bouton ➕ au-dessus de la grille → ouvre EntryForm en popin
 */

import { useState, useEffect, useCallback } from 'react'
import { listEntries, updateRow, deleteRow } from '../lib/repository.js'
import EntryForm from './EntryForm.jsx'

// ── Colonnes du journal ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: 0,  label: 'Date',      type: 'datetime-local', width: '170px' },
  { key: 1,  label: 'Paire',     type: 'text',           width: '110px' },
  { key: 2,  label: 'Sens',      type: 'select',         width: '100px',
    options: ['Achat', 'Vente', 'Dépôt', 'Retrait'] },
  { key: 3,  label: 'Statut',    type: 'select',         width: '110px',
    options: ['Exécuté', 'Annulé', 'En attente'] },
  { key: 4,  label: 'Cours',     type: 'number',         width: '110px' },
  { key: 5,  label: 'USDT',      type: 'number',         width: '100px' },
  { key: 6,  label: 'USDC',      type: 'number',         width: '100px' },
  { key: 7,  label: 'EUR',       type: 'number',         width: '90px'  },
  { key: 10, label: 'Volume',    type: 'number',         width: '100px' },
  { key: 11, label: 'Notes',     type: 'text',           width: '220px' },
  { key: 12, label: 'Dashboard', type: 'select',         width: '100px',
    options: ['true', 'false'] },
]

const PAGE_SIZE = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDatetimeLocal(val) {
  if (!val) return ''
  const s = String(val).trim()
  if (s.includes('T') && s.length >= 16) return s.slice(0, 16)
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`
  return s
}

/** Convertit une valeur de date en timestamp pour le tri */
function toTimestamp(val) {
  if (!val) return 0
  const s = String(val).trim()
  // Format ISO ou datetime-local
  if (s.includes('T')) return new Date(s).getTime() || 0
  // Format JJ/MM/AAAA HH:MM
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`).getTime() || 0
  return new Date(s).getTime() || 0
}

/** Tri anti-chronologique, puis par paire sur même date */
function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const tA = toTimestamp(a.data[0])
    const tB = toTimestamp(b.data[0])
    if (tB !== tA) return tB - tA  // anti-chronologique
    const pA = String(a.data[1] ?? '').toLowerCase()
    const pB = String(b.data[1] ?? '').toLowerCase()
    return pA.localeCompare(pB)    // alphabétique par paire
  })
}

function initDraft(data) {
  const d = [...data]
  while (d.length <= 12) d.push('')
  COLUMNS.forEach(col => {
    if (col.type === 'select') {
      const raw = String(d[col.key] ?? '').trim()
      d[col.key] = col.options.includes(raw) ? raw : col.options[0]
    } else if (col.type === 'number') {
      const raw = d[col.key]
      d[col.key] = (raw === null || raw === undefined || raw === '') ? '' : String(raw)
    } else if (col.type === 'datetime-local') {
      d[col.key] = toDatetimeLocal(d[col.key])
    } else {
      d[col.key] = d[col.key] ?? ''
    }
  })
  return d
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

// ── Ligne en lecture — boutons en DÉBUT de ligne ──────────────────────────────

function ReadRow({ entry, onEdit, onDelete }) {
  const { rowIndex, data } = entry
  const isExcluded = String(data[12]).trim().toLowerCase() === 'false'

  return (
    <tr className={`db-row${isExcluded ? ' db-row-excluded' : ''}`}>
      {/* ── Actions en premier ── */}
      <td className="db-cell db-cell-actions">
        <button className="db-btn db-btn-edit"   onClick={() => onEdit(rowIndex)}   title="Modifier">✏️</button>
        <button className="db-btn db-btn-delete" onClick={() => onDelete(rowIndex)} title="Supprimer">🗑️</button>
      </td>
      {COLUMNS.map(col => (
        <td key={col.key} className="db-cell">
          {formatCell(col, data[col.key])}
        </td>
      ))}
    </tr>
  )
}

// ── Ligne en édition — boutons en DÉBUT de ligne ──────────────────────────────

function EditRow({ entry, onSave, onCancel, saving }) {
  const { rowIndex } = entry
  const [draft, setDraft] = useState(() => initDraft(entry.data))

  function set(colKey, value) {
    setDraft(prev => { const next = [...prev]; next[colKey] = value; return next })
  }

  return (
    <tr className="db-row db-row-editing">
      {/* ── Actions en premier ── */}
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
      {COLUMNS.map(col => (
        <td key={col.key} className="db-cell db-cell-input">
          {col.type === 'select' ? (
            <select className="db-input" value={draft[col.key]} onChange={e => set(col.key, e.target.value)}>
              {col.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : col.type === 'datetime-local' ? (
            <input className="db-input" type="datetime-local" value={draft[col.key]} onChange={e => set(col.key, e.target.value)} />
          ) : col.key === 11 ? (
            <textarea className="db-input" rows={2} style={{resize:'vertical',minHeight:32,fontFamily:'inherit',fontSize:'inherit'}} value={draft[col.key]} onChange={e => set(col.key, e.target.value)} />
          ) : (
            <input className="db-input" type={col.type} step="any" value={draft[col.key]} onChange={e => set(col.key, e.target.value)} />
          )}
        </td>
      ))}
    </tr>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function DataBrowser({ onClose, onDataChanged }) {
  const [state, setState]         = useState('loading')
  const [allEntries, setAll]      = useState([])
  const [filter, setFilter]       = useState('')
  const [page, setPage]           = useState(0)
  const [editingIndex, setEditing] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showEntryForm, setShowEntryForm] = useState(false)

  const reload = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      const result = await listEntries()
      if (!result) { setState('error'); setError('Aucune donnée dans le repository.'); return }
      // Tri anti-chronologique + par paire
      setAll(sortEntries(result.entries))
      setState('ready')
    } catch (e) {
      setState('error'); setError(e.message)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const filtered = filter.trim()
    ? allEntries.filter(({ data }) =>
        data.some(cell => String(cell ?? '').toLowerCase().includes(filter.toLowerCase()))
      )
    : allEntries

  const pageCount   = Math.ceil(filtered.length / PAGE_SIZE)
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function onFilterChange(v) { setFilter(v); setPage(0); setEditing(null) }

  async function handleSave(rowIndex, newData) {
    setSaving(true); setError(null)
    try {
      await updateRow(rowIndex, newData)
      await reload()
      setEditing(null)
      onDataChanged?.()
    } catch (e) { setError('Erreur sauvegarde : ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(rowIndex) {
    setSaving(true); setError(null)
    try {
      await deleteRow(rowIndex)
      await reload()
      setDeleteConfirm(null); setEditing(null)
      onDataChanged?.()
    } catch (e) { setError('Erreur suppression : ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="db-overlay">
      <div className="db-modal">

        {/* ── Header ── */}
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

        {/* ── Toolbar : recherche + bouton ➕ ── */}
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
              {filter && <button className="db-search-clear" onClick={() => onFilterChange('')}>✕</button>}
            </div>
            <div className="db-filter-count">
              {filter ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}` : ''}
            </div>

            {/* ── Bouton Nouvelle entrée ── */}
            <button
              className="db-btn-add"
              onClick={() => setShowEntryForm(true)}
              title="Nouvelle entrée"
            >
              ➕ Nouvelle entrée
            </button>
          </div>
        )}

        {error && <div className="db-error">⚠️ {error}</div>}

        {/* ── Corps / tableau ── */}
        <div className="db-body">
          {state === 'loading' && (
            <div className="db-empty-state"><div className="db-spinner" />Chargement…</div>
          )}
          {state === 'error' && (
            <div className="db-empty-state"><span style={{ fontSize: '2rem' }}>📭</span>{error}</div>
          )}
          {state === 'ready' && filtered.length === 0 && (
            <div className="db-empty-state"><span style={{ fontSize: '2rem' }}>🔎</span>Aucune entrée ne correspond au filtre.</div>
          )}
          {state === 'ready' && filtered.length > 0 && (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    {/* Colonne actions en premier */}
                    <th className="db-th db-th-actions">Actions</th>
                    {COLUMNS.map(col => (
                      <th key={col.key} className="db-th" style={{ minWidth: col.width }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentPage.map(entry =>
                    editingIndex === entry.rowIndex ? (
                      <EditRow
                        key={`edit-${entry.rowIndex}`}
                        entry={entry}
                        saving={saving}
                        onSave={handleSave}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <ReadRow
                        key={`read-${entry.rowIndex}`}
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

        {/* ── Pagination ── */}
        {pageCount > 1 && (
          <div className="db-pagination">
            <button className="db-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Préc.</button>
            <span className="db-page-info">Page {page + 1} / {pageCount}</span>
            <button className="db-page-btn" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Suiv. →</button>
          </div>
        )}

        <div className="db-footer">
          <button className="db-btn-close" onClick={onClose}>Fermer</button>
        </div>

      </div>

      {/* ── Confirmation suppression ── */}
      {deleteConfirm !== null && (
        <div className="db-confirm-overlay">
          <div className="db-confirm">
            <div className="db-confirm-icon">🗑️</div>
            <div className="db-confirm-msg">
              Supprimer cette entrée ?<br />
              <span style={{ fontSize: '.65rem', color: 'var(--muted)' }}>Cette action est irréversible.</span>
            </div>
            <div className="db-confirm-actions">
              <button className="db-btn-cancel-confirm" onClick={() => setDeleteConfirm(null)} disabled={saving}>Annuler</button>
              <button className="db-btn-delete-confirm" onClick={() => handleDelete(deleteConfirm)} disabled={saving}>
                {saving ? '…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popin EntryForm ── */}
      {showEntryForm && (
        <EntryForm
          onClose={() => setShowEntryForm(false)}
          onSaved={() => {
            setShowEntryForm(false)
            reload()
            onDataChanged?.()
          }}
        />
      )}

    </div>
  )
}
