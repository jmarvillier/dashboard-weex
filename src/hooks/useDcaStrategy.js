/**
 * useDcaStrategy.js — v3
 * Renommage dette → rechargement DCA.
 * Calcul rechargement : shortfalls par période (manquées + achats partiels) − remboursements.
 */

import { useMemo } from 'react'

/* ─── Breakeven ─────────────────────────────────────────────────────────── */
export function computeBreakeven(pointedOps) {
  const buys  = pointedOps.filter(o => o.sens === 'Achat' && o.exec)
  const sells = pointedOps.filter(o => o.sens === 'Vente' && o.exec)
  const volBought  = buys.reduce((s, o)  => s + (o.vol  || 0), 0)
  const volSold    = sells.reduce((s, o) => s + (o.vol  || 0), 0)
  const netPos     = volBought - volSold
  const totalInv   = buys.reduce((s, o)  => s + (o.usdt || 0), 0)
  const sellRev    = sells.reduce((s, o) => s + (o.usdt || 0), 0)
  const netInv     = Math.max(0, totalInv - sellRev)
  if (netPos > 0) return netInv / netPos
  if (volBought > 0) return totalInv / volBought
  return 0
}

/* ─── Prix moyen d'achat ────────────────────────────────────────────────── */
export function computeAvgPrice(pointedOps) {
  const buys    = pointedOps.filter(o => o.sens === 'Achat' && o.exec && o.vol > 0)
  const vol     = buys.reduce((s, o) => s + o.vol,  0)
  const usdt    = buys.reduce((s, o) => s + o.usdt, 0)
  return vol > 0 ? usdt / vol : 0
}

/* ─── Date de début effective ───────────────────────────────────────────── */
export function getEffectiveStart(plan, pointedOps) {
  if (plan.startDate) {
    const d = new Date(plan.startDate)
    if (!isNaN(d.getTime())) return d
  }
  const buyOps = pointedOps.filter(o => o.sens === 'Achat' && o.exec && o.date)
  if (buyOps.length > 0)
    return new Date(Math.min(...buyOps.map(o => o.date.getTime())))
  return null
}

const PERIOD_MS = { day: 86400000, week: 604800000, month: 30 * 86400000 }

/* ─── Rechargement DCA disponible ──────────────────────────────────────────
   = Σ sur chaque période (max(0, baseAmount − acheté))
   − Σ des remboursements (ops avec recharge=true)
   Calcul inclut les achats partiels (ex: acheté 2 au lieu de 10 → +8)
   ─────────────────────────────────────────────────────────────────────────── */
export function computeRechargement(plan, pointedOps) {
  const baseAmount = plan.baseAmount || 10
  const ms         = PERIOD_MS[plan.frequency || 'day'] || PERIOD_MS.day
  const start      = getEffectiveStart(plan, pointedOps)
  if (!start) return { total: 0, missed: 0 }

  const now           = new Date()
  const totalPeriods  = Math.max(0, Math.floor((now.getTime() - start.getTime()) / ms))
  let rechargeBrut    = 0
  let missedPeriods   = 0

  for (let i = 0; i < totalPeriods; i++) {
    const pStart = new Date(start.getTime() + i * ms)
    const pEnd   = new Date(start.getTime() + (i + 1) * ms)

    // Achats normaux DCA (non-rechargement) dans cette période
    const buysInPeriod = pointedOps.filter(o =>
      o.sens === 'Achat' && o.exec && !o.recharge &&
      o.date && o.date >= pStart && o.date < pEnd
    )
    const bought    = buysInPeriod.reduce((s, o) => s + (o.usdt || 0), 0)
    const shortfall = Math.max(0, baseAmount - bought)

    if (bought === 0) missedPeriods++
    rechargeBrut += shortfall
  }

  // Remboursements déjà déployés (ops avec flag recharge=true)
  const rechargeDeploye = pointedOps
    .filter(o => o.recharge && o.sens === 'Achat' && o.exec)
    .reduce((s, o) => s + (o.usdt || 0), 0)

  const total = Math.max(0, rechargeBrut - rechargeDeploye)
  return { total, missed: missedPeriods, brut: rechargeBrut, deploye: rechargeDeploye }
}

