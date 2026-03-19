/**
 * priceRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Cours temps réel — cascade par type d'actif :
 *   Métaux  → Kraken (XAG/XAU) → metals.live → CryptoCompare
 *   Crypto  → Binance → Kraken → CryptoCompare
 */

const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP'])
const METALS  = new Set(['XAG','XAU','XPT','XPD'])

function getBase(pair)   { return pair.split('/')[0].toUpperCase() }
function getQuote(pair)  { return (pair.split('/')[1] || 'USDT').toUpperCase() }
function isTrading(pair) { return !STABLES.has(getBase(pair)) }
function isMetal(pair)   { return METALS.has(getBase(pair)) }
function isCrypto(pair)  { return isTrading(pair) && !isMetal(pair) }

// Timeout compatible Safari / iOS
function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

// ── Métaux : Kraken (prioritaire — CORS garanti, vraie bourse) ────────────────
//  Kraken cote les métaux précieux sans préfixe XX
const KRAKEN_METALS_MAP = {
  'XAG': 'XAGUSD',  // argent / silver
  'XAU': 'XAUUSD',  // or / gold
  'XPT': 'XPTUSD',  // platine
  'XPD': 'XPDUSD',  // palladium
}

async function fromKrakenMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (metalPairs.length === 0) return {}

  const entries = metalPairs.map(p => ({
    pair: p,
    krakenSym: KRAKEN_METALS_MAP[getBase(p)] ?? `${getBase(p)}USD`,
  }))

  const paramStr = entries.map(e => e.krakenSym).join(',')
  const url = `https://api.kraken.com/0/public/Ticker?pair=${paramStr}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Kraken metals ${res.status}`)
  const data = await res.json()
  if (data.error?.length) throw new Error(`Kraken metals: ${data.error[0]}`)

  const prices = {}
  const keys   = Object.keys(data.result || {})
  for (const { pair, krakenSym } of entries) {
    // Kraken peut répondre avec le sym exact ou une variante
    const key = keys.find(k =>
      k === krakenSym ||
      k.startsWith(getBase(pair)) ||
      k.includes(getBase(pair))
    )
    if (key && data.result[key]?.c?.[0]) {
      prices[pair] = parseFloat(data.result[key].c[0])
    }
  }
  return prices
}

// ── Métaux : metals.live (fallback) ──────────────────────────────────────────
const METALS_LIVE_KEY = { XAG: 'silver', XAU: 'gold', XPT: 'platinum', XPD: 'palladium' }

async function fromMetalsLive(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (metalPairs.length === 0) return {}

  const res = await fetchWithTimeout('https://api.metals.live/v1/spot', 8000)
  if (!res.ok) throw new Error(`metals.live ${res.status}`)
  const data = await res.json()
  const obj  = Array.isArray(data) ? data[0] : data

  const prices = {}
  for (const p of metalPairs) {
    const key = METALS_LIVE_KEY[getBase(p)]
    if (key && obj[key] != null) prices[p] = parseFloat(obj[key])
  }
  return prices
}

// ── Métaux : CryptoCompare (dernier recours) ─────────────────────────────────
async function fromCryptoCompareMetals(pairs) {
  const metalPairs = pairs.filter(isMetal)
  if (metalPairs.length === 0) return {}

  const fsyms = [...new Set(metalPairs.map(getBase))].join(',')
  const url   = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=USD`
  const res   = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`CryptoCompare metals ${res.status}`)
  const data  = await res.json()
  if (data.Response === 'Error') throw new Error(`CC: ${data.Message}`)

  const prices = {}
  for (const p of metalPairs) {
    const entry = data[getBase(p)]
    if (entry?.USD != null) prices[p] = entry.USD
  }
  return prices
}

// ── Crypto : Binance ─────────────────────────────────────────────────────────
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

// ── Crypto : Kraken ───────────────────────────────────────────────────────────
const KRAKEN_CRYPTO_MAP = {
  'BTC/USDT':  'XBTUSDT',  'ETH/USDT':  'ETHUSDT',  'SOL/USDT':  'SOLUSDT',
  'XRP/USDT':  'XRPUSDT',  'ADA/USDT':  'ADAUSDT',  'DOT/USDT':  'DOTUSDT',
  'DOGE/USDT': 'DOGEUSDT', 'AVAX/USDT': 'AVAXUSDT', 'LINK/USDT': 'LINKUSDT',
  'LTC/USDT':  'LTCUSDT',  'ATOM/USDT': 'ATOMUSDT', 'UNI/USDT':  'UNIUSDT',
  'NEAR/USDT': 'NEARUSDT', 'ARB/USDT':  'ARBUSDT',  'OP/USDT':   'OPUSDT',
  'BTC/USD':   'XBTUSD',   'ETH/USD':   'ETHUSD',
  'POL/USDT':  'POLUSDT',  'MATIC/USDT':'MATICUSDT',
}

async function fromKrakenCrypto(pairs) {
  const cryptoPairs = pairs.filter(isCrypto)
  if (cryptoPairs.length === 0) return {}

  const entries = cryptoPairs.map(p => ({
    pair: p,
    krakenSym: KRAKEN_CRYPTO_MAP[p] ?? `${getBase(p)}USDT`,
  }))

  const paramStr = entries.map(e => e.krakenSym).join(',')
  const url = `https://api.kraken.com/0/public/Ticker?pair=${paramStr}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Kraken crypto ${res.status}`)
  const data = await res.json()
  if (data.error?.length) throw new Error(`Kraken: ${data.error[0]}`)

  const prices = {}
  const keys   = Object.keys(data.result || {})
  for (const { pair, krakenSym } of entries) {
    const key = keys.find(k => k === krakenSym || k.includes(getBase(pair)))
    if (key && data.result[key]?.c?.[0]) {
      prices[pair] = parseFloat(data.result[key].c[0])
    }
  }
  return prices
}

