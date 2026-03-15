/**
 * usePeriodFilter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Formules capital :
 *   Capital déposé  = Σ dépôts USDT (cumulatif, non filtré)
 *   Capital investi = Σ achats − Σ ventes  (filtré sur la période)
 *   Capital dispo   = Capital déposé − (Σ achats ALL TIME − Σ ventes ALL TIME)
 *                     → toujours calculé sur l'ensemble des trades, non filtré
 */

import { useState, useMemo } from 'react'
import { periodStart } from '../components/PeriodFilter.jsx'

const n0 = v => isNaN(+v) ? 0 : +v
const pctOf = (val, ref) => ref > 0 ? (val / ref) * 100 : 0

function filterByPeriod(rawRows, period) {
  const start = periodStart(period)
  if (!start) return rawRows
  return rawRows.filter(r => r.date && r.date >= start)
}

function computeFromRaw(rawRows, period, pairList, prices) {
  const capitalDepose = pairList
    .filter(p => p.is_depot)
    .reduce((s, p) => s + n0(p.capital_depose), 0)

  const hasDates = rawRows.length > 0 &&
    rawRows.some(r => r.date instanceof Date && !isNaN(r.date.getTime()))

  if (!hasDates) {
    return computeFromPairList(pairList, capitalDepose, prices)
  }

  // ── Capital dispo : calculé sur ALL TIME (non filtré) ────────────────────
  const capitalDispoAllTime = computeCapitalDispo(rawRows, capitalDepose)

  // ── Filtre temporel pour les autres KPIs ─────────────────────────────────
  const filtered = filterByPeriod(rawRows, period)

  const map = {}
  filtered.forEach(r => {
    if (!r.pair) return
    const sensLow = r.sens.toLowerCase()
    if (sensLow.includes('dép') || sensLow.includes('dep')) return

    if (!map[r.pair]) map[r.pair] = {
      name: r.pair,
      usdtAchete: 0, usdtVendu: 0,
      volAchete: 0,  volVendu: 0,
      nbTotal: 0, nbExec: 0, nbAnnule: 0, nbAchat: 0, nbVente: 0,
    }
   const p = map[r.pair]
    p.nbTotal++
    if (r.annule) { p.nbAnnule++; return }
    if (!r.exec)  return
    p.nbExec++
    
    if (r.sens === 'Achat') p.nbAchat++
    if (r.sens === 'Vente') p.nbVente++
    
    if (r.sens === 'Achat') { p.usdtAchete += r.usdt || 0; p.volAchete += r.vol || 0 }
    if (r.sens === 'Vente') { p.usdtVendu  += r.usdt || 0; p.volVendu  += r.vol || 0 }
  })

  const rows = Object.values(map).filter(p => p.nbExec > 0).map(p => {
    const position  = p.volAchete - p.volVendu
    const prixMoy   = p.volAchete > 0 ? p.usdtAchete / p.volAchete : 0
    const breakeven = position > 0 && prixMoy > 0 ? prixMoy : 0
    const coutVendu = prixMoy * p.volVendu
    const pnlRealise = p.volVendu > 0 && prixMoy > 0
      ? p.usdtVendu - coutVendu : p.usdtVendu
    const coursLive = prices?.[p.name] ?? null
    const pnlLatent = position > 0 && breakeven > 0 && coursLive != null
      ? (coursLive - breakeven) * position : 0

    return {
      name:           p.name,
      capitalInvesti: p.usdtAchete - p.usdtVendu,
      usdtAchete:     p.usdtAchete,
      usdtVendu:      p.usdtVendu,
      position, breakeven, pnlRealise, pnlLatent,
      nbTotal: p.nbTotal, nbExec: p.nbExec, nbAnnule: p.nbAnnule,
      nbAchat: p.nbAchat, nbVente: p.nbVente,
    }
  })

  return buildKpis(rows, capitalDepose, capitalDispoAllTime)
}

/* ── Capital dispo sur ALL TIME ─────────────────────────────────────────── */
function computeCapitalDispo(rawRows, capitalDepose) {
  let totalAchete = 0
  let totalVendu  = 0
  rawRows.forEach(r => {
    if (!r.pair || !r.exec) return
    const sensLow = r.sens.toLowerCase()
    if (sensLow.includes('dép') || sensLow.includes('dep')) return
    if (r.sens === 'Achat') totalAchete += r.usdt || 0
    if (r.sens === 'Vente') totalVendu  += r.usdt || 0
  })
  return capitalDepose - (totalAchete - totalVendu)
}

