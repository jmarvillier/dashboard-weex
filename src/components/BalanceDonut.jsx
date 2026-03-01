/**
 * BalanceDonut.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Carte KPI avec donut SVG : balance USDT disponible vs valeur crypto détenue
 *
 * Calcul :
 *   usdt_dispo  = capital_déposé − investi_en_cours_total + usdt_recu_total
 *   valeur_crypto = sum(investi_en_cours) des paires trading non-USD non-exclues
 */

const fmt = (v, d = 2) =>
  isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── SVG Donut ──────────────────────────────────────────────────────────────

function Donut({ usdtPct, cryptoPct, size = 120, stroke = 14 }) {
  const r     = (size - stroke) / 2
  const cx    = size / 2
  const cy    = size / 2
  const circ  = 2 * Math.PI * r

  // arc USDT (vert) puis arc crypto (or) avec gap de 3°
  const GAP   = circ * (3 / 360)
  const aUsdt = circ * (usdtPct / 100) - GAP
  const aCryp = circ * (cryptoPct / 100) - GAP
  const aRest = circ - aUsdt - aCryp - GAP * 2

  // offset de départ depuis le haut (-90°)
  const o1 = 0
  const o2 = circ - aUsdt - GAP / 2
  const o3 = circ - aUsdt - GAP / 2 - aCryp - GAP / 2

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      {/* Fond */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />

      {/* Arc USDT (vert) */}
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

      {/* Arc Crypto (or) */}
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

      {/* Arc Reste (gris) */}
      {aRest > 2 && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          strokeDasharray={`${aRest} ${circ - aRest}`}
          strokeDashoffset={-o3}
          strokeLinecap="butt"
          opacity="0.3"
        />
      )}
    </svg>
  )
}

// ── Composant principal ────────────────────────────────────────────────────

export default function BalanceDonut({ pairList, excluded }) {
  const active  = pairList.filter(p => !excluded.has(p.name))
  const trading = active.filter(p => !p.is_depot)

  // Capital total déposé
  const capitalDepose = pairList.reduce((s, p) => s + p.capital_depose, 0)

  // Valeur crypto en cours (investi non encore vendu, hors paires USD/dépôts)
  const valeurCrypto = trading
    .filter(p => !p.is_usd)
    .reduce((s, p) => s + Math.max(0, p.investi_en_cours), 0)

  // USDT total reçu des ventes
  const usdtRecu = trading.reduce((s, p) => s + p.usdt_recu, 0)

  // USDT disponible estimé = déposé - investi en cours + reçu des ventes
  const totalInvesti = trading.reduce((s, p) => s + Math.max(0, p.investi_en_cours), 0)
  const usdtDispo = Math.max(0, capitalDepose - totalInvesti + usdtRecu - capitalDepose)
  // Approche plus simple et lisible :
  // USDT dispo = capital déposé - ce qui est encore bloqué en crypto
  const usdtDispoFinal = Math.max(0, capitalDepose - valeurCrypto)

  const total = usdtDispoFinal + valeurCrypto
  const usdtPct  = total > 0 ? (usdtDispoFinal / total) * 100 : 0
  const cryptoPct = total > 0 ? (valeurCrypto   / total) * 100 : 0

  const fmt1 = v => fmt(v, 0)

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
            <span style={{ fontSize: '.48rem', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>balance</span>
            <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              {fmt1(usdtPct)}%
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
              <div className="kpi-donut-val g">{fmt1(usdtDispoFinal)} <span className="kpi-unit">USDT</span></div>
              <div className="kpi-donut-pct">{fmt(usdtPct, 1)} %</div>
            </div>
          </div>
          <div className="kpi-donut-item">
            <span className="kpi-donut-dot" style={{ background: 'var(--gold)' }} />
            <div>
              <div className="kpi-donut-lbl">Crypto Détenues</div>
              <div className="kpi-donut-val o">{fmt1(valeurCrypto)} <span className="kpi-unit">USDT</span></div>
              <div className="kpi-donut-pct">{fmt(cryptoPct, 1)} %</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