// ── Crypto : CryptoCompare ────────────────────────────────────────────────────
async function fromCryptoCompare(pairs) {
  const cryptoPairs = pairs.filter(isCrypto)
  if (cryptoPairs.length === 0) return {}

  const fsyms = [...new Set(cryptoPairs.map(getBase))].join(',')
  const url   = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=USD,USDT`
  const res   = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`CryptoCompare ${res.status}`)
  const data  = await res.json()
  if (data.Response === 'Error') throw new Error(`CC: ${data.Message}`)

  const prices = {}
  for (const p of cryptoPairs) {
    const entry = data[getBase(p)]
    if (entry?.USDT != null)     prices[p] = entry.USDT
    else if (entry?.USD != null) prices[p] = entry.USD
  }
  return prices
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function tryGet(label, fn) {
  try {
    const result = await fn()
    console.info(`[prices] ✓ ${label}:`, result)
    return result
  } catch (e) {
    console.warn(`[prices] ✗ ${label}:`, e.message)
    return {}
  }
}

function mergeMissing(prices, extra) {
  for (const [k, v] of Object.entries(extra)) {
    if (prices[k] === undefined) prices[k] = v
  }
}

// ── API publique ──────────────────────────────────────────────────────────────

export async function fetchLivePrices(pairNames) {
  const trading     = pairNames.filter(isTrading)
  if (trading.length === 0) return { prices: {}, source: 'none' }

  const metalPairs  = trading.filter(isMetal)
  const cryptoPairs = trading.filter(isCrypto)
  const prices      = {}
  const sources     = []

  // ── 1. Métaux : Kraken (prioritaire) ──────────────────────────────────────
  if (metalPairs.length > 0) {
    const krakenM = await tryGet('Kraken-metals', () => fromKrakenMetals(metalPairs))
    mergeMissing(prices, krakenM)
    if (Object.keys(krakenM).length > 0) sources.push('Kraken')

    // Fallback metals.live
    const stillMissingM = metalPairs.filter(p => prices[p] === undefined)
    if (stillMissingM.length > 0) {
      const liveM = await tryGet('metals.live', () => fromMetalsLive(stillMissingM))
      mergeMissing(prices, liveM)
      if (Object.keys(liveM).length > 0) sources.push('Metals.live')
    }

    // Fallback CryptoCompare pour métaux
    const stillMissingM2 = metalPairs.filter(p => prices[p] === undefined)
    if (stillMissingM2.length > 0) {
      const ccM = await tryGet('CC-metals', () => fromCryptoCompareMetals(stillMissingM2))
      mergeMissing(prices, ccM)
      if (Object.keys(ccM).length > 0) sources.push('CryptoCompare')
    }
  }

  // ── 2. Crypto : Binance (prioritaire) ─────────────────────────────────────
  if (cryptoPairs.length > 0) {
    const binance = await tryGet('Binance', () => fromBinance(cryptoPairs))
    mergeMissing(prices, binance)
    if (Object.keys(binance).length > 0) sources.push('Binance')

    // Fallback Kraken crypto
    const missingC = cryptoPairs.filter(p => prices[p] === undefined)
    if (missingC.length > 0) {
      const krakenC = await tryGet('Kraken-crypto', () => fromKrakenCrypto(missingC))
      mergeMissing(prices, krakenC)
      if (Object.keys(krakenC).length > 0) sources.push('Kraken')
    }

    // Fallback CryptoCompare crypto
    const missingC2 = cryptoPairs.filter(p => prices[p] === undefined)
    if (missingC2.length > 0) {
      const cc = await tryGet('CryptoCompare', () => fromCryptoCompare(missingC2))
      mergeMissing(prices, cc)
      if (Object.keys(cc).length > 0) sources.push('CryptoCompare')
    }
  }

  if (Object.keys(prices).length === 0) return { prices: {}, source: 'error' }

  // Déduplique les sources pour l'affichage
  const uniqueSources = [...new Set(sources)]
  return { prices, source: uniqueSources.join(' + ') || 'inconnu' }
}
