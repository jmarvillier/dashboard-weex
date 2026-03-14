/**
 * usePeriodFilter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook qui filtre les rawRows (lignes brutes avec dates) selon la période
 * et recalcule tous les agrégats : capital, PnL, ordres, rows par paire.
 *
 * Formules capital :
 *   Capital déposé  = Σ dépôts USDT (cumulatif, non filtré)
 *   Capital investi = Σ achats USDT − Σ ventes USDT (sur la période)
 *   Capital dispo   = Capital déposé − Capital investi
 */

import { useState, useMemo } from 'react'
import { periodStart } from '../components/PeriodFilter.jsx'

const parseFloat2 = v => isNaN(+v) ? 0 : +v
const pctOf = (val, ref) => ref > 0 ? (val / ref) * 100 : 0

/* ── Filtre des rawRows sur la fenêtre temporelle ────────────────────────── */
function filterByPeriod(rawRows, period) {
  const start = periodStart(period)
  if (!start) return rawRows
  return rawRows.filter(r => r.date && r.date >= start)
}

/* ── Agrège rawRows filtrés en rows par paire + KPIs globaux ─────────────── */
function computeFromRaw(rawRows, period, pairList, prices) {
  // ── Capital déposé : cumulatif global (non filtré par période) ───────────
  const capitalDepose = pairList
    .filter(p => p.is_depot)
    .reduce((s, p) => s + parseFloat2(p.capital_depose), 0)

  // ── Vérification : dates exploitables dans les rawRows ?
  const hasDates = rawRows.length > 0 &&
    rawRows.some(r => r.date instanceof Date && !isNaN(r.date.getTime()))

  if (!hasDates) {
    return computeFromPairList(pairList, capitalDepose, prices)
  }

  // ── Filtre temporel ───────────────────────────────────────────────────────
  const filtered = filterByPeriod(rawRows, period)

  // ── Agrégation par paire ──────────────────────────────────────────────────
  const map = {}

  filtered.forEach(r => {
    if (!r.pair) return
    const sensLow = r.sens.toLowerCase()
    if (sensLow.includes('dép') || sensLow.includes('dep')) return

    if (!map[r.pair]) map[r.pair] = {
      name:       r.pair,
      usdtAchete: 0,   // Σ USDT dépensés en achats
      usdtVendu:  0,   // Σ USDT reçus des ventes
      volAchete:  0,
      volVendu:   0,
      nbTotal:    0,
      nbExec:     0,
      nbAnnule:   0,
      nbAchat:    0,
      nbVente:    0,
    }
    const p = map[r.pair]
    p.nbTotal++
    if (r.sens === 'Achat') p.nbAchat++
    if (r.sens === 'Vente') p.nbVente++
    if (r.annule) { p.nbAnnule++; return }
    if (!r.exec)  return
    p.nbExec++
    if (r.sens === 'Achat') { p.usdtAchete += r.usdt || 0; p.volAchete += r.vol || 0 }
    if (r.sens === 'Vente') { p.usdtVendu  += r.usdt || 0; p.volVendu  += r.vol || 0 }
  })

  // ── Métriques par paire ───────────────────────────────────────────────────
  const rows = Object.values(map).map(p => {
    const position  = p.volAchete - p.volVendu
    const prixMoy   = p.volAchete > 0 ? p.usdtAchete / p.volAchete : 0
    const breakeven = position > 0 && prixMoy > 0 ? prixMoy : 0

    // Capital investi pour cette paire = achats − ventes
    const capitalInvesti = p.usdtAchete - p.usdtVendu

    // PnL réalisé
    const coutVendu  = prixMoy * p.volVendu
    const pnlRealise = p.volVendu > 0 && prixMoy > 0
      ? p.usdtVendu - coutVendu
      : p.usdtVendu

    // PnL latent (avec prix live si dispo)
    const coursLive = prices?.[p.name] ?? null
    const pnlLatent = position > 0 && breakeven > 0 && coursLive != null
      ? (coursLive - breakeven) * position
      : 0

    return {
      name:            p.name,
      capitalInvesti,  // achats − ventes
      usdtAchete:      p.usdtAchete,
      usdtVendu:       p.usdtVendu,
      position,
      breakeven,
      pnlRealise,
      pnlLatent,
      nbTotal:  p.nbTotal,
      nbExec:   p.nbExec,
      nbAnnule: p.nbAnnule,
      nbAchat:  p.nbAchat,
      nbVente:  p.nbVente,
    }
  })

  return buildKpis(rows, capitalDepose)
}

