/**
 * xperps.js — Extraction & agrégation des trades XPERP (futures perpétuels)
 * ─────────────────────────────────────────────────────────────────────────────
 * Les trades XPERP sont DÉJÀ présents dans le journal : la régularisation OKX
 * (skill ydash-regul-okx) écrit une ligne par trade CLÔTURÉ. Schéma d'une ligne :
 *
 *   0 Date(+HH:MM) | 1 Paire(BASE/USDC) | 2 Sens | 3 Statut | 4 Cours |
 *   5 Montant USDT | 6 Montant USDC | 7 Montant EUR | 8 planId | 9 isRegul |
 *   10 Volume | 11 Notes | 12 Dashboard
 *
 * Repères XPERP :
 *   • Notes (col 11) préfixées « xperp »          → filtre d'isolation
 *   • Montant USDC (col 6) = PnL réalisé signé    → métrique native
 *   • Volume (col 10) = notionnel USDC
 *   • Sens (col 2) : « Achat » = clôture d'un SHORT · « Vente » = clôture d'un LONG
 *   • Date à la minute → heatmap par heure réelle possible
 *
 * Aucune donnée en R n'est stockée : le R est dérivé d'un « risque de référence »
 * (refRisk, en USDC) fourni par l'utilisateur → R = PnL / refRisk.
 */

import { normPair, parseN } from './parser.js'

/** Jours de semaine — index = Date.getDay() (0 = Dimanche). */
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/**
 * Parse une date du journal EN CONSERVANT l'heure/minute.
 * (parseDate() de process.js jette l'heure — inutilisable pour la heatmap.)
 * Formats gérés : ISO « 2024-05-01T14:30 », FR « 01/05/2024 14:30 »,
 * dates sans heure, et série Excel.
 */
export function parseDateTime(raw) {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!isNaN(n) && n > 40000 && n < 60000) {
    return new Date((n - 25569) * 86400 * 1000)
  }
  const s = String(raw).trim()
  if (!s) return null
  // ISO avec heure : 2024-05-01T14:30 (ou espace, secondes en plus)
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[T ](\d{1,2}):(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  // FR avec heure : 01/05/2024 14:30
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[T ](\d{1,2}):(\d{2})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5])
  // ISO sans heure
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  // FR sans heure
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

const isXperpNote = notes => String(notes || '').trim().toLowerCase().startsWith('xperp')

/**
 * Extrait les trades XPERP du journal brut (rows = snapshot.rows, en-tête inclus).
 * Retourne une liste d'objets triée par date croissante.
 */
export function extractXperpTrades(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  let start = 1
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i]?.some?.(c => String(c).toUpperCase().includes('PAIRE'))) { start = i + 1; break }
  }

  const out = []
  rows.slice(start).forEach(r => {
    if (!r || !r[1]) return
    if (!isXperpNote(r[11])) return

    // Respecte l'exclusion Dashboard=false (cohérence avec le reste de l'app)
    const dashStr = String(r[12]).trim().toLowerCase()
    if (r[12] === false || dashStr === 'false' || dashStr === '0') return

    const pair     = normPair(r[1])
    const sensRaw  = String(r[2] || '').trim()
    const pnl      = parseN(r[6])                 // PnL réalisé signé (USDC)
    const notional = Math.abs(parseN(r[10])) || 0 // notionnel USDC
    const prix     = parseN(r[4])
    const date     = parseDateTime(r[0])
    const notes    = String(r[11] || '')

    // Sens de l'ordre de clôture → sens réel du trade
    const side = sensRaw === 'Achat' ? 'short'
               : sensRaw === 'Vente' ? 'long'
               : 'unknown'

    const result = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be'
    const retPct = notional > 0 ? (pnl / notional) * 100 : null

    out.push({ date, pair, side, sensRaw, pnl, notional, prix, notes, result, retPct })
  })

  out.sort((a, b) => (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0))
  return out
}

/* ── Filtrage par période (fenêtres glissantes) ─────────────────────────────── */

export function periodStartXperp(period, ref = new Date()) {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  switch (period) {
    case 'jour':    return d
    case 'semaine': { const x = new Date(d); x.setDate(x.getDate() - 6);  return x }  // 7 j glissants
    case 'mois':    { const x = new Date(d); x.setDate(x.getDate() - 29); return x }  // 30 j glissants
    default:        return null                                                        // 'tout'
  }
}

export function filterByPeriod(trades, period) {
  const start = periodStartXperp(period)
  if (!start) return trades
  return trades.filter(t => t.date instanceof Date && !isNaN(t.date) && t.date >= start)
}

/* ── Agrégation ─────────────────────────────────────────────────────────────── */

