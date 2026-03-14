/**
 * PairesView.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Vue dédiée à l'affichage de toutes les cartes par paire.
 * Supporte un mode "embedded" (intégré dans AppShell) et un mode standalone.
 */

import PairCard from './PairCard.jsx'

export default function PairesView({ pairList, excluded, toggleFlag, onBack, embedded = false }) {
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

      {/* Grille ou état vide */}
      {pairList.length === 0 ? (
        <div className="paires-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, marginBottom: 6 }}>
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
