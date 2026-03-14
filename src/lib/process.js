import { normPair, parseN, isExec, isAnnul, isUsdPair } from './parser.js'

/**
 * Parse une date depuis une cellule du journal.
 * Gère les formats : DD/MM/YYYY, YYYY-MM-DD, timestamps JS, et les dates Excel (nombre de jours).
 */
function parseDate(raw) {
  if (!raw) return null

  // Nombre Excel (jours depuis 1900-01-01)
  const n = Number(raw)
  if (!isNaN(n) && n > 40000 && n < 60000) {
    const ms = (n - 25569) * 86400 * 1000
    return new Date(ms)
  }

  const s = String(raw).trim()
  if (!s) return null

  // Format DD/MM/YYYY ou DD/MM/YYYY HH:MM
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (dmy) {
    return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`)
  }

  // Format ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (iso) {
    return new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`)
  }

  // Tentative native (last resort)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export function process(rows) {
  let start = 1
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].some(c => String(c).toUpperCase().includes('PAIRE'))) { start = i + 1; break }
  }

  const P = {}

  rows.slice(start).forEach(r => {
    if (!r[1]) return

    const pair   = normPair(r[1])
    const sens   = String(r[2] || '').trim()
    const stat   = String(r[3] || '').trim()
    const prixDs = parseN(r[4])
    const usdt   = parseN(r[5])
    const usdc   = parseN(r[6])
    const eur    = parseN(r[7])
    const vol    = parseN(r[10])

    if (!pair) return

    const dash    = r[12]
    const dashStr = String(dash).trim().toLowerCase()
    if (dash === false || dashStr === 'false' || dashStr === '0') return

    if (!P[pair]) P[pair] = {
      name:            pair,
      is_depot:        false,
      is_usd:          isUsdPair(pair),
      capital_depose:  0,
      usdt_investi:    0,
      vol_achete:      0,
      vol_vendu:       0,
      usdt_recu:       0,
      last_prix_achat: 0,
      last_prix_vente: 0,
      nb_total:        0,
      nb_exec:         0,
      nb_annule:       0,
      nb_achat:        0,
      nb_vente:        0,
      nb_depot:        0,
    }

    const p = P[pair]

    if (sens === 'Dépôt' || sens === 'Depot' || sens.toLowerCase().includes('dép') || sens.toLowerCase().includes('dep')) {
      p.is_depot = true
      if (isExec(stat)) {
        const montant = usdt || usdc || eur || vol || 0
        p.capital_depose += montant
        p.nb_depot++
        p.nb_exec++
      }
      p.nb_total++
      return
    }

    p.nb_total++
    if (sens === 'Achat') p.nb_achat++
    if (sens === 'Vente') p.nb_vente++

    if (isAnnul(stat)) { p.nb_annule++; return }
    if (!isExec(stat)) return

    p.nb_exec++
    const montant = usdt || usdc || eur || 0

    if (sens === 'Achat') {
      p.usdt_investi += montant
      p.vol_achete   += vol
      if (prixDs > 0) p.last_prix_achat = prixDs
    } else if (sens === 'Vente') {
      p.usdt_recu += montant
      p.vol_vendu += vol
      if (prixDs > 0) p.last_prix_vente = prixDs
    }
  })

  Object.values(P).forEach(p => {
    p.position       = p.vol_achete - p.vol_vendu
    p.prix_moy       = p.vol_achete > 0 ? p.usdt_investi / p.vol_achete : 0
    p.prix_moy_vente = p.vol_vendu  > 0 ? p.usdt_recu    / p.vol_vendu  : 0

    const cout_vendu   = p.prix_moy * p.vol_vendu
    p.investi_en_cours = Math.max(0, p.usdt_investi - cout_vendu)

    p.pnl_realise = p.vol_vendu > 0 && p.prix_moy > 0
      ? p.usdt_recu - cout_vendu
      : p.usdt_recu

    p.pnl_latent = p.position > 0 && p.prix_moy > 0 && p.last_prix_achat > 0
      ? p.position * (p.last_prix_achat - p.prix_moy)
      : 0

    p.pnl_total = p.pnl_realise + p.pnl_latent

    // Champs live — initialisés à null
    p.cours_live        = null
    p.pnl_realise_live  = null
    p.pnl_latent_live   = null
    p.pnl_total_live    = null
  })

  return P
}

/**
 * Extrait les lignes brutes normalisées depuis les rows CSV/XLSX brutes.
 * Chaque ligne retournée a la forme :
 *   { date, pair, sens, statut, prix, usdt, vol, exec, annule }
 *
 * Utilisé par usePeriodFilter pour le filtrage temporel.
 */
export function extractRawRows(rows) {
  let start = 1
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].some(c => String(c).toUpperCase().includes('PAIRE'))) { start = i + 1; break }
  }

  const result = []

  rows.slice(start).forEach(r => {
    if (!r[1]) return

    const pair = normPair(r[1])
    if (!pair) return

    const dash    = r[12]
    const dashStr = String(dash).trim().toLowerCase()
    if (dash === false || dashStr === 'false' || dashStr === '0') return

    const sens   = String(r[2] || '').trim()
    const stat   = String(r[3] || '').trim()
    const prix   = parseN(r[4])
    const usdt   = parseN(r[5]) || parseN(r[6]) || parseN(r[7])
    const vol    = parseN(r[10])
    const date   = parseDate(r[0])

    result.push({
      date,
      pair,
      sens,
      statut: stat,
      prix,
      usdt,
      vol,
      exec:   isExec(stat),
      annule: isAnnul(stat),
    })
  })

  return result
}

export function enrichWithPrices(pairList, prices) {
  return pairList.map(function(p) {
    var coursLive = prices[p.name]

    if (coursLive == null || p.is_depot || p.prix_moy <= 0) {
      return Object.assign({}, p, { cours_live: coursLive != null ? coursLive : null })
    }

    var pnlRealiseLive = p.pnl_realise
    var pnlLatentLive  = p.position > 0 ? p.position * (coursLive - p.prix_moy) : 0
    var pnlTotalLive   = pnlRealiseLive + pnlLatentLive

    return Object.assign({}, p, {
      cours_live:       coursLive,
      pnl_realise_live: pnlRealiseLive,
      pnl_latent_live:  pnlLatentLive,
      pnl_total_live:   pnlTotalLive,
    })
  })
}

export function buildPairList(P) {
  return Object.values(P)
    .filter(p => p.nb_exec > 0 || p.vol_achete > 0 || p.vol_vendu > 0)
    .sort((a, b) => b.usdt_investi - a.usdt_investi)
}