function emptyStats(risk) {
  return {
    total: 0, wins: 0, losses: 0, be: 0, winRate: 0,
    pnlNet: 0, grossWin: 0, grossLoss: 0, profitFactor: 0,
    expectancyUsd: 0, avgWin: 0, avgLoss: 0,
    rNet: 0, rWon: 0, rLost: 0, expectancyR: 0,
    avgRetPct: 0, bestTrade: 0, worstTrade: 0,
    equity: [],
    pairs: [],
    hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 0, pnl: 0 })),
    dows: Array.from({ length: 7 }, (_, d) => ({ dow: d, label: DOW[d], n: 0, pnl: 0 })),
    longs: { n: 0, wins: 0, losses: 0, pnl: 0 },
    shorts: { n: 0, wins: 0, losses: 0, pnl: 0 },
    dist: [0, 0, 0, 0, 0, 0],
    best: { pair: null, worstPair: null, hour: null, dow: null },
    risk,
  }
}

/**
 * Agrège une liste de trades XPERP en statistiques exploitables.
 * @param {Array}  trades   liste issue de extractXperpTrades (déjà filtrée)
 * @param {number} refRisk  risque de référence en USDC (pour convertir en R)
 */
export function aggregateXperps(trades, refRisk = 10) {
  const risk = refRisk > 0 ? refRisk : 1
  if (!Array.isArray(trades) || trades.length === 0) return emptyStats(risk)

  const total = trades.length
  let wins = 0, losses = 0, be = 0
  let grossWin = 0, grossLoss = 0, pnlNet = 0
  let retSum = 0, retN = 0
  let best = -Infinity, worst = Infinity

  const pairMap = {}
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 0, pnl: 0 }))
  const dows  = Array.from({ length: 7 },  (_, d) => ({ dow: d, label: DOW[d], n: 0, pnl: 0 }))
  const side  = { long: { n: 0, wins: 0, losses: 0, pnl: 0 }, short: { n: 0, wins: 0, losses: 0, pnl: 0 } }
  const dist  = [0, 0, 0, 0, 0, 0] // >+2R | +1→2R | 0→1R | −1→0R | −2→−1R | <−2R
  const equity = []
  let cum = 0, cumR = 0

  trades.forEach(t => {
    pnlNet += t.pnl
    if (t.result === 'win')       { wins++;   grossWin  += t.pnl }
    else if (t.result === 'loss') { losses++; grossLoss += Math.abs(t.pnl) }
    else                            be++

    if (t.pnl > best)  best = t.pnl
    if (t.pnl < worst) worst = t.pnl
    if (t.retPct != null) { retSum += t.retPct; retN++ }

    // par paire
    const pm = pairMap[t.pair] || (pairMap[t.pair] = { pair: t.pair, n: 0, wins: 0, losses: 0, be: 0, pnl: 0, retSum: 0, retN: 0 })
    pm.n++; pm.pnl += t.pnl
    if (t.result === 'win') pm.wins++; else if (t.result === 'loss') pm.losses++; else pm.be++
    if (t.retPct != null) { pm.retSum += t.retPct; pm.retN++ }

    // heure + jour
    if (t.date instanceof Date && !isNaN(t.date)) {
      const h = t.date.getHours(); hours[h].n++; hours[h].pnl += t.pnl
      const d = t.date.getDay();   dows[d].n++;  dows[d].pnl  += t.pnl
    }

    // long / short
    if (t.side === 'long' || t.side === 'short') {
      const s = side[t.side]; s.n++; s.pnl += t.pnl
      if (t.result === 'win') s.wins++; else if (t.result === 'loss') s.losses++
    }

    // distribution en R
    const r = t.pnl / risk
    if (r > 2)        dist[0]++
    else if (r > 1)   dist[1]++
    else if (r >= 0)  dist[2]++
    else if (r >= -1) dist[3]++
    else if (r >= -2) dist[4]++
    else              dist[5]++

    // équité cumulée
    cum += t.pnl; cumR += r
    equity.push({ date: t.date, cum, cumR })
  })

  const pairs = Object.values(pairMap).map(p => ({
    ...p,
    winRate:   (p.wins + p.losses) > 0 ? (p.wins / (p.wins + p.losses)) * 100 : null,
    rNet:      p.pnl / risk,
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
    rNet: pnlNet / risk, rWon: grossWin / risk, rLost: grossLoss / risk,
    expectancyR: (pnlNet / risk) / total,
    avgRetPct: retN > 0 ? retSum / retN : 0,
    bestTrade:  best  === -Infinity ? 0 : best,
    worstTrade: worst === Infinity  ? 0 : worst,
    equity, pairs, hours, dows,
    longs: side.long, shorts: side.short,
    dist,
    best: { pair: bestPair, worstPair, hour: hourBest, dow: dowBest },
    risk,
  }
}