/* ── Mode dégradé : depuis pairList agrégée (équivalent "tout") ──────────── */
function computeFromPairList(pairList, capitalDepose, prices) {
  const trading = pairList.filter(p => !p.is_depot)

  const rows = trading.map(p => {
    const pnlRealise     = parseFloat2(p.pnl_realise_live ?? p.pnl_realise)
    const pnlLatent      = parseFloat2(p.pnl_latent_live  ?? p.pnl_latent)
    const position       = parseFloat2(p.position ?? (p.vol_achete - p.vol_vendu))
    // Capital investi = achats − ventes
    const capitalInvesti = parseFloat2(p.usdt_investi) - parseFloat2(p.usdt_recu)

    return {
      name:            p.name,
      capitalInvesti,
      usdtAchete:      parseFloat2(p.usdt_investi),
      usdtVendu:       parseFloat2(p.usdt_recu),
      position,
      breakeven:       parseFloat2(p.prix_moy),
      pnlRealise,
      pnlLatent,
      nbTotal:  parseFloat2(p.nb_total),
      nbExec:   parseFloat2(p.nb_exec),
      nbAnnule: parseFloat2(p.nb_annule),
      nbAchat:  parseFloat2(p.nb_achat),
      nbVente:  parseFloat2(p.nb_vente),
    }
  })

  return buildKpis(rows, capitalDepose)
}

/* ── KPIs globaux ────────────────────────────────────────────────────────── */
function buildKpis(rows, capitalDepose) {
  // Capital investi = Σ achats − Σ ventes
  const capitalInvesti = rows.reduce((s, r) => s + r.capitalInvesti, 0)
  const capitalDispo   = capitalDepose - capitalInvesti

  const pnlRealise = rows.reduce((s, r) => s + r.pnlRealise, 0)
  const pnlLatent  = rows.reduce((s, r) => s + r.pnlLatent,  0)
  const pnlTotal   = pnlRealise + pnlLatent

  const nbTotal  = rows.reduce((s, r) => s + r.nbTotal,  0)
  const nbExec   = rows.reduce((s, r) => s + r.nbExec,   0)
  const nbAnnule = rows.reduce((s, r) => s + r.nbAnnule, 0)
  const nbAchat  = rows.reduce((s, r) => s + r.nbAchat,  0)
  const nbVente  = rows.reduce((s, r) => s + r.nbVente,  0)
  const tauxExec = nbTotal > 0 ? (nbExec / nbTotal) * 100 : 0

  const buyW  = nbAchat + nbVente > 0 ? (nbAchat / (nbAchat + nbVente)) * 100 : 0
  const sellW = 100 - buyW

  return {
    // Capital (3 KPIs — valeur portefeuille retirée)
    capitalDepose,
    capitalInvesti,
    capitalDispo,
    capitalDispoPct: pctOf(capitalDispo, capitalDepose),

    // PnL
    pnlRealise,
    pnlRealisePct: pctOf(pnlRealise, capitalInvesti),
    pnlLatent,
    pnlLatentPct:  pctOf(pnlLatent,  capitalInvesti),
    pnlTotal,
    pnlTotalPct:   pctOf(pnlTotal,   capitalInvesti),

    // Ordres
    nbTotal, nbExec, nbAnnule, tauxExec,
    nbAchat, nbVente, buyW, sellW,

    // Rows tableau récap (expose aussi usdtAchete/usdtVendu pour le tableau)
    rows,
  }
}

/**
 * Hook usePeriodFilter
 *
 * @param {Array}  pairList  — liste agrégée des paires (depuis useTrading)
 * @param {Array}  rawRows   — lignes brutes avec dates (depuis useTrading)
 * @param {Object} prices    — prix live (optionnel)
 *
 * @returns {{ period, setPeriod, data }}
 */
export function usePeriodFilter(pairList = [], rawRows = [], prices = null) {
  const [period, setPeriod] = useState('1j')

  const data = useMemo(
    () => computeFromRaw(rawRows, period, pairList, prices),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawRows, period, pairList, prices]
  )

  return { period, setPeriod, data }
}
