import { normPair, parseN, isExec, isAnnul, isUsdPair } from './parser.js'

/**
 * Transforme les lignes brutes du journal en objets par paire
 * avec tous les calculs financiers (PnL réalisé, latent, positions…)
 */
export function process(rows) {
  // Trouve la ligne d'en-tête
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

    // Colonne Dashboard (index 12) : si false → ligne exclue du calcul
    const dash = r[12]
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

    // ── Ligne DÉPÔT ──
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

  // ── Calculs dérivés (statiques, basés sur le journal) ──
  Object.values(P).forEach(p => {
    p.position       = p.vol_achete - p.vol_vendu
    p.prix_moy       = p.vol_achete > 0 ? p.usdt_investi / p.vol_achete : 0
    p.prix_moy_vente = p.vol_vendu  > 0 ? p.usdt_recu    / p.vol_vendu  : 0

    const cout_vendu   = p.prix_moy * p.vol_vendu
    p.investi_en_cours = Math.max(0, p.usdt_investi - cout_vendu)

    // PnL basés sur le JOURNAL (dernier prix enregistré)
    p.pnl_realise = p.vol_vendu > 0 && p.prix_moy > 0
      ? p.usdt_recu - cout_vendu
      : p.usdt_recu

    p.pnl_latent = p.position > 0 && p.prix_moy > 0 && p.last_prix_achat > 0
      ? p.position * (p.last_prix_achat - p.prix_moy)
      : 0

    p.pnl_total = p.pnl_realise + p.pnl_latent

    // PnL live : initialisés à null (calculés dynamiquement dans enrichWithPrices)
    p.prix_live          = null
    p.pnl_realise_live   = null
    p.pnl_latent_live    = null
    p.pnl_total_live     = null
  })

  return P
}

/**
 * Enrichit les paires avec les prix live et recalcule les PnL live.
 * Appelé par useTrading à chaque mise à jour des prix.
 * @param {Object[]} pairList - liste issue de buildPairList()
 * @param {Object}   prices   - map pairName → prix USD
 * @returns {Object[]} nouvelle liste avec champs _live calculés
 */
export function enrichWithPrices(pairList, prices) {
  return pairList.map(p => {
    const livePrice = prices[p.name]

    if (!livePrice || p.is_depot || p.prix_moy <= 0) {
      return { ...p, prix_live: livePrice ?? null }
    }

    const cout_vendu = p.prix_moy * p.vol_vendu

    // PnL Réalisé live : même calcul que journal (les ventes sont déjà exécutées)
    // On recalcule en restant cohérent — la seule différence sera sur le latent
    const pnl_realise_live = p.pnl_realise // identique, les ventes sont closes

    // PnL Latent live : position ouverte × (prix live − prix moyen d'achat)
    const pnl_latent_live = p.position > 0
      ? p.position * (livePrice - p.prix_moy)
      : 0

    const pnl_total_live = pnl_realise_live + pnl_latent_live

    return {
      ...p,
      prix_live,
      pnl_realise_live,
      pnl_latent_live,
      pnl_total_live,
    }
  })
}

/** Retourne la liste triée des paires actives à partir de process() */
export function buildPairList(P) {
  return Object.values(P)
    .filter(p => p.nb_exec > 0 || p.vol_achete > 0 || p.vol_vendu > 0)
    .sort((a, b) => b.usdt_investi - a.usdt_investi)
}
