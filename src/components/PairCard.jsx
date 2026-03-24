import { useState } from 'react'
import KpiBox from './KpiBox.jsx'
import KpiTooltip from './KpiTooltip.jsx'

// ── Formatage ─────────────────────────────────────────────────────────────
const fmt = (v, d = 2) =>
  isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtPrice = v => {
  if (v == null || isNaN(+v) || +v === 0) return '—'
  const n = +v
  return n < 1
    ? n.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtQty = v => {
  if (v == null || isNaN(+v)) return '—'
  const n = +v
  if (n === 0) return '0'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 5 })
}

const fmtPct = v => {
  if (v == null || isNaN(+v)) return null
  const n = +v
  return (n >= 0 ? '+ ' : '− ') + fmt(Math.abs(n), 1) + ' %'
}

const fmtSign = v => {
  if (v == null || isNaN(+v)) return '—'
  const n = +v
  return (n >= 0 ? '+ ' : '− ') + fmt(Math.abs(n), 2)
}

const cc = v => {
  if (v == null || isNaN(+v) || +v === 0) return 'neu'
  return +v > 0 ? 'pos' : 'neg'
}

// ── Composant ─────────────────────────────────────────────────────────────
export default function PairCard({ p, excluded, onToggle, index }) {
  const [tip, setTip] = useState(null)
  const isExcl = excluded.has(p.name)
  const sym    = p.name.split('/')[0]
  const id     = p.name

  const hasLive = p.cours_live != null
  const price   = p.cours_live ?? p.last_prix_achat ?? 0

  const pnlR    = hasLive ? (p.pnl_realise_live ?? p.pnl_realise) : p.pnl_realise
  const pnlL    = hasLive ? (p.pnl_latent_live  ?? p.pnl_latent)  : p.pnl_latent
  const pnlT    = hasLive ? (p.pnl_total_live   ?? p.pnl_total)   : p.pnl_total
  const pnlRPct = hasLive ? (p.pnlRealizedPctLive ?? p.pnlRealizedPct) : p.pnlRealizedPct
  const pnlLPct = hasLive ? (p.pnlLatentPctLive   ?? p.pnlLatentPct)   : p.pnlLatentPct
  const pnlTPct = hasLive ? (p.pnlTotalPctLive    ?? p.pnlTotalPct)    : p.pnlTotalPct

  const dBuy     = hasLive ? p.deltaVsAvgBuy     : (p.avgBuyPrice > 0 && price > 0 ? price - p.avgBuyPrice : null)
  const dBuyPct  = hasLive ? p.deltaVsAvgBuyPct  : (dBuy != null ? dBuy / p.avgBuyPrice * 100 : null)
  const dSell    = p.deltaVsAvgSell    ?? null
  const dSellPct = p.deltaVsAvgSellPct ?? null
  const dBePct   = p.deltaVsBreakevenPct ?? null

  const tot          = (p.buyOrders || 0) + (p.sellOrders || 0)
  const buyW         = tot > 0 ? p.buyOrders  / tot * 100 : 100
  const sellW        = tot > 0 ? p.sellOrders / tot * 100 : 0
  const volBuy       = p.usdt_investi || 0
  const volSell      = p.usdt_recu    || 0
  const volTot       = volBuy + volSell
  const volumeBuyW   = volTot > 0 ? volBuy  / volTot * 100 : 100
  const volumeSellW  = volTot > 0 ? volSell / volTot * 100 : 0

  // ── Dépôt ────────────────────────────────────────────────────────────────
  if (p.is_depot) {
    return (
      <div className={`pc2${isExcl ? ' excluded' : ''}`}
           id={`pc-${id.replace(/\//g,'_')}`}
           style={{ animationDelay:`${index*.08}s` }}>
        <div className="pc2-head">
          <div className="pc2-head-top">
            <div className="pc2-head-left">
              <div className="pc2-name">{p.name}</div>
              <div className="pc2-sub">
                <span className="pc2-price">{p.nb_depot} dépôt{p.nb_depot > 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="pc2-head-right">
              <div className="pc2-badge neu">
                <span className="pc2-badge-val">💰 {fmt(p.capital_depose)} USDT</span>
              </div>
              <button className={`pc2-flag${isExcl?' on':''}`}
                      onClick={e=>{e.stopPropagation();onToggle(p.name)}}>
                {isExcl?'🚩':'🏳'}
              </button>
            </div>
          </div>
        </div>
        <div className="pc2-section">
          <div className="pc2-depot">
            <div className="pc2-depot-stat">
              <span className="pc2-depot-val gold">{fmt(p.capital_depose)}</span>
              <span className="pc2-depot-unit">USDT déposés</span>
            </div>
            <div className="pc2-depot-stat">
              <span className="pc2-depot-val">{p.nb_depot}</span>
              <span className="pc2-depot-unit">opération{p.nb_depot>1?'s':''}</span>
            </div>
          </div>
          <div className="pc2-depot-note">Apport de capital — exclu des calculs PnL</div>
        </div>
      </div>
    )
  }

  // ── Carte trading ─────────────────────────────────────────────────────────
  return (
    <div
      className={`pc2${isExcl ? ' excluded' : ''}`}
      id={`pc-${id.replace(/\//g,'_')}`}
      style={{ animationDelay:`${index*.08}s` }}
      onClick={() => setTip(null)}
    >
      {/* ── EN-TÊTE ── */}
      <div className="pc2-head">

        {/* Rangée 1 : nom + badge + flag */}
        <div className="pc2-head-top">
          <div className="pc2-head-left">
            <div className="pc2-name">{p.name}</div>
            <div className="pc2-sub">
                {price > 0 && <span className="pc2-price">{fmtPrice(price)} USDT</span>}
                {hasLive   && <span className="live-dot" style={{width:6,height:6,flexShrink:0}}></span>}
                {dBePct != null && (
                  <span className={`pc2-be ${cc(dBePct)}`}>{fmtPct(dBePct)} vs breakeven</span>
                )}
                {hasLive && p.priceSource && (
                  <span className="pc2-price-src">{p.priceSource}</span>
                )}
              </div>
          </div>
          <div className="pc2-head-right">
            <div className={`pc2-badge ${cc(pnlT)}`}>
              <span className="pc2-badge-val">{fmtSign(pnlT)} USDT</span>
              {fmtPct(pnlTPct) && <span className="pc2-badge-pct">{fmtPct(pnlTPct)}</span>}
            </div>
            <button className={`pc2-flag${isExcl?' on':''}`}
                    onClick={e=>{e.stopPropagation();onToggle(p.name)}}>
              {isExcl?'🚩':'🏳'}
            </button>
          </div>
        </div>

        {/* Rangée 2 : deltas pleine largeur */}
        {(dBuy != null || p.avgSellPrice != null) && (
          <div className="pc2-deltas">
            <div className="pc2-delta">
              <span className="pc2-delta-lbl">vs moy. achat</span>
              <span className={`pc2-delta-val ${cc(dBuy)}`}>
                {dBuy != null ? `${fmtSign(dBuy)} USDT (${fmtPct(dBuyPct)})` : '—'}
              </span>
            </div>
            <div className="pc2-delta">
              <span className="pc2-delta-lbl">vs moy. vente</span>
              {dSell != null
                ? <span className={`pc2-delta-val ${cc(dSell)}`}>{fmtSign(dSell)} USDT ({fmtPct(dSellPct)})</span>
                : <span className="pc2-delta-val neu">— (pas de vente)</span>
              }
            </div>
          </div>
        )}
      </div>

      {isExcl && <div className="pc2-excl">🚩 Paire exclue des calculs globaux</div>}

      {/* ── POSITION OUVERTE ── */}
      <div className="pc2-section">
        <div className="pc2-slabel">POSITION OUVERTE</div>

        <div className="pc2-g2">
          <KpiBox label="Position nette" value={`${fmtQty(p.netPosition ?? p.position)} ${sym}`}
            sublabel={price > 0 && (p.netPosition ?? p.position) > 0
              ? `≈ ${fmt((p.netPosition ?? p.position) * price, 2)} USDT`
              : undefined}
            tooltipId={`${id}-np`} tooltipTitle="Position nette"
            tooltipDesc="Quantité crypto encore détenue."
            tooltipFormula="Σ achats − Σ ventes"
            openId={tip} setOpenId={setTip} />
          <KpiBox label="Montant investi" value={`${fmt(p.amountInvested ?? p.usdt_investi)} USDT`}
            tooltipId={`${id}-inv`} tooltipTitle="Montant investi"
            tooltipDesc="Somme de tous les achats exécutés."
            tooltipFormula="Σ (quantité × prix)"
            openId={tip} setOpenId={setTip} />
        </div>

        <div className="pc2-sep" />

        <div className="pc2-g3">
          <KpiBox label="Moy. achat"
            value={p.avgBuyPrice > 0 ? fmtPrice(p.avgBuyPrice) : '—'}
            sublabel={`${p.buyOrdersCount ?? p.nb_achat} ordres`}
            tooltipId={`${id}-ab`} tooltipTitle="Prix moyen d'achat"
            tooltipDesc="Moyenne pondérée de tous les achats."
            tooltipFormula="Σ (prix × qté) / Σ qté"
            openId={tip} setOpenId={setTip} />
          <KpiBox label="Moy. vente"
            value={p.avgSellPrice != null ? fmtPrice(p.avgSellPrice) : '—'}
            sublabel={p.avgSellPrice != null
              ? `${p.sellOrdersCount ?? p.nb_vente} ordres`
              : '0 ordres'}
            valueColor={
              p.avgSellPrice == null ? 'neu'
              : p.avgSellPrice > p.avgBuyPrice ? 'pos'
              : p.avgSellPrice < p.avgBuyPrice ? 'neg'
              : 'neu'
            }
            tooltipId={`${id}-av`} tooltipTitle="Prix moyen de vente"
            tooltipDesc="Moyenne pondérée de toutes les ventes."
            tooltipFormula="Σ (prix × qté) / Σ qté vendue"
            openId={tip} setOpenId={setTip} />
          <KpiBox label="Breakeven"
            value={p.breakeven > 0 ? fmtPrice(p.breakeven) : '—'}
            sublabel="seuil zéro"
            tooltipId={`${id}-be`} tooltipTitle="Breakeven"
            tooltipDesc="Prix d'équilibre de la position."
            tooltipFormula="Investi en cours / Position nette"
            openId={tip} setOpenId={setTip} />
        </div>
      </div>

      {/* ── PNL ── */}
      <div className="pc2-section">
        <div className="pc2-slabel">
          <span className="live-dot" style={{width:6,height:6,flexShrink:0}}></span>
          PNL (COURS ACTUEL)
        </div>
        <div className="pc2-g3">
          <KpiBox label="Réalisé"
            value={`${fmtSign(pnlR)} USDT`}
            sublabel={fmtPct(pnlRPct) ?? '0,0 %'}
            valueColor={cc(pnlR)}
            tooltipId={`${id}-pr`} tooltipTitle="PnL réalisé"
            tooltipDesc="Gains/pertes sur ventes clôturées."
            tooltipFormula="Recettes − Coût au prix moy."
            openId={tip} setOpenId={setTip} />
          <KpiBox label="Latent"
            value={`${fmtSign(pnlL)} USDT`}
            sublabel={fmtPct(pnlLPct) ?? '0,0 %'}
            valueColor={cc(pnlL)}
            tooltipId={`${id}-pl`} tooltipTitle="PnL latent"
            tooltipDesc="Gain/perte non réalisé sur position ouverte."
            tooltipFormula="(Prix − Breakeven) × Position"
            openId={tip} setOpenId={setTip} />
          <KpiBox label="Total"
            value={`${fmtSign(pnlT)} USDT`}
            sublabel={fmtPct(pnlTPct) ?? '0,0 %'}
            valueColor={cc(pnlT)}
            tooltipId={`${id}-pt`} tooltipTitle="PnL total"
            tooltipDesc="Vision complète de la performance."
            tooltipFormula="PnL réalisé + PnL latent"
            openId={tip} setOpenId={setTip} />
        </div>
      </div>

      {/* ── ORDRES — Achats vs Ventes ── */}
      <div className="pc2-section">
        <div className="pc2-slabel">ACHATS VS VENTES</div>

        {/* Barre 1 : nombre d'ordres */}
        <div className="v5-bar-row">
          <div className="v5-bar-sublabel">Nombre d'ordres</div>
          <div className="v5-bar-labels">
            <span className="v5-bar-side v5-bar-side--buy">
              <strong>{p.buyOrders ?? p.nb_achat}</strong>
              <strong>{(p.buyOrders ?? p.nb_achat) > 1 ? 'achats' : 'achat'}</strong>
              <span className="v5-bar-pct v5-bar-pct--pill">{buyW > 0 ? Math.round(buyW) + ' %' : '—'}</span>
            </span>
            <span className="v5-bar-side v5-bar-side--sell">
              <span className="v5-bar-pct v5-bar-pct--pill">{sellW > 0 ? Math.round(sellW) + ' %' : '—'}</span>
              <strong>{(p.sellOrders ?? p.nb_vente) > 1 ? 'ventes' : 'vente'}</strong>
              <strong>{p.sellOrders ?? p.nb_vente}</strong>
            </span>
          </div>
          <div className="v5-bar-track">
            <div className="v5-bar-buy"  style={{width: buyW  + '%'}} />
            <div className="v5-bar-sell" style={{width: sellW + '%'}} />
          </div>
        </div>

        {/* Barre 2 : volume USDT */}
        <div className="v5-bar-row v5-bar-row--volume">
          <div className="v5-bar-sublabel">Volume USDT</div>
          <div className="v5-bar-labels">
            <span className="v5-bar-side v5-bar-side--buy">
              <strong>{Math.round(volBuy)}</strong>
              <strong className="v5-bar-unit-bold">USDT</strong>
              <span className="v5-bar-pct v5-bar-pct--pill">{volumeBuyW > 0 ? Math.round(volumeBuyW) + ' %' : '—'}</span>
            </span>
            <span className="v5-bar-side v5-bar-side--sell">
              <span className="v5-bar-pct v5-bar-pct--pill">{volumeSellW > 0 ? Math.round(volumeSellW) + ' %' : '—'}</span>
              <strong className="v5-bar-unit-bold">USDT</strong>
              <strong>{Math.round(volSell)}</strong>
            </span>
          </div>
          <div className="v5-bar-track">
            <div className="v5-bar-buy"  style={{width: volumeBuyW  + '%'}} />
            <div className="v5-bar-sell" style={{width: volumeSellW + '%'}} />
          </div>
        </div>
      </div>

    </div>
  )
}
