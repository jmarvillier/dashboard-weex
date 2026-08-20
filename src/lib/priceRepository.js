/**
 * priceRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cours temps réel par cascade :
 *   Métaux  → Bitfinex → OKX → Stooq → Yahoo Finance → metals.live → CF-Pages → jsDelivr
 *   Crypto  → Binance  → Kraken → CryptoCompare
 */

const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP'])
const METALS  = new Set(['XAG','XAU','XPT','XPD'])

const QUOTE_SUFFIXES = ['USDT','USDC','FDUSD','BUSD','TUSD','DAI','EUR','USD']

/**
 * Découpe une paire en base/quote.
 * Tolère les libellés SANS slash ("SOLUSDT") en plus de "SOL/USDT".
 * Sans ce garde-fou, "SOLUSDT" donnait base="SOLUSDT" + quote="USDT"
 * → symbole "SOLUSDTUSDT" → 400 Binance → TOUTE la batch tombait.
 */
function splitPair(pair) {
  const raw = String(pair).trim().toUpperCase()
  if (raw.includes('/')) {
    const [b, q] = raw.split('/')
    return { base: b, quote: (q || 'USDT') }
  }
  for (const q of QUOTE_SUFFIXES) {
    if (raw.length > q.length && raw.endsWith(q)) {
      return { base: raw.slice(0, -q.length), quote: q }
    }
  }
  return { base: raw, quote: 'USDT' }
}

function getBase(pair)   { return splitPair(pair).base }
function getQuote(pair)  { return splitPair(pair).quote }
function isTrading(pair) { return !STABLES.has(getBase(pair)) }
function isMetal(pair)   { return METALS.has(getBase(pair)) }
function isCrypto(pair)  { return isTrading(pair) && !isMetal(pair) }

function fetchWithTimeout(url, ms = 8000) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function dbg(label, data) { console.debug(`[prices] ${label}`, data) }

async function trySource(label, fn) {
  try {
    const result = await fn()
    if (Object.keys(result).length > 0) { dbg(`✅ ${label}`, result); return result }
    dbg(`⚠️  ${label} → réponse vide`, {})
    return {}
  } catch (e) {
    dbg(`❌ ${label} → ${e.message}`, {})
    return {}
  }
}

// ── MÉTAUX : Source 1 — Bitfinex ─────────────────────────────────────────────
const BITFINEX_METALS = { XAG: 'tXAGUSD', XAU: 'tXAUUSD', XPT: 'tXPTUSD', XPD: 'tXPDUSD' }

async function fromBitfinexMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}
  const prices = {}
  await Promise.all(metalPairs.map(async p => {
    const sym = BITFINEX_METALS[getBase(p)]
    if (!sym) return
    const res  = await fetchWithTimeout(`https://api-pub.bitfinex.com/v2/ticker/${sym}`, 8000)
    if (!res.ok) throw new Error(`Bitfinex ${sym} → HTTP ${res.status}`)
    const data = await res.json()
    // data[6] = LAST_PRICE
    if (Array.isArray(data) && data[6] != null) prices[p] = parseFloat(data[6])
  }))
  return prices
}

// ── MÉTAUX : Source 2 — GoldPrice.org ────────────────────────────────────────
// API publique temps réel, CORS ouvert, pas de clé API
// Retourne XAU et XAG en USD directement
async function fromGoldPrice(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}

  const res  = await fetchWithTimeout('https://data-asg.goldprice.org/dbXRates/USD', 8000)
  if (!res.ok) throw new Error(`GoldPrice → HTTP ${res.status}`)
  const data = await res.json()

  // data.items[0] = { xauPrice, xagPrice, ... }
  const item   = data?.items?.[0]
  if (!item) throw new Error('GoldPrice → structure inattendue')

  const MAP = { XAG: 'xagPrice', XAU: 'xauPrice' }
  const prices = {}
  for (const p of metalPairs) {
    const key = MAP[getBase(p)]
    if (key && item[key] != null) prices[p] = parseFloat(item[key])
  }
  return prices
}

