/**
 * useDcaStrategy.js — v2
 * Logique métier DCA : breakeven, dette, signal, timeline
 */

import { useMemo } from 'react'

/* ─── Breakeven (coût de revient réel après ventes partielles) ────────────── */
export function computeBreakeven(pointedOps) {
  const buys  = pointedOps.filter(o => o.sens === 'Achat' && o.exec)
  const sells = pointedOps.filter(o => o.sens === 'Vente' && o.exec)
  const totalVolBought = buys.reduce((s, o) => s + (o.vol || 0), 0)
  const totalVolSold   = sells.reduce((s, o) => s + (o.vol || 0), 0)
  const netPosition    = totalVolBought - totalVolSold
  const totalInvested  = buys.reduce((s, o) => s + (o.usdt || 0), 0)
  const sellRevenue    = sells.reduce((s, o) => s + (o.usdt || 0), 0)
  const netInvested    = Math.max(0, totalInvested - sellRevenue)
  if (netPosition > 0) return netInvested / netPosition
  if (totalVolBought > 0) return totalInvested / totalVolBought
  return 0
}

/* ─── Prix moyen d'achat pondéré (sans tenir compte des ventes) ──────────── */
export function computeAvgPrice(pointedOps) {
  const buys     = pointedOps.filter(o => o.sens === 'Achat' && o.exec && o.vol > 0)
  const totalVol  = buys.reduce((s, o) => s + o.vol,  0)
  const totalUsdt = buys.reduce((s, o) => s + o.usdt, 0)
  return totalVol > 0 ? totalUsdt / totalVol : 0
}

/* ─── Date de début effective ────────────────────────────────────────────── */
export function getEffectiveStart(plan, pointedOps) {
  if (plan.startDate) {
    const d = new Date(plan.startDate)
    if (!isNaN(d.getTime())) return d
  }
  // Fallback : première opération d'achat pointée
  const buyOps = pointedOps.filter(o => o.sens === 'Achat' && o.exec && o.date)
  if (buyOps.length > 0) {
    return new Date(Math.min(...buyOps.map(o => o.date.getTime())))
  }
  return null
}

/* ─── Calcul de la dette (périodes manquées × montant de base) ───────────── */
export function computeDebt(plan, pointedOps) {
  const baseAmount = plan.baseAmount || 10
  const frequency  = plan.frequency || 'day'
  const PERIOD_MS  = { day: 86400000, week: 604800000, month: 30 * 86400000 }
  const ms         = PERIOD_MS[frequency] || PERIOD_MS.day

  const start = getEffectiveStart(plan, pointedOps)
  if (!start) return 0

  const now             = new Date()
  const expectedPeriods = Math.max(0, Math.floor((now.getTime() - start.getTime()) / ms))

  // Compter les périodes distinctes où un achat a eu lieu
  const boughtPeriods = new Set()
  pointedOps
    .filter(o => o.sens === 'Achat' && o.exec && o.date)
    .forEach(op => {
      const idx = Math.floor((op.date.getTime() - start.getTime()) / ms)
      if (idx >= 0 && idx < expectedPeriods) boughtPeriods.add(idx)
    })

  const missed = Math.max(0, expectedPeriods - boughtPeriods.size)
  return missed * baseAmount
}

/* ─── Timeline : dernières N périodes avec statut ────────────────────────── */
export function generateTimeline(plan, pointedOps, slots = 15) {
  const baseAmount = plan.baseAmount || 10
  const frequency  = plan.frequency || 'day'
  const PERIOD_MS  = { day: 86400000, week: 604800000, month: 30 * 86400000 }
  const ms         = PERIOD_MS[frequency] || PERIOD_MS.day

  const start = getEffectiveStart(plan, pointedOps)
  if (!start) return []

  const now           = new Date()
  const totalExpected = Math.max(1, Math.floor((now.getTime() - start.getTime()) / ms) + 1)
  const firstIdx      = Math.max(0, totalExpected - slots)
  const result        = []

  for (let i = firstIdx; i < totalExpected; i++) {
    const periodStart = new Date(start.getTime() + i * ms)
    const periodEnd   = new Date(start.getTime() + (i + 1) * ms)
    const isFuture    = periodEnd > now

    const opsInPeriod = pointedOps.filter(o => {
      if (!o.date || !o.exec) return false
      return o.date >= periodStart && o.date < periodEnd
    })

    const buysInPeriod  = opsInPeriod.filter(o => o.sens === 'Achat')
    const sellsInPeriod = opsInPeriod.filter(o => o.sens === 'Vente')

    if (isFuture) {
      result.push({ type: 'future', date: periodStart, idx: i })
    } else if (buysInPeriod.length > 0) {
      const total = buysInPeriod.reduce((s, o) => s + (o.usdt || 0), 0)
      const pct   = baseAmount > 0 ? Math.round(total / baseAmount * 100) : 100
      result.push({ type: 'bought', date: periodStart, pct, amount: total, idx: i })
    } else if (sellsInPeriod.length > 0 && buysInPeriod.length === 0) {
      result.push({ type: 'sell', date: periodStart, idx: i })
    } else {
      result.push({ type: 'missed', date: periodStart, idx: i })
    }
  }

  return result
}

