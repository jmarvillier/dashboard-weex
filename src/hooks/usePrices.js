import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchLivePrices } from '../lib/priceRepository.js'

const REFRESH_INTERVAL = 60_000  // 1 minute

export function usePrices(pairList) {
  const [prices,          setPrices]          = useState({})
  const [pricesLoading,   setPricesLoading]   = useState(false)
  const [pricesError,     setPricesError]     = useState(null)
  const [priceSource,     setPriceSource]     = useState(null)
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null)

  const timerRef   = useRef(null)
  const namesRef   = useRef([])

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
    } finally {
      setPricesLoading(false)
    }
  }, [])

  // ─── Clé stable : seulement les NOMS des paires ────────────────────────────
  // On utilise une string au lieu de l'objet pairList pour éviter que
  // enrichWithPrices() (qui crée de nouveaux objets) ne déclenche le cleanup
  // → suppression de l'intervalle à chaque rafraîchissement des prix.
  const namesKey = (pairList || []).map(p => p.name).sort().join(',')

  useEffect(() => {
    const names = namesKey ? namesKey.split(',') : []
    namesRef.current = names

    clearInterval(timerRef.current)

    if (names.length === 0) {
      setPrices({})
      timerRef.current = null
      return
    }

    // Premier fetch immédiat + intervalle régulier
    refresh(names)
    timerRef.current = setInterval(() => refresh(namesRef.current), REFRESH_INTERVAL)

    return () => {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [namesKey, refresh])  // ← dépend de la STRING, pas de l'objet

  return {
    prices,
    pricesLoading,
    pricesError,
    priceSource,
    lastPriceUpdate,
    refreshPrices: () => refresh(namesRef.current),
  }
}