// ── MÉTAUX : Source 2 — OKX ──────────────────────────────────────────────────
// Perpetual swap XAG-USD-SWAP, temps réel, CORS ouvert
const OKX_METALS = { XAG: 'XAG-USD-SWAP', XAU: 'XAU-USD-SWAP' }

async function fromOkxMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}
  const prices = {}
  await Promise.all(metalPairs.map(async p => {
    const instId = OKX_METALS[getBase(p)]
    if (!instId) return
    const res  = await fetchWithTimeout(
      `https://www.okx.com/api/v5/market/ticker?instId=${instId}`, 8000
    )
    if (!res.ok) throw new Error(`OKX ${instId} → HTTP ${res.status}`)
    const data  = await res.json()
    const last  = data?.data?.[0]?.last
    if (last != null) prices[p] = parseFloat(last)
  }))
  return prices
}

// ── MÉTAUX : Source 3 — Stooq ────────────────────────────────────────────────
// CSV public (~15 min delay), pas de clé API
const STOOQ_METALS = { XAG: 'xagusd', XAU: 'xauusd', XPT: 'xptusd', XPD: 'xpdusd' }

async function fromStooqMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}
  const prices = {}
  await Promise.all(metalPairs.map(async p => {
    const sym = STOOQ_METALS[getBase(p)]
    if (!sym) return
    const url = `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`
    const res  = await fetchWithTimeout(url, 8000)
    if (!res.ok) throw new Error(`Stooq ${sym} → HTTP ${res.status}`)
    const txt  = await res.text()
    // Format CSV : Symbol,Date,Time,Open,High,Low,Close,Volume
    const lines = txt.trim().split('\n')
    if (lines.length < 2) throw new Error(`Stooq ${sym} → CSV vide`)
    const cols  = lines[1].split(',')
    const close = parseFloat(cols[6])   // colonne Close
    if (!isNaN(close) && close > 0) prices[p] = close
  }))
  return prices
}

// ── MÉTAUX : Source 4 — Yahoo Finance ────────────────────────────────────────
const YAHOO_METALS = { XAG: 'XAGUSD=X', XAU: 'XAUUSD=X', XPT: 'XPTUSD=X', XPD: 'XPDUSD=X' }

async function fromYahooFinanceMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}
  const prices = {}
  await Promise.all(metalPairs.map(async p => {
    const sym = YAHOO_METALS[getBase(p)]
    if (!sym) return
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d&includePrePost=false`
    const res  = await fetchWithTimeout(url, 8000)
    if (!res.ok) throw new Error(`Yahoo ${sym} → HTTP ${res.status}`)
    const data  = await res.json()
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (price != null) prices[p] = parseFloat(price)
  }))
  return prices
}

// ── MÉTAUX : Source 5 — metals.live ──────────────────────────────────────────
const METALS_LIVE_KEY = { XAG: 'silver', XAU: 'gold', XPT: 'platinum', XPD: 'palladium' }

async function fromMetalsLive(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}
  const res  = await fetchWithTimeout('https://api.metals.live/v1/spot', 8000)
  if (!res.ok) throw new Error(`metals.live → HTTP ${res.status}`)
  const data = await res.json()
  const obj  = Array.isArray(data) ? data[0] : data
  const prices = {}
  for (const p of metalPairs) {
    const key = METALS_LIVE_KEY[getBase(p)]
    if (key && obj[key] != null) prices[p] = parseFloat(obj[key])
  }
  return prices
}

// ── MÉTAUX : Source 6 — Cloudflare Pages (fawazahmed0) ───────────────────────
const FAWAZ_KEY = { XAG: 'xag', XAU: 'xau', XPT: 'xpt', XPD: 'xpd' }

async function fromCloudflareMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}
  const prices = {}
  await Promise.all(metalPairs.map(async p => {
    const key = FAWAZ_KEY[getBase(p)]
    if (!key) return
    const url = `https://latest.currency-api.pages.dev/v1/currencies/${key}.json`
    const res  = await fetchWithTimeout(url, 8000)
    if (!res.ok) throw new Error(`CF-Pages ${key} → HTTP ${res.status}`)
    const data = await res.json()
    const usdPrice = data?.[key]?.usd
    if (usdPrice != null) prices[p] = parseFloat(usdPrice)
  }))
  return prices
}