/* ─── Ops du cycle en cours ─────────────────────────────────────────────── */
export function getCurrentPeriodOps(plan, pointedOps) {
  const ms    = PERIOD_MS[plan.frequency || 'day'] || PERIOD_MS.day
  const start = getEffectiveStart(plan, pointedOps)
  if (!start) return { buys: [], sells: [], totalBought: 0, totalSold: 0 }
  const now          = new Date()
  const elapsed      = now.getTime() - start.getTime()
  const currentIdx   = Math.max(0, Math.floor(elapsed / ms))
  const periodStart  = new Date(start.getTime() + currentIdx * ms)
  const periodEnd    = new Date(periodStart.getTime() + ms)

  const ops   = pointedOps.filter(o => o.exec && o.date && o.date >= periodStart && o.date < periodEnd)
  const buys  = ops.filter(o => o.sens === 'Achat')
  const sells = ops.filter(o => o.sens === 'Vente')
  return {
    buys,
    sells,
    totalBought : buys.reduce((s, o)  => s + (o.usdt || 0), 0),
    totalSold   : sells.reduce((s, o) => s + (o.usdt || 0), 0),
    periodStart,
    periodEnd,
  }
}

/* ─── Timeline ───────────────────────────────────────────────────────────── */
export function generateTimeline(plan, pointedOps, slots = 15) {
  const baseAmount = plan.baseAmount || 10
  const ms         = PERIOD_MS[plan.frequency || 'day'] || PERIOD_MS.day
  const start      = getEffectiveStart(plan, pointedOps)
  if (!start) return []

  const now           = new Date()
  const totalExpected = Math.max(1, Math.floor((now.getTime() - start.getTime()) / ms) + 1)
  const firstIdx      = Math.max(0, totalExpected - slots)
  const result        = []

  for (let i = firstIdx; i < totalExpected; i++) {
    const pStart  = new Date(start.getTime() + i * ms)
    const pEnd    = new Date(start.getTime() + (i + 1) * ms)
    const isFuture = pEnd > now

    const opsInPeriod = pointedOps.filter(o =>
      o.exec && o.date && o.date >= pStart && o.date < pEnd
    )
    const buys  = opsInPeriod.filter(o => o.sens === 'Achat')
    const sells = opsInPeriod.filter(o => o.sens === 'Vente')

    if (isFuture) {
      result.push({ type: 'future', date: pStart, idx: i })
    } else if (buys.length > 0) {
      const amount = buys.reduce((s, o) => s + (o.usdt || 0), 0)
      const pct    = baseAmount > 0 ? Math.round(amount / baseAmount * 100) : 100
      result.push({ type: 'bought', date: pStart, pct, amount, idx: i })
    } else if (sells.length > 0) {
      result.push({ type: 'sell', date: pStart, idx: i })
    } else {
      result.push({ type: 'missed', date: pStart, idx: i })
    }
  }
  return result
}

