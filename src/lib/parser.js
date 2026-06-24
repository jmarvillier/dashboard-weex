/** Normalise le nom d'une paire */
export function normPair(p) {
  p = String(p).trim()
  if (p === 'XAGUSDT') return 'XAG/USDT'
  if (p === 'XAUUSDT') return 'XAU/USDT'
  if (p === 'BTCUSDT') return 'BTC/USDT'
  if (p === 'ETHUSDT') return 'ETH/USDT'
  return p
}

/**
 * Parse une valeur numérique.
 * Règle : le point ET la virgule sont des séparateurs décimaux — jamais de milliers.
 *   "1.456"    → 1.456   (volume XAG, pas 1456)
 *   "1,456"    → 1.456
 *   "1.626,95" → 1626.95 (format européen : point=milliers, virgule=décimal)
 *   "99.03984" → 99.03984
 */
export function parseN(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  let s = String(v).replace(/\s/g, '').replace(/["""]/g, '')

  const hasDot   = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // Format européen explicite : 1.234,56 → 1234.56
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    // Virgule seule = décimal : 1,456 → 1.456
    s = s.replace(',', '.')
  }
  // Point seul = déjà décimal, rien à faire

  return parseFloat(s) || 0
}

/** Parse une ligne CSV en tableau de cellules (gère les guillemets) */
export function parseCSV(text) {
  return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
    const cells = []; let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cells.push(cur.trim())
    return cells
  })
}

/** Statut "exécuté" — tolère espaces, accents manquants, casse */
export function isExec(stat) {
  const s = stat.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return s === 'execute' || s.startsWith('execut')
}

/** Statut "annulé" */
export function isAnnul(stat) {
  return stat.trim().toLowerCase().includes('annul')
}

/** Paire de type USD* (stablecoin / dépôt) */
export function isUsdPair(pair) {
  return /^usd/i.test(pair.trim())
}

/**
 * Flag technique « régularisation » (col 9 du journal).
 * Mis à true par l'import de régularisation, remis à false (vide) une fois
 * la ligne affiliée à un plan. Tolère booléen, "true", "1" ou "regul".
 */
export function isRegulFlag(v) {
  if (v === true) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'regul'
}