// ── MÉTAUX : Source 7 — jsDelivr CDN (fawazahmed0) — filet ultime ────────────
async function fromJsDelivrMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}
  const today = new Date().toISOString().slice(0, 10)
  const prices = {}
  await Promise.all(metalPairs.map(async p => {
    const key = FAWAZ_KEY[getBase(p)]
    if (!key) return
    const urls = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${today}/v1/currencies/${key}.json`,
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${key}.json`,
    ]
    for (const url of urls) {
      try {
        const res  = await fetchWithTimeout(url, 6000)
        if (!res.ok) continue
        const data = await res.json()
        const usdPrice = data?.[key]?.usd
        if (usdPrice != null) { prices[p] = parseFloat(usdPrice); break }
      } catch { /* essai suivant */ }
    }
  }))
  return prices
}

// ── CRYPTO : Source 0 — OKX (référence, 1 seul appel) ────────────────────────
// GET /api/v5/market/tickers?instType=SPOT → ~1400 instruments d'un coup.
// Pas de clé, CORS ouvert, et c'est l'exchange réellement tradé.
// Avantage clé : un symbole inconnu n'invalide PAS les autres.
let _okxCache = { at: 0, map: null }

async function okxSpotMap() {
  if (_okxCache.map && Date.now() - _okxCache.at < 30_000) return _okxCache.map
  const res = await fetchWithTimeout('https://www.okx.com/api/v5/market/tickers?instType=SPOT', 8000)
  if (!res.ok) throw new Error(`OKX tickers → HTTP ${res.status}`)
  const data = await res.json()
  if (data?.code !== '0' || !Array.isArray(data.data)) throw new Error(`OKX tickers → code ${data?.code}`)
  const map = new Map()
  for (const t of data.data) {
    const last = parseFloat(t.last)
    if (t.instId && !isNaN(last) && last > 0) map.set(t.instId, last)
  }
  _okxCache = { at: Date.now(), map }
  return map
}

async function fromOkxCrypto(pairs) {
  const cp = pairs.filter(isCrypto)
  if (!cp.length) return {}
  const map = await okxSpotMap()
  const prices = {}
  for (const p of cp) {
    const { base, quote } = splitPair(p)
    // quote demandée d'abord, puis équivalents stables
    for (const q of [quote, 'USDT', 'USDC', 'USD']) {
      const v = map.get(`${base}-${q}`)
      if (v != null) { prices[p] = v; break }
    }
  }
  return prices
}

