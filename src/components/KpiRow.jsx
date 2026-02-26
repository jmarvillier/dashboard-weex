/**
 * KpiRow.jsx — Bande de KPIs globaux en haut du dashboard
 */

const fmt  = (v, d = 2) => isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtS = v => { const n = +v; return isNaN(n) ? '—' : (n >= 0 ? '+' : '−') + ' ' + fmt(Math.abs(n)) }
const cc   = v => v > 0 ? 'g' : v < 0 ? 'r' : ''
const pct  = (val, ref) => ref > 0 ? ((val / ref) * 100) : null

export default function KpiRow({ pairList, excluded }) {
  const active  = pairList.filter(p => !excluded.has(p.name))
  const trading = active.filter(p => !p.is_depot)

  const sDepose = pairList.reduce((s, p) => s + p.capital_depose, 0)
  const sInv    = trading.reduce((s, p) => s + p.usdt_investi, 0)
  const sPnlR   = trading.reduce((s, p) => s + p.pnl_realise, 0)
  const sPnlL   = trading.reduce((s, p) => s + p.pnl_latent, 0)
  const sPnl    = sPnlR + sPnlL
  const sTot    = active.reduce((s, p) => s + p.nb_total, 0)
  const sExec   = active.reduce((s, p) => s + p.nb_exec, 0)
  const sCanc   = active.reduce((s, p) => s + p.nb_annule, 0)
  const ePct    = sTot > 0 ? sExec / sTot * 100 : 0
  const nActif  = trading.length

  const pctPnlR = pct(sPnlR, sInv)
  const pctPnlL = pct(sPnlL, sInv)
  const pctPnl  = pct(sPnl, sInv)

  return (
    <div className="kpi-row">

      {/* Capital déposé */}
      <div className="kpi kpi-capital">
        <div className="kpi-icon">💰</div>
        <div className="kpi-l">Capital Déposé</div>
        <div className="kpi-v o">{fmt(sDepose)}<span className="kpi-unit">USDT</span></div>
        <div className="kpi-s">Total des apports</div>
      </div>

      {/* Capital investi */}
      <div className="kpi">
        <div className="kpi-icon">📈</div>
        <div className="kpi-l">Capital Investi</div>
        <div className="kpi-v o">{fmt(sInv)}<span className="kpi-unit">USDT</span></div>
        <div className="kpi-s">{nActif} paire{nActif > 1 ? 's' : ''} active{nActif > 1 ? 's' : ''}</div>
      </div>

      {/* PnL Réalisé */}
      <div className={`kpi kpi-pnl ${cc(sPnlR)}`}>
        <div className="kpi-icon">{sPnlR >= 0 ? '✅' : '❌'}</div>
        <div className="kpi-l">PnL Réalisé</div>
        <div className={`kpi-v ${cc(sPnlR)}`}>{fmtS(sPnlR)}<span className="kpi-unit">USDT</span></div>
        {pctPnlR !== null && (
          <div className={`kpi-pct ${cc(sPnlR)}`}>
            {sPnlR >= 0 ? '+' : '−'}{fmt(Math.abs(pctPnlR), 1)} %
          </div>
        )}
        <div className="kpi-s">Gains / pertes clôturés</div>
      </div>

      {/* PnL Latent */}
      <div className={`kpi kpi-pnl ${cc(sPnlL)}`}>
        <div className="kpi-icon">{sPnlL >= 0 ? '⏳' : '⚠️'}</div>
        <div className="kpi-l">PnL Latent</div>
        <div className={`kpi-v ${cc(sPnlL)}`}>{fmtS(sPnlL)}<span className="kpi-unit">USDT</span></div>
        {pctPnlL !== null && (
          <div className={`kpi-pct ${cc(sPnlL)}`}>
            {sPnlL >= 0 ? '+' : '−'}{fmt(Math.abs(pctPnlL), 1)} %
          </div>
        )}
        <div className="kpi-s">Positions ouvertes</div>
      </div>

      {/* PnL Total */}
      <div className={`kpi kpi-pnl kpi-total ${cc(sPnl)}`}>
        <div className="kpi-icon">{sPnl >= 0 ? '🚀' : '📉'}</div>
        <div className="kpi-l">PnL Total</div>
        <div className={`kpi-v kpi-v-big ${cc(sPnl)}`}>{fmtS(sPnl)}<span className="kpi-unit">USDT</span></div>
        {pctPnl !== null && (
          <div className={`kpi-pct kpi-pct-big ${cc(sPnl)}`}>
            {sPnl >= 0 ? '+' : '−'}{fmt(Math.abs(pctPnl), 1)} %
          </div>
        )}
        <div className="kpi-s">Réalisé + Latent</div>
      </div>

      {/* Ordres */}
      <div className="kpi">
        <div className="kpi-icon">📋</div>
        <div className="kpi-l">Ordres</div>
        <div className="kpi-v">{sTot}<span className="kpi-unit">total</span></div>
        <div className="kpi-s">{sExec} exec · {sCanc} annulés</div>
      </div>

      {/* Taux exécution */}
      <div className="kpi">
        <div className="kpi-icon">🎯</div>
        <div className="kpi-l">Taux Exécution</div>
        <div className="kpi-v g">{fmt(ePct, 1)}<span className="kpi-unit">%</span></div>
        <div className="kpi-s">Exécutés / total</div>
      </div>

    </div>
  )
}
