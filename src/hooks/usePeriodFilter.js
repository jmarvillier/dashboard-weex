/**
 * usePeriodFilter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook qui filtre les données du store selon la période sélectionnée.
 *
 * Retourne des agrégats pré-calculés pour le Dashboard v5 :
 *   capital, PnL réalisé/latent/total, ordres, et rows par paire.
 *
 * Les données de `pairList` (issues de process.js / useTrading) contiennent
 * toutes les paires depuis le début. Pour simuler le filtre temporel sur des
 * données sans timestamps natifs, on utilise les champs disponibles :
 *   - usdt_investi, vol_achete, vol_vendu, pnl_realise, pnl_latent
 *   - pnl_latent_live, pnl_realise_live (si prix chargés)
 *   - nb_total, nb_exec, nb_annule, nb_achat, nb_vente
 *
 * NOTE : le vrai filtre temporel ligne par ligne nécessite que process.js
 * expose les rows brutes avec timestamps. Ce hook est architecturé pour
 * recevoir rawRows en paramètre optionnel et calculer sur la fenêtre filtrée.
 * En l'absence de rawRows, il opère sur les agrégats pairList (mode dégradé).
 */

import { useState, useMemo } from 'react'
import { periodStart } from '../components/PeriodFilter.jsx'

const fmt2  = (v, d = 2) => isNaN(+v) ? 0 : +v
const pct   = (val, ref) => ref > 0 ? (val / ref) * 100 : 0

/**
 * Filtre les rawRows (tableau de lignes brutes issues de parser) selon la période.
 * Chaque ligne est un objet { date: Date, ... }
 */
function filterRows(rawRows, period) {
  if (!rawRows || rawRows.length === 0) return []
  const start = periodStart(period)
  if (!start) return rawRows
  return rawRows.filter(r => r.date && r.date >= start)
}

/**
 * Agrège les paires à partir de rawRows filtrés.
 * Si rawRows est null → fallback sur pairList.
 */
function aggregate(pairList, rawRows, period, prices) {
  const trading = pairList.filter(p => !p.is_depot)
  const depots  = pairList.filter(p => p.is_depot)

  // ── Capital déposé (cumulatif, non filtré par période) ──────────────────
  const capitalDepose = depots.reduce((s, p) => s + fmt2(p.capital_depose), 0)

  // ── Agrégats trading ─────────────────────────────────────────────────────
  // Pour la période "tout" ou en l'absence de rawRows, on utilise pairList tel quel.
  // Avec rawRows, on recalcule sur la fenêtre temporelle.

  let rows = []

  if (rawRows && rawRows.length > 0) {
    // Vrai filtre temporel
    const filtered = filterRows(rawRows, period)
    rows = buildRowsFromRaw(filtered, prices)
  } else {
    // Mode dégradé : utilise les agrégats complets (équivalent "Tout")
    rows = trading.map(p => ({
      name:        p.name,
      investi:     fmt2(p.usdt_investi),
      position:    fmt2(p.position ?? (p.vol_achete - p.vol_vendu)),
      breakeven:   fmt2(p.prix_moy),
      pnlRealise:  fmt2(p.pnl_realise_live ?? p.pnl_realise),
      pnlLatent:   fmt2(p.pnl_latent_live  ?? p.pnl_latent),
      valActuelle: prices && prices[p.name]
        ? fmt2(p.position ?? (p.vol_achete - p.vol_vendu)) * prices[p.name]
        : fmt2(p.usdt_investi) + fmt2(p.pnl_latent_live ?? p.pnl_latent),
      nbTotal:  fmt2(p.nb_total),
      nbExec:   fmt2(p.nb_exec),
      nbAnnule: fmt2(p.nb_annule),
      nbAchat:  fmt2(p.nb_achat),
      nbVente:  fmt2(p.nb_vente),
    }))
  }

  // ── KPIs globaux ──────────────────────────────────────────────────────────
  const capitalInvesti = rows.reduce((s, r) => s + r.investi, 0)
  const valPortefeuille = rows.reduce((s, r) => s + r.valActuelle, 0)
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
    // Capital
    capitalDepose,
    capitalInvesti,
    valPortefeuille,
    valPortefeuillePct: pct(valPortefeuille - capitalInvesti, capitalInvesti),
    capitalDispo,
    capitalDispoPct:    pct(capitalDispo, capitalDepose),

    // PnL
    pnlRealise,
    pnlRealisePct: pct(pnlRealise, capitalInvesti),
    pnlLatent,
    pnlLatentPct:  pct(pnlLatent,  capitalInvesti),
    pnlTotal,
    pnlTotalPct:   pct(pnlTotal,   capitalInvesti),

    // Ordres
    nbTotal, nbExec, nbAnnule, tauxExec,
    nbAchat, nbVente, buyW, sellW,

    // Rows par paire (pour le tableau récap)
    rows,
  }
}

/**
 * Reconstruit des rows agrégées depuis des rawRows filtrés.
 * rawRows doit être au format { pair, sens, statut, prix, usdt, vol, date }
 */
function buildRowsFromRaw(filtered, prices) {
  const map = {}

  filtered.forEach(r => {
    if (!r.pair) return
    if (!map[r.pair]) map[r.pair] = {
      name: r.pair, investi: 0, volAchete: 0, volVendu: 0,
      usdtRecu: 0, nbTotal: 0, nbExec: 0, nbAnnule: 0, nbAchat: 0, nbVente: 0,
    }
    const p = map[r.pair]
    p.nbTotal++
    if (r.sens === 'Achat')  p.nbAchat++
    if (r.sens === 'Vente')  p.nbVente++
    if (r.annule) { p.nbAnnule++; return }
    if (!r.exec)  return
    p.nbExec++
    if (r.sens === 'Achat') { p.investi   += r.usdt || 0; p.volAchete += r.vol || 0 }
    if (r.sens === 'Vente') { p.usdtRecu  += r.usdt || 0; p.volVendu  += r.vol || 0 }
  })

  return Object.values(map).map(p => {
    const position   = p.volAchete - p.volVendu
    const breakeven  = position > 0 ? (p.investi - p.usdtRecu) / position : 0
    const pnlRealise = p.usdtRecu - (p.investi * (p.volVendu / (p.volAchete || 1)))
    const prix       = prices?.[p.name] ?? 0
    const valAct     = position * prix
    const pnlLatent  = position > 0 && prix > 0 ? (prix - breakeven) * position : 0

    return {
      name:        p.name,
      investi:     p.investi,
      position,
      breakeven,
      pnlRealise,
      pnlLatent,
      valActuelle: valAct || p.investi + pnlLatent,
      nbTotal:  p.nbTotal,
      nbExec:   p.nbExec,
      nbAnnule: p.nbAnnule,
      nbAchat:  p.nbAchat,
      nbVente:  p.nbVente,
    }
  })
}

/**
 * Hook usePeriodFilter
 *
 * @param {Array}  pairList  — liste des paires (depuis useTrading)
 * @param {Object} prices    — prix live (depuis usePrices), optionnel
 * @param {Array}  rawRows   — lignes brutes avec timestamps, optionnel
 *
 * @returns {{ period, setPeriod, data }}
 */
export function usePeriodFilter(pairList = [], prices = null, rawRows = null) {
  const [period, setPeriod] = useState('1j')

  const data = useMemo(
    () => aggregate(pairList, rawRows, period, prices),
    [pairList, rawRows, period, prices]
  )

  return { period, setPeriod, data }
}
