/**
 * priceRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetcher de cours temps réel — 3 sources en cascade :
 *   1. Binance
 *   2. Kraken
 *   3. CryptoCompare
 */

const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP'])

function getBase(pair)   { return pair.split('/')[0].toUpperCase() }
function getQuote(pair)  { return (pair.split('/')[1] || 'USDT').toUpperCase() }
function isTrading(pair) { return !STABLES.has(getBase(pair)) }

// Timeout compatible Safari / iOS (pas de AbortSignal.timeout)
function fetchWithTimeout(url, ms = 7000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

// ── Source 1 : Binance ───────────────────────────────────────────────────────

async function fromBinance(pairs) {
  const trading = pairs.filter(isTrading)
  if (trading.length === 0) return {}

  const symbols = trading.map(p => `"${getBase(p)}${getQuote(p)}"`)
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=[${symbols.join(',')}]`

  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Binance ${res.status}`)
  const data = await res.json()

  const prices = {}
  for (const p of trading) {
    const sym   = `${getBase(p)}${getQuote(p)}`
    const entry = data.find(d => d.symbol === sym)
    if (entry?.price) prices[p] = parseFloat(entry.price)
  }
  return prices
}

// ── Source 2 : Kraken ────────────────────────────────────────────────────────

const KRAKEN_MAP = {
  'BTC/USDT':  'XBTUSDT',  'ETH/USDT':  'ETHUSDT',   'SOL/USDT':  'SOLUSDT',
  'XRP/USDT':  'XRPUSDT',  'ADA/USDT':  'ADAUSDT',   'DOT/USDT':  'DOTUSDT',
  'DOGE/USDT': 'DOGEUSDT', 'AVAX/USDT': 'AVAXUSDT',  'LINK/USDT': 'LINKUSDT',
  'LTC/USDT':  'LTCUSDT',  'ATOM/USDT': 'ATOMUSDT',  'UNI/USDT':  'UNIUSDT',
  'NEAR/USDT': 'NEARUSDT', 'ARB/USDT':  'ARBUSDT',   'OP/USDT':   'OPUSDT',
  'BTC/USD':   'XBTUSD',   'ETH/USD':   'ETHUSD',
}

async function fromKraken(pairs) {
  const trading = pairs.filter(isTrading)
  if (trading.length === 0) return {}

  const krakenPairs = trading
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
    if (entry?.USDT)      prices[p] = entry.USDT
    else if (entry?.USD)  prices[p] = entry.USD
  }
  return prices
}

// ── API publique ──────────────────────────────────────────────────────────────

export async function fetchLivePrices(pairNames) {
  const trading = pairNames.filter(isTrading)
  if (trading.length === 0) return { prices: {}, source: 'none' }

  // Source 1 : Binance
  try {
    const prices = await fromBinance(trading)
    // Paires manquantes (XAG, XAU…) → CryptoCompare en complément
    const missing = trading.filter(p => prices[p] === undefined)
    if (missing.length > 0) {
      try {
        const extra = await fromCryptoCompare(missing)
        Object.assign(prices, extra)
      } catch { /* silencieux */ }
    }
    if (Object.keys(prices).length > 0) return { prices, source: 'Binance' }
    throw new Error('Aucun résultat')
  } catch (e) {
    console.warn('[prices] Binance failed:', e.message)
  }

  // Source 2 : Kraken
  try {
    const prices = await fromKraken(trading)
    if (Object.keys(prices).length > 0) return { prices, source: 'Kraken' }
    throw new Error('Aucun résultat')
  } catch (e) {
    console.warn('[prices] Kraken failed:', e.message)
  }

  // Source 3 : CryptoCompare
  try {
    const prices = await fromCryptoCompare(trading)
    if (Object.keys(prices).length > 0) return { prices, source: 'CryptoCompare' }
    throw new Error('Aucun résultat')
  } catch (e) {
    console.warn('[prices] CryptoCompare failed:', e.message)
  }

  return { prices: {}, source: 'error' }
}