/* ── Mode dégradé (pas de dates) ────────────────────────────────────────── */
function computeFromPairList(pairList, capitalDepose, prices) {
  const trading = pairList.filter(p => !p.is_depot)
  const rows = trading.map(p => {
    const pnlRealise     = n0(p.pnl_realise_live ?? p.pnl_realise)
    const pnlLatent      = n0(p.pnl_latent_live  ?? p.pnl_latent)
    const position       = n0(p.position ?? (p.vol_achete - p.vol_vendu))
    const capitalInvesti = n0(p.usdt_investi) - n0(p.usdt_recu)
    return {
      name: p.name, capitalInvesti,
      usdtAchete: n0(p.usdt_investi),
      usdtVendu:  n0(p.usdt_recu),
      position, breakeven: n0(p.prix_moy), pnlRealise, pnlLatent,
      nbTotal: n0(p.nb_total), nbExec: n0(p.nb_exec), nbAnnule: n0(p.nb_annule),
      nbAchat: n0(p.nb_achat), nbVente: n0(p.nb_vente),
    }
  })
  // En mode dégradé, capital dispo = déposé − investi all time
  const totalAchete = trading.reduce((s, p) => s + n0(p.usdt_investi), 0)
  const totalVendu  = trading.reduce((s, p) => s + n0(p.usdt_recu),    0)
  const capitalDispo = capitalDepose - (totalAchete - totalVendu)
  return buildKpis(rows, capitalDepose, capitalDispo)
}

/* ── KPIs globaux ────────────────────────────────────────────────────────── */
function buildKpis(rows, capitalDepose, capitalDispo) {
  const capitalInvesti = rows.reduce((s, r) => s + r.capitalInvesti, 0)

  const pnlRealise = rows.reduce((s, r) => s + r.pnlRealise, 0)
  const pnlLatent  = rows.reduce((s, r) => s + r.pnlLatent,  0)
  const pnlTotal   = pnlRealise + pnlLatent

  const nbTotal  = rows.reduce((s, r) => s + r.nbTotal,  0)
  const nbExec   = rows.reduce((s, r) => s + r.nbExec,   0)
  const nbAnnule = rows.reduce((s, r) => s + r.nbAnnule, 0)
  const nbAchat  = rows.reduce((s, r) => s + r.nbAchat,  0)
  const nbVente  = rows.reduce((s, r) => s + r.nbVente,  0)
  const tauxExec = nbTotal > 0 ? (nbExec / nbTotal) * 100 : 0
  const buyW     = nbAchat + nbVente > 0 ? (nbAchat / (nbAchat + nbVente)) * 100 : 0

  // ── Volumes USDT ──────────────────────────────────────────────────────────
  const volumeAchat  = rows.reduce((s, r) => s + (r.usdtAchete || 0), 0)
  const volumeVente  = rows.reduce((s, r) => s + (r.usdtVendu  || 0), 0)
  const volTotal     = volumeAchat + volumeVente
  const volumeBuyW   = volTotal > 0 ? (volumeAchat / volTotal) * 100 : 0

  return {
    capitalDepose,
    capitalInvesti,
    capitalDispo,
    capitalDispoPct: pctOf(capitalDispo, capitalDepose),
    pnlRealise,  pnlRealisePct: pctOf(pnlRealise, capitalInvesti),
    pnlLatent,   pnlLatentPct:  pctOf(pnlLatent,  capitalInvesti),
    pnlTotal,    pnlTotalPct:   pctOf(pnlTotal,   capitalInvesti),
    nbTotal, nbExec, nbAnnule, tauxExec,
    nbAchat, nbVente, buyW, sellW: 100 - buyW,
    volumeAchat, volumeVente, volumeBuyW, volumeSellW: 100 - volumeBuyW,
    rows,
  }
}

/**
 * Hook usePeriodFilter
 * Période par défaut : '1s' (recommandé pour trader DCA daily)
 */
export function usePeriodFilter(pairList = [], rawRows = [], prices = null) {
  const [period, setPeriod] = useState('1s')

  const data = useMemo(
    () => computeFromRaw(rawRows, period, pairList, prices),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawRows, period, pairList, prices]
  )

  return { period, setPeriod, data }
}
