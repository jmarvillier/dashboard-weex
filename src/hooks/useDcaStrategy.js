/**
 * useDcaStrategy.js
 * Calcul du signal DCA, de la dette et du prix moyen.
 * Aucun side-effect — fonctions pures + hook wrapper.
 */

/* ─────────────────────────────────────────────────────────────────────────
   Calcul du prix moyen pondéré depuis les ops pointées
   ops = [{ date, pair, sens, prix, usdt, vol, exec }]
   ───────────────────────────────────────────────────────────────────────── */
export function computeAvgPrice(pointedOps) {
  const buys = pointedOps.filter(o => o.sens === 'Achat' && o.exec && o.vol > 0)
  const totalVol   = buys.reduce((s, o) => s + o.vol,  0)
  const totalUsdt  = buys.reduce((s, o) => s + o.usdt, 0)
  return totalVol > 0 ? totalUsdt / totalVol : 0
}

/* ─────────────────────────────────────────────────────────────────────────
   Calcul de la dette accumulée
   ───────────────────────────────────────────────────────────────────────── */
export function computeDebt(plan, pointedOps) {
  const { baseAmount, frequency, startDate } = plan
  const start = new Date(startDate)
  const now   = new Date()
  if (isNaN(start.getTime())) return 0

  const PERIOD_MS = { day: 86400000, week: 604800000, month: 30 * 86400000 }
  const ms = PERIOD_MS[frequency] ?? PERIOD_MS.day

  const expectedPeriods = Math.max(0, Math.floor((now - start) / ms))
  const executedPeriods = pointedOps.filter(o => o.sens === 'Achat' && o.exec).length

  const missed = Math.max(0, expectedPeriods - executedPeriods)
  return missed * baseAmount
}

/* ─────────────────────────────────────────────────────────────────────────
   Calcul du signal du jour
   ───────────────────────────────────────────────────────────────────────── */
export function computeSignal(plan, currentPrice, avgPrice, debt) {
  if (!currentPrice || !avgPrice) {
    return { zone: 'UNKNOWN', action: 'hold', deployAmount: 0, label: 'Cours non disponible', description: 'Cours live indisponible pour cette paire.', sellPct: null, forceDebt: false }
  }

  const delta = (currentPrice - avgPrice) / avgPrice * 100

  // ── Mode distribution (bull run) ────────────────────────────────────────
  if (plan.bullThreshold && delta >= plan.bullThreshold) {
    const reached = (plan.profitZones || [])
      .filter(z => delta >= z.ecartThreshold)
      .sort((a, b) => b.ecartThreshold - a.ecartThreshold)
    const totalSell = reached.reduce((s, z) => s + z.positionPct, 0)
    const labels    = reached.map(z => z.label).join(', ')
    return {
      zone        : 'PROFIT',
      action      : 'sell',
      deployAmount: 0,
      label       : reached.length ? `Prise de profits — ${labels}` : `Bull run +${delta.toFixed(1)}%`,
      description : `Prix ${delta.toFixed(1)}% au-dessus de la moyenne. DCA suspendu. ${reached.length ? `Vendre ${totalSell}% de la position (paliers ${labels}).` : 'Aucun palier de vente atteint encore.'}`,
      sellPct     : totalSell,
      delta,
      forceDebt   : false,
    }
  }

  // ── Forçage si plafond de dette dépassé ─────────────────────────────────
  const forceDebt = plan.debtCeiling && debt >= plan.debtCeiling

  // ── Redistribution de dette ──────────────────────────────────────────────
  const activeDebtZone = (plan.debtZones || [])
    .filter(z => delta <= z.ecartThreshold)
    .sort((a, b) => a.ecartThreshold - b.ecartThreshold)[0] // le plus sévère

  // ── Zone d'accumulation normale ──────────────────────────────────────────
  const accZone = (plan.accZones || []).find(z => {
    const above = delta >= z.ecartMin
    const below = z.ecartMax === null || z.ecartMax === undefined || delta < z.ecartMax
    return above && below
  })

  const baseDeployAmount = accZone ? accZone.amount : (forceDebt ? plan.baseAmount : 0)

  // ── Montant avec redistribution de dette ────────────────────────────────
  let debtInject = 0
  if (activeDebtZone && debt > 0) {
    debtInject = debt * (activeDebtZone.debtPct / 100)
  }

  const deployAmount = baseDeployAmount + debtInject

  let label, description, zone
  if (activeDebtZone && debtInject > 0) {
    zone        = 'DEBT'
    label       = `${activeDebtZone.label} — Redistribution dette`
    description = `Prix ${Math.abs(delta).toFixed(1)}% sous la moyenne. ${activeDebtZone.label} actif : déployer ${baseDeployAmount.toFixed(2)} USDT + ${debtInject.toFixed(2)} USDT de dette (${activeDebtZone.debtPct}%).`
  } else if (accZone) {
    zone        = accZone.label
    const pct   = plan.baseAmount > 0 ? Math.round(accZone.amount / plan.baseAmount * 100) : 100
    label       = `Acheter ${pct}% — ${accZone.label}`
    description = delta < 0
      ? `Prix ${Math.abs(delta).toFixed(1)}% sous la moyenne. Zone optimale — déployer ${deployAmount.toFixed(2)} USDT.`
      : `Prix +${delta.toFixed(1)}% au-dessus. Zone ${accZone.label} active — déployer ${deployAmount.toFixed(2)} USDT.`
  } else if (forceDebt) {
    zone        = 'FORCE'
    label       = 'Achat forcé — plafond de dette atteint'
    description = `Plafond de ${plan.debtCeiling} USDT dépassé. Forçage d'achat à 100% : ${deployAmount.toFixed(2)} USDT.`
  } else {
    zone        = 'HOLD'
    label       = 'Accumuler la dette'
    description = `Prix +${delta.toFixed(1)}% au-dessus de la moyenne et hors zones actives. Aucune injection ce cycle.`
  }

  return { zone, action: deployAmount > 0 ? 'buy' : 'hold', deployAmount, debtInject, label, description, sellPct: null, delta, forceDebt, activeDebtZone: activeDebtZone || null }
}

/* ─────────────────────────────────────────────────────────────────────────
   Hook React
   ───────────────────────────────────────────────────────────────────────── */
import { useMemo } from 'react'

export function useDcaStrategy(plan, currentPrice, pointedOps) {
  return useMemo(() => {
    if (!plan) return null
    const ops      = pointedOps || []
    const avgPrice = computeAvgPrice(ops)
    const debt     = computeDebt(plan, ops)
    const signal   = computeSignal(plan, currentPrice, avgPrice, debt)
    const buys     = ops.filter(o => o.sens === 'Achat' && o.exec)
    const totalInvested = buys.reduce((s, o) => s + o.usdt, 0)
    const position      = buys.reduce((s, o) => s + o.vol, 0)
      - ops.filter(o => o.sens === 'Vente' && o.exec).reduce((s, o) => s + o.vol, 0)
    const breakeven     = position > 0 ? (totalInvested - ops.filter(o => o.sens === 'Vente' && o.exec).reduce((s, o) => s + o.usdt, 0)) / position : 0
    const pnlLatent     = currentPrice && position > 0 && breakeven > 0
      ? position * (currentPrice - breakeven) : 0
    const debtPct       = plan.debtCeiling ? Math.min(100, (debt / plan.debtCeiling) * 100) : 0
    return { signal, avgPrice, debt, debtPct, totalInvested, position, pnlLatent, breakeven }
  }, [plan, currentPrice, pointedOps])
}
