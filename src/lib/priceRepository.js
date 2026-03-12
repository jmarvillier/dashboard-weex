/**
 * priceRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetcher de cours temps réel avec fallback multi-sources :
 *   1. Binance (paires USDT, très fiable, CORS permissif)
 *   2. CoinGecko (fallback, peut être bloqué selon environnement)
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBaseSymbol(pairName) {
  return pairName.split('/')[0].toUpperCase()
}

function getQuoteSymbol(pairName) {
  return (pairName.split('/')[1] || 'USDT').toUpperCase()
}

const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP'])

function isTradingPair(pairName) {
  return !STABLES.has(getBaseSymbol(pairName))
}

// ── Source 1 : Binance ───────────────────────────────────────────────────────

/**
 * Binance ticker API — renvoie les prix pour une liste de symboles XXXUSDT
 * CORS ouvert, pas de clé requise, rate limit généreux.
 */
async function fetchFromBinance(pairNames) {
  const symbols = pairNames
    .filter(isTradingPair)
    .map(p => `${getBaseSymbol(p)}${getQuoteSymbol(p)}`)  // ex: BTCUSDT

  if (symbols.length === 0) return {}

  // Binance bookTicker : prix ask/bid pour une liste de symboles
  const qs = symbols.length === 1
    ? `symbol=${symbols[0]}`
    : `symbols=${encodeURIComponent(JSON.stringify(symbols))}`

  const url = `https://api.binance.com/api/v3/ticker/price?${qs}`

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)
  const data = await res.json()

  // data peut être un objet ou un tableau selon le nombre de symboles
  const arr = Array.isArray(data) ? data : [data]

  const prices = {}
  for (const pairName of pairNames) {
    const sym = `${getBaseSymbol(pairName)}${getQuoteSymbol(pairName)}`
    const entry = arr.find(d => d.symbol === sym)
    if (entry?.price) prices[pairName] = parseFloat(entry.price)
  }
  return prices
}

// ── Source 2 : CoinGecko ─────────────────────────────────────────────────────

const COINGECKO_IDS = {
  BTC:  'bitcoin',        ETH:  'ethereum',       BNB:  'binancecoin',
  SOL:  'solana',         XRP:  'ripple',          ADA:  'cardano',
  DOGE: 'dogecoin',       DOT:  'polkadot',        MATIC:'matic-network',
  POL:  'matic-network',  AVAX: 'avalanche-2',     LINK: 'chainlink',
  LTC:  'litecoin',       UNI:  'uniswap',         ATOM: 'cosmos',
  XLM:  'stellar',        NEAR: 'near',            APT:  'aptos',
  ARB:  'arbitrum',       OP:   'optimism',        INJ:  'injective-protocol',
  SUI:  'sui',            TIA:  'celestia',        JUP:  'jupiter-exchange-solana',
  WIF:  'dogwifcoin',     PEPE: 'pepe',            BONK: 'bonk',
  FIL:  'filecoin',       ICP:  'internet-computer', FTM: 'fantom',
  SAND: 'the-sandbox',    MANA: 'decentraland',    AXS:  'axie-infinity',
  GALA: 'gala',           ENJ:  'enjincoin',       CRV:  'curve-dao-token',
  AAVE: 'aave',           MKR:  'maker',           COMP: 'compound-governance-token',
  SNX:  'synthetix-network-token', LDO: 'lido-dao', RPL: 'rocket-pool',
  RUNE: 'thorchain',      ALGO: 'algorand',        VET:  'vechain',
  HBAR: 'hedera-hashgraph', ETC: 'ethereum-classic', BCH: 'bitcoin-cash',
  TRX:  'tron',           TON:  'the-open-network', SHIB: 'shiba-inu',
  FLOKI:'floki',          SEI:  'sei-network',     STX:  'blockstack',
  XAG:  'silver',         XAU:  'gold',
  GRT:  'the-graph',      SUSHI:'sushi',           YFI:  'yearn-finance',
  '1INCH':'1inch',        CAKE: 'pancakeswap-token', APE: 'apecoin',
}

async function fetchFromCoinGecko(pairNames) {
  const idMap = {}
  const cgIds = []
  for (const pair of pairNames.filter(isTradingPair)) {
    const sym = getBaseSymbol(pair)
    const id  = COINGECKO_IDS[sym]
    if (id) { idMap[pair] = id; if (!cgIds.includes(id)) cgIds.push(id) }
  }
  if (cgIds.length === 0) return {}

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=usd`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
  const data = await res.json()

  const prices = {}
  for (const [pair, cgId] of Object.entries(idMap)) {
    if (data[cgId]?.usd) prices[pair] = data[cgId].usd
  }
  return prices
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Récupère les prix live avec fallback automatique Binance → CoinGecko.
 * @param {string[]} pairNames - ex: ['BTC/USDT', 'ETH/USDT', 'XAG/USDT']
 * @returns {Promise<{ prices: Object, source: string }>}
 */
export async function fetchLivePrices(pairNames) {
  const trading = pairNames.filter(isTradingPair)
  if (trading.length === 0) return { prices: {}, source: 'none' }

  // Tentative 1 : Binance
  try {
    const prices = await fetchFromBinance(trading)
    // Binance ne couvre pas XAG, XAU — complète avec CoinGecko si nécessaire
    const missing = trading.filter(p => prices[p] === undefined)
    if (missing.length > 0) {
      try {
        const extra = await fetchFromCoinGecko(missing)
        Object.assign(prices, extra)
      } catch {
        // CoinGecko en fallback partiel — on ignore l'erreur
      }
    }
    const found = Object.keys(prices).length
    if (found > 0) return { prices, source: 'Binance' }
    throw new Error('Aucun prix retourné par Binance')
  } catch (binanceErr) {
    console.warn('[priceRepository] Binance failed:', binanceErr.message, '→ Fallback CoinGecko')
  }

  // Tentative 2 : CoinGecko
  try {
    const prices = await fetchFromCoinGecko(trading)
    return { prices, source: 'CoinGecko' }
  } catch (cgErr) {
    console.warn('[priceRepository] CoinGecko failed:', cgErr.message)
    return { prices: {}, source: 'error' }
  }
}
