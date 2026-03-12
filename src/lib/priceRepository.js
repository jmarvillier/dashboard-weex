/**
 * priceRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetcher de cours temps réel via CoinGecko (API publique, sans clé).
 * Fait le mapping paire → ID CoinGecko et expose fetchLivePrices().
 */

// Mapping symbole → ID CoinGecko (enrichir au besoin)
const COINGECKO_IDS = {
  BTC:  'bitcoin',
  ETH:  'ethereum',
  BNB:  'binancecoin',
  SOL:  'solana',
  XRP:  'ripple',
  ADA:  'cardano',
  DOGE: 'dogecoin',
  DOT:  'polkadot',
  MATIC:'matic-network',
  POL:  'matic-network',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  LTC:  'litecoin',
  UNI:  'uniswap',
  ATOM: 'cosmos',
  XLM:  'stellar',
  NEAR: 'near',
  APT:  'aptos',
  ARB:  'arbitrum',
  OP:   'optimism',
  INJ:  'injective-protocol',
  SUI:  'sui',
  TIA:  'celestia',
  JUP:  'jupiter-exchange-solana',
  WIF:  'dogwifcoin',
  PEPE: 'pepe',
  BONK: 'bonk',
  FIL:  'filecoin',
  ICP:  'internet-computer',
  FTM:  'fantom',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS:  'axie-infinity',
  GALA: 'gala',
  ENJ:  'enjincoin',
  CRV:  'curve-dao-token',
  AAVE: 'aave',
  MKR:  'maker',
  COMP: 'compound-governance-token',
  SNX:  'synthetix-network-token',
  LDO:  'lido-dao',
  RPL:  'rocket-pool',
  RUNE: 'thorchain',
  ALGO: 'algorand',
  VET:  'vechain',
  HBAR: 'hedera-hashgraph',
  ETC:  'ethereum-classic',
  BCH:  'bitcoin-cash',
  TRX:  'tron',
  TON:  'the-open-network',
  SHIB: 'shiba-inu',
  FLOKI:'floki',
  SEI:  'sei-network',
  STX:  'blockstack',
  EGLD: 'elrond-erd-2',
  FLOW: 'flow',
  MINA: 'mina-protocol',
  ZIL:  'zilliqa',
  KAVA: 'kava',
  ONE:  'harmony',
  ZEN:  'zencash',
  CAKE: 'pancakeswap-token',
  GMT:  'stepn',
  APE:  'apecoin',
  WOO:  'woo-network',
  GRT:  'the-graph',
  BAL:  'balancer',
  YFI:  'yearn-finance',
  SUSHI:'sushi',
  '1INCH':'1inch',
}

/**
 * Extrait le symbole base d'une paire (ex: "BTC/USDT" → "BTC")
 */
function getBaseSymbol(pairName) {
  return pairName.split('/')[0].toUpperCase()
}

/**
 * Récupère les prix live depuis CoinGecko pour une liste de paires.
 * @param {string[]} pairNames - ex: ['BTC/USDT', 'ETH/USDT']
 * @returns {Promise<Object>} map pairName → prix USD
 */
export async function fetchLivePrices(pairNames) {
  // Filtre les paires USD stables (USDT, USDC…) et dépôts
  const tradingPairs = pairNames.filter(n => {
    const base = getBaseSymbol(n)
    return !['USDT','USDC','BUSD','DAI','TUSD','FDUSD'].includes(base)
  })

  // Résout les IDs CoinGecko disponibles
  const idMap = {} // pairName → cgId
  const cgIds = []
  for (const pair of tradingPairs) {
    const sym = getBaseSymbol(pair)
    const id  = COINGECKO_IDS[sym]
    if (id) { idMap[pair] = id; if (!cgIds.includes(id)) cgIds.push(id) }
  }

  if (cgIds.length === 0) return {}

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=usd`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
    const data = await res.json()

    // Reconstruit la map pairName → prix
    const prices = {}
    for (const [pair, cgId] of Object.entries(idMap)) {
      const entry = data[cgId]
      if (entry?.usd) prices[pair] = entry.usd
    }
    return prices
  } catch (err) {
    console.warn('[priceRepository] fetchLivePrices error:', err.message)
    return {}
  }
}
