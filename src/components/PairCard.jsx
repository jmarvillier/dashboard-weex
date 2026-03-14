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
  const id     = p.name // raccourci

  const hasLive = p.cours_live != null
  const price   = p.cours_live ?? p.last_prix_achat ?? 0

  // PnL — live si dispo, sinon journal
  const pnlR    = hasLive ? (p.pnl_realise_live ?? p.pnl_realise) : p.pnl_realise
  const pnlL    = hasLive ? (p.pnl_latent_live  ?? p.pnl_latent)  : p.pnl_latent
  const pnlT    = hasLive ? (p.pnl_total_live   ?? p.pnl_total)   : p.pnl_total
  const pnlRPct = hasLive ? (p.pnlRealizedPctLive ?? p.pnlRealizedPct) : p.pnlRealizedPct
  const pnlLPct = hasLive ? (p.pnlLatentPctLive   ?? p.pnlLatentPct)   : p.pnlLatentPct
  const pnlTPct = hasLive ? (p.pnlTotalPctLive    ?? p.pnlTotalPct)    : p.pnlTotalPct

  // Deltas
  const dBuy    = hasLive ? p.deltaVsAvgBuy    : (p.avgBuyPrice > 0 && price > 0 ? price - p.avgBuyPrice : null)
  const dBuyPct = hasLive ? p.deltaVsAvgBuyPct : (dBuy != null ? dBuy / p.avgBuyPrice * 100 : null)
  const dSell    = p.deltaVsAvgSell    ?? null
  const dSellPct = p.deltaVsAvgSellPct ?? null
  const dBePct   = p.deltaVsBreakevenPct ?? null

  // Barre ordres
  const tot    = (p.buyOrders || 0) + (p.sellOrders || 0)
  const buyW   = tot > 0 ? p.buyOrders  / tot * 100 : 100
  const sellW  = tot > 0 ? p.sellOrders / tot * 100 : 0

  // ── Dépôt ────────────────────────────────────────────────────────────────
  if (p.is_depot) {
    return (
      <div className={`pc2${isExcl ? ' excluded' : ''}`}
           id={`pc-${id.replace(/\//g,'_')}`}
           style={{ animationDelay:`${index*.08}s` }}>
        <div className="pc2-head">
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
            <button className={`pc2-flag${isExcl?' on':''}`} onClick={e=>{e.stopPropagation();onToggle(p.name)}}>
              {isExcl?'🚩':'🏳'}
            </button>
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
        <div className="pc2-head-left">
          <div className="pc2-name">{p.name}</div>
          <div className="pc2-sub">
            {price > 0 && <span className="pc2-price">{fmtPrice(price)} USDT</span>}
            {hasLive   && <span className="live-dot" style={{width:6,height:6,flexShrink:0}}></span>}
            {dBePct != null && (
              <span className={`pc2-be ${cc(dBePct)}`}>{fmtPct(dBePct)} vs breakeven</span>
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

      {isExcl && <div className="pc2-excl">🚩 Paire exclue des calculs globaux</div>}

      {/* ── POSITION OUVERTE ── */}
      <div className="pc2-section">
        <div className="pc2-slabel">POSITION OUVERTE</div>

        {/* Groupe 1 : position + investi */}
        <div className="pc2-g2">
          <KpiBox label="Position nette" value={`${fmtQty(p.netPosition ?? p.position)} ${sym}`}
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

        {/* Groupe 2 : moy. achat / moy. vente / breakeven */}
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
            sublabel={p.avgSellPrice != null ? `${p.sellOrdersCount ?? p.nb_vente} ordres` : '0 ordres'}
            valueColor={p.avgSellPrice == null ? 'neu' : p.avgSellPrice > p.avgBuyPrice ? 'pos' : p.avgSellPrice < p.avgBuyPrice ? 'neg' : 'neu'}
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

        <div className="pc2-sep" />

        {/* Groupe 3 : prix actuel + deltas */}
        <div className="pc2-prix-box">
          <div className="kb-label">
            Prix actuel
            <KpiTooltip id={`${id}-px`} title="Prix actuel"
              description="Écarts entre le cours actuel et vos prix de référence."
              formula={"vs moy. achat : Prix − Moy. achat\nvs moy. vente : Prix − Moy. vente"}
              openId={tip} setOpenId={setTip} />
          </div>
          <div className="pc2-prix-val">{price > 0 ? `${fmtPrice(price)} USDT` : '—'}</div>
          <div className="pc2-prix-sep" />
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
      </div>

      {/* ── PNL ── */}
      <div className="pc2-section">
        <div className="pc2-slabel">
          <span className="live-dot" style={{width:6,height:6,flexShrink:0}}></span>
          PNL (COURS ACTUEL)
        </div>
        <div className="pc2-g3">
          <KpiBox label="Réalisé" value={`${fmtSign(pnlR)} USDT`} sublabel={fmtPct(pnlRPct) ?? '0,0 %'}
            valueColor={cc(pnlR)}
            tooltipId={`${id}-pr`} tooltipTitle="PnL réalisé"
            tooltipDesc="Gains/pertes sur ventes clôturées."
            tooltipFormula="Recettes − Coût au prix moy."
            openId={tip} setOpenId={setTip} />
          <KpiBox label="Latent" value={`${fmtSign(pnlL)} USDT`} sublabel={fmtPct(pnlLPct) ?? '0,0 %'}
            valueColor={cc(pnlL)}
            tooltipId={`${id}-pl`} tooltipTitle="PnL latent"
            tooltipDesc="Gain/perte non réalisé sur position ouverte."
            tooltipFormula="(Prix − Breakeven) × Position"
            openId={tip} setOpenId={setTip} />
          <KpiBox label="Total" value={`${fmtSign(pnlT)} USDT`} sublabel={fmtPct(pnlTPct) ?? '0,0 %'}
            valueColor={cc(pnlT)}
            tooltipId={`${id}-pt`} tooltipTitle="PnL total"
            tooltipDesc="Vision complète de la performance."
            tooltipFormula="PnL réalisé + PnL latent"
            openId={tip} setOpenId={setTip} />
        </div>
      </div>

      {/* ── ORDRES ── */}
      <div className="pc2-section">
        <div className="pc2-slabel">ORDRES</div>
        <div className="pc2-chips">
          <span className="pc2-chip"><b>{p.totalOrders ?? p.nb_total}</b> au total</span>
          <span className="pc2-chip"><b>{p.executedOrders ?? p.nb_exec}</b> exécutés</span>
          <span className="pc2-chip"><b>{p.cancelledOrders ?? p.nb_annule}</b> annulés</span>
        </div>
        <div className="pc2-bar-lbls">
          <span>{p.buyOrders ?? p.nb_achat} achats</span>
          <span>{p.sellOrders ?? p.nb_vente} ventes</span>
        </div>
        <div className="pc2-bar">
          <div className="pc2-bar-buy"  style={{width:`${buyW}%`}} />
          <div className="pc2-bar-sell" style={{width:`${sellW}%`}} />
        </div>
      </div>

    </div>
  )
}
