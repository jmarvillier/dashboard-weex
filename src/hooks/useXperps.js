/**
 * useXperps.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Charge les trades XPERP depuis la collection Firestore `users/{uid}/xperps`
 * (via xperpsRepository), gère la période et l'agrégation mémoïsée. Le R est
 * EXACT (figé dans chaque document) : plus de risque de référence à saisir.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { listXperps } from '../lib/xperpsRepository.js'
import { filterByPeriod, aggregateXperps } from '../lib/xperps.js'

export function useXperps() {
  const [docs, setDocs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [period, setPeriod]   = useState('semaine')

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const d = await listXperps()
      setDocs(Array.isArray(d) ? d : [])
    } catch (e) {
      setError(e?.message || 'Erreur de chargement')
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const filtered = useMemo(() => filterByPeriod(docs, period), [docs, period])
  const stats    = useMemo(() => aggregateXperps(filtered), [filtered])

  return {
    period, setPeriod,
    docs, filtered, stats,
    loading, error, reload,
    hasData: docs.length > 0,
    allCount: docs.length,
  }
}