/* ─── Signal ─────────────────────────────────────────────────────────────── */
export function computeSignal(plan, currentPrice, breakeven, rechargement) {
  const rechargeTotal = rechargement?.total ?? 0
  if (!currentPrice || !breakeven) {
    return { zone: 'UNKNOWN', action: 'hold', deployAmount: 0, label: 'Cours non disponible', description: 'Cours live indisponible.', sellPct: null, forceRecharge: false }
  }

  const delta = (currentPrice - breakeven) / breakeven * 100

  // ── Bull run / Distribution ──────────────────────────────────────────────
  if (plan.bullThreshold && delta >= plan.bullThreshold) {
    const reached   = (plan.profitZones || []).filter(z => delta >= (parseFloat(z.ecartThreshold) || 0)).sort((a, b) => b.ecartThreshold - a.ecartThreshold)
    const totalSell = reached.reduce((s, z) => s + (z.positionPct || 0), 0)
    const labels    = reached.map(z => z.label).join(', ')
    return {
      zone: 'PROFIT', action: 'sell', deployAmount: 0,
      label: reached.length ? `Prise de profits — ${labels}` : `Bull run +${delta.toFixed(1)}%`,
      description: `Prix ${delta.toFixed(1)}% au-dessus du breakeven. DCA suspendu.${reached.length ? ` Vendre ${totalSell}% de la position.` : ''}`,
      sellPct: totalSell, delta, forceRecharge: false,
    }
  }

  // ── Forçage si rechargement DCA max dépassé ──────────────────────────────
  const forceRecharge = plan.debtCeiling && rechargeTotal >= plan.debtCeiling

  // ── Zone de redistribution de rechargement ───────────────────────────────
  const activeDebtZone = (plan.debtZones || [])
    .filter(z => delta <= (parseFloat(z.ecartThreshold) || 0))
    .sort((a, b) => (parseFloat(a.ecartThreshold) || 0) - (parseFloat(b.ecartThreshold) || 0))[0] || null

  // ── Zone d'accumulation ──────────────────────────────────────────────────
  const accZone = (plan.accZones || []).find(z => {
    const min = z.ecartMin == null || z.ecartMin === '' ? -Infinity : parseFloat(z.ecartMin)
    const max = z.ecartMax == null || z.ecartMax === '' ? Infinity  : parseFloat(z.ecartMax)
    return delta >= min && delta < max
  })

  const base       = forceRecharge && !accZone ? (plan.baseAmount || 10) : (accZone ? accZone.amount : 0)
  const rechargeInject = activeDebtZone && rechargeTotal > 0 ? rechargeTotal * ((parseFloat(activeDebtZone.debtPct) || 0) / 100) : 0
  const deployAmount   = base + rechargeInject

  let label, description, zone
  if (activeDebtZone && rechargeInject > 0) {
    zone        = 'RECHARGE'
    label       = `${activeDebtZone.label} — Redistribution rechargement`
    description = `Prix ${Math.abs(delta).toFixed(1)}% sous le breakeven. Injecter ${base.toFixed(2)} USDT + ${rechargeInject.toFixed(2)} USDT de rechargement (${activeDebtZone.debtPct}%).`
  } else if (accZone) {
    const pctAmt = plan.baseAmount > 0 ? Math.round(accZone.amount / plan.baseAmount * 100) : 100
    zone        = accZone.label
    label       = `Acheter ${pctAmt}% — ${accZone.label}`
    description = delta < 0
      ? `Prix ${Math.abs(delta).toFixed(1)}% sous le breakeven. Zone optimale — déployer ${deployAmount.toFixed(2)} USDT.`
      : `Prix +${delta.toFixed(1)}% au-dessus du breakeven. Zone ${accZone.label} — déployer ${deployAmount.toFixed(2)} USDT.`
  } else if (forceRecharge) {
    zone        = 'FORCE'
    label       = 'Achat forcé — plafond de rechargement atteint'
    description = `Plafond de ${plan.debtCeiling} USDT atteint. Forçage d'achat : ${deployAmount.toFixed(2)} USDT.`
  } else {
    zone        = 'HOLD'
    label       = 'Alimenter le rechargement DCA'
    description = `Prix +${delta.toFixed(1)}% au-dessus du breakeven. Aucune injection ce cycle — rechargement en cours d'accumulation.`
  }

  return { zone, action: deployAmount > 0 ? 'buy' : 'hold', deployAmount, base, rechargeInject, label, description, sellPct: null, delta, forceRecharge, activeDebtZone }
}

/* ─── Hook React ─────────────────────────────────────────────────────────── */
export function useDcaStrategy(plan, currentPrice, pointedOps) {
  return useMemo(() => {
    if (!plan) return null
    const ops         = pointedOps || []
    const breakeven   = computeBreakeven(ops)
    const avgPrice    = computeAvgPrice(ops)
    const rechargement = computeRechargement(plan, ops)
    const signal      = computeSignal(plan, currentPrice, breakeven, rechargement)
    const buys        = ops.filter(o => o.sens === 'Achat' && o.exec)
    const sells       = ops.filter(o => o.sens === 'Vente' && o.exec)
    const totalInvested  = buys.reduce((s, o) => s + o.usdt, 0)
    const volBought      = buys.reduce((s, o) => s + (o.vol || 0), 0)
    const volSold        = sells.reduce((s, o) => s + (o.vol || 0), 0)
    const position       = volBought - volSold
    const pnlLatent      = currentPrice && position > 0 && breakeven > 0 ? position * (currentPrice - breakeven) : 0
    const rechargePct    = plan.debtCeiling ? Math.min(100, (rechargement.total / plan.debtCeiling) * 100) : 0
    return { signal, breakeven, avgPrice, rechargement, rechargePct, totalInvested, position, pnlLatent }
  }, [plan, currentPrice, pointedOps])
}
