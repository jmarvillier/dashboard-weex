/**
 * priceRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetcher de cours temps réel — cascade par type d'actif :
 *   Crypto  → Binance → Kraken → CryptoCompare
 *   Métaux  → Metals.live → Kraken (XAG/XAU) → CryptoCompare
 */

const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP'])
// Paires métaux précieux (ne sont pas sur Binance)
const METALS  = new Set(['XAG','XAU','XPT','XPD'])

function getBase(pair)   { return pair.split('/')[0].toUpperCase() }
function getQuote(pair)  { return (pair.split('/')[1] || 'USDT').toUpperCase() }
function isTrading(pair) { return !STABLES.has(getBase(pair)) }
function isMetal(pair)   { return METALS.has(getBase(pair)) }
function isCrypto(pair)  { return isTrading(pair) && !isMetal(pair) }

// Timeout compatible Safari / iOS (pas de AbortSignal.timeout)
function fetchWithTimeout(url, ms = 7000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

// ── Source Métaux : metals.live ──────────────────────────────────────────────
// API gratuite, sans clé, prix en USD / troy oz
// https://metals.live

const METALS_LIVE_MAP = {
  'XAG': 'silver',
  'XAU': 'gold',
  'XPT': 'platinum',
  'XPD': 'palladium',
}

async function fromMetalsLive(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (metalPairs.length === 0) return {}

  const res = await fetchWithTimeout('https://api.metals.live/v1/spot', 8000)
  if (!res.ok) throw new Error(`metals.live ${res.status}`)
  const data = await res.json()
  // Réponse : [{ silver: 29.5, gold: 2050, ... }] ou { silver: 29.5, ... }
  const obj = Array.isArray(data) ? data[0] : data

  const prices = {}
  for (const p of metalPairs) {
    const key = METALS_LIVE_MAP[getBase(p)]
    if (key && obj[key] != null) {
      prices[p] = parseFloat(obj[key])
    }
  }
  return prices
}

// ── Source 1 : Binance ───────────────────────────────────────────────────────

async function fromBinance(pairs) {
  const cryptoPairs = pairs.filter(isCrypto)
  if (cryptoPairs.length === 0) return {}

  const symbols = cryptoPairs.map(p => `"${getBase(p)}${getQuote(p)}"`)
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=[${symbols.join(',')}]`

  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Binance ${res.status}`)
  const data = await res.json()

  const prices = {}
  for (const p of cryptoPairs) {
    const sym   = `${getBase(p)}${getQuote(p)}`
    const entry = data.find(d => d.symbol === sym)
    if (entry?.price) prices[p] = parseFloat(entry.price)
  }
  return prices
}

// ── Source 2 : Kraken ────────────────────────────────────────────────────────

const KRAKEN_MAP = {
  // Crypto
  'BTC/USDT':  'XBTUSDT',  'ETH/USDT':  'ETHUSDT',   'SOL/USDT':  'SOLUSDT',
  'XRP/USDT':  'XRPUSDT',  'ADA/USDT':  'ADAUSDT',   'DOT/USDT':  'DOTUSDT',
  'DOGE/USDT': 'DOGEUSDT', 'AVAX/USDT': 'AVAXUSDT',  'LINK/USDT': 'LINKUSDT',
  'LTC/USDT':  'LTCUSDT',  'ATOM/USDT': 'ATOMUSDT',  'UNI/USDT':  'UNIUSDT',
  'NEAR/USDT': 'NEARUSDT', 'ARB/USDT':  'ARBUSDT',   'OP/USDT':   'OPUSDT',
  'BTC/USD':   'XBTUSD',   'ETH/USD':   'ETHUSD',
  // Métaux précieux (Kraken cote XAG et XAU en USD)
  'XAG/USDT':  'XXAGUSD',  'XAG/USD':   'XXAGUSD',
  'XAU/USDT':  'XXAUUSD',  'XAU/USD':   'XXAUUSD',
}

