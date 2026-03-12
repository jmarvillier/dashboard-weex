/**
 * usePrices.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook qui gère le cycle de vie des prix live.
 * Rafraîchit toutes les 60s tant que le dashboard est actif.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchLivePrices } from '../lib/priceRepository.js'

const REFRESH_INTERVAL = 60_000

export function usePrices(pairList) {
  const [prices, setPrices]               = useState({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError]     = useState(null)
  const [priceSource, setPriceSource]     = useState(null)   // 'Binance' | 'CoinGecko' | 'error'
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null)
  const timerRef = useRef(null)

  const refresh = useCallback(async (pairs) => {
    if (!pairs || pairs.length === 0) return
    setPricesLoading(true)
    setPricesError(null)
    try {
      const { prices: result, source } = await fetchLivePrices(pairs.map(p => p.name))
      setPrices(result)
      setPriceSource(source)
      if (Object.keys(result).length > 0) {
        setLastPriceUpdate(new Date())
      } else {
        setPricesError('Aucun cours disponible (Binance + CoinGecko hors ligne)')
      }
    } catch (err) {
      setPricesError(err.message)
      setPriceSource('error')
    } finally {
      setPricesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pairList || pairList.length === 0) {
      setPrices({})
      return
    }

    refresh(pairList)
    timerRef.current = setInterval(() => refresh(pairList), REFRESH_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [pairList, refresh])

  return {
    prices,
    pricesLoading,
    pricesError,
    priceSource,
    lastPriceUpdate,
    refreshPrices: () => refresh(pairList),
  }
}
