/**
 * useXperps.js
 * ─────────────────────────────────────────────────────────────────────────────
 * État du menu XPERPS : période sélectionnée + risque de référence (persisté en
 * localStorage, compatible Safari iPad) + agrégation mémoïsée des trades.
 *
 * `trades` est la liste déjà extraite du journal (extractXperpTrades), passée en
 * prop depuis useTrading — référence stable jusqu'au prochain chargement.
 */

import { useState, useMemo, useCallback } from 'react'
import { filterByPeriod, aggregateXperps } from '../lib/xperps.js'

const RISK_KEY = 'ydash-xperp-risk'
const DEFAULT_RISK = 10

function loadRisk() {
  try {
    const v = parseFloat(localStorage.getItem(RISK_KEY))
    return isNaN(v) || v <= 0 ? DEFAULT_RISK : v
  } catch { return DEFAULT_RISK }
}

export function useXperps(trades = []) {
  const [period, setPeriod]        = useState('semaine')
  const [refRisk, setRefRiskState] = useState(loadRisk)

  const setRefRisk = useCallback(v => {
    const n = parseFloat(v)
    const safe = isNaN(n) || n < 0 ? 0 : n
    setRefRiskState(safe)
    try { if (safe > 0) localStorage.setItem(RISK_KEY, String(safe)) } catch { /* Safari privé */ }
  }, [])

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period])
  const stats    = useMemo(() => aggregateXperps(filtered, refRisk || DEFAULT_RISK), [filtered, refRisk])

  return {
    period, setPeriod,
    refRisk, setRefRisk,
    filtered, stats,
    hasData: trades.length > 0,
    allCount: trades.length,
  }
}