async function fromKraken(pairs) {
  const pairsToFetch = pairs.filter(p => isTrading(p))
  if (pairsToFetch.length === 0) return {}

  const krakenPairs = pairsToFetch
    .map(p => ({ pair: p, kraken: KRAKEN_MAP[p] ?? `${getBase(p)}USDT` }))

  const pairParam = krakenPairs.map(x => x.kraken).join(',')
  const url = `https://api.kraken.com/0/public/Ticker?pair=${pairParam}`

  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Kraken ${res.status}`)
  const data = await res.json()
  if (data.error && data.error.length > 0) throw new Error(`Kraken: ${data.error[0]}`)

  const prices = {}
  const resultKeys = Object.keys(data.result || {})
  for (const { pair, kraken } of krakenPairs) {
    const key = resultKeys.find(k => k === kraken || k.includes(getBase(pair)))
    if (key && data.result[key]?.c?.[0]) {
      prices[pair] = parseFloat(data.result[key].c[0])
    }
  }
  return prices
}

// ── Source 3 : CryptoCompare ─────────────────────────────────────────────────

async function fromCryptoCompare(pairs) {
  const trading = pairs.filter(isTrading)
  if (trading.length === 0) return {}

  const fsyms = [...new Set(trading.map(getBase))].join(',')
  const url = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=USD,USDT`

  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`CryptoCompare ${res.status}`)
  const data = await res.json()
  if (data.Response === 'Error') throw new Error(`CryptoCompare: ${data.Message}`)

  const prices = {}
  for (const p of trading) {
    const entry = data[getBase(p)]
    if (entry?.USDT)     prices[p] = entry.USDT
    else if (entry?.USD) prices[p] = entry.USD
  }
  return prices
}

// ── API publique ──────────────────────────────────────────────────────────────

export async function fetchLivePrices(pairNames) {
  const trading = pairNames.filter(isTrading)
  if (trading.length === 0) return { prices: {}, source: 'none' }

  const metalPairs  = trading.filter(isMetal)
  const cryptoPairs = trading.filter(isCrypto)
  const prices      = {}
  let   source      = 'none'

  // ── Métaux : metals.live en premier ─────────────────────────────────────
  if (metalPairs.length > 0) {
    try {
      const metalPrices = await fromMetalsLive(metalPairs)
      Object.assign(prices, metalPrices)
      if (Object.keys(metalPrices).length > 0) source = 'Metals.live'
    } catch (e) {
      console.warn('[prices] metals.live failed:', e.message)
    }

    // Fallback Kraken pour les métaux non obtenus
    const missingMetals = metalPairs.filter(p => prices[p] === undefined)
    if (missingMetals.length > 0) {
      try {
        const krakenMetals = await fromKraken(missingMetals)
        Object.assign(prices, krakenMetals)
        if (Object.keys(krakenMetals).length > 0 && source === 'none') source = 'Kraken'
      } catch (e) {
        console.warn('[prices] Kraken metals failed:', e.message)
      }
    }
  }

  // ── Crypto : Binance en premier ──────────────────────────────────────────
  if (cryptoPairs.length > 0) {
    try {
      const binancePrices = await fromBinance(cryptoPairs)
      Object.assign(prices, binancePrices)
      if (Object.keys(binancePrices).length > 0) {
        source = source === 'none' ? 'Binance' : `${source} + Binance`
      }

      // Paires crypto manquantes → CryptoCompare
      const missing = cryptoPairs.filter(p => prices[p] === undefined)
      if (missing.length > 0) {
        try {
          const extra = await fromCryptoCompare(missing)
          Object.assign(prices, extra)
        } catch { /* silencieux */ }
      }
    } catch (e) {
      console.warn('[prices] Binance failed:', e.message)

      // Fallback Kraken crypto
      try {
        const krakenPrices = await fromKraken(cryptoPairs)
        Object.assign(prices, krakenPrices)
        if (Object.keys(krakenPrices).length > 0) {
          source = source === 'none' ? 'Kraken' : `${source} + Kraken`
        }
      } catch (e2) {
        console.warn('[prices] Kraken crypto failed:', e2.message)
      }

      // Fallback CryptoCompare crypto
      const stillMissing = cryptoPairs.filter(p => prices[p] === undefined)
      if (stillMissing.length > 0) {
        try {
          const ccPrices = await fromCryptoCompare(stillMissing)
          Object.assign(prices, ccPrices)
          if (Object.keys(ccPrices).length > 0) {
            source = source === 'none' ? 'CryptoCompare' : `${source} + CryptoCompare`
          }
        } catch (e3) {
          console.warn('[prices] CryptoCompare failed:', e3.message)
        }
      }
    }
  }

  if (Object.keys(prices).length === 0) return { prices: {}, source: 'error' }
  return { prices, source }
}
