/**
 * KpiRow.jsx — Dashboard v5
 * ─────────────────────────────────────────────────────────────────────────────
 * Section Capital   → 3 KPIs : déposé · investi · disponible
 * Section Perf      → 3 KPIs : PnL réalisé · latent · total
 * Section Ordres    → Synthèse + barre achats/ventes
 *
 * Formules :
 *   Capital déposé  = Σ dépôts USDT (cumulatif)
 *   Capital investi = Σ achats USDT − Σ ventes USDT
 *   Capital dispo   = Capital déposé − Capital investi
 */

import { useState } from 'react'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmtN = (v, d = 2) =>
  isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtS = v => {
  const n = +v
  if (isNaN(n)) return '—'
  return (n >= 0 ? '+ ' : '− ') + fmtN(Math.abs(n))
}

const fmtPct = v => {
  const n = +v
  if (isNaN(n)) return '—'
  return (n >= 0 ? '+ ' : '− ') + fmtN(Math.abs(n), 1) + ' %'
}

const cc = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'neu')

/* ── Tooltip ─────────────────────────────────────────────────────────────── */
function Tooltip({ id, title, desc, formula, openId, setOpenId }) {
  const isOpen = openId === id
  return (
    <div className="v5-tooltip-wrap">
      <button
        className="v5-info-btn"
        aria-label={`Info ${title}`}
        onClick={e => { e.stopPropagation(); setOpenId(isOpen ? null : id) }}
      >
        i
      </button>
      {isOpen && (
        <div className="v5-tooltip">
          <strong>{title}</strong>
          <span>{desc}</span>
          {formula && <code>{formula}</code>}
        </div>
      )}
    </div>
  )
}

