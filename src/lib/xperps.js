/**
 * xperps.js — Agrégation des trades XPERP lus depuis la collection Firestore
 * `users/{uid}/xperps` (documents figés par le skill, schéma v1).
 *
 * Plus aucune extraction depuis le journal : chaque document porte déjà
 * netPnlUsd, rMultiple (R EXACT via le stop), returnPct, result, side,
 * closeHourLocal, closeDowLocal, riskModel… On se contente de filtrer par
 * période et de sommer.
 */

// index = (ISO weekday 1..7) − 1  → 1=Lundi … 7=Dimanche
const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const num = v => (v == null || isNaN(+v)) ? 0 : +v

/* ── Filtrage par période (fenêtres glissantes, heure locale du navigateur) ─── */
export function periodStartXperp(period, ref = new Date()) {
  const d = new Date(ref); d.setHours(0, 0, 0, 0)
  switch (period) {
    case 'jour':    return d.getTime()
    case 'semaine': { const x = new Date(d); x.setDate(x.getDate() - 6);  return x.getTime() }
    case 'mois':    { const x = new Date(d); x.setDate(x.getDate() - 29); return x.getTime() }
    default:        return null   // 'tout'
  }
}

export function filterByPeriod(docs, period) {
  const start = periodStartXperp(period)
  if (start == null) return docs
  return docs.filter(d => num(d.closeTimeMs) >= start)
}

/* ── Agrégation ─────────────────────────────────────────────────────────────── */
function emptyStats() {
  return {
    total: 0, wins: 0, losses: 0, be: 0, winRate: 0,
    pnlNet: 0, grossWin: 0, grossLoss: 0, profitFactor: 0,
    expectancyUsd: 0, avgWin: 0, avgLoss: 0,
    rNet: 0, rWon: 0, rLost: 0, expectancyR: 0,
    avgRetPct: 0, bestTrade: 0, worstTrade: 0,
    equity: [],
    pairs: [],
    hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 0, pnl: 0 })),
    dows:  Array.from({ length: 7 },  (_, i) => ({ dow: i + 1, label: DOW[i], n: 0, pnl: 0 })),
    longs:  { n: 0, wins: 0, losses: 0, pnl: 0, rNet: 0 },
    shorts: { n: 0, wins: 0, losses: 0, pnl: 0, rNet: 0 },
    dist: [0, 0, 0, 0, 0, 0],
    best: { pair: null, worstPair: null, hour: null, dow: null },
    exactCount: 0, fixedCount: 0,
  }
}

export function aggregateXperps(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return emptyStats()

  const trades = [...docs].sort((a, b) => num(a.closeTimeMs) - num(b.closeTimeMs))
  const total = trades.length

  let wins = 0, losses = 0, be = 0
  let grossWin = 0, grossLoss = 0, pnlNet = 0
  let rNet = 0, rWon = 0, rLost = 0
  let retSum = 0, retN = 0
  let best = -Infinity, worst = Infinity
  let exactCount = 0, fixedCount = 0

  const pairMap = {}
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 0, pnl: 0 }))
  const dows  = Array.from({ length: 7 },  (_, i) => ({ dow: i + 1, label: DOW[i], n: 0, pnl: 0 }))
  const side  = { long: { n: 0, wins: 0, losses: 0, pnl: 0, rNet: 0 },
                  short: { n: 0, wins: 0, losses: 0, pnl: 0, rNet: 0 } }
  const dist  = [0, 0, 0, 0, 0, 0]     // >+2R | +1→2R | 0→1R | −1→0R | −2→−1R | <−2R
  const equity = []
  let cum = 0, cumR = 0

  trades.forEach(t => {
    const net = num(t.netPnlUsd)
    const r   = num(t.rMultiple)
    const ret = t.returnPct == null ? null : num(t.returnPct)
    const res = t.result || (net > 0 ? 'win' : net < 0 ? 'loss' : 'be')

    pnlNet += net; rNet += r
    if (res === 'win')       { wins++;   grossWin  += net; if (r > 0) rWon  += r }
    else if (res === 'loss') { losses++; grossLoss += -net; if (r < 0) rLost += -r }
    else                       be++
    if (net > best)  best = net
    if (net < worst) worst = net
    if (ret != null) { retSum += ret; retN++ }
    if (t.riskModel === 'fixed') fixedCount++; else exactCount++

    // par paire
    const key = t.pair || t.instId || '—'
    const pm = pairMap[key] || (pairMap[key] = { pair: key, n: 0, wins: 0, losses: 0, be: 0, pnl: 0, rNet: 0, retSum: 0, retN: 0 })
    pm.n++; pm.pnl += net; pm.rNet += r
    if (res === 'win') pm.wins++; else if (res === 'loss') pm.losses++; else pm.be++
    if (ret != null) { pm.retSum += ret; pm.retN++ }

    // heure + jour (champs locaux figés)
    const h = t.closeHourLocal
    if (h != null && h >= 0 && h < 24) { hours[h].n++; hours[h].pnl += net }
    const wd = t.closeDowLocal
    if (wd != null && wd >= 1 && wd <= 7) { dows[wd - 1].n++; dows[wd - 1].pnl += net }

    // long / short
    if (t.side === 'long' || t.side === 'short') {
      const s = side[t.side]; s.n++; s.pnl += net; s.rNet += r
      if (res === 'win') s.wins++; else if (res === 'loss') s.losses++
    }

    // distribution en R (exact)
    if (r > 2)        dist[0]++
    else if (r > 1)   dist[1]++
    else if (r >= 0)  dist[2]++
    else if (r >= -1) dist[3]++
    else if (r >= -2) dist[4]++
    else              dist[5]++

    // équité cumulée
    cum += net; cumR += r
    equity.push({ date: t.closeTime, cum, cumR })
  })

  const pairs = Object.values(pairMap).map(p => ({
    ...p,
    winRate:   (p.wins + p.losses) > 0 ? (p.wins / (p.wins + p.losses)) * 100 : null,
    avgRetPct: p.retN > 0 ? p.retSum / p.retN : null,
  })).sort((a, b) => b.pnl - a.pnl)

  const bestPair  = pairs.length ? pairs[0] : null
  const worstPair = pairs.length ? pairs[pairs.length - 1] : null
  const hourBest  = hours.filter(h => h.n > 0).sort((a, b) => b.pnl - a.pnl)[0] || null
  const dowBest   = dows.filter(d => d.n > 0).sort((a, b) => b.pnl - a.pnl)[0] || null

  return {
    total, wins, losses, be,
    winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
    pnlNet, grossWin, grossLoss,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
    expectancyUsd: pnlNet / total,
    avgWin:  wins   > 0 ? grossWin  / wins   : 0,
    avgLoss: losses > 0 ? grossLoss / losses : 0,
    rNet, rWon, rLost, expectancyR: rNet / total,
    avgRetPct: retN > 0 ? retSum / retN : 0,
    bestTrade:  best  === -Infinity ? 0 : best,
    worstTrade: worst === Infinity  ? 0 : worst,
    equity, pairs, hours, dows,
    longs: side.long, shorts: side.short,
    dist,
    best: { pair: bestPair, worstPair, hour: hourBest, dow: dowBest },
    exactCount, fixedCount,
  }
}
