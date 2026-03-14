/**
 * PairCard.jsx — v2 aérée
 */
import { useState } from 'react'
import KpiBox from './KpiBox.jsx'
import KpiTooltip from './KpiTooltip.jsx'

// ── Formatage ────────────────────────────────────────────────────────────────
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
  const sign = n >= 0 ? '+' : '−'
  return `${sign} ${fmt(Math.abs(n), 1)} %`
}

const fmtDelta = v => {
  if (v == null || isNaN(+v)) return '—'
  const n = +v
  const sign = n >= 0 ? '+' : '−'
  return `${sign} ${fmt(Math.abs(n), 2)}`
}

const colorOf = v => {
  if (v == null || isNaN(+v) || +v === 0) return 'neu'
  return +v > 0 ? 'pos' : 'neg'
}

export default function PairCard({ p, excluded, onToggle, index }) {
  const [openTooltip, setOpenTooltip] = useState(null)
  const isExcl = excluded.has(p.name)
  const sym    = p.name.split('/')[0]

  const coursLive = p.cours_live != null ? p.cours_live : null
  const hasLive   = coursLive != null

  const pnlRL   = hasLive ? (p.pnl_realise_live ?? p.pnl_realise) : p.pnl_realise
  const pnlLL   = hasLive ? (p.pnl_latent_live  ?? p.pnl_latent)  : p.pnl_latent
  const pnlTL   = hasLive ? (p.pnl_total_live   ?? p.pnl_total)   : p.pnl_total
  const pnlRPct = hasLive ? (p.pnlRealizedPctLive ?? p.pnlRealizedPct) : p.pnlRealizedPct
  const pnlLPct = hasLive ? (p.pnlLatentPctLive   ?? p.pnlLatentPct)   : p.pnlLatentPct
  const pnlTPct = hasLive ? (p.pnlTotalPctLive    ?? p.pnlTotalPct)    : p.pnlTotalPct

  const currentPrice = coursLive ?? p.last_prix_achat ?? 0

  const dAvgBuy     = hasLive ? p.deltaVsAvgBuy    : (p.avgBuyPrice > 0 && currentPrice > 0 ? currentPrice - p.avgBuyPrice : null)
  const dAvgBuyPct  = hasLive ? p.deltaVsAvgBuyPct : (p.avgBuyPrice > 0 && currentPrice > 0 ? dAvgBuy / p.avgBuyPrice * 100 : null)
  const dAvgSell    = hasLive ? p.deltaVsAvgSell    : null
  const dAvgSellPct = hasLive ? p.deltaVsAvgSellPct : null
  const dBePct      = hasLive ? p.deltaVsBreakevenPct : null

  const totalBar = (p.buyOrders || 0) + (p.sellOrders || 0)
  const buyBarW  = totalBar > 0 ? (p.buyOrders  / totalBar * 100) : 100
  const sellBarW = totalBar > 0 ? (p.sellOrders / totalBar * 100) : 0

  // ── Dépôt ──────────────────────────────────────────────────────────────────
  if (p.is_depot) {
    return (
      <div className={`pc${isExcl ? ' excluded' : ''}`}
           id={`pc-${p.name.replace(/\//g,'_')}`}
           style={{ animationDelay:`${index*0.08}s` }}>
        <div className="pc2-header">
          <div className="pc2-header-left">
            <div className="pc2-pair-name">{p.name}</div>
            <div className="pc2-price-row" style={{color:'var(--muted)',fontSize:'.6rem'}}>
              {p.nb_depot} dépôt{p.nb_depot > 1 ? 's' : ''}
            </div>
          </div>
          <div className="pc2-header-right">
            <div className="pc2-pnl-badge pc2-badge-neu">
              <span className="pc2-badge-usdt">💰 {fmt(p.capital_depose)} USDT</span>
            </div>
            <button className={`flag-btn${isExcl?' flagged':''}`}
                    onClick={e=>{e.stopPropagation();onToggle(p.name)}}>
              {isExcl?'🚩':'🏳'}
            </button>
          </div>
        </div>
        <div className="pc2-body">
          <div className="pc2-section pc2-section-full">
            <div className="depot-body">
              <div className="depot-stat">
                <span className="depot-val o">{fmt(p.capital_depose)}</span>
                <span className="depot-unit">USDT déposés</span>
              </div>
              <div className="depot-stat">
                <span className="depot-val">{p.nb_depot}</span>
                <span className="depot-unit">opération{p.nb_depot>1?'s':''}</span>
              </div>
            </div>
            <div className="depot-note">Apport de capital — exclu des calculs PnL</div>
          </div>
        </div>
      </div>
    )
  }

  // ── Carte principale ───────────────────────────────────────────────────────
  return (
    <div
      className={`pc pc-v2${isExcl ? ' excluded' : ''}`}
      id={`pc-${p.name.replace(/\//g,'_')}`}
      style={{ animationDelay:`${index*0.08}s` }}
      onClick={() => setOpenTooltip(null)}
    >
      {/* ═══ EN-TÊTE ═══ */}
      <div className="pc2-header">
        <div className="pc2-header-left">
          <div className="pc2-pair-name">{p.name}</div>
          <div className="pc2-price-row">
            {currentPrice > 0 && (
              <span className="pc2-current-price">{fmtPrice(currentPrice)} USDT</span>
            )}
            {hasLive && <span className="live-dot live-dot-sm" style={{flexShrink:0}}></span>}
            {dBePct != null && (
              <span className={`pc2-delta-be ${colorOf(dBePct)}`}>
                {fmtPct(dBePct)} vs breakeven
              </span>
            )}
          </div>
        </div>
        <div className="pc2-header-right">
          <div className={`pc2-pnl-badge pc2-badge-${colorOf(pnlTL)}`}>
            <span className="pc2-badge-usdt">{fmtDelta(pnlTL)} USDT</span>
            {fmtPct(pnlTPct) && <span className="pc2-badge-pct">{fmtPct(pnlTPct)}</span>}
          </div>
          <button className={`flag-btn${isExcl?' flagged':''}`}
                  onClick={e=>{e.stopPropagation();onToggle(p.name)}}>
            {isExcl?'🚩':'🏳'}
          </button>
        </div>
      </div>

      {isExcl && <div className="pc2-excluded-banner">🚩 Paire exclue des calculs globaux</div>}

      {/* ═══ CORPS 2 colonnes ═══ */}
      <div className="pc2-body">

        {/* ── COL GAUCHE : Position ouverte ── */}
        <div className="pc2-section">
          <div className="pc2-section-label">POSITION OUVERTE</div>

          {/* Groupe 1 — ce qu'on détient */}
          <div className="pc2-grid-2">
            <KpiBox
              label="Position nette"
              value={`${fmtQty(p.netPosition ?? p.position)} ${sym}`}
              tooltipId={`${p.name}-netpos`}
              tooltipTitle="Position nette"
              tooltipDesc="Quantité crypto encore détenue."
              tooltipFormula="Σ achats − Σ ventes"
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
            <KpiBox
              label="Montant investi"
              value={`${fmt(p.amountInvested ?? p.usdt_investi)} USDT`}
              tooltipId={`${p.name}-invested`}
              tooltipTitle="Montant investi"
              tooltipDesc="Somme de tous les achats exécutés."
              tooltipFormula="Σ (quantité × prix)"
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
          </div>

          <div className="pc2-sep" />

          {/* Groupe 2 — prix de référence */}
          <div className="pc2-grid-3">
            <KpiBox
              label="Moy. achat"
              value={p.avgBuyPrice > 0 ? fmtPrice(p.avgBuyPrice) : '—'}
              sublabel={`${p.buyOrdersCount ?? p.nb_achat} ordres`}
              tooltipId={`${p.name}-avgbuy`}
              tooltipTitle="Prix moyen d'achat"
              tooltipDesc="Moyenne pondérée de tous les achats."
              tooltipFormula="Σ (prix × qté) / Σ qté"
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
            <KpiBox
              label="Moy. vente"
              value={p.avgSellPrice != null ? fmtPrice(p.avgSellPrice) : '—'}
              sublabel={p.avgSellPrice != null
                ? `${p.sellOrdersCount ?? p.nb_vente} ordres`
                : '0 ordres'}
              valueColor={p.avgSellPrice == null ? 'neu'
                : p.avgSellPrice > p.avgBuyPrice ? 'pos'
                : p.avgSellPrice < p.avgBuyPrice ? 'neg'
                : 'neu'}
              tooltipId={`${p.name}-avgsell`}
              tooltipTitle="Prix moyen de vente"
              tooltipDesc="Moyenne pondérée de toutes les ventes."
              tooltipFormula="Σ (prix × qté) / Σ qté vendue"
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
            <KpiBox
              label="Breakeven"
              value={p.breakeven > 0 ? fmtPrice(p.breakeven) : '—'}
              sublabel="seuil zéro"
              tooltipId={`${p.name}-breakeven`}
              tooltipTitle="Breakeven"
              tooltipDesc="Prix d'équilibre de la position."
              tooltipFormula="Investi en cours / Position nette"
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
          </div>

          <div className="pc2-sep" />

          {/* Groupe 3 — prix actuel + deltas */}
          <div className="kpi-box kpi-box-full">
            <div className="kpi-box-label">
              Prix actuel
              <KpiTooltip
                id={`${p.name}-currentprice`}
                title="Prix actuel"
                description="Écarts entre le cours et vos références."
                formula={"vs moy. achat : Prix − Moy. achat\nvs moy. vente : Prix − Moy. vente"}
                openId={openTooltip} setOpenId={setOpenTooltip}
              />
            </div>
            <div className="kpi-box-value">
              {currentPrice > 0 ? `${fmtPrice(currentPrice)} USDT` : '—'}
            </div>
            <div className="pc2-current-sep" />
            <div className="pc2-delta-row">
              <span className="pc2-delta-label">vs moy. achat</span>
              <span className={`pc2-delta-val pc2-delta-${colorOf(dAvgBuy)}`}>
                {dAvgBuy != null ? `${fmtDelta(dAvgBuy)} USDT (${fmtPct(dAvgBuyPct)})` : '—'}
              </span>
            </div>
            <div className="pc2-delta-row">
              <span className="pc2-delta-label">vs moy. vente</span>
              {dAvgSell != null
                ? <span className={`pc2-delta-val pc2-delta-${colorOf(dAvgSell)}`}>{fmtDelta(dAvgSell)} USDT ({fmtPct(dAvgSellPct)})</span>
                : <span className="pc2-delta-na">— (pas de vente)</span>
              }
            </div>
          </div>
        </div>

        {/* ── COL DROITE : PnL + Ordres ── */}
        <div className="pc2-section">

          {/* PnL */}
          <div className="pc2-section-label">
            <span className="live-dot live-dot-sm"></span>
            PNL (COURS ACTUEL)
          </div>
          <div className="pc2-grid-3">
            <KpiBox
              label="Réalisé"
              value={`${fmtDelta(pnlRL)} USDT`}
              sublabel={fmtPct(pnlRPct) ?? '0,0 %'}
              valueColor={colorOf(pnlRL)}
              tooltipId={`${p.name}-pnlr`}
              tooltipTitle="PnL réalisé"
              tooltipDesc="Gains/pertes sur ventes clôturées."
              tooltipFormula="Recettes − Coût au prix moy."
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
            <KpiBox
              label="Latent"
              value={`${fmtDelta(pnlLL)} USDT`}
              sublabel={fmtPct(pnlLPct) ?? '0,0 %'}
              valueColor={colorOf(pnlLL)}
              tooltipId={`${p.name}-pnll`}
              tooltipTitle="PnL latent"
              tooltipDesc="Gain/perte non réalisé sur position ouverte."
              tooltipFormula="(Prix − Breakeven) × Position"
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
            <KpiBox
              label="Total"
              value={`${fmtDelta(pnlTL)} USDT`}
              sublabel={fmtPct(pnlTPct) ?? '0,0 %'}
              valueColor={colorOf(pnlTL)}
              tooltipId={`${p.name}-pnlt`}
              tooltipTitle="PnL total"
              tooltipDesc="Vision complète de la performance."
              tooltipFormula="PnL réalisé + PnL latent"
              openId={openTooltip} setOpenId={setOpenTooltip}
            />
          </div>

          {/* Ordres */}
          <div className="pc2-pnl-label-sep" />
          <div className="pc2-section-label">ORDRES</div>
          <div className="pc2-chips">
            <span className="pc2-chip"><b>{p.totalOrders ?? p.nb_total}</b> au total</span>
            <span className="pc2-chip"><b>{p.executedOrders ?? p.nb_exec}</b> exécutés</span>
            <span className="pc2-chip"><b>{p.cancelledOrders ?? p.nb_annule}</b> annulés</span>
          </div>
          <div className="pc2-bar-labels">
            <span>{p.buyOrders ?? p.nb_achat} achats</span>
            <span>{p.sellOrders ?? p.nb_vente} ventes</span>
          </div>
          <div className="pc2-bar-track">
            <div className="pc2-bar-buy"  style={{ width:`${buyBarW}%` }} />
            <div className="pc2-bar-sell" style={{ width:`${sellBarW}%` }} />
          </div>

        </div>
      </div>
    </div>
  )
}
