/**
 * BalanceDonut.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Carte KPI avec donut SVG : balance USDT disponible vs valeur crypto détenue
 *
 * Calcul correct des flux :
 *   usdt_dispo  = capital_déposé + Σ usdt_recu (ventes) - Σ usdt_investi (achats)
 *   valeur_crypto = Σ investi_en_cours (ce qui est encore bloqué en crypto)
 *
 * Logique :
 *   Tu déposes du cash → tu achètes de la crypto (ça sort du cash)
 *   Tu vends de la crypto → ça rentre dans le cash
 *   Ce qui reste en cash = déposé + rentrées ventes - sorties achats
 */

const fmt = (v, d = 2) =>
  isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── SVG Donut ──────────────────────────────────────────────────────────────

function Donut({ usdtPct, cryptoPct, size = 120, stroke = 14 }) {
  const r    = (size - stroke) / 2
  const cx   = size / 2
  const cy   = size / 2
  const circ = 2 * Math.PI * r
  const GAP  = circ * (3 / 360)

  const aUsdt = Math.max(0, circ * (usdtPct  / 100) - GAP)
  const aCryp = Math.max(0, circ * (cryptoPct / 100) - GAP)

  // offsets (on part du haut = -90°, géré par rotate(-90deg) sur le SVG)
  const o1 = 0
  const o2 = circ - aUsdt - GAP

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {/* Fond */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />

      {/* Arc USDT disponible (vert) */}
      {aUsdt > 0 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--green)"
          strokeWidth={stroke}
          strokeDasharray={`${aUsdt} ${circ - aUsdt}`}
          strokeDashoffset={-o1}
          strokeLinecap="butt"
          style={{ filter: 'drop-shadow(0 0 4px rgba(0,214,143,.5))' }}
        />
      )}

      {/* Arc Crypto détenue (or) */}
      {aCryp > 0 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--gold)"
          strokeWidth={stroke}
          strokeDasharray={`${aCryp} ${circ - aCryp}`}
          strokeDashoffset={-o2}
          strokeLinecap="butt"
          style={{ filter: 'drop-shadow(0 0 4px rgba(232,184,75,.4))' }}
        />
      )}
    </svg>
  )
}

// ── Composant principal ────────────────────────────────────────────────────

export default function BalanceDonut({ pairList, excluded }) {
  const active  = pairList.filter(p => !excluded.has(p.name))
  const trading = active.filter(p => !p.is_depot)

  // ── Flux de trésorerie ────────────────────────────────────────────────────
  // Capital total déposé (toutes les lignes dépôt)
  const capitalDepose = pairList.reduce((s, p) => s + p.capital_depose, 0)

  // Total USDT sorti pour acheter de la crypto (tous achats exécutés)
  const totalAchats = trading.reduce((s, p) => s + p.usdt_investi, 0)

  // Total USDT rentré des ventes
  const totalVentes = trading.reduce((s, p) => s + p.usdt_recu, 0)

  // USDT disponible = ce qui est rentré - ce qui est sorti
  // = dépôts + ventes - achats
  const usdtDispo = Math.max(0, capitalDepose + totalVentes - totalAchats)

  // Valeur crypto encore détenue (coût d'acquisition de ce qui reste en portefeuille)
  const valeurCrypto = trading
    .filter(p => !p.is_usd)
    .reduce((s, p) => s + Math.max(0, p.investi_en_cours), 0)

  // ── Pourcentages pour le donut ────────────────────────────────────────────
  const total     = usdtDispo + valeurCrypto
  const usdtPct   = total > 0 ? (usdtDispo   / total) * 100 : 0
  const cryptoPct = total > 0 ? (valeurCrypto / total) * 100 : 0

  const fmt0 = v => fmt(v, 0)

  return (
    <div className="kpi kpi-donut">
      <div className="kpi-donut-inner">

        {/* Donut SVG */}
        <div className="kpi-donut-chart" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Donut usdtPct={usdtPct} cryptoPct={cryptoPct} size={110} stroke={13} />
          {/* Label central */}
          <div style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1.2,
          }}>
            <span style={{ fontSize: '.44rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>balance</span>
            <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              {fmt(usdtPct, 1)}%
            </span>
            <span style={{ fontSize: '.42rem', color: 'var(--green)' }}>USDT</span>
          </div>
        </div>

        {/* Légende */}
        <div className="kpi-donut-legend">

          <div className="kpi-donut-item">
            <span className="kpi-donut-dot" style={{ background: 'var(--green)' }} />
            <div>
              <div className="kpi-donut-lbl">USDT Disponible</div>
              <div className="kpi-donut-val g">{fmt0(usdtDispo)} <span className="kpi-unit">USDT</span></div>
              <div className="kpi-donut-pct">{fmt(usdtPct, 1)} %</div>
            </div>
          </div>

          <div className="kpi-donut-item">
            <span className="kpi-donut-dot" style={{ background: 'var(--gold)' }} />
            <div>
              <div className="kpi-donut-lbl">Crypto Détenues</div>
              <div className="kpi-donut-val o">{fmt0(valeurCrypto)} <span className="kpi-unit">USDT</span></div>
              <div className="kpi-donut-pct">{fmt(cryptoPct, 1)} %</div>
            </div>
          </div>

          {/* Ligne de vérification */}
          <div style={{
            marginTop: 4,
            paddingTop: 8,
            borderTop: '1px solid var(--border)',
            fontSize: '.52rem',
            color: 'var(--text2)',
            lineHeight: 1.7,
          }}>
            <span style={{ color: 'var(--text)' }}>Dépôts :</span> {fmt0(capitalDepose)} ·{' '}
            <span style={{ color: 'var(--text)' }}>Achats :</span> {fmt0(totalAchats)} ·{' '}
            <span style={{ color: 'var(--green)' }}>Ventes :</span> {fmt0(totalVentes)}
          </div>

        </div>
      </div>
    </div>
  )
}
