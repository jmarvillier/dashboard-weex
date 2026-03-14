/**
 * PairCard.jsx — v2 (ticket #29)
 */
import { useState } from 'react'
import KpiBox from './KpiBox.jsx'
import KpiTooltip from './KpiTooltip.jsx'

// ── Formatage ────────────────────────────────────────────────────────────────
const fmt = (v, d = 2) =>
  isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtPrice = v => {
  if (isNaN(+v) || +v === 0) return '—'
  const n = +v
  return n < 1
    ? n.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtQty = v => {
  if (isNaN(+v)) return '—'
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
  if (v == null || isNaN(+v)) return null
  const n = +v
  const sign = n >= 0 ? '+' : '−'
  return `${sign} ${fmt(Math.abs(n), 2)}`
}

const colorOf = v => {
  if (v == null || isNaN(+v) || +v === 0) return 'neu'
  return +v > 0 ? 'pos' : 'neg'
}

// ── Composant ────────────────────────────────────────────────────────────────
export default function PairCard({ p, excluded, onToggle, index }) {
  const [openTooltip, setOpenTooltip] = useState(null)
  const isExcl = excluded.has(p.name)
  const sym    = p.name.split('/')[0]

  // Ferme tooltip au clic en dehors
  function handleCardClick() { setOpenTooltip(null) }

  // Données live vs journal
  const coursLive  = p.cours_live       != null ? p.cours_live       : null
  const pnlRL      = p.pnl_realise_live != null ? p.pnl_realise_live : p.pnl_realise
  const pnlLL      = p.pnl_latent_live  != null ? p.pnl_latent_live  : p.pnl_latent
  const pnlTL      = p.pnl_total_live   != null ? p.pnl_total_live   : p.pnl_total
  const hasLive    = p.cours_live != null

  const pnlRPct = hasLive ? (p.pnlRealizedPctLive ?? p.pnlRealizedPct) : p.pnlRealizedPct
  const pnlLPct = hasLive ? (p.pnlLatentPctLive   ?? p.pnlLatentPct)   : p.pnlLatentPct
  const pnlTPct = hasLive ? (p.pnlTotalPctLive    ?? p.pnlTotalPct)    : p.pnlTotalPct

  const currentPrice = coursLive ?? p.last_prix_achat ?? 0

  const dBreakevenPct = p.deltaVsBreakevenPct ?? null
  const dBreakeven    = p.deltaVsBreakeven    ?? null

  // Barre ordres
  const totalBar = (p.buyOrders || 0) + (p.sellOrders || 0)
  const buyBarW  = totalBar > 0 ? (p.buyOrders  / totalBar * 100) : 100
  const sellBarW = totalBar > 0 ? (p.sellOrders / totalBar * 100) : 0

  // ── Dépôts ─────────────────────────────────────────────────────────────────
  if (p.is_depot) {
    return (
      <div className={`pc${isExcl ? ' excluded' : ''}`} id={`pc-${p.name.replace(/\//g,'_')}`} style={{ animationDelay:`${index*0.08}s` }} onClick={handleCardClick}>
        <div className="pc-head">
          <div className="pc-head-left">
            <div className="pc-name">{p.name}</div>
            <div className="pc-sub">{p.nb_depot} dépôt{p.nb_depot > 1 ? 's' : ''}</div>
          </div>
          <div className="pc-head-right">
            <div className="pc-pnl-badge n">💰 {fmt(p.capital_depose)} USDT</div>
            <button className={`flag-btn${isExcl?' flagged':''}`} onClick={e=>{e.stopPropagation();onToggle(p.name)}}>{isExcl?'🚩':'🏳'}</button>
          </div>
        </div>
        <div className="pc-body">
          <div className="depot-body">
            <div className="depot-stat"><span className="depot-val o">{fmt(p.capital_depose)}</span><span className="depot-unit">USDT déposés</span></div>
            <div className="depot-stat"><span className="depot-val">{p.nb_depot}</span><span className="depot-unit">opération{p.nb_depot>1?'s':''}</span></div>
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
      onClick={handleCardClick}
    >
      {/* ═══ EN-TÊTE ═══ */}
      <div className="pc2-header">
        <div className="pc2-header-left">
          <div className="pc2-pair-name">{p.name}</div>
          <div className="pc2-price-row">
            {currentPrice > 0 && (
              <>
                <span className="pc2-current-price">{fmtPrice(currentPrice)} USDT</span>
                {hasLive && <span className="live-dot live-dot-sm" style={{marginLeft:6}}></span>}
                {dBreakevenPct != null && (
                  <span className={`pc2-delta-be ${colorOf(dBreakevenPct)}`}>
                    {fmtPct(dBreakevenPct)} vs breakeven
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="pc2-header-right">
          <div className={`pc2-pnl-badge pc2-badge-${colorOf(pnlTL)}`}>
            <span className="pc2-badge-usdt">{fmtDelta(pnlTL)} USDT</span>
            <span className="pc2-badge-pct">{fmtPct(pnlTPct)}</span>
          </div>
          <button className={`flag-btn${isExcl?' flagged':''}`} onClick={e=>{e.stopPropagation();onToggle(p.name)}}>{isExcl?'🚩':'🏳'}</button>
        </div>
      </div>

      {isExcl && <div className="pc2-excluded-banner">🚩 Paire exclue des calculs globaux</div>}

      {/* ═══ POSITION OUVERTE ═══ */}
      <div className="pc2-section">
        <div className="pc2-section-label">POSITION OUVERTE</div>

        {/* Groupe 1 — 2 colonnes */}
        <div className="pc2-grid-2">
          <KpiBox
            label="Position nette"
            value={`${fmtQty(p.netPosition || p.position)} ${sym}`}
            tooltipId={`${p.name}-netpos`}
            tooltipTitle="Position nette"
            tooltipDesc="Quantité crypto encore détenue."
            tooltipFormula="Σ achats − Σ ventes"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
          <KpiBox
            label="Montant investi"
            value={`${fmt(p.amountInvested || p.usdt_investi)} USDT`}
            tooltipId={`${p.name}-invested`}
            tooltipTitle="Montant investi"
            tooltipDesc="Somme de tous les achats exécutés."
            tooltipFormula="Σ (quantité × prix) sur tous les achats"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
        </div>

        <div className="pc2-sep" />

        {/* Groupe 2 — 3 colonnes */}
        <div className="pc2-grid-3">
          <KpiBox
            label="Moy. achat"
            value={p.avgBuyPrice > 0 ? fmtPrice(p.avgBuyPrice) : '—'}
            sublabel={`${p.buyOrdersCount || p.nb_achat} ordres`}
            tooltipId={`${p.name}-avgbuy`}
            tooltipTitle="Prix moyen d'achat"
            tooltipDesc="Moyenne pondérée de tous les achats exécutés."
            tooltipFormula="Σ (prix × qté) / Σ qté achetée"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
          <KpiBox
            label="Moy. vente"
            value={p.avgSellPrice != null && p.avgSellPrice > 0
              ? fmtPrice(p.avgSellPrice)
              : '—'}
            sublabel={p.avgSellPrice != null
              ? `${p.sellOrdersCount || p.nb_vente} ordres`
              : '0 ordres'}
            valueColor={p.avgSellPrice == null
              ? 'neu'
              : p.avgSellPrice > p.avgBuyPrice ? 'pos'
              : p.avgSellPrice < p.avgBuyPrice ? 'neg'
              : 'neu'}
            tooltipId={`${p.name}-avgsell`}
            tooltipTitle="Prix moyen de vente"
            tooltipDesc="Moyenne pondérée de toutes les ventes exécutées."
            tooltipFormula="Σ (prix × qté) / Σ qté vendue"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
          <KpiBox
            label="Breakeven"
            value={p.breakeven > 0 ? fmtPrice(p.breakeven) : '—'}
            sublabel="seuil zéro"
            tooltipId={`${p.name}-breakeven`}
            tooltipTitle="Breakeven"
            tooltipDesc="Prix auquel la position est à l'équilibre."
            tooltipFormula="(Investi − PnL réalisé) / Position nette"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
        </div>

        <div className="pc2-sep" />

        {/* Groupe 3 — prix actuel pleine largeur */}
        <div className="kpi-box kpi-box-full pc2-current-box">
          <div className="kpi-box-label">
            Prix actuel
            <KpiTooltip
              id={`${p.name}-currentprice`}
              title="Prix actuel"
              description="Écarts entre le cours actuel et vos prix de référence."
              formula={"vs moy. achat : Prix actuel − Moy. achat\nvs moy. vente : Prix actuel − Moy. vente"}
              openId={openTooltip}
              setOpenId={setOpenTooltip}
            />
          </div>
          <div className="kpi-box-value">{currentPrice > 0 ? `${fmtPrice(currentPrice)} USDT` : '—'}</div>
          <div className="pc2-current-sep" />
          <div className="pc2-delta-row">
            <span className="pc2-delta-label">vs moy. achat</span>
            <span className={`pc2-delta-val pc2-delta-${colorOf(p.deltaVsAvgBuy)}`}>
              {p.deltaVsAvgBuy != null
                ? `${fmtDelta(p.deltaVsAvgBuy)} USDT (${fmtPct(p.deltaVsAvgBuyPct)})`
                : hasLive ? `${fmtDelta(currentPrice - p.avgBuyPrice)} USDT (${fmtPct((currentPrice - p.avgBuyPrice) / p.avgBuyPrice * 100)})` : '—'
              }
            </span>
          </div>
          <div className="pc2-delta-row">
            <span className="pc2-delta-label">vs moy. vente</span>
            <span className={`pc2-delta-val pc2-delta-${colorOf(p.deltaVsAvgSell)}`}>
              {p.avgSellPrice != null && p.deltaVsAvgSell != null
                ? `${fmtDelta(p.deltaVsAvgSell)} USDT (${fmtPct(p.deltaVsAvgSellPct)})`
                : <span className="pc2-delta-na">— (pas de vente)</span>
              }
            </span>
          </div>
        </div>
      </div>

      {/* ═══ PNL ═══ */}
      <div className="pc2-section">
        <div className="pc2-section-label">
          <span className="live-dot live-dot-sm"></span>
          PNL (COURS ACTUEL)
        </div>
        <div className="pc2-grid-3">
          <KpiBox
            label="Réalisé"
            value={`${fmtDelta(pnlRL)} USDT`}
            sublabel={fmtPct(pnlRPct)}
            valueColor={colorOf(pnlRL)}
            tooltipId={`${p.name}-pnlr`}
            tooltipTitle="PnL réalisé"
            tooltipDesc="Gains/pertes sur ventes clôturées."
            tooltipFormula="Σ (prix vente − breakeven) × qté vendue"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
          <KpiBox
            label="Latent"
            value={`${fmtDelta(pnlLL)} USDT`}
            sublabel={fmtPct(pnlLPct)}
            valueColor={colorOf(pnlLL)}
            tooltipId={`${p.name}-pnll`}
            tooltipTitle="PnL latent"
            tooltipDesc="Gain/perte non réalisé sur la position ouverte."
            tooltipFormula="(Prix actuel − Breakeven) × Position nette"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
          <KpiBox
            label="Total"
            value={`${fmtDelta(pnlTL)} USDT`}
            sublabel={fmtPct(pnlTPct)}
            valueColor={colorOf(pnlTL)}
            tooltipId={`${p.name}-pnlt`}
            tooltipTitle="PnL total"
            tooltipDesc="Vision complète de la performance."
            tooltipFormula="PnL réalisé + PnL latent"
            openId={openTooltip}
            setOpenId={setOpenTooltip}
          />
        </div>
      </div>

      {/* ═══ ORDRES ═══ */}
      <div className="pc2-section pc2-section-orders">
        <div className="pc2-section-label">ORDRES</div>
        <div className="pc2-chips">
          <span className="pc2-chip"><b>{p.totalOrders || p.nb_total}</b> au total</span>
          <span className="pc2-chip"><b>{p.executedOrders || p.nb_exec}</b> exécutés</span>
          <span className="pc2-chip"><b>{p.cancelledOrders || p.nb_annule}</b> annulés</span>
        </div>
        <div className="pc2-bar-labels">
          <span>{p.buyOrders || p.nb_achat} achats</span>
          <span>{p.sellOrders || p.nb_vente} ventes</span>
        </div>
        <div className="pc2-bar-track">
          <div className="pc2-bar-buy"  style={{ width:`${buyBarW}%` }} />
          <div className="pc2-bar-sell" style={{ width:`${sellBarW}%` }} />
        </div>
      </div>
    </div>
  )
}