// ── CRYPTO : Source 1 — Binance ───────────────────────────────────────────────
async function fromBinance(pairs) {
  const cp = pairs.filter(isCrypto)
  if (!cp.length) return {}
  const prices = {}
  // Requêtes UNITAIRES : l'endpoint batch renvoie 400 (-1121 Invalid symbol)
  // dès qu'UN seul symbole est inconnu → on perdait tous les cours d'un coup.
  await Promise.allSettled(cp.map(async p => {
    const sym = `${getBase(p)}${getQuote(p)}`
    const res = await fetchWithTimeout(
      `https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, 8000
    )
    if (!res.ok) return
    const data = await res.json()
    const v = parseFloat(data?.price)
    if (!isNaN(v) && v > 0) prices[p] = v
  }))
  return prices
}

// ── CRYPTO : Source 2 — Kraken ────────────────────────────────────────────────
const KRAKEN_CRYPTO = {
  'BTC/USDT':  'XBTUSDT',  'ETH/USDT':  'ETHUSDT',  'SOL/USDT':  'SOLUSDT',
  'XRP/USDT':  'XRPUSDT',  'ADA/USDT':  'ADAUSDT',  'DOT/USDT':  'DOTUSDT',
  'DOGE/USDT': 'DOGEUSDT', 'AVAX/USDT': 'AVAXUSDT', 'LINK/USDT': 'LINKUSDT',
  'LTC/USDT':  'LTCUSDT',  'ATOM/USDT': 'ATOMUSDT', 'UNI/USDT':  'UNIUSDT',
  'NEAR/USDT': 'NEARUSDT', 'ARB/USDT':  'ARBUSDT',  'OP/USDT':   'OPUSDT',
  'POL/USDT':  'POLUSDT',  'MATIC/USDT':'MATICUSDT',
}

async function fromKrakenCrypto(pairs) {
  const cp = pairs.filter(isCrypto)
  if (!cp.length) return {}
  const entries = cp.map(p => ({ pair: p, sym: KRAKEN_CRYPTO[p] ?? `${getBase(p)}USDT` }))
  const res = await fetchWithTimeout(
    `https://api.kraken.com/0/public/Ticker?pair=${entries.map(e => e.sym).join(',')}`
  )
  if (!res.ok) throw new Error(`Kraken → HTTP ${res.status}`)
  const data = await res.json()
  // Kraken renvoie une erreur par symbole inconnu tout en servant les autres :
  // on ne jette QUE si rien n'est exploitable.
  if (data.error?.length && !Object.keys(data.result || {}).length) {
    throw new Error(`Kraken: ${data.error[0]}`)
  }
  const prices = {}
  const keys   = Object.keys(data.result || {})
  for (const { pair, sym } of entries) {
    const key = keys.find(k => k === sym || k.includes(getBase(pair)))
    if (key && data.result[key]?.c?.[0]) prices[pair] = parseFloat(data.result[key].c[0])
  }
  return prices
}

// ── CRYPTO : Source 3 — CryptoCompare ────────────────────────────────────────
async function fromCryptoCompare(pairs) {
  const cp = pairs.filter(isCrypto)
  if (!cp.length) return {}
  const fsyms = [...new Set(cp.map(getBase))].join(',')
  const res   = await fetchWithTimeout(
    `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=USD,USDT`
  )
  if (!res.ok) throw new Error(`CryptoCompare → HTTP ${res.status}`)
  const data  = await res.json()
  if (data.Response === 'Error') throw new Error(`CryptoCompare: ${data.Message}`)
  const prices = {}
  for (const p of cp) {
    const entry = data[getBase(p)]
    if (entry?.USDT != null)     prices[p] = entry.USDT
    else if (entry?.USD != null) prices[p] = entry.USD
  }
  return prices
}

// ── Helper : merge prix + sources ─────────────────────────────────────────────
function mergeMissing(prices, priceSources, sourceResult, sourceName) {
  for (const [k, v] of Object.entries(sourceResult)) {
    if (prices[k] === undefined) {
      prices[k]       = v
      priceSources[k] = sourceName
    }
  }
}

// ── API publique ──────────────────────────────────────────────────────────────
export async function fetchLivePrices(pairNames) {
  const trading = pairNames.filter(isTrading)
  if (!trading.length) return { prices: {}, priceSources: {}, source: 'none' }

  const metals  = trading.filter(isMetal)
  const cryptos = trading.filter(isCrypto)
  const prices       = {}
  const priceSources = {}
  const sources      = []

  console.group('[prices] fetchLivePrices')
  dbg('Paires demandées', { metals, cryptos })

  // ── Métaux ─────────────────────────────────────────────────────────────────
  if (metals.length) {
    // 1. Bitfinex
    const bf = await trySource('Bitfinex-metals', () => fromBitfinexMetals(metals))
    mergeMissing(prices, priceSources, bf, 'Bitfinex')
    if (Object.keys(bf).length) sources.push('Bitfinex')

    // 2. GoldPrice.org
    const miss1 = metals.filter(p => prices[p] === undefined)
    if (miss1.length) {
      const gp = await trySource('GoldPrice', () => fromGoldPrice(miss1))
      mergeMissing(prices, priceSources, gp, 'GoldPrice')
      if (Object.keys(gp).length) sources.push('GoldPrice')
    }

    // 3. OKX
    const miss2 = metals.filter(p => prices[p] === undefined)
    if (miss2.length) {
      const okx = await trySource('OKX-metals', () => fromOkxMetals(miss2))
      mergeMissing(prices, priceSources, okx, 'OKX')
      if (Object.keys(okx).length) sources.push('OKX')
    }

    // 4. Stooq
    const miss3 = metals.filter(p => prices[p] === undefined)
    if (miss3.length) {
      const stooq = await trySource('Stooq-metals', () => fromStooqMetals(miss3))
      mergeMissing(prices, priceSources, stooq, 'Stooq')
      if (Object.keys(stooq).length) sources.push('Stooq')
    }

    // 5. Yahoo Finance
    const miss4 = metals.filter(p => prices[p] === undefined)
    if (miss4.length) {
      const yf = await trySource('Yahoo-metals', () => fromYahooFinanceMetals(miss4))
      mergeMissing(prices, priceSources, yf, 'Yahoo')
      if (Object.keys(yf).length) sources.push('Yahoo')
    }

    // 6. metals.live
    const miss5 = metals.filter(p => prices[p] === undefined)
    if (miss5.length) {
      const ml = await trySource('metals.live', () => fromMetalsLive(miss5))
      mergeMissing(prices, priceSources, ml, 'Metals.live')
      if (Object.keys(ml).length) sources.push('Metals.live')
    }

    // 7. Cloudflare Pages
    const miss6 = metals.filter(p => prices[p] === undefined)
    if (miss6.length) {
      const cf = await trySource('CF-Pages', () => fromCloudflareMetals(miss6))
      mergeMissing(prices, priceSources, cf, 'CF-Pages')
      if (Object.keys(cf).length) sources.push('CF-Pages')
    }

    // 8. jsDelivr — filet ultime
    const miss7 = metals.filter(p => prices[p] === undefined)
    if (miss7.length) {
      const cdn = await trySource('jsDelivr-CDN', () => fromJsDelivrMetals(miss7))
      mergeMissing(prices, priceSources, cdn, 'jsDelivr')
      if (Object.keys(cdn).length) sources.push('jsDelivr')
    }
  }
  
  // ── Crypto ─────────────────────────────────────────────────────────────────
  if (cryptos.length) {
    // 0. OKX — référence
    const okxC = await trySource('OKX-crypto', () => fromOkxCrypto(cryptos))
    mergeMissing(prices, priceSources, okxC, 'OKX')
    if (Object.keys(okxC).length) sources.push('OKX')

    // 1. Binance
    const missB = cryptos.filter(p => prices[p] === undefined)
    const bn = missB.length ? await trySource('Binance', () => fromBinance(missB)) : {}
    mergeMissing(prices, priceSources, bn, 'Binance')
    if (Object.keys(bn).length) sources.push('Binance')

    // 2. Kraken
    const miss1 = cryptos.filter(p => prices[p] === undefined)
    if (miss1.length) {
      const kr = await trySource('Kraken-crypto', () => fromKrakenCrypto(miss1))
      mergeMissing(prices, priceSources, kr, 'Kraken')
      if (Object.keys(kr).length) sources.push('Kraken')
    }

    // 3. CryptoCompare
    const miss2 = cryptos.filter(p => prices[p] === undefined)
    if (miss2.length) {
      const cc = await trySource('CryptoCompare', () => fromCryptoCompare(miss2))
      mergeMissing(prices, priceSources, cc, 'CryptoCompare')
      if (Object.keys(cc).length) sources.push('CryptoCompare')
    }
  }

  dbg('Résultat final', { prices, priceSources })
  console.groupEnd()

  if (!Object.keys(prices).length) return { prices: {}, priceSources: {}, source: 'error' }
  return { prices, priceSources, source: [...new Set(sources)].join(' + ') }
}
