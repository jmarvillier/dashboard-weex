/**
 * PairesView.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vue dédiée à l'affichage de toutes les cartes par paire.
 * Supporte un mode "embedded" (intégré dans AppShell) et un mode standalone.
 */

import PairCard from './PairCard.jsx'

export default function PairesView({ pairList, excluded, toggleFlag, onBack, embedded = false }) {
  const tradingPairs = pairList.filter(p => !p.is_depot)
  const depotPairs   = pairList.filter(p => p.is_depot)
  const actives      = tradingPairs.filter(p => p.position > 0).length
  const exclues      = excluded.size

  return (
    <div className={embedded ? 'paires-embedded' : 'paires-standalone'}>

      {/* Header (standalone uniquement) */}
      {!embedded && (
        <div className="paires-standalone-header">
          <button className="dp-back-btn" onClick={onBack}>
            <span>←</span> Menu principal
          </button>
        </div>
      )}

      {/* Bandeau de stats */}
      <div className="paires-page-header">
        <div className="paires-page-title">
          <span>⚡</span> Paires de Trading
        </div>
        <div className="paires-page-meta">
          <span className="paires-badge">
            <span className="paires-badge-val">{tradingPairs.length}</span>
            <span className="paires-badge-lbl">Paires</span>
          </span>
          <span className="paires-badge g">
            <span className="paires-badge-val">{actives}</span>
            <span className="paires-badge-lbl">En position</span>
          </span>
          {exclues > 0 && (
            <span className="paires-badge r">
              <span className="paires-badge-val">{exclues}</span>
              <span className="paires-badge-lbl">Exclue{exclues > 1 ? 's' : ''}</span>
            </span>
          )}
          {depotPairs.length > 0 && (
            <span className="paires-badge o">
              <span className="paires-badge-val">{depotPairs.length}</span>
              <span className="paires-badge-lbl">Dépôt{depotPairs.length > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
        <div className="paires-hint">
          Cliquez sur 🏳 pour exclure une paire des calculs globaux
        </div>
      </div>

      {/* Grille ou état vide */}
      {pairList.length === 0 ? (
        <div className="paires-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, marginBottom: 6 }}>
            Aucune paire chargée
          </div>
          <div style={{ fontSize: '.7rem', color: 'var(--text2)' }}>
            Importez d'abord votre journal depuis l'onglet Données.
          </div>
        </div>
      ) : (
        <div className="pairs-grid">
          {pairList.map((p, i) => (
            <PairCard
              key={p.name}
              p={p}
              index={i}
              excluded={excluded}
              onToggle={toggleFlag}
            />
          ))}
        </div>
      )}
    </div>
  )
}
