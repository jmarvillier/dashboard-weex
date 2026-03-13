/**
 * KpiRow.jsx — Bande de KPIs globaux + barre live
 */

const fmt  = (v, d = 2) => isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtS = v => { const n = +v; return isNaN(n) ? '—' : (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) }
const cc   = v => v > 0 ? 'g' : v < 0 ? 'r' : ''
const pct  = (val, ref) => ref > 0 ? ((val / ref) * 100) : null

export default function KpiRow({ pairList, excluded, pricesLoading, pricesError, priceSource, lastPriceUpdate, refreshPrices }) {
  const active  = pairList.filter(p => !excluded.has(p.name))
  const trading = active.filter(p => !p.is_depot)

  const sDepose = pairList.reduce((s, p) => s + p.capital_depose, 0)
  const sInv    = trading.reduce((s, p) => s + p.usdt_investi, 0)

  // PnL journal
  const sPnlR  = trading.reduce((s, p) => s + p.pnl_realise, 0)
  const sPnlL  = trading.reduce((s, p) => s + p.pnl_latent, 0)
  const sPnl   = sPnlR + sPnlL

  // PnL live
  const hasLive = trading.some(p => p.pnl_latent_live !== null)
  const sPnlRL  = hasLive ? trading.reduce((s, p) => s + (p.pnl_realise_live ?? p.pnl_realise), 0) : null
  const sPnlLL  = hasLive ? trading.reduce((s, p) => s + (p.pnl_latent_live  ?? 0), 0) : null
  const sPnlTL  = (sPnlRL !== null && sPnlLL !== null) ? sPnlRL + sPnlLL : null

  const sTot   = active.reduce((s, p) => s + p.nb_total, 0)
  const sExec  = active.reduce((s, p) => s + p.nb_exec, 0)
  const sCanc  = active.reduce((s, p) => s + p.nb_annule, 0)
  const ePct   = sTot > 0 ? sExec / sTot * 100 : 0
  const nActif = trading.length

  const pctPnlR  = pct(sPnlR, sInv)
  const pctPnlL  = pct(sPnlL, sInv)
  const pctPnl   = pct(sPnl, sInv)
  const pctPnlTL = sPnlTL !== null ? pct(sPnlTL, sInv) : null

  const updateLabel = lastPriceUpdate ?? '—'

  const sourceLabel = pricesError
    ? '⚠️ Erreur'
    : priceSource
      ? priceSource
      : 'chargement…'

  return (
    <div className="kpi-section">

      {/* ── Ligne 1 : KPIs statiques ── */}
      <div className="kpi-row">

        <div className="kpi kpi-capital">
          <div className="kpi-icon">💰</div>
          <div className="kpi-l">Capital Déposé</div>
          <div className="kpi-v o">{fmt(sDepose)}<span className="kpi-unit">USDT</span></div>
          <div className="kpi-s">Total des apports</div>
        </div>

        <div className="kpi">
          <div className="kpi-icon">📈</div>
          <div className="kpi-l">Capital Investi</div>
          <div className="kpi-v o">{fmt(sInv)}<span className="kpi-unit">USDT</span></div>
          <div className="kpi-s">{nActif} paire{nActif > 1 ? 's' : ''} active{nActif > 1 ? 's' : ''}</div>
        </div>

        <div className={`kpi kpi-pnl ${cc(sPnlR)}`}>
          <div className="kpi-icon">{sPnlR >= 0 ? '✅' : '❌'}</div>
          <div className="kpi-l">PnL Réalisé <span className="kpi-source-tag">journal</span></div>
          <div className={`kpi-v ${cc(sPnlR)}`}>{fmtS(sPnlR)}<span className="kpi-unit">USDT</span></div>
          {pctPnlR !== null && (
            <div className={`kpi-pct ${cc(sPnlR)}`}>{sPnlR >= 0 ? '+' : '−'}{fmt(Math.abs(pctPnlR), 1)} %</div>
          )}
          <div className="kpi-s">Gains / pertes clôturés</div>
        </div>

        <div className={`kpi kpi-pnl ${cc(sPnlL)}`}>
          <div className="kpi-icon">{sPnlL >= 0 ? '⏳' : '⚠️'}</div>
          <div className="kpi-l">PnL Latent <span className="kpi-source-tag">journal</span></div>
          <div className={`kpi-v ${cc(sPnlL)}`}>{fmtS(sPnlL)}<span className="kpi-unit">USDT</span></div>
          {pctPnlL !== null && (
            <div className={`kpi-pct ${cc(sPnlL)}`}>{sPnlL >= 0 ? '+' : '−'}{fmt(Math.abs(pctPnlL), 1)} %</div>
          )}
          <div className="kpi-s">Positions ouvertes</div>
        </div>

        <div className={`kpi kpi-pnl kpi-total ${cc(sPnl)}`}>
          <div className="kpi-icon">{sPnl >= 0 ? '🚀' : '📉'}</div>
          <div className="kpi-l">PnL Total <span className="kpi-source-tag">journal</span></div>
          <div className={`kpi-v kpi-v-big ${cc(sPnl)}`}>{fmtS(sPnl)}<span className="kpi-unit">USDT</span></div>
          {pctPnl !== null && (
            <div className={`kpi-pct kpi-pct-big ${cc(sPnl)}`}>{sPnl >= 0 ? '+' : '−'}{fmt(Math.abs(pctPnl), 1)} %</div>
          )}
          <div className="kpi-s">Réalisé + Latent</div>
        </div>

        <div className="kpi">
          <div className="kpi-icon">📋</div>
          <div className="kpi-l">Ordres</div>
          <div className="kpi-v">{sTot}<span className="kpi-unit">total</span></div>
          <div className="kpi-s">{sExec} exec · {sCanc} annulés</div>
        </div>

        <div className="kpi">
          <div className="kpi-icon">🎯</div>
          <div className="kpi-l">Taux Exécution</div>
          <div className="kpi-v g">{fmt(ePct, 1)}<span className="kpi-unit">%</span></div>
          <div className="kpi-s">Exécutés / total</div>
        </div>

      </div>

      {/* ── Ligne 2 : KPIs live ── */}
      <div className="kpi-live-bar">
        <div className="kpi-live-header">
          <span className={`live-dot${pricesLoading ? ' live-dot-loading' : ''}`}></span>
          <span className="kpi-live-label">
            COURS TEMPS RÉEL — {sourceLabel}
          </span>
          <span className="kpi-live-update">
            {pricesLoading
              ? 'Mise à jour…'
              : pricesError
                ? pricesError
                : `Mis à jour à ${updateLabel}`
            }
          </span>
          {refreshPrices && (
            <button className="kpi-live-refresh" onClick={refreshPrices} title="Rafraîchir les prix">↺</button>
          )}
        </div>

        <div className="kpi-live-row">

          <div className={`kpi kpi-pnl kpi-live ${sPnlRL !== null ? cc(sPnlRL) : ''}`}>
            <div className="kpi-icon">{sPnlRL !== null ? (sPnlRL >= 0 ? '✅' : '❌') : '🔄'}</div>
            <div className="kpi-l">PnL Réalisé <span className="kpi-source-tag live">live</span></div>
            {sPnlRL !== null ? (
              <>
                <div className={`kpi-v ${cc(sPnlRL)}`}>{fmtS(sPnlRL)}<span className="kpi-unit">USDT</span></div>
                {pct(sPnlRL, sInv) !== null && (
                  <div className={`kpi-pct ${cc(sPnlRL)}`}>{sPnlRL >= 0 ? '+' : '−'}{fmt(Math.abs(pct(sPnlRL, sInv)), 1)} %</div>
                )}
              </>
            ) : (
              <div className="kpi-v kpi-v-pending">—</div>
            )}
            <div className="kpi-s">Basé sur cours actuel</div>
          </div>

          <div className={`kpi kpi-pnl kpi-live ${sPnlLL !== null ? cc(sPnlLL) : ''}`}>
            <div className="kpi-icon">{sPnlLL !== null ? (sPnlLL >= 0 ? '⏳' : '⚠️') : '🔄'}</div>
            <div className="kpi-l">PnL Latent <span className="kpi-source-tag live">live</span></div>
            {sPnlLL !== null ? (
              <>
                <div className={`kpi-v ${cc(sPnlLL)}`}>{fmtS(sPnlLL)}<span className="kpi-unit">USDT</span></div>
                {pct(sPnlLL, sInv) !== null && (
                  <div className={`kpi-pct ${cc(sPnlLL)}`}>{sPnlLL >= 0 ? '+' : '−'}{fmt(Math.abs(pct(sPnlLL, sInv)), 1)} %</div>
                )}
              </>
            ) : (
              <div className="kpi-v kpi-v-pending">—</div>
            )}
            <div className="kpi-s">Position × (cours live − PM)</div>
          </div>

          <div className={`kpi kpi-pnl kpi-total kpi-live ${sPnlTL !== null ? cc(sPnlTL) : ''}`}>
            <div className="kpi-icon">{sPnlTL !== null ? (sPnlTL >= 0 ? '🚀' : '📉') : '🔄'}</div>
            <div className="kpi-l">PnL Total <span className="kpi-source-tag live">live</span></div>
            {sPnlTL !== null ? (
              <>
                <div className={`kpi-v kpi-v-big ${cc(sPnlTL)}`}>{fmtS(sPnlTL)}<span className="kpi-unit">USDT</span></div>
                {pctPnlTL !== null && (
                  <div className={`kpi-pct kpi-pct-big ${cc(sPnlTL)}`}>{sPnlTL >= 0 ? '+' : '−'}{fmt(Math.abs(pctPnlTL), 1)} %</div>
                )}
              </>
            ) : (
              <div className="kpi-v kpi-v-big kpi-v-pending">—</div>
            )}
            <div className="kpi-s">Réalisé + Latent live</div>
          </div>

        </div>
      </div>
    </div>
  )
}
