/**
 * BalanceDonut.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Donut : USDT disponible vs valeur crypto détenue
 *
 * USDT dispo  = Σ capital_déposé + Σ usdt_recu (toutes ventes) - Σ usdt_investi (tous achats)
 * Crypto      = Σ investi_en_cours des paires non-dépôt (coût d'achat encore bloqué)
 */

const fmt = (v, d = 2) =>
  isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

function Donut({ usdtPct, cryptoPct, size = 110, stroke = 13 }) {
  const r    = (size - stroke) / 2
  const cx   = size / 2
  const cy   = size / 2
  const circ = 2 * Math.PI * r
  const GAP  = circ * (4 / 360)

  const aUsdt = Math.max(0, circ * (usdtPct  / 100) - GAP)
  const aCryp = Math.max(0, circ * (cryptoPct / 100) - GAP)
  const o2    = circ - aUsdt - GAP

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      {aUsdt > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--green)" strokeWidth={stroke}
          strokeDasharray={`${aUsdt} ${circ - aUsdt}`}
          strokeDashoffset={0} strokeLinecap="butt"
          style={{ filter: 'drop-shadow(0 0 5px rgba(0,214,143,.6))' }}
        />
      )}
      {aCryp > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--gold)" strokeWidth={stroke}
          strokeDasharray={`${aCryp} ${circ - aCryp}`}
          strokeDashoffset={-o2} strokeLinecap="butt"
          style={{ filter: 'drop-shadow(0 0 5px rgba(232,184,75,.5))' }}
        />
      )}
    </svg>
  )
}

export default function BalanceDonut({ pairList, excluded }) {
  // ── On travaille sur TOUTES les paires (pas de filtre excluded pour les flux) ──
  const depots  = pairList.filter(p => p.is_depot)
  const trades  = pairList.filter(p => !p.is_depot)

  // 1. Total des dépôts
  const totalDepose   = depots.reduce((s, p) => s + p.capital_depose, 0)

  // 2. Total de tous les achats exécutés (USDT sortis du wallet)
  const totalAchats   = trades.reduce((s, p) => s + p.usdt_investi, 0)

  // 3. Total de toutes les ventes exécutées (USDT rentrés dans le wallet)
  const totalVentes   = trades.reduce((s, p) => s + p.usdt_recu, 0)

  // 4. USDT disponible = flux entrants - flux sortants
  const usdtDispo     = Math.max(0, totalDepose + totalVentes - totalAchats)

  // 5. Valeur crypto encore détenue = somme des coûts d'achat non encore vendus
  //    investi_en_cours = usdt_investi - (prix_moy × vol_vendu)
  const valeurCrypto  = trades.reduce((s, p) => s + Math.max(0, p.investi_en_cours), 0)

  // ── Donut ──
  const total     = usdtDispo + valeurCrypto
  const usdtPct   = total > 0 ? (usdtDispo   / total) * 100 : 0
  const cryptoPct = total > 0 ? (valeurCrypto / total) * 100 : 0

  return (
    <div className="kpi kpi-donut">
      <div className="kpi-donut-inner">

        {/* SVG */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Donut usdtPct={usdtPct} cryptoPct={cryptoPct} />
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
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
              <div className="kpi-donut-val g">{fmt(usdtDispo, 0)} <span className="kpi-unit">USDT</span></div>
              <div className="kpi-donut-pct">{fmt(usdtPct, 1)} %</div>
            </div>
          </div>

          <div className="kpi-donut-item">
            <span className="kpi-donut-dot" style={{ background: 'var(--gold)' }} />
            <div>
              <div className="kpi-donut-lbl">Crypto Détenues</div>
              <div className="kpi-donut-val o">{fmt(valeurCrypto, 0)} <span className="kpi-unit">USDT</span></div>
              <div className="kpi-donut-pct">{fmt(cryptoPct, 1)} %</div>
            </div>
          </div>

          {/* Détail des flux pour vérification */}
          <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {[
              { l: 'Dépôts',  v: totalDepose, c: 'var(--gold)' },
              { l: 'Achats',  v: -totalAchats, c: 'var(--red)' },
              { l: 'Ventes',  v: totalVentes, c: 'var(--green)' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.48rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{l}</div>
                <div style={{ fontSize: '.65rem', fontWeight: 700, color: c, fontFamily: "'Syne', sans-serif" }}>
                  {fmt(Math.abs(v), 0)}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
