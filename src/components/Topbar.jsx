import Logo from './Logo.jsx'
/**
 * Topbar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Barre de navigation du dashboard.
 * Actions disponibles :
 *   - Retour au menu principal (backToLanding)
 *   - Effacer le repository (clearRepository)
 */

export default function Topbar({ fileName, loadedAt, excluded, clearRepository, backToLanding }) {
  const n = excluded.size

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Logo small />
        <div className="topbar-file">📊 <strong>{fileName}</strong></div>
      </div>
      <div className="topbar-actions">
        <div className="live-dot" />
        <span style={{ fontSize: '.58rem', color: 'var(--text2)' }}>
          {loadedAt ? `Chargé à ${loadedAt}` : ''}
        </span>
        {n > 0 && (
          <span className="excl-counter visible">
            {n} paire{n > 1 ? 's' : ''} exclue{n > 1 ? 's' : ''}
          </span>
        )}
        <button className="btn-sm" onClick={backToLanding}>← Menu principal</button>
        <button className="btn-sm btn-sm-danger" onClick={clearRepository} title="Efface le repository local">
          🗑 Effacer les données
        </button>
      </div>
    </div>
  )
}
