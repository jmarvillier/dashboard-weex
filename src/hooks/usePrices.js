import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchLivePrices } from '../lib/priceRepository.js'

const REFRESH_INTERVAL = 60_000

export function usePrices(pairList) {
  const [prices, setPrices]           = useState({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState(null)
  const [priceSource, setPriceSource] = useState(null)
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null)
  const timerRef    = useRef(null)
  const namesRef    = useRef([])  // on compare les noms, pas les objets

  const refresh = useCallback(async (names) => {
    if (!names || names.length === 0) return
    setPricesLoading(true)
    try {
      const result = await fetchLivePrices(names)
      const { prices: data, source } = result || { prices: {}, source: 'error' }
      setPrices(data || {})
      setPriceSource(source || 'error')
      if (data && Object.keys(data).length > 0) {
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
  }, []) // aucune dépendance — refresh est stable

  useEffect(() => {
    // Compare uniquement les noms de paires, pas les objets entiers
    const names = (pairList || []).map(p => p.name)
    const prev  = namesRef.current

    const changed =
      names.length !== prev.length ||
      names.some((n, i) => n !== prev[i])

    if (!changed) return  // pairList enrichie → on ignore

    namesRef.current = names
    clearInterval(timerRef.current)

    if (names.length === 0) {
      setPrices({})
      return
    }

    refresh(names)
    timerRef.current = setInterval(() => refresh(namesRef.current), REFRESH_INTERVAL)

    return () => clearInterval(timerRef.current)
  }, [pairList, refresh])

  return {
    prices,
    pricesLoading,
    pricesError,
    priceSource,
    lastPriceUpdate,
    refreshPrices: () => refresh(namesRef.current),
  }
}
