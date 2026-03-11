/** Normalise le nom d'une paire */
export function normPair(p) {
  p = String(p).trim()
  if (p === 'XAGUSDT') return 'XAG/USDT'
  if (p === 'BTCUSDT') return 'BTC/USDT'
  if (p === 'ETHUSDT') return 'ETH/USDT'
  return p
}

/** Parse une valeur numérique (gère virgule/point, espaces, guillemets) */
export function parseN(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  let s = String(v).replace(/\s/g, '').replace(/["""]/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
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
