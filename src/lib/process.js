import { normPair, parseN, isExec, isAnnul, isUsdPair, isRegulFlag } from './parser.js'

export function parseDate(raw) {
  if (!raw) return null
  const n = Number(raw)
  if (!isNaN(n) && n > 40000 && n < 60000) {
    const ms = (n - 25569) * 86400 * 1000
    return new Date(ms)
  }
  const s = String(raw).trim()
  if (!s) return null
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`)
  const iso = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (iso) return new Date(`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`)
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
      _nb_achat_exec:  0,
      _nb_vente_exec:  0,
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
      p.usdt_investi  += montant
      p.vol_achete    += vol
      if (prixDs > 0) {
        p.last_prix_achat = prixDs
        p._nb_achat_exec++
      }
    } else if (sens === 'Vente') {
      p.usdt_recu += montant
      p.vol_vendu += vol
      if (prixDs > 0) {
        p.last_prix_vente = prixDs
        p._nb_vente_exec++
      }
    }
  })

  Object.values(P).forEach(p => {
    // ── Position nette ──────────────────────────────────────
    p.position    = p.vol_achete - p.vol_vendu
    p.netPosition = p.position

    // ── Moyennes pondérées par volume ───────────────────────
    p.avgBuyPrice  = p.vol_achete > 0 ? p.usdt_investi / p.vol_achete : 0
    p.avgSellPrice = p.vol_vendu  > 0 ? p.usdt_recu    / p.vol_vendu  : null

    // compat legacy
    p.prix_moy       = p.avgBuyPrice
    p.prix_moy_vente = p.avgSellPrice || 0

    // ── Coût des ventes au prix moyen d'achat ───────────────
    const cout_vendu   = p.avgBuyPrice * p.vol_vendu
    p.investi_en_cours = Math.max(0, p.usdt_investi - cout_vendu)
    p.amountInvested   = p.usdt_investi

    // ── PnL réalisé ─────────────────────────────────────────
    // = ce qu'on a reçu en vendant − ce que ça nous avait coûté (au prix moy. achat)
    p.pnl_realise = p.vol_vendu > 0 && p.avgBuyPrice > 0
      ? p.usdt_recu - cout_vendu
      : 0

    // ── Breakeven ────────────────────────────────────────────
    // = capital encore engagé / position nette restante
    p.breakeven = p.netPosition > 0
      ? p.investi_en_cours / p.netPosition
      : 0

    // ── PnL latent (journal — basé sur dernier prix saisi) ───
    p.pnl_latent = p.netPosition > 0 && p.breakeven > 0 && p.last_prix_achat > 0
      ? p.netPosition * (p.last_prix_achat - p.breakeven)
      : 0

    p.pnl_total = p.pnl_realise + p.pnl_latent

    // ── Pourcentages PnL ─────────────────────────────────────
    const base = p.amountInvested || 1
    p.pnlRealizedPct = p.pnl_realise / base * 100
    p.pnlLatentPct   = p.pnl_latent  / base * 100
    p.pnlTotalPct    = p.pnl_total   / base * 100

    // ── Compteurs ordres ─────────────────────────────────────
    p.totalOrders     = p.nb_total
    p.executedOrders  = p.nb_exec
    p.cancelledOrders = p.nb_annule
    p.buyOrders       = p.nb_achat
    p.sellOrders      = p.nb_vente
    p.buyOrdersCount  = p._nb_achat_exec
    p.sellOrdersCount = p._nb_vente_exec

    // ── Champs live — initialisés à null ─────────────────────
    p.cours_live        = null
    p.pnl_realise_live  = null
    p.pnl_latent_live   = null
    p.pnl_total_live    = null
  })

  return P
}

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
    const planId = String(r[8] || '').trim()
    const isRegul = isRegulFlag(r[9])
    result.push({ date, pair, sens, statut: stat, prix, usdt, vol, exec: isExec(stat), annule: isAnnul(stat), planId, isRegul })
  })

  return result
}

export function enrichWithPrices(pairList, prices, priceSources = {}) {
  return pairList.map(function(p) {
    const coursLive = prices[p.name]

    if (coursLive == null || p.is_depot || p.avgBuyPrice <= 0) {
      return Object.assign({}, p, {
        cours_live:   coursLive != null ? coursLive : null,
        priceSource:  coursLive != null ? (priceSources[p.name] ?? null) : null,
      })
    }
    
    // PnL réalisé ne change pas avec le cours live
    const pnlRealiseLive = p.pnl_realise

    // PnL latent live = (cours actuel − breakeven) × position nette
    const pnlLatentLive = p.netPosition > 0 && p.breakeven > 0
      ? p.netPosition * (coursLive - p.breakeven)
      : 0

    const pnlTotalLive = pnlRealiseLive + pnlLatentLive

    const base = p.amountInvested || 1
    const pnlRealizedPctLive = pnlRealiseLive / base * 100
    const pnlLatentPctLive   = pnlLatentLive  / base * 100
    const pnlTotalPctLive    = pnlTotalLive   / base * 100

    // Valeur actuelle de la position
    const currentValue = p.netPosition * coursLive

    // Deltas prix vs références
    const deltaVsAvgBuy      = coursLive - p.avgBuyPrice
    const deltaVsAvgBuyPct   = p.avgBuyPrice > 0 ? deltaVsAvgBuy / p.avgBuyPrice * 100 : null
    const deltaVsAvgSell     = p.avgSellPrice != null ? coursLive - p.avgSellPrice : null
    const deltaVsAvgSellPct  = p.avgSellPrice != null && p.avgSellPrice > 0
      ? deltaVsAvgSell / p.avgSellPrice * 100 : null
    const deltaVsBreakeven    = p.breakeven > 0 ? coursLive - p.breakeven : null
    const deltaVsBreakevenPct = p.breakeven > 0 ? deltaVsBreakeven / p.breakeven * 100 : null

    return Object.assign({}, p, {
      cours_live:           coursLive,
      currentPrice:         coursLive,
      currentValue,
      pnl_realise_live:     pnlRealiseLive,
      pnl_latent_live:      pnlLatentLive,
      pnl_total_live:       pnlTotalLive,
      pnlRealizedPctLive,
      pnlLatentPctLive,
      pnlTotalPctLive,
      deltaVsAvgBuy,
      deltaVsAvgBuyPct,
      deltaVsAvgSell,
      deltaVsAvgSellPct,
      deltaVsBreakeven,
      deltaVsBreakevenPct,
      priceSource: priceSources[p.name] ?? null
    })
  })
}

export function buildPairList(P) {
  return Object.values(P)
    .filter(p => p.nb_exec > 0 || p.vol_achete > 0 || p.vol_vendu > 0)
    .sort((a, b) => b.usdt_investi - a.usdt_investi)
}
