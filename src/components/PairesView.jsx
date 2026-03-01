/**
 * PairesView.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Page dédiée à l'affichage de toutes les cartes par paire.
 * Accessible depuis la carte "Paires" sur la Landing page.
 */

import PairCard from './PairCard.jsx'
import Logo     from './Logo.jsx'

export default function PairesView({ pairList, excluded, toggleFlag, onBack }) {
  const tradingPairs = pairList.filter(p => !p.is_depot)
  const depotPairs   = pairList.filter(p => p.is_depot)
  const actives      = tradingPairs.filter(p => p.position > 0).length
  const exclues      = excluded.size

  return (
    <div id="landing" style={{ justifyContent: 'flex-start', paddingTop: 28 }}>

      {/* ── Header avec logo ── */}
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <Logo small />
        <button
          className="back-btn"
          onClick={onBack}
          style={{ fontSize: '.68rem', padding: '7px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', textDecoration: 'none' }}
        >
          ← Retour au menu
        </button>
      </div>

      {/* ── Titre de section ── */}
      <div style={{ width: '100%', maxWidth: 1100 }}>
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
          <div style={{ fontSize: '.6rem', color: 'var(--text2)', marginTop: 6 }}>
            Cliquez sur 🏳 pour exclure une paire des calculs globaux
          </div>
        </div>
      </div>

      {/* ── Grille des cartes ── */}
      <div style={{ width: '100%', maxWidth: 1100 }}>
        {pairList.length === 0 ? (
          <div className="paires-empty">
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, marginBottom: 6 }}>
              Aucune paire chargée
            </div>
            <div style={{ fontSize: '.7rem', color: 'var(--text2)' }}>
              Importez d'abord votre journal de trading depuis le menu Données.
            </div>
            <button className="back-btn" onClick={onBack} style={{ marginTop: 18, display: 'inline-block' }}>
              ← Retour au menu principal
            </button>
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
    </div>
  )
}
