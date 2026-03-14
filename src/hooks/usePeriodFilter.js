/**
 * usePeriodFilter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook qui filtre les rawRows (lignes brutes avec dates) selon la période
 * et recalcule tous les agrégats : capital, PnL, ordres, rows par paire.
 */

import { useState, useMemo } from 'react'
import { periodStart } from '../components/PeriodFilter.jsx'

const parseFloat2 = v => isNaN(+v) ? 0 : +v
const pctOf = (val, ref) => ref > 0 ? (val / ref) * 100 : 0

/* ── Filtre des rawRows sur la fenêtre temporelle ────────────────────────── */
function filterByPeriod(rawRows, period) {
  const start = periodStart(period)
  if (!start) return rawRows                          // "tout" → pas de filtre
  return rawRows.filter(r => r.date && r.date >= start)
}

/* ── Agrège rawRows filtrés en rows par paire + KPIs globaux ─────────────── */
function computeFromRaw(rawRows, period, pairList, prices) {
  // ── Capital déposé : cumulatif global (non filtré par période) ───────────
  const capitalDepose = pairList
    .filter(p => p.is_depot)
    .reduce((s, p) => s + parseFloat2(p.capital_depose), 0)

  // ── Vérification : est-ce que les rawRows ont des dates exploitables ?
  const hasDates = rawRows.length > 0 &&
    rawRows.some(r => r.date instanceof Date && !isNaN(r.date.getTime()))

  if (!hasDates) {
    // Mode dégradé : utilise pairList tel quel (équivalent "tout")
    return computeFromPairList(pairList, capitalDepose, prices)
  }

  // ── Filtre sur la fenêtre temporelle ─────────────────────────────────────
  const filtered = filterByPeriod(rawRows, period)

  // ── Agrégation par paire sur les lignes filtrées ──────────────────────────
  const map = {}

  filtered.forEach(r => {
    if (!r.pair) return
    // Exclure les dépôts du calcul de trading
    if (r.sens === 'Dépôt' || r.sens === 'Depot' ||
        r.sens.toLowerCase().includes('dép') ||
        r.sens.toLowerCase().includes('dep')) return

    if (!map[r.pair]) map[r.pair] = {
      name:      r.pair,
      investi:   0,
      volAchete: 0,
      volVendu:  0,
      usdtRecu:  0,
      nbTotal:   0,
      nbExec:    0,
      nbAnnule:  0,
      nbAchat:   0,
      nbVente:   0,
    }
    const p = map[r.pair]
    p.nbTotal++
    if (r.sens === 'Achat') p.nbAchat++
    if (r.sens === 'Vente') p.nbVente++
    if (r.annule) { p.nbAnnule++; return }
    if (!r.exec)  return
    p.nbExec++
    if (r.sens === 'Achat') { p.investi   += r.usdt || 0; p.volAchete += r.vol || 0 }
    if (r.sens === 'Vente') { p.usdtRecu  += r.usdt || 0; p.volVendu  += r.vol || 0 }
  })

  // ── Calcul des métriques par paire ────────────────────────────────────────
  const rows = Object.values(map).map(p => {
    const position  = p.volAchete - p.volVendu
    const prixMoy   = p.volAchete > 0 ? p.investi / p.volAchete : 0
    const breakeven = position > 0 && prixMoy > 0 ? prixMoy : 0

    // PnL réalisé : recettes vente − coût de revient des volumes vendus
    const coutVendu  = prixMoy * p.volVendu
    const pnlRealise = p.volVendu > 0 && prixMoy > 0
      ? p.usdtRecu - coutVendu
      : p.usdtRecu

    // PnL latent : utilise le cours live s'il est dispo, sinon le breakeven
    const coursLive = prices?.[p.name] ?? null
    const pnlLatent = position > 0 && breakeven > 0 && coursLive != null
      ? (coursLive - breakeven) * position
      : 0

    // Valeur actuelle
    const valActuelle = coursLive != null && position > 0
      ? position * coursLive
      : p.investi + pnlLatent

    return {
      name:       p.name,
      investi:    p.investi,
      position,
      breakeven,
      pnlRealise,
      pnlLatent,
      valActuelle,
      nbTotal:  p.nbTotal,
      nbExec:   p.nbExec,
      nbAnnule: p.nbAnnule,
      nbAchat:  p.nbAchat,
      nbVente:  p.nbVente,
    }
  })

  return buildKpis(rows, capitalDepose)
}

/* ── Mode dégradé : construit depuis pairList (sans filtrage temporel) ───── */
function computeFromPairList(pairList, capitalDepose, prices) {
  const trading = pairList.filter(p => !p.is_depot)

  const rows = trading.map(p => {
    const coursLive   = prices?.[p.name] ?? null
    const pnlRealise  = parseFloat2(p.pnl_realise_live ?? p.pnl_realise)
    const pnlLatent   = parseFloat2(p.pnl_latent_live  ?? p.pnl_latent)
    const position    = parseFloat2(p.position ?? (p.vol_achete - p.vol_vendu))
    const valActuelle = coursLive != null && position > 0
      ? position * coursLive
      : parseFloat2(p.usdt_investi) + pnlLatent

    return {
      name:        p.name,
      investi:     parseFloat2(p.usdt_investi),
      position,
      breakeven:   parseFloat2(p.prix_moy),
      pnlRealise,
      pnlLatent,
      valActuelle,
      nbTotal:  parseFloat2(p.nb_total),
      nbExec:   parseFloat2(p.nb_exec),
      nbAnnule: parseFloat2(p.nb_annule),
      nbAchat:  parseFloat2(p.nb_achat),
      nbVente:  parseFloat2(p.nb_vente),
    }
  })

  return buildKpis(rows, capitalDepose)
}

/* ── Construit les KPIs globaux depuis les rows agrégées ─────────────────── */
function buildKpis(rows, capitalDepose) {
  const capitalInvesti  = rows.reduce((s, r) => s + r.investi,     0)
  const valPortefeuille = rows.reduce((s, r) => s + r.valActuelle, 0)
  const capitalDispo    = capitalDepose - capitalInvesti

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
    // Capital
    capitalDepose,
    capitalInvesti,
    valPortefeuille,
    valPortefeuillePct: pctOf(valPortefeuille - capitalInvesti, capitalInvesti),
    capitalDispo,
    capitalDispoPct:    pctOf(capitalDispo, capitalDepose),

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

    // Rows pour le tableau récapitulatif
    rows,
  }
}

/**
 * Hook usePeriodFilter
 *
 * @param {Array}  pairList  — liste agrégée des paires (depuis useTrading)
 * @param {Array}  rawRows   — lignes brutes avec dates (depuis useTrading)
 * @param {Object} prices    — prix live { 'BTC/USDT': 83000, ... } (optionnel)
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