/* ── KPI Card ────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, unit = 'USDT', sub, subClass, tipId, tipTitle, tipDesc, tipFormula, openId, setOpenId, borderColor, className = '' }) {
  return (
    <div className={`v5-kpi${className ? ' ' + className : ''}`} style={borderColor ? { borderColor } : undefined}>
      <div className="v5-kpi-label">
        <span>{label}</span>
        {tipId && (
          <Tooltip
            id={tipId}
            title={tipTitle}
            desc={tipDesc}
            formula={tipFormula}
            openId={openId}
            setOpenId={setOpenId}
          />
        )}
      </div>
      <div className="v5-kpi-val">
        {value} <span className="v5-kpi-unit">{unit}</span>
      </div>
      {sub && <div className={`v5-kpi-sub${subClass ? ' ' + subClass : ''}`}>{sub}</div>}
    </div>
  )
}

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function KpiRow({
  // Nouvelle signature v5
  data,
  pricesLoading,
  pricesError,
  lastPriceUpdate,
  refreshPrices,

  // Ancienne signature (fallback si data absent)
  pairList,
  excluded,
}) {
  const [openTip, setOpenTip] = useState(null)

  // ── Mode fallback (ancienne API sans data agrégée) ────────────────────────
  let d = data
  if (!d && pairList) {
    const trading = pairList.filter(p => !excluded?.has(p.name) && !p.is_depot)
    const depots  = pairList.filter(p => p.is_depot)
    const sDepose  = depots.reduce((s, p) => s + (p.capital_depose || 0), 0)
    // Capital investi = achats − ventes
    const sAchete  = trading.reduce((s, p) => s + (p.usdt_investi || 0), 0)
    const sVendu   = trading.reduce((s, p) => s + (p.usdt_recu    || 0), 0)
    const sInvesti = sAchete - sVendu
    const sPnlR    = trading.reduce((s, p) => s + (p.pnl_realise_live ?? p.pnl_realise ?? 0), 0)
    const sPnlL    = trading.reduce((s, p) => s + (p.pnl_latent_live  ?? p.pnl_latent  ?? 0), 0)
    const sTot     = pairList.reduce((s, p) => s + (p.nb_total  || 0), 0)
    const sExec    = pairList.reduce((s, p) => s + (p.nb_exec   || 0), 0)
    const sCanc    = pairList.reduce((s, p) => s + (p.nb_annule || 0), 0)
    const sAchat   = pairList.reduce((s, p) => s + (p.nb_achat  || 0), 0)
    const sVente   = pairList.reduce((s, p) => s + (p.nb_vente  || 0), 0)
    const bw       = sAchat + sVente > 0 ? (sAchat / (sAchat + sVente)) * 100 : 0
    d = {
      capitalDepose:   sDepose,
      capitalInvesti:  sInvesti,
      capitalDispo:    sDepose - sInvesti,
      capitalDispoPct: sDepose > 0 ? ((sDepose - sInvesti) / sDepose) * 100 : 0,
      pnlRealise:     sPnlR,
      pnlRealisePct:  sInvesti > 0 ? (sPnlR / sInvesti) * 100 : 0,
      pnlLatent:      sPnlL,
      pnlLatentPct:   sInvesti > 0 ? (sPnlL / sInvesti) * 100 : 0,
      pnlTotal:       sPnlR + sPnlL,
      pnlTotalPct:    sInvesti > 0 ? ((sPnlR + sPnlL) / sInvesti) * 100 : 0,
      nbTotal: sTot, nbExec: sExec, nbAnnule: sCanc, tauxExec: sTot > 0 ? (sExec / sTot) * 100 : 0,
      nbAchat: sAchat, nbVente: sVente, buyW: bw, sellW: 100 - bw,
    }
  }

  if (!d) return null

  const {
    capitalDepose, capitalInvesti, capitalDispo, capitalDispoPct,
    pnlRealise, pnlRealisePct, pnlLatent, pnlLatentPct, pnlTotal, pnlTotalPct,
    nbTotal, nbExec, nbAnnule, tauxExec,
    nbAchat, nbVente, buyW, sellW,
  } = d

  const totBorderColor = pnlTotal > 0
    ? 'var(--color-border-success, rgba(0,214,143,.5))'
    : pnlTotal < 0
    ? 'var(--color-border-danger, rgba(245,71,106,.5))'
    : undefined

  const updateLabel = lastPriceUpdate ?? '—'
  const sourceLabel = pricesError ? '⚠️ Erreur' : (pricesLoading ? 'chargement…' : 'live')

  return (
    <div className="v5-kpi-root" onClick={() => setOpenTip(null)}>

      {/* ══ CAPITAL ══════════════════════════════════════════════════════════ */}
      <section className="v5-section">
        <h2 className="v5-section-title">Capital</h2>
        <div className="v5-kpi-grid v5-g3">

          <KpiCard
            label="Capital déposé"
            value={fmtN(capitalDepose)}
            tipId="tip-dep" tipTitle="Capital déposé"
            tipDesc="Total cumulé de tous vos apports depuis le début. Ne diminue jamais."
            tipFormula="Σ dépôts USDT"
            openId={openTip} setOpenId={setOpenTip}
          />

          <KpiCard
            label="Capital investi"
            value={fmtN(capitalInvesti)}
            tipId="tip-inv" tipTitle="Capital investi"
            tipDesc="Capital actuellement engagé sur le marché — ce que vous avez acheté moins ce que vous avez vendu."
            tipFormula="Σ achats USDT − Σ ventes USDT"
            openId={openTip} setOpenId={setOpenTip}
          />

          <KpiCard
            label="Capital disponible"
            value={fmtN(capitalDispo)}
            sub={fmtN(capitalDispoPct, 0) + ' % du capital déposé'}
            subClass="neu"
            tipId="tip-dispo" tipTitle="Capital disponible"
            tipDesc="USDT non investi, prêt à être déployé."
            tipFormula="Capital déposé − Capital investi"
            openId={openTip} setOpenId={setOpenTip}
          />

        </div>
      </section>

      {/* ══ PERFORMANCE ══════════════════════════════════════════════════════ */}
      <section className="v5-section">
        <h2 className="v5-section-title">
          <span className={`v5-live-dot${pricesLoading ? ' v5-live-dot--loading' : ''}`} />
          Performance (cours actuel)
          <span className="v5-perf-source">
            {sourceLabel}
            {!pricesLoading && !pricesError && lastPriceUpdate && (
              <> · {updateLabel}</>
            )}
          </span>
          {refreshPrices && (
            <button
              className="v5-refresh-btn"
              onClick={e => { e.stopPropagation(); refreshPrices() }}
              title="Rafraîchir les prix"
            >
              ↺
            </button>
          )}
        </h2>
        <div className="v5-kpi-grid v5-g3">

          <KpiCard
            label="PnL réalisé"
            value={<span className={cc(pnlRealise)}>{fmtS(pnlRealise)}</span>}
            sub={fmtPct(pnlRealisePct)}
            subClass={cc(pnlRealisePct)}
            tipId="tip-real" tipTitle="PnL réalisé"
            tipDesc="Gains/pertes sur les ventes clôturées dans la période sélectionnée."
            tipFormula="Σ PnL réalisé par paire"
            openId={openTip} setOpenId={setOpenTip}
          />

          <KpiCard
            label="PnL latent"
            value={<span className={cc(pnlLatent)}>{fmtS(pnlLatent)}</span>}
            sub={fmtPct(pnlLatentPct)}
            subClass={cc(pnlLatentPct)}
            tipId="tip-lat" tipTitle="PnL latent"
            tipDesc="Variation de valeur des positions encore ouvertes."
            tipFormula="Σ (prix actuel − breakeven) × position nette"
            openId={openTip} setOpenId={setOpenTip}
          />

          <KpiCard
            label="PnL total"
            value={<span className={cc(pnlTotal)}>{fmtS(pnlTotal)}</span>}
            sub={fmtPct(pnlTotalPct)}
            subClass={cc(pnlTotalPct)}
            borderColor={totBorderColor}
            className="v5-kpi--total"
            tipId="tip-tot" tipTitle="PnL total"
            tipDesc="Performance complète sur la période."
            tipFormula="PnL réalisé + PnL latent"
            openId={openTip} setOpenId={setOpenTip}
          />

        </div>
      </section>

      {/* ══ ORDRES ═══════════════════════════════════════════════════════════ */}
      <section className="v5-section">
        <h2 className="v5-section-title">Ordres</h2>
        <div className="v5-kpi-grid v5-g2">

          <div className="v5-kpi v5-orders-synthese">
            <div className="v5-kpi-label">Synthèse</div>
            <div className="v5-orders-row">
              <div className="v5-order-stat">
                <div className="v5-order-lbl">Total</div>
                <div className="v5-order-val">{nbTotal}</div>
              </div>
              <div className="v5-order-stat">
                <div className="v5-order-lbl">Exécutés</div>
                <div className="v5-order-val">{nbExec}</div>
              </div>
              <div className="v5-order-stat">
                <div className="v5-order-lbl">Annulés</div>
                <div className="v5-order-val neg">{nbAnnule}</div>
              </div>
              <div className="v5-order-stat">
                <div className="v5-order-lbl">Taux exec.</div>
                <div className={`v5-order-val v5-order-rate ${cc(tauxExec - 50)}`}>
                  {fmtN(tauxExec, 0)} %
                </div>
              </div>
            </div>
          </div>

          <div className="v5-kpi v5-orders-bar-card">
            <div className="v5-kpi-label">Achats vs ventes</div>
            <div className="v5-bar-labels">
              <span><strong>{nbAchat}</strong> achats</span>
              <span><strong>{nbVente}</strong> ventes</span>
            </div>
            <div className="v5-bar-track">
              <div className="v5-bar-buy"  style={{ width: buyW  + '%' }} />
              <div className="v5-bar-sell" style={{ width: sellW + '%' }} />
            </div>
          </div>

        </div>
      </section>

    </div>
  )
}
