/**
 * usePrices.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook qui gère le cycle de vie des prix live.
 * Rafraîchit toutes les 60s tant que le dashboard est actif.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchLivePrices } from '../lib/priceRepository.js'

const REFRESH_INTERVAL = 60_000 // 60 secondes

export function usePrices(pairList) {
  const [prices, setPrices]         = useState({})   // { 'BTC/USDT': 67500, ... }
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError]     = useState(null)
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null)
  const timerRef = useRef(null)

  const refresh = useCallback(async (pairs) => {
    if (!pairs || pairs.length === 0) return
    setPricesLoading(true)
    setPricesError(null)
    try {
      const result = await fetchLivePrices(pairs.map(p => p.name))
      setPrices(result)
      setLastPriceUpdate(new Date())
    } catch (err) {
      setPricesError(err.message)
    } finally {
      setPricesLoading(false)
    }
  }, [])

  // Démarre/redémarre le polling quand pairList change
  useEffect(() => {
    if (!pairList || pairList.length === 0) {
      setPrices({})
      return
    }

    refresh(pairList)

    timerRef.current = setInterval(() => refresh(pairList), REFRESH_INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [pairList, refresh])

  return { prices, pricesLoading, pricesError, lastPriceUpdate, refreshPrices: () => refresh(pairList) }
}
