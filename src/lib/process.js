import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchLivePrices } from '../lib/priceRepository.js'

const REFRESH_INTERVAL = 60_000

export function usePrices(pairList) {
  const [prices, setPrices]               = useState({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError]     = useState(null)
  const [priceSource, setPriceSource]     = useState(null)
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null) // string HH:MM, pas un Date
  const timerRef = useRef(null)

  const refresh = useCallback(async (pairs) => {
    if (!pairs || pairs.length === 0) return
    setPricesLoading(true)
    setPricesError(null)
    try {
      const result = await fetchLivePrices(pairs.map(p => p.name))
      const { prices: data, source } = result || { prices: {}, source: 'error' }
      setPrices(data || {})
      setPriceSource(source || 'error')
      if (data && Object.keys(data).length > 0) {
        // Stocke une string fixe, pas un objet Date qui change à chaque render
        const now = new Date()
        setLastPriceUpdate(
          now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        )
        setPricesError(null)
      } else {
        setPricesError('Aucun cours disponible')
      }
    } catch (err) {
      console.warn('[usePrices] error:', err)
      setPricesError('Erreur de chargement')
      setPriceSource('error')
      setPrices({})
    } finally {
      setPricesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pairList || pairList.length === 0) {
      setPrices({})
      clearInterval(timerRef.current)
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
    lastPriceUpdate,  // string 'HH:MM' ou null
    refreshPrices: () => refresh(pairList),
  }
}