/* ─── Signal du jour ────────────────────────────────────────────────────────── */
export function computeSignal(plan, currentPrice, breakeven, debt) {
  if (!currentPrice || !breakeven) {
    return { zone: 'UNKNOWN', action: 'hold', deployAmount: 0, label: 'Cours non disponible', description: 'Cours live indisponible pour cette paire.', sellPct: null, forceDebt: false }
  }

  const delta = (currentPrice - breakeven) / breakeven * 100

  // ── Mode distribution (bull run) ─────────────────────────────────────────
  if (plan.bullThreshold && delta >= plan.bullThreshold) {
    const reached    = (plan.profitZones || []).filter(z => delta >= z.ecartThreshold).sort((a, b) => b.ecartThreshold - a.ecartThreshold)
    const totalSell  = reached.reduce((s, z) => s + z.positionPct, 0)
    const labels     = reached.map(z => z.label).join(', ')
    return {
      zone: 'PROFIT', action: 'sell', deployAmount: 0,
      label: reached.length ? `Prise de profits — ${labels}` : `Bull run +${delta.toFixed(1)}%`,
      description: `Prix ${delta.toFixed(1)}% au-dessus du breakeven. DCA suspendu.${reached.length ? ` Vendre ${totalSell}% de la position (${labels}).` : ''}`,
      sellPct: totalSell, delta, forceDebt: false,
    }
  }

  // ── Forçage si plafond de dette dépassé ─────────────────────────────────
  const forceDebt = plan.debtCeiling && debt >= plan.debtCeiling

  // ── Redistribution de dette ─────────────────────────────────────────────
  const activeDebtZone = (plan.debtZones || [])
    .filter(z => delta <= z.ecartThreshold)
    .sort((a, b) => a.ecartThreshold - b.ecartThreshold)[0] || null

  // ── Zone d'accumulation ─────────────────────────────────────────────────
  const accZone = (plan.accZones || []).find(z => {
    const above = delta >= (z.ecartMin ?? -Infinity)
    const below = z.ecartMax == null || delta < z.ecartMax
    return above && below
  })

  const base       = forceDebt && !accZone ? (plan.baseAmount || 10) : (accZone ? accZone.amount : 0)
  const debtInject = activeDebtZone && debt > 0 ? debt * (activeDebtZone.debtPct / 100) : 0
  const deployAmount = base + debtInject

  let label, description, zone
  if (activeDebtZone && debtInject > 0) {
    zone        = 'DEBT'
    label       = `${activeDebtZone.label} — Redistribution dette`
    description = `Prix ${Math.abs(delta).toFixed(1)}% sous le breakeven. Injecter ${base.toFixed(2)} USDT + ${debtInject.toFixed(2)} USDT de dette (${activeDebtZone.debtPct}%).`
  } else if (accZone) {
    const pct = plan.baseAmount > 0 ? Math.round(accZone.amount / plan.baseAmount * 100) : 100
    zone        = accZone.label
    label       = `Acheter ${pct}% — ${accZone.label}`
    description = delta < 0
      ? `Prix ${Math.abs(delta).toFixed(1)}% sous le breakeven. Zone optimale — déployer ${deployAmount.toFixed(2)} USDT.`
      : `Prix +${delta.toFixed(1)}% au-dessus du breakeven. Zone ${accZone.label} — déployer ${deployAmount.toFixed(2)} USDT.`
  } else if (forceDebt) {
    zone        = 'FORCE'
    label       = 'Achat forcé — plafond de dette atteint'
    description = `Plafond de ${plan.debtCeiling} USDT dépassé. Forçage d'achat : ${deployAmount.toFixed(2)} USDT.`
  } else {
    zone        = 'HOLD'
    label       = 'Accumuler la dette'
    description = `Prix +${delta.toFixed(1)}% au-dessus du breakeven et hors zones actives. Aucune injection ce cycle.`
  }

  return { zone, action: deployAmount > 0 ? 'buy' : 'hold', deployAmount, base, debtInject, label, description, sellPct: null, delta, forceDebt, activeDebtZone }
}

/* ─── Hook React ──────────────────────────────────────────────────────────── */
export function useDcaStrategy(plan, currentPrice, pointedOps) {
  return useMemo(() => {
    if (!plan) return null
    const ops           = pointedOps || []
    const breakeven     = computeBreakeven(ops)
    const avgPrice      = computeAvgPrice(ops)
    const debt          = computeDebt(plan, ops)
    const signal        = computeSignal(plan, currentPrice, breakeven, debt)
    const buys          = ops.filter(o => o.sens === 'Achat' && o.exec)
    const sells         = ops.filter(o => o.sens === 'Vente' && o.exec)
    const totalInvested = buys.reduce((s, o) => s + o.usdt, 0)
    const totalVolBought = buys.reduce((s, o) => s + (o.vol || 0), 0)
    const totalVolSold   = sells.reduce((s, o) => s + (o.vol || 0), 0)
    const position       = totalVolBought - totalVolSold
    const pnlLatent      = currentPrice && position > 0 && breakeven > 0
      ? position * (currentPrice - breakeven) : 0
    const debtPct        = plan.debtCeiling ? Math.min(100, (debt / plan.debtCeiling) * 100) : 0
    return { signal, breakeven, avgPrice, debt, debtPct, totalInvested, position, pnlLatent }
  }, [plan, currentPrice, pointedOps])
}
