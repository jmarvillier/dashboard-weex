/**
 * priceRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cours temps réel par cascade :
 *   Métaux  → Bitfinex → metals.live → jsDelivr CDN (fawazahmed0)
 *   Crypto  → Binance  → Kraken      → CryptoCompare
 *
 * ⚠️  Kraken ne cote PLUS XAG/XAU depuis 2019 — retiré définitivement
 */

const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP'])
const METALS  = new Set(['XAG','XAU','XPT','XPD'])

function getBase(pair)   { return pair.split('/')[0].toUpperCase() }
function getQuote(pair)  { return (pair.split('/')[1] || 'USDT').toUpperCase() }
function isTrading(pair) { return !STABLES.has(getBase(pair)) }
function isMetal(pair)   { return METALS.has(getBase(pair)) }
function isCrypto(pair)  { return isTrading(pair) && !isMetal(pair) }

function fetchWithTimeout(url, ms = 8000) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

// ── Helper de debug ───────────────────────────────────────────────────────────
function dbg(label, data) {
  console.debug(`[prices] ${label}`, data)
}

async function trySource(label, fn) {
  try {
    const result = await fn()
    if (Object.keys(result).length > 0) {
      dbg(`✅ ${label}`, result)
      return result
    }
    dbg(`⚠️  ${label} → réponse vide`, {})
    return {}
  } catch (e) {
    dbg(`❌ ${label} → ${e.message}`, {})
    return {}
  }
}

// ── MÉTAUX : Source 1 — Bitfinex ─────────────────────────────────────────────
// Bitfinex cote XAG/USD en temps réel, API publique avec CORS
// Réponse : [BID, BID_SIZE, ASK, ASK_SIZE, CHANGE, CHANGE_PCT, LAST, VOLUME, HIGH, LOW]
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
    if (Array.isArray(data) && data[6] != null) {
      prices[p] = parseFloat(data[6])
    }
  }))
  return prices
}

// ── MÉTAUX : Source 2 — metals.live ──────────────────────────────────────────
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

// ── MÉTAUX : Source 3 — jsDelivr CDN (fawazahmed0) ───────────────────────────
// CDN statique, jamais de CORS, mis à jour quotidiennement
// https://github.com/fawazahmed0/exchange-api
const FAWAZ_KEY = { XAG: 'xag', XAU: 'xau', XPT: 'xpt', XPD: 'xpd' }

async function fromJsDelivrMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (!metalPairs.length) return {}

  const prices = {}
  await Promise.all(metalPairs.map(async p => {
    const key = FAWAZ_KEY[getBase(p)]
    if (!key) return
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${key}.json`
    const res  = await fetchWithTimeout(url, 8000)
    if (!res.ok) throw new Error(`jsDelivr ${key} → HTTP ${res.status}`)
    const data = await res.json()
    // data.xag.usd = prix de 1 troy oz d'argent en USD
    const usdPrice = data?.[key]?.usd
    if (usdPrice != null) prices[p] = parseFloat(usdPrice)
  }))
  return prices
}

// ── CRYPTO : Source 1 — Binance ───────────────────────────────────────────────
async function fromBinance(pairs) {
  const cp = pairs.filter(isCrypto)
  if (!cp.length) return {}

  const symbols = cp.map(p => `"${getBase(p)}${getQuote(p)}"`)
  const res  = await fetchWithTimeout(
    `https://api.binance.com/api/v3/ticker/price?symbols=[${symbols.join(',')}]`
  )
  if (!res.ok) throw new Error(`Binance → HTTP ${res.status}`)
  const data = await res.json()

  const prices = {}
  for (const p of cp) {
    const sym   = `${getBase(p)}${getQuote(p)}`
    const entry = data.find(d => d.symbol === sym)
    if (entry?.price) prices[p] = parseFloat(entry.price)
  }
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

  const entries = cp.map(p => ({
    pair: p, sym: KRAKEN_CRYPTO[p] ?? `${getBase(p)}USDT`
  }))
  const res = await fetchWithTimeout(
    `https://api.kraken.com/0/public/Ticker?pair=${entries.map(e => e.sym).join(',')}`
  )
  if (!res.ok) throw new Error(`Kraken → HTTP ${res.status}`)
  const data = await res.json()
  if (data.error?.length) throw new Error(`Kraken: ${data.error[0]}`)

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

// ── Helper : complète les trous ───────────────────────────────────────────────
function mergeMissing(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (target[k] === undefined) target[k] = v
  }
}

// ── API publique ──────────────────────────────────────────────────────────────
export async function fetchLivePrices(pairNames) {
  const trading = pairNames.filter(isTrading)
  if (!trading.length) return { prices: {}, source: 'none' }

  const metals  = trading.filter(isMetal)
  const cryptos = trading.filter(isCrypto)
  const prices  = {}
  const sources = []

  console.group('[prices] fetchLivePrices')
  dbg('Paires demandées', { metals, cryptos })

  // ── Métaux ─────────────────────────────────────────────────────────────────
  if (metals.length) {
    // 1. Bitfinex
    const bf = await trySource('Bitfinex-metals', () => fromBitfinexMetals(metals))
    mergeMissing(prices, bf)
    if (Object.keys(bf).length) sources.push('Bitfinex')

    // 2. metals.live pour les manquants
    const miss1 = metals.filter(p => prices[p] === undefined)
    if (miss1.length) {
      const ml = await trySource('metals.live', () => fromMetalsLive(miss1))
      mergeMissing(prices, ml)
      if (Object.keys(ml).length) sources.push('Metals.live')
    }

    // 3. jsDelivr CDN comme filet ultime
    const miss2 = metals.filter(p => prices[p] === undefined)
    if (miss2.length) {
      const cdn = await trySource('jsDelivr-CDN', () => fromJsDelivrMetals(miss2))
      mergeMissing(prices, cdn)
      if (Object.keys(cdn).length) sources.push('jsDelivr')
    }
  }

  // ── Crypto ─────────────────────────────────────────────────────────────────
  if (cryptos.length) {
    // 1. Binance
    const bn = await trySource('Binance', () => fromBinance(cryptos))
    mergeMissing(prices, bn)
    if (Object.keys(bn).length) sources.push('Binance')

    // 2. Kraken pour les manquants
    const miss1 = cryptos.filter(p => prices[p] === undefined)
    if (miss1.length) {
      const kr = await trySource('Kraken-crypto', () => fromKrakenCrypto(miss1))
      mergeMissing(prices, kr)
      if (Object.keys(kr).length) sources.push('Kraken')
    }

    // 3. CryptoCompare pour les manquants
    const miss2 = cryptos.filter(p => prices[p] === undefined)
    if (miss2.length) {
      const cc = await trySource('CryptoCompare', () => fromCryptoCompare(miss2))
      mergeMissing(prices, cc)
      if (Object.keys(cc).length) sources.push('CryptoCompare')
    }
  }

  dbg('Résultat final', prices)
  console.groupEnd()

  if (!Object.keys(prices).length) return { prices: {}, source: 'error' }
  return { prices, source: [...new Set(sources)].join(' + ') }
}
